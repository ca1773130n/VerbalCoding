import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import {
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import prism from 'prism-media';
import wav from 'wav';
import { buildAgentSettings, createAgentAdapter, isPatchLikeOutput, shellSplit } from './agent_adapters.mjs';
import {
  appendJsonl,
  createLatencyTurn,
  formatLatencySummary,
  readJsonlRecords,
  summarizeLatencyRecords,
} from './latency_metrics.mjs';
import { splitForTTS } from './tts_chunks.mjs';
import { playChunkedTTSWithPrefetch } from './tts_prefetch.mjs';
import { createSentencer } from './stream_sentencer.mjs';
import { createStreamingTTSQueue } from './streaming_tts_queue.mjs';
import { createSmartProgressSummarizer } from './smart_progress.mjs';
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
import { createNotifier, buildDiscordDeepLink } from './notify.mjs';
import { progressCategory, summarizeProgressEvents, formatProgressMessage } from './progress_speech.mjs';
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
import { pickOccupiedUserVoiceChannel, shouldFollowUserVoiceChannel } from './voice_autojoin.mjs';
import { sendDiscordText, splitDiscordMessage } from './discord_text.mjs';
import { progressTtsCacheFileName } from './progress_cache.mjs';
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
  try { ttsBackend?.close?.(); } catch (e) { warn('tts backend close failed', e?.message || e); }
  ttsBackend = createTtsBackend(settings.tts, { execFileAsync, spawn, log, warn, onFallback: ttsFallbackNotice, voiceProvider: () => settings.tts.edge.voice });
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
let ttsBackend = createTtsBackend(settings.tts, { execFileAsync, spawn, log, warn, onFallback: ttsFallbackNotice, voiceProvider: () => settings.tts.edge.voice });
const voiceCloneCapture = createVoiceCloneCaptureState({ defaultTargetPath: settings.tts.openvoice.refAudio });

let connection = null;
let activeVoiceChannelId = '';
let activeTranscriptChannelId = '';
const recentDiscordTextByChannel = new Map();
let player = createAudioPlayer();
let speaking = false;
let processing = false;
let activeTurnId = 0;
let currentAbortController = null;
const interruptedTurns = new Set();
const activeStreams = new Map();
let bridgeState = null;
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
bridgeState = createBridgeState({ log, cleanupFile: file => fs.rm(file, { force: true }, () => {}) });
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
  return bridgeState?.discardQueues(reason) || 0;
}
let verboseProgress = Boolean(settings.agent.verboseProgress);
let activeProgressSignal = null;
let verboseProgressSpeechQueue = Promise.resolve();
let activeProgressAbortController = null;
let speechPlaybackGeneration = 0;
let progressSpeechBatch = [];
let progressSpeechBatchTimer = null;
let progressSpeechBatchSignal = null;
let progressSpeechBatchStartedAt = 0;

const STREAMING_TTS_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.STREAMING_TTS || '0').toLowerCase());
let activeSentencer = null;
let activeStreamingQueue = null;
let streamingSpeechDelivered = false;

let notifyUserOptIn = false;
let notifierInstance = null;
function ensureNotifier() {
  if (notifierInstance) return notifierInstance;
  notifierInstance = createNotifier({
    provider: (process.env.NOTIFY_PROVIDER || 'ntfy').toLowerCase(),
    topic: process.env.NTFY_TOPIC || '',
    pushoverUser: process.env.PUSHOVER_USER || '',
    pushoverToken: process.env.PUSHOVER_TOKEN || '',
  });
  return notifierInstance;
}
function notifyStatusText() {
  const provider = (process.env.NOTIFY_PROVIDER || 'ntfy').toLowerCase();
  const hasTopic = provider === 'ntfy' ? Boolean(process.env.NTFY_TOPIC) : (provider === 'pushover' ? Boolean(process.env.PUSHOVER_USER && process.env.PUSHOVER_TOKEN) : true);
  const mode = notifyUserOptIn ? 'always' : 'empty-channel only';
  const config = hasTopic ? 'configured' : 'NOT configured';
  return `notify: ${mode} via ${provider} (${config}). Threshold: ${process.env.NOTIFY_MIN_TASK_MS || '60000'}ms.`;
}
async function getVoiceChannelHumanCount() {
  if (!activeVoiceChannelId) return 0;
  try {
    const ch = await client.channels.fetch(activeVoiceChannelId).catch(() => null);
    if (!ch || !ch.members) return 0;
    let count = 0;
    for (const [, m] of ch.members) if (!m.user?.bot) count += 1;
    return count;
  } catch (e) {
    warn('humanCount failed', e?.message || e);
    return 0;
  }
}
let lastNotifyAt = 0;
let lastNotifyBody = '';
async function maybeNotifyTaskComplete({ answer, label, elapsedMs, guildId }) {
  const provider = (process.env.NOTIFY_PROVIDER || '').toLowerCase();
  if (!provider || provider === 'noop') return;
  const minTaskMs = Number(process.env.NOTIFY_MIN_TASK_MS || '60000');
  const debounceMs = Number(process.env.NOTIFY_DEBOUNCE_MS || '30000');
  const humanCount = await getVoiceChannelHumanCount();
  const notifier = ensureNotifier();
  if (!notifier.shouldNotify({ humanCount, taskMs: elapsedMs, minTaskMs, userOptIn: notifyUserOptIn })) return;
  const text = String(answer || '').trim();
  const lastSentence = text.split(/(?<=[.!?。！？])\s+/).filter(Boolean).pop() || text;
  const body = lastSentence.slice(0, 200);
  const now = Date.now();
  if (body && body === lastNotifyBody && now - lastNotifyAt < debounceMs) {
    log('notify debounced', 'sinceLastMs', now - lastNotifyAt);
    return;
  }
  const title = label ? `${label} finished` : 'VerbalCoding finished';
  const deepLink = buildDiscordDeepLink({ guildId, channelId: activeVoiceChannelId });
  try {
    const result = await notifier.send({ title, body, deepLink });
    lastNotifyAt = now;
    lastNotifyBody = body;
    log('notify sent', 'provider', provider, 'status', result?.status || result?.ok, 'skipped', result?.skipped || false);
  } catch (e) {
    warn('notify send failed', e?.message || e);
  }
}

const planStates = new Map(); // channelId -> { steps, language }

function planChannelKey() {
  return activeVoiceChannelId || settings.transcriptChannelId || 'default';
}

async function askNextDecision(state, signal) {
  const decision = state.decisions[state.pendingDecisionIndex];
  if (!decision) return;
  const text = renderDecisionPrompt(decision, state.language);
  await sendText(`❓ ${text}`);
  await speakText(text, signal, null);
}

async function finalizePlanReady(state, signal) {
  const language = state.language;
  const resolvedLine = renderResolvedDecisions(state.resolvedDecisions, language);
  const plan = planNarrationLines(state.steps, language);
  const tail = /^en/i.test(String(language || ''))
    ? `${plan}\n${resolvedLine}\nSay "approve" to run, or edit with skip/insert.`
    : `${plan}\n${resolvedLine}\n"실행"이라고 하면 시작할게. skip/insert로 수정도 돼.`;
  await sendText(`📝 ${tail}`);
  await speakText(tail, signal, null);
}

async function dispatchPlanModeUtterance(prompt, signal) {
  const language = settings.voiceLanguage;
  const key = planChannelKey();
  const existing = planStates.get(key);

  if (existing && existing.pendingDecisionIndex < existing.decisions.length) {
    const controlCommand = parsePlanVoiceCommand(prompt, language);
    if (controlCommand.type === 'cancel') {
      const cancelState = routingStateFor(key);
      if (existing.routingSnapshot) cancelState.activeRouting = { ...existing.routingSnapshot };
      cancelState.pendingFallbackPrompt = null;
      cancelState.lastResolvedDecisions = {};
      planStates.delete(key);
      const msg = /^en/i.test(String(language || '')) ? 'Plan cancelled.' : '계획을 취소했어.';
      await sendText(`❎ ${msg}`);
      await speakText(msg, signal, null);
      return { handled: true };
    }
    const decision = existing.decisions[existing.pendingDecisionIndex];
    const answer = parseDecisionAnswer(prompt, decision, language);
    if (answer.type === 'unknown') {
      await sendText(/^en/i.test(String(language || ''))
        ? '⚠️ I did not catch that. Please pick an option.'
        : '⚠️ 못 알아들었어. 옵션 중에 하나 골라줘.');
      await askNextDecision(existing, signal);
      return { handled: true };
    }
    const next = {
      ...existing,
      resolvedDecisions: { ...existing.resolvedDecisions, [decision.slot]: answer.choice },
      pendingDecisionIndex: existing.pendingDecisionIndex + 1,
    };
    planStates.set(key, next);
    if (isAgentRoutingDecision(decision) && answer.choice) {
      const candidate = adapterForBackend(answer.choice, resolveProjectSessionForChannel(key));
      if (candidate) {
        routingStateFor(key).activeRouting = { backend: answer.choice, sticky: true };
      } else {
        const msg = /^en/i.test(String(language || ''))
          ? `${answer.choice} is not installed; staying with ${settings.agent.label}.`
          : `${answer.choice}이(가) 설치되어 있지 않아. ${settings.agent.label}로 진행할게.`;
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
      }
    }
    if (next.pendingDecisionIndex < next.decisions.length) {
      await askNextDecision(next, signal);
    } else {
      await finalizePlanReady(next, signal);
    }
    return { handled: true };
  }

  if (existing) {
    const cmd = parsePlanVoiceCommand(prompt, language);
    if (cmd.type === 'skip' || cmd.type === 'insert') {
      const nextSteps = applyPlanCommand(existing.steps, cmd);
      planStates.set(key, { ...existing, steps: nextSteps });
      await finalizePlanReady({ ...existing, steps: nextSteps }, signal);
      return { handled: true };
    }
    if (cmd.type === 'cancel') {
      const cancelState = routingStateFor(key);
      if (existing.routingSnapshot) cancelState.activeRouting = { ...existing.routingSnapshot };
      cancelState.pendingFallbackPrompt = null;
      cancelState.lastResolvedDecisions = {};
      planStates.delete(key);
      const msg = /^en/i.test(String(language || '')) ? 'Plan cancelled.' : '계획을 취소했어.';
      await sendText(`❎ ${msg}`);
      await speakText(msg, signal, null);
      return { handled: true };
    }
    if (cmd.type === 'approve') {
      routingStateFor(key).lastResolvedDecisions = existing.resolvedDecisions || {};
      const finalPlan = renderFinalPlan(existing.steps);
      const resolvedLine = renderResolvedDecisions(existing.resolvedDecisions, language);
      const promptToRun = [
        planExecutionPreamble(language),
        '',
        finalPlan,
        resolvedLine,
        '',
        `Original user request: ${existing.originalPrompt}`,
      ].filter(Boolean).join('\n');
      planStates.delete(key);
      const note = /^en/i.test(String(language || '')) ? 'Running the plan now.' : '계획대로 실행할게.';
      await sendText(`▶ ${note}`);
      await speakText(note, signal, null);
      return { handled: false, prompt: promptToRun };
    }
    planStates.delete(key);
    return { handled: false, prompt };
  }

  if (isPlanEntryUtterance(prompt, language)) {
    const planPrompt = `${planModePreamble(language)}\n\nUser request: ${prompt}`;
    const adapter = adapterForProjectSession(resolveProjectSessionForChannel(planChannelKey()));
    const plan = { task: false, label: adapter.label, verboseProgress: false, language, projectContext: '' };
    const result = await adapter.run(planPrompt, signal, plan).catch(e => ({ answer: '', error: e }));
    const { steps, decisions } = parsePlanOutput(result.answer || '');
    if (!steps.length) {
      const failMsg = /^en/i.test(String(language || ''))
        ? 'I could not produce a plan. Continuing as a regular turn.'
        : '계획을 만들지 못했어. 일반 작업으로 진행할게.';
      await sendText(`⚠️ ${failMsg}`);
      return { handled: false, prompt };
    }
    const planKey = planChannelKey();
    const routingSnapshot = { ...routingStateFor(planKey).activeRouting };
    const state = {
      steps,
      decisions,
      resolvedDecisions: {},
      pendingDecisionIndex: 0,
      originalPrompt: prompt,
      language,
      routingSnapshot,
    };
    planStates.set(planKey, state);
    const narration = planNarrationLines(steps, language);
    await sendText(`📝 ${narration}`);
    await speakText(narration, signal, null);
    if (decisions.length) {
      await askNextDecision(state, signal);
    } else {
      await finalizePlanReady(state, signal);
    }
    return { handled: true };
  }
  return { handled: false, prompt };
}

