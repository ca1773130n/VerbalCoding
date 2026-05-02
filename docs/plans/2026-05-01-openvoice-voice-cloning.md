# OpenVoice Voice Cloning Integration Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Add an optional local voice-cloning TTS backend to VerbalCoding while preserving the current Edge TTS fallback.

Architecture: Keep Discord receive/STT/agent/playback unchanged. Extract TTS synthesis behind a backend adapter interface in Node, with `edge` as default and `openvoice` as an optional Python CLI subprocess backend. Use OpenVoice V2 first because it is modern, MIT licensed, supports Korean natively, and is better suited than the older Real-Time-Voice-Cloning repo despite having fewer stars.

Tech Stack: Node.js bridge, Python venv for OpenVoice, ffmpeg, OpenVoice V2, existing Discord playback via @discordjs/voice.

Safety / consent: Voice cloning must only be enabled with a user-provided reference sample that the user owns or has permission to use. Do not bundle third-party voices. Keep reference audio paths local and gitignored.

---

## Why OpenVoice instead of the highest-star repo

The highest-star repo found was `CorentinJ/Real-Time-Voice-Cloning` (~59.7k stars), but its README says it is old and no longer state-of-the-art. For VerbalCoding, the better practical choice is `myshell-ai/OpenVoice` because:

- MIT license and free commercial/research use.
- Instant voice cloning design.
- OpenVoice V2 supports Korean natively.
- More modern than SV2TTS/Real-Time-Voice-Cloning.
- Can be wrapped as a local subprocess without API keys.

Fallback remains Edge TTS for reliability.

---

## Environment variables

Add these supported settings:

```bash
TTS_BACKEND=edge                 # edge | openvoice
TTS_VOICE=ko-KR-InJoonNeural     # Edge only
TTS_RATE=+10%                    # Edge only for now
OPENVOICE_DIR=./vendor/OpenVoice
OPENVOICE_VENV=./.venv-openvoice
OPENVOICE_REF_AUDIO=./voice-samples/user-reference.wav
OPENVOICE_LANGUAGE=KR
OPENVOICE_STYLE=default
OPENVOICE_TIMEOUT_MS=90000
```

Gitignore:

```text
vendor/OpenVoice/
.venv-openvoice/
voice-samples/
.cache/openvoice/
```

---

## Task 1: Add TTS backend config tests

Objective: Make backend selection explicit and testable.

Files:
- Modify: `app-node/main.mjs`
- Create: `app-node/tts_settings.mjs`
- Create: `app-node/tts_settings.test.mjs`

Steps:
1. Extract TTS env parsing from `main.mjs` into `buildTtsSettings(env, root)`.
2. Add tests for default Edge backend.
3. Add tests for OpenVoice backend env parsing.
4. Run: `npm test`.

Expected: all Node tests pass.

---

## Task 2: Extract current Edge TTS into an adapter module

Objective: Keep existing behavior while enabling more TTS backends.

Files:
- Create: `app-node/tts_backends.mjs`
- Create: `app-node/tts_backends.test.mjs`
- Modify: `app-node/main.mjs`

Design:

```js
export function createTtsBackend(settings, deps) {
  if (settings.backend === 'openvoice') return createOpenVoiceBackend(settings, deps);
  return createEdgeTtsBackend(settings, deps);
}
```

The backend interface:

```js
await backend.synthesize(text, { signal, kind: 'final' });
await backend.synthesize(text, { signal, kind: 'progress' });
backend.cacheKeyParts();
```

Steps:
1. Write tests using fake `execFileAsync`.
2. Move `edge-tts` command construction into `createEdgeTtsBackend`.
3. Keep progress cache key including backend, voice, rate, and text.
4. Run: `node --check app-node/main.mjs app-node/tts_backends.mjs && npm test`.

Expected: Edge TTS output path and existing progress cache behavior remain compatible.

---

## Task 3: Add OpenVoice CLI wrapper script

Objective: Isolate Python/OpenVoice complexity outside the Node bot.

Files:
- Create: `scripts/openvoice_synth.py`
- Create: `scripts/openvoice_smoke.py`
- Modify: `.gitignore`

Wrapper CLI contract:

```bash
python scripts/openvoice_synth.py \
  --openvoice-dir ./vendor/OpenVoice \
  --ref-audio ./voice-samples/user-reference.wav \
  --text '안녕하세요 테스트입니다' \
  --language KR \
  --style default \
  --output /tmp/verbalcoding-openvoice.wav
```

Requirements:
- Validate reference file exists.
- Write WAV output for Discord playback.
- Print only non-secret status lines.
- Exit nonzero on setup/model errors.
- Do not import OpenVoice at module import time; import inside `main()` so `--help` works even before setup.

Steps:
1. Add argument parsing and validation.
2. Add placeholder imports with clear setup error if OpenVoice is absent.
3. Add smoke script that synthesizes a short Korean sentence.
4. Run: `python3 scripts/openvoice_synth.py --help`.

Expected: help works even before OpenVoice is installed.

---

## Task 4: Add OpenVoice backend in Node

Objective: Let VerbalCoding call the OpenVoice wrapper when `TTS_BACKEND=openvoice`.

Files:
- Modify: `app-node/tts_backends.mjs`
- Modify: `app-node/tts_backends.test.mjs`
- Modify: `app-node/main.mjs`

