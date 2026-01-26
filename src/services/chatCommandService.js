// src/services/chatCommandsService.js
'use strict';

const { prisma } = require('../db/prisma');

function normTrigger(s) {
  return String(s || '').trim().replace(/^!+/, '').toLowerCase();
}

function normAlias(s) {
  return String(s || '').trim().replace(/^!+/, '').toLowerCase();
}

async function ensureDefaultChatCommands(streamerId) {
  const sid = String(streamerId);

  const existing = await prisma.chatCommand.findFirst({
    where: { streamerId: sid },
    select: { id: true }
  });
  if (existing) return { ok: true, already: true };

  // Default !hype
  const hype = await prisma.chatCommand.create({
    data: {
      streamerId: sid,
      type: 'HYPE',
      trigger: 'hype',
      isEnabled: true,
      cooldownSec: 10,
      bypassBroadcaster: true,
      bypassMods: true,
      maxDelta: 25,
      defaultDelta: 1,
      meta: { format: '!hype ORDER 5' }
    }
  });

  // Default !maxhype (debug spike)
  const maxhype = await prisma.chatCommand.create({
    data: {
      streamerId: sid,
      type: 'MAXHYPE',
      trigger: 'maxhype',
      isEnabled: true,
      cooldownSec: 30,
      bypassBroadcaster: true,
      bypassMods: true,
      maxDelta: 25,
      defaultDelta: 25,
      meta: { format: '!maxhype ORDER' }
    }
  });

  // Optional namespaced aliases so you don’t collide with Streamer.bot defaults
  await prisma.chatCommandAlias.createMany({
    data: [
      { commandId: hype.id, alias: 'cfhype' },
      { commandId: maxhype.id, alias: 'cfmaxhype' }
    ],
    skipDuplicates: true
  });

  return { ok: true, created: true };
}

async function listChatCommands(streamerId) {
  const sid = String(streamerId);

  await ensureDefaultChatCommands(sid);

  const cmds = await prisma.chatCommand.findMany({
    where: { streamerId: sid },
    orderBy: [{ type: 'asc' }, { trigger: 'asc' }],
    include: { aliases: true }
  });

  return {
    ok: true,
    commands: cmds.map(c => ({
      id: c.id,
      type: c.type,
      trigger: c.trigger,
      isEnabled: c.isEnabled,
      cooldownSec: c.cooldownSec,
      bypassBroadcaster: c.bypassBroadcaster,
      bypassMods: c.bypassMods,
      maxDelta: c.maxDelta,
      defaultDelta: c.defaultDelta,
      aliases: (c.aliases || []).map(a => ({ id: a.id, alias: a.alias }))
    }))
  };
}

async function updateChatCommand(streamerId, commandId, patch) {
  const sid = String(streamerId);
  const id = String(commandId);

  const cmd = await prisma.chatCommand.findFirst({
    where: { id, streamerId: sid }
  });
  if (!cmd) throw Object.assign(new Error('Command not found.'), { statusCode: 404 });

  const next = {
    trigger: patch.trigger != null ? normTrigger(patch.trigger) : undefined,
    isEnabled: patch.isEnabled != null ? !!patch.isEnabled : undefined,
    cooldownSec: patch.cooldownSec != null ? Math.max(0, Number(patch.cooldownSec) || 0) : undefined,
    bypassBroadcaster: patch.bypassBroadcaster != null ? !!patch.bypassBroadcaster : undefined,
    bypassMods: patch.bypassMods != null ? !!patch.bypassMods : undefined,
    maxDelta: patch.maxDelta != null ? Math.max(1, Math.trunc(Number(patch.maxDelta) || 1)) : undefined,
    defaultDelta: patch.defaultDelta != null ? Math.trunc(Number(patch.defaultDelta) || 1) : undefined
  };

  const updated = await prisma.chatCommand.update({
    where: { id },
    data: next,
    include: { aliases: true }
  });

  return {
    ok: true,
    command: {
      id: updated.id,
      type: updated.type,
      trigger: updated.trigger,
      isEnabled: updated.isEnabled,
      cooldownSec: updated.cooldownSec,
      bypassBroadcaster: updated.bypassBroadcaster,
      bypassMods: updated.bypassMods,
      maxDelta: updated.maxDelta,
      defaultDelta: updated.defaultDelta,
      aliases: (updated.aliases || []).map(a => ({ id: a.id, alias: a.alias }))
    }
  };
}

async function addAlias(streamerId, commandId, alias) {
  const sid = String(streamerId);
  const command = await prisma.chatCommand.findFirst({
    where: { id: String(commandId), streamerId: sid },
    select: { id: true }
  });
  if (!command) throw Object.assign(new Error('Command not found.'), { statusCode: 404 });

  const a = normAlias(alias);
  if (!a) throw Object.assign(new Error('Alias is required.'), { statusCode: 400 });

  const created = await prisma.chatCommandAlias.create({
    data: { commandId: command.id, alias: a }
  });

  return { ok: true, alias: { id: created.id, alias: created.alias } };
}

async function deleteAlias(streamerId, aliasId) {
  const sid = String(streamerId);

  // Verify ownership via command relation
  const ali = await prisma.chatCommandAlias.findUnique({
    where: { id: String(aliasId) },
    include: { command: true }
  });

  if (!ali || ali.command?.streamerId !== sid) {
    throw Object.assign(new Error('Alias not found.'), { statusCode: 404 });
  }

  await prisma.chatCommandAlias.delete({ where: { id: ali.id } });
  return { ok: true };
}

module.exports = {
  listChatCommands,
  updateChatCommand,
  addAlias,
  deleteAlias,
  ensureDefaultChatCommands
};
