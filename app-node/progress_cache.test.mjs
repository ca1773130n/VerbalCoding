import test from 'node:test';
import assert from 'node:assert/strict';

import { progressTtsCacheFileName } from './progress_cache.mjs';

test('progressTtsCacheFileName includes full text even when backend key prefix is long', () => {
  const longBackendKey = [
    'speechswift',
    'server',
    'http://127.0.0.1:18080',
    'cosyvoice',
    '/Users/neo/Developer/Projects/VerbalCoding/voice-samples/user-reference.wav',
    'korean',
    'aufklarer/CosyVoice3-0.5B-MLX-4bit',
  ];

  const first = progressTtsCacheFileName({ backendKeyParts: longBackendKey, text: 'Hermes Agent 호출 시작', ext: 'wav' });
  const second = progressTtsCacheFileName({ backendKeyParts: longBackendKey, text: '터미널 명령 실행', ext: 'wav' });

  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}\.wav$/);
  assert.match(second, /^[a-f0-9]{64}\.wav$/);
});
