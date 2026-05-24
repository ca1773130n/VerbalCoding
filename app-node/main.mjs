import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import { buildAgentSettings, createAgentAdapter, isPatchLikeOutput, shellSplit } from './agent_adapters.mjs';
import {
  appendJsonl,
  createLatencyTurn,
  formatLatencySummary,
  readJsonlRecords,
  summarizeLatencyRecords,
} from './latency_metrics.mjs';
import {
  isPlanEntryUtterance,
  parsePlanOutput,
  parseVoiceCommand as parsePlanVoiceCommand,
  applyCommand as applyPlanCommand,
  renderFinalPlan,
  planModePreamble,
  planExecutionPreamble,
  parseDecisionAnswer,
  renderDecisionPrompt,
  renderResolvedDecisions,
} from './plan_mode.mjs';
import {
  parseAgentRoutingCommand,
  renderAgentPrefix,
  buildCrossAgentPrompt,
  isAgentRoutingDecision,
  buildFallbackDecision,
  isRoutingOnlyUtterance,
} from './agent_routing.mjs';
import { createSessionOntology } from './session_ontology.mjs';
import { parseResearchCommand, runResearchTurn } from './research_mode.mjs';
import { buildTtsSettings } from './tts_settings.mjs';
import { createTtsBackend } from './tts_backends.mjs';
import {
  applyTtsVoiceSelectionToEnv,
  defaultTtsVoiceConfig,
  effectiveTtsVoiceSelection,
  preferredVoiceTypeForLanguage,
  readTtsVoiceConfig,
  updateTtsVoiceConfig,
  voiceCommandFromTranscript,
  writeTtsVoiceConfig,
} from './tts_voice_config.mjs';
import { createBridgeLogger, createTransientErrorReporter, isTransientNetworkError } from './bridge_logger.mjs';
import { createBridgeState } from './bridge_state.mjs';
import { createBridge } from './bridge_context.mjs';
import { createVoiceIO } from './voice_io.mjs';
import { createTtsPlayer } from './tts_player.mjs';
import { createUtteranceRouter } from './utterance_router.mjs';
import { createProgressHandler } from './progress_handler.mjs';
import { createNotificationHandler } from './notification_handler.mjs';
import { createTtsRuntime } from './tts_runtime.mjs';
import { pickOccupiedUserVoiceChannel, shouldFollowUserVoiceChannel } from './voice_autojoin.mjs';
import { sendDiscordText, splitDiscordMessage } from './discord_text.mjs';
import { shouldPassWhisperLanguage, voiceLanguageCommandFromTranscript, languagePreset } from './language_config.mjs';
import { whisperFailureMessage, whisperTimeoutMs } from './stt_whisper.mjs';
import { formatRestartCompleteNotice, formatRestartShutdownNotice } from './restart_notice.mjs';
import {
  appendRecentDiscordText,
  formatRecentDiscordContext,
  shouldRouteDiscordTextToAgent,
} from './text_routing.mjs';
import {
  bindProjectSessionToChannel,
  createProjectSession,
  listProjectSessions,
  loadProjectSessions,
  parseProjectSessionCommand,
  projectSessionContextText,
  projectSessionForChannel,
  saveProjectSessions,
} from './project_sessions.mjs';
import {
  agentAnswerHeader,
  emptyAgentAnswer,
  formatSttResultMessage,
  formatSttStartMessage,
  formatVoiceErrorMessage,
  formatWakeRejectedMessage,
  sensitivityChangedSpeech,
  sensitivityStatusTextForLanguage,
  verboseChangedSpeech,
  verboseStatusTextForLanguage,
} from './voice_messages.mjs';
import { enqueueDeferredUtterance } from './deferred_queue.mjs';
import {
  createVoiceCloneCaptureState,
  saveVoiceCloneReference,
  voiceCloneCommandFromText,
} from './voice_clone_capture.mjs';
import {
  bargeInThresholdsForMode,
  createLiveBargeInMonitor,
  isBargeInCandidate as isValidatedBargeInCandidate,
  isExplicitBargeInTranscript,
  isRepeatedNoiseTranscript,
  sensitivityModeFromTranscript,
  shouldUseLivePlaybackBargeIn,
} from './barge_in.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadDotEnv(file = path.join(ROOT, '.env'), { override = true } = {}) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim().replace(/^export\s+/, '');
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
    }
    if (key && (override || !(key in process.env))) process.env[key] = value;
  }
}

function loadRuntimeEnv() {
  const instanceEnv = process.env.VERBALCODING_INSTANCE_ENV || '';
  loadDotEnv(path.join(ROOT, '.env'), { override: !instanceEnv });
  if (instanceEnv) loadDotEnv(instanceEnv, { override: true });
}

function loadZshrcExports() {
  const zshrc = path.join(os.homedir(), '.zshrc');
  if (!fs.existsSync(zshrc)) return;
  const text = fs.readFileSync(zshrc, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('export ') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice('export '.length, idx).trim();
    if (process.env[key]) continue;
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) process.env[key] = value;
  }
}

loadZshrcExports();
loadRuntimeEnv();

const TTS_VOICE_CONFIG_PATH = process.env.TTS_VOICE_CONFIG || path.join(ROOT, 'config', 'tts-voices.json');
function ensureTtsVoiceConfig() {
  if (!fs.existsSync(TTS_VOICE_CONFIG_PATH)) {
    writeTtsVoiceConfig(TTS_VOICE_CONFIG_PATH, defaultTtsVoiceConfig());
  }
  return readTtsVoiceConfig(TTS_VOICE_CONFIG_PATH);
}
function applyVoiceConfigToProcessEnv(config = ensureTtsVoiceConfig()) {
  const selection = effectiveTtsVoiceSelection(config, process.env);
  const configuredVoiceLanguage = process.env.VOICE_LANGUAGE;
  const nextEnv = applyTtsVoiceSelectionToEnv(process.env, selection);
  if (configuredVoiceLanguage) nextEnv.VOICE_LANGUAGE = configuredVoiceLanguage;
  for (const [key, value] of Object.entries(nextEnv)) process.env[key] = value;
  return { config, selection };
}
function rebuildTtsRuntimeSettings(selection = null) {
  settings.tts = buildTtsSettings(process.env, ROOT);
  if (selection?.backend === 'edge' && selection.voice?.voice) settings.tts.edge.voice = selection.voice.voice;
  try { bridge.ttsBackend?.close?.(); } catch (e) { warn('tts backend close failed', e?.message || e); }
  bridge.ttsBackend = createTtsBackend(settings.tts, { execFileAsync, spawn, log, warn, onFallback: ttsFallbackNotice, voiceProvider: () => settings.tts.edge.voice });
  return settings.tts;
}
function reloadRuntimeLanguageFromEnv() {
  const previousWhisperLanguage = settings?.whisperLanguage;
  const previousVoiceLanguage = settings?.voiceLanguage;
  loadRuntimeEnv();
  settings.whisperLanguage = process.env.WHISPER_CPP_LANGUAGE || process.env.STT_LANGUAGE || settings.whisperLanguage || 'ko';
  settings.voiceLanguage = process.env.VOICE_LANGUAGE || process.env.WHISPER_CPP_LANGUAGE || process.env.STT_LANGUAGE || settings.voiceLanguage || 'ko';
  const changed = previousWhisperLanguage !== undefined && (
    previousWhisperLanguage !== settings.whisperLanguage || previousVoiceLanguage !== settings.voiceLanguage
  );
  if (changed) discardVoiceInputQueues('external-language-change');
  return { whisperLanguage: settings.whisperLanguage, voiceLanguage: settings.voiceLanguage, changed };
}
applyVoiceConfigToProcessEnv();

