import { EventEmitter } from 'node:events';

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const BOX_RE = /[╭╮╰╯│┊─]/g;
const PROGRESS_LINE_RE = /^VERBALCODING_PROGRESS\s*:.*$/i;
const TERMINAL_RE = /(?<!\b(?:e\.g|i\.e|etc|cf|Mr|Mrs|Dr|Sr|Jr|St|Mt|vs|approx|al|aka|fig|eqn|inc|ltd|co))[.!?。！？…]+["'\)\]\}」』]*(?=\s|$)/;

function clean(text) {
  return String(text || '')
    .replace(ANSI_RE, '')
    .split(/\r?\n/)
    .filter(line => !PROGRESS_LINE_RE.test(line.trim()))
    .join('\n')
    .replace(BOX_RE, '')
    .replace(/[ \t]+/g, ' ');
}

export function createSentencer({ minChars = 40, maxLatencyMs = 800 } = {}) {
  const ee = new EventEmitter();
  let buffer = '';
  let inFence = false;
  let pendingFenceTail = '';
  let lastEmit = Date.now();

  function emit(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    ee.emit('sentence', trimmed);
    lastEmit = Date.now();
  }

  function trailingBackticks(text) {
    let n = 0;
    for (let i = text.length - 1; i >= 0 && text[i] === '`' && n < 2; i -= 1) n += 1;
    return n;
  }

  function ingest(text) {
    let remaining = pendingFenceTail + text;
    pendingFenceTail = '';
    while (remaining.length > 0) {
      const fence = remaining.indexOf('```');
      if (fence === -1) {
        const heldCount = trailingBackticks(remaining);
        const safe = heldCount > 0 ? remaining.slice(0, remaining.length - heldCount) : remaining;
        pendingFenceTail = heldCount > 0 ? remaining.slice(remaining.length - heldCount) : '';
        if (!inFence) buffer += safe;
        return;
      }
      const before = remaining.slice(0, fence);
      if (!inFence) buffer += before;
      inFence = !inFence;
      remaining = remaining.slice(fence + 3);
    }
  }

  function scan() {
    while (true) {
      const match = buffer.match(TERMINAL_RE);
      if (!match) break;
      const end = match.index + match[0].length;
      const sentence = buffer.slice(0, end);
      buffer = buffer.slice(end).replace(/^\s+/, '');
      emit(sentence);
    }
    if (buffer.length >= minChars && Date.now() - lastEmit >= maxLatencyMs) {
      const cut = buffer.lastIndexOf(' ');
      if (cut > Math.floor(minChars / 2)) {
        emit(buffer.slice(0, cut));
        buffer = buffer.slice(cut).trim();
      }
    }
  }

  return {
    on: (event, fn) => ee.on(event, fn),
    push(text) {
      const cleaned = clean(text);
      if (!cleaned) return;
      ingest(cleaned);
      scan();
    },
    flush() {
      if (!inFence) buffer += pendingFenceTail;
      pendingFenceTail = '';
      emit(buffer);
      buffer = '';
      inFence = false;
    },
  };
}
