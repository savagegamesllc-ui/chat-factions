// public/js/streamer/chat.js
'use strict';

const cfgEl = document.getElementById('cfg');
const btnSave = document.getElementById('btnSave');
const btnReset = document.getElementById('btnReset');
const defaultsEl = document.getElementById('defaults');
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

function safeParseObject(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null; // blank means reset
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return { __err: 'Config must be a JSON object.' };
    }
    return v;
  } catch (e) {
    return { __err: e.message || 'Invalid JSON.' };
  }
}

// Endpoint candidates
const LOAD_URLS = [
  '/admin/api/chat/config',
  '/admin/api/chat',
  '/admin/chat/config'
];

const SAVE_URLS = [
  '/admin/api/chat/config',
  '/admin/api/chat',
  '/admin/chat/config'
];

const RESET_URLS = [
  '/admin/api/chat/reset',
  '/admin/api/chat/config/reset',
  '/admin/chat/reset'
];

async function tryGet(urls) {
  let lastErr = null;
  for (const u of urls) {
    try { return await fetchJSON(u); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No chat config endpoint worked.');
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
  throw lastErr || new Error('No chat config endpoint worked.');
}

function setButtonsDisabled(v) {
  if (btnSave) btnSave.disabled = v;
  if (btnReset) btnReset.disabled = v;
}

function renderDefaults(obj) {
  if (!defaultsEl) return;
  if (!obj) {
    defaultsEl.textContent = '';
    return;
  }
  try {
    defaultsEl.textContent = JSON.stringify(obj, null, 2);
  } catch {
    defaultsEl.textContent = String(obj);
  }
}

async function load() {
  showStatus('', 'ok');
  setButtonsDisabled(true);

  const data = await tryGet(LOAD_URLS);

  // Try a few shapes
  const current = data?.config ?? data?.chatConfig ?? data?.currentConfig ?? null;
  const defaults = data?.defaults ?? data?.defaultConfig ?? data?.defaultChatConfig ?? null;

  if (cfgEl) cfgEl.value = current ? JSON.stringify(current, null, 2) : '';
  renderDefaults(defaults);

  setButtonsDisabled(false);
  showStatus('Loaded chat config.', 'ok');
}

async function save() {
  const parsed = safeParseObject(cfgEl.value);

  if (parsed && parsed.__err) {
    showStatus(`Invalid JSON: ${parsed.__err}`, 'error');
    return;
  }

  setButtonsDisabled(true);
  showStatus(parsed == null ? 'Resetting to defaults…' : 'Saving…', 'ok');

  // Most servers accept either:
  // - { config: <object|null> }
  // - or { configText: "<json>" }
  // We'll send both safely.
  const raw = String(cfgEl.value ?? '').trim();

  try {
    await tryPost(SAVE_URLS, {
      config: parsed,                 // null means reset
      configText: raw || ''           // keep compatibility
    });

    setButtonsDisabled(false);
    showStatus(parsed == null ? 'Reset to defaults.' : 'Saved.', 'ok');
    await load(); // reload to reflect normalized server config
  } catch (e) {
    setButtonsDisabled(false);
    showStatus(`Save failed: ${e.message}`, 'error');
  }
}

async function reset() {
  if (!confirm('Reset chat config to defaults?')) return;

  setButtonsDisabled(true);
  showStatus('Resetting…', 'ok');

  try {
    // Prefer explicit reset endpoint
    try {
      await tryPost(RESET_URLS);
    } catch {
      // fallback: blank save
      await tryPost(SAVE_URLS, { config: null, configText: '' });
    }

    setButtonsDisabled(false);
    showStatus('Reset to defaults.', 'ok');
    await load();
  } catch (e) {
    setButtonsDisabled(false);
    showStatus(`Reset failed: ${e.message}`, 'error');
  }
}

function wire() {
  if (btnSave) btnSave.addEventListener('click', (e) => { e.preventDefault(); save(); });
  if (btnReset) btnReset.addEventListener('click', (e) => { e.preventDefault(); reset(); });

  // UX: Ctrl/Cmd+S to save
  document.addEventListener('keydown', (e) => {
    const isSave = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
    if (!isSave) return;
    e.preventDefault();
    save();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wire();
  load().catch(err => {
    setButtonsDisabled(false);
    showStatus(err.message || 'Failed to load chat config.', 'error');
  });
});
