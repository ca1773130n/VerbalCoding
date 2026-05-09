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
    speechswift: {
      command: 'audio',
      engine: 'cosyvoice',
      language: 'korean',
      refAudio: '/project/voice-samples/me.wav',
      modelId: 'aufklarer/CosyVoice3-0.5B-MLX-4bit',
      model: 'base',
      speaker: '',
      instruct: '',
      timeoutMs: 120000,
      stream: true,
      useForProgress: false,
      mode: 'cli',
      serverUrl: 'http://127.0.0.1:18080',
    },
    supertonic: {
      command: 'supertonic',
      voice: 'M1',
      language: 'ko',
      steps: 2,
      speed: 1.08,
      maxChunkLength: 300,
      silenceDuration: 0.15,
      customStylePath: '',
      timeoutMs: 60000,
      useForProgress: false,
      cacheDir: '',
      intraOpThreads: '',
      interOpThreads: '',
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

test('Edge backend reads dynamic voice before each TTS request', async () => {
  const calls = [];
  const backend = createTtsBackend(baseSettings(), {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    voiceProvider: () => 'en-US-GuyNeural',
    execFileAsync: async (cmd, args, options) => {
      calls.push({ cmd, args, options });
    },
  });

  await backend.synthesize('hello', { kind: 'final' });

  assert.deepEqual(calls[0].args.slice(0, 2), ['-v', 'en-US-GuyNeural']);
  assert.deepEqual(backend.cacheKeyParts(), ['edge', 'en-US-GuyNeural', '+10%']);
});

test('Edge backend honors configurable command path', async () => {
  const calls = [];
  const settings = baseSettings();
  settings.edge.command = '/project/.venv/bin/edge-tts';
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args, options) => {
      calls.push({ cmd, args, options });
    },
  });

  await backend.synthesize('안녕하세요', { kind: 'final' });

  assert.equal(calls[0].cmd, '/project/.venv/bin/edge-tts');
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
  assert.ok(calls[0].args.some(arg => String(arg).endsWith('integrations/openvoice/synth.py')));
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

test('SpeechSwift CosyVoice backend calls audio CLI with reference sample and output path', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'speechswift' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('복제 음성 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, 'audio');
  assert.deepEqual(calls[0].args.slice(0, 4), ['speak', '복제 음성 테스트', '--engine', 'cosyvoice']);
  assert.ok(calls[0].args.includes('--voice-sample'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.ok(calls[0].args.includes('--stream'));
  assert.ok(calls[0].args.includes('--model-id'));
  assert.equal(calls[0].options.timeout, 120000);
  assert.match(out, /^\/tmp\/verbalcoding-speechswift-/);
  assert.deepEqual(backend.cacheKeyParts(), ['speechswift', 'cli', 'http://127.0.0.1:18080', 'cosyvoice', '/project/voice-samples/me.wav', 'korean', 'aufklarer/CosyVoice3-0.5B-MLX-4bit', 'base', '', '']);
});

test('SpeechSwift progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'speechswift' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('진행 안내', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('SpeechSwift falls back to Edge when audio CLI fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'speechswift' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === 'audio') throw new Error('speech-swift missing');
    },
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd === 'audio'));
  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /speech-swift failed; falling back to edge/i.test(call.warn || '')));
});

test('SpeechSwift server mode passes an AbortSignal timeout to audio-server fetch', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'speechswift', speechswift: { ...baseSettings().speechswift, mode: 'server', serverUrl: 'http://127.0.0.1:18080', timeoutMs: 50 } };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    writeFileAsync: async () => {},
    execFileAsync: async () => {},
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      };
    },
  });

  await backend.synthesize('서버 음성 테스트', { kind: 'final' });

  assert.equal(calls[0].url, 'http://127.0.0.1:18080/speak');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[0].options.signal.aborted, false);
});

test('SpeechSwift server mode posts to audio-server and writes returned WAV', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'speechswift', speechswift: { ...baseSettings().speechswift, mode: 'server', serverUrl: 'http://127.0.0.1:18080' } };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    writeFileAsync: async (file, bytes) => calls.push({ write: file, bytes: bytes.length }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      };
    },
  });

  const out = await backend.synthesize('서버 음성 테스트', { kind: 'final' });

  assert.equal(calls[0].url, 'http://127.0.0.1:18080/speak');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    text: '서버 음성 테스트',
    engine: 'cosyvoice',
    language: 'korean',
  });
  assert.match(calls[1].write, /^\/tmp\/verbalcoding-speechswift-server-/);
  assert.equal(calls[1].bytes, 4);
  assert.match(out, /^\/tmp\/verbalcoding-speechswift-server-/);
});

test('SpeechSwift server mode falls back to Edge when audio-server fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'speechswift', speechswift: { ...baseSettings().speechswift, mode: 'server' } };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    writeFileAsync: async () => {},
    fetch: async () => ({ ok: false, status: 503, statusText: 'Unavailable', text: async () => 'loading' }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /speech-swift failed; falling back to edge/i.test(call.warn || '')));
});

test('Supertonic backend calls local supertonic CLI with Korean low-latency options', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'supertonic' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('수퍼토닉 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, 'supertonic');
  assert.deepEqual(calls[0].args.slice(0, 6), ['tts', '수퍼토닉 테스트', '-o', calls[0].args[3], '--lang', 'ko']);
  assert.ok(calls[0].args.includes('--voice'));
  assert.ok(calls[0].args.includes('M1'));
  assert.ok(calls[0].args.includes('--steps'));
  assert.ok(calls[0].args.includes('2'));
  assert.ok(calls[0].args.includes('--speed'));
  assert.ok(calls[0].args.includes('1.08'));
  assert.equal(calls[0].options.timeout, 60000);
  assert.match(out, /^\/tmp\/verbalcoding-supertonic-/);
  assert.deepEqual(backend.cacheKeyParts(), ['supertonic', 'supertonic', 'M1', 'ko', 2, 1.08, 300, 0.15, '']);
});

test('Supertonic progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'supertonic' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('진행 안내', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('Supertonic falls back to Edge when local CLI fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'supertonic' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === 'supertonic') throw new Error('supertonic missing');
    },
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd === 'supertonic'));
  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /supertonic failed; falling back to edge/i.test(call.warn || '')));
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
