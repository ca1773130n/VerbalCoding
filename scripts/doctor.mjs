#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseKeyValueEnv } from '../app-node/install_config.mjs';
import { checkInstanceConfigs, formatInstanceDoctor } from '../app-node/instance_doctor.mjs';
import { autoRestartVoiceBotEnabled } from '../app-node/restart_policy.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const autoFixEnabled = !args.includes('--no-fix') && !['0', 'false', 'no', 'off'].includes(String(process.env.VERBALCODING_DOCTOR_AUTO_FIX || '1').toLowerCase());
let autoFixAttempted = false;

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

function quoteEnv(value) {
  return JSON.stringify(String(value ?? ''));
}

function upsertEnvFile(file, updates) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const seen = new Set();
  const lines = existing.split(/\r?\n/).map(raw => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) return raw;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim().replace(/^export\s+/, '');
    if (!(key in updates)) return raw;
    seen.add(key);
    return `${key}=${quoteEnv(updates[key])}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${quoteEnv(value)}`);
  }
  const text = `${lines.filter((line, index, arr) => line !== '' || index < arr.length - 1).join('\n')}\n`;
  fs.writeFileSync(file, text, { mode: 0o600 });
}

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command) {
  const extraPath = [
    path.join(ROOT, '.local', 'bin'),
    path.join(process.env.HOME || '', '.local', 'bin'),
  ].filter(Boolean).join(':');
  const result = spawnSync('bash', ['-lc', `command -v ${JSON.stringify(command)}`], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${extraPath}:${process.env.PATH || ''}` },
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function resolveCommand(command, fallbackPaths = []) {
  const found = commandExists(command);
  if (found) return found;
  for (const candidate of fallbackPaths) {
    if (isExecutable(candidate)) return candidate;
  }
  return '';
}

function check(label, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`);
  return Boolean(ok);
}

function note(label, detail = '') {
  console.log(`• ${label}${detail ? ` — ${detail}` : ''}`);
}

function fixablePrerequisites(env) {
  const ttsBackend = (env.TTS_BACKEND || 'edge').toLowerCase();
  const backend = (env.AGENT_BACKEND || 'hermes').toLowerCase();
  const missing = [];
  if (!commandExists('ffmpeg')) missing.push('ffmpeg');
  if (!resolveCommand(env.WHISPER_CPP_BIN || 'whisper-cli', [path.join(ROOT, '.local', 'bin', 'whisper-cli')])) missing.push('whisper-cli');
  const modelPath = path.resolve(ROOT, env.WHISPER_CPP_MODEL || 'models/ggml-small-q5_1.bin');
  if (!fs.existsSync(modelPath)) missing.push('whisper.cpp model');
  if (ttsBackend === 'edge') {
    const edgeCommand = env.EDGE_TTS_COMMAND || env.TTS_EDGE_COMMAND || 'edge-tts';
    if (!resolveCommand(edgeCommand, [path.join(ROOT, '.venv-tts', 'bin', 'edge-tts')])) missing.push('edge-tts');
  }
  if (backend === 'hermes' && !commandExists('hermes')) missing.push('hermes CLI');
  return missing;
}

