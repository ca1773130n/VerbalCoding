import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAgentRoutingCommand, resolveBackendAlias,
  renderAgentPrefix, buildCrossAgentPrompt,
} from './agent_routing.mjs';
import { parseDecisionAnswer } from './plan_mode.mjs';

test('routing pipeline: ask Codex resolves to single-turn route', () => {
  const cmd = parseAgentRoutingCommand('ask Codex what it thinks', 'en');
  assert.equal(cmd.type, 'route');
  assert.equal(cmd.backend, 'codex');
  assert.equal(cmd.sticky, false);
});

test('routing pipeline: switch to Aider resolves to sticky route', () => {
  const cmd = parseAgentRoutingCommand('switch to Aider', 'en');
  assert.equal(cmd.type, 'route');
  assert.equal(cmd.backend, 'aider');
  assert.equal(cmd.sticky, true);
});

test('routing pipeline: alias resolves Claude Code to claude', () => {
  assert.equal(resolveBackendAlias('Claude Code'), 'claude');
});

test('routing pipeline: prefix changes only when backend changes', () => {
  let last = 'claude';
  let next = 'codex';
  let prefix = last === next ? '' : renderAgentPrefix(next, 'en');
  assert.equal(prefix, 'Codex says: ');
  last = next;
  next = 'codex';
  prefix = last === next ? '' : renderAgentPrefix(next, 'en');
  assert.equal(prefix, '');
});

test('routing pipeline: cross-agent prompt carries prior decisions', () => {
  const out = buildCrossAgentPrompt({
    prompt: 'finish the OAuth wire-up',
    fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: { oauth_provider: 'github' },
    priorUtterances: ['plan it first'],
    language: 'en',
  });
  assert.match(out, /from Claude Code to Codex/);
  assert.match(out, /oauth_provider=github/);
});

test('which_agent decision: voice answer maps to backend name', () => {
  const decision = { slot: 'which_agent', question: 'Who?', options: ['codex', 'aider'] };
  assert.equal(parseDecisionAnswer('codex', decision, 'en').choice, 'codex');
});

test('which_agent decision: ordinal answer maps to backend', () => {
  const decision = { slot: 'which_agent', question: 'Who?', options: ['codex', 'aider', 'claude'] };
  assert.equal(parseDecisionAnswer('the third one', decision, 'en').choice, 'claude');
});

test('e2e composition: ask Codex single-turn, then back to default', () => {
  const turn1 = parseAgentRoutingCommand('ask Codex what it thinks', 'en');
  assert.equal(turn1.type, 'route');
  assert.equal(turn1.sticky, false);
  const prompt = buildCrossAgentPrompt({
    prompt: 'ask Codex what it thinks',
    fromBackend: 'claude', toBackend: turn1.backend,
    resolvedDecisions: {}, priorUtterances: [], language: 'en',
  });
  assert.match(prompt, /from Claude Code to Codex/);
  const turn2 = parseAgentRoutingCommand('also add a test', 'en');
  assert.equal(turn2.type, 'none');
});

test('e2e composition: switch sticky until restore', () => {
  assert.equal(parseAgentRoutingCommand('switch to Aider', 'en').sticky, true);
  assert.equal(parseAgentRoutingCommand('write the test', 'en').type, 'none');
  assert.equal(parseAgentRoutingCommand('back to default', 'en').type, 'restore');
});
