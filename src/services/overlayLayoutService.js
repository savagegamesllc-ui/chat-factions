// src/services/overlayLayoutService.js
'use strict';

const { prisma } = require('../db/prisma');

function normalizeTier(v) {
  const t = String(v || '').toUpperCase();
  return t === 'PRO' ? 'PRO' : 'FREE';
}

function toBool(v) {
  // Accept: "on", "true", true, "1", 1
  if (v === true || v === 1) return true;
  const s = String(v || '').toLowerCase();
  return s === 'on' || s === 'true' || s === '1';
}

function safeParseJson(text) {
  if (text == null) return null;
  const raw = String(text).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { __parseError: 'Invalid JSON', __raw: raw };
  }
}

async function listLayouts({ includeInactive = true } = {}) {
  return prisma.overlayLayout.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }]
  });
}

async function getLayoutById(id) {
  return prisma.overlayLayout.findUnique({ where: { id } });
}

async function createLayout(input) {
  const name = String(input.name || '').trim();
  const styleKey = String(input.styleKey || '').trim();

  if (!name) throw Object.assign(new Error('Name is required.'), { statusCode: 400 });
  if (!styleKey) throw Object.assign(new Error('styleKey is required.'), { statusCode: 400 });

  const tier = normalizeTier(input.tier);
  const isActive = toBool(input.isActive);

  const defaultConfig = safeParseJson(input.defaultConfig);
  if (defaultConfig && defaultConfig.__parseError) {
    throw Object.assign(new Error('defaultConfig must be valid JSON.'), { statusCode: 400 });
  }

  const metadata = safeParseJson(input.metadata);
  if (metadata && metadata.__parseError) {
    throw Object.assign(new Error('metadata must be valid JSON.'), { statusCode: 400 });
  }

  return prisma.overlayLayout.create({
    data: {
      name,
      styleKey,
      tier,
      isActive,
      defaultConfig: defaultConfig ?? undefined,
      metadata: metadata ?? undefined
    }
  });
}

async function updateLayout(id, input) {
  const existing = await getLayoutById(id);
  if (!existing) throw Object.assign(new Error('Layout not found.'), { statusCode: 404 });

  const name = String(input.name || '').trim();
  const styleKey = String(input.styleKey || '').trim();

  if (!name) throw Object.assign(new Error('Name is required.'), { statusCode: 400 });
  if (!styleKey) throw Object.assign(new Error('styleKey is required.'), { statusCode: 400 });

  const tier = normalizeTier(input.tier);
  const isActive = toBool(input.isActive);

  const defaultConfig = safeParseJson(input.defaultConfig);
  if (defaultConfig && defaultConfig.__parseError) {
    throw Object.assign(new Error('defaultConfig must be valid JSON.'), { statusCode: 400 });
  }

  const metadata = safeParseJson(input.metadata);
  if (metadata && metadata.__parseError) {
    throw Object.assign(new Error('metadata must be valid JSON.'), { statusCode: 400 });
  }

  return prisma.overlayLayout.update({
    where: { id },
    data: {
      name,
      styleKey,
      tier,
      isActive,
      defaultConfig: defaultConfig ?? null,
      metadata: metadata ?? null
    }
  });
}

module.exports = {
  listLayouts,
  getLayoutById,
  createLayout,
  updateLayout
};
