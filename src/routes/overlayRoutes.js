// src/routes/overlayRoutes.js
'use strict';

const express = require('express');
const { resolveOverlayByToken } = require('../services/overlayRenderService');
const { overlayHeaders } = require('../middleware/overlayHeaders');

function isReservedToken(token) {
  const t = String(token || '').toLowerCase();
  return t === 'sse' || t === 'api' || t === 'events';
}

function overlayRoutes() {
  const router = express.Router();

  // Slot overlay URL: /overlay/:token/:slot (slot 0..3)
  router.get('/overlay/:token/:slot', overlayHeaders, async (req, res, next) => {
    try {
      const token = req.params.token;
      if (isReservedToken(token)) return next(); // allow other routers to handle /overlay/sse etc.

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
      if (isReservedToken(token)) return next(); // allow /overlay/sse to pass through

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
