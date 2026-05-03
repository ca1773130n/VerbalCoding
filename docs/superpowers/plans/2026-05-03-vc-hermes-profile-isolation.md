# vc Multi-Hermes-Profile Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-instance Hermes profile isolation to vc so each Discord-bot-per-project instance runs against its own `~/.hermes/profiles/<name>` (memory, MEMORY.md, SOUL.md, skills) instead of sharing the user's default `~/.hermes`.

**Architecture:** Idempotent `ensureHermesProfile()` helper in a new `app-node/hermes_profiles.mjs` module. Called from `vc instance setup` (creates profile, sets `terminal.cwd`, seeds SOUL.md, renders `HERMES_HOME` into instance env) and from `vc instance start` (self-heals manually-edited envs). Profile selection is purely env-driven via `HERMES_HOME`; no `vc hermes` command group, no `HERMES_PROFILE` alias.

**Tech Stack:** Node 20+ ESM (`*.mjs`). `node:test` runner. Subprocess invocation uses `node:child_process` `execFile` named import only — never shell strings.

---

## Pre-flight

Before Task 1: verify the worktree builds.

- [ ] Run `npm test` and confirm all current tests pass.

If any baseline test fails, fix or skip it before touching new code.

---

## Task 1: Profile name validation

**Files:**
- Create: `app-node/hermes_profiles.mjs`
- Create: `app-node/hermes_profiles.test.mjs`

The Hermes profile name must match `^[a-z0-9][a-z0-9_-]{0,63}$`. vc's existing `slugifyInstanceName` is lenient (allows dots, Unicode), so we add a strict validator at the Hermes boundary.

- [ ] **Step 1: Write the failing test**

```js
// app-node/hermes_profiles.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfileName, InvalidProfileName } from './hermes_profiles.mjs';

test('validateProfileName accepts canonical names', () => {
  for (const name of ['acme', 'llm-wiki', 'verbalcoding', 'a', 'a1_b-c']) {
    validateProfileName(name);
  }
});

test('validateProfileName rejects invalid names', () => {
  const bad = ['', 'Acme', 'llm.wiki', 'has space', '_leading', '-leading', '한글', 'a'.repeat(65)];
  for (const name of bad) {
    assert.throws(() => validateProfileName(name), InvalidProfileName, `expected ${JSON.stringify(name)} to throw`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --test-name-pattern='validateProfileName'
```

Expected: FAIL with module-not-found or function-not-defined.

- [ ] **Step 3: Implement the validator**

```js
// app-node/hermes_profiles.mjs
export class InvalidProfileName extends Error {
  constructor(name) {
    super(`invalid Hermes profile name ${JSON.stringify(name)}: must match ^[a-z0-9][a-z0-9_-]{0,63}$`);
    this.name = 'InvalidProfileName';
  }
}

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function validateProfileName(name) {
  if (typeof name !== 'string' || !PROFILE_NAME_RE.test(name)) {
    throw new InvalidProfileName(name);
  }
  return name;
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --test-name-pattern='validateProfileName'
```

Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add app-node/hermes_profiles.mjs app-node/hermes_profiles.test.mjs
git commit -m "feat(hermes-profiles): validate profile names against Hermes regex"
```

---

## Task 2: Profile directory resolution and `profileExists`

**Files:**
- Modify: `app-node/hermes_profiles.mjs`
- Modify: `app-node/hermes_profiles.test.mjs`

`hermesProfilesRoot` resolves `~/.hermes/profiles`. `hermesProfileDir(name)` joins root + name. `profileExists(name)` keys on `<dir>/config.yaml`.

- [ ] **Step 1: Write the failing test**

Append to `app-node/hermes_profiles.test.mjs`:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { hermesProfilesRoot, hermesProfileDir, profileExists } from './hermes_profiles.mjs';

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vc-hermes-home-'));
}

test('hermesProfilesRoot resolves under HOME', () => {
  const home = '/tmp/fake-home';
  assert.equal(hermesProfilesRoot({ homedir: () => home }), '/tmp/fake-home/.hermes/profiles');
});

test('hermesProfileDir joins root and validated name', () => {
  const deps = { homedir: () => '/tmp/fake-home' };
  assert.equal(hermesProfileDir('llm-wiki', deps), '/tmp/fake-home/.hermes/profiles/llm-wiki');
});

test('hermesProfileDir throws on invalid name', () => {
  const deps = { homedir: () => '/tmp/fake-home' };
  assert.throws(() => hermesProfileDir('Bad Name', deps), { name: 'InvalidProfileName' });
});

test('profileExists returns false when config.yaml missing', () => {
  const home = tempHome();
  const deps = { homedir: () => home };
  assert.equal(profileExists('llm-wiki', deps), false);
});

test('profileExists returns true when config.yaml present', () => {
  const home = tempHome();
  const dir = path.join(home, '.hermes', 'profiles', 'llm-wiki');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: /tmp\n');
  const deps = { homedir: () => home };
  assert.equal(profileExists('llm-wiki', deps), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --test-name-pattern='hermesProfilesRoot|hermesProfileDir|profileExists'
```

Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Append to `app-node/hermes_profiles.mjs`:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function defaultDeps(deps = {}) {
  return {
    homedir: deps.homedir || os.homedir,
    fs: deps.fs || fs,
    env: deps.env || process.env,
  };
}

