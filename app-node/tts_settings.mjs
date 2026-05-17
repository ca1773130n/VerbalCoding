import path from 'node:path';

export const SUPPORTED_TTS_BACKENDS = [
  'edge',
  'openvoice',
  'speechswift',
  'supertonic',
  'omnivoice',
  'qwen3tts',
  'mlxaudio',
  'fireredtts2',
  'mossttsnano',
  'neuttsair',
];

export const TTS_BACKEND_ALIASES = new Map([
  ['q3', 'qwen3tts'],
  ['qwen3', 'qwen3tts'],
  ['qwen3-tts', 'qwen3tts'],
  ['qtts', 'qwen3tts'],
  ['mlx', 'mlxaudio'],
  ['mlx-audio', 'mlxaudio'],
  ['qwen3-mlx', 'mlxaudio'],
  ['neutts', 'neuttsair'],
  ['neutts-air', 'neuttsair'],
  ['neutts air', 'neuttsair'],
  ['neuttsair', 'neuttsair'],
  ['neu-tts-air', 'neuttsair'],
  ['neu tts air', 'neuttsair'],
  ['neutts-air-backend', 'neuttsair'],
  ['firered', 'fireredtts2'],
  ['fireredtts', 'fireredtts2'],
  ['firered-tts-2', 'fireredtts2'],
  ['fireredtts-2', 'fireredtts2'],
  ['moss', 'mossttsnano'],
  ['moss-tts', 'mossttsnano'],
  ['mossnano', 'mossttsnano'],
  ['moss-tts-nano', 'mossttsnano'],
  ['openmoss', 'mossttsnano'],
]);

