import test from 'node:test';
import assert from 'node:assert/strict';

import { playChunkedTTSWithPrefetch } from './tts_prefetch.mjs';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('playChunkedTTSWithPrefetch starts synthesizing the next chunk while current chunk is playing', async () => {
  const events = [];
  const firstPlayStarted = deferred();
  const releaseFirstPlay = deferred();

  async function synth(chunk, index) {
    events.push(`synth-start-${index}:${chunk}`);
    return `mp3-${index}`;
  }

  async function play(file, index) {
    events.push(`play-start-${index}:${file}`);
    if (index === 0) {
      firstPlayStarted.resolve();
      await releaseFirstPlay.promise;
    }
    events.push(`play-end-${index}:${file}`);
  }

  const run = playChunkedTTSWithPrefetch(['하나.', '둘.'], { synth, play });
  await firstPlayStarted.promise;

  assert.ok(events.includes('synth-start-1:둘.'), 'next chunk should begin synthesizing before first playback ends');
  assert.equal(events.includes('play-end-0:mp3-0'), false, 'first playback should still be running');

  releaseFirstPlay.resolve();
  await run;
});

test('playChunkedTTSWithPrefetch preserves playback order', async () => {
  const played = [];
  await playChunkedTTSWithPrefetch(['하나.', '둘.', '셋.'], {
    synth: async (_chunk, index) => `mp3-${index}`,
    play: async file => { played.push(file); },
  });

  assert.deepEqual(played, ['mp3-0', 'mp3-1', 'mp3-2']);
});
