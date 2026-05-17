import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function uniquePath(tmpdir, prefix, ext) {
  return path.join(tmpdir, `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`);
}

function validateOutput(file, fsApi) {
  if (!fsApi.existsSync(file) || fsApi.statSync(file).size <= 0) {
    throw new Error(`TTS backend produced empty output: ${file}`);
  }
  return file;
}

function execOptions(base, signal) {
  return signal ? { ...base, signal } : base;
}

function openVoicePython(openvoice, existsSync = fs.existsSync) {
  const venvPython = path.join(openvoice.venv, 'bin', 'python');
  if (existsSync(venvPython)) return venvPython;
  return 'python3';
}

function speechSwiftArgs(text, out, speechswift) {
  const args = ['speak', text, '--engine', speechswift.engine, '--output', out];
  if (speechswift.language) args.push('--language', speechswift.language);
  if (speechswift.stream) args.push('--stream');
  if (speechswift.refAudio) args.push('--voice-sample', speechswift.refAudio);
  if (speechswift.engine === 'cosyvoice' && speechswift.modelId) args.push('--model-id', speechswift.modelId);
  if (speechswift.engine === 'qwen3') {
    if (speechswift.model) args.push('--model', speechswift.model);
    if (speechswift.speaker) args.push('--speaker', speechswift.speaker);
    if (speechswift.instruct) args.push('--instruct', speechswift.instruct);
  }
  return args;
}

function supertonicArgs(text, out, supertonic) {
  const args = ['tts', text, '-o', out, '--lang', supertonic.language];
  if (supertonic.customStylePath) args.push('--custom-style-path', supertonic.customStylePath);
  else if (supertonic.voice) args.push('--voice', supertonic.voice);
  if (supertonic.steps) args.push('--steps', String(supertonic.steps));
  if (supertonic.speed) args.push('--speed', String(supertonic.speed));
  if (supertonic.maxChunkLength) args.push('--max-chunk-length', String(supertonic.maxChunkLength));
  if (supertonic.silenceDuration != null) args.push('--silence-duration', String(supertonic.silenceDuration));
  return args;
}

function supertonicEnv(baseEnv, supertonic) {
  const env = { ...baseEnv };
  if (supertonic.cacheDir) env.SUPERTONIC_CACHE_DIR = supertonic.cacheDir;
  if (supertonic.intraOpThreads) env.SUPERTONIC_INTRA_OP_THREADS = String(supertonic.intraOpThreads);
  if (supertonic.interOpThreads) env.SUPERTONIC_INTER_OP_THREADS = String(supertonic.interOpThreads);
  return env;
}

function omniVoiceArgs(text, out, omnivoice) {
  const args = [
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'integrations', 'omnivoice', 'synth.py'),
    '--text', text,
    '--output', out,
    '--model', omnivoice.model,
    '--device', omnivoice.device,
    '--dtype', omnivoice.dtype,
  ];
  if (omnivoice.refAudio) args.push('--ref-audio', omnivoice.refAudio);
  if (omnivoice.refText) args.push('--ref-text', omnivoice.refText);
  if (omnivoice.language) args.push('--language', omnivoice.language);
  if (omnivoice.speaker) args.push('--speaker', omnivoice.speaker);
  return args;
}

function qwen3TtsArgs(text, out, qwen3tts) {
  const args = ['speak', text, '--engine', 'qwen3', '--output', out];
  if (qwen3tts.language) args.push('--language', qwen3tts.language);
  if (qwen3tts.stream) args.push('--stream');
  if (qwen3tts.mode === 'clone') {
    args.push('--model', qwen3tts.model || 'base');
    if (qwen3tts.refAudio) args.push('--voice-sample', qwen3tts.refAudio);
  } else if (qwen3tts.mode === 'design') {
    args.push('--model', qwen3tts.model || 'customVoice');
    if (qwen3tts.instruct) args.push('--instruct', qwen3tts.instruct);
  } else {
    args.push('--model', qwen3tts.model || 'customVoice');
    if (qwen3tts.speaker) args.push('--speaker', qwen3tts.speaker);
    if (qwen3tts.instruct) args.push('--instruct', qwen3tts.instruct);
  }
  return args;
}

function mlxAudioArgs(text, out, mlxaudio) {
  const args = [
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'integrations', 'mlxaudio', 'synth.py'),
    '--text', text,
    '--output', out,
    '--model', mlxaudio.model,
    '--voice', mlxaudio.voice,
  ];
  if (mlxaudio.langCode) args.push('--lang-code', mlxaudio.langCode);
  if (mlxaudio.stream) args.push('--stream');
  return args;
}

