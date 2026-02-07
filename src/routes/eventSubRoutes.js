// src/routes/eventSubRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');

const { verifyEventSub } = require('../services/eventSubVerify');
const { getOrCreateActiveSession } = require('../services/sessionService');
const { addHype, getMetersSnapshot } = require('../services/meterService');
const { broadcast } = require('../services/realtimeHub');
const { getEffectiveEventConfig } = require('../services/eventConfigService');
const { resolveFactionKey } = require('../services/hypePolicyService');

const {
  setLatestFollower,
  setLatestSubscriber,
  setLatestCheer,
} = require('../services/statsService');

function clampInt(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  n = Math.trunc(n);
  return Math.max(lo, Math.min(hi, n));
}

function normalizeEvent(subType, ev) {
  if (subType === 'channel.follow') return { type: 'follow', value: 1, meta: ev };
  if (subType === 'channel.cheer') return { type: 'cheer', value: Number(ev?.bits || 0), meta: ev };
  if (subType === 'channel.subscribe') return { type: 'sub', value: 1, meta: ev };
  if (subType === 'channel.subscription.gift') return { type: 'gift', value: 1, meta: ev };
  if (subType === 'channel.subscription.message') return { type: 'resub', value: 1, meta: ev };
  return null;
}

function mapDelta(eventCfg, normalized) {
  const t = normalized.type;

  if (t === 'cheer') {
    const cfg = eventCfg?.cheer || {};
    if (cfg.enabled === false) return 0;

    const bits = Math.max(0, Math.trunc(Number(normalized.value || 0)));
    const bitsPerStep = clampInt(cfg.bitsPerStep ?? 100, 1, 1_000_000);
    const hypePerStep = clampInt(cfg.hypePerStep ?? 5, 0, 1_000_000);

    const raw = Math.floor(bits / bitsPerStep) * hypePerStep;
    const maxDelta = clampInt(cfg.maxDelta ?? 100, 0, 1_000_000);
    return maxDelta > 0 ? Math.min(raw, maxDelta) : raw;
  }

  const cfg = eventCfg?.[t] || {};
  if (cfg.enabled === false) return 0;

  const raw = clampInt(cfg.hype ?? 0, 0, 1_000_000);
  const maxDelta = clampInt(cfg.maxDelta ?? 0, 0, 1_000_000);
  return maxDelta > 0 ? Math.min(raw, maxDelta) : raw;
}

function pickEventUserName(ev) {
  return ev?.user_name || ev?.user_login || null;
}

