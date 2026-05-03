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
