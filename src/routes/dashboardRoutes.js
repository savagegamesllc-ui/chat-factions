// src/routes/dashboardRoutes.js
'use strict';

const express = require('express');
const { requireStreamer } = require('../middleware/requireStreamer');
const { getDashboardSummary } = require('../services/dashboardService');
const { bustChatConfigCache } = require('../services/chatConfigService');



const {
  ensureDefaultFactions,
  listFactions,
  createFaction,
  updateFaction,
  deleteFaction
} = require('../services/factionsService');

const {
  getLayoutsForStreamer,
  selectLayout,
  selectLayoutForSlot,
  saveOverrideConfig
} = require('../services/layoutSelectionService');

const {
  listChatCommands,
  updateChatCommand,
  addAlias,
  deleteAlias
} = require('../services/chatCommandsService');



function dashboardRoutes() {
  const router = express.Router();
  router.get('/admin/dashboard', requireStreamer, (req, res) => res.redirect('/admin'));

  // --------------------
  // Streamer Dashboard Home
  // --------------------
  router.get('/admin', requireStreamer, async (req, res, next) => {
    try {
      // Ensure first-time streamer has factions
      await ensureDefaultFactions(req.session.streamerId);

      res.render('pages/streamer/dashboard', {
        title: 'Streamer Dashboard'
      });
    } catch (err) {
      next(err);
    }
  });

    router.get('/admin/api/summary', requireStreamer, async (req, res, next) => {
    try {
      const summary = await getDashboardSummary(req.session.streamerId);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  // --------------------
  // Layouts Page (SSR)
  // --------------------
  router.get('/admin/layouts', requireStreamer, async (req, res, next) => {
    try {
      res.render('pages/streamer/layouts', { title: 'Overlay Layouts' });
    } catch (err) {
      next(err);
    }
  });

  // Layouts API (JSON)
  router.get('/admin/api/layouts', requireStreamer, async (req, res, next) => {
    try {
      const data = await getLayoutsForStreamer(req.session.streamerId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/api/layouts/select', requireStreamer, async (req, res) => {
    try {
      const layoutId = String((req.body && req.body.layoutId) || '');
      if (!layoutId) return res.status(400).json({ error: 'layoutId is required.' });

      const result = await selectLayout(req.session.streamerId, layoutId);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message || 'Failed to select layout.' });
    }
  });

    // NEW: Select a layout for a specific slot (0..3)
  router.post('/admin/api/layouts/select-slot', requireStreamer, async (req, res) => {
    try {
      const layoutId = String((req.body && req.body.layoutId) || '');
      const slot = Number((req.body && req.body.slot));

      if (!layoutId) return res.status(400).json({ error: 'layoutId is required.' });
      if (!Number.isInteger(slot) || slot < 0 || slot > 3) {
        return res.status(400).json({ error: 'slot must be an integer 0..3.' });
      }

      const result = await selectLayoutForSlot(req.session.streamerId, layoutId, slot);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message || 'Failed to select layout.' });
    }
  });

    router.post('/admin/api/layouts/override', requireStreamer, async (req, res) => {
    try {
      const layoutId = String((req.body && req.body.layoutId) || '');
      const overrideConfigText = (req.body && req.body.overrideConfigText) ?? '';

      if (!layoutId) return res.status(400).json({ error: 'layoutId is required.' });

      const result = await saveOverrideConfig(req.session.streamerId, layoutId, overrideConfigText);
      return res.json(result);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message || 'Failed to save override config.' });
    }
  });

  // --------------------
  // Factions Page (SSR)
  // --------------------
  router.get('/admin/factions', requireStreamer, async (req, res, next) => {
    try {
      await ensureDefaultFactions(req.session.streamerId);

      res.render('pages/streamer/factions', {
        title: 'Factions'
      });
    } catch (err) {
      next(err);
    }
  });

  // --------------------
  // Factions API (JSON)
  // --------------------
  router.get('/admin/api/factions', requireStreamer, async (req, res, next) => {
    try {
      const factions = await listFactions(req.session.streamerId);
      res.json({ factions });
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/api/factions', requireStreamer, async (req, res) => {
    try {
      const created = await createFaction(req.session.streamerId, req.body || {});
      res.status(201).json({ faction: created });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to create faction.' });
    }
  });

  router.put('/admin/api/factions/:id', requireStreamer, async (req, res) => {
    try {
      const updated = await updateFaction(req.session.streamerId, req.params.id, req.body || {});
      res.json({ faction: updated });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to update faction.' });
    }
  });

  router.delete('/admin/api/factions/:id', requireStreamer, async (req, res) => {
    try {
      const result = await deleteFaction(req.session.streamerId, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to delete faction.' });
    }
  });

    // --------------------
  // Chat Page (SSR)
  // --------------------
  router.get('/admin/chat', requireStreamer, async (req, res, next) => {
    try {
      res.render('pages/streamer/chat', { title: 'Chat' });
    } catch (err) {
      next(err);
    }
  });

  // --------------------
  // Chat Commands API (JSON)
  // --------------------
  router.get('/admin/api/chat/commands', requireStreamer, async (req, res, next) => {
    try {
      const data = await listChatCommands(req.session.streamerId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

router.put('/admin/api/chat/commands/:id', requireStreamer, async (req, res) => {
  try {
    const out = await updateChatCommand(req.session.streamerId, req.params.id, req.body || {});
    bustChatConfigCache(req.session.streamerId); // <- bust AFTER update succeeds
    res.json(out);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to update command.' });
  }
});


router.post('/admin/api/chat/commands/:id/aliases', requireStreamer, async (req, res) => {
  try {
    const alias = String((req.body && req.body.alias) || '');
    const out = await addAlias(req.session.streamerId, req.params.id, alias);
    bustChatConfigCache(req.session.streamerId);
    res.status(201).json(out);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to add alias.' });
  }
});

router.delete('/admin/api/chat/aliases/:id', requireStreamer, async (req, res) => {
  try {
    const out = await deleteAlias(req.session.streamerId, req.params.id);
    bustChatConfigCache(req.session.streamerId);
    res.json(out);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to delete alias.' });
  }
});


  return router;
}

module.exports = { dashboardRoutes: dashboardRoutes() };
