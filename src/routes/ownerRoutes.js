// src/routes/ownerRoutes.js
'use strict';

const express = require('express');
const { requireOwner } = require('../middleware/requireOwner');
const { validateOwnerLogin } = require('../services/ownerAuthService');
const {
  listLayouts,
  getLayoutById,
  createLayout,
  updateLayout
} = require('../services/overlayLayoutService');

const { getSystemHealth, listStreamers } = require('../services/systemHealthService');

function ownerRoutes() {
  const router = express.Router();

  // --------------------
  // Owner Auth
  // --------------------

  router.get('/owner/login', (req, res) => {
    if (req.session && req.session.owner === true) return res.redirect('/owner');

    res.render('pages/owner/login', {
      title: 'Owner Login',
      error: null,
      usernameDefault: 'owner'
    });
  });

  router.post('/owner/login', (req, res) => {
    const username = String(req.body.username || '');
    const password = String(req.body.password || '');

    const result = validateOwnerLogin(username, password);

    if (!result.ok) {
      return res.status(401).render('pages/owner/login', {
        title: 'Owner Login',
        error: result.reason || 'Login failed.',
        usernameDefault: username || 'owner'
      });
    }

    // ✅ Locked contract
    req.session.owner = true;

    return res.redirect('/owner');
  });

  router.post('/owner/logout', requireOwner, (req, res) => {
    req.session.owner = false;
    return res.redirect('/owner/login');
  });

    router.get('/owner/health', requireOwner, async (req, res, next) => {
    try {
      const health = await getSystemHealth();
      res.render('pages/owner/health', {
        title: 'System Health',
        health
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/owner/streamers', requireOwner, async (req, res, next) => {
    try {
      const streamers = await listStreamers({ take: 200 });
      res.render('pages/owner/streamers', {
        title: 'Streamers',
        streamers
      });
    } catch (err) {
      next(err);
    }
  });

  // --------------------
  // Owner Dashboard
  // --------------------

  router.get('/owner', requireOwner, async (req, res, next) => {
    try {
      const layouts = await listLayouts({ includeInactive: true });

      res.render('pages/owner/dashboard', {
        title: 'Owner Dashboard',
        layoutCount: layouts.length
      });
    } catch (err) {
      next(err);
    }
  });

  // --------------------
  // Owner: Overlay Layouts
  // --------------------

  router.get('/owner/layouts', requireOwner, async (req, res, next) => {
    try {
      const layouts = await listLayouts({ includeInactive: true });
      res.render('pages/owner/layouts', {
        title: 'Overlay Layouts',
        layouts
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/owner/layouts/new', requireOwner, (req, res) => {
    res.render('pages/owner/layoutEdit', {
      title: 'Create Layout',
      mode: 'create',
      error: null,
      layout: {
        name: '',
        styleKey: '',
        tier: 'FREE',
        isActive: true,
        defaultConfig: '',
        metadata: ''
      }
    });
  });

  router.post('/owner/layouts/new', requireOwner, async (req, res, next) => {
    try {
      const created = await createLayout({
        name: req.body.name,
        styleKey: req.body.styleKey,
        tier: req.body.tier,
        isActive: req.body.isActive,
        defaultConfig: req.body.defaultConfig,
        metadata: req.body.metadata
      });

      return res.redirect(`/owner/layouts/${created.id}`);
    } catch (err) {
      // Render same form with error
      return res.status(err.statusCode || 400).render('pages/owner/layoutEdit', {
        title: 'Create Layout',
        mode: 'create',
        error: err.message || 'Failed to create layout.',
        layout: {
          name: String(req.body.name || ''),
          styleKey: String(req.body.styleKey || ''),
          tier: String(req.body.tier || 'FREE'),
          isActive: Boolean(req.body.isActive),
          defaultConfig: String(req.body.defaultConfig || ''),
          metadata: String(req.body.metadata || '')
        }
      });
    }
  });

  router.get('/owner/layouts/:id', requireOwner, async (req, res, next) => {
    try {
      const layout = await getLayoutById(req.params.id);
      if (!layout) return res.status(404).send('Layout not found.');

      res.render('pages/owner/layoutEdit', {
        title: `Edit Layout: ${layout.name}`,
        mode: 'edit',
        error: null,
        layout: {
          id: layout.id,
          name: layout.name,
          styleKey: layout.styleKey,
          tier: layout.tier,
          isActive: layout.isActive,
          defaultConfig: layout.defaultConfig ? JSON.stringify(layout.defaultConfig, null, 2) : '',
          metadata: layout.metadata ? JSON.stringify(layout.metadata, null, 2) : ''
        }
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/owner/layouts/:id', requireOwner, async (req, res, next) => {
    try {
      const updated = await updateLayout(req.params.id, {
        name: req.body.name,
        styleKey: req.body.styleKey,
        tier: req.body.tier,
        isActive: req.body.isActive,
        defaultConfig: req.body.defaultConfig,
        metadata: req.body.metadata
      });

      return res.redirect(`/owner/layouts/${updated.id}`);
    } catch (err) {
      // Re-render with error
      return res.status(err.statusCode || 400).render('pages/owner/layoutEdit', {
        title: 'Edit Layout',
        mode: 'edit',
        error: err.message || 'Failed to update layout.',
        layout: {
          id: req.params.id,
          name: String(req.body.name || ''),
          styleKey: String(req.body.styleKey || ''),
          tier: String(req.body.tier || 'FREE'),
          isActive: Boolean(req.body.isActive),
          defaultConfig: String(req.body.defaultConfig || ''),
          metadata: String(req.body.metadata || '')
        }
      });
    }
  });

  return router;
}

module.exports = { ownerRoutes: ownerRoutes() };
