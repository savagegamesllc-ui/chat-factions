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

function startSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // nginx: do not buffer SSE
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(': connected\n\n');
}

function writeSse(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload ?? {})}\n\n`);
}

function realtimeRoutes() {
  const router = express.Router();

  // meters.js expects this
  router.get('/admin/api/realtime/status', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;
    res.json({ ok: true, streamerId, ts: new Date().toISOString() });
  });

  // meters.js expects this
  router.get('/admin/api/realtime/sse', (req, res) => {
    try {
      const streamerId = requireStreamer(req, res);
      if (!streamerId) return;

      if (typeof subscribe !== 'function') {
        console.error('[realtimeRoutes] subscribe is not a function. Check services/realtimeHub exports.');
        return res.status(500).json({ error: 'Realtime hub misconfigured (subscribe missing)' });
      }

      startSse(res);

      const unsubscribe = subscribe(streamerId, (eventName, payload) => {
        try {
          writeSse(res, eventName, payload);
        } catch (_) {
          // ignore write errors; close handler will clean up
        }
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
    } catch (e) {
      console.error('[realtimeRoutes] SSE handler crashed:', e);
      // If headers were already sent, we can’t send JSON; just end.
      try {
        if (!res.headersSent) res.status(500).json({ error: 'SSE crashed' });
        else res.end();
      } catch (_) {}
    }
  });

  // OBS/token-based SSE (nice to keep)
  router.get('/overlay/:token/sse', async (req, res) => {
    try {
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
        try { writeSse(res, eventName, payload); } catch (_) {}
      });

      const t = setInterval(() => {
        try { writeSse(res, 'ping', { ok: true, ts: new Date().toISOString() }); } catch (_) {}
      }, 25000);

      req.on('close', () => {
        clearInterval(t);
        try { unsubscribe(); } catch (_) {}
      });
    } catch (e) {
      console.error('[realtimeRoutes] overlay SSE crashed:', e);
      try {
        if (!res.headersSent) res.status(500).json({ error: 'SSE crashed' });
        else res.end();
      } catch (_) {}
    }
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