const settings = {
  token: process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN,
  allowedUsers: new Set((process.env.DISCORD_ALLOWED_USERS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean)),
  autoJoinVoiceChannels: (process.env.AUTO_JOIN_VOICE_CHANNELS || '일반,General,general').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  transcriptChannelId: (process.env.TRANSCRIPT_CHANNEL_ID || '').trim(),
  whisperBin: process.env.WHISPER_CPP_BIN || 'whisper-cli',
  whisperModel: process.env.WHISPER_CPP_MODEL || path.join(ROOT, 'models', 'ggml-small-q5_1.bin'),
  whisperLanguage: process.env.WHISPER_CPP_LANGUAGE || process.env.STT_LANGUAGE || 'ko',
  whisperTimeoutMs: whisperTimeoutMs(process.env),
  voiceLanguage: process.env.VOICE_LANGUAGE || process.env.WHISPER_CPP_LANGUAGE || process.env.STT_LANGUAGE || 'ko',
  tts: buildTtsSettings(process.env, ROOT),
  requireWakeWord: ['1', 'true', 'yes'].includes((process.env.REQUIRE_WAKE_WORD || '0').toLowerCase()),
  wakeWords: (process.env.WAKE_WORDS || 'hermes,헤르메스,허미스').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  debugDir: process.env.NODE_AUDIO_DEBUG_DIR || '/tmp/verbalcoding-node-debug',
  latencyLogPath: process.env.LATENCY_LOG_PATH || path.join(ROOT, '.logs', 'latency.jsonl'),
  projectSessionsPath: process.env.PROJECT_SESSIONS_FILE || path.join(ROOT, 'config', 'project-sessions.json'),
  agent: buildAgentSettings({ ROOT, env: process.env }),
};
if (!settings.token) throw new Error('DISCORD_BOT_TOKEN or DISCORD_TOKEN is required');
fs.mkdirSync(settings.debugDir, { recursive: true });
fs.mkdirSync(settings.tts.progressCacheDir, { recursive: true });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});
const announcedTtsFallbacks = new Set();
const pendingFallbackNoticePromises = new Set();
function ttsFallbackNotice({ backend } = {}) {
  if (!backend || backend === 'edge') return;
  if (announcedTtsFallbacks.has(backend)) return;
  announcedTtsFallbacks.add(backend);
  const en = /^en/i.test(String(settings.voiceLanguage || ''));
  const msg = en
    ? `${backend} synthesis failed; using Edge for the rest of this session.`
    : `${backend} 음성 생성에 실패해서 이번 세션은 Edge로 진행할게.`;
  const textPromise = sendText(`⚠️ ${msg}`)
    .catch(e => warn('tts fallback notice send failed', e?.message || e));
  pendingFallbackNoticePromises.add(textPromise);
  textPromise.finally(() => pendingFallbackNoticePromises.delete(textPromise));
  const speakPromise = new Promise(resolve => queueMicrotask(() => {
    speakText(msg, null, null, { mirrorText: false })
      .catch(e => warn('tts fallback notice speak failed', e?.message || e))
      .finally(resolve);
  }));
  pendingFallbackNoticePromises.add(speakPromise);
  speakPromise.finally(() => pendingFallbackNoticePromises.delete(speakPromise));
}
const bridge = createBridge();
bridge.ttsBackend = createTtsBackend(settings.tts, { execFileAsync, spawn, log, warn, onFallback: ttsFallbackNotice, voiceProvider: () => settings.tts.edge.voice });
const voiceCloneCapture = createVoiceCloneCaptureState({ defaultTargetPath: settings.tts.openvoice.refAudio });

bridge.player = createAudioPlayer();
const MAX_DEFERRED_PROCESSING_UTTERANCES = Number(process.env.MAX_DEFERRED_PROCESSING_UTTERANCES || '0');
const MIN_UTTERANCE_SECONDS = Number(process.env.MIN_UTTERANCE_SECONDS || '1.4');
const MIN_UTTERANCE_BYTES = 48000 * 2 * 2 * MIN_UTTERANCE_SECONDS;
const BARGE_IN_MIN_SECONDS = Number(process.env.BARGE_IN_MIN_SECONDS || '1.4');
const BARGE_IN_MIN_MEAN_VOLUME_DB = Number(process.env.BARGE_IN_MIN_MEAN_VOLUME_DB || '-30');
const BARGE_IN_MIN_MAX_VOLUME_DB = Number(process.env.BARGE_IN_MIN_MAX_VOLUME_DB || '-14');
const PLAYBACK_BARGE_IN_MIN_SECONDS = Number(process.env.PLAYBACK_BARGE_IN_MIN_SECONDS || '0.9');
const PLAYBACK_BARGE_IN_MIN_MEAN_VOLUME_DB = Number(process.env.PLAYBACK_BARGE_IN_MIN_MEAN_VOLUME_DB || '-36');
const PLAYBACK_BARGE_IN_MIN_MAX_VOLUME_DB = Number(process.env.PLAYBACK_BARGE_IN_MIN_MAX_VOLUME_DB || '-18');
const PLAYBACK_BARGE_IN_REQUIRE_BOTH = !['0', 'false', 'no', 'off'].includes(String(process.env.PLAYBACK_BARGE_IN_REQUIRE_BOTH || '1').toLowerCase());
const BARGE_IN_CONSERVATIVE_MIN_SECONDS = Number(process.env.BARGE_IN_CONSERVATIVE_MIN_SECONDS || '1.8');
const BARGE_IN_CONSERVATIVE_MIN_MEAN_VOLUME_DB = Number(process.env.BARGE_IN_CONSERVATIVE_MIN_MEAN_VOLUME_DB || '-27');
const BARGE_IN_CONSERVATIVE_MIN_MAX_VOLUME_DB = Number(process.env.BARGE_IN_CONSERVATIVE_MIN_MAX_VOLUME_DB || '-12');
const SENSITIVITY_MODE_DEFAULT = (process.env.BARGE_IN_SENSITIVITY_MODE || 'normal').toLowerCase() === 'conservative' ? 'conservative' : 'normal';
const SENSITIVITY_OUTDOOR_SECONDS = Number(process.env.BARGE_IN_OUTDOOR_SECONDS || '900');
const SUBSCRIBE_AFTER_SILENCE_MS = Number(process.env.SUBSCRIBE_AFTER_SILENCE_MS || '2200');
// Wait long enough for natural mid-sentence pauses before sending audio to STT.
// If this is too short, a long thought gets split: the first fragment starts an
// agent turn and the rest is treated as barge-in/processing speech.
const UTTERANCE_IDLE_MS = Number(process.env.UTTERANCE_IDLE_MS || '4500');
const MIN_MEAN_VOLUME_DB = Number(process.env.MIN_MEAN_VOLUME_DB || '-35');
const MIN_MAX_VOLUME_DB = Number(process.env.MIN_MAX_VOLUME_DB || '-12');
const STT_START_VOICE_NOTICE = !['0', 'false', 'no', 'off'].includes((process.env.STT_START_VOICE_NOTICE || '1').toLowerCase());

const bridgeLogger = createBridgeLogger({
  appendLine: line => {
    if (!process.env.BRIDGE_LOG_PATH) return;
    fs.appendFileSync(process.env.BRIDGE_LOG_PATH, `${line}\n`);
  },
});
function log(...args) { bridgeLogger.log(...args); }
function warn(...args) { bridgeLogger.warn(...args); }
bridge.bridgeState = createBridgeState({ log, cleanupFile: file => fs.rm(file, { force: true }, () => {}) });
const reportTransientProcessError = createTransientErrorReporter({ warn });
function isBenignTransientNetworkError(error) {
  return isTransientNetworkError(error);
}
function writeLatencyRecord(record) {
  try {
    appendJsonl(settings.latencyLogPath, record);
    log('latency metric', 'status', record.status, 'total_ms', record.durations?.total_ms, 'stt_ms', record.durations?.stt_ms, 'agent_ms', record.durations?.agent_ms, 'tts_total_ms', record.durations?.tts_total_ms);
  } catch (e) {
    warn('write latency metric failed', e?.stack || e);
  }
}
function newLatencyTurn(userId, startedAtMs) {
  const id = `${Date.now()}-${userId}-${Math.random().toString(16).slice(2, 8)}`;
  return createLatencyTurn({ id, userId, startedAtMs, writeRecord: writeLatencyRecord });
}

function discardVoiceInputQueues(reason = 'config-change') {
  return bridge.bridgeState?.discardQueues(reason) || 0;
}
bridge.verboseProgress = Boolean(settings.agent.verboseProgress);

const STREAMING_TTS_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.STREAMING_TTS || '1').toLowerCase());

bridge.smartProgressEnabled = Boolean(process.env.SMART_PROGRESS_API_KEY);
const VOICE_CONNECT_TIMEOUT_MS = Number(process.env.VOICE_CONNECT_TIMEOUT_MS || '60000');
const PROGRESS_IDLE_NOTICE_INITIAL_MS = Number(process.env.PROGRESS_IDLE_NOTICE_INITIAL_MS || process.env.PROGRESS_IDLE_NOTICE_MS || '10000');
const PROGRESS_IDLE_NOTICE_MAX_MS = Number(process.env.PROGRESS_IDLE_NOTICE_MAX_MS || '30000');
const PROGRESS_IDLE_NOTICE_MULTIPLIER = Number(process.env.PROGRESS_IDLE_NOTICE_MULTIPLIER || '1.8');
const PROGRESS_IDLE_CHECK_MS = Number(process.env.PROGRESS_IDLE_CHECK_MS || '5000');
const PROGRESS_IDLE_NOTICE_LIMIT = Number(process.env.PROGRESS_IDLE_NOTICE_LIMIT || '20');
const projectSessionsState = loadProjectSessions(settings.projectSessionsPath);
const ttsPlayer = createTtsPlayer({
  bridge,
  settings,
  log,
  warn,
  sleep,
  sendText,
  refreshTtsRuntimeConfig,
  waitEvent,
  isAbortError,
  STREAMING_TTS_ENABLED,
});
const { synthTTS, playAudio, speakText, beginStreamingTurn, endStreamingTurn, stopPlaybackForBargeIn } = ttsPlayer;

