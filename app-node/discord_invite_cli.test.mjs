import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CLI = path.join(ROOT, 'scripts', 'cli.mjs');

test('vc bot invite prints an OAuth URL for a Discord client id', () => {
  const result = spawnSync(process.execPath, [CLI, 'bot', 'invite', '1497879755394125924'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Discord bot invite URL:/);
  assert.match(result.stdout, /client_id=1497879755394125924/);
  assert.match(result.stdout, /scope=bot\+applications\.commands|scope=bot%20applications\.commands/);
  assert.match(result.stdout, /permissions=277028604928/);
});

test('vc bot invite supports a guild id shortcut', () => {
  const result = spawnSync(process.execPath, [CLI, 'bot', 'invite', '1497879755394125924', '--guild', '1497880000000000000'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /guild_id=1497880000000000000/);
  assert.match(result.stdout, /disable_guild_select=true/);
});
