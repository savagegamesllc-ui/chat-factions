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

// Route modules (skeleton now; filled in later phases)
const { authRoutes } = require('./routes/authRoutes');
const { dashboardRoutes } = require('./routes/dashboardRoutes');
const { ownerRoutes } = require('./routes/ownerRoutes');
const { overlayRoutes } = require('./routes/overlayRoutes');
const { billingRoutes } = require('./routes/billingRoutes');
const { webhookRoutes } = require('./routes/webhookRoutes');
const { realtimeRoutes } = require('./routes/realtimeRoutes');
const { attachStreamer } = require('./middleware/attachStreamer');
const { meterRoutes } = require('./routes/meterRoutes');
const { chatRoutes } = require('./routes/chatRoutes');
const { chatConfigRoutes } = require('./routes/chatConfigRoutes');
const { eventKeyRoutes } = require('./routes/eventKeyRoutes');
const { eventApiPageRoutes } = require('./routes/eventApiPageRoutes');
const { ownerStreamersRoutes } = require('./routes/ownerStreamersRoutes');




const app = express();

// Trust proxy if you later deploy behind reverse proxy (nginx, cloudflare, etc.)
app.set('trust proxy', 1);

// Template engine (SSR)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Security + compression
app.use(helmet());
app.use(compression());

// Stripe Webhook
app.use(webhookRoutes);

// Parsers (note: Stripe webhooks need raw body later; webhookRoutes will handle that separately)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Sessions (cookie-based, per contract)
app.use(
  session({
    name: 'sos.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false // set true when behind HTTPS in production
    }
  })
);

// Static assets
app.use('/public', express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    // Prevent OBS/Chromium from choking on odd mime + nosniff combos
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Template locals
app.use(attachLocals);
app.use(attachStreamer);


// Home
app.get('/', (req, res) => {
  res.render('pages/home', {
    title: 'Streamer Overlay System'
  });
});

// Mount routes (no route imports from other routes; contracts stay stable)
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(ownerRoutes);
app.use(overlayRoutes);
app.use(billingRoutes);
app.use(webhookRoutes);
app.use(realtimeRoutes);
app.use(meterRoutes);
app.use(chatRoutes);
app.use(chatConfigRoutes);
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
