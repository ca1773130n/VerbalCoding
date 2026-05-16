import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  applyTtsVoiceSelectionToEnv,
  defaultTtsVoiceConfig,
  effectiveTtsVoiceSelection,
  preferredVoiceTypeForLanguage,
  readTtsVoiceConfig,
  updateTtsVoiceConfig,
  voiceCommandFromTranscript,
  writeTtsVoiceConfig,
} from './tts_voice_config.mjs';

test('effectiveTtsVoiceSelection reads backend and voice type from config', () => {
  const config = defaultTtsVoiceConfig();
  config.currentBackend = 'edge';
  config.currentVoiceType = 'korean_female';

  const selected = effectiveTtsVoiceSelection(config, {});

  assert.equal(selected.backend, 'edge');
  assert.equal(selected.voiceType, 'korean_female');
  assert.equal(selected.voice.voice, 'ko-KR-SunHiNeural');
});

test('effectiveTtsVoiceSelection falls back to backend voice when env voice type belongs to another backend', () => {
  const config = defaultTtsVoiceConfig();
  config.currentBackend = 'edge';
  config.currentVoiceType = 'korean_male';
  config.backends.edge.currentVoiceType = 'korean_male';

  const selected = effectiveTtsVoiceSelection(config, { TTS_BACKEND: 'edge', TTS_VOICE_TYPE: 'cloned_reference' });

  assert.equal(selected.backend, 'edge');
  assert.equal(selected.voiceType, 'korean_male');
  assert.equal(selected.voice.voice, 'ko-KR-InJoonNeural');
});

test('effectiveTtsVoiceSelection accepts Qwen3 backend aliases from env', () => {
  const selected = effectiveTtsVoiceSelection(defaultTtsVoiceConfig(), { TTS_BACKEND: 'qwen3' });

  assert.equal(selected.backend, 'qwen3tts');
  assert.equal(selected.voiceType, 'korean_preset');
});

test('applyTtsVoiceSelectionToEnv updates backend voice and voice language together', () => {
  const selected = effectiveTtsVoiceSelection(updateTtsVoiceConfig(defaultTtsVoiceConfig(), { voiceType: 'korean_male' }), {});

  assert.deepEqual(applyTtsVoiceSelectionToEnv({ TTS_RATE: '+0%' }, selected), {
    TTS_RATE: '+0%',
    TTS_BACKEND: 'edge',
    TTS_VOICE_TYPE: 'korean_male',
    TTS_VOICE: 'ko-KR-InJoonNeural',
    VOICE_LANGUAGE: 'ko',
  });
});

test('preferredVoiceTypeForLanguage maps language to available backend voice type', () => {
  const config = defaultTtsVoiceConfig();
  assert.equal(preferredVoiceTypeForLanguage(config, 'ko'), 'korean_male');
  assert.equal(preferredVoiceTypeForLanguage(config, 'en'), 'english_male');
});

test('voiceCommandFromTranscript detects voice type changes', () => {
  assert.deepEqual(voiceCommandFromTranscript('change voice to Korean female'), { voiceType: 'korean_female' });
  assert.deepEqual(voiceCommandFromTranscript('남자 한국어 목소리로 바꿔'), { voiceType: 'korean_male' });
  assert.deepEqual(voiceCommandFromTranscript('switch speaker to English'), { voiceType: 'english_male' });
  assert.equal(voiceCommandFromTranscript('change language to Korean'), null);
});

test('voiceCommandFromTranscript detects TTS backend changes', () => {
  assert.deepEqual(voiceCommandFromTranscript('change TTS backend to OmniVoice'), { backend: 'omnivoice' });
  assert.deepEqual(voiceCommandFromTranscript('음성 백엔드 옴니보이스로 바꿔'), { backend: 'omnivoice' });
  assert.deepEqual(voiceCommandFromTranscript('TTS를 Edge로 바꿔'), { backend: 'edge' });
  assert.deepEqual(voiceCommandFromTranscript('TTS를 qwen3로 바꿔'), { backend: 'qwen3tts' });
  assert.deepEqual(voiceCommandFromTranscript('음성 백엔드 큐웬으로 바꿔'), { backend: 'qwen3tts' });
  assert.deepEqual(voiceCommandFromTranscript('TTS backend to FireRedTTS-2'), { backend: 'fireredtts2' });
  assert.deepEqual(voiceCommandFromTranscript('음성 백엔드 모스로 바꿔'), { backend: 'mossttsnano' });
});

