export function createStreamingTTSQueue({ synth, play, signal, cleanup, log = () => {}, onSynthError = null } = {}) {
  if (typeof synth !== 'function') throw new Error('synth is required');
  if (typeof play !== 'function') throw new Error('play is required');

  const queue = [];
  let pumping = null;
  let droppedCount = 0;

  async function pump() {
    while (queue.length && !signal?.aborted) {
      const text = queue.shift();
      let file;
      try {
        file = await synth(text);
      } catch (e) {
        log('streaming tts synth failed', e?.message || e);
        droppedCount += 1;
        try { onSynthError?.({ text, error: e, droppedCount }); } catch {}
        continue;
      }
      if (!file) continue;
      if (signal?.aborted) {
        try { await cleanup?.(file); } catch {}
        return;
      }
      try {
        await play(file);
      } catch (e) {
        if (signal?.aborted) {
          try { await cleanup?.(file); } catch {}
          return;
        }
        log('streaming tts play failed', e?.message || e);
      }
      try { await cleanup?.(file); } catch {}
    }
  }

  return {
    enqueue(text) {
      const trimmed = String(text || '').trim();
      if (!trimmed || signal?.aborted) return;
      queue.push(trimmed);
      if (!pumping) pumping = pump().finally(() => { pumping = null; });
    },
    async drain() {
      while (pumping) await pumping;
    },
    get size() { return queue.length; },
    get droppedCount() { return droppedCount; },
  };
}
