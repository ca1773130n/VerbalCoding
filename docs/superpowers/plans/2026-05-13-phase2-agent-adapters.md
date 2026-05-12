# Phase 2 — Agent-Agnostic Adapter Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Round out `agent_adapters.mjs` so VerbalCoding works first-class with Aider and Cursor CLI, and auto-detects whichever agent is installed on the host.

**Architecture:** Extend the existing `buildAgentSettings()` defaults table in `app-node/agent_adapters.mjs`. Add a new `detectInstalledAgents()` helper in `app-node/agent_detect.mjs` that uses `which`/`command -v` to probe binaries, and wire it into `vc setup` + `vc doctor` + `vc status`. Add adapter quirks for Aider (`--no-pretty`, stdin prompt) and Cursor CLI (`cursor-agent`).

**Tech Stack:** Node 20 ESM, `node:child_process`, `node --test` (existing test runner).

---

## Spec

### Adapter additions

- **Aider** — `aider --no-pretty --yes-always --message <prompt>`; no built-in session resume via flag, but supports `.aider.chat.history.md` for history. Skip session resume in adapter (treat each turn as fresh w/ project context). Sanitize Aider's "Tokens:" footer.
- **Cursor CLI** — `cursor-agent --prompt <prompt> --print` (Cursor's CLI flags vary by version; default to `cursor-agent` binary).

### Auto-detection

- `detectInstalledAgents(env, { which })` returns ordered list of `{ backend, label, command, present: boolean, version?: string }`.
- Probe order: `hermes`, `claude`, `codex`, `gemini`, `opencode`, `openclaw`, `aider`, `cursor-agent`.
- Called by `vc setup` to auto-pick a default when `AGENT_BACKEND` is unset.
- Called by `vc doctor` to display which agents are reachable.

### CLI surface

- `vc setup` — show detected agents and ask user to pick (default = first present).
- `vc doctor` — section "Agent backends" lists present/missing.
- `vc status` — show current `AGENT_BACKEND` + whether the binary resolves.

---

## File Structure

- Create: `app-node/agent_detect.mjs` — `detectInstalledAgents`, `probeAgentBinary`.
- Create: `app-node/agent_detect.test.mjs` — unit tests with injected `which`.
- Modify: `app-node/agent_adapters.mjs` (lines ~208–276) — add `aider` and `cursor` entries to `defaults` in `buildAgentSettings`.
- Modify: `app-node/agent_contract.mjs` — extend capability flags (`supportsStdinPrompt`, `supportsResume`).
- Modify: `scripts/install.mjs` (or wherever `vc setup` lives — find via grep) — call `detectInstalledAgents` when prompting for backend.
- Modify: `scripts/doctor.mjs` — render detection report.
- Modify: `.env.example` — document `AIDER_COMMAND`, `CURSOR_COMMAND`.
- Modify: `README.md` — agent list (after Phase 2 lands, full README reframe is its own task).

---

## Tasks

### Task 1: Failing test for `detectInstalledAgents`

**Files:** Create `app-node/agent_detect.test.mjs`.

- [ ] Step 1: Write failing test

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectInstalledAgents } from './agent_detect.mjs';

test('detectInstalledAgents marks present when which resolves', async () => {
  const fakeWhich = async (bin) => bin === 'hermes' ? '/usr/local/bin/hermes' : null;
  const result = await detectInstalledAgents({}, { which: fakeWhich });
  const hermes = result.find(r => r.backend === 'hermes');
  assert.equal(hermes.present, true);
  assert.equal(hermes.command.includes('hermes'), true);
  const claude = result.find(r => r.backend === 'claude');
  assert.equal(claude.present, false);
});

test('detectInstalledAgents includes aider and cursor', async () => {
  const fakeWhich = async () => null;
  const result = await detectInstalledAgents({}, { which: fakeWhich });
  const backends = result.map(r => r.backend);
  assert.ok(backends.includes('aider'));
  assert.ok(backends.includes('cursor'));
});

test('detectInstalledAgents honors env overrides for command', async () => {
  const fakeWhich = async (bin) => bin === 'aider' ? '/opt/aider' : null;
  const result = await detectInstalledAgents({ AIDER_COMMAND: 'aider --foo' }, { which: fakeWhich });
  const aider = result.find(r => r.backend === 'aider');
  assert.equal(aider.command, 'aider --foo');
});
```

- [ ] Step 2: Run test, expect failure

```bash
node --test app-node/agent_detect.test.mjs
```
Expected: FAIL — `Cannot find module './agent_detect.mjs'`.

### Task 2: Implement `agent_detect.mjs`

**Files:** Create `app-node/agent_detect.mjs`.

- [ ] Step 1: Implement minimal module

```javascript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const PROBES = [
  { backend: 'hermes', bin: 'hermes', defaultCommand: 'hermes chat -Q -q', envCommand: 'HERMES_COMMAND' },
  { backend: 'claude', bin: 'claude', defaultCommand: 'claude -p', envCommand: 'CLAUDE_COMMAND' },
  { backend: 'codex', bin: 'codex', defaultCommand: 'codex exec', envCommand: 'CODEX_COMMAND' },
  { backend: 'gemini', bin: 'gemini', defaultCommand: 'gemini -p', envCommand: 'GEMINI_COMMAND' },
  { backend: 'opencode', bin: 'opencode', defaultCommand: 'opencode run', envCommand: 'OPENCODE_COMMAND' },
  { backend: 'openclaw', bin: 'openclaw', defaultCommand: 'openclaw run', envCommand: 'OPENCLAW_COMMAND' },
  { backend: 'aider', bin: 'aider', defaultCommand: 'aider --no-pretty --yes-always --message', envCommand: 'AIDER_COMMAND' },
  { backend: 'cursor', bin: 'cursor-agent', defaultCommand: 'cursor-agent --print --prompt', envCommand: 'CURSOR_COMMAND' },
];

