// Shared mutable state for the Discord voice bridge.
//
// main.mjs used to hold ~40 module-level `let` bindings and `Map`/`Set`
// containers that the extracted voice_io / tts_player / utterance_router
// modules need to read and write by reference. Wrapping them in one object
// means every extracted module sees the same live state without having to
// thread dozens of getters/setters through call sites.
//
// Fields that depend on settings/client/etc. are seeded after the caller
// has built those (see `seedBridge`); the factory itself only allocates
// containers and primitive defaults.

export function createBridge() {
  return {
    // Discord client & active voice channel state
    connection: null,
    player: null,
    speaking: false,
    processing: false,
    activeTurnId: 0,
    activeVoiceChannelId: '',
    activeTranscriptChannelId: '',
    currentAbortController: null,
    activeStreams: new Map(),
    interruptedTurns: new Set(),
    speechPlaybackGeneration: 0,
    recentDiscordTextByChannel: new Map(),

    // External adapters/state holders set during boot
    ttsBackend: null,
    bridgeState: null,

    // Verbose / progress speech
    verboseProgress: false,
    activeProgressSignal: null,
    verboseProgressSpeechQueue: Promise.resolve(),
    activeProgressAbortController: null,
    progressSpeechBatch: [],
    progressSpeechBatchTimer: null,
    progressSpeechBatchSignal: null,
    progressSpeechBatchStartedAt: 0,
    activeProgressLastEventAt: 0,
    lastVerboseProgressText: '',
    lastVerboseProgressTextAt: 0,

    // Streaming TTS pipeline
    activeSentencer: null,
    activeStreamingQueue: null,
    streamingSpeechDelivered: false,

    // Notifications (ntfy/pushover)
    notifyUserOptIn: false,
    notifierInstance: null,
    lastNotifyAt: 0,
    lastNotifyBody: '',

    // Plan mode / cross-agent routing / per-channel session state
    planStates: new Map(),
    agentAdaptersBySession: new Map(),
    agentAdaptersByBackend: new Map(),
    routingStateByChannel: new Map(),
    ontologyByChannel: new Map(),
    installedBinaryCache: new Map(),

    // Barge-in sensitivity
    sensitivityMode: 'normal',
    sensitivityOutdoorUntilMs: 0,

    // Smart progress summarizer
    smartProgressEnabled: false,
    smartProgressSummarizer: null,
  };
}
