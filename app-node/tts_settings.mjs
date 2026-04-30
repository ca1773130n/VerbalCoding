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
  const backend = requestedBackend === 'openvoice' ? 'openvoice' : 'edge';
  return {
    backend,
    maxChars: positiveNumber(env.TTS_MAX_CHARS, 495),
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
  };
}