async function defaultWhich(bin) {
  try {
    const { stdout } = await execFileP('which', [bin]);
    const p = stdout.trim();
    return p || null;
  } catch { return null; }
}

export async function detectInstalledAgents(env = process.env, { which = defaultWhich } = {}) {
  const results = await Promise.all(PROBES.map(async (p) => {
    const path = await which(p.bin);
    return {
      backend: p.backend,
      label: backendLabel(p.backend),
      command: env[p.envCommand] || p.defaultCommand,
      bin: p.bin,
      path: path || null,
      present: Boolean(path),
    };
  }));
  return results;
}

function backendLabel(backend) {
  return { hermes: 'Hermes Agent', claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini', opencode: 'OpenCode', openclaw: 'OpenClaw', aider: 'Aider', cursor: 'Cursor CLI' }[backend] || backend;
}
```

- [ ] Step 2: Run tests

```bash
node --test app-node/agent_detect.test.mjs
```
Expected: PASS.

- [ ] Step 3: Commit

```bash
git add app-node/agent_detect.mjs app-node/agent_detect.test.mjs
git commit -m "feat(adapters): add agent_detect for auto-detection across 8 backends"
```

### Task 3: Add Aider + Cursor defaults to `buildAgentSettings`

**Files:** Modify `app-node/agent_adapters.mjs` defaults table (~lines 211–260).

- [ ] Step 1: Add entries

Inside the `defaults` object, insert:

```javascript
    aider: {
      label: 'Aider',
      command: env.AIDER_COMMAND || 'aider --no-pretty --yes-always --message',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'aider'),
      supportsHermesSession: false,
    },
    cursor: {
      label: 'Cursor CLI',
      command: env.CURSOR_COMMAND || 'cursor-agent --print --prompt',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'cursor'),
      supportsHermesSession: false,
    },
```

- [ ] Step 2: Add a corresponding test to `app-node/agent_adapters.test.mjs`

```javascript
test('buildAgentSettings supports AGENT_BACKEND=aider', () => {
  const s = buildAgentSettings({ ROOT: '/tmp/r', env: { AGENT_BACKEND: 'aider' } });
  assert.equal(s.backend, 'aider');
  assert.equal(s.label, 'Aider');
  assert.match(s.command, /aider/);
});

test('buildAgentSettings supports AGENT_BACKEND=cursor', () => {
  const s = buildAgentSettings({ ROOT: '/tmp/r', env: { AGENT_BACKEND: 'cursor' } });
  assert.equal(s.backend, 'cursor');
  assert.match(s.command, /cursor-agent/);
});
```

- [ ] Step 3: Run

```bash
node --test app-node/agent_adapters.test.mjs
```
Expected: PASS.

- [ ] Step 4: Commit

```bash
git add app-node/agent_adapters.mjs app-node/agent_adapters.test.mjs
git commit -m "feat(adapters): first-class Aider and Cursor CLI backends"
```

### Task 4: Wire detection into `vc setup`

**Files:** Find via `grep -nR "AGENT_BACKEND" scripts/install.mjs scripts/cli.mjs` first, then modify the relevant prompt logic.

- [ ] Step 1: Use `detectInstalledAgents` to default the picker, and label entries as `present`/`missing`.
- [ ] Step 2: Add a test for the picker function (extracted as pure function for testability).
- [ ] Step 3: Commit:

```bash
git commit -m "feat(setup): auto-detect installed agents and default the picker"
```

### Task 5: Wire detection into `vc doctor`

- [ ] Step 1: Render a new "Agent backends" section in doctor output.
- [ ] Step 2: Commit.

### Task 6: Document in `.env.example` and `docs/USAGE.md`

- [ ] Step 1: Add `AIDER_COMMAND` and `CURSOR_COMMAND` to `.env.example` with comments.
- [ ] Step 2: Update `docs/USAGE.md` agent table.
- [ ] Step 3: Commit.

---

## Self-Review

- Spec coverage: detection ✓, Aider ✓, Cursor ✓, setup wiring ✓, doctor wiring ✓, docs ✓.
- No placeholders.
- Types consistent (`backend` strings match across `agent_adapters.mjs` and `agent_detect.mjs`).
