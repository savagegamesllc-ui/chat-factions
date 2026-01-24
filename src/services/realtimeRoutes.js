// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const { resolveOverlayByToken } = require('../services/overlayRenderService');
const { getMetersSnapshot, addHype } = require('../services/meterService');
const { registerClient, broadcast } = require('../services/realtimeHub');
const { findStreamerByEventKey } = require('../services/eventKeyService');


function realtimeRoutes() {
  const router = express.Router();

  /**
   * Overlay subscribes to SSE using overlay token.
   * Example: /overlay/<token>/sse
   */
  router.get('/overlay/:token/sse', async (req, res) => {
    const token = req.params.token;

    // Resolve token -> streamerId (and validate exists)
    const resolved = await resolveOverlayByToken(token);
    const streamerId = resolved.streamer.id;

    // SSE headers
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // helpful on some proxies

    // Initial comment to open stream
    res.write(`: connected\n\n`);

      const ka = setInterval(() => {
    try { res.write(`: ping ${Date.now()}\n\n`); } catch (_) {}
  }, 25000);

  res.on('close', () => {
    try { clearInterval(ka); } catch (_) {}
  });

    // Register client
    registerClient(streamerId, res);

    // Send initial snapshot immediately
    const snap = await getMetersSnapshot(streamerId);
    res.write(`event: meters\n`);
    res.write(`data: ${JSON.stringify(snap)}\n\n`);
  });

  /**
   * External event API (game triggers etc.)
   * For now: simple shared secret using OVERLAY_TOKEN or a new env later.
   *
   * Body: { overlayToken, factionKey, delta, source?, meta? }
   */
  router.post('/api/events/hype', async (req, res) => {
          const actionRaw = (req.body && req.body.action) ? String(req.body.action) : 'ADD';
      const action = actionRaw.trim().toUpperCase();

      const source = (req.body && req.body.source) || 'api';
      const meta = (req.body && req.body.meta) || null;
      const metaWithEvent = (meta && typeof meta === 'object')
        ? { ...meta, eventId }
        : (eventId ? { eventId } : meta);

      const {
        addHype,
        setHype,
        resetHype,
        bulkAddHype,
        getMetersSnapshot
      } = require('../services/meterService');

      let result;

      if (action === 'ADD') {
        const factionKey = String((req.body && req.body.factionKey) || '');
        const delta = (req.body && req.body.delta) ?? 0;
        if (!factionKey) return res.status(400).json({ error: 'factionKey is required for ADD.' });
        result = await addHype(streamer.id, factionKey, delta, source, metaWithEvent);

      } else if (action === 'SET') {
        const factionKey = String((req.body && req.body.factionKey) || '');
        const value = (req.body && req.body.value) ?? 0;
        if (!factionKey) return res.status(400).json({ error: 'factionKey is required for SET.' });
        result = await setHype(streamer.id, factionKey, value, source, metaWithEvent);

      } else if (action === 'RESET') {
        const factionKey = String((req.body && req.body.factionKey) || '');
        if (!factionKey) return res.status(400).json({ error: 'factionKey is required for RESET.' });
        result = await resetHype(streamer.id, factionKey, source, metaWithEvent);

      } else if (action === 'BULK_ADD') {
        const items = (req.body && req.body.items) || null;
        result = await bulkAddHype(streamer.id, items, source, metaWithEvent);

      } else {
        return res.status(400).json({ error: `Unknown action "${action}". Use ADD|SET|RESET|BULK_ADD.` });
      }

      // Broadcast updated snapshot (consistent)
      const snap = await getMetersSnapshot(streamer.id);
      broadcast(streamer.id, 'meters', snap);

      return res.json({ ok: true, action, eventId, ...result });

  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
