export const AUTO_RESTART_ENV_KEY = 'VERBALCODING_AUTO_RESTART_VOICE_BOT';

export function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || String(value).trim() === '') return Boolean(defaultValue);
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) return false;
  return Boolean(defaultValue);
}

export function autoRestartVoiceBotEnabled(env = process.env) {
  return parseBooleanFlag(env[AUTO_RESTART_ENV_KEY], false);
}

export function normalizeAutoRestartCommand(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['on', 'true', '1', 'yes', 'enable', 'enabled', '켜', '켜줘'].includes(normalized)) return '1';
  if (['off', 'false', '0', 'no', 'disable', 'disabled', '꺼', '꺼줘'].includes(normalized)) return '0';
  return null;
}

export function autoRestartStatusText(env = process.env, language = 'ko') {
  const enabled = autoRestartVoiceBotEnabled(env);
  const english = /^en/i.test(String(language || ''));
  if (english) return `Auto restart voice bot after commits: ${enabled ? 'on' : 'off'}.`;
  return `커밋 후 음성봇 자동 재시작: ${enabled ? '켜짐' : '꺼짐'}.`;
}
