import test from 'node:test';
import assert from 'node:assert/strict';
import { createTtsPlayer } from './tts_player.mjs';
import { createBridge } from './bridge_context.mjs';

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  bridge.ttsBackend = {
    name: 'fake',
    synthesize: async () => '/tmp/fake.wav',
  };
  return {
    bridge,
    settings: { tts: { maxChars: 200, volume: 1 } },
    log: () => {},
    warn: () => {},
    sleep: async () => {},
    sendText: async () => {},
    refreshTtsRuntimeConfig: async () => {},
    waitEvent: async () => {},
    isAbortError: () => false,
    STREAMING_TTS_ENABLED: true,
    ...overrides,
  };
}

test('createTtsPlayer exposes the expected functions', () => {
  const player = createTtsPlayer(makeDeps());
  for (const name of ['synthTTS', 'playAudio', 'speakText', 'beginStreamingTurn', 'endStreamingTurn', 'stopPlaybackForBargeIn']) {
    assert.equal(typeof player[name], 'function', `${name} is exposed`);
  }
});

test('stopPlaybackForBargeIn is a no-op when nothing is speaking', () => {
  const deps = makeDeps();
  const { stopPlaybackForBargeIn } = createTtsPlayer(deps);
  assert.equal(deps.bridge.speaking, false);
  assert.equal(stopPlaybackForBargeIn('user-1', 'manual'), false);
  assert.equal(deps.bridge.speechPlaybackGeneration, 0);
});

test('stopPlaybackForBargeIn stops the active player and increments generation', () => {
  let stopped = false;
  const deps = makeDeps();
  deps.bridge.speaking = true;
  deps.bridge.player = { stop: () => { stopped = true; } };
  const { stopPlaybackForBargeIn } = createTtsPlayer(deps);
  const out = stopPlaybackForBargeIn('user-1', 'live-barge-in');
  assert.equal(out, true);
  assert.equal(stopped, true);
  assert.equal(deps.bridge.speaking, false);
  assert.equal(deps.bridge.speechPlaybackGeneration, 1);
});

test('playAudio is a no-op when no voice connection', async () => {
  const deps = makeDeps();
  deps.bridge.connection = null;
  const { playAudio } = createTtsPlayer(deps);
  await playAudio('/tmp/fake.wav', { deleteAfter: false });
  // No throw and no state mutation expected.
  assert.equal(deps.bridge.speaking, false);
});

test('beginStreamingTurn returns false when streaming disabled', () => {
  const deps = makeDeps({ STREAMING_TTS_ENABLED: false });
  deps.bridge.connection = { subscribe: () => {} };
  const { beginStreamingTurn } = createTtsPlayer(deps);
  assert.equal(beginStreamingTurn(new AbortController().signal), false);
  assert.equal(deps.bridge.activeSentencer, null);
  assert.equal(deps.bridge.activeStreamingQueue, null);
});

test('beginStreamingTurn returns false when no voice connection', () => {
  const deps = makeDeps();
  deps.bridge.connection = null;
  const { beginStreamingTurn } = createTtsPlayer(deps);
  assert.equal(beginStreamingTurn(new AbortController().signal), false);
});

test('synthTTS retries on transient failure and surfaces the final error', async () => {
  let calls = 0;
  const deps = makeDeps();
  deps.bridge.ttsBackend = {
    name: 'flaky',
    synthesize: async () => {
      calls++;
      const e = new Error('boom');
      throw e;
    },
  };
  const { synthTTS } = createTtsPlayer(deps);
  await assert.rejects(() => synthTTS('hi', null), /boom/);
  assert.equal(calls, 3);
});

test('synthTTS aborts immediately on signal abort', async () => {
  let calls = 0;
  const deps = makeDeps({ isAbortError: e => e.name === 'AbortError' });
  deps.bridge.ttsBackend = {
    name: 'aborty',
    synthesize: async () => {
      calls++;
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    },
  };
  const { synthTTS } = createTtsPlayer(deps);
  await assert.rejects(() => synthTTS('hi', null), /aborted/);
  assert.equal(calls, 1, 'no retries after AbortError');
});

