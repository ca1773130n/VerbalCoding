# Phase 15 — Phone Companion PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** When a Phase 10 push notification fires while no human is in the bound voice channel, tapping it opens a PWA that (a) replays the agent's `spokenAnswer` audio, (b) lets the user re-engage by voice — speech captured in the PWA is delivered to the bot as if uttered in the bound VC, and (c) shows an optional markdown summary plus progress events.

**Architecture:** A new `app-node/companion_server.mjs` boots an Express HTTP server in the same Node process as `main.mjs`. It serves a static PWA from `app-node/companion_pwa/` (manifest, service worker, single-page UI). Each push notification carries a one-time-use, HMAC-signed token scoped to `(userId, messageId, ttl=600s)` and a `Click` URL pointing at `https://<COMPANION_BASE>/c/#<token>`. On load the PWA POSTs `/companion/session` to redeem the token, fetches the pre-rendered `spokenAnswer.opus` (cached in-memory by messageId), and renders the markdown body. Re-engage records mic audio via MediaRecorder, uploads to `/companion/utterance`, and main.mjs dispatches it through the existing voice transcript pipeline bound to `activeVoiceChannelId`.

**Tech Stack:** Node 20 ESM, `express` (new dep), `crypto.timingSafeEqual` for token verify, existing `ttsBackend` for pre-render, browser `MediaRecorder` (opus) + `Web Audio` for playback, no build step (single hand-written PWA bundle).

## Spec

### Token grammar
- Payload: `base64url({uid, mid, vcid, gid, exp})` + `.` + `base64url(HMAC-SHA256(payload, COMPANION_SECRET))`.
- TTL default 600s. Single-use: redeemed tokens recorded in an in-memory `Set<string>` cleared on bot restart.
- `COMPANION_SECRET` required when `COMPANION_BASE` is set; bot refuses to boot otherwise.

### Pre-rendered audio
- `maybeNotifyTaskComplete` (`app-node/main.mjs:369-394`) gains a sibling helper `prerenderSpokenAnswer(spokenText, lang)` that calls the existing `ttsBackend.synthesize` (same path used at `main.mjs:1495-1496`) and stashes the resulting opus bytes in a bounded LRU keyed by `messageId` (cap 32, 10 MB).
- `notify.mjs` `send()` is extended with optional `audioUrl` and `summaryUrl` fields; the ntfy provider sets `X-Attach` and `X-Actions` headers, pushover sets `url`/`url_title`. Existing redaction in `notify.mjs:5-10` still applies to title/body.

### Re-engage path
- PWA POSTs WebM/opus blob + token to `/companion/utterance`.
- Server hands the blob to a new `dispatchCompanionUtterance({userId, vcid, blob})` that resamples (existing `prism.opus.Decoder`) and feeds the same downstream `processVoiceTranscript(text)` path used by the VC listener (call site near `main.mjs:1488-1497`). Result: the bot answers as if the user spoke in `activeVoiceChannelId`.
- If `vcid` differs from `activeVoiceChannelId`, the bot rebinds (mirrors `pickOccupiedUserVoiceChannel`) before replying.

### Summary view
- `/companion/summary/:mid` returns `{markdown, progressEvents}`. Markdown is the existing `fullAnswerText` (`main.mjs:1491`). Progress events come from the existing `summarizeProgressEvents` output already collected per-turn.

### Security
- All `/companion/*` routes require a valid token in `Authorization: Bearer`.
- Tokens single-use, 10-min TTL, scoped to `(uid, mid, vcid)`. Replay → 401.
- Mic upload capped at 1 MB and 30 s.
- Rate-limit: 10 req/min per token (in-memory bucket).

## File Structure
- Create: `app-node/companion_server.mjs`, `app-node/companion_tokens.mjs`, `app-node/companion_tokens.test.mjs`, `app-node/companion_pwa/{index.html,app.js,sw.js,manifest.webmanifest,styles.css}`.
- Modify: `app-node/notify.mjs` — accept `audioUrl`, `summaryUrl`; build companion deep link helper `buildCompanionLink({base, token})`.
- Modify: `app-node/main.mjs` — pre-render audio inside `maybeNotifyTaskComplete` (line 369), mint token, swap `deepLink` for the companion URL, boot companion server at startup, add `dispatchCompanionUtterance` near the text-agent path (line 1488).
- Modify: `.env.example` — `COMPANION_BASE`, `COMPANION_SECRET`, `COMPANION_PORT`, `COMPANION_TTL_SEC`.
- Modify: `package.json` — add `express` dep.

## Tasks

### Task 1: TDD — token mint/verify
- [ ] Step 1: Write `companion_tokens.test.mjs` covering: roundtrip ok, tampered payload fails, expired fails, single-use replay fails, wrong secret fails.
- [ ] Step 2: Implement `companion_tokens.mjs` exporting `mint({uid,mid,vcid,gid,ttlSec,secret})` and `verify(token, {secret, redeemed})`.
- [ ] Step 3: Run `node --test app-node/companion_tokens.test.mjs`, expect PASS. Commit.

### Task 2: Pre-render audio + extend notifier
- [ ] Step 1: Add bounded LRU `companionAudioCache` in `main.mjs` and `prerenderSpokenAnswer()` reusing `ttsBackend`.
- [ ] Step 2: Extend `notify.mjs send()` signature with `audioUrl`, `summaryUrl`; map per-provider headers.
- [ ] Step 3: Add `notify.test.mjs` cases for ntfy `X-Actions` and pushover `url` carrying the companion link.
- [ ] Step 4: Commit.

### Task 3: companion_server.mjs + PWA
- [ ] Step 1: Boot Express on `COMPANION_PORT` from `main.mjs` startup; mount `/c/*` static and `/companion/*` API.
- [ ] Step 2: Routes — `POST /companion/session`, `GET /companion/audio/:mid`, `GET /companion/summary/:mid`, `POST /companion/utterance`.
- [ ] Step 3: PWA — manifest (standalone), SW (cache-first for static, network-only for API), `app.js` handles token redeem, autoplay (user-gesture fallback), MediaRecorder upload, summary render via lightweight markdown renderer.
- [ ] Step 4: Add `companion_server.test.mjs` exercising token flow and utterance dispatch with a stub agent adapter.
- [ ] Step 5: Commit.

### Task 4: Wire re-engage into agent pipeline
- [ ] Step 1: Factor the text-agent dispatch at `main.mjs:1488-1497` into `runAgentForUtterance({text, vcid, gid, speakResponse})` reused by VC and companion paths.
- [ ] Step 2: Companion utterance → Whisper STT (existing `transcribeWav`) → `runAgentForUtterance({speakResponse: vcOccupied})`.
- [ ] Step 3: If VC empty, response is delivered as a second push (re-uses Phase 10), creating a conversational loop entirely over phone.
- [ ] Step 4: Commit.

### Task 5: Document
- [ ] Step 1: `.env.example` entries + `docs/USAGE.md` companion section with QR-code suggestion for first-pair UX.
- [ ] Step 2: Note out-of-scope: native push reliability, multi-device replay.
- [ ] Step 3: Commit.
