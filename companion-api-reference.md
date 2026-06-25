# Chat Factions — Companion API Reference

## 1. SSE Endpoint URL

```
GET https://chatfactions.me/api/v1/companion/events
```

> The path is `/api/v1/companion/events` — the `/v1/` segment is required.

---

## 2. Auth Method

Header only — no query string option:

```
Authorization: Bearer cfk_<your-64-hex-key>
```

Keys are generated from `/admin/companion-key` in the streamer dashboard.
They start with `cfk_` and are 68 characters total.

---

## 3. SSE Event Names

| Event      | When fired                                                        |
|------------|-------------------------------------------------------------------|
| `snapshot` | Once, immediately on connect                                      |
| `meters`   | Any time faction meters change                                    |
| `stats`    | Any time streamer activity changes (follower, sub, cheer, tip)    |
| `ping`     | Every 25 seconds (keepalive)                                      |

> There are no events named `FACTION_SURGE`, `LEAD_CHANGE`, `MAX_HYPE`,
> `FACTION_WINNER`, `RAID_BURST`, `CHEER_BURST`, or `SUB_BURST`.
> The system sends full-state snapshots on every change, not per-event
> typed notifications. See section 5 for details.

---

## 4. Sample Payloads

### `snapshot` — fired once on connect

Contains the full current state of the session, meters, and streamer activity.

```json
{
  "session": {
    "id": "cm9x...",
    "startedAt": "2026-06-25T20:00:00.000Z",
    "title": null,
    "votingOpen": true,
    "votingChangedAt": "2026-06-25T20:01:00.000Z",
    "lastDecayAt": "2026-06-25T20:05:00.000Z"
  },
  "meters": {
    "ok": true,
    "streamerId": "abc123",
    "sessionId": "cm9x...",
    "updatedAt": "2026-06-25T20:05:00.000Z",
    "meters": [
      { "factionKey": "RED",  "key": "RED",  "name": "Red",  "colorHex": "#ef4444", "meter": 47 },
      { "factionKey": "BLUE", "key": "BLUE", "name": "Blue", "colorHex": "#3b82f6", "meter": 23 }
    ],
    "factions": "<same array as meters>"
  },
  "stats": {
    "latestFollower":   { "name": "StreamFan99", "at": "2026-06-25T20:03:00.000Z" },
    "latestSubscriber": { "name": "HypeKing",    "at": "2026-06-25T20:01:00.000Z", "tier": "1000", "isGift": false },
    "latestCheer":      { "name": "BitsMaster",  "at": "2026-06-25T19:55:00.000Z", "bits": 500 },
    "latestTip":        null
  }
}
```

---

### `meters` — fired after any hype change

Sent after a chat vote, Twitch EventSub event, or a decay tick.
Always contains all factions, not just the one that changed.

```json
{
  "ok": true,
  "streamerId": "abc123",
  "sessionId": "cm9x...",
  "updatedAt": "2026-06-25T20:06:00.000Z",
  "meters": [
    { "factionKey": "RED",  "key": "RED",  "name": "Red",  "colorHex": "#ef4444", "meter": 52 },
    { "factionKey": "BLUE", "key": "BLUE", "name": "Blue", "colorHex": "#3b82f6", "meter": 23 }
  ],
  "factions": "<same array as meters>"
}
```

> `factions` is a convenience alias for `meters` — both arrays are identical.

---

### `stats` — fired after any Twitch activity event

Sent after a follow, subscription, cheer, or tip. Fields are `null` until
that event type has occurred at least once in the session.

```json
{
  "latestFollower":   { "name": "NewViewer",  "at": "2026-06-25T20:06:30.000Z" },
  "latestSubscriber": { "name": "HypeKing",   "at": "2026-06-25T20:01:00.000Z", "tier": "1000", "isGift": false },
  "latestCheer":      { "name": "BitsMaster", "at": "2026-06-25T19:55:00.000Z", "bits": 500 },
  "latestTip":        null
}
```

---

### `ping` — every 25 seconds

```json
{ "t": 1750895200000 }
```

