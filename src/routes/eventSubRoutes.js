// src/routes/eventSubRoutes.js
'use strict';

const express = require('express');
const { verifyEventSub } = require('../services/eventSubVerify');

// NOTE: You likely already import these in your original file.
// Keep your existing imports here if they differ.
const { config } = require('../config/env');

// If your original file imports these from elsewhere, keep those imports.
// (I’m using generic names consistent with your grep evidence.)
const { addHype } = require('../services/meterService');
const { decideHype } = require('../services/hypePolicyService'); // adjust if your function name differs
const prisma = require('../services/prisma'); // adjust to your actual prisma import

function registerEventSubRoutes(app) {
  const router = express.Router();

  // IMPORTANT: raw body required for signature verification
  router.post(
    '/twitch/eventsub',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      // raw buffer from express.raw
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

      const msgType = String(req.headers['twitch-eventsub-message-type'] || '');
      const msgId = String(req.headers['twitch-eventsub-message-id'] || '');
      const timestamp = String(req.headers['twitch-eventsub-message-timestamp'] || '');

      // Helpful trace line (low noise)
      console.log('[eventsub] inbound', {
        type: msgType,
        id: msgId ? msgId.slice(0, 12) : '',
        ts: timestamp || '',
        bodyLen: rawBody.length,
      });

      const secret = config.EVENTSUB_WEBHOOK_SECRET || process.env.EVENTSUB_WEBHOOK_SECRET || '';

      if (!secret) {
        return res.status(500).type('text/plain').send('Missing EVENTSUB_WEBHOOK_SECRET');
      }

      // Signature verification
      const v = verifyEventSub(req, rawBody, secret);
      if (!v.ok) {
        return res.status(403).type('text/plain').send(v.reason || 'Invalid signature');
      }

      // Parse JSON AFTER verification
      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8') || '{}');
      } catch (e) {
        return res.status(400).type('text/plain').send('Invalid JSON');
      }

      // 1) Verification handshake
      if (msgType === 'webhook_callback_verification') {
        const challenge = payload?.challenge;
        if (!challenge) {
          return res.status(400).type('text/plain').send('Missing challenge');
        }
        console.log('[eventsub] verification ok', { id: msgId ? msgId.slice(0, 12) : '' });
        return res.status(200).type('text/plain').send(String(challenge));
      }

      // 2) Revocation
      if (msgType === 'revocation') {
        console.warn('[eventsub] revoked', {
          id: msgId ? msgId.slice(0, 12) : '',
          subscription: payload?.subscription?.type || '',
          status: payload?.subscription?.status || '',
          reason: payload?.subscription?.status || '',
        });
        return res.status(204).end();
      }

      // 3) Notification
      if (msgType !== 'notification') {
        return res.status(204).end();
      }

      // Idempotency (you already do receiptKey based on msgId; keep it)
      try {
        // If your original schema uses a different table/model, keep yours.
        // This is only shown because your grep indicates receiptKey usage.
        await prisma.eventReceipt.create({
          data: {
            receiptKey: `eventsub:${msgId}`,
          },
        });
      } catch (e) {
        // If already processed, treat as success
        // Prisma unique violation often has code 'P2002'
        return res.status(204).end();
      }

      try {
        const eventType = String(payload?.subscription?.type || '');
        const event = payload?.event || {};

        // Find streamer by broadcaster_user_id from the event payload (typical)
        const broadcasterUserId =
          String(event?.broadcaster_user_id || payload?.subscription?.condition?.broadcaster_user_id || '');

        if (!broadcasterUserId) {
          console.warn('[eventsub] missing broadcaster_user_id', { eventType });
          return res.status(204).end();
        }

        const streamer = await prisma.streamer.findUnique({
          where: { twitchUserId: broadcasterUserId },
        });

        if (!streamer) {
          console.warn('[eventsub] streamer not found for broadcaster', { broadcasterUserId });
          return res.status(204).end();
        }

        // Decide faction + delta via policy layer (no hardcoding)
        // If your function name differs, adjust this call to match your codebase.
        const decision = await decideHype({
          streamerId: streamer.id,
          eventType,
          event,
        });

        const factionKey = decision?.factionKey;
        const delta = Number(decision?.delta || 0);

        if (!factionKey || !Number.isFinite(delta) || delta === 0) {
          console.log('[eventsub] policy no-op', { eventType, factionKey, delta });
          return res.status(204).end();
        }

        // Apply hype through the one true path
        await addHype(streamer.id, factionKey, delta, 'eventsub', {
          eventType,
          msgId,
        });

        console.log('[eventsub] applied', { eventType, factionKey, delta });

        return res.status(204).end();
      } catch (e) {
        console.error('[eventsub] apply error', e?.message || e);
        return res.status(500).type('text/plain').send('EventSub apply error');
      }
    }
  );

  app.use(router);
}

module.exports = { registerEventSubRoutes };
