export const DEFAULT_WHISPER_TIMEOUT_MS = 90000;

export function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function whisperTimeoutMs(env = process.env) {
  return parsePositiveInt(env.WHISPER_CPP_TIMEOUT_MS || env.WHISPER_TIMEOUT_MS, DEFAULT_WHISPER_TIMEOUT_MS);
}

export function whisperFailureMessage(error) {
  const signal = error?.signal ? `signal ${error.signal}` : '';
  const code = error?.code !== undefined && error?.code !== null ? `code ${error.code}` : '';
  const killed = error?.killed ? 'killed' : '';
  const message = String(error?.message || '').trim();
  const stderr = String(error?.stderr || '').trim();
  const stdout = String(error?.stdout || '').trim();
  const detail = stderr || stdout || message || 'unknown error';
  const tail = detail.length > 1400 ? detail.slice(-1400) : detail;
  const prefix = [killed, signal, code].filter(Boolean).join(' ');
  return prefix ? `${prefix}: ${tail}` : tail;
}
