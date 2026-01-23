// src/middleware/attachStreamer.js
'use strict';

const { getStreamerById } = require('../services/streamerService');

/**
 * Attaches the current streamer (if logged in) to res.locals.streamer.
 * Does not enforce auth; requireStreamer still does that.
 */
async function attachStreamer(req, res, next) {
  try {
    const streamerId = req.session && req.session.streamerId;
    if (!streamerId) {
      res.locals.streamer = null;
      return next();
    }

    const streamer = await getStreamerById(streamerId);
    res.locals.streamer = streamer || null;

    // If session references a deleted streamer, clear the session key.
    if (!streamer) {
      delete req.session.streamerId;
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { attachStreamer };
