// src/services/dashboardService.js
'use strict';

const { prisma } = require('../db/prisma');

async function getDashboardSummary(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      id: true,
      displayName: true,
      login: true,
      overlayToken: true,
      planTier: true,
      proOverride: true
    }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  const selected = await prisma.streamerLayout.findFirst({
    where: { streamerId, isSelected: true },
    include: { layout: true }
  });

  return {
    streamer,
    selectedLayout: selected
      ? {
          id: selected.layout.id,
          name: selected.layout.name,
          tier: selected.layout.tier,
          styleKey: selected.layout.styleKey,
          // Effective config: defaultConfig + overrideConfig later (Phase 5)
          defaultConfig: selected.layout.defaultConfig,
          overrideConfig: selected.overrideConfig
        }
      : null
  };
}

module.exports = {
  getDashboardSummary
};
