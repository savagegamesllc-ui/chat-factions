// src/routes/overlayRoutes.js
'use strict';

const express = require('express');
const { resolveOverlayByToken } = require('../services/overlayRenderService');
const { overlayHeaders } = require('../middleware/overlayHeaders');
const { registerClient, unregisterClient } = require('../services/realtimeHub');
const { getMetersSnapshot } = require('../services/meterService');

function isReservedToken(token) {
  const t = String(token || '').toLowerCase();
  return t === 'sse' || t === 'api' || t === 'events';
}

function overlayRoutes() {
  const router = express.Router();

  // ✅ IMPORTANT: SSE must be declared BEFORE /overlay/:token/:slot
  router.get('/overlay/:token/sse', overlayHeaders, async (req, res, next) => {
    const token = req.params.token;

    // Give every SSE connection a short id so logs are easy to follow
    const connId = `sse:${token}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;

    try {
      if (isReservedToken(token)) return next();

      // Resolve token -> streamer + layout info (slot 0 is fine)
      const resolved = await resolveOverlayByToken(token, 0);

      // 🔧 Prefer nested streamer object id first (most likely DB id),
      // then fallback to other fields. This helps avoid "token wins" mismatches.
      const streamerId =
        resolved?.streamer?.id || resolved?.streamerId || resolved?.ownerStreamerId;

      // 🔎 Debug: what did we resolve and what key are we about to use?
      console.log('[SSE] resolve', {
        connId,
        token,
        streamerId,
        resolvedKeys: Object.keys(resolved || {}),
        resolvedStreamerId: resolved?.streamerId,
        resolvedStreamerObjId: resolved?.streamer?.id,
        resolvedOwnerStreamerId: resolved?.ownerStreamerId,
        styleKey: resolved?.styleKey
      });

      if (!streamerId) {
        console.warn('[SSE] missing streamerId', { connId, token });
        res.status(404).end();
        return;
      }

      // SSE headers
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      // Register this response under streamerId
      registerClient(streamerId, res);
      console.log('[SSE] registered', { connId, token, streamerId });

      // Send initial meters so overlay updates immediately (and log result)
      try {
        const snap = await getMetersSnapshot(streamerId);
        res.write(`event: meters\n`);
        res.write(`data: ${JSON.stringify(snap ?? {})}\n\n`);
        console.log('[SSE] initial meters sent', {
          connId,
          streamerId,
          snapType: snap ? typeof snap : 'null',
          snapKeys: snap ? Object.keys(snap) : null
        });
      } catch (e) {
        console.error('[SSE] initial meters failed', {
          connId,
          streamerId,
          message: e?.message || String(e)
        });
      }

      // Keepalive ping
      const pingTimer = setInterval(() => {
        try {
          res.write(`event: ping\n`);
          res.write(`data: {"t":${Date.now()}}\n\n`);
          // (optional) comment this in if you want noisy logs
          // console.log('[SSE] ping', { connId, streamerId });
        } catch (e) {
          console.error('[SSE] ping write failed', {
            connId,
            streamerId,
            message: e?.message || String(e)
          });
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(pingTimer);
        unregisterClient(streamerId, res);
        console.log('[SSE] closed', { connId, token, streamerId });
        try { res.end(); } catch (_) {}
      });
    } catch (err) {
      console.error('[SSE] handler error', { connId, token, message: err?.message || String(err) });
      next(err);
    }
  });

  // Slot overlay URL: /overlay/:token/:slot (slot 0..3)
  router.get('/overlay/:token/:slot', overlayHeaders, async (req, res, next) => {
    try {
      const token = req.params.token;
      if (isReservedToken(token)) return next();

      const slot = req.params.slot;
      const resolved = await resolveOverlayByToken(token, slot);

      return res.render('pages/overlay/overlay', {
        title: 'Overlay',
        overlayToken: token,
        styleKey: resolved.styleKey,
        layout: resolved.layout,
        effectiveConfigJson: JSON.stringify(resolved.effectiveConfig || {}, null, 0),
        blockedReason: resolved.blockedReason || null
      });
    } catch (err) {
      next(err);
    }
  });

  // Backward-compatible OBS overlay URL (slot 0): /overlay/:token
  router.get('/overlay/:token', overlayHeaders, async (req, res, next) => {
    try {
      const token = req.params.token;
      if (isReservedToken(token)) return next();

      const resolved = await resolveOverlayByToken(token, 0);

      return res.render('pages/overlay/overlay', {
        title: 'Overlay',
        overlayToken: token,
        styleKey: resolved.styleKey,
        layout: resolved.layout,
        effectiveConfigJson: JSON.stringify(resolved.effectiveConfig || {}, null, 0),
        blockedReason: resolved.blockedReason || null
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { overlayRoutes: overlayRoutes() };
