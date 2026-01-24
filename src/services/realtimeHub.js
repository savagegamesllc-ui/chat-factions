// src/services/realtimeHub.js
'use strict';

// SSE clients (Express res objects)
const clientsByStreamerId = new Map(); // streamerId(string) -> Set(res)

// In-process listeners (functions)
const listenersByStreamer = new Map(); // streamerId(string) -> Set(fn)

/**
 * Register an SSE client response
 */
function registerClient(streamerId, res) {
  const key = String(streamerId);

  if (!clientsByStreamerId.has(key)) clientsByStreamerId.set(key, new Set());
  const set = clientsByStreamerId.get(key);
  set.add(res);

  // cleanup on disconnect
  res.on('close', () => {
    try {
      set.delete(res);
      if (set.size === 0) clientsByStreamerId.delete(key);
    } catch (_) {}
  });
}

/**
 * Subscribe to events in-process (kept for backwards compatibility)
 * fn(eventName, payload)
 */
function subscribe(streamerId, fn) {
  const key = String(streamerId);
  if (!listenersByStreamer.has(key)) listenersByStreamer.set(key, new Set());
  const set = listenersByStreamer.get(key);
  set.add(fn);
  return () => {
    try {
      set.delete(fn);
      if (set.size === 0) listenersByStreamer.delete(key);
    } catch (_) {}
  };
}

/**
 * Broadcast event payload to:
 * 1) SSE clients registered with registerClient()
 * 2) any local subscribers registered with subscribe()
 */
function broadcast(streamerId, eventName, payload) {
  const key = String(streamerId);

  // 1) SSE clients
  const sseSet = clientsByStreamerId.get(key);
  if (sseSet && sseSet.size) {
    const frame =
      `event: ${eventName}\n` +
      `data: ${JSON.stringify(payload)}\n\n`;

    for (const res of sseSet) {
      try {
        res.write(frame);
      } catch (_) {
        try { sseSet.delete(res); } catch {}
      }
    }

    if (sseSet.size === 0) clientsByStreamerId.delete(key);
  }

  // 2) In-process listeners
  const fnSet = listenersByStreamer.get(key);
  if (fnSet && fnSet.size) {
    for (const fn of fnSet) {
      try { fn(eventName, payload); } catch (_) {}
    }
  }
}

module.exports = { registerClient, subscribe, broadcast };
