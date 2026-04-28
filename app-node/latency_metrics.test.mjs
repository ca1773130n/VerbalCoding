import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLatencyTurn,
  summarizeLatencyRecords,
  formatLatencySummary,
} from './latency_metrics.mjs';

test('createLatencyTurn records stage timings and derived total latency', () => {
  let now = 1000;
  const writes = [];
  const turn = createLatencyTurn({
    id: 'turn-1',
    userId: 'u1',
    startedAtMs: now,
    now: () => now,
    writeRecord: record => writes.push(record),
  });

  now = 1200;
  turn.mark('voice_first_packet');
  now = 1800;
  turn.mark('voice_segment_end');
  now = 2100;
  turn.stage('stt', 500, { transcriptChars: 12 });
  now = 3000;
  turn.stage('agent', 900, { answerChars: 30 });
  now = 3500;
  turn.stage('tts_synth', 400, { chunks: 2 });
  now = 4300;
  const record = turn.finish({ status: 'ok' });

  assert.equal(writes.length, 1);
  assert.equal(record.id, 'turn-1');
  assert.equal(record.status, 'ok');
  assert.equal(record.durations.total_ms, 3300);
  assert.equal(record.durations.voice_capture_ms, 600);
  assert.equal(record.durations.stt_ms, 500);
  assert.equal(record.durations.agent_ms, 900);
  assert.equal(record.durations.tts_synth_ms, 400);
  assert.equal(record.meta.transcriptChars, 12);
  assert.equal(record.meta.answerChars, 30);
});

test('summarizeLatencyRecords reports count averages and p95', () => {
  const summary = summarizeLatencyRecords([
    { status: 'ok', durations: { total_ms: 1000, stt_ms: 100, agent_ms: 500 } },
    { status: 'ok', durations: { total_ms: 2000, stt_ms: 300, agent_ms: 700 } },
    { status: 'empty_transcript', durations: { total_ms: 500, stt_ms: 100 } },
  ]);

  assert.equal(summary.count, 3);
  assert.equal(summary.ok, 2);
  assert.equal(summary.statuses.empty_transcript, 1);
  assert.equal(summary.durations.total_ms.avg, 1167);
  assert.equal(summary.durations.stt_ms.avg, 167);
  assert.equal(summary.durations.agent_ms.avg, 600);
  assert.equal(summary.durations.total_ms.p95, 2000);
});

test('formatLatencySummary is compact and readable', () => {
  const text = formatLatencySummary(summarizeLatencyRecords([
    { status: 'ok', durations: { total_ms: 1234, stt_ms: 111, tts_total_ms: 222 } },
  ]));

  assert.match(text, /처리량: 1턴/);
  assert.match(text, /total/);
  assert.match(text, /stt/);
  assert.match(text, /tts_total/);
});
