import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatSttStartMessage,
  formatSttResultMessage,
  formatWakeRejectedMessage,
  formatVoiceErrorMessage,
  sensitivityStatusTextForLanguage,
  verboseStatusTextForLanguage,
} from './voice_messages.mjs';

test('voice-mode status messages use English when voice language is English', () => {
  assert.equal(formatSttStartMessage('en'), '🎧 Transcribing your speech now.');
  assert.equal(formatSttResultMessage('en', '123', 'hello'), '📝 STT result <@123>: hello');
  assert.equal(formatWakeRejectedMessage('en'), 'Wake word missing: I will not respond.');
  assert.equal(formatVoiceErrorMessage('en', 'edge failed'), '⚠️ Voice processing failed: edge failed');
});

test('voice-mode status messages use Korean when voice language is Korean', () => {
  assert.equal(formatSttStartMessage('ko'), '🎧 음성을 텍스트로 변환하는 중이야.');
  assert.equal(formatSttResultMessage('ko', '123', '안녕'), '📝 STT 결과 <@123>: 안녕');
  assert.equal(formatWakeRejectedMessage('ko'), 'wake word 없음: 응답은 안 함');
  assert.equal(formatVoiceErrorMessage('ko', '실패'), '⚠️ 음성 처리 실패: 실패');
});

test('verbose and sensitivity status messages are localized', () => {
  const thresholds = { mode: 'normal', minBytes: 48000 * 2 * 2 * 1.4, minMeanDb: -30, minMaxDb: -14 };
  assert.match(verboseStatusTextForLanguage(true, 'en'), /^Verbose progress mode: on/);
  assert.match(verboseStatusTextForLanguage(false, 'ko'), /^verbose 진행 모드: 꺼짐/);
  assert.match(sensitivityStatusTextForLanguage(thresholds, 0, 'en'), /^Sensitivity mode: normal/);
  assert.match(sensitivityStatusTextForLanguage(thresholds, 0, 'ko'), /^감도 모드: normal/);
});
