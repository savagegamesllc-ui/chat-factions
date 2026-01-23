// public/overlays/styles/gridPulseBeatCorners.js
// FREE Overlay: GridPulse Beat Corners (Equalizer Corner Edition)
//
// Original intent: like GridPulse, but ONLY the corners (or optionally corners + a thin baseline)
// More hype => taller corner bars. Spikes => corner "thump".
// Corners can lock to winning faction color while the rest uses weighted mix (if enabled).
//
// Contract: export meta + init({ canvas, app, config }) -> { destroy, setConfig }

'use strict';

export const meta = {
  styleKey: 'gridPulseBeatCorners',
  name: 'GridPulse Beat Corners (FREE)',
  tier: 'FREE',
  description:
    'Corner-only equalizer zones that thump on hype spikes. Corners can lock to the winning faction color for big-game moments.',
  defaultConfig: {
    // Corners-only by default (this file’s purpose)
    mode: 'corners',          // corners | corners+baseline
    baselinePlacement: 'edges', // edges | bottom (only used if mode=corners+baseline)

    mixMode: 'weighted',      // weighted | winner (main / baseline)
    intensity: 1.0,           // 0..2

    // Crownfall mapping + smoothing
    hypeK: 140,               // smaller reacts sooner
    maxTotalClamp: 2400,      // safety
    hypeSmoothing: 0.14,      // seconds-ish

    // Grid look
    cellSize: 16,             // px
    gap: 4,                   // px
    cornerRadius: 16,         // px (soft mask)

    // Corner zones
    cornerBeatSize: 150,      // px square zone size per corner
    cornerDepth: 96,          // px max bar depth (height) inside the corner zone
    cornerBeatStrength: 1.25, // 0..2 (extra thump in corners)
    cornerColorMode: 'winner',// winner | match (match = same as main color)
    cornerPulseSpeed: 1.25,   // 0.1..3
    cornerPulseWidth: 0.7,    // 0.1..1

    // Equalizer behavior
    barRise: 8.0,             // rise speed
    barFall: 2.0,             // fall speed
    barSmoothing: 0.22,       // 0..0.8 (neighbor smoothing within each corner)

    shimmer: 0.35,            // 0..1

    // Event response (meter delta driven)
    eventBoost: 1.0,          // 0..2

    // Visuals
    glow: 0.7,                // 0..1
    alpha: 0.92,              // 0..1
    backgroundDim: 0.0        // 0..0.35
  },
  controls: [
    { key: 'mode', label: 'Mode', type: 'select', options: ['corners', 'corners+baseline'], default: 'corners' },
    { key: 'baselinePlacement', label: 'Baseline Placement', type: 'select', options: ['edges', 'bottom'], default: 'edges' },

    { key: 'mixMode', label: 'Main Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'range', min: 40, max: 500, step: 5, default: 140 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'range', min: 200, max: 6000, step: 50, default: 2400 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.14 },

    { key: 'cellSize', label: 'Cell Size', type: 'range', min: 10, max: 40, step: 1, default: 16 },
    { key: 'gap', label: 'Gap', type: 'range', min: 1, max: 12, step: 1, default: 4 },
    { key: 'cornerRadius', label: 'Corner Radius', type: 'range', min: 0, max: 40, step: 1, default: 16 },

    { key: 'cornerBeatSize', label: 'Corner Zone Size', type: 'range', min: 60, max: 240, step: 2, default: 150 },
    { key: 'cornerDepth', label: 'Max Corner Bar Depth', type: 'range', min: 30, max: 220, step: 2, default: 96 },
    { key: 'cornerBeatStrength', label: 'Corner Beat Strength', type: 'range', min: 0, max: 2, step: 0.05, default: 1.25 },
    { key: 'cornerColorMode', label: 'Corner Color Mode', type: 'select', options: ['winner', 'match'], default: 'winner' },
    { key: 'cornerPulseSpeed', label: 'Corner Pulse Speed', type: 'range', min: 0.1, max: 3, step: 0.05, default: 1.25 },
    { key: 'cornerPulseWidth', label: 'Corner Pulse Width', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.7 },

    { key: 'barRise', label: 'Bar Rise', type: 'range', min: 1, max: 20, step: 0.25, default: 8.0 },
    { key: 'barFall', label: 'Bar Fall', type: 'range', min: 0.2, max: 6, step: 0.05, default: 2.0 },
    { key: 'barSmoothing', label: 'Bar Smoothing', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.22 },
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

  let factions = [];
  let meters = [];

  // Hype mapping + smoothing
  let total = 0;
  let hTarget = 0;
  let hype = 0;

  // Meter delta => event bump
  let lastMeterMap = new Map();
  let eventEnergy = 0;
  let eventVel = 0;

  // Corner bars (each corner gets its own strip of columns)
  let cornerBars = {
    tl: new Float32Array(0),
    tr: new Float32Array(0),
    br: new Float32Array(0),
    bl: new Float32Array(0),
    n: 0
  };

  let raf = 0;
  let running = true;
  let last = performance.now();

  // subscriptions (defensive)
  try {
    if (app && typeof app.on === 'function') {
      app.on('state', (s) => {
        const f = s?.factions || s?.state?.factions;
        const m = s?.meters || s?.state?.meters || s?.factionMeters || s?.state?.factionMeters;
        if (Array.isArray(f)) factions = f;
        if (Array.isArray(m)) ingestMeters(m, s);
      });
      app.on('meters', (m) => ingestMeters(m, null));
      app.on('factions', (f) => { if (Array.isArray(f)) factions = f; });
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

    let sum = 0;
    const cur = new Map();

    for (const it of meters) {
      const id = it?.factionId ?? it?.id ?? it?.faction ?? null;
      const v = Math.max(0, num(it?.value, num(it?.hype, 0)));
      if (id !=null) cur.set(id, v);
      sum += v;
    }

    // prefer explicit totalHype if present
    let explicitTotal =
      num(sMaybe?.totalHype, null) ??
      num(sMaybe?.state?.totalHype, null) ??
      null;

    total = clamp(explicitTotal == null ? sum : explicitTotal, 0, cfg.maxTotalClamp);

    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));
    hTarget = clamp01(hTarget * clamp(cfg.intensity, 0, 2));

    // delta => event bump
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

    // event decay
    eventVel *= Math.pow(0.15, dt);
    eventEnergy = clamp01(eventEnergy * Math.pow(0.45, dt) + eventVel * 0.5);
    eventVel *= Math.pow(0.65, dt);

    // colors
    const mainColor = pickFactionColorCss({ factions, meters }, cfg.mixMode, cfg.alpha);
    const winnerColor = pickFactionColorCss({ factions, meters }, 'winner', cfg.alpha);
    const cornerColor = (cfg.cornerColorMode === 'winner') ? winnerColor : mainColor;

    ctx.clearRect(0, 0, w, h);

    if (cfg.backgroundDim > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(cfg.backgroundDim, 0, 0.35);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // set corner bar count for current geometry
    ensureCornerBars(w, h);

    // update bars in each corner strip
    updateCornerBars(dt, now / 1000);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const glowBase = (10 + 40 * clamp01(cfg.glow));
    ctx.shadowBlur = glowBase * (0.55 + 0.85 * hype + 0.85 * eventEnergy);

    // Optional: thin baseline using mainColor (keeps “frame” presence if you want it)
    if (cfg.mode === 'corners+baseline') {
      ctx.shadowColor = mainColor;
      drawBaseline(ctx, w, h, now / 1000, mainColor);
    }

    // Corner zones (stronger beat)
    ctx.shadowColor = cornerColor;
    drawCornerZones(ctx, w, h, now / 1000, cornerColor);

    ctx.restore();
  }

  raf = requestAnimationFrame(tick);

  function ensureCornerBars(w, h) {
    const cs = clamp(cfg.cellSize, 8, 60);
    const gap = clamp(cfg.gap, 1, 20);
    const step = cs + gap;

    const size = clamp(cfg.cornerBeatSize, 60, Math.min(w, h) / 2);
    const cols = Math.max(4, Math.floor(size / step));

    if (cols !== cornerBars.n) {
      cornerBars.n = cols;
      cornerBars.tl = new Float32Array(cols);
      cornerBars.tr = new Float32Array(cols);
      cornerBars.br = new Float32Array(cols);
      cornerBars.bl = new Float32Array(cols);
    }
  }

  function updateCornerBars(dt, t) {
    const n = cornerBars.n;
    if (n <= 0) return;

    const rise = clamp(cfg.barRise, 1, 30);
    const fall = clamp(cfg.barFall, 0.1, 10);
    const neighbor = clamp01(cfg.barSmoothing);

    const strength = clamp(cfg.cornerBeatStrength, 0, 2);

    // corner beat intensity (thump): hype + event spikes
    const beat = clamp01((0.20 + 0.80 * hype + 1.05 * eventEnergy) * strength);

    // independent corner pulse wave
    const speed = clamp(cfg.cornerPulseSpeed, 0.05, 4);
    const width = clamp(cfg.cornerPulseWidth, 0.05, 1);

    // update one strip array
    function stepStrip(arr, seedBase) {
      for (let i = 0; i < n; i++) {
        const u = (n <= 1) ? 0 : i / (n - 1);

        // diagonal-ish travel (looks like the corner is “breathing” outward)
        const phase = frac(u - t * speed * 0.28);
        const band = smoothPulse(phase, width); // 0..1

        const nse = (hash01(seedBase + i * 911 + ((t * 60) | 0)) - 0.5) * 2;
        const sh = clamp01(cfg.shimmer) * (0.25 + 0.75 * beat);
        const flick = 0.05 * sh * nse;

        // target height 0..1
        let target = clamp01(beat * (0.55 + 0.75 * band) + flick);

        // neighbor smoothing uses current values (stable + cheap)
        if (neighbor > 0.001 && n > 3) {
          const prev = arr[(i - 1 + n) % n];
          const next = arr[(i + 1) % n];
          target = lerp(target, (target + prev + next) / 3, neighbor);
        }

        const cur = arr[i];
        const k = (target > cur) ? rise : fall;
        arr[i] = lerp(cur, target, 1 - Math.exp(-k * dt));
      }
    }

    stepStrip(cornerBars.tl, 1001);
    stepStrip(cornerBars.tr, 2002);
    stepStrip(cornerBars.br, 3003);
    stepStrip(cornerBars.bl, 4004);
  }

  // Draw only a thin baseline (optional)
  function drawBaseline(ctx, w, h, t, color) {
    const placement = cfg.baselinePlacement === 'bottom' ? 'bottom' : 'edges';

    // Keep baseline subtle: reuse grid, but low max depth
    const save = { ...cfg };
    const depth = Math.min(48, clamp(cfg.cornerDepth, 30, 220));
    const thickness = Math.max(24, Math.min(56, depth * 0.55));

    // temporarily treat as borderThickness for a lightweight frame
    const oldCornerDepth = cfg.cornerDepth;
    cfg.cornerDepth = thickness;

    drawGridFrameLight(ctx, w, h, t, color, placement);

    cfg.cornerDepth = oldCornerDepth;
  }

  function drawGridFrameLight(ctx, w, h, t, color, placement) {
    const pad = clamp(cfg.cornerRadius > 0 ? 10 : 8, 0, 80); // tiny inset baseline
    const cs = clamp(cfg.cellSize, 8, 60);
    const gap = clamp(cfg.gap, 1, 20);
    const step = cs + gap;

    const thick = clamp(cfg.cornerDepth, 18, 80);
    const layersMax = Math.max(1, Math.floor(thick / step));

    ctx.fillStyle = color;

    const innerLeft = pad;
    const innerTop = pad;
    const innerRight = w - pad;
    const innerBottom = h - pad;

    function drawEdge(x0, y0, x1, y1, dirX, dirY) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const count = Math.max(2, Math.floor(len / step));
      for (let j = 0; j < count; j++) {
        const u = j / Math.max(1, count - 1);
        const bx = x0 + (x1 - x0) * u;
        const by = y0 + (y1 - y0) * u;

        // baseline uses hype for some mild breathing
        const base = clamp01(0.12 + 0.45 * hype);
        const phase = frac(u - t * 0.35);
        const band = smoothPulse(phase, 0.45);
        const target = clamp01(base * (0.55 + 0.55 * band));

        const layers = Math.max(1, Math.round(target * layersMax));
        for (let d = 0; d < layers; d++) {
          const v = layersMax <= 1 ? 0 : d / (layersMax - 1);
          const x = bx + dirX * (d * step);
          const y = by + dirY * (d * step);
          const a = clamp01(cfg.alpha * (0.35 + 0.65 * (1 - v)));
          ctx.globalAlpha = a;
          const s = cs * 0.9;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
    }

    if (placement === 'bottom') {
      drawEdge(innerLeft, innerBottom, innerRight, innerBottom, 0, -1);
    } else {
      drawEdge(innerLeft, innerTop, innerRight, innerTop, 0, 1);
      drawEdge(innerRight, innerTop, innerRight, innerBottom, -1, 0);
      drawEdge(innerRight, innerBottom, innerLeft, innerBottom, 0, -1);
      drawEdge(innerLeft, innerBottom, innerLeft, innerTop, 1, 0);
    }

    ctx.globalAlpha = 1;
  }

  function drawCornerZones(ctx, w, h, t, color) {
    const pad = clamp(cfg.padding, 0, 80);
    const size = clamp(cfg.cornerBeatSize, 60, Math.min(w, h) / 2);
    const depthPx = clamp(cfg.cornerDepth, 30, Math.min(240, size));

    const cs = clamp(cfg.cellSize, 8, 60);
    const gap = clamp(cfg.gap, 1, 20);
    const step = cs + gap;

    const cols = cornerBars.n;
    if (cols <= 0) return;

    const layersMax = Math.max(1, Math.floor(depthPx / step));

    // Rounded mask-ish (optional)
    const r = clamp(cfg.cornerRadius, 0, 60);
    function inRoundedRect(x, y) {
      if (r <= 0) return true;
      const left = pad, top = pad, right = w - pad, bottom = h - pad;
      if (x < left + r && y < top + r) return (sq(x - (left + r)) + sq(y - (top + r))) <= r * r;
      if (x > right - r && y < top + r) return (sq(x - (right - r)) + sq(y - (top + r))) <= r * r;
      if (x < left + r && y > bottom - r) return (sq(x - (left + r)) + sq(y - (bottom - r))) <= r * r;
      if (x > right - r && y > bottom - r) return (sq(x - (right - r)) + sq(y - (bottom - r))) <= r * r;
      return true;
    }

    ctx.fillStyle = color;

    // helper: draw one corner with its strip array
    function drawCornerStrip(x0, y0, dirX, dirY, strip) {
      // x0,y0 is the corner “origin” along the frame
      // We draw columns along two axes (like an L): horizontal run + vertical run
      // For a “corner-only” feel: we place columns along the edge line and push “inward”.

      // horizontal run (along x), bars push inward in y
      for (let i = 0; i < cols; i++) {
        const u = cols <= 1 ? 0 : i / (cols - 1);
        const bx = x0 + dirX * (u * (size - step));
        const by = y0;

        const height01 = clamp01(strip[i]);
        const layers = Math.max(1, Math.round(height01 * layersMax));

        for (let d = 0; d < layers; d++) {
          const v = layersMax <= 1 ? 0 : d / (layersMax - 1);
          const x = bx;
          const y = by + dirY * (d * step);

          if (!inRoundedRect(x, y)) continue;

          const depth = 1 - v * 0.95;
          const a = clamp01(cfg.alpha * (0.18 + 0.82 * depth));
          if (a <= 0.01) continue;

          ctx.globalAlpha = a;

          const jitter = clamp01(cfg.shimmer) * 0.10 * Math.sin(t * 9 + (i * 131 + d * 17));
          const s = cs * (0.92 + 0.10 * height01 + jitter);
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }

      // vertical run (along y), bars push inward in x
      for (let i = 0; i < cols; i++) {
        const u = cols <= 1 ? 0 : i / (cols - 1);
        const bx = x0;
        const by = y0 + dirY * (u * (size - step));

        // mirror index so motion feels like it wraps around the corner
        const idx = cols - 1 - i;
        const height01 = clamp01(strip[idx]);
        const layers = Math.max(1, Math.round(height01 * layersMax));

        for (let d = 0; d < layers; d++) {
          const v = layersMax <= 1 ? 0 : d / (layersMax - 1);
          const x = bx + dirX * (d * step);
          const y = by;

          if (!inRoundedRect(x, y)) continue;

          const depth = 1 - v * 0.95;
          const a = clamp01(cfg.alpha * (0.18 + 0.82 * depth));
          if (a <= 0.01) continue;

          ctx.globalAlpha = a;

          const jitter = clamp01(cfg.shimmer) * 0.10 * Math.sin(t * 9 + (i * 137 + d * 23));
          const s = cs * (0.92 + 0.10 * height01 + jitter);
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
    }

    // positions: start slightly inside padding
    const inset = pad + cs;
    const left = inset;
    const right = w - inset;
    const top = inset;
    const bottom = h - inset;

    // TL: push inward (+x, +y)
    drawCornerStrip(left, top, +1, +1, cornerBars.tl);
    // TR: push inward (-x, +y)
    drawCornerStrip(right, top, -1, +1, cornerBars.tr);
    // BR: push inward (-x, -y)
    drawCornerStrip(right, bottom, -1, -1, cornerBars.br);
    // BL: push inward (+x, -y)
    drawCornerStrip(left, bottom, +1, -1, cornerBars.bl);

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
  c.dataset.style = styleKey || 'gridPulseBeatCorners';
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

  const a = clamp01(alpha ?? 1);
  if (!factions.length || !meters.length) return `rgba(120,200,255,${a})`;

  const idToColor = new Map();
  for (const f of factions) {
    const id = f?.id ?? f?.key ?? null;
    if (id == null) continue;
    idToColor.set(id, f?.colorHex || f?.color || '#78c8ff');
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
    return `rgba(${rgb.r|0},${rgb.g|0},${rgb.b|0},${a})`;
  }

  if (sum <= 0) return `rgba(120,200,255,${a})`;
  return `rgba(${(r/sum)|0},${(g/sum)|0},${(b/sum)|0},${a})`;
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
function lerp(a, b, t) { return a + (b - a) * t; }
function sq(x) { return x * x; }

function smoothPulse(phase, width) {
  let p = phase;
  if (p > 0.5) p -= 1;
  const w = clamp(width, 0.05, 1);
  const d = Math.abs(p) / (0.5 * w);
  const x = clamp01(1 - d);
  return x * x * (3 - 2 * x);
}

function hash01(n) {
  let x = n | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10000) / 10000;
}

function normalizeConfig(c) {
  const out = { ...c };
  out.mode = (out.mode === 'corners+baseline') ? 'corners+baseline' : 'corners';
  out.baselinePlacement = (out.baselinePlacement === 'bottom') ? 'bottom' : 'edges';

  out.mixMode = (out.mixMode === 'winner') ? 'winner' : 'weighted';
  out.cornerColorMode = (out.cornerColorMode === 'match') ? 'match' : 'winner';

  out.intensity = clamp(num(out.intensity, 1.0), 0, 2);

  out.hypeK = clamp(num(out.hypeK, 140), 40, 600);
  out.maxTotalClamp = clamp(num(out.maxTotalClamp, 2400), 200, 6000);
  out.hypeSmoothing = clamp(num(out.hypeSmoothing, 0.14), 0.05, 0.5);

  out.cellSize = clamp(num(out.cellSize, 16), 8, 60);
  out.gap = clamp(num(out.gap, 4), 1, 20);
  out.cornerRadius = clamp(num(out.cornerRadius, 16), 0, 60);

  out.cornerBeatSize = clamp(num(out.cornerBeatSize, 150), 60, 300);
  out.cornerDepth = clamp(num(out.cornerDepth, 96), 30, 260);
  out.cornerBeatStrength = clamp(num(out.cornerBeatStrength, 1.25), 0, 2);

  out.cornerPulseSpeed = clamp(num(out.cornerPulseSpeed, 1.25), 0.05, 4);
  out.cornerPulseWidth = clamp(num(out.cornerPulseWidth, 0.7), 0.05, 1);

  out.barRise = clamp(num(out.barRise, 8.0), 1, 30);
  out.barFall = clamp(num(out.barFall, 2.0), 0.1, 10);
  out.barSmoothing = clamp01(num(out.barSmoothing, 0.22));

  out.shimmer = clamp01(num(out.shimmer, 0.35));
  out.eventBoost = clamp(num(out.eventBoost, 1.0), 0, 2);

  out.glow = clamp01(num(out.glow, 0.7));
  out.alpha = clamp01(num(out.alpha, 0.92));
  out.backgroundDim = clamp(num(out.backgroundDim, 0.0), 0, 0.35);

  return out;
}
