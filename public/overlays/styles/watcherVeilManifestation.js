// public/overlays/styles/watcherVeilManifestation.js
// PRO Overlay: Watcher Veil: Manifestation (Fog + Vignette + Pulses + Manifestations + Spike Distortion + Max Reveal)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Design goals:
// - Shares the same baseline as FREE, but adds:
//   - Shadow manifestations in fog
//   - Eye glimpses
//   - Edge distortion pulses on spikes
//   - Max-hype reveal moment with cooldown
// - Faction tinting OPTIONAL but ENABLED by default

'use strict';

export const meta = {
  styleKey: 'watcherVeilManifestation',
  name: 'Watcher Veil: Manifestation (PRO)',
  tier: 'PRO',
  description:
    'The Watcher Veil evolves: shadow forms appear in the fog, eyes flicker into view, and spike events trigger subtle edge distortion. Max hype reveals the Watcher briefly.',

  defaultConfig: {
    // General
    intensity: 1.0,
    fpsCap: 60,

    // Hype mapping
    hypeK: 220,
    maxTotalClamp: 2200,
    hypeSmoothing: 0.18,

    // Fog (baseline)
    fogEnabled: true,
    fogDensity: 0.65,
    fogSpeed: 0.22,
    fogInset: 0.38,
    fogSoftness: 0.82,
    fogGrain: 0.55,
    fogSwirl: 0.40,

    // Vignette
    vignetteStrength: 0.48,
    vignetteSoftness: 0.70,

    // Pulse
    pulseEnabled: true,
    pulseStrength: 0.22,
    pulseRate: 0.58,

    // Faction tinting (DEFAULT ON)
    factionTintEnabled: true,
    factionTintStrength: 0.24,

    // Safety / readability
    centerClearBias: 0.58,

    // Manifestations
    manifestationEnabled: true,
    manifestationFrequency: 0.55,     // 0..1
    shadowVsEye: 0.72,                // 0..1 (1=more shadow, 0=more eyes)
    shapeDefinition: 0.42,            // 0..1 (sharper = more readable)
    eyeGlimpseDuration: 0.22,         // seconds (brief)
    factionBiasStrength: 0.35,        // 0..1 (where things appear)

    // Spikes / distortion
    spikeSensitivity: 0.95,           // 0..2
    distortionEnabled: true,
    distortionIntensity: 0.55,        // 0..1
    distortionRadius: 0.30,           // 0.15..0.6 (how far into screen)

    // Max reveal
    maxRevealEnabled: true,
    maxRevealDuration: 1.3,           // seconds
    maxRevealCooldown: 12.0,          // seconds (prevents spam)
  },

  controls: [
    // General
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },

    // Hype mapping
    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 60, max: 800, step: 10, default: 220 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    // Fog
    { key: 'fogEnabled', label: 'Enable Fog', type: 'checkbox', default: true },
    { key: 'fogDensity', label: 'Fog Density', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: 'fogSpeed', label: 'Fog Speed', type: 'range', min: 0, max: 1.5, step: 0.01, default: 0.22 },
    { key: 'fogInset', label: 'Fog Inset', type: 'range', min: 0.15, max: 0.65, step: 0.01, default: 0.38 },
    { key: 'fogSoftness', label: 'Fog Softness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.82 },
    { key: 'fogGrain', label: 'Fog Grain', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'fogSwirl', label: 'Fog Swirl', type: 'range', min: 0, max: 1, step: 0.01, default: 0.40 },

    // Vignette
    { key: 'vignetteStrength', label: 'Vignette Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.48 },
    { key: 'vignetteSoftness', label: 'Vignette Softness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.70 },

    // Pulse
    { key: 'pulseEnabled', label: 'Enable Pulse', type: 'checkbox', default: true },
    { key: 'pulseStrength', label: 'Pulse Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22 },
    { key: 'pulseRate', label: 'Pulse Rate', type: 'range', min: 0, max: 2, step: 0.01, default: 0.58 },

    // Tint
    { key: 'factionTintEnabled', label: 'Faction Tinting', type: 'checkbox', default: true },
    { key: 'factionTintStrength', label: 'Tint Strength', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.24 },

    // Safety
    { key: 'centerClearBias', label: 'Center Clear Bias', type: 'range', min: 0, max: 0.9, step: 0.01, default: 0.58 },

    // Manifestations
    { key: 'manifestationEnabled', label: 'Enable Manifestations', type: 'checkbox', default: true },
    { key: 'manifestationFrequency', label: 'Manifestation Frequency', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'shadowVsEye', label: 'Shadow vs Eye', type: 'range', min: 0, max: 1, step: 0.01, default: 0.72 },
    { key: 'shapeDefinition', label: 'Shape Definition', type: 'range', min: 0, max: 1, step: 0.01, default: 0.42 },
    { key: 'eyeGlimpseDuration', label: 'Eye Glimpse Duration (s)', type: 'range', min: 0.08, max: 0.7, step: 0.01, default: 0.22 },
    { key: 'factionBiasStrength', label: 'Faction Bias Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },

    // Distortion
    { key: 'spikeSensitivity', label: 'Spike Sensitivity', type: 'range', min: 0, max: 2, step: 0.05, default: 0.95 },
    { key: 'distortionEnabled', label: 'Enable Distortion', type: 'checkbox', default: true },
    { key: 'distortionIntensity', label: 'Distortion Intensity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'distortionRadius', label: 'Distortion Radius', type: 'range', min: 0.15, max: 0.6, step: 0.01, default: 0.30 },

    // Max reveal
    { key: 'maxRevealEnabled', label: 'Enable Max Reveal', type: 'checkbox', default: true },
    { key: 'maxRevealDuration', label: 'Max Reveal Duration (s)', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1.3 },
    { key: 'maxRevealCooldown', label: 'Max Reveal Cooldown (s)', type: 'range', min: 3, max: 45, step: 0.5, default: 12.0 },
  ],
};

function clamp(n, a, b) { n = Number(n); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const h = String(hex || '#78c8ff').trim().replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
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
    rgb = mixWeighted(colors, weights);
  } else {
    rgb = { r: 140, g: 210, b: 255 };
  }

  const k = clamp(cfg.hypeK ?? 220, 60, 800);
  let h = 1 - Math.exp(-total / k);
  h = clamp01(h + (1 - h) * 0.06 * Math.min(1, total / 70));

  return { total, h, rgb };
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'watcherVeilManifestation';
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

// Cheap hash-noise
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function drawVignette(ctx, w, h, strength, softness) {
  const s = clamp01(strength);
  if (s <= 0.001) return;

  const soft = clamp01(softness);
  const r0 = Math.min(w, h) * lerp(0.20, 0.38, soft);
  const r1 = Math.max(w, h) * lerp(0.70, 0.95, soft);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = s;

  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, r0, w * 0.5, h * 0.5, r1);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function initFogField(field, w, h, seed) {
  const scale = 0.12;
  field.fw = Math.max(80, Math.floor(w * scale));
  field.fh = Math.max(45, Math.floor(h * scale));
  field.canvas.width = field.fw;
  field.canvas.height = field.fh;
  field.seed = seed;
}

function renderFogField(field, t, cfg, hype01, tintRgb, tintStrength, edgeMaskFn) {
  const ctx = field.ctx;
  const fw = field.fw, fh = field.fh;

  ctx.clearRect(0, 0, fw, fh);

  const grain = clamp01(cfg.fogGrain);
  const swirl = clamp01(cfg.fogSwirl);
  const density = clamp01(cfg.fogDensity) * (0.25 + 0.85 * hype01);
  const softness = clamp01(cfg.fogSoftness);

  const driftX = t * (0.18 + 1.20 * cfg.fogSpeed) * (0.35 + 0.85 * hype01);
  const driftY = t * (0.10 + 0.85 * cfg.fogSpeed) * (0.35 + 0.85 * hype01);

  const tr = tintRgb?.r ?? 140;
  const tg = tintRgb?.g ?? 210;
  const tb = tintRgb?.b ?? 255;
  const tintA = clamp01(tintStrength) * (0.10 + 0.55 * hype01);

  const img = ctx.getImageData(0, 0, fw, fh);
  const data = img.data;

  const f1 = 0.045;
  const f2 = 0.085;

  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const em = edgeMaskFn(x / fw, y / fh);

      const wx = (x + driftX * 40) * f1 + field.seed;
      const wy = (y + driftY * 40) * f1 + field.seed * 0.7;
      const warp = (smoothNoise(wx, wy) - 0.5) * 2 * swirl;

      const n1 = smoothNoise((x + driftX * 55) * f1 + warp, (y + driftY * 50) * f1 - warp);
      const n2 = smoothNoise((x - driftX * 35) * f2 - warp, (y + driftY * 30) * f2 + warp);

      let v = (0.68 * n1 + 0.32 * n2);
      v = Math.pow(clamp01(v), lerp(1.9, 1.05, softness));
      v *= em;
      v = clamp01((v - 0.34) * 1.35) * density;

      if (grain > 0.001) {
        const g = (hash2(x + field.seed * 1000, y + field.seed * 2000) - 0.5) * 2;
        v = clamp01(v + g * 0.10 * grain * (0.35 + 0.65 * em));
      }

      const a = (v * 255) | 0;

      const idx = (y * fw + x) * 4;
      const base = 14;

      const r = clamp01((base / 255) + (tr / 255) * tintA) * 255;
      const g2 = clamp01((base / 255) + (tg / 255) * tintA) * 255;
      const b = clamp01((base / 255) + (tb / 255) * tintA) * 255;

      data[idx + 0] = r | 0;
      data[idx + 1] = g2 | 0;
      data[idx + 2] = b | 0;
      data[idx + 3] = a;
    }
  }

  ctx.putImageData(img, 0, 0);
}

// Simple “manifestation” objects: either shadow blob or eye glimpse
function spawnManifestation(list, now, cfg, h, spikeEnergy, biasU, biasV) {
  const freq = clamp01(cfg.manifestationFrequency);
  if (!cfg.manifestationEnabled || freq <= 0.001) return;

  // Spawn chance per tick (scaled by hype + spikes)
  const p = (0.004 + 0.020 * h + 0.030 * spikeEnergy) * freq;

  if (Math.random() > p) return;

  const shadowVsEye = clamp01(cfg.shadowVsEye);
  const isEye = (Math.random() > shadowVsEye) && (h > 0.42 || spikeEnergy > 0.25);

  const life = isEye
    ? clamp(cfg.eyeGlimpseDuration, 0.08, 0.7) * (0.75 + 0.75 * Math.random())
    : (0.65 + 1.25 * Math.random()) * (0.75 + 0.8 * h);

  // Edge-biased position with faction bias
  // biasU/biasV in [-1..1], where sign hints side
  const edge = Math.random();
  let u, v;

  // pick an edge region, influenced by faction bias
  const bias = clamp01(cfg.factionBiasStrength);
  const bu = lerp(0, biasU, bias);
  const bv = lerp(0, biasV, bias);

  if (edge < 0.25) { u = 0.02 + Math.random() * 0.18; v = Math.random(); }              // left
  else if (edge < 0.50) { u = 0.80 + Math.random() * 0.18; v = Math.random(); }         // right
  else if (edge < 0.75) { u = Math.random(); v = 0.02 + Math.random() * 0.18; }         // top
  else { u = Math.random(); v = 0.80 + Math.random() * 0.18; }                          // bottom

  // apply bias nudge
  u = clamp01(u + bu * 0.12);
  v = clamp01(v + bv * 0.12);

  list.push({
    t0: now,
    life,
    u, v,
    isEye,
    // size / definition scales with hype
    size: (isEye ? (0.045 + 0.040 * h) : (0.080 + 0.120 * h)) * (0.85 + 0.7 * Math.random()),
    def: clamp01(cfg.shapeDefinition) * (0.55 + 0.75 * h),
    blink: Math.random() * 10,
  });

  // cap to keep perf stable
  if (list.length > 18) list.shift();
}

function drawShadow(ctx, w, h, m, t, h01) {
  const age = (t - m.t0);
  const p = clamp01(age / m.life);
  const fade = (1 - p);
  const a = (0.10 + 0.22 * h01) * fade * (0.65 + 0.35 * Math.sin((age * 2.0 + m.blink) * 1.7));

  const x = m.u * w;
  const y = m.v * h;
  const r = m.size * Math.max(w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = a;

  // shadow blob gradient
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0.0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.65)');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (0.75 + 0.45 * m.def), r * (0.55 + 0.35 * m.def), Math.sin(t * 0.7) * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // subtle “reaching” smear
  if (h01 > 0.60) {
    ctx.globalAlpha *= 0.55;
    ctx.rotate(0);
    ctx.fillRect(x - r * 0.10, y - r * 0.65, r * 0.20, r * 0.90);
  }

  ctx.restore();
}

function drawEye(ctx, w, h, m, t, h01) {
  const age = (t - m.t0);
  const p = clamp01(age / m.life);
  const fade = (1 - p);

  // quick snap in/out
  const snap = Math.sin(p * Math.PI);
  const a = (0.18 + 0.32 * h01) * fade * (0.55 + 0.45 * snap);

  const x = m.u * w;
  const y = m.v * h;
  const r = m.size * Math.max(w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;

  // iris glow
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0.0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');

  // eye shape (almond)
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.85, r * 0.45, Math.sin(t * 0.9 + m.blink) * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // pupil
  ctx.globalAlpha *= 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  ctx.beginPath();
  ctx.ellipse(x + Math.sin(t * 1.3) * r * 0.06, y, r * 0.18, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function computeBiasVectorFromRgb(rgb) {
  // Deterministic “direction” based on tint color
  const r = (rgb?.r ?? 140) / 255;
  const g = (rgb?.g ?? 210) / 255;
  const b = (rgb?.b ?? 255) / 255;
  // map to [-1..1]
  const u = (r - b) * 1.3;
  const v = (g - 0.5) * 1.1;
  return { u: clamp(u, -1, 1), v: clamp(v, -1, 1) };
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  // offscreen buffer for distortion
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: true });

  // low-res fog field
  const fogField = {
    canvas: document.createElement('canvas'),
    ctx: null,
    fw: 0, fh: 0,
    seed: Math.random() * 1000,
  };
  fogField.ctx = fogField.canvas.getContext('2d', { alpha: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // state
  let latestSnap = { factions: [] };
  let hTarget = 0;
  let tintRgb = { r: 140, g: 210, b: 255 };
  let totalRaw = 0;

  let hSmooth = 0;
  let tintSmooth = { r: 140, g: 210, b: 255 };

  // spike detection from delta total
  let lastTotal = 0;
  let spikeVel = 0;
  let spikeEnergy = 0; // 0..1

  // manifestations
  const manifestations = [];

  // max reveal
  let revealUntil = 0;
  let revealCooldownUntil = 0;

  // loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    tintRgb = res.rgb;

    const d = Math.abs(totalRaw - lastTotal);
    lastTotal = totalRaw;

    const sens = clamp(cfg.spikeSensitivity, 0, 2);
    const bump01 = clamp01(d / 70) * sens;
    spikeVel += bump01 * 1.25;
  });

  function edgeMaskFactory(w, h, inset, centerClearBias) {
    const ins = clamp(inset, 0.15, 0.65);
    const centerBias = clamp(centerClearBias, 0, 0.9);

    return (u, v) => {
      const dx = Math.min(u, 1 - u);
      const dy = Math.min(v, 1 - v);
      const d = Math.min(dx, dy);
      let m = 1 - clamp01(d / ins);
      m = Math.pow(m, lerp(1.15, 2.35, centerBias));
      return clamp01(m);
    };
  }

  function resize() {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // offscreen at same resolution
    if (off.width !== canvas.width || off.height !== canvas.height) {
      off.width = canvas.width;
      off.height = canvas.height;
    }
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    initFogField(fogField, w, h, fogField.seed);
    return { w, h };
  }

  function maybeStartMaxReveal(nowS) {
    if (!cfg.maxRevealEnabled) return;
    if (nowS < revealCooldownUntil) return;

    // Treat “max hype” as very high smooth value
    if (hSmooth >= 0.985) {
      const dur = clamp(cfg.maxRevealDuration, 0.3, 3);
      const cd = clamp(cfg.maxRevealCooldown, 3, 45);
      revealUntil = nowS + dur;
      revealCooldownUntil = nowS + cd;
    }
  }

  function drawMaxReveal(ctx, w, h, nowS, tint) {
    if (nowS > revealUntil) return;
    const p = clamp01((revealUntil - nowS) / Math.max(0.001, (revealUntil - (revealUntil - 1))));
    // Instead: create a controlled fade using time remaining
    const rem = (revealUntil - nowS);
    const a = clamp01(rem / clamp(cfg.maxRevealDuration, 0.3, 3));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + 0.22 * (1 - a);

    // “Watcher” suggestion: large, faint eye arc + vertical presence
    const cx = w * 0.5;
    const cy = h * 0.38;
    const R = Math.max(w, h) * 0.42;

    const tr = tint.r | 0, tg = tint.g | 0, tb = tint.b | 0;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.55)`;
    ctx.lineWidth = lerp(2, 10, hSmooth);

    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.85, R * 0.40, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha *= 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.12, R * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // vertical “presence” columns near edges (doesn’t block center)
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = `rgba(${tr},${tg},${tb},0.18)`;
    ctx.fillRect(0, 0, w * 0.03, h);
    ctx.fillRect(w * 0.97, 0, w * 0.03, h);

    ctx.restore();
  }

  function applyEdgeDistortion(dstCtx, srcCanvas, w, h, nowS, strength, radius) {
    // Very lightweight distortion: draw the scene with slight per-scanline x-offset,
    // strongest near edges, faded toward center.
    const s = clamp01(strength);
    if (s <= 0.001) {
      dstCtx.drawImage(srcCanvas, 0, 0, w, h);
      return;
    }

    const rad = clamp(radius, 0.15, 0.6);
    const lines = 60; // keep cheap
    const step = h / lines;

    for (let i = 0; i < lines; i++) {
      const y = i * step;
      const v = y / h;

      const edge = Math.min(v, 1 - v); // 0 at edges, 0.5 center (vertical edge weighting too)
      const em = 1 - clamp01(edge / rad);

      const wob = Math.sin(nowS * 6.2 + v * 13.0) + 0.35 * Math.sin(nowS * 10.0 + v * 21.0);
      const ox = wob * (2 + 18 * s) * em;

      dstCtx.drawImage(
        srcCanvas,
        0, y, w, step + 1,
        ox, y, w, step + 1
      );
    }
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

    // smooth hype
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));

    // smooth tint
    tintSmooth.r = lerp(tintSmooth.r, tintRgb.r, 1 - Math.exp(-8 * dt));
    tintSmooth.g = lerp(tintSmooth.g, tintRgb.g, 1 - Math.exp(-8 * dt));
    tintSmooth.b = lerp(tintSmooth.b, tintRgb.b, 1 - Math.exp(-8 * dt));

    // spike energy
    spikeVel *= Math.pow(0.12, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.60);
    spikeVel *= Math.pow(0.65, dt);

    const { w, h } = resize();
    const nowS = nowMs / 1000;

    // breathing pulse
    const pulseOn = !!cfg.pulseEnabled;
    const pulseRate = clamp(cfg.pulseRate, 0, 2);
    const pulseStrength = clamp01(cfg.pulseStrength);
    const breathe = pulseOn ? (0.5 + 0.5 * Math.sin(nowS * (0.75 + pulseRate * 1.35))) : 0;
    const pulse = pulseOn ? (breathe * breathe) * pulseStrength * (0.25 + 0.9 * hSmooth) : 0;

    // Render base scene into offscreen first
    offCtx.clearRect(0, 0, w, h);

    // fog
    if (cfg.fogEnabled) {
      const tintEnabled = !!cfg.factionTintEnabled;
      const tintStrength = tintEnabled ? clamp(cfg.factionTintStrength, 0, 0.6) : 0;

      const edgeMask = edgeMaskFactory(w, h, cfg.fogInset, cfg.centerClearBias);
      renderFogField(
        fogField,
        nowS,
        cfg,
        clamp01(hSmooth + pulse * 0.35),
        tintSmooth,
        tintStrength,
        edgeMask
      );

      offCtx.save();
      offCtx.globalAlpha = clamp01(0.35 + 0.55 * cfg.fogDensity) * (0.25 + 0.9 * hSmooth) * (0.85 + pulse * 0.35);
      offCtx.imageSmoothingEnabled = true;
      offCtx.drawImage(fogField.canvas, 0, 0, w, h);
      offCtx.restore();
    }

    // manifestations spawn/draw
    const biasVec = computeBiasVectorFromRgb(tintSmooth);
    spawnManifestation(manifestations, nowS, cfg, hSmooth, spikeEnergy, biasVec.u, biasVec.v);

    if (cfg.manifestationEnabled) {
      for (let i = manifestations.length - 1; i >= 0; i--) {
        const m = manifestations[i];
        if ((nowS - m.t0) >= m.life) {
          manifestations.splice(i, 1);
          continue;
        }
        if (m.isEye) drawEye(offCtx, w, h, m, nowS, hSmooth);
        else drawShadow(offCtx, w, h, m, nowS, hSmooth);
      }
    }

    // vignette (heavier near high hype, plus pulse)
    const vig = clamp01(cfg.vignetteStrength) * lerp(0.65, 1.25, hSmooth) * (1 + pulse * 0.28);
    drawVignette(offCtx, w, h, vig, cfg.vignetteSoftness);

    // max reveal logic + draw into offscreen
    maybeStartMaxReveal(nowS);
    drawMaxReveal(offCtx, w, h, nowS, tintSmooth);

    // Now composite to onscreen with optional distortion on spikes
    ctx.clearRect(0, 0, w, h);

    let distortion = 0;
    if (cfg.distortionEnabled && hSmooth > 0.60) {
      const base = clamp01(cfg.distortionIntensity) * (0.10 + 0.75 * spikeEnergy) * (0.35 + 0.65 * hSmooth);
      distortion = clamp01(base);
    }

    if (distortion > 0.001) {
      applyEdgeDistortion(
        ctx,
        off,
        w,
        h,
        nowS,
        distortion,
        cfg.distortionRadius
      );
    } else {
      ctx.drawImage(off, 0, 0, w, h);
    }

    // subtle container drift
    const drift = lerp(0.0, 2.6, hSmooth) * (0.65 + 0.75 * spikeEnergy);
    container.style.transform = `translate3d(${(Math.sin(nowS * 0.9) * drift).toFixed(2)}px,${(Math.cos(nowS * 0.7) * drift).toFixed(2)}px,0)`;
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    tintRgb = res.rgb;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  // start
  resize();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
