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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { hermesProfilesRoot, hermesProfileDir, profileExists } from './hermes_profiles.mjs';

const __tempRoots = [];
test.after(() => {
  for (const root of __tempRoots) try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
});

function tempHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-hermes-home-'));
  __tempRoots.push(root);
  return root;
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
  const soul = fs.readFileSync(path.join(dir, 'SOUL.md'), 'utf8');
  assert.match(soul, /<!-- vc:project-context:start -->/);
  assert.match(soul, /LLM-Wiki backend agent/);
  assert.match(soul, /<!-- vc:project-context:end -->/);
  const setCall = runner.calls.find(c => c.args[0] === 'config' && c.args[1] === 'set');
  assert.equal(setCall.opts.env.HERMES_HOME, dir);
});

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

import { applyProjectContextToSoul, VC_SOUL_MARKER_START, VC_SOUL_MARKER_END } from './hermes_profiles.mjs';

test('applyProjectContextToSoul appends a marker block to existing SOUL.md', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-soul-'));
  __tempRoots.push(tmp);
  const soulPath = path.join(tmp, 'SOUL.md');
  const persona = 'You are Hermes Agent, an intelligent AI assistant.';
  fs.writeFileSync(soulPath, persona);
  applyProjectContextToSoul(soulPath, 'LLM-Wiki backend agent for the wiki repo.');
  const out = fs.readFileSync(soulPath, 'utf8');
  assert.ok(out.startsWith(persona), 'cloned persona must be preserved');
  assert.match(out, new RegExp(VC_SOUL_MARKER_START));
  assert.match(out, /## Project context/);
  assert.match(out, /LLM-Wiki backend agent for the wiki repo\./);
  assert.match(out, new RegExp(VC_SOUL_MARKER_END));
});

test('applyProjectContextToSoul updates an existing marker block in place (idempotent)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-soul-'));
  __tempRoots.push(tmp);
  const soulPath = path.join(tmp, 'SOUL.md');
  fs.writeFileSync(soulPath, 'Persona text.');
  applyProjectContextToSoul(soulPath, 'first context');
  applyProjectContextToSoul(soulPath, 'second context');
  const out = fs.readFileSync(soulPath, 'utf8');
  const startCount = (out.match(/<!-- vc:project-context:start -->/g) || []).length;
  const endCount = (out.match(/<!-- vc:project-context:end -->/g) || []).length;
  assert.equal(startCount, 1, 'must not duplicate marker block on re-apply');
  assert.equal(endCount, 1);
  assert.match(out, /second context/);
  assert.doesNotMatch(out, /first context/);
});

test('applyProjectContextToSoul writes a fresh SOUL.md when none exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-soul-'));
  __tempRoots.push(tmp);
  const soulPath = path.join(tmp, 'SOUL.md');
  applyProjectContextToSoul(soulPath, 'fresh project context');
  const out = fs.readFileSync(soulPath, 'utf8');
  assert.match(out, /fresh project context/);
  assert.match(out, new RegExp(VC_SOUL_MARKER_START));
  assert.match(out, new RegExp(VC_SOUL_MARKER_END));
});

test('applyProjectContextToSoul is a no-op when projectContext is empty', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-soul-'));
  __tempRoots.push(tmp);
  const soulPath = path.join(tmp, 'SOUL.md');
  fs.writeFileSync(soulPath, 'persona');
  applyProjectContextToSoul(soulPath, '   ');
  assert.equal(fs.readFileSync(soulPath, 'utf8'), 'persona');
});

test('ensureHermesProfile refreshes SOUL.md on reuse with new projectContext', async () => {
  const home = tempHome();
  const dir = path.join(home, '.hermes', 'profiles', 'llm-wiki');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), 'terminal:\n  cwd: /workdir/llm-wiki\n');
  fs.writeFileSync(path.join(dir, 'SOUL.md'), 'persona\n\n<!-- vc:project-context:start -->\n## Project context\n\nold context\n<!-- vc:project-context:end -->\n');

  const runner = recordingRunner({
    'hermes config get terminal.cwd': cb => cb(null, { stdout: '/workdir/llm-wiki\n', stderr: '' }),
  });
  await ensureHermesProfile({
    name: 'llm-wiki',
    workdir: '/workdir/llm-wiki',
    projectContext: 'fresh context',
    deps: { execFile: runner, homedir: () => home, fs },
  });
  const soul = fs.readFileSync(path.join(dir, 'SOUL.md'), 'utf8');
  assert.match(soul, /fresh context/);
  assert.doesNotMatch(soul, /old context/);
  assert.equal((soul.match(/<!-- vc:project-context:start -->/g) || []).length, 1);
});
