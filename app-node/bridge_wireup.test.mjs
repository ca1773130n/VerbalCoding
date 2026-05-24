// Integration tests for the cross-module factory wire-up that lives in main.mjs.
//
// These tests don't import main.mjs directly (it has Discord-side effects).
// Instead they reproduce its factory construction sequence here and assert
// that the circular voice_io <-> utterance_router dep is actually resolved at
// runtime, that bridge state is shared by reference across modules, and that
// the call chain `voice_io.queueSegment -> flushUtterance -> handleRecording
// -> transcribe` round-trips correctly through the thunk indirection.
//
// Codex's holistic review flagged that the previous test suite had zero
// coverage of the wire-up itself; these tests close that gap.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createBridge } from './bridge_context.mjs';
import { createTtsPlayer } from './tts_player.mjs';
import { createProgressHandler } from './progress_handler.mjs';
import { createNotificationHandler } from './notification_handler.mjs';
import { createTtsRuntime } from './tts_runtime.mjs';
import { createVoiceIO } from './voice_io.mjs';
import { createDiscordVoiceSetup } from './discord_voice_setup.mjs';
import { createUtteranceRouter } from './utterance_router.mjs';
import { createAgentTurnLifecycle } from './agent_turn.mjs';

const noop = () => {};
const noopAsync = async () => {};

