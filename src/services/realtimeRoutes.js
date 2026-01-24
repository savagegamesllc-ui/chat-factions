// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { resolveOverlayByToken } = require('../services/overlayRenderService');
const { registerClient } = require('../services/realtimeHub');
const { getMetersSnapshot } = require('../services/meterService');

function openSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: don't buffer SSE
  res.write(`: connected\n\n`);
}

function realtimeRoutes() {
  const router = express.Router();

  router.get('/ping', (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // Admin dashboard SSE (requires streamer session)
  router.get('/sse', async (req, res) => {
    const streamerId = req.session?.streamerId;
    if (!streamerId) return res.status(401).json({ error: 'Not authenticated' });

    openSse(res);

    // register client for this streamer
    registerClient(streamerId, res);

    // send initial snapshot
    const snap = await getMetersSnapshot(streamerId);
    res.write(`event: meters\n`);
    res.write(`data: ${JSON.stringify(snap)}\n\n`);
  });

  // Overlay SSE by overlay token (OBS overlay can subscribe without session)
  router.get('/overlay/:token/sse', async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const resolved = await resolveOverlayByToken(token);
    const streamerId = resolved?.streamer?.id;
    if (!streamerId) return res.status(404).json({ error: 'Overlay not found' });

    openSse(res);

    registerClient(streamerId, res);

    const snap = await getMetersSnapshot(streamerId);
    res.write(`event: meters\n`);
    res.write(`data: ${JSON.stringify(snap)}\n\n`);
  });

  return router;
}

module.exports = { realtimeRoutes };