const progressHandler = createProgressHandler({
  bridge,
  settings,
  log,
  warn,
  isAbortError,
  playAudio,
  sendText,
  refreshTtsRuntimeConfig,
});
const {
  ensureSmartProgressSummarizer,
  smartProgressStatusText,
  progressEmoji,
  formatProgressText,
  sendVerboseProgressText,
  synthProgressTTS,
  speakProgress,
  speakImmediateNotice,
  queueProgressSpeechText,
  flushProgressSpeechBatch,
  queueVerboseProgressSpeech,
  clearProgressSpeechBatch,
  stopProgressSpeech,
} = progressHandler;

const notificationHandler = createNotificationHandler({ bridge, client, log, warn });
const {
  ensureNotifier,
  notifyStatusText,
  getVoiceChannelHumanCount,
  maybeNotifyTaskComplete,
} = notificationHandler;

const ttsRuntime = createTtsRuntime({
  bridge,
  ROOT,
  execFileAsync,
  speakText,
  warn,
  persistEnvValues,
});
const { ensureSelectedTtsBackendInstalled, commandIsInstalled } = ttsRuntime;

function createBridgeAgentAdapter(agentSettings) {
  return createAgentAdapter(agentSettings, {
    execFileAsync,
    spawn,
    log,
    warn,
    onProgress: event => {
      if (!bridge.verboseProgress) return;
      bridge.activeProgressLastEventAt = Date.now();
      sendVerboseProgressText(event, bridge.activeProgressSignal);
      if (bridge.smartProgressEnabled && process.env.SMART_PROGRESS_API_KEY) {
        try { ensureSmartProgressSummarizer().ingest(event); }
        catch (e) { warn('smart progress ingest failed', e?.stack || e); queueVerboseProgressSpeech(event, bridge.activeProgressSignal); }
      } else {
        queueVerboseProgressSpeech(event, bridge.activeProgressSignal);
      }
    },
    onStdoutChunk: chunk => {
      if (bridge.activeSentencer) {
        try { bridge.activeSentencer.push(chunk); } catch (e) { warn('streaming sentencer push failed', e?.stack || e); }
      }
    },
  });
}
const agentAdapter = createBridgeAgentAdapter(settings.agent);
function resolveProjectSessionForChannel(channelId) {
  return projectSessionForChannel(projectSessionsState, channelId) || null;
}

function ontologyStateFor(channelKey) {
  const key = String(channelKey || 'default');
  let store = bridge.ontologyByChannel.get(key);
  if (!store) {
    store = createSessionOntology({ channelKey: key });
    try { store.load(); } catch {}
    bridge.ontologyByChannel.set(key, store);
  }
  return store;
}
function captureOntologyFromTurn(channelKey, { prompt, answer, backend }) {
  try {
    const store = ontologyStateFor(channelKey);
    const promptEntities = store.entitiesFromText(String(prompt || ''), { by: backend, kind: 'utterance' });
    const answerEntities = store.entitiesFromText(String(answer || ''), { by: backend, kind: 'result' });
    store.add(promptEntities);
    store.add(answerEntities);
    store.save();
  } catch (e) {
    warn('ontology capture failed', e?.message || e);
  }
}
function resetRoutingState(channelKey) {
  const state = routingStateFor(channelKey);
  state.activeRouting = { backend: settings.agent.backend, sticky: false };
  state.pendingFallbackPrompt = null;
}
function invalidateBackendAdaptersForSession(sessionSlug) {
  if (!sessionSlug) return;
  for (const key of Array.from(bridge.agentAdaptersByBackend.keys())) {
    if (key.endsWith(`::${sessionSlug}`)) bridge.agentAdaptersByBackend.delete(key);
  }
}
function saveProjectSessionsState() {
  saveProjectSessions(settings.projectSessionsPath, projectSessionsState);
}
bridge.sensitivityMode = SENSITIVITY_MODE_DEFAULT;
function currentBargeInThresholds() {
  if (bridge.sensitivityModeExpiresAt && Date.now() > bridge.sensitivityModeExpiresAt) {
    bridge.sensitivityMode = SENSITIVITY_MODE_DEFAULT;
    bridge.sensitivityModeExpiresAt = 0;
    log('barge-in sensitivity mode expired; restored', bridge.sensitivityMode);
  }
  return bargeInThresholdsForMode(bridge.sensitivityMode, {
    minSeconds: BARGE_IN_MIN_SECONDS,
    minMeanDb: BARGE_IN_MIN_MEAN_VOLUME_DB,
    minMaxDb: BARGE_IN_MIN_MAX_VOLUME_DB,
    conservativeMinSeconds: BARGE_IN_CONSERVATIVE_MIN_SECONDS,
    conservativeMinMeanDb: BARGE_IN_CONSERVATIVE_MIN_MEAN_VOLUME_DB,
    conservativeMinMaxDb: BARGE_IN_CONSERVATIVE_MIN_MAX_VOLUME_DB,
  });
}
function currentPlaybackBargeInThresholds() {
  return {
    minBytes: 48000 * 2 * 2 * PLAYBACK_BARGE_IN_MIN_SECONDS,
    minSeconds: PLAYBACK_BARGE_IN_MIN_SECONDS,
    minMeanDb: PLAYBACK_BARGE_IN_MIN_MEAN_VOLUME_DB,
    minMaxDb: PLAYBACK_BARGE_IN_MIN_MAX_VOLUME_DB,
    requireBoth: PLAYBACK_BARGE_IN_REQUIRE_BOTH,
    mode: 'playback',
  };
}
function setSensitivityMode(mode, reason = 'manual') {
  bridge.sensitivityMode = mode === 'conservative' ? 'conservative' : 'normal';
  bridge.sensitivityModeExpiresAt = bridge.sensitivityMode === 'conservative' && SENSITIVITY_OUTDOOR_SECONDS > 0
    ? Date.now() + SENSITIVITY_OUTDOOR_SECONDS * 1000
    : 0;
  const thresholds = currentBargeInThresholds();
  log('barge-in sensitivity mode set', bridge.sensitivityMode, 'reason', reason, 'expiresAt', bridge.sensitivityModeExpiresAt || 'never', 'thresholds', thresholds);
  return thresholds;
}
function sensitivityStatusText() {
  const thresholds = currentBargeInThresholds();
  const ttl = bridge.sensitivityModeExpiresAt ? Math.max(0, Math.round((bridge.sensitivityModeExpiresAt - Date.now()) / 1000)) : 0;
  return sensitivityStatusTextForLanguage(thresholds, ttl, settings.voiceLanguage);
}

function verboseStatusText() {
  return verboseStatusTextForLanguage(bridge.verboseProgress, settings.voiceLanguage);
}

function setVerboseProgress(enabled, reason = 'manual') {
  bridge.verboseProgress = Boolean(enabled);
  log('verbose progress mode set', bridge.verboseProgress, 'reason', reason);
  return bridge.verboseProgress;
}

function persistEnvValues(values) {
  const envPath = path.join(ROOT, '.env');
  let lines = [];
  try {
    if (fs.existsSync(envPath)) lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  } catch (e) {
    warn('read .env for update failed', e?.stack || e);
  }
  const pending = new Map(Object.entries(values).filter(([, value]) => value !== undefined));
  const updated = lines.map(line => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=.*$/);
    if (!match || !pending.has(match[1])) return line;
    const key = match[1];
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of pending) updated.push(`${key}=${value}`);
  fs.writeFileSync(envPath, `${updated.filter((line, idx) => line !== '' || idx < updated.length - 1).join('\n')}\n`, { mode: 0o600 });
}