function installHermesCliIfNeeded(env) {
  const backend = (env.AGENT_BACKEND || 'hermes').toLowerCase();
  if (backend !== 'hermes' || commandExists('hermes')) return false;
  if (process.platform === 'win32') {
    console.log('Skipping Hermes CLI auto-install: Windows is not supported by VerbalCoding yet.');
    return false;
  }
  if (['0', 'false', 'no', 'off'].includes(String(process.env.VERBALCODING_DOCTOR_INSTALL_HERMES || '1').toLowerCase())) {
    console.log('Skipping Hermes CLI auto-install because VERBALCODING_DOCTOR_INSTALL_HERMES is off.');
    return false;
  }
  if (!commandExists('curl')) {
    console.log('Skipping Hermes CLI auto-install: curl is missing.');
    return false;
  }
  console.log('VerbalCoding doctor: missing hermes CLI; installing Hermes Agent...');
  const result = spawnSync('bash', ['-lc', 'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.log(`Hermes installer exited with status ${result.status}. Continuing with checks.`);
  }
  return true;
}

function discordSetupGuidance(env) {
  const clientId = env.DISCORD_CLIENT_ID || env.APPLICATION_ID || '';
  const lines = [
    'Discord bot setup:',
    '  1. Open https://discord.com/developers/applications and create an application.',
    '  2. Bot tab: Add Bot, enable Message Content Intent, then Reset/Copy Token.',
    `  3. Save it in ${path.join(ROOT, '.env')} as DISCORD_BOT_TOKEN="...".`,
    '  4. OAuth2 tab: copy the Application/Client ID.',
    clientId
      ? `  5. Invite the bot: vc bot invite ${clientId}`
      : '  5. Invite the bot: vc bot invite <client-id>',
    '  6. Give it text channel send/read plus voice connect/speak permissions, then rerun vc doctor.',
  ];
  return lines.join('\n');
}

function persistDiscoveredLocalHelpers(env) {
  const updates = {};
  const localWhisper = path.join(ROOT, '.local', 'bin', 'whisper-cli');
  if (!commandExists(env.WHISPER_CPP_BIN || 'whisper-cli') && isExecutable(localWhisper)) {
    updates.WHISPER_CPP_BIN = localWhisper;
  }
  const ttsBackend = (env.TTS_BACKEND || 'edge').toLowerCase();
  const localEdge = path.join(ROOT, '.venv-tts', 'bin', 'edge-tts');
  const edgeCommand = env.EDGE_TTS_COMMAND || env.TTS_EDGE_COMMAND || 'edge-tts';
  if (ttsBackend === 'edge' && !commandExists(edgeCommand) && isExecutable(localEdge)) {
    updates.EDGE_TTS_COMMAND = localEdge;
  }
  if (Object.keys(updates).length > 0) {
    upsertEnvFile(path.join(ROOT, '.env'), updates);
    return updates;
  }
  return {};
}

let env = mergeEnv();
const missingBeforeFix = fixablePrerequisites(env);
if (autoFixEnabled && missingBeforeFix.length > 0) {
  console.log(`VerbalCoding doctor: missing ${missingBeforeFix.join(', ')}; running automatic prerequisite bootstrap...`);
  const result = spawnSync('bash', [path.join(ROOT, 'scripts', 'bootstrap_prereqs.sh'), '--yes'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VERBALCODING_SKIP_CLI_LINK: process.env.VERBALCODING_SKIP_CLI_LINK || '1' },
  });
  autoFixAttempted = true;
  const persisted = persistDiscoveredLocalHelpers(mergeEnv());
  if (Object.keys(persisted).length > 0) {
    console.log(`Doctor recorded local helper paths in .env: ${Object.keys(persisted).join(', ')}`);
  }
  if (result.status !== 0) {
    console.log(`Doctor bootstrap exited with status ${result.status}. Continuing with checks.`);
  }
  console.log('');
  env = mergeEnv();
}
if (autoFixEnabled) {
  const hermesAttempted = installHermesCliIfNeeded(env);
  if (hermesAttempted) {
    console.log('');
    env = mergeEnv();
  }
}

const backend = (env.AGENT_BACKEND || 'hermes').toLowerCase();
const ttsBackend = (env.TTS_BACKEND || 'edge').toLowerCase();
let ok = true;

console.log('VerbalCoding doctor');
console.log(`Project: ${ROOT}`);
console.log(`Backend: ${backend}`);
console.log(`TTS backend: ${ttsBackend}`);
if (!autoFixEnabled) note('Automatic prerequisite bootstrap', 'off');
if (autoFixAttempted) note('Automatic prerequisite bootstrap', 'attempted');
console.log('');

const nodeCommand = commandExists('node');
const npmCommand = commandExists('npm');
const ffmpegCommand = commandExists('ffmpeg');
const whisperCommand = resolveCommand(env.WHISPER_CPP_BIN || 'whisper-cli', [path.join(ROOT, '.local', 'bin', 'whisper-cli')]);
ok = check('Node.js', nodeCommand, nodeCommand || 'missing') && ok;
ok = check('npm', npmCommand, npmCommand || 'missing') && ok;
ok = check('ffmpeg', ffmpegCommand, ffmpegCommand || 'missing') && ok;
ok = check('whisper-cli', whisperCommand, whisperCommand || 'missing') && ok;

