import test from 'node:test';
import assert from 'node:assert/strict';

import { createBridgeLogger, createTransientErrorReporter, isBrokenPipeError } from './bridge_logger.mjs';

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

test('createBridgeLogger can be marked stdio-broken from stream error handlers', () => {
  const stdioCalls = [];
  const fileLines = [];
  const logger = createBridgeLogger({
    now: () => '2026-05-01T00:00:00.000Z',
    stdout: { log: (...args) => stdioCalls.push(args), warn: (...args) => stdioCalls.push(args) },
    appendLine: line => fileLines.push(line),
  });

  logger.markStdioBroken();
  logger.log('file only');

  assert.equal(stdioCalls.length, 0);
  assert.equal(fileLines.length, 1);
  assert.match(fileLines[0], /file only/);
});

test('createTransientErrorReporter rate-limits repeated transient errors', () => {
  let now = 1000;
  const lines = [];
  const reporter = createTransientErrorReporter({
    now: () => now,
    intervalMs: 5000,
    warn: (...args) => lines.push(args.join(' ')),
  });
  const error = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });

  assert.equal(reporter('uncaught exception', error), true);
  assert.equal(reporter('uncaught exception', error), true);
  assert.equal(reporter('uncaught exception', error), true);
  now = 7000;
  assert.equal(reporter('uncaught exception', error), true);

  assert.equal(lines.length, 2);
  assert.match(lines[0], /suppressed transient uncaught exception EPIPE write EPIPE/);
  assert.match(lines[1], /repeated 2 times/);
});
