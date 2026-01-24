// src/services/twitchChatService.js
'use strict';

const tmi = require('tmi.js');
const { prisma } = require('../db/prisma');
const { getValidAccessToken } = require('./twitchTokenService');
const { getEffectiveChatConfig } = require('./chatConfigService');


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

  client.on('message', async (channel, tags, message, self) => {
  if (self) return;

  try {
    // Load effective config (defaults + streamer overrides)
    const chatCfg = await getEffectiveChatConfig(streamerId);

    // Parse command
    const parsed = parseCommand(message, chatCfg);
    if (!parsed) return;

    const deltaRaw = Number(parsed.delta);
    if (!Number.isFinite(deltaRaw) || deltaRaw === 0) return;

    // Cap per message (hype uses config maxDelta; vote is tighter)
    let capped = Math.trunc(deltaRaw);

    if (parsed.type === 'hype') {
      const maxD = Number(chatCfg?.commands?.hype?.maxDelta ?? 25);
      const lim = Number.isFinite(maxD) ? Math.max(1, Math.abs(Math.trunc(maxD))) : 25;
      capped = Math.max(-lim, Math.min(lim, capped));
    } else {
      capped = Math.max(-10, Math.min(10, capped));
    }

    // Cooldown per user per action type
    const session = await getOrCreateActiveSession(streamerId);
    const userKey = getUserKey(tags);
    const action = parsed.type; // "vote" | "hype"

    const overrideMinutes = chatCfg?.cooldownMinutes?.[action];
    const allowed = await checkAndTouchCooldown(
      session.id,
      action,
      userKey,
      overrideMinutes
    );

    if (!allowed) return;

    // Apply to meters + log analytics via addHype implementation
    await addHype(streamerId, parsed.factionKey, capped, 'chat', {
      cmd: parsed.type,
      user: tags?.username || null,
      displayName: tags?.['display-name'] || null
    });

    // Broadcast fresh snapshot to overlays
    const snap = await getMetersSnapshot(streamerId);
    broadcast(streamerId, 'meters', snap);
  } catch (e) {
console.error('[twitchChatService] message handler error:', e?.message || e);
  }
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
