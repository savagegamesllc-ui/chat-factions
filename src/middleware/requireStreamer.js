// src/middleware/requireStreamer.js
'use strict';

/**
 * Streamer auth gate.
 * Contract:
 * - After Twitch login: req.session.streamerId = <streamer.id>
 * - If missing: redirect to /admin/login (per your locked requirement)
 */
function requireStreamer(req, res, next) {
  if (req.session && req.session.streamerId) return next();
  return res.redirect('/admin/login');
}

module.exports = { requireStreamer };
