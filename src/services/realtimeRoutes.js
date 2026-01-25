// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { registerClient, unregisterClient, broadcast, getClientCount } = require('../services/realtimeHub');

function requireStreamer(req, res, next) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) return res.status(401).json({ error: 'Not authenticated' });
  req.streamerId = streamerId;
  next();
}

function realtimeRoutes() {
  const router = express.Router();

  /**
   * SSE endpoint used by meters.js (same-origin):
   *   GET /admin/api/realtime/sse
   */
  router.get('/admin/api/realtime/sse', requireStreamer, (req, res) => {
    const streamerId = req.streamerId;

    // SSE headers
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Important for Nginx: prevents buffering SSE
    res.setHeader('X-Accel-Buffering', 'no');

    // If compression middleware exists, this helps avoid buffering
    res.flushHeaders?.();

    // Register this client
    const info = registerClient(streamerId, res);

    // Initial hello event so the browser knows it's live
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, ts: new Date().toISOString(), clients: info.count })}\n\n`);

    // Keepalive ping every 25s so proxies don’t kill idle SSE
    const keepalive = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      } catch {
        // If write fails, close will fire and unregister happens there too
        clearInterval(keepalive);
      }
    }, 25000);

    // Cleanup
    res.on('close', () => {
      clearInterval(keepalive);
      unregisterClient(streamerId, res);
    });
  });

  /**
   * Simple debug endpoint so you can verify session + route quickly:
   *   GET /admin/api/realtime/status
   */
  router.get('/admin/api/realtime/status', requireStreamer, (req, res) => {
    const streamerId = req.streamerId;
    res.json({
      ok: true,
      streamerId,
      clients: getClientCount(streamerId),
      ts: new Date().toISOString(),
    });
  });

  /**
   * Optional dev-only push route:
   * POST /admin/api/realtime/dev/broadcast
   * body: { event: "meters", data: {...} }
   */
  router.post('/admin/api/realtime/dev/broadcast', requireStreamer, express.json(), (req, res) => {
    const streamerId = req.streamerId;
    const event = String(req.body?.event || 'message');
    const data = req.body?.data ?? null;
    const out = broadcast(streamerId, event, data);
    res.json({ ok: true, ...out });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
