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

test('playback barge-in can confirm on a shorter, quieter utterance', () => {
  const pcmBytes = 48000 * 2 * 2 * 0.45;
  const events = [];
  const monitor = createLiveBargeInMonitor({
    minBytes: pcmBytes,
    minMeanDb: -42,
    minMaxDb: -22,
    onConfirm: event => events.push(event),
  });

  assert.equal(monitor.push(pcmWithConstantSample(5000, pcmBytes / 2)), true);
  assert.equal(events.length, 1);
  assert.equal(events[0].pcmBytes, pcmBytes);
  assert.ok(events[0].levels.maxDb > -22);
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

test('default barge-in thresholds are intentionally less sensitive than utterance detection', () => {
  const normal = bargeInThresholdsForMode('normal');
  const conservative = bargeInThresholdsForMode('conservative');

  assert.equal(normal.minBytes, 48000 * 2 * 2 * 1.4);
  assert.equal(normal.minMeanDb, -30);
  assert.equal(normal.minMaxDb, -14);
  assert.equal(conservative.minBytes, 48000 * 2 * 2 * 1.8);
  assert.equal(conservative.minMeanDb, -27);
  assert.equal(conservative.minMaxDb, -12);
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
  assert.equal(conservative.minBytes, 48000 * 2 * 2 * 1.8);
  assert.equal(conservative.minMeanDb, -27);
  assert.equal(conservative.minMaxDb, -12);
});

test('sensitivityModeFromTranscript detects temporary outdoor and indoor mode requests', () => {
  assert.deepEqual(sensitivityModeFromTranscript('밖이라 시끄러워 감도 낮춰'), { mode: 'conservative', reason: 'outdoor' });
  assert.deepEqual(sensitivityModeFromTranscript('외부 보수 모드 켜'), { mode: 'conservative', reason: 'outdoor' });
  assert.deepEqual(sensitivityModeFromTranscript('이제 실내니까 평소 감도로 해'), { mode: 'normal', reason: 'indoor' });
  assert.equal(sensitivityModeFromTranscript('그냥 다음 작업 해줘'), null);
});

test('sensitivityModeFromTranscript ignores complaints that mention sensitivity mode', () => {
  assert.equal(sensitivityModeFromTranscript('누가 외부 보수 모드로 바꾸랬어?'), null);
  assert.equal(sensitivityModeFromTranscript('끼어들기 민감도 설정을 너무 멍청하게 해놨잖아'), null);
  assert.equal(sensitivityModeFromTranscript('외부 보수 모드로 바꾸라는 말 아니야'), null);
});

test('isRepeatedNoiseTranscript rejects short repeated syllable noise', () => {
  assert.equal(isRepeatedNoiseTranscript('너덜너덜너덜'), true);
  assert.equal(isRepeatedNoiseTranscript('쒸'), true);
  assert.equal(isRepeatedNoiseTranscript('잠깐 잠깐 멈춰'), false);
});

test('isRepeatedNoiseTranscript keeps common short valid Korean utterances', () => {
  assert.equal(isRepeatedNoiseTranscript('안녕!'), false);
  assert.equal(isRepeatedNoiseTranscript('네'), false);
  assert.equal(isRepeatedNoiseTranscript('응'), false);
  assert.equal(isRepeatedNoiseTranscript('그래'), false);
});

test('isRepeatedNoiseTranscript keeps real English sentences with repeated words or low unique ratio', () => {
  assert.equal(isRepeatedNoiseTranscript('Fuck you. Fuck you.'), false);
  assert.equal(isRepeatedNoiseTranscript("The problem is, you ignore my speech sometimes. That's the fucking problem."), false);
  assert.equal(isRepeatedNoiseTranscript("I found the problem. You don't detect my speech."), false);
});

test('isExplicitBargeInTranscript only treats clear stop phrases as processing interrupts', () => {
  assert.equal(isExplicitBargeInTranscript('잠깐 잠깐 멈춰'), true);
  assert.equal(isExplicitBargeInTranscript('그만 말해'), true);
  assert.equal(isExplicitBargeInTranscript('stop talking'), true);
  assert.equal(isExplicitBargeInTranscript('shut up'), true);
  assert.equal(isExplicitBargeInTranscript('cancel this'), true);
  assert.equal(isExplicitBargeInTranscript('시청해 주셔서 감사합니다'), false);
  assert.equal(isExplicitBargeInTranscript('너덜너덜너덜'), false);
});


test('shouldUseLivePlaybackBargeIn avoids aborting an active agent during progress TTS', () => {
  assert.equal(shouldUseLivePlaybackBargeIn({ speaking: true, processing: false }), true);
  assert.equal(shouldUseLivePlaybackBargeIn({ speaking: true, processing: true }), false);
  assert.equal(shouldUseLivePlaybackBargeIn({ speaking: false, processing: true }), false);
});
