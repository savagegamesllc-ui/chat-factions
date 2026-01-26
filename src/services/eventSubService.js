// src/services/eventSubService.js
'use strict';

const crypto = require('node:crypto');

function getHeader(req, name) {
  // Express lowercases headers internally, but keeps originals accessible.
  const v = req.headers[String(name).toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function computeSignature({ secret, messageId, timestamp, rawBodyBuffer }) {
  // message = id + timestamp + rawBodyBytes
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(messageId);
  hmac.update(timestamp);
  hmac.update(rawBodyBuffer);
  return `sha256=${hmac.digest('hex')}`;
}

function verifyEventSub(req, rawBodyBuffer, secret) {
  const messageId = getHeader(req, 'Twitch-Eventsub-Message-Id');
  const timestamp = getHeader(req, 'Twitch-Eventsub-Message-Timestamp');
  const signature = getHeader(req, 'Twitch-Eventsub-Message-Signature');

  if (!messageId || !timestamp || !signature) {
    return { ok: false, reason: 'Missing required EventSub headers.' };
  }

  const expected = computeSignature({
    secret,
    messageId: String(messageId),
    timestamp: String(timestamp),
    rawBodyBuffer,
  });

  const ok = timingSafeEqual(String(signature), expected);
  return { ok, expected, signature: String(signature), messageId, timestamp };
}

module.exports = {
  verifyEventSub,
};
