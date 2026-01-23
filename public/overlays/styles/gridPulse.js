// public/overlays/styles/gridPulse.js
// FREE Overlay: GridPulse (Equalizer Edition)
// Original concept: looks/acts like an audio equalizer—more hype => higher bars.
//
// What changed vs your draft:
// ✅ Bars actually have HEIGHT now (per-cell “column” heights) instead of just brightness.
// ✅ Works on edges OR bottom-only.
// ✅ Uses Crownfall-style hype mapping: total = sum(factions[].meter); h = 1 - exp(-total/k)
// ✅ Still keeps "event pop" (meter delta) to make spikes punchier.
// ✅ Defensive subscriptions: supports app.on('meters') and app.on('state') styles.
//
// Contract: export meta + init({ canvas, app, config }) -> { destroy, setConfig }

'use strict';

export const meta = {
  styleKey: 'gridPulse',
  name: 'Grid Pulse (FREE)',
  tier: 'FREE',
  description: 'An animated LED equalizer border—bars rise with hype and ripple around the frame. Clean, modern, OBS-friendly.',
  defaultConfig: {
    placement: 'edges',      // edges | bottom
    mixMode: 'weighted',     // weighted | winner
    intensity: 1.0,          // 0..2

    // Crownfall mapping + smoothing
    hypeK: 140,              // smaller = reacts sooner
    maxTotalClamp: 2400,     // safety clamp
    hypeSmoothing: 0.14,     // seconds-ish

    // Grid look
    cellSize: 16,            // px (bar column width)
    gap: 4,                  // px
    borderThickness: 90,     // px (max bar height / depth into frame)
    padding: 10,             // px inset from screen edge
    cornerRadius: 16,        // px (mask-ish)

    // Equalizer behavior
    barFall: 1.7,            // 0.2..5  (how fast bars drop)
    barRise: 7.0,            // 1..20   (how snappy bars rise)
    barSmoothing: 0.22,      // 0..0.8  (extra smoothing across columns)
    rippleSpeed: 0.9,        // 0.1..2  (wave travel speed)
    rippleWidth: 0.55,       // 0.1..1  (band width)

    shimmer: 0.35,           // 0..1 (micro flicker/sparkle)

    // Event response (meter delta driven)
    eventBoost: 1.0,         // 0..2

    // Visuals
    glow: 0.7,               // 0..1
    alpha: 0.92,             // 0..1
    backgroundDim: 0.0       // 0..0.35
  },
  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'bottom'], default: 'edges' },
    { key: 'mixMode', label: 'Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'range', min: 40, max: 500, step: 5, default: 140 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'range', min: 200, max: 6000, step: 50, default: 2400 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.14 },

    { key: 'cellSize', label: 'Bar Width (px)', type: 'range', min: 10, max: 40, step: 1, default: 16 },
    { key: 'gap', label: 'Gap', type: 'range', min: 1, max: 12, step: 1, default: 4 },
    { key: 'borderThickness', label: 'Max Bar Height (px)', type: 'range', min: 30, max: 180, step: 2, default: 90 },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 40, step: 1, default: 10 },
    { key: 'cornerRadius', label: 'Corner Radius', type: 'range', min: 0, max: 40, step: 1, default: 16 },

    { key: 'barRise', label: 'Bar Rise', type: 'range', min: 1, max: 20, step: 0.25, default: 7.0 },
    { key: 'barFall', label: 'Bar Fall', type: 'range', min: 0.2, max: 6, step: 0.05, default: 1.7 },
    { key: 'barSmoothing', label: 'Bar Smoothing', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.22 },

    { key: 'rippleSpeed', label: 'Ripple Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.9 },
    { key: 'rippleWidth', label: 'Ripple Width', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.55 },
    { key: 'shimmer', label: 'Shimmer', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'eventBoost', label: 'Event Boost', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },
    { key: 'alpha', label: 'Opacity', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.92 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.35, step: 0.01, default: 0.0 }
  ]
};

