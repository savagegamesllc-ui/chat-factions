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
 * Decay model: meter := floor(meter * (1 - p) ^ minutes)
 * where p = percentPerMinute / 100.
 *
 * IMPORTANT: Use floor to ensure monotonic decrease (no "stuck" rounding).
 * Also: only update lastDecayAt when decay actually changes something,
 * so elapsed time can accumulate until a decrement occurs.
 */
async function applyDecayIfNeeded(streamerId, sessionId) {
  const cfg = await getEffectiveChatConfig(streamerId);
  const decayCfg = cfg?.decay || {};
  if (decayCfg.enabled === false) return { applied: false, reason: 'disabled' };

  const percentPerMinute = clampNum(decayCfg.percentPerMinute ?? 2, 0, 100);
  if (percentPerMinute <= 0) return { applied: false, reason: 'ppm<=0' };

  const session = await prisma.streamSession.findUnique({
    where: { id: sessionId },
    select: { id: true, lastDecayAt: true }
  });
  if (!session) return { applied: false, reason: 'no-session' };

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
  if (elapsedMs < 10_000) return { applied: false, reason: 'too-soon' }; // avoid over-updating (10s)

  const minutes = elapsedMs / 60_000;
  if (minutes <= 0) return { applied: false, reason: 'no-time' };

  const p = percentPerMinute / 100;
  const factor = Math.pow(1 - p, minutes);

  const minClampAbs = Math.max(0, Math.trunc(Number(decayCfg.minClampAbs ?? 0)));

  // Fetch all meters for this session
  const rows = await prisma.sessionFactionMeter.findMany({
    where: { sessionId },
    select: { id: true, meter: true }
  });

  const updates = [];
  for (const r of rows) {
    const m = Math.max(0, Math.trunc(Number(r.meter) || 0));
    if (m <= 0) continue;

    // Monotonic decay: never increase due to rounding
    let next = Math.floor(m * factor);
    if (next > m) next = m;
    if (next < 0) next = 0;

    // Optional clamp tiny values to 0 to prevent jitter
    if (minClampAbs > 0 && Math.abs(next) <= minClampAbs) next = 0;

    if (next !== m) {
      updates.push({ id: r.id, meter: next });
    }
  }

  // If nothing changed, DO NOT advance lastDecayAt.
  // This lets elapsed time accumulate until at least 1 point drops.
  if (updates.length === 0) {
    return { applied: false, updated: 0, factor, reason: 'no-integer-change-yet' };
  }

  // Apply updates in a transaction
  await prisma.$transaction(
    updates.map(u =>
      prisma.sessionFactionMeter.update({
        where: { id: u.id },
        data: { meter: u.meter }
      })
    )
  );

  // Advance the decay timestamp only when we actually changed meters
  await prisma.streamSession.update({
    where: { id: sessionId },
    data: { lastDecayAt: now }
  });

  return { applied: true, updated: updates.length, factor };
}

module.exports = {
  applyDecayIfNeeded
};
