// src/services/eventConfigService.js
'use strict';

const { prisma } = require('../db/prisma');

const DEFAULT_EVENT_CONFIG = {
  enabled: true,

  // Which faction gets hype from monetization events:
  // - "leader": current leading faction in the active session
  // - "default": always use defaultFactionKey
  factionPolicy: 'leader',

  // Used when factionPolicy is "default" OR when leader cannot be determined yet.
  defaultFactionKey: 'ORDER',

  // Hype mapping defaults (simple + sane)
  cheer: {
    enabled: true,
    bitsPerStep: 100,   // every 100 bits...
    hypePerStep: 5,     // ...adds 5 hype
    maxDelta: 100       // cap per event (safety)
  },
  sub: {
    enabled: true,
    hype: 25,
    maxDelta: 100
  },
  gift: {
    enabled: true,
    hype: 25,
    maxDelta: 200
  },
  resub: {
    enabled: true,
    hype: 15,
    maxDelta: 100
  }
};

function deepMerge(base, override) {
  if (base == null) return override ?? null;
  if (override == null) return base ?? null;
  if (Array.isArray(base) || Array.isArray(override)) return override;
  if (typeof base === 'object' && typeof override === 'object') {
    const out = { ...base };
    for (const k of Object.keys(override)) out[k] = deepMerge(base[k], override[k]);
    return out;
  }
  return override;
}

function clampInt(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  n = Math.trunc(n);
  return Math.max(lo, Math.min(hi, n));
}

function validateEventConfig(cfg) {
  const enabled = cfg?.enabled;
  if (enabled === false) return;

  const fp = String(cfg?.factionPolicy || 'leader');
  if (!['leader', 'default'].includes(fp)) {
    throw Object.assign(new Error('eventConfig.factionPolicy must be "leader" or "default".'), { statusCode: 400 });
  }

  const dfk = String(cfg?.defaultFactionKey || '').trim();
  if (!dfk) {
    throw Object.assign(new Error('eventConfig.defaultFactionKey is required.'), { statusCode: 400 });
  }

  // light numeric clamps (hard clamps still applied at runtime)
  if (cfg?.cheer) {
    clampInt(cfg.cheer.bitsPerStep ?? 100, 1, 1000000);
    clampInt(cfg.cheer.hypePerStep ?? 5, 0, 1000000);
    clampInt(cfg.cheer.maxDelta ?? 100, 0, 1000000);
  }
}

async function getEffectiveEventConfig(streamerId) {
  const s = await prisma.streamer.findUnique({
    where: { id: String(streamerId) },
    select: { eventConfig: true }
  });

  const merged = deepMerge(DEFAULT_EVENT_CONFIG, s?.eventConfig || {});
  validateEventConfig(merged);
  return merged;
}

async function saveEventConfig(streamerId, cfg) {
  validateEventConfig(cfg);
  await prisma.streamer.update({
    where: { id: String(streamerId) },
    data: { eventConfig: cfg }
  });
  return { ok: true };
}

module.exports = {
  DEFAULT_EVENT_CONFIG,
  getEffectiveEventConfig,
  saveEventConfig
};
