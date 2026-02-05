// public/overlays/styles/watcherVeil.js
// FREE Overlay: Watcher Veil (Fog + Vignette + Breathing Pulse, faction tint ON by default)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Notes:
// - Edge-weighted fog, center stays clearer
// - Faction tinting is OPTIONAL but ENABLED by default
// - No eyes, silhouettes, or distortion in FREE

'use strict';

export const meta = {
  styleKey: 'watcherVeil',
  name: 'Watcher Veil (FREE)',
  tier: 'FREE',
  description:
    'Edge-hugging horror fog with a deepening vignette and subtle breathing pulses as hype rises. Designed to stay readable over gameplay.',

  defaultConfig: {
    // General
    intensity: 1.0,            // 0..2
    fpsCap: 60,                // 15..60

    // Hype mapping
    hypeK: 220,                // larger = slower ramp
    maxTotalClamp: 2200,       // safety clamp
    hypeSmoothing: 0.18,       // 0.05..0.5

    // Fog
    fogEnabled: true,
    fogDensity: 0.65,          // 0..1
    fogSpeed: 0.20,            // 0..1.5 (drift)
    fogInset: 0.38,            // 0.15..0.65 (how far toward center)
    fogSoftness: 0.85,         // 0..1 (blur feel)
    fogGrain: 0.55,            // 0..1 (texture)
    fogSwirl: 0.35,            // 0..1 (turbulence)

    // Vignette
    vignetteStrength: 0.45,    // 0..1
    vignetteSoftness: 0.70,    // 0..1

    // Pulse
    pulseEnabled: true,
    pulseStrength: 0.22,       // 0..1
    pulseRate: 0.55,           // 0..2 (breathing cadence)

    // Faction tinting (DEFAULT ON)
    factionTintEnabled: true,
    factionTintStrength: 0.22, // 0..0.6

    // Safety
    centerClearBias: 0.55,     // 0..0.9 higher keeps center clearer
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
    { key: 'fogSpeed', label: 'Fog Speed', type: 'range', min: 0, max: 1.5, step: 0.01, default: 0.20 },
    { key: 'fogInset', label: 'Fog Inset', type: 'range', min: 0.15, max: 0.65, step: 0.01, default: 0.38 },
    { key: 'fogSoftness', label: 'Fog Softness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'fogGrain', label: 'Fog Grain', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'fogSwirl', label: 'Fog Swirl', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },

    // Vignette
    { key: 'vignetteStrength', label: 'Vignette Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'vignetteSoftness', label: 'Vignette Softness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.70 },

    // Pulse
    { key: 'pulseEnabled', label: 'Enable Pulse', type: 'checkbox', default: true },
    { key: 'pulseStrength', label: 'Pulse Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22 },
    { key: 'pulseRate', label: 'Pulse Rate', type: 'range', min: 0, max: 2, step: 0.01, default: 0.55 },

    // Faction tinting
    { key: 'factionTintEnabled', label: 'Faction Tinting', type: 'checkbox', default: true },
    { key: 'factionTintStrength', label: 'Tint Strength', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.22 },

    // Safety
    { key: 'centerClearBias', label: 'Center Clear Bias', type: 'range', min: 0, max: 0.9, step: 0.01, default: 0.55 },
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
  c.dataset.style = styleKey || 'watcherVeil';
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

// Cheap hash-noise (stable, fast)
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
  // Low-res field for perf
  const scale = 0.12; // resolution factor
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

  // Grain + swirl parameters
  const grain = clamp01(cfg.fogGrain);
  const swirl = clamp01(cfg.fogSwirl);
  const density = clamp01(cfg.fogDensity) * (0.25 + 0.85 * hype01);
  const softness = clamp01(cfg.fogSoftness);

  const driftX = t * (0.18 + 1.20 * cfg.fogSpeed) * (0.35 + 0.85 * hype01);
  const driftY = t * (0.10 + 0.85 * cfg.fogSpeed) * (0.35 + 0.85 * hype01);

  // Tint (subtle)
  const tr = tintRgb?.r ?? 140;
  const tg = tintRgb?.g ?? 210;
  const tb = tintRgb?.b ?? 255;
  const tintA = clamp01(tintStrength) * (0.10 + 0.55 * hype01);

  const img = ctx.getImageData(0, 0, fw, fh);
  const data = img.data;

  // Sample frequency (lower = bigger blobs)
  const f1 = 0.045;
  const f2 = 0.085;

  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      // Edge mask in 0..1 (strong at edges, weak center)
      const em = edgeMaskFn(x / fw, y / fh);

      // Swirl domain warp
      const wx = (x + driftX * 40) * f1 + field.seed;
      const wy = (y + driftY * 40) * f1 + field.seed * 0.7;
      const warp = (smoothNoise(wx, wy) - 0.5) * 2 * swirl;

      const n1 = smoothNoise((x + driftX * 55) * f1 + warp, (y + driftY * 50) * f1 - warp);
      const n2 = smoothNoise((x - driftX * 35) * f2 - warp, (y + driftY * 30) * f2 + warp);

      // Fog value: combine + soften
      let v = (0.68 * n1 + 0.32 * n2);
      v = Math.pow(clamp01(v), lerp(1.8, 1.05, softness)); // softness -> less contrast

      // Edge weighting + density
      v *= em;
      v = clamp01((v - 0.35) * 1.35) * density;

      // Grain texture
      if (grain > 0.001) {
        const g = (hash2(x + field.seed * 1000, y + field.seed * 2000) - 0.5) * 2;
        v = clamp01(v + g * 0.10 * grain * (0.35 + 0.65 * em));
      }

      // Convert fog value to alpha
      const a = (v * 255) | 0;

      const idx = (y * fw + x) * 4;
      // Base fog is dark; tint is subtle
      const base = 14; // near-black
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

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // low-res fog field
  const fogField = {
    canvas: document.createElement('canvas'),
    ctx: null,
    fw: 0, fh: 0,
    seed: Math.random() * 1000,
  };
  fogField.ctx = fogField.canvas.getContext('2d', { alpha: true });

  // state
  let latestSnap = { factions: [] };
  let { h: hTarget, rgb: tintRgb } = computeBlendAndHype(latestSnap, cfg);
  let hSmooth = 0;
  let tintSmooth = { r: 140, g: 210, b: 255 };

  // loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;
    tintRgb = res.rgb;
  });

  function edgeMaskFactory(w, h, inset, centerClearBias) {
    // Returns function (u,v)->mask (1 at edges, 0-ish center)
    const ins = clamp(inset, 0.15, 0.65);
    const centerBias = clamp(centerClearBias, 0, 0.9);

    return (u, v) => {
      const dx = Math.min(u, 1 - u);
      const dy = Math.min(v, 1 - v);
      const d = Math.min(dx, dy); // 0 at edge, 0.5 center
      // map to 0..1 where 1 = edge
      let m = 1 - clamp01(d / ins);
      // keep center clearer
      m = Math.pow(m, lerp(1.15, 2.35, centerBias));
      return clamp01(m);
    };
  }

  function resize() {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initFogField(fogField, w, h, fogField.seed);
    return { w, h };
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

    const { w, h } = resize();
    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    // breathing pulse
    const pulseOn = !!cfg.pulseEnabled;
    const pulseRate = clamp(cfg.pulseRate, 0, 2);
    const pulseStrength = clamp01(cfg.pulseStrength);
    const breathe = pulseOn ? (0.5 + 0.5 * Math.sin(t * (0.75 + pulseRate * 1.35))) : 0;
    const pulse = pulseOn ? (breathe * breathe) * pulseStrength * (0.25 + 0.9 * hSmooth) : 0;

    // fog render
    if (cfg.fogEnabled) {
      const tintEnabled = !!cfg.factionTintEnabled;
      const tintStrength = tintEnabled ? clamp(cfg.factionTintStrength, 0, 0.6) : 0;

      const edgeMask = edgeMaskFactory(w, h, cfg.fogInset, cfg.centerClearBias);
      renderFogField(
        fogField,
        t,
        cfg,
        clamp01(hSmooth + pulse * 0.35),
        tintSmooth,
        tintStrength,
        edgeMask
      );

      // Composite fog upscaled
      ctx.save();
      // Lighter composite at higher hype, otherwise normal
      ctx.globalCompositeOperation = (hSmooth > 0.55) ? 'source-over' : 'source-over';
      const a = clamp01(0.35 + 0.55 * cfg.fogDensity) * (0.25 + 0.9 * hSmooth) * (0.85 + pulse * 0.35);
      ctx.globalAlpha = a;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fogField.canvas, 0, 0, w, h);
      ctx.restore();
    }

    // vignette
    const vig = clamp01(cfg.vignetteStrength) * lerp(0.65, 1.15, hSmooth) * (1 + pulse * 0.25);
    drawVignette(ctx, w, h, vig, cfg.vignetteSoftness);

    // ultra-subtle container drift (keeps it alive, very small)
    const drift = lerp(0.0, 2.0, hSmooth);
    container.style.transform = `translate3d(${(Math.sin(t * 0.7) * drift).toFixed(2)}px,${(Math.cos(t * 0.6) * drift).toFixed(2)}px,0)`;
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeBlendAndHype(latestSnap, cfg);
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
