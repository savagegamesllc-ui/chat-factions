// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');

// ✅ Load realtimeHub in a way that survives export shape changes
const realtimeHub = require('../services/realtimeHub');
const subscribe =
  (realtimeHub && realtimeHub.subscribe) ||
  (realtimeHub && realtimeHub.realtimeHub && realtimeHub.realtimeHub.subscribe) ||
  (realtimeHub && realtimeHub.default && realtimeHub.default.subscribe) ||
  null;

function requireStreamer(req, res) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function writeSse(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload ?? {})}\n\n`);
}

function startSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: don't buffer

  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(': connected\n\n');
}

function realtimeRoutes() {
  const router = express.Router();

  router.get('/admin/api/realtime/status', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;
    res.json({ ok: true, streamerId, ts: new Date().toISOString() });
  });

  router.get('/admin/api/realtime/sse', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    // ✅ DO NOT crash the process if subscribe is missing
    if (typeof subscribe !== 'function') {
      return res.status(500).json({
        error: 'Realtime hub not wired (subscribe missing). Check realtimeHub exports.',
      });
    }

    startSse(res);

    let unsubscribe = null;
    try {
      unsubscribe = subscribe(streamerId, (eventName, payload) => {
        try {
          writeSse(res, eventName, payload);
        } catch (_) {}
      });
    } catch (e) {
      return res.status(500).json({
        error: 'Failed to subscribe realtime hub',
        detail: e?.message || String(e),
      });
    }

    const t = setInterval(() => {
      try {
        writeSse(res, 'ping', { ok: true, ts: new Date().toISOString() });
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try {
        if (typeof unsubscribe === 'function') unsubscribe();
      } catch (_) {}
    });
  });

  router.get('/overlay/:token/sse', async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const streamer = await prisma.streamer.findUnique({
      where: { overlayToken: token },
      select: { id: true },
    });

    if (!streamer?.id) return res.status(404).json({ error: 'Invalid token' });

    if (typeof subscribe !== 'function') {
      return res.status(500).json({
        error: 'Realtime hub not wired (subscribe missing). Check realtimeHub exports.',
      });
    }

    startSse(res);

    const streamerId = streamer.id;

    let unsubscribe = null;
    try {
      unsubscribe = subscribe(streamerId, (eventName, payload) => {
        try {
          writeSse(res, eventName, payload);
        } catch (_) {}
      });
    } catch (e) {
      return res.status(500).json({
        error: 'Failed to subscribe realtime hub',
        detail: e?.message || String(e),
      });
    }

    const t = setInterval(() => {
      try {
        writeSse(res, 'ping', { ok: true, ts: new Date().toISOString() });
      } catch (_) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(t);
      try {
        if (typeof unsubscribe === 'function') unsubscribe();
      } catch (_) {}
    });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
