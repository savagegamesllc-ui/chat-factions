// public/js/streamer/eventApi.js
'use strict';

const keyEl = document.getElementById('key');
const btnRotate = document.getElementById('btnRotate');
const exampleEl = document.getElementById('example');
const statusEl = document.getElementById('status');

function showStatus(msg, kind = 'ok') {
  if (!statusEl) return;
  statusEl.className = `notice ${kind}`;
  statusEl.textContent = msg;
  statusEl.style.display = msg ? 'block' : 'none';
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function setRotateDisabled(v) {
  if (btnRotate) btnRotate.disabled = v;
}

function buildExample({ apiKey, endpointUrl }) {
  const eventId = 'evt_' + Math.random().toString(16).slice(2) + Date.now().toString(16);

  const single = {
    eventId,
    factionKey: 'ORDER',
    delta: 5,
    source: 'game',
    meta: { reason: 'kill_streak', streak: 3 }
  };

  const multi = {
    eventId: eventId + '_multi',
    source: 'game',
    actions: [
      { factionKey: 'ORDER', delta: 3, meta: { reason: 'bonus' } },
      { factionKey: 'CHAOS', delta: 2, meta: { reason: 'assist' } }
    ]
  };

  const curlSingle = [
    `curl -s -X POST "${endpointUrl}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "X-Event-Key: ${apiKey}" \\`,
    `  -d '${JSON.stringify(single)}'`
  ].join('\n');

  const curlMulti = [
    `curl -s -X POST "${endpointUrl}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "X-Event-Key: ${apiKey}" \\`,
    `  -d '${JSON.stringify(multi)}'`
  ].join('\n');

  return [
    `Endpoint: ${endpointUrl}`,
    ``,
    `--- Single action JSON ---`,
    JSON.stringify(single, null, 2),
    ``,
    `--- Multi action JSON ---`,
    JSON.stringify(multi, null, 2),
    ``,
    `--- curl (single) ---`,
    curlSingle,
    ``,
    `--- curl (multi) ---`,
    curlMulti,
    ``
  ].join('\n');
}

// Endpoint candidates
const STATUS_URLS = [
  '/admin/api/event-api/status',
  '/admin/api/event-api',
  '/admin/api/events/key',
  '/admin/event-api/status'
];

const ROTATE_URLS = [
  '/admin/api/event-api/rotate',
  '/admin/api/events/key/rotate',
  '/admin/event-api/rotate'
];

const EVENT_POST_URLS = [
  // what you described as “Event API secured”
  '/api/events',
  '/api/realtime/events',
  '/realtime/api/events'
];

async function tryGet(urls) {
  let lastErr = null;
  for (const u of urls) {
    try { return await fetchJSON(u); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No status endpoint worked.');
}

async function tryPost(urls, bodyObj) {
  let lastErr = null;
  for (const u of urls) {
    try {
      return await fetchJSON(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyObj ? JSON.stringify(bodyObj) : undefined
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No rotate endpoint worked.');
}

function ensureCopyButton() {
  if (!keyEl) return;

  // if already inserted, skip
  if (keyEl.dataset.copyReady === '1') return;
  keyEl.dataset.copyReady = '1';

  // Create a small Copy button next to the key input
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '10px';
  wrap.style.alignItems = 'center';
  wrap.style.marginTop = '6px';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = 'Copy';
  btn.addEventListener('click', async () => {
    const v = keyEl.value || '';
    try {
      await navigator.clipboard.writeText(v);
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy'), 1200);
    } catch {
      alert('Copy failed');
    }
  });

  // Insert below the input
  keyEl.insertAdjacentElement('afterend', wrap);
  wrap.appendChild(btn);
}

async function refresh() {
  showStatus('', 'ok');
  setRotateDisabled(true);

  const data = await tryGet(STATUS_URLS);

  // accept a couple shapes
  const apiKey = data?.apiKey || data?.key || data?.eventApiKey || '';
  const headerName = data?.headerName || 'X-Event-Key';

  if (keyEl) keyEl.value = apiKey;

  ensureCopyButton();

  // choose best event post URL guess
  const endpointUrl = `${location.origin}${EVENT_POST_URLS[0]}`;

  if (exampleEl) {
    // keep it plain text in <pre>
    exampleEl.textContent = buildExample({ apiKey: `${headerName}: ${apiKey}`, endpointUrl });
  }

  setRotateDisabled(false);
  showStatus('Event API key loaded.', 'ok');
}

async function rotate() {
  if (!confirm('Rotate Event API key? This will invalidate the old key immediately.')) return;

  showStatus('Rotating key…', 'ok');
  setRotateDisabled(true);

  try {
    await tryPost(ROTATE_URLS);
    showStatus('Key rotated.', 'ok');
    await refresh();
  } catch (e) {
    showStatus(`Rotate failed: ${e.message}`, 'error');
    setRotateDisabled(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (btnRotate) btnRotate.addEventListener('click', (e) => { e.preventDefault(); rotate(); });
  refresh().catch(err => {
    setRotateDisabled(false);
    showStatus(err.message || 'Failed to load Event API status.', 'error');
  });
});
