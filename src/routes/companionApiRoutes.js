// src/routes/companionApiRoutes.js
'use strict';

const express = require('express');
const { requireCompanionKey } = require('../middleware/requireCompanionKey');
const { prisma } = require('../db/prisma');

function companionApiRoutes() {
  const router = express.Router();

  router.use('/api/v1/companion', requireCompanionKey);

  /**
   * GET /api/v1/companion/me
   * Returns streamer identity and plan info.
   */
  router.get('/api/v1/companion/me', (req, res) => {
    const s = req.companionStreamer;
    res.json({
      id: s.id,
      login: s.login,
      displayName: s.displayName,
      planTier: s.planTier,
      proOverride: s.proOverride
    });
  });

  /**
   * GET /api/v1/companion/session
   * Returns the most recent active stream session (or null).
   */
  router.get('/api/v1/companion/session', async (req, res) => {
    try {
      const session = await prisma.streamSession.findFirst({
        where: {
          streamerId: req.companionStreamer.id,
          endedAt: null
        },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          startedAt: true,
          title: true,
          votingOpen: true,
          votingChangedAt: true,
          lastDecayAt: true
        }
      });
      res.json({ session: session || null });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch session.' });
    }
  });

  /**
   * GET /api/v1/companion/factions
   * Returns the streamer's active factions.
   */
  router.get('/api/v1/companion/factions', async (req, res) => {
    try {
      const factions = await prisma.faction.findMany({
        where: {
          streamerId: req.companionStreamer.id,
          isActive: true
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          colorHex: true,
          sortOrder: true
        }
      });
      res.json({ factions });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch factions.' });
    }
  });

  /**
   * GET /api/v1/companion/meters
   * Returns faction meter values for the active session (or empty if no session).
   */
  router.get('/api/v1/companion/meters', async (req, res) => {
    try {
      const session = await prisma.streamSession.findFirst({
        where: {
          streamerId: req.companionStreamer.id,
          endedAt: null
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true }
      });

      if (!session) {
        return res.json({ sessionId: null, meters: [] });
      }

      const meters = await prisma.sessionFactionMeter.findMany({
        where: { sessionId: session.id },
        include: {
          faction: {
            select: { key: true, name: true, colorHex: true }
          }
        },
        orderBy: { faction: { sortOrder: 'asc' } }
      });

      res.json({
        sessionId: session.id,
        meters: meters.map(m => ({
          factionId: m.factionId,
          factionKey: m.faction.key,
          factionName: m.faction.name,
          colorHex: m.faction.colorHex,
          meter: m.meter,
          updatedAt: m.updatedAt
        }))
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch meters.' });
    }
  });

  return router;
}

module.exports = { companionApiRoutes: companionApiRoutes() };
