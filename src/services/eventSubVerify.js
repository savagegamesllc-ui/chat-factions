// src/services/eventSubVerify.js
'use strict';

const crypto = require('node:crypto');

function getHeader(req, name) {
  const key = String(name || '').toLowerCase();
  return (req?.headers?.[key] ?? req?.headers?.[name] ?? '') || '';
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

  if (!messageId || !timestamp || !signature) {
    console.warn('[eventsub verify] missing headers', {
      hasId: !!messageId,
      hasTs: !!timestamp,
      hasSig: !!signature,
      bodyLen: bodyBuf.length,
    });

    return {
      ok: false,
      reason: 'Missing EventSub headers.',
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
