#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyLanguagePreset, languageStatus, normalizeLanguageKey } from '../app-node/language_config.mjs';
import {
  buildInstanceEnvFile,
  buildDiscordBotInviteUrl,
  normalizeInstanceAnswers,
  parseKeyValueEnv,
  renderInstanceSetupSummary,
} from '../app-node/install_config.mjs';
import { ensureHermesProfile, validateProfileName } from '../app-node/hermes_profiles.mjs';
import { checkInstanceConfigs } from '../app-node/instance_doctor.mjs';
import {
  listInstanceStatuses,
  resolveInstanceEnvPath,
  startInstance,
  statusForInstance,
  stopInstance,
} from '../app-node/instances.mjs';
import { AUTO_RESTART_ENV_KEY, autoRestartStatusText, normalizeAutoRestartCommand } from '../app-node/restart_policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');

function usage() {
  return `VerbalCoding CLI

Usage:
  vc status
  vc language <ko|en|auto>
  vc language status
  vc restart auto <on|off|status>
  vc bot invite <client-id> [--guild <guild-id>]
  vc instance list
  vc instance setup [name] [--start]
  vc instance status [name]
  vc instance start <name>
  vc instance stop <name>
  vc instance restart <name>
  vc doctor

Examples:
  vc language en
  vc language ko
  vc language auto
  vc restart auto off
  vc bot invite 123456789012345678
`;
}