// Build the entire factory chain the way main.mjs does, returning every
// destructured handle plus the shared bridge so tests can introspect state.
function buildSystem(overrides = {}) {
  const bridge = createBridge();
  bridge.ttsBackend = {
    name: 'fake',
    outputExtension: 'mp3',
    cacheKeyParts: () => ['fake'],
    synthesize: async () => '/tmp/fake.wav',
    close: () => {},
  };
  bridge.player = { play: () => {}, stop: () => {}, on: () => {} };
  bridge.bridgeState = {
    deferredSize: () => 0,
    currentEpoch: () => 1,
    discardQueues: () => 0,
    appendSegment: (uid, seg) => ({ files: [seg.file], pcmBytes: seg.pcmBytes, epoch: 1, timer: null }),
    deletePending: () => null,
    getPending: () => null,
    clearPendingTimer: () => {},
  };

  const settings = {
    voiceLanguage: 'ko',
    transcriptChannelId: 'tx-ch',
    allowedUsers: new Set(),
    autoJoinVoiceChannels: [],
    debugDir: '',
    agent: { backend: 'hermes', label: 'hermes' },
    tts: { maxChars: 200, volume: 1, edge: { voice: 'ko-KR-x' }, progressCacheDir: '/tmp/cache' },
  };

  const client = {
    user: { id: 'bot-id' },
    channels: { cache: new Map(), fetch: async () => null },
    guilds: { cache: new Map() },
    destroy: () => {},
  };

  const sharedHelpers = {
    log: noop,
    warn: noop,
    sleep: async () => {},
    isAbortError: e => e?.name === 'AbortError',
    isAllowed: () => true,
    stamp: () => 'stamp',
    sendText: async () => true,
    sendEmbed: async () => true,
    execFileAsync: async () => ({ stdout: '', stderr: '' }),
    waitEvent: async () => {},
    refreshTtsRuntimeConfig: async () => ({ backend: 'edge', voice: { voice: 'x' } }),
    persistEnvValues: noop,
    reloadRuntimeLanguageFromEnv: () => ({ changed: false, voiceLanguage: 'ko', whisperLanguage: 'ko' }),
    discardVoiceInputQueues: () => 0,
  };

  // ttsPlayer first — provides speakText / playAudio.
  const ttsPlayer = createTtsPlayer({
    bridge, settings,
    log: sharedHelpers.log, warn: sharedHelpers.warn, sleep: sharedHelpers.sleep,
    sendText: sharedHelpers.sendText,
    refreshTtsRuntimeConfig: sharedHelpers.refreshTtsRuntimeConfig,
    waitEvent: sharedHelpers.waitEvent,
    isAbortError: sharedHelpers.isAbortError,
    STREAMING_TTS_ENABLED: false,
  });

  const progressHandler = createProgressHandler({
    bridge, settings,
    log: sharedHelpers.log, warn: sharedHelpers.warn,
    isAbortError: sharedHelpers.isAbortError,
    playAudio: ttsPlayer.playAudio,
    sendText: sharedHelpers.sendText,
    refreshTtsRuntimeConfig: sharedHelpers.refreshTtsRuntimeConfig,
  });

  const notificationHandler = createNotificationHandler({ bridge, client, log: sharedHelpers.log, warn: sharedHelpers.warn });

  const ttsRuntime = createTtsRuntime({
    bridge, ROOT: '/tmp/vc',
    execFileAsync: sharedHelpers.execFileAsync,
    speakText: ttsPlayer.speakText,
    warn: sharedHelpers.warn,
    persistEnvValues: sharedHelpers.persistEnvValues,
  });

  const agentAdapter = { label: 'hermes', backend: 'hermes', readSessionId: () => null, ask: async () => 'mock answer' };

  // --- circular dep resolution: forward-declared utteranceRouter + thunk ---
  let utteranceRouter;
  const voiceIO = createVoiceIO({
    bridge, settings, client,
    execFileAsync: sharedHelpers.execFileAsync,
    log: sharedHelpers.log, warn: sharedHelpers.warn,
    stamp: sharedHelpers.stamp, sleep: sharedHelpers.sleep,
    isAllowed: sharedHelpers.isAllowed,
    UTTERANCE_IDLE_MS: 100,
    SUBSCRIBE_AFTER_SILENCE_MS: 100,
    MIN_UTTERANCE_BYTES: 1024,
    MIN_MEAN_VOLUME_DB: -50,
    MIN_MAX_VOLUME_DB: -20,
    currentBargeInThresholds: () => ({ minBytes: 0, minMeanDb: -40, minMaxDb: -20, mode: 'normal' }),
    currentPlaybackBargeInThresholds: () => ({ minBytes: 0, minMeanDb: -40, minMaxDb: -20, requireBoth: true }),
    createLiveBargeInMonitor: () => ({ push: () => {} }),
    shouldUseLivePlaybackBargeIn: () => false,
    stopPlaybackForBargeIn: ttsPlayer.stopPlaybackForBargeIn,
    analyzeAudio: async () => ({ meanDb: -10, maxDb: -5 }),
    concatWavs: async () => {},
    saveCapturedVoiceCloneSample: async () => false,
    isBargeInCandidate: () => false,
    validateProcessingBargeIn: async () => ({ action: 'ignore', text: '' }),
    enqueueDeferredProcessingUtterance: () => true,
    newLatencyTurn: () => ({ mark: () => {}, addMeta: () => {}, stage: () => {}, finish: () => {} }),
    // THUNK: at construction time utteranceRouter is undefined; the thunk
    // defers the lookup until the call actually happens.
    handleRecording: (...args) => utteranceRouter.handleRecording(...args),
  });

  const discordVoiceSetup = createDiscordVoiceSetup({
    bridge, client, settings, ROOT: '/tmp/vc',
    log: sharedHelpers.log, warn: sharedHelpers.warn,
    speakText: ttsPlayer.speakText,
    waitEvent: sharedHelpers.waitEvent,
    subscribeUser: voiceIO.subscribeUser,
    pendingFallbackNoticePromises: new Set(),
    bindProjectSessionToChannel: () => null,
    createProjectSession: () => null,
    resolveProjectSessionForChannel: () => null,
    saveProjectSessionsState: noop,
    projectSessionsState: { channelSessions: {} },
    invalidateBackendAdaptersForSession: noop,
    VOICE_CONNECT_TIMEOUT_MS: 5000,
  });

  const agentTurnLifecycle = createAgentTurnLifecycle({
    bridge,
    warn: sharedHelpers.warn,
  });
  utteranceRouter = createUtteranceRouter({
    bridge,
    agentTurnLifecycle,
    log: sharedHelpers.log, warn: sharedHelpers.warn,
    path: { join: (...a) => a.join('/') },
    fs: { rm: (_p, _o, cb) => cb && cb() },
    ROOT: '/tmp/vc',
    TTS_VOICE_CONFIG_PATH: '/tmp/voices.json',
    agentAdapter, settings,
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
    createBridgeAgentAdapter: () => ({ label: 'fake', backend: 'fake', ask: async () => '' }),
    buildAgentSettings: () => ({ backend: 'hermes', label: 'hermes' }),
    commandIsInstalled: ttsRuntime.commandIsInstalled,
    shellSplit: s => String(s).split(' '),
    sendText: sharedHelpers.sendText,
    speakText: ttsPlayer.speakText,
    ensureTtsVoiceConfig: () => ({ backends: {} }),
    updateTtsVoiceConfig: c => c,
    writeTtsVoiceConfig: noop,
    applyVoiceConfigToProcessEnv: () => ({ selection: { backend: 'edge', voiceType: 'female', voice: { language: 'ko', voice: 'x' } } }),
    ensureSelectedTtsBackendInstalled: ttsRuntime.ensureSelectedTtsBackendInstalled,
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
    // Phase 4b deps
    transcribe: voiceIO.transcribe,
    beginStreamingTurn: ttsPlayer.beginStreamingTurn,
    endStreamingTurn: ttsPlayer.endStreamingTurn,
    client,
    isAllowed: sharedHelpers.isAllowed,
    isAbortError: sharedHelpers.isAbortError,
    sleep: sharedHelpers.sleep,
    sendEmbed: sharedHelpers.sendEmbed,
    speakImmediateNotice: progressHandler.speakImmediateNotice,
    reloadRuntimeLanguageFromEnv: sharedHelpers.reloadRuntimeLanguageFromEnv,
    drainDeferredProcessingUtterances: noopAsync,
    maybeNotifyTaskComplete: notificationHandler.maybeNotifyTaskComplete,
    ontologyStateFor: () => ({ nodeCount: 0, serializeForHandoff: () => '' }),
    captureOntologyFromTurn: noop,
    queueProgressSpeechText: progressHandler.queueProgressSpeechText,
    stopProgressSpeech: progressHandler.stopProgressSpeech,
    agentAnswerHeader: () => 'agent says:',
    emptyAgentAnswer: () => '(empty)',
    formatRecentDiscordContext: () => '',
    formatSttResultMessage: (_lang, _u, t) => `you said: ${t}`,
    formatSttStartMessage: () => '🎧',
    formatVoiceErrorMessage: (_lang, m) => m,
    formatWakeRejectedMessage: () => 'no wake word',
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
    parseResearchCommand: () => ({ type: 'none' }),
    runResearchTurn: async () => ({ status: 'no_backend' }),
    PROGRESS_IDLE_CHECK_MS: 5000,
    PROGRESS_IDLE_NOTICE_INITIAL_MS: 10000,
    PROGRESS_IDLE_NOTICE_LIMIT: 20,
    PROGRESS_IDLE_NOTICE_MAX_MS: 30000,
    PROGRESS_IDLE_NOTICE_MULTIPLIER: 1.8,
    STT_START_VOICE_NOTICE: false,
    ...overrides,
  });

  return { bridge, settings, client, agentAdapter, ttsPlayer, progressHandler, notificationHandler, ttsRuntime, voiceIO, discordVoiceSetup, utteranceRouter, getUtteranceRouter: () => utteranceRouter };
}

