import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePlanOutput,
  parseDecisions,
  parseDecisionAnswer,
  renderDecisionPrompt,
  renderResolvedDecisions,
  parseVoiceCommand,
  applyCommand,
  renderFinalPlan,
  isPlanEntryUtterance,
  planModePreamble,
} from './plan_mode.mjs';

test('parsePlanOutput extracts numbered steps between markers', () => {
  const out = parsePlanOutput('intro\nPLAN_BEGIN\n1. Read auth.ts\n2. Add login route\n3. Write test\nPLAN_END\nthanks');
  assert.deepEqual(out.steps.map(s => s.text), ['Read auth.ts', 'Add login route', 'Write test']);
  assert.equal(out.steps[0].status, 'pending');
  assert.equal(out.steps[0].id, 1);
  assert.deepEqual(out.decisions, []);
});

test('parsePlanOutput returns empty steps when markers missing', () => {
  assert.deepEqual(parsePlanOutput('no plan here'), { steps: [], decisions: [] });
});

test('parsePlanOutput extracts decisions block', () => {
  const text = [
    'PLAN_BEGIN',
    '1. Add OAuth',
    '2. Wire callback',
    'PLAN_END',
    'DECISIONS_BEGIN',
    '- oauth_provider | Which OAuth provider? | google | github | both',
    '- session_store | Where to store sessions? | redis | memory',
    'DECISIONS_END',
  ].join('\n');
  const out = parsePlanOutput(text);
  assert.equal(out.steps.length, 2);
  assert.equal(out.decisions.length, 2);
  assert.equal(out.decisions[0].slot, 'oauth_provider');
  assert.deepEqual(out.decisions[0].options, ['google', 'github', 'both']);
  assert.equal(out.decisions[1].slot, 'session_store');
});

test('parseDecisions skips malformed lines', () => {
  const text = 'DECISIONS_BEGIN\n- bad line\n- ok | question | a | b\nDECISIONS_END';
  const out = parseDecisions(text);
  assert.equal(out.length, 1);
  assert.equal(out[0].slot, 'ok');
});

test('parseDecisionAnswer matches option by name', () => {
  const decision = { slot: 'x', question: 'Pick one', options: ['redis', 'memory'] };
  assert.deepEqual(parseDecisionAnswer('use redis', decision), { type: 'option', choice: 'redis' });
  assert.deepEqual(parseDecisionAnswer('go with memory', decision), { type: 'option', choice: 'memory' });
});

test('parseDecisionAnswer matches by number and ordinal', () => {
  const decision = { slot: 'x', question: 'Pick one', options: ['alpha', 'beta', 'gamma'] };
  assert.deepEqual(parseDecisionAnswer('option 2', decision), { type: 'option', choice: 'beta' });
  assert.deepEqual(parseDecisionAnswer('the first one', decision), { type: 'option', choice: 'alpha' });
  assert.deepEqual(parseDecisionAnswer('세번째', decision), { type: 'option', choice: 'gamma' });
});

test('parseDecisionAnswer detects defer phrases', () => {
  const decision = { slot: 'x', question: 'q', options: ['a', 'b'] };
  assert.equal(parseDecisionAnswer('either is fine', decision).type, 'auto');
  assert.equal(parseDecisionAnswer('you decide', decision).type, 'auto');
  assert.equal(parseDecisionAnswer('아무거나', decision).type, 'auto');
});

test('parseDecisionAnswer returns unknown on no match', () => {
  const decision = { slot: 'x', question: 'q', options: ['alpha', 'beta'] };
  assert.equal(parseDecisionAnswer('hello world', decision).type, 'unknown');
});

test('renderDecisionPrompt formats question with numbered options', () => {
  const decision = { slot: 'x', question: 'Pick auth?', options: ['google', 'github'] };
  assert.match(renderDecisionPrompt(decision, 'en'), /Pick auth\?\s+Options:\s+1\) google\s+2\) github/);
});

test('renderResolvedDecisions handles auto choices', () => {
  const resolved = { provider: 'github', store: null };
  const out = renderResolvedDecisions(resolved, 'en');
  assert.match(out, /provider=github/);
  assert.match(out, /store=\(agent picks\)/);
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
