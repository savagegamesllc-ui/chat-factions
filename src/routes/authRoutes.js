// src/routes/authRoutes.js
'use strict';

const express = require('express');

const {
  randomToken,
  buildTwitchAuthorizeUrl,
  handleOAuthCallback, // ✅ NEW: single entrypoint (code -> tokens -> helix -> upsert)
} = require('../services/twitchAuthService');

function authRoutes() {
  const router = express.Router();

  // --------------------
  // Streamer Login (Twitch OAuth)
  // --------------------

  // This is where requireStreamer redirects if not logged in (locked contract)
  router.get('/admin/login', (req, res) => {
    if (req.session && req.session.streamerId) return res.redirect('/admin/dashboard');

    return res.render('pages/streamer/login', {
      title: 'Streamer Login',
      error: null,
    });
  });

  router.get('/admin/auth/twitch', (req, res, next) => {
    try {
      // CSRF state token stored in session
      const state = randomToken(16);
      req.session.twitchOAuthState = state;

      const url = buildTwitchAuthorizeUrl(state);
      return res.redirect(url);
    } catch (err) {
      return next(err);
    }
  });

  router.get('/admin/auth/twitch/callback', async (req, res, next) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        return res.status(401).render('pages/streamer/login', {
          title: 'Streamer Login',
          error: String(error_description || error),
        });
      }

      // Verify state (CSRF protection)
      const expectedState = req.session.twitchOAuthState;
      delete req.session.twitchOAuthState;

      if (!expectedState || String(state || '') !== String(expectedState)) {
        return res.status(400).render('pages/streamer/login', {
          title: 'Streamer Login',
          error: 'OAuth state mismatch. Please try again.',
        });
      }

      if (!code) {
        return res.status(400).render('pages/streamer/login', {
          title: 'Streamer Login',
          error: 'Missing OAuth code from Twitch.',
        });
      }

      // ✅ Single atomic flow:
      // - exchange code -> token bundle
      // - helix /users -> twitch user
      // - upsert streamer
      // - persist tokens on streamer row
      const result = await handleOAuthCallback(String(code));
      const streamer = result?.streamer;

      if (!streamer?.id) {
        return res.status(500).render('pages/streamer/login', {
          title: 'Streamer Login',
          error: 'Login succeeded but streamer record could not be created.',
        });
      }

      // ✅ Locked contract: store ONE session key
      req.session.streamerId = streamer.id;

      return res.redirect('/admin/dashboard');
    } catch (err) {
      return next(err);
    }
  });

  // Streamer logout (clears streamer session key)
  router.post('/admin/logout', (req, res) => {
    if (req.session) {
      req.session.streamerId = null;
      delete req.session.streamerId;
    }
    return res.redirect('/admin/login');
  });

  // Keep your generic logout if you want
  router.post('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });

  return router;
}

module.exports = { authRoutes: authRoutes() };
