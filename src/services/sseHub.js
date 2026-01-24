// src/services/sseHub.js
import { EventEmitter } from "node:events";

export function createSseHub() {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);

  function channel(streamerId) {
    return `streamer:${streamerId}`;
  }

  function publish(streamerId, evt) {
    bus.emit(channel(streamerId), evt);
  }

  function subscribe(streamerId, fn) {
    const key = channel(streamerId);
    bus.on(key, fn);
    return () => bus.off(key, fn);
  }

  return { publish, subscribe };
}