// --- speakText full chunked synth/play flow ------------------------------
//
// synthTTS internally calls fs.statSync on the file the backend returns,
// so these tests create a real temp file the fake synthesize() can return.

import fsReal from 'node:fs';
import osReal from 'node:os';
import pathReal from 'node:path';

function makeFakeWav() {
  const dir = fsReal.mkdtempSync(pathReal.join(osReal.tmpdir(), 'vc-tts-test-'));
  const file = pathReal.join(dir, 'fake.wav');
  fsReal.writeFileSync(file, Buffer.from('RIFF....fake-wav-bytes'));
  return file;
}

test('speakText mirrors text to channel, then synths + plays each chunk in order', async () => {
  const fakePath = makeFakeWav();
  const synthCalls = [];
  const sentTexts = [];
  const stages = {};
  const deps = makeDeps({
    sendText: async t => { sentTexts.push(t); },
  });
  deps.bridge.connection = { subscribe: () => {} };
  deps.bridge.player = { play: () => {}, stop: () => {}, on: () => {} };
  deps.bridge.ttsBackend = {
    name: 'fake',
    synthesize: async text => { synthCalls.push(text); return fakePath; },
  };
  deps.waitEvent = async () => {};

  const { speakText } = createTtsPlayer(deps);
  const metricsTurn = { stage: (label, ms, extra) => { stages[label] = { ms, extra }; } };
  await speakText('hello world', null, metricsTurn, { mirrorText: true });

  assert.equal(synthCalls.length, 1, 'one synth call for one chunk');
  assert.equal(synthCalls[0], 'hello world');
  assert.ok(sentTexts.some(t => /hello world/.test(t)), 'mirror text sent to channel');
  assert.ok(stages.tts_synth, 'tts_synth stage recorded');
  assert.ok(stages.tts_play, 'tts_play stage recorded');
  assert.ok(stages.tts_total, 'tts_total stage recorded');
  assert.equal(stages.tts_synth.extra.ttsChunks, 1, 'extra carries chunk count');
});

test('speakText with mirrorText:false does NOT echo to the text channel', async () => {
  const fakePath = makeFakeWav();
  const sentTexts = [];
  const deps = makeDeps({ sendText: async t => { sentTexts.push(t); } });
  deps.bridge.connection = { subscribe: () => {} };
  deps.bridge.player = { play: () => {}, stop: () => {}, on: () => {} };
  deps.bridge.ttsBackend = { name: 'fake', synthesize: async () => fakePath };
  deps.waitEvent = async () => {};

  const { speakText } = createTtsPlayer(deps);
  await speakText('quiet', null, null, { mirrorText: false });
  assert.equal(sentTexts.length, 0, 'no mirror when mirrorText:false');
});

test('speakText skips play when speechPlaybackGeneration changes mid-flight', async () => {
  const fakePath = makeFakeWav();
  let synthCalls = 0;
  let playCalls = 0;
  const deps = makeDeps();
  deps.bridge.connection = { subscribe: () => {} };
  deps.bridge.player = { play: () => { playCalls++; }, stop: () => {}, on: () => {} };
  const beforeGen = deps.bridge.speechPlaybackGeneration;
  // Bump the generation during synth — when playChunkedTTSWithPrefetch's
  // play wrapper checks playbackStopped(), it'll see the mismatch and skip.
  deps.bridge.ttsBackend = {
    name: 'fake',
    synthesize: async () => {
      synthCalls++;
      deps.bridge.speechPlaybackGeneration = beforeGen + 1;
      return fakePath;
    },
  };
  deps.waitEvent = async () => {};

  const { speakText } = createTtsPlayer(deps);
  await speakText('hello world', null, null, { mirrorText: false });
  assert.equal(synthCalls, 1, 'synth runs once');
  assert.equal(playCalls, 0, 'play is skipped because generation changed');
});
