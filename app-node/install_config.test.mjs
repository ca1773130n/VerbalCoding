import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEnvFile,
  normalizeInstallAnswers,
  parseKeyValueEnv,
  renderInstallSummary,
} from './install_config.mjs';

test('normalizeInstallAnswers maps supported harnesses to backend env', () => {
  const answers = normalizeInstallAnswers({
    harness: 'opencode',
    discordBotToken: 'token-123',
    allowedUsers: '111,222',
    autoJoinVoiceChannels: '일반,General',
    transcriptChannelId: '333',
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
  assert.equal(answers.TTS_VOICE, 'ko-KR-SunHiNeural');
  assert.equal(answers.TTS_RATE, '+10%');
  assert.equal(answers.OPENVOICE_LANGUAGE, 'KR');
  assert.equal(answers.REQUIRE_WAKE_WORD, '0');
  assert.equal(answers.UTTERANCE_IDLE_MS, '2000');
});

test('buildEnvFile writes configurable CLI harness and Discord settings without comments leaking into values', () => {
  const envText = buildEnvFile({
    AGENT_BACKEND: 'custom',
    AGENT_LABEL: 'My Harness',
    AGENT_COMMAND: 'my-harness run --json',
    TTS_BACKEND: 'openvoice',
    DISCORD_BOT_TOKEN: 'token-abc',
    DISCORD_ALLOWED_USERS: '111',
    AUTO_JOIN_VOICE_CHANNELS: '일반',
    TRANSCRIPT_CHANNEL_ID: '222',
    TTS_VOICE: 'ko-KR-SunHiNeural',
    TTS_RATE: '+10%',
    REQUIRE_WAKE_WORD: '0',
    OPENVOICE_REF_AUDIO: './voice-samples/me.wav',
  });
  const parsed = parseKeyValueEnv(envText);

  assert.equal(parsed.AGENT_BACKEND, 'custom');
  assert.equal(parsed.AGENT_LABEL, 'My Harness');
  assert.equal(parsed.AGENT_COMMAND, 'my-harness run --json');
  assert.equal(parsed.TTS_BACKEND, 'openvoice');
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
