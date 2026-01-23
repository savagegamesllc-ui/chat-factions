// src/services/factionsService.js
'use strict';

const { prisma } = require('../db/prisma');

const MIN_FACTIONS = 2;
const MAX_FACTIONS = 10;

function normalizeKey(key) {
  // Keys are used in commands + overlay config; keep stable and safe.
  return String(key || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

function normalizeColorHex(v) {
  const s = String(v || '').trim();
  if (!s) return '#78C8FF';
  // Accept #RGB or #RRGGBB
  if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  return '#78C8FF';
}

function toBool(v) {
  if (v === true || v === 1) return true;
  const s = String(v || '').toLowerCase();
  return s === 'on' || s === 'true' || s === '1';
}

async function countFactions(streamerId) {
  return prisma.faction.count({ where: { streamerId } });
}

async function listFactions(streamerId) {
  return prisma.faction.findMany({
    where: { streamerId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
}

async function getFaction(streamerId, factionId) {
  return prisma.faction.findFirst({
    where: { id: factionId, streamerId }
  });
}

async function createFaction(streamerId, input) {
  const existingCount = await countFactions(streamerId);
  if (existingCount >= MAX_FACTIONS) {
    throw Object.assign(new Error(`You can have at most ${MAX_FACTIONS} factions.`), { statusCode: 400 });
  }

  const key = normalizeKey(input.key);
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim() || null;

  if (!key) throw Object.assign(new Error('Faction key is required.'), { statusCode: 400 });
  if (!name) throw Object.assign(new Error('Faction name is required.'), { statusCode: 400 });

  const colorHex = normalizeColorHex(input.colorHex);
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
  const isActive = toBool(input.isActive);

  // Ensure key uniqueness per streamer
  const dupe = await prisma.faction.findUnique({
    where: { streamerId_key: { streamerId, key } }
  });
  if (dupe) throw Object.assign(new Error(`Faction key "${key}" already exists.`), { statusCode: 409 });

  return prisma.faction.create({
    data: {
      streamerId,
      key,
      name,
      description,
      colorHex,
      sortOrder,
      isActive
    }
  });
}

async function updateFaction(streamerId, factionId, input) {
  const existing = await getFaction(streamerId, factionId);
  if (!existing) throw Object.assign(new Error('Faction not found.'), { statusCode: 404 });

  const key = normalizeKey(input.key);
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim() || null;

  if (!key) throw Object.assign(new Error('Faction key is required.'), { statusCode: 400 });
  if (!name) throw Object.assign(new Error('Faction name is required.'), { statusCode: 400 });

  const colorHex = normalizeColorHex(input.colorHex);
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
  const isActive = toBool(input.isActive);

  // If key changed, ensure uniqueness
  if (key !== existing.key) {
    const dupe = await prisma.faction.findUnique({
      where: { streamerId_key: { streamerId, key } }
    });
    if (dupe) throw Object.assign(new Error(`Faction key "${key}" already exists.`), { statusCode: 409 });
  }

  return prisma.faction.update({
    where: { id: existing.id },
    data: {
      key,
      name,
      description,
      colorHex,
      sortOrder,
      isActive
    }
  });
}

async function deleteFaction(streamerId, factionId) {
  const existing = await getFaction(streamerId, factionId);
  if (!existing) throw Object.assign(new Error('Faction not found.'), { statusCode: 404 });

  const existingCount = await countFactions(streamerId);
  if (existingCount <= MIN_FACTIONS) {
    throw Object.assign(new Error(`You must keep at least ${MIN_FACTIONS} factions.`), { statusCode: 400 });
  }

  // Hard delete is fine; relations have cascading rules where appropriate.
  await prisma.faction.delete({ where: { id: existing.id } });
  return { ok: true };
}

/**
 * Ensure streamer has a default set of factions if they have none.
 * This runs once after first OAuth login (Phase 4 route will call it).
 */
async function ensureDefaultFactions(streamerId) {
  const n = await countFactions(streamerId);
  if (n > 0) return { created: 0 };

  const defaults = [
    { key: 'ORDER', name: 'Order', colorHex: '#4C9AFF', sortOrder: 10, isActive: true },
    { key: 'CHAOS', name: 'Chaos', colorHex: '#FF3B30', sortOrder: 20, isActive: true },
    { key: 'NATURE', name: 'Nature', colorHex: '#34C759', sortOrder: 30, isActive: true },
    { key: 'TECH', name: 'Tech', colorHex: '#AF52DE', sortOrder: 40, isActive: true }
  ];

  // createMany doesn’t return created rows; we only need them to exist.
  await prisma.faction.createMany({
    data: defaults.map(d => ({
      streamerId,
      ...d,
      description: null
    }))
  });

  return { created: defaults.length };
}

module.exports = {
  MIN_FACTIONS,
  MAX_FACTIONS,
  listFactions,
  getFaction,
  createFaction,
  updateFaction,
  deleteFaction,
  ensureDefaultFactions
};
