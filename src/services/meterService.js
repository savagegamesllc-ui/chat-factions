// src/services/meterService.js
'use strict';

const { prisma } = require('../db/prisma');
const { getOrCreateActiveSession } = require('./sessionService');

function normFactionKey(k) {
  return String(k || '').trim().toUpperCase();
}

function toNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Returns a consistent snapshot shape.
 * - meters: legacy array (your current server shape)
 * - factions: overlay-friendly alias of meters (same items)
 */
async function getMetersSnapshot(streamerId) {
  const sid = String(streamerId);
  const session = await getOrCreateActiveSession(sid);

  const rows = await prisma.sessionFactionMeter.findMany({
    where: { sessionId: session.id },
    include: { faction: true },
    orderBy: [{ faction: { sortOrder: 'asc' } }, { faction: { key: 'asc' } }],
  });

  const list = rows.map((r) => ({
    factionKey: r.faction.key,
    key: r.faction.key,              // extra convenience
    name: r.faction.name,
    colorHex: r.faction.colorHex,
    meter: toNumber(r.meter, 0),
  }));

  return {
    ok: true,
    streamerId: sid,
    sessionId: session.id,
    updatedAt: new Date().toISOString(),
    // Legacy/current
    meters: list,
    // Overlay-friendly alias (same array)
    factions: list,
  };
}

/**
 * Adds hype to a faction for the streamer's active session.
 * Fix: faction lookup MUST use compound unique (streamerId_key).
 */
async function addHype(streamerId, factionKey, delta, source = 'chat', meta = {}) {
  const sid = String(streamerId);
  const session = await getOrCreateActiveSession(sid);
  const key = normFactionKey(factionKey);

  // ✅ Correct compound-unique lookup
  const faction = await prisma.faction.findUnique({
    where: {
      streamerId_key: {
        streamerId: sid,
        key,
      },
    },
  });

  if (!faction) {
    const e = new Error(`Unknown faction key for streamer ${sid}: ${key}`);
    e.statusCode = 400;
    throw e;
  }

  // Ensure row exists
  const row = await prisma.sessionFactionMeter.upsert({
    where: { sessionId_factionId: { sessionId: session.id, factionId: faction.id } },
    create: { sessionId: session.id, factionId: faction.id, meter: 0 },
    update: {},
  });

  const d = toNumber(delta, 0);
  const current = toNumber(row.meter, 0);
  const next = Math.max(0, current + d);

  await prisma.sessionFactionMeter.update({
    where: { id: row.id },
    data: { meter: next },
  });

  await prisma.eventLog.create({
    data: {
      streamerId: sid,
      type: 'hype',
      payload: {
        source: String(source || 'chat'),
        factionKey: key,
        delta: d,
        meter: next,
        meta: meta || {},
      },
    },
  });

  return { ok: true, sessionId: session.id, factionKey: key, meter: next };
}

module.exports = {
  addHype,
  getMetersSnapshot,
};
