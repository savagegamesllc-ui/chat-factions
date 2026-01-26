// public/overlays/styles/flameEdge.js
'use strict';

import { createStemPack } from '/public/overlays/audio/stemPack.js';

/**
 * Flame Edge (fire-like)
 * - Computes total hype = sum(snap.factions[].meter)
 * - Maps total -> h in [0..1] via compressing curve: h = 1 - exp(-total / k)
 * - Fire band renders via a single <canvas> (OBS-safe, no DOM churn)
 * - Visual tiers:
 *   Tier 0 (h < 0.10): subtle ember glow + thin flame lick
 *   Tier 1 (0.10–0.35): thicker/brighter, faster turbulence
 *   Tier 2 (0.35–0.70): embers/sparks spawn + shimmer
 *   Tier 3 (0.70–1.00): big glow, shock pulses, mild camera shake
 */

export const meta = {
  styleKey: 'flameEdge',
  name: 'Flame Edge',
  tier: 'PRO',
  controls: [
    {
      key: 'position',
      label: 'Position',
      type: 'select',
      default: 'bottom',
      options: [
        { value: 'bottom', label: 'Bottom only' },
        { value: 'edges', label: 'Edges (left/right + bottom)' }
      ]
    },
    {
      key: 'intensityScale',
      label: 'Intensity Scale',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 5,
      step: 0.1
    },
    {
      key: 'maxThicknessPx',
      label: 'Max Thickness (px)',
      type: 'number',
      default: 90,
      min: 20,
      max: 240,
      step: 1
    },
    {
      key: 'baseThicknessPx',
      label: 'Base Thickness (px)',
      type: 'number',
      default: 10,
      min: 2,
      max: 60,
      step: 1
    },
    {
      key: 'glowBlurPx',
      label: 'Glow Blur (px)',
      type: 'number',
      default: 6,
      min: 0,
      max: 30,
      step: 1
    },

    // ---- New knobs (appended) ----
    {
      key: 'hypeK',
      label: 'Hype Scale (k)',
      type: 'number',
      default: 140,
      min: 20,
      max: 600,
      step: 5
    },
    {
      key: 'maxTotalClamp',
      label: 'Max Total Clamp',
      type: 'number',
      default: 1500,
      min: 200,
      max: 5000,
      step: 50
    },
    {
      key: 'emberRate',
      label: 'Ember Rate',
      type: 'number',
      default: 1.0,
      min: 0,
      max: 3,
      step: 0.1
    },
    {
      key: 'emberMax',
      label: 'Max Embers',
      type: 'number',
      default: 220,
      min: 0,
      max: 800,
      step: 10
    },
    {
      key: 'shockwaveStrength',
      label: 'Shockwave Strength',
      type: 'number',
      default: 1.0,
      min: 0,
      max: 2,
      step: 0.1
    },
    {
      key: 'shakeMaxPx',
      label: 'Max Shake (px)',
      type: 'number',
      default: 4,
      min: 0,
      max: 16,
      step: 1
    }
,
// ---- Audio (PRO) ----
{
  key: 'audioEnabled',
  label: 'Audio Enabled',
  type: 'select',
  default: false,
  options: [
    { value: true, label: 'On' },
    { value: false, label: 'Off' }
  ]
},
{
  key: 'audioPackId',
  label: 'Audio Pack ID',
  type: 'text',
  default: ''
},
{
  key: 'audioMasterVolume',
  label: 'Audio Master Volume',
  type: 'number',
  default: 0.70,
  min: 0,
  max: 1,
  step: 0.01
},
{
  key: 'audioFadeInMs',
  label: 'Audio Fade In (ms)',
  type: 'number',
  default: 350,
  min: 30,
  max: 4000,
  step: 10
},
{
  key: 'audioFadeOutMs',
  label: 'Audio Fade Out (ms)',
  type: 'number',
  default: 600,
  min: 30,
  max: 6000,
  step: 10
}

  ]
};

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function clamp01(n) {
  return clamp(n, 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  const s = String(hex || '').trim();
  const m = s.replace('#', '');
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    return { r, g, b };
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 255, g: 120, b: 60 };
}

