import test from 'node:test';
import assert from 'node:assert/strict';

import { sendDiscordText, splitDiscordMessage } from './discord_text.mjs';

test('splitDiscordMessage chunks long text for Discord', () => {
  const chunks = splitDiscordMessage('x'.repeat(4001), 1900);
  assert.deepEqual(chunks.map(c => c.length), [1900, 1900, 201]);
});

test('sendDiscordText returns false when target is not text based', async () => {
  const warnings = [];
  const delivered = await sendDiscordText({
    channelId: '123',
    text: 'final answer',
    client: { channels: { fetch: async () => ({ isTextBased: () => false }) } },
    warn: (...args) => warnings.push(args.join(' ')),
  });
  assert.equal(delivered, false);
  assert.match(warnings.join('\n'), /not text based/);
});

test('sendDiscordText sends every chunk and returns true', async () => {
  const sent = [];
  const delivered = await sendDiscordText({
    channelId: '123',
    text: 'abcdef',
    client: { channels: { fetch: async () => ({ isTextBased: () => true, send: async chunk => sent.push(chunk) }) } },
  });
  assert.equal(delivered, true);
  assert.deepEqual(sent, ['abcdef']);
});
