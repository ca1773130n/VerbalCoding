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
    omnivoice: {
      python: '/project/.venv-omnivoice/bin/python',
      model: 'k2-fsa/OmniVoice',
      device: 'mps',
      dtype: 'float16',
      refAudio: '/project/voice-samples/me.wav',
      refText: '테스트 기준 음성입니다.',
      language: 'ko',
      speaker: 'warm korean male voice',
      timeoutMs: 180000,
      useForProgress: false,
    },
    qwen3tts: {
      command: 'audio',
      mode: 'custom',
      model: '',
      language: 'korean',
      speaker: 'sohee',
      instruct: 'calm conversational Korean',
      refAudio: '/project/voice-samples/me.wav',
      refText: '테스트 기준 음성입니다.',
      stream: true,
      timeoutMs: 120000,
      useForProgress: false,
    },
    fireredtts2: {
      command: 'fireredtts2',
      pretrainedDir: '/project/models/FireRedTTS2',
      device: 'mps',
      genType: 'monologue',
      speaker: 'S1',
      promptAudio: '/project/voice-samples/me.wav',
      promptText: '테스트 기준 음성입니다.',
      useBf16: true,
      timeoutMs: 180000,
      useForProgress: false,
    },
    mossttsnano: {
      command: 'python3',
      script: '/project/vendor/MOSS-TTS-Nano/infer.py',
      checkpoint: 'OpenMOSS-Team/MOSS-TTS-Nano',
      audioTokenizer: 'OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano',
      mode: 'voice_clone',
      language: 'ko',
      device: 'cpu',
      dtype: 'float32',
      promptAudio: '/project/voice-samples/me.wav',
      promptText: '테스트 기준 음성입니다.',
      maxNewFrames: 256,
      seed: '7',
      timeoutMs: 120000,
      useForProgress: false,
    },
    mossttsnano_mlx: {
      python: 'python3',
      script: '/project/integrations/mossttsnano_mlx/synth.py',
      torchInferScript: '/project/vendor/MOSS-TTS-Nano/infer.py',
      checkpoint: 'OpenMOSS-Team/MOSS-TTS-Nano',
      audioTokenizer: 'OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano',
      mode: 'voice_clone',
      language: 'ko',
      torchDevice: 'cpu',
      torchDtype: 'float32',
      promptAudio: '/project/voice-samples/me.wav',
      promptText: '테스트 기준 음성입니다.',
      maxNewFrames: 120,
      seed: '7',
      timeoutMs: 180000,
      useForProgress: false,
    },
    neuttsair: {
      python: '/project/.venv-neuttsair/bin/python',
      script: '/project/integrations/neuttsair/synth.py',
      backboneRepo: 'neuphonic/neutts-air-q4-gguf',
      backboneDevice: 'mps',
      codecRepo: 'neuphonic/neucodec',
      codecDevice: 'mps',
      refAudio: '/project/voice-samples/me.wav',
      refText: 'Reference voice text.',
      language: 'en',
      sampleRate: 24000,
      timeoutMs: 120000,
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

test('OmniVoice backend calls Python wrapper with model, reference sample, and output path', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'omnivoice' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('옴니보이스 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, '/project/.venv-omnivoice/bin/python');
  assert.ok(calls[0].args.some(arg => String(arg).endsWith('integrations/omnivoice/synth.py')));
  assert.ok(calls[0].args.includes('--model'));
  assert.ok(calls[0].args.includes('k2-fsa/OmniVoice'));
  assert.ok(calls[0].args.includes('--ref-audio'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.ok(calls[0].args.includes('--ref-text'));
  assert.ok(calls[0].args.includes('테스트 기준 음성입니다.'));
  assert.ok(calls[0].args.includes('--speaker'));
  assert.ok(calls[0].args.includes('warm korean male voice'));
  assert.ok(calls[0].args.includes('--text'));
  assert.ok(calls[0].args.includes('옴니보이스 테스트'));
  assert.equal(calls[0].options.timeout, 180000);
  assert.match(out, /^\/tmp\/verbalcoding-omnivoice-/);
  assert.deepEqual(backend.cacheKeyParts(), ['omnivoice', 'k2-fsa/OmniVoice', 'mps', 'float16', '/project/voice-samples/me.wav', '테스트 기준 음성입니다.', 'ko', 'warm korean male voice']);
});

test('OmniVoice progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'omnivoice' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('진행 안내', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('OmniVoice falls back to Edge when Python wrapper fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'omnivoice' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd.includes('.venv-omnivoice')) throw new Error('omnivoice missing');
    },
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd?.includes('.venv-omnivoice')));
  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /omnivoice failed; falling back to edge/i.test(call.warn || '')));
});

