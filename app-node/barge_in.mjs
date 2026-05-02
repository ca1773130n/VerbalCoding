export function pcm16StereoLevels(pcm) {
  if (!pcm || pcm.length < 2) return { meanDb: -Infinity, maxDb: -Infinity, sampleCount: 0 };
  const usable = pcm.length - (pcm.length % 2);
  let sumSquares = 0;
  let maxAbs = 0;
  let sampleCount = 0;
  for (let offset = 0; offset < usable; offset += 2) {
    const sample = pcm.readInt16LE(offset);
    const abs = Math.abs(sample);
    if (abs > maxAbs) maxAbs = abs;
    const normalized = sample / 32768;
    sumSquares += normalized * normalized;
    sampleCount += 1;
  }
  if (!sampleCount) return { meanDb: -Infinity, maxDb: -Infinity, sampleCount: 0 };
  const rms = Math.sqrt(sumSquares / sampleCount);
  return {
    meanDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    maxDb: maxAbs > 0 ? 20 * Math.log10(maxAbs / 32768) : -Infinity,
    sampleCount,
  };
}

export function isBargeInCandidate(pcmBytes, levels, thresholds) {
  const minBytes = Number(thresholds?.minBytes ?? 0);
  const minMeanDb = Number(thresholds?.minMeanDb ?? -Infinity);
  const minMaxDb = Number(thresholds?.minMaxDb ?? -Infinity);
  if (pcmBytes < minBytes) return false;
  return levels.meanDb >= minMeanDb || levels.maxDb >= minMaxDb;
}

export function bargeInThresholdsForMode(mode, base = {}) {
  const minSeconds = Number(base.minSeconds ?? 1.4);
  const minMeanDb = Number(base.minMeanDb ?? -30);
  const minMaxDb = Number(base.minMaxDb ?? -14);
  if (mode === 'conservative') {
    const conservativeSeconds = Number(base.conservativeMinSeconds ?? Math.max(minSeconds, 1.8));
    return {
      minBytes: 48000 * 2 * 2 * conservativeSeconds,
      minSeconds: conservativeSeconds,
      minMeanDb: Number(base.conservativeMinMeanDb ?? Math.max(minMeanDb, -27)),
      minMaxDb: Number(base.conservativeMinMaxDb ?? Math.max(minMaxDb, -12)),
      mode: 'conservative',
    };
  }
  return {
    minBytes: 48000 * 2 * 2 * minSeconds,
    minSeconds,
    minMeanDb,
    minMaxDb,
    mode: 'normal',
  };
}

export function sensitivityModeFromTranscript(text) {
  const compact = String(text || '').toLowerCase().replace(/\s+/g, '');
  if (!compact) return null;
  // Do not treat complaints/questions that merely mention a mode as commands.
  if (/(누가|왜|뭐|아니|안|하지마|말고|싫|바꾸랬|하랬|랬어|랬냐|\?)/u.test(compact)) return null;
  if (/(실내|집|조용|평소|기본|일반).*(감도|모드).*(해|켜|바꿔|변경|설정)|감도(올려|높여|평소|기본|일반)(해|로|으로|켜|바꿔|변경|설정)?/u.test(compact)) {
    return { mode: 'normal', reason: 'indoor' };
  }
  if (/(외부|밖|야외|시끄럽|소음|지하철|버스|길거리|카페).*(감도|모드|낮춰|보수|둔감).*(해|켜|바꿔|변경|설정)|감도(낮춰|내려)(해|줘|라|켜|바꿔|변경|설정)?|보수모드(해|켜|바꿔|변경|설정)/u.test(compact)) {
    return { mode: 'conservative', reason: 'outdoor' };
  }
  return null;
}

export function isRepeatedNoiseTranscript(text) {
  const compact = String(text || '')
    .normalize('NFC')
    .replace(/\s+/g, '')
    .replace(/[\p{P}\p{S}_]+/gu, '');
  if (!compact) return true;
  // Keep common short-but-valid Korean utterances. These are frequent phone-call
  // probes/answers and should not be erased after Whisper correctly hears them.
  if (/^(안녕|안녕하세요|야|네|예|응|그래|좋아|오케이|okay|ok)$/iu.test(compact)) return false;
  if (compact.length <= 1) return true;
  if (/^(쒸|쉬|쉿|씁|흠|음|어|아|으|앗|악)$/u.test(compact)) return true;
  if (compact.length <= 3 && !/(잠깐|멈춰|그만|중지|스톱|stop)/iu.test(compact)) return true;

  // Repetition/low-unique-ratio filtering is for short Korean noise/hallucination
  // fragments. English sentences often repeat ordinary letters/words ("the problem",
  // "fuck you") and were being deleted here after Whisper recognized them correctly.
  const hasLatin = /\p{Script=Latin}/u.test(compact);
  const hasHangul = /\p{Script=Hangul}/u.test(compact);
  if (hasLatin && !hasHangul) return false;

  for (let size = 1; size <= Math.floor(compact.length / 2); size += 1) {
    if (compact.length % size !== 0) continue;
    const unit = compact.slice(0, size);
    if (unit.repeat(compact.length / size) === compact) return true;
  }
  const chars = [...compact];
  const uniqueRatio = new Set(chars).size / chars.length;
  return chars.length >= 4 && uniqueRatio <= 0.35 && !/(잠깐|멈춰|그만|중지|스톱|stop)/iu.test(compact);
}

export function isExplicitBargeInTranscript(text) {
  const compact = String(text || '')
    .normalize('NFC')
    .replace(/\s+/g, '')
    .replace(/[\p{P}\p{S}_]+/gu, '')
    .toLowerCase();
  if (!compact || isRepeatedNoiseTranscript(compact)) return false;
  return /(잠깐|멈춰|그만|중지|취소|끊어|스톱|스탑|stop|cancel|abort|shutup|quiet|silence|enough|stopit|stoptalking|말하지마|말그만|조용)/iu.test(compact);
}

export function shouldUseLivePlaybackBargeIn({ speaking, processing }) {
  return Boolean(speaking && !processing);
}

export function createLiveBargeInMonitor({
  minBytes,
  minMeanDb,
  minMaxDb,
  onConfirm,
  log = () => {},
}) {
  const chunks = [];
  let bytes = 0;
  let confirmed = false;
  return {
    push(chunk) {
      if (confirmed || !chunk?.length) return false;
      chunks.push(chunk);
      bytes += chunk.length;
      if (bytes < minBytes) return false;
      const levels = pcm16StereoLevels(Buffer.concat(chunks, bytes));
      if (!isBargeInCandidate(bytes, levels, { minBytes, minMeanDb, minMaxDb })) {
        log('live barge-in below volume threshold', 'pcmBytes', bytes, 'meanDb', levels.meanDb, 'maxDb', levels.maxDb);
        return false;
      }
      confirmed = true;
      onConfirm?.({ pcmBytes: bytes, levels });
      return true;
    },
    get confirmed() {
      return confirmed;
    },
    get bytes() {
      return bytes;
    },
  };
}
