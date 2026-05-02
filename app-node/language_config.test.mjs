import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyLanguagePreset,
  languagePreset,
  languageStatus,
  normalizeLanguageKey,
  shouldPassWhisperLanguage,
  voiceLanguageCommandFromTranscript,
} from './language_config.mjs';

test('normalizeLanguageKey accepts common English, Korean, and auto aliases', () => {
  assert.equal(normalizeLanguageKey('english'), 'en');
  assert.equal(normalizeLanguageKey('한국어'), 'ko');
  assert.equal(normalizeLanguageKey('auto-detect'), 'auto');
});

test('voiceLanguageCommandFromTranscript detects voice language changes', () => {
  assert.deepEqual(voiceLanguageCommandFromTranscript('change language to English'), { language: 'en' });
  assert.deepEqual(voiceLanguageCommandFromTranscript('영어로 바꿔'), { language: 'en' });
  assert.deepEqual(voiceLanguageCommandFromTranscript('한국어로 말해'), { language: 'ko' });
  assert.deepEqual(voiceLanguageCommandFromTranscript('switch to auto detect language'), { language: 'auto' });
  assert.equal(voiceLanguageCommandFromTranscript('do we have a language option?'), null);
});

test('language presets update STT and TTS together', () => {
  const en = applyLanguagePreset({ TTS_RATE: '+0%' }, 'en');
  assert.equal(en.WHISPER_CPP_LANGUAGE, 'en');
  assert.equal(en.STT_LANGUAGE, 'en');
  assert.equal(en.VOICE_LANGUAGE, 'en');
  assert.equal(en.TTS_VOICE, 'en-US-GuyNeural');

  const ko = languagePreset('ko');
  assert.equal(ko.ttsVoice, 'ko-KR-InJoonNeural');
});

test('auto language omits forced whisper language while keeping a voice language', () => {
  const auto = applyLanguagePreset({}, 'auto');
  assert.equal(auto.WHISPER_CPP_LANGUAGE, 'auto');
  assert.equal(shouldPassWhisperLanguage(auto.WHISPER_CPP_LANGUAGE), false);
  assert.equal(shouldPassWhisperLanguage('en'), true);
});

test('languageStatus summarizes current env values', () => {
  assert.deepEqual(languageStatus({ WHISPER_CPP_LANGUAGE: 'en', VOICE_LANGUAGE: 'en', TTS_VOICE: 'en-US-GuyNeural' }), {
    sttLanguage: 'en',
    voiceLanguage: 'en',
    ttsVoice: 'en-US-GuyNeural',
  });
});
