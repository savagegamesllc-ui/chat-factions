// src/services/layoutSelectionService.js
'use strict';

const { prisma } = require('../db/prisma');

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

function hasProAccess(streamer) {
  return streamer && (streamer.planTier === 'PRO' || streamer.proOverride === true);
}

async function getLayoutsForStreamer(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { id: true, planTier: true, proOverride: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  const [layouts, joins] = await Promise.all([
    prisma.overlayLayout.findMany({
      where: { isActive: true },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }]
    }),
    prisma.streamerLayout.findMany({
      where: { streamerId },
      select: {
        id: true,
        layoutId: true,
        isEnabled: true,
        isSelected: true,
        selectedSlot: true,
        overrideConfig: true
      }
    })
  ]);

  const joinByLayoutId = new Map(joins.map(j => [j.layoutId, j]));
  const proOk = hasProAccess(streamer);

  const merged = layouts.map(l => {
    const j = joinByLayoutId.get(l.id) || null;

    const isProLayout = l.tier === 'PRO';
    const isAccessible = !isProLayout || proOk;

    return {
      id: l.id,
      name: l.name,
      tier: l.tier,
      styleKey: l.styleKey,
      isActive: l.isActive,
      defaultConfig: l.defaultConfig,
      metadata: l.metadata,

      // Join state (if created)
      isEnabled: j ? j.isEnabled : true,

      // Legacy (slot0) + new slot selection info
      isSelected: j ? j.isSelected : false,
      selectedSlot: j ? j.selectedSlot : null,

      overrideConfig: j ? j.overrideConfig : null,

      // Computed
      isAccessible
    };
  });

  return { streamer, layouts: merged };
}

async function ensureJoinRow(streamerId, layoutId) {
  const existing = await prisma.streamerLayout.findUnique({
    where: { streamerId_layoutId: { streamerId, layoutId } }
  });
  if (existing) return existing;

  return prisma.streamerLayout.create({
    data: {
      streamerId,
      layoutId,
      isEnabled: true,
      isSelected: false,
      selectedSlot: null
    }
  });
}

/**
 * Select a layout for a given slot.
 * slot 0 is the "main" overlay (legacy compatible).
 * slots 1-3 require PRO.
 */
async function selectLayoutForSlot(streamerId, layoutId, slot) {
  const slotNum = Number(slot);
  if (!Number.isInteger(slotNum) || slotNum < 0 || slotNum > 3) {
    throw Object.assign(new Error('slot must be an integer 0..3'), { statusCode: 400 });
  }

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { id: true, planTier: true, proOverride: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  // PRO feature gate for extra slots
  if (slotNum > 0 && !hasProAccess(streamer)) {
    throw Object.assign(new Error('Additional overlay slots require PRO.'), { statusCode: 403 });
  }

  const layout = await prisma.overlayLayout.findUnique({ where: { id: layoutId } });
  if (!layout || !layout.isActive) {
    throw Object.assign(new Error('Layout not found or inactive.'), { statusCode: 404 });
  }

  // Tier gate: selecting a PRO layout requires PRO
  if (layout.tier === 'PRO' && !hasProAccess(streamer)) {
    throw Object.assign(new Error('This layout requires PRO.'), { statusCode: 403 });
  }

  const join = await ensureJoinRow(streamerId, layoutId);
  if (!join.isEnabled) {
    throw Object.assign(new Error('This layout is disabled for your account.'), { statusCode: 403 });
  }

  // Transaction:
  // - Clear any existing layout selected for this slot (selectedSlot=slot)
  // - Select this layout for the slot
  // - For slot0 also maintain legacy isSelected flag
  const ops = [
    prisma.streamerLayout.updateMany({
      where: { streamerId, selectedSlot: slotNum },
      data: { selectedSlot: null, isSelected: false }
    }),
    prisma.streamerLayout.updateMany({
      where: { streamerId, isSelected: true },
      data: (slotNum === 0) ? { isSelected: false } : {}
    }),
    prisma.streamerLayout.update({
      where: { id: join.id },
      data: {
        selectedSlot: slotNum,
        isSelected: slotNum === 0 ? true : join.isSelected
      }
    })
  ];

  await prisma.$transaction(ops);

  return { ok: true, slot: slotNum };
}

// Backward compatible: old selection endpoint selects slot 0
async function selectLayout(streamerId, layoutId) {
  return selectLayoutForSlot(streamerId, layoutId, 0);
}

async function getSelectedLayoutForSlot(streamerId, slot) {
  const slotNum = Number(slot);
  if (!Number.isInteger(slotNum) || slotNum < 0 || slotNum > 3) return null;

  // Prefer new slot selection
  const selected = await prisma.streamerLayout.findFirst({
    where: { streamerId, selectedSlot: slotNum, isEnabled: true },
    include: { layout: true }
  });

  if (selected) return selected;

  // Legacy fallback for slot 0
  if (slotNum === 0) {
    const legacy = await prisma.streamerLayout.findFirst({
      where: { streamerId, isSelected: true, isEnabled: true },
      include: { layout: true }
    });
    return legacy || null;
  }

  return null;
}

async function saveOverrideConfig(streamerId, layoutId, overrideConfigText) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { id: true, planTier: true, proOverride: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  const layout = await prisma.overlayLayout.findUnique({ where: { id: layoutId } });
  if (!layout || !layout.isActive) {
    throw Object.assign(new Error('Layout not found or inactive.'), { statusCode: 404 });
  }

  // Tier gate
  const proOk = hasProAccess(streamer);
  if (layout.tier === 'PRO' && !proOk) {
    throw Object.assign(new Error('This layout requires PRO.'), { statusCode: 403 });
  }

  const join = await ensureJoinRow(streamerId, layoutId);
  if (!join.isEnabled) {
    throw Object.assign(new Error('This layout is disabled for your account.'), { statusCode: 403 });
  }

  const parsed = safeParseJson(overrideConfigText);
  if (parsed && parsed.__parseError) {
    throw Object.assign(new Error('overrideConfig must be valid JSON.'), { statusCode: 400 });
  }

  const value = parsed == null ? null : parsed;

  await prisma.streamerLayout.update({
    where: { id: join.id },
    data: { overrideConfig: value }
  });

  return { ok: true };
}

module.exports = {
  getLayoutsForStreamer,
  selectLayout,             // legacy slot 0
  selectLayoutForSlot,      // NEW
  getSelectedLayoutForSlot, // NEW
  saveOverrideConfig
};