function planNarrationLines(steps, language) {
  const visible = steps.filter(s => s.status !== 'skipped');
  const header = /^en/i.test(String(language || ''))
    ? `Plan with ${visible.length} steps. Say "skip step N", "add X after step N", or "approve" to run.`
    : `${visible.length}단계 계획. "step N 건너뛰어", "step N 다음에 X 추가", "실행"이라고 말해줘.`;
  const body = visible.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
  return `${header}\n${body}`;
}

let smartProgressEnabled = Boolean(process.env.SMART_PROGRESS_API_KEY);
let smartProgressSummarizer = null;
function ensureSmartProgressSummarizer() {
  if (smartProgressSummarizer) return smartProgressSummarizer;
  smartProgressSummarizer = createSmartProgressSummarizer({
    apiKey: process.env.SMART_PROGRESS_API_KEY || '',
    baseUrl: process.env.SMART_PROGRESS_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.SMART_PROGRESS_MODEL || 'llama-3.1-8b-instant',
    language: settings.voiceLanguage,
  });
  smartProgressSummarizer.on('summary', summary => {
    if (!summary || !activeProgressSignal) return;
    queueVerboseProgressSpeech(summary, activeProgressSignal);
  });
  return smartProgressSummarizer;
}
function smartProgressStatusText() {
  const hasKey = Boolean(process.env.SMART_PROGRESS_API_KEY);
  const mode = smartProgressEnabled && hasKey ? 'on' : 'off';
  const reason = !hasKey ? ' (no SMART_PROGRESS_API_KEY set)' : '';
  return `smart-progress: ${mode}${reason}`;
}
let activeProgressLastEventAt = 0;
let lastVerboseProgressText = '';
let lastVerboseProgressTextAt = 0;
const VOICE_CONNECT_TIMEOUT_MS = Number(process.env.VOICE_CONNECT_TIMEOUT_MS || '60000');
const PROGRESS_IDLE_NOTICE_INITIAL_MS = Number(process.env.PROGRESS_IDLE_NOTICE_INITIAL_MS || process.env.PROGRESS_IDLE_NOTICE_MS || '10000');
const PROGRESS_IDLE_NOTICE_MAX_MS = Number(process.env.PROGRESS_IDLE_NOTICE_MAX_MS || '30000');
const PROGRESS_IDLE_NOTICE_MULTIPLIER = Number(process.env.PROGRESS_IDLE_NOTICE_MULTIPLIER || '1.8');
const PROGRESS_IDLE_CHECK_MS = Number(process.env.PROGRESS_IDLE_CHECK_MS || '5000');
const PROGRESS_IDLE_NOTICE_LIMIT = Number(process.env.PROGRESS_IDLE_NOTICE_LIMIT || '20');
const projectSessionsState = loadProjectSessions(settings.projectSessionsPath);
const agentAdaptersBySession = new Map();
function createBridgeAgentAdapter(agentSettings) {
  return createAgentAdapter(agentSettings, {
    execFileAsync,
    spawn,
    log,
    warn,
    onProgress: event => {
      if (!verboseProgress) return;
      activeProgressLastEventAt = Date.now();
      sendVerboseProgressText(event, activeProgressSignal);
      if (smartProgressEnabled && process.env.SMART_PROGRESS_API_KEY) {
        try { ensureSmartProgressSummarizer().ingest(event); }
        catch (e) { warn('smart progress ingest failed', e?.stack || e); queueVerboseProgressSpeech(event, activeProgressSignal); }
      } else {
        queueVerboseProgressSpeech(event, activeProgressSignal);
      }
    },
    onStdoutChunk: chunk => {
      if (activeSentencer) {
        try { activeSentencer.push(chunk); } catch (e) { warn('streaming sentencer push failed', e?.stack || e); }
      }
    },
  });
}
const agentAdapter = createBridgeAgentAdapter(settings.agent);
function adapterForProjectSession(session) {
  if (!session) return agentAdapter;
  const key = session.slug || session.name;
  if (!agentAdaptersBySession.has(key)) {
    agentAdaptersBySession.set(key, createBridgeAgentAdapter({
      ...settings.agent,
      label: `${settings.agent.label} · ${session.name}`,
      sessionFile: session.sessionFile,
      cwd: session.workdir,
      projectContext: projectSessionContextText(session),
    }));
  }
  return agentAdaptersBySession.get(key);
}
function resolveProjectSessionForChannel(channelId) {
  return projectSessionForChannel(projectSessionsState, channelId) || null;
}

const agentAdaptersByBackend = new Map();
const routingStateByChannel = new Map();
function routingStateFor(channelKey) {
  const key = String(channelKey || 'default');
  let state = routingStateByChannel.get(key);
  if (!state) {
    state = {
      activeRouting: { backend: settings.agent.backend, sticky: false },
      lastUsedBackend: settings.agent.backend,
      lastResolvedDecisions: {},
      pendingFallbackPrompt: null,
      recentUtterances: [],
    };
    routingStateByChannel.set(key, state);
  }
  return state;
}
function recordUtterance(channelKey, text) {
  if (!text) return;
  const state = routingStateFor(channelKey);
  state.recentUtterances.push(text);
  while (state.recentUtterances.length > 4) state.recentUtterances.shift();
}

