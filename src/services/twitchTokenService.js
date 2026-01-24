// src/services/twitchTokenService.js
'use strict';

const { prisma } = require('../db/prisma');
const { config } = require('../config/env');

/**
 * Normalize the "scope" value from Twitch into an array of strings.
 * Twitch may return scope as:
 * - array: ["user:read:email"]
 * - string: "user:read:email chat:read"
 * - missing/undefined
 */
function normalizeScopes(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  return String(scope)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function makeHttpError(statusCode, message) {
  const err = new Error(message || 'Request failed');
  err.statusCode = statusCode || 500;
  return err;
}

/**
 * Refresh Twitch access token using the stored refresh token.
 * Updates Streamer.twitchAccessToken, twitchRefreshToken, twitchTokenExpiresAt, twitchScopes, twitchTokenUpdatedAt.
 */
async function refreshTwitchToken(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      twitchRefreshToken: true,
    },
  });

  if (!streamer || !streamer.twitchRefreshToken) {
    throw makeHttpError(400, 'No Twitch refresh token available.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: String(streamer.twitchRefreshToken),
    client_id: String(config.twitchClientId || ''),
    client_secret: String(config.twitchClientSecret || ''),
  });

  // Basic env guard (helps avoid confusing 500s)
  if (!config.twitchClientId || !config.twitchClientSecret) {
    throw makeHttpError(500, 'Server is missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET.');
  }

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
    throw makeHttpError(400, `Twitch refresh failed: ${msg}`);
  }

  const accessToken = json?.access_token ? String(json.access_token) : '';
  if (!accessToken) {
    throw makeHttpError(500, 'Twitch refresh succeeded but no access_token was returned.');
  }

  const expiresIn = Number(json.expires_in || 0);
  const twitchTokenExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : null;

  const scopesArr = normalizeScopes(json.scope);

  await prisma.streamer.update({
    where: { id: streamerId },
    data: {
      twitchAccessToken: accessToken,
      twitchRefreshToken: json.refresh_token
        ? String(json.refresh_token)
        : streamer.twitchRefreshToken,
      twitchTokenExpiresAt,
      twitchScopes: scopesArr, // Json field -> store array
      twitchTokenUpdatedAt: new Date(),
    },
  });

  return accessToken;
}

/**
 * Return a valid access token for a streamer.
 * Refreshes if the token is missing expiry or expiring soon.
 *
 * Refresh behavior:
 * - If expiresAt exists and is within 2 minutes -> refresh
 * - If expiresAt is missing but we have refresh token -> DO NOT force refresh (keeps stable)
 */
async function getValidAccessToken(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      twitchAccessToken: true,
      twitchTokenExpiresAt: true,
      twitchRefreshToken: true,
    },
  });

  if (!streamer || !streamer.twitchAccessToken) {
    throw makeHttpError(400, 'No Twitch access token available.');
  }

  const token = String(streamer.twitchAccessToken);
  const expiresAtMs = streamer.twitchTokenExpiresAt
    ? new Date(streamer.twitchTokenExpiresAt).getTime()
    : 0;

  // Refresh if expiring within 2 minutes
  if (expiresAtMs) {
    const now = Date.now();
    if (expiresAtMs - now < 2 * 60 * 1000) {
      // If refresh token missing, we can still return the token; Twitch may accept briefly.
      if (!streamer.twitchRefreshToken) return token;
      return refreshTwitchToken(streamerId);
    }
  }

  return token;
}

module.exports = {
  getValidAccessToken,
  refreshTwitchToken,
};