function safeJsonParse(buf) {
  try {
    const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getHeader(req, name) {
  // robust, case-insensitive header read
  if (typeof req.get === 'function') return req.get(name) || '';
  return req.headers?.[String(name).toLowerCase()] || '';
}

function eventSubRoutes({ env }) {
  const router = express.Router();

  router.post(
    '/twitch/eventsub',
    // MUST be raw for signature verification
    express.raw({ type: '*/*', limit: '2mb' }),
    async (req, res) => {
      const rawBody = req.body; // Buffer
      const secret = String(env.EVENTSUB_WEBHOOK_SECRET || '').trim();
      if (!secret) return res.status(500).type('text/plain').send('Missing EVENTSUB_WEBHOOK_SECRET');

      // Useful raw-hit log (shows if it's Twitch or something else)
      console.log('[eventsub] hit', {
        ip: req.ip,
        remote: req.socket?.remoteAddress,
        host: req.headers?.host || '',
        url: req.originalUrl,
        ct: String(req.headers?.['content-type'] || ''),
        bodyLen: Buffer.isBuffer(rawBody) ? rawBody.length : 0,
        twitchHdrs: Object.keys(req.headers || {}).filter((k) => k.includes('twitch-eventsub')),
      });

      // Message type/id are headers (lowercase in req.headers)
      const msgType = String(getHeader(req, 'Twitch-Eventsub-Message-Type') || '').toLowerCase();
      const msgId = String(getHeader(req, 'Twitch-Eventsub-Message-Id') || '').trim();

      // 1) Verify signature FIRST (before JSON parse)
      const v = verifyEventSub(req, rawBody, secret);
      if (!v?.ok) {
        // 403 tells Twitch the delivery failed (it will retry), which is what we want when signature is wrong.
        return res.sendStatus(403);
      }

      // 2) Parse payload after verification
      const payload = safeJsonParse(rawBody);
      if (!payload) {
        console.warn('[eventsub] invalid JSON payload', { msgId: msgId ? msgId.slice(0, 12) : '', bodyLen: rawBody?.length || 0 });
        return res.sendStatus(400);
      }

      // 3) Verification challenge
      if (msgType === 'webhook_callback_verification') {
        const challenge = payload?.challenge;
        if (!challenge) return res.sendStatus(400);
        return res.status(200).type('text/plain').send(String(challenge));
      }

      // 4) Revocation
      if (msgType === 'revocation') {
        console.warn('[eventsub] revocation', {
          msgId: msgId ? msgId.slice(0, 12) : '',
          subType: payload?.subscription?.type,
          status: payload?.subscription?.status,
          reason: payload?.subscription?.status,
        });
        return res.sendStatus(204);
      }

      // 5) Notifications only beyond this point
      if (msgType !== 'notification') return res.sendStatus(204);

      const subType = payload?.subscription?.type;
      const ev = payload?.event || {};

      const broadcasterId =
        ev?.broadcaster_user_id ||
        payload?.subscription?.condition?.broadcaster_user_id;

      if (!broadcasterId) return res.sendStatus(204);

      const streamer = await prisma.streamer.findUnique({
        where: { twitchUserId: String(broadcasterId) },
        select: { id: true },
      });

      if (!streamer) return res.sendStatus(204);

      // Idempotency
      if (msgId) {
        const seen = await prisma.externalEventReceipt.findUnique({
          where: {
            streamerId_eventId: {
              streamerId: streamer.id,
              eventId: msgId,
            },
          },
          select: { id: true },
        });

        if (seen) return res.sendStatus(204);

        try {
          await prisma.externalEventReceipt.create({
            data: { streamerId: streamer.id, eventId: msgId },
          });
        } catch (_) {
          // ignore unique race
        }
      }

      const normalized = normalizeEvent(subType, ev);
      if (!normalized) return res.sendStatus(204);

      // Always update latest activity stats
      try {
        if (subType === 'channel.follow') {
          await setLatestFollower(streamer.id, { name: pickEventUserName(ev), at: new Date() });
        } else if (subType === 'channel.cheer') {
          await setLatestCheer(streamer.id, { name: pickEventUserName(ev), bits: Number(ev?.bits || 0), at: new Date() });
        } else if (subType === 'channel.subscribe' || subType === 'channel.subscription.message') {
          await setLatestSubscriber(streamer.id, { name: pickEventUserName(ev), tier: ev?.tier || null, isGift: false, at: new Date() });
        } else if (subType === 'channel.subscription.gift') {
          await setLatestSubscriber(streamer.id, { name: pickEventUserName(ev), tier: ev?.tier || null, isGift: true, at: new Date() });
        }
      } catch (e) {
        console.error('[eventsub] stats update failed', e?.message || e);
      }

      // Apply hype (optional, based on config)
      const eventCfg = await getEffectiveEventConfig(streamer.id);
      if (eventCfg?.enabled === false) return res.sendStatus(204);

      const session = await getOrCreateActiveSession(streamer.id);
      const factionKey = await resolveFactionKey({
        streamerId: streamer.id,
        sessionId: session.id,
        eventCfg,
      });

      const delta = mapDelta(eventCfg, normalized);
      if (!factionKey || delta <= 0) return res.sendStatus(204);

      try {
        await addHype(streamer.id, factionKey, delta, 'eventsub', { subType });
        const snap = await getMetersSnapshot(streamer.id);
        broadcast(streamer.id, 'meters', snap);
      } catch (e) {
        console.error('[eventsub] hype apply failed', e?.message || e);
      }

      return res.sendStatus(204);
    }
  );

  return router;
}

module.exports = { eventSubRoutes };
