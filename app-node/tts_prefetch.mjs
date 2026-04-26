function isAbortError(e) {
  return e?.name === 'AbortError' || e?.code === 'ABORT_ERR';
}

export async function playChunkedTTSWithPrefetch(chunks, { synth, play, cleanup, signal, log = () => {} }) {
  if (!Array.isArray(chunks) || chunks.length === 0) return;

  const startSynth = index => Promise.resolve()
    .then(() => {
      if (signal?.aborted) return null;
      log('TTS chunk start', index + 1, '/', chunks.length, 'chars', String(chunks[index] || '').length);
      return synth(chunks[index], index);
    });

  let currentPromise = startSynth(0);
  for (let index = 0; index < chunks.length; index += 1) {
    if (signal?.aborted) return;
    const file = await currentPromise;
    if (!file) return;

    const nextPromise = index + 1 < chunks.length ? startSynth(index + 1) : null;

    if (signal?.aborted) {
      await cleanup?.(file).catch?.(() => {});
      return;
    }

    try {
      await play(file, index);
    } catch (e) {
      if (isAbortError(e) || signal?.aborted) return;
      throw e;
    }

    if (signal?.aborted) return;
    currentPromise = nextPromise;
  }
}
