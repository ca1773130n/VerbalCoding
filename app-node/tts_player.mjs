// Text-to-speech playback pipeline: chunk text -> synth -> play through the
// shared @discordjs/voice AudioPlayer, with optional streaming (sentence-by-
// sentence) playback and barge-in cancellation.
//
// Phase 3 extraction from main.mjs. Reads/writes shared bridge state
// (connection, player, speaking, speechPlaybackGeneration, activeSentencer,
// activeStreamingQueue, streamingSpeechDelivered, ttsBackend) and calls back
// into helpers that still live in main.mjs (refreshTtsRuntimeConfig,
// waitEvent, sendText). Module-level imports keep the heavy dependencies
// (@discordjs/voice helpers, streaming utilities) out of main.mjs.

import fs from 'node:fs';
import { AudioPlayerStatus, StreamType, createAudioResource } from '@discordjs/voice';
import { splitForTTS } from './tts_chunks.mjs';
import { playChunkedTTSWithPrefetch } from './tts_prefetch.mjs';
import { createSentencer } from './stream_sentencer.mjs';
import { createStreamingTTSQueue } from './streaming_tts_queue.mjs';

export function createTtsPlayer(deps) {
  const {
    bridge,
    settings,
    log,
    warn,
    sleep,
    sendText,
    refreshTtsRuntimeConfig,
    waitEvent,
    isAbortError,
    STREAMING_TTS_ENABLED,
  } = deps;

  async function synthTTS(text, signal) {
    await refreshTtsRuntimeConfig();
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        log('final tts synth start', 'backend', bridge.ttsBackend.name, 'attempt', attempt, 'chars', String(text || '').length);
        const out = await bridge.ttsBackend.synthesize(text, { signal, kind: 'final' });
        log('final tts synth done', 'backend', bridge.ttsBackend.name, 'attempt', attempt, out, fs.statSync(out).size);
        return out;
      } catch (e) {
        lastError = e;
        if (isAbortError(e) || signal?.aborted) throw e;
        warn('final tts synth failed', 'attempt', attempt, e?.stderr?.toString?.().slice(-500) || e?.message || e);
        await sleep(1000 * attempt);
      }
    }
    throw lastError;
  }

  async function playAudio(file, { deleteAfter = true } = {}) {
    if (!bridge.connection) return;
    bridge.speaking = true;
    try {
      const resource = createAudioResource(file, { inputType: StreamType.Arbitrary, inlineVolume: true });
      resource.volume?.setVolume(settings.tts.volume);
      bridge.player.play(resource);
      bridge.connection.subscribe(bridge.player);
      await waitEvent(bridge.player, AudioPlayerStatus.Idle, 120000).catch(() => {});
    } finally {
      bridge.speaking = false;
      if (deleteAfter) fs.rm(file, { force: true }, () => {});
    }
  }

  async function speakText(text, signal, metricsTurn = null, options = {}) {
    const chunks = splitForTTS(text, settings.tts.maxChars);
    if (!chunks.length) return;
    if (options.mirrorText !== false) {
      await sendText(`${options.mirrorPrefix || '🔊 음성으로 읽는 내용'}:\n${String(text || '')}`);
    }
    log('TTS chunks', chunks.length, 'maxChars', settings.tts.maxChars, 'backend', bridge.ttsBackend.name);
    const playbackGeneration = bridge.speechPlaybackGeneration;
    const playbackStopped = () => playbackGeneration !== bridge.speechPlaybackGeneration;
    let synthMs = 0;
    let playMs = 0;
    const ttsStart = Date.now();
    await playChunkedTTSWithPrefetch(chunks, {
      signal,
      log,
      synth: async chunk => {
        if (playbackStopped()) return null;
        const start = Date.now();
        try { return await synthTTS(chunk, signal); }
        finally { synthMs += Date.now() - start; }
      },
      play: async file => {
        if (playbackStopped()) {
          await fs.promises.rm(file, { force: true }).catch(() => {});
          return;
        }
        const start = Date.now();
        try { return await playAudio(file); }
        finally { playMs += Date.now() - start; }
      },
      cleanup: file => fs.promises.rm(file, { force: true }),
    });
    metricsTurn?.stage('tts_synth', synthMs, { ttsChunks: chunks.length, spokenChars: String(text || '').length });
    metricsTurn?.stage('tts_play', playMs);
    metricsTurn?.stage('tts_total', Date.now() - ttsStart);
  }

  function beginStreamingTurn(signal) {
    if (!STREAMING_TTS_ENABLED || !bridge.connection) return false;
    bridge.streamingSpeechDelivered = false;
    const sentencer = createSentencer({ minChars: 40, maxLatencyMs: 800 });
    let streamingDropAnnounced = false;
    const queue = createStreamingTTSQueue({
      synth: async text => synthTTS(text, signal),
      play: async file => playAudio(file, { deleteAfter: false }),
      cleanup: async file => { try { await fs.promises.rm(file, { force: true }); } catch {} },
      signal,
      log,
      onSynthError: () => {
        if (streamingDropAnnounced || signal?.aborted) return;
        streamingDropAnnounced = true;
        const en = /^en/i.test(String(settings.voiceLanguage || ''));
        const msg = en
          ? 'Some sentences could not be spoken; check the text channel for the full answer.'
          : '일부 문장 음성 합성에 실패했어. 전체 답변은 텍스트 채널을 확인해줘.';
        void sendText(`⚠️ ${msg}`).catch(e => warn('streaming synth notice send failed', e?.message || e));
      },
    });
    sentencer.on('sentence', text => {
      if (signal?.aborted) return;
      queue.enqueue(text);
    });
    bridge.activeSentencer = sentencer;
    bridge.activeStreamingQueue = queue;
    log('streaming turn begin');
    return true;
  }

  async function endStreamingTurn() {
    const sentencer = bridge.activeSentencer;
    const queue = bridge.activeStreamingQueue;
    bridge.activeSentencer = null;
    bridge.activeStreamingQueue = null;
    if (!sentencer || !queue) return;
    try { sentencer.flush(); } catch (e) { warn('streaming sentencer flush failed', e?.stack || e); }
    try { await queue.drain(); } catch (e) { warn('streaming queue drain failed', e?.stack || e); }
    bridge.streamingSpeechDelivered = queue.size === 0;
    log('streaming turn end');
  }

  function stopPlaybackForBargeIn(userId, reason = 'playback-barge-in') {
    if (!bridge.speaking) return false;
    log('stop playback for barge-in', 'byUser', userId, 'reason', reason, 'speaking', bridge.speaking, 'processing', bridge.processing, 'turn', bridge.activeTurnId);
    bridge.speechPlaybackGeneration += 1;
    try { bridge.player.stop(true); } catch (e) { warn('stop playback failed', e?.stack || e); }
    bridge.speaking = false;
    return true;
  }

  return {
    synthTTS,
    playAudio,
    speakText,
    beginStreamingTurn,
    endStreamingTurn,
    stopPlaybackForBargeIn,
  };
}
