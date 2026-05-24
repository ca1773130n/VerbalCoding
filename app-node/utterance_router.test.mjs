import test from 'node:test';
import assert from 'node:assert/strict';
import { createUtteranceRouter } from './utterance_router.mjs';
import { createBridge } from './bridge_context.mjs';
import { createAgentTurnLifecycle } from './agent_turn.mjs';

function noop() {}
async function noopAsync() {}

function makeDeps(overrides = {}) {
  const bridge = createBridge();
  // handleRecording's finally block touches bridge.bridgeState.deferredSize();
  // give the tests a minimal stub so the cleanup path doesn't NPE.
  bridge.bridgeState = {
    deferredSize: () => 0,
    currentEpoch: () => 1,
    discardQueues: () => 0,
  };
  const agentTurnLifecycle = createAgentTurnLifecycle({ bridge, warn: noop });
  const agentAdapter = {
    label: 'default-agent',
    backend: 'hermes',
    readSessionId: () => null,
    ask: async () => 'mock agent answer',
  };
  return {
    bridge,
    agentTurnLifecycle,
    log: noop, warn: noop, path: { join: (...a) => a.join('/') }, fs: { rm: (_p, _o, cb) => cb && cb() },
    ROOT: '/tmp/vc', TTS_VOICE_CONFIG_PATH: '/tmp/voices.json',
    agentAdapter,
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
    createBridgeAgentAdapter: s => ({ label: s?.label || 'fake', backend: s?.backend || 'hermes', ask: async () => '' }),
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
    // Phase 4b deps for handleRecording
    transcribe: async () => 'hey hermes do a thing',
    beginStreamingTurn: () => false,
    endStreamingTurn: noopAsync,
    client: { channels: { cache: new Map() } },
    isAllowed: () => true,
    isAbortError: e => e?.name === 'AbortError',
    sleep: async () => {},
    sendEmbed: async () => true,
    speakImmediateNotice: noopAsync,
    reloadRuntimeLanguageFromEnv: () => ({ changed: false, voiceLanguage: 'ko', whisperLanguage: 'ko' }),
    drainDeferredProcessingUtterances: noopAsync,
    maybeNotifyTaskComplete: noopAsync,
    ontologyStateFor: () => ({ nodeCount: 0, serializeForHandoff: () => '' }),
    captureOntologyFromTurn: noop,
    queueProgressSpeechText: noop,
    stopProgressSpeech: noop,
    agentAnswerHeader: () => 'agent says:',
    emptyAgentAnswer: () => '(empty)',
    formatRecentDiscordContext: () => '',
    formatSttResultMessage: (_lang, _uid, text) => `you said: ${text}`,
    formatSttStartMessage: () => '🎧 listening',
    formatVoiceErrorMessage: (_lang, msg) => `error: ${msg}`,
    formatWakeRejectedMessage: () => 'no wake word',
    spokenResultOnly: (_p, answer) => answer,
    stripWake: t => t,
    acceptsWake: () => true,
    sensitivityChangedSpeech: () => 'sensitivity set',
    sensitivityModeFromTranscript: () => null,
    sensitivityStatusText: () => 'normal',
    setSensitivityMode: () => ({ mode: 'normal', minBytes: 0, minMeanDb: -40, minMaxDb: -20 }),
    isSensitivityOnlyRequest: () => false,
    verboseChangedSpeech: () => 'verbose set',
    verboseModeFromTranscript: () => null,
    verboseStatusText: () => 'verbose off',
    setVerboseProgress: noop,
    isVerboseOnlyRequest: () => false,
    isRoutingOnlyUtterance: () => false,
    parseAgentRoutingCommand: () => ({ type: 'none' }),
    renderAgentPrefix: () => '',
    buildCrossAgentPrompt: ({ prompt }) => prompt,
    buildFallbackDecision: () => ({ slot: 'fallback' }),
    parseResearchCommand: () => ({ type: 'none' }),
    runResearchTurn: async () => ({ status: 'no_backend' }),
    PROGRESS_IDLE_CHECK_MS: 5000,
    PROGRESS_IDLE_NOTICE_INITIAL_MS: 10000,
    PROGRESS_IDLE_NOTICE_LIMIT: 20,
    PROGRESS_IDLE_NOTICE_MAX_MS: 30000,
    PROGRESS_IDLE_NOTICE_MULTIPLIER: 1.8,
    STT_START_VOICE_NOTICE: false,
    ...overrides,
  };
}

