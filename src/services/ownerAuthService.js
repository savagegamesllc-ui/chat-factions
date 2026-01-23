// src/services/ownerAuthService.js
'use strict';

const crypto = require('crypto');
const { config } = require('../config/env');

/**
 * Constant-time string compare to reduce timing attacks.
 * (Overkill for local owner login, but good hygiene.)
 */
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');

  // timingSafeEqual throws if lengths differ, so normalize
  if (aa.length !== bb.length) {
    const max = Math.max(aa.length, bb.length);
    const aa2 = Buffer.concat([aa, Buffer.alloc(max - aa.length)]);
    const bb2 = Buffer.concat([bb, Buffer.alloc(max - bb.length)]);
    // still compute equal to keep timing similar
    crypto.timingSafeEqual(aa2, bb2);
    return false;
  }

  return crypto.timingSafeEqual(aa, bb);
}

/**
 * Validate owner credentials against env.
 * Env contract (Phase 2):
 * - OWNER_PASSWORD is required for owner login to work
 * - OWNER_USERNAME optional; defaults to "owner"
 */
function validateOwnerLogin(username, password) {
  const expectedUser = config.ownerUsername || 'owner';
  const expectedPass = config.ownerPassword || '';

  if (!expectedPass) {
    // Misconfiguration: owner password not set
    return { ok: false, reason: 'Owner credentials not configured (OWNER_PASSWORD missing).' };
  }

  const userOk = safeEqual(username, expectedUser);
  const passOk = safeEqual(password, expectedPass);

  if (!userOk || !passOk) return { ok: false, reason: 'Invalid username or password.' };
  return { ok: true };
}

module.exports = {
  validateOwnerLogin
};