const ontologyByChannel = new Map();
function ontologyStateFor(channelKey) {
  const key = String(channelKey || 'default');
  let store = ontologyByChannel.get(key);
  if (!store) {
    store = createSessionOntology({ channelKey: key });
    try { store.load(); } catch {}
    ontologyByChannel.set(key, store);
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
function clearTransientRouting(channelKey) {
  const state = routingStateFor(channelKey);
  state.pendingFallbackPrompt = null;
  if (!state.activeRouting?.sticky) {
    state.activeRouting = { backend: settings.agent.backend, sticky: false };
  }
}
function invalidateBackendAdaptersForSession(sessionSlug) {
  if (!sessionSlug) return;
  for (const key of Array.from(agentAdaptersByBackend.keys())) {
    if (key.endsWith(`::${sessionSlug}`)) agentAdaptersByBackend.delete(key);
  }
}
const installedBinaryCache = new Map();
function commandIsInstalled(binary, { cwd = process.cwd() } = {}) {
  if (!binary) return false;
  const isWindows = process.platform === 'win32';
  const exts = isWindows
    ? String(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  function existsExecutable(candidate) {
    try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
  }
  function existsAnyExt(candidate) {
    if (existsExecutable(candidate)) return true;
    if (isWindows && !/\.[^\\/.]+$/.test(candidate)) {
      return exts.some(ext => existsExecutable(candidate + ext));
    }
    return false;
  }
  if (path.isAbsolute(binary)) return existsAnyExt(binary);
  const hasPathSep = binary.includes('/') || (isWindows && binary.includes('\\'));
  if (hasPathSep) return existsAnyExt(path.resolve(cwd, binary));
  if (installedBinaryCache.has(binary)) return installedBinaryCache.get(binary);
  const pathEntries = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const found = pathEntries.some(dir => existsAnyExt(path.join(dir, binary)));
  installedBinaryCache.set(binary, found);
  return found;
}
function adapterForBackend(backend, session = null) {
  const normalized = String(backend || '').toLowerCase();
  if (!normalized || normalized === settings.agent.backend) {
    return session ? adapterForProjectSession(session) : agentAdapter;
  }
  const key = `${normalized}::${session ? (session.slug || session.name) : '_default'}`;
  if (agentAdaptersByBackend.has(key)) return agentAdaptersByBackend.get(key);
  let routedSettings;
  try {
    const scrubbed = { ...process.env };
    for (const key of ['AGENT_BACKEND', 'AGENT_LABEL', 'AGENT_COMMAND', 'AGENT_SESSION_FILE']) {
      delete scrubbed[key];
    }
    scrubbed.AGENT_BACKEND = normalized;
    routedSettings = buildAgentSettings({
      ROOT: settings.agent.cwd || process.cwd(),
      env: scrubbed,
    });
  } catch (e) {
    warn(`adapterForBackend: cannot build settings for ${normalized}: ${e?.message || e}`);
    return null;
  }
  if (session) {
    routedSettings = {
      ...routedSettings,
      label: `${routedSettings.label} · ${session.name}`,
      sessionFile: session.sessionFile,
      cwd: session.workdir || routedSettings.cwd,
      projectContext: projectSessionContextText(session),
    };
  }
  const argv = shellSplit(String(routedSettings.command || ''));
  const binary = argv[0];
  if (binary && !commandIsInstalled(binary, { cwd: routedSettings.cwd || settings.agent.cwd || process.cwd() })) {
    warn(`adapterForBackend: ${normalized} binary not found on PATH: ${binary}`);
    return null;
  }
  const adapter = createBridgeAgentAdapter(routedSettings);
  agentAdaptersByBackend.set(key, adapter);
  return adapter;
}
function saveProjectSessionsState() {
  saveProjectSessions(settings.projectSessionsPath, projectSessionsState);
}
let sensitivityMode = SENSITIVITY_MODE_DEFAULT;
let sensitivityModeExpiresAt = 0;
function currentBargeInThresholds() {
  if (sensitivityModeExpiresAt && Date.now() > sensitivityModeExpiresAt) {
    sensitivityMode = SENSITIVITY_MODE_DEFAULT;
    sensitivityModeExpiresAt = 0;
    log('barge-in sensitivity mode expired; restored', sensitivityMode);
  }
  return bargeInThresholdsForMode(sensitivityMode, {
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
  sensitivityMode = mode === 'conservative' ? 'conservative' : 'normal';
  sensitivityModeExpiresAt = sensitivityMode === 'conservative' && SENSITIVITY_OUTDOOR_SECONDS > 0
    ? Date.now() + SENSITIVITY_OUTDOOR_SECONDS * 1000
    : 0;
  const thresholds = currentBargeInThresholds();
  log('barge-in sensitivity mode set', sensitivityMode, 'reason', reason, 'expiresAt', sensitivityModeExpiresAt || 'never', 'thresholds', thresholds);
  return thresholds;
}
function sensitivityStatusText() {
  const thresholds = currentBargeInThresholds();
  const ttl = sensitivityModeExpiresAt ? Math.max(0, Math.round((sensitivityModeExpiresAt - Date.now()) / 1000)) : 0;
  return sensitivityStatusTextForLanguage(thresholds, ttl, settings.voiceLanguage);
}

function verboseStatusText() {
  return verboseStatusTextForLanguage(verboseProgress, settings.voiceLanguage);
}

function progressEmoji(event) {
  const category = progressCategory(event, { language: settings.voiceLanguage })?.key;
  return {
    test: '🧪',
    edit: '✏️',
    read: '📖',
    search: '🔎',
    terminal: '⌨️',
    skill: '🧰',
    browser: '🌐',
    tool: '🛠️',
    agent: '🤖',
    work: '⚙️',
  }[category] || '⚙️';
}

function formatProgressText(event) {
  return formatProgressMessage(event, { language: settings.voiceLanguage });
}

function setVerboseProgress(enabled, reason = 'manual') {
  verboseProgress = Boolean(enabled);
  log('verbose progress mode set', verboseProgress, 'reason', reason);
  return verboseProgress;
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

async function ensureSelectedTtsBackendInstalled(selection, signal) {
  if (selection.backend === 'mlxaudio') {
    const mlxPython = process.env.MLXAUDIO_PYTHON || './.venv-mlxaudio/bin/python';
    const mlxPath = path.isAbsolute(mlxPython) ? mlxPython : path.resolve(ROOT, mlxPython);
    if (fs.existsSync(mlxPath)) return { ok: true, installed: false };
    await speakText('MLX Audio가 아직 설치 안 돼 있어서 지금 설치할게. 처음엔 모델 다운로드가 걸릴 수 있어.', signal, { mirrorText: true });
    try {
      await execFileAsync('bash', [path.join(ROOT, 'scripts', 'install_mlxaudio.sh'), '--yes'], {
        cwd: ROOT,
        timeout: Number(process.env.MLXAUDIO_INSTALL_TIMEOUT_MS || '1800000'),
        maxBuffer: 1024 * 1024,
      });
      process.env.MLXAUDIO_PYTHON = './.venv-mlxaudio/bin/python';
      persistEnvValues({ MLXAUDIO_PYTHON: './.venv-mlxaudio/bin/python' });
      return { ok: true, installed: true };
    } catch (error) {
      const tail = String(error?.stderr || error?.stdout || error?.message || error).slice(-900);
      warn('MLX Audio auto-install failed', tail);
      await speakText(`MLX Audio 자동 설치가 실패했어. Edge fallback은 유지할게. 로그 꼬리: ${tail}`, signal, { mirrorText: true });
      return { ok: false, installed: false, error };
    }
  }
  if (selection.backend === 'fireredtts2') {
    const fireCommand = process.env.FIREREDTTS2_COMMAND || './.local/bin/fireredtts2';
    const firePath = path.isAbsolute(fireCommand) ? fireCommand : path.resolve(ROOT, fireCommand);
    const fireModel = path.resolve(ROOT, process.env.FIREREDTTS2_PRETRAINED_DIR || 'pretrained_models/FireRedTTS2');
    if (fs.existsSync(firePath) && fs.existsSync(fireModel)) return { ok: true, installed: false };
    await speakText('FireRedTTS-2가 아직 설치 안 돼 있어서 지금 설치할게. 모델 다운로드 때문에 오래 걸릴 수 있어.', signal, { mirrorText: true });
    try {
      await execFileAsync('bash', [path.join(ROOT, 'scripts', 'install_fireredtts2.sh'), '--yes'], {
        cwd: ROOT,
        timeout: Number(process.env.FIREREDTTS2_INSTALL_TIMEOUT_MS || '3600000'),
        maxBuffer: 1024 * 1024,
      });
      process.env.FIREREDTTS2_COMMAND = './.local/bin/fireredtts2';
      process.env.FIREREDTTS2_PRETRAINED_DIR = 'pretrained_models/FireRedTTS2';
      persistEnvValues({
        FIREREDTTS2_COMMAND: './.local/bin/fireredtts2',
        FIREREDTTS2_PRETRAINED_DIR: 'pretrained_models/FireRedTTS2',
      });
      return { ok: true, installed: true };
    } catch (error) {
      const tail = String(error?.stderr || error?.stdout || error?.message || error).slice(-900);
      warn('FireRedTTS-2 auto-install failed', tail);
      await speakText(`FireRedTTS-2 자동 설치가 실패했어. Edge fallback은 유지할게. 로그 꼬리: ${tail}`, signal, { mirrorText: true });
      return { ok: false, installed: false, error };
    }
  }
  if (selection.backend === 'mossttsnano') {
    const mossCommand = process.env.MOSSTTSNANO_COMMAND || './.local/bin/mossttsnano';
    const mossPath = path.isAbsolute(mossCommand) ? mossCommand : path.resolve(ROOT, mossCommand);
    const mossScript = path.resolve(ROOT, process.env.MOSSTTSNANO_SCRIPT || 'vendor/MOSS-TTS-Nano/infer.py');
    if (fs.existsSync(mossPath) && fs.existsSync(mossScript)) return { ok: true, installed: false };
    await speakText('MOSS-TTS-Nano가 아직 설치 안 돼 있어서 지금 설치할게. 처음엔 모델 다운로드가 걸릴 수 있어.', signal, { mirrorText: true });
    try {
      await execFileAsync('bash', [path.join(ROOT, 'scripts', 'install_mossttsnano.sh'), '--yes'], {
        cwd: ROOT,
        timeout: Number(process.env.MOSSTTSNANO_INSTALL_TIMEOUT_MS || '1800000'),
        maxBuffer: 1024 * 1024,
      });
      process.env.MOSSTTSNANO_COMMAND = './.venv-mossttsnano/bin/python';
      process.env.MOSSTTSNANO_SCRIPT = 'vendor/MOSS-TTS-Nano/infer.py';
      persistEnvValues({
        MOSSTTSNANO_COMMAND: './.venv-mossttsnano/bin/python',
        MOSSTTSNANO_SCRIPT: 'vendor/MOSS-TTS-Nano/infer.py',
      });
      return { ok: true, installed: true };
    } catch (error) {
      const tail = String(error?.stderr || error?.stdout || error?.message || error).slice(-900);
      warn('MOSS-TTS-Nano auto-install failed', tail);
      await speakText(`MOSS-TTS-Nano 자동 설치가 실패했어. Edge fallback은 유지할게. 로그 꼬리: ${tail}`, signal, { mirrorText: true });
      return { ok: false, installed: false, error };
    }
  }
  return { ok: true, installed: false };
}

async function handleTtsVoiceCommand(prompt, signal) {
  const request = voiceCommandFromTranscript(prompt);
  if (!request) return false;
  discardVoiceInputQueues('voice-change');
  let config = ensureTtsVoiceConfig();
  config = updateTtsVoiceConfig(config, request);
  writeTtsVoiceConfig(TTS_VOICE_CONFIG_PATH, config);
  const { selection } = applyVoiceConfigToProcessEnv(config);
  await ensureSelectedTtsBackendInstalled(selection, signal);
  rebuildTtsRuntimeSettings(selection);
  if (selection.voice?.language) settings.voiceLanguage = selection.voice.language;
  persistEnvValues({
    TTS_BACKEND: selection.backend,
    TTS_VOICE_TYPE: selection.voiceType,
    TTS_VOICE: selection.backend === 'edge' ? selection.voice.voice : process.env.TTS_VOICE,
    VOICE_LANGUAGE: settings.voiceLanguage,
    MLXAUDIO_PYTHON: selection.backend === 'mlxaudio' ? (process.env.MLXAUDIO_PYTHON || './.venv-mlxaudio/bin/python') : process.env.MLXAUDIO_PYTHON,
    MLXAUDIO_VOICE: selection.backend === 'mlxaudio' ? (process.env.MLXAUDIO_VOICE || selection.voice?.voice) : process.env.MLXAUDIO_VOICE,
    FIREREDTTS2_COMMAND: selection.backend === 'fireredtts2' ? (process.env.FIREREDTTS2_COMMAND || './.local/bin/fireredtts2') : process.env.FIREREDTTS2_COMMAND,
    FIREREDTTS2_PRETRAINED_DIR: selection.backend === 'fireredtts2' ? (process.env.FIREREDTTS2_PRETRAINED_DIR || 'pretrained_models/FireRedTTS2') : process.env.FIREREDTTS2_PRETRAINED_DIR,
  });
  await speakText(voiceChangedText(selection), signal);
  notifyVoiceCloneSampleGapIfNeeded(selection, signal).catch(e => warn('voice clone gap notice failed', e?.message || e));
  return true;
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

async function handleLanguageCommand(prompt, signal) {
  const request = voiceLanguageCommandFromTranscript(prompt);
  if (!request) return false;
  const preset = applyRuntimeLanguage(request.language);
  await speakText(languageChangedText(preset), signal);
  return true;
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
    channelId: activeTranscriptChannelId || settings.transcriptChannelId,
    text,
    log,
    warn,
  });
}

async function sendEmbed(embed, { content = '' } = {}) {
  if (!embed) return false;
  try {
    const channelId = activeTranscriptChannelId || settings.transcriptChannelId;
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

function sendVerboseProgressText(event, signal) {
  if (!verboseProgress || !signal || signal.aborted || activeProgressSignal !== signal) return;
  const formatted = formatProgressText(event).replace(/\s+/g, ' ').trim();
  if (!formatted) return;
  const message = formatted.slice(0, 1900);
  const now = Date.now();
  if (message === lastVerboseProgressText && now - lastVerboseProgressTextAt < 2000) return;
  lastVerboseProgressText = message;
  lastVerboseProgressTextAt = now;
  void sendText(message).catch(e => warn('verbose progress text delivery failed', e?.stack || e));
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

async function transcribeOnce(wavPath, input16k, outBase) {
  const args = ['-m', settings.whisperModel, '-f', input16k];
  if (shouldPassWhisperLanguage(settings.whisperLanguage)) args.push('-l', settings.whisperLanguage);
  args.push('-nt', '-otxt', '-of', outBase, '-sns', '-nf', '-nth', '0.35', '-et', '2.2', '-lpt', '-0.8');
  try {
    await execFileAsync(settings.whisperBin, args, { timeout: settings.whisperTimeoutMs, maxBuffer: 4 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`whisper failed: ${whisperFailureMessage(e)}`);
  }
  const txtPath = `${outBase}.txt`;
  const raw = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
  return { raw, txtPath };
}

async function transcribe(wavPath) {
  const tmpBase = path.join(os.tmpdir(), `hermes-node-stt-${Date.now()}`);
  const input16k = `${tmpBase}.16k.wav`;
  const outBase = `${tmpBase}.out`;
  // whisper.cpp can read WAV, but Discord receiver output is 48 kHz stereo.
  // Convert explicitly to the 16 kHz mono PCM shape Whisper expects.
  await execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', input16k], {
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });

  let raw = '';
  let txtPath = '';
  try {
    ({ raw, txtPath } = await transcribeOnce(wavPath, input16k, outBase));
    let cleaned = cleanTranscript(raw);
    log('stt raw', JSON.stringify(raw.trim()).slice(0, 500), 'cleaned', JSON.stringify(cleaned).slice(0, 500));
    if (!cleaned) {
      await sleep(300);
      const retryBase = `${tmpBase}.retry`;
      const retry = await transcribeOnce(wavPath, input16k, retryBase);
      raw = retry.raw;
      txtPath = retry.txtPath;
      cleaned = cleanTranscript(raw);
      log('stt retry raw', JSON.stringify(raw.trim()).slice(0, 500), 'cleaned', JSON.stringify(cleaned).slice(0, 500));
    }
    return cleaned;
  } finally {
    if (settings.debugDir) {
      const debug16k = path.join(settings.debugDir, `stt-input-${stamp()}.wav`);
      fs.copyFile(input16k, debug16k, () => {});
      if (raw) fs.writeFile(path.join(settings.debugDir, `stt-raw-${stamp()}.txt`), raw, () => {});
    }
    fs.rm(input16k, { force: true }, () => {});
    if (txtPath) fs.rm(txtPath, { force: true }, () => {});
  }
}

function cleanTranscript(raw) {
  const bad = [
    '구독', '좋아요', '알림설정', '시청해주셔서', '시청해주신', '다음영상', '영상에서만나요',
    '부탁드려요', '큰힘이됩니다',
    'mbc뉴스', '이준범기자입니다', '뉴스입니다', '기자입니다', '앵커', '속보', '보도입니다', '전해드립니다',
  ];
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^\[[^\]]+\]\s*/, '').trim());
  const kept = [];
  for (const line of lines) {
    const compact = line
      .replace(/\s+/g, '')
      .replace(/[\p{P}\p{S}_]+/gu, '');
    if (!compact) continue;
    if (/^[\(\[（【].*[\)\]）】]$/.test(line.replace(/\s+/g, ''))) continue;
    if (['끄덕', '끄덕끄덕', '박수', '웃음', '음악', '자막', '침묵', '무음'].includes(compact)) continue;
    if (bad.some(b => compact.toLowerCase().includes(b))) continue;
    if (isRepeatedNoiseTranscript(compact)) continue;
    kept.push(line);
  }
  return kept.join(' ').trim();
}

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
    try { ttsBackend?.close?.(); } catch (e) { warn('tts backend close failed', e?.message || e); }
    ttsBackend = createTtsBackend(settings.tts, { execFileAsync, spawn, log, warn, onFallback: ttsFallbackNotice, voiceProvider: () => settings.tts.edge.voice });
    log('tts backend reloaded from voice config', settings.tts.backend, 'voiceType', selection.voiceType);
  }
  return selection;
}

async function synthTTS(text, signal) {
  await refreshTtsRuntimeConfig();
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      log('final tts synth start', 'backend', ttsBackend.name, 'attempt', attempt, 'chars', String(text || '').length);
      const out = await ttsBackend.synthesize(text, { signal, kind: 'final' });
      log('final tts synth done', 'backend', ttsBackend.name, 'attempt', attempt, out, fs.statSync(out).size);
      return out;
    } catch (e) {
      lastError = e;
      if (isAbortError(e) || signal?.aborted) throw e;
      warn('final tts synth failed', 'attempt', attempt, e?.stderr?.toString?.().slice(-500) || e?.message || e);
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function synthProgressTTS(text, signal) {
  await refreshTtsRuntimeConfig();
  const ext = ttsBackend.outputExtension || 'mp3';
  const cachePath = path.join(settings.tts.progressCacheDir, progressTtsCacheFileName({
    backendKeyParts: ttsBackend.cacheKeyParts(),
    text,
    ext,
  }));
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    log('progress tts cache hit', text, cachePath);
    return cachePath;
  }
  log('progress tts cache miss', text);
  const tmp = await ttsBackend.synthesize(text, { signal, kind: 'progress' });
  fs.renameSync(tmp, cachePath);
  return cachePath;
}

async function playAudio(file, { deleteAfter = true } = {}) {
  if (!connection) return;
  speaking = true;
  try {
    const resource = createAudioResource(file, { inputType: StreamType.Arbitrary, inlineVolume: true });
    resource.volume?.setVolume(settings.tts.volume);
    player.play(resource);
    connection.subscribe(player);
    await waitEvent(player, AudioPlayerStatus.Idle, 120000).catch(() => {});
  } finally {
    speaking = false;
    if (deleteAfter) fs.rm(file, { force: true }, () => {});
  }
}

async function speakText(text, signal, metricsTurn = null, options = {}) {
  const chunks = splitForTTS(text, settings.tts.maxChars);
  if (!chunks.length) return;
  if (options.mirrorText !== false) {
    await sendText(`${options.mirrorPrefix || '🔊 음성으로 읽는 내용'}:\n${String(text || '')}`);
  }
  log('TTS chunks', chunks.length, 'maxChars', settings.tts.maxChars, 'backend', ttsBackend.name);
  const playbackGeneration = speechPlaybackGeneration;
  const playbackStopped = () => playbackGeneration !== speechPlaybackGeneration;
  let synthMs = 0;
  let playMs = 0;
  const ttsStart = Date.now();
  await playChunkedTTSWithPrefetch(chunks, {
    signal,
    log,
    synth: async chunk => {
      if (playbackStopped()) return null;
      const start = Date.now();
      try { return await synthTTS(chunk, signal); }
      finally { synthMs += Date.now() - start; }
    },
    play: async file => {
      if (playbackStopped()) {
        await fs.promises.rm(file, { force: true }).catch(() => {});
        return;
      }
      const start = Date.now();
      try { return await playAudio(file); }
      finally { playMs += Date.now() - start; }
    },
    cleanup: file => fs.promises.rm(file, { force: true }),
  });
  metricsTurn?.stage('tts_synth', synthMs, { ttsChunks: chunks.length, spokenChars: String(text || '').length });
  metricsTurn?.stage('tts_play', playMs);
  metricsTurn?.stage('tts_total', Date.now() - ttsStart);
}

function beginStreamingTurn(signal) {
  if (!STREAMING_TTS_ENABLED || !connection) return false;
  streamingSpeechDelivered = false;
  const sentencer = createSentencer({ minChars: 40, maxLatencyMs: 800 });
  let streamingDropAnnounced = false;
  const queue = createStreamingTTSQueue({
    synth: async text => synthTTS(text, signal),
    play: async file => playAudio(file, { deleteAfter: false }),
    cleanup: async file => { try { await fs.promises.rm(file, { force: true }); } catch {} },
    signal,
    log,
    onSynthError: () => {
      if (streamingDropAnnounced || signal?.aborted) return;
      streamingDropAnnounced = true;
      const en = /^en/i.test(String(settings.voiceLanguage || ''));
      const msg = en
        ? 'Some sentences could not be spoken; check the text channel for the full answer.'
        : '일부 문장 음성 합성에 실패했어. 전체 답변은 텍스트 채널을 확인해줘.';
      void sendText(`⚠️ ${msg}`).catch(e => warn('streaming synth notice send failed', e?.message || e));
    },
  });
  sentencer.on('sentence', text => {
    if (signal?.aborted) return;
    queue.enqueue(text);
  });
  activeSentencer = sentencer;
  activeStreamingQueue = queue;
  log('streaming turn begin');
  return true;
}

async function endStreamingTurn() {
  const sentencer = activeSentencer;
  const queue = activeStreamingQueue;
  activeSentencer = null;
  activeStreamingQueue = null;
  if (!sentencer || !queue) return;
  try { sentencer.flush(); } catch (e) { warn('streaming sentencer flush failed', e?.stack || e); }
  try { await queue.drain(); } catch (e) { warn('streaming queue drain failed', e?.stack || e); }
  streamingSpeechDelivered = queue.size === 0;
  log('streaming turn end');
}

async function speakProgress(text, signal) {
  if (signal?.aborted) return;
  try {
    const mp3 = await synthProgressTTS(text, signal);
    if (signal?.aborted) return;
    await playAudio(mp3, { deleteAfter: false });
  } catch (e) {
    if (!isAbortError(e)) warn('progress tts failed', e?.stack || e);
  }
}

async function speakImmediateNotice(text, signal, reason = 'notice') {
  if (signal?.aborted) return;
  try {
    log('immediate notice speech', reason, 'text', String(text || '').slice(0, 80));
    const mp3 = await synthProgressTTS(text, signal);
    if (signal?.aborted) return;
    await playAudio(mp3, { deleteAfter: false });
  } catch (e) {
    if (!isAbortError(e)) warn('immediate notice speech failed', reason, e?.stack || e);
  }
}

function queueProgressSpeechText(text, signal, reason = 'status') {
  const spoken = String(text || '').replace(/\s+/g, ' ').trim();
  if (!spoken || !signal || signal.aborted || activeProgressSignal !== signal) return;
  verboseProgressSpeechQueue = verboseProgressSpeechQueue
    .catch(() => {})
    .then(async () => {
      if (signal.aborted || activeProgressSignal !== signal || !processing) return;
      log('progress speech queued', reason, 'text', spoken);
      await speakProgress(spoken, signal);
    });
}

function flushProgressSpeechBatch(signal, reason = 'timer') {
  if (!signal || signal.aborted || activeProgressSignal !== signal) return;
  if (progressSpeechBatchTimer) {
    clearTimeout(progressSpeechBatchTimer);
    progressSpeechBatchTimer = null;
  }
  const events = progressSpeechBatch;
  progressSpeechBatch = [];
  progressSpeechBatchSignal = null;
  progressSpeechBatchStartedAt = 0;
  const text = summarizeProgressEvents(events, { maxCategories: 3, language: settings.voiceLanguage });
  if (!text) return;
  queueProgressSpeechText(text, signal, `batch-${reason}-${events.length}`);
}

function queueVerboseProgressSpeech(event, signal) {
  if (!verboseProgress || !signal || signal.aborted || activeProgressSignal !== signal) return;
  const text = String(event || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!text) return;
  if (progressSpeechBatchSignal && progressSpeechBatchSignal !== signal) {
    progressSpeechBatch = [];
    if (progressSpeechBatchTimer) clearTimeout(progressSpeechBatchTimer);
    progressSpeechBatchTimer = null;
    progressSpeechBatchStartedAt = 0;
  }
  progressSpeechBatchSignal = signal;
  if (!progressSpeechBatchStartedAt) progressSpeechBatchStartedAt = Date.now();
  progressSpeechBatch.push(text);
  const elapsedMs = Date.now() - progressSpeechBatchStartedAt;
  const ratePerSecond = progressSpeechBatch.length / Math.max(0.2, elapsedMs / 1000);
  const maxBatchEvents = ratePerSecond >= 6 ? 5 : ratePerSecond >= 3 ? 4 : 3;
  const batchDelayMs = ratePerSecond >= 6 ? 650 : ratePerSecond >= 3 ? 550 : 450;
  if (progressSpeechBatch.length >= maxBatchEvents) {
    flushProgressSpeechBatch(signal, 'full');
    return;
  }
  if (progressSpeechBatchTimer) clearTimeout(progressSpeechBatchTimer);
  progressSpeechBatchTimer = setTimeout(() => flushProgressSpeechBatch(signal, 'timer'), batchDelayMs);
}

function clearProgressSpeechBatch(signal = activeProgressSignal) {
  if (progressSpeechBatchTimer) {
    clearTimeout(progressSpeechBatchTimer);
    progressSpeechBatchTimer = null;
  }
  if (!signal || progressSpeechBatchSignal === signal) {
    progressSpeechBatch = [];
    progressSpeechBatchSignal = null;
    progressSpeechBatchStartedAt = 0;
  }
}

function stopProgressSpeech(signal, reason = 'final-answer') {
  if (activeProgressSignal !== signal) return;
  clearProgressSpeechBatch(signal);
  activeProgressSignal = null;
  if (activeProgressAbortController && !activeProgressAbortController.signal.aborted) {
    try { activeProgressAbortController.abort(); } catch (e) { warn('abort progress speech failed', e?.stack || e); }
  }
  if (speaking) {
    log('stop progress speech before final answer', reason);
    try { player.stop(true); } catch (e) { warn('stop progress speech failed', e?.stack || e); }
    speaking = false;
  }
}

async function handleTextAgentMessage(msg, text, { speakResponse = false } = {}) {
  if (processing) {
    await msg.reply('지금 이전 작업을 처리 중이야. 끝나면 다시 보내줘.');
    return;
  }
  processing = true;
  const controller = new AbortController();
  currentAbortController = controller;
  const signal = controller.signal;
  const progressController = new AbortController();
  activeProgressAbortController = progressController;
  activeProgressSignal = progressController.signal;
  activeProgressLastEventAt = Date.now();
  const previousTranscriptChannelId = activeTranscriptChannelId;
  const session = resolveProjectSessionForChannel(msg.channelId);
  activeTranscriptChannelId = session?.transcriptChannelId || msg.channelId;
  const selectedAgentAdapter = adapterForProjectSession(session);
  const projectContext = projectSessionContextText(session);
  const recentDiscordContext = formatRecentDiscordContext(recentDiscordTextByChannel, {
    channelId: activeTranscriptChannelId,
  });
  const plan = {
    task: true,
    label: selectedAgentAdapter.label,
    verboseProgress,
    language: settings.voiceLanguage,
    cwd: session?.workdir,
    projectContext,
    recentDiscordContext,
  };
  const sessionBefore = selectedAgentAdapter.readSessionId?.();
  log('text agent request start', selectedAgentAdapter.label, sessionBefore ? 'resume-existing-session' : 'new-session', 'verbose', verboseProgress, session ? `project=${session.slug}` : 'project=default');
  try {
    const result = await selectedAgentAdapter.run(text, signal, plan);
    const answer = result.answer || emptyAgentAnswer(settings.voiceLanguage);
    const fullAnswerText = `${agentAnswerHeader(settings.voiceLanguage, selectedAgentAdapter.label)}\n${answer}`;
    await sendChannelText(msg.channel, fullAnswerText);
    stopProgressSpeech(progressController.signal, 'text-agent-answer-ready');
    if (speakResponse && connection) {
      const spokenAnswer = spokenResultOnly(text, answer, settings.voiceLanguage);
      await speakText(spokenAnswer, signal, null, { mirrorText: false });
    }
  } catch (e) {
    if (isAbortError(e)) return;
    warn('text agent request failed', e?.stack || e);
    await sendChannelText(msg.channel, formatVoiceErrorMessage(settings.voiceLanguage, String(e?.message || e).slice(0, 800)));
  } finally {
    if (activeProgressAbortController && activeProgressAbortController.signal === progressController.signal && !activeProgressAbortController.signal.aborted) {
      try { activeProgressAbortController.abort(); } catch (e) { warn('abort text progress speech failed', e?.stack || e); }
    }
    if (activeProgressSignal === progressController.signal) activeProgressSignal = null;
    if (activeProgressAbortController?.signal === progressController.signal) activeProgressAbortController = null;
    clearProgressSpeechBatch(progressController.signal);
    if (currentAbortController === controller) currentAbortController = null;
    activeTranscriptChannelId = previousTranscriptChannelId;
    processing = false;
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

async function handleVoiceCloneCommand(userId, prompt, signal = null) {
  const command = voiceCloneCommandFromText(prompt);
  if (!command) return false;
  if (command.action === 'cancel') {
    const cancelled = voiceCloneCapture.cancel(userId);
    await sendText(cancelled ? '🎙️ 보이스 클로닝 샘플 캡처를 취소했어.' : '🎙️ 대기 중인 보이스 클로닝 샘플 캡처가 없어.');
    await speakText(cancelled ? '목소리 샘플 녹음 대기를 취소했어.' : '대기 중인 목소리 샘플 녹음은 없어.', signal);
    return true;
  }
  if (command.action === 'status') {
    const current = voiceCloneCapture.current();
    const status = current?.userId === String(userId)
      ? `🎙️ 다음 유효한 음성을 ${path.relative(ROOT, current.targetPath)}에 저장할게.`
      : '🎙️ 지금 대기 중인 보이스 클로닝 샘플 캡처는 없어.';
    await sendText(status);
    await speakText(current?.userId === String(userId) ? '다음에 말하는 목소리를 샘플로 저장할게.' : '대기 중인 목소리 샘플 녹음은 없어.', signal);
    return true;
  }
  const armed = voiceCloneCapture.arm({ userId, source: 'voice-command' });
  await sendText(`🎙️ 보이스 클로닝 샘플 캡처 대기 중. 다음 10초에서 30초 정도 말하면 ${path.relative(ROOT, armed.targetPath)}에 저장할게.`);
  await speakText('좋아. 다음에 10초에서 30초 정도 말하면 그 음성을 목소리 샘플로 저장할게.', signal);
  return true;
}

function stopPlaybackForBargeIn(userId, reason = 'playback-barge-in') {
  if (!speaking) return false;
  log('stop playback for barge-in', 'byUser', userId, 'reason', reason, 'speaking', speaking, 'processing', processing, 'turn', activeTurnId);
  speechPlaybackGeneration += 1;
  try { player.stop(true); } catch (e) { warn('stop playback failed', e?.stack || e); }
  speaking = false;
  return true;
}

function interruptCurrentResponse(userId, reason = 'barge-in') {
  if (!speaking && !processing) return false;
  const turnId = activeTurnId;
  if (turnId) interruptedTurns.add(turnId);
  log('interrupt current response', 'byUser', userId, 'reason', reason, 'speaking', speaking, 'processing', processing, 'turn', turnId);
  if (currentAbortController && !currentAbortController.signal.aborted) {
    try { currentAbortController.abort(); } catch (e) { warn('abort current response failed', e?.stack || e); }
  }
  try { player.stop(true); } catch (e) { warn('stop playback failed', e?.stack || e); }
  speaking = false;
  processing = false;
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

function queueSegment(userId, file, pcmBytes, startedAtMs = Date.now(), endedAtMs = Date.now()) {
  const pending = bridgeState.appendSegment(userId, {
    file,
    pcmBytes,
    startedAtMs,
    endedAtMs,
    timerFactory: () => setTimeout(() => flushUtterance(userId).catch(e => warn('flushUtterance failed', userId, e?.stack || e)), UTTERANCE_IDLE_MS),
  });
  log('queued segment', userId, 'segments', pending.files.length, 'totalPcmBytes', pending.pcmBytes, 'idleMs', UTTERANCE_IDLE_MS, 'epoch', pending.epoch);
}

function isBargeInCandidate(pcmBytes, levels) {
  const thresholds = currentBargeInThresholds();
  return isValidatedBargeInCandidate(pcmBytes, levels, thresholds);
}

function enqueueDeferredProcessingUtterance({ userId, wavPath, pcmBytes, segments, startedAtMs = Date.now() }) {
  const item = { userId, wavPath, pcmBytes, segments, startedAtMs };
  const result = bridgeState.enqueueDeferred(item, enqueueDeferredUtterance, MAX_DEFERRED_PROCESSING_UTTERANCES);
  if (!result.queued) {
    log('drop deferred utterance because queue disabled', userId, wavPath, 'max', MAX_DEFERRED_PROCESSING_UTTERANCES);
    return false;
  }
  if (result.dropped) {
    log('drop oldest deferred utterance because queue is full', result.dropped?.userId, result.dropped?.wavPath);
  }
  log('queued deferred utterance while processing', userId, wavPath, 'queueSize', bridgeState.deferredSize(), 'epoch', bridgeState.currentEpoch());
  return true;
}

async function drainDeferredProcessingUtterances() {
  if (processing || bridgeState.deferredSize() === 0) return;
  const next = bridgeState.shiftDeferred();
  if (!next) return;
  log('drain deferred utterance', next.userId, next.wavPath, 'remaining', bridgeState.deferredSize());
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

async function flushUtterance(userId) {
  const pending = bridgeState.deletePending(userId);
  if (!pending) return;
  if (pending.timer) clearTimeout(pending.timer);
  const files = pending.files;
  const pcmBytes = pending.pcmBytes;
  const metricsTurn = newLatencyTurn(userId, pending.firstPacketAt || Date.now());
  metricsTurn.mark('voice_first_packet', pending.firstPacketAt || Date.now());
  metricsTurn.mark('voice_segment_end', pending.lastSegmentEndAt || Date.now());
  metricsTurn.mark('utterance_flush');
  metricsTurn.addMeta({ segments: files.length, pcmBytes, epoch: pending.epoch });
  if (pending.epoch !== bridgeState.currentEpoch()) {
    log('drop stale utterance after voice input queue reset', userId, 'utteranceEpoch', pending.epoch, 'currentEpoch', bridgeState.currentEpoch());
    for (const file of files) fs.rm(file, { force: true }, () => {});
    metricsTurn.finish({ status: 'stale_after_config_change' });
    return;
  }
  if (pcmBytes < MIN_UTTERANCE_BYTES) {
    log('skip short utterance', userId, 'segments', files.length, 'pcmBytes', pcmBytes, 'minBytes', MIN_UTTERANCE_BYTES);
    metricsTurn.finish({ status: 'skip_short' });
    return;
  }
  const merged = path.join(settings.debugDir, `utterance-merged-${stamp()}-${userId}.wav`);
  await concatWavs(files, merged);
  const levels = await analyzeAudio(merged);
  log('utterance levels', userId, 'segments', files.length, 'pcmBytes', pcmBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb);
  if (await saveCapturedVoiceCloneSample(userId, merged, pcmBytes, files.length)) {
    metricsTurn.addMeta({ meanDb: levels.meanDb, maxDb: levels.maxDb });
    metricsTurn.finish({ status: 'voice_clone_sample_saved' });
    return;
  }
  const candidate = isBargeInCandidate(pcmBytes, levels);
  if (speaking || processing) {
    const thresholds = currentBargeInThresholds();
    if (!candidate) {
      log('check weak barge-in for explicit stop transcript', userId, 'pcmBytes', pcmBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb, 'thresholdBytes', thresholds.minBytes, 'thresholds', thresholds.minMeanDb, thresholds.minMaxDb, 'mode', thresholds.mode);
    }
    const validation = await validateProcessingBargeIn(userId, merged, pcmBytes, files.length);
    if (validation?.action === 'interrupt') {
      metricsTurn.finish({ status: processing ? 'barge_in_processing_interrupt' : 'barge_in_playback_interrupt' });
      return;
    }
    if (processing && validation?.action === 'defer') {
      const queued = enqueueDeferredProcessingUtterance({
        userId,
        wavPath: merged,
        pcmBytes,
        segments: files.length,
        startedAtMs: pending.firstPacketAt || Date.now(),
      });
      metricsTurn.finish({ status: queued ? 'deferred_during_processing' : 'drop_deferred_during_processing' });
      return;
    }
    metricsTurn.finish({ status: speaking ? 'barge_in_playback_ignored' : 'barge_in_processing_ignored' });
    return;
  }
  // Drop only when BOTH overall energy and peak are low. Real Discord speech from this
  // mic can have low mean volume while still carrying intelligible peaks; using OR here
  // caused valid Korean utterances to be discarded as "low-energy".
  if (levels.meanDb < MIN_MEAN_VOLUME_DB && levels.maxDb < MIN_MAX_VOLUME_DB) {
    log('skip low-energy utterance', userId, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb, 'thresholds', MIN_MEAN_VOLUME_DB, MIN_MAX_VOLUME_DB, 'mode', 'both-below');
    metricsTurn.addMeta({ meanDb: levels.meanDb, maxDb: levels.maxDb });
    metricsTurn.finish({ status: 'skip_low_energy' });
    return;
  }
  metricsTurn.addMeta({ meanDb: levels.meanDb, maxDb: levels.maxDb });
  await handleRecording(userId, merged, pcmBytes, files.length, metricsTurn);
}

async function handleRecording(userId, wavPath, pcmBytes, segments = 1, metricsTurn = null) {
  if (processing) { log('drop while processing', userId); metricsTurn?.finish({ status: 'drop_processing' }); return; }
  if (!isAllowed(userId)) { warn('ignore unauthorized', userId); metricsTurn?.finish({ status: 'unauthorized' }); return; }
  processing = true;
  const turnId = ++activeTurnId;
  const controller = new AbortController();
  currentAbortController = controller;
  const signal = controller.signal;
  const sessionForVoice = resolveProjectSessionForChannel(activeVoiceChannelId || settings.transcriptChannelId);
  const previousTranscriptChannelId = activeTranscriptChannelId;
  activeTranscriptChannelId = sessionForVoice?.transcriptChannelId || settings.transcriptChannelId;
  try {
    const runtimeLanguage = reloadRuntimeLanguageFromEnv();
    if (runtimeLanguage.changed) {
      log('drop current utterance because language changed before STT', userId, 'turn', turnId, 'language', runtimeLanguage.voiceLanguage);
      fs.rm(wavPath, { force: true }, () => {});
      metricsTurn?.finish({ status: 'drop_stale_language_change' });
      return;
    }
    const session = resolveProjectSessionForChannel(activeVoiceChannelId || settings.transcriptChannelId);
    activeTranscriptChannelId = session?.transcriptChannelId || settings.transcriptChannelId;
    log('voice turn text target', session ? `project=${session.slug}` : 'project=default', 'channel', activeTranscriptChannelId ? 'project-or-default' : 'none');
    log('transcribing', userId, wavPath, 'pcmBytes', pcmBytes, 'segments', segments, 'turn', turnId);
    const sttNotice = formatSttStartMessage(settings.voiceLanguage);
    await sendText(sttNotice);
    const sttNoticeSpeech = STT_START_VOICE_NOTICE
      ? speakImmediateNotice(sttNotice.replace(/^🎧\s*/u, ''), signal, 'stt-start')
      : Promise.resolve();
    const sttStart = Date.now();
    const text = await transcribe(wavPath);
    await sttNoticeSpeech;
    metricsTurn?.stage('stt', Date.now() - sttStart, { transcriptChars: String(text || '').length });
    if (interruptedTurns.has(turnId) || signal.aborted) { metricsTurn?.finish({ status: 'aborted_after_stt' }); return; }
    if (!text) { log('empty transcript', userId, wavPath); metricsTurn?.finish({ status: 'empty_transcript' }); return; }
    log(`user ${userId} said: ${text}`);
    await sendText(formatSttResultMessage(settings.voiceLanguage, userId, text));
    if (!acceptsWake(text)) { await sendText(formatWakeRejectedMessage(settings.voiceLanguage)); metricsTurn?.finish({ status: 'wake_rejected' }); return; }

    let prompt = stripWake(text);
    if (await handleLanguageCommand(prompt, signal)) {
      metricsTurn?.finish({ status: 'language_command' });
      return;
    }
    if (await handleTtsVoiceCommand(prompt, signal)) {
      metricsTurn?.finish({ status: 'voice_command' });
      return;
    }
    if (await handleVoiceCloneCommand(userId, prompt, signal)) {
      metricsTurn?.finish({ status: 'voice_clone_command' });
      return;
    }
    const sensitivityRequest = sensitivityModeFromTranscript(prompt);
    if (sensitivityRequest) {
      const thresholds = setSensitivityMode(sensitivityRequest.mode, sensitivityRequest.reason);
      await sendText(`🎚️ ${sensitivityStatusText()}`);
      if (isSensitivityOnlyRequest(prompt)) {
        await speakText(sensitivityChangedSpeech(thresholds.mode, settings.voiceLanguage), signal, metricsTurn);
        metricsTurn?.finish({ status: 'sensitivity_only' });
        return;
      }
    }
    const verboseRequest = verboseModeFromTranscript(prompt);
    if (verboseRequest !== null) {
      setVerboseProgress(verboseRequest, 'voice-command');
      await sendText(`🔎 ${verboseStatusText()}`);
      if (isVerboseOnlyRequest(prompt)) {
        await speakText(verboseChangedSpeech(verboseRequest, settings.voiceLanguage), signal, metricsTurn);
        metricsTurn?.finish({ status: 'verbose_only' });
        return;
      }
    }
    const routingKey = planChannelKey();
    const routingState = routingStateFor(routingKey);
    if (routingState.pendingFallbackPrompt) {
      const decision = buildFallbackDecision(
        routingState.pendingFallbackPrompt.requestedBackend || 'agent',
        settings.agent.label,
        settings.voiceLanguage,
      );
      const fallbackAnswer = parseDecisionAnswer(prompt, decision, settings.voiceLanguage);
      if (fallbackAnswer.type === 'unknown') {
        const msg = /^en/i.test(String(settings.voiceLanguage || ''))
          ? 'Please answer yes or no.'
          : '예 또는 아니오로 대답해줘.';
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
        metricsTurn?.finish({ status: 'fallback_pending' });
        return;
      }
      const accepted = fallbackAnswer.type === 'auto' || fallbackAnswer.choice === 'yes';
      const previous = routingState.pendingFallbackPrompt;
      routingState.pendingFallbackPrompt = null;
      if (!accepted) {
        const msg = /^en/i.test(String(settings.voiceLanguage || '')) ? 'Cancelled.' : '취소했어.';
        await sendText(`❎ ${msg}`);
        await speakText(msg, signal, null);
        metricsTurn?.finish({ status: 'fallback_declined' });
        return;
      }
      routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
      prompt = previous.originalPrompt;
    }

    const researchCmd = parseResearchCommand(prompt, settings.voiceLanguage);
    if (researchCmd.type === 'research') {
      const preemptiveRouting = parseAgentRoutingCommand(prompt, settings.voiceLanguage);
      let researchBackend = routingState.activeRouting.backend;
      if (preemptiveRouting.type === 'route') {
        const routedCandidate = adapterForBackend(preemptiveRouting.backend, session);
        if (routedCandidate) {
          researchBackend = preemptiveRouting.backend;
          if (preemptiveRouting.sticky) routingState.activeRouting = { backend: preemptiveRouting.backend, sticky: true };
        } else {
          const en = /^en/i.test(String(settings.voiceLanguage || ''));
          const msg = en
            ? `${preemptiveRouting.backend} is not installed. Want me to research with ${settings.agent.label} instead?`
            : `${preemptiveRouting.backend}이(가) 설치되어 있지 않아. ${settings.agent.label}로 리서치할까?`;
          await sendText(`⚠️ ${msg}`);
          await speakText(msg, signal, null);
          routingState.pendingFallbackPrompt = {
            requestedBackend: preemptiveRouting.backend,
            originalPrompt: `research ${researchCmd.query}`,
          };
          metricsTurn?.finish({ status: 'research_routing_fallback_pending' });
          return;
        }
      }
      const en = /^en/i.test(String(settings.voiceLanguage || ''));
      const startMsg = en ? `Researching ${researchCmd.query}.` : `${researchCmd.query} 리서치할게.`;
      await sendText(`🔎 ${startMsg}`);
      await speakText(startMsg, signal, null);
      const adapter = adapterForBackend(researchBackend, session) || adapterForProjectSession(session);
      const synthesize = async (synthPrompt, opts = {}) => {
        const out = await adapter.ask(synthPrompt, signal, {
          task: Boolean(opts.task),
          label: adapter.label,
          language: settings.voiceLanguage,
        });
        return String(out || '');
      };
      const result = await runResearchTurn({ query: researchCmd.query, language: settings.voiceLanguage, synthesize, signal })
        .catch(e => ({ status: 'error', error: e?.message || String(e), query: researchCmd.query }));
      if (result.status === 'ok') {
        const sentEmbed = await sendEmbed(result.embed);
        if (!sentEmbed) await sendText(result.markdown);
        await speakText(result.speech, signal, null);
        captureOntologyFromTurn(routingKey, { prompt, answer: result.bullets.join('\n'), backend: 'research' });
      } else if (result.status === 'empty') {
        await sendText(result.markdown);
        await speakText(result.speech, signal, null);
      } else if (result.status === 'no_backend') {
        const msg = en
          ? 'No search backend is configured. Set TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, SEARXNG_URL, or SEARCH_BACKEND_AGENT_FALLBACK=1 to delegate research to the active agent.'
          : '검색 백엔드가 설정돼 있지 않아. TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, SEARXNG_URL 중 하나를 설정하거나 SEARCH_BACKEND_AGENT_FALLBACK=1로 활성 에이전트에게 위임할 수 있어.';
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
      } else {
        const msg = en ? `Research failed: ${result.error || result.status}` : `리서치 실패: ${result.error || result.status}`;
        await sendText(`⚠️ ${msg}`);
        await speakText(en ? 'Research failed.' : '리서치 실패.', signal, null);
      }
      if (preemptiveRouting.type === 'route' && !preemptiveRouting.sticky && researchBackend !== settings.agent.backend) {
        routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
      }
      metricsTurn?.finish({ status: `research_${result.status}` });
      return;
    }

    const routing = parseAgentRoutingCommand(prompt, settings.voiceLanguage);
    if (routing.type === 'restore') {
      routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
      const msg = /^en/i.test(String(settings.voiceLanguage || ''))
        ? `Back to the default agent (${settings.agent.label}).`
        : `기본 에이전트로 돌아갈게 (${settings.agent.label}).`;
      await sendText(`↩ ${msg}`);
      await speakText(msg, signal, null);
      metricsTurn?.finish({ status: 'routing_restore' });
      return;
    }
    if (routing.type === 'route') {
      const candidate = adapterForBackend(routing.backend, session);
      if (!candidate) {
        const msg = /^en/i.test(String(settings.voiceLanguage || ''))
          ? `${routing.backend} is not installed. Want me to use ${settings.agent.label} instead?`
          : `${routing.backend}이(가) 설치되어 있지 않아. ${settings.agent.label}로 대신 진행할까?`;
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
        routingState.pendingFallbackPrompt = { requestedBackend: routing.backend, originalPrompt: prompt };
        metricsTurn?.finish({ status: 'routing_fallback_pending' });
        return;
      }
      routingState.activeRouting = { backend: routing.backend, sticky: routing.sticky };
      if (isRoutingOnlyUtterance(prompt)) {
        const en = /^en/i.test(String(settings.voiceLanguage || ''));
        const label = candidate.label || routing.backend;
        const msg = routing.sticky
          ? (en ? `Switched to ${label}.` : `${label}로 전환했어.`)
          : (en ? `Asking ${label} this turn.` : `이번 턴은 ${label}로 진행할게.`);
        await sendText(`↪ ${msg}`);
        await speakText(msg, signal, null);
        metricsTurn?.finish({ status: 'routing_only' });
        return;
      }
    }
    recordUtterance(routingKey, prompt);

    let promptForAgent = prompt;
    try {
      const planOutcome = await dispatchPlanModeUtterance(prompt, signal);
      if (planOutcome.handled) {
        metricsTurn?.finish({ status: 'plan_mode' });
        return;
      }
      if (planOutcome.prompt) promptForAgent = planOutcome.prompt;
    } catch (e) {
      warn('plan mode dispatch failed', e?.stack || e);
    }
    const routedBackend = routingState.activeRouting.backend;
    const selectedAgentAdapter = adapterForBackend(routedBackend, session) || adapterForProjectSession(session);
    const isHandoff = routingState.lastUsedBackend !== routedBackend;
    const ttsPrefix = isHandoff ? renderAgentPrefix(routedBackend, settings.voiceLanguage) : '';
    if (isHandoff) {
      const ontologyStore = ontologyStateFor(routingKey);
      const ontologyBlock = ontologyStore.nodeCount > 0
        ? ontologyStore.serializeForHandoff({ language: settings.voiceLanguage })
        : '';
      promptForAgent = buildCrossAgentPrompt({
        prompt: promptForAgent,
        fromBackend: routingState.lastUsedBackend,
        toBackend: routedBackend,
        resolvedDecisions: routingState.lastResolvedDecisions || {},
        priorUtterances: routingState.recentUtterances.slice(0, -1),
        language: settings.voiceLanguage,
      });
      if (ontologyBlock) {
        const header = /^en/i.test(String(settings.voiceLanguage || '')) ? '\n\n[Session ontology]\n' : '\n\n[세션 온톨로지]\n';
        promptForAgent = `${promptForAgent}${header}${ontologyBlock}`;
      }
    }
    routingState.lastUsedBackend = routedBackend;
    if (!routingState.activeRouting.sticky) routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
    const projectContext = projectSessionContextText(session);
    const recentDiscordContext = formatRecentDiscordContext(recentDiscordTextByChannel, {
      channelId: activeTranscriptChannelId,
    });
    const plan = {
      task: true,
      label: selectedAgentAdapter.label,
      verboseProgress,
      language: settings.voiceLanguage,
      cwd: session?.workdir,
      projectContext,
      recentDiscordContext,
    };
    log('Agent plan', plan.label, 'backend', selectedAgentAdapter.backend, 'task', plan.task, 'language', plan.language, session ? `project=${session.slug}` : 'project=default');
    const agentStart = Date.now();
    const progressController = new AbortController();
    activeProgressAbortController = progressController;
    activeProgressSignal = progressController.signal;
    activeProgressLastEventAt = Date.now();
    const streamingTurnActive = beginStreamingTurn(signal);
    if (streamingTurnActive && ttsPrefix && activeStreamingQueue) {
      activeStreamingQueue.enqueue(ttsPrefix.replace(/[:\s]+$/u, '.'));
    }
    const agentPromise = selectedAgentAdapter.ask(promptForAgent, signal, plan);
    let done = false;
    // Status announcements share one queue with verbose progress so they never
    // talk over each other. In verbose mode, skip the generic initial prompt;
    // the detailed tool/file/test events are the initial progress voice.
    const progressLoop = (async () => {
      if (!verboseProgress) {
        await sleep(2500);
        if (!done && !signal.aborted && !interruptedTurns.has(turnId)) {
          const initial = /^en/i.test(String(settings.voiceLanguage || ''))
            ? 'calling the agent.'
            : '에이전트 호출했어. 응답 기다리는 중.';
          queueProgressSpeechText(initial, progressController.signal, 'generic-initial');
        }
      }
      let idleNotices = 0;
      let nextIdleNoticeMs = PROGRESS_IDLE_NOTICE_INITIAL_MS;
      let lastObservedProgressAt = activeProgressLastEventAt;
      while (!done && !signal.aborted && !interruptedTurns.has(turnId) && idleNotices < PROGRESS_IDLE_NOTICE_LIMIT) {
        await sleep(Math.min(PROGRESS_IDLE_CHECK_MS, nextIdleNoticeMs));
        if (done || signal.aborted || interruptedTurns.has(turnId)) break;
        if (activeProgressLastEventAt !== lastObservedProgressAt) {
          lastObservedProgressAt = activeProgressLastEventAt;
          nextIdleNoticeMs = PROGRESS_IDLE_NOTICE_INITIAL_MS;
          continue;
        }
        const idleMs = Date.now() - activeProgressLastEventAt;
        if (idleMs < nextIdleNoticeMs) continue;
        idleNotices += 1;
        activeProgressLastEventAt = Date.now();
        lastObservedProgressAt = activeProgressLastEventAt;
        const idle = /^en/i.test(String(settings.voiceLanguage || ''))
          ? 'still working on that.'
          : '아직 작업 중이야.';
        queueProgressSpeechText(idle, progressController.signal, `idle-${idleNotices}-${Math.round(nextIdleNoticeMs / 1000)}s`);
        nextIdleNoticeMs = Math.min(
          PROGRESS_IDLE_NOTICE_MAX_MS,
          Math.max(nextIdleNoticeMs + 1000, Math.round(nextIdleNoticeMs * PROGRESS_IDLE_NOTICE_MULTIPLIER)),
        );
      }
    })().catch(e => {
      if (!isAbortError(e)) warn('progress loop failed', e?.stack || e);
    });
    const answer = await agentPromise.finally(() => { done = true; });
    if (streamingTurnActive) await endStreamingTurn();
    metricsTurn?.stage('agent', Date.now() - agentStart, { answerChars: String(answer || '').length, backend: selectedAgentAdapter.backend });
    void progressLoop;
    if (interruptedTurns.has(turnId) || signal.aborted) { metricsTurn?.finish({ status: 'aborted_after_agent' }); return; }

    log('Agent answer', selectedAgentAdapter.label, answer.slice(0, 200));
    captureOntologyFromTurn(routingKey, { prompt, answer, backend: routedBackend });
    const spokenAnswerCore = spokenResultOnly(prompt, answer, settings.voiceLanguage);
    const spokenAnswer = ttsPrefix ? `${ttsPrefix}${spokenAnswerCore}` : spokenAnswerCore;
    const fullAnswerText = `${agentAnswerHeader(settings.voiceLanguage, selectedAgentAdapter.label)}\n${answer || emptyAgentAnswer(settings.voiceLanguage)}`;
    log('send agent answer text', 'chars', fullAnswerText.length);
    const answerTextDelivered = await sendText(fullAnswerText);
    if (!answerTextDelivered) {
      warn('agent answer text delivery failed; still speaking answer');
    }
    log('spoken answer', spokenAnswer.slice(0, 200));
    stopProgressSpeech(progressController.signal, 'agent-answer-ready');
    if (streamingTurnActive && streamingSpeechDelivered) {
      log('skipping post-run speakText; streaming already delivered audio');
    } else {
      await speakText(spokenAnswer, signal, metricsTurn, { mirrorText: !answerTextDelivered });
    }
    try {
      const guildId = client.channels.cache.get(activeVoiceChannelId)?.guild?.id || '';
      await maybeNotifyTaskComplete({
        answer: spokenAnswer || answer,
        label: selectedAgentAdapter.label,
        elapsedMs: Date.now() - agentStart,
        guildId,
      });
    } catch (e) { warn('maybeNotifyTaskComplete failed', e?.message || e); }
    metricsTurn?.finish({ status: 'ok' });
  } catch (e) {
    if (isAbortError(e) || interruptedTurns.has(turnId)) {
      log('turn aborted', userId, 'turn', turnId);
      clearTransientRouting(planChannelKey());
      metricsTurn?.finish({ status: 'aborted' });
      return;
    }
    warn('handleRecording failed', e?.stack || e);
    const shortMsg = String(e?.message || e).slice(0, 800);
    metricsTurn?.finish({ status: 'error', error: shortMsg });
    await sendText(formatVoiceErrorMessage(settings.voiceLanguage, shortMsg));
  } finally {
    if (activeProgressAbortController && !activeProgressAbortController.signal.aborted) {
      try { activeProgressAbortController.abort(); } catch (e) { warn('abort progress speech in cleanup failed', e?.stack || e); }
    }
    if (activeProgressSignal === activeProgressAbortController?.signal) activeProgressSignal = null;
    activeProgressAbortController = null;
    if (currentAbortController === controller) currentAbortController = null;
    activeTranscriptChannelId = previousTranscriptChannelId;
    interruptedTurns.delete(turnId);
    if (activeTurnId === turnId) activeTurnId = 0;
    processing = false;
    if (bridgeState.deferredSize() > 0) {
      setImmediate(() => drainDeferredProcessingUtterances().catch(e => warn('drain deferred utterance failed', e?.stack || e)));
    }
  }
}

function subscribeUser(receiver, userId) {
  if (!isAllowed(userId)) return;
  if (String(userId) === client.user?.id) return;
  const wasSpeaking = speaking;
  const wasProcessing = processing;
  if ((wasSpeaking || wasProcessing) && !activeStreams.has(userId)) {
    // Speaking-start alone is too noisy in Discord voice. Record and validate a
    // real segment first; only confirmed playback barge-in stops the current
    // audio chunk, and only explicit stop transcripts abort active agent work.
    log('possible barge-in start; waiting for segment validation', userId, 'speaking', wasSpeaking, 'processing', wasProcessing);
  }
  if (activeStreams.has(userId)) return;
  const pending = bridgeState.getPending(userId);
  if (pending?.timer) {
    bridgeState.clearPendingTimer(userId);
    log('extend pending utterance because new segment started', userId, 'segments', pending.files.length, 'totalPcmBytes', pending.pcmBytes);
  }

  const file = path.join(settings.debugDir, `segment-${stamp()}-${userId}.wav`);
  log('subscribe user', userId, file);
  const opusStream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: SUBSCRIBE_AFTER_SILENCE_MS } });
  const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  const writer = new wav.FileWriter(file, { sampleRate: 48000, channels: 2, bitDepth: 16 });
  activeStreams.set(userId, { opusStream, decoder, writer, file, startedAtMs: Date.now() });
  let pcmBytes = 0;
  const liveThresholds = wasSpeaking && !wasProcessing ? currentPlaybackBargeInThresholds() : currentBargeInThresholds();
  const liveBargeIn = shouldUseLivePlaybackBargeIn({ speaking: wasSpeaking, processing: wasProcessing }) ? createLiveBargeInMonitor({
    minBytes: liveThresholds.minBytes,
    minMeanDb: liveThresholds.minMeanDb,
    minMaxDb: liveThresholds.minMaxDb,
    requireBoth: liveThresholds.requireBoth,
    log,
    onConfirm: ({ pcmBytes: confirmedBytes, levels }) => {
      log('confirmed live playback barge-in before segment end', userId, 'pcmBytes', confirmedBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb);
      stopPlaybackForBargeIn(userId, 'confirmed-live-playback-barge-in');
    },
  }) : null;
  decoder.on('data', chunk => {
    pcmBytes += chunk.length;
    liveBargeIn?.push(chunk);
  });
  opusStream.on('error', e => warn('opus stream error', userId, e?.stack || e));
  decoder.on('error', e => warn('opus decoder error', userId, e?.stack || e));
  writer.on('error', e => warn('wav writer error', userId, e?.stack || e));
  opusStream.on('end', () => log('opus end', userId, 'pcmBytes', pcmBytes));
  writer.on('finish', () => {
    const streamState = activeStreams.get(userId);
    activeStreams.delete(userId);
    const endedAtMs = Date.now();
    log('saved segment', userId, 'pcmBytes', pcmBytes, file);
    queueSegment(userId, file, pcmBytes, streamState?.startedAtMs || endedAtMs, endedAtMs);
  });
  opusStream.pipe(decoder).pipe(writer);
}

async function connectTo(channel) {
  if (connection) {
    try { connection.destroy(); } catch {}
  }
  activeVoiceChannelId = channel.id;
  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });
  const voiceConnection = connection;
  voiceConnection.subscribe(player);
  voiceConnection.on('error', e => warn('voice connection error', e?.stack || e));
  voiceConnection.on('stateChange', async (oldState, newState) => {
    log('voice connection state', oldState.status, '->', newState.status);
    if (connection !== voiceConnection) {
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
        if (connection !== voiceConnection) return;
        warn('voice connection disconnected; reconnecting to channel', channel.guild.name, channel.name, e?.message || e);
        try { voiceConnection.destroy(); } catch {}
        connection = null;
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
  const activeGuildId = activeVoiceChannelId ? client.channels.cache.get(activeVoiceChannelId)?.guild?.id || '' : '';
  const occupied = pickOccupiedUserVoiceChannel(client.guilds.cache.values(), settings.allowedUsers, {
    activeVoiceChannelId,
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
      try { connection?.destroy(); } catch {}
      connection = null;
      activeVoiceChannelId = '';
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
          try { connection?.destroy(); } catch {}
          connection = null;
          activeVoiceChannelId = '';
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
  if (activeVoiceChannelId && msg.guild) {
    try {
      const ch = await msg.guild.channels.fetch(activeVoiceChannelId);
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
  agentAdaptersBySession.delete(session.slug);
  invalidateBackendAdaptersForSession(session.slug);
  if (activeVoiceChannelId !== voiceChannel.id) await connectTo(voiceChannel);
  return msg.reply(`${session.name} 세션을 이 텍스트 채널과 음성 채널 ${voiceChannel.name}에 붙였어. 이제 그 음성채널 발화의 STT/답변 텍스트는 이 채널로 가.`);
}

async function handleProjectSessionCommand(msg, command) {
  const activeSession = resolveProjectSessionForChannel(msg.channelId) || resolveProjectSessionForChannel(activeVoiceChannelId);
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
    agentAdaptersBySession.delete(session.slug);
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
  appendRecentDiscordText(recentDiscordTextByChannel, {
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
    notifyUserOptIn = true;
    return void msg.reply(notifyStatusText());
  }
  if (['!notify off', '!notify auto', '!notify 0'].includes(content.toLowerCase())) {
    notifyUserOptIn = false;
    return void msg.reply(notifyStatusText());
  }
  if (content === '!smart-progress' || content === '!smart_progress') return void msg.reply(smartProgressStatusText());
  if (['!smart-progress on', '!smart-progress true', '!smart-progress 1', '!smart_progress on'].includes(content.toLowerCase())) {
    smartProgressEnabled = true;
    return void msg.reply(smartProgressStatusText());
  }
  if (['!smart-progress off', '!smart-progress false', '!smart-progress 0', '!smart_progress off'].includes(content.toLowerCase())) {
    smartProgressEnabled = false;
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
    try { connection?.destroy(); } catch {}
    connection = null;
    activeVoiceChannelId = '';
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
      await msg.reply(`TTS 백엔드 ${ttsBackend.name}로 음성 테스트할게.`);
      await speakText(text);
      await msg.channel.send(`음성 테스트 완료: ${ttsBackend.name}, ${Date.now() - started}ms`);
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
  log('graceful shutdown requested', signalName, 'connection', Boolean(connection));
  try {
    if (currentAbortController && !currentAbortController.signal.aborted) currentAbortController.abort();
  } catch (e) {
    warn('abort before shutdown failed', e?.stack || e);
  }
  try {
    if (connection) {
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
      await waitEvent(player, AudioPlayerStatus.Idle, 30000).catch(() => {});
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
  try { ttsBackend?.close?.(); } catch (e) { warn('tts backend close failed', e?.message || e); }
  try { connection?.destroy(); } catch {}
  try { client.destroy(); } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });

client.login(settings.token);
