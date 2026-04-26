import test from 'node:test';
import assert from 'node:assert/strict';

import { splitForTTS } from './tts_chunks.mjs';

test('splitForTTS keeps short text as one chunk', () => {
  assert.deepEqual(splitForTTS('짧은 답변이야.', 80), ['짧은 답변이야.']);
});

test('splitForTTS splits long Korean text on sentence boundaries without exceeding the limit', () => {
  const text = '첫 번째 문장은 충분히 길지만 하나의 단위야. 두 번째 문장도 이어서 말해야 해. 세 번째 문장은 너무 길어지면 다음 조각으로 넘어가야 해.';
  const chunks = splitForTTS(text, 45);

  assert.deepEqual(chunks, [
    '첫 번째 문장은 충분히 길지만 하나의 단위야.',
    '두 번째 문장도 이어서 말해야 해.',
    '세 번째 문장은 너무 길어지면 다음 조각으로 넘어가야 해.',
  ]);
  assert.ok(chunks.every(chunk => chunk.length <= 45));
});

test('splitForTTS falls back to whitespace splitting when a sentence is too long', () => {
  const text = '하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열 열하나 열둘';
  const chunks = splitForTTS(text, 12);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(' '), text);
  assert.ok(chunks.every(chunk => chunk.length <= 12));
});