const modelPath = path.resolve(ROOT, env.WHISPER_CPP_MODEL || 'models/ggml-small-q5_1.bin');
ok = check('whisper.cpp model', fs.existsSync(modelPath), path.relative(ROOT, modelPath)) && ok;
ok = check('Discord bot token configured', Boolean(env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN), (env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN) ? '[REDACTED]' : 'missing DISCORD_BOT_TOKEN') && ok;
if (!(env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN)) {
  console.log(discordSetupGuidance(env));
}
note('Allowed users configured', env.DISCORD_ALLOWED_USERS ? '[REDACTED]' : 'not set; bot may accept all users depending on config');
note('Auto-join channels', env.AUTO_JOIN_VOICE_CHANNELS || 'default: 일반,General,general');
note('Verbose progress default', ['1', 'true', 'yes', 'on'].includes(String(env.AGENT_VERBOSE_PROGRESS || env.VERBALCODING_VERBOSE_PROGRESS || '0').toLowerCase()) ? 'on' : 'off');
note('Auto restart voice bot after commits', autoRestartVoiceBotEnabled(env) ? 'on' : 'off');
note('Utterance idle wait before STT', `${env.UTTERANCE_IDLE_MS || '4500'} ms`);
note('STT language', env.WHISPER_CPP_LANGUAGE || env.STT_LANGUAGE || 'ko');
note('Progress/voice language', env.VOICE_LANGUAGE || env.WHISPER_CPP_LANGUAGE || env.STT_LANGUAGE || 'ko');
note('Latency log path', env.LATENCY_LOG_PATH || './.logs/latency.jsonl');
note('TTS voice fallback', env.TTS_VOICE || 'ko-KR-SunHiNeural');

if (!['edge', 'openvoice', 'speechswift', 'supertonic'].includes(ttsBackend)) {
  ok = check('TTS_BACKEND value', false, 'must be edge, openvoice, speechswift, or supertonic') && ok;
}
if (ttsBackend === 'edge') {
  const edgeCommand = env.EDGE_TTS_COMMAND || env.TTS_EDGE_COMMAND || 'edge-tts';
  const edgeFound = resolveCommand(edgeCommand, [path.join(ROOT, '.venv-tts', 'bin', 'edge-tts')]);
  ok = check('edge-tts', edgeFound, edgeFound || 'missing') && ok;
} else if (ttsBackend === 'openvoice') {
  ok = check('Python for OpenVoice', commandExists('python3'), commandExists('python3') || 'missing') && ok;
  const openvoiceDir = path.resolve(ROOT, env.OPENVOICE_DIR || './vendor/OpenVoice');
  const openvoiceVenv = path.resolve(ROOT, env.OPENVOICE_VENV || './.venv-openvoice');
  const refAudio = path.resolve(ROOT, env.OPENVOICE_REF_AUDIO || './voice-samples/user-reference.wav');
  ok = check('OpenVoice repo', fs.existsSync(openvoiceDir), path.relative(ROOT, openvoiceDir)) && ok;
  ok = check('OpenVoice venv', fs.existsSync(openvoiceVenv), path.relative(ROOT, openvoiceVenv)) && ok;
  ok = check('OpenVoice reference audio', fs.existsSync(refAudio), path.relative(ROOT, refAudio)) && ok;
  ok = check('OpenVoice synth wrapper help', spawnSync('python3', ['integrations/openvoice/synth.py', '--help'], { cwd: ROOT, encoding: 'utf8' }).status === 0, 'integrations/openvoice/synth.py') && ok;
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
console.log('Instance checks');
const instanceResult = checkInstanceConfigs(ROOT);
for (const line of formatInstanceDoctor(instanceResult)) {
  console.log(line);
}
ok = instanceResult.errors.length === 0 && ok;

console.log('');
if (ok) {
  console.log('Doctor passed. Run vc start to start VerbalCoding.');
} else {
  const suffix = autoFixEnabled ? 'Fix the remaining ✗ items, then rerun vc doctor.' : 'Fix the ✗ items, then rerun vc doctor.';
  console.log(`Doctor found missing prerequisites. ${suffix}`);
  process.exitCode = 1;
}
