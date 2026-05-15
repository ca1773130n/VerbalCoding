import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { buildTtsSettings } from './tts_settings.mjs';

test('buildTtsSettings defaults to Edge TTS with Korean voice', () => {
  const root = '/project';
  const settings = buildTtsSettings({}, root);

  assert.equal(settings.backend, 'edge');
  assert.equal(settings.edge.command, 'edge-tts');
  assert.equal(settings.edge.voice, 'ko-KR-SunHiNeural');
  assert.equal(settings.edge.rate, '+10%');
  assert.equal(settings.maxChars, 495);
  assert.equal(settings.volume, 1.0);
  assert.equal(settings.progressCacheDir, path.join(root, '.cache', 'progress-tts'));
});

test('buildTtsSettings allows explicit Edge TTS command path', () => {
  const root = '/project';
  const settings = buildTtsSettings({ EDGE_TTS_COMMAND: '/project/.venv/bin/edge-tts' }, root);

  assert.equal(settings.edge.command, '/project/.venv/bin/edge-tts');
});

test('buildTtsSettings normalizes OpenVoice settings and keeps Edge fallback', () => {
  const root = '/project';
  const settings = buildTtsSettings({
    TTS_BACKEND: 'openvoice',
    TTS_VOICE: 'ko-KR-InJoonNeural',
    TTS_RATE: '+5%',
    OPENVOICE_DIR: './vendor/OpenVoice',
    OPENVOICE_VENV: './.venv-openvoice',
    OPENVOICE_REF_AUDIO: './voice-samples/me.wav',
    OPENVOICE_LANGUAGE: 'KR',
    OPENVOICE_STYLE: 'cheerful',
    OPENVOICE_TIMEOUT_MS: '12345',
    OPENVOICE_PROGRESS: '1',
    TTS_MAX_CHARS: '333',
    PROGRESS_TTS_CACHE_DIR: './.cache/progress',
  }, root);

  assert.equal(settings.backend, 'openvoice');
  assert.equal(settings.edge.voice, 'ko-KR-InJoonNeural');
  assert.equal(settings.edge.rate, '+5%');
  assert.equal(settings.maxChars, 333);
  assert.equal(settings.progressCacheDir, path.join(root, '.cache', 'progress'));
  assert.equal(settings.openvoice.dir, path.join(root, 'vendor', 'OpenVoice'));
  assert.equal(settings.openvoice.venv, path.join(root, '.venv-openvoice'));
  assert.equal(settings.openvoice.refAudio, path.join(root, 'voice-samples', 'me.wav'));
  assert.equal(settings.openvoice.language, 'KR');
  assert.equal(settings.openvoice.style, 'cheerful');
  assert.equal(settings.openvoice.timeoutMs, 12345);
  assert.equal(settings.openvoice.useForProgress, true);
});

test('buildTtsSettings normalizes speech-swift CosyVoice settings', () => {
  const root = '/project';
  const settings = buildTtsSettings({
    TTS_BACKEND: 'speechswift',
    SPEECHSWIFT_COMMAND: 'audio',
    SPEECHSWIFT_ENGINE: 'cosyvoice',
    SPEECHSWIFT_LANGUAGE: 'korean',
    SPEECHSWIFT_REF_AUDIO: './voice-samples/me.wav',
    SPEECHSWIFT_MODEL_ID: 'aufklarer/CosyVoice3-0.5B-MLX-4bit',
    SPEECHSWIFT_TIMEOUT_MS: '120000',
    SPEECHSWIFT_STREAM: '1',
    SPEECHSWIFT_PROGRESS: '0',
    SPEECHSWIFT_MODE: 'server',
    SPEECHSWIFT_SERVER_URL: 'http://127.0.0.1:18080/',
  }, root);

  assert.equal(settings.backend, 'speechswift');
  assert.equal(settings.speechswift.command, 'audio');
  assert.equal(settings.speechswift.engine, 'cosyvoice');
  assert.equal(settings.speechswift.language, 'korean');
  assert.equal(settings.speechswift.refAudio, path.join(root, 'voice-samples', 'me.wav'));
  assert.equal(settings.speechswift.modelId, 'aufklarer/CosyVoice3-0.5B-MLX-4bit');
  assert.equal(settings.speechswift.timeoutMs, 120000);
  assert.equal(settings.speechswift.stream, true);
  assert.equal(settings.speechswift.useForProgress, false);
  assert.equal(settings.speechswift.mode, 'server');
  assert.equal(settings.speechswift.serverUrl, 'http://127.0.0.1:18080');
});

