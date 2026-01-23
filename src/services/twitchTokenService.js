// src/services/twitchTokenService.js
'use strict';

const { prisma } = require('../db/prisma');
const { config } = require('../config/env');

async function refreshTwitchToken(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      twitchRefreshToken: true
    }
  });
  if (!streamer || !streamer.twitchRefreshToken) {
    throw Object.assign(new Error('No Twitch refresh token available.'), { statusCode: 400 });
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: streamer.twitchRefreshToken,
    client_id: config.twitchClientId,
    client_secret: config.twitchClientSecret
  });

  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`Twitch refresh failed: ${json?.message || resp.statusText}`);
  }

  await prisma.streamer.update({
    where: { id: streamerId },
    data: {
      twitchAccessToken: json.access_token,
      twitchRefreshToken: json.refresh_token || streamer.twitchRefreshToken,
      twitchTokenExpiresAt: json.expires_in
        ? new Date(Date.now() + Number(json.expires_in) * 1000)
        : null,
      twitchScopes: json.scope ? json.scope : null,
      twitchTokenUpdatedAt: new Date()
    }
  });

  return json.access_token;
}

async function getValidAccessToken(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      twitchAccessToken: true,
      twitchTokenExpiresAt: true
    }
  });
  if (!streamer || !streamer.twitchAccessToken) {
    throw Object.assign(new Error('No Twitch access token available.'), { statusCode: 400 });
  }

  const expiresAt = streamer.twitchTokenExpiresAt ? new Date(streamer.twitchTokenExpiresAt).getTime() : 0;
  const now = Date.now();

  // refresh if expiring within 2 minutes
  if (expiresAt && expiresAt - now < 2 * 60 * 1000) {
    return refreshTwitchToken(streamerId);
  }

  return streamer.twitchAccessToken;
}

module.exports = {
  getValidAccessToken,
  refreshTwitchToken
};
