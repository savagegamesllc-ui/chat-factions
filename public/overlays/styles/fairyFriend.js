// public/overlays/styles/fairyFriend.js
// FREE Overlay: Fairy Friend
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Visual: a small fairy-like orb with wings that wanders around the screen.
// Speech bubbles occasionally appear with phrases like "Listen", "Hey", and rarely "DAWG OPEN YOUR EARS!".
// Hype increases size + glow; glow color follows the current hype leader.
//
// Event phrases:
// - subPhrase: shown on sub events (cooldown protected)
// - bitsPhrase: shown on bits events (cooldown protected)
//
// Note: If the runtime provides api.onEvent(fn), we’ll use it.
// Otherwise, the overlay still works with idle phrases + hype color/size via api.onMeters().

'use strict';

export const meta = {
  styleKey: 'fairyFriend',
  name: 'Fairy Friend (FREE)',
  tier: 'FREE',
  description:
    'A roaming fairy companion that glows in the hype leader’s color and occasionally pops speech bubbles like “Listen” and “Hey”.',

  defaultConfig: {
    // Hype mapping
    hypeK: 140,              // smaller = reacts sooner
    maxTotalClamp: 2500,     // safety clamp

    // Fairy motion
    pathRadius: 0.22,        // 0..0.5 as fraction of min(screenW, screenH)
    wanderSpeed: 0.65,       // base movement speed (multiplier)
    jitter: 0.35,            // subtle randomness
    edgePadding: 0.06,       // keep away from edges (fraction of min dimension)

    // Fairy appearance (base size in px at 1080p-ish; scales with viewport)
    baseSize: 28,
    sizeGrowth: 0.85,        // how much hype increases size (0..2)
    glowStrength: 0.95,      // bloom intensity (0..1.5)
    coreBrightness: 0.92,    // 0..1
    wingOpacity: 0.55,       // 0..1

    // Speech bubbles
    bubbleEnabled: true,
    bubbleDurationMs: 1400,
    bubbleCooldownMs: 5200,     // global cooldown after any bubble ends
    bubbleMinGapMs: 1200,       // minimum time between bubbles even if cooldown small

    // Idle phrase scheduling
    idleChancePerSecond: 0.065, // chance per second to attempt an idle bubble
    idlePhrases: ['Listen', 'Hey'],
    rarePhrase: 'DAWG OPEN YOUR EARS!',
    rareChance: 0.02,           // chance that an idle phrase becomes the rare phrase

    // Event phrases (user configurable)
    subPhrase: '',              // e.g. "THANK YOU FOR THE SUB!"
    bitsPhrase: '',             // e.g. "BITS?! YOU LEGEND!"

    // Event gating
    eventCooldownMs: 6500,      // separate “event bubble” gate (also respects global bubble lock)
    eventPriority: true,        // if an event happens and bubble is available, it should use event phrase instead of idle

    // Text/bubble styling
    bubbleScale: 1.0,           // 0.7..1.4
    bubbleMaxWidth: 320,        // px cap (scaled by DPR transform, we draw in CSS px)
    bubbleFont: '700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    bubbleTextColor: 'rgba(255,255,255,0.96)',
    bubbleFill: 'rgba(10,10,18,0.72)',
    bubbleStroke: 'rgba(255,255,255,0.18)',

    // Performance
    fpsCap: 60,                 // 15..60
  },

  controls: [
    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 140 },

    { key: 'wanderSpeed', label: 'Wander Speed', type: 'range', min: 0.2, max: 1.8, step: 0.05, default: 0.65 },
    { key: 'pathRadius', label: 'Path Radius', type: 'range', min: 0.08, max: 0.45, step: 0.01, default: 0.22 },
    { key: 'edgePadding', label: 'Edge Padding', type: 'range', min: 0.0, max: 0.16, step: 0.005, default: 0.06 },

    { key: 'baseSize', label: 'Base Size', type: 'range', min: 12, max: 70, step: 1, default: 28 },
    { key: 'sizeGrowth', label: 'Hype Size Growth', type: 'range', min: 0, max: 2, step: 0.05, default: 0.85 },
    { key: 'glowStrength', label: 'Glow Strength', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.95 },

    { key: 'bubbleEnabled', label: 'Enable Speech Bubbles', type: 'checkbox', default: true },
    { key: 'bubbleDurationMs', label: 'Bubble Duration (ms)', type: 'range', min: 600, max: 3000, step: 50, default: 1400 },
    { key: 'bubbleCooldownMs', label: 'Bubble Cooldown (ms)', type: 'range', min: 1500, max: 15000, step: 250, default: 5200 },
    { key: 'idleChancePerSecond', label: 'Idle Bubble Rate', type: 'range', min: 0, max: 0.25, step: 0.005, default: 0.065 },
    { key: 'rareChance', label: 'Rare Phrase Chance', type: 'range', min: 0, max: 0.12, step: 0.005, default: 0.02 },

    { key: 'subPhrase', label: 'Sub Phrase', type: 'text', default: '' },
    { key: 'bitsPhrase', label: 'Bits Phrase', type: 'text', default: '' },
    { key: 'eventCooldownMs', label: 'Event Cooldown (ms)', type: 'range', min: 1500, max: 20000, step: 250, default: 6500 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
  ],
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a)); }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const h = String(hex || '#78c8ff').trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function pickLeaderColor(factions) {
  if (!Array.isArray(factions) || factions.length === 0) return { r: 140, g: 210, b: 255 };
  let best = factions[0];
  for (const f of factions) {
    if ((Number(f?.meter) || 0) > (Number(best?.meter) || 0)) best = f;
  }
  return hexToRgb(best?.colorHex || '#78c8ff');
}

