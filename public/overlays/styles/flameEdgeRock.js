// public/overlays/styles/flameEdgeRock.js
// PRO Overlay: Flame Edge (Rock) + Dynamic Stem Audio (ROCKON001..005.wav)
// - Uses StemPack engine: /public/overlays/audio/stemPack.js
// - Audio reacts to hype (dynamic fade in/out) via setHype(h01)
// - Keeps overlay modular (no SSE logic here; only api.onMeters)

'use strict';

import { createStemPack } from '/public/overlays/audio/stemPack.js';

export const meta = {
  styleKey: 'flameEdgeRock',
  name: 'Flame Edge (Rock)',
  tier: 'PRO',
  controls: [
    { key: 'position', label: 'Position', type: 'select', default: 'bottom',
      options: [{ value: 'bottom', label: 'Bottom only' }, { value: 'edges', label: 'Edges (left/right + bottom)' }] },

    { key: 'intensityScale', label: 'Intensity Scale', type: 'number', default: 1.0, min: 0.1, max: 5, step: 0.1 },
    { key: 'maxThicknessPx', label: 'Max Thickness (px)', type: 'number', default: 90, min: 20, max: 240, step: 1 },
    { key: 'baseThicknessPx', label: 'Base Thickness (px)', type: 'number', default: 10, min: 2, max: 60, step: 1 },
    { key: 'glowBlurPx', label: 'Glow Blur (px)', type: 'number', default: 6, min: 0, max: 30, step: 1 },

    // perf knobs
    { key: 'fpsCap', label: 'FPS Cap', type: 'number', default: 60, min: 15, max: 120, step: 1 },
    { key: 'renderScale', label: 'Render Scale', type: 'number', default: 0.75, min: 0.35, max: 1.0, step: 0.01 },
    { key: 'dprCap', label: 'DPR Cap', type: 'number', default: 2.0, min: 1, max: 3, step: 0.1 },

    // hype tuning
    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', default: 140, min: 20, max: 600, step: 5 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', default: 1500, min: 200, max: 5000, step: 50 },

    // embers
    { key: 'emberRate', label: 'Ember Rate', type: 'number', default: 1.0, min: 0, max: 3, step: 0.1 },
    { key: 'emberMax', label: 'Max Embers', type: 'number', default: 220, min: 0, max: 1200, step: 10 },
    { key: 'emberSpawnCapPerFrame', label: 'Ember Spawn Cap / Frame', type: 'number', default: 90, min: 0, max: 250, step: 1 },

    { key: 'shockwaveStrength', label: 'Shockwave Strength', type: 'number', default: 1.0, min: 0, max: 2, step: 0.1 },
    { key: 'shakeMaxPx', label: 'Max Shake (px)', type: 'number', default: 4, min: 0, max: 16, step: 1 },

    // ---- Audio (PRO) ----
    { key: 'audioEnabled', label: 'Audio Enabled', type: 'select', default: true,
      options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }] },
    { key: 'audioPackId', label: 'Audio Pack ID', type: 'text', default: 'ROCKON' },
    { key: 'audioMasterVolume', label: 'Audio Master Volume', type: 'number', default: 0.70, min: 0, max: 1, step: 0.01 },
    { key: 'audioFadeInMs', label: 'Audio Fade In (ms)', type: 'number', default: 350, min: 30, max: 4000, step: 10 },
    { key: 'audioFadeOutMs', label: 'Audio Fade Out (ms)', type: 'number', default: 600, min: 30, max: 6000, step: 10 }
  ]
};

