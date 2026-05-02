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

test('read and write voice config round trips current selection', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-config-test-'));
  const file = path.join(dir, 'tts-voices.json');
  const config = updateTtsVoiceConfig(defaultTtsVoiceConfig(), { voiceType: 'korean_female' });

  writeTtsVoiceConfig(file, config);
  const loaded = readTtsVoiceConfig(file);

  assert.equal(loaded.currentVoiceType, 'korean_female');
});
