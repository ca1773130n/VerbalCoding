import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanDispatcher } from './plan_dispatcher.mjs';
import { createBridge } from './bridge_context.mjs';

const noop = () => {};
const noopAsync = async () => {};

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  return {
    bridge,
    settings: { voiceLanguage: 'ko', transcriptChannelId: 'tx-ch', agent: { backend: 'hermes', label: 'hermes' } },
    sendText: noopAsync,
    speakText: noopAsync,
    routingStateFor: () => ({
      activeRouting: { backend: 'hermes', sticky: false },
      lastUsedBackend: 'hermes',
      lastResolvedDecisions: {},
      pendingFallbackPrompt: null,
      recentUtterances: [],
    }),
    adapterForBackend: () => null,
    adapterForProjectSession: () => ({ label: 'hermes', backend: 'hermes', ask: async () => '' }),
    resolveProjectSessionForChannel: () => null,
    isAgentRoutingDecision: () => false,
    parseDecisionAnswer: () => ({ type: 'unknown' }),
    parsePlanVoiceCommand: () => ({ type: 'unknown' }),
    applyPlanCommand: s => s,
    parsePlanOutput: () => ({ steps: [], decisions: [] }),
    renderDecisionPrompt: d => d?.text || '',
    renderResolvedDecisions: () => '',
    renderFinalPlan: () => '',
    planModePreamble: () => 'plan-preamble',
    planExecutionPreamble: () => 'exec-preamble',
    isPlanEntryUtterance: () => false,
    ...overrides,
  };
}

test('createPlanDispatcher exposes the expected functions', () => {
  const d = createPlanDispatcher(makeDeps());
  for (const name of ['planChannelKey', 'askNextDecision', 'finalizePlanReady', 'dispatchPlanModeUtterance', 'planNarrationLines']) {
    assert.equal(typeof d[name], 'function', `${name} is exposed`);
  }
});

test('planChannelKey prefers active voice channel, then transcript, then default', () => {
  const deps = makeDeps();
  const { planChannelKey } = createPlanDispatcher(deps);
  assert.equal(planChannelKey(), 'tx-ch');
  deps.bridge.activeVoiceChannelId = 'vc-1';
  assert.equal(planChannelKey(), 'vc-1');
  deps.bridge.activeVoiceChannelId = '';
  deps.settings.transcriptChannelId = '';
  assert.equal(planChannelKey(), 'default');
});

test('planNarrationLines numbers visible steps and skips dropped ones', () => {
  const { planNarrationLines } = createPlanDispatcher(makeDeps());
  const steps = [
    { text: 'first', status: 'pending' },
    { text: 'dropped', status: 'skipped' },
    { text: 'third', status: 'pending' },
  ];
  const out = planNarrationLines(steps, 'en');
  assert.match(out, /2 steps/, 'header counts visible only');
  assert.match(out, /1\. first/);
  assert.match(out, /2\. third/);
  assert.doesNotMatch(out, /dropped/);
});

test('dispatchPlanModeUtterance returns handled:false when not a plan entry and no existing plan', async () => {
  const deps = makeDeps({
    isPlanEntryUtterance: () => false,
  });
  const { dispatchPlanModeUtterance } = createPlanDispatcher(deps);
  const out = await dispatchPlanModeUtterance('hello world', new AbortController().signal);
  assert.deepEqual(out, { handled: false, prompt: 'hello world' });
});

test('dispatchPlanModeUtterance handles cancel command on existing pending decision', async () => {
  const deps = makeDeps({
    parsePlanVoiceCommand: text => /cancel/.test(text) ? { type: 'cancel' } : { type: 'unknown' },
  });
  // Seed a plan with one pending decision so the cancel branch can fire.
  const { dispatchPlanModeUtterance, planChannelKey } = createPlanDispatcher(deps);
  const key = planChannelKey();
  deps.bridge.planStates.set(key, {
    steps: [{ text: 's1', status: 'pending' }],
    decisions: [{ slot: 'oauth_provider', options: ['google', 'github'] }],
    pendingDecisionIndex: 0,
    resolvedDecisions: {},
    language: 'en',
    routingSnapshot: null,
  });
  const out = await dispatchPlanModeUtterance('cancel this', new AbortController().signal);
  assert.equal(out.handled, true);
  // Plan state should be cleared after cancel.
  assert.equal(deps.bridge.planStates.has(key), false);
});