export function normalizeTtsBackendName(value, fallback = 'edge') {
  const requested = String(value || '').trim().toLowerCase();
  const normalized = TTS_BACKEND_ALIASES.get(requested) || requested;
  return SUPPORTED_TTS_BACKENDS.includes(normalized) ? normalized : fallback;
}

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
  const backend = normalizeTtsBackendName(env.TTS_BACKEND || 'edge');
  return {
    backend,
    maxChars: positiveNumber(env.TTS_MAX_CHARS, 495),
    volume: positiveNumber(env.TTS_VOLUME, 1.0),
    progressCacheDir: resolveUnderRoot(root, env.PROGRESS_TTS_CACHE_DIR, path.join('.cache', 'progress-tts')),
    edge: {
      command: env.EDGE_TTS_COMMAND || env.TTS_EDGE_COMMAND || 'edge-tts',
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
    omnivoice: {
      python: resolveUnderRoot(root, env.OMNIVOICE_PYTHON, path.join('.venv-omnivoice', 'bin', 'python')),
      model: env.OMNIVOICE_MODEL || 'k2-fsa/OmniVoice',
      device: env.OMNIVOICE_DEVICE || 'mps',
      dtype: env.OMNIVOICE_DTYPE || 'float16',
      refAudio: resolveUnderRoot(root, env.OMNIVOICE_REF_AUDIO || env.OPENVOICE_REF_AUDIO, path.join('voice-samples', 'user-reference.wav')),
      refText: env.OMNIVOICE_REF_TEXT || '',
      language: env.OMNIVOICE_LANGUAGE || env.VOICE_LANGUAGE || 'ko',
      speaker: env.OMNIVOICE_SPEAKER || '',
      timeoutMs: positiveNumber(env.OMNIVOICE_TIMEOUT_MS, 180000),
      useForProgress: boolEnv(env.OMNIVOICE_PROGRESS, false),
    },
    qwen3tts: {
      command: env.QWEN3TTS_COMMAND || env.QTTS_COMMAND || 'audio',
      mode: env.QWEN3TTS_MODE || 'custom',
      model: env.QWEN3TTS_MODEL || '',
      language: env.QWEN3TTS_LANGUAGE || env.VOICE_LANGUAGE || 'korean',
      speaker: env.QWEN3TTS_SPEAKER || 'sohee',
      instruct: env.QWEN3TTS_INSTRUCT || '',
      refAudio: env.QWEN3TTS_REF_AUDIO ? resolveUnderRoot(root, env.QWEN3TTS_REF_AUDIO, '') : '',
      refText: env.QWEN3TTS_REF_TEXT || '',
      stream: boolEnv(env.QWEN3TTS_STREAM, true),
      timeoutMs: positiveNumber(env.QWEN3TTS_TIMEOUT_MS, 120000),
      useForProgress: boolEnv(env.QWEN3TTS_PROGRESS, false),
    },
    mlxaudio: {
      python: resolveUnderRoot(root, env.MLXAUDIO_PYTHON, path.join('.venv-mlxaudio', 'bin', 'python')),
      model: env.MLXAUDIO_MODEL || 'mlx-community/Qwen3-TTS-12Hz-1.7B-Base-8bit',
      voice: env.MLXAUDIO_VOICE || 'Chelsie',
      langCode: env.MLXAUDIO_LANG_CODE || env.VOICE_LANGUAGE || 'ko',
      stream: boolEnv(env.MLXAUDIO_STREAM, false),
      timeoutMs: positiveNumber(env.MLXAUDIO_TIMEOUT_MS, 180000),
      useForProgress: boolEnv(env.MLXAUDIO_PROGRESS, false),
    },
    neuttsair: {
      python: resolveUnderRoot(root, env.NEUTTSAIR_PYTHON || env.NEUTTS_AIR_PYTHON, path.join('.venv-neuttsair', 'bin', 'python')),
      script: resolveUnderRoot(root, env.NEUTTSAIR_SCRIPT || env.NEUTTS_AIR_SCRIPT, path.join('integrations', 'neuttsair', 'synth.py')),
      backboneRepo: env.NEUTTSAIR_BACKBONE_REPO || env.NEUTTS_AIR_BACKBONE_REPO || env.NEUTTSAIR_BACKBONE || 'neuphonic/neutts-air-q4-gguf',
      backboneDevice: env.NEUTTSAIR_BACKBONE_DEVICE || env.NEUTTS_AIR_BACKBONE_DEVICE || env.NEUTTSAIR_DEVICE || 'mps',
      codecRepo: env.NEUTTSAIR_CODEC_REPO || env.NEUTTS_AIR_CODEC_REPO || env.NEUTTSAIR_CODEC || 'neuphonic/neucodec',
      codecDevice: env.NEUTTSAIR_CODEC_DEVICE || env.NEUTTS_AIR_CODEC_DEVICE || env.NEUTTSAIR_DEVICE || 'mps',
      refAudio: resolveUnderRoot(root, env.NEUTTSAIR_REF_AUDIO || env.NEUTTS_AIR_REF_AUDIO || env.OPENVOICE_REF_AUDIO, path.join('voice-samples', 'user-reference.wav')),
      refText: env.NEUTTSAIR_REF_TEXT || env.NEUTTS_AIR_REF_TEXT || '',
      refTextFile: (env.NEUTTSAIR_REF_TEXT_FILE || env.NEUTTS_AIR_REF_TEXT_FILE) ? resolveUnderRoot(root, env.NEUTTSAIR_REF_TEXT_FILE || env.NEUTTS_AIR_REF_TEXT_FILE, '') : '',
      language: env.NEUTTSAIR_LANGUAGE || env.NEUTTS_AIR_LANGUAGE || env.VOICE_LANGUAGE || 'en',
      sampleRate: positiveNumber(env.NEUTTSAIR_SAMPLE_RATE || env.NEUTTS_AIR_SAMPLE_RATE, 24000),
      cacheRef: boolEnv(env.NEUTTSAIR_CACHE_REF || env.NEUTTS_AIR_CACHE_REF, true),
      timeoutMs: positiveNumber(env.NEUTTSAIR_TIMEOUT_MS || env.NEUTTS_AIR_TIMEOUT_MS, 120000),
      useForProgress: boolEnv(env.NEUTTSAIR_PROGRESS || env.NEUTTS_AIR_PROGRESS, false),
    },
    fireredtts2: {
      command: env.FIREREDTTS2_COMMAND || './.local/bin/fireredtts2',
      pretrainedDir: resolveUnderRoot(root, env.FIREREDTTS2_PRETRAINED_DIR, path.join('pretrained_models', 'FireRedTTS2')),
      device: env.FIREREDTTS2_DEVICE || 'auto',
      genType: env.FIREREDTTS2_GEN_TYPE || 'monologue',
      speaker: env.FIREREDTTS2_SPEAKER || 'S1',
      promptAudio: env.FIREREDTTS2_PROMPT_AUDIO ? resolveUnderRoot(root, env.FIREREDTTS2_PROMPT_AUDIO, '') : '',
      promptText: env.FIREREDTTS2_PROMPT_TEXT || '',
      useBf16: boolEnv(env.FIREREDTTS2_BF16, false),
      timeoutMs: positiveNumber(env.FIREREDTTS2_TIMEOUT_MS, 180000),
      useForProgress: boolEnv(env.FIREREDTTS2_PROGRESS, false),
    },
    mossttsnano: {
      command: env.MOSSTTSNANO_COMMAND || './.venv-mossttsnano/bin/python',
      script: resolveUnderRoot(root, env.MOSSTTSNANO_SCRIPT, path.join('vendor', 'MOSS-TTS-Nano', 'infer.py')),
      checkpoint: env.MOSSTTSNANO_CHECKPOINT || env.MOSS_TTS_NANO_CHECKPOINT || 'OpenMOSS-Team/MOSS-TTS-Nano',
      audioTokenizer: env.MOSSTTSNANO_AUDIO_TOKENIZER || env.MOSS_TTS_NANO_AUDIO_TOKENIZER || '',
      mode: env.MOSSTTSNANO_MODE || 'continuation',
      language: env.MOSSTTSNANO_LANGUAGE || env.VOICE_LANGUAGE || 'ko',
      device: env.MOSSTTSNANO_DEVICE || 'auto',
      dtype: env.MOSSTTSNANO_DTYPE || 'auto',
      promptAudio: env.MOSSTTSNANO_PROMPT_AUDIO ? resolveUnderRoot(root, env.MOSSTTSNANO_PROMPT_AUDIO, '') : '',
      promptText: env.MOSSTTSNANO_PROMPT_TEXT || '',
      maxNewFrames: positiveNumber(env.MOSSTTSNANO_MAX_NEW_FRAMES, 375),
      seed: env.MOSSTTSNANO_SEED || '',
      timeoutMs: positiveNumber(env.MOSSTTSNANO_TIMEOUT_MS, 120000),
      useForProgress: boolEnv(env.MOSSTTSNANO_PROGRESS, false),
    },
  };
}
