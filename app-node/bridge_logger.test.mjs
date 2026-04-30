import test from 'node:test';
import assert from 'node:assert/strict';

import { createBridgeLogger, isBrokenPipeError } from './bridge_logger.mjs';

test('isBrokenPipeError recognizes stdout/stderr pipe failures', () => {
  assert.equal(isBrokenPipeError({ code: 'EPIPE', message: 'write EPIPE' }), true);
  assert.equal(isBrokenPipeError({ code: 'ECONNRESET', message: 'socket hang up' }), false);
});

test('createBridgeLogger disables stdio after EPIPE but keeps file logging', () => {
  const stdioCalls = [];
  const fileLines = [];
  const logger = createBridgeLogger({
    now: () => '2026-05-01T00:00:00.000Z',
    stdout: {
      log: (...args) => {
        stdioCalls.push(args);
        const error = new Error('write EPIPE');
        error.code = 'EPIPE';
        throw error;
      },
      warn: (...args) => stdioCalls.push(args),
    },
    appendLine: line => fileLines.push(line),
  });

  logger.log('first');
  logger.warn('second');

  assert.equal(stdioCalls.length, 1);
  assert.equal(fileLines.length, 2);
  assert.match(fileLines[0], /first/);
  assert.match(fileLines[1], /second/);
});
