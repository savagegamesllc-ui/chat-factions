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
    try {
      const token = req.params.token;
      if (isReservedToken(token)) return next();

      // Resolve token -> streamer + layout info (slot 0 is fine)
      const resolved = await resolveOverlayByToken(token, 0);

      // You need streamerId from resolver; adjust if your resolver names it differently
      const streamerId =
        resolved.streamerId || resolved.streamer?.id || resolved.ownerStreamerId;

      if (!streamerId) {
        res.status(404).end();
        return;
      }

      // SSE headers
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      // Register this response under streamerId (THIS must match broadcast(streamer.id,...))
      registerClient(streamerId, res);

      // Send initial meters so overlay updates immediately
      try {
        const snap = await getMetersSnapshot(streamerId);
        res.write(`event: meters\n`);
        res.write(`data: ${JSON.stringify(snap ?? {})}\n\n`);
      } catch (_) {}

      // Keepalive ping
      const pingTimer = setInterval(() => {
        try {
          res.write(`event: ping\n`);
          res.write(`data: {"t":${Date.now()}}\n\n`);
        } catch (_) {}
      }, 15000);

      req.on('close', () => {
        clearInterval(pingTimer);
        unregisterClient(streamerId, res);
        try { res.end(); } catch (_) {}
      });
    } catch (err) {
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
