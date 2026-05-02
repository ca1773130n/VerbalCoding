#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { buildEnvFile, normalizeInstallAnswers, renderInstallSummary, SUPPORTED_HARNESSES } from '../app-node/install_config.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function ask(question, fallback = '', options = {}) {
  const rl = globalThis.__rl;
  const suffixValue = options.fallbackLabel ?? fallback;
  const suffix = suffixValue ? ` [${suffixValue}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'instance' || args.includes('--instance')) {
    const { spawnSync } = await import('node:child_process');
    const pass = args[0] === 'instance'
      ? args.slice(1)
      : args.filter(arg => arg !== '--instance');
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'cli.mjs'), 'instance', 'setup', ...pass], { stdio: 'inherit', cwd: ROOT });
    process.exitCode = result.status ?? 1;
    return;
  }
  globalThis.__rl = readline.createInterface({ input, output });
  try {
    console.log('VerbalCoding installer');
    console.log(`Supported harnesses: ${SUPPORTED_HARNESSES.join(', ')}`);
    const harness = await ask('Harness/backend', 'hermes');
    let agentCommand = '';
    let agentLabel = '';
    if (harness.toLowerCase() === 'custom') {
      agentLabel = await ask('Custom harness label', 'Custom Agent');
      agentCommand = await ask('Custom harness command, prompt appended as final argv', 'my-agent run');
    }
    const existingDiscordBotToken = process.env.DISCORD_BOT_TOKEN || '';
    const discordBotToken = await ask('Discord bot token (DISCORD_BOT_TOKEN)', existingDiscordBotToken, { fallbackLabel: existingDiscordBotToken ? 'keep existing' : '' });
    const allowedUsers = await ask('Allowed Discord user IDs, comma-separated', process.env.DISCORD_ALLOWED_USERS || '');
    const autoJoinVoiceChannels = await ask('Auto-join voice channel names', process.env.AUTO_JOIN_VOICE_CHANNELS || '일반,General,general');
    const transcriptChannelId = await ask('Transcript text channel/thread ID', process.env.TRANSCRIPT_CHANNEL_ID || '');
    const language = await ask('Default voice language: ko/en/auto', process.env.VOICE_LANGUAGE || process.env.WHISPER_CPP_LANGUAGE || process.env.STT_LANGUAGE || 'ko');
    const ttsBackend = await ask('TTS backend: edge/openvoice/speechswift/supertonic', process.env.TTS_BACKEND || 'edge');
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
    const requireWake = (await ask('Require wake word? 1/0', process.env.REQUIRE_WAKE_WORD || '0')) === '1';
    const verboseProgress = (await ask('Verbose progress by default? 1/0', process.env.AGENT_VERBOSE_PROGRESS || process.env.VERBALCODING_VERBOSE_PROGRESS || '0')) === '1';
    const utteranceIdleMs = await ask('Utterance idle wait before STT, ms', process.env.UTTERANCE_IDLE_MS || '2000');
    const latencyLogPath = await ask('Latency JSONL log path', process.env.LATENCY_LOG_PATH || './.logs/latency.jsonl');

    const values = normalizeInstallAnswers({
      harness,
      agentLabel,
      agentCommand,
      discordBotToken,
      allowedUsers,
      autoJoinVoiceChannels,
      transcriptChannelId,
      language,
      ttsBackend,
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
