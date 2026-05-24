import test from 'node:test';
import assert from 'node:assert/strict';
import { createUtteranceRouter } from './utterance_router.mjs';
import { createBridge } from './bridge_context.mjs';

function noop() {}
async function noopAsync() {}

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  return {
    bridge,
    log: noop, warn: noop, path: { join: (...a) => a.join('/') }, fs: {},
    ROOT: '/tmp/vc', TTS_VOICE_CONFIG_PATH: '/tmp/voices.json',
    agentAdapter: { label: 'default-agent', backend: 'hermes', readSessionId: () => null },
    settings: {
      voiceLanguage: 'ko', transcriptChannelId: 'tx-ch', agent: { backend: 'hermes', label: 'hermes' }, tts: {},
    },
    isPlanEntryUtterance: () => false,
    parsePlanOutput: () => ({ steps: [], decisions: [] }),
    parsePlanVoiceCommand: () => ({ type: 'unknown' }),
    applyPlanCommand: state => state,
    renderFinalPlan: () => '',
    planModePreamble: () => '',
    planExecutionPreamble: () => '',
    parseDecisionAnswer: () => ({ type: 'unknown' }),
    renderDecisionPrompt: d => d?.text || '',
    renderResolvedDecisions: () => '',
    isAgentRoutingDecision: () => false,
    projectSessionContextText: () => '',
    resolveProjectSessionForChannel: () => null,
    createBridgeAgentAdapter: settings => ({ label: settings?.label || 'fake', backend: settings?.backend || 'hermes' }),
    buildAgentSettings: () => ({ backend: 'hermes', label: 'hermes' }),
    commandIsInstalled: async () => true,
    shellSplit: s => String(s).split(' '),
    sendText: noopAsync, speakText: noopAsync,
    ensureTtsVoiceConfig: () => ({ backends: {} }),
    updateTtsVoiceConfig: c => c,
    writeTtsVoiceConfig: noop,
    applyVoiceConfigToProcessEnv: () => ({ selection: { backend: 'edge', voiceType: 'female', voice: { language: 'ko', voice: 'ko-KR-SunHiNeural' } } }),
    ensureSelectedTtsBackendInstalled: noopAsync,
    rebuildTtsRuntimeSettings: noop,
    voiceCommandFromTranscript: () => null,
    voiceChangedText: () => 'changed',
    voiceLanguageCommandFromTranscript: () => null,
    voiceCloneCommandFromText: () => null,
    voiceCloneCapture: { arm: () => ({ targetPath: '/tmp/sample.wav' }), cancel: () => false, current: () => null },
    notifyVoiceCloneSampleGapIfNeeded: noopAsync,
    languageChangedText: () => 'language',
    applyRuntimeLanguage: noop,
    persistEnvValues: noop,
    discardVoiceInputQueues: () => 0,
    ...overrides,
  };
}

test('createUtteranceRouter exposes the expected functions', () => {
  const router = createUtteranceRouter(makeDeps());
  for (const name of [
    'planChannelKey', 'askNextDecision', 'finalizePlanReady', 'dispatchPlanModeUtterance',
    'planNarrationLines', 'adapterForProjectSession', 'routingStateFor', 'recordUtterance',
    'clearTransientRouting', 'adapterForBackend', 'handleTtsVoiceCommand', 'handleLanguageCommand',
    'handleVoiceCloneCommand', 'interruptCurrentResponse',
  ]) {
    assert.equal(typeof router[name], 'function', `${name} is exposed`);
  }
});

test('planChannelKey prefers active voice channel, then transcript, then default', () => {
  const deps = makeDeps();
  const { planChannelKey } = createUtteranceRouter(deps);
  assert.equal(planChannelKey(), 'tx-ch'); // settings.transcriptChannelId fallback
  deps.bridge.activeVoiceChannelId = 'vc-1';
  assert.equal(planChannelKey(), 'vc-1');
  deps.bridge.activeVoiceChannelId = '';
  deps.settings.transcriptChannelId = '';
  assert.equal(planChannelKey(), 'default');
});

test('routingStateFor lazily creates per-channel state with sensible defaults', () => {
  const deps = makeDeps();
  const { routingStateFor } = createUtteranceRouter(deps);
  const state = routingStateFor('chan-a');
  assert.equal(state.activeRouting.backend, 'hermes');
  assert.equal(state.activeRouting.sticky, false);
  assert.deepEqual(state.lastResolvedDecisions, {});
  assert.equal(state.pendingFallbackPrompt, null);
  assert.deepEqual(state.recentUtterances, []);
  // Same channel returns the same object
  const again = routingStateFor('chan-a');
  assert.equal(state, again);
});

test('recordUtterance pushes to bounded recent buffer per channel', () => {
  const deps = makeDeps();
  const { routingStateFor, recordUtterance } = createUtteranceRouter(deps);
  routingStateFor('c1');
  for (let i = 0; i < 6; i++) recordUtterance('c1', `u${i}`);
  const state = routingStateFor('c1');
  assert.equal(state.recentUtterances.length, 4, 'buffer caps at 4');
  assert.deepEqual(state.recentUtterances, ['u2', 'u3', 'u4', 'u5']);
});

test('clearTransientRouting wipes pending fallback prompt and non-sticky route', () => {
  const deps = makeDeps();
  const { routingStateFor, clearTransientRouting } = createUtteranceRouter(deps);
  const state = routingStateFor('c1');
  state.pendingFallbackPrompt = 'pending';
  state.activeRouting = { backend: 'codex', sticky: false };
  clearTransientRouting('c1');
  const post = routingStateFor('c1');
  assert.equal(post.pendingFallbackPrompt, null);
  assert.equal(post.activeRouting.backend, 'hermes', 'reset to default backend');
});

test('clearTransientRouting leaves sticky routing intact', () => {
  const deps = makeDeps();
  const { routingStateFor, clearTransientRouting } = createUtteranceRouter(deps);
  const state = routingStateFor('c1');
  state.pendingFallbackPrompt = 'pending';
  state.activeRouting = { backend: 'codex', sticky: true };
  clearTransientRouting('c1');
  const post = routingStateFor('c1');
  assert.equal(post.pendingFallbackPrompt, null);
  assert.equal(post.activeRouting.backend, 'codex', 'sticky backend is preserved');
});

test('adapterForProjectSession returns the default adapter when no session', () => {
  const deps = makeDeps();
  const { adapterForProjectSession } = createUtteranceRouter(deps);
  assert.equal(adapterForProjectSession(null), deps.agentAdapter);
});

test('adapterForProjectSession caches per-session adapters', () => {
  const deps = makeDeps();
  const { adapterForProjectSession } = createUtteranceRouter(deps);
  const session = { name: 'My Project', slug: 'my-project', sessionFile: '/tmp/s.json', workdir: '/tmp' };
  const a = adapterForProjectSession(session);
  const b = adapterForProjectSession(session);
  assert.equal(a, b, 'same session returns cached adapter');
  assert.equal(deps.bridge.agentAdaptersBySession.size, 1);
});
