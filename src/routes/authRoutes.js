// src/routes/authRoutes.js
'use strict';

const express = require('express');

const {
  randomToken,
  buildTwitchAuthorizeUrl,
  exchangeCodeForToken,
  fetchTwitchUser,
  upsertStreamerFromTwitchUser,
  saveTwitchTokensForStreamer, // ✅ NEW
} = require('../services/twitchAuthService');

function authRoutes() {
  const router = express.Router();

  // --------------------
  // Streamer Login (Twitch OAuth)
  // --------------------

  // This is where requireStreamer redirects if not logged in (locked contract)
  router.get('/admin/login', (req, res) => {
    if (req.session && req.session.streamerId) return res.redirect('/admin');

    res.render('pages/streamer/login', {
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
      next(err);
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

      // 1) Exchange code for token
      const tokenJson = await exchangeCodeForToken(String(code));

      // 2) Fetch Twitch user (Helix)
      const twitchUser = await fetchTwitchUser(tokenJson.access_token);

      // 3) Upsert streamer
      const streamer = await upsertStreamerFromTwitchUser(twitchUser);

      // ✅ 4) Persist tokens on Streamer row (needed for chat listener)
      await saveTwitchTokensForStreamer(streamer.id, tokenJson);

      // ✅ Locked contract: store ONE session key
      req.session.streamerId = streamer.id;

      return res.redirect('/admin');
    } catch (err) {
      next(err);
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

  // (Keep your generic logout if you want, but streamer contract uses /admin/logout)
  router.post('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });

  return router;
}

module.exports = { authRoutes: authRoutes() };
