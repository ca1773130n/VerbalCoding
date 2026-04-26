
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
import { splitForTTS } from './tts_chunks.mjs';
import { playChunkedTTSWithPrefetch } from './tts_prefetch.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

const settings = {
  token: process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN,
  allowedUsers: new Set((process.env.DISCORD_ALLOWED_USERS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean)),
  autoJoinVoiceChannels: (process.env.AUTO_JOIN_VOICE_CHANNELS || '일반,General,general').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  transcriptChannelId: (process.env.TRANSCRIPT_CHANNEL_ID || '1497890694730219540').trim(),
  hermesCommand: process.env.HERMES_COMMAND || 'hermes chat -Q -q',
  whisperBin: process.env.WHISPER_CPP_BIN || 'whisper-cli',
  whisperModel: process.env.WHISPER_CPP_MODEL || path.join(ROOT, 'models', 'ggml-small-q5_1.bin'),
  ttsVoice: process.env.TTS_VOICE || 'ko-KR-SunHiNeural',
  ttsRate: process.env.TTS_RATE || '+10%',
  ttsMaxChars: Number(process.env.TTS_MAX_CHARS || '495'),
  requireWakeWord: ['1', 'true', 'yes'].includes((process.env.REQUIRE_WAKE_WORD || '0').toLowerCase()),
  wakeWords: (process.env.WAKE_WORDS || 'hermes,헤르메스,허미스').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  debugDir: process.env.NODE_AUDIO_DEBUG_DIR || '/tmp/hermes-discord-node-debug',
  progressTtsCacheDir: process.env.PROGRESS_TTS_CACHE_DIR || path.join(ROOT, '.cache', 'progress-tts'),
  sessionFile: process.env.HERMES_SESSION_FILE || path.join(ROOT, '.hermes-discord-session'),
};
if (!settings.token) throw new Error('DISCORD_BOT_TOKEN or DISCORD_TOKEN is required');
fs.mkdirSync(settings.debugDir, { recursive: true });
fs.mkdirSync(settings.progressTtsCacheDir, { recursive: true });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

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
const BARGE_IN_MIN_BYTES = 48000 * 2 * 2 * BARGE_IN_MIN_SECONDS;
const BARGE_IN_MIN_MEAN_VOLUME_DB = Number(process.env.BARGE_IN_MIN_MEAN_VOLUME_DB || '-35');
const BARGE_IN_MIN_MAX_VOLUME_DB = Number(process.env.BARGE_IN_MIN_MAX_VOLUME_DB || '-18');
const SUBSCRIBE_AFTER_SILENCE_MS = Number(process.env.SUBSCRIBE_AFTER_SILENCE_MS || '2200');
const UTTERANCE_IDLE_MS = Number(process.env.UTTERANCE_IDLE_MS || '2600');
const MIN_MEAN_VOLUME_DB = Number(process.env.MIN_MEAN_VOLUME_DB || '-35');
const MIN_MAX_VOLUME_DB = Number(process.env.MIN_MAX_VOLUME_DB || '-18');

