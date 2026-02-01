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

/* ---------------------------
 * helpers (existing)
 * -------------------------- */

function getUserKey(tags) {
  // stable key per user; prefer user-id
  const uid = tags && (tags['user-id'] || tags.userId);
  if (uid) return `uid:${String(uid)}`;
  const u = tags && (tags.username || tags['display-name']);
  return `user:${String(u || 'unknown').toLowerCase()}`;
}

function normalizeCmd(s) {
  return String(s || '').trim().toLowerCase();
}

function cmdMatches(cmd, primary, aliases) {
  const c = normalizeCmd(cmd);
  const p = normalizeCmd(primary);
  if (c && p && c === p) return true;

  const list = Array.isArray(aliases) ? aliases : [];
  for (const a of list) {
    if (c === normalizeCmd(a)) return true;
  }
  return false;
}

function isBroadcasterOrMod(tags) {
  const badges = tags?.badges || {};
  const badgeInfo = tags?.badgeInfo || {};

  const isBroadcaster =
    badges.broadcaster === '1' || badgeInfo.broadcaster === '1';

  // tmi sets tags.mod as boolean-ish, and may also provide moderator badge
  const isMod =
    tags?.mod === true ||
    tags?.mod === '1' ||
    badges.moderator === '1' ||
    badgeInfo.moderator === '1';

  return { isBroadcaster, isMod };
}

/* ---------------------------
 * helpers (NEW: viewer + faction membership)
 * -------------------------- */

function getTwitchUserId(tags) {
  const uid = tags && (tags['user-id'] || tags.userId);
  return uid ? String(uid) : null;
}

function displayNameFromTags(tags) {
  return String(tags?.['display-name'] || tags?.username || 'Viewer');
}

function normalizeFactionInput(s) {
  return String(s || '').trim();
}

async function getOrCreateViewer(streamerId, tags) {
  const twitchUserId = getTwitchUserId(tags);
  if (!twitchUserId) return null;

  // Viewer is unique on (streamerId, twitchUserId)
  const viewer = await prisma.viewer.upsert({
    where: {
      streamerId_twitchUserId: {
        streamerId: String(streamerId),
        twitchUserId,
      },
    },
    create: {
      streamerId: String(streamerId),
      twitchUserId,
      displayName: displayNameFromTags(tags),
    },
    update: {
      displayName: displayNameFromTags(tags),
    },
    select: { id: true, streamerId: true, twitchUserId: true, displayName: true },
  });

  return viewer;
}

// Resolve a faction for this streamer by key (preferred) or name
async function resolveFactionForStreamer(streamerId, factionRaw) {
  const raw = normalizeFactionInput(factionRaw);
  if (!raw) return null;

  const keyGuess = raw.toUpperCase();

  let f = await prisma.faction.findFirst({
    where: { streamerId: String(streamerId), key: keyGuess, isActive: true },
    select: { id: true, key: true, name: true },
  });
  if (f) return f;

  f = await prisma.faction.findFirst({
    where: {
      streamerId: String(streamerId),
      name: { equals: raw, mode: 'insensitive' },
      isActive: true,
    },
    select: { id: true, key: true, name: true },
  });

  return f || null;
}

// Returns viewer's current faction key (if any). If multiple exist, use most recent.
async function getViewerFactionKey(streamerId, viewerId) {
  const mem = await prisma.factionMembership.findFirst({
    where: { streamerId: String(streamerId), viewerId: String(viewerId) },
    orderBy: { joinedAt: 'desc' },
    select: { faction: { select: { key: true, name: true } } },
  });

  return mem?.faction?.key || null;
}

// Enforce "one faction per viewer per streamer" in service logic.
// Your schema allows multiple memberships, so we delete existing then create the new one.
async function setViewerFaction(streamerId, viewerId, factionId) {
  await prisma.factionMembership.deleteMany({
    where: { streamerId: String(streamerId), viewerId: String(viewerId) },
  });

  return prisma.factionMembership.create({
    data: {
      streamerId: String(streamerId),
      viewerId: String(viewerId),
      factionId: String(factionId),
      role: 'MEMBER',
    },
  });
}

