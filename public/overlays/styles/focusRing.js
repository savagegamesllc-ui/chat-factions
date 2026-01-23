// public/overlays/styles/focusRing.js
// Focus Ring (FREE) — v2 (new contract + Crownfall-style hype)
// - Animated ring to highlight/encircle something (facecam/player icon).
// - Reacts to faction hype (color) and total hype (pulse/thickness/glow).
// - NEW CONTRACT: init({ root, config, api }) -> { destroy, setConfig }
// - Total hype: total = sum(snap.factions[].meter); h = 1 - exp(-total / k)
//
// NOTE: This replaces the old app/canvas defensive pattern.
// OverlayCore should pass a root element; we own it and clean up on destroy.

'use strict';

export const meta = {
  styleKey: 'focusRing',
  name: 'Focus Ring',
  tier: 'FREE',
  description:
    'Animated ring to highlight/encircle something (facecam/player icon). Reacts to faction hype (color) and total hype (pulse/thickness/glow).',
  defaultConfig: {
    // Presets (kept for UI consistency; focus ring doesn't draw a frame)
    placement: 'edges', // bottom|edges
    anchor: 'topRight', // topRight|topLeft|bottomLeft|bottomRight|centerBottom|center
    mixMode: 'weighted', // weighted|winner
    intensity: 1.0, // 0..2

    // NEW (matches Crownfall mapping)
    hypeK: 120,            // smaller = responds sooner
    maxTotalClamp: 2200,   // safety clamp for big totals
    hypeSmoothing: 0.18,   // seconds-ish

    // Center override (0..1 normalized). If null/blank, derived from anchor.
    centerX: null,
    centerY: null,

    radius: 150,
    thickness: 14,
    gapDegrees: 16,

    spin: 0.22,   // rev/s
    pulse: 0.35,  // 0..1
    wobble: 0.12, // 0..1

    glow: 0.68,
    alpha: 0.92,
    backgroundDim: 0.0,

    sparks: true,
    sparkRate: 18,  // per sec
    sparkSize: 2.2,
    sparkLife: 0.55,

    maxSparks: 600
  },
  controls: [
    {
      key: 'placement',
      label: 'Placement Preset',
      type: 'select',
      options: [
        { label: 'Edges', value: 'edges' },
        { label: 'Bottom', value: 'bottom' },
      ],
      default: 'edges',
    },
    {
      key: 'anchor',
      label: 'Anchor (Camera/Icon)',
      type: 'select',
      options: [
        { label: 'Top Right', value: 'topRight' },
        { label: 'Top Left', value: 'topLeft' },
        { label: 'Bottom Left', value: 'bottomLeft' },
        { label: 'Bottom Right', value: 'bottomRight' },
        { label: 'Center Bottom', value: 'centerBottom' },
        { label: 'Center', value: 'center' },
      ],
      default: 'topRight',
    },
    {
      key: 'mixMode',
      label: 'Faction Mix Mode',
      type: 'select',
      options: [
        { label: 'Weighted Mix', value: 'weighted' },
        { label: 'Winner Takes Color', value: 'winner' },
      ],
      default: 'weighted',
    },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 120 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'radius', label: 'Radius (px)', type: 'range', min: 40, max: 600, step: 1, default: 150 },
    { key: 'thickness', label: 'Thickness (px)', type: 'range', min: 2, max: 60, step: 1, default: 14 },
    { key: 'gapDegrees', label: 'Ring Gap (deg)', type: 'range', min: 0, max: 120, step: 1, default: 16 },

    { key: 'spin', label: 'Spin (rev/s)', type: 'range', min: -2, max: 2, step: 0.01, default: 0.22 },
    { key: 'pulse', label: 'Pulse Amount', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'wobble', label: 'Wobble', type: 'range', min: 0, max: 1, step: 0.01, default: 0.12 },

    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.68 },
    { key: 'alpha', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.01, default: 0.92 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.0 },

    { key: 'sparks', label: 'Sparks', type: 'checkbox', default: true },
    { key: 'sparkRate', label: 'Spark Rate', type: 'range', min: 0, max: 120, step: 1, default: 18 },
    { key: 'sparkSize', label: 'Spark Size', type: 'range', min: 1, max: 10, step: 0.1, default: 2.2 },
    { key: 'sparkLife', label: 'Spark Life (s)', type: 'range', min: 0.1, max: 2.0, step: 0.05, default: 0.55 },

    { key: 'centerX', label: 'Center X (0..1 or blank)', type: 'text', default: '' },
    { key: 'centerY', label: 'Center Y (0..1 or blank)', type: 'text', default: '' },
  ],
};

