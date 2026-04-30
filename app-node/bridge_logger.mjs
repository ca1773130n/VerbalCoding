export function isBrokenPipeError(error) {
  return error?.code === 'EPIPE' || /write EPIPE/i.test(String(error?.message || error));
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
    get stdioBroken() { return stdioBroken; },
  };
}
