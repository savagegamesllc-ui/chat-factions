// public/overlays/styles/prismBloom.js
// PRO Overlay: PrismBloom
// Full-screen prismatic rainbow bloom that intensifies with hype.
// - Uses downsampled offscreen render for performance
// - placement: edges|bottom (controls where bloom is strongest; full-screen still)
// - mixMode: weighted|winner (used as a "bias tint" rather than replacing rainbow)
// - intensity: 0..2
//
// ✅ Hype driver included:
//   - totalHype: 0..1 (soft-normalized from meter sums)
//   - eventEnergy: 0..1 (short-lived spikes from meter deltas)
//   - flash: 0..1 (brief flash on spikes)
// Contract: export meta + init({ canvas, app, config })

'use strict';

export const meta = {
  styleKey: 'prismBloom',
  name: 'PrismBloom (PRO)',
  tier: 'PRO',
  description: 'A full-screen rainbow aurora that blooms and brightens as hype rises. Subtle at idle, spectacular at peak moments.',
  defaultConfig: {
    placement: 'edges',         // edges | bottom (where bloom is strongest)
    mixMode: 'weighted',        // weighted | winner (bias tint source)
    intensity: 1.0,             // 0..2

    // Performance / resolution
    renderScale: 0.33,          // 0.2..0.75 (offscreen scale; lower = faster)
    fpsCap: 60,                 // 15..60 (cap draw rate)

    // Bloom / field
    baseOpacity: 0.08,          // 0..0.4 subtle at idle
    hypeOpacityBoost: 0.55,     // 0..1 additional opacity at high hype
    bloomStrength: 0.75,        // 0..1 glow-like amplification
    fieldComplexity: 0.75,      // 0..1 more warping/noise (slightly more cost)
    flowSpeed: 0.85,            // 0.1..2 animation speed

    // Rainbow characteristics
    rainbowSpeed: 0.9,          // 0.1..2 hue travel speed
    rainbowScale: 1.0,          // 0.4..2 size of color bands
    saturation: 0.95,           // 0..1
    contrast: 1.05,             // 0.6..1.6
    vignette: 0.35,             // 0..0.8 darken edges slightly (helps readability)

    // "Big moment" response (delta-driven)
    eventBoost: 1.0,            // 0..2 spikes add extra pop
    flashStrength: 0.65,        // 0..1 brief flash on spikes

    // Faction bias tinting
    biasStrength: 0.25,         // 0..0.75 how much faction color biases the rainbow

    // Global
    backgroundDim: 0.0          // 0..0.25 optional dim behind bloom
  },
  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'bottom'], default: 'edges' },
    { key: 'mixMode', label: 'Bias Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'renderScale', label: 'Render Scale', type: 'range', min: 0.2, max: 0.75, step: 0.01, default: 0.33 },
    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },

    { key: 'baseOpacity', label: 'Base Opacity', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.08 },
    { key: 'hypeOpacityBoost', label: 'Hype Opacity Boost', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'bloomStrength', label: 'Bloom Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },
    { key: 'fieldComplexity', label: 'Field Complexity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },
    { key: 'flowSpeed', label: 'Flow Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.85 },

    { key: 'rainbowSpeed', label: 'Rainbow Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.9 },
    { key: 'rainbowScale', label: 'Rainbow Scale', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1.0 },
    { key: 'saturation', label: 'Saturation', type: 'range', min: 0, max: 1, step: 0.01, default: 0.95 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.6, max: 1.6, step: 0.01, default: 1.05 },
    { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.35 },

    { key: 'eventBoost', label: 'Event Boost', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'flashStrength', label: 'Flash Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },

    { key: 'biasStrength', label: 'Faction Bias Strength', type: 'range', min: 0, max: 0.75, step: 0.01, default: 0.25 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.0 }
  ]
};

export function init({ canvas, app, config }) {
  const resolved = ensureCanvas(canvas, meta.styleKey);
  canvas = resolved.canvas;
  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Offscreen canvas for fast pixel work
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { willReadFrequently: false });

  // App state (needed for faction bias tint)
  let factions = [];
  let meters = [];

  // ✅ Hype driver state
  let totalHype = 0;      // 0..1
  let lastMeterMap = new Map();
  let eventVel = 0;       // internal
  let eventEnergy = 0;    // 0..1
  let flash = 0;          // 0..1

  // Loop timing
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  // Subscribe defensive
  try {
    if (app && typeof app.on === 'function') {
      app.on('state', (s) => {
        if (s?.factions) factions = s.factions;
        if (s?.meters) ingestMeters(s.meters);
      });
      app.on('meters', (m) => ingestMeters(m));
      app.on('factions', (f) => { factions = Array.isArray(f) ? f : factions; });
    }
    if (app && typeof app.getState === 'function') {
      const s = app.getState();
      if (s?.factions) factions = s.factions;
      if (s?.meters) ingestMeters(s.meters);
    }
  } catch {}

  // ✅ Ingest meters -> update:
  // - meters array (for bias tint)
  // - totalHype (0..1)
  // - eventVel bump (spike detector)
  function ingestMeters(m) {
    meters = Array.isArray(m) ? m : [];

    let sum = 0;
    const cur = new Map();

    for (const it of meters) {
      const id = it?.factionId ?? it?.id ?? it?.faction ?? null;
      const v = Math.max(0, num(it?.value, num(it?.hype, 0)));
      if (id != null) cur.set(id, v);
      sum += v;
    }

    // total hype 0..1 soft normalize, then intensity scaling
    const base = clamp01(1 - Math.exp(-sum / 180));              // <- tune divisor if needed
    totalHype = clamp01(base * clamp(cfg.intensity, 0, 2));

    // delta => event bump (short-lived)
    let delta = 0;
    for (const [id, v] of cur.entries()) {
      const prev = lastMeterMap.get(id) ?? 0;
      delta += Math.abs(v - prev);
    }
    for (const [id, prev] of lastMeterMap.entries()) {
      if (!cur.has(id)) delta += Math.abs(prev);
    }
    lastMeterMap = cur;

    const bump = clamp01(delta / 28) * clamp(cfg.eventBoost, 0, 2); // <- tune divisor if needed
    eventVel += bump * 1.25;
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.floor(rect.width * dpr));
    const H = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // offscreen at scaled resolution
    const scale = clamp(cfg.renderScale, 0.2, 0.75);
    const ow = Math.max(2, Math.floor((W / dpr) * scale));
    const oh = Math.max(2, Math.floor((H / dpr) * scale));
    if (off.width !== ow || off.height !== oh) {
      off.width = ow;
      off.height = oh;
    }
    return { dpr, w: W / dpr, h: H / dpr, ow, oh };
  }

  function getBiasRgb() {
    // Bias color from factions/meters; used to tint rainbow slightly
    const rgba = pickFactionColorCss({ factions, meters }, cfg.mixMode, 1.0);
    const rgb = rgbaToRgb(rgba);
    return rgb || { r: 140, g: 210, b: 255 };
  }

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    // FPS cap
    const cap = clamp(cfg.fpsCap, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;
    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // ✅ decay spikes (this is what makes “events” feel punchy)
    eventVel *= Math.pow(0.12, dt);
    eventEnergy = clamp01(eventEnergy * Math.pow(0.40, dt) + eventVel * 0.60);
    eventVel *= Math.pow(0.65, dt);

    // ✅ flash is derived from eventEnergy (brief bright pop)
    const flashStrength = clamp01(cfg.flashStrength);
    flash = clamp01(flash * Math.pow(0.10, dt) + eventEnergy * flashStrength * 0.55);

    const { w, h, ow, oh } = resize();

    // background dim
    ctx.clearRect(0, 0, w, h);
    if (cfg.backgroundDim > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(cfg.backgroundDim, 0, 0.25);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Render prismatic field to offscreen pixels
    const t = nowMs / 1000;
    renderField(offCtx, ow, oh, t, dt, getBiasRgb());

    // Composite upscaled + bloom-ish glow by drawing twice with additive blend
    const baseOp = clamp(cfg.baseOpacity, 0, 0.6);
    const boostOp = clamp(cfg.hypeOpacityBoost, 0, 1.2);

    // ✅ opacity is driven by hype + flash
    const op = clamp01(baseOp + boostOp * totalHype + 0.35 * flash);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Base layer
    ctx.globalAlpha = op;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);

    // "Bloom" pass: draw again with higher blur via shadow
    const bloom = clamp01(cfg.bloomStrength);
    if (bloom > 0.001) {
      ctx.globalAlpha = op * (0.55 + 0.65 * bloom);
      ctx.shadowColor = 'rgba(255,255,255,0.85)';

      // ✅ bloom blur strength is also driven by hype + flash
      ctx.shadowBlur = (18 + 90 * bloom) * (0.25 + 0.95 * totalHype + 0.85 * flash);

      ctx.drawImage(off, 0, 0, w, h);
    }

    ctx.restore();

    // Vignette for readability
    const vig = clamp(cfg.vignette, 0, 0.9);
    if (vig > 0.001) {
      drawVignette(ctx, w, h, vig);
    }

    // Placement emphasis: slightly stronger near bottom or edges
    emphasizePlacement(ctx, w, h, cfg.placement, totalHype, flash);
  }

  function renderField(ictx, W, H, t, dt, biasRgb) {
    const img = ictx.getImageData(0, 0, W, H);
    const data = img.data;

    const cx = W * 0.5;
    const cy = H * 0.5;

    const flow = clamp(cfg.flowSpeed, 0.05, 3);
    const rs = clamp(cfg.rainbowSpeed, 0.05, 3);
    const scale = clamp(cfg.rainbowScale, 0.3, 3);

    const sat = clamp01(cfg.saturation);
    const contrast = clamp(cfg.contrast, 0.4, 2.0);
    const complexity = clamp01(cfg.fieldComplexity);

    const bias = clamp(cfg.biasStrength, 0, 1);

    // ✅ Energy uses hype + flash
    const energy = clamp01(0.15 + 0.85 * totalHype + 0.9 * flash);

    const k1 = 1.6 * scale;
    const k2 = 2.4 * scale;
    const k3 = 3.2 * scale;

    // Bias vector from faction color
    const br = biasRgb.r / 255;
    const bg = biasRgb.g / 255;
    const bb = biasRgb.b / 255;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;

        const nx = (x - cx) / Math.max(1, W);
        const ny = (y - cy) / Math.max(1, H);
        const rr = Math.sqrt(nx * nx + ny * ny);

        // Flow field warp
        const w1 = Math.sin((nx * k1 + t * 0.35 * flow) * 6.283);
        const w2 = Math.cos((ny * k2 - t * 0.27 * flow) * 6.283);
        const w3 = Math.sin(((nx + ny) * k3 + t * 0.18 * flow) * 6.283);

        const warp = (w1 + w2 + w3) / 3;

        const hue = frac(
          (nx * 0.9 + ny * 0.6) * (0.85 + 0.85 * complexity) * scale
          + t * 0.10 * rs * (0.75 + 1.25 * energy)
          + warp * (0.20 + 0.55 * complexity)
        );

        // Brightness
        const band = 0.5 + 0.5 * Math.sin((ny * 2.4 + warp * 0.9 + t * 0.55 * flow) * 6.283);
        const center = 1 - clamp01(rr * 1.6);
        let v = (0.25 + 0.75 * band) * (0.40 + 0.60 * center);
        v = v * (0.55 + 0.85 * energy);

        let rgb = hsvToRgb(hue, sat * (0.6 + 0.4 * energy), clamp01(v));

        // Faction bias (tint)
        rgb.r = lerp(rgb.r, rgb.r * (1 - bias) + br * bias, 0.65);
        rgb.g = lerp(rgb.g, rgb.g * (1 - bias) + bg * bias, 0.65);
        rgb.b = lerp(rgb.b, rgb.b * (1 - bias) + bb * bias, 0.65);

        // Contrast curve
        rgb.r = clamp01((rgb.r - 0.5) * contrast + 0.5);
        rgb.g = clamp01((rgb.g - 0.5) * contrast + 0.5);
        rgb.b = clamp01((rgb.b - 0.5) * contrast + 0.5);

        data[i + 0] = (rgb.r * 255) | 0;
        data[i + 1] = (rgb.g * 255) | 0;
        data[i + 2] = (rgb.b * 255) | 0;
        data[i + 3] = 255;
      }
    }

    ictx.putImageData(img, 0, 0);
  }

  function emphasizePlacement(ctx, w, h, placement, hype, flash) {
    const a = clamp01(0.08 + 0.18 * hype + 0.20 * flash);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (placement === 'bottom') {
      g.addColorStop(0.0, 'rgba(0,0,0,0)');
      g.addColorStop(0.65, 'rgba(0,0,0,0)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.9)');
    } else {
      g.addColorStop(0.0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.22, 'rgba(0,0,0,0)');
      g.addColorStop(0.78, 'rgba(0,0,0,0)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.85)');
    }

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  loop(lastMs);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (resolved.created && canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
    setConfig(next) {
      cfg = { ...cfg, ...(next || {}) };
      // (no need to rebuild anything; hype uses cfg.intensity/eventBoost live in ingest + decay)
    }
  };
}

