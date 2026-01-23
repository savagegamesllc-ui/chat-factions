// src/services/systemHealthService.js
'use strict';

const { prisma } = require('../db/prisma');

async function getSystemHealth() {
  const [
    streamerCount,
    layoutCount,
    activeLayoutCount,
    factionCount,
    lastErrors
  ] = await Promise.all([
    prisma.streamer.count(),
    prisma.overlayLayout.count(),
    prisma.overlayLayout.count({ where: { isActive: true } }),
    prisma.faction.count(),
    prisma.appErrorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  return {
    streamerCount,
    layoutCount,
    activeLayoutCount,
    factionCount,
    lastErrors
  };
}

async function listStreamers({ take = 100 } = {}) {
  return prisma.streamer.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      twitchUserId: true,
      login: true,
      displayName: true,
      planTier: true,
      proOverride: true,
      createdAt: true,
      overlayToken: true
    }
  });
}

module.exports = {
  getSystemHealth,
  listStreamers
};
