# Phase 10 — Push Notification Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** When a long-running agent task completes while no human is in the voice channel (or after a configurable idle threshold), send a mobile push notification with a 1-line voice summary; tap the notification to rejoin the VC and hear the full reply.

**Architecture:** New `app-node/notify.mjs` with a provider interface (`send(title, body, deepLink)`). Default provider: ntfy.sh (zero-setup, works with iOS/Android apps, supports a `Click` action that opens a URL). Optional providers: Pushover, Discord DM. Trigger heuristic: task elapsed > `NOTIFY_MIN_TASK_MS` (default 60s) AND VC has 0 non-bot listeners OR user enabled `!notify on` for the session.

**Tech Stack:** Node 20 ESM, `fetch`, optional Discord DM via existing `discord.js` client.

---

## Spec

### Provider API

```javascript
const notifier = createNotifier({ provider: 'ntfy', topic: env.NTFY_TOPIC });
await notifier.send({
  title: 'Hermes finished',
  body: 'Refactor done, 3 files changed, all tests green.',
  deepLink: 'discord://discord.com/channels/<guild>/<channel>',
});
```

### Trigger logic

- Wrap each `agent.run()`; if elapsed > threshold AND `shouldNotify()` returns true, send.
- `shouldNotify()`:
  - User toggle `!notify on` → always send.
  - Or: `getVoiceChannelHumanCount() === 0` → send.

### Body composition

- Use last sentence of sanitized agent answer (short).
- Truncate to 200 chars.
- Strip PII (token/api key patterns) via existing `compactProgressText` helper.

### Discord deep link

- Built from guild+channel IDs.

### Privacy

- Notification body never contains code, diffs, or session_id.

---

## File Structure

- Create: `app-node/notify.mjs`, `app-node/notify.test.mjs`.
- Modify: `app-node/main.mjs` — wrap agent run completion.
- Modify: `.env.example` — `NOTIFY_PROVIDER`, `NTFY_TOPIC`, `PUSHOVER_USER`, `PUSHOVER_TOKEN`, `NOTIFY_MIN_TASK_MS`.

---

## Tasks

### Task 1: TDD — ntfy provider sends correct payload

- [ ] Step 1: Failing test:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier } from './notify.mjs';

test('ntfy provider posts to topic URL with title and body', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  const n = createNotifier({ provider: 'ntfy', topic: 'verbalcoding-test', fetchImpl });
  await n.send({ title: 'Done', body: 'All green.', deepLink: 'discord://x' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /ntfy\.sh\/verbalcoding-test/);
  assert.equal(calls[0].opts.headers.Title, 'Done');
  assert.equal(calls[0].opts.headers.Click, 'discord://x');
  assert.equal(calls[0].opts.body, 'All green.');
});

test('shouldNotify true when zero human listeners', async () => {
  const n = createNotifier({ provider: 'ntfy', topic: 'x', fetchImpl: async () => ({ ok: true }) });
  assert.equal(n.shouldNotify({ humanCount: 0, taskMs: 10_000, minTaskMs: 1000 }), true);
  assert.equal(n.shouldNotify({ humanCount: 1, taskMs: 10_000, minTaskMs: 1000 }), false);
  assert.equal(n.shouldNotify({ humanCount: 0, taskMs: 100, minTaskMs: 1000 }), false);
  assert.equal(n.shouldNotify({ humanCount: 1, taskMs: 10_000, minTaskMs: 1000, userOptIn: true }), true);
});

test('redacts api keys from body', async () => {
  const calls = [];
  const fetchImpl = async (u, o) => { calls.push(o); return { ok: true }; };
  const n = createNotifier({ provider: 'ntfy', topic: 'x', fetchImpl });
  await n.send({ title: 't', body: 'token=sk-abc123 finished', deepLink: '' });
  assert.match(calls[0].body, /\[REDACTED\]/);
  assert.doesNotMatch(calls[0].body, /sk-abc123/);
});
```

- [ ] Step 2: Run, expect FAIL.

### Task 2: Implement `notify.mjs`

- [ ] Step 1: Create module:

```javascript
const SECRET_RE = /\b(?:token|api[_-]?key|password|secret|authorization|bearer|sk-[a-zA-Z0-9_-]+)\b[^\s]*/gi;

function redact(text) {
  return String(text || '').replace(SECRET_RE, '[REDACTED]');
}

export function createNotifier({ provider = 'ntfy', topic = '', fetchImpl = globalThis.fetch, ntfyBase = 'https://ntfy.sh' } = {}) {
  async function send({ title = 'VerbalCoding', body = '', deepLink = '' } = {}) {
    const safeBody = redact(body).slice(0, 200);
    if (provider === 'ntfy') {
      if (!topic) return { skipped: true, reason: 'no topic' };
      const headers = { Title: title };
      if (deepLink) headers.Click = deepLink;
      const res = await fetchImpl(`${ntfyBase}/${encodeURIComponent(topic)}`, {
        method: 'POST',
        headers,
        body: safeBody,
      });
      return { ok: !!res?.ok, status: res?.status };
    }
    if (provider === 'noop') return { ok: true };
    throw new Error(`unknown notify provider ${provider}`);
  }

  function shouldNotify({ humanCount = 0, taskMs = 0, minTaskMs = 60_000, userOptIn = false } = {}) {
    if (taskMs < minTaskMs) return false;
    if (userOptIn) return true;
    return humanCount === 0;
  }

  return { send, shouldNotify };
}
```

- [ ] Step 2: Run tests, expect PASS.
- [ ] Step 3: Commit.

### Task 3: Wire into `main.mjs`

- [ ] Step 1: After each agent run, check `shouldNotify`, build deep link, call `send`.
- [ ] Step 2: Helper `getVoiceChannelHumanCount(channel)` reads voice state.
- [ ] Step 3: Add `!notify on|off` per-channel toggle.
- [ ] Step 4: Commit.

### Task 4: Document

- [ ] Step 1: `.env.example` + `docs/USAGE.md` notification section.
- [ ] Step 2: Commit.
