// Per-turn lifecycle helpers shared by the voice path (handleRecording)
// and the text path (handleTextAgentMessage). Both paths used to inline
// nearly the same controller setup + cleanup, with a subtle difference
// in the finally block: the voice path aborted ANY currently-active
// progress controller without confirming it was still the turn's own,
// which Codex flagged as a race. This module centralises both ends so
// they stay consistent.
//
// Usage:
//   const lifecycle = createAgentTurnLifecycle({ bridge, warn });
//
//   if (bridge.processing) { /* caller handles "busy" reply */ return; }
//   const turn = lifecycle.start({ withTurnId: true });
//   try {
//     // ... per-turn work using turn.signal / turn.progressController.signal ...
//   } finally {
//     // Optionally clear progress-speech batch first (text path does this).
//     lifecycle.finish(turn);
//     // Any path-specific extras (e.g. drainDeferredProcessingUtterances).
//   }
//
// `withTurnId: true` opts into the voice-path semantics where
// bridge.activeTurnId is incremented per turn and bridge.interruptedTurns
// tracks aborts. The text path leaves turnId unset.

export function createAgentTurnLifecycle(deps) {
  const { bridge, warn } = deps;
  // Note: clearing the progress-speech batch is intentionally NOT part of
  // finish(). The voice path's pre-refactor cleanup did not call it; only
  // the text path did. Callers that need it (currently
  // handleTextAgentMessage) invoke clearProgressSpeechBatch explicitly
  // before finish().

  function start({ withTurnId = false } = {}) {
    const controller = new AbortController();
    bridge.currentAbortController = controller;
    const progressController = new AbortController();
    bridge.activeProgressAbortController = progressController;
    bridge.activeProgressSignal = progressController.signal;
    bridge.activeProgressLastEventAt = Date.now();
    const previousTranscriptChannelId = bridge.activeTranscriptChannelId;
    bridge.processing = true;
    const turnId = withTurnId ? ++bridge.activeTurnId : undefined;
    return {
      controller,
      signal: controller.signal,
      progressController,
      previousTranscriptChannelId,
      turnId,
    };
  }

  function finish(turn) {
    if (!turn) return;
    const { controller, progressController, previousTranscriptChannelId, turnId } = turn;

    // Only abort the progress controller if it's still THIS turn's. The
    // voice path's old inline cleanup omitted this check and could abort
    // a newer turn's controller.
    if (progressController
        && bridge.activeProgressAbortController === progressController
        && !progressController.signal.aborted) {
      try { progressController.abort(); } catch (e) { warn?.('abort progress speech in cleanup failed', e?.stack || e); }
    }
    if (bridge.activeProgressAbortController === progressController) {
      bridge.activeProgressAbortController = null;
    }
    if (bridge.activeProgressSignal === progressController?.signal) {
      bridge.activeProgressSignal = null;
    }

    if (bridge.currentAbortController === controller) {
      bridge.currentAbortController = null;
    }
    bridge.activeTranscriptChannelId = previousTranscriptChannelId;

    if (turnId !== undefined) {
      bridge.interruptedTurns.delete(turnId);
      if (bridge.activeTurnId === turnId) bridge.activeTurnId = 0;
    }

    bridge.processing = false;
  }

  return { start, finish };
}