function readEnvFile(file = ENV_PATH) {
  if (!fs.existsSync(file)) return {};
  return parseKeyValueEnv(fs.readFileSync(file, 'utf8'));
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

function printLanguageStatus(values) {
  const s = languageStatus(values);
  console.log(`STT language: ${s.sttLanguage}`);
  console.log(`Progress/voice language: ${s.voiceLanguage}`);
  console.log(`TTS voice: ${s.ttsVoice}`);
}

function printInstanceStatus(statuses) {
  if (statuses.length === 0) {
    console.log('No instance env files found in instances/*.env');
    return;
  }
  for (const status of statuses) {
    const pid = status.pid ?? '-';
    console.log(`${status.name.padEnd(16)} ${status.status.padEnd(8)} pid=${pid} log=${status.logPath}`);
  }
}

function assertInstanceStartIsSafe() {
  const result = checkInstanceConfigs(ROOT);
  if (result.errors.length > 0) {
    throw new Error(`Refusing to start instance because instance configuration checks failed: ${result.errors.join('; ')}`);
  }
}

async function askQuestion(rl, question, fallback = '', options = {}) {
  const suffixValue = options.fallbackLabel ?? fallback;
  const suffix = suffixValue ? ` [${suffixValue}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function setupInstance(argv) {
  const { default: readline } = await import('node:readline/promises');
  const { stdin: input, stdout: output } = await import('node:process');
  const startAfter = argv.includes('--start');
  const nonFlagArgs = argv.slice(2).filter(arg => !arg.startsWith('--'));
  const shared = readEnvFile();
  const initialName = nonFlagArgs[0] || '';
  const rl = readline.createInterface({ input, output });
  try {
    console.log('VerbalCoding instance setup');
    console.log('This creates or updates instances/<name>.env; no manual editing is required.');
    const instanceName = await askQuestion(rl, 'Instance name', initialName || 'llm-wiki');
    const preview = normalizeInstanceAnswers({ instanceName });
    const instancePath = path.join(ROOT, 'instances', `${preview.INSTANCE_NAME}.env`);
    const existing = readEnvFile(instancePath);
    const defaults = { ...shared, ...existing };
    const existingToken = defaults.DISCORD_TOKEN || defaults.DISCORD_BOT_TOKEN || '';
    const values = normalizeInstanceAnswers({
      instanceName,
      discordBotToken: await askQuestion(rl, 'Discord bot token for this bot', existingToken, { fallbackLabel: existingToken ? 'keep existing' : '' }),
      discordClientId: await askQuestion(rl, 'Discord application/client ID for invite URL', defaults.DISCORD_CLIENT_ID || ''),
      allowedUsers: await askQuestion(rl, 'Allowed Discord user IDs, comma-separated', defaults.DISCORD_ALLOWED_USERS || shared.DISCORD_ALLOWED_USERS || ''),
      autoJoinVoiceChannels: await askQuestion(rl, 'Voice channel for this instance', defaults.AUTO_JOIN_VOICE_CHANNELS || instanceName),
      transcriptChannelId: await askQuestion(rl, 'Transcript text channel/thread ID', defaults.TRANSCRIPT_CHANNEL_ID || ''),
      workdir: await askQuestion(rl, 'Project working directory', defaults.AGENT_CWD || defaults.AGENT_WORKDIR || shared.AGENT_CWD || shared.AGENT_WORKDIR || ROOT),
      projectContext: await askQuestion(rl, 'Project context prompt', defaults.AGENT_PROJECT_CONTEXT || `Project session: ${instanceName}`),
      projectSessionsFile: await askQuestion(rl, 'Project sessions file', defaults.PROJECT_SESSIONS_FILE || `config/project-sessions.${preview.INSTANCE_NAME}.json`),
      bridgeLogPath: await askQuestion(rl, 'Bridge log path', defaults.BRIDGE_LOG_PATH || `/tmp/verbalcoding-${preview.INSTANCE_NAME}.log`),
      nodeAudioDebugDir: await askQuestion(rl, 'Audio debug directory', defaults.NODE_AUDIO_DEBUG_DIR || `/tmp/verbalcoding-${preview.INSTANCE_NAME}-debug`),
      hermesSessionFile: await askQuestion(rl, 'Hermes session file', defaults.HERMES_SESSION_FILE || `.agent-sessions/hermes/${preview.INSTANCE_NAME}.session`),
      agentLabel: await askQuestion(rl, 'Agent label', defaults.AGENT_LABEL || `Hermes Agent · ${instanceName}`),
    });
    try {
      validateProfileName(values.INSTANCE_NAME);
    } catch (err) {
      console.error(`Instance name ${JSON.stringify(values.INSTANCE_NAME)} cannot be used as a Hermes profile name.`);
      console.error('Pick a name matching ^[a-z0-9][a-z0-9_-]{0,63}$ (e.g. llm-wiki, acme).');
      process.exitCode = 2;
      return;
    }

    let profileResult;
    try {
      profileResult = await ensureHermesProfile({
        name: values.INSTANCE_NAME,
        workdir: values.AGENT_CWD || ROOT,
        projectContext: values.AGENT_PROJECT_CONTEXT || '',
      });
    } catch (err) {
      console.error(`Hermes profile setup failed: ${err.message}`);
      process.exitCode = 2;
      return;
    }
    values.HERMES_HOME = profileResult.dir;
    for (const w of profileResult.warnings || []) console.warn(`warning: ${w}`);
    console.log(`Hermes profile: ${profileResult.name} at ${profileResult.dir} (${profileResult.created ? 'created' : 'reused'})`);
    fs.mkdirSync(path.dirname(instancePath), { recursive: true });
    if (fs.existsSync(instancePath)) {
      const backup = `${instancePath}.bak-${Date.now()}`;
      fs.copyFileSync(instancePath, backup);
      console.log(`Backed up existing instance env to ${backup}`);
    }
    fs.writeFileSync(instancePath, buildInstanceEnvFile(values), { mode: 0o600 });
    console.log(`Wrote ${instancePath}`);
    console.log(renderInstanceSetupSummary(values));
    if (startAfter) {
      assertInstanceStartIsSafe();
      const status = startInstance(ROOT, values.INSTANCE_NAME);
      console.log(`Started ${status.name} pid=${status.pid}`);
      console.log(`Log: ${status.logPath}`);
    }
  } finally {
    rl.close();
  }
}

function handleBotCommand(argv) {
  const action = argv[1] || 'invite';
  if (action !== 'invite') {
    console.error(`Unknown bot command: ${action}`);
    console.error('Use: vc bot invite <client-id> [--guild <guild-id>]');
    process.exitCode = 2;
    return;
  }
  const clientId = argv[2];
  const guildIndex = argv.indexOf('--guild');
  const guildId = guildIndex >= 0 ? argv[guildIndex + 1] : '';
  if (!clientId || clientId.startsWith('--')) {
    console.error('Use: vc bot invite <client-id> [--guild <guild-id>]');
    process.exitCode = 2;
    return;
  }
  console.log('Discord bot invite URL:');
  console.log(buildDiscordBotInviteUrl({ clientId, guildId }));
}

async function handleInstanceCommand(argv) {
  const action = argv[1] || 'status';
  const name = argv[2];
  if (action === 'list' || (action === 'status' && !name)) {
    printInstanceStatus(listInstanceStatuses(ROOT));
    return;
  }
  if (action === 'setup' || action === 'configure') {
    await setupInstance(argv);
    return;
  }
  if (action === 'status') {
    const envPath = resolveInstanceEnvPath(ROOT, name);
    printInstanceStatus([statusForInstance(ROOT, envPath)]);
    return;
  }
  if (action === 'start') {
    if (!name) throw new Error('Use: verbalcoding instance start <name>');
    assertInstanceStartIsSafe();
    const status = startInstance(ROOT, name);
    console.log(`Started ${status.name} pid=${status.pid}`);
    console.log(`Log: ${status.logPath}`);
    return;
  }
  if (action === 'stop') {
    if (!name) throw new Error('Use: verbalcoding instance stop <name>');
    const result = await stopInstance(ROOT, name);
    const suffix = result.alreadyStopped ? 'already stopped' : (result.killed ? 'stopped with SIGKILL fallback' : 'stopped');
    console.log(`${result.name} ${suffix}`);
    return;
  }
  if (action === 'restart') {
    if (!name) throw new Error('Use: verbalcoding instance restart <name>');
    assertInstanceStartIsSafe();
    await stopInstance(ROOT, name);
    const status = startInstance(ROOT, name);
    console.log(`Restarted ${status.name} pid=${status.pid}`);
    console.log(`Log: ${status.logPath}`);
    return;
  }
  console.error(`Unknown instance command: ${action}`);
  console.error('Use: verbalcoding instance <list|setup|status|start|stop|restart> [name]');
  process.exitCode = 2;
}

async function main(argv = process.argv.slice(2)) {
  const [command, subcommand] = argv;
  if (!command || ['help', '-h', '--help'].includes(command)) {
    console.log(usage());
    return;
  }
  if (command === 'doctor') {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { stdio: 'inherit', cwd: ROOT });
    process.exitCode = result.status ?? 1;
    return;
  }
  if (command === 'status') {
    printLanguageStatus(readEnvFile());
    console.log(autoRestartStatusText(readEnvFile()));
    return;
  }
  if (command === 'instance') {
    await handleInstanceCommand(argv);
    return;
  }
  if (command === 'bot') {
    handleBotCommand(argv);
    return;
  }
  if (command === 'restart') {
    if (subcommand !== 'auto') {
      console.error('Use: verbalcoding restart auto <on|off|status>');
      process.exitCode = 2;
      return;
    }
    const value = argv[2] || 'status';
    if (value === 'status') {
      console.log(autoRestartStatusText(readEnvFile()));
      return;
    }
    const normalized = normalizeAutoRestartCommand(value);
    if (normalized === null) {
      console.error(`Unknown auto restart setting: ${value}`);
      console.error('Use on, off, or status.');
      process.exitCode = 2;
      return;
    }
    upsertEnvFile(ENV_PATH, { [AUTO_RESTART_ENV_KEY]: normalized });
    console.log(`Updated ${ENV_PATH}`);
    console.log(autoRestartStatusText({ [AUTO_RESTART_ENV_KEY]: normalized }));
    return;
  }
  if (command === 'language') {
    if (!subcommand || subcommand === 'status') {
      printLanguageStatus(readEnvFile());
      return;
    }
    const key = normalizeLanguageKey(subcommand, '');
    if (!key) {
      console.error(`Unknown language: ${subcommand}`);
      console.error('Use ko, en, or auto.');
      process.exitCode = 2;
      return;
    }
    const current = readEnvFile();
    const next = applyLanguagePreset(current, key);
    upsertEnvFile(ENV_PATH, {
      VOICE_LANGUAGE: next.VOICE_LANGUAGE,
      WHISPER_CPP_LANGUAGE: next.WHISPER_CPP_LANGUAGE,
      STT_LANGUAGE: next.STT_LANGUAGE,
      TTS_BACKEND: next.TTS_BACKEND,
      TTS_VOICE: next.TTS_VOICE,
    });
    console.log(`Updated ${ENV_PATH}`);
    printLanguageStatus(next);
    console.log('Restart the bridge for this to take effect.');
    return;
  }
  console.error(`Unknown command: ${command}`);
  console.error(usage());
  process.exitCode = 2;
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exit(1);
});