function computeTotalAndH(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) total += Math.max(0, Number(f?.meter) || 0);

  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2500, 200, 9000));
  const k = clamp(cfg.hypeK ?? 140, 40, 600);
  let h = 1 - Math.exp(-total / k);
  // slight lift so small hype is visible
  h = clamp01(h + (1 - h) * 0.05 * Math.min(1, total / 70));

  return { total, h, leaderRgb: pickLeaderColor(factions) };
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'fairyFriend';
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

function resizeCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: W / dpr, h: H / dpr, dpr };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let latestSnap = { factions: [] };
  let hTarget = 0;
  let hSmooth = 0;
  let leaderRgb = { r: 140, g: 210, b: 255 };
  let leaderSmooth = { r: 140, g: 210, b: 255 };

  // Speech state
  let bubble = null; // { text, startedAt, endAt, kind }
  let nextBubbleAllowedAt = 0;
  let nextEventAllowedAt = 0;

  // Motion state
  let t0 = performance.now() / 1000;
  let pos = { x: 0.5, y: 0.5 }; // normalized
  let vel = { x: 0, y: 0 };

  // Loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  // Subscriptions
  const unsubMeters = api?.onMeters?.((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeTotalAndH(latestSnap, cfg);
    hTarget = res.h;
    leaderRgb = res.leaderRgb;
  });

  // Optional event hook (runtime-dependent)
  const unsubEvent = (typeof api?.onEvent === 'function')
    ? api.onEvent((ev) => handleEvent(ev))
    : null;

  function handleEvent(ev) {
    // We intentionally keep this tolerant:
    // Accepts {type:'sub'} / {type:'bits'} or Twitch-ish {kind:'sub'} etc.
    const type = String(ev?.type || ev?.kind || ev?.event || '').toLowerCase();
    if (!type) return;

    const now = performance.now();

    // global lock: do not override an active bubble
    if (!cfg.bubbleEnabled) return;
    if (bubble && now < bubble.endAt) return;
    if (now < nextBubbleAllowedAt) return;

    // event cooldown
    if (now < nextEventAllowedAt) return;

    if (type.includes('sub')) {
      const text = String(cfg.subPhrase || '').trim();
      if (!text) return;
      showBubble(text, 'sub');
      nextEventAllowedAt = now + clamp(cfg.eventCooldownMs, 0, 60000);
      return;
    }

    if (type.includes('bit') || type.includes('cheer')) {
      const text = String(cfg.bitsPhrase || '').trim();
      if (!text) return;
      showBubble(text, 'bits');
      nextEventAllowedAt = now + clamp(cfg.eventCooldownMs, 0, 60000);
      return;
    }
  }

  function showBubble(text, kind = 'idle') {
    const now = performance.now();
    const dur = clamp(cfg.bubbleDurationMs, 400, 10000);

    bubble = {
      text: String(text || '').trim(),
      kind,
      startedAt: now,
      endAt: now + dur,
    };

    // next bubble gate starts AFTER bubble ends
    const minGap = clamp(cfg.bubbleMinGapMs ?? 0, 0, 60000);
    const cd = clamp(cfg.bubbleCooldownMs ?? 0, 0, 60000);
    nextBubbleAllowedAt = bubble.endAt + Math.max(minGap, cd);
  }

  function attemptIdleBubble(dtSec) {
    if (!cfg.bubbleEnabled) return;

    const now = performance.now();
    if (bubble && now < bubble.endAt) return;
    if (now < nextBubbleAllowedAt) return;

    // If eventPriority is on and we’re within event cooldown, still allow idle bubbles (but don’t conflict with event).
    // This keeps behavior simple: idle bubbles only depend on bubble gate.
    const chancePerSec = clamp(cfg.idleChancePerSecond, 0, 1);
    const p = 1 - Math.pow(1 - chancePerSec, dtSec); // convert to per-frame probability
    if (Math.random() > p) return;

    // Choose phrase
    const rare = Math.random() < clamp(cfg.rareChance, 0, 1);
    const text = rare
      ? String(cfg.rarePhrase || 'DAWG OPEN YOUR EARS!').trim()
      : pickFromList(cfg.idlePhrases, 'Listen');

    if (!text) return;
    showBubble(text, 'idle');
  }

  function pickFromList(list, fallback) {
    const arr = Array.isArray(list) ? list.map(s => String(s || '').trim()).filter(Boolean) : [];
    if (!arr.length) return String(fallback || '').trim();
    return arr[(Math.random() * arr.length) | 0];
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeTotalAndH(latestSnap, cfg);
    hTarget = res.h;
    leaderRgb = res.leaderRgb;
  }

  function destroy() {
    try { unsubMeters?.(); } catch {}
    try { unsubEvent?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function onResize() {
    resizeCanvas(canvas);
  }

  window.addEventListener('resize', onResize, { passive: true });
  onResize();

  function drawFairy(w, h, nowSec) {
    // Scale sizes relative to viewport
    const minD = Math.min(w, h);
    const baseSize = clamp(cfg.baseSize, 8, 160) * (minD / 900);
    const size = baseSize * (1 + clamp(cfg.sizeGrowth, 0, 3) * hSmooth);

    const x = pos.x * w;
    const y = pos.y * h;

    // Color
    const r = leaderSmooth.r | 0;
    const g = leaderSmooth.g | 0;
    const b = leaderSmooth.b | 0;

    // Glow
    const glow = clamp(cfg.glowStrength, 0, 2) * (0.20 + 0.95 * hSmooth);
    const core = clamp01(cfg.coreBrightness);

    ctx.save();
    ctx.translate(x, y);

    // subtle bob/tilt
    const bob = Math.sin(nowSec * 2.3) * size * 0.08;
    const tilt = Math.sin(nowSec * 1.9) * 0.18;
    ctx.rotate(tilt);
    ctx.translate(0, bob);

    // Outer bloom
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
    ctx.shadowBlur = (18 + 80 * glow) * (0.5 + 0.9 * hSmooth);

    // Aura ring
    const aura = ctx.createRadialGradient(0, 0, size * 0.15, 0, 0, size * 1.45);
    aura.addColorStop(0, `rgba(${r},${g},${b},${0.28 * glow})`);
    aura.addColorStop(0.45, `rgba(${r},${g},${b},${0.14 * glow})`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Wings (two soft ellipses)
    ctx.shadowBlur = (10 + 45 * glow) * (0.5 + 0.8 * hSmooth);
    ctx.globalAlpha = clamp01(cfg.wingOpacity) * (0.65 + 0.35 * Math.sin(nowSec * 6.0) * 0.25 + 0.15);
    const wingA = ctx.createRadialGradient(-size * 0.55, 0, 0, -size * 0.55, 0, size * 0.95);
    wingA.addColorStop(0, `rgba(255,255,255,${0.40 * core})`);
    wingA.addColorStop(0.25, `rgba(${r},${g},${b},${0.22 * core})`);
    wingA.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wingA;
    ctx.beginPath();
    ctx.ellipse(-size * 0.55, 0, size * 0.85, size * 0.45, -0.35, 0, Math.PI * 2);
    ctx.fill();

    const wingB = ctx.createRadialGradient(size * 0.55, 0, 0, size * 0.55, 0, size * 0.95);
    wingB.addColorStop(0, `rgba(255,255,255,${0.40 * core})`);
    wingB.addColorStop(0.25, `rgba(${r},${g},${b},${0.22 * core})`);
    wingB.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wingB;
    ctx.beginPath();
    ctx.ellipse(size * 0.55, 0, size * 0.85, size * 0.45, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Core orb
    ctx.globalAlpha = 1;
    ctx.shadowBlur = (14 + 70 * glow) * (0.55 + 0.85 * hSmooth);

    const coreGrad = ctx.createRadialGradient(-size * 0.15, -size * 0.15, size * 0.1, 0, 0, size * 0.85);
    coreGrad.addColorStop(0, `rgba(255,255,255,${0.95 * core})`);
    coreGrad.addColorStop(0.35, `rgba(${r},${g},${b},${0.55 * core})`);
    coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Tiny sparkle dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,255,255,${0.65 + 0.35 * Math.sin(nowSec * 4.8)})`;
    ctx.beginPath();
    ctx.arc(-size * 0.15, -size * 0.18, Math.max(1.2, size * 0.08), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBubble(w, h, nowMs) {
    if (!cfg.bubbleEnabled) return;
    if (!bubble) return;

    const still = nowMs < bubble.endAt;
    if (!still) {
      bubble = null;
      return;
    }

    const text = bubble.text || '';
    if (!text) return;

    const nowSec = nowMs / 1000;
    const x = pos.x * w;
    const y = pos.y * h;

    // timing: quick pop + gentle fade
    const dur = Math.max(1, bubble.endAt - bubble.startedAt);
    const t = clamp01((nowMs - bubble.startedAt) / dur);
    const fadeIn = clamp01(t / 0.16);
    const fadeOut = clamp01((1 - t) / 0.18);
    const vis = Math.min(fadeIn, fadeOut);

    const scale = clamp(cfg.bubbleScale, 0.5, 2) * (0.92 + 0.08 * Math.sin(nowSec * 10.0));
    const pop = 0.88 + 0.12 * Math.sin(Math.min(1, t * 8) * Math.PI * 0.5);

    ctx.save();
    ctx.globalAlpha = vis;
    ctx.font = cfg.bubbleFont || meta.defaultConfig.bubbleFont;
    ctx.textBaseline = 'middle';

    const padX = 14 * scale;
    const padY = 10 * scale;
    const maxW = clamp(cfg.bubbleMaxWidth, 160, 900);

    // measure text and clamp width (simple wrap-once approach)
    let line = text;
    let metrics = ctx.measureText(line);
    let tw = metrics.width;
    if (tw > maxW) {
      // naive truncation with ellipsis for safety (prevents mega-text)
      while (line.length > 6 && ctx.measureText(line + '…').width > maxW) {
        line = line.slice(0, -1);
      }
      line = line + '…';
      tw = ctx.measureText(line).width;
    }

    const boxW = tw + padX * 2;
    const boxH = 38 * scale + padY; // single-line bubble
    const r = 14 * scale;

    // Position bubble slightly above/right of fairy, but keep onscreen
    let bx = x + 22 * scale;
    let by = y - 58 * scale;

    bx = clamp(bx, 10, w - boxW - 10);
    by = clamp(by, 10, h - boxH - 10);

    // Tail points toward fairy
    const tailX = clamp(x, bx + r, bx + boxW - r);
    const tailY = by + boxH;

    // Bubble
    ctx.save();
    ctx.translate(bx + boxW * 0.08, by + boxH * 0.08);
    ctx.scale(pop, pop);
    ctx.translate(-(bx + boxW * 0.08), -(by + boxH * 0.08));

    ctx.fillStyle = cfg.bubbleFill || meta.defaultConfig.bubbleFill;
    ctx.strokeStyle = cfg.bubbleStroke || meta.defaultConfig.bubbleStroke;
    ctx.lineWidth = Math.max(1, 1.5 * scale);

    roundRectPath(ctx, bx, by, boxW, boxH, r);
    ctx.fill();
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(tailX - 10 * scale, tailY - 2 * scale);
    ctx.lineTo(tailX + 2 * scale, tailY - 2 * scale);
    ctx.lineTo(x + 6 * scale, y - 6 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = cfg.bubbleTextColor || meta.defaultConfig.bubbleTextColor;
    ctx.fillText(line, bx + padX, by + boxH * 0.5);

    ctx.restore();
    ctx.restore();
  }

  function stepMotion(dt, w, h, nowSec) {
    // Update hype smoothing + leader color smoothing
    const smooth = 0.18;
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth);

    leaderSmooth.r = lerp(leaderSmooth.r, leaderRgb.r, 1 - Math.exp(-8 * dt));
    leaderSmooth.g = lerp(leaderSmooth.g, leaderRgb.g, 1 - Math.exp(-8 * dt));
    leaderSmooth.b = lerp(leaderSmooth.b, leaderRgb.b, 1 - Math.exp(-8 * dt));

    // Motion: a smooth “living” orbit + drift + slight jitter, affected by hype
    const minD = Math.min(w, h);
    const pad = clamp01(cfg.edgePadding) * minD;

    const speed = clamp(cfg.wanderSpeed, 0.1, 3.0) * (0.65 + 0.55 * hSmooth);
    const radius = clamp(cfg.pathRadius, 0.02, 0.6) * minD;

    // Target point: Lissajous-ish around a slowly moving center
    const t = (nowSec - t0) * speed;
    const cx = w * (0.5 + 0.12 * Math.sin(t * 0.22));
    const cy = h * (0.45 + 0.10 * Math.cos(t * 0.18));

    const tx = cx + radius * (0.85 * Math.sin(t * 0.9) + 0.15 * Math.sin(t * 2.2));
    const ty = cy + radius * (0.75 * Math.cos(t * 1.1) + 0.18 * Math.sin(t * 1.7));

    // Convert current normalized pos -> px
    let px = pos.x * w;
    let py = pos.y * h;

    // Steering
    const dx = tx - px;
    const dy = ty - py;

    const jitter = clamp01(cfg.jitter) * (0.25 + 0.55 * hSmooth);
    const jx = (Math.random() - 0.5) * radius * 0.02 * jitter;
    const jy = (Math.random() - 0.5) * radius * 0.02 * jitter;

    const accel = 6.0 * (0.75 + 0.6 * hSmooth);
    vel.x += (dx / Math.max(1, radius)) * accel * dt + jx * dt;
    vel.y += (dy / Math.max(1, radius)) * accel * dt + jy * dt;

    // damping
    const damp = Math.pow(0.06, dt);
    vel.x *= damp;
    vel.y *= damp;

    // integrate
    px += vel.x * minD * 0.25;
    py += vel.y * minD * 0.25;

    // clamp inside padded rect
    px = clamp(px, pad, w - pad);
    py = clamp(py, pad, h - pad);

    pos.x = px / w;
    pos.y = py / h;
  }

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const cap = clamp(cfg.fpsCap, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nowSec = nowMs / 1000;

    // update motion + try idle phrase
    stepMotion(dt, w, h, nowSec);
    attemptIdleBubble(dt);

    // draw
    ctx.clearRect(0, 0, w, h);
    drawFairy(w, h, nowSec);
    drawBubble(w, h, nowMs);
  }

  // Kick
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
