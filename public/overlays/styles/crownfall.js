// public/overlays/styles/crownfall.js
// PRO Overlay: Crownfall (Top-Center Spectral Crown + Prismatic Ember Rain)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Updates in this version:
// - Crown looks more 3D: metallic fill, bevel highlight, inner shading + cast shadow
// - Better full-hype performance:
//   - NO per-frame getBoundingClientRect() resize (resize only when needed)
//   - Cached Path2D for crown geometry
//   - Bloom/blur clamps + auto-throttle extra glow passes when particle count is high

'use strict';

export const meta = {
  styleKey: 'crownfall',
  name: 'Crownfall (PRO)',
  tier: 'PRO',
  description:
    'A top-center spectral crown that flares on spikes and rains prismatic embers. Big-moment overlay with faction-biased glow. Designed to sit over an avatar.',

  defaultConfig: {
    placement: 'edges',            // edges | bottom (bottom biases ember origin lower)
    mixMode: 'weighted',           // weighted | winner
    intensity: 1.0,                // 0..2

    // Hype mapping
    hypeK: 160,                    // reacts by ~50–100 total, huge by ~300–500
    maxTotalClamp: 2200,           // safety clamp
    hypeSmoothing: 0.18,           // 0.05..0.5 higher = snappier

    // Performance
    fpsCap: 60,                    // 15..60
    crownRenderScale: 0.55,        // 0.25..1 (offscreen crown canvas scale)
    emberMax: 420,                 // particle cap (primary perf knob)
    emberSpawnCapPerFrame: 90,     // hard safety cap

    // Crown layout (top-center)
    crownX: 0.5,                   // 0..1
    crownY: 0.115,                 // 0..1
    crownWidth: 0.56,              // 0.2..0.9 (fraction of screen width)
    crownHeight: 0.18,             // 0.08..0.35 (fraction of screen height)
    crownTilt: 0.0,                // -0.2..0.2 (small)
    crownOpacity: 0.16,            // base visibility
    crownGlow: 0.92,               // 0..1
    crownLineWidth: 3.5,           // px outline
    crownGemCount: 5,              // 3..9

    // NEW: 3D / shadow tuning
    crownDepth: 1.0,               // 0..2 (bevel + shading strength)
    crownCastShadow: 0.85,         // 0..2 (shadow under crown)
    crownShadowSoftness: 1.0,      // 0.2..2 (blur multiplier)
    crownShadowOffset: 1.0,        // 0..2 (offset multiplier)

    // Reaction tuning
    eventBoost: 1.0,               // 0..2
    spikeSensitivity: 0.95,        // 0..2
    flareAttack: 9.0,              // 1..20
    flareRelease: 2.2,             // 0.2..6
    flareStrength: 0.9,            // 0..1

    // Embers
    emberEnabled: true,
    emberRate: 18,                 // base/sec
    emberBoost: 150,               // additional/sec at max hype/spike
    emberLife: 1.25,               // sec
    emberSize: 2.6,                // px
    emberSpeed: 420,               // px/sec
    emberGravity: 920,             // px/sec^2
    emberDrift: 120,               // px/sec sideways
    emberTurbulence: 0.55,         // 0..1
    emberGlow: 0.85,               // 0..1
    emberAlpha: 0.55,              // 0..1
    emberHueSpeed: 1.15,           // 0.1..3

    // Tier 2+ extras
    sparkEnabled: true,
    sparkRate: 6,                  // extra sparks/sec (Tier2+)
    sparkBoost: 35,                // extra sparks/sec (Tier3)
    sparkSize: 1.4,                // px
    sparkLife: 0.55,               // sec

    // Tier 3 spectacle
    shockwaveStrength: 1.0,        // 0..2
    lensGlowStrength: 1.0,         // 0..2 (soft halo above crown)
    chromaSplit: 0.75,             // 0..2 (subtle RGB offset at max hype)

    // Rainbow / color
    saturation: 0.95,              // 0..1
    contrast: 1.05,                // 0.6..1.6
    biasStrength: 0.24,            // 0..0.75 faction tint influence on crown

    // Screen shaping
    backgroundDim: 0.0,            // 0..0.25
    vignette: 0.22                 // 0..0.8
  },

  controls: [
    { key: 'placement', label: 'Placement Bias', type: 'select', options: ['edges', 'bottom'], default: 'edges' },
    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    // Performance
    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'crownRenderScale', label: 'Crown Render Scale', type: 'range', min: 0.25, max: 1, step: 0.01, default: 0.55 },
    { key: 'emberMax', label: 'Max Embers', type: 'range', min: 60, max: 1200, step: 10, default: 420 },

    // Crown layout
    { key: 'crownX', label: 'Crown X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'crownY', label: 'Crown Y', type: 'range', min: 0.02, max: 0.3, step: 0.005, default: 0.115 },
    { key: 'crownWidth', label: 'Crown Width', type: 'range', min: 0.2, max: 0.9, step: 0.01, default: 0.56 },
    { key: 'crownHeight', label: 'Crown Height', type: 'range', min: 0.08, max: 0.35, step: 0.01, default: 0.18 },
    { key: 'crownTilt', label: 'Crown Tilt', type: 'range', min: -0.2, max: 0.2, step: 0.01, default: 0.0 },
    { key: 'crownOpacity', label: 'Crown Opacity', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.16 },
    { key: 'crownGlow', label: 'Crown Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.92 },
    { key: 'crownLineWidth', label: 'Crown Line Width', type: 'range', min: 1, max: 10, step: 0.1, default: 3.5 },
    { key: 'crownGemCount', label: 'Gem Count', type: 'range', min: 3, max: 9, step: 1, default: 5 },

    // NEW: 3D / shadow
    { key: 'crownDepth', label: 'Crown Depth', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'crownCastShadow', label: 'Cast Shadow', type: 'range', min: 0, max: 2, step: 0.05, default: 0.85 },
    { key: 'crownShadowSoftness', label: 'Shadow Softness', type: 'range', min: 0.2, max: 2, step: 0.05, default: 1.0 },
    { key: 'crownShadowOffset', label: 'Shadow Offset', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    // Reaction tuning
    { key: 'eventBoost', label: 'Event Boost', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'spikeSensitivity', label: 'Spike Sensitivity', type: 'range', min: 0, max: 2, step: 0.05, default: 0.95 },
    { key: 'flareAttack', label: 'Flare Attack', type: 'range', min: 1, max: 20, step: 0.5, default: 9.0 },
    { key: 'flareRelease', label: 'Flare Release', type: 'range', min: 0.2, max: 6, step: 0.1, default: 2.2 },
    { key: 'flareStrength', label: 'Flare Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },

    // Embers
    { key: 'emberEnabled', label: 'Enable Embers', type: 'checkbox', default: true },
    { key: 'emberRate', label: 'Ember Rate', type: 'range', min: 0, max: 120, step: 1, default: 18 },
    { key: 'emberBoost', label: 'Ember Boost', type: 'range', min: 0, max: 400, step: 5, default: 150 },
    { key: 'emberLife', label: 'Ember Life', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1.25 },
    { key: 'emberSize', label: 'Ember Size', type: 'range', min: 0.8, max: 10, step: 0.1, default: 2.6 },
    { key: 'emberSpeed', label: 'Ember Speed', type: 'range', min: 80, max: 1200, step: 20, default: 420 },
    { key: 'emberGravity', label: 'Gravity', type: 'range', min: 0, max: 2200, step: 20, default: 920 },
    { key: 'emberDrift', label: 'Ember Drift', type: 'range', min: 0, max: 450, step: 5, default: 120 },
    { key: 'emberTurbulence', label: 'Turbulence', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'emberGlow', label: 'Ember Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'emberAlpha', label: 'Ember Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'emberHueSpeed', label: 'Hue Speed', type: 'range', min: 0.1, max: 3, step: 0.05, default: 1.15 },

    { key: 'saturation', label: 'Saturation', type: 'range', min: 0, max: 1, step: 0.01, default: 0.95 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.6, max: 1.6, step: 0.01, default: 1.05 },
    { key: 'biasStrength', label: 'Faction Bias Strength', type: 'range', min: 0, max: 0.75, step: 0.01, default: 0.24 },

    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.0 },
    { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.22 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 160 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'sparkEnabled', label: 'Enable Sparks', type: 'checkbox', default: true },
    { key: 'sparkRate', label: 'Spark Rate', type: 'range', min: 0, max: 40, step: 1, default: 6 },
    { key: 'sparkBoost', label: 'Spark Boost', type: 'range', min: 0, max: 150, step: 5, default: 35 },
    { key: 'shockwaveStrength', label: 'Shockwave Strength', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'lensGlowStrength', label: 'Lens Glow Strength', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'chromaSplit', label: 'Chroma Split', type: 'range', min: 0, max: 2, step: 0.05, default: 0.75 },
  ],
};

function clamp(n, min, max) { return Math.max(min, Math.min(max, Number.isFinite(+n) ? +n : min)); }
function clamp01(x) { return clamp(x, 0, 1); }
function clampInt(x, a, b) { return Math.max(a, Math.min(b, (x | 0))); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'crownfall';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';
  c.style.willChange = 'transform, opacity, filter';

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

function mixWeighted(colors, weights) {
  let sum = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < colors.length; i++) {
    const w = Math.max(0, weights[i] ?? 0);
    sum += w;
    r += colors[i].r * w;
    g += colors[i].g * w;
    b += colors[i].b * w;
  }
  if (sum <= 0) return { r: 140, g: 210, b: 255 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 140, g: 210, b: 255 };
}

function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 2200, 200, 6000);
  total = clamp(total, 0, maxTotalClamp);

  let rgb;
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === 'winner') ? pickWinner(colors, weights) : mixWeighted(colors, weights);
  } else {
    rgb = { r: 140, g: 210, b: 255 };
  }

  const k = clamp(cfg.hypeK ?? 160, 40, 600);
  let h = 1 - Math.exp(-total / k);
  h = clamp01(h + (1 - h) * 0.06 * Math.min(1, total / 70));
  return { total, h, rgb };
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

