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
  let lastEmit = Date.now();

  function emit(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    ee.emit('sentence', trimmed);
    lastEmit = Date.now();
  }

  function ingest(text) {
    let remaining = text;
    while (remaining.length > 0) {
      const fence = remaining.indexOf('```');
      if (fence === -1) {
        if (!inFence) buffer += remaining;
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
      emit(buffer);
      buffer = '';
      inFence = false;
    },
  };
}
