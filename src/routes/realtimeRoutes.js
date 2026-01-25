// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const {
  registerClient,
  unregisterClient,
  getClientCount,
} = require('../services/realtimeHub');

function requireStreamer(req, res) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function startSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // nginx: do not buffer
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers immediately (if supported)
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // initial comment line
  res.write(': connected\n\n');
}

function realtimeRoutes() {
  const router = express.Router();

  /**
   * ADMIN (session-based) SSE
   * meters.js expects:
   *   GET /admin/api/realtime/sse
   *   GET /admin/api/realtime/status
   */
  router.get('/admin/api/realtime/status', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    res.json({
      ok: true,
      streamerId,
      clients: getClientCount(streamerId),
      ts: new Date().toISOString(),
    });
  });

  router.get('/admin/api/realtime/sse', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    startSse(res);

    // Register this response with the hub (hub.broadcast will write SSE frames)
    registerClient(streamerId, res);

    // Heartbeat every 25s to keep proxies happy
    const t = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ ok: true, ts: new Date().toISOString() })}\n\n`);
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try { unregisterClient(streamerId, res); } catch (_) {}
    });
  });

  /**
   * OVERLAY (token-based) SSE
   *   GET /overlay/:token/sse
   */
  router.get('/overlay/:token/sse', async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const streamer = await prisma.streamer.findUnique({
      where: { overlayToken: token },
      select: { id: true },
    });

    if (!streamer?.id) return res.status(404).json({ error: 'Invalid token' });

    const streamerId = streamer.id;

    startSse(res);

    registerClient(streamerId, res);

    const t = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ ok: true, ts: new Date().toISOString() })}\n\n`);
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try { unregisterClient(streamerId, res); } catch (_) {}
    });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
