// src/services/eventKeyService.js
'use strict';

const crypto = require('crypto');
const { prisma } = require('../db/prisma');

function generateKey() {
  // URL-safe-ish key: 32 bytes => 64 hex chars
  return crypto.randomBytes(32).toString('hex');
}

async function ensureEventApiKey(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { eventApiKey: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  if (streamer.eventApiKey) return streamer.eventApiKey;

  const key = generateKey();
  await prisma.streamer.update({
    where: { id: streamerId },
    data: { eventApiKey: key }
  });
  return key;
}

async function rotateEventApiKey(streamerId) {
  const key = generateKey();
  await prisma.streamer.update({
    where: { id: streamerId },
    data: { eventApiKey: key }
  });
  return key;
}

async function findStreamerByEventKey(eventKey) {
  if (!eventKey) return null;
  return prisma.streamer.findFirst({
    where: { eventApiKey: String(eventKey) },
    select: { id: true }
  });
}

module.exports = {
  ensureEventApiKey,
  rotateEventApiKey,
  findStreamerByEventKey
};
