// src/routes/realtimeRoutes.js
'use strict';

const express = require('express');

const { findStreamerByEventKey } = require('../services/eventKeyService');
const { reserveExternalEvent } = require('../services/idempotencyService');
const { broadcast } = require('../services/realtimeHub');

const {
  addHype,
  setHype,
  resetHype,
  bulkAddHype,
  getMetersSnapshot
} = require('../services/meterService');

function realtimeRoutes() {
  const router = express.Router();

  /**
   * External event ingest (game triggers, bonus events, etc.)
   *
   * Auth:
   *  - Header: X-Event-Key: <streamer.eventApiKey>
   *
   * Idempotency:
   *  - Optional body.eventId
   *
   * Actions:
   *  - ADD:      { action:"ADD", factionKey, delta }
   *  - SET:      { action:"SET", factionKey, value }
   *  - RESET:    { action:"RESET", factionKey }
   *  - BULK_ADD: { action:"BULK_ADD", items:[{ factionKey, delta }, ...] }
   *
   * Response:
   *  - { ok:true, action, eventId, ...result }
   */
  router.post('/api/events/hype', async (req, res) => {
    try {
      // --- Auth ---
      const eventKey = String(req.headers['x-event-key'] || '').trim();
      if (!eventKey) return res.status(401).json({ error: 'Missing X-Event-Key header.' });

      const streamer = await findStreamerByEventKey(eventKey);
      if (!streamer) return res.status(401).json({ error: 'Invalid event key.' });

      // --- Idempotency ---
      const eventId = (req.body && req.body.eventId) ? String(req.body.eventId) : null;

      const okToProcess = await reserveExternalEvent(streamer.id, eventId);
      if (!okToProcess) {
        // Idempotent success response (do not re-apply)
        return res.json({ ok: true, duplicate: true, eventId });
      }

      // --- Common payload ---
      const actionRaw = (req.body && req.body.action) ? String(req.body.action) : 'ADD';
      const action = actionRaw.trim().toUpperCase();

      const source = (req.body && req.body.source) || 'api';
      const meta = (req.body && req.body.meta) || null;

      const metaWithEvent = (meta && typeof meta === 'object')
        ? { ...meta, eventId }
        : (eventId ? { eventId } : meta);

      // --- Execute action ---
      let result;

      if (action === 'ADD') {
        const factionKey = String((req.body && req.body.factionKey) || '').trim();
        const delta = (req.body && req.body.delta) ?? 0;

        if (!factionKey) return res.status(400).json({ error: 'factionKey is required for ADD.' });

        result = await addHype(streamer.id, factionKey, delta, source, metaWithEvent);

      } else if (action === 'SET') {
        const factionKey = String((req.body && req.body.factionKey) || '').trim();
        const value = (req.body && req.body.value) ?? 0;

        if (!factionKey) return res.status(400).json({ error: 'factionKey is required for SET.' });

        result = await setHype(streamer.id, factionKey, value, source, metaWithEvent);

      } else if (action === 'RESET') {
        const factionKey = String((req.body && req.body.factionKey) || '').trim();

        if (!factionKey) return res.status(400).json({ error: 'factionKey is required for RESET.' });

        result = await resetHype(streamer.id, factionKey, source, metaWithEvent);

      } else if (action === 'BULK_ADD') {
        const items = (req.body && req.body.items) || null;
        result = await bulkAddHype(streamer.id, items, source, metaWithEvent);

      } else {
        return res.status(400).json({ error: `Unknown action "${action}". Use ADD|SET|RESET|BULK_ADD.` });
      }

      // --- Broadcast updated snapshot ---
      const snap = await getMetersSnapshot(streamer.id);
      broadcast(streamer.id, 'meters', snap);

      return res.json({ ok: true, action, eventId, ...result });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message || 'Event ingest failed.' });
    }
  });

  // Optional: keep a placeholder root if you want, but don't break clients.
  router.post('/api/events', (req, res) => {
    res.status(404).json({ error: 'Use POST /api/events/hype' });
  });

  return router;
}

module.exports = { realtimeRoutes: realtimeRoutes() };
