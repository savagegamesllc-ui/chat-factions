// src/services/eventSubVerify.js
'use strict';

const crypto = require('node:crypto');

function getHeader(req, name) {
  const v = req.headers[String(name).toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function computeSignature({ secret, messageId, timestamp, rawBody }) {
  // signature = HMAC_SHA256(secret, messageId + timestamp + rawBody)
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(messageId));
  hmac.update(String(timestamp));
  hmac.update(rawBody);
  return `sha256=${hmac.digest('hex')}`;
}

function verifyEventSub(req, rawBody, secret) {
  const messageId = getHeader(req, 'Twitch-Eventsub-Message-Id');
  const timestamp = getHeader(req, 'Twitch-Eventsub-Message-Timestamp');
  const signature = getHeader(req, 'Twitch-Eventsub-Message-Signature');

  if (!messageId || !timestamp || !signature) {
    return { ok: false, reason: 'Missing EventSub headers.' };
  }

  const expected = computeSignature({ secret, messageId, timestamp, rawBody });
  const ok = timingSafeEqual(signature, expected);

  return { ok, messageId: String(messageId), timestamp: String(timestamp), signature: String(signature) };
}

module.exports = { verifyEventSub };
