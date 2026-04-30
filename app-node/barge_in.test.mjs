import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bargeInThresholdsForMode,
  createLiveBargeInMonitor,
  isBargeInCandidate,
  isRepeatedNoiseTranscript,
  isExplicitBargeInTranscript,
  shouldUseLivePlaybackBargeIn,
  pcm16StereoLevels,
  sensitivityModeFromTranscript,
} from './barge_in.mjs';

function pcmWithConstantSample(sample, sampleCount) {
  const buf = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i += 1) buf.writeInt16LE(sample, i * 2);
  return buf;
}

test('isBargeInCandidate requires enough buffered audio before confirming', () => {
  assert.equal(
    isBargeInCandidate(100, { meanDb: -10, maxDb: -3 }, { minBytes: 200, minMeanDb: -35, minMaxDb: -18 }),
    false,
  );
  assert.equal(
    isBargeInCandidate(200, { meanDb: -10, maxDb: -3 }, { minBytes: 200, minMeanDb: -35, minMaxDb: -18 }),
    true,
  );
});

test('pcm16StereoLevels reports silence as negative infinity', () => {
  const levels = pcm16StereoLevels(Buffer.alloc(480));
  assert.equal(levels.meanDb, -Infinity);
  assert.equal(levels.maxDb, -Infinity);
  assert.equal(levels.sampleCount, 240);
});

test('createLiveBargeInMonitor confirms while audio stream is still active', () => {
  const events = [];
  const monitor = createLiveBargeInMonitor({
    minBytes: 400,
    minMeanDb: -35,
    minMaxDb: -18,
    onConfirm: event => events.push(event),
  });

  assert.equal(monitor.push(pcmWithConstantSample(12000, 100)), false);
  assert.equal(events.length, 0);
  assert.equal(monitor.push(pcmWithConstantSample(12000, 100)), true);

  assert.equal(events.length, 1);
  assert.equal(events[0].pcmBytes, 400);
  assert.ok(events[0].levels.meanDb > -12);
  assert.equal(monitor.confirmed, true);
});

test('createLiveBargeInMonitor ignores low-volume candidates after minimum duration', () => {
  const events = [];
  const monitor = createLiveBargeInMonitor({
    minBytes: 400,
    minMeanDb: -35,
    minMaxDb: -18,
    onConfirm: event => events.push(event),
  });

  assert.equal(monitor.push(pcmWithConstantSample(120, 200)), false);

  assert.equal(events.length, 0);
  assert.equal(monitor.confirmed, false);
});

test('conservative sensitivity requires a longer barge-in than normal mode', () => {
  const normal = bargeInThresholdsForMode('normal', {
    minSeconds: 0.9,
    minMeanDb: -35,
    minMaxDb: -18,
  });
  const conservative = bargeInThresholdsForMode('conservative', {
    minSeconds: 0.9,
    minMeanDb: -35,
    minMaxDb: -18,
  });

  assert.equal(normal.minBytes, 48000 * 2 * 2 * 0.9);
  assert.equal(conservative.minBytes, 48000 * 2 * 2 * 1.4);
  assert.equal(conservative.minMeanDb, -30);
  assert.equal(conservative.minMaxDb, -14);
});

test('sensitivityModeFromTranscript detects temporary outdoor and indoor mode requests', () => {
  assert.deepEqual(sensitivityModeFromTranscript('나 지금 외부라서 감도 낮춰줘'), { mode: 'conservative', reason: 'outdoor' });
  assert.deepEqual(sensitivityModeFromTranscript('이제 실내니까 평소 감도로 해'), { mode: 'normal', reason: 'indoor' });
  assert.equal(sensitivityModeFromTranscript('그냥 다음 작업 해줘'), null);
});

test('isRepeatedNoiseTranscript rejects short repeated syllable noise', () => {
  assert.equal(isRepeatedNoiseTranscript('너덜너덜너덜'), true);
  assert.equal(isRepeatedNoiseTranscript('쒸'), true);
  assert.equal(isRepeatedNoiseTranscript('잠깐 잠깐 멈춰'), false);
});

test('isExplicitBargeInTranscript only treats clear stop phrases as processing interrupts', () => {
  assert.equal(isExplicitBargeInTranscript('잠깐 잠깐 멈춰'), true);
  assert.equal(isExplicitBargeInTranscript('그만 말해'), true);
  assert.equal(isExplicitBargeInTranscript('시청해 주셔서 감사합니다'), false);
  assert.equal(isExplicitBargeInTranscript('너덜너덜너덜'), false);
});


test('shouldUseLivePlaybackBargeIn avoids aborting an active agent during progress TTS', () => {
  assert.equal(shouldUseLivePlaybackBargeIn({ speaking: true, processing: false }), true);
  assert.equal(shouldUseLivePlaybackBargeIn({ speaking: true, processing: true }), false);
  assert.equal(shouldUseLivePlaybackBargeIn({ speaking: false, processing: true }), false);
});
