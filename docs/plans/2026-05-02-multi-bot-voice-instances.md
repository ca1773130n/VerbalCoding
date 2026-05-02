# Multi-Bot Voice Instances Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Let VerbalCoding run multiple Discord bot instances at the same time so each project can permanently occupy its own Discord voice channel, text transcript channel/thread, Hermes session file, workdir, and project context.

**Architecture:** Keep the existing single-instance Node bridge as the runtime unit, but add a small multi-instance launcher and per-instance env/config files. Each instance uses a distinct Discord bot token, isolated logs/debug directories/session files, and explicit voice/text routing; the launcher starts/stops/status-checks instances without sharing in-memory state.

**Tech Stack:** Node.js ESM, discord.js/@discordjs/voice, existing `run.sh`, existing `scripts/cli.mjs`, JSON/env config files, `node --test`, shell process management.

---

## Current Constraints and Decisions

- A single Discord bot account/token should be treated as one active voice connection per guild. Multi-channel residency requires multiple Discord applications/bot tokens.
- Do not make one Node process host multiple Discord clients yet. YAGNI: independent OS processes are easier to reason about and isolate crashes/logs.
- Reuse existing bridge code paths for STT, TTS, progress, barge-in, project sessions, and Hermes adapter behavior.
- Instance files must not commit secrets. Commit templates/examples only.
- Operational target:
  - `verbalcoding instance start verbalcoding`
  - `verbalcoding instance start llm-wiki`
  - `verbalcoding instance status`
  - `verbalcoding instance stop llm-wiki`

---

### Task 1: Add instance config template directory

**Objective:** Define the file layout for multiple bridge instances without introducing secrets.

**Files:**
- Create: `instances/.gitkeep`
- Create: `instances/README.md`
- Create: `instances/example.env`
- Modify: `.gitignore`

**Step 1: Add ignore rules**

Add to `.gitignore`:

```gitignore
# VerbalCoding per-instance runtime configs; may contain Discord tokens.
instances/*.env
!instances/example.env
instances/*.local.env
```

**Step 2: Create `instances/example.env`**

```env
# Copy to instances/<name>.env and fill secrets locally. Do not commit real tokens.
INSTANCE_NAME=example
DISCORD_TOKEN=replace-with-a-dedicated-discord-bot-token
AUTO_JOIN_VOICE_CHANNELS=Example Voice Channel
TRANSCRIPT_CHANNEL_ID=replace-with-text-channel-or-thread-id
PROJECT_SESSIONS_FILE=config/project-sessions.example.json
BRIDGE_LOG_PATH=/tmp/verbalcoding-example.log
NODE_AUDIO_DEBUG_DIR=/tmp/verbalcoding-example-debug
HERMES_SESSION_FILE=.agent-sessions/hermes/example.session
AGENT_LABEL=Hermes Agent · Example
AGENT_CWD=/Users/neo/Developer/Projects/VerbalCoding
AGENT_PROJECT_CONTEXT=Project session: Example
```

**Step 3: Create `instances/README.md`**

Document:

- Each `.env` needs a distinct Discord bot token.
- Invite each bot to the server with text + voice permissions.
- Do not reuse the same token in two running instances.
- `TRANSCRIPT_CHANNEL_ID` can be a text channel or thread ID.
- `AUTO_JOIN_VOICE_CHANNELS` should usually contain exactly one voice channel name per instance.

**Step 4: Verify**

Run:

```bash
git status --short instances .gitignore
```

Expected: template files tracked, real `instances/*.env` ignored.

---

### Task 2: Make `run.sh` accept an optional instance env file

**Objective:** Allow the existing bridge runtime to load `instances/<name>.env` after `.env`, so per-instance settings override the shared defaults.

**Files:**
- Modify: `run.sh`
- Test: `bash -n run.sh`

**Step 1: Update argument/env loading**

Add near the existing `.env` load block:

