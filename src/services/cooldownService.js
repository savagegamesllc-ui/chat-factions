// src/services/cooldownService.js
'use strict';

const { prisma } = require('../db/prisma');
const { config } = require('../config/env');

/**
 * Returns true if allowed, false if still on cooldown.
 * Uses VoteCooldown(sessionId, action, userKey).
 *
 * Cooldown minutes from env: FACTION_SWITCH_COOLDOWN_MINUTES (fallback 60)
 */
async function checkAndTouchCooldown(sessionId, action, userKey, overrideMinutes) {
    const minutesRaw = overrideMinutes == null ? config.factionSwitchCooldownMinutes : overrideMinutes;
  const minutes = Number(minutesRaw || 60);

  const cooldownMs = Math.max(0, minutes) * 60 * 1000;
  if (cooldownMs === 0) return true;

  const now = new Date();
  const cutoff = new Date(Date.now() - cooldownMs);

  // Find existing cooldown row
  const existing = await prisma.voteCooldown.findUnique({
    where: { sessionId_action_userKey: { sessionId, action, userKey } },
    select: { id: true, lastAt: true }
  });

  if (!existing) {
    await prisma.voteCooldown.create({
      data: { sessionId, action, userKey, lastAt: now }
    });
    return true;
  }

  // still cooling down?
  if (existing.lastAt && existing.lastAt > cutoff) return false;

  await prisma.voteCooldown.update({
    where: { id: existing.id },
    data: { lastAt: now }
  });

  return true;
}

module.exports = {
  checkAndTouchCooldown
};