// -------- init (new contract) --------
export function init({ root, config, api }) {
  // mount: we own root
  while (root.firstChild) root.removeChild(root.firstChild);

  const { canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = normalizeConfig({ ...meta.defaultConfig, ...(config || {}) });

  // latest snapshot
  let latestSnap = { factions: [] };

  // hype mapping
  let total = 0;
  let hTarget = 0; // 0..1
  let hSmooth = 0;

  // sparks
  const sparks = [];
  let sparkCarry = 0;

  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;
  const startMs = lastMs;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    total = computeTotal(latestSnap, cfg.maxTotalClamp);
    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));
  });

  const onResize = () => resize();
  window.addEventListener('resize', onResize, { passive: true });

  function resize() {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function tick(nowMs) {
    raf = requestAnimationFrame(tick);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    // simple 60fps cap
    const frameEvery = 1000 / 60;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    const { w, h } = resize();
    const t = (nowMs - startMs) / 1000;

    // smooth hype
    const smooth = clamp(cfg.hypeSmoothing, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));

    ctx.clearRect(0, 0, w, h);

    const { cx, cy } = resolveCenter(w, h, cfg);
    const mixed = pickMixedColorFromSnap(latestSnap, cfg.mixMode);

    const intensity = clamp(cfg.intensity, 0, 2);
    const hype = hSmooth;
    const hypeBoost = 0.35 + hype * 0.85;

    const spinRad = t * cfg.spin * Math.PI * 2;

    const pulseAmt = clamp01(cfg.pulse) * intensity * hypeBoost;
    const wobbleAmt = clamp01(cfg.wobble) * intensity * hypeBoost;

    const pulse = 1 + Math.sin(t * (2.2 + hype * 5.0)) * 0.5 * pulseAmt;
    const thick = Math.max(1, cfg.thickness * pulse * (0.9 + hype * 0.6));

    const gap = degToRad(clamp(cfg.gapDegrees, 0, 180));
    const a0 = spinRad + gap * 0.5;
    const a1 = spinRad + (Math.PI * 2 - gap * 0.5);

    const r = Math.max(10, cfg.radius * (1 + Math.sin(t * 1.7) * 0.02 * wobbleAmt));

    // optional dim behind ring
    if (cfg.backgroundDim > 0.001) {
      ctx.save();
      ctx.globalAlpha = clamp(cfg.backgroundDim, 0, 0.6) * 0.9;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, r + thick * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const glow = clamp01(cfg.glow) * (0.6 + hype * 0.9) * intensity;

    // Glow pass
    if (glow > 0.001) {
      ctx.save();
      ctx.globalAlpha = clamp01(cfg.alpha) * 0.55;
      ctx.strokeStyle = mixed;
      ctx.lineCap = 'round';
      ctx.shadowColor = mixed;
      ctx.shadowBlur = 18 + 40 * glow;
      ctx.lineWidth = thick * (1.6 + 0.7 * glow);
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1, false);
      ctx.stroke();
      ctx.restore();
    }

    // Core ring
    ctx.save();
    ctx.globalAlpha = clamp01(cfg.alpha);
    ctx.strokeStyle = mixed;
    ctx.lineCap = 'round';
    ctx.shadowColor = mixed;
    ctx.shadowBlur = 2 + 10 * glow;
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1, false);
    ctx.stroke();
    ctx.restore();

    // Inner highlight
    ctx.save();
    ctx.globalAlpha = clamp01(cfg.alpha) * 0.35;
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, thick * 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, r - thick * 0.28, a0, a1, false);
    ctx.stroke();
    ctx.restore();

    if (cfg.sparks) {
      spawnAndUpdateSparks(dt, cx, cy, r, a0, a1, mixed, hype, intensity);
      drawSparks(ctx, cfg);
    } else {
      sparks.length = 0;
      sparkCarry = 0;
    }
  }

  resize();
  raf = requestAnimationFrame(tick);

  function setConfig(next) {
    cfg = normalizeConfig({ ...cfg, ...(next || {}) });

    // recompute targets immediately
    total = computeTotal(latestSnap, cfg.maxTotalClamp);
    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}

    sparks.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  // ---- Sparks helpers ----
  function spawnAndUpdateSparks(dt, cx, cy, r, a0, a1, color, hype, intensity) {
    const rate = Math.max(0, cfg.sparkRate) * (0.35 + hype * 1.25) * intensity;
    sparkCarry += rate * dt;

    const maxSpawn = 60;
    let n = Math.min(maxSpawn, Math.floor(sparkCarry));
    sparkCarry -= n;

    for (let i = 0; i < n; i++) {
      const ang = lerp(a0, a1, Math.random());
      const rr = r + (Math.random() * 2 - 1) * cfg.thickness * 0.25;

      const px = cx + Math.cos(ang) * rr;
      const py = cy + Math.sin(ang) * rr;

      const tang = ang + Math.PI / 2;
      const speed = (40 + Math.random() * 120) * (0.4 + hype * 1.1) * intensity;

      const vx = Math.cos(tang) * speed + Math.cos(ang) * (10 + Math.random() * 25);
      const vy = Math.sin(tang) * speed + Math.sin(ang) * (10 + Math.random() * 25);

      sparks.push({
        x: px,
        y: py,
        vx,
        vy,
        life: cfg.sparkLife * (0.7 + Math.random() * 0.6),
        age: 0,
        size: cfg.sparkSize * (0.7 + Math.random() * 0.8),
        color,
      });
    }

    const drag = 0.88;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) {
        sparks.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(drag, dt * 60);
      p.vy *= Math.pow(drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    const maxS = clampInt(cfg.maxSparks, 100, 2000);
    if (sparks.length > maxS) sparks.splice(0, sparks.length - maxS);
  }

  function drawSparks(ctx, cfg) {
    ctx.save();
    for (const p of sparks) {
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = clamp01(cfg.alpha) * (0.15 + 0.85 * k);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6 * k;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.6 + 0.8 * k)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { destroy, setConfig };
}

// ---------- mount + helpers ----------

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'focusRing';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w: w / dpr, h: h / dpr, dpr };
}

