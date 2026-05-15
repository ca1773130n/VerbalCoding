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
    omnivoice: {
      currentVoiceType: 'cloned_reference',
      voices: {
        cloned_reference: { label: 'OmniVoice reference sample', language: 'ko', voice: 'voice-samples/user-reference.wav' },
        designed_speaker: { label: 'OmniVoice designed speaker', language: 'ko', voice: 'warm korean male voice' },
      },
    },
    qwen3tts: {
      currentVoiceType: 'korean_preset',
      voices: {
        korean_preset: { label: 'Qwen3 TTS Korean preset', language: 'ko', voice: 'Cherry' },
        cloned_reference: { label: 'Qwen3 TTS reference sample', language: 'ko', voice: 'voice-samples/user-reference.wav' },
        designed_speaker: { label: 'Qwen3 TTS designed speaker', language: 'ko', voice: 'calm conversational Korean voice' },
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
  const aliases = new Map([
    ['q13', 'qwen3tts'],
    ['q13tts', 'qwen3tts'],
    ['qwen3', 'qwen3tts'],
    ['qwen3-tts', 'qwen3tts'],
    ['qtts', 'qwen3tts'],
  ]);
  const normalized = aliases.get(key) || key;
  return config.backends?.[normalized] ? normalized : 'edge';
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
  const requestedVoiceType = env.TTS_VOICE_TYPE || merged.currentVoiceType;
  const voiceType = backendConfig.voices?.[requestedVoiceType]
    ? requestedVoiceType
    : normalizeVoiceType(backendConfig, backendConfig.currentVoiceType);
  const voice = backendConfig.voices[voiceType];
  return { backend, voiceType, voice, backendConfig };
}

export function applyTtsVoiceSelectionToEnv(env = {}, selection) {
  const next = { ...env, TTS_BACKEND: selection.backend, TTS_VOICE_TYPE: selection.voiceType };
  if (selection.backend === 'edge') next.TTS_VOICE = selection.voice.voice;
  if (selection.backend === 'qwen3tts') {
    if (selection.voiceType === 'cloned_reference') {
      next.QWEN3TTS_MODE = 'clone';
      next.QWEN3TTS_REF_AUDIO = selection.voice.voice;
    } else if (selection.voiceType === 'designed_speaker') {
      next.QWEN3TTS_MODE = 'design';
      next.QWEN3TTS_INSTRUCT = selection.voice.voice;
    } else {
      next.QWEN3TTS_MODE = 'custom';
      next.QWEN3TTS_SPEAKER = selection.voice.voice;
    }
  }
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
  const looksLikeBackend = /\b(tts|voice|speech|audio)\b.*\bbackend\b|\bbackend\b.*\b(tts|voice|speech|audio)\b/i.test(raw)
    || /(tts|음성|목소리).*(백엔드|백앤드|backend).*(바꿔|변경|설정|해줘|로)/iu.test(raw)
    || /(백엔드|백앤드|backend).*(옴니보이스|오픈보이스|엣지|수퍼토닉|슈퍼토닉|스피치스위프트|큐원|큐웬|qwen|q13|qtts|speechswift|omnivoice|openvoice|edge|supertonic)/iu.test(raw)
    || /tts를.*(옴니보이스|오픈보이스|엣지|수퍼토닉|슈퍼토닉|스피치스위프트|큐원|큐웬|qwen|q13|qtts|omnivoice|openvoice|edge|supertonic|speechswift).*바꿔/iu.test(raw);
  if (looksLikeBackend) {
    if (/(omnivoice|omni voice|옴니보이스|업니보이스|옴니|업니)/iu.test(raw)) return { backend: 'omnivoice' };
    if (/(openvoice|open voice|오픈보이스|오픈 보이스)/iu.test(raw)) return { backend: 'openvoice' };
    if (/(speechswift|speech swift|스피치스위프트|스피치 스위프트|cosyvoice|코지보이스)/iu.test(raw)) return { backend: 'speechswift' };
    if (/(qwen3|qwen|q13|qtts|큐원|큐웬|큐엔|큐13|큐삼)/iu.test(raw)) return { backend: 'qwen3tts' };
    if (/(supertonic|수퍼토닉|슈퍼토닉)/iu.test(raw)) return { backend: 'supertonic' };
    if (/(edge|엣지)/iu.test(raw)) return { backend: 'edge' };
  }
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