function neuTtsAirArgs(text, out, neuttsair) {
  const args = [
    neuttsair.script,
    '--text', text,
    '--output', out,
    '--backbone-repo', neuttsair.backboneRepo,
    '--codec-repo', neuttsair.codecRepo,
    '--backbone-device', neuttsair.backboneDevice,
    '--codec-device', neuttsair.codecDevice,
    '--ref-audio', neuttsair.refAudio,
    '--language', neuttsair.language,
    '--sample-rate', String(neuttsair.sampleRate),
  ];
  if (neuttsair.refText) args.push('--ref-text', neuttsair.refText);
  if (neuttsair.refTextFile) args.push('--ref-text-file', neuttsair.refTextFile);
  if (neuttsair.cacheRef) args.push('--cache-ref');
  return args;
}

function fireRedTts2Args(text, out, fireredtts2) {
  const args = ['--text', text, '--output', out];
  if (fireredtts2.pretrainedDir) args.push('--pretrained-dir', fireredtts2.pretrainedDir);
  if (fireredtts2.device) args.push('--device', fireredtts2.device);
  if (fireredtts2.genType) args.push('--gen-type', fireredtts2.genType);
  if (fireredtts2.speaker) args.push('--speaker', fireredtts2.speaker);
  if (fireredtts2.promptAudio) args.push('--prompt-audio', fireredtts2.promptAudio);
  if (fireredtts2.promptText) args.push('--prompt-text', fireredtts2.promptText);
  if (fireredtts2.useBf16) args.push('--bf16');
  return args;
}

function mossTtsNanoArgs(text, out, mossttsnano) {
  const args = [mossttsnano.script || 'infer.py', '--text', text, '--output-audio-path', out];
  if (mossttsnano.checkpoint) args.push('--checkpoint', mossttsnano.checkpoint);
  if (mossttsnano.audioTokenizer) args.push('--audio-tokenizer-pretrained-name-or-path', mossttsnano.audioTokenizer);
  if (mossttsnano.mode) args.push('--mode', mossttsnano.mode);
  if (mossttsnano.device) args.push('--device', mossttsnano.device);
  if (mossttsnano.dtype) args.push('--dtype', mossttsnano.dtype);
  if (mossttsnano.promptAudio) args.push('--prompt-audio-path', mossttsnano.promptAudio);
  if (mossttsnano.promptText) args.push('--prompt-text', mossttsnano.promptText);
  if (mossttsnano.maxNewFrames) args.push('--max-new-frames', String(mossttsnano.maxNewFrames));
  if (mossttsnano.seed) args.push('--seed', String(mossttsnano.seed));
  if (mossttsnano.disableWetext !== false) args.push('--disable-wetext-processing');
  return args;
}

async function speechSwiftServerRequest({ fetchImpl, speechswift, text, signal }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), speechswift.timeoutMs);
  const abortFromCaller = () => controller.abort(signal.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener?.('abort', abortFromCaller, { once: true });
  try {
    const response = await fetchImpl(`${speechswift.serverUrl}/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        engine: speechswift.engine,
        language: speechswift.language,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
      throw new Error(`audio-server /speak failed ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', abortFromCaller);
  }
}

export function createEdgeTtsBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const tmpdir = deps.tmpdir || os.tmpdir();
  const edge = settings.edge || {};
  const voiceProvider = deps.voiceProvider || (() => edge.voice);
  const currentVoice = () => voiceProvider() || edge.voice;
  const edgeCommand = edge.command || 'edge-tts';
  return {
    name: 'edge',
    outputExtension: 'mp3',
    cacheKeyParts() {
      return ['edge', currentVoice(), edge.rate];
    },
    async synthesize(text, { signal } = {}) {
      const out = uniquePath(tmpdir, 'verbalcoding-edge', 'mp3');
      await execFileAsync(edgeCommand, ['-v', currentVoice(), '--rate', edge.rate, '-t', text, '--write-media', out], execOptions({
        timeout: 60000,
        maxBuffer: 2 * 1024 * 1024,
      }, signal));
      return validateOutput(out, fsApi);
    },
  };
}