```bash
INSTANCE_ENV="${VERBALCODING_INSTANCE_ENV:-${1:-}}"
if [ -n "$INSTANCE_ENV" ]; then
  if [ ! -f "$INSTANCE_ENV" ]; then
    echo "instance env file not found: $INSTANCE_ENV" >&2
    exit 2
  fi
  set -a
  # shellcheck disable=SC1090
  source "$INSTANCE_ENV"
  set +a
fi
```

Keep the existing `.env` load first, then instance env second, so instance-specific values win.

**Step 2: Verify shell syntax**

Run:

```bash
bash -n run.sh
```

Expected: exit 0.

---

### Task 3: Add pure instance config parser

**Objective:** Create testable logic that discovers instance env files and computes process metadata without starting processes.

**Files:**
- Create: `app-node/instances.mjs`
- Create: `app-node/instances.test.mjs`

**Step 1: Write failing tests**

Add tests for:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listInstanceEnvFiles, instanceNameFromEnvPath, instanceRuntimePaths } from './instances.mjs';

test('listInstanceEnvFiles finds env files except example', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-instances-'));
  fs.writeFileSync(path.join(dir, 'example.env'), '');
  fs.writeFileSync(path.join(dir, 'llm-wiki.env'), '');
  fs.writeFileSync(path.join(dir, 'verbalcoding.env'), '');
  assert.deepEqual(listInstanceEnvFiles(dir).map(p => path.basename(p)), ['llm-wiki.env', 'verbalcoding.env']);
});

test('instanceRuntimePaths derives pid and log paths', () => {
  assert.deepEqual(instanceRuntimePaths('/repo', 'llm-wiki'), {
    pidFile: '/repo/.run/instances/llm-wiki.pid',
    defaultLogPath: '/tmp/verbalcoding-llm-wiki.log',
  });
});
```

**Step 2: Implement minimal module**

```js
import fs from 'node:fs';
import path from 'node:path';

export function instanceNameFromEnvPath(file) {
  return path.basename(file).replace(/\.env$/i, '');
}

export function listInstanceEnvFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.env') && name !== 'example.env')
    .sort()
    .map(name => path.join(dir, name));
}

