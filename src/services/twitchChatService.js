// src/services/twitchChatService.js
'use strict';

const tmi = require('tmi.js');
const { prisma } = require('../db/prisma');
const { getValidAccessToken } = require('./twitchTokenService');
const { getEffectiveChatConfig } = require('./chatConfigService');
const { getOrCreateActiveSession } = require('./sessionService');
const { checkAndTouchCooldown } = require('./cooldownService');
const { addHype, getMetersSnapshot } = require('./meterService');
const { broadcast } = require('./realtimeHub');

const clients = new Map(); // streamerId -> { client, channel }

function getUserKey(tags) {
  // stable key per user; prefer user-id
  const uid = tags && (tags['user-id'] || tags.userId);
  if (uid) return `uid:${String(uid)}`;
  const u = tags && (tags.username || tags['display-name']);
  return `user:${String(u || 'unknown').toLowerCase()}`;
}

function parseCommand(message, chatCfg) {
  const text = String(message || '').trim();
  if (!text.startsWith('!')) return null;

  // defaults (these exist in your chatConfigService defaults)
  const hypeCmd = String(chatCfg?.commands?.hype?.name || '!hype').toLowerCase();
  const maxCmd = String(chatCfg?.commands?.maxhype?.name || '!maxhype').toLowerCase();

  const parts = text.split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();

  // !hype ORDER 5
  if (cmd === hypeCmd) {
    const factionKey = (parts[1] || '').toUpperCase();
    const delta = Number(parts[2] || 0);
    if (!factionKey) return null;
    return { type: 'hype', factionKey, delta };
  }

  // !maxhype ORDER  (debug)
  if (cmd === maxCmd) {
    const factionKey = (parts[1] || '').toUpperCase();
    if (!factionKey) return null;
    // big visible spike (note: still capped by maxDelta below)
    return { type: 'hype', factionKey, delta: 100 };
  }

  return null;
}

async function startChatForStreamer(streamerId) {
  if (!streamerId) {
    const e = new Error('Missing streamerId');
    e.statusCode = 400;
    throw e;
  }

  if (clients.has(streamerId)) return { ok: true, alreadyRunning: true };

  const streamer = await prisma.streamer.findUnique({
    where: { id: String(streamerId) },
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
    const e = new Error(
      'Streamer.login is missing (Twitch username). Re-auth via Twitch to populate it.'
    );
    e.statusCode = 400;
    throw e;
  }

  const channelName = streamer.login.startsWith('#') ? streamer.login : `#${streamer.login}`;

  // Token must exist (OAuth)
  const accessToken = await getValidAccessToken(streamer.id);

  const client = new tmi.Client({
    options: { debug: false },
    connection: {
      secure: true,
      reconnect: true,
    },
    identity: {
      username: streamer.login, // This makes YOUR messages come in as self===true
      password: `oauth:${accessToken}`,
    },
    channels: [channelName],
  });

  client.on('connected', (addr, port) => {
    console.log('[tmi connected]', {
      streamerId: streamer.id,
      addr,
      port,
      channel: channelName.replace('#', ''),
    });
  });

  client.on('disconnected', (reason) => {
    console.log('[tmi disconnected]', {
      streamerId: streamer.id,
      reason: String(reason || ''),
    });
  });

  client.on('message', async (channel, tags, message, self) => {
    const text = String(message || '').trim();

    // Only log command-like messages to keep noise low
    const isCmd = text.startsWith('!');
    if (isCmd) {
      console.log('[tmi msg]', {
        streamerId: streamer.id,
        channel,
        user: tags?.username,
        display: tags?.['display-name'],
        self,
        text,
      });
    }

    // ✅ IMPORTANT CHANGE:
    // We no longer drop self messages, because you are connected as the streamer account.
    // If later you swap to a separate bot account, this still works fine.
    // if (self) return;

    try {
      const chatCfg = await getEffectiveChatConfig(streamer.id);
      const parsed = parseCommand(text, chatCfg);

      if (!parsed) {
        if (isCmd) console.log('[cmd] not recognized', { streamerId: streamer.id, self, text });
        return;
      }

      // Cap per command
      let deltaRaw = Number(parsed.delta || 0);
      if (!Number.isFinite(deltaRaw) || deltaRaw === 0) {
        console.log('[cmd] delta invalid/zero', { streamerId: streamer.id, parsed, text });
        return;
      }

      let capped = Math.trunc(deltaRaw);

      const maxD = Number(chatCfg?.commands?.hype?.maxDelta ?? 25);
      const lim = Number.isFinite(maxD) ? Math.max(1, Math.abs(Math.trunc(maxD))) : 25;
      capped = Math.max(-lim, Math.min(lim, capped));

      console.log('[cmd] parsed', {
        streamerId: streamer.id,
        parsed,
        deltaRaw,
        capped,
        lim,
        maxD,
      });

      // cooldown
      const session = await getOrCreateActiveSession(streamer.id);
      const userKey = getUserKey(tags);

      const overrideMinutes = chatCfg?.cooldownMinutes?.hype;
      const allowed = await checkAndTouchCooldown(session.id, 'hype', userKey, overrideMinutes);

      console.log('[cmd] cooldown', {
        streamerId: streamer.id,
        allowed,
        userKey,
        overrideMinutes: overrideMinutes ?? null,
        sessionId: session?.id,
      });

      if (!allowed) return;

      // apply
      await addHype(streamer.id, parsed.factionKey, capped, 'chat', {
        user: tags?.username || null,
        displayName: tags?.['display-name'] || null,
        raw: text,
        self: !!self,
      });

      console.log('[cmd] hype applied', {
        streamerId: streamer.id,
        factionKey: parsed.factionKey,
        capped,
      });

      // broadcast updated snapshot
      const snap = await getMetersSnapshot(streamer.id);

      console.log('[cmd] broadcasting meters', {
        streamerId: streamer.id,
        factionKey: parsed.factionKey,
        capped,
        snapKeys: snap ? Object.keys(snap) : null,
      });

      broadcast(streamer.id, 'meters', snap);
    } catch (e) {
      console.error('[twitchChatService] message handler error:', e?.message || e);
    }
  });

  await client.connect();

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