export function createOpenVoiceBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const openvoice = settings.openvoice;
  return {
    name: 'openvoice',
    outputExtension: openvoice.useForProgress ? 'wav' : 'mp3',
    cacheKeyParts() {
      return ['openvoice', openvoice.refAudio, openvoice.language, openvoice.style];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !openvoice.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-openvoice', 'wav');
      const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'integrations', 'openvoice', 'synth.py');
      const args = [
        script,
        '--openvoice-dir', openvoice.dir,
        '--ref-audio', openvoice.refAudio,
        '--text', text,
        '--language', openvoice.language,
        '--style', openvoice.style,
        '--output', out,
      ];
      try {
        await execFileAsync(openVoicePython(openvoice, fsApi.existsSync), args, execOptions({
          timeout: openvoice.timeoutMs,
          maxBuffer: 2 * 1024 * 1024,
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('openvoice failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createSpeechSwiftBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const fetchImpl = deps.fetch || globalThis.fetch;
  const writeFileAsync = deps.writeFileAsync || fs.promises.writeFile;
  const edge = createEdgeTtsBackend(settings, deps);
  const speechswift = settings.speechswift;
  return {
    name: 'speechswift',
    outputExtension: speechswift.useForProgress ? 'wav' : 'mp3',
    cacheKeyParts() {
      return ['speechswift', speechswift.mode, speechswift.serverUrl, speechswift.engine, speechswift.refAudio, speechswift.language, speechswift.modelId, speechswift.model, speechswift.speaker, speechswift.instruct];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !speechswift.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, speechswift.mode === 'server' ? 'verbalcoding-speechswift-server' : 'verbalcoding-speechswift', 'wav');
      try {
        if (speechswift.mode === 'server') {
          if (!fetchImpl) throw new Error('fetch is not available for speech-swift server mode');
          const wavBytes = await speechSwiftServerRequest({ fetchImpl, speechswift, text, signal });
          await writeFileAsync(out, wavBytes);
        } else {
          if (!execFileAsync) throw new Error('execFileAsync dependency is required');
          await execFileAsync(speechswift.command, speechSwiftArgs(text, out, speechswift), execOptions({
            timeout: speechswift.timeoutMs,
            maxBuffer: 4 * 1024 * 1024,
          }, signal));
        }
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('speech-swift failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createSupertonicBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const supertonic = settings.supertonic;
  return {
    name: 'supertonic',
    outputExtension: supertonic.useForProgress ? 'wav' : 'mp3',
    cacheKeyParts() {
      return ['supertonic', supertonic.command, supertonic.voice, supertonic.language, supertonic.steps, supertonic.speed, supertonic.maxChunkLength, supertonic.silenceDuration, supertonic.customStylePath];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !supertonic.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-supertonic', 'wav');
      try {
        await execFileAsync(supertonic.command, supertonicArgs(text, out, supertonic), execOptions({
          timeout: supertonic.timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
          env: supertonicEnv(process.env, supertonic),
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('supertonic failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createOmniVoiceBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const omnivoice = settings.omnivoice;
  return {
    name: 'omnivoice',
    outputExtension: omnivoice.useForProgress ? 'wav' : 'mp3',
    cacheKeyParts() {
      return ['omnivoice', omnivoice.model, omnivoice.device, omnivoice.dtype, omnivoice.refAudio, omnivoice.refText, omnivoice.language, omnivoice.speaker];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !omnivoice.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-omnivoice', 'wav');
      try {
        await execFileAsync(omnivoice.python || 'python3', omniVoiceArgs(text, out, omnivoice), execOptions({
          timeout: omnivoice.timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('omnivoice failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createQwen3TtsBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const qwen3tts = settings.qwen3tts;
  return {
    name: 'qwen3tts',
    outputExtension: qwen3tts.useForProgress ? 'mp3' : 'mp3',
    cacheKeyParts() {
      return ['qwen3tts', qwen3tts.command, qwen3tts.mode, qwen3tts.language, qwen3tts.speaker, qwen3tts.instruct, qwen3tts.refAudio, qwen3tts.refText];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !qwen3tts.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-qwen3tts', 'mp3');
      try {
        await execFileAsync(qwen3tts.command, qwen3TtsArgs(text, out, qwen3tts), execOptions({
          timeout: qwen3tts.timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('qwen3tts failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createMlxAudioBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const mlxaudio = settings.mlxaudio;
  return {
    name: 'mlxaudio',
    outputExtension: mlxaudio.useForProgress ? 'wav' : 'wav',
    cacheKeyParts() {
      return ['mlxaudio', mlxaudio.python, mlxaudio.model, mlxaudio.voice, mlxaudio.langCode, mlxaudio.stream];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !mlxaudio.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-mlxaudio', 'wav');
      try {
        await execFileAsync(mlxaudio.python || 'python3', mlxAudioArgs(text, out, mlxaudio), execOptions({
          timeout: mlxaudio.timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('mlx-audio failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createNeuTtsAirBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const neuttsair = settings.neuttsair;
  return {
    name: 'neuttsair',
    outputExtension: neuttsair.useForProgress ? 'wav' : 'wav',
    cacheKeyParts() {
      return ['neuttsair', neuttsair.python, neuttsair.script, neuttsair.backboneRepo, neuttsair.backboneDevice, neuttsair.codecRepo, neuttsair.codecDevice, neuttsair.refAudio, neuttsair.refText, neuttsair.language, neuttsair.sampleRate];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !neuttsair.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-neuttsair', 'wav');
      try {
        await execFileAsync(neuttsair.python || 'python3', neuTtsAirArgs(text, out, neuttsair), execOptions({
          timeout: neuttsair.timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('neuttsair failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createFireRedTts2Backend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const fireredtts2 = settings.fireredtts2;
  return {
    name: 'fireredtts2',
    outputExtension: fireredtts2.useForProgress ? 'wav' : 'wav',
    cacheKeyParts() {
      return ['fireredtts2', fireredtts2.command, fireredtts2.pretrainedDir, fireredtts2.device, fireredtts2.genType, fireredtts2.speaker, fireredtts2.promptAudio, fireredtts2.promptText, fireredtts2.useBf16];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !fireredtts2.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-fireredtts2', 'wav');
      try {
        await execFileAsync(fireredtts2.command, fireRedTts2Args(text, out, fireredtts2), execOptions({
          timeout: fireredtts2.timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('fireredtts2 failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createMossTtsNanoBackend(settings, deps = {}) {
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const tmpdir = deps.tmpdir || os.tmpdir();
  const warn = deps.warn || (() => {});
  const fsApi = {
    existsSync: deps.existsSync || fs.existsSync,
    statSync: deps.statSync || fs.statSync,
  };
  const edge = createEdgeTtsBackend(settings, deps);
  const mossttsnano = settings.mossttsnano;
  return {
    name: 'mossttsnano',
    outputExtension: mossttsnano.useForProgress ? 'wav' : 'wav',
    cacheKeyParts() {
      return ['mossttsnano', mossttsnano.command, mossttsnano.script, mossttsnano.checkpoint, mossttsnano.audioTokenizer, mossttsnano.mode, mossttsnano.language, mossttsnano.device, mossttsnano.dtype, mossttsnano.promptAudio, mossttsnano.promptText, mossttsnano.maxNewFrames, mossttsnano.seed];
    },
    async synthesize(text, { signal, kind = 'final' } = {}) {
      if (kind === 'progress' && !mossttsnano.useForProgress) {
        return edge.synthesize(text, { signal, kind });
      }
      const out = uniquePath(tmpdir, 'verbalcoding-mossttsnano', 'wav');
      try {
        await execFileAsync(mossttsnano.command, mossTtsNanoArgs(text, out, mossttsnano), execOptions({
          timeout: mossttsnano.timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        }, signal));
        return validateOutput(out, fsApi);
      } catch (error) {
        fs.rm(out, { force: true }, () => {});
        warn('mossttsnano failed; falling back to edge', error?.message || error);
        return edge.synthesize(text, { signal, kind });
      }
    },
  };
}

export function createTtsBackend(settings, deps = {}) {
  if (settings.backend === 'openvoice') return createOpenVoiceBackend(settings, deps);
  if (settings.backend === 'speechswift') return createSpeechSwiftBackend(settings, deps);
  if (settings.backend === 'supertonic') return createSupertonicBackend(settings, deps);
  if (settings.backend === 'omnivoice') return createOmniVoiceBackend(settings, deps);
  if (settings.backend === 'qwen3tts') return createQwen3TtsBackend(settings, deps);
  if (settings.backend === 'mlxaudio') return createMlxAudioBackend(settings, deps);
  if (settings.backend === 'neuttsair') return createNeuTtsAirBackend(settings, deps);
  if (settings.backend === 'fireredtts2') return createFireRedTts2Backend(settings, deps);
  if (settings.backend === 'mossttsnano') return createMossTtsNanoBackend(settings, deps);
  return createEdgeTtsBackend(settings, deps);
}