function normalizeConfig(c) {
  const out = { ...c };

  out.centerX = parseNullable01(out.centerX);
  out.centerY = parseNullable01(out.centerY);

  out.placement = out.placement === 'bottom' ? 'bottom' : 'edges';
  out.anchor = normalizeAnchor(out.anchor);
  out.mixMode = out.mixMode === 'winner' ? 'winner' : 'weighted';

  out.intensity = clamp(numberOr(out.intensity, 1.0), 0, 2);

  out.hypeK = clamp(numberOr(out.hypeK, 120), 40, 600);
  out.maxTotalClamp = clamp(numberOr(out.maxTotalClamp, 2200), 200, 6000);
  out.hypeSmoothing = clamp(numberOr(out.hypeSmoothing, 0.18), 0.05, 0.5);

  out.radius = numberOr(out.radius, 150);
  out.thickness = numberOr(out.thickness, 14);
  out.gapDegrees = numberOr(out.gapDegrees, 16);

  out.spin = numberOr(out.spin, 0.22);
  out.pulse = clamp01(numberOr(out.pulse, 0.35));
  out.wobble = clamp01(numberOr(out.wobble, 0.12));

  out.glow = clamp01(numberOr(out.glow, 0.68));
  out.alpha = clamp01(numberOr(out.alpha, 0.92));
  out.backgroundDim = clamp(numberOr(out.backgroundDim, 0.0), 0, 0.6);

  out.sparks = !!out.sparks;
  out.sparkRate = numberOr(out.sparkRate, 18);
  out.sparkSize = numberOr(out.sparkSize, 2.2);
  out.sparkLife = numberOr(out.sparkLife, 0.55);

  out.maxSparks = clampInt(numberOr(out.maxSparks, 600), 100, 2000);

  return out;
}

