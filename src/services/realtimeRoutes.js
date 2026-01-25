// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const { subscribe } = require('../services/realtimeHub');

// Small helper to write SSE events safely
function sseWrite(res, event, data) {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
}

function setSseHeaders(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // If you're behind nginx, disabling buffering helps SSE a LOT:
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

function requireStreamerSession(req, res) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return String(streamerId);
}

function realtimeRoutes() {
  const router = express.Router();

  /**
   * ===========================
   * ADMIN (session) SSE
   * ===========================
   * Used by streamer dashboard (meters UI, etc.)
   * GET /admin/api/realtime/sse
   */
  router.get('/admin/api/realtime/sse', async (req, res) => {
    const streamerId = requireStreamerSession(req, res);
    if (!streamerId) return;

    setSseHeaders(res);

    // Initial hello so browser knows it's connected
    sseWrite(res, 'hello', { ok: true, streamerId, ts: new Date().toISOString() });

    // Subscribe to hub broadcasts for this streamerId
    const unsub = subscribe(streamerId, (eventName, payload) => {
      try {
        sseWrite(res, eventName || 'message', payload);
      } catch (_) {
        // ignore write failures; close handler will clean up
      }
    });

    // Keepalive ping (prevents idle timeouts)
    const ping = setInterval(() => {
      try {
        sseWrite(res, 'ping', { ts: new Date().toISOString() });
      } catch (_) {}
    }, 20000);

    req.on('close', () => {
      clearInterval(ping);
      try { unsub(); } catch (_) {}
      try { res.end(); } catch (_) {}
    });
  });

  /**
   * Quick sanity check
   * GET /admin/api/realtime/status
   */
  router.get('/admin/api/realtime/status', (req, res) => {
    const streamerId = requireStreamerSession(req, res);
    if (!streamerId) return;
    res.json({ ok: true, streamerId, ts: new Date().toISOString() });
  });

  /**
   * ===========================
   * OVERLAY (token) SSE
   * ===========================
   * Used by OBS overlay client
   * GET /overlay/:token/sse
   */
  router.get('/overlay/:token/sse', async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const streamer = await prisma.streamer.findUnique({
      where: { overlayToken: token },
      select: { id: true },
    });

    if (!streamer) return res.status(404).json({ error: 'Invalid token' });

    const streamerId = String(streamer.id);

    setSseHeaders(res);
    sseWrite(res, 'hello', { ok: true, streamerId, ts: new Date().toISOString() });

    const unsub = subscribe(streamerId, (eventName, payload) => {
      try {
        sseWrite(res, eventName || 'message', payload);
      } catch (_) {}
    });

    const ping = setInterval(() => {
      try {
        sseWrite(res, 'ping', { ts: new Date().toISOString() });
      } catch (_) {}
    }, 20000);

    req.on('close', () => {
      clearInterval(ping);
      try { unsub(); } catch (_) {}
      try { res.end(); } catch (_) {}
    });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
