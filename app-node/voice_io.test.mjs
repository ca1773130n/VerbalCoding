import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceIO } from './voice_io.mjs';
import { createBridge } from './bridge_context.mjs';

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  // Seed bridgeState with the minimum shape the voice_io helpers use.
  bridge.bridgeState = {
    appendSegment: () => ({ files: ['a'], pcmBytes: 1024, epoch: 1 }),
    deletePending: () => null,
    getPending: () => null,
    clearPendingTimer: () => {},
    currentEpoch: () => 1,
  };
  return {
    bridge,
    settings: {
      whisperBin: 'whisper-cli',
      whisperModel: '/dev/null',
      whisperLanguage: 'ko',
      whisperTimeoutMs: 1000,
      debugDir: '',
      allowedUsers: new Set(),
    },
    client: { user: { id: 'bot-id' } },
    execFileAsync: async () => ({ stdout: '', stderr: '' }),
    log: () => {},
    warn: () => {},
    stamp: () => 'stamp',
    sleep: async () => {},
    isAllowed: () => true,
    UTTERANCE_IDLE_MS: 4500,
    SUBSCRIBE_AFTER_SILENCE_MS: 2200,
    MIN_UTTERANCE_BYTES: 1024,
    MIN_MEAN_VOLUME_DB: -35,
    MIN_MAX_VOLUME_DB: -12,
    currentBargeInThresholds: () => ({ minBytes: 0, minMeanDb: -40, minMaxDb: -20, mode: 'normal' }),
    currentPlaybackBargeInThresholds: () => ({ minBytes: 0, minMeanDb: -40, minMaxDb: -20, requireBoth: true }),
    createLiveBargeInMonitor: () => ({ push: () => {} }),
    shouldUseLivePlaybackBargeIn: () => false,
    stopPlaybackForBargeIn: () => false,
    analyzeAudio: async () => ({ meanDb: -20, maxDb: -10 }),
    concatWavs: async () => {},
    saveCapturedVoiceCloneSample: async () => false,
    isBargeInCandidate: () => false,
    validateProcessingBargeIn: async () => ({ action: 'ignore', text: '' }),
    enqueueDeferredProcessingUtterance: () => true,
    newLatencyTurn: () => ({ mark: () => {}, addMeta: () => {}, finish: () => {} }),
    handleRecording: async () => {},
    ...overrides,
  };
}

test('createVoiceIO exposes the expected functions', () => {
  const voiceIO = createVoiceIO(makeDeps());
  for (const name of ['transcribeOnce', 'transcribe', 'cleanTranscript', 'queueSegment', 'flushUtterance', 'subscribeUser']) {
    assert.equal(typeof voiceIO[name], 'function', `${name} is exposed as a function`);
  }
});

test('cleanTranscript strips junk lines and noise tokens', () => {
  const { cleanTranscript } = createVoiceIO(makeDeps());
  // Real-world whisper output: timestamp prefix, brackets, junk tokens
  const raw = [
    '[00:00:00.000 --> 00:00:01.000] 안녕하세요',
    '구독 좋아요 부탁드려요',
    '(박수)',
    '오늘은 회의 안건을 정리해 봅시다',
    '시청해주셔서 감사합니다',
  ].join('\n');
  const cleaned = cleanTranscript(raw);
  assert.match(cleaned, /안녕하세요/);
  assert.match(cleaned, /오늘은 회의 안건을 정리해 봅시다/);
  assert.doesNotMatch(cleaned, /구독/);
  assert.doesNotMatch(cleaned, /시청해주셔서/);
  assert.doesNotMatch(cleaned, /박수/);
});

test('cleanTranscript returns empty string for noise-only input', () => {
  const { cleanTranscript } = createVoiceIO(makeDeps());
  assert.equal(cleanTranscript('(웃음)\n(박수)\n끄덕끄덕\n'), '');
  assert.equal(cleanTranscript(''), '');
});

test('subscribeUser ignores the bot itself', () => {
  let subscribed = false;
  const deps = makeDeps({ isAllowed: () => true });
  const { subscribeUser } = createVoiceIO(deps);
  const receiver = { subscribe: () => { subscribed = true; return { on: () => {}, pipe: () => ({ pipe: () => ({}) }) }; } };
  subscribeUser(receiver, 'bot-id');
  assert.equal(subscribed, false, 'never subscribes to its own user id');
});

test('subscribeUser ignores disallowed users', () => {
  let subscribed = false;
  const deps = makeDeps({ isAllowed: () => false });
  const { subscribeUser } = createVoiceIO(deps);
  const receiver = { subscribe: () => { subscribed = true; return { on: () => {}, pipe: () => ({ pipe: () => ({}) }) }; } };
  subscribeUser(receiver, 'someone-else');
  assert.equal(subscribed, false);
});
