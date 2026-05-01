export function isBrokenPipeError(error) {
  return error?.code === 'EPIPE' || /write EPIPE/i.test(String(error?.message || error));
}

export function isTransientNetworkError(error) {
  return ['EPIPE', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code) || /write EPIPE|socket hang up/i.test(String(error?.message || error));
}

export function createTransientErrorReporter({
  now = () => Date.now(),
  intervalMs = 30000,
  warn = () => {},
  isTransientError = isTransientNetworkError,
} = {}) {
  let nextLogAt = 0;
  let suppressed = 0;
  return function reportTransientError(label, error) {
    if (!isTransientError(error)) return false;
    const time = now();
    if (time < nextLogAt) {
      suppressed += 1;
      return true;
    }
    const repeated = suppressed ? `repeated ${suppressed} times` : '';
    suppressed = 0;
    nextLogAt = time + intervalMs;
    warn(`suppressed transient ${label}`, error?.code || '', error?.message || error, repeated);
    return true;
  };
}

export function createBridgeLogger({
  now = () => new Date().toISOString(),
  stdout = console,
  appendLine = () => {},
} = {}) {
  let stdioBroken = false;

  function lineFrom(args) {
    return [now(), ...args].map(String).join(' ');
  }

  function emit(kind, args) {
    const line = lineFrom(args);
    try { appendLine(line); } catch {}
    if (stdioBroken) return line;
    try {
      const fn = kind === 'warn' ? stdout.warn : stdout.log;
      fn.call(stdout, line);
    } catch (error) {
      if (isBrokenPipeError(error)) {
        stdioBroken = true;
        return line;
      }
      throw error;
    }
    return line;
  }

  return {
    log(...args) { return emit('log', args); },
    warn(...args) { return emit('warn', args); },
    markStdioBroken() { stdioBroken = true; },
    get stdioBroken() { return stdioBroken; },
  };
}