function applyRuntimeLanguage(language) {
  discardVoiceInputQueues('language-change');
  const preset = languagePreset(language);
  settings.whisperLanguage = preset.sttLanguage;
  settings.voiceLanguage = preset.voiceLanguage;
  let config = ensureTtsVoiceConfig();
  config = updateTtsVoiceConfig(config, { voiceType: preferredVoiceTypeForLanguage(config, preset.voiceLanguage) });
  writeTtsVoiceConfig(TTS_VOICE_CONFIG_PATH, config);
  const { selection } = applyVoiceConfigToProcessEnv(config);
  rebuildTtsRuntimeSettings(selection);
  if (selection.backend !== 'edge') settings.tts.edge.voice = preset.ttsVoice;
  process.env.VOICE_LANGUAGE = preset.voiceLanguage;
  process.env.WHISPER_CPP_LANGUAGE = preset.sttLanguage;
  process.env.STT_LANGUAGE = preset.sttLanguage;
  process.env.TTS_VOICE = settings.tts.edge.voice;
  process.env.TTS_VOICE_TYPE = selection.voiceType;
  persistEnvValues({
    VOICE_LANGUAGE: preset.voiceLanguage,
    WHISPER_CPP_LANGUAGE: preset.sttLanguage,
    STT_LANGUAGE: preset.sttLanguage,
    TTS_BACKEND: selection.backend,
    TTS_VOICE: settings.tts.edge.voice,
    TTS_VOICE_TYPE: selection.voiceType,
  });
  return preset;
}

function languageChangedText(preset) {
  if (preset.key === 'ko') return '언어를 한국어로 바꿨어. STT, 중간 음성, 최종 음성, 목소리 타입까지 한국어 설정으로 맞췄어.';
  if (preset.key === 'auto') return 'Language set to auto-detect STT with English voice. Progress voice will stay in English.';
  return 'Language set to English. STT, progress voice, final voice, and voice type are English now.';
}

function voiceChangedText(selection) {
  const lang = selection.voice?.language || settings.voiceLanguage;
  if (/^ko/i.test(String(lang))) return `목소리를 ${selection.voice?.label || selection.voiceType}로 바꿨어.`;
  return `Voice changed to ${selection.voice?.label || selection.voiceType}.`;
}

function isCloneVoiceType(voiceType) {
  return /^(cloned_reference|prompt_reference|cosyvoice_reference)$/i.test(String(voiceType || ''));
}

async function notifyVoiceCloneSampleGapIfNeeded(selection, signal) {
  if (!selection || selection.backend === 'edge') return;
  if (!isCloneVoiceType(selection.voiceType)) return;
  const ref = String(selection.voice?.voice || '').trim();
  if (!ref) return;
  const candidatePath = path.isAbsolute(ref) ? ref : path.resolve(ROOT, ref);
  if (fs.existsSync(candidatePath)) return;
  const en = /^en/i.test(String(settings.voiceLanguage || ''));
  const msg = en
    ? `${selection.backend} needs a voice clone sample at ${ref}. Say "voice clone capture" to record one, or pick a non-clone voice.`
    : `${selection.backend} 백엔드는 음성 클론 샘플(${ref})이 필요해. "보이스 클로닝 캡처"라고 하거나 다른 보이스를 골라줘.`;
  await sendText(`🎙️ ${msg}`);
  await speakText(msg, signal, null);
}

function isAllowed(userId) { return settings.allowedUsers.size === 0 || settings.allowedUsers.has(String(userId)); }
function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-'); }

function stripMarkdownNoise(text, language = settings.voiceLanguage) {
  const codeBlockText = /^en/i.test(String(language || '')) ? 'I left the code block in the text channel.' : '코드 블록은 텍스트 채널에 남겼어.';
  return String(text || '')
    .replace(/```[\s\S]*?```/g, codeBlockText)
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[[^\]]+\]\([^\)]+\)/g, match => match.replace(/\]\([^\)]+\)/, '').replace('[', ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function spokenResultOnly(userPrompt, answer, language = settings.voiceLanguage) {
  const english = /^en/i.test(String(language || ''));
  const cleaned = stripMarkdownNoise(answer, language);
  if (isPatchLikeOutput(cleaned)) {
    return english
      ? 'The code diff is too long to read aloud. I will keep the changed files and test results in the text channel.'
      : '코드 변경 diff가 길게 나와서 음성으로는 읽지 않을게. 변경 파일과 테스트 결과만 텍스트 채널에 정리할게.';
  }
  const tooLongForVoice = cleaned.length > 3000;
  const hasBulkyCodeOrLogs = /I left the code block in the text channel|코드 블록은 텍스트 채널에 남겼어|^\s*(run|log|command|diff|changed files|verification log|test output|실행|로그|명령|diff|변경사항 상세|검증 로그|테스트 출력)\s*[:：]/im.test(cleaned);
  if (!tooLongForVoice) return cleaned;

  const lines = cleaned
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^\s*(run|log|command|diff|changed files|verification log|test output|실행|로그|명령|diff|변경사항 상세|검증 로그|테스트 출력)\s*[:：]/i.test(line));

  let spoken = hasBulkyCodeOrLogs ? lines.slice(0, 10).join(' ') : cleaned;
  const moreText = english ? 'I left the rest in the text channel.' : '나머지는 텍스트 채널에 남겼어.';
  if (spoken.length > 1800) spoken = `${spoken.slice(0, 1760).replace(/[\s,.;:，。]+$/u, '')}. ${moreText}`;
  if (spoken.length < cleaned.length && !/(text channel|텍스트 채널)/i.test(spoken)) spoken += ` ${moreText}`;
  return spoken;
}

async function sendText(text) {
  return sendDiscordText({
    client,
    channelId: bridge.activeTranscriptChannelId || settings.transcriptChannelId,
    text,
    log,
    warn,
  });
}

async function sendEmbed(embed, { content = '' } = {}) {
  if (!embed) return false;
  try {
    const channelId = bridge.activeTranscriptChannelId || settings.transcriptChannelId;
    if (!channelId) return false;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.send) return false;
    await channel.send(content ? { content, embeds: [embed] } : { embeds: [embed] });
    return true;
  } catch (e) {
    warn('sendEmbed failed', e?.message || e);
    return false;
  }
}

async function sendChannelText(channel, text) {
  const body = String(text || '');
  const chunks = splitDiscordMessage(body);
  for (const chunk of chunks) await channel.send(chunk);
  return true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitEvent(emitter, event, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error(`timeout waiting ${event}`)); }, timeoutMs);
    const onEvent = (...args) => { cleanup(); resolve(args); };
    const onErr = err => { cleanup(); reject(err); };
    const cleanup = () => { clearTimeout(t); emitter.off(event, onEvent); emitter.off('error', onErr); };
    emitter.once(event, onEvent);
    emitter.once('error', onErr);
  });
}

