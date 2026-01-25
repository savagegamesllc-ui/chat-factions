// public/overlays/overlayClient.js
'use strict';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function findOverlayRoot() {
  // First try direct id
  let el = document.getElementById('overlayRoot');
  if (el) return el;

  // Fallback: attribute-based (in case template/layout changes)
  el = document.querySelector('[data-style-key][data-streamer-token]');
  if (el) return el;

  // If DOM not ready yet, wait briefly for parse/layout insertion
  if (document.readyState === 'loading') {
    await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    el = document.getElementById('overlayRoot') || document.querySelector('[data-style-key][data-streamer-token]');
    if (el) return el;
  }

  // Last resort: a short retry loop (covers weird OBS timing)
  for (let i = 0; i < 20; i++) {
    await sleep(25);
    el = document.getElementById('overlayRoot') || document.querySelector('[data-style-key][data-streamer-token]');
    if (el) return el;
  }

  return null;
}

function makeApi({ streamerToken }) {
  const handlers = new Set();

  const params = new URLSearchParams(window.location.search || '');
  const isPreview = params.get('preview') === '1';

  let maxHypeEnabled = false;

  // Keep last real snap so we can revert cleanly when sim stops
  let lastRealSnap = null;

  // Simulation state
  let simTimer = null;
  let simT = 0;

  function emitToHandlers(snap) {
    handlers.forEach((fn) => {
      try { fn(snap); } catch {}
    });
  }

  function startSim() {
    if (simTimer) return;
    simT = 0;

    simTimer = setInterval(() => {
      simT += 1;

      // Smooth oscillation so you SEE motion + blending
      const wave = (Math.sin(simT / 10) + 1) / 2; // 0..1

      // Big values so thickness clearly increases in flameEdge
      const a = 50 + wave * 600;
      const b = 50 + (1 - wave) * 600;

      emitToHandlers({
        factions: [
          { meter: a, colorHex: '#ff6a00' },
          { meter: b, colorHex: '#ff2e2e' },
        ]
      });
    }, 100);
  }

  function stopSim() {
    if (!simTimer) return;
    clearInterval(simTimer);
    simTimer = null;

    // When stopping, restore last real state if we have one
    if (lastRealSnap) emitToHandlers(lastRealSnap);
    else emitToHandlers({ factions: [] });
  }

  // Listen for preview toggle messages from dashboard
  if (isPreview) {
    window.addEventListener('message', (ev) => {
      const msg = ev?.data;
      if (!msg || msg.type !== 'DEV_PREVIEW_MAX_HYPE') return;

      maxHypeEnabled = !!msg.enabled;

      if (maxHypeEnabled) startSim();
      else stopSim();
    });
  }

  // Real SSE feed
  const sseUrl = `/overlays/${encodeURIComponent(token)}/sse`;
  const es = new EventSource(sseUrl);

  es.addEventListener('meters', (ev) => {
    try {
      const snap = JSON.parse(ev.data);
      lastRealSnap = snap;

      // If sim is ON, don't overwrite the visuals—just remember real snap.
      if (!(isPreview && maxHypeEnabled)) {
        emitToHandlers(snap);
      }
    } catch (_) {}
  });

  es.addEventListener('error', () => {
    // SSE auto reconnect
  });

  return {
    onMeters(fn) {
      handlers.add(fn);
      // If we already have a real snap, push it once
      if (lastRealSnap && !(isPreview && maxHypeEnabled)) {
        try { fn(lastRealSnap); } catch {}
      }
      return () => handlers.delete(fn);
    }
  };
}


function normalizeStyleKey(styleKey) {
  const s = String(styleKey || '').trim();
  return s.toLowerCase().endsWith('.js') ? s.slice(0, -3) : s;
}

async function loadStyle(styleKey) {
  const key = normalizeStyleKey(styleKey);

  // Try plural first, then singular (compat)
  const urls = [
    `/public/overlays/styles/${encodeURIComponent(key)}.js`,
    `/public/overlays/style/${encodeURIComponent(key)}.js`,
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      return await import(url);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Failed to import style module: ${key}`);
}

function renderError(msg) {
  const pre = document.createElement('pre');
  pre.style.position = 'fixed';
  pre.style.left = '0';
  pre.style.top = '0';
  pre.style.right = '0';
  pre.style.padding = '8px';
  pre.style.margin = '0';
  pre.style.fontSize = '12px';
  pre.style.background = 'rgba(0,0,0,0.65)';
  pre.style.color = '#ffb3b3';
  pre.style.pointerEvents = 'none';
  pre.textContent = `Overlay error: ${msg}`;
  document.body.appendChild(pre);
}

async function main() {
  const rootEl = await findOverlayRoot();
  if (!rootEl) {
    renderError('overlayRoot not found (template/layout did not render it or script executed too early)');
    return;
  }

  const streamerToken = String(rootEl.dataset.streamerToken || '').trim();
  const styleKey = String(rootEl.dataset.styleKey || '').trim();

  // Support both:
  // - data-config-json="..."
  // - data-effective-config-json="..." (if you used that name)
  const cfgText =
    rootEl.dataset.configJson ??
    rootEl.dataset.effectiveConfigJson ??
    '{}';

  const config = safeJson(cfgText);

  if (!streamerToken) {
    renderError('Missing data-streamer-token on overlayRoot');
    return;
  }
  if (!styleKey) {
    renderError('Missing data-style-key on overlayRoot');
    return;
  }

  const api = makeApi({ streamerToken });

  const mod = await loadStyle(styleKey);
  if (!mod || typeof mod.init !== 'function') {
    renderError(`Style "${styleKey}" did not export init()`);
    return;
  }

  mod.init({
    root: rootEl,
    config,
    api
  });
}

main().catch((err) => renderError(err?.message || String(err)));
