import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  voiceCloneCommandFromText,
  createVoiceCloneCaptureState,
  isVoiceCloneCaptureArmedFor,
  saveVoiceCloneReference,
} from './voice_clone_capture.mjs';

test('voiceCloneCommandFromText detects Korean voice commands for arming capture', () => {
  assert.equal(voiceCloneCommandFromText('내 목소리 샘플 녹음 시작해').action, 'start');
  assert.equal(voiceCloneCommandFromText('보이스 클로닝 샘플 저장 취소').action, 'cancel');
  assert.equal(voiceCloneCommandFromText('보이스 클론 상태 알려줘').action, 'status');
  assert.equal(voiceCloneCommandFromText('그냥 테스트야'), null);
});

test('createVoiceCloneCaptureState arms and consumes only the requested user', () => {
  const state = createVoiceCloneCaptureState({ defaultTargetPath: '/project/voice-samples/user-reference.wav' });
  const armed = state.arm({ userId: 'u1', source: 'voice-command' });

  assert.equal(armed.targetPath, '/project/voice-samples/user-reference.wav');
  assert.equal(isVoiceCloneCaptureArmedFor(state, 'u1'), true);
  assert.equal(isVoiceCloneCaptureArmedFor(state, 'u2'), false);
  assert.equal(state.consume('u2'), null);
  assert.equal(state.consume('u1').source, 'voice-command');
  assert.equal(isVoiceCloneCaptureArmedFor(state, 'u1'), false);
});

test('saveVoiceCloneReference normalizes the captured Discord WAV with ffmpeg', async () => {
  const calls = [];
  const target = '/project/voice-samples/user-reference.wav';
  await saveVoiceCloneReference({
    sourceWav: '/tmp/utterance.wav',
    targetPath: target,
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
    mkdirSync: dir => calls.push({ mkdir: dir }),
    existsSync: () => true,
    statSync: () => ({ size: 12345 }),
  });

  assert.equal(calls[0].mkdir, path.dirname(target));
  assert.equal(calls[1].cmd, 'ffmpeg');
  assert.deepEqual(calls[1].args.slice(0, 6), ['-y', '-hide_banner', '-loglevel', 'error', '-i', '/tmp/utterance.wav']);
  assert.ok(calls[1].args.includes('-ac'));
  assert.ok(calls[1].args.includes('1'));
  assert.ok(calls[1].args.includes('-ar'));
  assert.ok(calls[1].args.includes('16000'));
  assert.equal(calls[1].args.at(-1), target);
});
