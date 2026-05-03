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
  assert.equal(fs.readFileSync(path.join(dir, 'SOUL.md'), 'utf8'), 'LLM-Wiki backend agent');
  const setCall = runner.calls.find(c => c.args[0] === 'config' && c.args[1] === 'set');
  assert.equal(setCall.opts.env.HERMES_HOME, dir);
});
