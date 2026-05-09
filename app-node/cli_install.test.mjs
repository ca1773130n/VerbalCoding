import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { healInstanceProfileFromEnv } from './instance_profile_lifecycle.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('package exposes a short vc shell command', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.equal(pkg.private, undefined);
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.engines?.node, '>=20');
  assert.equal(pkg.bin?.vc, 'scripts/cli.mjs');
  assert.equal(pkg.bin?.verbalcoding, 'scripts/cli.mjs');
  assert.ok(pkg.files.includes('app-node/'));
  assert.ok(pkg.files.includes('scripts/*.mjs'));
  assert.ok(pkg.files.includes('scripts/*.sh'));
  assert.ok(pkg.files.includes('integrations/openvoice/'));
  assert.ok(!pkg.files.includes('scripts/*.py'));
  assert.ok(pkg.files.includes('run.sh'));
  assert.ok(pkg.files.includes('LICENSE'));
});

test('CLI includes npm-friendly setup and start commands', () => {
  const cli = fs.readFileSync(path.join(ROOT, 'scripts', 'cli.mjs'), 'utf8');

  assert.match(cli, /vc setup \[--yes\]/);
  assert.match(cli, /command === 'setup'/);
  assert.match(cli, /VERBALCODING_SKIP_CLI_LINK/);
  assert.match(cli, /command === 'start'/);
  assert.match(cli, /run\.sh/);
});

test('installer shell script links the vc command during setup', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'install.sh'), 'utf8');

  assert.match(script, /bootstrap_prereqs\.sh/);
  assert.match(script, /--no-wizard/);
  assert.match(script, /--yes\) BOOTSTRAP_ARGS\+=\("\$arg"\); INSTALL_ARGS\+=\("\$arg"\)/);
  assert.match(script, /VERBALCODING_SKIP_BOOTSTRAP/);
  assert.match(script, /npm link/);
  assert.match(script, /Installed shell CLI: vc/);
  assert.match(script, /VERBALCODING_SKIP_CLI_LINK/);
});

test('npm setup supports non-interactive --yes mode', () => {
  const installer = fs.readFileSync(path.join(ROOT, 'scripts', 'install.mjs'), 'utf8');
  const config = fs.readFileSync(path.join(ROOT, 'app-node', 'install_config.mjs'), 'utf8');

  assert.match(installer, /args\.includes\('--yes'\)/);
  assert.match(installer, /normalizeInstallAnswers\(process\.env\)/);
  assert.match(config, /vc start/);
  assert.doesNotMatch(config, /npm install -g \.\s+#/);
});

test('bootstrap script installs cross-platform prerequisites and local model helpers', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'bootstrap_prereqs.sh'), 'utf8');

  assert.match(script, /brew install/);
  assert.match(script, /apt-get install/);
  assert.match(script, /dnf install/);
  assert.match(script, /pacman -Sy/);
  assert.match(script, /git clone --depth 1 https:\/\/github\.com\/ggml-org\/whisper\.cpp\.git/);
  assert.match(script, /ggml-small-q5_1\.bin/);
  assert.match(script, /\.venv-tts/);
});

test('Ubuntu Docker smoke script validates clean install without secrets', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'docker_ubuntu_smoke.sh'), 'utf8');

  assert.match(script, /ubuntu:24\.04/);
  assert.match(script, /git .*archive --format=tar HEAD/);
  assert.match(script, /\.\/scripts\/install\.sh --yes --no-wizard/);
  assert.match(script, /DISCORD_BOT_TOKEN="smoke-test-token"/);
  assert.match(script, /AGENT_BACKEND="custom"/);
  assert.match(script, /vc doctor/);
  assert.doesNotMatch(script, /npm run vc/);
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
