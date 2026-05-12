# Phase 7 — Voice Plan Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Let the user say "plan it first" and the agent returns a numbered plan, narrated step-by-step; the user can say "skip step 3", "add a test for X after step 2", or "approve" to run the modified plan.

**Architecture:** Stateful plan session in `app-node/plan_mode.mjs`. The first user request is wrapped with a planning preamble in `voiceBridgePrompt`. Agent returns a numbered plan in a `PLAN_BEGIN ... PLAN_END` envelope; we parse, narrate, and listen for follow-up voice commands. Commands mutate the plan; the approval command sends the modified plan back to the agent with an "act on this plan now" preamble.

**Tech Stack:** Node 20 ESM, existing adapter + sentencer, regex grammar (no external NLP).

---

## Spec

### Plan envelope

Agent returns:
```
PLAN_BEGIN
1. <step>
2. <step>
PLAN_END
```

Parser strips envelope and yields `{ id, text, status }`.

### Voice command grammar

- enter: `plan it first` / `plan first` / `먼저 계획`
- skip: `skip step N` / `step N 건너뛰어`
- insert: `add <text> after step N` / `step N 다음에 <text> 추가`
- approve: `approve` / `go ahead` / `실행`
- cancel: `cancel` / `취소`

### Session state

`{ active: boolean, steps: Step[], language: 'en'|'ko' }` stored in `bridge_state.mjs` per channel.

---

## File Structure

- Create: `app-node/plan_mode.mjs`, `app-node/plan_mode.test.mjs`.
- Modify: `app-node/agent_adapters.mjs::voiceBridgePrompt` — add `planMode` branch.
- Modify: `app-node/discord_text.mjs` and `app-node/main.mjs` — route plan-mode utterances.

---

## Tasks

### Task 1: TDD — parsers

- [ ] Write tests in `app-node/plan_mode.test.mjs`:
  1. `parsePlanOutput` extracts numbered steps between markers.
  2. `parseVoiceCommand` recognises skip (en + ko).
  3. `parseVoiceCommand` recognises insert (en + ko).
  4. `parseVoiceCommand` recognises approve in both languages.
  5. `applyCommand` skip flips a step's status.
  6. `applyCommand` insert places a new step after the named one.

- [ ] Run, expect FAIL.

### Task 2: Implement `plan_mode.mjs`

- [ ] Functions to export:
  - `parsePlanOutput(text)` — regex on `/PLAN_BEGIN\s*\n([\s\S]*?)\nPLAN_END/`, then split lines matching `^\s*(\d+)\.\s*(.+)$`.
  - `parseVoiceCommand(text, language)` — small regex set, returns discriminated union `{ type: 'skip'|'insert'|'approve'|'cancel'|'unknown', ...}`.
  - `applyCommand(steps, cmd)` — pure reducer.
  - `renderFinalPlan(steps)` — re-numbers active steps for the approval prompt.

- [ ] Run tests: PASS.
- [ ] Commit: `feat(plan-mode): parsers and reducer`.

### Task 3: Wire `voiceBridgePrompt`

- [ ] In `agent_adapters.mjs::voiceBridgePrompt`, accept `options.planMode`. When set, append:
  ```
  You are in PLAN MODE. Do NOT modify any files. Reply ONLY with a plan:
  PLAN_BEGIN
  1. ...
  2. ...
  PLAN_END
  Each step under 12 words.
  ```
  Korean variant included.
- [ ] Test: `voiceBridgePrompt('do X', { planMode: true })` contains `PLAN_BEGIN`.
- [ ] Commit.

### Task 4: Bridge wiring

- [ ] In `main.mjs`:
  - Detect enter phrase → call agent with `planMode: true` → parse output → store in channel state → speak each step.
  - Each follow-up utterance while `state.active` → `parseVoiceCommand` → mutate state OR on approve call agent again with `renderFinalPlan(...)` as the user prompt and clear state.
- [ ] Add integration test using a fake adapter.
- [ ] Commit.

### Task 5: Document

- [ ] Add a "Voice plan mode" section to `docs/USAGE.md` with example transcript.
- [ ] Commit.

---

## Self-Review

- Spec covered.
- No placeholders.
- Names consistent: `parsePlanOutput`, `parseVoiceCommand`, `applyCommand`, `renderFinalPlan`, `planMode`.