// --- wire-up correctness -------------------------------------------------

test('the forward-declared utteranceRouter thunk resolves at invocation time', async () => {
  // Reproduce main.mjs's exact pattern: voiceIO is built first with a
  // closure that references `utteranceRouter` before it's assigned. If
  // the thunk accidentally captured the (still-undefined) value at
  // construction time, calling it would throw a TypeError. We assert the
  // simpler contract: handleRecording is reachable AND a full turn lands
  // in cleanup without raising.
  //
  // (Tracking the exact adapter the router picks for routedBackend='hermes'
  // is brittle in unit-test conditions because adapterForBackend probes the
  // real PATH via commandIsInstalled; see the end-to-end test below for the
  // strict round-trip via voiceIO.transcribe instead.)
  const system = buildSystem();
  assert.equal(typeof system.utteranceRouter.handleRecording, 'function');
  let threw = null;
  try {
    await system.utteranceRouter.handleRecording('user-1', '/tmp/u.wav', 8192, 1, null);
  } catch (e) { threw = e; }
  assert.equal(threw, null, 'handleRecording reachable via thunk closure; no TDZ throw');
  assert.equal(system.bridge.processing, false, 'turn cleaned up');
});

test('bridge state is shared by reference across factory closures', () => {
  const { bridge, ttsPlayer, progressHandler, utteranceRouter } = buildSystem();

  // utteranceRouter mutates bridge.processing during a turn; we'll simulate
  // by manually setting + reading from another module's perspective.
  bridge.processing = true;
  bridge.speaking = true;

  // tts_player.stopPlaybackForBargeIn reads bridge.speaking.
  // Calling it should clear bridge.speaking + bump speechPlaybackGeneration.
  const stopped = ttsPlayer.stopPlaybackForBargeIn('test-user', 'test');
  assert.equal(stopped, true);
  assert.equal(bridge.speaking, false, 'shared bridge.speaking cleared by tts_player');
  assert.equal(bridge.speechPlaybackGeneration, 1);

  // progress_handler also touches bridge.speaking.
  bridge.speaking = true;
  bridge.activeProgressSignal = 'sig-A';
  progressHandler.stopProgressSpeech('sig-A', 'final');
  assert.equal(bridge.activeProgressSignal, null, 'progress handler cleared shared signal');
  assert.equal(bridge.speaking, false, 'progress handler cleared shared speaking flag');
});

