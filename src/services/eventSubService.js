// src/services/eventSubService.js
'use strict';

const crypto = require('node:crypto');
const { prisma } = require('../db/prisma');

// ----------
// Verifier (UNCHANGED behavior)
// ----------
function getHeader(req, name) {
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

// ----------
// Subscription management (NEW)
// ----------

function readEnv(key) {
  const v = process.env?.[key];
  return v ? String(v).trim() : '';
}

async function twitchFetch(url, { method = 'GET', headers = {}, body } = {}) {
  const resp = await fetch(url, { method, headers, body });
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!resp.ok) {
    const msg = json?.message || json?.error || text || resp.statusText;
    const err = new Error(`Twitch API ${method} ${url} failed: ${resp.status} ${msg}`);
    err.status = resp.status;
    err.body = json || text;
    throw err;
  }
  return json;
}

function requiredTypes() {
  return [
    { type: 'channel.cheer', version: '1' },
    { type: 'channel.subscribe', version: '1' },
    { type: 'channel.subscription.gift', version: '1' },
    { type: 'channel.subscription.message', version: '1' },
    // If you add follow later, it has different condition requirements.
    // { type: 'channel.follow', version: '2' },
  ];
}

async function listEventSubSubscriptions({ appAccessToken }) {
  const clientId = readEnv('TWITCH_CLIENT_ID');
  if (!clientId) throw new Error('TWITCH_CLIENT_ID missing');

  return twitchFetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'GET',
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${appAccessToken}`,
    },
  });
}

async function createEventSubSubscription({ userAccessToken, broadcasterUserId, callbackUrl, secret, type, version }) {
  const clientId = readEnv('TWITCH_CLIENT_ID');
  if (!clientId) throw new Error('TWITCH_CLIENT_ID missing');

  const payload = {
    type,
    version,
    condition: { broadcaster_user_id: String(broadcasterUserId) },
    transport: {
      method: 'webhook',
      callback: String(callbackUrl),
      secret: String(secret),
    },
  };

  return twitchFetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function ensureEventSubsForStreamer(streamerId) {
  const callbackUrl = readEnv('EVENTSUB_WEBHOOK_URL') || 'https://chatfactions.me/twitch/eventsub';
  const secret = readEnv('EVENTSUB_WEBHOOK_SECRET');
  if (!secret) throw new Error('EVENTSUB_WEBHOOK_SECRET missing');

  const streamer = await prisma.streamer.findUnique({
    where: { id: String(streamerId) },
    select: {
      id: true,
      twitchUserId: true,
      twitchAccessToken: true,
      twitchScopes: true,
    },
  });

  if (!streamer?.twitchUserId) throw new Error(`Streamer ${streamerId} missing twitchUserId`);
  if (!streamer?.twitchAccessToken) throw new Error(`Streamer ${streamerId} missing twitchAccessToken`);

  // Use an app token to LIST subs (cheap + global)
  const appToken = await getAppAccessToken();
  const list = await listEventSubSubscriptions({ appAccessToken: appToken });

  const existing = (list?.data || []).filter(s =>
    s?.condition?.broadcaster_user_id === String(streamer.twitchUserId) &&
    s?.transport?.callback === callbackUrl &&
    s?.status === 'enabled'
  );

  const existingKey = new Set(existing.map(s => `${s.type}:${s.version}`));

  const need = requiredTypes().filter(x => !existingKey.has(`${x.type}:${x.version}`));

  const created = [];
  for (const sub of need) {
    try {
      const resp = await createEventSubSubscription({
        userAccessToken: streamer.twitchAccessToken,
        broadcasterUserId: streamer.twitchUserId,
        callbackUrl,
        secret,
        type: sub.type,
        version: sub.version,
      });
      created.push({ type: sub.type, version: sub.version, resp });
    } catch (e) {
      // Log loudly so you know if it failed due to missing scope, invalid token, etc.
      console.error('[eventsub ensure] create failed', {
        streamerId: streamer.id,
        broadcaster: streamer.twitchUserId,
        type: sub.type,
        status: e?.status,
        body: e?.body,
        message: e?.message,
      });
    }
  }

  return {
    streamerId: streamer.id,
    broadcasterUserId: streamer.twitchUserId,
    callbackUrl,
    ensured: requiredTypes().length,
    alreadyEnabled: existing.length,
    created: created.map(c => ({ type: c.type, version: c.version })),
  };
}

async function getAppAccessToken() {
  const clientId = readEnv('TWITCH_CLIENT_ID');
  const clientSecret = readEnv('TWITCH_CLIENT_SECRET');
  if (!clientId) throw new Error('TWITCH_CLIENT_ID missing');
  if (!clientSecret) throw new Error('TWITCH_CLIENT_SECRET missing');

  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const json = await twitchFetch(url.toString(), { method: 'POST' });
  if (!json?.access_token) throw new Error('Failed to obtain app access token');
  return String(json.access_token);
}

module.exports = {
  // keep existing export
  verifyEventSub,

  // new exports
  ensureEventSubsForStreamer,
  getAppAccessToken,
};
