// src/middleware/overlayHeaders.js
'use strict';

function overlayHeaders(req, res, next) {
  // Keep overlays permissive enough for OBS while still safe.
  // No inline scripts needed; we only allow same-origin scripts/modules.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",          // module scripts allowed from same origin
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https: wss:", // SSE / WS
      "font-src 'self' data: https:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors *"
    ].join('; ')
  );

  next();
}

module.exports = { overlayHeaders };
