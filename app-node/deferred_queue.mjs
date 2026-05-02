export function enqueueDeferredUtterance(queue, item, maxSize) {
  const limit = Number(maxSize);
  if (!Number.isFinite(limit) || limit <= 0) {
    return { queued: false, dropped: item, reason: 'disabled' };
  }
  let dropped = null;
  while (queue.length >= limit) {
    dropped = queue.shift();
  }
  queue.push(item);
  return { queued: true, dropped, reason: dropped ? 'replaced-oldest' : 'queued' };
}
