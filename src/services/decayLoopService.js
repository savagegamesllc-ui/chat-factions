// src/services/decayLoopService.js
'use strict';

const { prisma } = require('../db/prisma');
const { applyDecayIfNeeded } = require('./decayService');
const { getMetersSnapshot } = require('./meterService');
const { broadcast } = require('./realtimeHub');

function startDecayLoop({ intervalMs = 15000 } = {}) {
  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;

    try {
      // Decay all active sessions
      const sessions = await prisma.streamSession.findMany({
        where: { endedAt: null },
        select: { id: true, streamerId: true }
      });

      for (const s of sessions) {
        const r = await applyDecayIfNeeded(s.streamerId, s.id);

        // If decay applied, push new meters to overlays
        if (r && r.applied) {
          const snap = await getMetersSnapshot(s.streamerId);
          broadcast(s.streamerId, 'meters', snap);
        }
      }
    } catch (e) {
      console.error('[decayLoop] tick error:', e?.message || e);
    } finally {
      running = false;
    }
  }

  timer = setInterval(tick, intervalMs);
  tick().catch(() => {});
  console.log('[decayLoop] started', { intervalMs });

  return {
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      console.log('[decayLoop] stopped');
    }
  };
}

module.exports = { startDecayLoop };
