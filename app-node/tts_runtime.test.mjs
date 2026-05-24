import test from 'node:test';
import assert from 'node:assert/strict';
import { createTtsRuntime } from './tts_runtime.mjs';
import { createBridge } from './bridge_context.mjs';

function makeDeps(overrides = {}) {
  return {
    bridge: createBridge(),
    ROOT: '/tmp/vc-root',
    execFileAsync: async () => ({ stdout: '', stderr: '' }),
    speakText: async () => {},
    warn: () => {},
    persistEnvValues: () => {},
    ...overrides,
  };
}

test('createTtsRuntime exposes the expected functions', () => {
  const rt = createTtsRuntime(makeDeps());
  for (const name of ['ensureSelectedTtsBackendInstalled', 'commandIsInstalled']) {
    assert.equal(typeof rt[name], 'function', `${name} is exposed`);
  }
});

test('ensureSelectedTtsBackendInstalled is a no-op for built-in backends', async () => {
  const { ensureSelectedTtsBackendInstalled } = createTtsRuntime(makeDeps());
  const result = await ensureSelectedTtsBackendInstalled({ backend: 'edge' }, null);
  assert.deepEqual(result, { ok: true, installed: false });
});

test('ensureSelectedTtsBackendInstalled triggers install when mlxaudio binary missing', async () => {
  const calls = [];
  const speakCalls = [];
  const persisted = [];
  const deps = makeDeps({
    execFileAsync: async (...args) => { calls.push(args); return { stdout: '', stderr: '' }; },
    speakText: async msg => { speakCalls.push(msg); },
    persistEnvValues: v => persisted.push(v),
  });
  const prev = process.env.MLXAUDIO_PYTHON;
  process.env.MLXAUDIO_PYTHON = '/path/that/does/not/exist/mlxaudio';
  try {
    const { ensureSelectedTtsBackendInstalled } = createTtsRuntime(deps);
    const result = await ensureSelectedTtsBackendInstalled({ backend: 'mlxaudio' }, null);
    assert.equal(result.ok, true);
    assert.equal(result.installed, true);
    assert.equal(calls.length, 1, 'bash install script invoked once');
    assert.match(calls[0][0], /bash/);
    assert.ok(calls[0][1][0].endsWith('install_mlxaudio.sh'));
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].MLXAUDIO_PYTHON, './.venv-mlxaudio/bin/python');
  } finally {
    if (prev === undefined) delete process.env.MLXAUDIO_PYTHON;
    else process.env.MLXAUDIO_PYTHON = prev;
  }
});

test('ensureSelectedTtsBackendInstalled reports install failure', async () => {
  const deps = makeDeps({
    execFileAsync: async () => { const e = new Error('install boom'); e.stderr = 'boom'; throw e; },
  });
  const prev = process.env.MLXAUDIO_PYTHON;
  process.env.MLXAUDIO_PYTHON = '/path/that/does/not/exist/mlxaudio';
  try {
    const { ensureSelectedTtsBackendInstalled } = createTtsRuntime(deps);
    const result = await ensureSelectedTtsBackendInstalled({ backend: 'mlxaudio' }, null);
    assert.equal(result.ok, false);
    assert.equal(result.installed, false);
    assert.ok(result.error);
  } finally {
    if (prev === undefined) delete process.env.MLXAUDIO_PYTHON;
    else process.env.MLXAUDIO_PYTHON = prev;
  }
});

test('commandIsInstalled returns false for empty input', () => {
  const { commandIsInstalled } = createTtsRuntime(makeDeps());
  assert.equal(commandIsInstalled(''), false);
  assert.equal(commandIsInstalled(null), false);
});

test('commandIsInstalled caches results per binary on bridge', () => {
  const deps = makeDeps();
  const { commandIsInstalled } = createTtsRuntime(deps);
  // Probe with a binary name extremely unlikely to exist
  commandIsInstalled('vc-test-no-such-binary-xyz123');
  assert.ok(deps.bridge.installedBinaryCache.has('vc-test-no-such-binary-xyz123'));
  assert.equal(deps.bridge.installedBinaryCache.get('vc-test-no-such-binary-xyz123'), false);
});