export function init({ canvas, app, config }) {
  const resolved = ensureCanvas(canvas, meta.styleKey);
  canvas = resolved.canvas;
  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = normalizeConfig({ ...meta.defaultConfig, ...(config || {}) });

  // incoming state
  let factions = [];
  let meters = [];

  // Crownfall hype mapping (target + smoothing)
  let total = 0;
  let hTarget = 0;
  let hype = 0;

  // Delta-driven "event pop"
  let lastMeterMap = new Map();
  let eventEnergy = 0;
  let eventVel = 0;

  // Equalizer bars: per “column along perimeter”
  let barVals = new Float32Array(0);  // current height 0..1
  let barPeaks = new Float32Array(0); // optional peak/hold (we keep light)
  let barCount = 0;

  // animation
  let raf = 0;
  let running = true;
  let last = performance.now();

  // Subscriptions (defensive)
  try {
    if (app && typeof app.on === 'function') {
      app.on('state', (s) => {
        const f = s?.factions || s?.state?.factions;
        const m = s?.meters || s?.state?.meters || s?.factionMeters || s?.state?.factionMeters;
        if (Array.isArray(f)) factions = f;
        if (Array.isArray(m)) ingestMeters(m, s);
      });

      app.on('meters', (m) => ingestMeters(m, null));

      app.on('factions', (f) => {
        if (Array.isArray(f)) factions = f;
      });
    }

    if (app && typeof app.getState === 'function') {
      const s = app.getState();
      const f = s?.factions || s?.state?.factions;
      const m = s?.meters || s?.state?.meters || s?.factionMeters || s?.state?.factionMeters;
      if (Array.isArray(f)) factions = f;
      if (Array.isArray(m)) ingestMeters(m, s);
    }
  } catch {}

  function ingestMeters(m, sMaybe) {
    meters = Array.isArray(m) ? m : [];

    // build meter map + total
    let sum = 0;
    const cur = new Map();

    for (const it of meters) {
      const id = it?.factionId ?? it?.id ?? it?.faction ?? null;
      const v = Math.max(0, num(it?.value, num(it?.hype, 0)));
      if (id != null) cur.set(id, v);
      sum += v;
    }

    // Crownfall: prefer explicit total if present, else sum
    let explicitTotal =
      num(sMaybe?.totalHype, null) ??
      num(sMaybe?.state?.totalHype, null) ??
      null;

    total = clamp(explicitTotal == null ? sum : explicitTotal, 0, cfg.maxTotalClamp);

    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));
    hTarget = clamp01(hTarget * clamp(cfg.intensity, 0, 2));

    // delta detection => "event"
    let delta = 0;
    for (const [id, v] of cur.entries()) {
      const prev = lastMeterMap.get(id) ?? 0;
      delta += Math.abs(v - prev);
    }
    for (const [id, prev] of lastMeterMap.entries()) {
      if (!cur.has(id)) delta += Math.abs(prev);
    }
    lastMeterMap = cur;

    const bump = clamp01(delta / 30) * clamp(cfg.eventBoost, 0, 2);
    eventVel += bump * 1.2;
  }

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const dpr = resizeCanvasToDisplaySize(canvas);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // smooth hype
    const smooth = clamp(cfg.hypeSmoothing, 0.05, 0.5);
    const a = 1 - Math.exp(-(1 / smooth) * dt);
    hype = clamp01(lerp(hype, hTarget, a));

    // decay event energy
    eventVel *= Math.pow(0.15, dt);
    eventEnergy = clamp01(eventEnergy * Math.pow(0.45, dt) + eventVel * 0.5);
    eventVel *= Math.pow(0.65, dt);

    // color
    const color = pickFactionColorCss({ factions, meters }, cfg.mixMode, cfg.alpha);

    // clear + background dim
    ctx.clearRect(0, 0, w, h);

    if (cfg.backgroundDim > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(cfg.backgroundDim, 0, 0.35);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // allocate bars based on current geometry
    ensureBarsForGeometry(w, h);

    // update bars
    updateBars(dt, now / 1000);

    // draw
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = color;
    ctx.shadowBlur =
      (10 + 40 * clamp01(cfg.glow)) *
      (0.45 + 0.9 * hype + 0.75 * eventEnergy);

    drawEqualizerBorder(ctx, w, h, now / 1000, color);

    ctx.restore();
  }

  raf = requestAnimationFrame(tick);

  function ensureBarsForGeometry(w, h) {
    const pad = clamp(cfg.padding, 0, 80);
    const cs = clamp(cfg.cellSize, 8, 60);
    const gap = clamp(cfg.gap, 1, 20);
    const step = cs + gap;

    const placement = cfg.placement === 'bottom' ? 'bottom' : 'edges';

    // estimate number of bar columns along drawn edges
    const innerLeft = pad;
    const innerTop = pad;
    const innerRight = w - pad;
    const innerBottom = h - pad;

    let n = 0;
    if (placement === 'bottom') {
      const len = Math.max(1, innerRight - innerLeft);
      n = Math.max(8, Math.floor(len / step));
    } else {
      const topLen = Math.max(1, innerRight - innerLeft);
      const sideLen = Math.max(1, innerBottom - innerTop);
      const topN = Math.max(4, Math.floor(topLen / step));
      const sideN = Math.max(4, Math.floor(sideLen / step));
      // perimeter columns (top + right + bottom + left)
      n = topN + sideN + topN + sideN;
      n = Math.max(32, n);
    }

    if (n !== barCount) {
      barCount = n;
      barVals = new Float32Array(barCount);
      barPeaks = new Float32Array(barCount);
      for (let i = 0; i < barCount; i++) {
        barVals[i] = 0;
        barPeaks[i] = 0;
      }
    }
  }

  function updateBars(dt, t) {
    // base target height from hype + event spikes
    const base = clamp01(0.10 + 0.86 * hype);
    const pop = clamp01(eventEnergy) * 0.35;
    const globalTarget = clamp01(base + pop);

    // ripple around frame (like an equalizer sweep)
    const speed = clamp(cfg.rippleSpeed, 0.05, 3);
    const width = clamp(cfg.rippleWidth, 0.05, 1);

    const rise = clamp(cfg.barRise, 1, 30);
    const fall = clamp(cfg.barFall, 0.1, 10);
    const smooth = clamp01(cfg.barSmoothing);

    // pre-pass: desired targets per bar
    // - travelling bright band makes some bars taller moment-to-moment
    // - shimmer adds small random motion so it feels alive
    for (let i = 0; i < barCount; i++) {
      const u = barCount <= 1 ? 0 : i / (barCount - 1);
      const phase = frac(u - t * speed * 0.22);
      const band = smoothPulse(phase, width); // 0..1

      const n = (hash01(i * 999 + (t * 60) | 0) - 0.5) * 2; // -1..1 pseudo noise
      const sh = clamp01(cfg.shimmer) * (0.25 + 0.75 * globalTarget);
      const flick = 0.06 * sh * n * (0.5 + 0.5 * Math.sin(t * 6.5 + i * 0.21));

      // equalizer target: global target + band emphasis + tiny flicker
      let target = globalTarget * (0.55 + 0.70 * band) + flick;
      target = clamp01(target);

      // smooth across neighbors (optional)
      if (smooth > 0.001 && barCount > 3) {
        const prev = barVals[(i - 1 + barCount) % barCount];
        const next = barVals[(i + 1) % barCount];
        target = lerp(target, (target + prev + next) / 3, smooth);
      }

      // attack/release
      const cur = barVals[i];
      const k = (target > cur) ? rise : fall;
      barVals[i] = lerp(cur, target, 1 - Math.exp(-k * dt));

      // peaks (very subtle)
      barPeaks[i] = Math.max(barPeaks[i] * Math.pow(0.55, dt), barVals[i]);
    }
  }

  function drawEqualizerBorder(ctx, w, h, t, color) {
    const pad = clamp(cfg.padding, 0, 80);
    const thick = clamp(cfg.borderThickness, 20, Math.min(w, h) / 2);
    const cs = clamp(cfg.cellSize, 8, 60);
    const gap = clamp(cfg.gap, 1, 20);
    const step = cs + gap;

    const r = clamp(cfg.cornerRadius, 0, 60);
    const placement = cfg.placement === 'bottom' ? 'bottom' : 'edges';

    ctx.fillStyle = color;

    function inRoundedRect(x, y) {
      if (r <= 0) return true;
      const left = pad, top = pad, right = w - pad, bottom = h - pad;
      if (x < left + r && y < top + r) return (sq(x - (left + r)) + sq(y - (top + r))) <= r * r;
      if (x > right - r && y < top + r) return (sq(x - (right - r)) + sq(y - (top + r))) <= r * r;
      if (x < left + r && y > bottom - r) return (sq(x - (left + r)) + sq(y - (bottom - r))) <= r * r;
      if (x > right - r && y > bottom - r) return (sq(x - (right - r)) + sq(y - (bottom - r))) <= r * r;
      return true;
    }

    // draw “columns” as stacked cells into the border thickness
    // barVals[i] 0..1 => number of layers
    const layersMax = Math.max(1, Math.floor(thick / step));

    const alphaBase = clamp01(cfg.alpha);
    const glow = clamp01(cfg.glow);

    function drawColumn(bx, by, dirX, dirY, i) {
      const height01 = clamp01(barVals[i]);
      const layers = Math.max(1, Math.round(height01 * layersMax));

      for (let d = 0; d < layers; d++) {
        const v = layersMax <= 1 ? 0 : d / (layersMax - 1);

        const x = bx + dirX * (d * step);
        const y = by + dirY * (d * step);

        if (!inRoundedRect(x, y)) continue;

        // alpha slightly higher at the outer edge + peak hint
        const peak = barPeaks[i];
        const peakBoost = 0.10 * peak;
        const depth = 1 - v * 0.95;

        const a = clamp01((0.22 + 0.78 * depth) * alphaBase + peakBoost);
        if (a <= 0.01) continue;

        ctx.globalAlpha = a;

        const size = cs * (0.94 + 0.06 * glow);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }

    const innerLeft = pad;
    const innerTop = pad;
    const innerRight = w - pad;
    const innerBottom = h - pad;

    if (placement === 'bottom') {
      const len = Math.max(1, innerRight - innerLeft);
      const count = Math.max(1, Math.floor(len / step));

      // map i across bars
      for (let j = 0; j < count; j++) {
        const u = count <= 1 ? 0 : j / (count - 1);
        const bx = innerLeft + u * (innerRight - innerLeft);
        const by = innerBottom;

        const i = Math.min(barCount - 1, Math.floor(u * (barCount - 1)));
        drawColumn(bx, by, 0, -1, i);
      }
    } else {
      // top edge
      {
        const len = Math.max(1, innerRight - innerLeft);
        const count = Math.max(1, Math.floor(len / step));
        for (let j = 0; j < count; j++) {
          const u = count <= 1 ? 0 : j / (count - 1);
          const bx = innerLeft + u * (innerRight - innerLeft);
          const by = innerTop;

          const i = Math.min(barCount - 1, Math.floor(u * (barCount - 1) * 0.25));
          drawColumn(bx, by, 0, 1, i);
        }
      }

      // right edge
      {
        const len = Math.max(1, innerBottom - innerTop);
        const count = Math.max(1, Math.floor(len / step));
        const base = Math.floor(barCount * 0.25);
        for (let j = 0; j < count; j++) {
          const u = count <= 1 ? 0 : j / (count - 1);
          const bx = innerRight;
          const by = innerTop + u * (innerBottom - innerTop);

          const i = Math.min(barCount - 1, base + Math.floor(u * (barCount - 1) * 0.25));
          drawColumn(bx, by, -1, 0, i);
        }
      }

      // bottom edge
      {
        const len = Math.max(1, innerRight - innerLeft);
        const count = Math.max(1, Math.floor(len / step));
        const base = Math.floor(barCount * 0.5);
        for (let j = 0; j < count; j++) {
          const u = count <= 1 ? 0 : j / (count - 1);
          const bx = innerRight - u * (innerRight - innerLeft);
          const by = innerBottom;

          const i = Math.min(barCount - 1, base + Math.floor(u * (barCount - 1) * 0.25));
          drawColumn(bx, by, 0, -1, i);
        }
      }

      // left edge
      {
        const len = Math.max(1, innerBottom - innerTop);
        const count = Math.max(1, Math.floor(len / step));
        const base = Math.floor(barCount * 0.75);
        for (let j = 0; j < count; j++) {
          const u = count <= 1 ? 0 : j / (count - 1);
          const bx = innerLeft;
          const by = innerBottom - u * (innerBottom - innerTop);

          const i = Math.min(barCount - 1, base + Math.floor(u * (barCount - 1) * 0.25));
          drawColumn(bx, by, 1, 0, i);
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  return {
    destroy() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (resolved.created && canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
    setConfig(next) {
      cfg = normalizeConfig({ ...cfg, ...(next || {}) });
      // keep internals sane
      total = clamp(total, 0, cfg.maxTotalClamp);
      const k = clamp(cfg.hypeK, 40, 600);
      hTarget = clamp01(1 - Math.exp(-total / k));
      hTarget = clamp01(hTarget * clamp(cfg.intensity, 0, 2));
    }
  };
}

/* ---------- Helpers ---------- */
function ensureCanvas(existing, styleKey) {
  if (existing && typeof existing.getContext === 'function') {
    styleCanvas(existing);
    return { canvas: existing, created: false };
  }
  const root = document.getElementById('overlayRoot') || document.body;
  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'gridPulse';
  styleCanvas(c);
  root.appendChild(c);
  return { canvas: c, created: true };
}

function styleCanvas(c) {
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
}

function resizeCanvasToDisplaySize(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
}

function pickFactionColorCss(state, mixMode, alpha) {
  const factions = Array.isArray(state?.factions) ? state.factions : [];
  const meters = Array.isArray(state?.meters) ? state.meters : [];

  if (!factions.length || !meters.length) return `rgba(120,200,255,${clamp01(alpha ?? 1)})`;

  const idToColor = new Map();
  for (const f of factions) {
    const id = f?.id ?? f?.key ?? null;
    const col = f?.colorHex || f?.color || '#78c8ff';
    if (id != null) idToColor.set(id, col);
  }

  let bestId = null;
  let bestV = -1;

  let sum = 0, r = 0, g = 0, b = 0;

  for (const m of meters) {
    const id = m?.factionId ?? m?.id ?? m?.faction ?? null;
    const v = Math.max(0, num(m?.value, num(m?.hype, 0)));
    if (id == null || v <= 0) continue;

    const rgb = hexToRgb(idToColor.get(id) || m?.color || '#78c8ff');

    if (v > bestV) { bestV = v; bestId = id; }

    r += rgb.r * v;
    g += rgb.g * v;
    b += rgb.b * v;
    sum += v;
  }

  if (mixMode === 'winner' && bestId != null) {
    const rgb = hexToRgb(idToColor.get(bestId) || '#78c8ff');
    return `rgba(${rgb.r|0},${rgb.g|0},${rgb.b|0},${clamp01(alpha ?? 1)})`;
  }

  if (sum <= 0) return `rgba(120,200,255,${clamp01(alpha ?? 1)})`;
  return `rgba(${(r/sum)|0},${(g/sum)|0},${(b/sum)|0},${clamp01(alpha ?? 1)})`;
}

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

function num(v, fallback) {
  const n = (typeof v === 'string') ? Number(v) : v;
  return (typeof n === 'number' && isFinite(n)) ? n : fallback;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function clamp01(x) { return clamp(x, 0, 1); }
function frac(x) { return x - Math.floor(x); }
function sq(x) { return x * x; }
function lerp(a, b, t) { return a + (b - a) * t; }

// Smooth pulse peaked near 0 (wraparound). width 0.1..1
function smoothPulse(phase, width) {
  let p = phase;
  if (p > 0.5) p -= 1;
  const w = clamp(width, 0.05, 1);
  const d = Math.abs(p) / (0.5 * w);
  const x = clamp01(1 - d);
  return x * x * (3 - 2 * x);
}

// fast deterministic-ish hash 0..1
function hash01(n) {
  let x = n | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10000) / 10000;
}

function normalizeConfig(c) {
  const out = { ...c };
  out.placement = out.placement === 'bottom' ? 'bottom' : 'edges';
  out.mixMode = out.mixMode === 'winner' ? 'winner' : 'weighted';
  out.intensity = clamp(num(out.intensity, 1.0), 0, 2);

  out.hypeK = clamp(num(out.hypeK, 140), 40, 600);
  out.maxTotalClamp = clamp(num(out.maxTotalClamp, 2400), 200, 6000);
  out.hypeSmoothing = clamp(num(out.hypeSmoothing, 0.14), 0.05, 0.5);

  out.cellSize = clamp(num(out.cellSize, 16), 8, 60);
  out.gap = clamp(num(out.gap, 4), 1, 20);
  out.borderThickness = clamp(num(out.borderThickness, 90), 20, 220);
  out.padding = clamp(num(out.padding, 10), 0, 80);
  out.cornerRadius = clamp(num(out.cornerRadius, 16), 0, 60);

  out.barFall = clamp(num(out.barFall, 1.7), 0.1, 10);
  out.barRise = clamp(num(out.barRise, 7.0), 1, 30);
  out.barSmoothing = clamp01(num(out.barSmoothing, 0.22));

  out.rippleSpeed = clamp(num(out.rippleSpeed, 0.9), 0.05, 3);
  out.rippleWidth = clamp(num(out.rippleWidth, 0.55), 0.05, 1);

  out.shimmer = clamp01(num(out.shimmer, 0.35));
  out.eventBoost = clamp(num(out.eventBoost, 1.0), 0, 2);

  out.glow = clamp01(num(out.glow, 0.7));
  out.alpha = clamp01(num(out.alpha, 0.92));
  out.backgroundDim = clamp(num(out.backgroundDim, 0.0), 0, 0.35);

  return out;
}
