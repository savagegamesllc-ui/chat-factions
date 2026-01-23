// src/routes/services/layoutSelectionService.js
'use strict';

const { prisma } = require('../db/prisma'); // keep consistent with how other route-services import prisma

function isProAllowed(streamer) {
  return streamer.planTier === 'PRO' || streamer.proOverride === true;
}

function safeParseJsonOrThrow(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null; // treat blank as "clear override"
  try {
    const obj = JSON.parse(trimmed);
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('overrideConfig must be a JSON object.');
    }
    return obj;
  } catch (e) {
    throw Object.assign(new Error(`Invalid JSON: ${e.message}`), { statusCode: 400 });
  }
}

async function getLayoutsForStreamer(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { id: true, planTier: true, proOverride: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  const proOk = isProAllowed(streamer);

  // Active layouts only
  const layouts = await prisma.overlayLayout.findMany({
    where: { isActive: true },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      tier: true,
      styleKey: true,
      defaultConfig: true
    }
  });

  // Streamer join rows (enabled/selected/override)
  const joins = await prisma.streamerLayout.findMany({
    where: { streamerId },
    select: {
      layoutId: true,
      isEnabled: true,
      isSelected: true,
      overrideConfig: true
    }
  });

  const joinByLayoutId = new Map(joins.map(j => [j.layoutId, j]));

  const out = layouts.map(l => {
    const j = joinByLayoutId.get(l.id);
    const accessible = l.tier === 'FREE' || proOk;

    return {
      id: l.id,
      name: l.name,
      tier: l.tier,
      styleKey: l.styleKey,
      defaultConfig: l.defaultConfig,

      // join-derived
      isEnabled: j ? j.isEnabled : true,
      isSelected: j ? j.isSelected : false,
      overrideConfig: j ? j.overrideConfig : null,

      // computed for UI gating
      isAccessible: accessible
    };
  });

  return { streamer, layouts: out };
}

async function selectLayout(streamerId, layoutId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { id: true, planTier: true, proOverride: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  const layout = await prisma.overlayLayout.findUnique({
    where: { id: layoutId },
    select: { id: true, tier: true, isActive: true, name: true }
  });
  if (!layout || !layout.isActive) {
    throw Object.assign(new Error('Layout not found.'), { statusCode: 404 });
  }

  // ✅ PRO gating (server-side)
  if (layout.tier === 'PRO' && !isProAllowed(streamer)) {
    throw Object.assign(new Error('PRO required to select this layout.'), { statusCode: 403 });
  }

  // Ensure join exists
  await prisma.streamerLayout.upsert({
    where: { streamerId_layoutId: { streamerId, layoutId } },
    create: { streamerId, layoutId, isEnabled: true, isSelected: false },
    update: {}
  });

  // Only one selected at a time
  await prisma.streamerLayout.updateMany({
    where: { streamerId, isSelected: true },
    data: { isSelected: false }
  });

  await prisma.streamerLayout.update({
    where: { streamerId_layoutId: { streamerId, layoutId } },
    data: { isSelected: true }
  });

  return { ok: true, selectedLayoutId: layoutId };
}

async function saveOverrideConfig(streamerId, layoutId, overrideConfigText) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { id: true, planTier: true, proOverride: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  const layout = await prisma.overlayLayout.findUnique({
    where: { id: layoutId },
    select: { id: true, tier: true, isActive: true }
  });
  if (!layout || !layout.isActive) {
    throw Object.assign(new Error('Layout not found.'), { statusCode: 404 });
  }

  // ✅ PRO gating (server-side) for override edits too (optional but consistent)
  if (layout.tier === 'PRO' && !isProAllowed(streamer)) {
    throw Object.assign(new Error('PRO required to edit overrideConfig for this layout.'), { statusCode: 403 });
  }

  const overrideObj = safeParseJsonOrThrow(overrideConfigText);

  await prisma.streamerLayout.upsert({
    where: { streamerId_layoutId: { streamerId, layoutId } },
    create: {
      streamerId,
      layoutId,
      isEnabled: true,
      isSelected: false,
      overrideConfig: overrideObj
    },
    update: {
      overrideConfig: overrideObj
    }
  });

  return { ok: true };
}

module.exports = {
  getLayoutsForStreamer,
  selectLayout,
  saveOverrideConfig
};
