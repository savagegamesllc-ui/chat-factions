// src/routes/overlayRoutes.js
'use strict';

const express = require('express');
const { resolveOverlayByToken } = require('../services/overlayRenderService');
const { overlayHeaders } = require('../middleware/overlayHeaders');
const { registerClient, unregisterClient } = require('../services/realtimeHub');
const { getMetersSnapshot } = require('../services/meterService');
const { getStatsSnapshot } = require('../services/statsService');

function isReservedToken(token) {
  const t = String(token || '').toLowerCase();
  return t === 'sse' || t === 'api' || t === 'events';
}

function overlayRoutes() {
  const router = express.Router();

  router.get('/overlay/:token/sse', overlayHeaders, async (req, res, next) => {
    const token = req.params.token;
    const connId = `sse:${token}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;

    try {
      if (isReservedToken(token)) return next();

      const resolved = await resolveOverlayByToken(token, 0);
      const streamerId = resolved?.streamerId;

      console.log('[SSE] resolve', { connId, token, streamerId, styleKey: resolved?.styleKey });

      if (!streamerId) {
        res.status(404).end();
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      registerClient(streamerId, res);

      // Initial meters
      try {
        const snap = await getMetersSnapshot(streamerId);
        res.write(`event: meters\n`);
        res.write(`data: ${JSON.stringify(snap ?? {})}\n\n`);
      } catch (e) {
        console.error('[SSE] initial meters failed', { connId, streamerId, message: e?.message || String(e) });
      }

      // Initial stats
      try {
        const stats = await getStatsSnapshot(streamerId);
        res.write(`event: stats\n`);
        res.write(`data: ${JSON.stringify(stats ?? {})}\n\n`);
      } catch (e) {
        console.error('[SSE] initial stats failed', { connId, streamerId, message: e?.message || String(e) });
      }

      const pingTimer = setInterval(() => {
        try {
          res.write(`event: ping\n`);
          res.write(`data: {"t":${Date.now()}}\n\n`);
        } catch (_) {}
      }, 25000);

      req.on('close', () => {
        clearInterval(pingTimer);
        try { unregisterClient(streamerId, res); } catch (_) {}
        try { res.end(); } catch (_) {}
      });
    } catch (err) {
      next(err);
    }
  });

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
