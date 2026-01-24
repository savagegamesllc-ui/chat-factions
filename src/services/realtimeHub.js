// src/services/realtimeHub.js
'use strict';

const clientsByStreamerId = new Map(); // streamerId -> Set(res)
const listenersByStreamer = new Map(); // streamerId -> Set(fn)


/**
 * Register an SSE client response (Express res)
 */
function registerClient(streamerId, res) {
  const key = String(streamerId);

  if (!clientsByStreamerId.has(key)) {
    clientsByStreamerId.set(key, new Set());
  }
  const set = clientsByStreamerId.get(key);
  set.add(res);

  // Cleanup on disconnect
  res.on('close', () => {
    try {
      set.delete(res);
      if (set.size === 0) clientsByStreamerId.delete(key);
    } catch (_) {}
  });
}

/**
 * Optional in-process subscriber pattern (kept for any UI that uses it)
 */
function subscribe(streamerId, fn) {
  const key = String(streamerId);
  if (!listenersByStreamer.has(key)) listenersByStreamer.set(key, new Set());
  const set = listenersByStreamer.get(key);
  set.add(fn);
  return () => set.delete(fn);
}

/**
 * Broadcast an SSE event to:
 *  1) all registered SSE responses (registerClient)
 *  2) any in-process subscribers (subscribe)
 */
function broadcast(streamerId, eventName, payload) {
  const key = String(streamerId);

  // 1) SSE responses
  const resSet = clientsByStreamerId.get(key);
  if (resSet && resSet.size) {
    const data = JSON.stringify(payload ?? {});
    for (const res of Array.from(resSet)) {
      try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${data}\n\n`);
      } catch (_) {
        // if write fails, drop it
        try { resSet.delete(res); } catch (_) {}
      }
    }
    if (resSet.size === 0) clientsByStreamerId.delete(key);
  }

  // 2) Local listeners
  const fnSet = listenersByStreamer.get(key);
  if (fnSet && fnSet.size) {
    for (const fn of fnSet) {
      try { fn(eventName, payload); } catch (_) {}
    }
  }
}

module.exports = { registerClient, subscribe, broadcast };
