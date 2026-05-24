// Agent progress speech pipeline: queues verbose progress events into rate-limited
// TTS batches, plays them through the shared bridge player, and stops cleanly
// when the agent finally answers.
//
// Phase 5a extraction from main.mjs. Closes over bridge state
// (activeProgressSignal, activeProgressAbortController, smartProgressSummarizer,
// progressSpeechBatch, etc.) plus a handful of injected helpers (settings, log,
// warn, playAudio, synthProgressTTS deps, refreshTtsRuntimeConfig).
//
// Module-level imports (createSmartProgressSummarizer, progressCategory,
// formatProgressMessage, summarizeProgressEvents, progressTtsCacheFileName)
// move with the handler — they're not needed anywhere else in main.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { createSmartProgressSummarizer } from './smart_progress.mjs';
import { progressCategory, formatProgressMessage, summarizeProgressEvents } from './progress_speech.mjs';
import { progressTtsCacheFileName } from './progress_cache.mjs';

export function createProgressHandler(deps) {
  const {
    bridge,
    settings,
    log,
    warn,
    isAbortError,
    playAudio,
    sendText,
    refreshTtsRuntimeConfig,
  } = deps;

  function ensureSmartProgressSummarizer() {
    if (bridge.smartProgressSummarizer) return bridge.smartProgressSummarizer;
    bridge.smartProgressSummarizer = createSmartProgressSummarizer({
      apiKey: process.env.SMART_PROGRESS_API_KEY || '',
      baseUrl: process.env.SMART_PROGRESS_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.SMART_PROGRESS_MODEL || 'llama-3.1-8b-instant',
      language: settings.voiceLanguage,
    });
    bridge.smartProgressSummarizer.on('summary', summary => {
      if (!summary || !bridge.activeProgressSignal) return;
      queueVerboseProgressSpeech(summary, bridge.activeProgressSignal);
    });
    return bridge.smartProgressSummarizer;
  }

  function smartProgressStatusText() {
    const hasKey = Boolean(process.env.SMART_PROGRESS_API_KEY);
    const mode = bridge.smartProgressEnabled && hasKey ? 'on' : 'off';
    const reason = !hasKey ? ' (no SMART_PROGRESS_API_KEY set)' : '';
    return `smart-progress: ${mode}${reason}`;
  }

  function progressEmoji(event) {
    const category = progressCategory(event, { language: settings.voiceLanguage })?.key;
    return {
      test: '🧪',
      edit: '✏️',
      read: '📖',
      search: '🔎',
      terminal: '⌨️',
      skill: '🧰',
      browser: '🌐',
      tool: '🛠️',
      agent: '🤖',
      work: '⚙️',
    }[category] || '⚙️';
  }

  function formatProgressText(event) {
    return formatProgressMessage(event, { language: settings.voiceLanguage });
  }

  function sendVerboseProgressText(event, signal) {
    if (!bridge.verboseProgress || !signal || signal.aborted || bridge.activeProgressSignal !== signal) return;
    const formatted = formatProgressText(event).replace(/\s+/g, ' ').trim();
    if (!formatted) return;
    const message = formatted.slice(0, 1900);
    const now = Date.now();
    if (message === bridge.lastVerboseProgressText && now - bridge.lastVerboseProgressTextAt < 2000) return;
    bridge.lastVerboseProgressText = message;
    bridge.lastVerboseProgressTextAt = now;
    void sendText(message).catch(e => warn('verbose progress text delivery failed', e?.stack || e));
  }

  async function synthProgressTTS(text, signal) {
    await refreshTtsRuntimeConfig();
    const ext = bridge.ttsBackend.outputExtension || 'mp3';
    const cachePath = path.join(settings.tts.progressCacheDir, progressTtsCacheFileName({
      backendKeyParts: bridge.ttsBackend.cacheKeyParts(),
      text,
      ext,
    }));
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
      log('progress tts cache hit', text, cachePath);
      return cachePath;
    }
    log('progress tts cache miss', text);
    const tmp = await bridge.ttsBackend.synthesize(text, { signal, kind: 'progress' });
    fs.renameSync(tmp, cachePath);
    return cachePath;
  }

  async function speakProgress(text, signal) {
    if (signal?.aborted) return;
    try {
      const mp3 = await synthProgressTTS(text, signal);
      if (signal?.aborted) return;
      await playAudio(mp3, { deleteAfter: false });
    } catch (e) {
      if (!isAbortError(e)) warn('progress tts failed', e?.stack || e);
    }
  }

  async function speakImmediateNotice(text, signal, reason = 'notice') {
    if (signal?.aborted) return;
    try {
      log('immediate notice speech', reason, 'text', String(text || '').slice(0, 80));
      const mp3 = await synthProgressTTS(text, signal);
      if (signal?.aborted) return;
      await playAudio(mp3, { deleteAfter: false });
    } catch (e) {
      if (!isAbortError(e)) warn('immediate notice speech failed', reason, e?.stack || e);
    }
  }

  function queueProgressSpeechText(text, signal, reason = 'status') {
    const spoken = String(text || '').replace(/\s+/g, ' ').trim();
    if (!spoken || !signal || signal.aborted || bridge.activeProgressSignal !== signal) return;
    bridge.verboseProgressSpeechQueue = bridge.verboseProgressSpeechQueue
      .catch(() => {})
      .then(async () => {
        if (signal.aborted || bridge.activeProgressSignal !== signal || !bridge.processing) return;
        log('progress speech queued', reason, 'text', spoken);
        await speakProgress(spoken, signal);
      });
  }

  function flushProgressSpeechBatch(signal, reason = 'timer') {
    if (!signal || signal.aborted || bridge.activeProgressSignal !== signal) return;
    if (bridge.progressSpeechBatchTimer) {
      clearTimeout(bridge.progressSpeechBatchTimer);
      bridge.progressSpeechBatchTimer = null;
    }
    const events = bridge.progressSpeechBatch;
    bridge.progressSpeechBatch = [];
    bridge.progressSpeechBatchSignal = null;
    bridge.progressSpeechBatchStartedAt = 0;
    const text = summarizeProgressEvents(events, { maxCategories: 3, language: settings.voiceLanguage });
    if (!text) return;
    queueProgressSpeechText(text, signal, `batch-${reason}-${events.length}`);
  }

  function queueVerboseProgressSpeech(event, signal) {
    if (!bridge.verboseProgress || !signal || signal.aborted || bridge.activeProgressSignal !== signal) return;
    const text = String(event || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text) return;
    if (bridge.progressSpeechBatchSignal && bridge.progressSpeechBatchSignal !== signal) {
      bridge.progressSpeechBatch = [];
      if (bridge.progressSpeechBatchTimer) clearTimeout(bridge.progressSpeechBatchTimer);
      bridge.progressSpeechBatchTimer = null;
      bridge.progressSpeechBatchStartedAt = 0;
    }
    bridge.progressSpeechBatchSignal = signal;
    if (!bridge.progressSpeechBatchStartedAt) bridge.progressSpeechBatchStartedAt = Date.now();
    bridge.progressSpeechBatch.push(text);
    const elapsedMs = Date.now() - bridge.progressSpeechBatchStartedAt;
    const ratePerSecond = bridge.progressSpeechBatch.length / Math.max(0.2, elapsedMs / 1000);
    const maxBatchEvents = ratePerSecond >= 6 ? 5 : ratePerSecond >= 3 ? 4 : 3;
    const batchDelayMs = ratePerSecond >= 6 ? 650 : ratePerSecond >= 3 ? 550 : 450;
    if (bridge.progressSpeechBatch.length >= maxBatchEvents) {
      flushProgressSpeechBatch(signal, 'full');
      return;
    }
    if (bridge.progressSpeechBatchTimer) clearTimeout(bridge.progressSpeechBatchTimer);
    bridge.progressSpeechBatchTimer = setTimeout(() => flushProgressSpeechBatch(signal, 'timer'), batchDelayMs);
  }

  function clearProgressSpeechBatch(signal = bridge.activeProgressSignal) {
    if (bridge.progressSpeechBatchTimer) {
      clearTimeout(bridge.progressSpeechBatchTimer);
      bridge.progressSpeechBatchTimer = null;
    }
    if (!signal || bridge.progressSpeechBatchSignal === signal) {
      bridge.progressSpeechBatch = [];
      bridge.progressSpeechBatchSignal = null;
      bridge.progressSpeechBatchStartedAt = 0;
    }
  }

  function stopProgressSpeech(signal, reason = 'final-answer') {
    if (bridge.activeProgressSignal !== signal) return;
    clearProgressSpeechBatch(signal);
    bridge.activeProgressSignal = null;
    if (bridge.activeProgressAbortController && !bridge.activeProgressAbortController.signal.aborted) {
      try { bridge.activeProgressAbortController.abort(); } catch (e) { warn('abort progress speech failed', e?.stack || e); }
    }
    if (bridge.speaking) {
      log('stop progress speech before final answer', reason);
      try { bridge.player.stop(true); } catch (e) { warn('stop progress speech failed', e?.stack || e); }
      bridge.speaking = false;
    }
  }

  return {
    ensureSmartProgressSummarizer,
    smartProgressStatusText,
    progressEmoji,
    formatProgressText,
    sendVerboseProgressText,
    synthProgressTTS,
    speakProgress,
    speakImmediateNotice,
    queueProgressSpeechText,
    flushProgressSpeechBatch,
    queueVerboseProgressSpeech,
    clearProgressSpeechBatch,
    stopProgressSpeech,
  };
}
