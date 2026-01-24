// src/services/twitchTokenService.js
'use strict';

const { prisma } = require('../db/prisma');
const { config } = require('../config/env');

// Node 18+ has global fetch. Older Node needs node-fetch.
let fetchFn = global.fetch;
async function getFetch() {
  if (fetchFn) return fetchFn;
  // Lazy import so this file works even if node-fetch isn't installed in dev.
  const mod = await import('node-fetch');
  fetchFn = mod.default;
  return fetchFn;
}

function normalizeScopes(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  return String(scope)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function httpErr(statusCode, message) {
  const e = new Error(message || 'Request failed');
  e.statusCode = statusCode || 500;
  return e;
}

function assertTwitchEnv() {
  // Your twitchAuthService.js expects these:
  // config.twitchClientId, config.twitchClientSecret, config.twitchRedirectUri
  if (!config.twitchClientId) throw httpErr(500, 'TWITCH_CLIENT_ID missing');
  if (!config.twitchClientSecret) throw httpErr(500, 'TWITCH_CLIENT_SECRET missing');
  if (!config.twitchRedirectUri) throw httpErr(500, 'TWITCH_REDIRECT_URI missing');
}

/**
 * Refresh Twitch token using the refresh token stored on Streamer.
 * Updates Streamer fields:
 * - twitchAccessToken
 * - twitchRefreshToken
 * - twitchTokenExpiresAt
 * - twitchScopes (Json array)
 * - twitchTokenUpdatedAt
 */
async function refreshTwitchToken(streamerId) {
  assertTwitchEnv();

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      twitchRefreshToken: true,
    },
  });

  if (!streamer?.twitchRefreshToken) {
    throw httpErr(400, 'No Twitch refresh token available.');
  }

  const fetch = await getFetch();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: String(streamer.twitchRefreshToken),
    client_id: String(config.twitchClientId),
    client_secret: String(config.twitchClientSecret),
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
    throw httpErr(400, `Twitch refresh failed: ${msg}`);
  }

  const accessToken = json?.access_token ? String(json.access_token) : '';
  if (!accessToken) {
    throw httpErr(500, 'Twitch refresh succeeded but no access_token returned.');
  }

  const expiresIn = Number(json?.expires_in || 0);
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

  const scopes = normalizeScopes(json?.scope);

  await prisma.streamer.update({
    where: { id: streamerId },
    data: {
      twitchAccessToken: accessToken,
      twitchRefreshToken: json?.refresh_token
        ? String(json.refresh_token)
        : streamer.twitchRefreshToken,
      twitchTokenExpiresAt: expiresAt,
      twitchScopes: scopes,
      twitchTokenUpdatedAt: new Date(),
    },
  });

  return accessToken;
}

/**
 * Returns a valid access token for the streamer.
 * If token expires within 2 minutes, refreshes automatically.
 */
async function getValidAccessToken(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      twitchAccessToken: true,
      twitchRefreshToken: true,
      twitchTokenExpiresAt: true,
    },
  });

  if (!streamer?.twitchAccessToken) {
    throw httpErr(400, 'No Twitch access token available.');
  }

  const token = String(streamer.twitchAccessToken);
  const expMs = streamer.twitchTokenExpiresAt
    ? new Date(streamer.twitchTokenExpiresAt).getTime()
    : 0;

  // Refresh if expiring soon
  if (expMs) {
    const msLeft = expMs - Date.now();
    if (msLeft < 2 * 60 * 1000) {
      if (!streamer.twitchRefreshToken) return token; // best effort
      return refreshTwitchToken(streamerId);
    }
  }

  return token;
}

module.exports = {
  getValidAccessToken,
  refreshTwitchToken,
};
