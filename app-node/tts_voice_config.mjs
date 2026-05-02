import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_TTS_VOICE_CONFIG = {
  currentBackend: 'edge',
  currentVoiceType: 'english_male',
  backends: {
    edge: {
      currentVoiceType: 'english_male',
      voices: {
        english_male: { label: 'English male', language: 'en', voice: 'en-US-GuyNeural' },
        english_female: { label: 'English female', language: 'en', voice: 'en-US-AriaNeural' },
        korean_male: { label: 'Korean male', language: 'ko', voice: 'ko-KR-InJoonNeural' },
        korean_female: { label: 'Korean female', language: 'ko', voice: 'ko-KR-SunHiNeural' },
        korean_multilingual_male: { label: 'Korean multilingual male', language: 'ko', voice: 'ko-KR-HyunsuMultilingualNeural' },
      },
    },
    openvoice: {
      currentVoiceType: 'cloned_reference',
      voices: {
        cloned_reference: { label: 'OpenVoice reference sample', language: 'ko', voice: 'voice-samples/user-reference.wav' },
      },
    },
    speechswift: {
      currentVoiceType: 'cosyvoice_reference',
      voices: {
        cosyvoice_reference: { label: 'CosyVoice reference sample', language: 'ko', voice: 'voice-samples/user-reference.wav' },
        qwen3_default: { label: 'Qwen3 default speaker', language: 'ko', voice: 'qwen3_default' },
      },
    },
    supertonic: {
      currentVoiceType: 'm1',
      voices: {
        m1: { label: 'Supertonic M1', language: 'ko', voice: 'M1' },
      },
    },
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function defaultTtsVoiceConfig() {
  return clone(DEFAULT_TTS_VOICE_CONFIG);
}

function normalizeBackend(value, config) {
  const key = String(value || '').trim().toLowerCase();
  return config.backends?.[key] ? key : 'edge';
}

function normalizeVoiceType(backendConfig, requested) {
  const key = String(requested || backendConfig?.currentVoiceType || '').trim();
  if (key && backendConfig?.voices?.[key]) return key;
  return Object.keys(backendConfig?.voices || {})[0] || '';
}

export function readTtsVoiceConfig(configPath, fallback = DEFAULT_TTS_VOICE_CONFIG) {
  try {
    if (!configPath || !fs.existsSync(configPath)) return clone(fallback);
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { ...clone(fallback), ...parsed, backends: { ...clone(fallback).backends, ...(parsed.backends || {}) } };
  } catch {
    return clone(fallback);
  }
}

export function writeTtsVoiceConfig(configPath, config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function effectiveTtsVoiceSelection(config, env = {}) {
  const merged = config || defaultTtsVoiceConfig();
  const backend = normalizeBackend(env.TTS_BACKEND || merged.currentBackend, merged);
  const backendConfig = merged.backends[backend] || merged.backends.edge;
  const voiceType = normalizeVoiceType(backendConfig, env.TTS_VOICE_TYPE || merged.currentVoiceType || backendConfig.currentVoiceType);
  const voice = backendConfig.voices[voiceType];
  return { backend, voiceType, voice, backendConfig };
}

export function applyTtsVoiceSelectionToEnv(env = {}, selection) {
  const next = { ...env, TTS_BACKEND: selection.backend, TTS_VOICE_TYPE: selection.voiceType };
  if (selection.backend === 'edge') next.TTS_VOICE = selection.voice.voice;
  if (selection.voice?.language) next.VOICE_LANGUAGE = selection.voice.language;
  return next;
}

export function updateTtsVoiceConfig(config, { backend, voiceType } = {}) {
  const next = clone(config || DEFAULT_TTS_VOICE_CONFIG);
  const selectedBackend = normalizeBackend(backend || next.currentBackend, next);
  const backendConfig = next.backends[selectedBackend];
  const selectedVoiceType = normalizeVoiceType(backendConfig, voiceType || next.currentVoiceType || backendConfig.currentVoiceType);
  next.currentBackend = selectedBackend;
  next.currentVoiceType = selectedVoiceType;
  backendConfig.currentVoiceType = selectedVoiceType;
  return next;
}

export function preferredVoiceTypeForLanguage(config, language) {
  const lang = /^ko/i.test(String(language || '')) ? 'ko' : 'en';
  const backend = normalizeBackend(config.currentBackend, config);
  const voices = config.backends[backend]?.voices || {};
  const preferred = lang === 'ko'
    ? ['korean_male', 'korean_female', 'korean_multilingual_male']
    : ['english_male', 'english_female'];
  for (const key of preferred) if (voices[key]?.language === lang) return key;
  return Object.entries(voices).find(([, voice]) => voice.language === lang)?.[0] || Object.keys(voices)[0] || '';
}

export function voiceCommandFromTranscript(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const compact = raw.toLowerCase().replace(/\s+/g, '');
  const looksLikeVoice = /\b(change|switch|set)\b.*\b(voice|speaker)\b/i.test(raw)
    || /\b(voice|speaker)\b.*\b(to|as)\b/i.test(raw)
    || /(목소리|음성).*(바꿔|변경|설정|해줘)|목소리.*로|음성.*로/u.test(compact);
  if (!looksLikeVoice) return null;
  const language = /(korean|한국|한글|ko-kr|kor)/iu.test(raw) ? 'ko' : /(english|영어|en-us|eng)/iu.test(raw) ? 'en' : null;
  const gender = /(female|woman|여자|여성)/iu.test(raw) ? 'female' : /(male|man|남자|남성)/iu.test(raw) ? 'male' : null;
  if (language === 'ko' && gender === 'female') return { voiceType: 'korean_female' };
  if (language === 'ko') return { voiceType: 'korean_male' };
  if (language === 'en' && gender === 'female') return { voiceType: 'english_female' };
  if (language === 'en') return { voiceType: 'english_male' };
  return null;
}
