// src/services/sessionService.js
'use strict';

const { prisma } = require('../db/prisma');

async function getOrCreateActiveSession(streamerId) {
  const sid = String(streamerId || '');
  if (!sid) throw new Error('Missing streamerId');

  // active session = endedAt null
  let session = await prisma.streamSession.findFirst({
    where: { streamerId: sid, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) {
    session = await prisma.streamSession.create({
      data: { streamerId: sid },
    });
  }

  // Ensure meters exist for all active factions
  const factions = await prisma.faction.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  });

  // Create missing meters (idempotent)
  for (const f of factions) {
    await prisma.sessionFactionMeter.upsert({
      where: {
        sessionId_factionId: { sessionId: session.id, factionId: f.id },
      },
      create: {
        sessionId: session.id,
        factionId: f.id,
        meter: 0,
      },
      update: {},
    });
  }

  return session;
}

module.exports = {
  getOrCreateActiveSession,
};
