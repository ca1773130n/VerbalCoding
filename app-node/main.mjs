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
import { buildAgentSettings, createAgentAdapter, isPatchLikeOutput } from './agent_adapters.mjs';
import {
  appendJsonl,
  createLatencyTurn,
  formatLatencySummary,
  readJsonlRecords,
  summarizeLatencyRecords,
} from './latency_metrics.mjs';
import { splitForTTS } from './tts_chunks.mjs';
import { playChunkedTTSWithPrefetch } from './tts_prefetch.mjs';
import { buildTtsSettings } from './tts_settings.mjs';
import { createTtsBackend } from './tts_backends.mjs';
import { createBridgeLogger, createTransientErrorReporter, isTransientNetworkError } from './bridge_logger.mjs';
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

function loadDotEnv(file = path.join(ROOT, '.env')) {
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
    if (key) process.env[key] = value;
  }
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
loadDotEnv();

const settings = {
  token: process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN,
  allowedUsers: new Set((process.env.DISCORD_ALLOWED_USERS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean)),
  autoJoinVoiceChannels: (process.env.AUTO_JOIN_VOICE_CHANNELS || '일반,General,general').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  transcriptChannelId: (process.env.TRANSCRIPT_CHANNEL_ID || '1497890694730219540').trim(),
  whisperBin: process.env.WHISPER_CPP_BIN || 'whisper-cli',
  whisperModel: process.env.WHISPER_CPP_MODEL || path.join(ROOT, 'models', 'ggml-small-q5_1.bin'),
  tts: buildTtsSettings(process.env, ROOT),
  requireWakeWord: ['1', 'true', 'yes'].includes((process.env.REQUIRE_WAKE_WORD || '0').toLowerCase()),
  wakeWords: (process.env.WAKE_WORDS || 'hermes,헤르메스,허미스').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  debugDir: process.env.NODE_AUDIO_DEBUG_DIR || '/tmp/verbalcoding-node-debug',
  latencyLogPath: process.env.LATENCY_LOG_PATH || path.join(ROOT, '.logs', 'latency.jsonl'),
  agent: buildAgentSettings({ ROOT, env: process.env }),
};
if (!settings.token) throw new Error('DISCORD_BOT_TOKEN or DISCORD_TOKEN is required');
fs.mkdirSync(settings.debugDir, { recursive: true });
fs.mkdirSync(settings.tts.progressCacheDir, { recursive: true });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});
const ttsBackend = createTtsBackend(settings.tts, { execFileAsync, log, warn });
const voiceCloneCapture = createVoiceCloneCaptureState({ defaultTargetPath: settings.tts.openvoice.refAudio });

let connection = null;
let player = createAudioPlayer();
let speaking = false;
let processing = false;
let activeTurnId = 0;
let currentAbortController = null;
const interruptedTurns = new Set();
const activeStreams = new Map();
const pendingUtterances = new Map();
const MIN_UTTERANCE_SECONDS = Number(process.env.MIN_UTTERANCE_SECONDS || '1.0');
const MIN_UTTERANCE_BYTES = 48000 * 2 * 2 * MIN_UTTERANCE_SECONDS;
const BARGE_IN_MIN_SECONDS = Number(process.env.BARGE_IN_MIN_SECONDS || '0.9');
const BARGE_IN_MIN_MEAN_VOLUME_DB = Number(process.env.BARGE_IN_MIN_MEAN_VOLUME_DB || '-35');
const BARGE_IN_MIN_MAX_VOLUME_DB = Number(process.env.BARGE_IN_MIN_MAX_VOLUME_DB || '-18');
const BARGE_IN_CONSERVATIVE_MIN_SECONDS = Number(process.env.BARGE_IN_CONSERVATIVE_MIN_SECONDS || '1.4');
const BARGE_IN_CONSERVATIVE_MIN_MEAN_VOLUME_DB = Number(process.env.BARGE_IN_CONSERVATIVE_MIN_MEAN_VOLUME_DB || '-30');
const BARGE_IN_CONSERVATIVE_MIN_MAX_VOLUME_DB = Number(process.env.BARGE_IN_CONSERVATIVE_MIN_MAX_VOLUME_DB || '-14');
const SENSITIVITY_MODE_DEFAULT = (process.env.BARGE_IN_SENSITIVITY_MODE || 'normal').toLowerCase() === 'conservative' ? 'conservative' : 'normal';
const SENSITIVITY_OUTDOOR_SECONDS = Number(process.env.BARGE_IN_OUTDOOR_SECONDS || '900');
const SUBSCRIBE_AFTER_SILENCE_MS = Number(process.env.SUBSCRIBE_AFTER_SILENCE_MS || '2200');
const UTTERANCE_IDLE_MS = Number(process.env.UTTERANCE_IDLE_MS || '2000');
const MIN_MEAN_VOLUME_DB = Number(process.env.MIN_MEAN_VOLUME_DB || '-35');
const MIN_MAX_VOLUME_DB = Number(process.env.MIN_MAX_VOLUME_DB || '-18');

