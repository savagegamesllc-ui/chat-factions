'use strict';

export const meta = {
  styleKey: 'chatPerspective',
  name: 'Chat Perspective (PRO)',
  tier: 'PRO',
  description: 'Live Twitch chat rendered as cinematic perspective text (with preview-safe fake chat).',

  defaultConfig: {
    mode: 'crawl', // crawl | angled | flat

    // Buffer / lifetime
    maxLines: 34,
    lineLifetime: 14, // seconds

    // Typography
    fontFamily: 'Arial Black, Impact, system-ui, sans-serif',
    fontSize: 28,
    lineSpacing: 1.2,
    textColor: '#ffe81f',
    outlineColor: 'rgba(0,0,0,0.65)',
    outlineWidth: 3,

    // Perspective & tilt
    perspective: 800,
    tiltX: 65, // degrees (crawl)
    tiltY: 0,  // degrees (angled)
    depthFade: 0.85,

    // Motion
    scrollSpeed: 22,     // px/sec-ish baseline
    hypeSpeedBoost: 1.4, // multiplier at max hype (if meters exist)

    // Fade shaping
    fadeIn: 0.35,
    fadeOut: 1.1,

    // Performance
    fpsCap: 60,
    renderScale: 1.0,

    // --- Preview / fallback ---
    fakeChatEnabled: true,         // allow generator
    fakeChatRate: 0.55,            // messages/sec baseline
    fakeChatBurstRate: 2.0,        // messages/sec at high hype (or preview “max”)
    fakeChatIncludeUser: true,     // prefix "User: msg"
    fakeChatSeed: 0                // set non-zero to get repeatable-ish randomness
  }
};

function clamp(n, a, b) { n = +n; return isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function normalizeCfg(base, incoming) {
  const cfg = { ...base, ...(incoming || {}) };
  cfg.maxLines = clamp(cfg.maxLines, 5, 200) | 0;
  cfg.lineLifetime = clamp(cfg.lineLifetime, 3, 60);

  cfg.fontSize = clamp(cfg.fontSize, 10, 90);
  cfg.lineSpacing = clamp(cfg.lineSpacing, 0.9, 2.0);

  cfg.tiltX = clamp(cfg.tiltX, -5, 85);
  cfg.tiltY = clamp(cfg.tiltY, -60, 60);
  cfg.perspective = clamp(cfg.perspective, 200, 2400);

  cfg.scrollSpeed = clamp(cfg.scrollSpeed, 0, 180);
  cfg.hypeSpeedBoost = clamp(cfg.hypeSpeedBoost, 1.0, 5.0);

  cfg.fadeIn = clamp(cfg.fadeIn, 0, 2);
  cfg.fadeOut = clamp(cfg.fadeOut, 0.1, 4);

  cfg.fpsCap = clamp(cfg.fpsCap, 15, 60) | 0;
  cfg.renderScale = clamp(cfg.renderScale, 0.5, 1.25);

  cfg.fakeChatRate = clamp(cfg.fakeChatRate, 0, 6);
  cfg.fakeChatBurstRate = clamp(cfg.fakeChatBurstRate, 0, 12);
  cfg.fakeChatSeed = clamp(cfg.fakeChatSeed, 0, 2147483647) | 0;

  return cfg;
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'chatPerspective';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas, renderScale) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr * renderScale));
  const H = Math.max(1, Math.floor(rect.height * dpr * renderScale));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  // We draw in CSS pixels
  const wCss = rect.width;
  const hCss = rect.height;
  return { wCss, hCss, dpr, renderScale };
}

/**
 * We’ll use meters (if available) only to:
 * - speed up fake chat generation when hype is high
 * - optionally boost scroll speed
 *
 * This mirrors your existing "api.onMeters" contract. :contentReference[oaicite:1]{index=1}
 */
function computeTotalHype(snap) {
  const factions = snap && Array.isArray(snap.factions) ? snap.factions : [];
  let total = 0;
  for (const f of factions) total += Math.max(0, Number(f?.meter) || 0);
  return total;
}

