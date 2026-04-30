import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { createTtsBackend } from './tts_backends.mjs';

function baseSettings() {
  return {
    backend: 'edge',
    edge: { voice: 'ko-KR-InJoonNeural', rate: '+10%' },
    openvoice: {
      dir: '/project/vendor/OpenVoice',
      venv: '/project/.venv-openvoice',
      refAudio: '/project/voice-samples/me.wav',
      language: 'KR',
      style: 'default',
      timeoutMs: 90000,
      useForProgress: false,
    },
  };
}

test('Edge backend calls edge-tts with voice, rate, text, and output path', async () => {
  const calls = [];
  const backend = createTtsBackend(baseSettings(), {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args, options) => {
      calls.push({ cmd, args, options });
    },
  });

  const out = await backend.synthesize('안녕하세요', { kind: 'final' });

  assert.equal(calls[0].cmd, 'edge-tts');
  assert.deepEqual(calls[0].args.slice(0, 5), ['-v', 'ko-KR-InJoonNeural', '--rate', '+10%', '-t']);
  assert.equal(calls[0].args[5], '안녕하세요');
  assert.equal(calls[0].args[6], '--write-media');
  assert.match(out, /^\/tmp\/verbalcoding-edge-/);
  assert.equal(calls[0].options.timeout, 60000);
  assert.deepEqual(backend.cacheKeyParts(), ['edge', 'ko-KR-InJoonNeural', '+10%']);
});

test('OpenVoice final synthesis calls Python wrapper with reference audio and output path', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'openvoice' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: file => file.endsWith('python') || file.endsWith('.wav'),
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('복제 음성 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, path.join('/project/.venv-openvoice', 'bin', 'python'));
  assert.ok(calls[0].args.some(arg => String(arg).endsWith('scripts/openvoice_synth.py')));
  assert.ok(calls[0].args.includes('--ref-audio'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.ok(calls[0].args.includes('--text'));
  assert.ok(calls[0].args.includes('복제 음성 테스트'));
  assert.equal(calls[0].options.timeout, 90000);
  assert.match(out, /^\/tmp\/verbalcoding-openvoice-/);
  assert.deepEqual(backend.cacheKeyParts(), ['openvoice', '/project/voice-samples/me.wav', 'KR', 'default']);
});

test('OpenVoice progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'openvoice' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('파일 읽기', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('OpenVoice final synthesis falls back to Edge when wrapper fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'openvoice' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd.includes('.venv-openvoice')) throw new Error('openvoice missing');
    },
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd?.includes('.venv-openvoice')));
  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /falling back to edge/i.test(call.warn || '')));
});


test('OpenVoice backend falls back to python3 when configured venv python is missing', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'openvoice' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: file => file.endsWith('.wav'),
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  await backend.synthesize('복제 음성 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, 'python3');
});

test('TTS backends omit signal option when no AbortSignal is provided', async () => {
  const calls = [];
  const backend = createTtsBackend(baseSettings(), {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  await backend.synthesize('신호 없는 음성 테스트', { signal: null, kind: 'final' });

  assert.equal(calls[0].cmd, 'edge-tts');
  assert.equal(Object.hasOwn(calls[0].options, 'signal'), false);
});
