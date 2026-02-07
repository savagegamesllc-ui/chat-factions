// src/services/eventSubVerify.js
'use strict';

const crypto = require('node:crypto');

function getHeader(req, name) {
  const proper = String(name || '');
  const key = proper.toLowerCase();

  // Express provides req.get()/req.header() which handles casing reliably
  const viaGet = typeof req?.get === 'function' ? req.get(proper) : '';
  if (viaGet) return viaGet;

  // Node stores header keys lowercased in req.headers
  return (req?.headers?.[key] ?? '') || '';
}

function computeSignature({ secret, messageId, timestamp, rawBody }) {
  const hmac = crypto.createHmac('sha256', String(secret || ''));
  hmac.update(String(messageId || ''), 'utf8');
  hmac.update(String(timestamp || ''), 'utf8');
  hmac.update(rawBody); // Buffer
  return `sha256=${hmac.digest('hex')}`;
}

function timingSafeEqual(a, b) {
  try {
    const ba = Buffer.from(String(a || ''), 'utf8');
    const bb = Buffer.from(String(b || ''), 'utf8');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyEventSub(req, rawBody, secret) {
  const messageId = getHeader(req, 'Twitch-Eventsub-Message-Id');
  const timestamp = getHeader(req, 'Twitch-Eventsub-Message-Timestamp');
  const signature = getHeader(req, 'Twitch-Eventsub-Message-Signature');

  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');

  // Treat empty body as a verifier failure too — Twitch always sends a body.
  if (!messageId || !timestamp || !signature || bodyBuf.length === 0) {
    console.warn('[eventsub verify] missing headers', {
      hasId: !!messageId,
      hasTs: !!timestamp,
      hasSig: !!signature,
      bodyLen: bodyBuf.length,

      // These extra bits will tell us immediately if the request is really Twitch:
      twitchHeaderKeys: Object.keys(req?.headers || {}).filter((k) => k.includes('twitch-eventsub')),
      contentType: String(req?.headers?.['content-type'] || ''),
      userAgent: String(req?.headers?.['user-agent'] || ''),
      // x-forwarded-for is useful if you’re behind nginx/proxy
      xff: String(req?.headers?.['x-forwarded-for'] || ''),
    });

    return {
      ok: false,
      reason: bodyBuf.length === 0
        ? 'Empty body (expected Twitch EventSub payload).'
        : 'Missing EventSub headers.',
      messageId: String(messageId || ''),
      timestamp: String(timestamp || ''),
      signature: String(signature || ''),
    };
  }

  const expected = computeSignature({
    secret,
    messageId,
    timestamp,
    rawBody: bodyBuf,
  });

  const ok = timingSafeEqual(signature, expected);

  if (!ok) {
    console.warn('[eventsub verify] mismatch', {
      bodyLen: bodyBuf.length,
      id: String(messageId).slice(0, 12),
      ts: String(timestamp),
      sigRecv: String(signature).slice(0, 20),
      sigExp: String(expected).slice(0, 20),
      secretLen: String(secret || '').length,
    });
  }

  return {
    ok,
    reason: ok ? '' : 'Invalid signature.',
    messageId: String(messageId),
    timestamp: String(timestamp),
    signature: String(signature),
  };
}

module.exports = { verifyEventSub };
