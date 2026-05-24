// Voice I/O pipeline: Discord opus receive -> per-user WAV segments ->
// idle-merged utterance -> whisper transcription -> cleaned text.
//
// Phase 2 extraction from main.mjs. The functions read/write shared bridge
// state (activeStreams, speaking, processing, bridgeState) and call back
// into helpers that still live in main.mjs (currentBargeInThresholds,
// stopPlaybackForBargeIn, handleRecording, etc.), so the factory takes
// them all explicitly.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EndBehaviorType } from '@discordjs/voice';
import prism from 'prism-media';
import wav from 'wav';
import { shouldPassWhisperLanguage } from './language_config.mjs';
import { whisperFailureMessage } from './stt_whisper.mjs';
import { isRepeatedNoiseTranscript } from './barge_in.mjs';

export function createVoiceIO(deps) {
  const {
    bridge,
    settings,
    client,
    execFileAsync,
    log,
    warn,
    stamp,
    sleep,
    isAllowed,
    UTTERANCE_IDLE_MS,
    SUBSCRIBE_AFTER_SILENCE_MS,
    MIN_UTTERANCE_BYTES,
    MIN_MEAN_VOLUME_DB,
    MIN_MAX_VOLUME_DB,
    currentBargeInThresholds,
    currentPlaybackBargeInThresholds,
    createLiveBargeInMonitor,
    shouldUseLivePlaybackBargeIn,
    stopPlaybackForBargeIn,
    analyzeAudio,
    concatWavs,
    saveCapturedVoiceCloneSample,
    isBargeInCandidate,
    validateProcessingBargeIn,
    enqueueDeferredProcessingUtterance,
    newLatencyTurn,
    handleRecording,
  } = deps;

  async function transcribeOnce(wavPath, input16k, outBase) {
    const args = ['-m', settings.whisperModel, '-f', input16k];
    if (shouldPassWhisperLanguage(settings.whisperLanguage)) args.push('-l', settings.whisperLanguage);
    args.push('-nt', '-otxt', '-of', outBase, '-sns', '-nf', '-nth', '0.35', '-et', '2.2', '-lpt', '-0.8');
    try {
      await execFileAsync(settings.whisperBin, args, { timeout: settings.whisperTimeoutMs, maxBuffer: 4 * 1024 * 1024 });
    } catch (e) {
      throw new Error(`whisper failed: ${whisperFailureMessage(e)}`);
    }
    const txtPath = `${outBase}.txt`;
    const raw = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
    return { raw, txtPath };
  }

  async function transcribe(wavPath) {
    const tmpBase = path.join(os.tmpdir(), `hermes-node-stt-${Date.now()}`);
    const input16k = `${tmpBase}.16k.wav`;
    const outBase = `${tmpBase}.out`;
    // whisper.cpp can read WAV, but Discord receiver output is 48 kHz stereo.
    // Convert explicitly to the 16 kHz mono PCM shape Whisper expects.
    await execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', input16k], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });

    let raw = '';
    let txtPath = '';
    try {
      ({ raw, txtPath } = await transcribeOnce(wavPath, input16k, outBase));
      let cleaned = cleanTranscript(raw);
      log('stt raw', JSON.stringify(raw.trim()).slice(0, 500), 'cleaned', JSON.stringify(cleaned).slice(0, 500));
      if (!cleaned) {
        await sleep(300);
        const retryBase = `${tmpBase}.retry`;
        const retry = await transcribeOnce(wavPath, input16k, retryBase);
        raw = retry.raw;
        txtPath = retry.txtPath;
        cleaned = cleanTranscript(raw);
        log('stt retry raw', JSON.stringify(raw.trim()).slice(0, 500), 'cleaned', JSON.stringify(cleaned).slice(0, 500));
      }
      return cleaned;
    } finally {
      if (settings.debugDir) {
        const debug16k = path.join(settings.debugDir, `stt-input-${stamp()}.wav`);
        fs.copyFile(input16k, debug16k, () => {});
        if (raw) fs.writeFile(path.join(settings.debugDir, `stt-raw-${stamp()}.txt`), raw, () => {});
      }
      fs.rm(input16k, { force: true }, () => {});
      if (txtPath) fs.rm(txtPath, { force: true }, () => {});
    }
  }

  function cleanTranscript(raw) {
    const bad = [
      '구독', '좋아요', '알림설정', '시청해주셔서', '시청해주신', '다음영상', '영상에서만나요',
      '부탁드려요', '큰힘이됩니다',
      'mbc뉴스', '이준범기자입니다', '뉴스입니다', '기자입니다', '앵커', '속보', '보도입니다', '전해드립니다',
    ];
    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.replace(/^\[[^\]]+\]\s*/, '').trim());
    const kept = [];
    for (const line of lines) {
      const compact = line
        .replace(/\s+/g, '')
        .replace(/[\p{P}\p{S}_]+/gu, '');
      if (!compact) continue;
      if (/^[\(\[（【].*[\)\]）】]$/.test(line.replace(/\s+/g, ''))) continue;
      if (['끄덕', '끄덕끄덕', '박수', '웃음', '음악', '자막', '침묵', '무음'].includes(compact)) continue;
      if (bad.some(b => compact.toLowerCase().includes(b))) continue;
      if (isRepeatedNoiseTranscript(compact)) continue;
      kept.push(line);
    }
    return kept.join(' ').trim();
  }

  function queueSegment(userId, file, pcmBytes, startedAtMs = Date.now(), endedAtMs = Date.now()) {
    const pending = bridge.bridgeState.appendSegment(userId, {
      file,
      pcmBytes,
      startedAtMs,
      endedAtMs,
      timerFactory: () => setTimeout(() => flushUtterance(userId).catch(e => warn('flushUtterance failed', userId, e?.stack || e)), UTTERANCE_IDLE_MS),
    });
    log('queued segment', userId, 'segments', pending.files.length, 'totalPcmBytes', pending.pcmBytes, 'idleMs', UTTERANCE_IDLE_MS, 'epoch', pending.epoch);
  }

  async function flushUtterance(userId) {
    const pending = bridge.bridgeState.deletePending(userId);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    const files = pending.files;
    const pcmBytes = pending.pcmBytes;
    const metricsTurn = newLatencyTurn(userId, pending.firstPacketAt || Date.now());
    metricsTurn.mark('voice_first_packet', pending.firstPacketAt || Date.now());
    metricsTurn.mark('voice_segment_end', pending.lastSegmentEndAt || Date.now());
    metricsTurn.mark('utterance_flush');
    metricsTurn.addMeta({ segments: files.length, pcmBytes, epoch: pending.epoch });
    if (pending.epoch !== bridge.bridgeState.currentEpoch()) {
      log('drop stale utterance after voice input queue reset', userId, 'utteranceEpoch', pending.epoch, 'currentEpoch', bridge.bridgeState.currentEpoch());
      for (const file of files) fs.rm(file, { force: true }, () => {});
      metricsTurn.finish({ status: 'stale_after_config_change' });
      return;
    }
    if (pcmBytes < MIN_UTTERANCE_BYTES) {
      log('skip short utterance', userId, 'segments', files.length, 'pcmBytes', pcmBytes, 'minBytes', MIN_UTTERANCE_BYTES);
      metricsTurn.finish({ status: 'skip_short' });
      return;
    }
    const merged = path.join(settings.debugDir, `utterance-merged-${stamp()}-${userId}.wav`);
    await concatWavs(files, merged);
    const levels = await analyzeAudio(merged);
    log('utterance levels', userId, 'segments', files.length, 'pcmBytes', pcmBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb);
    if (await saveCapturedVoiceCloneSample(userId, merged, pcmBytes, files.length)) {
      metricsTurn.addMeta({ meanDb: levels.meanDb, maxDb: levels.maxDb });
      metricsTurn.finish({ status: 'voice_clone_sample_saved' });
      return;
    }
    const candidate = isBargeInCandidate(pcmBytes, levels);
    if (bridge.speaking || bridge.processing) {
      const thresholds = currentBargeInThresholds();
      if (!candidate) {
        log('check weak barge-in for explicit stop transcript', userId, 'pcmBytes', pcmBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb, 'thresholdBytes', thresholds.minBytes, 'thresholds', thresholds.minMeanDb, thresholds.minMaxDb, 'mode', thresholds.mode);
      }
      const validation = await validateProcessingBargeIn(userId, merged, pcmBytes, files.length);
      if (validation?.action === 'interrupt') {
        metricsTurn.finish({ status: bridge.processing ? 'barge_in_processing_interrupt' : 'barge_in_playback_interrupt' });
        return;
      }
      if (bridge.processing && validation?.action === 'defer') {
        const queued = enqueueDeferredProcessingUtterance({
          userId,
          wavPath: merged,
          pcmBytes,
          segments: files.length,
          startedAtMs: pending.firstPacketAt || Date.now(),
        });
        metricsTurn.finish({ status: queued ? 'deferred_during_processing' : 'drop_deferred_during_processing' });
        return;
      }
      metricsTurn.finish({ status: bridge.speaking ? 'barge_in_playback_ignored' : 'barge_in_processing_ignored' });
      return;
    }
    // Drop only when BOTH overall energy and peak are low. Real Discord speech from this
    // mic can have low mean volume while still carrying intelligible peaks; using OR here
    // caused valid Korean utterances to be discarded as "low-energy".
    if (levels.meanDb < MIN_MEAN_VOLUME_DB && levels.maxDb < MIN_MAX_VOLUME_DB) {
      log('skip low-energy utterance', userId, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb, 'thresholds', MIN_MEAN_VOLUME_DB, MIN_MAX_VOLUME_DB, 'mode', 'both-below');
      metricsTurn.addMeta({ meanDb: levels.meanDb, maxDb: levels.maxDb });
      metricsTurn.finish({ status: 'skip_low_energy' });
      return;
    }
    metricsTurn.addMeta({ meanDb: levels.meanDb, maxDb: levels.maxDb });
    await handleRecording(userId, merged, pcmBytes, files.length, metricsTurn);
  }

  function subscribeUser(receiver, userId) {
    if (!isAllowed(userId)) return;
    if (String(userId) === client.user?.id) return;
    const wasSpeaking = bridge.speaking;
    const wasProcessing = bridge.processing;
    if ((wasSpeaking || wasProcessing) && !bridge.activeStreams.has(userId)) {
      // Speaking-start alone is too noisy in Discord voice. Record and validate a
      // real segment first; only confirmed playback barge-in stops the current
      // audio chunk, and only explicit stop transcripts abort active agent work.
      log('possible barge-in start; waiting for segment validation', userId, 'speaking', wasSpeaking, 'processing', wasProcessing);
    }
    if (bridge.activeStreams.has(userId)) return;
    const pending = bridge.bridgeState.getPending(userId);
    if (pending?.timer) {
      bridge.bridgeState.clearPendingTimer(userId);
      log('extend pending utterance because new segment started', userId, 'segments', pending.files.length, 'totalPcmBytes', pending.pcmBytes);
    }

    const file = path.join(settings.debugDir, `segment-${stamp()}-${userId}.wav`);
    log('subscribe user', userId, file);
    const opusStream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: SUBSCRIBE_AFTER_SILENCE_MS } });
    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    const writer = new wav.FileWriter(file, { sampleRate: 48000, channels: 2, bitDepth: 16 });
    bridge.activeStreams.set(userId, { opusStream, decoder, writer, file, startedAtMs: Date.now() });
    let pcmBytes = 0;
    const liveThresholds = wasSpeaking && !wasProcessing ? currentPlaybackBargeInThresholds() : currentBargeInThresholds();
    const liveBargeIn = shouldUseLivePlaybackBargeIn({ speaking: wasSpeaking, processing: wasProcessing }) ? createLiveBargeInMonitor({
      minBytes: liveThresholds.minBytes,
      minMeanDb: liveThresholds.minMeanDb,
      minMaxDb: liveThresholds.minMaxDb,
      requireBoth: liveThresholds.requireBoth,
      log,
      onConfirm: ({ pcmBytes: confirmedBytes, levels }) => {
        log('confirmed live playback barge-in before segment end', userId, 'pcmBytes', confirmedBytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb);
        stopPlaybackForBargeIn(userId, 'confirmed-live-playback-barge-in');
      },
    }) : null;
    decoder.on('data', chunk => {
      pcmBytes += chunk.length;
      liveBargeIn?.push(chunk);
    });
    opusStream.on('error', e => warn('opus stream error', userId, e?.stack || e));
    decoder.on('error', e => warn('opus decoder error', userId, e?.stack || e));
    writer.on('error', e => warn('wav writer error', userId, e?.stack || e));
    opusStream.on('end', () => log('opus end', userId, 'pcmBytes', pcmBytes));
    writer.on('finish', () => {
      const streamState = bridge.activeStreams.get(userId);
      bridge.activeStreams.delete(userId);
      const endedAtMs = Date.now();
      log('saved segment', userId, 'pcmBytes', pcmBytes, file);
      queueSegment(userId, file, pcmBytes, streamState?.startedAtMs || endedAtMs, endedAtMs);
    });
    opusStream.pipe(decoder).pipe(writer);
  }

  return {
    transcribeOnce,
    transcribe,
    cleanTranscript,
    queueSegment,
    flushUtterance,
    subscribeUser,
  };
}