const bridgeLogger = createBridgeLogger({
  appendLine: line => {
    if (!process.env.BRIDGE_LOG_PATH) return;
    fs.appendFileSync(process.env.BRIDGE_LOG_PATH, `${line}\n`);
  },
});
function log(...args) { bridgeLogger.log(...args); }
function warn(...args) { bridgeLogger.warn(...args); }
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
let verboseProgress = Boolean(settings.agent.verboseProgress);
let activeProgressSignal = null;
let verboseProgressSpeechQueue = Promise.resolve();
const agentAdapter = createAgentAdapter(settings.agent, {
  execFileAsync,
  spawn,
  log,
  warn,
  onProgress: event => {
    if (!verboseProgress) return;
    sendText(`🔎 진행: ${event}`).catch(e => warn('send verbose progress failed', e?.stack || e));
    queueVerboseProgressSpeech(event, activeProgressSignal);
  },
});
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
  return `감도 모드: ${thresholds.mode}, 최소 ${(thresholds.minBytes / (48000 * 2 * 2)).toFixed(1)}초, mean>=${thresholds.minMeanDb}dB 또는 max>=${thresholds.minMaxDb}dB${ttl ? `, ${ttl}초 뒤 기본으로 복귀` : ''}`;
}

function verboseStatusText() {
  return `verbose 진행 모드: ${verboseProgress ? '켜짐' : '꺼짐'}${verboseProgress ? ' — 에이전트의 파일 읽기/스킬 사용/툴 사용/웹 검색/터미널 실행 같은 중간 항목을 텍스트와 음성으로 알려줄게.' : ' — 기본은 조용하게 최종 결과 중심으로만 알려줄게.'}`;
}

function setVerboseProgress(enabled, reason = 'manual') {
  verboseProgress = Boolean(enabled);
  log('verbose progress mode set', verboseProgress, 'reason', reason);
  return verboseProgress;
}

function isAllowed(userId) { return settings.allowedUsers.size === 0 || settings.allowedUsers.has(String(userId)); }
function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-'); }

function stripMarkdownNoise(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, '코드 블록은 텍스트 채널에 남겼어.')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[[^\]]+\]\([^\)]+\)/g, match => match.replace(/\]\([^\)]+\)/, '').replace('[', ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function spokenResultOnly(userPrompt, answer) {
  const cleaned = stripMarkdownNoise(answer);
  if (isPatchLikeOutput(cleaned)) {
    return '코드 변경 diff가 길게 나와서 음성으로는 읽지 않을게. 변경 파일과 테스트 결과만 텍스트 채널에 정리할게.';
  }
  if (!isTaskRequest(userPrompt)) return cleaned;

  const lines = cleaned
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^\s*(실행|로그|명령|diff|변경사항 상세|검증 로그|테스트 출력)\s*[:：]/i.test(line));

  const resultish = lines.filter(line => /(완료|고쳤|수정|추가|생성|적용|확인|성공|실패|에러|남았|필요|바뀐|변경|결과)/.test(line));
  const selected = (resultish.length ? resultish : lines).slice(0, 4).join(' ');
  let spoken = selected || cleaned;
  if (spoken.length > 520) spoken = `${spoken.slice(0, 500).replace(/[\s,.;:，。]+$/u, '')}. 자세한 내용은 텍스트 채널에 남겼어.`;
  if (spoken.length < cleaned.length && !/텍스트 채널/.test(spoken)) spoken += ' 자세한 내용은 텍스트 채널에 남겼어.';
  return spoken;
}

