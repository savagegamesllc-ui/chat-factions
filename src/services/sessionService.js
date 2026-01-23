// src/services/sessionService.js
'use strict';

const { prisma } = require('../db/prisma');

/**
 * Find an active session (endedAt is null) or create one.
 * Keeps sessions per streamer.
 */
async function getOrCreateActiveSession(streamerId) {
  const existing = await prisma.streamSession.findFirst({
    where: { streamerId, endedAt: null },
    orderBy: { startedAt: 'desc' }
  });

  if (existing) return existing;

  return prisma.streamSession.create({
    data: {
      streamerId,
      startedAt: new Date(),
      votingOpen: true,
      votingChangedAt: new Date()
    }
  });
}

module.exports = {
  getOrCreateActiveSession
};
