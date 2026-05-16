import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isHumanAllowed,
  pickOccupiedUserVoiceChannel,
  shouldFollowUserVoiceChannel,
} from './voice_autojoin.mjs';

function member(id, { bot = false } = {}) {
  return { user: { id, bot } };
}

function voiceChannel(id, name, members = []) {
  return {
    id,
    name,
    members: new Map(members.map(m => [m.user.id, m])),
    isVoiceBased: () => true,
  };
}

function textChannel(id, name) {
  return { id, name, members: new Map(), isVoiceBased: () => false };
}

function guild(channels) {
  return { channels: { cache: new Map(channels.map(ch => [ch.id, ch])) } };
}

test('pickOccupiedUserVoiceChannel selects an allowed human voice channel before configured names', () => {
  const empty = voiceChannel('v1', 'General', []);
  const occupied = voiceChannel('v2', 'Summer', [member('u1')]);

  const selected = pickOccupiedUserVoiceChannel([guild([textChannel('t1', 'text'), empty, occupied])], new Set(['u1']));

  assert.equal(selected, occupied);
});

test('pickOccupiedUserVoiceChannel ignores bots and disallowed humans', () => {
  const botOnly = voiceChannel('v1', 'Bot room', [member('bot1', { bot: true })]);
  const disallowed = voiceChannel('v2', 'Other', [member('u2')]);

  const selected = pickOccupiedUserVoiceChannel([guild([botOnly, disallowed])], new Set(['u1']));

  assert.equal(selected, null);
});

test('shouldFollowUserVoiceChannel only follows allowed users in single-instance mode', () => {
  assert.equal(shouldFollowUserVoiceChannel({ singleInstance: true, userId: 'u1', allowedUsers: new Set(['u1']), userChannelId: 'voice-a', activeVoiceChannelId: 'voice-b' }), true);
  assert.equal(shouldFollowUserVoiceChannel({ singleInstance: false, userId: 'u1', allowedUsers: new Set(['u1']), userChannelId: 'voice-a', activeVoiceChannelId: 'voice-b' }), false);
  assert.equal(shouldFollowUserVoiceChannel({ singleInstance: true, userId: 'u2', allowedUsers: new Set(['u1']), userChannelId: 'voice-a', activeVoiceChannelId: 'voice-b' }), false);
  assert.equal(shouldFollowUserVoiceChannel({ singleInstance: true, userId: 'u1', allowedUsers: new Set(['u1']), userChannelId: 'voice-a', activeVoiceChannelId: 'voice-a' }), false);
});

test('isHumanAllowed accepts any non-bot when allowlist is empty', () => {
  assert.equal(isHumanAllowed(member('u1'), new Set()), true);
  assert.equal(isHumanAllowed(member('bot1', { bot: true }), new Set()), false);
});
