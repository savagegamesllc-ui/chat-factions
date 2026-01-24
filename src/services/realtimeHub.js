// src/services/realtimeHub.js
'use strict';

/**
 * SSE hub:
 * - clientsByStreamer: streamerId -> Set(res)
 * - broadcast(streamerId, event, data): pushes SSE
 */

const clientsByStreamer = new Map();

function ensureSet(streamerId) {
  const key = String(streamerId || '');
  if (!key) return null;
  if (!clientsByStreamer.has(key)) clientsByStreamer.set(key, new Set());
  return clientsByStreamer.get(key);
}

function registerSseClient(streamerId, res) {
  const set = ensureSet(streamerId);
  if (!set) return () => {};

  set.add(res);

  // Clean up on disconnect
  res.on('close', () => {
    try { set.delete(res); } catch {}
    if (set.size === 0) clientsByStreamer.delete(String(streamerId));
  });

  return () => {
    try { set.delete(res); } catch {}
    if (set.size === 0) clientsByStreamer.delete(String(streamerId));
  };
}

function writeSse(res, eventName, payload) {
  // SSE format
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(streamerId, eventName, payload) {
  const set = clientsByStreamer.get(String(streamerId));
  if (!set || set.size === 0) return { ok: true, delivered: 0 };

  let delivered = 0;
  for (const res of set) {
    try {
      writeSse(res, eventName, payload);
      delivered++;
    } catch (_) {
      try { set.delete(res); } catch {}
    }
  }
  return { ok: true, delivered };
}

module.exports = {
  registerSseClient,
  broadcast,
};
