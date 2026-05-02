import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEnvFile,
  buildInstanceEnvFile,
  normalizeInstallAnswers,
  normalizeInstanceAnswers,
  parseKeyValueEnv,
  renderInstallSummary,
  renderInstanceSetupSummary,
} from './install_config.mjs';

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
  assert.equal(answers.UTTERANCE_IDLE_MS, '2000');
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
    autoJoinVoiceChannels: 'LLM-Wiki',
    transcriptChannelId: '1497890694730219540',
    workdir: '/Users/neo/Developer/Projects/LLM-Wiki',
    projectContext: 'LLM-Wiki graph context',
    agentLabel: '',
  });

  assert.equal(values.INSTANCE_NAME, 'llm-wiki');
  assert.equal(values.DISCORD_TOKEN, 'token-instance');
  assert.equal(values.AUTO_JOIN_VOICE_CHANNELS, 'LLM-Wiki');
  assert.equal(values.TRANSCRIPT_CHANNEL_ID, '1497890694730219540');
  assert.equal(values.PROJECT_SESSIONS_FILE, 'config/project-sessions.llm-wiki.json');
  assert.equal(values.BRIDGE_LOG_PATH, '/tmp/verbalcoding-llm-wiki.log');
  assert.equal(values.NODE_AUDIO_DEBUG_DIR, '/tmp/verbalcoding-llm-wiki-debug');
  assert.equal(values.HERMES_SESSION_FILE, '.agent-sessions/hermes/llm-wiki.session');
  assert.equal(values.AGENT_LABEL, 'Hermes Agent · LLM Wiki');
  assert.equal(values.AGENT_CWD, '/Users/neo/Developer/Projects/LLM-Wiki');
  assert.equal(values.AGENT_PROJECT_CONTEXT, 'LLM-Wiki graph context');
});

test('buildInstanceEnvFile writes only local per-instance values with token redaction left to callers', () => {
  const envText = buildInstanceEnvFile(normalizeInstanceAnswers({
    instanceName: 'verbalcoding',
    discordBotToken: 'token-vc',
    autoJoinVoiceChannels: 'VerbalCoding',
    transcriptChannelId: 'thread-1',
    allowedUsers: '111,222',
  }));
  const parsed = parseKeyValueEnv(envText);

  assert.equal(parsed.INSTANCE_NAME, 'verbalcoding');
  assert.equal(parsed.DISCORD_TOKEN, 'token-vc');
  assert.equal(parsed.DISCORD_ALLOWED_USERS, '111,222');
  assert.equal(parsed.AUTO_JOIN_VOICE_CHANNELS, 'VerbalCoding');
  assert.equal(parsed.TRANSCRIPT_CHANNEL_ID, 'thread-1');
  assert.equal(parsed.PROJECT_SESSIONS_FILE, 'config/project-sessions.verbalcoding.json');
  assert.equal(parsed.AGENT_BACKEND, undefined);
});

test('renderInstanceSetupSummary points users at CLI commands, not manual editing', () => {
  const summary = renderInstanceSetupSummary({ INSTANCE_NAME: 'llm-wiki', BRIDGE_LOG_PATH: '/tmp/verbalcoding-llm-wiki.log' });

  assert.match(summary, /instances\/llm-wiki\.env/);
  assert.match(summary, /npm run vc -- instance start llm-wiki/);
  assert.match(summary, /npm run vc -- instance status llm-wiki/);
  assert.match(summary, /npm run doctor/);
});
