// src/services/twitchChatService.js
'use strict';

const tmi = require('tmi.js');
const { prisma } = require('../db/prisma');
const { getValidAccessToken } = require('./twitchTokenService');
const { addHype, getMetersSnapshot } = require('./meterService');
const { broadcast } = require('./realtimeHub');
const { getOrCreateActiveSession } = require('./sessionService');
const { checkAndTouchCooldown } = require('./cooldownService');
const { getEffectiveChatConfig } = require('./chatConfigService');

const clients = new Map(); // streamerId -> { client, channel }

function normalizeFactionKey(s) {
  return String(s || '').trim().toUpperCase();
}

function parseCommand(message, chatCfg) {
  const txt = String(message || '').trim();
  const prefix = String(chatCfg?.prefix || '!');

  if (!txt.startsWith(prefix)) return null;

  const parts = txt.split(/\s+/);
  const cmd = parts[0].slice(prefix.length).toLowerCase();

  const voteCfg = chatCfg?.commands?.vote || {};
  const hypeCfg = chatCfg?.commands?.hype || {};

  if (cmd === 'vote' && voteCfg.enabled !== false && parts[1]) {
    const w = Number(voteCfg.weight ?? 1);
    const weight = Number.isFinite(w) ? Math.trunc(w) : 1;
    return { type: 'vote', factionKey: normalizeFactionKey(parts[1]), delta: weight };
  }

  if (cmd === 'hype' && hypeCfg.enabled !== false && parts[1]) {
    const delta = parts[2] != null ? Number(parts[2]) : 1;
    return { type: 'hype', factionKey: normalizeFactionKey(parts[1]), delta };
  }

  return null;
}

function getUserKey(tags) {
  // Prefer Twitch numeric user-id (stable); fallback to username
  const id = tags?.['user-id'];
  if (id) return `twitch:${id}`;
  const name = tags?.username;
  if (name) return `twitchuser:${String(name).toLowerCase()}`;
  return 'twitch:unknown';
}

async function startChatForStreamer(streamerId) {
  if (clients.has(streamerId)) return { ok: true, already: true };

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      id: true,
      login: true,
      displayName: true,
    },
  });

  if (!streamer || !streamer.login) {
    throw Object.assign(
      new Error('Streamer has no Twitch login; re-auth may be required.'),
      { statusCode: 400 }
    );
  }

  // Load chat config (prefix, cooldowns, weights, etc.)
  const chatCfg = await getEffectiveChatConfig(streamerId);

  // Get a valid access token (refreshes if needed)
  const token = await getValidAccessToken(streamerId);

  // Hard fail if token is not usable (prevents weird “start failed”)
  if (!token || typeof token !== 'string' || token.length < 10) {
    throw Object.assign(
      new Error('No valid Twitch access token returned by getValidAccessToken().'),
      { statusCode: 400 }
    );
  }

  const client = new tmi.Client({
    options: {
      // ✅ Turn this on while troubleshooting prod listener issues.
      // You can set back to false after stable.
      debug: true,
    },
    identity: {
      username: streamer.login,
      password: `oauth:${token}`,
    },
    channels: [streamer.login],
  });

  // Helpful diagnostics from Twitch IRC
  client.on('notice', (channel, msgid, message) => {
    console.log('[tmi notice]', { streamerId, channel, msgid, message });
  });

  client.on('connected', (addr, port) => {
    console.log('[tmi connected]', { streamerId, addr, port, channel: streamer.login });
  });

  client.on('disconnected', (reason) => {
    console.log('[tmi disconnected]', { streamerId, reason });
    clients.delete(streamerId);
  });

  client.on('message', async (channel, tags, message, self) => {
    try {
      if (self) return;

      const parsed = parseCommand(message, chatCfg);
      if (!parsed) return;

      const delta = Number(parsed.delta);
      if (!Number.isFinite(delta) || delta === 0) return;

      // Cap per message
      let capped = Math.trunc(delta);

      if (parsed.type === 'hype') {
        const maxD = Number(chatCfg?.commands?.hype?.maxDelta ?? 25);
        const lim = Number.isFinite(maxD)
          ? Math.max(1, Math.abs(Math.trunc(maxD)))
          : 25;
        capped = Math.max(-lim, Math.min(lim, capped));
      } else {
        // vote: tighter cap
        capped = Math.max(-10, Math.min(10, capped));
      }

      // Cooldown per user per action type (vote/hype)
      const session = await getOrCreateActiveSession(streamerId);
      const userKey = getUserKey(tags);
      const action = parsed.type;

      const overrideMinutes = chatCfg?.cooldownMinutes?.[action];
      const allowed = await checkAndTouchCooldown(
        session.id,
        action,
        userKey,
        overrideMinutes
      );

      if (!allowed) return;

      await addHype(streamerId, parsed.factionKey, capped, 'chat', {
        cmd: parsed.type,
        user: tags?.username || null,
        displayName: tags?.['display-name'] || null,
      });

      const snap = await getMetersSnapshot(streamerId);
      broadcast(streamerId, 'meters', snap);
    } catch (err) {
      // Don’t crash the listener loop; log once if you want
      // console.error('[tmi message handler] error', err);
    }
  });

  // ✅ Connect with explicit error logging
  try {
    await client.connect();
  } catch (e) {
    console.error('[tmi connect] failed:', e);
    throw (e instanceof Error) ? e : new Error(typeof e === 'string' ? e : 'tmi.connect() failed');
  }

  clients.set(streamerId, { client, channel: streamer.login });
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