test('applyTtsVoiceSelectionToEnv maps Qwen3 voice types to CLI mode env', () => {
  const preset = effectiveTtsVoiceSelection(updateTtsVoiceConfig(defaultTtsVoiceConfig(), { backend: 'qwen3tts', voiceType: 'korean_preset' }), {});
  assert.deepEqual(applyTtsVoiceSelectionToEnv({}, preset), {
    TTS_BACKEND: 'qwen3tts',
    TTS_VOICE_TYPE: 'korean_preset',
    QWEN3TTS_MODE: 'custom',
    QWEN3TTS_SPEAKER: 'sohee',
    VOICE_LANGUAGE: 'ko',
  });

  const clone = effectiveTtsVoiceSelection(updateTtsVoiceConfig(defaultTtsVoiceConfig(), { backend: 'qwen3tts', voiceType: 'cloned_reference' }), {});
  assert.deepEqual(applyTtsVoiceSelectionToEnv({}, clone), {
    TTS_BACKEND: 'qwen3tts',
    TTS_VOICE_TYPE: 'cloned_reference',
    QWEN3TTS_MODE: 'clone',
    QWEN3TTS_REF_AUDIO: 'voice-samples/user-reference.wav',
    VOICE_LANGUAGE: 'ko',
  });
});

test('applyTtsVoiceSelectionToEnv maps FireRedTTS-2 and MOSS prompt references', () => {
  const fire = effectiveTtsVoiceSelection(updateTtsVoiceConfig(defaultTtsVoiceConfig(), { backend: 'fireredtts2', voiceType: 'prompt_reference' }), {});
  assert.deepEqual(applyTtsVoiceSelectionToEnv({}, fire), {
    TTS_BACKEND: 'fireredtts2',
    TTS_VOICE_TYPE: 'prompt_reference',
    FIREREDTTS2_PROMPT_AUDIO: 'voice-samples/user-reference.wav',
    VOICE_LANGUAGE: 'ko',
  });

  const moss = effectiveTtsVoiceSelection(updateTtsVoiceConfig(defaultTtsVoiceConfig(), { backend: 'mossttsnano', voiceType: 'prompt_reference' }), {});
  assert.deepEqual(applyTtsVoiceSelectionToEnv({}, moss), {
    TTS_BACKEND: 'mossttsnano',
    TTS_VOICE_TYPE: 'prompt_reference',
    MOSSTTSNANO_MODE: 'voice_clone',
    MOSSTTSNANO_PROMPT_AUDIO: 'voice-samples/user-reference.wav',
    VOICE_LANGUAGE: 'ko',
  });
});

test('updateTtsVoiceConfig can switch to OmniVoice backend default voice', () => {
  const config = updateTtsVoiceConfig(defaultTtsVoiceConfig(), { backend: 'omnivoice' });
  const selected = effectiveTtsVoiceSelection(config, {});

  assert.equal(selected.backend, 'omnivoice');
  assert.equal(selected.voiceType, 'cloned_reference');
  assert.equal(selected.voice.voice, 'voice-samples/user-reference.wav');
});

test('read and write voice config round trips current selection', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-config-test-'));
  const file = path.join(dir, 'tts-voices.json');
  const config = updateTtsVoiceConfig(defaultTtsVoiceConfig(), { voiceType: 'korean_female' });

  writeTtsVoiceConfig(file, config);
  const loaded = readTtsVoiceConfig(file);

  assert.equal(loaded.currentVoiceType, 'korean_female');
});
