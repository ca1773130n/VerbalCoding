import { languagePreset, normalizeLanguageKey } from './language_config.mjs';

export const SUPPORTED_HARNESSES = [
  'hermes',
  'claude-code',
  'claude',
  'codex',
  'gemini',
  'opencode',
  'openclaw',
  'custom',
];

export const DEFAULT_DISCORD_BOT_PERMISSIONS = 277028604928;

function clean(value, fallback = '') {
  const v = value == null ? '' : String(value).trim();
  return v || fallback;
}

export function normalizeInstallAnswers(input = {}) {
  const harness = clean(input.harness || input.AGENT_BACKEND, 'hermes').toLowerCase();
  const normalizedHarness = SUPPORTED_HARNESSES.includes(harness) ? harness : 'custom';
  const language = normalizeLanguageKey(input.language || input.VOICE_LANGUAGE || input.WHISPER_CPP_LANGUAGE || input.STT_LANGUAGE || 'ko');
  const preset = languagePreset(language);
  const out = {
    AGENT_BACKEND: normalizedHarness,
    DISCORD_BOT_TOKEN: clean(input.discordBotToken || input.DISCORD_BOT_TOKEN),
    DISCORD_CLIENT_ID: clean(input.discordClientId || input.DISCORD_CLIENT_ID || input.applicationId || input.APPLICATION_ID),
    DISCORD_ALLOWED_USERS: clean(input.allowedUsers || input.DISCORD_ALLOWED_USERS),
    AUTO_JOIN_VOICE_CHANNELS: clean(input.autoJoinVoiceChannels || input.AUTO_JOIN_VOICE_CHANNELS, '일반,General,general'),
    TRANSCRIPT_CHANNEL_ID: clean(input.transcriptChannelId || input.TRANSCRIPT_CHANNEL_ID),
    TTS_BACKEND: ['edge', 'openvoice', 'speechswift', 'supertonic'].includes(clean(input.ttsBackend || input.TTS_BACKEND, 'edge').toLowerCase())
      ? clean(input.ttsBackend || input.TTS_BACKEND, 'edge').toLowerCase()
      : 'edge',
    EDGE_TTS_COMMAND: clean(input.edgeTtsCommand || input.EDGE_TTS_COMMAND || input.TTS_EDGE_COMMAND, 'edge-tts'),
    VOICE_LANGUAGE: clean(input.voiceLanguage || input.VOICE_LANGUAGE, preset.voiceLanguage),
    WHISPER_CPP_LANGUAGE: clean(input.whisperLanguage || input.WHISPER_CPP_LANGUAGE || input.STT_LANGUAGE, preset.sttLanguage),
    STT_LANGUAGE: clean(input.sttLanguage || input.STT_LANGUAGE || input.WHISPER_CPP_LANGUAGE, preset.sttLanguage),
    TTS_VOICE: clean(input.ttsVoice || input.TTS_VOICE, preset.ttsVoice),
    TTS_RATE: clean(input.ttsRate || input.TTS_RATE, '+10%'),
    TTS_MAX_CHARS: clean(input.ttsMaxChars || input.TTS_MAX_CHARS, '495'),
    TTS_VOLUME: clean(input.ttsVolume || input.TTS_VOLUME, '1.0'),
    SUPERTONIC_COMMAND: clean(input.supertonicCommand || input.SUPERTONIC_COMMAND, 'supertonic'),
    SUPERTONIC_VOICE: clean(input.supertonicVoice || input.SUPERTONIC_VOICE, 'M1'),
    SUPERTONIC_LANGUAGE: clean(input.supertonicLanguage || input.SUPERTONIC_LANGUAGE, 'ko'),
    SUPERTONIC_STEPS: clean(input.supertonicSteps || input.SUPERTONIC_STEPS, '2'),
    SUPERTONIC_SPEED: clean(input.supertonicSpeed || input.SUPERTONIC_SPEED, '1.0'),
    SUPERTONIC_MAX_CHUNK_LENGTH: clean(input.supertonicMaxChunkLength || input.SUPERTONIC_MAX_CHUNK_LENGTH, '300'),
    SUPERTONIC_SILENCE_DURATION: clean(input.supertonicSilenceDuration || input.SUPERTONIC_SILENCE_DURATION, '0.15'),
    SUPERTONIC_PROGRESS: input.supertonicProgress === true || input.SUPERTONIC_PROGRESS === '1' ? '1' : '0',
    OPENVOICE_DIR: clean(input.openvoiceDir || input.OPENVOICE_DIR, './vendor/OpenVoice'),
    OPENVOICE_VENV: clean(input.openvoiceVenv || input.OPENVOICE_VENV, './.venv-openvoice'),
    OPENVOICE_REF_AUDIO: clean(input.openvoiceRefAudio || input.OPENVOICE_REF_AUDIO, './voice-samples/user-reference.wav'),
    OPENVOICE_LANGUAGE: clean(input.openvoiceLanguage || input.OPENVOICE_LANGUAGE, 'KR'),
    OPENVOICE_STYLE: clean(input.openvoiceStyle || input.OPENVOICE_STYLE, 'default'),
    OPENVOICE_TIMEOUT_MS: clean(input.openvoiceTimeoutMs || input.OPENVOICE_TIMEOUT_MS, '90000'),
    OPENVOICE_PROGRESS: input.openvoiceProgress === true || input.OPENVOICE_PROGRESS === '1' ? '1' : '0',
    REQUIRE_WAKE_WORD: input.requireWakeWord === true || input.REQUIRE_WAKE_WORD === '1' ? '1' : '0',
    MIN_UTTERANCE_SECONDS: clean(input.minUtteranceSeconds || input.MIN_UTTERANCE_SECONDS, '1.0'),
    UTTERANCE_IDLE_MS: clean(input.utteranceIdleMs || input.UTTERANCE_IDLE_MS, '4500'),
    HERMES_TASK_TIMEOUT_MS: clean(input.taskTimeoutMs || input.HERMES_TASK_TIMEOUT_MS, '0'),
    HERMES_CHAT_TIMEOUT_MS: clean(input.chatTimeoutMs || input.HERMES_CHAT_TIMEOUT_MS, '45000'),
    AGENT_VERBOSE_PROGRESS: input.verboseProgress === true || input.AGENT_VERBOSE_PROGRESS === '1' ? '1' : '0',
    LATENCY_LOG_PATH: clean(input.latencyLogPath || input.LATENCY_LOG_PATH, './.logs/latency.jsonl'),
  };
  if (input.agentLabel || input.AGENT_LABEL) out.AGENT_LABEL = clean(input.agentLabel || input.AGENT_LABEL);
  if (input.agentCommand || input.AGENT_COMMAND) out.AGENT_COMMAND = clean(input.agentCommand || input.AGENT_COMMAND);
  return out;
}

