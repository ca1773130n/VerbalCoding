import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { buildTtsSettings } from './tts_settings.mjs';

test('buildTtsSettings defaults to Edge TTS with Korean voice', () => {
  const root = '/project';
  const settings = buildTtsSettings({}, root);

  assert.equal(settings.backend, 'edge');
  assert.equal(settings.edge.voice, 'ko-KR-SunHiNeural');
  assert.equal(settings.edge.rate, '+10%');
  assert.equal(settings.maxChars, 495);
  assert.equal(settings.progressCacheDir, path.join(root, '.cache', 'progress-tts'));
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

test('buildTtsSettings falls back to edge for unsupported backend', () => {
  const settings = buildTtsSettings({ TTS_BACKEND: 'unknown' }, '/project');
  assert.equal(settings.backend, 'edge');
});
