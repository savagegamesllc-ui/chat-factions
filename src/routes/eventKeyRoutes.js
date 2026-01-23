// src/routes/eventKeyRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');
const { ensureEventApiKey, rotateEventApiKey } = require('../services/eventKeyService');

function eventKeyRoutes() {
  const router = express.Router();

  router.get('/admin/api/events/key', requireStreamer, async (req, res) => {
    try {
      const key = await ensureEventApiKey(req.session.streamerId);
      res.json({ eventApiKey: key });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to load event API key.' });
    }
  });

  router.post('/admin/api/events/key/rotate', requireStreamer, async (req, res) => {
    try {
      const key = await rotateEventApiKey(req.session.streamerId);
      res.json({ eventApiKey: key });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to rotate event API key.' });
    }
  });

  return router;
}

module.exports = { eventKeyRoutes: eventKeyRoutes() };
