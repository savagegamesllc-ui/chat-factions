// src/services/twitchAuthService.js
'use strict';

const crypto = require('crypto');
const { prisma } = require('../db/prisma');

// Your env module varies across your codebase. We’ll safely support both:
// - { config: {...} } (your current)
/// - { env: {...} }   (your Fastify-side style)
let envMod = {};
try {
  envMod = require('../config/env');
} catch {
  envMod = {};
}
const config = envMod?.config || envMod?.env || {};

// Node 18+ has fetch; otherwise use node-fetch.
let fetchFn = global.fetch;
async function getFetch() {
  if (fetchFn) return fetchFn;
  const mod = await import('node-fetch');
  fetchFn = mod.default;
  return fetchFn;
}

// ---------
// Helpers
// ---------

function readCfg(...keys) {
  for (const k of keys) {
    const v = config?.[k] ?? process.env?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
}

function assertEnv() {
  const cid = readCfg('twitchClientId', 'TWITCH_CLIENT_ID');
  const sec = readCfg('twitchClientSecret', 'TWITCH_CLIENT_SECRET');
  const red = readCfg('twitchRedirectUri', 'TWITCH_REDIRECT_URI');

  if (!cid) throw new Error('TWITCH_CLIENT_ID missing');
  if (!sec) throw new Error('TWITCH_CLIENT_SECRET missing');
  if (!red) throw new Error('TWITCH_REDIRECT_URI missing');
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

// ✅ MISSING BEFORE: used by authRoutes.js
function randomToken(bytes = 16) {
  const n = Number(bytes) || 16;
  return crypto.randomBytes(n).toString('hex');
}

// ✅ MISSING BEFORE: used by authRoutes.js
function buildTwitchAuthorizeUrl(state) {
  assertEnv();

  const clientId = readCfg('twitchClientId', 'TWITCH_CLIENT_ID');
  const redirectUri = readCfg('twitchRedirectUri', 'TWITCH_REDIRECT_URI');

  // Default scopes for Chat Factions
  // Chat + identity + monetization (EventSub)
  const defaultScopes = [
    'user:read:email',
    'chat:read',
    'chat:edit',
    'bits:read',
    'channel:read:subscriptions',
  ];

  // Allow override via env, but fall back to defaults
  const scopeStr =
    readCfg('twitchScopes', 'TWITCH_SCOPES') ||
    defaultScopes.join(' ');

  const u = new URL('https://id.twitch.tv/oauth2/authorize');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', scopeStr);
  u.searchParams.set('state', String(state || ''));

  // Optional but useful when adding new scopes:
  // u.searchParams.set('force_verify', 'true');

  return u.toString();
}


/**
 * Fetch Twitch user from Helix using access token.
 * Returns { twitchUserId, login, displayName, email }
 */
async function fetchTwitchUser(accessToken) {
  assertEnv();
  const fetch = await getFetch();

  const clientId = readCfg('twitchClientId', 'TWITCH_CLIENT_ID');

  const resp = await fetch('https://api.twitch.tv/helix/users', {
    method: 'GET',
    headers: {
      'Client-Id': clientId,
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

  const clientId = readCfg('twitchClientId', 'TWITCH_CLIENT_ID');
  const clientSecret = readCfg('twitchClientSecret', 'TWITCH_CLIENT_SECRET');
  const redirectUri = readCfg('twitchRedirectUri', 'TWITCH_REDIRECT_URI');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: String(code),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
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
  const tokenBundle = await exchangeCodeForToken(code);
  const twitchUser = await fetchTwitchUser(tokenBundle.accessToken);
  const streamer = await upsertStreamerFromTwitchUser(twitchUser, tokenBundle);
  return { streamer, twitchUser, tokenBundle };
}

/**
 * Legacy name used by authRoutes.js
 * Accepts either raw twitch token JSON or our tokenBundle shape.
 */
async function saveTwitchTokensForStreamer(streamerId, tokenJson) {
  if (!streamerId) throw new Error('Missing streamerId');

  const access = tokenJson?.access_token ?? tokenJson?.accessToken ?? null;
  const refresh = tokenJson?.refresh_token ?? tokenJson?.refreshToken ?? null;

  const expiresIn = tokenJson?.expires_in ?? null;
  const expiresAt =
    tokenJson?.expiresAt ??
    (expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null);

  const scopes = tokenJson?.scope ?? tokenJson?.scopes ?? null;
  const scopeArr = normalizeScopes(scopes);

  return prisma.streamer.update({
    where: { id: String(streamerId) },
    data: {
      twitchAccessToken: access,
      twitchRefreshToken: refresh,
      twitchTokenExpiresAt: expiresAt,
      twitchScopes: scopeArr,
      twitchTokenUpdatedAt: new Date(),
    },
  });
}

module.exports = {
  randomToken,
  buildTwitchAuthorizeUrl,

  handleOAuthCallback,

  exchangeCodeForToken,
  fetchTwitchUser,
  upsertStreamerFromTwitchUser,
  saveTwitchTokensForStreamer,
};
