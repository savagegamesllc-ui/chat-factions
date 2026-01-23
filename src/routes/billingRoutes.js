// src/routes/billingRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');

const {
  getBillingStatus,
  createProCheckoutSession,
  createCustomerPortalUrl
} = require('../services/stripeService');

function billingRoutes() {
  const router = express.Router();

  // Billing tab (SSR)
  router.get('/admin/billing', requireStreamer, (req, res) => {
    res.render('pages/streamer/billing', {
      title: 'Billing'
    });
  });

  // Contract endpoint
  router.get('/admin/api/billing/status', requireStreamer, async (req, res) => {
    try {
      const status = await getBillingStatus(req.session.streamerId);
      res.json(status);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to load billing status.' });
    }
  });

  // Create checkout session (PRO subscription)
  router.post('/admin/api/billing/checkout', requireStreamer, async (req, res) => {
    try {
      const url = await createProCheckoutSession(req.session.streamerId);
      res.json({ url });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to create checkout session.' });
    }
  });

  // Customer portal (manage subscription)
  router.post('/admin/api/billing/portal', requireStreamer, async (req, res) => {
    try {
      const url = await createCustomerPortalUrl(req.session.streamerId);
      if (!url) return res.json({ url: null, action: 'checkout_required' });
      res.json({ url });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to create customer portal session.' });
    }
  });

  return router;
}

module.exports = { billingRoutes: billingRoutes() };