export function instanceRuntimePaths(root, name) {
  return {
    pidFile: path.join(root, '.run', 'instances', `${name}.pid`),
    defaultLogPath: `/tmp/verbalcoding-${name}.log`,
  };
}
```

**Step 3: Verify**

Run:

```bash
node --test app-node/instances.test.mjs
```

Expected: pass.

---

### Task 4: Add CLI subcommands for instance status

**Objective:** Extend the existing CLI with read-only instance discovery/status.

**Files:**
- Modify: `scripts/cli.mjs`
- Test: add tests if CLI helpers are pure, otherwise smoke with terminal commands

**Step 1: Add command syntax**

Support:

```bash
vc instance list
vc instance status
vc instance status llm-wiki
```

**Step 2: Implement status behavior**

For each instance:

- Read `instances/<name>.env` path.
- Read `.run/instances/<name>.pid` if it exists.
- Check `process.kill(pid, 0)` to determine alive/dead.
- Print name, env path, pid, status, and log path.

Expected output example:

```text
llm-wiki        running pid=12345 log=/tmp/verbalcoding-llm-wiki.log
verbalcoding    stopped pid=- log=/tmp/verbalcoding-verbalcoding.log
```

**Step 3: Verify**

Run:

```bash
vc instance status
```

Expected: lists configured instance env files; no crash when none exist.

---

### Task 5: Add CLI start/stop for one instance

**Objective:** Start and stop one bridge instance as a detached process using its env file.

**Files:**
- Modify: `scripts/cli.mjs`
- Modify: `app-node/instances.mjs`

**Step 1: Add commands**

```bash
vc instance start llm-wiki
vc instance stop llm-wiki
vc instance restart llm-wiki
```

**Step 2: Implement start**

Start command should:

1. Resolve `instances/<name>.env`.
2. Refuse to start if pid file points to a live process.
3. Ensure `.run/instances/` exists.
4. Spawn `./run.sh instances/<name>.env` with:
   - `detached: true`
   - `stdio: ['ignore', 'ignore', 'ignore']`
   - env including `VERBALCODING_INSTANCE_NAME=<name>`
5. Write the child pid to `.run/instances/<name>.pid`.
6. Print where logs are expected.

**Step 3: Implement stop**

Stop command should:

1. Read pid file.
2. Send `SIGTERM`.
3. Poll up to 10 seconds.
4. Send `SIGKILL` if still alive.
5. Remove stale pid file.

**Step 4: Verify**

With a non-secret local instance env:

```bash
vc instance start llm-wiki
vc instance status llm-wiki
vc instance stop llm-wiki
```

Expected: starts, reports running, stops cleanly.

---

### Task 6: Add instance doctor checks

**Objective:** Prevent common multi-bot mistakes before starting instances.

**Files:**
- Modify: `scripts/doctor.mjs`
- Optionally create: `app-node/instance_doctor.mjs`

**Checks:**

- Every `instances/*.env` has a token set.
- No two enabled instance env files use the same token fingerprint. Print only a redacted hash prefix, not the token.
- `AUTO_JOIN_VOICE_CHANNELS` is set.
- `TRANSCRIPT_CHANNEL_ID` is set.
- `PROJECT_SESSIONS_FILE`, `BRIDGE_LOG_PATH`, and `NODE_AUDIO_DEBUG_DIR` do not collide between instances.
- Warn if `HERMES_SESSION_FILE`/session paths collide.

**Verification:**

Run:

```bash
vc doctor
```

Expected: no secret values printed; duplicate-token scenarios produce a clear error.

---

### Task 7: Add first-class text/voice binding docs

**Objective:** Document the short-term single-bot command and long-term multi-bot flow.

**Files:**
- Modify: `README.md`
- Create or modify: `docs/MULTI_INSTANCE.md`

**Document short-term command:**

```text
!session attach-voice --voice "LLM-Wiki"
```

Behavior:

- Run this in the target text channel/thread.
- It binds that text channel/thread to the selected voice channel.
- If the text channel has no existing project session, it creates an ad-hoc channel session.
- To attach an existing named project session:

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

**Document long-term multi-bot setup:**

- Create one Discord application per project.
- Invite each bot to the server.
- Create `instances/verbalcoding.env` and `instances/llm-wiki.env`.
- Start both instances.
- Verify each is in the expected voice channel and writing to expected text channel.

---

### Task 8: End-to-end verification with two bot tokens

**Objective:** Prove the design supports two simultaneous voice channels.

**Prerequisites:**

- Two real Discord bot tokens configured locally:
  - `instances/verbalcoding.env`
  - `instances/llm-wiki.env`

**Steps:**

1. Start both:

```bash
vc instance start verbalcoding
vc instance start llm-wiki
```

2. Verify processes:

```bash
vc instance status
```

Expected: both running, distinct pids.

3. Verify logs:

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

Expected:

- VerbalCoding instance logs `Listening in voice channel ... / VerbalCoding`.
- LLM-Wiki instance logs `Listening in voice channel ... / LLM-Wiki`.

4. Speak in each voice channel.

Expected:

- VerbalCoding speech goes to the VerbalCoding transcript channel/thread.
- LLM-Wiki speech goes to the LLM-Wiki transcript channel/thread.
- Hermes session files differ.

5. Stop both:

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

Expected: both stop cleanly and do not leave orphan `node app-node/main.mjs` processes.

---

## Acceptance Criteria

- Short-term command exists: `!session attach-voice [sessionName] [--voice <channel>]` or alias `!session voice ...`.
- Running the command in any text channel/thread binds the selected voice channel to that text channel's session.
- If no session exists in the text channel, an ad-hoc isolated session is created.
- Voice STT/result/progress/final-answer text uses the active project session transcript target, not the global fallback.
- `node --check app-node/main.mjs` passes.
- `npm test` passes.
- Detailed multi-bot implementation plan exists at `docs/plans/2026-05-02-multi-bot-voice-instances.md`.
- The future multi-instance launcher uses separate bot tokens and refuses duplicate token use.