// handleRecording lives inside utteranceRouter (extracted in Phase 4b) but
// voiceIO.flushUtterance needs to call it. Use a forward-declared `let` plus
// a thunk so the deps for createVoiceIO resolve before createUtteranceRouter
// is constructed.
let utteranceRouter;
const voiceIO = createVoiceIO({
  bridge,
  settings,
  client,
  execFileAsync,
  log,
  warn,
  stamp,
  sleep,
  isAllowed,
  UTTERANCE_IDLE_MS,
  SUBSCRIBE_AFTER_SILENCE_MS,
  MIN_UTTERANCE_BYTES,
  MIN_MEAN_VOLUME_DB,
  MIN_MAX_VOLUME_DB,
  currentBargeInThresholds,
  currentPlaybackBargeInThresholds,
  createLiveBargeInMonitor,
  shouldUseLivePlaybackBargeIn,
  stopPlaybackForBargeIn,
  analyzeAudio,
  concatWavs,
  saveCapturedVoiceCloneSample,
  isBargeInCandidate,
  validateProcessingBargeIn,
  enqueueDeferredProcessingUtterance,
  newLatencyTurn,
  handleRecording: (...args) => utteranceRouter.handleRecording(...args),
});
const { transcribeOnce, transcribe, cleanTranscript, queueSegment, flushUtterance, subscribeUser } = voiceIO;
utteranceRouter = createUtteranceRouter({
  bridge,
  log,
  warn,
  path,
  fs,
  ROOT,
  TTS_VOICE_CONFIG_PATH,
  agentAdapter,
  settings,
  isPlanEntryUtterance,
  parsePlanOutput,
  parsePlanVoiceCommand,
  applyPlanCommand,
  renderFinalPlan,
  planModePreamble,
  planExecutionPreamble,
  parseDecisionAnswer,
  renderDecisionPrompt,
  renderResolvedDecisions,
  isAgentRoutingDecision,
  projectSessionContextText,
  resolveProjectSessionForChannel,
  createBridgeAgentAdapter,
  buildAgentSettings,
  commandIsInstalled,
  shellSplit,
  sendText,
  speakText,
  ensureTtsVoiceConfig,
  updateTtsVoiceConfig,
  writeTtsVoiceConfig,
  applyVoiceConfigToProcessEnv,
  ensureSelectedTtsBackendInstalled,
  rebuildTtsRuntimeSettings,
  voiceCommandFromTranscript,
  voiceChangedText,
  voiceLanguageCommandFromTranscript,
  voiceCloneCommandFromText,
  voiceCloneCapture,
  notifyVoiceCloneSampleGapIfNeeded,
  languageChangedText,
  applyRuntimeLanguage,
  persistEnvValues,
  discardVoiceInputQueues,
  // Phase 4b deps
  transcribe,
  beginStreamingTurn,
  endStreamingTurn,
  client,
  isAllowed,
  isAbortError,
  sleep,
  sendEmbed,
  speakImmediateNotice,
  reloadRuntimeLanguageFromEnv,
  drainDeferredProcessingUtterances,
  maybeNotifyTaskComplete,
  ontologyStateFor,
  captureOntologyFromTurn,
  queueProgressSpeechText,
  stopProgressSpeech,
  agentAnswerHeader,
  emptyAgentAnswer,
  formatRecentDiscordContext,
  formatSttResultMessage,
  formatSttStartMessage,
  formatVoiceErrorMessage,
  formatWakeRejectedMessage,
  spokenResultOnly,
  stripWake,
  acceptsWake,
  sensitivityChangedSpeech,
  sensitivityModeFromTranscript,
  sensitivityStatusText,
  setSensitivityMode,
  isSensitivityOnlyRequest,
  verboseChangedSpeech,
  verboseModeFromTranscript,
  verboseStatusText,
  setVerboseProgress,
  isVerboseOnlyRequest,
  isRoutingOnlyUtterance,
  parseAgentRoutingCommand,
  renderAgentPrefix,
  buildCrossAgentPrompt,
  buildFallbackDecision,
  parseResearchCommand,
  runResearchTurn,
  PROGRESS_IDLE_CHECK_MS,
  PROGRESS_IDLE_NOTICE_INITIAL_MS,
  PROGRESS_IDLE_NOTICE_LIMIT,
  PROGRESS_IDLE_NOTICE_MAX_MS,
  PROGRESS_IDLE_NOTICE_MULTIPLIER,
  STT_START_VOICE_NOTICE,
});
const {
  planChannelKey,
  askNextDecision,
  finalizePlanReady,
  dispatchPlanModeUtterance,
  planNarrationLines,
  adapterForProjectSession,
  routingStateFor,
  recordUtterance,
  clearTransientRouting,
  adapterForBackend,
  handleTtsVoiceCommand,
  handleLanguageCommand,
  handleVoiceCloneCommand,
  interruptCurrentResponse,
  handleRecording,
} = utteranceRouter;

function isAbortError(e) {
  return e?.name === 'AbortError' || e?.code === 'ABORT_ERR';
}

function isTaskRequest(text) {
  const compact = text.replace(/\s+/g, '').toLowerCase();
  return /(파일|폴더|프로젝트|코드|구현|수정|고쳐|만들|생성|실행|확인|검색|설치|테스트|디버그|재시작|로그|커밋|깃|git|github|브랜치|배포|서버|프로세스|터미널|스크립트|압축|다운로드|분석해|찾아)/i.test(compact);
}

function isSensitivityOnlyRequest(text) {
  const compact = String(text || '').replace(/\s+/g, '').toLowerCase();
  if (!sensitivityModeFromTranscript(compact)) return false;
  return !isTaskRequest(compact) && !/(그리고|그다음|다음에|추가로|해줘.*(말|설명|대답))/u.test(compact);
}

function verboseModeFromTranscript(text) {
  const compact = String(text || '').replace(/\s+/g, '').toLowerCase();
  // Korean STT often hears "상세" as "상쇄" or "상쇠" in noisy voice calls.
  const verboseWords = 'verbose|버보스|상세|상쇄|상쇠|상세진행|자세히알려|중간과정';
  if (new RegExp(`(${verboseWords}).*(켜|on|시작|보여|알려|읽어|말해)|^(verbose|버보스|상세|상쇄|상쇠)모드(켜|on)?$`).test(compact)) return true;
  if (new RegExp(`(${verboseWords}).*(꺼|off|중지|그만)|^(verbose|버보스|상세|상쇄|상쇠)모드꺼$`).test(compact)) return false;
  return null;
}

function isVerboseOnlyRequest(text) {
  const compact = String(text || '').replace(/\s+/g, '').toLowerCase();
  return verboseModeFromTranscript(compact) !== null && !isTaskRequest(compact) && !/(그리고|그다음|다음에|추가로)/u.test(compact);
}

async function refreshTtsRuntimeConfig() {
  reloadRuntimeLanguageFromEnv();
  const { selection } = applyVoiceConfigToProcessEnv(ensureTtsVoiceConfig());
  const previousBackend = settings.tts.backend;
  settings.tts.backend = selection.backend;
  if (selection.backend === 'edge') settings.tts.edge.voice = selection.voice.voice;
  if (previousBackend !== settings.tts.backend) {
    const rebuilt = buildTtsSettings(process.env, ROOT);
    Object.assign(settings.tts, rebuilt);
    try { bridge.ttsBackend?.close?.(); } catch (e) { warn('tts backend close failed', e?.message || e); }
    bridge.ttsBackend = createTtsBackend(settings.tts, { execFileAsync, spawn, log, warn, onFallback: ttsFallbackNotice, voiceProvider: () => settings.tts.edge.voice });
    log('tts backend reloaded from voice config', settings.tts.backend, 'voiceType', selection.voiceType);
  }
  return selection;
}

async function handleTextAgentMessage(msg, text, { speakResponse = false } = {}) {
  if (bridge.processing) {
    await msg.reply('지금 이전 작업을 처리 중이야. 끝나면 다시 보내줘.');
    return;
  }
  bridge.processing = true;
  const controller = new AbortController();
  bridge.currentAbortController = controller;
  const signal = controller.signal;
  const progressController = new AbortController();
  bridge.activeProgressAbortController = progressController;
  bridge.activeProgressSignal = progressController.signal;
  bridge.activeProgressLastEventAt = Date.now();
  const previousTranscriptChannelId = bridge.activeTranscriptChannelId;
  const session = resolveProjectSessionForChannel(msg.channelId);
  bridge.activeTranscriptChannelId = session?.transcriptChannelId || msg.channelId;
  const selectedAgentAdapter = adapterForProjectSession(session);
  const projectContext = projectSessionContextText(session);
  const recentDiscordContext = formatRecentDiscordContext(bridge.recentDiscordTextByChannel, {
    channelId: bridge.activeTranscriptChannelId,
  });
  const plan = {
    task: true,
    label: selectedAgentAdapter.label,
    verboseProgress: bridge.verboseProgress,
    language: settings.voiceLanguage,
    cwd: session?.workdir,
    projectContext,
    recentDiscordContext,
  };
  const sessionBefore = selectedAgentAdapter.readSessionId?.();
  log('text agent request start', selectedAgentAdapter.label, sessionBefore ? 'resume-existing-session' : 'new-session', 'verbose', bridge.verboseProgress, session ? `project=${session.slug}` : 'project=default');
  try {
    const result = await selectedAgentAdapter.run(text, signal, plan);
    const answer = result.answer || emptyAgentAnswer(settings.voiceLanguage);
    const fullAnswerText = `${agentAnswerHeader(settings.voiceLanguage, selectedAgentAdapter.label)}\n${answer}`;
    await sendChannelText(msg.channel, fullAnswerText);
    stopProgressSpeech(progressController.signal, 'text-agent-answer-ready');
    if (speakResponse && bridge.connection) {
      const spokenAnswer = spokenResultOnly(text, answer, settings.voiceLanguage);
      await speakText(spokenAnswer, signal, null, { mirrorText: false });
    }
  } catch (e) {
    if (isAbortError(e)) return;
    warn('text agent request failed', e?.stack || e);
    await sendChannelText(msg.channel, formatVoiceErrorMessage(settings.voiceLanguage, String(e?.message || e).slice(0, 800)));
  } finally {
    if (bridge.activeProgressAbortController && bridge.activeProgressAbortController.signal === progressController.signal && !bridge.activeProgressAbortController.signal.aborted) {
      try { bridge.activeProgressAbortController.abort(); } catch (e) { warn('abort text progress speech failed', e?.stack || e); }
    }
    if (bridge.activeProgressSignal === progressController.signal) bridge.activeProgressSignal = null;
    if (bridge.activeProgressAbortController?.signal === progressController.signal) bridge.activeProgressAbortController = null;
    clearProgressSpeechBatch(progressController.signal);
    if (bridge.currentAbortController === controller) bridge.currentAbortController = null;
    bridge.activeTranscriptChannelId = previousTranscriptChannelId;
    bridge.processing = false;
  }
}