/* ---------------------------
 * parsing (UPDATED)
 * -------------------------- */

function parseCommand(message, chatCfg) {
  const text = String(message || '').trim();
  if (!text.startsWith('!')) return null;

  const parts = text.split(/\s+/);
  const cmd = normalizeCmd(parts[0] || '');

  const hypeName = String(chatCfg?.commands?.hype?.name || '!hype');
  const hypeAliases = chatCfg?.commands?.hype?.aliases || [];

  const maxName = String(chatCfg?.commands?.maxhype?.name || '!maxhype');
  const maxAliases = chatCfg?.commands?.maxhype?.aliases || [];

  const voteName = String(chatCfg?.commands?.vote?.name || '!vote');
  const voteAliases = chatCfg?.commands?.vote?.aliases || [];

  // NEW: join/switch commands (defaults; optionally configurable later)
  const joinName = String(chatCfg?.commands?.join?.name || '!join');
  const joinAliases = chatCfg?.commands?.join?.aliases || [];

  const factionName = String(chatCfg?.commands?.faction?.name || '!faction');
  const factionAliases = chatCfg?.commands?.faction?.aliases || ['!switch', '!switchfaction'];

  // !join Knights
  if (cmdMatches(cmd, joinName, joinAliases)) {
    const factionRaw = parts.slice(1).join(' ').trim();
    if (!factionRaw) return null;
    return { type: 'membership', action: 'join', factionRaw };
  }

  // !faction Knights
  if (cmdMatches(cmd, factionName, factionAliases)) {
    const factionRaw = parts.slice(1).join(' ').trim();
    if (!factionRaw) return null;
    return { type: 'membership', action: 'faction', factionRaw };
  }

  // !hype 10    (NEW desired behavior: use membership)
  // keep old: !hype ORDER 5
  if (cmdMatches(cmd, hypeName, hypeAliases)) {
    const a1 = parts[1];
    const a2 = parts[2];

    // !hype (no args) => default to 1 to be friendly
    if (a1 == null || a1 === '') {
      return { type: 'hype', action: 'hype', mode: 'member', delta: 1 };
    }

    // If first arg is numeric -> membership hype
    const maybePoints = Number(a1);
    if (Number.isFinite(maybePoints)) {
      const delta = maybePoints;
      if (!Number.isFinite(delta) || delta === 0) return null;
      return { type: 'hype', action: 'hype', mode: 'member', delta };
    }

    // Back-compat: !hype FACTION 5
    const factionKey = String(a1 || '').toUpperCase();
    const delta = Number(a2 || 0);
    if (!factionKey) return null;
    if (!Number.isFinite(delta) || delta === 0) return null;
    return { type: 'hype', action: 'hype', mode: 'explicit', factionKey, delta };
  }

  // !maxhype ORDER
  if (cmdMatches(cmd, maxName, maxAliases)) {
    const factionKey = (parts[1] || '').toUpperCase();
    if (!factionKey) return null;
    // big visible spike (still capped later)
    return { type: 'hype', action: 'maxhype', mode: 'explicit', factionKey, delta: 100 };
  }

  // !vote ORDER   (optional; safe even if you don't use it yet)
  if (cmdMatches(cmd, voteName, voteAliases)) {
    const factionKey = (parts[1] || '').toUpperCase();
    if (!factionKey) return null;

    // If they type "!vote ORDER 3" allow it; else use configured weight/default
    const maybe = parts[2];
    const weight = Number(chatCfg?.commands?.vote?.weight ?? 1);

    const delta = (maybe != null && maybe !== '')
      ? Number(maybe)
      : Number(weight);

    if (!Number.isFinite(delta) || delta === 0) return null;
    return { type: 'hype', action: 'vote', mode: 'explicit', factionKey, delta };
  }

  return null;
}