function quoteEnv(value) {
  return JSON.stringify(String(value ?? ''));
}

export function buildDiscordBotInviteUrl(input = {}) {
  const clientId = clean(input.clientId || input.DISCORD_CLIENT_ID || input.applicationId || input.APPLICATION_ID);
  if (!clientId) throw new Error('Discord application/client ID is required.');
  if (!/^\d{15,25}$/.test(clientId)) throw new Error('Discord application/client ID must be a numeric snowflake.');
  const permissions = clean(input.permissions || input.DISCORD_BOT_PERMISSIONS, String(DEFAULT_DISCORD_BOT_PERMISSIONS));
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('permissions', permissions);
  url.searchParams.set('scope', 'bot applications.commands');
  const guildId = clean(input.guildId || input.DISCORD_GUILD_ID);
  if (guildId) {
    url.searchParams.set('guild_id', guildId);
    url.searchParams.set('disable_guild_select', 'true');
  }
  return url.toString();
}

export function slugifyInstanceName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_.-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'default';
}

export function buildEnvFile(values = {}) {
  const ordered = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_ALLOWED_USERS',
    'AUTO_JOIN_VOICE_CHANNELS',
    'TRANSCRIPT_CHANNEL_ID',
    'AGENT_BACKEND',
    'AGENT_LABEL',
    'AGENT_COMMAND',
    'VOICE_LANGUAGE',
    'WHISPER_CPP_LANGUAGE',
    'STT_LANGUAGE',
    'TTS_BACKEND',
    'EDGE_TTS_COMMAND',
    'TTS_VOICE',
    'TTS_RATE',
    'TTS_MAX_CHARS',
    'TTS_VOLUME',
    'SUPERTONIC_COMMAND',
    'SUPERTONIC_VOICE',
    'SUPERTONIC_LANGUAGE',
    'SUPERTONIC_STEPS',
    'SUPERTONIC_SPEED',
    'SUPERTONIC_MAX_CHUNK_LENGTH',
    'SUPERTONIC_SILENCE_DURATION',
    'SUPERTONIC_PROGRESS',
    'OPENVOICE_DIR',
    'OPENVOICE_VENV',
    'OPENVOICE_REF_AUDIO',
    'OPENVOICE_LANGUAGE',
    'OPENVOICE_STYLE',
    'OPENVOICE_TIMEOUT_MS',
    'OPENVOICE_PROGRESS',
    'REQUIRE_WAKE_WORD',
    'MIN_UTTERANCE_SECONDS',
    'UTTERANCE_IDLE_MS',
    'HERMES_TASK_TIMEOUT_MS',
    'HERMES_CHAT_TIMEOUT_MS',
    'AGENT_VERBOSE_PROGRESS',
    'LATENCY_LOG_PATH',
  ];
  const lines = [
    '# Generated by VerbalCoding installer.',
    '# Secrets stay local; do not commit this file.',
  ];
  for (const key of ordered) {
    if (values[key] == null || values[key] === '') continue;
    lines.push(`${key}=${quoteEnv(values[key])}`);
  }
  return `${lines.join('\n')}\n`;
}

