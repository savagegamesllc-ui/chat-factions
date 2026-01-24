// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { resolveOverlayByToken } = require('../services/overlayRenderService');
const { getMetersSnapshot } = require('../services/meterService');
const { subscribe } = require('../services/realtimeHub');

function requireStreamer(req, res) {
  const streamerId = req.session && req.session.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function openSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // initial comment to open stream
  res.write(`: connected\n\n`);

  // keepalive
  const ping = setInterval(() => {
    try { res.write(`: ping ${Date.now()}\n\n`); } catch (_) {}
  }, 15000);

  res.on('close', () => {
    clearInterval(ping);
  });
}

function sendEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function realtimeRoutes() {
  const router = express.Router();

  // ================
  // 1) Overlay SSE (existing shape): /overlay/:token/sse
  // ================
  router.get('/overlay/:token/sse', async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).send('Missing token');

    const resolved = await resolveOverlayByToken(token);
    const streamerId = resolved.streamer.id;

    openSse(res);

    // Subscribe to hub broadcasts for this streamer
    const unsub = subscribe(streamerId, (eventName, payload) => {
      try { sendEvent(res, eventName, payload); } catch (_) {}
    });

    res.on('close', () => unsub());

    // Send initial snapshot immediately
    const snap = await getMetersSnapshot(streamerId);
    sendEvent(res, 'meters', snap);
  });

  // ================
  // 2) Overlay SSE (meters.js fallback): /overlay/sse?token=...
  // ================
  router.get('/overlay/sse', async (req, res) => {
    const token = String(req.query && req.query.token || '').trim();
    if (!token) return res.status(400).send('Missing token');
    req.params.token = token;
    return router.handle(req, res, () => {});
  });

  // ================
  // 3) Admin SSE (meters.js first choice): /admin/api/realtime/sse
  //    Uses streamer session.
  // ================
  router.get('/admin/api/realtime/sse', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    openSse(res);

    const unsub = subscribe(streamerId, (eventName, payload) => {
      try { sendEvent(res, eventName, payload); } catch (_) {}
    });

    res.on('close', () => unsub());

    const snap = await getMetersSnapshot(streamerId);
    sendEvent(res, 'meters', snap);
  });

  // Optional aliases meters.js probes
  router.get('/admin/realtime/sse', (req, res, next) => {
    req.url = '/admin/api/realtime/sse';
    next();
  });

  router.get('/realtime/sse', (req, res, next) => {
    req.url = '/admin/api/realtime/sse';
    next();
  });

  router.get('/sse', (req, res, next) => {
    req.url = '/admin/api/realtime/sse';
    next();
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
