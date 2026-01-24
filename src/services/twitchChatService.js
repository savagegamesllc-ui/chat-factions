// src/services/twitchChatService.js
'use strict';

const tmi = require('tmi.js');
const { prisma } = require('../db/prisma');
const { getValidAccessToken } = require('./twitchTokenService');

// If you have these in your project, you can wire them back in later.
// const { addHype, getMetersSnapshot } = require('./meterService');
// const { broadcast } = require('./realtimeHub');
// const { getOrCreateActiveSession } = require('./sessionService');
// const { checkAndTouchCooldown } = require('./cooldownService');
// const { getEffectiveChatConfig } = require('./chatConfigService');

const clients = new Map(); // streamerId -> { client, channel }

async function startChatForStreamer(streamerId) {
  if (clients.has(streamerId)) return { ok: true, already: true };

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      id: true,
      twitchLogin: true,   // ⚠️ If your field is named differently, adjust here.
      displayName: true,
    },
  });

  if (!streamer || !streamer.twitchLogin) {
    const e = new Error('Streamer Twitch login not found.');
    e.statusCode = 400;
    throw e;
  }

  const token = await getValidAccessToken(streamerId);
  if (!token) {
    const e = new Error('No Twitch access token available.');
    e.statusCode = 400;
    throw e;
  }

  const client = new tmi.Client({
    options: { debug: true },
    identity: {
      username: streamer.twitchLogin,
      password: `oauth:${token}`,
    },
    channels: [streamer.twitchLogin],
  });

  client.on('notice', (channel, msgid, message) => {
    console.log('[tmi notice]', { streamerId, channel, msgid, message });
  });

  client.on('connected', (addr, port) => {
    console.log('[tmi connected]', { streamerId, addr, port, channel: streamer.twitchLogin });
  });

  client.on('disconnected', (reason) => {
    console.log('[tmi disconnected]', { streamerId, reason });
    clients.delete(streamerId);
  });

  // Keep message handler minimal for now
  client.on('message', (channel, tags, message, self) => {
    if (self) return;
    // Later: parse commands and push into meters/realtimeHub
  });

  try {
    await client.connect();
  } catch (err) {
    console.error('[tmi connect] failed', err);
    throw err instanceof Error ? err : new Error('tmi.connect failed');
  }

  clients.set(streamerId, { client, channel: streamer.twitchLogin });
  return { ok: true };
}

async function stopChatForStreamer(streamerId) {
  const entry = clients.get(streamerId);
  if (!entry) return { ok: true, already: true };

  try {
    await entry.client.disconnect();
  } catch (_) {}

  clients.delete(streamerId);
  return { ok: true };
}

function getChatStatus(streamerId) {
  return { connected: clients.has(streamerId) };
}

module.exports = {
  startChatForStreamer,
  stopChatForStreamer,
  getChatStatus,
};
