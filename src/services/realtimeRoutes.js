// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { subscribe } = require('../services/realtimeHub');

function requireStreamer(req, res) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function realtimeRoutes() {
  const router = express.Router();

  // GET /admin/api/realtime/ping
  router.get('/api/realtime/ping', (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // GET /admin/api/realtime/sse
  router.get('/api/realtime/sse', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    // SSE headers
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // If behind nginx, this helps prevent buffering:
    res.setHeader('X-Accel-Buffering', 'no');

    // First message immediately (lets the browser “open” the stream)
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);

    // Keepalive ping every 25s (prevents idle timeouts)
    const keepAlive = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      } catch (_) {}
    }, 25000);

    // Subscribe to server broadcasts for this streamer
    const unsubscribe = subscribe(streamerId, (eventName, payload) => {
      try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload ?? null)}\n\n`);
      } catch (_) {}
    });

    // Cleanup
    req.on('close', () => {
      clearInterval(keepAlive);
      try { unsubscribe(); } catch (_) {}
    });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
