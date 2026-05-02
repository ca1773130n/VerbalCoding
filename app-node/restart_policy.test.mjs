import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTO_RESTART_ENV_KEY,
  autoRestartStatusText,
  autoRestartVoiceBotEnabled,
  normalizeAutoRestartCommand,
  parseBooleanFlag,
} from './restart_policy.mjs';

test('auto restart defaults off unless explicitly enabled', () => {
  assert.equal(autoRestartVoiceBotEnabled({}), false);
  assert.equal(autoRestartVoiceBotEnabled({ [AUTO_RESTART_ENV_KEY]: '' }), false);
  assert.equal(autoRestartVoiceBotEnabled({ [AUTO_RESTART_ENV_KEY]: '0' }), false);
  assert.equal(autoRestartVoiceBotEnabled({ [AUTO_RESTART_ENV_KEY]: 'off' }), false);
  assert.equal(autoRestartVoiceBotEnabled({ [AUTO_RESTART_ENV_KEY]: '1' }), true);
  assert.equal(autoRestartVoiceBotEnabled({ [AUTO_RESTART_ENV_KEY]: 'on' }), true);
});

test('normalizes user auto restart commands', () => {
  assert.equal(normalizeAutoRestartCommand('on'), '1');
  assert.equal(normalizeAutoRestartCommand('켜'), '1');
  assert.equal(normalizeAutoRestartCommand('off'), '0');
  assert.equal(normalizeAutoRestartCommand('꺼'), '0');
  assert.equal(normalizeAutoRestartCommand('maybe'), null);
});

test('auto restart status text is explicit', () => {
  assert.equal(autoRestartStatusText({}, 'ko'), '커밋 후 음성봇 자동 재시작: 꺼짐.');
  assert.equal(autoRestartStatusText({ [AUTO_RESTART_ENV_KEY]: '1' }, 'en'), 'Auto restart voice bot after commits: on.');
  assert.equal(parseBooleanFlag('enabled'), true);
});
