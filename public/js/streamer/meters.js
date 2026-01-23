// public/js/streamer/meters.js
'use strict';

const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const rowsEl = document.getElementById('rows');

const chatStartBtn = document.getElementById('btnChatStart');
const chatStopBtn = document.getElementById('btnChatStop');
const chatStatusEl = document.getElementById('chatStatus');

function showStatus(msg, kind = 'ok') {
  if (!statusEl) return;
  statusEl.className = `notice ${kind}`;
  statusEl.textContent = msg;
  statusEl.style.display = msg ? 'block' : 'none';
}

function setSummary(html) {
  if (!summaryEl) return;
  summaryEl.innerHTML = html;
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

function normalizeHex(s) {
  const v = String(s || '').trim();
  if (!v) return '#78C8FF';
  return v.startsWith('#') ? v : `#${v}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Expected SSE payload shapes (we accept several):
 * 1) { type:"meters", meters:[{ key,name,colorHex,meter }] }
 * 2) { meters:[...] }
 * 3) { data:{ meters:[...] } }
 */
function extractMeters(payload) {
  if (!payload) return null;
  if (Array.isArray(payload.meters)) return payload.meters;
  if (payload.data && Array.isArray(payload.data.meters)) return payload.data.meters;
  if (payload.type === 'meters' && Array.isArray(payload.meters)) return payload.meters;
  return null;
}

function renderMetersTable(meters) {
  if (!rowsEl) return;

  const max = meters.reduce((m, x) => Math.max(m, Number(x.meter || 0)), 0) || 1;

  const html = meters
    .slice()
    .sort((a, b) => (Number(b.meter || 0) - Number(a.meter || 0)))
    .map(m => {
      const name = m.name ?? m.factionName ?? m.faction ?? m.key ?? 'Faction';
      const key = m.key ?? m.factionKey ?? '';
      const meter = Number(m.meter || 0);
      const color = normalizeHex(m.colorHex || m.color || '#78C8FF');

      // bar width based on relative max
      const pct = clamp(Math.round((meter / max) * 100), 0, 100);

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="
                width:12px; height:12px; border-radius:4px;
                background:${esc(color)};
                border:1px solid rgba(255,255,255,0.18);
                box-shadow: 0 0 0 4px rgba(255,255,255,0.06);
              "></span>
              <div>
                <div style="font-weight:800;">${esc(name)}</div>
                <div class="small muted">${esc(key)}</div>
              </div>
            </div>
          </td>

          <td class="mono">${esc(key)}</td>

          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="
                flex: 1;
                height: 10px;
                border-radius: 999px;
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.10);
                overflow:hidden;
              ">
                <div style="
                  width:${pct}%;
                  height:100%;
                  background: rgba(255,255,255,0.22);
                "></div>
              </div>
              <div class="mono" style="min-width:64px; text-align:right;">${meter}</div>
            </div>
          </td>

          <td class="mono">${esc(color)}</td>
        </tr>
      `;
    })
    .join('');

  rowsEl.innerHTML = html || `<tr><td colspan="4" class="muted">No meter data yet.</td></tr>`;
}

function setConnectionPill(state, detail) {
  const pill = (label) => `<span class="pill">${label}</span>`;
  const extra = detail ? ` <span class="small muted">${esc(detail)}</span>` : '';
  setSummary(`
    <div class="pills">
      ${pill(state)}
      ${pill('SSE')}
    </div>
    <div class="small muted" style="margin-top:8px;">
      Live meter updates feed overlays + dashboards.${extra}
    </div>
  `);
}

let es = null;
let reconnectTimer = null;

const SSE_CANDIDATES = [
  // common patterns in this project
  '/admin/api/realtime/sse',
  '/admin/realtime/sse',
  '/realtime/sse',
  '/sse',
  // last-resort (some builds use overlay namespace)
  '/overlay/sse'
];

async function probeSseEndpoint(url) {
  // quick probe: fetch with Accept text/event-stream
  // Some servers will 200 even though it's SSE; others 404. This is good enough.
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'text/event-stream' }
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findWorkingSseUrl() {
  for (const url of SSE_CANDIDATES) {
    const ok = await probeSseEndpoint(url);
    if (ok) return url;
  }
  // if probes fail (some servers keep SSE open and block probe), still try first candidate
  return SSE_CANDIDATES[0];
}

async function connectSSE() {
  if (es) {
    try { es.close(); } catch {}
    es = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  setConnectionPill('Connecting…');

  const sseUrl = await findWorkingSseUrl();

  try {
    es = new EventSource(sseUrl, { withCredentials: true });
  } catch (e) {
    showStatus(`Failed to create EventSource: ${e.message}`, 'error');
    scheduleReconnect();
    return;
  }

  es.onopen = () => {
    showStatus('', 'ok');
    setConnectionPill('Connected', sseUrl);
  };

  es.onerror = () => {
    setConnectionPill('Reconnecting…', sseUrl);
    scheduleReconnect();
  };

  es.onmessage = (evt) => {
    if (!evt || !evt.data) return;

    let payload = null;
    try { payload = JSON.parse(evt.data); } catch { return; }

    const meters = extractMeters(payload);
    if (!meters) return;

    renderMetersTable(meters);
  };

  // Also support named "meters" event if your server emits it
  es.addEventListener('meters', (evt) => {
    if (!evt || !evt.data) return;
    let payload = null;
    try { payload = JSON.parse(evt.data); } catch { return; }
    const meters = extractMeters(payload) || payload;
    if (Array.isArray(meters)) renderMetersTable(meters);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSSE().catch(() => scheduleReconnect());
  }, 1200);
}

/**
 * Chat listener controls
 * We try a couple common endpoints so we don't have to stop the build.
 */
const CHAT_START_CANDIDATES = ['/admin/api/chat/start', '/admin/api/chat/listener/start', '/admin/chat/start'];
const CHAT_STOP_CANDIDATES = ['/admin/api/chat/stop', '/admin/api/chat/listener/stop', '/admin/chat/stop'];

async function tryPost(urls) {
  let lastErr = null;
  for (const url of urls) {
    try {
      return await fetchJSON(url, { method: 'POST' });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No endpoint worked');
}

function setChatStatus(msg, kind = 'ok') {
  if (!chatStatusEl) return;
  chatStatusEl.className = kind === 'error' ? 'small' : 'small muted';
  chatStatusEl.textContent = msg;
}

function wireChatButtons() {
  if (chatStartBtn) {
    chatStartBtn.addEventListener('click', async () => {
      setChatStatus('Starting…');
      try {
        await tryPost(CHAT_START_CANDIDATES);
        setChatStatus('Chat listener started.');
      } catch (e) {
        setChatStatus(`Start failed: ${e.message}`, 'error');
      }
    });
  }

  if (chatStopBtn) {
    chatStopBtn.addEventListener('click', async () => {
      setChatStatus('Stopping…');
      try {
        await tryPost(CHAT_STOP_CANDIDATES);
        setChatStatus('Chat listener stopped.');
      } catch (e) {
        setChatStatus(`Stop failed: ${e.message}`, 'error');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireChatButtons();
  connectSSE().catch(err => showStatus(err.message || 'Failed to connect SSE.', 'error'));
});
