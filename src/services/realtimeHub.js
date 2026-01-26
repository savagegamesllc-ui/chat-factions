// src/services/realtimeHub.js
'use strict';

// streamerId -> Set(res)
const clientsByStreamerId = new Map();

function ensureSet(streamerId) {
  const key = String(streamerId);
  let set = clientsByStreamerId.get(key);
  if (!set) {
    set = new Set();
    clientsByStreamerId.set(key, set);
  }
  return set;
}

function writeSse(res, eventName, payload) {
  // SSE format: event + data + blank line
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload ?? {})}\n\n`);
}

function registerClient(streamerId, res) {
  const key = String(streamerId);
  const set = ensureSet(key);
  set.add(res);

  // auto-cleanup
  res.on('close', () => {
    try {
      set.delete(res);
      if (set.size === 0) clientsByStreamerId.delete(key);
    } catch (_) {}
  });
}

function unregisterClient(streamerId, res) {
  const key = String(streamerId);
  const set = clientsByStreamerId.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientsByStreamerId.delete(key);
}

function broadcast(streamerId, eventName, payload) {
  const key = String(streamerId);
  const set = clientsByStreamerId.get(key);
  if (!set || set.size === 0) return;

  for (const res of set) {
    try {
      writeSse(res, eventName, payload);
    } catch (_) {
      // if a write fails, the close handler will usually clean up
    }
  }
}

function getClientCount(streamerId) {
  const key = String(streamerId);
  const set = clientsByStreamerId.get(key);
  return set ? set.size : 0;
}

module.exports = {
  registerClient,
  unregisterClient,
  broadcast,
  getClientCount,
};
