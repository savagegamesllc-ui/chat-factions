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

// NEW: DB-backed latest-activity updates
const {
  setLatestFollower,
  setLatestSubscriber,
  setLatestCheer
} = require('../services/statsService');

function clampInt(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  n = Math.trunc(n);
  return Math.max(lo, Math.min(hi, n));
}

function normalizeEvent(subType, ev) {
  if (subType === 'channel.follow') {
    return { type: 'follow', value: 1, meta: ev };
  }
  if (subType === 'channel.cheer') {
    return { type: 'cheer', value: Number(ev?.bits || 0), meta: ev };
  }
  if (subType === 'channel.subscribe') {
    return { type: 'sub', value: 1, meta: ev };
  }
  if (subType === 'channel.subscription.gift') {
    return { type: 'gift', value: 1, meta: ev };
  }
  if (subType === 'channel.subscription.message') {
    return { type: 'resub', value: 1, meta: ev };
  }
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

function eventSubRoutes({ env }) {
  const router = express.Router();

  router.post(
    '/twitch/eventsub',
    express.raw({ type: '*/*', limit: '2mb' }),
    async (req, res) => {
      const secret = String(env.EVENTSUB_WEBHOOK_SECRET || '').trim();
      if (!secret) return res.status(500).send('Missing EVENTSUB_WEBHOOK_SECRET');

      let payload;
      try {
        payload = verifyEventSub({ req, secret });
      } catch (e) {
        console.warn('[eventsub] verify failed', e?.message || e);
        return res.sendStatus(403);
      }

      const msgType = String(req.headers['twitch-eventsub-message-type'] || '').toLowerCase();
      const msgId = String(req.header('Twitch-Eventsub-Message-Id') || '').trim();

      if (msgType === 'webhook_callback_verification') {
        return res.status(200).type('text/plain').send(payload.challenge);
      }

      if (msgType !== 'notification') return res.sendStatus(204);

      const subType = payload?.subscription?.type;
      const ev = payload?.event || {};

      const broadcasterId =
        ev?.broadcaster_user_id ||
        payload?.subscription?.condition?.broadcaster_user_id;

      if (!broadcasterId) return res.sendStatus(204);

      const streamer = await prisma.streamer.findUnique({
        where: { twitchUserId: String(broadcasterId) },
        select: { id: true }
      });

      if (!streamer) return res.sendStatus(204);

      // Idempotency
      if (msgId) {
        const seen = await prisma.externalEventReceipt.findUnique({
          where: {
            streamerId_eventId: {
              streamerId: streamer.id,
              eventId: msgId
            }
          }
        });
        if (seen) return res.sendStatus(204);

        try {
          await prisma.externalEventReceipt.create({
            data: {
              streamerId: streamer.id,
              eventId: msgId
            }
          });
        } catch (_) {}
      }

      const normalized = normalizeEvent(subType, ev);
      if (!normalized) return res.sendStatus(204);

      // ✅ Update latest activity (always)
      try {
        if (subType === 'channel.follow') {
          await setLatestFollower(streamer.id, {
            name: pickEventUserName(ev),
            at: new Date()
          });
        } else if (subType === 'channel.cheer') {
          await setLatestCheer(streamer.id, {
            name: pickEventUserName(ev),
            bits: Number(ev?.bits || 0),
            at: new Date()
          });
        } else if (
          subType === 'channel.subscribe' ||
          subType === 'channel.subscription.message'
        ) {
          await setLatestSubscriber(streamer.id, {
            name: pickEventUserName(ev),
            tier: ev?.tier || null,
            isGift: false,
            at: new Date()
          });
        } else if (subType === 'channel.subscription.gift') {
          await setLatestSubscriber(streamer.id, {
            name: pickEventUserName(ev),
            tier: ev?.tier || null,
            isGift: true,
            at: new Date()
          });
        }
      } catch (e) {
        console.error('[eventsub] stats update failed', e?.message || e);
      }

      const eventCfg = await getEffectiveEventConfig(streamer.id);
      if (eventCfg.enabled === false) return res.sendStatus(204);

      const session = await getOrCreateActiveSession(streamer.id);
      const factionKey = await resolveFactionKey({
        streamerId: streamer.id,
        sessionId: session.id,
        eventCfg
      });

      const delta = mapDelta(eventCfg, normalized);
      if (!factionKey || delta <= 0) return res.sendStatus(204);

      await addHype(streamer.id, factionKey, delta, 'eventsub', { subType });

      const snap = await getMetersSnapshot(streamer.id);
      broadcast(streamer.id, 'meters', snap);

      return res.sendStatus(204);
    }
  );

  return router;
}

module.exports = { eventSubRoutes };