function smoothstep01(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

function tierFromH(h) {
  if (h < 0.10) return 0;
  if (h < 0.35) return 1;
  if (h < 0.70) return 2;
  return 3;
}

// Crown path cache (rebuilt only when sw/sh/peaks change)
function buildCrownPaths(sw, sh, peakCount) {
  const left = -sw * 0.5;
  const right = sw * 0.5;
  const top = -sh * 0.5;
  const base = sh * 0.35;

  const toothW = sw / (peakCount + 1);

  // Outline: zig-zag crown edge
  const outline = new Path2D();
  outline.moveTo(left, base);
  for (let i = 0; i <= peakCount; i++) {
    const x = left + toothW * (i + 0.5);
    const ph = (0.55 + 0.45 * Math.sin((i / peakCount) * Math.PI));
    const yPeak = top + sh * 0.15 * ph;
    outline.lineTo(x, yPeak);
    outline.lineTo(x + toothW * 0.5, base);
  }
  outline.lineTo(right, base);

  // Body: a slightly thicker “plate” under the outline
  const body = new Path2D(outline);
  body.lineTo(right * 0.92, base + sh * 0.26);
  body.lineTo(left * 0.92, base + sh * 0.26);
  body.closePath();

  // Crown “rim” (for bevel highlight): follow just the upper outline
  const rim = new Path2D();
  rim.moveTo(left, base);
  for (let i = 0; i <= peakCount; i++) {
    const x = left + toothW * (i + 0.5);
    const ph = (0.55 + 0.45 * Math.sin((i / peakCount) * Math.PI));
    const yPeak = top + sh * 0.13 * ph; // slightly higher/cleaner
    rim.lineTo(x, yPeak);
    rim.lineTo(x + toothW * 0.5, base);
  }
  rim.lineTo(right, base);

  return { outline, body, rim, left, right, top, base, toothW };
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Offscreen crown canvas
  const crownOff = document.createElement('canvas');
  const crownCtx = crownOff.getContext('2d', { alpha: true });

  // Live snap state
  let latestSnap = { factions: [] };
  let { total: totalRaw, h: hTarget, rgb: biasRgb } = computeBlendAndHype(latestSnap, cfg);

  // Smoothed hype + color
  let hSmooth = 0;
  let biasSmooth = { r: 140, g: 210, b: 255 };

  // Spike / flare energy
  let lastTotal = 0;
  let spikeVel = 0;
  let spikeEnergy = 0; // 0..1
  let flare = 0;       // 0..1
  let flash = 0;       // 0..1

  // Particles
  const embers = []; // {x,y,vx,vy,life,t,rot,vr,size,hueSeed,power,isSpark,grav}
  let emberCarry = 0;
  let sparkCarry = 0;

  // Shockwave (tier 3)
  let shockT = 0;
  let shockV = 0;

  // Loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  // Size state (IMPORTANT PERF FIX: no per-frame getBoundingClientRect)
  let size = { w: 1, h: 1, dpr: 1, ow: 2, oh: 2 };
  let sizeDirty = true;

  // Crown path cache state
  let crownPathKey = '';
  let crownPaths = null;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    biasRgb = res.rgb;

    const d = Math.abs(totalRaw - lastTotal);
    lastTotal = totalRaw;
    const bump01 = clamp01(d / 70) * clamp(cfg.eventBoost, 0, 2) * clamp(cfg.spikeSensitivity, 0, 2);
    spikeVel += bump01 * 1.25;
  });

  function applyResizeIfNeeded() {
    if (!sizeDirty) return;
    sizeDirty = false;

    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = clamp(cfg.crownRenderScale, 0.25, 1);
    const ow = Math.max(2, Math.floor(w * scale));
    const oh = Math.max(2, Math.floor(h * scale));
    if (crownOff.width !== ow || crownOff.height !== oh) {
      crownOff.width = ow;
      crownOff.height = oh;
    }
    size = { w, h, dpr, ow, oh };
  }

  const onResize = () => { sizeDirty = true; };
  window.addEventListener('resize', onResize, { passive: true });

  function spawnEmbers(dt, crown, t) {
    if (!cfg.emberEnabled) return;

    const baseRate = clamp(cfg.emberRate, 0, 900);
    const boost = clamp(cfg.emberBoost, 0, 2400);

    const rate = baseRate + boost * clamp01(0.55 * hSmooth + 0.85 * spikeEnergy + 0.6 * flare);
    emberCarry += rate * dt;
    let count = Math.floor(emberCarry);
    emberCarry -= count;

    const max = clampInt(cfg.emberMax, 0, 100000);
    if (max <= 0) return;

    count = Math.min(count, clampInt(cfg.emberSpawnCapPerFrame ?? 90, 10, 200));

    const life = clamp(cfg.emberLife, 0.1, 12);
    const size0 = clamp(cfg.emberSize, 0.2, 40);
    const speed = clamp(cfg.emberSpeed, 0, 4000);
    const grav = clamp(cfg.emberGravity, 0, 10000);
    const drift = clamp(cfg.emberDrift, 0, 2000);
    const turb = clamp01(cfg.emberTurbulence);

    const power = clamp01(0.20 + 0.80 * (0.55 * hSmooth + 0.45 * flare));
    const spread = lerp(0.55, 0.95, hSmooth);
    const speedBoost = lerp(0.85, 1.35, hSmooth);

    for (let i = 0; i < count; i++) {
      if (embers.length >= max) embers.shift();

      const sx = crown.cx + (Math.random() - 0.5) * crown.w * 0.65 * spread;
      const sy = crown.cy + crown.h * (0.18 + 0.12 * Math.random());

      const vx = (Math.random() - 0.5) * drift * (0.25 + 0.75 * turb);
      const vy = speed * (0.35 + 0.75 * Math.random()) * speedBoost * (0.55 + 0.9 * power);

      embers.push({
        x: sx, y: sy, vx, vy,
        grav,
        life: life * (0.75 + 0.7 * Math.random()),
        t: 0,
        size: size0 * (0.7 + 0.8 * Math.random()) * lerp(0.9, 1.3, hSmooth),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * lerp(7, 14, hSmooth),
        hueSeed: Math.random(),
        power,
        isSpark: false,
      });
    }
  }

  function spawnSparks(dt, crown, t) {
    const tier = tierFromH(hSmooth);
    if (tier < 2) return;
    if (!cfg.sparkEnabled) return;

    const base = clamp(cfg.sparkRate, 0, 240);
    const boost = clamp(cfg.sparkBoost, 0, 600);
    const rate = base + (tier === 3 ? boost : boost * 0.35) * clamp01(0.45 * hSmooth + 0.8 * spikeEnergy + 0.45 * flare);

    sparkCarry += rate * dt;
    let count = Math.floor(sparkCarry);
    sparkCarry -= count;

    count = Math.min(count, 60);

    const max = clampInt(cfg.emberMax, 0, 100000);
    if (max <= 0) return;

    const life = clamp(cfg.sparkLife ?? 0.55, 0.15, 2.0);
    const size0 = clamp(cfg.sparkSize ?? 1.4, 0.5, 8);
    const grav = clamp(cfg.emberGravity, 0, 10000) * 0.85;
    const drift = clamp(cfg.emberDrift, 0, 2000) * 1.1;

    for (let i = 0; i < count; i++) {
      if (embers.length >= max) embers.shift();

      const side = (Math.random() < 0.5) ? -1 : 1;
      const sx = crown.cx + side * crown.w * (0.25 + 0.25 * Math.random());
      const sy = crown.cy + crown.h * (0.05 + 0.18 * Math.random());

      const vx = side * (0.4 + 0.6 * Math.random()) * drift * 0.25 + (Math.random() - 0.5) * drift * 0.08;
      const vy = (120 + 260 * Math.random()) * (0.9 + 0.8 * hSmooth);

      embers.push({
        x: sx, y: sy, vx, vy,
        grav,
        life: life * (0.7 + 0.7 * Math.random()),
        t: 0,
        size: size0 * (0.75 + 0.8 * Math.random()) * (0.85 + 0.8 * hSmooth),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 18,
        hueSeed: Math.random(),
        power: clamp01(0.35 + 0.65 * hSmooth),
        isSpark: true,
      });
    }
  }

  function stepParticles(dt, w, h, t) {
    const drift = clamp(cfg.emberDrift, 0, 2000);
    const turb = clamp01(cfg.emberTurbulence);

    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.t += dt;

      const n = Math.sin((e.hueSeed * 9 + t * 2.4) * Math.PI * 2);
      e.vx += n * drift * 0.10 * turb * dt;

      e.vy += e.grav * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rot += e.vr * dt;

      e.vx *= Math.pow(0.35, dt);
      e.vy *= Math.pow(0.82, dt);

      if (e.t >= e.life || e.y > h + 120) embers.splice(i, 1);
    }
  }

  function drawParticles(ctx, t, biasRgb) {
    if (!cfg.emberEnabled) return;

    const glow = clamp01(cfg.emberGlow);
    const alphaBase = clamp01(cfg.emberAlpha);
    const sat = clamp01(cfg.saturation);
    const hueSpeed = clamp(cfg.emberHueSpeed, 0.05, 6);
    const tier = tierFromH(hSmooth);

    ctx.save();
    ctx.globalCompositeOperation = (tier >= 2) ? 'lighter' : 'source-over';

    // Full-hype optimization: cap blur when we have a lot of particles
    const particlePressure = clamp01(embers.length / Math.max(1, clampInt(cfg.emberMax, 1, 20000)));
    const blurCap = lerp(1.0, 0.55, particlePressure); // more particles => less blur
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = (6 + 70 * glow) * (0.20 + 1.20 * hSmooth) * (0.7 + 0.6 * flare) * blurCap;

    const bias = clamp(cfg.biasStrength, 0, 1) * lerp(0.15, 0.55, hSmooth);
    const br = biasRgb.r / 255, bg = biasRgb.g / 255, bb = biasRgb.b / 255;

    for (const e of embers) {
      const p = clamp01(e.t / e.life);
      const fade = (1 - p);
      const a = alphaBase * fade * (0.25 + 0.85 * e.power) * (0.45 + 0.95 * hSmooth + 0.35 * flare);

      const hue = frac(e.hueSeed + t * 0.12 * hueSpeed * lerp(0.85, 1.35, hSmooth) + p * 0.25);
      let rgb = hsvToRgb(hue, sat, 1);

      rgb.r = lerp(rgb.r, rgb.r * (1 - bias) + br * bias, 0.55);
      rgb.g = lerp(rgb.g, rgb.g * (1 - bias) + bg * bias, 0.55);
      rgb.b = lerp(rgb.b, rgb.b * (1 - bias) + bb * bias, 0.55);

      const rr = (rgb.r * 255) | 0, gg = (rgb.g * 255) | 0, bb2 = (rgb.b * 255) | 0;

      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);

      if (e.isSpark) {
        const sz = e.size;
        ctx.fillStyle = `rgba(${rr},${gg},${bb2},${a})`;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.2, -sz * 2.0);
        ctx.lineTo(sz * 0.25, -sz * 0.4);
        ctx.lineTo(sz * 0.2, sz * 2.0);
        ctx.lineTo(-sz * 0.35, sz * 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${a * 0.35})`;
        ctx.fillRect(-sz * 0.06, -sz * 1.6, sz * 0.12, sz * 3.2);
      } else {
        const sz = e.size;
        ctx.fillStyle = `rgba(${rr},${gg},${bb2},${a})`;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.35, -sz * 1.15);
        ctx.lineTo(sz * 0.75, -sz * 0.25);
        ctx.lineTo(sz * 0.35, sz * 1.15);
        ctx.lineTo(-sz * 0.85, sz * 0.25);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${a * lerp(0.24, 0.42, hSmooth)})`;
        ctx.fillRect(-sz * 0.08, -sz * 0.95, sz * 0.16, sz * 1.9);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  function drawCrownToOffscreen(ow, oh, t, crown, biasRgb) {
    const ictx = crownCtx;
    ictx.clearRect(0, 0, ow, oh);

    const tier = tierFromH(hSmooth);
    const energy = clamp01(0.12 + 0.88 * hSmooth + 0.85 * flare + 0.55 * flash);
    const glow = clamp01(cfg.crownGlow);
    const baseA = clamp01(cfg.crownOpacity);

    // Map main-canvas crown rect into offscreen
    const sx = crown.cx / crown.wScreen * ow;
    const sy = crown.cy / crown.hScreen * oh;
    const sw = crown.w / crown.wScreen * ow;
    const sh = crown.h / crown.hScreen * oh;

    const peaks = clampInt(cfg.crownGemCount, 3, 9);
    const key = `${(sw * 10) | 0}:${(sh * 10) | 0}:${peaks}`;
    if (key !== crownPathKey) {
      crownPathKey = key;
      crownPaths = buildCrownPaths(sw, sh, peaks);
    }

    // Faction bias tint (subtle)
    const bias = clamp(cfg.biasStrength, 0, 1);
    const br = biasRgb.r / 255, bg = biasRgb.g / 255, bb = biasRgb.b / 255;

    // Rainbow sweep for sheen
    const hueBase = frac(t * lerp(0.08, 0.16, hSmooth));

    ictx.save();
    ictx.translate(sx, sy);
    ictx.rotate(cfg.crownTilt || 0);

    // 1) Cast shadow (3D): draw body path offset & blurred
    const cast = clamp(cfg.crownCastShadow ?? 0.85, 0, 2);
    const depth = clamp(cfg.crownDepth ?? 1.0, 0, 2);
    if (cast > 0.001) {
      const off = (1.2 + 6.0 * depth) * clamp(cfg.crownShadowOffset ?? 1.0, 0, 2) * (0.55 + 0.65 * hSmooth);
      const soft = clamp(cfg.crownShadowSoftness ?? 1.0, 0.2, 2);
      const maxBlur = 26; // hard cap for OBS sanity
      ictx.save();
      ictx.globalCompositeOperation = 'source-over';
      ictx.globalAlpha = (0.18 + 0.22 * cast) * (0.6 + 0.55 * energy);
      ictx.shadowColor = 'rgba(0,0,0,0.85)';
      ictx.shadowBlur = Math.min(maxBlur, (10 + 20 * cast) * soft * (0.6 + 0.7 * hSmooth));
      ictx.shadowOffsetX = off * 0.55;
      ictx.shadowOffsetY = off;
      ictx.fillStyle = 'rgba(0,0,0,0.85)';
      ictx.fill(crownPaths.body);
      ictx.restore();
    }

    // 2) Metallic body fill (3D): gradient + subtle rim light
    const bodyA = baseA * lerp(0.35, 0.78, smoothstep01(hSmooth)) * (0.35 + 0.65 * energy);
    const bodyGrad = ictx.createLinearGradient(0, crownPaths.top, 0, crownPaths.base + sh * 0.28);

    // Tint the metal slightly toward faction at higher hype
    const tint = lerp(0.08, 0.22, hSmooth) * bias;
    const tr = lerp(1.0, br, tint);
    const tg = lerp(1.0, bg, tint);
    const tb = lerp(1.0, bb, tint);

    // Dark-to-light-to-dark metal banding
    bodyGrad.addColorStop(0.00, `rgba(${(20 * tr) | 0},${(24 * tg) | 0},${(30 * tb) | 0},${bodyA * (0.70 + 0.20 * depth)})`);
    bodyGrad.addColorStop(0.28, `rgba(${(70 * tr) | 0},${(78 * tg) | 0},${(92 * tb) | 0},${bodyA * (0.55 + 0.30 * depth)})`);
    bodyGrad.addColorStop(0.58, `rgba(${(26 * tr) | 0},${(30 * tg) | 0},${(40 * tb) | 0},${bodyA * (0.65 + 0.22 * depth)})`);
    bodyGrad.addColorStop(1.00, `rgba(0,0,0,${bodyA * (0.75 + 0.20 * depth)})`);

    ictx.save();
    ictx.globalCompositeOperation = 'source-over';
    ictx.fillStyle = bodyGrad;
    ictx.fill(crownPaths.body);

    // Inner shading (cheap bevel): darken lower interior
    if (depth > 0.001) {
      ictx.save();
      ictx.globalCompositeOperation = 'source-atop';
      const inner = ictx.createLinearGradient(0, crownPaths.base - sh * 0.05, 0, crownPaths.base + sh * 0.30);
      inner.addColorStop(0, `rgba(0,0,0,0)`);
      inner.addColorStop(1, `rgba(0,0,0,${0.20 * depth * (0.7 + 0.6 * hSmooth)})`);
      ictx.fillStyle = inner;
      ictx.fillRect(-sw * 0.6, crownPaths.base - sh * 0.05, sw * 1.2, sh * 0.40);
      ictx.restore();
    }

    // Bevel highlight along rim
    if (depth > 0.001) {
      ictx.save();
      ictx.globalCompositeOperation = 'lighter';
      ictx.globalAlpha = (0.10 + 0.18 * depth) * (0.55 + 0.55 * energy);
      ictx.lineWidth = Math.max(1.0, (clamp(cfg.crownLineWidth, 1, 20) * 0.55) * (0.9 + 0.6 * depth));
      ictx.strokeStyle = 'rgba(255,255,255,0.65)';
      ictx.shadowColor = 'rgba(255,255,255,0.8)';
      ictx.shadowBlur = Math.min(18, 6 + 16 * depth);
      ictx.stroke(crownPaths.rim);
      ictx.restore();
    }

    ictx.restore();

    // 3) Glow stroke (rainbow) — still the “spectral” identity
    ictx.save();
    ictx.globalCompositeOperation = 'lighter';

    // Full-hype optimization: clamp shadow blur when particle pressure is high
    const pressure = clamp01(embers.length / Math.max(1, clampInt(cfg.emberMax, 1, 20000)));
    const blurScale = lerp(1.0, 0.55, pressure);
    const maxGlowBlur = 80; // hard cap
    ictx.shadowColor = 'rgba(255,255,255,0.9)';
    ictx.shadowBlur = Math.min(
      maxGlowBlur,
      (10 + 90 * glow) * (0.18 + 1.05 * energy) * lerp(0.85, 1.45, hSmooth) * blurScale
    );

    const grad = ictx.createLinearGradient(crownPaths.left, crownPaths.top, crownPaths.right, crownPaths.base);
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      const hue = frac(hueBase + u * 0.75);
      let rgb = hsvToRgb(hue, clamp01(cfg.saturation), 1);

      rgb.r = lerp(rgb.r, rgb.r * (1 - bias) + br * bias, 0.55);
      rgb.g = lerp(rgb.g, rgb.g * (1 - bias) + bg * bias, 0.55);
      rgb.b = lerp(rgb.b, rgb.b * (1 - bias) + bb * bias, 0.55);

      grad.addColorStop(
        u,
        `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},${0.30 + 0.62 * energy})`
      );
    }

    const lw = clamp(cfg.crownLineWidth, 1, 20) * (0.70 + 1.05 * flare) * lerp(0.85, 1.25, hSmooth);
    ictx.strokeStyle = grad;
    ictx.lineWidth = lw;
    ictx.stroke(crownPaths.outline);

    // Gems
    const gemY = crownPaths.base - sh * 0.07;
    for (let i = 0; i < peaks; i++) {
      const gx = crownPaths.left + crownPaths.toothW * (i + 1);
      const hue = frac(hueBase + i / peaks + t * lerp(0.04, 0.09, hSmooth));
      const rgb = hsvToRgb(hue, clamp01(cfg.saturation), 1);

      const gemA = (0.16 + 0.84 * energy) * (0.50 + 0.75 * flare) * lerp(0.75, 1.25, hSmooth);
      ictx.fillStyle = `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},${gemA})`;
      ictx.beginPath();
      ictx.arc(gx, gemY, Math.max(2, sw * 0.02) * (0.75 + 0.75 * flare) * lerp(0.9, 1.35, hSmooth), 0, Math.PI * 2);
      ictx.fill();

      ictx.fillStyle = `rgba(255,255,255,${gemA * lerp(0.22, 0.42, hSmooth)})`;
      ictx.beginPath();
      ictx.arc(gx - sw * 0.006, gemY - sw * 0.006, Math.max(1.2, sw * 0.008), 0, Math.PI * 2);
      ictx.fill();
    }

    // Tier 3: lens glow halo
    if (tier === 3 && (cfg.lensGlowStrength ?? 1) > 0) {
      const ls = clamp(cfg.lensGlowStrength, 0, 2);
      const haloA = clamp01(0.10 + 0.22 * flare + 0.16 * hSmooth) * ls;
      const halo = ictx.createRadialGradient(0, crownPaths.top, 0, 0, crownPaths.top, sw * 0.65);
      halo.addColorStop(0.0, `rgba(255,255,255,${haloA})`);
      halo.addColorStop(0.25, `rgba(255,255,255,${haloA * 0.35})`);
      halo.addColorStop(1.0, `rgba(0,0,0,0)`);
      ictx.fillStyle = halo;
      ictx.beginPath();
      ictx.ellipse(0, crownPaths.top + sh * 0.05, sw * 0.55, sh * 0.55, 0, 0, Math.PI * 2);
      ictx.fill();
    }

    ictx.restore();
  }

  function compositeCrown(ctx, w, h) {
    const tier = tierFromH(hSmooth);
    const energy = clamp01(0.12 + 0.88 * hSmooth + 0.85 * flare + 0.55 * flash);
    const glow = clamp01(cfg.crownGlow);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;

    const op = clamp01(cfg.crownOpacity + 0.18 * hSmooth + 0.28 * flare) * clamp01(0.75 + 0.35 * cfg.intensity);
    ctx.globalAlpha = op;

    ctx.drawImage(crownOff, 0, 0, w, h);

    // Full-hype optimization: fewer bloom passes if particle pressure is high
    const pressure = clamp01(embers.length / Math.max(1, clampInt(cfg.emberMax, 1, 20000)));
    const bloomThrottle = lerp(1.0, 0.55, pressure);

    const bloom = clamp01(cfg.flareStrength) * (0.18 + 1.05 * flare) * lerp(0.65, 1.35, smoothstep01(hSmooth)) * bloomThrottle;
    if (bloom > 0.001) {
      ctx.globalAlpha = op * (0.35 + 0.70 * bloom);
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      const maxBlur = 90;
      ctx.shadowBlur = Math.min(
        maxBlur,
        (18 + 110 * glow) * (0.18 + 1.10 * energy) * lerp(0.85, 1.35, hSmooth) * bloomThrottle
      );
      ctx.drawImage(crownOff, 0, 0, w, h);
      ctx.shadowBlur = 0;
    }

    // Tier 3: chroma split (limit intensity under pressure)
    const csBase = clamp(cfg.chromaSplit ?? 0.75, 0, 2) * (tier === 3 ? lerp(0.2, 1.0, (hSmooth - 0.7) / 0.3) : 0);
    const cs = csBase * lerp(1.0, 0.6, pressure);
    if (cs > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = op * 0.18;
      const ox = Math.sin(performance.now() * 0.002) * cs * 2.0;
      const oy = Math.cos(performance.now() * 0.0017) * cs * 1.4;
      ctx.drawImage(crownOff, ox, 0, w, h);
      ctx.drawImage(crownOff, -ox * 0.7, oy, w, h);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawShockwave(ctx, w, h, crown) {
    const tier = tierFromH(hSmooth);
    if (tier < 3) return;

    const s = clamp(cfg.shockwaveStrength ?? 1, 0, 2);
    if (s <= 0) return;

    shockV *= Math.pow(0.08, 1 / 60);
    shockT = clamp01(shockT + shockV * 0.016);
    if (shockT <= 0.0001) return;

    const cx = crown.cx;
    const cy = crown.cy + crown.h * 0.12;
    const maxR = Math.max(w, h) * 0.55;
    const r = lerp(crown.w * 0.08, maxR, shockT);
    const a = clamp01((1 - shockT) * (0.22 + 0.28 * flare + 0.22 * hSmooth)) * s;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = lerp(2, 10, hSmooth) * s;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = lerp(12, 40, hSmooth) * s;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    shockV *= 0.92;
    shockT *= 0.98;
  }

  function kickShock() {
    const tier = tierFromH(hSmooth);
    if (tier < 3) return;
    shockT = Math.min(shockT, 0.02);
    shockV += 0.95 * clamp01(0.35 + 0.65 * spikeEnergy);
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

    // Smooth h
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));

    // Smooth color
    biasSmooth.r = lerp(biasSmooth.r, biasRgb.r, 1 - Math.exp(-8 * dt));
    biasSmooth.g = lerp(biasSmooth.g, biasRgb.g, 1 - Math.exp(-8 * dt));
    biasSmooth.b = lerp(biasSmooth.b, biasRgb.b, 1 - Math.exp(-8 * dt));

    // Spike energy
    spikeVel *= Math.pow(0.12, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.60);
    spikeVel *= Math.pow(0.65, dt);

    // Flare dynamics
    const atk = clamp(cfg.flareAttack, 0.1, 60);
    const rel = clamp(cfg.flareRelease, 0.05, 60);
    const target = clamp01(0.06 + 0.70 * hSmooth + 0.95 * spikeEnergy) * clamp01(cfg.flareStrength);
    if (target > flare) flare = lerp(flare, target, 1 - Math.exp(-atk * dt));
    else flare = lerp(flare, target, 1 - Math.exp(-rel * dt));

    flash = clamp01(flash * Math.pow(0.10, dt) + (0.35 * spikeEnergy + 0.22 * flare) * 0.55);

    if (spikeEnergy > 0.72 && hSmooth > 0.72) kickShock();

    // Resize only when needed
    applyResizeIfNeeded();
    const { w, h, ow, oh } = size;
    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    const dim = clamp(cfg.backgroundDim, 0, 0.25) * lerp(0.25, 1.0, smoothstep01(hSmooth));
    if (dim > 0.001) {
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    const crown = {
      wScreen: w,
      hScreen: h,
      cx: (clamp(cfg.crownX, 0, 1) * w),
      cy: (clamp(cfg.crownY, 0, 1) * h),
      w: clamp(cfg.crownWidth, 0.1, 1) * w,
      h: clamp(cfg.crownHeight, 0.05, 0.7) * h
    };

    const tier = tierFromH(hSmooth);
    if (tier >= 2) {
      const breathe = lerp(0.0, 6.0, smoothstep01((hSmooth - 0.35) / 0.65));
      const ox = Math.sin(t * 2.0) * breathe * 0.25;
      const oy = Math.cos(t * 1.7) * breathe * 0.18;
      container.style.transform = `translate3d(${ox.toFixed(2)}px,${oy.toFixed(2)}px,0)`;
    } else {
      container.style.transform = 'translateZ(0)';
    }

    drawCrownToOffscreen(ow, oh, t, crown, biasSmooth);
    compositeCrown(ctx, w, h);

    drawShockwave(ctx, w, h, crown);

    spawnEmbers(dt, crown, t);
    spawnSparks(dt, crown, t);
    stepParticles(dt, w, h, t);
    drawParticles(ctx, t, biasSmooth);

    const vig = clamp(cfg.vignette, 0, 0.9) * lerp(0.8, 1.15, smoothstep01(hSmooth));
    if (vig > 0.001) drawVignette(ctx, w, h, vig);
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    biasRgb = res.rgb;

    // If render scale changed, we need a resize refresh
    sizeDirty = true;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    embers.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  // start
  sizeDirty = true;
  applyResizeIfNeeded();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
