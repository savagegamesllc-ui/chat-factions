// src/services/twitchAuthService.js
'use strict';

const crypto = require('crypto');
const { prisma } = require('../db/prisma');
const { config } = require('../config/env');

function assertTwitchEnv() {
  if (!config.twitchClientId) throw new Error('TWITCH_CLIENT_ID is missing in .env');
  if (!config.twitchClientSecret) throw new Error('TWITCH_CLIENT_SECRET is missing in .env');
  if (!config.twitchRedirectUri) throw new Error('TWITCH_REDIRECT_URI is missing in .env');
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Build Twitch authorize URL.
 * We store a CSRF state token in the session and verify it on callback.
 */
function buildTwitchAuthorizeUrl(state) {
  assertTwitchEnv();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.twitchClientId,
    redirect_uri: config.twitchRedirectUri,
    scope: 'user:read:email',
    state
  });

  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange code for an access token.
 */
async function exchangeCodeForToken(code) {
  assertTwitchEnv();

  const params = new URLSearchParams({
    client_id: config.twitchClientId,
    client_secret: config.twitchClientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.twitchRedirectUri
  });

  const resp = await fetch(`https://id.twitch.tv/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Twitch token exchange failed (${resp.status}): ${text}`);
  }

  return resp.json(); // { access_token, refresh_token, expires_in, token_type }
}

/**
 * Fetch Twitch user via Helix.
 */
async function fetchTwitchUser(accessToken) {
  assertTwitchEnv();

  const resp = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': config.twitchClientId
    }
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Twitch user fetch failed (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  const user = json && json.data && json.data[0];

  if (!user || !user.id) throw new Error('Twitch user fetch returned no user.');

  return {
    twitchUserId: String(user.id),
    login: user.login ? String(user.login) : null,
    displayName: user.display_name ? String(user.display_name) : (user.login ? String(user.login) : 'Streamer'),
    email: user.email ? String(user.email) : null
  };
}

/**
 * Upsert Streamer row based on Twitch user id.
 * - overlayToken is created once and preserved
 * - planTier defaults to FREE via schema
 */
async function upsertStreamerFromTwitchUser(twitchUser) {
  const existing = await prisma.streamer.findUnique({
    where: { twitchUserId: twitchUser.twitchUserId }
  });

  if (existing) {
    return prisma.streamer.update({
      where: { id: existing.id },
      data: {
        login: twitchUser.login,
        displayName: twitchUser.displayName,
        email: twitchUser.email
      }
    });
  }

  return prisma.streamer.create({
    data: {
      twitchUserId: twitchUser.twitchUserId,
      login: twitchUser.login,
      displayName: twitchUser.displayName,
      email: twitchUser.email,
      overlayToken: randomToken(24)
    }
  });
}

module.exports = {
  randomToken,
  buildTwitchAuthorizeUrl,
  exchangeCodeForToken,
  fetchTwitchUser,
  upsertStreamerFromTwitchUser
};
