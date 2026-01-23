// src/services/overlayRenderService.js
'use strict';

const { prisma } = require('../db/prisma');

function normalizeToken(raw) {
  return String(raw || '').trim().replace(/^"+|"+$/g, '');
}

function normalizeStyleKey(styleKey) {
  const s = String(styleKey || '').trim();
  return s.toLowerCase().endsWith('.js') ? s.slice(0, -3) : s;
}

function safeJson(v) {
  return v == null ? {} : v;
}

function hasProAccess(streamer) {
  return streamer && (streamer.planTier === 'PRO' || streamer.proOverride === true);
}

async function resolveOverlayByToken(rawToken, slot = 0) {
  const token = normalizeToken(rawToken);
  if (!token) throw Object.assign(new Error('Missing overlay token.'), { statusCode: 400 });

  const slotNum = Number(slot);
  if (!Number.isInteger(slotNum) || slotNum < 0 || slotNum > 3) {
    throw Object.assign(new Error('Invalid slot (must be 0..3).'), { statusCode: 400 });
  }

  const streamer = await prisma.streamer.findUnique({
    where: { overlayToken: token },
    select: {
      id: true,
      displayName: true,
      planTier: true,
      proOverride: true
    }
  });

  if (!streamer) {
    throw Object.assign(new Error(`Overlay not found (no streamer for token: ${token}).`), { statusCode: 404 });
  }

  const proOk = hasProAccess(streamer);

  // Extra slots are PRO-only
  if (slotNum > 0 && !proOk) {
    return {
      streamerId: streamer.id,
      styleKey: 'error',
      layout: null,
      effectiveConfig: {},
      blockedReason: 'Additional overlay slots (1–3) require PRO.'
    };
  }

  // --- Layout resolution (slot selection -> legacy slot0 -> enabled fallback -> first FREE active) ---
  let selected = await prisma.streamerLayout.findFirst({
    where: { streamerId: streamer.id, selectedSlot: slotNum, isEnabled: true },
    include: { layout: true }
  });

  // Legacy fallback for slot 0
  if (!selected && slotNum === 0) {
    selected = await prisma.streamerLayout.findFirst({
      where: { streamerId: streamer.id, isSelected: true, isEnabled: true },
      include: { layout: true }
    });
  }

  let chosenLayout = selected?.layout || null;
  let overrideConfig = selected?.overrideConfig || null;

  if (!chosenLayout) {
    const anyEnabled = await prisma.streamerLayout.findFirst({
      where: { streamerId: streamer.id, isEnabled: true },
      orderBy: { updatedAt: 'desc' },
      include: { layout: true }
    });
    chosenLayout = anyEnabled?.layout || null;
    overrideConfig = anyEnabled?.overrideConfig || null;
  }

  if (!chosenLayout) {
    chosenLayout = await prisma.overlayLayout.findFirst({
      where: { isActive: true, tier: 'FREE' },
      orderBy: { createdAt: 'asc' }
    });
    overrideConfig = null;
  }

  if (!chosenLayout) {
    return {
      streamerId: streamer.id,
      styleKey: 'error',
      layout: null,
      effectiveConfig: {},
      blockedReason: 'No overlay layouts exist yet. Owner must create at least one layout.'
    };
  }

  // Tier gate for PRO layouts
  if (chosenLayout.tier === 'PRO' && !proOk) {
    return {
      streamerId: streamer.id,
      styleKey: normalizeStyleKey(chosenLayout.styleKey),
      layout: chosenLayout,
      effectiveConfig: safeJson(chosenLayout.defaultConfig || chosenLayout.config),
      blockedReason: 'PRO layout selected but streamer is not PRO.'
    };
  }

  const defaultCfg = safeJson(chosenLayout.defaultConfig || chosenLayout.config);
  const overrideCfg = safeJson(overrideConfig);
  const effectiveConfig = { ...defaultCfg, ...overrideCfg };

  return {
    streamerId: streamer.id,
    styleKey: normalizeStyleKey(chosenLayout.styleKey),
    layout: chosenLayout,
    effectiveConfig,
    blockedReason: null
  };
}

module.exports = { resolveOverlayByToken };
