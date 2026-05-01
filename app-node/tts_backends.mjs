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

async function speechSwiftServerRequest({ fetchImpl, speechswift, text, signal }) {
  const response = await fetchImpl(`${speechswift.serverUrl}/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      engine: speechswift.engine,
      language: speechswift.language,
    }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const detail = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
    throw new Error(`audio-server /speak failed ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return Buffer.from(await response.arrayBuffer());
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
  return {
    name: 'edge',
    outputExtension: 'mp3',
    cacheKeyParts() {
      return ['edge', edge.voice, edge.rate];
    },
    async synthesize(text, { signal } = {}) {
      const out = uniquePath(tmpdir, 'verbalcoding-edge', 'mp3');
      await execFileAsync('edge-tts', ['-v', edge.voice, '--rate', edge.rate, '-t', text, '--write-media', out], execOptions({
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
      const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'scripts', 'openvoice_synth.py');
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

export function createTtsBackend(settings, deps = {}) {
  if (settings.backend === 'openvoice') return createOpenVoiceBackend(settings, deps);
  if (settings.backend === 'speechswift') return createSpeechSwiftBackend(settings, deps);
  return createEdgeTtsBackend(settings, deps);
}
