// public/dev/overlaySandbox.js
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

function post(type, payload) {
  // Parent is same-origin in Overlay Lab tool
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
    for (const fn of handlers) {
      try { fn(lastSnap); } catch {}
    }
  }

  return {
    onMeters(fn) {
      handlers.add(fn);
      // Immediately push last snapshot so overlays can render ASAP
      try { fn(lastSnap); } catch {}
      return () => handlers.delete(fn);
    },
    _emit: emit,
    _getLast: () => lastSnap,
  };
}

async function loadStyleByKey(styleKey) {
  const key = normalizeStyleKey(styleKey);

  const urls = [
    `/public/overlays/styles/${encodeURIComponent(key)}.js`,
    `/public/overlays/style/${encodeURIComponent(key)}.js`, // compat fallback
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

function isLikelyCspBlobImportBlock(err, moduleUrl) {
  const msg = String(err?.message || err || '').toLowerCase();
  const url = String(moduleUrl || '').toLowerCase();

  // Typical browser phrasing for this situation:
  // "Failed to fetch dynamically imported module: blob:..."
  // plus the console CSP violation.
  return url.startsWith('blob:') && (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch') ||
    msg.includes('importing a module script failed') ||
    msg.includes('load failed')
  );
}

function makeCspGuidance(moduleUrl) {
  // Keep this short and actionable—this is what Jay needs to fix server-side.
  return (
    `Local overlay import blocked by CSP.\n` +
    `Your server is sending CSP "script-src 'self'" (no blob:), so import(${moduleUrl}) is blocked.\n\n` +
    `Fix (dev-only recommended): allow blob: for /public/dev/*\n` +
    `- script-src 'self' blob:\n` +
    `- script-src-elem 'self' blob:\n\n` +
    `Note: meta CSP in overlaySandbox.html cannot override CSP headers.`
  );
}

async function loadStyleByUrl(moduleUrl) {
  // moduleUrl can be blob:... created in the parent tool (Overlay Lab)
  // This requires CSP header to allow blob: in script-src / script-src-elem
  try {
    return await import(moduleUrl);
  } catch (e) {
    // Improve the error for the common CSP block case
    if (isLikelyCspBlobImportBlock(e, moduleUrl)) {
      const err = new Error(makeCspGuidance(moduleUrl));
      // Preserve original stack/message for debugging context
      err.cause = e;
      throw err;
    }
    throw e;
  }
}

async function main() {
  installErrorHooks();

  const params = new URLSearchParams(window.location.search || '');

  const styleKey = params.get('styleKey') || '';
  const moduleUrl = params.get('moduleUrl') || '';
  const moduleName = params.get('moduleName') || '';

  const cfgB64 = params.get('config') || '';
  let config = safeDecodeConfig(cfgB64);

  const root = document.getElementById('overlayRoot');
  if (!root) throw new Error('overlayRoot missing');

  // reset root
  while (root.firstChild) root.removeChild(root.firstChild);

  const api = makeDevApi();

  // load module (local blob URL or server styleKey)
  let mod;
  if (moduleUrl) mod = await loadStyleByUrl(moduleUrl);
  else mod = await loadStyleByKey(styleKey);

  if (!mod || typeof mod.init !== 'function') {
    throw new Error(
      moduleUrl
        ? `Local module "${moduleName || 'local'}" did not export init()`
        : `Style "${styleKey}" did not export init()`
    );
  }

  let instance = null;

  function boot() {
    while (root.firstChild) root.removeChild(root.firstChild);

    // overlays expect init({ root, config, api })
    instance = mod.init({ root, config, api }) || null;

    // Not required, but gives us safe reload semantics
    if (instance && typeof instance.destroy !== 'function') {
      instance.destroy = () => {};
    }
  }

  boot();

  // message bridge from parent tool
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

      // Prefer live update if overlay supports it
      if (instance && typeof instance.setConfig === 'function') {
        try {
          instance.setConfig(config);
        } catch (e) {
          post('DEV_ERROR', { message: e?.message || String(e), stack: e?.stack || '' });
        }
      } else {
        // Hot reboot
        try { instance?.destroy?.(); } catch {}
        boot();

        // restore last snap after reboot so overlay has state
        api._emit(api._getLast());
      }
      return;
    }
  });

  // ready signal
  post('DEV_READY', {
    styleKey: moduleUrl ? (moduleName || 'local') : normalizeStyleKey(styleKey),
  });
}

main().catch((e) => {
  // If we wrapped a CSP-related error, show the guidance clearly
  post('DEV_ERROR', { message: e?.message || String(e), stack: e?.stack || '' });

  // Also surface original cause if present (optional extra context)
  if (e && e.cause) {
    post('DEV_ERROR', {
      message: `Underlying error: ${e.cause?.message || String(e.cause)}`,
      stack: e.cause?.stack || '',
    });
  }
});
