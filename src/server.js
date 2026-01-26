// src/server.js
'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');

const { config } = require('./config/env');
const { attachLocals } = require('./middleware/attachLocals');
const { errorHandler } = require('./middleware/errorHandler');
const { attachStreamer } = require('./middleware/attachStreamer');

// Route modules
const { eventSubRoutes } = require('./routes/eventSubRoutes');
const { authRoutes } = require('./routes/authRoutes');
const { dashboardRoutes } = require('./routes/dashboardRoutes');
const { ownerRoutes } = require('./routes/ownerRoutes');
const { overlayRoutes } = require('./routes/overlayRoutes');
const { billingRoutes } = require('./routes/billingRoutes');
const { webhookRoutes } = require('./routes/webhookRoutes');
const { realtimeRoutes } = require('./routes/realtimeRoutes');
const { meterRoutes } = require('./routes/meterRoutes');
const { chatRoutes } = require('./routes/chatRoutes');
const { chatConfigRoutes } = require('./routes/chatConfigRoutes');
const { eventKeyRoutes } = require('./routes/eventKeyRoutes');
const { eventApiPageRoutes } = require('./routes/eventApiPageRoutes');
const { ownerStreamersRoutes } = require('./routes/ownerStreamersRoutes');
const { startDecayLoop } = require('./services/decayLoopService');


const app = express();

startDecayLoop({ intervalMs: 15000 });
// Trust proxy if later deployed behind reverse proxy
app.set('trust proxy', 1);

// Template engine (SSR)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Security headers
app.use(helmet());

// IMPORTANT: Skip compression for SSE endpoints.
// Otherwise EventSource often "hangs"/buffers and looks like a spinning request.
app.use(
  compression({
    filter(req, res) {
      const accept = String(req.headers.accept || '');
      const isSseAccept = accept.includes('text/event-stream');

      // Common SSE paths in this project:
      // /admin/api/realtime/sse
      // /admin/realtime/sse
      // /realtime/sse
      // /sse
      // /overlay/:token/sse
      // /overlay/sse
      const p = String(req.path || '');
      const isSsePath = p === '/sse' || p.endsWith('/sse') || p.includes('/sse/');

      if (isSseAccept || isSsePath) return false;

      // Fall back to default compression behavior
      return compression.filter(req, res);
    }
  })
);

/**
 * Stripe Webhooks MUST be mounted BEFORE json/urlencoded parsers
 * so the webhook route can read the raw body and verify signatures.
 */
app.use(webhookRoutes);
app.use(eventSubRoutes({ env: process.env }));
// Parsers (normal routes)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Sessions
app.use(
  session({
    name: 'sos.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: true // set true behind HTTPS in production
    }
  })
);

// Static assets
app.use(
  '/public',
  express.static(path.join(__dirname, '..', 'public'), {
    setHeaders(res, filePath) {
      // Prevent OBS/Chromium from choking on odd mime + nosniff combos
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    }
  })
);

// Template locals + streamer attach
app.use(attachLocals);
app.use(attachStreamer);

// Home
app.get('/', (req, res) => {
  res.render('pages/home', { title: 'Streamer Overlay System' });
});

// Mount routes (contracts stay stable)
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(ownerRoutes);
app.use(realtimeRoutes);
app.use(overlayRoutes);
app.use(billingRoutes);

// Realtime + meters + chat

app.use(meterRoutes);
app.use(chatRoutes);
app.use(chatConfigRoutes);

// Misc tools
app.use(eventKeyRoutes);
app.use(eventApiPageRoutes);
app.use(ownerStreamersRoutes);


// 404
app.use((req, res) => {
  res.status(404).render('pages/notFound', { title: 'Not Found' });
});

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[server] listening on ${config.appBaseUrl}`);
});