// ---------- utils ----------
function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(n) { return clamp(n, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

function hexToRgb(hex) {
  const s = String(hex || '').trim().replace('#', '');
  if (s.length === 3) return { r: parseInt(s[0] + s[0], 16), g: parseInt(s[1] + s[1], 16), b: parseInt(s[2] + s[2], 16) };
  if (s.length === 6) return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
  return { r: 255, g: 120, b: 60 };
}

function rgbToCss({ r, g, b }, a = 1) {
  return `rgba(${(clamp(r, 0, 255) + 0.5) | 0},${(clamp(g, 0, 255) + 0.5) | 0},${(clamp(b, 0, 255) + 0.5) | 0},${clamp(a, 0, 1)})`;
}

// cheap deterministic hash noise in [0..1)
function hash01(i) {
  let x = i | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return ((x >>> 0) % 1024) / 1024;
}

// ---------- hype + color ----------
function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 1500, 200, 5000);
  total = clamp(total, 0, maxTotalClamp);

  let r = 255, g = 120, b = 60;
  if (total > 0) {
    r = 0; g = 0; b = 0;
    for (const f of factions) {
      const m = Number(f?.meter) || 0;
      if (m <= 0) continue;
      const w = m / total;
      const c = hexToRgb(f?.colorHex);
      r += c.r * w; g += c.g * w; b += c.b * w;
    }
  }

  const k = clamp(cfg.hypeK ?? 140, 20, 600);
  let h = 1 - Math.exp(-total / k);
  h = clamp(h, 0, 1);

  // tiny floor so it never feels dead
  const hBoost = 0.10;
  h = clamp(h + (1 - h) * (hBoost * Math.min(1, total / 60)), 0, 1);

  return { total, h, rgb: { r, g, b } };
}

