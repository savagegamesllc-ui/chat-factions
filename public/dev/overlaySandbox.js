'use strict';

function normalizeStyleKey(styleKey) {
  const s = String(styleKey || '').trim();
  return s.toLowerCase().endsWith('.js') ? s.slice(0, -3) : s;
}

function safeDecodeConfig(b64) {
  try {
    const json = decodeURIComponent(escape(atob(String(b64 || ''))));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

async function loadStyle(styleKey) {
  const key = normalizeStyleKey(styleKey);

  const urls = [
    `/public/overlays/styles/${encodeURIComponent(key)}.js`,
    `/public/overlays/style/${encodeURIComponent(key)}.js`, // compat
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      return await import(url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`Failed to import style: ${key}`);
}

function post(type, payload) {
  // parent is same-origin in your tool
  window.parent?.postMessage({ type, ...payload }, window.location.origin);
}

function installErrorHooks() {
  window.addEventListener('error', (ev) => {
    const msg = ev?.error?.message || ev?.message || 'Unknown window error';
    const stack = ev?.error?.stack || '';
    post('DEV_ERROR', { message: msg, stack });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const err = ev?.reason;
    const msg = err?.message || String(err || 'Unhandled rejection');
    const stack = err?.stack || '';
    post('DEV_ERROR', { message: msg, stack });
  });
}

function makeDevApi() {
  const handlers = new Set();
  let lastSnap = { factions: [] };

  function emit(snap) {
    lastSnap = snap || { factions: [] };
    handlers.forEach((fn) => {
      try { fn(lastSnap); } catch {}
    });
  }

  return {
    onMeters(fn) {
      handlers.add(fn);
      // push immediately so overlays render right away
      try { fn(lastSnap); } catch {}
      return () => handlers.delete(fn);
    },
    _emit: emit,
    _getLast: () => lastSnap,
  };
}

async function main() {
  installErrorHooks();

  const params = new URLSearchParams(window.location.search || '');
  const styleKey = params.get('styleKey') || '';
  const cfgB64 = params.get('config') || '';
  let config = safeDecodeConfig(cfgB64);

  const root = document.getElementById('overlayRoot');
  if (!root) throw new Error('overlayRoot missing');

  // reset root
  while (root.firstChild) root.removeChild(root.firstChild);

  const api = makeDevApi();

  // load and init overlay
  const mod = await loadStyle(styleKey);
  if (!mod || typeof mod.init !== 'function') {
    throw new Error(`Style "${styleKey}" did not export init()`);
  }

  let instance = null;

  function boot() {
    while (root.firstChild) root.removeChild(root.firstChild);
    instance = mod.init({ root, config, api }) || null;

    // overlays like crownfall return { destroy, setConfig }
    if (instance && typeof instance.destroy !== 'function') {
      // not required, but helps safe reloads
      instance.destroy = () => {};
    }
  }

  boot();

  // message bridge
  window.addEventListener('message', (ev) => {
    if (ev.origin !== window.location.origin) return;
    const msg = ev.data || {};
    if (!msg.type) return;

    if (msg.type === 'DEV_PING') {
      post('DEV_PONG', { at: Date.now() });
      return;
    }

    if (msg.type === 'DEV_SET_SNAP') {
      api._emit(msg.snap || { factions: [] });
      return;
    }

    if (msg.type === 'DEV_SET_CONFIG') {
      config = msg.config || {};

      // prefer live update, otherwise hot-reboot
      if (instance && typeof instance.setConfig === 'function') {
        try { instance.setConfig(config); }
        catch (e) { post('DEV_ERROR', { message: e?.message || String(e), stack: e?.stack || '' }); }
      } else {
        try { instance?.destroy?.(); } catch {}
        boot();
        // restore last snap after reboot
        api._emit(api._getLast());
      }
      return;
    }
  });

  post('DEV_READY', { styleKey: normalizeStyleKey(styleKey) });
}

main().catch((e) => {
  post('DEV_ERROR', { message: e?.message || String(e), stack: e?.stack || '' });
});