/* ---------- Utilities ---------- */
function ensureCanvas(existing, styleKey) {
  if (existing && typeof existing.getContext === 'function') {
    styleCanvas(existing);
    return { canvas: existing, created: false };
  }
  const root = document.getElementById('overlayRoot') || document.body;
  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'prismBloom';
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

    r += rgb.r * v; g += rgb.g * v; b += rgb.b * v;
    sum += v;
  }

  if (mixMode === 'winner' && bestId != null) {
    const rgb = hexToRgb(idToColor.get(bestId) || '#78c8ff');
    return `rgba(${rgb.r|0},${rgb.g|0},${rgb.b|0},${a})`;
  }

  if (sum <= 0) return `rgba(120,200,255,${a})`;
  return `rgba(${(r/sum)|0},${(g/sum)|0},${(b/sum)|0},${a})`;
}

function rgbaToRgb(rgba) {
  const s = String(rgba || '').trim();
  if (s.startsWith('rgba(') || s.startsWith('rgb(')) {
    const inside = s.substring(s.indexOf('(') + 1, s.lastIndexOf(')')).split(',').map(x => x.trim());
    if (inside.length >= 3) {
      return { r: clampInt(Number(inside[0]), 0, 255), g: clampInt(Number(inside[1]), 0, 255), b: clampInt(Number(inside[2]), 0, 255) };
    }
  }
  return hexToRgb(s || '#78c8ff');
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

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r, g, b };
}

function drawVignette(ctx, w, h, strength) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = clamp01(strength);

  const r = Math.max(w, h) * 0.75;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, r * 0.15, w * 0.5, h * 0.5, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function num(v, fallback) {
  const n = (typeof v === 'string') ? Number(v) : v;
  return (typeof n === 'number' && isFinite(n)) ? n : fallback;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function clamp01(x) { return clamp(x, 0, 1); }
function clampInt(x, a, b) { return Math.max(a, Math.min(b, x | 0)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }
