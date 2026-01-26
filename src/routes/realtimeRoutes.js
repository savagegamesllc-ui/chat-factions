// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const {
  registerClient,
  unregisterClient,
  getClientCount,
  broadcast
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
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: don’t buffer SSE

  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(': connected\n\n');
}

function realtimeRoutes() {
  const router = express.Router();

  // ============================
  // ADMIN (session-based)
  // ============================

  // Status probe
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

  // Admin SSE
  router.get('/admin/api/realtime/sse', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    startSse(res);
    registerClient(streamerId, res);

    const t = setInterval(() => {
      try {
        res.write(
          `event: ping\ndata: ${JSON.stringify({
            ok: true,
            ts: new Date().toISOString(),
          })}\n\n`
        );
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try { unregisterClient(streamerId, res); } catch (_) {}
    });
  });

  // ============================
  // OVERLAY (token-based)
  // ============================

  // Overlay SSE
  router.get('/overlay/:token/sse', async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const streamer = await prisma.streamer.findUnique({
      where: { overlayToken: token },
      select: { id: true },
    });

    if (!streamer?.id) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    const streamerId = streamer.id;

    startSse(res);
    registerClient(streamerId, res);

    const t = setInterval(() => {
      try {
        res.write(
          `event: ping\ndata: ${JSON.stringify({
            ok: true,
            ts: new Date().toISOString(),
          })}\n\n`
        );
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try { unregisterClient(streamerId, res); } catch (_) {}
    });
  });

  // ============================
  // DEBUG — PROVE BROADCAST WORKS
  // REMOVE AFTER TESTING
  // ============================

  router.post('/overlay/:token/debug/broadcast', async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const streamer = await prisma.streamer.findUnique({
      where: { overlayToken: token },
      select: { id: true },
    });

    if (!streamer?.id) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    const streamerId = streamer.id;

    const payload = {
      debug: true,
      msg: 'hello from debug broadcast',
      ts: new Date().toISOString(),
    };

    broadcast(streamerId, 'meters', payload);

    return res.json({
      ok: true,
      streamerId,
      clients: getClientCount(streamerId),
      sent: payload,
    });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
