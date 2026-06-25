// src/services/companionKeyService.js
'use strict';

const crypto = require('crypto');
const { prisma } = require('../db/prisma');

const KEY_PREFIX = 'cfk_';

function generateRawKey() {
  return KEY_PREFIX + crypto.randomBytes(32).toString('hex');
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function getKeyPrefix(rawKey) {
  return rawKey.slice(0, 12);
}

/**
 * Generate a new companion key for the streamer (create or replace).
 * Returns the plaintext key ONCE — caller must send it to the user immediately.
 */
async function upsertKey(streamerId) {
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  await prisma.companionApiKey.upsert({
    where: { streamerId },
    create: {
      streamerId,
      keyHash,
      keyPrefix,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null
    },
    update: {
      keyHash,
      keyPrefix,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null
    }
  });

  return rawKey;
}

/**
 * Revoke the active companion key. Key row is kept for audit purposes.
 */
async function revokeKey(streamerId) {
  await prisma.companionApiKey.updateMany({
    where: { streamerId },
    data: { revokedAt: new Date() }
  });
}

/**
 * Return the stored key info (no hash) for dashboard display.
 * Returns null if no key row exists.
 */
async function getKeyInfo(streamerId) {
  const row = await prisma.companionApiKey.findUnique({
    where: { streamerId },
    select: {
      keyPrefix: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true
    }
  });
  return row || null;
}

/**
 * Look up a streamer by a raw companion key token.
 * Returns the streamer record or null if key is invalid/revoked.
 */
async function findStreamerByCompanionKey(rawToken) {
  if (!rawToken || !rawToken.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashKey(rawToken);

  const row = await prisma.companionApiKey.findUnique({
    where: { keyHash },
    include: {
      streamer: {
        select: {
          id: true,
          displayName: true,
          login: true,
          planTier: true,
          proOverride: true
        }
      }
    }
  });

  if (!row || row.revokedAt !== null) return null;

  return { keyRow: row, streamer: row.streamer };
}

/**
 * Async fire-and-forget: update lastUsedAt without blocking the request.
 */
function touchLastUsed(streamerId) {
  prisma.companionApiKey
    .updateMany({
      where: { streamerId, revokedAt: null },
      data: { lastUsedAt: new Date() }
    })
    .catch(() => {});
}

module.exports = {
  upsertKey,
  revokeKey,
  getKeyInfo,
  findStreamerByCompanionKey,
  touchLastUsed
};
