// src/services/statsService.js
'use strict';

const { prisma } = require('../db/prisma');
const { broadcast } = require('./realtimeHub');

function safeName(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  // keep it reasonable (prevents weird huge payloads)
  return s.slice(0, 80);
}

function safeDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d) {
  return d instanceof Date ? d.toISOString() : null;
}

function rowToSnapshot(row) {
  if (!row) return {};

  return {
    latestFollower: row.latestFollowerName
      ? { name: row.latestFollowerName, at: toIso(row.latestFollowerAt) }
      : null,

    latestSubscriber: row.latestSubscriberName
      ? {
          name: row.latestSubscriberName,
          at: toIso(row.latestSubscriberAt),
          tier: row.latestSubscriberTier ?? null,
          isGift: row.latestSubscriberIsGift ?? null,
        }
      : null,

    latestCheer: row.latestCheerName
      ? { name: row.latestCheerName, at: toIso(row.latestCheerAt), bits: row.latestCheerBits ?? null }
      : null,

    latestTip: row.latestTipName
      ? {
          name: row.latestTipName,
          at: toIso(row.latestTipAt),
          amount: row.latestTipAmount ?? null,
          currency: row.latestTipCurrency ?? null,
        }
      : null,
  };
}

async function getStatsSnapshot(streamerId) {
  if (!streamerId) return {};
  const row = await prisma.streamerLatestActivity.findUnique({
    where: { streamerId },
  });
  return rowToSnapshot(row);
}

/**
 * Internal helper: upsert + return new snapshot
 */
async function upsertAndSnapshot(streamerId, data) {
  const row = await prisma.streamerLatestActivity.upsert({
    where: { streamerId },
    create: { streamerId, ...data },
    update: { ...data },
  });

  return rowToSnapshot(row);
}

/**
 * Broadcast helper: writes to all connected SSE clients for this streamer.
 * Event name should match what overlayClient listens for: "stats".
 */
function broadcastStats(streamerId, statsSnapshot) {
  try {
    broadcast(streamerId, 'stats', statsSnapshot ?? {});
  } catch (_) {}
}

/**
 * Convenience: update + broadcast in one call
 */
async function setLatestFollower(streamerId, { name, at } = {}) {
  const snap = await upsertAndSnapshot(streamerId, {
    latestFollowerName: safeName(name),
    latestFollowerAt: safeDate(at) ?? new Date(),
  });
  broadcastStats(streamerId, snap);
  return snap;
}

async function setLatestSubscriber(streamerId, { name, at, tier, isGift } = {}) {
  const snap = await upsertAndSnapshot(streamerId, {
    latestSubscriberName: safeName(name),
    latestSubscriberAt: safeDate(at) ?? new Date(),
    latestSubscriberTier: tier != null ? String(tier).slice(0, 40) : null,
    latestSubscriberIsGift: typeof isGift === 'boolean' ? isGift : null,
  });
  broadcastStats(streamerId, snap);
  return snap;
}

async function setLatestCheer(streamerId, { name, at, bits } = {}) {
  const nBits = Number(bits);
  const snap = await upsertAndSnapshot(streamerId, {
    latestCheerName: safeName(name),
    latestCheerAt: safeDate(at) ?? new Date(),
    latestCheerBits: Number.isFinite(nBits) ? Math.max(0, Math.floor(nBits)) : null,
  });
  broadcastStats(streamerId, snap);
  return snap;
}

async function setLatestTip(streamerId, { name, at, amount, currency } = {}) {
  const nAmt = Number(amount);
  const snap = await upsertAndSnapshot(streamerId, {
    latestTipName: safeName(name),
    latestTipAt: safeDate(at) ?? new Date(),
    latestTipAmount: Number.isFinite(nAmt) ? nAmt : null,
    latestTipCurrency: currency != null ? String(currency).slice(0, 12) : null,
  });
  broadcastStats(streamerId, snap);
  return snap;
}

module.exports = {
  getStatsSnapshot,
  broadcastStats,

  setLatestFollower,
  setLatestSubscriber,
  setLatestCheer,
  setLatestTip,
};
