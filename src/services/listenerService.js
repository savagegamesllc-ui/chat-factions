// src/services/listenerService.js
export function createListenerService({ sseHub, prisma }) {
  // in-memory state: streamerId -> { running, startedAt }
  const state = new Map();

  function isRunning(streamerId) {
    return state.get(streamerId)?.running === true;
  }

  async function start(streamerId) {
    if (!streamerId) throw new Error("Missing streamerId");
    if (isRunning(streamerId)) return { ok: true, already: true };

    state.set(streamerId, { running: true, startedAt: Date.now() });

    // Optional: broadcast a system event so overlays/dev UI can react
    sseHub.publish(streamerId, {
      type: "system",
      ts: Date.now(),
      streamerId,
      payload: { message: "Listener started" },
    });

    return { ok: true };
  }

  async function stop(streamerId) {
    if (!streamerId) throw new Error("Missing streamerId");
    if (!isRunning(streamerId)) return { ok: true, already: true };

    state.set(streamerId, { running: false, startedAt: null });

    sseHub.publish(streamerId, {
      type: "system",
      ts: Date.now(),
      streamerId,
      payload: { message: "Listener stopped" },
    });

    return { ok: true };
  }

  async function status(streamerId) {
    const s = state.get(streamerId);
    return {
      running: s?.running === true,
      startedAt: s?.startedAt || null,
    };
  }

  return { start, stop, status, isRunning };
}
