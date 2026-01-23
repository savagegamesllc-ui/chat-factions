// src/middleware/errorHandler.js
'use strict';

function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  console.error('[ERROR]', err);

  const status = err.statusCode || err.status || 500;

  // If it's an API route, return JSON
  if (req.path.startsWith('/api') || req.path.startsWith('/owner/api') || req.path.startsWith('/admin/api')) {
    return res.status(status).json({
      error: 'internal_error',
      message: status === 500 ? 'Unexpected server error' : err.message
    });
  }

  // Otherwise render a minimal error page
  return res.status(status).send(
    `<h1>Error</h1><p>${status === 500 ? 'Unexpected server error' : String(err.message)}</p>`
  );
}

module.exports = { errorHandler };
