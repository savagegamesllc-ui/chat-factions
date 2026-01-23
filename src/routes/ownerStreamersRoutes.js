// src/routes/ownerStreamersRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const { requireOwner } = require('../middleware/requireOwner');

function ownerStreamersRoutes() {
  const router = express.Router();

  // Page (SSR)
  router.get('/owner/streamers', requireOwner, async (req, res, next) => {
    try {
      res.render('pages/owner/streamers', { title: 'Owner — Streamers' });
    } catch (err) {
      next(err);
    }
  });

  // API: list streamers
  router.get('/owner/api/streamers', requireOwner, async (req, res, next) => {
    try {
      const streamers = await prisma.streamer.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          displayName: true,
          login: true,
          twitchUserId: true,
          planTier: true,
          proOverride: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          overlayToken: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json({ streamers });
    } catch (err) {
      next(err);
    }
  });

  // API: set plan + override
  router.post('/owner/api/streamers/:id/plan', requireOwner, async (req, res) => {
    try {
      const id = String(req.params.id || '');

      const planTier = String((req.body && req.body.planTier) || '').toUpperCase();
      const proOverride = !!(req.body && req.body.proOverride);

      if (!id) return res.status(400).json({ error: 'Missing streamer id.' });
      if (planTier !== 'FREE' && planTier !== 'PRO') {
        return res.status(400).json({ error: 'planTier must be FREE or PRO.' });
      }

      const updated = await prisma.streamer.update({
        where: { id },
        data: {
          planTier,
          proOverride,
          proGrantedAt: (planTier === 'PRO' || proOverride) ? new Date() : null
        },
        select: {
          id: true,
          displayName: true,
          planTier: true,
          proOverride: true,
          proGrantedAt: true,
          updatedAt: true
        }
      });

      res.json({ ok: true, streamer: updated });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to update plan.' });
    }
  });

  return router;
}

module.exports = { ownerStreamersRoutes: ownerStreamersRoutes() };
