import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { healInstanceProfileFromEnv } from './instance_profile_lifecycle.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('package exposes a short vc shell command', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.equal(pkg.bin?.vc, 'scripts/cli.mjs');
  assert.equal(pkg.bin?.verbalcoding, 'scripts/cli.mjs');
});

test('installer shell script links the vc command during setup', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'install.sh'), 'utf8');

  assert.match(script, /npm link/);
  assert.match(script, /Installed shell CLI: vc/);
  assert.match(script, /VERBALCODING_SKIP_CLI_LINK/);
});

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
