import fs from 'node:fs';
import path from 'node:path';

function roundMs(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function percentile(values, p) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const idx = Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1);
  return xs[idx];
}

export function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
}

export function readJsonlRecords(file, { limit = 200 } = {}) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(Math.max(0, lines.length - limit)).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

export function createLatencyTurn({ id, userId, startedAtMs = Date.now(), now = Date.now, writeRecord = () => {} } = {}) {
  const marks = { start: startedAtMs };
  const durations = {};
  const meta = {};
  let finished = false;

  return {
    id,
    userId,
    marks,
    durations,
    meta,
    mark(name, atMs = now()) {
      marks[name] = atMs;
      return atMs;
    },
    stage(name, durationMs, extra = {}) {
      durations[`${name}_ms`] = roundMs(durationMs);
      Object.assign(meta, extra);
    },
    addMeta(extra = {}) {
      Object.assign(meta, extra);
    },
    finish(extra = {}) {
      if (finished) return null;
      finished = true;
      const endedAtMs = extra.endedAtMs ?? now();
      marks.end = endedAtMs;
      if (marks.voice_first_packet && marks.voice_segment_end) {
        durations.voice_capture_ms = roundMs(marks.voice_segment_end - marks.voice_first_packet);
      }
      if (marks.voice_segment_end && marks.utterance_flush) {
        durations.utterance_idle_wait_ms = roundMs(marks.utterance_flush - marks.voice_segment_end);
      }
      durations.total_ms = roundMs(endedAtMs - marks.start);
      const record = {
        id,
        userId,
        ts: new Date(endedAtMs).toISOString(),
        status: extra.status || 'ok',
        durations,
        meta,
      };
      if (extra.error) record.error = String(extra.error).slice(0, 500);
      writeRecord(record);
      return record;
    },
  };
}

export function summarizeLatencyRecords(records = []) {
  const statuses = {};
  const durationKeys = new Set();
  for (const r of records) {
    statuses[r.status || 'unknown'] = (statuses[r.status || 'unknown'] || 0) + 1;
    for (const key of Object.keys(r.durations || {})) durationKeys.add(key);
  }
  const durations = {};
  for (const key of [...durationKeys].sort()) {
    const values = records.map(r => Number(r.durations?.[key])).filter(Number.isFinite);
    if (!values.length) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    durations[key] = {
      avg: roundMs(sum / values.length),
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      min: Math.min(...values),
      max: Math.max(...values),
      n: values.length,
    };
  }
  return {
    count: records.length,
    ok: statuses.ok || 0,
    statuses,
    durations,
  };
}

export function formatLatencySummary(summary) {
  if (!summary?.count) return 'latency 기록이 아직 없어.';
  const names = [
    'total_ms',
    'voice_capture_ms',
    'utterance_idle_wait_ms',
    'stt_ms',
    'agent_ms',
    'tts_synth_ms',
    'tts_play_ms',
    'tts_total_ms',
  ];
  const lines = [`처리량: ${summary.count}턴, 성공 ${summary.ok}턴`];
  for (const name of names) {
    const s = summary.durations[name];
    if (!s) continue;
    const label = name.replace(/_ms$/, '');
    lines.push(`${label}: avg ${s.avg}ms / p95 ${s.p95}ms / max ${s.max}ms (n=${s.n})`);
  }
  const otherStatuses = Object.entries(summary.statuses)
    .filter(([k]) => k !== 'ok')
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
  if (otherStatuses) lines.push(`기타 상태: ${otherStatuses}`);
  return lines.join('\n');
}