export function normalizeInstanceAnswers(input = {}) {
  const instanceNameRaw = clean(input.instanceName || input.INSTANCE_NAME, 'example');
  const instanceName = slugifyInstanceName(instanceNameRaw);
  const displayName = clean(input.displayName || input.agentLabel || input.AGENT_LABEL, instanceNameRaw);
  const workdir = clean(input.workdir || input.AGENT_CWD || input.AGENT_WORKDIR, '');
  const projectContext = clean(input.projectContext || input.AGENT_PROJECT_CONTEXT, `Project session: ${displayName}`);
  const out = {
    INSTANCE_NAME: instanceName,
    DISCORD_TOKEN: clean(input.discordBotToken || input.DISCORD_TOKEN || input.DISCORD_BOT_TOKEN),
    DISCORD_CLIENT_ID: clean(input.discordClientId || input.DISCORD_CLIENT_ID || input.applicationId || input.APPLICATION_ID),
    DISCORD_ALLOWED_USERS: clean(input.allowedUsers || input.DISCORD_ALLOWED_USERS),
    AUTO_JOIN_VOICE_CHANNELS: clean(input.autoJoinVoiceChannels || input.AUTO_JOIN_VOICE_CHANNELS, displayName),
    TRANSCRIPT_CHANNEL_ID: clean(input.transcriptChannelId || input.TRANSCRIPT_CHANNEL_ID),
    PROJECT_SESSIONS_FILE: clean(input.projectSessionsFile || input.PROJECT_SESSIONS_FILE, `config/project-sessions.${instanceName}.json`),
    BRIDGE_LOG_PATH: clean(input.bridgeLogPath || input.BRIDGE_LOG_PATH, `/tmp/verbalcoding-${instanceName}.log`),
    NODE_AUDIO_DEBUG_DIR: clean(input.nodeAudioDebugDir || input.NODE_AUDIO_DEBUG_DIR, `/tmp/verbalcoding-${instanceName}-debug`),
    HERMES_SESSION_FILE: clean(input.hermesSessionFile || input.HERMES_SESSION_FILE, `.agent-sessions/hermes/${instanceName}.session`),
    HERMES_HOME: clean(input.hermesHome || input.HERMES_HOME),
    AGENT_LABEL: clean(input.agentLabel || input.AGENT_LABEL, `Hermes Agent · ${displayName}`),
    AGENT_CWD: workdir,
    AGENT_PROJECT_CONTEXT: projectContext,
  };
  return out;
}

