import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRestartDetail, formatRestartCompleteNotice, formatRestartShutdownNotice } from './restart_notice.mjs';

test('restart complete notice follows English TTS voice so Edge can synthesize it', () => {
  const notice = formatRestartCompleteNotice('English speech detection fixed.', 'en-US-GuyNeural');
  assert.equal(notice.text, '✅ Restart complete. I am back online. Applied: English speech detection fixed.');
  assert.equal(notice.speech, 'Restart complete. I am back online. English speech detection fixed.');
});

test('restart complete notice stays Korean for Korean TTS voice', () => {
  const notice = formatRestartCompleteNotice('영어 STT 정리 버그 수정.', 'ko-KR-SunHiNeural');
  assert.equal(notice.text, '✅ 재시작 완료. 다시 온라인이야. 적용 내용: 영어 STT 정리 버그 수정.');
  assert.equal(notice.speech, '재시작 완료. 다시 온라인이야. 영어 STT 정리 버그 수정.');
});

test('shutdown restart notice follows English TTS voice', () => {
  assert.equal(
    formatRestartShutdownNotice('English speech detection fixed.', 'en-US-GuyNeural'),
    'I applied this change: English speech detection fixed. Restarting now. Voice may cut out briefly.',
  );
});

test('restart detail strips restart boilerplate before formatting', () => {
  assert.equal(
    cleanRestartDetail('에이전트 안내 고쳤어. 이제 재시작할게. 잠깐 음성이 끊길 수 있어.', 'ko-KR-InJoonNeural'),
    '에이전트 안내 고쳤어.',
  );
  assert.equal(
    formatRestartShutdownNotice('에이전트 안내 고쳤어. 이제 재시작할게. 잠깐 음성이 끊길 수 있어.', 'ko-KR-InJoonNeural'),
    '방금 한 작업은 에이전트 안내 고쳤어. 이제 재시작할게. 잠깐 음성이 끊길 수 있어.',
  );
  assert.equal(
    formatRestartCompleteNotice('에이전트 안내 고쳤어. 이제 재시작할게. 잠깐 음성이 끊길 수 있어.', 'ko-KR-InJoonNeural').speech,
    '재시작 완료. 다시 온라인이야. 에이전트 안내 고쳤어.',
  );
});

test('Korean restart detail strips stale English restart boilerplate', () => {
  assert.equal(
    cleanRestartDetail('I applied this change: OmniVoice 한국어 설정 반영. Restarting now. Voice may cut out briefly.', 'ko-KR-InJoonNeural'),
    'OmniVoice 한국어 설정 반영.',
  );
  assert.equal(
    formatRestartCompleteNotice('I applied this change: OmniVoice 한국어 설정 반영. Restarting now. Voice may cut out briefly.', 'ko-KR-InJoonNeural').speech,
    '재시작 완료. 다시 온라인이야. OmniVoice 한국어 설정 반영.',
  );
});
