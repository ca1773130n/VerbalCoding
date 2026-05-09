import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DISCORD_BOT_PERMISSIONS,
  buildDiscordBotInviteUrl,
  buildEnvFile,
  buildInstanceEnvFile,
  normalizeInstallAnswers,
  normalizeInstanceAnswers,
  parseKeyValueEnv,
  renderInstallSummary,
  renderInstanceSetupSummary,
} from './install_config.mjs';

test('buildDiscordBotInviteUrl creates bot invite with voice and text permissions', () => {
  const url = buildDiscordBotInviteUrl({ clientId: '123456789012345678' });
  const parsed = new URL(url);

  assert.equal(parsed.origin, 'https://discord.com');
  assert.equal(parsed.pathname, '/oauth2/authorize');
  assert.equal(parsed.searchParams.get('client_id'), '123456789012345678');
  assert.equal(parsed.searchParams.get('scope'), 'bot applications.commands');
  assert.equal(parsed.searchParams.get('permissions'), String(DEFAULT_DISCORD_BOT_PERMISSIONS));
});

test('buildDiscordBotInviteUrl can pin a guild and disables guild selection', () => {
  const url = buildDiscordBotInviteUrl({ clientId: '123456789012345678', guildId: '987654321098765432' });
  const parsed = new URL(url);

  assert.equal(parsed.searchParams.get('guild_id'), '987654321098765432');
  assert.equal(parsed.searchParams.get('disable_guild_select'), 'true');
});

test('normalizeInstallAnswers maps supported harnesses to backend env', () => {
  const answers = normalizeInstallAnswers({
    harness: 'opencode',
    discordBotToken: 'token-123',
    allowedUsers: '111,222',
    autoJoinVoiceChannels: '일반,General',
    transcriptChannelId: '333',
    language: 'en',
    ttsVoice: '',
    ttsRate: '',
    requireWakeWord: false,
  });

  assert.equal(answers.AGENT_BACKEND, 'opencode');
  assert.equal(answers.DISCORD_BOT_TOKEN, 'token-123');
  assert.equal(answers.DISCORD_ALLOWED_USERS, '111,222');
  assert.equal(answers.AUTO_JOIN_VOICE_CHANNELS, '일반,General');
  assert.equal(answers.TRANSCRIPT_CHANNEL_ID, '333');
  assert.equal(answers.TTS_BACKEND, 'edge');
  assert.equal(answers.EDGE_TTS_COMMAND, 'edge-tts');
  assert.equal(answers.VOICE_LANGUAGE, 'en');
  assert.equal(answers.WHISPER_CPP_LANGUAGE, 'en');
  assert.equal(answers.STT_LANGUAGE, 'en');
  assert.equal(answers.TTS_VOICE, 'en-US-GuyNeural');
  assert.equal(answers.TTS_RATE, '+10%');
  assert.equal(answers.TTS_VOLUME, '1.0');
  assert.equal(answers.SUPERTONIC_COMMAND, 'supertonic');
  assert.equal(answers.SUPERTONIC_SPEED, '1.0');
  assert.equal(answers.SUPERTONIC_LANGUAGE, 'ko');
  assert.equal(answers.OPENVOICE_LANGUAGE, 'KR');
  assert.equal(answers.REQUIRE_WAKE_WORD, '0');
  assert.equal(answers.UTTERANCE_IDLE_MS, '4500');
});