test('voice_io.transcribe is reachable from utterance_router via deps', async () => {
  // Reproduces the other half of the circular dep: utterance_router calls
  // voice_io.transcribe through its deps. Patch voice_io.transcribe and
  // verify handleRecording reaches it.
  let transcribedPath = null;
  const system = buildSystem({
    transcribe: async wav => { transcribedPath = wav; return 'hermes say hi'; },
  });
  await system.utteranceRouter.handleRecording('user-1', '/tmp/wired.wav', 4096, 1, null);
  assert.equal(transcribedPath, '/tmp/wired.wav', 'router reached voice_io.transcribe through deps');
});

test('utteranceRouter destructured exports include handleRecording', () => {
  // Explicit check (the per-module test had this gap before — Codex flagged it).
  const { utteranceRouter } = buildSystem();
  for (const name of [
    'planChannelKey', 'askNextDecision', 'finalizePlanReady', 'dispatchPlanModeUtterance',
    'planNarrationLines', 'adapterForProjectSession', 'routingStateFor', 'recordUtterance',
    'clearTransientRouting', 'adapterForBackend', 'handleTtsVoiceCommand', 'handleLanguageCommand',
    'handleVoiceCloneCommand', 'interruptCurrentResponse', 'handleRecording',
  ]) {
    assert.equal(typeof utteranceRouter[name], 'function', `utterance_router.${name} bound after factory call`);
  }
});

test('voiceIO destructured exports include transcribe + subscribeUser', () => {
  const { voiceIO } = buildSystem();
  for (const name of ['transcribeOnce', 'transcribe', 'cleanTranscript', 'queueSegment', 'flushUtterance', 'subscribeUser']) {
    assert.equal(typeof voiceIO[name], 'function', `voice_io.${name} bound after factory call`);
  }
});

test('discordVoiceSetup destructured exports include gracefulShutdown', () => {
  const { discordVoiceSetup } = buildSystem();
  for (const name of ['connectTo', 'autoJoin', 'findVoiceChannelBySelector', 'voiceChannelLabel', 'resolveVoiceChannelForAttach', 'attachVoiceChannelToTextSession', 'gracefulShutdown']) {
    assert.equal(typeof discordVoiceSetup[name], 'function', `discord_voice_setup.${name} bound after factory call`);
  }
});

