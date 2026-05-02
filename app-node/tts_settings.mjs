import path from 'node:path';

function boolEnv(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveUnderRoot(root, value, fallback) {
  const raw = value == null || value === '' ? fallback : String(value);
  return path.isAbsolute(raw) ? raw : path.join(root, raw);
}

export function buildTtsSettings(env = process.env, root = process.cwd()) {
  const requestedBackend = String(env.TTS_BACKEND || 'edge').trim().toLowerCase();
  const supportedBackends = new Set(['edge', 'openvoice', 'speechswift', 'supertonic']);
  const backend = supportedBackends.has(requestedBackend) ? requestedBackend : 'edge';
  return {
    backend,
    maxChars: positiveNumber(env.TTS_MAX_CHARS, 495),
    volume: positiveNumber(env.TTS_VOLUME, 1.0),
    progressCacheDir: resolveUnderRoot(root, env.PROGRESS_TTS_CACHE_DIR, path.join('.cache', 'progress-tts')),
    edge: {
      voice: env.TTS_VOICE || 'ko-KR-SunHiNeural',
      rate: env.TTS_RATE || '+10%',
    },
    openvoice: {
      dir: resolveUnderRoot(root, env.OPENVOICE_DIR, path.join('vendor', 'OpenVoice')),
      venv: resolveUnderRoot(root, env.OPENVOICE_VENV, '.venv-openvoice'),
      refAudio: resolveUnderRoot(root, env.OPENVOICE_REF_AUDIO, path.join('voice-samples', 'user-reference.wav')),
      language: env.OPENVOICE_LANGUAGE || 'KR',
      style: env.OPENVOICE_STYLE || 'default',
      timeoutMs: positiveNumber(env.OPENVOICE_TIMEOUT_MS, 90000),
      useForProgress: boolEnv(env.OPENVOICE_PROGRESS, false),
    },
    speechswift: {
      command: env.SPEECHSWIFT_COMMAND || 'audio',
      engine: env.SPEECHSWIFT_ENGINE || 'cosyvoice',
      language: env.SPEECHSWIFT_LANGUAGE || 'korean',
      refAudio: resolveUnderRoot(root, env.SPEECHSWIFT_REF_AUDIO || env.OPENVOICE_REF_AUDIO, path.join('voice-samples', 'user-reference.wav')),
      modelId: env.SPEECHSWIFT_MODEL_ID || 'aufklarer/CosyVoice3-0.5B-MLX-4bit',
      model: env.SPEECHSWIFT_MODEL || 'base',
      speaker: env.SPEECHSWIFT_SPEAKER || '',
      instruct: env.SPEECHSWIFT_INSTRUCT || '',
      timeoutMs: positiveNumber(env.SPEECHSWIFT_TIMEOUT_MS, 120000),
      stream: boolEnv(env.SPEECHSWIFT_STREAM, true),
      useForProgress: boolEnv(env.SPEECHSWIFT_PROGRESS, false),
      mode: String(env.SPEECHSWIFT_MODE || 'cli').trim().toLowerCase() === 'server' ? 'server' : 'cli',
      serverUrl: String(env.SPEECHSWIFT_SERVER_URL || 'http://127.0.0.1:18080').replace(/\/+$/, ''),
    },
    supertonic: {
      command: env.SUPERTONIC_COMMAND || 'supertonic',
      voice: env.SUPERTONIC_VOICE || 'M1',
      language: env.SUPERTONIC_LANGUAGE || 'ko',
      steps: positiveNumber(env.SUPERTONIC_STEPS, 2),
      speed: positiveNumber(env.SUPERTONIC_SPEED, 1.08),
      maxChunkLength: positiveNumber(env.SUPERTONIC_MAX_CHUNK_LENGTH, 300),
      silenceDuration: positiveNumber(env.SUPERTONIC_SILENCE_DURATION, 0.15),
      customStylePath: env.SUPERTONIC_CUSTOM_STYLE_PATH ? resolveUnderRoot(root, env.SUPERTONIC_CUSTOM_STYLE_PATH, '') : '',
      timeoutMs: positiveNumber(env.SUPERTONIC_TIMEOUT_MS, 60000),
      useForProgress: boolEnv(env.SUPERTONIC_PROGRESS, false),
      cacheDir: env.SUPERTONIC_CACHE_DIR ? resolveUnderRoot(root, env.SUPERTONIC_CACHE_DIR, '') : '',
      intraOpThreads: env.SUPERTONIC_INTRA_OP_THREADS || '',
      interOpThreads: env.SUPERTONIC_INTER_OP_THREADS || '',
    },
  };
}