function log(...args) { console.log(new Date().toISOString(), ...args); }
function warn(...args) { console.warn(new Date().toISOString(), ...args); }
function isAllowed(userId) { return settings.allowedUsers.size === 0 || settings.allowedUsers.has(String(userId)); }
function shellSplit(s) {
  const out = [];
  let cur = '', quote = null, esc = false;
  for (const ch of s) {
    if (esc) { cur += ch; esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (quote) { if (ch === quote) quote = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-'); }

function readHermesSessionId() {
  try {
    const id = fs.readFileSync(settings.sessionFile, 'utf8').trim();
    return id || null;
  } catch {
    return null;
  }
}

function writeHermesSessionId(id) {
  if (!id) return;
  try {
    fs.writeFileSync(settings.sessionFile, `${id}\n`, { mode: 0o600 });
  } catch (e) {
    warn('write Hermes session id failed', e?.stack || e);
  }
}

function extractHermesSessionId(text) {
  return /^session_id:\s*(\S+)/m.exec(text || '')?.[1] || null;
}

function sanitizeHermesOutput(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter(line => !/^session_id:\s*\S+\s*$/.test(line.trim()))
    .filter(line => !/^↻\s*Resumed session\s+\S+/.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function voiceBridgePrompt(text) {
  return [
    'Discord 음성 대화로 들어온 사용자 발화다.',
    '단순 대화/상태 질문이면 도구를 쓰지 말고 1~3문장으로 바로 한국어 답변해라.',
    '파일 수정, 실행, 로그 확인, 검색 같은 실제 작업 지시일 때만 필요한 도구를 사용해라.',
    '코드 변경을 수행했다면 음성 답변에는 diff나 코드 전문을 읽지 말고, 작업 결과와 다음 확인 사항만 짧게 말해라.',
    'CLI 메타정보나 session_id는 답변에 포함하지 마라.',
    '',
    text,
  ].join('\n');
}

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

function hermesPlan(text) {
  return {
    task: true,
    command: settings.hermesCommand,
    label: 'Hermes Agent',
  };
}

async function askHermes(text, signal, plan = hermesPlan(text)) {
  const argv = shellSplit(plan.command);
  const cmd = argv[0];
  const query = voiceBridgePrompt(text);
  let args = argv.slice(1).concat([query]);
  const sessionId = readHermesSessionId();
  if (sessionId) {
    const qIndex = args.lastIndexOf('-q');
    const insertAt = qIndex >= 0 ? qIndex : args.length - 1;
    args = args.slice(0, insertAt).concat(['--resume', sessionId], args.slice(insertAt));
  }
  const start = Date.now();
  log('Hermes CLI start', plan.label, cmd, args.slice(0, -1).join(' '), sessionId ? `resume=${sessionId}` : 'new-session');
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: plan.task ? 180000 : 45000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      signal,
    });
    const combined = `${stdout || ''}\n${stderr || ''}`;
    const newSessionId = extractHermesSessionId(combined);
    if (newSessionId) {
      writeHermesSessionId(newSessionId);
      log('Hermes session saved', newSessionId);
    }
    log('Hermes CLI done', plan.label, 'ms', Date.now() - start);
    return sanitizeHermesOutput(stdout) || sanitizeHermesOutput(stderr) || '응답이 비어 있어.';
  } catch (e) {
    if (isAbortError(e)) throw e;
    const stderr = (e.stderr || '').toString().trim();
    const stdout = (e.stdout || '').toString().trim();
    const msg = (e.message || '').toString().trim();
    warn('Hermes CLI failed', 'mode', plan.label, 'ms', Date.now() - start, 'code', e.code, 'signal', e.signal, 'stdout', stdout.slice(-500), 'stderr', stderr.slice(-500), 'message', msg.slice(-500));
    if (e.signal === 'SIGINT' || e.signal === 'SIGTERM') {
      return 'Hermes 작업이 중간에 중단됐어. 긴 코드 변경 출력은 음성으로 읽지 않을게. 필요한 경우 텍스트 채널에서 다시 지시해줘.';
    }
    return `Hermes CLI 실행에 실패했어: ${sanitizeHermesOutput(stderr || stdout || msg || e.code || 'unknown error').slice(0, 700)}`;
  }
}

async function synthTTS(text, signal) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const out = path.join(os.tmpdir(), `hermes-node-tts-${Date.now()}-${attempt}.mp3`);
    try {
      log('final tts synth start', 'attempt', attempt, 'chars', String(text || '').length);
      await execFileAsync('edge-tts', ['-v', settings.ttsVoice, '--rate', settings.ttsRate, '-t', text, '--write-media', out], { timeout: 60000, maxBuffer: 2 * 1024 * 1024, signal });
      if (!fs.existsSync(out) || fs.statSync(out).size <= 0) throw new Error('edge-tts produced empty file');
      log('final tts synth done', 'attempt', attempt, out, fs.statSync(out).size);
      return out;
    } catch (e) {
      lastError = e;
      fs.rm(out, { force: true }, () => {});
      if (isAbortError(e) || signal?.aborted) throw e;
      warn('final tts synth failed', 'attempt', attempt, e?.stderr?.toString?.().slice(-500) || e?.message || e);
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function synthProgressTTS(text, signal) {
  const cachePath = path.join(settings.progressTtsCacheDir, `${cacheKeyForText(`${settings.ttsVoice}\n${settings.ttsRate}\n${text}`)}.mp3`);
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    log('progress tts cache hit', text, cachePath);
    return cachePath;
  }
  log('progress tts cache miss', text);
  const tmp = path.join(settings.progressTtsCacheDir, `${cacheKeyForText(`${Date.now()}\n${text}`)}.tmp.mp3`);
  await execFileAsync('edge-tts', ['-v', settings.ttsVoice, '--rate', settings.ttsRate, '-t', text, '--write-media', tmp], { timeout: 60000, maxBuffer: 1024 * 1024, signal });
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

async function speakText(text, signal) {
  const chunks = splitForTTS(text, settings.ttsMaxChars);
  if (!chunks.length) return;
  log('TTS chunks', chunks.length, 'maxChars', settings.ttsMaxChars);
  await playChunkedTTSWithPrefetch(chunks, {
    signal,
    log,
    synth: chunk => synthTTS(chunk, signal),
    play: file => playAudio(file),
    cleanup: file => fs.promises.rm(file, { force: true }),
  });
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

function queueSegment(userId, file, pcmBytes) {
  let pending = pendingUtterances.get(userId);
  if (!pending) {
    pending = { files: [], pcmBytes: 0, timer: null };
    pendingUtterances.set(userId, pending);
  }
  pending.files.push(file);
  pending.pcmBytes += pcmBytes;
  if (pending.timer) clearTimeout(pending.timer);
  pending.timer = setTimeout(() => flushUtterance(userId).catch(e => warn('flushUtterance failed', userId, e?.stack || e)), UTTERANCE_IDLE_MS);
  log('queued segment', userId, 'segments', pending.files.length, 'totalPcmBytes', pending.pcmBytes, 'idleMs', UTTERANCE_IDLE_MS);
}

function isBargeInCandidate(pcmBytes, levels) {
  if (pcmBytes < BARGE_IN_MIN_BYTES) return false;
  return levels.meanDb >= BARGE_IN_MIN_MEAN_VOLUME_DB || levels.maxDb >= BARGE_IN_MIN_MAX_VOLUME_DB;
}

async function flushUtterance(userId) {
  const pending = pendingUtterances.get(userId);
  if (!pending) return;
  pendingUtterances.delete(userId);
  if (pending.timer) clearTimeout(pending.timer);
  const files = pending.files;
  const pcmBytes = pending.pcmBytes;
  if (pcmBytes < MIN_UTTERANCE_BYTES) {
    log('skip short utterance', userId, 'segments', files.length, 'pcmBytes', pcmBytes, 'minBytes', MIN_UTTERANCE_BYTES);
    return;
  }
  const merged = path.join(settings.debugDir, `utterance-merged-${stamp()}-${userId}.wav`);
  await concatWavs(files, merged);
  const levels = await analyzeAudio(merged);
  log('utterance levels', userId, 'segments', files.length, 'pcmBytes', pcmBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb);
  if ((speaking || processing) && isBargeInCandidate(pcmBytes, levels)) {
    interruptCurrentResponse(userId, 'confirmed-barge-in');
  } else if (speaking || processing) {
    log('ignore weak barge-in candidate', userId, 'pcmBytes', pcmBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb, 'thresholdBytes', BARGE_IN_MIN_BYTES, 'thresholds', BARGE_IN_MIN_MEAN_VOLUME_DB, BARGE_IN_MIN_MAX_VOLUME_DB);
  }
  // Drop only when BOTH overall energy and peak are low. Real Discord speech from this
  // mic can have low mean volume while still carrying intelligible peaks; using OR here
  // caused valid Korean utterances to be discarded as "low-energy".
  if (levels.meanDb < MIN_MEAN_VOLUME_DB && levels.maxDb < MIN_MAX_VOLUME_DB) {
    log('skip low-energy utterance', userId, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb, 'thresholds', MIN_MEAN_VOLUME_DB, MIN_MAX_VOLUME_DB, 'mode', 'both-below');
    return;
  }
  await handleRecording(userId, merged, pcmBytes, files.length);
}

async function handleRecording(userId, wavPath, pcmBytes, segments = 1) {
  if (processing) { log('drop while processing', userId); return; }
  if (!isAllowed(userId)) { warn('ignore unauthorized', userId); return; }
  processing = true;
  const turnId = ++activeTurnId;
  const controller = new AbortController();
  currentAbortController = controller;
  const signal = controller.signal;
  try {
    log('transcribing', userId, wavPath, 'pcmBytes', pcmBytes, 'segments', segments, 'turn', turnId);
    const text = await transcribe(wavPath);
    if (interruptedTurns.has(turnId) || signal.aborted) return;
    if (!text) { log('empty transcript', userId, wavPath); return; }
    log(`user ${userId} said: ${text}`);
    await sendText(`📝 STT 결과 <@${userId}>: ${text}`);
    if (!acceptsWake(text)) { await sendText('wake word 없음: 응답은 안 함'); return; }

    const prompt = stripWake(text);
    const plan = hermesPlan(prompt);
    log('Hermes plan', plan.label, 'task', plan.task);
    const hermesPromise = askHermes(prompt, signal, plan);
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
    const answer = await hermesPromise.finally(() => { done = true; });
    void progressLoop;
    if (interruptedTurns.has(turnId) || signal.aborted) return;

    log('Hermes answer', answer.slice(0, 200));
    await sendText(`✅ Hermes 응답:\n${answer}`);
    const spokenAnswer = spokenResultOnly(prompt, answer);
    log('spoken answer', spokenAnswer.slice(0, 200));
    if (!signal.aborted && !interruptedTurns.has(turnId)) {
      speakProgress('응답 받았어. 음성으로 바꾸는 중.', signal).catch(() => {});
    }
    await speakText(spokenAnswer, signal);
  } catch (e) {
    if (isAbortError(e) || interruptedTurns.has(turnId)) {
      log('turn aborted', userId, 'turn', turnId);
      return;
    }
    warn('handleRecording failed', e?.stack || e);
    const shortMsg = String(e?.message || e).slice(0, 800);
    await sendText(`⚠️ 음성 처리 실패: ${shortMsg}`);
  } finally {
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
  activeStreams.set(userId, { opusStream, decoder, writer, file });
  let pcmBytes = 0;
  decoder.on('data', chunk => { pcmBytes += chunk.length; });
  opusStream.on('error', e => warn('opus stream error', userId, e?.stack || e));
  decoder.on('error', e => warn('opus decoder error', userId, e?.stack || e));
  writer.on('error', e => warn('wav writer error', userId, e?.stack || e));
  opusStream.on('end', () => log('opus end', userId, 'pcmBytes', pcmBytes));
  writer.on('finish', () => {
    activeStreams.delete(userId);
    log('saved segment', userId, 'pcmBytes', pcmBytes, file);
    queueSegment(userId, file, pcmBytes);
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
  if (content === '!session') return void msg.reply(`Hermes 세션: ${readHermesSessionId() || '아직 없음'}`);
  if (content === '!reset-session') {
    try { fs.rmSync(settings.sessionFile, { force: true }); } catch {}
    return void msg.reply('Hermes 음성/텍스트 공유 세션 초기화했어.');
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
  if (content.startsWith('!ask ')) {
    const text = content.slice(5).trim();
    if (!text) return void msg.reply('물어볼 내용을 붙여줘.');
    await msg.channel.send('텍스트 입력을 음성 세션과 같은 Hermes 세션으로 보낼게.');
    const plan = hermesPlan(text);
    const answer = await askHermes(text, undefined, plan);
    await msg.channel.send(answer.slice(0, 1900));
    if (connection) {
      await speakText(answer);
    }
    return;
  }
});

process.on('SIGTERM', () => { try { connection?.destroy(); } catch {}; client.destroy(); process.exit(0); });
process.on('SIGINT', () => { try { connection?.destroy(); } catch {}; client.destroy(); process.exit(0); });

client.login(settings.token);
