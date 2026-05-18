import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAgentRoutingCommand,
  resolveBackendAlias,
  isAgentRoutingDecision,
  renderAgentPrefix,
  buildCrossAgentPrompt,
  buildFallbackDecision,
  isRoutingOnlyUtterance,
} from './agent_routing.mjs';

test('parseAgentRoutingCommand recognizes "ask X" as single-turn', () => {
  assert.deepEqual(parseAgentRoutingCommand('ask Codex what it thinks', 'en'),
    { type: 'route', backend: 'codex', sticky: false });
  assert.deepEqual(parseAgentRoutingCommand('ask aider to write the test', 'en'),
    { type: 'route', backend: 'aider', sticky: false });
});

test('parseAgentRoutingCommand recognizes "switch to X" as sticky', () => {
  assert.deepEqual(parseAgentRoutingCommand('switch to Aider', 'en'),
    { type: 'route', backend: 'aider', sticky: true });
  assert.deepEqual(parseAgentRoutingCommand('switch to claude code', 'en'),
    { type: 'route', backend: 'claude', sticky: true });
});

test('parseAgentRoutingCommand recognizes Korean routing phrases', () => {
  assert.deepEqual(parseAgentRoutingCommand('코덱스한테 물어봐', 'ko'),
    { type: 'route', backend: 'codex', sticky: false });
  assert.deepEqual(parseAgentRoutingCommand('aider로 전환해', 'ko'),
    { type: 'route', backend: 'aider', sticky: true });
});

test('parseAgentRoutingCommand recognizes restore-default phrases', () => {
  assert.deepEqual(parseAgentRoutingCommand('back to default', 'en'),
    { type: 'restore' });
  assert.deepEqual(parseAgentRoutingCommand('use the default agent', 'en'),
    { type: 'restore' });
  assert.deepEqual(parseAgentRoutingCommand('기본으로 돌아가', 'ko'),
    { type: 'restore' });
});

test('parseAgentRoutingCommand returns none on unrelated input', () => {
  assert.deepEqual(parseAgentRoutingCommand('just write the function', 'en'),
    { type: 'none' });
  assert.deepEqual(parseAgentRoutingCommand('plan it first', 'en'),
    { type: 'none' });
});

test('resolveBackendAlias maps user-facing names to canonical backends', () => {
  assert.equal(resolveBackendAlias('Claude Code'), 'claude');
  assert.equal(resolveBackendAlias('claude'), 'claude');
  assert.equal(resolveBackendAlias('cursor cli'), 'cursor');
  assert.equal(resolveBackendAlias('gemini cli'), 'gemini');
  assert.equal(resolveBackendAlias('코덱스'), 'codex');
  assert.equal(resolveBackendAlias('unknown'), null);
});

test('isAgentRoutingDecision detects which_agent slot', () => {
  assert.equal(isAgentRoutingDecision({ slot: 'which_agent', options: ['codex', 'aider'] }), true);
  assert.equal(isAgentRoutingDecision({ slot: 'oauth_provider', options: ['google', 'github'] }), false);
  assert.equal(isAgentRoutingDecision({ slot: 'agent', options: ['codex', 'aider'] }), true);
  assert.equal(isAgentRoutingDecision(null), false);
});

test('renderAgentPrefix uses English label for en', () => {
  assert.equal(renderAgentPrefix('codex', 'en'), 'Codex says: ');
  assert.equal(renderAgentPrefix('claude', 'en'), 'Claude Code says: ');
});

test('renderAgentPrefix uses Korean label for ko', () => {
  assert.equal(renderAgentPrefix('codex', 'ko'), '코덱스: ');
  assert.equal(renderAgentPrefix('claude', 'ko'), 'Claude Code: ');
});

test('renderAgentPrefix returns empty when backend unknown', () => {
  assert.equal(renderAgentPrefix('', 'en'), '');
  assert.equal(renderAgentPrefix(null, 'en'), '');
  assert.equal(renderAgentPrefix('unknownbackend', 'en'), '');
});

test('buildCrossAgentPrompt prepends handoff block in English', () => {
  const out = buildCrossAgentPrompt({
    prompt: 'Refactor the login route to use OAuth.',
    fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: { oauth_provider: 'github' },
    priorUtterances: ['plan it first', 'skip step 2'],
    language: 'en',
  });
  assert.match(out, /Cross-agent handoff from Claude Code to Codex/);
  assert.match(out, /Prior decisions: oauth_provider=github/);
  assert.match(out, /Recent user voice: plan it first \| skip step 2/);
  assert.match(out, /User request: Refactor the login route to use OAuth\./);
});

test('buildCrossAgentPrompt omits empty sections', () => {
  const out = buildCrossAgentPrompt({
    prompt: 'do it', fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: {}, priorUtterances: [], language: 'en',
  });
  assert.doesNotMatch(out, /Prior decisions:/);
  assert.doesNotMatch(out, /Recent user voice:/);
  assert.match(out, /User request: do it/);
});

test('buildCrossAgentPrompt renders Korean header for ko', () => {
  const out = buildCrossAgentPrompt({
    prompt: '로그인 라우트 리팩토링해줘',
    fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: {}, priorUtterances: [], language: 'ko',
  });
  assert.match(out, /에이전트 핸드오프: Claude Code → 코덱스/);
  assert.match(out, /사용자 요청: 로그인 라우트 리팩토링해줘/);
});

test('buildFallbackDecision yields a yes/no shape', () => {
  const d = buildFallbackDecision('codex', 'Claude Code', 'en');
  assert.equal(d.slot, 'fallback');
  assert.deepEqual(d.options, ['yes', 'no']);
  assert.match(d.question, /codex/);
  assert.match(d.question, /Claude Code/);
});

test('buildFallbackDecision yields a Korean prompt for ko', () => {
  const d = buildFallbackDecision('codex', 'Claude Code', 'ko');
  assert.match(d.question, /codex/);
  assert.match(d.question, /Claude Code/);
});

test('isRoutingOnlyUtterance detects command-only utterances', () => {
  assert.equal(isRoutingOnlyUtterance('switch to codex'), true);
  assert.equal(isRoutingOnlyUtterance('switch to Aider.'), true);
  assert.equal(isRoutingOnlyUtterance('back to default'), true);
  assert.equal(isRoutingOnlyUtterance('codex로 전환'), true);
  assert.equal(isRoutingOnlyUtterance('기본으로 돌아가'), true);
  assert.equal(isRoutingOnlyUtterance('switch to codex and write a test'), false);
  assert.equal(isRoutingOnlyUtterance('ask codex what it thinks'), false);
});
