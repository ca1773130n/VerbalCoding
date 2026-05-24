import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressHandler } from './progress_handler.mjs';
import { createBridge } from './bridge_context.mjs';

const noop = () => {};
const noopAsync = async () => {};

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  bridge.ttsBackend = {
    outputExtension: 'mp3',
    cacheKeyParts: () => ['fake'],
    synthesize: async () => '/tmp/progress-tmp.mp3',
  };
  return {
    bridge,
    settings: { tts: { progressCacheDir: '/tmp/progress-cache' }, voiceLanguage: 'ko' },
    log: noop, warn: noop,
    isAbortError: () => false,
    playAudio: noopAsync,
    sendText: noopAsync,
    refreshTtsRuntimeConfig: noopAsync,
    ...overrides,
  };
}

test('createProgressHandler exposes the expected functions', () => {
  const handler = createProgressHandler(makeDeps());
  for (const name of [
    'ensureSmartProgressSummarizer', 'smartProgressStatusText', 'progressEmoji',
    'formatProgressText', 'sendVerboseProgressText', 'synthProgressTTS',
    'speakProgress', 'speakImmediateNotice', 'queueProgressSpeechText',
    'flushProgressSpeechBatch', 'queueVerboseProgressSpeech',
    'clearProgressSpeechBatch', 'stopProgressSpeech',
  ]) {
    assert.equal(typeof handler[name], 'function', `${name} is exposed`);
  }
});

test('smartProgressStatusText reports off + no-key when env is empty', () => {
  const prev = process.env.SMART_PROGRESS_API_KEY;
  delete process.env.SMART_PROGRESS_API_KEY;
  try {
    const { smartProgressStatusText } = createProgressHandler(makeDeps());
    const text = smartProgressStatusText();
    assert.match(text, /smart-progress: off/);
    assert.match(text, /no SMART_PROGRESS_API_KEY set/);
  } finally {
    if (prev !== undefined) process.env.SMART_PROGRESS_API_KEY = prev;
  }
});

test('progressEmoji maps category keys to emoji glyphs', () => {
  const { progressEmoji } = createProgressHandler(makeDeps());
  // progressCategory returns null for empty event -> fallback emoji
  assert.equal(progressEmoji(''), '⚙️');
});

test('queueProgressSpeechText drops empty/aborted/mismatched signals', () => {
  const deps = makeDeps();
  let calls = 0;
  deps.playAudio = async () => { calls++; };
  const { queueProgressSpeechText } = createProgressHandler(deps);
  const signal = new AbortController().signal;
  // No active progress signal set -> drop
  queueProgressSpeechText('hello', signal, 'test');
  assert.equal(calls, 0);
});

test('clearProgressSpeechBatch resets the batch buffer for the active signal', () => {
  const deps = makeDeps();
  const { clearProgressSpeechBatch } = createProgressHandler(deps);
  deps.bridge.progressSpeechBatchSignal = 'sig';
  deps.bridge.progressSpeechBatch = ['a', 'b'];
  deps.bridge.progressSpeechBatchStartedAt = 12345;
  clearProgressSpeechBatch('sig');
  assert.equal(deps.bridge.progressSpeechBatchSignal, null);
  assert.deepEqual(deps.bridge.progressSpeechBatch, []);
  assert.equal(deps.bridge.progressSpeechBatchStartedAt, 0);
});

test('stopProgressSpeech is a no-op when signal does not match active', () => {
  const deps = makeDeps();
  deps.bridge.activeProgressSignal = 'A';
  deps.bridge.speaking = true;
  const { stopProgressSpeech } = createProgressHandler(deps);
  stopProgressSpeech('B', 'mismatch');
  // Unchanged because mismatched signal
  assert.equal(deps.bridge.activeProgressSignal, 'A');
  assert.equal(deps.bridge.speaking, true);
});

test('sendVerboseProgressText debounces repeated identical messages', async () => {
  const deps = makeDeps();
  let sent = 0;
  deps.sendText = async () => { sent++; };
  deps.bridge.verboseProgress = true;
  const signal = new AbortController().signal;
  deps.bridge.activeProgressSignal = signal;
  const handler = createProgressHandler(deps);
  handler.sendVerboseProgressText('test', signal);
  await new Promise(r => setImmediate(r));
  handler.sendVerboseProgressText('test', signal);
  await new Promise(r => setImmediate(r));
  // Second identical call within 2s window is debounced
  assert.equal(sent, 1);
});
