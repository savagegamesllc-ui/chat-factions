// src/routes/chatRoutes.js
'use strict';

const express = require('express');
const { startChatForStreamer, stopChatForStreamer, getChatStatus } = require('../services/twitchChatService');

function requireStreamer(req, res) {
  const streamerId = req.session && req.session.streamerId;
  if (!streamerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return streamerId;
}

function chatRoutes() {
  const router = express.Router();

  // meters.js tries these first
  router.post('/admin/api/chat/start', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    try {
      const out = await startChatForStreamer(streamerId);
      res.json(out);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || 'start failed' });
    }
  });

  router.post('/admin/api/chat/stop', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    try {
      const out = await stopChatForStreamer(streamerId);
      res.json(out);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || 'stop failed' });
    }
  });

  router.get('/admin/api/chat/status', async (req, res) => {
    const streamerId = requireStreamer(req, res);
    if (!streamerId) return;

    try {
      const out = await getChatStatus(streamerId);
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(500).json({ error: e.message || 'status failed' });
    }
  });

  // Optional compatibility aliases (meters.js tries these too)
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