async function saveCapturedVoiceCloneSample(userId, wavPath, pcmBytes, segments, signal = null) {
  const capture = voiceCloneCapture.consume(userId);
  if (!capture) return false;
  try {
    const saved = await saveVoiceCloneReference({
      sourceWav: wavPath,
      targetPath: capture.targetPath,
      execFileAsync,
    });
    log('voice clone reference saved', 'user', userId, 'pcmBytes', pcmBytes, 'segments', segments, 'path', saved);
    await sendText(`🎙️ 보이스 클로닝 참조 샘플 저장 완료: ${path.relative(ROOT, saved)}`);
    await speakText('목소리 샘플 저장했어. 이제 OpenVoice 백엔드로 테스트할 수 있어.', signal);
  } catch (e) {
    warn('voice clone reference save failed', e?.stack || e);
    await sendText(`⚠️ 목소리 샘플 저장 실패: ${String(e?.message || e).slice(0, 700)}`);
    await speakText('목소리 샘플 저장에 실패했어. 로그를 확인해볼게.', signal);
  }
  return true;
}

function acceptsWake(text) {
  if (!settings.requireWakeWord) return true;
  const low = text.toLowerCase();
  return settings.wakeWords.some(w => low.includes(w));
}
function stripWake(text) {
  let out = text;
  for (const w of settings.wakeWords) out = out.replaceAll(w, '').replaceAll(w.toLowerCase(), '');
  return out.trim() || text;
}