function rgbToCss({ r, g, b }, a = 1) {
  const rr = Math.round(clamp(r, 0, 255));
  const gg = Math.round(clamp(g, 0, 255));
  const bb = Math.round(clamp(b, 0, 255));
  const aa = clamp(a, 0, 1);
  return `rgba(${rr}, ${gg}, ${bb}, ${aa})`;
}

/**
 * Standard utility block (as requested):
 * Returns blended faction color + total hype + normalized h + flame-friendly CSS colors.
 */
function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  // --- total hype ---
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }

  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 1500, 200, 5000);
  total = clamp(total, 0, maxTotalClamp);

  // --- weighted color blend ---
  let r = 0, g = 0, b = 0;
  if (total > 0) {
    for (const f of factions) {
      const m = Number(f?.meter) || 0;
      if (m <= 0) continue;
      const w = m / total;
      const c = hexToRgb(f?.colorHex);
      r += c.r * w;
      g += c.g * w;
      b += c.b * w;
    }
  } else {
    r = 255; g = 120; b = 60;
  }

  // --- compressing hype curve ---
  // Defaults tuned so:
  // total 50  -> h ~ 0.30
  // total 100 -> h ~ 0.51
  // total 300 -> h ~ 0.88
  // total 500 -> h ~ 0.97
  const k = clamp(cfg.hypeK ?? 140, 20, 600);
  let h = 1 - Math.exp(-total / k);

  // keep tiny hype visible
  h = clamp(h, 0, 1);
  const hBoost = 0.10; // small floor curve, subtle
  h = clamp(h + (1 - h) * (hBoost * Math.min(1, total / 60)), 0, 1);

  // Make “flame” palettes: base = blended, hot = pushed towards yellow-white
  // We bias hot towards (255, 220, 120) at high h (still influenced by faction blend).
  const hotTarget = { r: 255, g: 220, b: 120 };
  const hotMix = smoothstep(0.10, 0.95, h);
  const hotRgb = {
    r: lerp(r, hotTarget.r, 0.45 + 0.35 * hotMix),
    g: lerp(g, hotTarget.g, 0.45 + 0.35 * hotMix),
    b: lerp(b, hotTarget.b, 0.20 + 0.20 * hotMix),
  };

  // CSS strings used for gradients / particles
  const baseColorCss = rgbToCss({ r, g, b }, 1);
  const hotColorCss = rgbToCss(hotRgb, 1);

  return {
    total,
    h,
    rgb: { r, g, b },
    baseColorCss,
    hotColorCss
  };
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const position = (config.position === 'edges') ? 'edges' : 'bottom';

  // Existing knobs (kept)
  const intensityScale = clamp(config.intensityScale ?? 1.0, 0.1, 5);
  const maxThicknessPx = clamp(config.maxThicknessPx ?? 90, 20, 240);
  const baseThicknessPx = clamp(config.baseThicknessPx ?? 10, 2, 60);
  const glowBlurPx = clamp(config.glowBlurPx ?? 6, 0, 30);

  // New knobs
  const emberRate = clamp(config.emberRate ?? 1.0, 0, 3);
  const emberMax = Math.round(clamp(config.emberMax ?? 220, 0, 800));
  const shockwaveStrength = clamp(config.shockwaveStrength ?? 1.0, 0, 2);
  const shakeMaxPx = clamp(config.shakeMaxPx ?? 4, 0, 16);

  // DOM: single container + canvas (no per-update nodes)
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity';

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.transform = 'translateZ(0)';
  canvas.style.willChange = 'transform, filter, opacity';

  container.appendChild(canvas);
  root.appendChild(container);

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let vw = 0, vh = 0, dpr = 1;
  function resize() {
    dpr = clamp(window.devicePixelRatio || 1, 1, 2); // cap DPR for perf
    vw = Math.max(1, Math.floor(window.innerWidth));
    vh = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Live snapshot state (updated only in onMeters)
  let latestSnap = { factions: [] };
  let blendState = computeBlendAndHype(latestSnap, config);

  // Smooth towards targets
  let hSmooth = 0;
  let totalSmooth = 0;
  let colorSmooth = { r: 255, g: 120, b: 60 };

  // Embers: fixed-size pool
  const embers = [];
  function spawnEmber(band) {
    // band: { x0, y0, w, h, dir } where dir indicates upward direction
    // Spawn from near the flame top edge
    const x = band.x0 + Math.random() * band.w;
    const y = band.y0 + band.h * (0.35 + 0.40 * Math.random());
    const up = band.dir; // {x,y} unit-ish

    // Velocity: mostly upward with some sideways drift
    const speed = lerp(40, 260, hSmooth) * (0.6 + 0.8 * Math.random());
    const vx = (up.x * speed + (Math.random() - 0.5) * 140) / 60;
    const vy = (up.y * speed + (Math.random() - 0.5) * 80) / 60;

    // Life and size scale with hype (cap)
    const life = lerp(0.45, 1.35, hSmooth) * (0.7 + 0.6 * Math.random());
    const size = lerp(1.0, 3.4, hSmooth) * (0.7 + 0.8 * Math.random());

    // Ember color: hot, with slight randomization
    const base = colorSmooth;
    const hot = {
      r: clamp(base.r + 90 + 60 * Math.random(), 0, 255),
      g: clamp(base.g + 70 + 80 * Math.random(), 0, 255),
      b: clamp(base.b + 10 + 30 * Math.random(), 0, 255),
    };

    embers.push({
      x, y,
      vx, vy,
      life,
      age: 0,
      size,
      r: hot.r,
      g: hot.g,
      b: hot.b
    });
  }

  // Simple 1D “turbulence” (cheap): sum of sines + hashy jitter
  function turb(x, t) {
    const a = Math.sin(x * 0.012 + t * 1.20);
    const b = Math.sin(x * 0.020 - t * 1.65);
    const c = Math.sin(x * 0.045 + t * 0.80);
    const d = Math.sin(x * 0.090 - t * 2.05);
    return (a * 0.45 + b * 0.30 + c * 0.18 + d * 0.07);
  }

  function drawFlameBand({ x0, y0, w, h, vertical, flip }, tSec, tier, glowPx, alpha, baseCss, hotCss) {
    // vertical=false => bottom band (flames rise upward)
    // vertical=true  => side band (flames push inward)
    // flip controls left/right mirroring

    const stepPx = clamp(lerp(10, 5, hSmooth), 5, 12); // higher hype => more detail
    const steps = Math.max(8, Math.floor(w / stepPx));

    ctx.save();
    ctx.globalAlpha = alpha;

    // Build flame silhouette path
    ctx.beginPath();

    if (!vertical) {
      // Bottom: baseline at y0 + h (bottom edge), flame tips go upward
      const baseY = y0 + h;
      ctx.moveTo(x0, baseY);

      for (let i = 0; i <= steps; i++) {
        const x = x0 + (i / steps) * w;
        const n = turb(x, tSec) * 0.5 + turb(x * 1.7, tSec * 1.3) * 0.35 + turb(x * 2.4, tSec * 0.7) * 0.15;

        // stronger movement at higher tiers
        const flicker = (Math.random() - 0.5) * lerp(0.02, 0.10, hSmooth);
        const amp = lerp(0.18, 0.62, hSmooth) * (1 + 0.15 * tier);
        const height = h * (0.35 + amp * (0.55 + 0.45 * n + flicker));

        const y = baseY - clamp(height, h * 0.10, h * 0.98);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(x0 + w, baseY);
      ctx.closePath();
    } else {
      // Side: baseline at x0 (edge), flame tips go inward towards x0+w
      // flip: false => left edge grows rightward; true => right edge grows leftward
      const baseX = flip ? (x0 + w) : x0;
      const inward = flip ? -1 : 1;

      ctx.moveTo(baseX, y0);

      for (let i = 0; i <= steps; i++) {
        const y = y0 + (i / steps) * h;
        const n = turb(y, tSec) * 0.5 + turb(y * 1.7, tSec * 1.25) * 0.35 + turb(y * 2.4, tSec * 0.72) * 0.15;
        const flicker = (Math.random() - 0.5) * lerp(0.02, 0.10, hSmooth);
        const amp = lerp(0.18, 0.62, hSmooth) * (1 + 0.15 * tier);
        const width = w * (0.35 + amp * (0.55 + 0.45 * n + flicker));

        const x = baseX + inward * clamp(width, w * 0.10, w * 0.98);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(baseX, y0 + h);
      ctx.closePath();
    }

    // Fill flame (core)
    const grad = (!vertical)
      ? ctx.createLinearGradient(0, y0 + h, 0, y0)
      : ctx.createLinearGradient(x0, 0, x0 + w, 0);

    // Fire-like ramp: transparent -> base -> hot -> near-white tips
    grad.addColorStop(0.00, 'rgba(0,0,0,0)');
    grad.addColorStop(0.12, baseCss);
    grad.addColorStop(0.48, hotCss);
    grad.addColorStop(0.82, 'rgba(255,255,255,0.82)');
    grad.addColorStop(1.00, 'rgba(255,255,255,0.00)');

    ctx.fillStyle = grad;
    ctx.fill();

    // Glow pass (cheap): blur + lighter composite
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${glowPx}px)`;
    ctx.globalAlpha = alpha * lerp(0.25, 0.75, hSmooth);
    ctx.fillStyle = grad;
    ctx.fill();

    // Reset
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Shockwave pulses at Tier 3 (throttled)
  let pulse = 0;          // 0..1
  let pulseVel = 0;
  let pulseCooldown = 0;

  function kickPulse(amount) {
    pulseVel += amount;
  }

  let raf = 0;
  let lastTs = 0;

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;

    // Pull current targets
    const { total, h, rgb, baseColorCss, hotColorCss } = blendState;

    // Smooth hype / color
    const hLerp = 1 - Math.pow(0.0001, dt); // stable smoothing
    hSmooth = lerp(hSmooth, h, 0.10 + 0.25 * hLerp);

    // Keep audio tracking smoothed hype (dynamic stems)
    if (getAudioCfg().enabled) {
      void ensureAudioStarted(hSmooth);
    } else if (stemPack) {
      teardownAudio();
    }

    totalSmooth = lerp(totalSmooth, total, 0.08 + 0.20 * hLerp);
    colorSmooth.r = lerp(colorSmooth.r, rgb.r, 0.08 + 0.22 * hLerp);
    colorSmooth.g = lerp(colorSmooth.g, rgb.g, 0.08 + 0.22 * hLerp);
    colorSmooth.b = lerp(colorSmooth.b, rgb.b, 0.08 + 0.22 * hLerp);

    // Tier thresholds
    const tier0 = hSmooth < 0.10;
    const tier1 = hSmooth >= 0.10 && hSmooth < 0.35;
    const tier2 = hSmooth >= 0.35 && hSmooth < 0.70;
    const tier3 = hSmooth >= 0.70;

    const tier = tier3 ? 3 : tier2 ? 2 : tier1 ? 1 : 0;

    // Distinct changes as hype rises:
    // 1) thickness
    const thickness = clamp(
      baseThicknessPx + (maxThicknessPx - baseThicknessPx) * smoothstep(0.00, 1.00, Math.pow(hSmooth, 0.85)) * intensityScale,
      baseThicknessPx,
      maxThicknessPx
    );

    // 2) brightness/opacity
    const alpha = clamp(lerp(0.25, 0.95, smoothstep(0.00, 1.00, hSmooth)), 0.15, 0.98);

    // 3) glow/blur
    const glow = clamp(glowBlurPx + lerp(2, 18, Math.pow(hSmooth, 0.9)) * intensityScale, 0, 28);

    // 4) animation speed (turbulence time multiplier)
    const speed = lerp(0.55, 2.8, Math.pow(hSmooth, 1.1)) * (1 + 0.10 * tier);

    // 5) complexity (detail step + ember spawn + shimmer + pulse + shake)
    const tSec = (ts / 1000) * speed;

    // Mild camera shake at tier 3 (transform only; no layout thrash)
    if (tier3 && shakeMaxPx > 0) {
      const shakeAmt = shakeMaxPx * smoothstep(0.70, 1.00, hSmooth);
      const sx = (Math.random() - 0.5) * shakeAmt;
      const sy = (Math.random() - 0.5) * shakeAmt * 0.7;
      const rot = (Math.random() - 0.5) * 0.6 * smoothstep(0.75, 1.00, hSmooth);
      container.style.transform = `translate3d(${sx}px, ${sy}px, 0) rotate(${rot}deg)`;
    } else {
      container.style.transform = 'translateZ(0)';
    }

    // Canvas clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Use DPR scaling
    ctx.scale(dpr, dpr);

    // Bands geometry
    const bottomBand = { x0: 0, y0: vh - thickness, w: vw, h: thickness, dir: { x: 0, y: -1 } };

    // Optional side bands
    const sideW = thickness;
    const leftBand = { x0: 0, y0: 0, w: sideW, h: vh, dir: { x: 1, y: 0 } };
    const rightBand = { x0: vw - sideW, y0: 0, w: sideW, h: vh, dir: { x: -1, y: 0 } };

    // Compose base/hot CSS (slightly hype-animated)
    const baseA = rgbToCss(colorSmooth, clamp(0.55 + 0.35 * hSmooth, 0.35, 0.92));
    const hotA = (() => {
      // extra “fire hotness” beyond computeBlendAndHype when h is big
      const boost = smoothstep(0.10, 1.00, hSmooth);
      const hotRgb = {
        r: clamp(colorSmooth.r + 70 + 90 * boost, 0, 255),
        g: clamp(colorSmooth.g + 55 + 120 * boost, 0, 255),
        b: clamp(colorSmooth.b + 10 + 40 * boost, 0, 255),
      };
      return rgbToCss(hotRgb, clamp(0.75 + 0.20 * boost, 0.6, 0.98));
    })();

    // Draw flames (core + glow)
    drawFlameBand(
      { x0: bottomBand.x0, y0: bottomBand.y0, w: bottomBand.w, h: bottomBand.h, vertical: false, flip: false },
      tSec,
      tier,
      glow,
      alpha,
      baseA,
      hotA
    );

    if (position === 'edges') {
      drawFlameBand(
        { x0: leftBand.x0, y0: leftBand.y0, w: leftBand.w, h: leftBand.h, vertical: true, flip: false },
        tSec,
        tier,
        glow,
        alpha * 0.90,
        baseA,
        hotA
      );
      drawFlameBand(
        { x0: rightBand.x0, y0: rightBand.y0, w: rightBand.w, h: rightBand.h, vertical: true, flip: true },
        tSec,
        tier,
        glow,
        alpha * 0.90,
        baseA,
        hotA
      );
    }

    // Tier 2+: shimmer heat-haze layer
    if (!tier0 && (tier2 || tier3)) {
      const shimmerA = clamp(0.04 + 0.10 * smoothstep(0.35, 1.00, hSmooth), 0, 0.18);
      ctx.save();
      ctx.globalAlpha = shimmerA;
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${clamp(lerp(2, 10, hSmooth), 0, 12)}px)`;

      // bottom shimmer
      ctx.translate(0, vh - thickness * 1.25);
      const shimmerH = thickness * 1.25;
      const shimmerGrad = ctx.createLinearGradient(0, shimmerH, 0, 0);
      shimmerGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
      shimmerGrad.addColorStop(0.3, rgbToCss(colorSmooth, 0.30));
      shimmerGrad.addColorStop(0.7, 'rgba(255,255,255,0.20)');
      shimmerGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
      ctx.fillStyle = shimmerGrad;

      // wavy shimmer stripes
      const stripeCount = clamp(Math.floor(lerp(6, 18, hSmooth)), 4, 22);
      for (let i = 0; i < stripeCount; i++) {
        const phase = tSec * 1.7 + i * 0.8;
        const y = (i / stripeCount) * shimmerH;
        const amp = lerp(4, 18, hSmooth);
        const xOff = Math.sin(phase) * amp;
        ctx.fillRect(xOff, y, vw, Math.max(2, shimmerH / stripeCount - 1));
      }

      ctx.restore();
    }

    // Embers (Tier 2+)
    if ((tier2 || tier3) && emberMax > 0 && emberRate > 0) {
      // Spawn rate scales with hype (clamped)
      // ~ 0.5/s at tier2 start, up to ~ 18/s at high tier3 (before emberRate multiplier)
      const basePerSec = lerp(0.6, 18.0, Math.pow(hSmooth, 1.6));
      const perSec = basePerSec * emberRate * (tier3 ? 1.15 : 1.0);
      const spawnCount = Math.min(6, Math.floor(perSec * dt + Math.random())); // throttle
      const bands = position === 'edges' ? [bottomBand, leftBand, rightBand] : [bottomBand];

      for (let i = 0; i < spawnCount; i++) {
        if (embers.length >= emberMax) break;
        const band = bands[(Math.random() * bands.length) | 0];
        spawnEmber(band);
      }
    }

    // Update + draw embers
    if (embers.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const emberBlur = clamp(lerp(0, 2.8, hSmooth), 0, 3.5);
      ctx.filter = emberBlur > 0 ? `blur(${emberBlur}px)` : 'none';

      for (let i = embers.length - 1; i >= 0; i--) {
        const p = embers[i];
        p.age += dt;
        if (p.age >= p.life) {
          embers.splice(i, 1);
          continue;
        }
        p.x += p.vx * 60 * dt;
        p.y += p.vy * 60 * dt;

        // Drag + upward bias for "float"
        p.vx *= (1 - 0.6 * dt);
        p.vy *= (1 - 0.35 * dt);
        p.vy -= lerp(0.18, 0.55, hSmooth) * dt;

        const t = p.age / p.life;
        const fade = (1 - t) * (1 - t); // quadratic fade
        const s = p.size * (0.85 + 0.55 * (1 - t));

        const a = clamp(0.65 * fade + 0.25 * hSmooth, 0, 0.95);
        ctx.globalAlpha = a;

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 3.5);
        grd.addColorStop(0.0, `rgba(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)},${a})`);
        grd.addColorStop(0.35, `rgba(255,255,255,${0.30 * a})`);
        grd.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      ctx.filter = 'none';
    }

    // Tier 3: shock pulse glow (screen-wide “bloom” near edges)
    if (tier3 && shockwaveStrength > 0) {
      pulseCooldown = Math.max(0, pulseCooldown - dt);

      // Kick pulse occasionally, based on hype (throttled)
      if (pulseCooldown <= 0 && Math.random() < lerp(0.08, 0.25, smoothstep(0.70, 1.00, hSmooth)) * dt * 60) {
        kickPulse(lerp(0.35, 0.85, hSmooth) * shockwaveStrength);
        pulseCooldown = lerp(0.35, 0.16, hSmooth); // more frequent at higher hype
      }

      // Integrate pulse
      pulseVel *= Math.pow(0.25, dt);
      pulse = clamp(pulse + pulseVel * dt, 0, 1);
      pulseVel -= pulse * lerp(2.4, 5.2, hSmooth) * dt; // spring back

      if (pulse > 0.001) {
        const pA = pulse * smoothstep(0.70, 1.00, hSmooth) * 0.55;
        ctx.save();
        ctx.globalAlpha = clamp(pA, 0, 0.55);
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = `blur(${clamp(lerp(10, 34, hSmooth), 8, 36)}px)`;

        // bottom bloom
        const bloomH = thickness * lerp(1.6, 2.8, hSmooth);
        const bloomGrad = ctx.createLinearGradient(0, vh, 0, vh - bloomH);
        bloomGrad.addColorStop(0.0, rgbToCss(colorSmooth, 0.0));
        bloomGrad.addColorStop(0.25, rgbToCss(colorSmooth, 0.35));
        bloomGrad.addColorStop(0.70, 'rgba(255,255,255,0.22)');
        bloomGrad.addColorStop(1.0, 'rgba(255,255,255,0.00)');
        ctx.fillStyle = bloomGrad;
        ctx.fillRect(0, vh - bloomH, vw, bloomH);

        if (position === 'edges') {
          const bloomW = thickness * lerp(1.5, 2.6, hSmooth);
          const leftGrad = ctx.createLinearGradient(0, 0, bloomW, 0);
          leftGrad.addColorStop(0.0, rgbToCss(colorSmooth, 0.0));
          leftGrad.addColorStop(0.35, rgbToCss(colorSmooth, 0.25));
          leftGrad.addColorStop(0.75, 'rgba(255,255,255,0.16)');
          leftGrad.addColorStop(1.0, 'rgba(255,255,255,0.00)');
          ctx.fillStyle = leftGrad;
          ctx.fillRect(0, 0, bloomW, vh);

          const rightGrad = ctx.createLinearGradient(vw, 0, vw - bloomW, 0);
          rightGrad.addColorStop(0.0, rgbToCss(colorSmooth, 0.0));
          rightGrad.addColorStop(0.35, rgbToCss(colorSmooth, 0.25));
          rightGrad.addColorStop(0.75, 'rgba(255,255,255,0.16)');
          rightGrad.addColorStop(1.0, 'rgba(255,255,255,0.00)');
          ctx.fillStyle = rightGrad;
          ctx.fillRect(vw - bloomW, 0, bloomW, vh);
        }

        ctx.restore();
        ctx.filter = 'none';
      }
    } else {
      pulse = 0;
      pulseVel = 0;
      pulseCooldown = 0;
    }

    // Subtle global opacity at very low hype (boring idle)
    container.style.opacity = tier0 ? '0.65' : '1.0';
  }

  // Start render loop
  raf = requestAnimationFrame(frame);

  // Initialize
  blendState = computeBlendAndHype({ factions: [] }, config);

  // Subscribe to meters (NO DOM churn: just update state)
  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    blendState = computeBlendAndHype(latestSnap, config);
  });

function setConfig(next) {
  // FlameEdge currently reads most knobs once at init.
  // For v1 audio controls, we allow toggling + volume changes live by re-reading config fields.
  // If you later want live-updatable visuals, we can refactor knobs into a mutable cfg.
  if (next && typeof next === 'object') {
    // merge into config object reference (overlayClient passes a plain object)
    Object.assign(config, next);
    // apply volume immediately if audio is live
    if (stemPack) {
      try { stemPack.setMasterVolume(clamp(config.audioMasterVolume ?? 0.70, 0, 1)); } catch {}
    }
    // if audio disabled, tear down
    if (!getAudioCfg().enabled && stemPack) teardownAudio();
  }
}

function destroy() {
  try { unsub?.(); } catch {}
  try { cancelAnimationFrame(raf); } catch {}
  try { window.removeEventListener('resize', resize); } catch {}
  teardownAudio();
  // clear DOM
  try { while (root.firstChild) root.removeChild(root.firstChild); } catch {}
}

return { destroy, setConfig };

  // Optional cleanup (overlayClient may not call it yet)
  // return () => {
  //   try { unsub?.(); } catch {}
  //   cancelAnimationFrame(raf);
  //   window.removeEventListener('resize', resize);
  // };
}
