'use strict';

function $(id) { return document.getElementById(id); }

function showStatus(msg, isErr = false) {
  const el = $('status');
  el.style.display = 'block';
  el.textContent = msg;
  el.className = 'notice' + (isErr ? ' error' : '');
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => (el.style.display = 'none'), 3500);
}

let localModuleUrl = null;
let localModuleName = null;

function revokeLocalModule() {
  if (localModuleUrl) {
    URL.revokeObjectURL(localModuleUrl);
    localModuleUrl = null;
    localModuleName = null;
  }
}

function safeJsonParse(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

function encodeConfig(obj) {
  const json = JSON.stringify(obj ?? {});
  // btoa is fine here (we keep configs ASCII-ish); if you store unicode in config,
  // swap this for a TextEncoder->base64 helper.
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeConfig(b64) {
  const json = decodeURIComponent(escape(atob(String(b64 || ''))));
  return JSON.parse(json);
}

function buildSnap(total, aPct, aColor, bColor) {
  const t = Math.max(0, Number(total) || 0);
  const ap = Math.max(0, Math.min(100, Number(aPct) || 0));
  const bp = 100 - ap;

  const a = (t * (ap / 100));
  const b = (t * (bp / 100));

  return {
    factions: [
      { meter: a, colorHex: String(aColor || '#ff6a00') },
      { meter: b, colorHex: String(bColor || '#ff2e2e') },
    ]
  };
}

function nowStamp() {
  const d = new Date();
  return d.toLocaleTimeString();
}

const state = {
  styleKey: '',
  config: {},
  oscillateTimer: null,
  oscillateT: 0,
};

function clearOscillate() {
  if (state.oscillateTimer) {
    clearInterval(state.oscillateTimer);
    state.oscillateTimer = null;
  }
}

function postToSandbox(type, payload) {
  const frame = $('frame');
  frame.contentWindow?.postMessage({ type, ...payload }, window.location.origin);
}

function appendError(line) {
  const box = $('errors');
  if (box.textContent.trim() === 'No errors.') box.textContent = '';
  box.textContent += `[${nowStamp()}] ${line}\n`;
  box.scrollTop = box.scrollHeight;
}

function setSandboxState(txt) { $('sandboxState').textContent = txt; }
function setLastPing(txt) { $('lastPing').textContent = txt; }
function setLastSnap(txt) { $('lastSnap').textContent = txt; }

function currentConfigFromTextarea() {
  const parsed = safeJsonParse($('configJson').value);
  if (parsed === null) return null;
  return parsed;
}

function loadSandbox(styleKey, configObj) {
  const cfgObj = configObj ?? {};
  state.config = cfgObj;

  const cfgB64 = encodeConfig(state.config);

  // If a local file is chosen, load by moduleUrl, else load by styleKey
  const usingLocal = !!localModuleUrl;

  if (!usingLocal) {
    const key = String(styleKey || '').trim();
    if (!key) {
      showStatus('Style key is required (or upload a local file).', true);
      return;
    }
    state.styleKey = key;
    localStorage.setItem('overlayLab.styleKey', key);
  }

  const qs = new URLSearchParams();
  if (usingLocal) {
    qs.set('moduleUrl', localModuleUrl);
    qs.set('moduleName', localModuleName || 'localOverlay.js');
  } else {
    qs.set('styleKey', state.styleKey);
  }
  qs.set('config', cfgB64);
  qs.set('ts', String(Date.now()));

  const url = `/public/dev/overlaySandbox.html?${qs.toString()}`;

  $('loadedKey').textContent = usingLocal ? (localModuleName || 'local') : state.styleKey;
  setSandboxState('loading…');
  $('frame').src = url;

  setTimeout(() => {
    try { postToSandbox('DEV_PING', { at: Date.now() }); } catch {}
  }, 300);
}


function sendSnapOnce() {
  const total = Number($('totalHype').value) || 0;
  const ap = Number($('faShare').value) || 50;
  const snap = buildSnap(total, ap, $('faColor').value, $('fbColor').value);

  postToSandbox('DEV_SET_SNAP', { snap });
  setLastSnap(`${Math.round(total)} total`);
}

function startOscillate() {
  clearOscillate();
  state.oscillateT = 0;

  state.oscillateTimer = setInterval(() => {
    state.oscillateT += 1;
    // gentle oscillation for “motion + blending”
    const wave = (Math.sin(state.oscillateT / 10) + 1) / 2; // 0..1
    const max = Number($('totalHype').max) || 1200;
    const total = Math.round(wave * max);

    $('totalHype').value = String(total);
    $('totalHypeNum').value = String(total);

    if ($('autoSend').checked) sendSnapOnce();
  }, 100);
}

function stopOscillate() {
  clearOscillate();
}

function wireUI() {
    $('localFile').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;

  try {
    revokeLocalModule();

    // Basic sanity: only JS-ish files
    const name = file.name || 'localOverlay.js';
    localModuleName = name;

    // Create a blob URL. This is NOT uploading — it stays local in browser memory.
    const blob = new Blob([await file.text()], { type: 'text/javascript' });
    localModuleUrl = URL.createObjectURL(blob);

    // Show in UI
    $('styleKey').value = '';
    $('loadedKey').textContent = name;

    // Load immediately
    const cfg = currentConfigFromTextarea();
    if (cfg === null) return showStatus('Config JSON is invalid.', true);

    $('errors').textContent = 'No errors.';
    loadSandbox('', cfg);

    showStatus(`Loaded local overlay: ${name}`);
  } catch (e) {
    showStatus(`Failed to load local file: ${e?.message || e}`, true);
  }
});
$('btnUseServerStyle').addEventListener('click', () => {
  // stop using local overlay
  $('localFile').value = '';
  revokeLocalModule();
  showStatus('Switched back to server style key.');
});

  // defaults
  $('styleKey').value = localStorage.getItem('overlayLab.styleKey') || 'crownfall';

  const savedCfg = localStorage.getItem('overlayLab.configJson');
  $('configJson').value = savedCfg || JSON.stringify({}, null, 2);

  // sync share labels
  const syncShare = () => {
    const a = Number($('faShare').value) || 50;
    const b = 100 - a;
    $('faShareLbl').textContent = `${a}%`;
    $('fbShare').value = String(b);
    $('fbShareLbl').textContent = `${b}%`;
  };
  $('faShare').addEventListener('input', () => {
    syncShare();
    if ($('autoSend').checked && !$('oscillate').checked) sendSnapOnce();
  });
  $('fbShare').addEventListener('input', () => {
    // editing B drives A (keep sum 100)
    const b = Number($('fbShare').value) || 50;
    const a = 100 - b;
    $('faShare').value = String(a);
    syncShare();
    if ($('autoSend').checked && !$('oscillate').checked) sendSnapOnce();
  });
  syncShare();

  // total hype slider <-> number
  $('totalHype').addEventListener('input', () => {
    $('totalHypeNum').value = $('totalHype').value;
    if ($('autoSend').checked && !$('oscillate').checked) sendSnapOnce();
  });
  $('totalHypeNum').addEventListener('input', () => {
    const v = Math.max(0, Math.min(Number($('totalHype').max) || 1200, Number($('totalHypeNum').value) || 0));
    $('totalHype').value = String(v);
    if ($('autoSend').checked && !$('oscillate').checked) sendSnapOnce();
  });

  // color changes
  $('faColor').addEventListener('input', () => { if ($('autoSend').checked && !$('oscillate').checked) sendSnapOnce(); });
  $('fbColor').addEventListener('input', () => { if ($('autoSend').checked && !$('oscillate').checked) sendSnapOnce(); });

  // buttons
$('btnLoad').addEventListener('click', () => {
  const cfg = currentConfigFromTextarea();
  if (cfg === null) return showStatus('Config JSON is invalid.', true);

  localStorage.setItem('overlayLab.configJson', $('configJson').value);

  $('errors').textContent = 'No errors.';

  // If localModuleUrl exists, ignore styleKey
  const key = $('styleKey').value.trim();
  if (!localModuleUrl) {
    localStorage.setItem('overlayLab.styleKey', key);
  }

  loadSandbox(key, cfg);
});


  $('btnHardReload').addEventListener('click', () => {
    // hard reload: reload iframe URL with ts param
    if (!state.styleKey) return;
    loadSandbox(state.styleKey, state.config);
    showStatus('Hard reloaded sandbox.');
  });

  $('btnApplyConfig').addEventListener('click', () => {
    const cfg = currentConfigFromTextarea();
    if (cfg === null) return showStatus('Config JSON is invalid.', true);

    state.config = cfg;
    localStorage.setItem('overlayLab.configJson', $('configJson').value);

    postToSandbox('DEV_SET_CONFIG', { config: cfg });
    showStatus('Config sent to sandbox.');
  });

  $('btnResetConfig').addEventListener('click', () => {
    $('configJson').value = JSON.stringify({}, null, 2);
    state.config = {};
    localStorage.setItem('overlayLab.configJson', $('configJson').value);
    postToSandbox('DEV_SET_CONFIG', { config: {} });
    showStatus('Config reset.');
  });

  $('btnSendSnap').addEventListener('click', () => sendSnapOnce());

  $('btnZero').addEventListener('click', () => {
    $('totalHype').value = '0';
    $('totalHypeNum').value = '0';
    if ($('autoSend').checked) sendSnapOnce();
  });

  $('btnClearErrors').addEventListener('click', () => {
    $('errors').textContent = 'No errors.';
  });

  $('btnPopout').addEventListener('click', () => {
    const frameUrl = $('frame').src;
    if (!frameUrl || frameUrl === 'about:blank') return;
    window.open(frameUrl, '_blank', 'noopener,noreferrer,width=1200,height=720');
  });

  // oscillate
  $('oscillate').addEventListener('change', () => {
    if ($('oscillate').checked) startOscillate();
    else stopOscillate();
  });

  // load on first run
  $('btnLoad').click();

  // listen for sandbox messages
  window.addEventListener('message', (ev) => {
    if (ev.origin !== window.location.origin) return;
    const msg = ev.data || {};
    if (!msg.type) return;

    if (msg.type === 'DEV_READY') {
      setSandboxState('ready');
      showStatus(`Sandbox ready (${msg.styleKey || 'unknown'})`);
      // send an initial snap so overlay has state
      sendSnapOnce();
      return;
    }

    if (msg.type === 'DEV_PONG') {
      setLastPing(nowStamp());
      return;
    }

    if (msg.type === 'DEV_ERROR') {
      setSandboxState('error');
      appendError(msg.message || 'Unknown error');
      if (msg.stack) appendError(msg.stack);
      return;
    }

    if (msg.type === 'DEV_LOG') {
      // optional: sandbox console log passthrough
      appendError(`LOG: ${msg.message || ''}`);
      return;
    }
  });
}

wireUI();
