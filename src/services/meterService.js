// src/services/metersService.js
'use strict';

const { prisma } = require('../db/prisma');
const { getOrCreateActiveSession } = require('./sessionService');

function normFactionKey(k) {
  return String(k || '').trim().toUpperCase();
}

async function getMetersSnapshot(streamerId) {
  const session = await getOrCreateActiveSession(streamerId);

  const rows = await prisma.sessionFactionMeter.findMany({
    where: { sessionId: session.id },
    include: { faction: true },
    orderBy: [{ faction: { sortOrder: 'asc' } }, { faction: { key: 'asc' } }],
  });

  return {
    ok: true,
    streamerId: String(streamerId),
    sessionId: session.id,
    updatedAt: new Date().toISOString(),
    meters: rows.map((r) => ({
      factionKey: r.faction.key,
      name: r.faction.name,
      colorHex: r.faction.colorHex,
      meter: r.meter,
    })),
  };
}

async function addHype(streamerId, factionKey, delta, source = 'chat', meta = {}) {
  const session = await getOrCreateActiveSession(streamerId);
  const key = normFactionKey(factionKey);

  const faction = await prisma.faction.findUnique({ where: { key } });
  if (!faction) {
    const e = new Error(`Unknown faction key: ${key}`);
    e.statusCode = 400;
    throw e;
  }

  // Ensure meter row exists
  const meterRow = await prisma.sessionFactionMeter.upsert({
    where: { sessionId_factionId: { sessionId: session.id, factionId: faction.id } },
    create: { sessionId: session.id, factionId: faction.id, meter: 0 },
    update: {},
  });

  // Apply delta (clamp at 0 min)
  const next = Math.max(0, Number(meterRow.meter || 0) + Number(delta || 0));

  await prisma.sessionFactionMeter.update({
    where: { id: meterRow.id },
    data: { meter: next },
  });

  // Analytics log
  await prisma.eventLog.create({
    data: {
      streamerId: String(streamerId),
      type: 'hype',
      source: String(source || 'chat'),
      payload: {
        factionKey: key,
        delta: Number(delta || 0),
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
