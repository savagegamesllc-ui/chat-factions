// src/routes/chatConfigRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');
const {
  DEFAULT_CHAT_CONFIG,
  getEffectiveChatConfig,
  saveChatConfig
} = require('../services/chatConfigService');

function chatConfigRoutes() {
  const router = express.Router();

  router.get('/admin/chat', requireStreamer, (req, res) => {
    res.render('pages/streamer/chat', { title: 'Chat Settings' });
  });

  router.get('/admin/api/chat/config', requireStreamer, async (req, res) => {
    try {
      const effective = await getEffectiveChatConfig(req.session.streamerId);
      res.json({ effective, defaults: DEFAULT_CHAT_CONFIG });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to load chat config.' });
    }
  });

  router.post('/admin/api/chat/config', requireStreamer, async (req, res) => {
    try {
      const text = (req.body && req.body.chatConfigText) ?? '';
      const out = await saveChatConfig(req.session.streamerId, text);
      res.json(out);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to save chat config.' });
    }
  });

  return router;
}

module.exports = { chatConfigRoutes: chatConfigRoutes() };
