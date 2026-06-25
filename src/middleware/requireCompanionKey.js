// src/middleware/requireCompanionKey.js
'use strict';

const { findStreamerByCompanionKey, touchLastUsed } = require('../services/companionKeyService');
const { hasProAccess } = require('../services/stripeService');

// Simple in-memory sliding-window rate limiter (per keyHash)
const _windows = new Map();
const RATE_LIMIT = 120;
const WINDOW_MS = 60_000;

function checkRateLimit(keyHash) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (_windows.get(keyHash) || []).filter(t => t > cutoff);

  if (timestamps.length >= RATE_LIMIT) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  timestamps.push(now);
  _windows.set(keyHash, timestamps);
  return { allowed: true };
}

// Periodically clean up stale entries to prevent memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of _windows) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) _windows.delete(key);
    else _windows.set(key, fresh);
  }
}, 60_000);

/**
 * Middleware that authenticates companion app requests via Bearer token.
 *
 * Expects: Authorization: Bearer cfk_<token>
 * On success: attaches req.companionStreamer
 * On failure: 401 (missing/bad key), 403 (PRO lapsed), 429 (rate limit)
 */
async function requireCompanionKey(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header. Expected: Bearer cfk_<token>' });
  }

  const rawToken = match[1].trim();

  if (!rawToken.startsWith('cfk_')) {
    return res.status(401).json({ error: 'Invalid API key format.' });
  }

  let result;
  try {
    result = await findStreamerByCompanionKey(rawToken);
  } catch (err) {
    return res.status(500).json({ error: 'Key lookup failed.' });
  }

  if (!result) {
    return res.status(401).json({ error: 'Invalid or revoked API key.' });
  }

  const { keyRow, streamer } = result;

  if (!hasProAccess(streamer)) {
    return res.status(403).json({ error: 'Companion app access requires a PRO subscription.' });
  }

  const { allowed, retryAfter } = checkRateLimit(keyRow.keyHash);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Rate limit exceeded.', retryAfterSeconds: retryAfter });
  }

  touchLastUsed(streamer.id);

  req.companionStreamer = streamer;
  return next();
}

module.exports = { requireCompanionKey };