function resolveCenter(w, h, cfg) {
  let cxN = cfg.centerX;
  let cyN = cfg.centerY;

  if (cxN == null || cyN == null) {
    const preset = anchorToCenter(cfg.anchor, cfg.placement);
    cxN = cxN ?? preset.x;
    cyN = cyN ?? preset.y;
  }

  return { cx: cxN * w, cy: cyN * h };
}

function anchorToCenter(anchor, placement) {
  const bottomBias = placement === 'bottom' ? 0.08 : 0;
  switch (anchor) {
    case 'topLeft': return { x: 0.18, y: 0.22 + bottomBias };
    case 'bottomLeft': return { x: 0.18, y: 0.78 + bottomBias };
    case 'bottomRight': return { x: 0.82, y: 0.78 + bottomBias };
    case 'centerBottom': return { x: 0.5, y: 0.82 + bottomBias };
    case 'center': return { x: 0.5, y: 0.5 + bottomBias };
    case 'topRight':
    default: return { x: 0.82, y: 0.22 + bottomBias };
  }
}

function normalizeAnchor(a) {
  const v = typeof a === 'string' ? a : '';
  const ok = new Set(['topRight', 'topLeft', 'bottomLeft', 'bottomRight', 'centerBottom', 'center']);
  return ok.has(v) ? v : 'topRight';
}

// total = sum(factions[].meter), clamped
function computeTotal(snap, maxClamp) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let sum = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) sum += m;
  }
  return clamp(sum, 0, clamp(maxClamp, 200, 6000));
}

function pickMixedColorFromSnap(snap, mixMode) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  if (!factions.length) return '#ffffff';

  let best = null;
  let bestV = -Infinity;

  let r = 0, g = 0, b = 0, sum = 0;

  for (const f of factions) {
    const v = Math.max(0, Number(f?.meter) || 0);
    if (v <= 0) continue;

    const col = normalizeHex(f?.colorHex || f?.color || f?.hex || '#ffffff');
    const rgb = hexToRgb(col);

    if (v > bestV) { bestV = v; best = rgb; }

    r += rgb.r * v;
    g += rgb.g * v;
    b += rgb.b * v;
    sum += v;
  }

  if (mixMode === 'winner' && best) {
    return rgbToHex(best.r | 0, best.g | 0, best.b | 0);
  }

  if (sum <= 0) return '#ffffff';
  return rgbToHex(Math.round(r / sum), Math.round(g / sum), Math.round(b / sum));
}

function parseNullable01(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? clamp01(v) : null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) ? clamp01(n) : null;
  }
  return null;
}

function numberOr(v, fallback) {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && isFinite(n) ? n : fallback;
}

function clamp01(x) { return clamp(x, 0, 1); }
function clamp(x, a, b) {
  const n = numberOr(x, a);
  return Math.max(a, Math.min(b, n));
}
function clampInt(x, a, b) {
  const n = numberOr(x, a);
  return Math.max(a, Math.min(b, n | 0));
}
function degToRad(d) { return (d * Math.PI) / 180; }
function lerp(a, b, t) { return a + (b - a) * t; }

function normalizeHex(hex) {
  if (typeof hex !== 'string') return '#ffffff';
  let h = hex.trim();
  if (!h) return '#ffffff';
  if (h[0] !== '#') h = '#' + h;
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (h.length !== 7) return '#ffffff';
  return h.toLowerCase();
}
function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const s = clamp(Math.round(x), 0, 255).toString(16);
        return s.length === 1 ? '0' + s : s;
      })
      .join('')
  );
}
