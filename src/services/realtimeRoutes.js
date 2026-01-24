// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');
const { realtimeHub } = require('../services/realtimeHub');

/**
 * Routes mounted under /admin (or whatever prefix you use).
 * Provides:
 *   GET  /admin/api/realtime/ping
 *   GET  /admin/api/realtime/sse
 *   POST /admin/api/realtime/push   (debug helper)
 */
const router = express.Router();

// Simple ping (useful behind nginx)
router.get('/api/realtime/ping', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// SSE stream (requires streamer session)
router.get('/api/realtime/sse', (req, res) => {
  const streamerId = req.session?.streamerId;
  if (!streamerId) return res.status(401).json({ error: 'Not authenticated' });

  // Let hub own the SSE wiring
  realtimeHub.openSse(streamerId, req, res);
});

// Debug endpoint: push an event to yourself (helps validate end-to-end)
router.post('/api/realtime/push', express.json(), (req, res) => {
  const streamerId = req.session?.streamerId;
  if (!streamerId) return res.status(401).json({ error: 'Not authenticated' });

  const type = String(req.body?.type || 'debug');
  const payload = req.body?.payload ?? { ok: true };

  realtimeHub.broadcast(streamerId, type, payload);
  res.json({ ok: true });
});

module.exports = { realtimeRoutes: router };
