// src/routes/chatRoutes.js
'use strict';

const express = require('express');
const {
  startChatForStreamer,
  stopChatForStreamer,
  getChatStatus
} = require('../services/twitchChatService');

function requireStreamer(req, res) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function chatRoutes() {
  const router = express.Router();

  // Primary endpoints expected by meters.js
  router.get('/admin/api/chat/status', (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;
    res.json({ ok: true, ...getChatStatus(streamerId) });
  });

  router.post('/admin/api/chat/start', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;
    try {
      const out = await startChatForStreamer(streamerId);
      res.json({ ok: true, ...out });
    } catch (e) {
      console.error('[chat/start] failed', e);
      res.status(e.statusCode || 500).json({ error: 'start failed' });
    }
  });

  router.post('/admin/api/chat/stop', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;
    try {
      const out = await stopChatForStreamer(streamerId);
      res.json({ ok: true, ...out });
    } catch (e) {
      console.error('[chat/stop] failed', e);
      res.status(e.statusCode || 500).json({ error: 'stop failed' });
    }
  });

  // Aliases meters.js tries (so it stops 404-ing)
  router.post('/admin/api/chat/listener/start', async (req, res) => {
    req.url = '/admin/api/chat/start';
    router.handle(req, res);
  });

  router.post('/admin/chat/start', async (req, res) => {
    req.url = '/admin/api/chat/start';
    router.handle(req, res);
  });

  return router;
}

module.exports = { chatRoutes: chatRoutes() };