// ---------- main ----------
export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  // mutable cfg (so setConfig can tune live)
  let cfg = { ...(config || {}) };

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity';
  root.appendChild(container);

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.transform = 'translateZ(0)';
  canvas.style.willChange = 'transform, filter, opacity';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  // scaled internal render (perf knob)
  let vw = 1, vh = 1, dpr = 1, rs = 1;
  function resize() {
    dpr = clamp(window.devicePixelRatio || 1, 1, clamp(cfg.dprCap ?? 2.0, 1, 3));
    rs = clamp(cfg.renderScale ?? 0.75, 0.35, 1.0);

    vw = Math.max(1, window.innerWidth | 0);
    vh = Math.max(1, window.innerHeight | 0);

    canvas.width = Math.max(1, (vw * dpr * rs) | 0);
    canvas.height = Math.max(1, (vh * dpr * rs) | 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // state from meters
  let latestSnap = { factions: [] };
  let blend = computeBlendAndHype(latestSnap, cfg);

  // smoothers
  let hSmooth = 0;
  let totalSmooth = 0;
  let colorSmooth = { r: 255, g: 120, b: 60 };

  // ---- embers: fixed pool + cached sprite ----
  const embers = [];
  let emberCarry = 0;

  // base white ember sprite
  const emberSprite = document.createElement('canvas');
  emberSprite.width = 64;
  emberSprite.height = 64;
  const ectx = emberSprite.getContext('2d');
  (function buildEmberSprite() {
    ectx.clearRect(0, 0, 64, 64);
    const cx = 32, cy = 32;
    const g = ectx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ectx.fillStyle = g;
    ectx.beginPath();
    ectx.arc(cx, cy, 28, 0, Math.PI * 2);
    ectx.fill();
  })();

  // cache tinted ember sprites by quantized RGB (reduces per-ember work)
  const emberTintCache = new Map();
  function getTintedEmber(r, g, b) {
    const rr = (clamp(r, 0, 255) | 0) & 0xF0;
    const gg = (clamp(g, 0, 255) | 0) & 0xF0;
    const bb = (clamp(b, 0, 255) | 0) & 0xF0;
    const key = (rr << 16) | (gg << 8) | bb;
    const hit = emberTintCache.get(key);
    if (hit) return hit;

    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const tctx = c.getContext('2d');
    tctx.drawImage(emberSprite, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = `rgb(${rr},${gg},${bb})`;
    tctx.fillRect(0, 0, 64, 64);
    tctx.globalCompositeOperation = 'source-over';

    emberTintCache.set(key, c);

    // keep cache bounded
    if (emberTintCache.size > 64) {
      const firstKey = emberTintCache.keys().next().value;
      emberTintCache.delete(firstKey);
    }
    return c;
  }

  function spawnEmber(band, tSeed) {
    const x = band.x0 + hash01(tSeed + 1) * band.w;
    const y = band.y0 + band.h * (0.35 + 0.40 * hash01(tSeed + 2));
    const up = band.dir;

    const speed = lerp(40, 260, hSmooth) * (0.6 + 0.8 * hash01(tSeed + 3));
    const vx = (up.x * speed + (hash01(tSeed + 4) - 0.5) * 140) / 60;
    const vy = (up.y * speed + (hash01(tSeed + 5) - 0.5) * 80) / 60;

    const life = lerp(0.45, 1.35, hSmooth) * (0.7 + 0.6 * hash01(tSeed + 6));
    const size = lerp(1.0, 3.4, hSmooth) * (0.7 + 0.8 * hash01(tSeed + 7));

    const base = colorSmooth;
    const hot = {
      r: clamp(base.r + 90 + 60 * hash01(tSeed + 8), 0, 255),
      g: clamp(base.g + 70 + 80 * hash01(tSeed + 9), 0, 255),
      b: clamp(base.b + 10 + 30 * hash01(tSeed + 10), 0, 255),
    };

    embers.push({ x, y, vx, vy, life, age: 0, size, r: hot.r, g: hot.g, b: hot.b });
  }

  // turbulence (kept, but no RNG inside)
  function turb(x, t) {
    const a = Math.sin(x * 0.012 + t * 1.20);
    const b = Math.sin(x * 0.020 - t * 1.65);
    const c = Math.sin(x * 0.045 + t * 0.80);
    const d = Math.sin(x * 0.090 - t * 2.05);
    return (a * 0.45 + b * 0.30 + c * 0.18 + d * 0.07);
  }

  function drawFlameBand(params, tSec, tier, glowPx, alpha, baseCss, hotCss, sharedGrad) {
    const { x0, y0, w, h, vertical, flip } = params;

    const stepPx = clamp(lerp(10, 5, hSmooth), 5, 12);
    const steps = Math.max(8, (w / stepPx) | 0);

    ctx.globalAlpha = alpha;
    ctx.beginPath();

    if (!vertical) {
      const baseY = y0 + h;
      ctx.moveTo(x0, baseY);

      for (let i = 0; i <= steps; i++) {
        const x = x0 + (i / steps) * w;
        const n = turb(x, tSec) * 0.5 + turb(x * 1.7, tSec * 1.3) * 0.35 + turb(x * 2.4, tSec * 0.7) * 0.15;

        const flicker = (hash01((i + (tSec * 120) | 0) ^ 0x9e3779b9) - 0.5) * lerp(0.02, 0.10, hSmooth);

        const amp = lerp(0.18, 0.62, hSmooth) * (1 + 0.15 * tier);
        const height = h * (0.35 + amp * (0.55 + 0.45 * n + flicker));

        const y = baseY - clamp(height, h * 0.10, h * 0.98);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(x0 + w, baseY);
      ctx.closePath();
    } else {
      const baseX = flip ? (x0 + w) : x0;
      const inward = flip ? -1 : 1;

      ctx.moveTo(baseX, y0);

      for (let i = 0; i <= steps; i++) {
        const y = y0 + (i / steps) * h;
        const n = turb(y, tSec) * 0.5 + turb(y * 1.7, tSec * 1.25) * 0.35 + turb(y * 2.4, tSec * 0.72) * 0.15;

        const flicker = (hash01((i + (tSec * 120) | 0) ^ 0x85ebca6b) - 0.5) * lerp(0.02, 0.10, hSmooth);

        const amp = lerp(0.18, 0.62, hSmooth) * (1 + 0.15 * tier);
        const width = w * (0.35 + amp * (0.55 + 0.45 * n + flicker));

        const x = baseX + inward * clamp(width, w * 0.10, w * 0.98);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(baseX, y0 + h);
      ctx.closePath();
    }

    // fill core
    sharedGrad.base.addColorStop(0.12, baseCss);
    sharedGrad.base.addColorStop(0.48, hotCss);
    ctx.fillStyle = sharedGrad.base;
    ctx.fill();

    // glow pass
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = glowPx;
    ctx.globalAlpha = alpha * lerp(0.22, 0.70, hSmooth);
    ctx.fillStyle = sharedGrad.base;
    ctx.fill();
    ctx.restore();
  }

  // ---- audio (PRO, correct StemPack API) ----
  let stemPack = null;
  let audioInitInFlight = false;

  function getAudioCfg() {
    return {
      enabled: !!cfg.audioEnabled,
      packId: String(cfg.audioPackId || '').trim(),
      volume: clamp(cfg.audioMasterVolume ?? 0.70, 0, 1),
      fadeInMs: clamp(cfg.audioFadeInMs ?? 350, 30, 4000),
      fadeOutMs: clamp(cfg.audioFadeOutMs ?? 600, 30, 6000),
    };
  }

  async function ensureAudio(h01) {
    const acfg = getAudioCfg();

    // Disabled or missing pack: tear down
    if (!acfg.enabled || !acfg.packId) {
      if (stemPack) {
        try { stemPack.destroy(); } catch {}
        stemPack = null;
      }
      return;
    }

    // Already running: drive it
    if (stemPack) {
      try { stemPack.setMasterVolume(acfg.volume); } catch {}
      try { stemPack.setHype(clamp01(h01)); } catch {}
      return;
    }

    // Init once
    if (audioInitInFlight) return;
    audioInitInFlight = true;

    try {
      stemPack = await createStemPack({
        packId: acfg.packId,
        baseUrl: '/public/overlays/audio',
        options: {
          maxStems: 5,
          masterVolume: acfg.volume,
          fadeInMs: acfg.fadeInMs,
          fadeOutMs: acfg.fadeOutMs,
          thresholds: [0.0, 0.20, 0.40, 0.65, 0.85],
          fileExt: 'wav',
          loop: true,
          stopAtFirstMissing: true,
        },
      });

      await stemPack.start();
      stemPack.setHype(clamp01(h01));
    } catch (e) {
      console.warn('[flameEdgeRock audio] init failed:', e);
      try { stemPack?.destroy?.(); } catch {}
      stemPack = null;
    } finally {
      audioInitInFlight = false;
    }
  }

  function teardownAudio() {
    audioInitInFlight = false;
    if (stemPack) {
      try { stemPack.destroy(); } catch {}
      stemPack = null;
    }
  }

  // ---- render loop with fps cap ----
  let raf = 0;
  let lastTs = 0;
  let acc = 0;
  let emberSeed = 1337;

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dtRaw = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;

    const fpsCap = clamp(cfg.fpsCap ?? 60, 15, 120);
    const step = 1 / fpsCap;
    acc += dtRaw;
    if (acc < step) return;
    const dt = Math.min(0.033, acc);
    acc = 0;

    // update targets
    const { total, h, rgb } = blend;

    // smoothing
    const hLerp = 1 - Math.pow(0.0001, dt);
    hSmooth = lerp(hSmooth, h, 0.10 + 0.25 * hLerp);

    totalSmooth = lerp(totalSmooth, total, 0.08 + 0.20 * hLerp);
    colorSmooth.r = lerp(colorSmooth.r, rgb.r, 0.08 + 0.22 * hLerp);
    colorSmooth.g = lerp(colorSmooth.g, rgb.g, 0.08 + 0.22 * hLerp);
    colorSmooth.b = lerp(colorSmooth.b, rgb.b, 0.08 + 0.22 * hLerp);

    // audio: dynamic stems track smoothed hype
    void ensureAudio(hSmooth);

    const tier = (hSmooth >= 0.70) ? 3 : (hSmooth >= 0.35) ? 2 : (hSmooth >= 0.10) ? 1 : 0;

    const intensityScale = clamp(cfg.intensityScale ?? 1.0, 0.1, 5);
    const maxThicknessPx = clamp(cfg.maxThicknessPx ?? 90, 20, 240);
    const baseThicknessPx = clamp(cfg.baseThicknessPx ?? 10, 2, 60);
    const glowBlurPx = clamp(cfg.glowBlurPx ?? 6, 0, 30);
    const shockwaveStrength = clamp(cfg.shockwaveStrength ?? 1.0, 0, 2);
    const shakeMaxPx = clamp(cfg.shakeMaxPx ?? 4, 0, 16);

    const thickness = clamp(
      baseThicknessPx + (maxThicknessPx - baseThicknessPx) * smoothstep(0.00, 1.00, Math.pow(hSmooth, 0.85)) * intensityScale,
      baseThicknessPx,
      maxThicknessPx
    );

    const alpha = clamp(lerp(0.25, 0.95, smoothstep(0.00, 1.00, hSmooth)), 0.15, 0.98);
    const glow = clamp(glowBlurPx + lerp(2, 18, Math.pow(hSmooth, 0.9)) * intensityScale, 0, 32);

    const speed = lerp(0.55, 2.8, Math.pow(hSmooth, 1.1)) * (1 + 0.10 * tier);
    const tSec = (ts / 1000) * speed;

    // shake (tier3)
    if (tier === 3 && shakeMaxPx > 0) {
      const shakeAmt = shakeMaxPx * smoothstep(0.70, 1.00, hSmooth);
      const sx = (hash01((ts | 0) ^ 0x51ed) - 0.5) * shakeAmt;
      const sy = (hash01(((ts | 0) + 999) ^ 0x9f37) - 0.5) * shakeAmt * 0.7;
      const rot = (hash01(((ts | 0) + 222) ^ 0x7f4a) - 0.5) * 0.6 * smoothstep(0.75, 1.00, hSmooth);
      container.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg)`;
    } else {
      container.style.transform = 'translateZ(0)';
    }

    // clear + scale to viewport coords
    const w = canvas.width;
    const hpx = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, hpx);

    // draw in CSS px coordinates
    const sx = (w / vw);
    const sy = (hpx / vh);
    ctx.scale(sx, sy);

    const position = (cfg.position === 'edges') ? 'edges' : 'bottom';
    const bottomBand = { x0: 0, y0: vh - thickness, w: vw, h: thickness, dir: { x: 0, y: -1 } };
    const sideW = thickness;
    const leftBand = { x0: 0, y0: 0, w: sideW, h: vh, dir: { x: 1, y: 0 } };
    const rightBand = { x0: vw - sideW, y0: 0, w: sideW, h: vh, dir: { x: -1, y: 0 } };

    const baseA = rgbToCss(colorSmooth, clamp(0.55 + 0.35 * hSmooth, 0.35, 0.92));
    const boost = smoothstep(0.10, 1.00, hSmooth);
    const hotRgb = {
      r: clamp(colorSmooth.r + 70 + 90 * boost, 0, 255),
      g: clamp(colorSmooth.g + 55 + 120 * boost, 0, 255),
      b: clamp(colorSmooth.b + 10 + 40 * boost, 0, 255),
    };
    const hotA = rgbToCss(hotRgb, clamp(0.75 + 0.20 * boost, 0.6, 0.98));

    // shared gradients
    const shared = { base: null };
    shared.base = ctx.createLinearGradient(0, bottomBand.y0 + bottomBand.h, 0, bottomBand.y0);
    shared.base.addColorStop(0.00, 'rgba(0,0,0,0)');
    shared.base.addColorStop(0.82, 'rgba(255,255,255,0.82)');
    shared.base.addColorStop(1.00, 'rgba(255,255,255,0.00)');

    drawFlameBand(
      { x0: bottomBand.x0, y0: bottomBand.y0, w: bottomBand.w, h: bottomBand.h, vertical: false, flip: false },
      tSec, tier, glow, alpha, baseA, hotA, shared
    );

    if (position === 'edges') {
      const sharedSide = { base: ctx.createLinearGradient(leftBand.x0, 0, leftBand.x0 + leftBand.w, 0) };
      sharedSide.base.addColorStop(0.00, 'rgba(0,0,0,0)');
      sharedSide.base.addColorStop(0.82, 'rgba(255,255,255,0.82)');
      sharedSide.base.addColorStop(1.00, 'rgba(255,255,255,0.00)');

      drawFlameBand(
        { x0: leftBand.x0, y0: leftBand.y0, w: leftBand.w, h: leftBand.h, vertical: true, flip: false },
        tSec, tier, glow, alpha * 0.90, baseA, hotA, sharedSide
      );

      drawFlameBand(
        { x0: rightBand.x0, y0: rightBand.y0, w: rightBand.w, h: rightBand.h, vertical: true, flip: true },
        tSec, tier, glow, alpha * 0.90, baseA, hotA, sharedSide
      );
    }

    // embers spawn
    const emberRate = clamp(cfg.emberRate ?? 1.0, 0, 3);
    const emberMax = (clamp(cfg.emberMax ?? 220, 0, 1200) | 0);
    const spawnCap = (clamp(cfg.emberSpawnCapPerFrame ?? 90, 0, 250) | 0);

    if (tier >= 2 && emberMax > 0 && emberRate > 0) {
      const basePerSec = lerp(0.6, 18.0, Math.pow(hSmooth, 1.6)) * (tier === 3 ? 1.15 : 1.0);
      emberCarry += basePerSec * emberRate * dt;

      let spawn = emberCarry | 0;
      if (spawn > 0) emberCarry -= spawn;
      if (spawnCap > 0) spawn = Math.min(spawn, spawnCap);

      const bands = (position === 'edges') ? [bottomBand, leftBand, rightBand] : [bottomBand];
      for (let i = 0; i < spawn; i++) {
        if (embers.length >= emberMax) break;
        const band = bands[(hash01((emberSeed + i) ^ 0xabc) * bands.length) | 0];
        spawnEmber(band, (emberSeed += 11));
      }
    }

    // embers draw
    if (embers.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;

      for (let i = embers.length - 1; i >= 0; i--) {
        const p = embers[i];
        p.age += dt;
        if (p.age >= p.life) { embers.splice(i, 1); continue; }

        p.x += p.vx * 60 * dt;
        p.y += p.vy * 60 * dt;

        p.vx *= (1 - 0.6 * dt);
        p.vy *= (1 - 0.35 * dt);
        p.vy -= lerp(0.18, 0.55, hSmooth) * dt;

        const t = p.age / p.life;
        const fade = (1 - t) * (1 - t);
        const s = p.size * (0.85 + 0.55 * (1 - t));
        const a = clamp(0.65 * fade + 0.25 * hSmooth, 0, 0.95);

        const sprite = getTintedEmber(p.r, p.g, p.b);
        const drawSize = s * 8;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, p.x - drawSize * 0.5, p.y - drawSize * 0.5, drawSize, drawSize);
      }

      ctx.restore();
    }

    // subtle tier 3 pulse bloom
    if (tier === 3 && shockwaveStrength > 0) {
      // (kept light; no heavy extra allocations)
      const pA = smoothstep(0.70, 1.00, hSmooth) * 0.10 * shockwaveStrength;
      if (pA > 0.001) {
        ctx.save();
        ctx.globalAlpha = clamp(pA, 0, 0.25);
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = clamp(lerp(10, 28, hSmooth), 8, 30);

        const bloomH = thickness * lerp(1.8, 2.8, hSmooth);
        const bloomGrad = ctx.createLinearGradient(0, vh, 0, vh - bloomH);
        bloomGrad.addColorStop(0.0, rgbToCss(colorSmooth, 0.0));
        bloomGrad.addColorStop(0.25, rgbToCss(colorSmooth, 0.25));
        bloomGrad.addColorStop(0.75, 'rgba(255,255,255,0.14)');
        bloomGrad.addColorStop(1.0, 'rgba(255,255,255,0.00)');
        ctx.fillStyle = bloomGrad;
        ctx.fillRect(0, vh - bloomH, vw, bloomH);

        ctx.restore();
      }
    }

    container.style.opacity = (tier === 0) ? '0.65' : '1.0';
  }

  // meters subscription
  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    blend = computeBlendAndHype(latestSnap, cfg);
  });

  function setConfig(next) {
    if (next && typeof next === 'object') {
      cfg = { ...cfg, ...next };
      resize();
      // live volume updates are supported; fade timings are applied at creation time (simple v1).
      if (stemPack) {
        try { stemPack.setMasterVolume(clamp(cfg.audioMasterVolume ?? 0.70, 0, 1)); } catch {}
        try { stemPack.setHype(clamp01(hSmooth)); } catch {}
      }
      // if disabled mid-stream, tear down
      if (!String(cfg.audioPackId || '').trim() || !cfg.audioEnabled) {
        teardownAudio();
      }
      blend = computeBlendAndHype(latestSnap, cfg);
    }
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', resize); } catch {}
    teardownAudio();
    embers.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  // kick
  raf = requestAnimationFrame(frame);
  blend = computeBlendAndHype({ factions: [] }, cfg);

  return { destroy, setConfig };
}
