import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePlanOutput,
  parseVoiceCommand,
  applyCommand,
  renderFinalPlan,
  isPlanEntryUtterance,
  planModePreamble,
} from './plan_mode.mjs';

test('parsePlanOutput extracts numbered steps between markers', () => {
  const out = parsePlanOutput('intro\nPLAN_BEGIN\n1. Read auth.ts\n2. Add login route\n3. Write test\nPLAN_END\nthanks');
  assert.deepEqual(out.map(s => s.text), ['Read auth.ts', 'Add login route', 'Write test']);
  assert.equal(out[0].status, 'pending');
  assert.equal(out[0].id, 1);
});

test('parsePlanOutput returns empty when markers missing', () => {
  assert.deepEqual(parsePlanOutput('no plan here'), []);
});

test('parseVoiceCommand recognizes skip in en and ko', () => {
  assert.deepEqual(parseVoiceCommand('skip step 3', 'en'), { type: 'skip', index: 3 });
  assert.deepEqual(parseVoiceCommand('step 2 건너뛰어', 'ko'), { type: 'skip', index: 2 });
});

test('parseVoiceCommand recognizes insert in en', () => {
  assert.deepEqual(parseVoiceCommand('add write a test after step 1', 'en'), { type: 'insert', after: 1, text: 'write a test' });
});

test('parseVoiceCommand recognizes insert in ko', () => {
  assert.deepEqual(parseVoiceCommand('step 2 다음에 테스트 작성 추가', 'ko'), { type: 'insert', after: 2, text: '테스트 작성' });
});

test('parseVoiceCommand recognizes approve in both languages', () => {
  assert.deepEqual(parseVoiceCommand('approve', 'en'), { type: 'approve' });
  assert.deepEqual(parseVoiceCommand('go ahead', 'en'), { type: 'approve' });
  assert.deepEqual(parseVoiceCommand('실행', 'ko'), { type: 'approve' });
});

test('parseVoiceCommand recognizes cancel', () => {
  assert.deepEqual(parseVoiceCommand('cancel', 'en'), { type: 'cancel' });
  assert.deepEqual(parseVoiceCommand('취소', 'ko'), { type: 'cancel' });
});

test('parseVoiceCommand falls through to unknown', () => {
  assert.deepEqual(parseVoiceCommand('what is the meaning of life', 'en'), { type: 'unknown' });
});

test('applyCommand skip marks status', () => {
  const steps = [{ id: 1, text: 'a', status: 'pending' }, { id: 2, text: 'b', status: 'pending' }];
  const after = applyCommand(steps, { type: 'skip', index: 2 });
  assert.equal(after[1].status, 'skipped');
});

test('applyCommand insert places new step after target', () => {
  const steps = [{ id: 1, text: 'a', status: 'pending' }, { id: 2, text: 'b', status: 'pending' }];
  const after = applyCommand(steps, { type: 'insert', after: 1, text: 'extra' });
  assert.equal(after.length, 3);
  assert.equal(after[1].text, 'extra');
  assert.equal(after[1].status, 'added');
  assert.equal(after[2].text, 'b');
});

test('renderFinalPlan skips skipped steps and renumbers', () => {
  const steps = [
    { id: 1, text: 'a', status: 'pending' },
    { id: 2, text: 'b', status: 'skipped' },
    { id: 3, text: 'c', status: 'pending' },
  ];
  assert.equal(renderFinalPlan(steps), '1. a\n2. c');
});

test('isPlanEntryUtterance detects entry phrases', () => {
  assert.equal(isPlanEntryUtterance('plan it first', 'en'), true);
  assert.equal(isPlanEntryUtterance('make a plan', 'en'), true);
  assert.equal(isPlanEntryUtterance('먼저 계획 짜줘', 'ko'), true);
  assert.equal(isPlanEntryUtterance('just do it', 'en'), false);
});

test('planModePreamble contains PLAN_BEGIN marker', () => {
  assert.match(planModePreamble('en'), /PLAN_BEGIN/);
  assert.match(planModePreamble('ko'), /PLAN_BEGIN/);
});
