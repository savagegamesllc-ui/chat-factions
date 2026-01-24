// src/services/cooldownService.js
'use strict';

const { prisma } = require('../db/prisma');

async function checkAndTouchCooldown(sessionId, action, userKey, overrideMinutes) {
  const sid = String(sessionId || '');
  const act = String(action || '').trim();
  const u = String(userKey || '').trim();

  if (!sid || !act || !u) return false;

  const minsNum = Number(overrideMinutes);
  const minutes = Number.isFinite(minsNum) && minsNum > 0 ? minsNum : 60;

  const existing = await prisma.voteCooldown.findUnique({
    where: { sessionId_action_userKey: { sessionId: sid, action: act, userKey: u } },
  });

  const now = Date.now();

  if (!existing) {
    await prisma.voteCooldown.create({
      data: { sessionId: sid, action: act, userKey: u },
    });
    return true;
  }

  const last = new Date(existing.lastAt).getTime();
  const waitMs = minutes * 60 * 1000;

  if (now - last < waitMs) return false;

  await prisma.voteCooldown.update({
    where: { id: existing.id },
    data: { lastAt: new Date() },
  });

  return true;
}

module.exports = {
  checkAndTouchCooldown,
};
