// src/services/eventSubSubscriptionService.js
'use strict';

const HELIX_EVENTSUB = 'https://api.twitch.tv/helix/eventsub/subscriptions';
const OAUTH_TOKEN = 'https://id.twitch.tv/oauth2/token';

function requireEnv(env, key) {
  const v = String(env[key] || '').trim();
  if (!v) throw Object.assign(new Error(`Missing ${key}`), { statusCode: 500 });
  return v;
}

async function getAppAccessToken(env) {
  const clientId = requireEnv(env, 'TWITCH_CLIENT_ID');
  const clientSecret = requireEnv(env, 'TWITCH_CLIENT_SECRET');

  const url = new URL(OAUTH_TOKEN);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const r = await fetch(url, { method: 'POST' });
  const j = await r.json().catch(() => ({}));

  if (!r.ok || !j.access_token) {
    throw Object.assign(new Error(`Failed to get app access token (${r.status})`), {
      statusCode: 500,
      detail: j,
    });
  }
  return j.access_token;
}

function helixHeaders(env, appToken) {
  return {
    'Client-Id': requireEnv(env, 'TWITCH_CLIENT_ID'),
    'Authorization': `Bearer ${appToken}`,
    'Content-Type': 'application/json',
  };
}

async function listAllSubscriptions(env, appToken) {
  const out = [];
  let after = null;

  for (let i = 0; i < 25; i++) {
    const url = new URL(HELIX_EVENTSUB);
    if (after) url.searchParams.set('after', after);

    const r = await fetch(url, { headers: helixHeaders(env, appToken) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw Object.assign(new Error(`Failed to list EventSub subs (${r.status})`), {
        statusCode: 500,
        detail: j,
      });
    }

    if (Array.isArray(j.data)) out.push(...j.data);
    after = j.pagination?.cursor || null;
    if (!after) break;
  }

  return out;
}

function keyOfSub(s) {
  const type = s?.type;
  const b = s?.condition?.broadcaster_user_id;
  const m = s?.condition?.moderator_user_id;
  // include moderator when present (future-proof)
  return `${type}::${b || ''}::${m || ''}`;
}

async function createSubscription(env, appToken, { type, condition }) {
  const baseUrl = String(env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  const secret = requireEnv(env, 'EVENTSUB_WEBHOOK_SECRET');

  if (!baseUrl.startsWith('https://')) {
    throw Object.assign(new Error('PUBLIC_BASE_URL must be a public https:// URL for EventSub webhooks'), {
      statusCode: 500,
    });
  }

  const body = {
    type,
    version: '1',
    condition,
    transport: {
      method: 'webhook',
      callback: `${baseUrl}/twitch/eventsub`,
      secret,
    },
  };

  const r = await fetch(HELIX_EVENTSUB, {
    method: 'POST',
    headers: helixHeaders(env, appToken),
    body: JSON.stringify(body),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw Object.assign(new Error(`Failed to create EventSub sub (${type}) (${r.status})`), {
      statusCode: 400,
      detail: j,
    });
  }

  return (j.data && j.data[0]) ? j.data[0] : j;
}

async function deleteSubscription(env, appToken, id) {
  const url = new URL(HELIX_EVENTSUB);
  url.searchParams.set('id', String(id));

  const r = await fetch(url, {
    method: 'DELETE',
    headers: helixHeaders(env, appToken),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw Object.assign(new Error(`Failed to delete EventSub sub (${r.status})`), {
      statusCode: 400,
      detail: text,
    });
  }
  return { ok: true };
}

function hasScope(scopeList, need) {
  if (!Array.isArray(scopeList)) return false;
  const set = new Set(scopeList.map(s => String(s).toLowerCase()));
  return set.has(String(need).toLowerCase());
}

function requiredScopesFor(types) {
  // Based on Twitch docs: subs require channel:read:subscriptions; cheers require bits:read. :contentReference[oaicite:5]{index=5}
  const need = new Set();
  for (const t of types) {
    if (t === 'channel.cheer') need.add('bits:read');
    if (
      t === 'channel.subscribe' ||
      t === 'channel.subscription.gift' ||
      t === 'channel.subscription.message'
    ) {
      need.add('channel:read:subscriptions');
    }
  }
  return Array.from(need);
}

async function ensureStreamerWebhookSubscriptions(env, { twitchUserId, twitchScopes }) {
  const wanted = [
    'channel.cheer',
    'channel.subscribe',
    'channel.subscription.gift',
    'channel.subscription.message',
  ];

  // Scope gate: broadcaster must have granted scopes to your app before you can subscribe. :contentReference[oaicite:6]{index=6}
  const required = requiredScopesFor(wanted);
  const missing = required.filter(s => !hasScope(twitchScopes, s));

  if (missing.length) {
    throw Object.assign(
      new Error(`Streamer must re-auth Twitch with scopes: ${missing.join(', ')}`),
      { statusCode: 400, missingScopes: missing }
    );
  }

  // Webhook subscriptions must be created using an app access token. :contentReference[oaicite:7]{index=7}
  const appToken = await getAppAccessToken(env);

  const all = await listAllSubscriptions(env, appToken);
  const map = new Map(all.map(s => [keyOfSub(s), s]));

  const created = [];
  const skipped = [];

  for (const type of wanted) {
    const key = `${type}::${twitchUserId}::`;
    if (map.has(key)) {
      const s = map.get(key);
      skipped.push({ type, id: s.id, status: s.status });
      continue;
    }

    const sub = await createSubscription(env, appToken, {
      type,
      condition: { broadcaster_user_id: String(twitchUserId) },
    });

    created.push({ type, id: sub.id, status: sub.status });
  }

  return { ok: true, created, skipped };
}

async function getStreamerWebhookSubscriptions(env, { twitchUserId }) {
  const appToken = await getAppAccessToken(env);
  const all = await listAllSubscriptions(env, appToken);

  const filtered = all
    .filter(s => String(s?.condition?.broadcaster_user_id || '') === String(twitchUserId))
    .map(s => ({
      id: s.id,
      type: s.type,
      status: s.status,
      createdAt: s.created_at,
      transport: s.transport?.method,
    }));

  return { ok: true, subs: filtered };
}

module.exports = {
  ensureStreamerWebhookSubscriptions,
  getStreamerWebhookSubscriptions,
  deleteSubscription,
  getAppAccessToken,
};