export function hermesProfilesRoot(deps = {}) {
  const { homedir, env } = defaultDeps(deps);
  if (env && env.HERMES_PROFILES_ROOT) return env.HERMES_PROFILES_ROOT;
  return path.join(homedir(), '.hermes', 'profiles');
}

export function hermesProfileDir(name, deps = {}) {
  validateProfileName(name);
  return path.join(hermesProfilesRoot(deps), name);
}

export function profileExists(name, deps = {}) {
  const { fs: fsDep } = defaultDeps(deps);
  const dir = hermesProfileDir(name, deps);
  return fsDep.existsSync(path.join(dir, 'config.yaml'));
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --test-name-pattern='hermesProfilesRoot|hermesProfileDir|profileExists'
```

Expected: PASS, all five tests green.

- [ ] **Step 5: Commit**

```bash
git add app-node/hermes_profiles.mjs app-node/hermes_profiles.test.mjs
git commit -m "feat(hermes-profiles): resolve profile dirs and detect existence via config.yaml"
```

---

## Task 3: `assertHermesAvailable` with deps-injectable runner

**Files:**
- Modify: `app-node/hermes_profiles.mjs`
- Modify: `app-node/hermes_profiles.test.mjs`

Throw a friendly error if `hermes` is not on PATH. Implementation calls `hermes --version` via `execFile` named import (no shell).

- [ ] **Step 1: Write the failing test**

Append to `app-node/hermes_profiles.test.mjs`:

```js
import { assertHermesAvailable, HermesCliMissing } from './hermes_profiles.mjs';

function fakeRunnerOk() {
  return (cmd, args, opts, cb) => cb(null, { stdout: 'hermes 0.6.1\n', stderr: '' });
}

function fakeRunnerEnoent() {
  return (cmd, args, opts, cb) => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    cb(err);
  };
}

test('assertHermesAvailable resolves when hermes --version succeeds', async () => {
  await assertHermesAvailable({ execFile: fakeRunnerOk() });
});