test('buildTtsSettings normalizes Supertonic local backend settings', () => {
  const root = '/project';
  const settings = buildTtsSettings({
    TTS_BACKEND: 'supertonic',
    SUPERTONIC_COMMAND: './.venv-supertonic/bin/supertonic',
    SUPERTONIC_VOICE: 'M4',
    SUPERTONIC_LANGUAGE: 'ko',
    SUPERTONIC_STEPS: '3',
    SUPERTONIC_SPEED: '1.15',
    SUPERTONIC_MAX_CHUNK_LENGTH: '240',
    SUPERTONIC_SILENCE_DURATION: '0.1',
    SUPERTONIC_CUSTOM_STYLE_PATH: './voice-styles/custom.json',
    SUPERTONIC_TIMEOUT_MS: '45000',
    SUPERTONIC_PROGRESS: '1',
    SUPERTONIC_CACHE_DIR: './.cache/supertonic',
    SUPERTONIC_INTRA_OP_THREADS: '4',
    SUPERTONIC_INTER_OP_THREADS: '1',
    TTS_VOLUME: '1.6',
  }, root);

  assert.equal(settings.backend, 'supertonic');
  assert.equal(settings.volume, 1.6);
  assert.equal(settings.supertonic.command, './.venv-supertonic/bin/supertonic');
  assert.equal(settings.supertonic.voice, 'M4');
  assert.equal(settings.supertonic.language, 'ko');
  assert.equal(settings.supertonic.steps, 3);
  assert.equal(settings.supertonic.speed, 1.15);
  assert.equal(settings.supertonic.maxChunkLength, 240);
  assert.equal(settings.supertonic.silenceDuration, 0.1);
  assert.equal(settings.supertonic.customStylePath, path.join(root, 'voice-styles', 'custom.json'));
  assert.equal(settings.supertonic.timeoutMs, 45000);
  assert.equal(settings.supertonic.useForProgress, true);
  assert.equal(settings.supertonic.cacheDir, path.join(root, '.cache', 'supertonic'));
  assert.equal(settings.supertonic.intraOpThreads, '4');
  assert.equal(settings.supertonic.interOpThreads, '1');
});

test('buildTtsSettings normalizes OmniVoice local backend settings', () => {
  const root = '/project';
  const settings = buildTtsSettings({
    TTS_BACKEND: 'omnivoice',
    OMNIVOICE_PYTHON: './.venv-omnivoice/bin/python',
    OMNIVOICE_MODEL: 'k2-fsa/OmniVoice',
    OMNIVOICE_DEVICE: 'mps',
    OMNIVOICE_DTYPE: 'float16',
    OMNIVOICE_REF_AUDIO: './voice-samples/me.wav',
    OMNIVOICE_REF_TEXT: '테스트 기준 음성입니다.',
    OMNIVOICE_LANGUAGE: 'ko',
    OMNIVOICE_SPEAKER: 'warm korean male voice',
    OMNIVOICE_TIMEOUT_MS: '180000',
    OMNIVOICE_PROGRESS: '1',
  }, root);

  assert.equal(settings.backend, 'omnivoice');
  assert.equal(settings.omnivoice.python, path.join(root, '.venv-omnivoice', 'bin', 'python'));
  assert.equal(settings.omnivoice.model, 'k2-fsa/OmniVoice');
  assert.equal(settings.omnivoice.device, 'mps');
  assert.equal(settings.omnivoice.dtype, 'float16');
  assert.equal(settings.omnivoice.refAudio, path.join(root, 'voice-samples', 'me.wav'));
  assert.equal(settings.omnivoice.refText, '테스트 기준 음성입니다.');
  assert.equal(settings.omnivoice.language, 'ko');
  assert.equal(settings.omnivoice.speaker, 'warm korean male voice');
  assert.equal(settings.omnivoice.timeoutMs, 180000);
  assert.equal(settings.omnivoice.useForProgress, true);
});

test('buildTtsSettings falls back to edge for unsupported backend', () => {
  const settings = buildTtsSettings({ TTS_BACKEND: 'unknown' }, '/project');
  assert.equal(settings.backend, 'edge');
});
