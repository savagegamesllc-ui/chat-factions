// src/services/twitchAuthService.js
'use strict';

const crypto = require('crypto');
const { prisma } = require('../db/prisma');
const { config } = require('../config/env');

// Node 18+ has fetch; otherwise use node-fetch.
let fetchFn = global.fetch;
async function getFetch() {
  if (fetchFn) return fetchFn;
  const mod = await import('node-fetch');
  fetchFn = mod.default;
  return fetchFn;
}

function assertEnv() {
  if (!config.twitchClientId) throw new Error('TWITCH_CLIENT_ID missing');
  if (!config.twitchClientSecret) throw new Error('TWITCH_CLIENT_SECRET missing');
  if (!config.twitchRedirectUri) throw new Error('TWITCH_REDIRECT_URI missing');
}

function normalizeScopes(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  return String(scope)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function computeExpiresAt(expiresInSeconds) {
  const n = Number(expiresInSeconds || 0);
  if (!n) return null;
  return new Date(Date.now() + n * 1000);
}

function newOverlayToken() {
  // stable unguessable token for OBS URL
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Fetch Twitch user from Helix using access token.
 * Returns { twitchUserId, login, displayName, email }
 */
async function fetchTwitchUser(accessToken) {
  const fetch = await getFetch();

  const resp = await fetch('https://api.twitch.tv/helix/users', {
    method: 'GET',
    headers: {
      'Client-Id': String(config.twitchClientId),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = json?.message || json?.error || resp.statusText || `HTTP ${resp.status}`;
    throw new Error(`Helix /users failed: ${msg}`);
  }

  const u = Array.isArray(json?.data) ? json.data[0] : null;
  if (!u?.id) throw new Error('Helix /users returned no user');

  return {
    twitchUserId: String(u.id),
    login: u.login ? String(u.login) : null,
    displayName: u.display_name ? String(u.display_name) : (u.login ? String(u.login) : 'Unknown'),
    email: u.email ? String(u.email) : null,
  };
}

/**
 * Upsert Streamer row based on Twitch user id.
 * - overlayToken is created once and preserved
 * - planTier defaults to FREE via schema
 * - also stores OAuth tokens on the streamer row
 */
async function upsertStreamerFromTwitchUser(twitchUser, tokenBundle) {
  const existing = await prisma.streamer.findUnique({
    where: { twitchUserId: twitchUser.twitchUserId },
  });

  const tokenData = tokenBundle
    ? {
        twitchAccessToken: tokenBundle.accessToken || null,
        twitchRefreshToken: tokenBundle.refreshToken || null,
        twitchTokenExpiresAt: tokenBundle.expiresAt || null,
        twitchScopes: tokenBundle.scopes || [],
        twitchTokenUpdatedAt: new Date(),
      }
    : {};

  if (existing) {
    return prisma.streamer.update({
      where: { id: existing.id },
      data: {
        login: twitchUser.login,
        displayName: twitchUser.displayName,
        email: twitchUser.email,
        ...tokenData,
      },
    });
  }

  return prisma.streamer.create({
    data: {
      twitchUserId: twitchUser.twitchUserId,
      login: twitchUser.login,
      displayName: twitchUser.displayName,
      email: twitchUser.email,
      overlayToken: newOverlayToken(),
      ...tokenData,
    },
  });
}

/**
 * Exchange OAuth code for tokens
 */
async function exchangeCodeForToken(code) {
  assertEnv();
  const fetch = await getFetch();

  const body = new URLSearchParams({
    client_id: String(config.twitchClientId),
    client_secret: String(config.twitchClientSecret),
    code: String(code),
    grant_type: 'authorization_code',
    redirect_uri: String(config.twitchRedirectUri),
  });

  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg =
      json?.error_description ||
      json?.message ||
      json?.error ||
      resp.statusText ||
      `HTTP ${resp.status}`;
    throw new Error(`Twitch token exchange failed: ${msg}`);
  }

  const accessToken = json?.access_token ? String(json.access_token) : null;
  if (!accessToken) throw new Error('Token exchange succeeded but no access_token returned');

  return {
    accessToken,
    refreshToken: json?.refresh_token ? String(json.refresh_token) : null,
    expiresAt: computeExpiresAt(json?.expires_in),
    scopes: normalizeScopes(json?.scope),
  };
}

async function handleOAuthCallback(code) {
  // 1) Exchange code -> tokens
  const tokenBundle = await exchangeCodeForToken(code);

  // 2) Fetch user from Helix
  const twitchUser = await fetchTwitchUser(tokenBundle.accessToken);

  // 3) Upsert Streamer + store tokens
  const streamer = await upsertStreamerFromTwitchUser(twitchUser, tokenBundle);

  return { streamer, twitchUser, tokenBundle };
}

module.exports = {
  handleOAuthCallback,
  exchangeCodeForToken,
  fetchTwitchUser,
  upsertStreamerFromTwitchUser,
};
