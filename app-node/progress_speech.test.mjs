import test from 'node:test';
import assert from 'node:assert/strict';

import { progressCategory, progressDetail, summarizeProgressEvents, formatProgressMessage } from './progress_speech.mjs';

test('progressCategory maps raw verbose events to stable cache-friendly buckets', () => {
  assert.equal(progressCategory('파일 읽기 app-node/main.mjs').key, 'read');
  assert.equal(progressCategory('터미널 명령 실행 npm test').key, 'test');
  assert.equal(progressCategory('웹 검색 VerbalCoding setup').key, 'search');
  assert.equal(progressCategory('스킬 사용 discord-voice-hermes-bridge').key, 'skill');
});

test('progressDetail preserves the meaningful task name after the generic prefix', () => {
  assert.equal(progressDetail('파일 수정 재시작 안내 문구 개선'), '파일 수정 재시작 안내 문구 개선');
  assert.equal(progressDetail('터미널 실행 음성봇 재시작 적용'), '터미널 실행 음성봇 재시작 적용');
});

test('formatProgressMessage renders intermediate text in the selected English language', () => {
  assert.equal(formatProgressMessage('파일 읽기 app-node/main.mjs', { language: 'en' }), '📖 reading files');
  assert.equal(formatProgressMessage('터미널 명령 실행 npm test', { language: 'en' }), '🧪 running tests npm test');
  assert.equal(formatProgressMessage('파일 수정 재시작 안내 문구 개선', { language: 'en' }), '✏️ editing files');
});

test('agent progress events format as visible and speakable status', () => {
  assert.equal(formatProgressMessage('Hermes Agent 호출 시작'), '🤖 에이전트 처리');
  assert.equal(summarizeProgressEvents(['Hermes Agent 호출 시작']), '에이전트 처리 중이야.');
});

test('summarizeProgressEvents batches many raw events with meaningful details', () => {
  const text = summarizeProgressEvents([
    '파일 읽기 app-node/main.mjs',
    '파일 수정 재시작 안내 문구 개선',
    '웹 검색 VerbalCoding setup',
    '터미널 명령 실행 npm test',
  ]);
  assert.equal(text, '파일 읽기, 파일 수정 재시작 안내 문구 개선, 검색 VerbalCoding setup 외 1개 작업 중이야.');
});

test('summarizeProgressEvents caps spoken details to keep latency low', () => {
  const text = summarizeProgressEvents([
    '파일 읽기 app-node/main.mjs',
    '웹 검색 VerbalCoding setup',
    '테스트 실행 npm test',
    '스킬 사용 discord-voice-hermes-bridge',
    '브라우저 확인 settings page',
  ], { maxCategories: 3 });
  assert.equal(text, '파일 읽기, 검색 VerbalCoding setup, 테스트 실행 npm test 외 2개 작업 중이야.');
});
