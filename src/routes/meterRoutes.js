// src/routes/meterRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');
const { getMetersSnapshot } = require('../services/meterService');

function meterRoutes() {
  const router = express.Router();

  // SSR: live meters viewer for streamer
  router.get('/admin/meters', requireStreamer, (req, res) => {
    res.render('pages/streamer/meters', { title: 'Live Meters' });
  });

  // JSON snapshot (manual refresh / debugging)
  router.get('/admin/api/meters', requireStreamer, async (req, res) => {
    try {
      const snap = await getMetersSnapshot(req.session.streamerId);
      res.json(snap);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to load meters.' });
    }
  });

  // SSE for dashboard (uses streamer session auth, separate from overlay token SSE)
  router.get('/admin/sse/meters', requireStreamer, async (req, res) => {
    try {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      res.write(`: connected\n\n`);

      // Reuse the same realtime hub so updates broadcast to both overlay and dashboard
      const { registerClient } = require('../services/realtimeHub');
      registerClient(req.session.streamerId, res);

      const snap = await getMetersSnapshot(req.session.streamerId);
      res.write(`event: meters\n`);
      res.write(`data: ${JSON.stringify(snap)}\n\n`);
    } catch (err) {
      res.status(500).end();
    }
  });

  return router;
}

module.exports = { meterRoutes: meterRoutes() };
