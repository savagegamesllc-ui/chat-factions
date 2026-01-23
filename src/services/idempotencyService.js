// src/services/idempotencyService.js
'use strict';

const { prisma } = require('../db/prisma');

/**
 * Returns true if event is new and reserved, false if already processed.
 * Uses ExternalEventReceipt unique constraint.
 */
async function reserveExternalEvent(streamerId, eventId) {
  if (!eventId) return true; // no idempotency requested

  const eid = String(eventId).trim();
  if (!eid) return true;

  try {
    await prisma.externalEventReceipt.create({
      data: { streamerId, eventId: eid }
    });
    return true;
  } catch (err) {
    // Prisma unique constraint error => already processed
    if (err && err.code === 'P2002') return false;
    throw err;
  }
}

module.exports = {
  reserveExternalEvent
};