test('Qwen3 TTS backend calls audio CLI with qwen3 engine, speaker, language, and output path', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'qwen3tts' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('큐웬 티티에스 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, 'audio');
  assert.deepEqual(calls[0].args.slice(0, 5), ['speak', '큐웬 티티에스 테스트', '--engine', 'qwen3', '--output']);
  assert.ok(calls[0].args.includes('--language'));
  assert.ok(calls[0].args.includes('korean'));
  assert.ok(calls[0].args.includes('--stream'));
  assert.ok(calls[0].args.includes('--model'));
  assert.ok(calls[0].args.includes('customVoice'));
  assert.ok(calls[0].args.includes('--speaker'));
  assert.ok(calls[0].args.includes('sohee'));
  assert.ok(calls[0].args.includes('--instruct'));
  assert.ok(calls[0].args.includes('calm conversational Korean'));
  assert.equal(calls[0].options.timeout, 120000);
  assert.match(out, /^\/tmp\/verbalcoding-qwen3tts-/);
  assert.deepEqual(backend.cacheKeyParts(), ['qwen3tts', 'audio', 'custom', 'korean', 'sohee', 'calm conversational Korean', '/project/voice-samples/me.wav', '테스트 기준 음성입니다.']);
});

test('Qwen3 TTS clone mode passes reference audio', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'qwen3tts', qwen3tts: { ...baseSettings().qwen3tts, mode: 'clone' } };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('복제 음성 테스트', { kind: 'final' });

  assert.ok(calls[0].args.includes('--model'));
  assert.ok(calls[0].args.includes('base'));
  assert.ok(calls[0].args.includes('--voice-sample'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.equal(calls[0].args.includes('--speaker'), false);
});

test('Qwen3 TTS progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'qwen3tts' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('진행 안내', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('Qwen3 TTS falls back to Edge when local CLI fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'qwen3tts' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === 'audio') throw new Error('qwen3 tts missing');
    },
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd === 'audio'));
  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /qwen3tts failed; falling back to edge/i.test(call.warn || '')));
});

test('FireRedTTS-2 backend calls configured CLI with model, prompt, and output path', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'fireredtts2' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('파이어레드 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, 'fireredtts2');
  assert.deepEqual(calls[0].args.slice(0, 4), ['--text', '파이어레드 테스트', '--output', calls[0].args[3]]);
  assert.ok(calls[0].args.includes('--pretrained-dir'));
  assert.ok(calls[0].args.includes('/project/models/FireRedTTS2'));
  assert.ok(calls[0].args.includes('--prompt-audio'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.ok(calls[0].args.includes('--bf16'));
  assert.equal(calls[0].options.timeout, 180000);
  assert.match(out, /^\/tmp\/verbalcoding-fireredtts2-/);
  assert.deepEqual(backend.cacheKeyParts(), ['fireredtts2', 'fireredtts2', '/project/models/FireRedTTS2', 'mps', 'monologue', 'S1', '/project/voice-samples/me.wav', '테스트 기준 음성입니다.', true]);
});

test('FireRedTTS-2 progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'fireredtts2' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('진행 안내', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('MOSS-TTS-Nano backend calls infer.py with checkpoint, prompt, and output path', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'mossttsnano' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('모스 나노 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, 'python3');
  assert.deepEqual(calls[0].args.slice(0, 5), ['/project/vendor/MOSS-TTS-Nano/infer.py', '--text', '모스 나노 테스트', '--output-audio-path', calls[0].args[4]]);
  assert.ok(calls[0].args.includes('--checkpoint'));
  assert.ok(calls[0].args.includes('OpenMOSS-Team/MOSS-TTS-Nano'));
  assert.ok(calls[0].args.includes('--audio-tokenizer-pretrained-name-or-path'));
  assert.ok(calls[0].args.includes('--prompt-audio-path'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.ok(calls[0].args.includes('--max-new-frames'));
  assert.ok(calls[0].args.includes('256'));
  assert.equal(calls[0].options.timeout, 120000);
  assert.match(out, /^\/tmp\/verbalcoding-mossttsnano-/);
  assert.deepEqual(backend.cacheKeyParts(), ['mossttsnano', 'python3', '/project/vendor/MOSS-TTS-Nano/infer.py', 'OpenMOSS-Team/MOSS-TTS-Nano', 'OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano', 'voice_clone', 'ko', 'cpu', 'float32', '/project/voice-samples/me.wav', '테스트 기준 음성입니다.', 256, '7']);
});

test('MOSS-TTS-Nano falls back to Edge when local CLI fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'mossttsnano' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === 'python3') throw new Error('moss missing');
    },
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd === 'python3'));
  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /mossttsnano failed; falling back to edge/i.test(call.warn || '')));
});

