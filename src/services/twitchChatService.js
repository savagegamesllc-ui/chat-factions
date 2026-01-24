// src/services/twitchChatService.js
'use strict';

const tmi = require('tmi.js');
const { prisma } = require('../db/prisma');
const { getValidAccessToken } = require('./twitchTokenService');

const clients = new Map(); // streamerId -> { client, channel }

async function startChatForStreamer(streamerId) {
  if (!streamerId) {
    const e = new Error('Missing streamerId');
    e.statusCode = 400;
    throw e;
  }

  if (clients.has(streamerId)) return { ok: true, alreadyRunning: true };

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      id: true,
      login: true,
      displayName: true,
    },
  });

  if (!streamer) {
    const e = new Error('Streamer not found');
    e.statusCode = 404;
    throw e;
  }

  if (!streamer.login) {
    const e = new Error('Streamer.login is missing (Twitch username). Re-auth via Twitch to populate it.');
    e.statusCode = 400;
    throw e;
  }

  const token = await getValidAccessToken(streamerId);
  if (!token) {
    const e = new Error('No Twitch access token available.');
    e.statusCode = 400;
    throw e;
  }

  const channelName = streamer.login;

  const client = new tmi.Client({
    options: { debug: true },
    identity: {
      username: channelName,
      password: `oauth:${token}`,
    },
    channels: [channelName],
  });

  client.on('notice', (channel, msgid, message) => {
    console.log('[tmi notice]', { streamerId, channel, msgid, message });
  });

  client.on('connected', (addr, port) => {
    console.log('[tmi connected]', { streamerId, addr, port, channel: channelName });
  });

  client.on('disconnected', (reason) => {
    console.log('[tmi disconnected]', { streamerId, reason });
    clients.delete(streamerId);
  });

  client.on('message', (channel, tags, message, self) => {
    if (self) return;
    // Later: parse commands + forward into meters/realtime
    // console.log('[chat]', channel, tags.username, message);
  });

  try {
    await client.connect();
  } catch (err) {
    console.error('[tmi connect] failed', err);
    throw err instanceof Error ? err : new Error('tmi.connect failed');
  }

  clients.set(streamerId, { client, channel: channelName });

  return { ok: true };
}

async function stopChatForStreamer(streamerId) {
  const entry = clients.get(streamerId);
  if (!entry) return { ok: true, notRunning: true };

  try {
    await entry.client.disconnect();
  } catch (_) {}

  clients.delete(streamerId);
  return { ok: true };
}

function getChatStatus(streamerId) {
  return { running: clients.has(streamerId) };
}

module.exports = {
  startChatForStreamer,
  stopChatForStreamer,
  getChatStatus,
};
