// src/services/hypePolicyService.js
'use strict';

const { prisma } = require('../db/prisma');

async function pickFactionLeader(streamerId, sessionId, fallbackKey) {
  // Pick highest meter faction for this session
  const top = await prisma.sessionFactionMeter.findFirst({
    where: { sessionId: String(sessionId) },
    select: { meter: true, faction: { select: { key: true, sortOrder: true } } },
    orderBy: [
      { meter: 'desc' },
      { faction: { sortOrder: 'asc' } },
      { faction: { key: 'asc' } }
    ]
  });

  if (top?.faction?.key) return top.faction.key;

  // If no meters yet, fall back to the first active faction
  const firstFaction = await prisma.faction.findFirst({
    where: { streamerId: String(streamerId), isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    select: { key: true }
  });

  return firstFaction?.key || fallbackKey || null;
}

async function resolveFactionKey({ streamerId, sessionId, eventCfg }) {
  const policy = String(eventCfg?.factionPolicy || 'leader');
  const fallback = String(eventCfg?.defaultFactionKey || 'ORDER').toUpperCase();

  if (policy === 'default') return fallback;
  return pickFactionLeader(streamerId, sessionId, fallback);
}

module.exports = { resolveFactionKey };
