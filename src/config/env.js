// src/config/env.js
'use strict';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function toInt(value, fallback) {
  const n = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  // Prisma uses DATABASE_URL directly, but we validate it exists early.
  databaseUrl: requireEnv('DATABASE_URL'),

  // Sessions
  sessionSecret: requireEnv('SESSION_SECRET'),

  // Owner credentials (Phase 2 will use these)
  ownerUsername: process.env.OWNER_USERNAME || '',
  ownerPassword: process.env.OWNER_PASSWORD || '',

  // Twitch OAuth (Phase 3 will use these)
  twitchClientId: process.env.TWITCH_CLIENT_ID || '',
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  twitchRedirectUri: process.env.TWITCH_REDIRECT_URI || '',

  // Stripe (Phase 6 will use these)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO || '',

  // Base URL (helpful for generating absolute links)
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${toInt(process.env.PORT, 3000)}`,

  TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET || '',
  EVENTSUB_WEBHOOK_SECRET: process.env.EVENTSUB_WEBHOOK_SECRET || ''
};

module.exports = { config };
