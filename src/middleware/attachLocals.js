// src/middleware/attachLocals.js
'use strict';

const { config } = require('../config/env');

/**
 * Attach safe, non-secret locals for templates.
 * No business logic here; just convenience flags/values.
 */
function attachLocals(req, res, next) {
  res.locals.nodeEnv = config.nodeEnv;
  res.locals.appBaseUrl = config.appBaseUrl;

  // Auth flags (used by nav partials)
  res.locals.isOwner = Boolean(req.session && req.session.owner === true);
  res.locals.isStreamer = Boolean(req.session && req.session.streamerId);

  // Current path (highlight nav, etc.)
  res.locals.path = req.path;

  // Flash placeholder (we'll wire a real flash mechanism later if needed)
  res.locals.flash = null;

  next();
}

module.exports = { attachLocals };