export function buildInstanceEnvFile(values = {}) {
  const ordered = [
    'INSTANCE_NAME',
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_ALLOWED_USERS',
    'AUTO_JOIN_VOICE_CHANNELS',
    'TRANSCRIPT_CHANNEL_ID',
    'PROJECT_SESSIONS_FILE',
    'BRIDGE_LOG_PATH',
    'NODE_AUDIO_DEBUG_DIR',
    'HERMES_SESSION_FILE',
    'HERMES_HOME',
    'AGENT_LABEL',
    'AGENT_CWD',
    'AGENT_PROJECT_CONTEXT',
  ];
  const lines = [
    '# Generated by `verbalcoding instance setup`.',
    '# Secrets stay local; do not commit this file.',
  ];
  for (const key of ordered) {
    if (values[key] == null || values[key] === '') continue;
    lines.push(`${key}=${quoteEnv(values[key])}`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderInstanceSetupSummary(values = {}) {
  const name = values.INSTANCE_NAME || 'example';
  const inviteUrl = values.DISCORD_CLIENT_ID ? buildDiscordBotInviteUrl({ clientId: values.DISCORD_CLIENT_ID }) : '';
  return [
    `Configured VerbalCoding instance: ${name}`,
    `Env file: instances/${name}.env`,
    ...(inviteUrl ? ['', 'Discord bot invite URL:', `  ${inviteUrl}`] : ['', 'Discord bot invite URL: run `vc bot invite <client-id>` after creating the Discord application.']),
    '',
    'Next commands:',
    '  vc doctor',
    `  vc instance start ${name}`,
    `  vc instance status ${name}`,
    '',
    `Voice channel: ${values.AUTO_JOIN_VOICE_CHANNELS || '(not set)'}`,
    `Transcript target: ${values.TRANSCRIPT_CHANNEL_ID || '(not set)'}`,
    `Log: ${values.BRIDGE_LOG_PATH || `/tmp/verbalcoding-${name}.log`}`,
  ].join('\n');
}

export function parseKeyValueEnv(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim().replace(/^export\s+/, '');
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    try {
      if (line.slice(idx + 1).trim().startsWith('"')) value = JSON.parse(line.slice(idx + 1).trim());
    } catch {}
    out[key] = value;
  }
  return out;
}

export function renderInstallSummary(values = {}) {
  const backend = values.AGENT_BACKEND || 'hermes';
  const inviteUrl = values.DISCORD_CLIENT_ID ? buildDiscordBotInviteUrl({ clientId: values.DISCORD_CLIENT_ID }) : '';
  return [
    `Configured Discord voice bridge for harness: ${backend}`,
    '',
    'Discord app setup:',
    '  1. Create an app: https://discord.com/developers/applications',
    '  2. Bot tab: Add Bot, enable Message Content Intent, copy/reset the token.',
    '  3. Put the token in .env as DISCORD_BOT_TOKEN="...".',
    inviteUrl ? `  4. Invite URL: ${inviteUrl}` : '  4. Invite URL: vc bot invite <client-id>',
    '  5. Make sure the bot can read/send text and connect/speak in voice.',
    '',
    'Next commands:',
    '  vc doctor',
    '  vc start',
    '',
    'Legacy project-local equivalents still work:',
    '  npm install',
    '  ./scripts/install.sh',
    '  npm run doctor',
    '  ./run.sh',
    '',
    `Auto-join voice channels: ${values.AUTO_JOIN_VOICE_CHANNELS || '일반,General,general'}`,
    `TTS backend: ${values.TTS_BACKEND || 'edge'}`,
    `Verbose progress: ${values.AGENT_VERBOSE_PROGRESS === '1' ? 'on' : 'off'} (toggle later with !verbose on/off)`,
    'Use !ask <text>, !session, !reset-session, !join, !leave, !verbose, !voice-test, and !sensitivity in Discord.',
  ].join('\n');
}
