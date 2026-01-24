// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { registerSseClient } = require('../services/realtimeHub');

function requireStreamer(req, res) {
  const streamerId = req.session && req.session.streamerId;
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

  // GET /admin/api/realtime/sse  (THIS IS WHAT meters.js expects)
  router.get('/api/realtime/sse', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // helps nginx SSE

    // initial comment to open stream
    res.write(`: ok\n\n`);

    // register
    registerSseClient(streamerId, res);

    // heartbeat
    const t = setInterval(() => {
      try { res.write(`event: ping\ndata: {"ts":"${new Date().toISOString()}"}\n\n`); } catch {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
    });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