function cacheKeyForText(text) {
  return Buffer.from(text, 'utf8').toString('base64url').slice(0, 160);
}

async function sendText(text) {
  const body = String(text || '');
  if (!settings.transcriptChannelId) { log('transcript:', body); return; }
  try {
    const ch = await client.channels.fetch(settings.transcriptChannelId);
    if (!ch?.isTextBased()) return;
    const chunks = [];
    for (let i = 0; i < body.length; i += 1900) chunks.push(body.slice(i, i + 1900));
    for (const chunk of chunks.length ? chunks : ['']) await ch.send(chunk);
  } catch (e) { warn('sendText failed', e?.stack || e); }
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
  const args = ['-m', settings.whisperModel, '-f', input16k, '-l', 'ko', '-nt', '-otxt', '-of', outBase, '-sns', '-nf', '-nth', '0.35', '-et', '2.2', '-lpt', '-0.8'];
  try {
    await execFileAsync(settings.whisperBin, args, { timeout: 25000, maxBuffer: 2 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`whisper failed: ${e.stderr || e.message}`);
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
    if (bad.some(b => compact.includes(b))) continue;
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

async function synthTTS(text, signal) {
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
  const ext = ttsBackend.outputExtension || 'mp3';
  const cachePath = path.join(settings.tts.progressCacheDir, `${cacheKeyForText(`${ttsBackend.cacheKeyParts().join('\n')}\n${text}`)}.${ext}`);
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
    const resource = createAudioResource(file, { inputType: StreamType.Arbitrary });
    player.play(resource);
    connection.subscribe(player);
    await waitEvent(player, AudioPlayerStatus.Idle, 120000).catch(() => {});
  } finally {
    speaking = false;
    if (deleteAfter) fs.rm(file, { force: true }, () => {});
  }
}

async function speakText(text, signal, metricsTurn = null) {
  const chunks = splitForTTS(text, settings.tts.maxChars);
  if (!chunks.length) return;
  log('TTS chunks', chunks.length, 'maxChars', settings.tts.maxChars, 'backend', ttsBackend.name);
  let synthMs = 0;
  let playMs = 0;
  const ttsStart = Date.now();
  await playChunkedTTSWithPrefetch(chunks, {
    signal,
    log,
    synth: async chunk => {
      const start = Date.now();
      try { return await synthTTS(chunk, signal); }
      finally { synthMs += Date.now() - start; }
    },
    play: async file => {
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

function queueVerboseProgressSpeech(event, signal) {
  if (!verboseProgress || !signal || signal.aborted) return;
  const text = String(event || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!text) return;
  verboseProgressSpeechQueue = verboseProgressSpeechQueue
    .catch(() => {})
    .then(async () => {
      if (!verboseProgress || signal.aborted || !processing) return;
      await speakProgress(text, signal);
    });
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
  let pending = pendingUtterances.get(userId);
  if (!pending) {
    pending = { files: [], pcmBytes: 0, timer: null, firstPacketAt: startedAtMs, lastSegmentEndAt: endedAtMs };
    pendingUtterances.set(userId, pending);
  }
  pending.files.push(file);
  pending.pcmBytes += pcmBytes;
  pending.firstPacketAt = Math.min(pending.firstPacketAt || startedAtMs, startedAtMs);
  pending.lastSegmentEndAt = Math.max(pending.lastSegmentEndAt || endedAtMs, endedAtMs);
  if (pending.timer) clearTimeout(pending.timer);
  pending.timer = setTimeout(() => flushUtterance(userId).catch(e => warn('flushUtterance failed', userId, e?.stack || e)), UTTERANCE_IDLE_MS);
  log('queued segment', userId, 'segments', pending.files.length, 'totalPcmBytes', pending.pcmBytes, 'idleMs', UTTERANCE_IDLE_MS);
}

function isBargeInCandidate(pcmBytes, levels) {
  const thresholds = currentBargeInThresholds();
  return isValidatedBargeInCandidate(pcmBytes, levels, thresholds);
}

async function validateProcessingBargeIn(userId, wavPath, pcmBytes, segments) {
  log('validating processing barge-in transcript', userId, wavPath, 'pcmBytes', pcmBytes, 'segments', segments);
  const text = await transcribe(wavPath);
  if (!text) {
    log('ignore processing barge-in: empty transcript', userId, wavPath);
    return false;
  }
  if (!isExplicitBargeInTranscript(text)) {
    log('ignore processing barge-in: not explicit stop phrase', userId, JSON.stringify(text));
    return false;
  }
  log('confirmed processing barge-in by explicit transcript', userId, JSON.stringify(text));
  interruptCurrentResponse(userId, 'confirmed-processing-barge-in');
  return true;
}

async function flushUtterance(userId) {
  const pending = pendingUtterances.get(userId);
  if (!pending) return;
  pendingUtterances.delete(userId);
  if (pending.timer) clearTimeout(pending.timer);
  const files = pending.files;
  const pcmBytes = pending.pcmBytes;
  const metricsTurn = newLatencyTurn(userId, pending.firstPacketAt || Date.now());
  metricsTurn.mark('voice_first_packet', pending.firstPacketAt || Date.now());
  metricsTurn.mark('voice_segment_end', pending.lastSegmentEndAt || Date.now());
  metricsTurn.mark('utterance_flush');
  metricsTurn.addMeta({ segments: files.length, pcmBytes });
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
  if (processing && candidate) {
    await validateProcessingBargeIn(userId, merged, pcmBytes, files.length);
    metricsTurn.finish({ status: 'barge_in_processing_candidate' });
    return;
  } else if (speaking && candidate) {
    metricsTurn.finish({ status: 'barge_in_playback' });
    interruptCurrentResponse(userId, 'confirmed-barge-in');
    return;
  } else if (speaking || processing) {
    const thresholds = currentBargeInThresholds();
    log('ignore weak barge-in candidate', userId, 'pcmBytes', pcmBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb, 'thresholdBytes', thresholds.minBytes, 'thresholds', thresholds.minMeanDb, thresholds.minMaxDb, 'mode', thresholds.mode);
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
  try {
    log('transcribing', userId, wavPath, 'pcmBytes', pcmBytes, 'segments', segments, 'turn', turnId);
    const sttStart = Date.now();
    const text = await transcribe(wavPath);
    metricsTurn?.stage('stt', Date.now() - sttStart, { transcriptChars: String(text || '').length });
    if (interruptedTurns.has(turnId) || signal.aborted) { metricsTurn?.finish({ status: 'aborted_after_stt' }); return; }
    if (!text) { log('empty transcript', userId, wavPath); metricsTurn?.finish({ status: 'empty_transcript' }); return; }
    log(`user ${userId} said: ${text}`);
    await sendText(`📝 STT 결과 <@${userId}>: ${text}`);
    if (!acceptsWake(text)) { await sendText('wake word 없음: 응답은 안 함'); metricsTurn?.finish({ status: 'wake_rejected' }); return; }

    const prompt = stripWake(text);
    if (await handleVoiceCloneCommand(userId, prompt, signal)) {
      metricsTurn?.finish({ status: 'voice_clone_command' });
      return;
    }
    const sensitivityRequest = sensitivityModeFromTranscript(prompt);
    if (sensitivityRequest) {
      const thresholds = setSensitivityMode(sensitivityRequest.mode, sensitivityRequest.reason);
      await sendText(`🎚️ ${sensitivityStatusText()}`);
      if (isSensitivityOnlyRequest(prompt)) {
        await speakText(`${thresholds.mode === 'conservative' ? '외부 보수 모드' : '기본 감도'}로 바꿨어.`, signal, metricsTurn);
        metricsTurn?.finish({ status: 'sensitivity_only' });
        return;
      }
    }
    const verboseRequest = verboseModeFromTranscript(prompt);
    if (verboseRequest !== null) {
      setVerboseProgress(verboseRequest, 'voice-command');
      await sendText(`🔎 ${verboseStatusText()}`);
      if (isVerboseOnlyRequest(prompt)) {
        await speakText(verboseRequest ? '상세 진행 모드 켰어.' : '상세 진행 모드 껐어.', signal, metricsTurn);
        metricsTurn?.finish({ status: 'verbose_only' });
        return;
      }
    }
    const plan = { task: true, label: agentAdapter.label, verboseProgress };
    log('Agent plan', plan.label, 'backend', agentAdapter.backend, 'task', plan.task);
    const agentStart = Date.now();
    activeProgressSignal = signal;
    const agentPromise = agentAdapter.ask(prompt, signal, plan);
    let done = false;
    // Stage announcements say the actual pipeline step. They are delayed so very
    // fast answers do not get blocked by status TTS.
    const progressLoop = (async () => {
      await sleep(2500);
      if (!done && !signal.aborted && !interruptedTurns.has(turnId)) {
        await speakProgress('에이전트 호출했어. 응답 기다리는 중.', signal);
      }
      // Do not repeat the same status phrase indefinitely; it makes the bridge
      // feel stuck. One extra long-running notice is enough for voice UX.
      await sleep(18000);
      if (!done && !signal.aborted && !interruptedTurns.has(turnId)) {
        await speakProgress('아직 작업 중이야.', signal);
      }
    })().catch(e => {
      if (!isAbortError(e)) warn('progress loop failed', e?.stack || e);
    });
    const answer = await agentPromise.finally(() => { done = true; });
    metricsTurn?.stage('agent', Date.now() - agentStart, { answerChars: String(answer || '').length, backend: agentAdapter.backend });
    void progressLoop;
    if (interruptedTurns.has(turnId) || signal.aborted) { metricsTurn?.finish({ status: 'aborted_after_agent' }); return; }

    log('Agent answer', agentAdapter.label, answer.slice(0, 200));
    await sendText(`✅ ${agentAdapter.label} 응답:\n${answer}`);
    const spokenAnswer = spokenResultOnly(prompt, answer);
    log('spoken answer', spokenAnswer.slice(0, 200));
    if (!signal.aborted && !interruptedTurns.has(turnId)) {
      speakProgress('응답 받았어. 음성으로 바꾸는 중.', signal).catch(() => {});
    }
    await speakText(spokenAnswer, signal, metricsTurn);
    metricsTurn?.finish({ status: 'ok' });
  } catch (e) {
    if (isAbortError(e) || interruptedTurns.has(turnId)) {
      log('turn aborted', userId, 'turn', turnId);
      metricsTurn?.finish({ status: 'aborted' });
      return;
    }
    warn('handleRecording failed', e?.stack || e);
    const shortMsg = String(e?.message || e).slice(0, 800);
    metricsTurn?.finish({ status: 'error', error: shortMsg });
    await sendText(`⚠️ 음성 처리 실패: ${shortMsg}`);
  } finally {
    if (activeProgressSignal === signal) activeProgressSignal = null;
    if (currentAbortController === controller) currentAbortController = null;
    interruptedTurns.delete(turnId);
    if (activeTurnId === turnId) activeTurnId = 0;
    processing = false;
  }
}

function subscribeUser(receiver, userId) {
  if (!isAllowed(userId)) return;
  if (String(userId) === client.user?.id) return;
  if ((speaking || processing) && !activeStreams.has(userId)) {
    // Do not abort on Discord speaking.start alone. Progress/final TTS can echo
    // into the user's mic and Discord also fires this for breath/clicks. Record
    // the candidate first; queueUtterance validates duration + volume before it
    // can interrupt the current turn.
    log('possible barge-in start; waiting for segment validation', userId, 'speaking', speaking, 'processing', processing);
  }
  if (activeStreams.has(userId)) return;
  const pending = pendingUtterances.get(userId);
  if (pending?.timer) {
    clearTimeout(pending.timer);
    pending.timer = null;
    log('extend pending utterance because new segment started', userId, 'segments', pending.files.length, 'totalPcmBytes', pending.pcmBytes);
  }

  const file = path.join(settings.debugDir, `segment-${stamp()}-${userId}.wav`);
  log('subscribe user', userId, file);
  const opusStream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: SUBSCRIBE_AFTER_SILENCE_MS } });
  const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  const writer = new wav.FileWriter(file, { sampleRate: 48000, channels: 2, bitDepth: 16 });
  activeStreams.set(userId, { opusStream, decoder, writer, file, startedAtMs: Date.now() });
  let pcmBytes = 0;
  const liveThresholds = currentBargeInThresholds();
  const liveBargeIn = shouldUseLivePlaybackBargeIn({ speaking, processing }) ? createLiveBargeInMonitor({
    minBytes: liveThresholds.minBytes,
    minMeanDb: liveThresholds.minMeanDb,
    minMaxDb: liveThresholds.minMaxDb,
    log,
    onConfirm: ({ pcmBytes: confirmedBytes, levels }) => {
      log('confirmed live playback barge-in before segment end', userId, 'pcmBytes', confirmedBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb);
      interruptCurrentResponse(userId, 'confirmed-live-playback-barge-in');
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
  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });
  connection.subscribe(player);
  connection.on('error', e => warn('voice connection error', e?.stack || e));
  connection.on('stateChange', async (oldState, newState) => {
    log('voice connection state', oldState.status, '->', newState.status);
    if (newState.status === VoiceConnectionStatus.Disconnected) {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch (e) {
        warn('voice connection disconnected; reconnecting to channel', channel.guild.name, channel.name, e?.message || e);
        try { connection?.destroy(); } catch {}
        connection = null;
        setTimeout(() => connectTo(channel).catch(err => warn('voice reconnect failed', err?.stack || err)), 1500);
      }
    }
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 30000);
  connection.receiver.speaking.on('start', userId => subscribeUser(connection.receiver, userId));
  log(`Listening in voice channel ${channel.guild.name} / ${channel.name}`);
}

async function autoJoin() {
  for (const guild of client.guilds.cache.values()) {
    const channels = await guild.channels.fetch();
    for (const ch of channels.values()) {
      if (ch?.isVoiceBased?.() && settings.autoJoinVoiceChannels.includes(ch.name.toLowerCase())) {
        await connectTo(ch);
        return;
      }
    }
  }
  warn('No auto-join channel found', settings.autoJoinVoiceChannels);
}

client.once('ready', async () => {
  log(`Logged in as ${client.user.tag} (${client.user.id})`);
  await autoJoin();
});

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!isAllowed(msg.author.id)) return;
  const content = msg.content.trim();
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
  if (content === '!session') return void msg.reply(`${agentAdapter.label} 세션: ${agentAdapter.readSessionId?.() || '아직 없음'}`);
  if (content === '!reset-session') {
    try { fs.rmSync(settings.agent.sessionFile, { force: true }); } catch {}
    return void msg.reply(`${agentAdapter.label} 음성/텍스트 공유 세션 초기화했어.`);
  }
  if (content === '!join') {
    const ch = msg.member?.voice?.channel;
    if (!ch) return void msg.reply('먼저 음성 채널에 들어가줘.');
    await connectTo(ch);
    return void msg.reply('들어왔어. Node receiver로 듣는 중.');
  }
  if (content === '!leave') {
    try { connection?.destroy(); } catch {}
    connection = null;
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
    await msg.channel.send(`텍스트 입력을 음성 세션과 같은 ${agentAdapter.label} 세션으로 보낼게.`);
    const plan = { task: true, label: agentAdapter.label, verboseProgress };
    const answer = await agentAdapter.ask(text, undefined, plan);
    await msg.channel.send(answer.slice(0, 1900));
    if (connection) {
      await speakText(answer);
    }
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
process.on('SIGTERM', () => { try { connection?.destroy(); } catch {}; client.destroy(); process.exit(0); });
process.on('SIGINT', () => { try { connection?.destroy(); } catch {}; client.destroy(); process.exit(0); });

client.login(settings.token);
