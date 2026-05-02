export const LANGUAGE_PRESETS = {
  ko: {
    key: 'ko',
    label: 'Korean',
    sttLanguage: 'ko',
    voiceLanguage: 'ko',
    ttsVoice: 'ko-KR-InJoonNeural',
  },
  en: {
    key: 'en',
    label: 'English',
    sttLanguage: 'en',
    voiceLanguage: 'en',
    ttsVoice: 'en-US-GuyNeural',
  },
  auto: {
    key: 'auto',
    label: 'Auto-detect STT, English voice',
    sttLanguage: 'auto',
    voiceLanguage: 'en',
    ttsVoice: 'en-US-GuyNeural',
  },
};

export function normalizeLanguageKey(value, fallback = 'ko') {
  const raw = String(value || '').trim().toLowerCase();
  if (['korean', 'kr', 'kor', '한국어', 'ko-kr'].includes(raw)) return 'ko';
  if (['english', 'eng', 'en-us', 'en-gb', '영어'].includes(raw)) return 'en';
  if (['auto', 'detect', 'auto-detect', '자동', '자동감지'].includes(raw)) return 'auto';
  return LANGUAGE_PRESETS[raw] ? raw : fallback;
}

export function languagePreset(value, fallback = 'ko') {
  return LANGUAGE_PRESETS[normalizeLanguageKey(value, fallback)];
}

export function shouldPassWhisperLanguage(language) {
  const raw = String(language || '').trim().toLowerCase();
  return raw && raw !== 'auto' && raw !== 'detect';
}

export function applyLanguagePreset(env = {}, language = 'ko') {
  const preset = languagePreset(language);
  return {
    ...env,
    VOICE_LANGUAGE: preset.voiceLanguage,
    WHISPER_CPP_LANGUAGE: preset.sttLanguage,
    STT_LANGUAGE: preset.sttLanguage,
    TTS_BACKEND: env.TTS_BACKEND || 'edge',
    TTS_VOICE: preset.ttsVoice,
  };
}

export function languageStatus(values = {}) {
  const stt = values.WHISPER_CPP_LANGUAGE || values.STT_LANGUAGE || 'ko';
  const voiceLanguage = values.VOICE_LANGUAGE || (/^en/i.test(String(values.TTS_VOICE || '')) ? 'en' : 'ko');
  const ttsVoice = values.TTS_VOICE || 'ko-KR-InJoonNeural';
  return { sttLanguage: stt, voiceLanguage, ttsVoice };
}

export function voiceLanguageCommandFromTranscript(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const compact = raw.toLowerCase().replace(/\s+/g, '');
  const looksLikeCommand = /\b(change|switch|set)\b.*\b(language|voice|stt|speech)\b/i.test(raw)
    || /\b(language|voice|stt|speech)\b.*\b(to|as)\b/i.test(raw)
    || /(언어|음성|말|말투).*(바꿔|변경|설정|해줘)|로말해|로바꿔/u.test(compact);
  if (!looksLikeCommand) return null;
  if (/(auto.?detect|detect.?language|automatic|자동|자동감지)/iu.test(raw)) return { language: 'auto' };
  if (/(english|영어|en-us|eng)/iu.test(raw)) return { language: 'en' };
  if (/(korean|한국어|한글|ko-kr|kor)/iu.test(raw)) return { language: 'ko' };
  return null;
}
