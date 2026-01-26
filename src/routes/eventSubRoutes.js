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

function clampInt(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  n = Math.trunc(n);
  return Math.max(lo, Math.min(hi, n));
}

function normalizeEvent(subType, ev) {
  // Returns: { type: 'cheer'|'sub'|'gift'|'resub', value, meta }
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

function eventSubRoutes({ env }) {
  const router = express.Router();

  router.post('/twitch/eventsub', express.raw({ type: 'application/json' }), async (req, res) => {
    const secret = String(env.EVENTSUB_WEBHOOK_SECRET || '').trim();
    if (!secret) return res.status(500).type('text/plain').send('Missing EVENTSUB_WEBHOOK_SECRET');

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

    const msgType = String(req.headers['twitch-eventsub-message-type'] || '');
    const msgIdHdr = String(req.headers['twitch-eventsub-message-id'] || '');

    // low-noise trace
    console.log('[eventsub] inbound', {
      type: msgType,
      id: msgIdHdr ? msgIdHdr.slice(0, 12) : '',
      bodyLen: rawBody.length,
    });

    const v = verifyEventSub(req, rawBody, secret);
    if (!v.ok) return res.status(403).type('text/plain').send(v.reason || 'Invalid signature');

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8') || '{}');
    } catch {
      return res.status(400).type('text/plain').send('Invalid JSON');
    }

    const msgId = String(req.headers['twitch-eventsub-message-id'] || v.messageId || '');

    // Verification handshake
    if (msgType === 'webhook_callback_verification') {
      const challenge = payload?.challenge;
      if (!challenge) return res.status(400).type('text/plain').send('Missing challenge');
      console.log('[eventsub] verification ok', { id: msgId ? msgId.slice(0, 12) : '' });
      return res.status(200).type('text/plain').send(String(challenge));
    }

    // Revocation
    if (msgType === 'revocation') {
      console.warn('[eventsub] revoked', {
        type: payload?.subscription?.type,
        status: payload?.subscription?.status,
        reason: payload?.subscription?.status || 'revoked',
      });
      return res.sendStatus(204);
    }

    // Notifications
    if (msgType !== 'notification') return res.sendStatus(204);

    // Dedupe using msg id (important)
    if (msgId) {
      const seen = await prisma.externalEventReceipt.findUnique({
        where: { receiptKey: `eventsub:${msgId}` },
        select: { receiptKey: true },
      });
      if (seen) return res.sendStatus(204);
    }

    const subType = payload?.subscription?.type;
    const ev = payload?.event || {};

    const broadcasterId =
      ev?.broadcaster_user_id ||
      payload?.subscription?.condition?.broadcaster_user_id ||
      null;

    if (!broadcasterId) return res.sendStatus(204);

    const streamer = await prisma.streamer.findUnique({
      where: { twitchUserId: String(broadcasterId) },
      select: { id: true },
    });

    if (!streamer) return res.sendStatus(204);

    const eventCfg = await getEffectiveEventConfig(streamer.id);
    if (eventCfg.enabled === false) return res.sendStatus(204);

    const normalized = normalizeEvent(subType, ev);
    if (!normalized) return res.sendStatus(204);

    const session = await getOrCreateActiveSession(streamer.id);

    const factionKey = await resolveFactionKey({
      streamerId: streamer.id,
      sessionId: session.id,
      eventCfg,
    });

    const delta = mapDelta(eventCfg, normalized);
    if (!factionKey || delta <= 0) return res.sendStatus(204);

    // Record receipt before processing (best-effort)
    if (msgId) {
      try {
        await prisma.externalEventReceipt.create({
          data: {
            streamerId: streamer.id,
            receiptKey: `eventsub:${msgId}`,
            payload: payload,
          },
        });
      } catch (_) {
        // ignore unique race
      }
    }

    try {
      await addHype(streamer.id, factionKey, delta, 'eventsub', {
        subType,
        broadcasterId,
        normalized,
      });

      const snap = await getMetersSnapshot(streamer.id);
      broadcast(streamer.id, 'meters', snap);
    } catch (e) {
      console.error('[eventsub] apply error', e?.message || e);
    }

    return res.sendStatus(204);
  });

  return router;
}

module.exports = { eventSubRoutes };
