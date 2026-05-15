import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_WHISPER_TIMEOUT_MS, parsePositiveInt, whisperFailureMessage, whisperTimeoutMs } from './stt_whisper.mjs';

test('whisperTimeoutMs defaults high enough for cold Metal startup plus transcription', () => {
  assert.equal(DEFAULT_WHISPER_TIMEOUT_MS, 90000);
  assert.equal(whisperTimeoutMs({}), 90000);
});

test('whisperTimeoutMs accepts explicit positive env override', () => {
  assert.equal(whisperTimeoutMs({ WHISPER_CPP_TIMEOUT_MS: '120000' }), 120000);
  assert.equal(whisperTimeoutMs({ WHISPER_TIMEOUT_MS: '45000' }), 45000);
});

test('parsePositiveInt rejects invalid timeout values', () => {
  assert.equal(parsePositiveInt('0', 7), 7);
  assert.equal(parsePositiveInt('-1', 7), 7);
  assert.equal(parsePositiveInt('nope', 7), 7);
  assert.equal(parsePositiveInt('12.8', 7), 12);
});

test('whisperFailureMessage keeps concise tail instead of dumping full backend log', () => {
  const err = new Error('Command failed');
  err.killed = true;
  err.signal = 'SIGTERM';
  err.stderr = `${'load_backend\n'.repeat(300)}final useful line`;
  const msg = whisperFailureMessage(err);
  assert.match(msg, /killed signal SIGTERM/);
  assert.match(msg, /final useful line/);
  assert.ok(msg.length < 1500);
});
