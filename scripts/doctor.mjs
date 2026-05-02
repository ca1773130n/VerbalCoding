#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseKeyValueEnv } from '../app-node/install_config.mjs';
import { autoRestartVoiceBotEnabled } from '../app-node/restart_policy.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readEnvFile(file) {
  try {
    return parseKeyValueEnv(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function mergeEnv() {
  // Project .env intentionally wins over ~/.zshrc so local setup is reproducible.
  return {
    ...process.env,
    ...readEnvFile(path.join(process.env.HOME || '', '.zshrc')),
    ...readEnvFile(path.join(ROOT, '.env')),
  };
}

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${JSON.stringify(command)}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function check(label, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`);
  return Boolean(ok);
}

function note(label, detail = '') {
  console.log(`• ${label}${detail ? ` — ${detail}` : ''}`);
}

const env = mergeEnv();
const backend = (env.AGENT_BACKEND || 'hermes').toLowerCase();
const ttsBackend = (env.TTS_BACKEND || 'edge').toLowerCase();
let ok = true;

console.log('VerbalCoding doctor');
console.log(`Project: ${ROOT}`);
console.log(`Backend: ${backend}`);
console.log(`TTS backend: ${ttsBackend}`);
console.log('');

ok = check('Node.js', commandExists('node'), commandExists('node') || 'missing') && ok;
ok = check('npm', commandExists('npm'), commandExists('npm') || 'missing') && ok;
ok = check('ffmpeg', commandExists('ffmpeg'), commandExists('ffmpeg') || 'missing') && ok;
ok = check('whisper-cli', commandExists(env.WHISPER_CPP_BIN || 'whisper-cli'), commandExists(env.WHISPER_CPP_BIN || 'whisper-cli') || 'missing') && ok;

const modelPath = path.resolve(ROOT, env.WHISPER_CPP_MODEL || 'models/ggml-small-q5_1.bin');
ok = check('whisper.cpp model', fs.existsSync(modelPath), path.relative(ROOT, modelPath)) && ok;
ok = check('Discord bot token configured', Boolean(env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN), (env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN) ? '[REDACTED]' : 'missing DISCORD_BOT_TOKEN') && ok;
note('Allowed users configured', env.DISCORD_ALLOWED_USERS ? '[REDACTED]' : 'not set; bot may accept all users depending on config');
note('Auto-join channels', env.AUTO_JOIN_VOICE_CHANNELS || 'default: 일반,General,general');
note('Verbose progress default', ['1', 'true', 'yes', 'on'].includes(String(env.AGENT_VERBOSE_PROGRESS || env.VERBALCODING_VERBOSE_PROGRESS || '0').toLowerCase()) ? 'on' : 'off');
note('Auto restart voice bot after commits', autoRestartVoiceBotEnabled(env) ? 'on' : 'off');
note('Utterance idle wait before STT', `${env.UTTERANCE_IDLE_MS || '2000'} ms`);
note('STT language', env.WHISPER_CPP_LANGUAGE || env.STT_LANGUAGE || 'ko');
note('Progress/voice language', env.VOICE_LANGUAGE || env.WHISPER_CPP_LANGUAGE || env.STT_LANGUAGE || 'ko');
note('Latency log path', env.LATENCY_LOG_PATH || './.logs/latency.jsonl');
note('TTS voice fallback', env.TTS_VOICE || 'ko-KR-SunHiNeural');

if (!['edge', 'openvoice', 'speechswift', 'supertonic'].includes(ttsBackend)) {
  ok = check('TTS_BACKEND value', false, 'must be edge, openvoice, speechswift, or supertonic') && ok;
}
if (ttsBackend === 'edge') {
  ok = check('edge-tts', commandExists('edge-tts'), commandExists('edge-tts') || 'missing') && ok;
} else if (ttsBackend === 'openvoice') {
  ok = check('Python for OpenVoice', commandExists('python3'), commandExists('python3') || 'missing') && ok;
  const openvoiceDir = path.resolve(ROOT, env.OPENVOICE_DIR || './vendor/OpenVoice');
  const openvoiceVenv = path.resolve(ROOT, env.OPENVOICE_VENV || './.venv-openvoice');
  const refAudio = path.resolve(ROOT, env.OPENVOICE_REF_AUDIO || './voice-samples/user-reference.wav');
  ok = check('OpenVoice repo', fs.existsSync(openvoiceDir), path.relative(ROOT, openvoiceDir)) && ok;
  ok = check('OpenVoice venv', fs.existsSync(openvoiceVenv), path.relative(ROOT, openvoiceVenv)) && ok;
  ok = check('OpenVoice reference audio', fs.existsSync(refAudio), path.relative(ROOT, refAudio)) && ok;
  ok = check('OpenVoice synth wrapper help', spawnSync('python3', ['scripts/openvoice_synth.py', '--help'], { cwd: ROOT, encoding: 'utf8' }).status === 0, 'scripts/openvoice_synth.py') && ok;
  note('OpenVoice progress prompts', ['1', 'true', 'yes', 'on'].includes(String(env.OPENVOICE_PROGRESS || '0').toLowerCase()) ? 'openvoice' : 'edge fallback');
} else if (ttsBackend === 'speechswift') {
  const mode = String(env.SPEECHSWIFT_MODE || 'cli').toLowerCase() === 'server' ? 'server' : 'cli';
  ok = check(mode === 'server' ? 'audio-server' : 'audio CLI', commandExists(mode === 'server' ? 'audio-server' : (env.SPEECHSWIFT_COMMAND || 'audio')), commandExists(mode === 'server' ? 'audio-server' : (env.SPEECHSWIFT_COMMAND || 'audio')) || 'missing') && ok;
  note('SpeechSwift progress prompts', ['1', 'true', 'yes', 'on'].includes(String(env.SPEECHSWIFT_PROGRESS || '0').toLowerCase()) ? 'speechswift' : 'edge fallback');
} else if (ttsBackend === 'supertonic') {
  const supertonicCommand = env.SUPERTONIC_COMMAND || 'supertonic';
  ok = check('supertonic CLI', commandExists(supertonicCommand), commandExists(supertonicCommand) || 'install with: python3 -m pip install supertonic') && ok;
  note('Supertonic voice/lang/steps', `${env.SUPERTONIC_VOICE || 'M1'} / ${env.SUPERTONIC_LANGUAGE || 'ko'} / ${env.SUPERTONIC_STEPS || '2'}`);
  note('Supertonic progress prompts', ['1', 'true', 'yes', 'on'].includes(String(env.SUPERTONIC_PROGRESS || '0').toLowerCase()) ? 'supertonic' : 'edge fallback');
}

const backendCommand = {
  hermes: env.HERMES_COMMAND || 'hermes',
  'claude-code': env.CLAUDE_COMMAND || 'claude',
  claude: env.CLAUDE_COMMAND || 'claude',
  codex: env.CODEX_COMMAND || 'codex',
  gemini: env.GEMINI_COMMAND || 'gemini',
  opencode: env.OPENCODE_COMMAND || 'opencode',
  openclaw: env.OPENCLAW_COMMAND || 'openclaw',
  custom: env.AGENT_COMMAND || '',
}[backend] || '';

if (backend === 'custom') {
  ok = check('Custom AGENT_COMMAND configured', Boolean(env.AGENT_COMMAND), env.AGENT_COMMAND ? '[REDACTED]' : 'missing AGENT_COMMAND') && ok;
} else {
  const first = String(backendCommand).trim().split(/\s+/)[0];
  ok = check(`${backend} CLI`, first && commandExists(first), first ? (commandExists(first) || `missing ${first}`) : 'missing command') && ok;
}

console.log('');
if (ok) {
  console.log('Doctor passed. Run ./run.sh to start VerbalCoding.');
} else {
  console.log('Doctor found missing prerequisites. Fix the ✗ items, then rerun npm run doctor.');
  process.exitCode = 1;
}