test('buildEnvFile writes configurable CLI harness and Discord settings without comments leaking into values', () => {
  const envText = buildEnvFile({
    AGENT_BACKEND: 'custom',
    AGENT_LABEL: 'My Harness',
    AGENT_COMMAND: 'my-harness run --json',
    VOICE_LANGUAGE: 'auto',
    WHISPER_CPP_LANGUAGE: 'auto',
    STT_LANGUAGE: 'auto',
    TTS_BACKEND: 'supertonic',
    EDGE_TTS_COMMAND: './.venv-tts/bin/edge-tts',
    SUPERTONIC_VOICE: 'M4',
    SUPERTONIC_STEPS: '3',
    DISCORD_BOT_TOKEN: 'token-abc',
    DISCORD_ALLOWED_USERS: '111',
    AUTO_JOIN_VOICE_CHANNELS: '일반',
    TRANSCRIPT_CHANNEL_ID: '222',
    TTS_VOICE: 'ko-KR-SunHiNeural',
    TTS_RATE: '+10%',
    TTS_VOLUME: '1.6',
    REQUIRE_WAKE_WORD: '0',
    OPENVOICE_REF_AUDIO: './voice-samples/me.wav',
  });
  const parsed = parseKeyValueEnv(envText);

  assert.equal(parsed.AGENT_BACKEND, 'custom');
  assert.equal(parsed.AGENT_LABEL, 'My Harness');
  assert.equal(parsed.AGENT_COMMAND, 'my-harness run --json');
  assert.equal(parsed.TTS_BACKEND, 'supertonic');
  assert.equal(parsed.EDGE_TTS_COMMAND, './.venv-tts/bin/edge-tts');
  assert.equal(parsed.VOICE_LANGUAGE, 'auto');
  assert.equal(parsed.WHISPER_CPP_LANGUAGE, 'auto');
  assert.equal(parsed.STT_LANGUAGE, 'auto');
  assert.equal(parsed.SUPERTONIC_VOICE, 'M4');
  assert.equal(parsed.SUPERTONIC_STEPS, '3');
  assert.equal(parsed.TTS_VOLUME, '1.6');
  assert.equal(parsed.OPENVOICE_REF_AUDIO, './voice-samples/me.wav');
  assert.equal(parsed.DISCORD_BOT_TOKEN, 'token-abc');
  assert.equal(parsed.REQUIRE_WAKE_WORD, '0');
});

test('renderInstallSummary documents selected harness and next commands', () => {
  const summary = renderInstallSummary({ AGENT_BACKEND: 'claude-code', AUTO_JOIN_VOICE_CHANNELS: '일반', TTS_BACKEND: 'openvoice' });

  assert.match(summary, /claude-code/);
  assert.match(summary, /npm install/);
  assert.match(summary, /\.\/run\.sh/);
  assert.match(summary, /openvoice/);
  assert.match(summary, /!voice-test/);
});

test('normalizeInstanceAnswers derives isolated per-instance env values', () => {
  const values = normalizeInstanceAnswers({
    instanceName: 'LLM Wiki',
    discordBotToken: 'token-instance',
    discordClientId: '123456789012345678',
    autoJoinVoiceChannels: 'LLM-Wiki',
    transcriptChannelId: '123456789012345678',
    workdir: '/path/to/my-project',
    projectContext: 'LLM-Wiki graph context',
    agentLabel: '',
  });

  assert.equal(values.INSTANCE_NAME, 'llm-wiki');
  assert.equal(values.DISCORD_TOKEN, 'token-instance');
  assert.equal(values.DISCORD_CLIENT_ID, '123456789012345678');
  assert.equal(values.AUTO_JOIN_VOICE_CHANNELS, 'LLM-Wiki');
  assert.equal(values.TRANSCRIPT_CHANNEL_ID, '123456789012345678');
  assert.equal(values.PROJECT_SESSIONS_FILE, 'config/project-sessions.llm-wiki.json');
  assert.equal(values.BRIDGE_LOG_PATH, '/tmp/verbalcoding-llm-wiki.log');
  assert.equal(values.NODE_AUDIO_DEBUG_DIR, '/tmp/verbalcoding-llm-wiki-debug');
  assert.equal(values.HERMES_SESSION_FILE, '.agent-sessions/hermes/llm-wiki.session');
  assert.equal(values.AGENT_LABEL, 'Hermes Agent · LLM Wiki');
  assert.equal(values.AGENT_CWD, '/path/to/my-project');
  assert.equal(values.AGENT_PROJECT_CONTEXT, 'LLM-Wiki graph context');
});

