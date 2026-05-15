import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendRecentDiscordText,
  formatRecentDiscordContext,
  shouldRouteDiscordTextToAgent,
} from './text_routing.mjs';

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

test('formats recent Discord text context for voice turns without commands', () => {
  const state = new Map();
  appendRecentDiscordText(state, { channelId: 'thread', authorLabel: 'user', content: '음성채널에서만 나가줘', now: 1000 });
  appendRecentDiscordText(state, { channelId: 'thread', authorLabel: 'user', content: '!ping', now: 1100 });
  appendRecentDiscordText(state, { channelId: 'thread', authorLabel: 'assistant', content: '알겠어', now: 1200 });

  const context = formatRecentDiscordContext(state, {
    channelId: 'thread',
    now: 2000,
    maxAgeMs: 5000,
  });

  assert.match(context, /최근 텍스트 채널 메시지/);
  assert.match(context, /user: 음성채널에서만 나가줘/);
  assert.doesNotMatch(context, /!ping/);
  assert.match(context, /assistant: 알겠어/);
});