`t` is a Unix timestamp in milliseconds. Use it to confirm the connection
is still alive and to calculate server-side latency if needed.

---

## 5. Payload Shape vs Expected Shape

Your expected shape:

```json
{
  "id": "...",
  "source": "twitch",
  "type": "CHEER_BURST",
  "faction": "Blue",
  "color": "#3b82ff",
  "message": "Blue cheer burst!",
  "hype": 92,
  "createdAt": "..."
}
```

**This shape does not match what the system currently sends.**

| Expected field | Current system |
|----------------|----------------|
| `id`           | Not included in broadcasts |
| `source`       | Not included |
| `type` (e.g. `CHEER_BURST`) | No typed events — all meter changes arrive as a `meters` event with the full updated state for all factions |
| `faction` (single name) | `meters[]` array — all factions at once, not one per event |
| `color`        | `colorHex` field inside each item in the `meters[]` array |
| `message`      | Not included |
| `hype`         | `meter` field per faction inside the `meters[]` array |
| `createdAt`    | `updatedAt` at the snapshot level |

**The system sends full-state snapshots on every change, not per-event
typed notifications.** If you want named event types like `CHEER_BURST` or
`FACTION_SURGE`, a typed broadcast layer would need to be added on top of
the current architecture.

---

## 6. Test Endpoint

**None exists.** There is no `POST /api/companion/test-event` or equivalent.

The only way to trigger a live `meters` event is to fire a real chat command
or receive a real Twitch EventSub webhook. A test-fire endpoint can be added
if needed.

---

## 7. Auth Failure Responses

| Situation | Status | Body |
|-----------|--------|------|
| Missing or malformed `Authorization` header | `401` | `"Missing or malformed Authorization header."` |
| Key doesn't start with `cfk_` | `401` | `"Invalid API key format."` |
| Key not found or revoked | `401` | `"Invalid or revoked API key."` |
| Valid key, PRO subscription lapsed | `403` | `"Companion app access requires a PRO subscription."` |
| Too many requests (>120/min) | `429` | `"Rate limit exceeded."` + `Retry-After` header |

---

## 8. Twitch / Chat Trigger Hooks

| Trigger | Source file | What gets broadcast |
|---------|-------------|---------------------|
| Twitch EventSub: follow, cheer, subscribe, gift sub, resub | `src/routes/eventSubRoutes.js` | `stats` (via statsService) then `meters` (after hype delta applied) |
| Chat commands / faction votes (tmi.js) | `src/services/twitchChatService.js` | `meters` (full snapshot after hype applied) |
| Periodic meter decay (every 15 s) | `src/services/decayLoopService.js` | `meters` (full snapshot) |

The companion SSE connection shares the same `realtimeHub` as the browser
overlay, so it automatically receives every broadcast the overlay receives
with no additional wiring needed.

---

## Quick-Start Example (JavaScript)

```js
const es = new EventSource('https://chatfactions.me/api/v1/companion/events', {
  headers: { Authorization: 'Bearer cfk_<your-key>' }
});

es.addEventListener('snapshot', (e) => {
  const { session, meters, stats } = JSON.parse(e.data);
  console.log('Initial state:', meters.meters);
});

es.addEventListener('meters', (e) => {
  const snap = JSON.parse(e.data);
  snap.meters.forEach(f => {
    console.log(`${f.name}: ${f.meter}`);
  });
});

es.addEventListener('stats', (e) => {
  const snap = JSON.parse(e.data);
  if (snap.latestCheer) console.log('Latest cheer:', snap.latestCheer);
});

es.addEventListener('ping', (e) => {
  const { t } = JSON.parse(e.data);
  console.log('Ping at', new Date(t).toISOString());
});

es.onerror = (err) => {
  console.error('SSE error, will auto-reconnect:', err);
};
```

> **Note:** The native `EventSource` API does not support custom headers in
> browsers. For browser-based companion apps use a library such as
> [`@microsoft/fetch-event-source`](https://github.com/Azure/fetch-event-source)
> or proxy the key through your own backend.
