'use strict';

import tmi from 'tmi.js';
import { prisma } from '../db/prisma.js';
import { getValidAccessToken } from './twitchTokenService.js';

const activeClients = new Map(); // streamerId -> tmi client

export async function startChatForStreamer(streamerId) {
  if (!streamerId) {
    const err = new Error('Missing streamerId');
    err.statusCode = 400;
    throw err;
  }

  // Prevent duplicate listeners
  if (activeClients.has(streamerId)) {
    return { ok: true, alreadyRunning: true };
  }

  // 🔑 THIS IS THE KEY FIX
  const token = await getValidAccessToken(streamerId);

  if (!token) {
    const err = new Error('No Twitch access token available');
    err.statusCode = 400;
    throw err;
  }

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { twitchLogin: true }
  });

  if (!streamer?.twitchLogin) {
    const err = new Error('Streamer Twitch login not found');
    err.statusCode = 400;
    throw err;
  }

  const client = new tmi.Client({
    options: { debug: false },
    identity: {
      username: streamer.twitchLogin,
      password: `oauth:${token}`,
    },
    channels: [streamer.twitchLogin],
  });

  try {
    await client.connect();
  } catch (e) {
    console.error('[tmi.connect] failed', e);
    throw new Error('Failed to connect to Twitch chat');
  }

  client.on('message', (channel, tags, message, self) => {
    if (self) return;

    // 🔥 This is where you emit to SSE / WS later
    // realtimeHub.emitChatMessage(...)
  });

  activeClients.set(streamerId, client);

  return { ok: true };
}

export async function stopChatForStreamer(streamerId) {
  const client = activeClients.get(streamerId);
  if (!client) return { ok: true, notRunning: true };

  try {
    await client.disconnect();
  } catch (e) {
    console.warn('[tmi.disconnect] failed', e);
  }

  activeClients.delete(streamerId);
  return { ok: true };
}

export async function getChatStatus(streamerId) {
  return {
    running: activeClients.has(streamerId),
  };
}
