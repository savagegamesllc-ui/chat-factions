// src/routes/chatRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');
const {
  startChatForStreamer,
  stopChatForStreamer,
  getChatStatus
} = require('../services/twitchChatService');

function chatRoutes() {
  const router = express.Router();

  router.get('/admin/api/chat/status', requireStreamer, (req, res) => {
    res.json(getChatStatus(req.session.streamerId));
  });

  router.post('/admin/api/chat/start', requireStreamer, async (req, res) => {
    try {
      const out = await startChatForStreamer(req.session.streamerId);
      res.json(out);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to start chat listener.' });
    }
  });

  router.post('/admin/api/chat/stop', requireStreamer, async (req, res) => {
    try {
      const out = await stopChatForStreamer(req.session.streamerId);
      res.json(out);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to stop chat listener.' });
    }
  });

  return router;
}

module.exports = { chatRoutes: chatRoutes() };
