# Phase 6 — Smart Progress Summarization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Replace pattern-matched progress narration ("editing files routes.ts, server.ts") with semantic summaries ("wiring the new endpoint into the router").

**Architecture:** Add a `SmartProgressSummarizer` that buffers raw progress events for `summaryWindowMs` (default 4000ms) and asks a small LLM (Groq llama-3.1-8b or local ollama) to compress them into one human sentence. Fall back to the existing regex labels on summarizer failure/timeout/no-API-key.

**Tech Stack:** Node 20 ESM, `fetch` (Groq OpenAI-compatible API by default).

---

## Spec

### API

```javascript
const summarizer = createSmartProgressSummarizer({
  apiKey: env.SMART_PROGRESS_API_KEY || env.GROQ_API_KEY,
  baseUrl: env.SMART_PROGRESS_BASE_URL || 'https://api.groq.com/openai/v1',
  model: env.SMART_PROGRESS_MODEL || 'llama-3.1-8b-instant',
  windowMs: 4000,
  language: 'en' | 'ko',
  fallback: rawEvent => rawEvent,
});
summarizer.ingest(rawEvent);
summarizer.on('summary', text => ...);
```

### Behavior

- Buffer events for `windowMs`; when window expires OR buffer hits 8 events, request a summary.
- Prompt: "Summarize what the coding agent is doing into one short sentence ({language}). Events: ..."
- 1.5s timeout — fall through to fallback if exceeded.
- Cache identical event windows for 60s (dedupe back-to-back identical narration).
- Disabled when no API key — pure fallback to current regex events.

### Integration

- `progress_speech.mjs` already handles narration cadence; add `summarizer` upstream.
- Voice toggleable: `!smart-progress on|off`.

---

## File Structure

- Create: `app-node/smart_progress.mjs`, `app-node/smart_progress.test.mjs`.
- Modify: `app-node/progress_speech.mjs` — inject summarizer.
- Modify: `app-node/main.mjs` — wire toggle.
- Modify: `.env.example` — new env keys.

---

## Tasks

### Task 1: TDD — fallback when no API key

- [ ] Step 1: Write failing test:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSmartProgressSummarizer } from './smart_progress.mjs';

test('falls back to raw events when no apiKey', async () => {
  const out = [];
  const s = createSmartProgressSummarizer({ windowMs: 10 });
  s.on('summary', t => out.push(t));
  s.ingest('reading files routes.ts');
  s.ingest('editing files routes.ts');
  await new Promise(r => setTimeout(r, 30));
  assert.ok(out.includes('reading files routes.ts'));
  assert.ok(out.includes('editing files routes.ts'));
});
```

- [ ] Step 2: Run, expect FAIL.

### Task 2: Implement minimal summarizer (fallback path only)

- [ ] Step 1: Create `app-node/smart_progress.mjs`:

```javascript
import { EventEmitter } from 'node:events';

export function createSmartProgressSummarizer({
  apiKey = '',
  baseUrl = 'https://api.groq.com/openai/v1',
  model = 'llama-3.1-8b-instant',
  windowMs = 4000,
  language = 'en',
  fetchImpl = globalThis.fetch,
  timeoutMs = 1500,
  cacheMs = 60_000,
} = {}) {
  const ee = new EventEmitter();
  let buffer = [];
  let timer = null;
  const cache = new Map();

  function flush() {
    timer = null;
    const events = buffer; buffer = [];
    if (!events.length) return;
    if (!apiKey) { for (const e of events) ee.emit('summary', e); return; }
    summarize(events).then(text => ee.emit('summary', text || events[events.length - 1])).catch(() => { for (const e of events) ee.emit('summary', e); });
  }

  async function summarize(events) {
    const key = events.join('|');
    const cached = cache.get(key);
    if (cached && Date.now() - cached.t < cacheMs) return cached.text;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        signal: ctl.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 40,
          messages: [
            { role: 'system', content: `Summarize a coding agent's recent actions in one short ${language === 'ko' ? 'Korean' : 'English'} sentence. No file paths unless essential. No quotes.` },
            { role: 'user', content: events.join('\n') },
          ],
        }),
      });
      const data = await r.json();
      const text = (data?.choices?.[0]?.message?.content || '').trim();
      cache.set(key, { text, t: Date.now() });
      return text;
    } finally { clearTimeout(to); }
  }

  return {
    on: (e, fn) => ee.on(e, fn),
    ingest(event) {
      if (!event) return;
      buffer.push(String(event));
      if (buffer.length >= 8) { clearTimeout(timer); flush(); return; }
      if (!timer) timer = setTimeout(flush, windowMs);
    },
  };
}
```

- [ ] Step 2: Run, expect PASS.
- [ ] Step 3: Commit.

### Task 3: TDD — calls fetch with apiKey

- [ ] Step 1: Write test that injects fake fetch and asserts the request body.
- [ ] Step 2: Run, expect PASS (implementation already supports this).
- [ ] Step 3: Commit.

### Task 4: TDD — timeout falls back to last raw event

- [ ] Step 1: Inject a fetch that never resolves; assert fallback after `timeoutMs`.
- [ ] Step 2: Commit.

### Task 5: Wire into `progress_speech.mjs`

- [ ] Step 1: Read existing module to find narration entry; pipe summaries through summarizer when enabled.
- [ ] Step 2: Add `!smart-progress` toggle parsed in `discord_text.mjs`.
- [ ] Step 3: Commit.

### Task 6: Document

- [ ] Step 1: `.env.example` — `SMART_PROGRESS_API_KEY`, `SMART_PROGRESS_MODEL`.
- [ ] Step 2: Commit.
