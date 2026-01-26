// src/services/chatConfigService.js
'use strict';

const { prisma } = require('../db/prisma');
const { ensureDefaultChatCommands } = require('./chatCommandsService'); // <- NEW

// Legacy defaults (kept so older code keeps working)
const DEFAULT_CHAT_CONFIG = {
  prefix: '!',
  commands: {
    vote: { enabled: true, weight: 1, name: '!vote' }, // legacy UI / future
    hype: { enabled: true, maxDelta: 25, name: '!hype' },
    maxhype: { enabled: true, name: '!maxhype' },      // legacy expectation
  },
  // Optional per-action cooldown minutes. If omitted, uses env FACTION_SWITCH_COOLDOWN_MINUTES.
  cooldownMinutes: {
    vote: null,
    hype: null,
    maxhype: null
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
  // Keep validation intentionally light; clamp at runtime too.
  const prefix = String(cfg?.prefix ?? '').trim();
  if (!prefix || prefix.length > 4) {
    throw Object.assign(new Error('prefix must be 1–4 characters.'), { statusCode: 400 });
  }

  const hypeEnabled = cfg?.commands?.hype?.enabled !== false;
  const maxEnabled = cfg?.commands?.maxhype?.enabled !== false;
  const voteEnabled = cfg?.commands?.vote?.enabled !== false;

  if (!hypeEnabled && !maxEnabled && !voteEnabled) {
    throw Object.assign(new Error('At least one command must be enabled.'), { statusCode: 400 });
  }
}

// ---------------------------
// DB → legacy config adapter
// ---------------------------

function stripBang(s) {
  return String(s || '').trim().replace(/^!+/, '');
}

function asMinutes(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return null;
  return n / 60;
}

function buildConfigFromDbRows(rows, legacyBase) {
  // rows: ChatCommand[] with aliases
  // legacyBase: DEFAULT_CHAT_CONFIG merged with Streamer.chatConfig (for fallback)
  const cfg = JSON.parse(JSON.stringify(legacyBase || DEFAULT_CHAT_CONFIG));

  // Always enforce prefix for legacy
  cfg.prefix = cfg.prefix || '!';

  // Prepare a map of trigger → info (include aliases as additional names)
  // We keep "name" as primary command name (with leading "!") for twitchChatService parser.
  for (const row of rows || []) {
    const trig = stripBang(row.trigger).toLowerCase();
    const primaryName = `${cfg.prefix}${trig}`;

    const aliases = (row.aliases || [])
      .filter(a => a && a.alias)
      .map(a => `${cfg.prefix}${stripBang(a.alias).toLowerCase()}`);

    const enabled = row.isEnabled !== false;

    // cooldownSec stored on the command; convert to legacy cooldownMinutes
    const cooldownMin = asMinutes(row.cooldownSec);

    if (row.type === 'HYPE') {
      cfg.commands.hype = cfg.commands.hype || {};
      cfg.commands.hype.enabled = enabled;
      cfg.commands.hype.name = primaryName;
      cfg.commands.hype.aliases = aliases;
      if (row.maxDelta != null) cfg.commands.hype.maxDelta = Number(row.maxDelta);
      if (row.defaultDelta != null) cfg.commands.hype.defaultDelta = Number(row.defaultDelta);
      cfg.cooldownMinutes.hype = cooldownMin;
    }

    if (row.type === 'MAXHYPE') {
      cfg.commands.maxhype = cfg.commands.maxhype || {};
      cfg.commands.maxhype.enabled = enabled;
      cfg.commands.maxhype.name = primaryName;
      cfg.commands.maxhype.aliases = aliases;
      // Use maxDelta on maxhype too (your twitchChatService clamps using hype.maxDelta,
      // but we still store it here for future parsing)
      if (row.maxDelta != null) cfg.commands.maxhype.maxDelta = Number(row.maxDelta);
      if (row.defaultDelta != null) cfg.commands.maxhype.defaultDelta = Number(row.defaultDelta);
      cfg.cooldownMinutes.maxhype = cooldownMin;
    }

    if (row.type === 'VOTE') {
      cfg.commands.vote = cfg.commands.vote || {};
      cfg.commands.vote.enabled = enabled;
      cfg.commands.vote.name = primaryName;
      cfg.commands.vote.aliases = aliases;
      if (row.defaultDelta != null) cfg.commands.vote.weight = Number(row.defaultDelta);
      cfg.cooldownMinutes.vote = cooldownMin;
    }
  }

  return cfg;
}

// ---------------------------
// Simple cache (per streamer)
// ---------------------------

const CACHE_MS = 15_000; // 15s is plenty for chat; UI saves will reflect quickly
const cache = new Map(); // streamerId -> { at, cfg }

async function getEffectiveChatConfig(streamerId) {
  const sid = String(streamerId);

  const hit = cache.get(sid);
  if (hit && (Date.now() - hit.at) < CACHE_MS) return hit.cfg;

  // 1) Legacy JSON config (kept)
  const s = await prisma.streamer.findUnique({
    where: { id: sid },
    select: { chatConfig: true }
  });

  const legacyMerged = deepMerge(DEFAULT_CHAT_CONFIG, s?.chatConfig || {});
  validateConfig(legacyMerged);

  // 2) DB commands (new scalable system)
  // Ensure defaults exist so new streamers don't have empty command sets
  try { await ensureDefaultChatCommands(sid); } catch (_) {}

  const rows = await prisma.chatCommand.findMany({
    where: { streamerId: sid },
    include: { aliases: true }
  });

  // If rows exist, they take precedence for command definitions + cooldowns.
  // If no rows, fallback completely to legacyMerged.
  const effective = (rows && rows.length)
    ? buildConfigFromDbRows(rows, legacyMerged)
    : legacyMerged;

  // Validate again, just in case
  validateConfig(effective);

  cache.set(sid, { at: Date.now(), cfg: effective });
  return effective;
}

async function saveChatConfig(streamerId, configText) {
  const parsed = safeParseJson(configText);
  if (parsed && parsed.__parseError) {
    throw Object.assign(new Error('chatConfig must be valid JSON.'), { statusCode: 400 });
  }
  if (parsed == null) {
    // Clear config (revert to defaults)
    await prisma.streamer.update({
      where: { id: String(streamerId) },
      data: { chatConfig: null }
    });

    // bust cache so the next read reflects it immediately
    cache.delete(String(streamerId));

    return { ok: true, cleared: true };
  }

  validateConfig(parsed);

  await prisma.streamer.update({
    where: { id: String(streamerId) },
    data: { chatConfig: parsed }
  });

  cache.delete(String(streamerId));
  return { ok: true };
}

// Useful when dashboard saves DB commands and you want immediate effect.
function bustChatConfigCache(streamerId) {
  cache.delete(String(streamerId));
}

module.exports = {
  DEFAULT_CHAT_CONFIG,
  getEffectiveChatConfig,
  saveChatConfig,
  bustChatConfigCache
};
