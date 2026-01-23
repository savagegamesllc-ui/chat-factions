// src/routes/eventApiPageRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');

function eventApiPageRoutes() {
  const router = express.Router();

  router.get('/admin/event-api', requireStreamer, (req, res) => {
    res.render('pages/streamer/eventApi', { title: 'Event API' });
  });

  return router;
}

module.exports = { eventApiPageRoutes: eventApiPageRoutes() };
