#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { buildEnvFile, normalizeInstallAnswers, renderInstallSummary, SUPPORTED_HARNESSES } from '../app-node/install_config.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function ask(question, fallback = '') {
  const rl = globalThis.__rl;
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function main() {
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
    const discordBotToken = await ask('Discord bot token (DISCORD_BOT_TOKEN)', process.env.DISCORD_BOT_TOKEN || '');
    const allowedUsers = await ask('Allowed Discord user IDs, comma-separated', process.env.DISCORD_ALLOWED_USERS || '');
    const autoJoinVoiceChannels = await ask('Auto-join voice channel names', process.env.AUTO_JOIN_VOICE_CHANNELS || '일반,General,general');
    const transcriptChannelId = await ask('Transcript text channel/thread ID', process.env.TRANSCRIPT_CHANNEL_ID || '');
    const ttsVoice = await ask('TTS voice', process.env.TTS_VOICE || 'ko-KR-SunHiNeural');
    const ttsRate = await ask('TTS rate', process.env.TTS_RATE || '+10%');
    const requireWake = (await ask('Require wake word? 1/0', process.env.REQUIRE_WAKE_WORD || '0')) === '1';

    const values = normalizeInstallAnswers({
      harness,
      agentLabel,
      agentCommand,
      discordBotToken,
      allowedUsers,
      autoJoinVoiceChannels,
      transcriptChannelId,
      ttsVoice,
      ttsRate,
      requireWakeWord: requireWake,
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