Implementation notes:
- Call `OPENVOICE_VENV/bin/python` if configured; otherwise `python3`.
- Pass args as an array via `execFileAsync`, never shell-concatenate text.
- Timeout with `OPENVOICE_TIMEOUT_MS`.
- Output temp WAV under `os.tmpdir()`.
- If OpenVoice fails, optionally fall back to Edge TTS and log `openvoice failed; falling back to edge`.

Steps:
1. Test command args do not leak secrets and include output path.
2. Test fallback behavior with fake failing OpenVoice command.
3. Wire backend into `synthTTS` and `synthProgressTTS`.
4. Run: `npm test`.

Expected: backend selection is covered and Edge fallback works.

---

## Task 5: Add setup/doctor support

Objective: Make setup visible and diagnosable.

Files:
- Modify: `scripts/doctor.mjs`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/FRESH_INSTALL.md` if present

Doctor checks:
- `TTS_BACKEND` value.
- If `openvoice`: Python exists, venv path exists, OpenVoice dir exists, reference audio exists, ffmpeg exists.
- Redact paths only if they contain obvious secrets; do not print token values.

Steps:
1. Add `.env.example` OpenVoice section.
2. Add doctor checks with clear WARN vs FAIL.
3. Add README setup commands.
4. Run: `vc doctor`.

Expected: Edge mode remains green; OpenVoice mode gives actionable missing-prereq messages.

---

## Task 6: Add installer prompts

Objective: Let a fresh install choose Edge or OpenVoice without hand-editing `.env`.

Files:
- Modify: `scripts/install.mjs`
- Modify: `app-node/install_config.mjs`
- Modify: `app-node/install_config.test.mjs`

Prompts:
- TTS backend: `edge` or `openvoice`.
- OpenVoice directory.
- OpenVoice venv.
- Reference audio path.
- Keep Edge voice/rate prompts for fallback.

Steps:
1. Add normalized values.
2. Add env rendering tests.
3. Add summary text.
4. Run: `npm test`.

Expected: generated `.env` contains OpenVoice fields only when selected, or includes commented examples.

---

## Task 7: Manual setup script for OpenVoice

Objective: Keep OpenVoice install repeatable without vendoring huge model files.

Files:
- Create: `scripts/setup_openvoice.sh`
- Modify: `README.md`

Script outline:

```bash
#!/usr/bin/env bash
set -euo pipefail
git clone https://github.com/myshell-ai/OpenVoice vendor/OpenVoice
python3 -m venv .venv-openvoice
. .venv-openvoice/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r vendor/OpenVoice/requirements.txt
python -m pip install -e vendor/OpenVoice
```

Steps:
1. Add idempotency checks.
2. Do not download voice samples.
3. Document model checkpoint download according to OpenVoice docs.
4. Run shell syntax check: `bash -n scripts/setup_openvoice.sh`.

Expected: script is safe to rerun and explains manual model download if needed.

---

## Task 8: End-to-end smoke test path

Objective: Prove cloned TTS can synthesize and play without touching STT/agent flow.

Files:
- Modify: `app-node/main.mjs`
- Modify: `README.md`

Add a text command:

```text
!voice-test <text>
```

Behavior:
- Synthesizes with active backend.
- Plays in current voice channel.
- Sends success/failure to transcript channel.

Steps:
1. Add command parser branch.
2. Reuse `speakText`.
3. Test manually with a short Korean sentence.
4. Verify logs include backend and elapsed time.

Expected: user can compare Edge vs OpenVoice without running full agent turn.

---

## Task 9: Performance and fallback tuning

Objective: Keep phone-call UX responsive.

Files:
- Modify: `app-node/main.mjs`
- Modify: `.env.example`

Rules:
- Progress prompts should remain Edge by default unless `OPENVOICE_PROGRESS=1`; cloning every progress phrase may be too slow.
- Final answers use OpenVoice.
- If OpenVoice final synthesis exceeds timeout, fall back to Edge and say a short failure notice.
- Keep sentence chunking and barge-in behavior unchanged.

Steps:
1. Add `OPENVOICE_PROGRESS=0` default.
2. Route `kind: 'progress'` to Edge unless explicitly enabled.
3. Add tests with fake backends.
4. Run: `npm test`.

Expected: long answers can use cloned voice, but progress prompts remain fast.

---

## Verification checklist

Run after implementation:

```bash
cd /Users/neo/Developer/Projects/VerbalCoding
node --check app-node/main.mjs app-node/tts_backends.mjs app-node/tts_settings.mjs
npm test
bash -n scripts/setup_openvoice.sh
python3 scripts/openvoice_synth.py --help
vc doctor
```

Manual voice check:

```text
!voice-test 안녕하세요. 버벌코딩 목소리 복제 테스트입니다.
```

Then verify:
- Bot remains connected to `Mac Mini's Hermes / 일반`.
- Final answers use cloned voice when `TTS_BACKEND=openvoice`.
- Progress prompts are still fast.
- Barge-in still stops playback.
- Edge fallback works when OpenVoice is missing or too slow.

---

## Rollback plan

Set:

```bash
TTS_BACKEND=edge
TTS_VOICE=ko-KR-InJoonNeural
```

Restart VerbalCoding. No STT/agent code should need rollback.
