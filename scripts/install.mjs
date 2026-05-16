#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { buildEnvFile, normalizeInstallAnswers, renderInstallSummary, SUPPORTED_HARNESSES } from '../app-node/install_config.mjs';
import { detectInstalledAgents, pickDefaultBackend, formatAgentDetectionReport } from '../app-node/agent_detect.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function ask(question, fallback = '', options = {}) {
  const rl = globalThis.__rl;
  const suffixValue = options.fallbackLabel ?? fallback;
  const suffix = suffixValue ? ` [${suffixValue}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
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

function argValue(args, name) {
  const idx = args.indexOf(name);
  if (idx < 0) return '';
  const value = args[idx + 1] || '';
  return value.startsWith('--') ? '' : value;
}

async function configureDiscordToken(args) {
  const envPath = path.join(ROOT, '.env');
  const tokenArg = args.find((arg, idx) => idx > 0 && !arg.startsWith('--')) || argValue(args, '--token');
  const clientIdArg = argValue(args, '--client-id') || argValue(args, '--application-id');
  let token = tokenArg || process.env.DISCORD_BOT_TOKEN || '';
  let clientId = clientIdArg || process.env.DISCORD_CLIENT_ID || '';
  if (!token) {
    globalThis.__rl = readline.createInterface({ input, output });
    try {
      console.log('Discord bot token setup');
      console.log('Create/copy the token at https://discord.com/developers/applications → your app → Bot.');
      token = await ask('Discord bot token (DISCORD_BOT_TOKEN)', '', { fallbackLabel: '' });
      clientId = await ask('Discord application/client ID for invite URL (optional)', clientId, { fallbackLabel: clientId ? 'keep existing' : 'skip' });
    } finally {
      globalThis.__rl.close();
      globalThis.__rl = null;
    }
  }
  if (!token) {
    console.error('No Discord bot token provided. Nothing changed.');
    process.exitCode = 2;
    return;
  }
  const updates = { DISCORD_BOT_TOKEN: token };
  if (clientId) updates.DISCORD_CLIENT_ID = clientId;
  upsertEnvFile(envPath, updates);
  console.log(`Updated ${envPath}`);
  console.log('Discord bot token saved. Run `vc doctor` to verify. You can update it anytime with `vc setup token`.');
  if (clientId) console.log(`Invite URL: vc bot invite ${clientId}`);
}

async function configureAutoJoinChannels(args) {
  const envPath = path.join(ROOT, '.env');
  let channels = args.find((arg, idx) => idx > 0 && !arg.startsWith('--')) || argValue(args, '--channels') || argValue(args, '--voice');
  if (!channels) {
    globalThis.__rl = readline.createInterface({ input, output });
    try {
      console.log('Discord auto-join voice channel setup');
      console.log('Enter one or more voice channel names, comma-separated. Example: General,Team Voice,일반');
      channels = await ask('Auto-join voice channel names', process.env.AUTO_JOIN_VOICE_CHANNELS || 'General,general');
    } finally {
      globalThis.__rl.close();
      globalThis.__rl = null;
    }
  }
  if (!channels) {
    console.error('No voice channel names provided. Nothing changed.');
    process.exitCode = 2;
    return;
  }
  upsertEnvFile(envPath, { AUTO_JOIN_VOICE_CHANNELS: channels });
  console.log(`Updated ${envPath}`);
  console.log(`Auto-join voice channels: ${channels}`);
  console.log('Restart the bridge for this to take effect. You can update it anytime with `vc setup channels`.');
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'token' || args[0] === 'discord' || args[0] === 'bot-token') {
    await configureDiscordToken(args);
    return;
  }
  if (args[0] === 'channels' || args[0] === 'channel' || args[0] === 'voice') {
    await configureAutoJoinChannels(args);
    return;
  }
  const yes = args.includes('--yes') || args.includes('-y');
  if (args[0] === 'instance' || args.includes('--instance')) {
    const { spawnSync } = await import('node:child_process');
    const pass = args[0] === 'instance'
      ? args.slice(1)
      : args.filter(arg => arg !== '--instance');
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'cli.mjs'), 'instance', 'setup', ...pass], { stdio: 'inherit', cwd: ROOT });
    process.exitCode = result.status ?? 1;
    return;
  }
  if (yes) {
    const values = normalizeInstallAnswers(process.env);
    const envPath = path.join(ROOT, '.env');
    if (fs.existsSync(envPath)) {
      const backup = `${envPath}.bak-${Date.now()}`;
      fs.copyFileSync(envPath, backup);
      console.log(`Backed up existing .env to ${backup}`);
    }
    fs.writeFileSync(envPath, buildEnvFile(values), { mode: 0o600 });
    console.log(`Wrote ${envPath}`);
    console.log(renderInstallSummary(values));
    return;
  }
  globalThis.__rl = readline.createInterface({ input, output });
  try {
    console.log('VerbalCoding installer');
    console.log(`Supported harnesses: ${SUPPORTED_HARNESSES.join(', ')}`);
    console.log('Discord setup: keep https://discord.com/developers/applications open.');
    console.log('Create an application/bot, enable Message Content intent, then paste the bot token and application/client ID below.');
    console.log('If you are not ready, press Enter to skip and run `vc setup token` / `vc setup channels` later.');
    let detectionDefault = 'hermes';
    try {
      const detection = await detectInstalledAgents(process.env);
      console.log('');
      console.log(formatAgentDetectionReport(detection));
      detectionDefault = pickDefaultBackend(detection, process.env.AGENT_BACKEND);
      console.log('');
    } catch (e) {
      console.log(`(agent detection skipped: ${e?.message || e})`);
    }
    const harness = await ask('Harness/backend', detectionDefault);
    let agentCommand = '';
    let agentLabel = '';
    if (harness.toLowerCase() === 'custom') {
      agentLabel = await ask('Custom harness label', 'Custom Agent');
      agentCommand = await ask('Custom harness command, prompt appended as final argv', 'my-agent run');
    }
    const existingDiscordBotToken = process.env.DISCORD_BOT_TOKEN || '';
    const discordBotToken = await ask('Discord bot token (DISCORD_BOT_TOKEN)', existingDiscordBotToken, { fallbackLabel: existingDiscordBotToken ? 'keep existing' : '' });
    const discordClientId = await ask('Discord application/client ID for invite URL', process.env.DISCORD_CLIENT_ID || '');
    const allowedUsers = await ask('Allowed Discord user IDs, comma-separated', process.env.DISCORD_ALLOWED_USERS || '');
    const autoJoinVoiceChannels = await ask('Auto-join voice channel names', process.env.AUTO_JOIN_VOICE_CHANNELS || '일반,General,general');
    const transcriptChannelId = await ask('Transcript text channel/thread ID', process.env.TRANSCRIPT_CHANNEL_ID || '');
    const language = await ask('Default voice language: ko/en/auto', process.env.VOICE_LANGUAGE || process.env.WHISPER_CPP_LANGUAGE || process.env.STT_LANGUAGE || 'ko');
    const ttsBackend = await ask('TTS backend: edge/openvoice/speechswift/supertonic/omnivoice/qwen3tts/fireredtts2/mossttsnano', process.env.TTS_BACKEND || 'edge');
    const edgeTtsCommand = await ask('Edge TTS command', process.env.EDGE_TTS_COMMAND || process.env.TTS_EDGE_COMMAND || 'edge-tts');
    const ttsVoice = await ask('TTS voice', process.env.TTS_VOICE || 'ko-KR-SunHiNeural');
    const ttsRate = await ask('TTS rate', process.env.TTS_RATE || '+10%');
    const ttsVolume = await ask('TTS playback volume', process.env.TTS_VOLUME || '1.0');
    const supertonicCommand = await ask('Supertonic command', process.env.SUPERTONIC_COMMAND || 'supertonic');
    const supertonicVoice = await ask('Supertonic voice', process.env.SUPERTONIC_VOICE || 'M1');
    const supertonicLanguage = await ask('Supertonic language', process.env.SUPERTONIC_LANGUAGE || 'ko');
    const supertonicSteps = await ask('Supertonic steps', process.env.SUPERTONIC_STEPS || '2');
    const supertonicSpeed = await ask('Supertonic speed', process.env.SUPERTONIC_SPEED || '1.0');
    const openvoiceDir = await ask('OpenVoice repo dir', process.env.OPENVOICE_DIR || './vendor/OpenVoice');
    const openvoiceVenv = await ask('OpenVoice venv dir', process.env.OPENVOICE_VENV || './.venv-openvoice');
    const openvoiceRefAudio = await ask('OpenVoice reference audio path', process.env.OPENVOICE_REF_AUDIO || './voice-samples/user-reference.wav');
    const omnivoicePython = await ask('OmniVoice Python', process.env.OMNIVOICE_PYTHON || './.venv-omnivoice/bin/python');
    const omnivoiceRefAudio = await ask('OmniVoice reference audio path', process.env.OMNIVOICE_REF_AUDIO || process.env.OPENVOICE_REF_AUDIO || './voice-samples/user-reference.wav');
    const requireWake = (await ask('Require wake word? 1/0', process.env.REQUIRE_WAKE_WORD || '0')) === '1';
    const verboseProgress = (await ask('Verbose progress by default? 1/0', process.env.AGENT_VERBOSE_PROGRESS || process.env.VERBALCODING_VERBOSE_PROGRESS || '0')) === '1';
    const utteranceIdleMs = await ask('Utterance idle wait before STT, ms', process.env.UTTERANCE_IDLE_MS || '4500');
    const latencyLogPath = await ask('Latency JSONL log path', process.env.LATENCY_LOG_PATH || './.logs/latency.jsonl');

    const values = normalizeInstallAnswers({
      harness,
      agentLabel,
      agentCommand,
      discordBotToken,
      discordClientId,
      allowedUsers,
      autoJoinVoiceChannels,
      transcriptChannelId,
      language,
      ttsBackend,
      edgeTtsCommand,
      ttsVoice,
      ttsRate,
      ttsVolume,
      supertonicCommand,
      supertonicVoice,
      supertonicLanguage,
      supertonicSteps,
      supertonicSpeed,
      openvoiceDir,
      openvoiceVenv,
      openvoiceRefAudio,
      omnivoicePython,
      omnivoiceRefAudio,
      requireWakeWord: requireWake,
      verboseProgress,
      utteranceIdleMs,
      latencyLogPath,
    });
    const envPath = path.join(ROOT, '.env');
    if (fs.existsSync(envPath)) {
      const backup = `${envPath}.bak-${Date.now()}`;
      fs.copyFileSync(envPath, backup);
      console.log(`Backed up existing .env to ${backup}`);
    }
    fs.writeFileSync(envPath, buildEnvFile(values), { mode: 0o600 });
    console.log(`Wrote ${envPath}`);
    console.log(renderInstallSummary(values));
  } finally {
    globalThis.__rl.close();
  }
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exit(1);
});
