import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectInstalledAgents, listKnownBackends } from './agent_detect.mjs';

test('detectInstalledAgents marks present when which resolves', async () => {
  const fakeWhich = async (bin) => (bin === 'hermes' ? '/usr/local/bin/hermes' : null);
  const result = await detectInstalledAgents({}, { which: fakeWhich });
  const hermes = result.find(r => r.backend === 'hermes');
  assert.equal(hermes.present, true);
  assert.equal(hermes.path, '/usr/local/bin/hermes');
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
  const fakeWhich = async (bin) => (bin === 'aider' ? '/opt/aider' : null);
  const result = await detectInstalledAgents({ AIDER_COMMAND: 'aider --foo' }, { which: fakeWhich });
  const aider = result.find(r => r.backend === 'aider');
  assert.equal(aider.command, 'aider --foo');
  assert.equal(aider.present, true);
});

test('listKnownBackends returns 8 entries', () => {
  const list = listKnownBackends();
  assert.equal(list.length, 8);
  assert.ok(list.some(b => b.backend === 'hermes'));
  assert.ok(list.some(b => b.backend === 'cursor'));
});

test('detectInstalledAgents default which uses PATH iteration', async () => {
  const result = await detectInstalledAgents({ PATH: '/nonexistent/dir' }, {});
  assert.ok(Array.isArray(result));
  for (const r of result) assert.equal(r.present, false);
});
