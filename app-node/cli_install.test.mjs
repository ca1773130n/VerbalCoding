import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
