// src/services/realtimeHub.js
'use strict';

const clientsByStreamerId = new Map(); // streamerId -> Set(res)

function registerClient(streamerId, res) {
  const key = String(streamerId);
  if (!clientsByStreamerId.has(key)) clientsByStreamerId.set(key, new Set());
  const set = clientsByStreamerId.get(key);
  set.add(res);

  res.on('close', () => {
    try {
      set.delete(res);
      if (set.size === 0) clientsByStreamerId.delete(key);
    } catch (_) {}
  });
}

function broadcast(streamerId, eventName, payload) {
  const key = String(streamerId);
  const set = clientsByStreamerId.get(key);
  if (!set || set.size === 0) return;

  const data = `event: ${eventName}\n` + `data: ${JSON.stringify(payload)}\n\n`;

  for (const res of set) {
    try {
      res.write(data);
    } catch (_) {
      // If write fails, drop it
      try { set.delete(res); } catch {}
    }
  }
}

module.exports = { registerClient, broadcast };
