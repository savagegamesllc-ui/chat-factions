// src/services/meterService.js
'use strict';

const { prisma } = require('../db/prisma');
const { getOrCreateActiveSession } = require('./sessionService');
const { applyDecayIfNeeded } = require('./decayService');


function clampInt(n, min, max) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

/**
 * Returns faction list for streamer (active only by default)
 */
async function listActiveFactions(streamerId) {
  return prisma.faction.findMany({
    where: { streamerId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, key: true, name: true, colorHex: true, sortOrder: true }
  });
}

async function getMetersSnapshot(streamerId) {
  const session = await getOrCreateActiveSession(streamerId);
  await applyDecayIfNeeded(streamerId, session.id);
  const factions = await listActiveFactions(streamerId);

  const meters = await prisma.sessionFactionMeter.findMany({
    where: { sessionId: session.id },
    select: { factionId: true, meter: true, updatedAt: true }
  });

  const byFactionId = new Map(meters.map(m => [m.factionId, m]));

  const out = factions.map(f => ({
    factionId: f.id,
    key: f.key,
    name: f.name,
    colorHex: f.colorHex,
    sortOrder: f.sortOrder,
    meter: byFactionId.get(f.id)?.meter ?? 0
  }));

  return {
    sessionId: session.id,
    streamerId,
    factions: out,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Apply a "hype" delta to a faction meter for the active session.
 * Creates SessionFactionMeter rows lazily.
 */
async function addHype(streamerId, factionKey, delta, source, meta) {
  const session = await getOrCreateActiveSession(streamerId);
  await applyDecayIfNeeded(streamerId, session.id);
  const faction = await prisma.faction.findUnique({
    where: { streamerId_key: { streamerId, key: String(factionKey).toUpperCase() } },
    select: { id: true, key: true, isActive: true }
  });

  if (!faction || !faction.isActive) {
    throw Object.assign(new Error('Faction not found or inactive.'), { statusCode: 404 });
  }

  const inc = clampInt(delta, -1000000, 1000000);
  if (inc === 0) return { ok: true, sessionId: session.id };

  // Upsert meter row then increment
  const meterRow = await prisma.sessionFactionMeter.upsert({
    where: { sessionId_factionId: { sessionId: session.id, factionId: faction.id } },
    update: { meter: { increment: inc } },
    create: {
      sessionId: session.id,
      factionId: faction.id,
      meter: inc
    }
  });

  // Log event (optional but useful)
  await prisma.eventLog.create({
    data: {
      streamerId,
      sessionId: session.id,
      type: 'HYPE_EVENT',
      payload: {
        factionKey: faction.key,
        delta: inc,
        source: source || 'api',
        meta: meta || null
      }
    }
  });

  return { ok: true, sessionId: session.id, factionId: faction.id, meter: meterRow.meter };
}
async function setHype(streamerId, factionKey, value, source, meta) {
  const session = await getOrCreateActiveSession(streamerId);
  await applyDecayIfNeeded(streamerId, session.id);
  const faction = await prisma.faction.findUnique({
    where: { streamerId_key: { streamerId, key: String(factionKey).toUpperCase() } },
    select: { id: true, key: true, isActive: true }
  });

  if (!faction || !faction.isActive) {
    throw Object.assign(new Error('Faction not found or inactive.'), { statusCode: 404 });
  }

  const v = clampInt(value, -100000000, 100000000);

  const meterRow = await prisma.sessionFactionMeter.upsert({
    where: { sessionId_factionId: { sessionId: session.id, factionId: faction.id } },
    update: { meter: v },
    create: {
      sessionId: session.id,
      factionId: faction.id,
      meter: v
    }
  });

  await prisma.eventLog.create({
    data: {
      streamerId,
      sessionId: session.id,
      type: 'HYPE_SET',
      payload: {
        factionKey: faction.key,
        value: v,
        source: source || 'api',
        meta: meta || null
      }
    }
  });

  return { ok: true, sessionId: session.id, factionId: faction.id, meter: meterRow.meter };
}

async function resetHype(streamerId, factionKey, source, meta) {
  return setHype(streamerId, factionKey, 0, source || 'api', meta);
}

async function bulkAddHype(streamerId, items, source, meta) {
  // items: [{ factionKey, delta }]
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('items must be a non-empty array.'), { statusCode: 400 });
  }

  // Apply sequentially for correctness (simple). We can optimize later.
  const results = [];
  for (const it of items) {
    const fk = String(it?.factionKey || '');
    const d = it?.delta ?? 0;
    if (!fk) continue;
    results.push(await addHype(streamerId, fk, d, source, meta));
  }
  return { ok: true, count: results.length, results };
}

module.exports = {
  getMetersSnapshot,
  addHype,
  setHype,
  resetHype,
  bulkAddHype
};

