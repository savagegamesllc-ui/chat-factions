// src/services/chatConfigService.js
'use strict';

const { prisma } = require('../db/prisma');

const DEFAULT_CHAT_CONFIG = {
  prefix: '!',
  commands: {
    vote: { enabled: true, weight: 1 },      // !vote ORDER
    hype: { enabled: true, maxDelta: 25 }    // !hype ORDER 10 (clamped to +/- maxDelta)
  },
  // Optional per-action cooldown minutes. If omitted, uses env FACTION_SWITCH_COOLDOWN_MINUTES.
  cooldownMinutes: {
    vote: null,
    hype: null
  },
    decay: {
    enabled: true,
    // percent per minute (2 means reduce meters by 2% per minute)
    percentPerMinute: 2,
    // clamp so tiny meters don't jitter forever
    minClampAbs: 0
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

function safeParseJson(text) {
  if (text == null) return null;
  const raw = String(text).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { __parseError: true };
  }
}

function validateConfig(cfg) {
  // Keep validation intentionally light; we clamp at runtime too.
  const prefix = String(cfg?.prefix ?? '').trim();
  if (!prefix || prefix.length > 4) {
    throw Object.assign(new Error('prefix must be 1–4 characters.'), { statusCode: 400 });
  }

  const voteEnabled = cfg?.commands?.vote?.enabled;
  const hypeEnabled = cfg?.commands?.hype?.enabled;
  if (voteEnabled === false && hypeEnabled === false) {
    throw Object.assign(new Error('At least one command must be enabled.'), { statusCode: 400 });
  }
}

async function getEffectiveChatConfig(streamerId) {
  const s = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { chatConfig: true }
  });
  const merged = deepMerge(DEFAULT_CHAT_CONFIG, s?.chatConfig || {});
  // Ensure defaults always valid
  validateConfig(merged);
  return merged;
}

async function saveChatConfig(streamerId, configText) {
  const parsed = safeParseJson(configText);
  if (parsed && parsed.__parseError) {
    throw Object.assign(new Error('chatConfig must be valid JSON.'), { statusCode: 400 });
  }
  if (parsed == null) {
    // Clear config (revert to defaults)
    await prisma.streamer.update({
      where: { id: streamerId },
      data: { chatConfig: null }
    });
    return { ok: true, cleared: true };
  }

  validateConfig(parsed);

  await prisma.streamer.update({
    where: { id: streamerId },
    data: { chatConfig: parsed }
  });

  return { ok: true };
}

module.exports = {
  DEFAULT_CHAT_CONFIG,
  getEffectiveChatConfig,
  saveChatConfig
};