test('assertHermesAvailable throws HermesCliMissing on ENOENT', async () => {
  await assert.rejects(
    () => assertHermesAvailable({ execFile: fakeRunnerEnoent() }),
    HermesCliMissing,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --test-name-pattern='assertHermesAvailable'
```

Expected: FAIL — symbol not exported.

- [ ] **Step 3: Implement**

Append to `app-node/hermes_profiles.mjs`:

```js
import { execFile as nodeRunner } from 'node:child_process';
import { promisify } from 'node:util';

export class HermesCliMissing extends Error {
  constructor() {
    super('hermes CLI not found on PATH; install Hermes (>= 0.6.0) and re-run `vc instance setup`');
    this.name = 'HermesCliMissing';
  }
}

function resolveRunner(deps = {}) {
  const raw = deps.execFile || nodeRunner;
  return promisify(raw);
}

export async function assertHermesAvailable(deps = {}) {
  const run = resolveRunner(deps);
  try {
    await run('hermes', ['--version'], { timeout: 5000 });
  } catch (err) {
    if (err && err.code === 'ENOENT') throw new HermesCliMissing();
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --test-name-pattern='assertHermesAvailable'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-node/hermes_profiles.mjs app-node/hermes_profiles.test.mjs
git commit -m "feat(hermes-profiles): assert hermes CLI is available"
```

---

## Task 4: `ensureHermesProfile` — create path

**Files:**
- Modify: `app-node/hermes_profiles.mjs`
- Modify: `app-node/hermes_profiles.test.mjs`

When the profile is missing, run `hermes profile create <name> --clone-from <cloneFrom>`, then `hermes config set terminal.cwd <workdir>` against `HERMES_HOME=<dir>`, then write `<dir>/SOUL.md` if missing.

- [ ] **Step 1: Write the failing test**

Append to `app-node/hermes_profiles.test.mjs`:

```js
import { ensureHermesProfile } from './hermes_profiles.mjs';

function recordingRunner(handlers = {}) {
  const calls = [];
  const fn = (cmd, args, opts, cb) => {
    calls.push({ cmd, args, opts: opts || {} });
    const key = `${cmd} ${args.join(' ')}`;
    const handler = handlers[key];
    if (handler) return handler(cb);
    cb(null, { stdout: '', stderr: '' });
  };
  fn.calls = calls;
  return fn;
}

test('ensureHermesProfile creates a missing profile', async () => {
  const home = tempHome();
  const dir = path.join(home, '.hermes', 'profiles', 'llm-wiki');
  const runner = recordingRunner({
    'hermes --version': cb => cb(null, { stdout: 'hermes 0.6.1\n', stderr: '' }),
    'hermes profile create llm-wiki --clone-from default': cb => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: /tmp/old\n');
      cb(null, { stdout: '', stderr: '' });
    },
    'hermes config set terminal.cwd /workdir/llm-wiki': cb => {
      fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: /workdir/llm-wiki\n');
      cb(null, { stdout: '', stderr: '' });
    },
    'hermes config get terminal.cwd': cb => cb(null, { stdout: '/workdir/llm-wiki\n', stderr: '' }),
  });
  const result = await ensureHermesProfile({
    name: 'llm-wiki',
    workdir: '/workdir/llm-wiki',
    projectContext: 'LLM-Wiki backend agent',
    deps: { execFile: runner, homedir: () => home, fs },
  });
  assert.equal(result.created, true);
  assert.equal(result.dir, dir);
  assert.equal(result.name, 'llm-wiki');
  assert.equal(fs.existsSync(path.join(dir, 'SOUL.md')), true);
  assert.equal(fs.readFileSync(path.join(dir, 'SOUL.md'), 'utf8'), 'LLM-Wiki backend agent');
  const setCall = runner.calls.find(c => c.args[0] === 'config' && c.args[1] === 'set');
  assert.equal(setCall.opts.env.HERMES_HOME, dir);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --test-name-pattern='ensureHermesProfile creates a missing profile'
```

Expected: FAIL — `ensureHermesProfile` not exported.

- [ ] **Step 3: Implement**

Append to `app-node/hermes_profiles.mjs`:

```js
async function runHermes(run, args, { extraEnv } = {}) {
  const env = { ...process.env, ...(extraEnv || {}) };
  return run('hermes', args, { env, timeout: 60000 });
}

export class ProfileBoundElsewhere extends Error {
  constructor(name, expected, actual) {
    super(`Hermes profile ${name} already binds terminal.cwd to ${actual}; expected ${expected}. Pick a different instance name or rebind with hermes config set terminal.cwd in that profile.`);
    this.name = 'ProfileBoundElsewhere';
    this.expected = expected;
    this.actual = actual;
  }
}

export class ProfileConfigFailed extends Error {
  constructor(stderr) {
    super(`hermes config set terminal.cwd failed: ${stderr}`);
    this.name = 'ProfileConfigFailed';
  }
}

async function readTerminalCwd(run, dir) {
  try {
    const out = await run('hermes', ['config', 'get', 'terminal.cwd'], { env: { ...process.env, HERMES_HOME: dir }, timeout: 10000 });
    return String(out.stdout || '').trim();
  } catch {
    return '';
  }
}

export async function ensureHermesProfile({ name, workdir, projectContext, cloneFrom = 'default', deps = {} } = {}) {
  validateProfileName(name);
  const { fs: fsDep, homedir, env } = defaultDeps(deps);
  const run = resolveRunner(deps);
  const dir = hermesProfileDir(name, { homedir, env });
  const warnings = [];

  if (profileExists(name, { homedir, env, fs: fsDep })) {
    const actualCwd = await readTerminalCwd(run, dir);
    if (actualCwd && actualCwd !== workdir) {
      throw new ProfileBoundElsewhere(name, workdir, actualCwd);
    }
    return { created: false, dir, name, configPath: path.join(dir, 'config.yaml'), updatedConfig: false, warnings };
  }

  await assertHermesAvailable({ execFile: run });

  try {
    await runHermes(run, ['profile', 'create', name, '--clone-from', cloneFrom]);
  } catch (err) {
    if (cloneFrom === 'default') {
      warnings.push(`hermes profile create --clone-from default failed (${err.message || err.code}); retrying without clone`);
      await runHermes(run, ['profile', 'create', name]);
    } else {
      throw err;
    }
  }

  try {
    await runHermes(run, ['config', 'set', 'terminal.cwd', workdir], { extraEnv: { HERMES_HOME: dir } });
  } catch (err) {
    throw new ProfileConfigFailed(String(err.stderr || err.message || err.code));
  }

  const soulPath = path.join(dir, 'SOUL.md');
  if (projectContext && !fsDep.existsSync(soulPath)) {
    fsDep.writeFileSync(soulPath, String(projectContext));
  }

  return { created: true, dir, name, configPath: path.join(dir, 'config.yaml'), updatedConfig: true, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --test-name-pattern='ensureHermesProfile creates a missing profile'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-node/hermes_profiles.mjs app-node/hermes_profiles.test.mjs
git commit -m "feat(hermes-profiles): create profile with clone, terminal.cwd, and SOUL.md seed"
```

---

## Task 5: `ensureHermesProfile` — reuse and conflict paths

**Files:**
- Modify: `app-node/hermes_profiles.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `app-node/hermes_profiles.test.mjs`:

```js
test('ensureHermesProfile reuses an existing profile with matching cwd', async () => {
  const home = tempHome();
  const dir = path.join(home, '.hermes', 'profiles', 'llm-wiki');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: /workdir/llm-wiki\n');

  const runner = recordingRunner({
    'hermes config get terminal.cwd': cb => cb(null, { stdout: '/workdir/llm-wiki\n', stderr: '' }),
  });
  const result = await ensureHermesProfile({
    name: 'llm-wiki',
    workdir: '/workdir/llm-wiki',
    projectContext: 'unused',
    deps: { execFile: runner, homedir: () => home, fs },
  });
  assert.equal(result.created, false);
  assert.equal(result.updatedConfig, false);
  assert.equal(runner.calls.some(c => c.args[0] === 'profile' && c.args[1] === 'create'), false);
});

test('ensureHermesProfile throws ProfileBoundElsewhere on cwd mismatch', async () => {
  const home = tempHome();
  const dir = path.join(home, '.hermes', 'profiles', 'llm-wiki');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: /elsewhere\n');

  const runner = recordingRunner({
    'hermes config get terminal.cwd': cb => cb(null, { stdout: '/elsewhere\n', stderr: '' }),
  });
  await assert.rejects(
    () => ensureHermesProfile({
      name: 'llm-wiki',
      workdir: '/workdir/llm-wiki',
      projectContext: '',
      deps: { execFile: runner, homedir: () => home, fs },
    }),
    { name: 'ProfileBoundElsewhere', expected: '/workdir/llm-wiki', actual: '/elsewhere' },
  );
});
```

- [ ] **Step 2: Run tests to verify they pass**

```
npm test -- --test-name-pattern='ensureHermesProfile (reuses|throws)'
```

Expected: PASS for both tests.

- [ ] **Step 3: Commit**

```bash
git add app-node/hermes_profiles.test.mjs
git commit -m "test(hermes-profiles): cover reuse and ProfileBoundElsewhere paths"
```

---

## Task 6: `ensureHermesProfile` — clone-fallback warning

**Files:**
- Modify: `app-node/hermes_profiles.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `app-node/hermes_profiles.test.mjs`:

```js
test('ensureHermesProfile falls back to plain create when clone fails', async () => {
  const home = tempHome();
  const dir = path.join(home, '.hermes', 'profiles', 'fresh-app');
  let cloneAttempted = false;
  let plainCreateAttempted = false;

  const runner = recordingRunner({
    'hermes --version': cb => cb(null, { stdout: 'hermes 0.6.1\n', stderr: '' }),
    'hermes profile create fresh-app --clone-from default': cb => {
      cloneAttempted = true;
      cb(Object.assign(new Error('no default profile'), { stderr: 'no default profile' }));
    },
    'hermes profile create fresh-app': cb => {
      plainCreateAttempted = true;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: ""\n');
      cb(null, { stdout: '', stderr: '' });
    },
    'hermes config set terminal.cwd /workdir/fresh-app': cb => {
      fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: /workdir/fresh-app\n');
      cb(null, { stdout: '', stderr: '' });
    },
  });

  const result = await ensureHermesProfile({
    name: 'fresh-app',
    workdir: '/workdir/fresh-app',
    projectContext: '',
    deps: { execFile: runner, homedir: () => home, fs },
  });
  assert.equal(cloneAttempted, true);
  assert.equal(plainCreateAttempted, true);
  assert.equal(result.created, true);
  assert.match(result.warnings[0], /clone-from default failed/);
});
```

- [ ] **Step 2: Run test to verify it passes**

```
npm test -- --test-name-pattern='falls back to plain create'
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app-node/hermes_profiles.test.mjs
git commit -m "test(hermes-profiles): cover clone-fallback warning path"
```

---

## Task 7: Render `HERMES_HOME` in instance env file

**Files:**
- Modify: `app-node/install_config.mjs`
- Modify: `app-node/install_config.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `app-node/install_config.test.mjs`:

```js
test('normalizeInstanceAnswers surfaces HERMES_HOME when provided', () => {
  const out = normalizeInstanceAnswers({
    instanceName: 'llm-wiki',
    discordBotToken: 'token',
    autoJoinVoiceChannels: 'LLM-Wiki',
    transcriptChannelId: '123',
    workdir: '/projects/llm-wiki',
    projectContext: 'LLM-Wiki agent',
    hermesHome: '/Users/neo/.hermes/profiles/llm-wiki',
  });
  assert.equal(out.HERMES_HOME, '/Users/neo/.hermes/profiles/llm-wiki');
});

test('buildInstanceEnvFile emits HERMES_HOME after HERMES_SESSION_FILE', () => {
  const text = buildInstanceEnvFile({
    INSTANCE_NAME: 'llm-wiki',
    DISCORD_TOKEN: 'token',
    HERMES_SESSION_FILE: '.agent-sessions/hermes/llm-wiki.session',
    HERMES_HOME: '/Users/neo/.hermes/profiles/llm-wiki',
    AGENT_LABEL: 'Hermes · llm-wiki',
    AGENT_CWD: '/projects/llm-wiki',
  });
  const lines = text.split('\n');
  const sessionIdx = lines.findIndex(l => l.startsWith('HERMES_SESSION_FILE='));
  const homeIdx = lines.findIndex(l => l.startsWith('HERMES_HOME='));
  assert.ok(sessionIdx >= 0 && homeIdx === sessionIdx + 1, `expected HERMES_HOME directly after HERMES_SESSION_FILE; got lines:\n${text}`);
  assert.match(text, /HERMES_HOME="\/Users\/neo\/\.hermes\/profiles\/llm-wiki"/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --test-name-pattern='HERMES_HOME'
```

Expected: FAIL — key absent in output.

- [ ] **Step 3: Implement**

Edit `app-node/install_config.mjs`. In `normalizeInstanceAnswers`, surface HERMES_HOME in the returned object alongside HERMES_SESSION_FILE:

```js
HERMES_HOME: clean(input.hermesHome || input.HERMES_HOME),
```

In `buildInstanceEnvFile`, insert `'HERMES_HOME'` immediately after `'HERMES_SESSION_FILE'` in the `ordered` array:

```js
const ordered = [
  'INSTANCE_NAME',
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_ALLOWED_USERS',
  'AUTO_JOIN_VOICE_CHANNELS',
  'TRANSCRIPT_CHANNEL_ID',
  'PROJECT_SESSIONS_FILE',
  'BRIDGE_LOG_PATH',
  'NODE_AUDIO_DEBUG_DIR',
  'HERMES_SESSION_FILE',
  'HERMES_HOME',
  'AGENT_LABEL',
  'AGENT_CWD',
  'AGENT_PROJECT_CONTEXT',
];
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --test-name-pattern='HERMES_HOME'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-node/install_config.mjs app-node/install_config.test.mjs
git commit -m "feat(install-config): render HERMES_HOME in instance env files"
```

---

## Task 8: Wizard wires `ensureHermesProfile`

**Files:**
- Modify: `scripts/cli.mjs`

- [ ] **Step 1: Read the current setup function**

Open `scripts/cli.mjs` and find the `handleInstanceSetup` (or equivalent) where `values = normalizeInstanceAnswers(...)` is built and `fs.writeFileSync(instancePath, buildInstanceEnvFile(values), { mode: 0o600 })` follows.

- [ ] **Step 2: Add the import**

Add to the import block at the top of `scripts/cli.mjs`:

```js
import { ensureHermesProfile, validateProfileName } from '../app-node/hermes_profiles.mjs';
```

- [ ] **Step 3: Wire the call before env write**

Insert immediately after `values = normalizeInstanceAnswers({...})` and before `fs.writeFileSync(instancePath, ...)`:

```js
try {
  validateProfileName(values.INSTANCE_NAME);
} catch (err) {
  console.error(`Instance name ${JSON.stringify(values.INSTANCE_NAME)} cannot be used as a Hermes profile name.`);
  console.error('Pick a name matching ^[a-z0-9][a-z0-9_-]{0,63}$ (e.g. llm-wiki, acme).');
  process.exitCode = 2;
  return;
}

let profileResult;
try {
  profileResult = await ensureHermesProfile({
    name: values.INSTANCE_NAME,
    workdir: values.AGENT_CWD || ROOT,
    projectContext: values.AGENT_PROJECT_CONTEXT || '',
  });
} catch (err) {
  console.error(`Hermes profile setup failed: ${err.message}`);
  process.exitCode = 2;
  return;
}
values.HERMES_HOME = profileResult.dir;
for (const w of profileResult.warnings || []) console.warn(`warning: ${w}`);
console.log(`Hermes profile: ${profileResult.name} at ${profileResult.dir} (${profileResult.created ? 'created' : 'reused'})`);
```

- [ ] **Step 4: Run the test suite**

```
npm test
```

Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add scripts/cli.mjs
git commit -m "feat(vc-cli): auto-create Hermes profile during instance setup"
```

---

## Task 9: Start path self-heals missing profile

**Files:**
- Modify: `scripts/cli.mjs`
- Modify: `app-node/cli_install.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `app-node/cli_install.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { healInstanceProfileFromEnv } from '../scripts/cli.mjs';

test('healInstanceProfileFromEnv ensures profile when HERMES_HOME is set', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-home-'));
  const calls = [];
  const ensure = async args => {
    calls.push(args);
    return { created: true, dir: path.join(home, '.hermes/profiles', args.name), name: args.name, warnings: [] };
  };
  const env = {
    HERMES_HOME: path.join(home, '.hermes/profiles/llm-wiki'),
    AGENT_CWD: '/projects/llm-wiki',
    AGENT_PROJECT_CONTEXT: 'LLM-Wiki agent',
  };
  const result = await healInstanceProfileFromEnv('llm-wiki', env, { ensureHermesProfile: ensure });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'llm-wiki');
  assert.equal(calls[0].workdir, '/projects/llm-wiki');
  assert.equal(result.created, true);
});

test('healInstanceProfileFromEnv is a no-op when HERMES_HOME is unset', async () => {
  let invoked = false;
  const ensure = async () => { invoked = true; return null; };
  const result = await healInstanceProfileFromEnv('llm-wiki', {}, { ensureHermesProfile: ensure });
  assert.equal(invoked, false);
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --test-name-pattern='healInstanceProfileFromEnv'
```

Expected: FAIL — `healInstanceProfileFromEnv` not exported.

- [ ] **Step 3: Implement helper and wire into start handler**

In `scripts/cli.mjs`, add the exported helper (near top-level helpers):

```js
export async function healInstanceProfileFromEnv(name, instanceEnv, deps = {}) {
  if (!instanceEnv || !instanceEnv.HERMES_HOME) return null;
  const ensure = deps.ensureHermesProfile || ensureHermesProfile;
  return ensure({
    name,
    workdir: instanceEnv.AGENT_CWD || ROOT,
    projectContext: instanceEnv.AGENT_PROJECT_CONTEXT || '',
  });
}
```

In the existing `vc instance start` branch, before `assertInstanceStartIsSafe`/`startInstance`:

```js
const envPath = resolveInstanceEnvPath(ROOT, name);
const instanceEnv = fs.existsSync(envPath) ? parseKeyValueEnv(fs.readFileSync(envPath, 'utf8')) : {};
try {
  await healInstanceProfileFromEnv(name, instanceEnv);
} catch (err) {
  console.error(`Hermes profile self-heal failed: ${err.message}`);
  process.exitCode = 2;
  return;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/cli.mjs app-node/cli_install.test.mjs
git commit -m "feat(vc-cli): self-heal Hermes profile on instance start"
```

---

## Task 10: Agent adapter merges `HERMES_HOME` explicitly

**Files:**
- Modify: `app-node/agent_adapters.mjs`
- Modify: `app-node/agent_adapters.test.mjs`

- [ ] **Step 1: Read the current Hermes spawn site around line 201**

```
sed -n '180,260p' app-node/agent_adapters.mjs
```

- [ ] **Step 2: Write the failing test**

Append to `app-node/agent_adapters.test.mjs`:

```js
test('hermes adapter spawn carries HERMES_HOME from instance env into child env', async () => {
  const { buildHermesSpawnOptions } = await import('./agent_adapters.mjs');
  const opts = buildHermesSpawnOptions({
    parentEnv: { PATH: '/usr/bin', HERMES_HOME: '/parent/.hermes' },
    instanceEnv: { HERMES_HOME: '/Users/neo/.hermes/profiles/llm-wiki' },
  });
  assert.equal(opts.env.HERMES_HOME, '/Users/neo/.hermes/profiles/llm-wiki');
  assert.equal(opts.env.PATH, '/usr/bin');
});
```

- [ ] **Step 3: Run test to verify it fails**

```
npm test -- --test-name-pattern='hermes adapter spawn carries HERMES_HOME'
```

Expected: FAIL — function not exported.

- [ ] **Step 4: Implement and wire**

Add at the top of `app-node/agent_adapters.mjs` (near other helpers):

```js
export function buildHermesSpawnOptions({ parentEnv = process.env, instanceEnv = {} } = {}) {
  const env = { ...parentEnv };
  if (instanceEnv.HERMES_HOME) env.HERMES_HOME = instanceEnv.HERMES_HOME;
  return { env };
}
```

At the existing spawn site (around line 201), replace the inline env construction with `buildHermesSpawnOptions({ instanceEnv: env }).env` (where `env` is the adapter's per-call env input map).

- [ ] **Step 5: Run tests to verify all pass**

```
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-node/agent_adapters.mjs app-node/agent_adapters.test.mjs
git commit -m "feat(agent-adapters): plumb instance HERMES_HOME into hermes spawn"
```

---

## Task 11: Doctor surfaces missing-profile and cwd-mismatch

**Files:**
- Modify: `app-node/instance_doctor.mjs`
- Modify: `app-node/instance_doctor.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `app-node/instance_doctor.test.mjs`:

```js
test('checkInstanceConfigs warns when HERMES_HOME points at a missing profile', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-doctor-'));
  const instancesDir = path.join(root, 'instances');
  fs.mkdirSync(instancesDir, { recursive: true });
  fs.writeFileSync(path.join(instancesDir, 'llm-wiki.env'), [
    'DISCORD_TOKEN="t"',
    'AUTO_JOIN_VOICE_CHANNELS="LLM-Wiki"',
    'TRANSCRIPT_CHANNEL_ID="1"',
    'AGENT_CWD="/projects/llm-wiki"',
    'HERMES_HOME="/nonexistent/.hermes/profiles/llm-wiki"',
    '',
  ].join('\n'));
  const result = checkInstanceConfigs(root, { instancesDir });
  assert.ok(result.warnings.some(w => /HERMES_HOME points at .* missing/.test(w)));
});

test('checkInstanceConfigs errors when profile terminal.cwd differs from AGENT_CWD', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-doctor-'));
  const instancesDir = path.join(root, 'instances');
  const profileDir = path.join(root, '.hermes', 'profiles', 'llm-wiki');
  fs.mkdirSync(instancesDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'config.yaml'), 'terminal:\n  cwd: /elsewhere\n');
  fs.writeFileSync(path.join(instancesDir, 'llm-wiki.env'), [
    'DISCORD_TOKEN="t"',
    'AUTO_JOIN_VOICE_CHANNELS="LLM-Wiki"',
    'TRANSCRIPT_CHANNEL_ID="1"',
    'AGENT_CWD="/projects/llm-wiki"',
    `HERMES_HOME="${profileDir}"`,
    '',
  ].join('\n'));
  const result = checkInstanceConfigs(root, {
    instancesDir,
    readTerminalCwd: () => '/elsewhere',
  });
  assert.ok(result.errors.some(e => /terminal\.cwd .* does not match AGENT_CWD/.test(e)));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --test-name-pattern='checkInstanceConfigs (warns when HERMES_HOME|errors when profile terminal)'
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Edit `app-node/instance_doctor.mjs`. Add helper:

```js
function readProfileTerminalCwdFromConfig(dir, fsDep = fs) {
  try {
    const text = fsDep.readFileSync(path.join(dir, 'config.yaml'), 'utf8');
    const m = text.match(/^\s*cwd:\s*"?([^"\n]+)"?\s*$/m);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}
```

Inside `checkInstanceConfigs(root, options = {})`, after the existing checks:

```js
const readTerminalCwd = options.readTerminalCwd || (dir => readProfileTerminalCwdFromConfig(dir));
for (const instance of instances) {
  const home = String(instance.env.HERMES_HOME || '').trim();
  if (!home) continue;
  if (!fs.existsSync(path.join(home, 'config.yaml'))) {
    warnings.push(`${instance.name}: HERMES_HOME points at ${home} which is missing; vc instance start will create it`);
    continue;
  }
  const profileCwd = readTerminalCwd(home);
  const agentCwd = String(instance.env.AGENT_CWD || '').trim();
  if (profileCwd && agentCwd && profileCwd !== agentCwd) {
    errors.push(`${instance.name}: profile terminal.cwd (${profileCwd}) does not match AGENT_CWD (${agentCwd}); re-run vc instance setup to reconcile`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-node/instance_doctor.mjs app-node/instance_doctor.test.mjs
git commit -m "feat(instance-doctor): warn on missing profile dir, error on cwd mismatch"
```

---

## Task 12: Launcher preserves instance `HERMES_HOME`

**Files:**
- Modify: `run.sh`

- [ ] **Step 1: Read the current launcher**

```
cat run.sh
```

- [ ] **Step 2: Make instance env take precedence over shared .env**

If `run.sh` currently sources the shared `.env` after the instance env (or unconditionally), reorder so the instance env is sourced last. Concretely, the loader block should be:

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

INSTANCE_ENV="${1:-}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -n "${INSTANCE_ENV:-}" ] && [ -f "$INSTANCE_ENV" ]; then
  export VERBALCODING_INSTANCE_ENV="$INSTANCE_ENV"
  set -a
  # shellcheck disable=SC1091
  . "$INSTANCE_ENV"
  set +a
fi

node app-node/main.mjs
```

If the current launcher already follows this order (instance env sourced last), leave it alone.

- [ ] **Step 3: Verify**

```
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit only if changed**

```bash
git add run.sh
git diff --cached --quiet || git commit -m "fix(run.sh): ensure instance env (HERMES_HOME) overrides shared .env"
```

---

## Task 13: Documentation

**Files:**
- Modify: `docs/MULTI_INSTANCE.md`
- Modify: `instances/README.md`
- Modify: `README.md`

- [ ] **Step 1: Update `docs/MULTI_INSTANCE.md`**

Add a new section after "Instance setup wizard":

```markdown
### Hermes profile isolation

Each instance gets its own Hermes home at `~/.hermes/profiles/<name>` so that
memory, MEMORY.md, SOUL.md, and learned skills do not leak across projects.

`vc instance setup <name>` automatically:

- runs `hermes profile create <name> --clone-from default` (carries API keys
  and model from your current `~/.hermes`; sessions and memory start fresh),
- sets the new profile's `terminal.cwd` to the instance workdir,
- seeds `<profile>/SOUL.md` from the wizard's project-context answer,
- writes `HERMES_HOME=...` into `instances/<name>.env`.

`vc instance start <name>` self-heals: if the env points at a Hermes profile
dir that no longer exists, the start command recreates it before launching.

Instance names must match `^[a-z0-9][a-z0-9_-]{0,63}$` because Hermes uses the
name as a directory and config key.
```

- [ ] **Step 2: Update `instances/README.md`**

Add `HERMES_HOME` to the "isolated values" bullet list:

```markdown
- Give each instance isolated values for:
  - `PROJECT_SESSIONS_FILE`
  - `BRIDGE_LOG_PATH`
  - `NODE_AUDIO_DEBUG_DIR`
  - `HERMES_SESSION_FILE`
  - `HERMES_HOME` (set automatically by `vc instance setup`)
```

- [ ] **Step 3: Update `README.md`**

In the multi-instance section, add one sentence:

```markdown
Each vc instance is bound 1:1 to an isolated Hermes profile under
`~/.hermes/profiles/<name>`, so per-project memory, skills, and SOUL.md stay
separate.
```

- [ ] **Step 4: Commit**

```bash
git add docs/MULTI_INSTANCE.md instances/README.md README.md
git commit -m "docs: explain per-instance Hermes profile isolation"
```

---

## Task 14: Final integration smoke

- [ ] **Step 1: Run the full test suite**

```
npm test
```

Expected: PASS.

- [ ] **Step 2: Run doctor on the live tree**

```
node scripts/cli.mjs doctor
```

Expected: doctor reports without crashing on the new fields. If any existing instance env now triggers the new warnings/errors (e.g. missing `HERMES_HOME` is fine — it's just an opt-in field), confirm the messages are coherent.

- [ ] **Step 3: Final commit if any cleanup was needed**

```bash
git status
git diff
```

If clean, no commit needed.

---

## Self-review

- ✓ Spec coverage: every locked decision in the spec has at least one task. (Decisions 1–9 → Tasks 4, 4, 5, 4, 4, 8/9, 4–9, 7, 1.)
- ✓ No "TBD" / "implement later" / "add error handling" placeholders.
- ✓ Function names consistent across tasks: `ensureHermesProfile`, `validateProfileName`, `profileExists`, `assertHermesAvailable`, `healInstanceProfileFromEnv`, `buildHermesSpawnOptions`, `readProfileTerminalCwdFromConfig`.
- ✓ Every code-touching step shows actual code.
- ✓ TDD ordering preserved: failing test → run → impl → run → commit.
- ✓ Concurrent-ensure lock file (per spec §Conflict handling) — INTENTIONALLY DEFERRED. Single-user vc instances rarely race; fold into a follow-up task when concurrent setup becomes a real failure mode.
