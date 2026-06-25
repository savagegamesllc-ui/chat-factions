// src/routes/companionApiRoutes.js
'use strict';

const express = require('express');
const { requireCompanionKey } = require('../middleware/requireCompanionKey');
const { prisma } = require('../db/prisma');
const { registerClient, unregisterClient } = require('../services/realtimeHub');
const { getMetersSnapshot } = require('../services/meterService');
const { getStatsSnapshot } = require('../services/statsService');

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

  /**
   * GET /api/v1/companion/events
   * Server-Sent Events stream. Sends a full snapshot on connect, then forwards
   * all real-time broadcasts (meters, stats, session, voting) as they happen.
   * Uses the same realtimeHub as the overlay SSE — no extra broadcast calls needed.
   *
   * Event types the companion app will receive:
   *   snapshot  — fired once on connect: { session, meters, stats }
   *   meters    — faction meter values changed
   *   stats     — streamer stats changed (latest follower, sub, etc.)
   *   session   — session started or ended
   *   voting    — voting open/closed state changed
   *   ping      — keepalive heartbeat every 25 s
   */
  router.get('/api/v1/companion/events', async (req, res) => {
    const streamerId = req.companionStreamer.id;
    const connId = `companion:${streamerId}:${Date.now().toString(36)}`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    registerClient(streamerId, res);

    // Send a full snapshot immediately so the companion app has current state
    // without needing to call any REST endpoints first.
    try {
      const [session, metersSnap, statsSnap] = await Promise.all([
        prisma.streamSession.findFirst({
          where: { streamerId, endedAt: null },
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            startedAt: true,
            title: true,
            votingOpen: true,
            votingChangedAt: true,
            lastDecayAt: true
          }
        }),
        getMetersSnapshot(streamerId),
        getStatsSnapshot(streamerId)
      ]);

      res.write(`event: snapshot\n`);
      res.write(`data: ${JSON.stringify({
        session: session || null,
        meters: metersSnap ?? {},
        stats: statsSnap ?? {}
      })}\n\n`);
    } catch (e) {
      console.error('[companion-sse] snapshot failed', { connId, message: e?.message || String(e) });
      res.write(`event: snapshot\n`);
      res.write(`data: ${JSON.stringify({ session: null, meters: {}, stats: {} })}\n\n`);
    }

    // Keepalive ping every 25 s — matches the overlay SSE interval
    const pingTimer = setInterval(() => {
      try {
        res.write(`event: ping\n`);
        res.write(`data: {"t":${Date.now()}}\n\n`);
      } catch (_) {}
    }, 25_000);

    req.on('close', () => {
      clearInterval(pingTimer);
      try { unregisterClient(streamerId, res); } catch (_) {}
      try { res.end(); } catch (_) {}
    });
  });

  return router;
}

module.exports = { companionApiRoutes: companionApiRoutes() };
