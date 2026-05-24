import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceTurnRunner } from './voice_turn_runner.mjs';
import { createUtteranceRouter } from './utterance_router.mjs';
import { createBridge } from './bridge_context.mjs';
import { createAgentTurnLifecycle } from './agent_turn.mjs';

function noop() {}
async function noopAsync() {}

// Build a complete dep set for voiceTurnRunner by first constructing a
// real utterance_router with stubbed pure-function deps, then threading
// its outputs into the runner alongside the rest. This mirrors main.mjs's
// real construction order so the tests catch any inter-module wiring drift.
function makeDeps(overrides = {}) {
  const bridge = createBridge();
  bridge.bridgeState = {
    deferredSize: () => 0,
    currentEpoch: () => 1,
    discardQueues: () => 0,
  };
  const agentTurnLifecycle = createAgentTurnLifecycle({ bridge, warn: noop });

  const agentAdapter = {
    label: 'default-agent', backend: 'hermes',
    readSessionId: () => null,
    ask: async () => 'mock agent answer',
  };

  // Construct the router with the same stubs Phase 6a tests used; runner
  // consumes the router's dispatch handlers + adapter selection.
  const router = createUtteranceRouter({
    bridge,
    agentTurnLifecycle,
    log: noop, warn: noop, path: { join: (...a) => a.join('/') }, fs: { rm: (_p, _o, cb) => cb && cb() },
    ROOT: '/tmp/vc', TTS_VOICE_CONFIG_PATH: '/tmp/voices.json',
    agentAdapter,
    settings: { voiceLanguage: 'ko', transcriptChannelId: 'tx-ch', agent: { backend: 'hermes', label: 'hermes' }, tts: {} },
    isPlanEntryUtterance: () => false,
    parsePlanOutput: () => ({ steps: [], decisions: [] }),
    parsePlanVoiceCommand: () => ({ type: 'unknown' }),
    applyPlanCommand: s => s,
    renderFinalPlan: () => '',
    planModePreamble: () => '',
    planExecutionPreamble: () => '',
    parseDecisionAnswer: () => ({ type: 'unknown' }),
    renderDecisionPrompt: () => '',
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
    applyVoiceConfigToProcessEnv: () => ({ selection: { backend: 'edge', voiceType: 'female', voice: { language: 'ko', voice: 'x' } } }),
    ensureSelectedTtsBackendInstalled: noopAsync,
    rebuildTtsRuntimeSettings: noop,
    voiceCommandFromTranscript: () => null,
    voiceChangedText: () => '',
    voiceLanguageCommandFromTranscript: () => null,
    voiceCloneCommandFromText: () => null,
    voiceCloneCapture: { arm: () => ({ targetPath: '' }), cancel: () => false, current: () => null },
    notifyVoiceCloneSampleGapIfNeeded: noopAsync,
    languageChangedText: () => '',
    applyRuntimeLanguage: noop,
    persistEnvValues: noop,
    discardVoiceInputQueues: () => 0,
  });

  const settings = { voiceLanguage: 'ko', transcriptChannelId: 'tx-ch', agent: { backend: 'hermes', label: 'hermes' }, tts: {} };

  return {
    bridge,
    agentTurnLifecycle,
    settings,
    client: { channels: { cache: new Map() } },
    log: noop, warn: noop, fs: { rm: (_p, _o, cb) => cb && cb() },
    // voice_io
    transcribe: async () => 'hey hermes do a thing',
    // tts_player
    beginStreamingTurn: () => false,
    endStreamingTurn: noopAsync,
    speakText: noopAsync,
    // progress_handler
    queueProgressSpeechText: noop,
    stopProgressSpeech: noop,
    speakImmediateNotice: noopAsync,
    // notification_handler
    maybeNotifyTaskComplete: noopAsync,
    // utterance_router outputs (real router instance built above)
    handleLanguageCommand: router.handleLanguageCommand,
    handleTtsVoiceCommand: router.handleTtsVoiceCommand,
    handleVoiceCloneCommand: router.handleVoiceCloneCommand,
    dispatchPlanModeUtterance: router.dispatchPlanModeUtterance,
    adapterForBackend: router.adapterForBackend,
    adapterForProjectSession: router.adapterForProjectSession,
    planChannelKey: router.planChannelKey,
    routingStateFor: router.routingStateFor,
    recordUtterance: router.recordUtterance,
    clearTransientRouting: router.clearTransientRouting,
    // pure helpers
    isAllowed: () => true,
    isAbortError: e => e?.name === 'AbortError',
    sleep: async () => {},
    sendText: noopAsync,
    sendEmbed: async () => true,
    reloadRuntimeLanguageFromEnv: () => ({ changed: false, voiceLanguage: 'ko', whisperLanguage: 'ko' }),
    drainDeferredProcessingUtterances: noopAsync,
    resolveProjectSessionForChannel: () => null,
    projectSessionContextText: () => '',
    ontologyStateFor: () => ({ nodeCount: 0, serializeForHandoff: () => '' }),
    captureOntologyFromTurn: noop,
    formatRecentDiscordContext: () => '',
    formatSttResultMessage: (_lang, _u, t) => `you said: ${t}`,
    formatSttStartMessage: () => '🎧',
    formatVoiceErrorMessage: (_lang, m) => m,
    formatWakeRejectedMessage: () => 'no wake word',
    agentAnswerHeader: () => 'agent says:',
    emptyAgentAnswer: () => '(empty)',
    spokenResultOnly: (_p, a) => a,
    stripWake: t => t,
    acceptsWake: () => true,
    sensitivityChangedSpeech: () => '',
    sensitivityModeFromTranscript: () => null,
    sensitivityStatusText: () => '',
    setSensitivityMode: () => ({ mode: 'normal' }),
    isSensitivityOnlyRequest: () => false,
    verboseChangedSpeech: () => '',
    verboseModeFromTranscript: () => null,
    verboseStatusText: () => '',
    setVerboseProgress: noop,
    isVerboseOnlyRequest: () => false,
    isRoutingOnlyUtterance: () => false,
    parseAgentRoutingCommand: () => ({ type: 'none' }),
    renderAgentPrefix: () => '',
    buildCrossAgentPrompt: ({ prompt }) => prompt,
    buildFallbackDecision: () => ({ slot: 'fallback' }),
    parseDecisionAnswer: () => ({ type: 'unknown' }),
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

test('createVoiceTurnRunner exposes handleRecording', () => {
  const runner = createVoiceTurnRunner(makeDeps());
  assert.equal(typeof runner.handleRecording, 'function');
});

test('handleRecording happy path: transcribe -> agent -> send + speak + notify, cleanup green', async () => {
  const calls = { transcribe: 0, askPrompt: '', sendText: [], speakText: [], notify: [] };
  // Capture the exact prompt the runner sends to the agent and the exact
  // answer that flows back out.
  const fakeAdapter = {
    label: 'hermes', backend: 'hermes', readSessionId: () => null,
    ask: async (prompt, _signal, plan) => {
      calls.askPrompt = prompt;
      assert.equal(plan.label, 'hermes', 'plan label = agent label');
      assert.equal(plan.task, true, 'plan.task=true for voice turn');
      return 'twelve apples';
    },
  };
  const deps = makeDeps({
    transcribe: async wav => { calls.transcribe++; assert.equal(wav, '/tmp/u.wav'); return 'hermes do the thing'; },
    sendText: async t => { calls.sendText.push(t); return true; },
    speakText: async t => { calls.speakText.push(t); },
    maybeNotifyTaskComplete: async ({ answer, label }) => { calls.notify.push({ answer, label }); },
    // Force the runner's adapter lookup to return our test adapter rather
    // than the router's auto-created one (the router builds a fresh adapter
    // per backend via createBridgeAgentAdapter).
    adapterForBackend: () => fakeAdapter,
    adapterForProjectSession: () => fakeAdapter,
  });
  const { handleRecording } = createVoiceTurnRunner(deps);
  assert.equal(deps.bridge.processing, false);
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, null);
  assert.equal(calls.transcribe, 1, 'transcribe called once');
  assert.equal(calls.askPrompt, 'hermes do the thing', 'agent receives the post-wake prompt');
  assert.deepEqual(calls.speakText.at(-1), 'twelve apples', 'agent answer is spoken');
  assert.ok(calls.sendText.some(s => /you said: hermes do the thing/.test(s)), 'STT echoed');
  assert.ok(calls.sendText.some(s => /twelve apples/.test(s)), 'agent answer surfaced as text');
  assert.equal(calls.notify.length, 1, 'maybeNotifyTaskComplete fired once');
  assert.equal(calls.notify[0].label, 'hermes', 'notify carries the agent label');
  assert.equal(deps.bridge.processing, false, 'processing flag cleared in finally');
  assert.equal(deps.bridge.activeTurnId, 0, 'activeTurnId cleared');
  assert.equal(deps.bridge.activeProgressAbortController, null, 'progress controller cleared');
});

test('handleRecording cleans up progress controller even when agent throws', async () => {
  const fakeAdapter = {
    label: 'hermes', backend: 'hermes', readSessionId: () => null,
    ask: async () => { throw new Error('agent boom'); },
  };
  const deps = makeDeps({
    adapterForBackend: () => fakeAdapter,
    adapterForProjectSession: () => fakeAdapter,
  });
  const { handleRecording } = createVoiceTurnRunner(deps);
  let finishStatus = null;
  let finishError = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; finishError = r.error; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(finishStatus, 'error');
  assert.match(finishError || '', /agent boom/);
  // Cleanup invariants — the bug Codex flagged on the original voice-path
  // finally is now guarded by agentTurnLifecycle.finish, so we double-check.
  assert.equal(deps.bridge.processing, false);
  assert.equal(deps.bridge.activeProgressAbortController, null);
  assert.equal(deps.bridge.currentAbortController, null);
});

test('handleRecording drops when bridge.processing is already true', async () => {
  const deps = makeDeps();
  deps.bridge.processing = true;
  const { handleRecording } = createVoiceTurnRunner(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(finishStatus, 'drop_processing');
  assert.equal(deps.bridge.processing, true, 'processing flag left intact (other turn owns it)');
});

test('handleRecording rejects unauthorized users', async () => {
  const deps = makeDeps({ isAllowed: () => false });
  const { handleRecording } = createVoiceTurnRunner(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('intruder', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(finishStatus, 'unauthorized');
});

test('handleRecording short-circuits on empty transcript', async () => {
  const deps = makeDeps({ transcribe: async () => '' });
  const { handleRecording } = createVoiceTurnRunner(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(finishStatus, 'empty_transcript');
  assert.equal(deps.bridge.processing, false, 'processing flag still cleaned up');
});

test('handleRecording short-circuits when wake word missing', async () => {
  const sent = [];
  const deps = makeDeps({
    acceptsWake: () => false,
    sendText: async t => { sent.push(t); return true; },
  });
  const { handleRecording } = createVoiceTurnRunner(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(finishStatus, 'wake_rejected');
  assert.ok(sent.some(t => /no wake word/.test(t)), 'wake-rejected message sent');
});

test('handleRecording with stale language reload aborts before transcribe', async () => {
  let transcribed = false;
  const deps = makeDeps({
    reloadRuntimeLanguageFromEnv: () => ({ changed: true, voiceLanguage: 'en', whisperLanguage: 'en' }),
    transcribe: async () => { transcribed = true; return 'hi'; },
  });
  const { handleRecording } = createVoiceTurnRunner(deps);
  let finishStatus = null;
  const metricsTurn = { mark: () => {}, addMeta: () => {}, stage: () => {}, finish: r => { finishStatus = r.status; } };
  await handleRecording('user-1', '/tmp/u.wav', 8192, 1, metricsTurn);
  assert.equal(transcribed, false, 'transcribe not called when language changed');
  assert.equal(finishStatus, 'drop_stale_language_change');
});
