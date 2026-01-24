// src/routes/chatRoutes.js
'use strict';

const express = require('express');
const {
  startChatForStreamer,
  stopChatForStreamer,
  getChatStatus
} = require('../services/twitchChatService');

function requireStreamer(req, res) {
  const streamerId = req.session && req.session.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function toErrText(e) {
  if (!e) return 'Unknown error (empty rejection)';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || e.stack || 'Error (no message)';
  if (typeof e === 'object') {
    // try common fields
    if (e.message) return String(e.message);
    if (e.error) return String(e.error);
    try { return JSON.stringify(e); } catch { return String(e); }
  }
  return String(e);
}

function chatRoutes() {
  const router = express.Router();

  router.post('/admin/api/chat/start', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    try {
      const out = await startChatForStreamer(streamerId);
      res.json(out);
    } catch (e) {
      // ✅ This is what we NEED right now:
      console.error('[chat/start] failed:', e);

      res
        .status((e && e.statusCode) || 500)
        .json({ error: toErrText(e) });
    }
  });

  router.post('/admin/api/chat/stop', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    try {
      const out = await stopChatForStreamer(streamerId);
      res.json(out);
    } catch (e) {
      console.error('[chat/stop] failed:', e);
      res
        .status((e && e.statusCode) || 500)
        .json({ error: toErrText(e) });
    }
  });

  router.get('/admin/api/chat/status', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    try {
      const out = await getChatStatus(streamerId);
      res.json({ ok: true, ...out });
    } catch (e) {
      console.error('[chat/status] failed:', e);
      res.status(500).json({ error: toErrText(e) });
    }
  });

  // Compatibility aliases (meters.js tries these too)
  router.post('/admin/api/chat/listener/start', (req, res, next) => {
    req.url = '/admin/api/chat/start';
    next();
  });

  router.post('/admin/api/chat/listener/stop', (req, res, next) => {
    req.url = '/admin/api/chat/stop';
    next();
  });

  router.post('/admin/chat/start', (req, res, next) => {
    req.url = '/admin/api/chat/start';
    next();
  });

  router.post('/admin/chat/stop', (req, res, next) => {
    req.url = '/admin/api/chat/stop';
    next();
  });

  return router;
}

module.exports = { chatRoutes: chatRoutes() };
