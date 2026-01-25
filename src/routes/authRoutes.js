// src/routes/authRoutes.js
'use strict';

const express = require('express');
const {
  randomToken,
  buildTwitchAuthorizeUrl,
  handleOAuthCallback,
} = require('../services/twitchAuthService');

function authRoutes() {
  const router = express.Router();

  router.get('/admin/login', (req, res) => {
    if (req.session && req.session.streamerId) return res.redirect('/admin'); // ✅ FIX
    return res.render('pages/streamer/login', { title: 'Streamer Login', error: null });
  });

  router.get('/admin/auth/twitch', (req, res, next) => {
    try {
      const state = randomToken(16);
      req.session.twitchOAuthState = state;
      return res.redirect(buildTwitchAuthorizeUrl(state));
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

      const result = await handleOAuthCallback(String(code));
      const streamer = result?.streamer;

      if (!streamer?.id) {
        return res.status(500).render('pages/streamer/login', {
          title: 'Streamer Login',
          error: 'Login succeeded but streamer record could not be created.',
        });
      }

      req.session.streamerId = streamer.id;

      return res.redirect('/admin'); // ✅ FIX
    } catch (err) {
      return next(err);
    }
  });

  router.post('/admin/logout', (req, res) => {
    if (req.session) {
      req.session.streamerId = null;
      delete req.session.streamerId;
    }
    return res.redirect('/admin/login');
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });

  return router;
}

module.exports = { authRoutes: authRoutes() };
