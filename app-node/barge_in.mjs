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
  const minSeconds = Number(base.minSeconds ?? 0.9);
  const minMeanDb = Number(base.minMeanDb ?? -35);
  const minMaxDb = Number(base.minMaxDb ?? -18);
  if (mode === 'conservative') {
    const conservativeSeconds = Number(base.conservativeMinSeconds ?? Math.max(minSeconds, 1.4));
    return {
      minBytes: 48000 * 2 * 2 * conservativeSeconds,
      minSeconds: conservativeSeconds,
      minMeanDb: Number(base.conservativeMinMeanDb ?? Math.max(minMeanDb, -30)),
      minMaxDb: Number(base.conservativeMinMaxDb ?? Math.max(minMaxDb, -14)),
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
  if (/(실내|집|조용|평소|기본|일반).*(감도|모드)|감도(올려|높여|평소|기본|일반)/u.test(compact)) {
    return { mode: 'normal', reason: 'indoor' };
  }
  if (/(외부|밖|야외|시끄럽|소음|지하철|버스|길거리|카페).*(감도|모드|낮춰|보수|둔감)|감도(낮춰|내려)|보수모드/u.test(compact)) {
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
  if (compact.length <= 1) return true;
  if (/^(쒸|쉬|쉿|씁|흠|음|어|아|으|앗|악)$/u.test(compact)) return true;
  if (compact.length <= 3 && !/(잠깐|멈춰|그만|중지|스톱|stop)/iu.test(compact)) return true;
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
  return /(잠깐|멈춰|그만|중지|스톱|스탑|stop|말하지마|말그만|조용)/iu.test(compact);
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
