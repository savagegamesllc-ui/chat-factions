// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const { subscribe } = require('../services/realtimeHub');

function requireStreamer(req, res) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function writeSse(res, eventName, payload) {
  // SSE format:
  // event: name
  // data: {...}
  // <blank line>
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload ?? {})}\n\n`);
}

function startSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Helps nginx not buffer SSE
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers immediately
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Comment line keeps some proxies happy
  res.write(': connected\n\n');
}

function realtimeRoutes() {
  const router = express.Router();

  /**
   * ============================
   * ADMIN (session-based) SSE
   * ============================
   * meters.js expects these:
   *   GET /admin/api/realtime/sse
   *   GET /admin/api/realtime/status
   *
   * NOTE: server.js mounts routes at root, so these are exact paths.
   */
  router.get('/admin/api/realtime/status', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;
    res.json({ ok: true, streamerId, ts: new Date().toISOString() });
  });

  router.get('/admin/api/realtime/sse', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    startSse(res);

    // Subscribe this connection to realtimeHub for this streamer
    const unsubscribe = subscribe(streamerId, (eventName, payload) => {
      try {
        writeSse(res, eventName, payload);
      } catch (_) {
        // ignore write errors; close handler will clean up
      }
    });

    // Heartbeat ping every 25s (prevents idle timeouts)
    const t = setInterval(() => {
      try {
        writeSse(res, 'ping', { ok: true, ts: new Date().toISOString() });
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try { unsubscribe(); } catch (_) {}
    });
  });

  /**
   * ============================
   * OVERLAY (token-based) SSE
   * ============================
   * Useful for OBS overlay clients that only have the overlayToken.
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

    startSse(res);

    const streamerId = streamer.id;

    const unsubscribe = subscribe(streamerId, (eventName, payload) => {
      try {
        writeSse(res, eventName, payload);
      } catch (_) {}
    });

    const t = setInterval(() => {
      try {
        writeSse(res, 'ping', { ok: true, ts: new Date().toISOString() });
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try { unsubscribe(); } catch (_) {}
    });
  });

  /**
   * ============================
   * Optional: External event ingestion (token-based)
   * ============================
   * Keep these if you already use them.
   * Example: POST /api/events/hype (your game triggers, etc.)
   *
   * If you don’t need these here, you can remove them.
   */

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
