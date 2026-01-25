// src/services/realtimeHub.js
'use strict';

/**
 * Minimal SSE hub.
 * - Keeps a Set of open SSE responses per streamerId
 * - Allows broadcasting events to all connected clients for that streamerId
 */

const clientsByStreamer = new Map(); // streamerId -> Set(res)

function ensureSet(streamerId) {
  const key = String(streamerId);
  let set = clientsByStreamer.get(key);
  if (!set) {
    set = new Set();
    clientsByStreamer.set(key, set);
  }
  return set;
}

function safeWrite(res, chunk) {
  try {
    res.write(chunk);
    return true;
  } catch {
    return false;
  }
}

function sseFormat(eventName, data) {
  const payload = data === undefined ? null : data;
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function registerClient(streamerId, res) {
  const set = ensureSet(streamerId);
  set.add(res);

  // If the socket closes, remove it
  res.on('close', () => {
    unregisterClient(streamerId, res);
  });

  return {
    count: set.size,
  };
}

function unregisterClient(streamerId, res) {
  const key = String(streamerId);
  const set = clientsByStreamer.get(key);
  if (!set) return { count: 0 };

  set.delete(res);
  if (set.size === 0) clientsByStreamer.delete(key);

  return { count: set.size };
}

function broadcast(streamerId, eventName, data) {
  const key = String(streamerId);
  const set = clientsByStreamer.get(key);
  if (!set || set.size === 0) return { ok: true, delivered: 0 };

  const msg = sseFormat(eventName, data);

  let delivered = 0;
  for (const res of Array.from(set)) {
    const ok = safeWrite(res, msg);
    if (ok) delivered += 1;
    else unregisterClient(key, res);
  }

  return { ok: true, delivered };
}

function getClientCount(streamerId) {
  const set = clientsByStreamer.get(String(streamerId));
  return set ? set.size : 0;
}

module.exports = {
  registerClient,
  unregisterClient,
  broadcast,
  getClientCount,
};
