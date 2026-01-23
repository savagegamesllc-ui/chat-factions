// src/services/streamerService.js
'use strict';

const { prisma } = require('../db/prisma');

async function getStreamerById(id) {
  if (!id) return null;
  return prisma.streamer.findUnique({
    where: { id },
    select: {
      id: true,
      twitchUserId: true,
      login: true,
      displayName: true,
      email: true,
      overlayToken: true,
      planTier: true,
      proOverride: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true
    }
  });
}

module.exports = {
  getStreamerById
};
