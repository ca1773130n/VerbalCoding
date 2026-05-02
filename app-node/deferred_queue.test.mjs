import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueDeferredUtterance } from './deferred_queue.mjs';

test('enqueueDeferredUtterance drops immediately when queue is disabled', () => {
  const queue = [];
  const item = { text: 'do not run this later' };
  const result = enqueueDeferredUtterance(queue, item, 0);
  assert.deepEqual(result, { queued: false, dropped: item, reason: 'disabled' });
  assert.deepEqual(queue, []);
});

test('enqueueDeferredUtterance keeps only latest items up to max size', () => {
  const queue = [{ text: 'old' }];
  const result = enqueueDeferredUtterance(queue, { text: 'new' }, 1);
  assert.equal(result.queued, true);
  assert.equal(result.reason, 'replaced-oldest');
  assert.deepEqual(result.dropped, { text: 'old' });
  assert.deepEqual(queue, [{ text: 'new' }]);
});