test('createUtteranceRouter exposes the expected functions', () => {
  const router = createUtteranceRouter(makeDeps());
  for (const name of [
    'planChannelKey', 'askNextDecision', 'finalizePlanReady', 'dispatchPlanModeUtterance',
    'planNarrationLines', 'adapterForProjectSession', 'routingStateFor', 'recordUtterance',
    'clearTransientRouting', 'adapterForBackend', 'handleTtsVoiceCommand', 'handleLanguageCommand',
    'handleVoiceCloneCommand', 'interruptCurrentResponse', 'handleRecording',
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

// --- handleRecording: full flow integration ------------------------------

test('handleRecording happy path: transcribes, asks agent, sends + speaks answer, cleans up', async () => {
  const calls = { transcribe: 0, askPrompt: '', sendText: [], speakText: [], notify: [] };
  const deps = makeDeps({
    transcribe: async wav => { calls.transcribe++; assert.equal(wav, '/tmp/u.wav'); return 'hermes do the thing'; },
    sendText: async t => { calls.sendText.push(t); return true; },
    speakText: async t => { calls.speakText.push(t); },
    maybeNotifyTaskComplete: async ({ answer, label }) => { calls.notify.push({ answer, label }); },
    agentAdapter: { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async (prompt, _signal, plan) => { calls.askPrompt = prompt; assert.equal(plan.label, 'hermes'); return 'twelve apples'; } },
  });
  const { handleRecording } = createUtteranceRouter(deps);

  assert.equal(deps.bridge.processing, false);
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, null);

  assert.equal(calls.transcribe, 1, 'transcribe called once');
  assert.equal(calls.askPrompt, 'hermes do the thing', 'agent receives the post-wake prompt');
  assert.deepEqual(calls.speakText.at(-1), 'twelve apples', 'agent answer is spoken');
  assert.ok(calls.sendText.some(s => /you said: hermes do the thing/.test(s)), 'STT result echoed to text channel');
  assert.equal(calls.notify.length, 1, 'maybeNotifyTaskComplete fires once');
  assert.equal(deps.bridge.processing, false, 'processing flag cleared in finally');
  assert.equal(deps.bridge.activeTurnId, 0, 'activeTurnId cleared');
  assert.equal(deps.bridge.activeProgressAbortController, null, 'progress controller cleared');
});

test('handleRecording drops when bridge.processing is already true', async () => {
  let agentCalls = 0;
  const deps = makeDeps({
    agentAdapter: { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async () => { agentCalls++; return ''; } },
  });
  deps.bridge.processing = true;
  const { handleRecording } = createUtteranceRouter(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(agentCalls, 0, 'agent is not invoked when busy');
  assert.equal(finishStatus, 'drop_processing');
  assert.equal(deps.bridge.processing, true, 'processing flag is left intact (other turn owns it)');
});

test('handleRecording rejects unauthorized users', async () => {
  let agentCalls = 0;
  const deps = makeDeps({
    isAllowed: () => false,
    agentAdapter: { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async () => { agentCalls++; return ''; } },
  });
  const { handleRecording } = createUtteranceRouter(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('intruder', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(agentCalls, 0);
  assert.equal(finishStatus, 'unauthorized');
});

test('handleRecording short-circuits on empty transcript', async () => {
  let asked = false;
  const deps = makeDeps({
    transcribe: async () => '',
    agentAdapter: { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async () => { asked = true; return ''; } },
  });
  const { handleRecording } = createUtteranceRouter(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(asked, false, 'agent never asked when transcript empty');
  assert.equal(finishStatus, 'empty_transcript');
  assert.equal(deps.bridge.processing, false, 'processing flag still cleaned up');
});

test('handleRecording short-circuits when wake word missing', async () => {
  let asked = false;
  const sentTexts = [];
  const deps = makeDeps({
    acceptsWake: () => false,
    sendText: async t => { sentTexts.push(t); return true; },
    agentAdapter: { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async () => { asked = true; return ''; } },
  });
  const { handleRecording } = createUtteranceRouter(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(asked, false);
  assert.equal(finishStatus, 'wake_rejected');
  assert.ok(sentTexts.some(t => /no wake word/.test(t)), 'wake-rejected message sent');
});

test('handleRecording cleans up progress controller even when agent throws', async () => {
  const deps = makeDeps({
    agentAdapter: { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async () => { throw new Error('agent boom'); } },
  });
  const { handleRecording } = createUtteranceRouter(deps);
  let finishStatus = null;
  let finishError = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; finishError = r.error; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(finishStatus, 'error');
  assert.match(finishError || '', /agent boom/);
  // Cleanup invariants
  assert.equal(deps.bridge.processing, false);
  assert.equal(deps.bridge.activeProgressAbortController, null);
  assert.equal(deps.bridge.currentAbortController, null);
});

test('handleRecording with stale language reload aborts before agent call', async () => {
  let asked = false;
  let transcribed = false;
  const deps = makeDeps({
    reloadRuntimeLanguageFromEnv: () => ({ changed: true, voiceLanguage: 'en', whisperLanguage: 'en' }),
    transcribe: async () => { transcribed = true; return 'hi'; },
    agentAdapter: { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async () => { asked = true; return ''; } },
  });
  const { handleRecording } = createUtteranceRouter(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(transcribed, false, 'transcribe not called when language changed');
  assert.equal(asked, false);
  assert.equal(finishStatus, 'drop_stale_language_change');
});

// --- cross-module state interactions ------------------------------------

test('interruptCurrentResponse flips speaking/processing back to clean state', () => {
  const deps = makeDeps();
  // simulate mid-turn
  deps.bridge.processing = true;
  deps.bridge.speaking = true;
  deps.bridge.activeTurnId = 42;
  const controller = new AbortController();
  deps.bridge.currentAbortController = controller;
  deps.bridge.player = { stop: () => {} };

  const { interruptCurrentResponse } = createUtteranceRouter(deps);
  const out = interruptCurrentResponse('user-1', 'test-barge-in');

  assert.equal(out, true, 'interrupt returns true when something was active');
  assert.equal(deps.bridge.speaking, false, 'speaking cleared');
  assert.equal(deps.bridge.processing, false, 'processing cleared');
  assert.ok(deps.bridge.interruptedTurns.has(42), 'interrupted turn tracked');
  assert.equal(controller.signal.aborted, true, 'abort controller fired');
});

test('interruptCurrentResponse is a no-op when nothing is in flight', () => {
  const deps = makeDeps();
  const { interruptCurrentResponse } = createUtteranceRouter(deps);
  assert.equal(interruptCurrentResponse('user-1', 'noop'), false);
  assert.equal(deps.bridge.speaking, false);
  assert.equal(deps.bridge.processing, false);
});
