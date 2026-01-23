// src/services/decayService.js
'use strict';

const { prisma } = require('../db/prisma');
const { getEffectiveChatConfig } = require('./chatConfigService');

function clampNum(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

/**
 * Apply decay to all meters in the active session for streamerId.
 * Uses StreamSession.lastDecayAt to compute elapsed minutes.
 *
 * Decay model: meter := round(meter * (1 - p) ^ minutes)
 * where p = percentPerMinute / 100.
 *
 * This is "exponential" decay; feels good for hype systems.
 */
async function applyDecayIfNeeded(streamerId, sessionId) {
  const cfg = await getEffectiveChatConfig(streamerId);
  const decayCfg = cfg?.decay || {};
  if (decayCfg.enabled === false) return { applied: false };

  const percentPerMinute = clampNum(decayCfg.percentPerMinute ?? 2, 0, 100);
  if (percentPerMinute <= 0) return { applied: false };

  const session = await prisma.streamSession.findUnique({
    where: { id: sessionId },
    select: { id: true, lastDecayAt: true }
  });
  if (!session) return { applied: false };

  const now = new Date();
  const last = session.lastDecayAt ? new Date(session.lastDecayAt) : null;

  // If never decayed, initialize timestamp only (don’t decay immediately)
  if (!last) {
    await prisma.streamSession.update({
      where: { id: sessionId },
      data: { lastDecayAt: now }
    });
    return { applied: false, initialized: true };
  }

  const elapsedMs = now.getTime() - last.getTime();
  if (elapsedMs < 10_000) return { applied: false }; // avoid over-updating (10s)

  const minutes = elapsedMs / 60_000;
  if (minutes <= 0) return { applied: false };

  const p = percentPerMinute / 100;
  const factor = Math.pow(1 - p, minutes);

  const minClampAbs = Math.max(0, Math.trunc(Number(decayCfg.minClampAbs ?? 0)));

  // Fetch all meters for this session
  const rows = await prisma.sessionFactionMeter.findMany({
    where: { sessionId },
    select: { id: true, meter: true }
  });

  // Compute new meters
  const updates = [];
  for (const r of rows) {
    const m = Number(r.meter) || 0;
    let next = Math.round(m * factor);

    // Optional clamp tiny values to 0 to prevent jitter
    if (minClampAbs > 0 && Math.abs(next) < minClampAbs) next = 0;

    if (next !== m) {
      updates.push({ id: r.id, meter: next });
    }
  }

  // Apply updates in a transaction
  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map(u =>
        prisma.sessionFactionMeter.update({
          where: { id: u.id },
          data: { meter: u.meter }
        })
      )
    );
  }

  await prisma.streamSession.update({
    where: { id: sessionId },
    data: { lastDecayAt: now }
  });

  return { applied: updates.length > 0, updated: updates.length, factor };
}

module.exports = {
  applyDecayIfNeeded
};
