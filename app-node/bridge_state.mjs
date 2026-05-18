export function createBridgeState({ log = () => {}, cleanupFile = () => {} } = {}) {
  let epoch = 0;
  const pendingUtterances = new Map();
  const deferredUtterances = [];

  function currentEpoch() {
    return epoch;
  }

  function discardQueues(reason = 'state-change') {
    epoch += 1;
    for (const pending of pendingUtterances.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      for (const file of pending.files || []) cleanupFile(file);
    }
    pendingUtterances.clear();
    for (const item of deferredUtterances.splice(0)) {
      if (item?.wavPath) cleanupFile(item.wavPath);
    }
    log('discard voice input queues', reason, 'epoch', epoch);
    return epoch;
  }

  function getPending(userId) {
    return pendingUtterances.get(userId);
  }

  function setPending(userId, pending) {
    pendingUtterances.set(userId, { ...pending, epoch: pending.epoch ?? epoch });
    return pendingUtterances.get(userId);
  }

  function deletePending(userId) {
    const pending = pendingUtterances.get(userId);
    if (pending?.timer) {
      clearTimeout(pending.timer);
      pending.timer = null;
    }
    pendingUtterances.delete(userId);
    return pending;
  }

  function clearPendingTimer(userId) {
    const pending = pendingUtterances.get(userId);
    if (pending?.timer) {
      clearTimeout(pending.timer);
      pending.timer = null;
    }
    return pending;
  }

  function appendSegment(userId, { file, pcmBytes, startedAtMs = Date.now(), endedAtMs = Date.now(), timerFactory }) {
    let pending = pendingUtterances.get(userId);
    if (pending && pending.epoch !== epoch) {
      if (pending.timer) clearTimeout(pending.timer);
      for (const oldFile of pending.files || []) cleanupFile(oldFile);
      pendingUtterances.delete(userId);
      pending = null;
    }
    if (!pending) {
      pending = { files: [], pcmBytes: 0, timer: null, firstPacketAt: startedAtMs, lastSegmentEndAt: endedAtMs, epoch };
      pendingUtterances.set(userId, pending);
    }
    pending.files.push(file);
    pending.pcmBytes += pcmBytes;
    pending.firstPacketAt = Math.min(pending.firstPacketAt || startedAtMs, startedAtMs);
    pending.lastSegmentEndAt = Math.max(pending.lastSegmentEndAt || endedAtMs, endedAtMs);
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = timerFactory?.();
    return pending;
  }

  function isStale(item) {
    return !item || item.epoch !== epoch;
  }

  function enqueueDeferred(item, enqueueFn, maxSize) {
    return enqueueFn(deferredUtterances, { ...item, epoch }, maxSize);
  }

  function shiftDeferred() {
    while (deferredUtterances.length > 0) {
      const item = deferredUtterances.shift();
      if (!isStale(item)) return item;
      if (item?.wavPath) cleanupFile(item.wavPath);
      log('drop stale deferred utterance', 'utteranceEpoch', item?.epoch, 'currentEpoch', epoch);
    }
    return null;
  }

  function deferredSize() {
    return deferredUtterances.length;
  }

  return {
    appendSegment,
    clearPendingTimer,
    currentEpoch,
    deferredSize,
    deletePending,
    discardQueues,
    enqueueDeferred,
    getPending,
    isStale,
    setPending,
    shiftDeferred,
  };
}
