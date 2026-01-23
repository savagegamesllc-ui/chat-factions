// src/services/realtimeHub.js
'use strict';

const clientsByStreamerId = new Map(); // streamerId -> Set(res)

/**
 * Register an SSE client response
 */
function registerClient(streamerId, res) {
  if (!clientsByStreamerId.has(streamerId)) {
    clientsByStreamerId.set(streamerId, new Set());
  }
  const set = clientsByStreamerId.get(streamerId);
  set.add(res);

  res.on('close', () => {
    try {
      set.delete(res);
      if (set.size === 0) clientsByStreamerId.delete(streamerId);
    } catch (_) {}
  });
}

/**
 * Broadcast event payload to all SSE clients for streamerId
 */
const listenersByStreamer = new Map();

function subscribe(streamerId, fn) {
  const key = String(streamerId);
  if (!listenersByStreamer.has(key)) listenersByStreamer.set(key, new Set());
  const set = listenersByStreamer.get(key);
  set.add(fn);
  return () => set.delete(fn);
}

function broadcast(streamerId, eventName, payload) {
  const key = String(streamerId);
  const set = listenersByStreamer.get(key);
  if (!set) return;
  for (const fn of set) fn(eventName, payload);
}

module.exports = { registerClient, subscribe, broadcast };
