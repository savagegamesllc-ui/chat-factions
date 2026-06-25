// src/routes/companionKeyRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');
const { hasProAccess } = require('../services/stripeService');
const { upsertKey, revokeKey, getKeyInfo } = require('../services/companionKeyService');
const { prisma } = require('../db/prisma');

function companionKeyRoutes() {
  const router = express.Router();

  /**
   * Page: /admin/companion-key
   */
  router.get('/admin/companion-key', requireStreamer, async (req, res) => {
    try {
      const streamer = await prisma.streamer.findUnique({
        where: { id: req.session.streamerId },
        select: { id: true, planTier: true, proOverride: true }
      });
      const isPro = hasProAccess(streamer);
      res.render('pages/streamer/companionKey', {
        title: 'Companion App',
        isPro
      });
    } catch (err) {
      res.status(500).render('pages/notFound', { title: 'Error' });
    }
  });

  /**
   * GET /admin/api/companion/key
   * Returns key metadata (no hash). Returns null if no key exists.
   */
  router.get('/admin/api/companion/key', requireStreamer, async (req, res) => {
    try {
      const streamer = await prisma.streamer.findUnique({
        where: { id: req.session.streamerId },
        select: { planTier: true, proOverride: true }
      });
      const isPro = hasProAccess(streamer);
      const info = await getKeyInfo(req.session.streamerId);
      res.json({ isPro, key: info });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load key info.' });
    }
  });

  /**
   * POST /admin/api/companion/key/generate
   * Generates (or replaces) the companion key. Returns plaintext ONCE.
   */
  router.post('/admin/api/companion/key/generate', requireStreamer, async (req, res) => {
    try {
      const streamer = await prisma.streamer.findUnique({
        where: { id: req.session.streamerId },
        select: { planTier: true, proOverride: true }
      });
      if (!hasProAccess(streamer)) {
        return res.status(403).json({ error: 'Companion app keys require a PRO subscription.' });
      }

      const rawKey = await upsertKey(req.session.streamerId);
      res.json({ key: rawKey });
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate key.' });
    }
  });

  /**
   * POST /admin/api/companion/key/rotate
   * Replaces the existing key. Returns new plaintext ONCE.
   */
  router.post('/admin/api/companion/key/rotate', requireStreamer, async (req, res) => {
    try {
      const streamer = await prisma.streamer.findUnique({
        where: { id: req.session.streamerId },
        select: { planTier: true, proOverride: true }
      });
      if (!hasProAccess(streamer)) {
        return res.status(403).json({ error: 'Companion app keys require a PRO subscription.' });
      }

      const rawKey = await upsertKey(req.session.streamerId);
      res.json({ key: rawKey });
    } catch (err) {
      res.status(500).json({ error: 'Failed to rotate key.' });
    }
  });

  /**
   * POST /admin/api/companion/key/revoke
   * Revokes the active key without generating a new one.
   */
  router.post('/admin/api/companion/key/revoke', requireStreamer, async (req, res) => {
    try {
      const streamer = await prisma.streamer.findUnique({
        where: { id: req.session.streamerId },
        select: { planTier: true, proOverride: true }
      });
      if (!hasProAccess(streamer)) {
        return res.status(403).json({ error: 'Companion app keys require a PRO subscription.' });
      }

      await revokeKey(req.session.streamerId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to revoke key.' });
    }
  });

  return router;
}

module.exports = { companionKeyRoutes: companionKeyRoutes() };