function hypeTo01(total) {
  // soft curve; tweak as desired
  const k = 180;
  const h = 1 - Math.exp(-Math.max(0, total) / k);
  return clamp01(h);
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = normalizeCfg(meta.defaultConfig, config);

  // Query params for preview behavior
  const params = new URLSearchParams(window.location.search || '');
  const isPreview = params.get('preview') === '1';

  // Chat ring buffer
  const lines = []; // { text, createdAt, life, user?, color? }
  function pushLine(text) {
    const t = String(text || '').trim();
    if (!t) return;
    lines.push({ text: t, createdAt: performance.now(), life: cfg.lineLifetime });
    while (lines.length > cfg.maxLines) lines.shift();
  }

  // --- Hype state (optional) ---
  let hype01 = 0;
  let hypeTarget = 0;
  let unsubMeters = null;

  if (api && typeof api.onMeters === 'function') {
    unsubMeters = api.onMeters((snap) => {
      const total = computeTotalHype(snap);
      hypeTarget = hypeTo01(total);
    });
  }

  // Smooth hype like your other overlays do (Crownfall pattern). :contentReference[oaicite:2]{index=2}
  function stepHype(dt) {
    const smooth = 0.20; // fixed smoothing (could be config later)
    hype01 = lerp(hype01, hypeTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hype01 = clamp01(hype01);
  }

  // --- Real chat subscription, if present ---
  let hasRealChat = false;
  let unsubChat = null;

  if (api && typeof api.onChat === 'function') {
    hasRealChat = true;
    unsubChat = api.onChat((msg) => {
      // Expect: { user, message, color? }
      const user = String(msg?.user || '').trim();
      const message = String(msg?.message || '').trim();
      if (!message) return;

      const finalText = cfg.fakeChatIncludeUser && user ? `${user}: ${message}` : message;
      pushLine(finalText);
    });
  }

  // --- Fake chat generator (fallback + preview) ---
  // Toggle: if no real chat OR preview OR explicitly enabled
  let fakeChatOn = (!hasRealChat && cfg.fakeChatEnabled) || (isPreview && cfg.fakeChatEnabled);

  // Optional: allow dashboard postMessage toggles (mirrors your preview control style). :contentReference[oaicite:3]{index=3}
  function onMsg(ev) {
    const msg = ev?.data;
    if (!msg) return;
    if (msg.type === 'DEV_PREVIEW_FAKE_CHAT') {
      fakeChatOn = !!msg.enabled;
    }
  }
  if (isPreview) window.addEventListener('message', onMsg);

  // Seeded RNG (stable-ish for demos when seed set)
  const rng = mulberry32((cfg.fakeChatSeed || 0) + 0xC0FFEE);

  const demoUsers = [
    'PixelPaladin', 'CinderWisp', 'JaySands', 'LootGoblin', 'NeonBard', 'FrostByte',
    'DungeonMom', 'RaidCaptain', 'CritMachine', 'HypeSquire', 'ArcaneCat'
  ];

  const demoPhrases = [
    'LET’S GOOOOO',
    'that was CLEAN',
    'no shot 😳',
    'CLUTCH!',
    'W chat',
    'this overlay is sick',
    'WHAT JUST HAPPENED',
    'absolute cinema',
    'broooooooo',
    'do it again',
    '10/10 moment',
    'I can’t breathe 😂',
    'peak content',
    'EZ',
    'BIG WIN'
  ];

  let fakeCarry = 0;

  function maybeGenerateFake(dt) {
    if (!fakeChatOn) return;

    // Rate scales with hype (or preview sim hype)
    const base = cfg.fakeChatRate;
    const burst = cfg.fakeChatBurstRate;

    // If we have meters, hype01 drives the burst. If not, preview uses a gentle wave.
    const previewWave = (Math.sin(performance.now() / 1200) + 1) / 2; // 0..1
    const driver = hasRealChat ? 0 : (unsubMeters ? hype01 : previewWave);

    const rate = base + (burst - base) * clamp01(driver);

    fakeCarry += rate * dt;
    const count = Math.min(5, Math.floor(fakeCarry)); // safety
    fakeCarry -= count;

    for (let i = 0; i < count; i++) {
      const user = demoUsers[(rng() * demoUsers.length) | 0];
      const phrase = demoPhrases[(rng() * demoPhrases.length) | 0];

      // Occasional “longer” line to show crawl nicely
      const spice = rng();
      const msg =
        spice < 0.20 ? `${phrase} — that timing was unreal` :
        spice < 0.30 ? `${phrase} !!!` :
        phrase;

      const finalText = cfg.fakeChatIncludeUser ? `${user}: ${msg}` : msg;
      pushLine(finalText);
    }
  }

  // --- Canvas sizing ---
  function resize() {
    const { wCss, hCss, dpr, renderScale } = resizeCanvas(canvas, cfg.renderScale);
    // Draw in CSS pixels; scale transform to map canvas pixels -> CSS pixels
    // canvas is larger by dpr*renderScale, so setTransform accordingly.
    ctx.setTransform(dpr * renderScale, 0, 0, dpr * renderScale, 0, 0);
    return { w: wCss, h: hCss };
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize, { passive: true });
  resize();

  function setTextStyle() {
    ctx.font = `${cfg.fontSize}px ${cfg.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
  }

  function alphaForAge(ageSec, lifeSec) {
    const fi = cfg.fadeIn;
    const fo = cfg.fadeOut;

    // Fade in
    const aIn = fi <= 0 ? 1 : clamp01(ageSec / fi);

    // Fade out near end
    const remain = lifeSec - ageSec;
    const aOut = fo <= 0 ? 1 : clamp01(remain / fo);

    return clamp01(aIn * aOut);
  }

  function drawFlat(w, h, nowMs) {
    setTextStyle();

    const centerX = w * 0.5;
    const bottomY = h * 0.92;
    const lineH = cfg.fontSize * cfg.lineSpacing;

    // Scroll uses time; boost slightly with hype
    const speed = cfg.scrollSpeed * lerp(1.0, cfg.hypeSpeedBoost, hype01);

    // Our lines each have "createdAt" and move upward with age
    for (let i = lines.length - 1; i >= 0; i--) {
      const L = lines[i];
      const ageSec = (nowMs - L.createdAt) / 1000;
      if (ageSec > L.life) continue;

      const a = alphaForAge(ageSec, L.life);
      if (a <= 0.001) continue;

      const y = bottomY - ageSec * speed - (lines.length - 1 - i) * lineH * 0.35;

      ctx.globalAlpha = a;
      if (cfg.outlineWidth > 0) {
        ctx.lineWidth = cfg.outlineWidth;
        ctx.strokeStyle = cfg.outlineColor;
        ctx.strokeText(L.text, centerX, y);
      }
      ctx.fillStyle = cfg.textColor;
      ctx.fillText(L.text, centerX, y);
    }
  }

  function drawAngled(w, h, nowMs) {
    setTextStyle();

    const speed = cfg.scrollSpeed * lerp(1.0, cfg.hypeSpeedBoost, hype01);
    const lineH = cfg.fontSize * cfg.lineSpacing;

    // A mild “wall” perspective: scale by depth (age)
    const cx = w * 0.55;
    const baseY = h * 0.88;

    ctx.save();
    // tilt around center
    ctx.translate(cx, baseY);
    ctx.rotate((-cfg.tiltY * Math.PI) / 180);

    for (let i = lines.length - 1; i >= 0; i--) {
      const L = lines[i];
      const ageSec = (nowMs - L.createdAt) / 1000;
      if (ageSec > L.life) continue;

      const a = alphaForAge(ageSec, L.life);
      if (a <= 0.001) continue;

      // depth grows with age -> smaller + higher
      const z = clamp01(ageSec / L.life);
      const scale = lerp(1.0, 0.45, z);
      const y = -ageSec * speed - (lines.length - 1 - i) * lineH * 0.25;

      ctx.save();
      ctx.globalAlpha = a * lerp(1.0, cfg.depthFade, z);
      ctx.scale(scale, scale);

      if (cfg.outlineWidth > 0) {
        ctx.lineWidth = cfg.outlineWidth / Math.max(0.6, scale);
        ctx.strokeStyle = cfg.outlineColor;
        ctx.strokeText(L.text, 0, y / scale);
      }
      ctx.fillStyle = cfg.textColor;
      ctx.fillText(L.text, 0, y / scale);

      ctx.restore();
    }

    ctx.restore();
  }

  function drawCrawl(w, h, nowMs) {
    setTextStyle();

    const speed = cfg.scrollSpeed * lerp(1.0, cfg.hypeSpeedBoost, hype01);
    const lineH = cfg.fontSize * cfg.lineSpacing;

    // Star Wars crawl transform:
    // - anchor at bottom center
    // - rotate X to tilt away
    // - compress Y to fake perspective
    const cx = w * 0.5;
    const baseY = h * 0.98;

    ctx.save();
    ctx.translate(cx, baseY);

    // We don’t have true 3D; fake it by:
    // - rotating “forward” via skewed scale
    // - scaling smaller as text rises
    const tilt = clamp(cfg.tiltX, 0, 85);
    const tiltRad = (tilt * Math.PI) / 180;
    const squash = lerp(1.0, 0.35, Math.sin(tiltRad)); // more tilt = more squash
    ctx.scale(1.0, squash);

    // Slight upward shift so it starts visible
    const startY = 0;

    // Draw from newest to oldest so newest is closest
    for (let i = lines.length - 1; i >= 0; i--) {
      const L = lines[i];
      const ageSec = (nowMs - L.createdAt) / 1000;
      if (ageSec > L.life) continue;

      const a = alphaForAge(ageSec, L.life);
      if (a <= 0.001) continue;

      // position increases with age (moves “up”)
      const y = startY - ageSec * speed - (lines.length - 1 - i) * lineH * 0.45;

      // convert y into a depth factor (farther = smaller + dimmer)
      const z = clamp01((-y) / (h * 0.9));
      const scale = lerp(1.05, 0.18, z);

      ctx.save();
      ctx.globalAlpha = a * lerp(1.0, cfg.depthFade, z);
      ctx.scale(scale, scale);

      if (cfg.outlineWidth > 0) {
        ctx.lineWidth = cfg.outlineWidth / Math.max(0.35, scale);
        ctx.strokeStyle = cfg.outlineColor;
        ctx.strokeText(L.text, 0, y / scale);
      }
      ctx.fillStyle = cfg.textColor;
      ctx.fillText(L.text, 0, y / scale);

      ctx.restore();
    }

    ctx.restore();
  }

  // --- main loop (fps cap) ---
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const frameEvery = 1000 / cfg.fpsCap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    stepHype(dt);
    maybeGenerateFake(dt);

    const { w, h } = resize();
    ctx.clearRect(0, 0, w, h);

    if (cfg.mode === 'flat') drawFlat(w, h, nowMs);
    else if (cfg.mode === 'angled') drawAngled(w, h, nowMs);
    else drawCrawl(w, h, nowMs);

    // Clear dead lines occasionally
    // (cheap pass; avoids buffer growing stale if config changes)
    for (let i = lines.length - 1; i >= 0; i--) {
      const ageSec = (nowMs - lines[i].createdAt) / 1000;
      if (ageSec > lines[i].life + 0.5) lines.splice(i, 1);
    }
  }

  raf = requestAnimationFrame(loop);

  function setConfig(next) {
    cfg = normalizeCfg(cfg, next);
  }

  function destroy() {
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    try { window.removeEventListener('message', onMsg); } catch {}
    try { unsubChat?.(); } catch {}
    try { unsubMeters?.(); } catch {}
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  return { destroy, setConfig };
}
