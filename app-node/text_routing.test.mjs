import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRouteDiscordTextToAgent } from './text_routing.mjs';

test('routes normal transcript-channel text to the shared agent session', () => {
  assert.equal(shouldRouteDiscordTextToAgent({
    content: '이 작업 이어서 해줘',
    channelId: 'transcript',
    transcriptChannelId: 'transcript',
  }), true);
});

test('does not route commands or other channels to the shared agent session', () => {
  assert.equal(shouldRouteDiscordTextToAgent({ content: '!ping', channelId: 'transcript', transcriptChannelId: 'transcript' }), false);
  assert.equal(shouldRouteDiscordTextToAgent({ content: '다른 채널 말', channelId: 'other', transcriptChannelId: 'transcript' }), false);
  assert.equal(shouldRouteDiscordTextToAgent({ content: '   ', channelId: 'transcript', transcriptChannelId: 'transcript' }), false);
});