/* ---------------------------
 * runtime
 * -------------------------- */

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
      username: streamer.login, // This makes YOUR messages come in as self===true on some setups
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

    // We do NOT drop self messages anymore.
    // if (self) return;

    try {
      const chatCfg = await getEffectiveChatConfig(streamer.id);
      const parsed = parseCommand(text, chatCfg);

      if (!parsed) {
        if (isCmd) console.log('[cmd] not recognized', { streamerId: streamer.id, self, text });
        return;
      }

      /* ---------------------------
       * membership commands
       * -------------------------- */

      if (parsed.type === 'membership') {
        const viewer = await getOrCreateViewer(streamer.id, tags);
        if (!viewer) return;

        const f = await resolveFactionForStreamer(streamer.id, parsed.factionRaw);
        if (!f) {
          // Optional: chat feedback (left off by default)
          // await client.say(channel, `Unknown faction "${parsed.factionRaw}".`);
          console.log('[cmd] membership: unknown faction', {
            streamerId: streamer.id,
            viewerId: viewer.id,
            factionRaw: parsed.factionRaw,
          });
          return;
        }

        if (parsed.action === 'join') {
          const existingKey = await getViewerFactionKey(streamer.id, viewer.id);
          if (existingKey) {
            // Optional: chat feedback
            // await client.say(channel, `You're already in ${existingKey}. Use !faction <name> to switch.`);
            console.log('[cmd] membership: join blocked (already in faction)', {
              streamerId: streamer.id,
              viewerId: viewer.id,
              existingKey,
            });
            return;
          }
        }

        await setViewerFaction(streamer.id, viewer.id, f.id);

        console.log('[cmd] membership updated', {
          streamerId: streamer.id,
          viewerId: viewer.id,
          twitchUserId: viewer.twitchUserId,
          viewerDisplay: viewer.displayName,
          factionKey: f.key,
          factionName: f.name,
          action: parsed.action,
        });

        return;
      }

      /* ---------------------------
       * hype commands (membership mode)
       * -------------------------- */

      // If "!hype 10", resolve membership to determine factionKey
      if (parsed.type === 'hype' && parsed.mode === 'member') {
        const viewer = await getOrCreateViewer(streamer.id, tags);
        if (!viewer) return;

        const factionKey = await getViewerFactionKey(streamer.id, viewer.id);
        if (!factionKey) {
          // Optional: prompt to join
          // await client.say(channel, `Join a faction first: !join <faction>`);
          console.log('[cmd] hype blocked: no membership', {
            streamerId: streamer.id,
            viewerId: viewer.id,
            twitchUserId: viewer.twitchUserId,
          });
          return;
        }

        // Mutate parsed so existing pipeline can proceed unchanged
        parsed.factionKey = factionKey;
      }

      /* ---------------------------
       * common hype pipeline (existing)
       * -------------------------- */

      // Cap per command
      const deltaRaw = Number(parsed.delta || 0);
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

      // cooldown (bypass for broadcaster/mod so testing isn't miserable)
      const session = await getOrCreateActiveSession(streamer.id);
      const userKey = getUserKey(tags);
      const { isBroadcaster, isMod } = isBroadcasterOrMod(tags);

      let overrideMinutes = chatCfg?.cooldownMinutes?.[parsed.action] ?? chatCfg?.cooldownMinutes?.hype ?? null;
      let allowed = true;

      if (!isBroadcaster && !isMod) {
        allowed = await checkAndTouchCooldown(session.id, parsed.action, userKey, overrideMinutes);
      }

      console.log('[cmd] cooldown', {
        streamerId: streamer.id,
        allowed,
        userKey,
        overrideMinutes,
        isBroadcaster,
        isMod,
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

      // 🔥 HARD PROOF: tiny debug meter event so we can see twitch-chat path end-to-end
      broadcast(streamer.id, 'meters', {
        debugFrom: 'twitchChatService',
        at: new Date().toISOString(),
        factionKey: parsed.factionKey,
        delta: capped,
        user: tags?.username || null,
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