async function analyzeAudio(wavPath) {
  const args = ['-hide_banner', '-nostats', '-i', wavPath, '-af', 'volumedetect', '-f', 'null', '-'];
  let text = '';
  try {
    const { stdout, stderr } = await execFileAsync('ffmpeg', args, { timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
    text = `${stdout || ''}\n${stderr || ''}`;
  } catch (e) {
    text = `${e.stdout || ''}\n${e.stderr || ''}`;
  }
  const mean = /mean_volume:\s*(-?(?:[0-9.]+|inf)) dB/i.exec(text)?.[1];
  const max = /max_volume:\s*(-?(?:[0-9.]+|inf)) dB/i.exec(text)?.[1];
  if (mean && max) {
    const parseDb = value => value.toLowerCase().includes('inf') ? -Infinity : Number(value);
    return { meanDb: parseDb(mean), maxDb: parseDb(max) };
  }
  throw new Error(`volumedetect failed: ${text.slice(-500)}`);
}

async function concatWavs(files, output) {
  if (files.length === 1) {
    fs.copyFileSync(files[0], output);
    return;
  }
  const listPath = path.join(os.tmpdir(), `hermes-node-concat-${Date.now()}.txt`);
  const body = files.map(f => `file '${String(f).replaceAll("'", "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, body);
  try {
    await execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', output], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
  } finally {
    fs.rm(listPath, { force: true }, () => {});
  }
}

function isBargeInCandidate(pcmBytes, levels) {
  const thresholds = currentBargeInThresholds();
  return isValidatedBargeInCandidate(pcmBytes, levels, thresholds);
}

function enqueueDeferredProcessingUtterance({ userId, wavPath, pcmBytes, segments, startedAtMs = Date.now() }) {
  const item = { userId, wavPath, pcmBytes, segments, startedAtMs };
  const result = bridge.bridgeState.enqueueDeferred(item, enqueueDeferredUtterance, MAX_DEFERRED_PROCESSING_UTTERANCES);
  if (!result.queued) {
    log('drop deferred utterance because queue disabled', userId, wavPath, 'max', MAX_DEFERRED_PROCESSING_UTTERANCES);
    return false;
  }
  if (result.dropped) {
    log('drop oldest deferred utterance because queue is full', result.dropped?.userId, result.dropped?.wavPath);
  }
  log('queued deferred utterance while processing', userId, wavPath, 'queueSize', bridge.bridgeState.deferredSize(), 'epoch', bridge.bridgeState.currentEpoch());
  return true;
}

async function drainDeferredProcessingUtterances() {
  if (bridge.processing || bridge.bridgeState.deferredSize() === 0) return;
  const next = bridge.bridgeState.shiftDeferred();
  if (!next) return;
  log('drain deferred utterance', next.userId, next.wavPath, 'remaining', bridge.bridgeState.deferredSize());
  const metricsTurn = newLatencyTurn(next.userId, next.startedAtMs || Date.now());
  metricsTurn.mark('voice_first_packet', next.startedAtMs || Date.now());
  metricsTurn.mark('utterance_flush');
  metricsTurn.addMeta({ segments: next.segments, pcmBytes: next.pcmBytes, deferred: true });
  await handleRecording(next.userId, next.wavPath, next.pcmBytes, next.segments, metricsTurn);
}

async function validateProcessingBargeIn(userId, wavPath, pcmBytes, segments) {
  log('validating processing barge-in transcript', userId, wavPath, 'pcmBytes', pcmBytes, 'segments', segments);
  const text = await transcribe(wavPath);
  if (!text) {
    log('ignore processing barge-in: empty transcript', userId, wavPath);
    return { action: 'ignore', text: '' };
  }
  if (!isExplicitBargeInTranscript(text)) {
    log('defer processing barge-in: not explicit stop phrase', userId, JSON.stringify(text));
    return { action: 'defer', text };
  }
  log('confirmed processing barge-in by explicit transcript', userId, JSON.stringify(text));
  interruptCurrentResponse(userId, 'confirmed-processing-barge-in');
  return { action: 'interrupt', text };
}

async function connectTo(channel) {
  if (bridge.connection) {
    try { bridge.connection.destroy(); } catch {}
  }
  bridge.activeVoiceChannelId = channel.id;
  bridge.connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });
  const voiceConnection = bridge.connection;
  voiceConnection.subscribe(bridge.player);
  voiceConnection.on('error', e => warn('voice connection error', e?.stack || e));
  voiceConnection.on('stateChange', async (oldState, newState) => {
    log('voice connection state', oldState.status, '->', newState.status);
    if (bridge.connection !== voiceConnection) {
      log('ignore stale voice connection state', oldState.status, '->', newState.status);
      return;
    }
    if (newState.status === VoiceConnectionStatus.Disconnected) {
      try {
        await Promise.race([
          entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5000),
          entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch (e) {
        if (bridge.connection !== voiceConnection) return;
        warn('voice connection disconnected; reconnecting to channel', channel.guild.name, channel.name, e?.message || e);
        try { voiceConnection.destroy(); } catch {}
        bridge.connection = null;
        setTimeout(() => connectTo(channel).catch(err => warn('voice reconnect failed', err?.stack || err)), 1500);
      }
    }
  });
  await entersState(voiceConnection, VoiceConnectionStatus.Ready, VOICE_CONNECT_TIMEOUT_MS);
  voiceConnection.receiver.speaking.on('start', userId => subscribeUser(voiceConnection.receiver, userId));
  log(`Listening in voice channel ${channel.guild.name} / ${channel.name}`);
}

async function autoJoin() {
  const attempted = [];
  for (const guild of client.guilds.cache.values()) {
    await guild.channels.fetch().catch(e => warn('auto-join channel fetch failed', guild.name, e?.message || e));
  }
  const activeGuildId = bridge.activeVoiceChannelId ? client.channels.cache.get(bridge.activeVoiceChannelId)?.guild?.id || '' : '';
  const occupied = pickOccupiedUserVoiceChannel(client.guilds.cache.values(), settings.allowedUsers, {
    activeVoiceChannelId: bridge.activeVoiceChannelId,
    activeGuildId,
  });
  if (occupied) {
    attempted.push(`${occupied.guild.name}/${occupied.name}`);
    try {
      log('auto-join following occupied user voice channel', occupied.guild.name, occupied.name);
      await connectTo(occupied);
      return;
    } catch (e) {
      warn('auto-join occupied user voice channel failed; trying configured channels', occupied.guild.name, occupied.name, e?.stack || e);
      try { bridge.connection?.destroy(); } catch {}
      bridge.connection = null;
      bridge.activeVoiceChannelId = '';
    }
  }
  for (const preferredName of settings.autoJoinVoiceChannels) {
    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch();
      for (const ch of channels.values()) {
        if (!ch?.isVoiceBased?.() || ch.name.toLowerCase() !== preferredName) continue;
        attempted.push(`${guild.name}/${ch.name}`);
        try {
          await connectTo(ch);
          return;
        } catch (e) {
          warn('auto-join failed; trying next configured voice channel', guild.name, ch.name, e?.stack || e);
          try { bridge.connection?.destroy(); } catch {}
          bridge.connection = null;
          bridge.activeVoiceChannelId = '';
        }
      }
    }
  }
  warn('No auto-join channel found or reachable', settings.autoJoinVoiceChannels, 'attempted', attempted);
}

function consumeRestartNotice() {
  const noticePath = path.join(ROOT, '.cache', 'restart-notice.txt');
  try {
    if (!fs.existsSync(noticePath)) return '';
    const detail = fs.readFileSync(noticePath, 'utf8').replace(/\s+/g, ' ').trim().slice(0, 120);
    fs.rmSync(noticePath, { force: true });
    return detail;
  } catch (e) {
    warn('consume restart notice failed', e?.stack || e);
    return '';
  }
}

async function announceRestartComplete() {
  const detail = consumeRestartNotice();
  const { text, speech } = formatRestartCompleteNotice(detail, settings.tts.edge.voice);
  const delivered = await sendText(text);
  if (!delivered) warn('restart-complete text delivery failed');
  await speakText(speech, undefined, null, { mirrorText: false });
}

async function findVoiceChannelBySelector(guild, selector) {
  const wanted = String(selector || '').trim();
  if (!wanted || !guild) return null;
  const id = wanted.replace(/^<#(\d+)>$/, '$1');
  const channels = await guild.channels.fetch();
  const voiceChannels = [...channels.values()].filter(ch => ch?.isVoiceBased?.());
  const byId = voiceChannels.find(ch => ch.id === id);
  if (byId) return byId;
  const matches = voiceChannels.filter(ch => String(ch.name || '').toLowerCase() === wanted.toLowerCase());
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error(`같은 이름의 음성 채널이 여러 개야. 채널 ID나 멘션으로 지정해줘: ${wanted}`);
  throw new Error(`음성 채널을 찾지 못했어: ${wanted}`);
}

async function voiceChannelLabel(guild, channelId) {
  if (!channelId || !guild) return '없음';
  try {
    const ch = await guild.channels.fetch(channelId);
    return ch?.name || '지정됨';
  } catch {
    return '지정됨';
  }
}

async function resolveVoiceChannelForAttach(msg, selector = '') {
  if (selector) return findVoiceChannelBySelector(msg.guild, selector);
  if (msg.member?.voice?.channel) return msg.member.voice.channel;
  if (bridge.activeVoiceChannelId && msg.guild) {
    try {
      const ch = await msg.guild.channels.fetch(bridge.activeVoiceChannelId);
      if (ch?.isVoiceBased?.()) return ch;
    } catch {}
  }
  throw new Error('붙일 음성 채널을 못 찾았어. 음성채널에 들어가서 `!session attach-voice`를 치거나 `--voice "채널명"`을 붙여줘.');
}

async function attachVoiceChannelToTextSession(msg, command) {
  const voiceChannel = await resolveVoiceChannelForAttach(msg, command.voice);
  let session = null;
  if (command.name) {
    session = bindProjectSessionToChannel({ state: projectSessionsState, nameOrSlug: command.name, channelId: msg.channelId });
  } else {
    session = resolveProjectSessionForChannel(msg.channelId)
      || resolveProjectSessionForChannel(voiceChannel.id);
    if (!session) {
      const fallbackName = String(msg.channel?.name || `channel-${msg.channelId}`).trim() || `channel-${msg.channelId}`;
      session = createProjectSession({
        root: ROOT,
        state: projectSessionsState,
        name: fallbackName,
        workdir: settings.agent.cwd || ROOT,
        channelId: msg.channelId,
        voiceChannelId: voiceChannel.id,
        transcriptChannelId: msg.channelId,
        mcpContext: 'Ad-hoc Discord text channel session',
      });
    }
  }
  session.transcriptChannelId = msg.channelId;
  session.voiceChannelId = voiceChannel.id;
  projectSessionsState.channelSessions[msg.channelId] = session.slug;
  projectSessionsState.channelSessions[voiceChannel.id] = session.slug;
  saveProjectSessionsState();
  bridge.agentAdaptersBySession.delete(session.slug);
  invalidateBackendAdaptersForSession(session.slug);
  if (bridge.activeVoiceChannelId !== voiceChannel.id) await connectTo(voiceChannel);
  return msg.reply(`${session.name} 세션을 이 텍스트 채널과 음성 채널 ${voiceChannel.name}에 붙였어. 이제 그 음성채널 발화의 STT/답변 텍스트는 이 채널로 가.`);
}

async function handleProjectSessionCommand(msg, command) {
  const activeSession = resolveProjectSessionForChannel(msg.channelId) || resolveProjectSessionForChannel(bridge.activeVoiceChannelId);
  if (command.action === 'attach-voice') return void await attachVoiceChannelToTextSession(msg, command);
  if (command.action === 'status') {
    if (!activeSession) return void msg.reply(`${agentAdapter.label} 기본 세션: ${agentAdapter.readSessionId?.() || '아직 없음'}`);
    const adapter = adapterForProjectSession(activeSession);
    const voiceName = await voiceChannelLabel(msg.guild, activeSession.voiceChannelId);
    return void msg.reply([
      `프로젝트 세션: ${activeSession.name}`,
      `작업실: ${activeSession.workdir}`,
      `음성 채널: ${voiceName}`,
      `Hermes 세션: ${adapter.readSessionId?.() || '아직 없음'}`,
      `텍스트 채널: 현재 채널`,
    ].join('\n'));
  }
  if (command.action === 'list') {
    const sessions = listProjectSessions(projectSessionsState);
    if (!sessions.length) return void msg.reply('등록된 프로젝트 세션이 없어. `!session new 이름 /프로젝트/경로 --voice 음성채널명`으로 만들 수 있어.');
    const lines = [];
    for (const session of sessions) {
      const voiceName = await voiceChannelLabel(msg.guild, session.voiceChannelId);
      lines.push(`- ${session.name}: ${session.workdir} / voice: ${voiceName}`);
    }
    return void msg.reply(lines.join('\n').slice(0, 1900));
  }
  if (command.action === 'reset') {
    const session = activeSession;
    const targetFile = session?.sessionFile || settings.agent.sessionFile;
    try { fs.rmSync(targetFile, { force: true }); } catch {}
    return void msg.reply(`${session?.name || agentAdapter.label} 세션 초기화했어.`);
  }
  if (command.action === 'use') {
    if (!command.name) return void msg.reply('사용할 세션 이름을 붙여줘. 예: `!session use llm-wiki --voice "LLM Wiki"`');
    const voiceChannel = command.voice ? await findVoiceChannelBySelector(msg.guild, command.voice) : null;
    const session = bindProjectSessionToChannel({ state: projectSessionsState, nameOrSlug: command.name, channelId: msg.channelId });
    if (voiceChannel) {
      projectSessionsState.channelSessions[voiceChannel.id] = session.slug;
      session.voiceChannelId = voiceChannel.id;
    }
    saveProjectSessionsState();
    return void msg.reply(`${session.name} 프로젝트 세션을 이 텍스트 채널${voiceChannel ? `과 음성 채널 ${voiceChannel.name}` : ''}에 연결했어. 작업실은 ${session.workdir}이야.`);
  }
  if (command.action === 'new') {
    if (!command.name || !command.workdir) {
      return void msg.reply('형식: `!session new <이름> <작업실경로> [MCP/프로젝트 설명] --voice <음성채널명>`');
    }
    if (!fs.existsSync(command.workdir)) return void msg.reply(`작업실 경로가 없어: ${command.workdir}`);
    const voiceChannel = command.voice ? await findVoiceChannelBySelector(msg.guild, command.voice) : null;
    const session = createProjectSession({
      root: ROOT,
      state: projectSessionsState,
      name: command.name,
      workdir: command.workdir,
      channelId: msg.channelId,
      voiceChannelId: voiceChannel?.id || '',
      transcriptChannelId: msg.channelId,
      mcpContext: command.mcpContext,
    });
    saveProjectSessionsState();
    bridge.agentAdaptersBySession.delete(session.slug);
  invalidateBackendAdaptersForSession(session.slug);
    return void msg.reply(`${session.name} 프로젝트 세션 만들었어. 작업실은 ${session.workdir}이고, 이 텍스트 채널${voiceChannel ? `과 음성 채널 ${voiceChannel.name}` : ''} 입력은 별도 Hermes 세션 파일로 이어져.`);
  }
}

client.once('ready', async () => {
  log(`Logged in as ${client.user.tag} (${client.user.id})`);
  await autoJoin();
  await announceRestartComplete();
});

client.on('messageCreate', async msg => {
  const content = msg.content.trim();
  if (msg.author.bot && !content.startsWith('!say ')) return;
  if (!msg.author.bot && !isAllowed(msg.author.id)) return;
  appendRecentDiscordText(bridge.recentDiscordTextByChannel, {
    channelId: msg.channelId,
    authorLabel: msg.member?.displayName || msg.author?.username || 'user',
    content,
    messageId: msg.id,
  });
  const projectSessionCommand = parseProjectSessionCommand(content);
  if (projectSessionCommand) {
    try {
      await handleProjectSessionCommand(msg, projectSessionCommand);
    } catch (e) {
      warn('project session command failed', e?.stack || e);
      await msg.reply(String(e?.message || e).slice(0, 700));
    }
    return;
  }
  if (content === '!ping') return void msg.reply('pong');
  if (content === '!verbose') return void msg.reply(verboseStatusText());
  if (['!verbose on', '!verbose true', '!verbose 1', '!verbose 켜', '!verbose 켜줘'].includes(content.toLowerCase())) {
    setVerboseProgress(true, 'discord-command');
    return void msg.reply(verboseStatusText());
  }
  if (['!verbose off', '!verbose false', '!verbose 0', '!verbose 꺼', '!verbose 꺼줘'].includes(content.toLowerCase())) {
    setVerboseProgress(false, 'discord-command');
    return void msg.reply(verboseStatusText());
  }
  if (content === '!notify') return void msg.reply(notifyStatusText());
  if (['!notify on', '!notify always', '!notify 1'].includes(content.toLowerCase())) {
    bridge.notifyUserOptIn = true;
    return void msg.reply(notifyStatusText());
  }
  if (['!notify off', '!notify auto', '!notify 0'].includes(content.toLowerCase())) {
    bridge.notifyUserOptIn = false;
    return void msg.reply(notifyStatusText());
  }
  if (content === '!smart-progress' || content === '!smart_progress') return void msg.reply(smartProgressStatusText());
  if (['!smart-progress on', '!smart-progress true', '!smart-progress 1', '!smart_progress on'].includes(content.toLowerCase())) {
    bridge.smartProgressEnabled = true;
    return void msg.reply(smartProgressStatusText());
  }
  if (['!smart-progress off', '!smart-progress false', '!smart-progress 0', '!smart_progress off'].includes(content.toLowerCase())) {
    bridge.smartProgressEnabled = false;
    return void msg.reply(smartProgressStatusText());
  }
  if (content === '!sensitivity') return void msg.reply(sensitivityStatusText());
  if (content === '!latency' || content === '!metrics') {
    const summary = summarizeLatencyRecords(readJsonlRecords(settings.latencyLogPath, { limit: 200 }));
    return void msg.reply(`최근 latency 요약 (${settings.latencyLogPath}):\n${formatLatencySummary(summary)}`.slice(0, 1900));
  }
  if (content === '!sensitivity conservative') {
    setSensitivityMode('conservative', 'discord-command');
    return void msg.reply(sensitivityStatusText());
  }
  if (content === '!sensitivity normal') {
    setSensitivityMode('normal', 'discord-command');
    return void msg.reply(sensitivityStatusText());
  }
  if (content === '!session') return void handleProjectSessionCommand(msg, { action: 'status' });
  if (content === '!reset-session') return void handleProjectSessionCommand(msg, { action: 'reset' });
  if (content === '!join') {
    const ch = msg.member?.voice?.channel;
    if (!ch) return void msg.reply('먼저 음성 채널에 들어가줘.');
    await connectTo(ch);
    return void msg.reply('들어왔어. Node receiver로 듣는 중.');
  }
  if (content === '!leave') {
    try { bridge.connection?.destroy(); } catch {}
    bridge.connection = null;
    bridge.activeVoiceChannelId = '';
    return void msg.reply('나갈게.');
  }
  if (content.startsWith('!say ')) {
    const text = content.slice(5).trim();
    const mp3 = await synthTTS(text);
    await playAudio(mp3);
    return;
  }
  if (content.startsWith('!voice-test ')) {
    const text = content.slice('!voice-test '.length).trim();
    if (!text) return void msg.reply('테스트할 문장을 붙여줘.');
    const started = Date.now();
    try {
      await msg.reply(`TTS 백엔드 ${bridge.ttsBackend.name}로 음성 테스트할게.`);
      await speakText(text);
      await msg.channel.send(`음성 테스트 완료: ${bridge.ttsBackend.name}, ${Date.now() - started}ms`);
    } catch (e) {
      warn('voice-test failed', e?.stack || e);
      await msg.channel.send(`음성 테스트 실패: ${String(e?.message || e).slice(0, 700)}`);
    }
    return;
  }
  if (content === '!voice-clone' || content === '!voice-clone status') {
    const current = voiceCloneCapture.current();
    if (current?.userId === String(msg.author.id)) {
      return void msg.reply(`다음 유효한 음성을 ${path.relative(ROOT, current.targetPath)}에 저장할게.`);
    }
    return void msg.reply('대기 중인 보이스 클로닝 샘플 캡처가 없어. `!voice-clone capture`로 시작해.');
  }
  if (content === '!voice-clone cancel') {
    const cancelled = voiceCloneCapture.cancel(msg.author.id);
    return void msg.reply(cancelled ? '보이스 클로닝 샘플 캡처를 취소했어.' : '대기 중인 캡처가 없어.');
  }
  if (content === '!voice-clone capture') {
    const armed = voiceCloneCapture.arm({ userId: msg.author.id, source: 'discord-command' });
    return void msg.reply(`다음 유효한 음성을 ${path.relative(ROOT, armed.targetPath)}에 저장할게. 음성 채널에서 10~30초 정도 말해줘.`);
  }
  if (content.startsWith('!ask ')) {
    const text = content.slice(5).trim();
    if (!text) return void msg.reply('물어볼 내용을 붙여줘.');
    await handleTextAgentMessage(msg, text, { speakResponse: true });
    return;
  }
  if (shouldRouteDiscordTextToAgent({
    content,
    channelId: msg.channelId,
    transcriptChannelId: settings.transcriptChannelId,
  }) || resolveProjectSessionForChannel(msg.channelId)) {
    await handleTextAgentMessage(msg, content, { speakResponse: false });
    return;
  }
});

process.stdout?.on?.('error', error => {
  if (isBenignTransientNetworkError(error)) {
    bridgeLogger.markStdioBroken();
    reportTransientProcessError('stdout error', error);
    return;
  }
  warn('stdout error', error?.stack || error);
});
process.stderr?.on?.('error', error => {
  if (isBenignTransientNetworkError(error)) {
    bridgeLogger.markStdioBroken();
    reportTransientProcessError('stderr error', error);
    return;
  }
  warn('stderr error', error?.stack || error);
});
process.on('unhandledRejection', error => {
  if (reportTransientProcessError('unhandled rejection', error)) return;
  warn('unhandled rejection', error?.stack || error);
});
process.on('uncaughtException', error => {
  if (reportTransientProcessError('uncaught exception', error)) return;
  warn('uncaught exception; exiting', error?.stack || error);
  process.exit(1);
});
client.on('error', e => warn('discord client error', e?.stack || e));
client.on('shardError', e => warn('discord shard error', e?.stack || e));

let shutdownStarted = false;
async function gracefulShutdown(signalName) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  log('graceful shutdown requested', signalName, 'connection', Boolean(bridge.connection));
  try {
    if (bridge.currentAbortController && !bridge.currentAbortController.signal.aborted) bridge.currentAbortController.abort();
  } catch (e) {
    warn('abort before shutdown failed', e?.stack || e);
  }
  try {
    if (bridge.connection) {
      let detail = '';
      const noticePath = path.join(ROOT, '.cache', 'restart-notice.txt');
      try {
        if (fs.existsSync(noticePath)) {
          detail = fs.readFileSync(noticePath, 'utf8').replace(/\s+/g, ' ').trim().slice(0, 120);
        }
      } catch (e) {
        warn('read restart notice failed', e?.stack || e);
      }
      await speakText(formatRestartShutdownNotice(detail, settings.tts.edge.voice));
      await waitEvent(bridge.player, AudioPlayerStatus.Idle, 30000).catch(() => {});
    }
  } catch (e) {
    warn('shutdown voice notice failed', e?.stack || e);
  }
  if (pendingFallbackNoticePromises.size) {
    try {
      await Promise.race([
        Promise.allSettled(Array.from(pendingFallbackNoticePromises)),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch {}
  }
  try { bridge.ttsBackend?.close?.(); } catch (e) { warn('tts backend close failed', e?.message || e); }
  try { bridge.connection?.destroy(); } catch {}
  try { client.destroy(); } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });

client.login(settings.token);