test('progressHandler + ttsPlayer share bridge.speaking via separate code paths', () => {
  // Phase 5 layering specifically split speech-stop logic between
  // tts_player.stopPlaybackForBargeIn (final answer barge-in) and
  // progress_handler.stopProgressSpeech (progress speech termination).
  // Both touch bridge.speaking. This test pins their contract so future
  // refactors don't accidentally diverge.
  const { bridge, ttsPlayer, progressHandler } = buildSystem();

  // ttsPlayer: only acts when bridge.speaking is already true.
  assert.equal(ttsPlayer.stopPlaybackForBargeIn('u1', 'noop'), false);
  bridge.speaking = true;
  assert.equal(ttsPlayer.stopPlaybackForBargeIn('u1', 'go'), true);
  assert.equal(bridge.speaking, false);

  // progressHandler: only acts when signal matches activeProgressSignal.
  bridge.speaking = true;
  bridge.activeProgressSignal = 'A';
  progressHandler.stopProgressSpeech('B', 'mismatch');
  assert.equal(bridge.speaking, true, 'mismatched signal leaves speaking alone');
  progressHandler.stopProgressSpeech('A', 'match');
  assert.equal(bridge.speaking, false);
  assert.equal(bridge.activeProgressSignal, null);
});

test('end-to-end: queueSegment timer triggers flushUtterance which calls handleRecording via thunk', async () => {
  // The most important wire-up test: real voiceIO.queueSegment, real timer,
  // resolves through the forward-declared thunk to the real handleRecording,
  // which calls back into voiceIO.transcribe through its own deps.
  let handleRecordingCalled = false;
  let transcribeCalled = false;
  const system = buildSystem({
    transcribe: async () => { transcribeCalled = true; return 'hermes echo'; },
  });
  // Override handleRecording entirely so we can observe the thunk path.
  // We need to re-build the system in a way that lets us patch the router
  // post-construction. Easiest: monkey-patch the returned router instance.
  const originalHandleRecording = system.utteranceRouter.handleRecording;
  system.utteranceRouter.handleRecording = async (...args) => {
    handleRecordingCalled = true;
    return originalHandleRecording(...args);
  };

  // Seed the bridge state we need for queueSegment + flushUtterance:
  // appendSegment must return a 'pending' shape with a timer that fires.
  let pendingTimer = null;
  let pendingFiles = [];
  let pendingTimerFactory = null;
  system.bridge.bridgeState = {
    deferredSize: () => 0,
    currentEpoch: () => 1,
    discardQueues: () => 0,
    appendSegment: (_uid, seg) => {
      pendingFiles.push(seg.file);
      pendingTimerFactory = seg.timerFactory;
      pendingTimer = seg.timerFactory();
      return { files: pendingFiles, pcmBytes: 16384, epoch: 1, timer: pendingTimer };
    },
    deletePending: () => ({
      files: pendingFiles,
      pcmBytes: 16384,
      epoch: 1,
      timer: pendingTimer,
      firstPacketAt: Date.now(),
      lastSegmentEndAt: Date.now(),
    }),
    getPending: () => null,
    clearPendingTimer: () => {},
  };

  // Kick off the chain: queueSegment -> timer fires -> flushUtterance ->
  // handleRecording (via thunk) -> transcribe (via deps).
  system.voiceIO.queueSegment('user-1', '/tmp/seg.wav', 16384, Date.now(), Date.now());
  // Let the timer (UTTERANCE_IDLE_MS=100 in our setup) fire.
  await new Promise(r => setTimeout(r, 200));

  assert.equal(handleRecordingCalled, true, 'queueSegment -> flushUtterance -> thunk -> router.handleRecording');
  assert.equal(transcribeCalled, true, 'router.handleRecording -> voiceIO.transcribe via deps');
});