test('buildInstanceEnvFile writes only local per-instance values with token redaction left to callers', () => {
  const envText = buildInstanceEnvFile(normalizeInstanceAnswers({
    instanceName: 'verbalcoding',
    discordBotToken: 'token-vc',
    autoJoinVoiceChannels: 'VerbalCoding',
    transcriptChannelId: 'thread-1',
    allowedUsers: '111,222',
    discordClientId: '123456789012345678',
  }));
  const parsed = parseKeyValueEnv(envText);

  assert.equal(parsed.INSTANCE_NAME, 'verbalcoding');
  assert.equal(parsed.DISCORD_TOKEN, 'token-vc');
  assert.equal(parsed.DISCORD_CLIENT_ID, '123456789012345678');
  assert.equal(parsed.DISCORD_ALLOWED_USERS, '111,222');
  assert.equal(parsed.AUTO_JOIN_VOICE_CHANNELS, 'VerbalCoding');
  assert.equal(parsed.TRANSCRIPT_CHANNEL_ID, 'thread-1');
  assert.equal(parsed.PROJECT_SESSIONS_FILE, 'config/project-sessions.verbalcoding.json');
  assert.equal(parsed.AGENT_BACKEND, undefined);
});

test('normalizeInstanceAnswers surfaces HERMES_HOME when provided', () => {
  const out = normalizeInstanceAnswers({
    instanceName: 'llm-wiki',
    discordBotToken: 'token',
    autoJoinVoiceChannels: 'LLM-Wiki',
    transcriptChannelId: '123',
    workdir: '/projects/llm-wiki',
    projectContext: 'LLM-Wiki agent',
    hermesHome: '/home/you/.hermes/profiles/my-project',
  });
  assert.equal(out.HERMES_HOME, '/home/you/.hermes/profiles/my-project');
});

test('buildInstanceEnvFile emits HERMES_HOME after HERMES_SESSION_FILE', () => {
  const text = buildInstanceEnvFile({
    INSTANCE_NAME: 'llm-wiki',
    DISCORD_TOKEN: 'token',
    HERMES_SESSION_FILE: '.agent-sessions/hermes/llm-wiki.session',
    HERMES_HOME: '/home/you/.hermes/profiles/my-project',
    AGENT_LABEL: 'Hermes · llm-wiki',
    AGENT_CWD: '/projects/llm-wiki',
  });
  const lines = text.split('\n');
  const sessionIdx = lines.findIndex(l => l.startsWith('HERMES_SESSION_FILE='));
  const homeIdx = lines.findIndex(l => l.startsWith('HERMES_HOME='));
  assert.ok(sessionIdx >= 0 && homeIdx === sessionIdx + 1, `expected HERMES_HOME directly after HERMES_SESSION_FILE; got lines:\n${text}`);
  assert.match(text, /HERMES_HOME="\/home\/you\/\.hermes\/profiles\/my-project"/);
});

test('renderInstanceSetupSummary points users at installed vc commands, not npm script wrappers or manual editing', () => {
  const summary = renderInstanceSetupSummary({ INSTANCE_NAME: 'llm-wiki', DISCORD_CLIENT_ID: '123456789012345678', BRIDGE_LOG_PATH: '/tmp/verbalcoding-llm-wiki.log' });

  assert.match(summary, /instances\/llm-wiki\.env/);
  assert.match(summary, /vc instance start llm-wiki/);
  assert.match(summary, /vc instance status llm-wiki/);
  assert.match(summary, /vc doctor/);
  assert.match(summary, /Discord bot invite URL:/);
  assert.match(summary, /client_id=123456789012345678/);
  assert.doesNotMatch(summary, /npm run vc/);
});