test('MOSS-TTS-Nano MLX hybrid backend calls experimental synth wrapper', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'mossttsnano_mlx' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('모스 엠엘엑스 테스트', { kind: 'final' });

  assert.equal(calls[0].cmd, 'python3');
  assert.deepEqual(calls[0].args.slice(0, 5), ['/project/integrations/mossttsnano_mlx/synth.py', '--text', '모스 엠엘엑스 테스트', '--output-audio-path', calls[0].args[4]]);
  assert.ok(calls[0].args.includes('--torch-infer-script'));
  assert.ok(calls[0].args.includes('/project/vendor/MOSS-TTS-Nano/infer.py'));
  assert.ok(calls[0].args.includes('--torch-device'));
  assert.ok(calls[0].args.includes('cpu'));
  assert.ok(calls[0].args.includes('--torch-dtype'));
  assert.ok(calls[0].args.includes('float32'));
  assert.ok(calls[0].args.includes('--prompt-audio-path'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.equal(calls[0].options.timeout, 180000);
  assert.match(out, /^\/tmp\/verbalcoding-mossttsnano-mlx-/);
  assert.deepEqual(backend.cacheKeyParts(), ['mossttsnano_mlx', 'python3', '/project/integrations/mossttsnano_mlx/synth.py', '/project/vendor/MOSS-TTS-Nano/infer.py', 'OpenMOSS-Team/MOSS-TTS-Nano', 'OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano', 'voice_clone', 'ko', 'cpu', 'float32', '/project/voice-samples/me.wav', '테스트 기준 음성입니다.', 120, '7']);
});

test('MOSS-TTS-Nano MLX progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'mossttsnano_mlx' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('진행 안내', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('NeuTTS Air backend calls Python wrapper with GGUF backbone, reference sample, and output path', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'neuttsair' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 999 }),
    execFileAsync: async (cmd, args, options) => calls.push({ cmd, args, options }),
  });

  const out = await backend.synthesize('NeuTTS Air test', { kind: 'final' });

  assert.equal(calls[0].cmd, '/project/.venv-neuttsair/bin/python');
  assert.deepEqual(calls[0].args.slice(0, 5), ['/project/integrations/neuttsair/synth.py', '--text', 'NeuTTS Air test', '--output', calls[0].args[4]]);
  assert.ok(calls[0].args.includes('--backbone-repo'));
  assert.ok(calls[0].args.includes('neuphonic/neutts-air-q4-gguf'));
  assert.ok(calls[0].args.includes('--backbone-device'));
  assert.ok(calls[0].args.includes('mps'));
  assert.ok(calls[0].args.includes('--codec-repo'));
  assert.ok(calls[0].args.includes('neuphonic/neucodec'));
  assert.ok(calls[0].args.includes('--codec-device'));
  assert.ok(calls[0].args.includes('--ref-audio'));
  assert.ok(calls[0].args.includes('/project/voice-samples/me.wav'));
  assert.ok(calls[0].args.includes('--ref-text'));
  assert.ok(calls[0].args.includes('Reference voice text.'));
  assert.ok(calls[0].args.includes('--language'));
  assert.ok(calls[0].args.includes('en'));
  assert.equal(calls[0].options.timeout, 120000);
  assert.match(out, /^\/tmp\/verbalcoding-neuttsair-/);
  assert.deepEqual(backend.cacheKeyParts(), ['neuttsair', '/project/.venv-neuttsair/bin/python', '/project/integrations/neuttsair/synth.py', 'neuphonic/neutts-air-q4-gguf', 'mps', 'neuphonic/neucodec', 'mps', '/project/voice-samples/me.wav', 'Reference voice text.', 'en', 24000]);
});

test('NeuTTS Air progress uses Edge fallback unless explicitly enabled', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'neuttsair' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    execFileAsync: async (cmd, args) => calls.push({ cmd, args }),
  });

  await backend.synthesize('진행 안내', { kind: 'progress' });

  assert.equal(calls[0].cmd, 'edge-tts');
});

test('NeuTTS Air falls back to Edge when Python wrapper fails', async () => {
  const calls = [];
  const settings = { ...baseSettings(), backend: 'neuttsair' };
  const backend = createTtsBackend(settings, {
    tmpdir: '/tmp',
    existsSync: () => true,
    statSync: () => ({ size: 123 }),
    warn: (...args) => calls.push({ warn: args.join(' ') }),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd.includes('.venv-neuttsair')) throw new Error('neutts missing');
    },
  });

  await backend.synthesize('fallback', { kind: 'final' });

  assert.ok(calls.some(call => call.cmd?.includes('.venv-neuttsair')));
  assert.ok(calls.some(call => call.cmd === 'edge-tts'));
  assert.ok(calls.some(call => /neuttsair failed; falling back to edge/i.test(call.warn || '')));
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
