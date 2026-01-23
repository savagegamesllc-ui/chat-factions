// src/middleware/requireOwner.js
'use strict';

/**
 * Owner auth gate.
 * Contract:
 * - Owner login sets: req.session.owner = true
 */
function requireOwner(req, res, next) {
  if (req.session && req.session.owner === true) return next();
  return res.redirect('/owner/login');
}

module.exports = { requireOwner };
