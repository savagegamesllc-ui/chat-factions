// public/overlays/styles/factionAscension.js
// PRO Overlay: Faction Ascension
//
// Visual concept:
// - A glowing faction “sigil” rises from the bottom as hype increases.
// - Tiered spectacle: trail -> sparks -> shockwave + dominance flare.
// - Designed to sit under gameplay / around webcam without heavy obstruction.
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Snapshot contract assumed:
//   snap = { factions: [{ meter:number, colorHex:string, name?:string, key?:string }, ...] }

'use strict';

export const meta = {
  styleKey: 'factionAscension',
  name: 'Faction Ascension (PRO)',
  tier: 'PRO',
  description:
    'A faction sigil rises with hype. Adds trails, sparks, and shockwaves on spikes. At high hype, the leading faction asserts dominance.',

  defaultConfig: {
    // --- Hype mapping ---
    hypeK: 180,            // smaller -> more reactive
    maxTotalClamp: 2200,   // safety clamp
    hypeSmoothing: 0.18,   // 0.05..0.5 (higher = snappier)

    // --- Behavior ---
    mixMode: 'weighted',   // weighted | winner (winner = leading faction color)
    dominanceAtTier3: true,// if true, Tier 3 forces "winner" color even if weighted
    intensity: 1.0,        // 0..2 overall

    // --- Layout ---
    anchorX: 0.5,          // 0..1 (sigil horizontal position)
    baseY: 0.92,           // 0..1 (where it starts)
    riseHeight: 0.42,      // 0.05..0.8 (how far it rises at max hype)
    sigilSize: 0.22,       // 0.08..0.45 (fraction of min(screenW, screenH))
    sigilTilt: 0.0,        // -0.25..0.25 radians (small tilt)
    safeZoneRadius: 0.0,   // 0..0.4 (optional “keep center clear” feel)

    // --- Visuals ---
    baseOpacity: 0.18,     // baseline sigil visibility
    glowStrength: 0.9,     // 0..1
    trailStrength: 1.0,    // 0..2
    backgroundDim: 0.0,    // 0..0.25

    // --- Particles ---
    fpsCap: 60,            // 15..60
    particleMax: 520,      // main cap
    spawnRate: 18,         // base particles/sec
    spawnBoost: 160,       // additional/sec at high hype or spikes
    particleLife: 1.15,    // seconds
    particleSpeed: 420,    // px/sec
    particleSize: 2.4,     // px
    turbulence: 0.55,      // 0..1
    gravity: 820,          // px/sec^2
    drift: 160,            // px/sec sideways

    // --- Sparks (Tier2+) ---
    sparksEnabled: true,
    sparkRate: 6,
    sparkBoost: 40,
    sparkLife: 0.55,
    sparkSize: 1.4,

    // --- Shockwave (Tier3) ---
    shockwaveStrength: 1.0,  // 0..2
    spikeSensitivity: 0.95,  // 0..2
    eventBoost: 1.0,         // 0..2
  },

  controls: [
    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'dominanceAtTier3', label: 'Dominance at Tier 3', type: 'checkbox', default: true },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'particleMax', label: 'Max Particles', type: 'range', min: 80, max: 1600, step: 20, default: 520 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 180 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },

    { key: 'anchorX', label: 'Sigil X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'baseY', label: 'Base Y', type: 'range', min: 0.6, max: 0.98, step: 0.005, default: 0.92 },
    { key: 'riseHeight', label: 'Rise Height', type: 'range', min: 0.05, max: 0.8, step: 0.01, default: 0.42 },
    { key: 'sigilSize', label: 'Sigil Size', type: 'range', min: 0.08, max: 0.45, step: 0.01, default: 0.22 },

    { key: 'baseOpacity', label: 'Base Opacity', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18 },
    { key: 'glowStrength', label: 'Glow Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
    { key: 'trailStrength', label: 'Trail Strength', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.0 },

    { key: 'sparksEnabled', label: 'Enable Sparks', type: 'checkbox', default: true },
    { key: 'shockwaveStrength', label: 'Shockwave Strength', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
  ],
};

function clamp(n, a, b) { n = Number(n); return isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

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

function pickWinnerIndex(weights) {
  let best = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; best = i; }
  }
  return best;
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'factionAscension';
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

function tierFromH(h) {
  if (h < 0.10) return 0;  // barely present
  if (h < 0.35) return 1;  // trail
  if (h < 0.70) return 2;  // sparks
  return 3;                // shockwave + dominance
}

function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  let total = 0;
  const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
  for (const w of weights) total += w;

  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 2200, 200, 6000);
  total = clamp(total, 0, maxTotalClamp);

  const k = clamp(cfg.hypeK ?? 180, 40, 600);
  let h = 1 - Math.exp(-total / k);
  // gentle lift so small hype isn't invisible
  h = clamp01(h + (1 - h) * 0.06 * Math.min(1, total / 70));

  // color selection
  let rgb = { r: 140, g: 210, b: 255 };
  let winnerIndex = 0;

  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    winnerIndex = pickWinnerIndex(weights);

    const mode = (cfg.mixMode === 'winner') ? 'winner' : 'weighted';
    if (mode === 'winner') rgb = colors[winnerIndex] || rgb;
    else rgb = mixWeighted(colors, weights);
  }

  return { total, h, rgb, winnerIndex, factions, weights };
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // state
  let latestSnap = { factions: [] };
  let hTarget = 0;
  let hSmooth = 0;

  let colorTarget = { r: 140, g: 210, b: 255 };
  let colorSmooth = { r: 140, g: 210, b: 255 };
  let winnerIndex = 0;

  // spike detection
  let lastTotal = 0;
  let spikeVel = 0;     // impulse accumulator
  let spikeEnergy = 0;  // 0..1

  // particles
  const particles = []; // {x,y,vx,vy,life,t,size,rot,vr,hueSeed,isSpark}
  let carry = 0;
  let sparkCarry = 0;

  // shockwave
  let shockT = 0;
  let shockV = 0;

  // loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };

    const res = computeBlendAndHype(latestSnap, cfg);
    winnerIndex = res.winnerIndex;

    hTarget = res.h;

    // color behavior: optionally force winner at tier 3 (dominance)
    const forceWinner = !!cfg.dominanceAtTier3 && tierFromH(hTarget) === 3;
    if (forceWinner && res.factions.length) {
      const wCol = hexToRgb(res.factions[winnerIndex]?.colorHex);
      colorTarget = wCol || res.rgb;
    } else {
      colorTarget = res.rgb;
    }

    const d = Math.abs(res.total - lastTotal);
    lastTotal = res.total;

    const bump01 =
      clamp01(d / 70) *
      clamp(cfg.eventBoost ?? 1.0, 0, 2) *
      clamp(cfg.spikeSensitivity ?? 0.95, 0, 2);

    spikeVel += bump01 * 1.25;
  });

  const onResize = () => resize();
  window.addEventListener('resize', onResize, { passive: true });

  function resize() {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function spawnParticles(dt, w, h, sigil) {
    const max = Math.max(0, cfg.particleMax | 0);
    if (max <= 0) return;

    const tier = tierFromH(hSmooth);

    const baseRate = clamp(cfg.spawnRate, 0, 900);
    const boost = clamp(cfg.spawnBoost, 0, 2400);
    const rate = baseRate + boost * clamp01(0.55 * hSmooth + 0.85 * spikeEnergy);

    carry += rate * dt;
    let count = Math.floor(carry);
    carry -= count;

    // safety cap per frame
    count = Math.min(count, 90);

    const life = clamp(cfg.particleLife, 0.1, 8);
    const size = clamp(cfg.particleSize, 0.3, 30);
    const speed = clamp(cfg.particleSpeed, 0, 4000);
    const grav = clamp(cfg.gravity, 0, 10000);
    const drift = clamp(cfg.drift, 0, 3000);
    const turb = clamp01(cfg.turbulence);

    const spread = lerp(0.35, 0.85, hSmooth);
    const speedBoost = lerp(0.75, 1.25, hSmooth);

    for (let i = 0; i < count; i++) {
      if (particles.length >= max) particles.shift();

      const ang = (Math.random() * Math.PI * 2);
      const rad = sigil.r * (0.18 + 0.35 * Math.random()) * spread;
      const sx = sigil.x + Math.cos(ang) * rad;
      const sy = sigil.y + Math.sin(ang) * rad * 0.65;

      const vx = (Math.random() - 0.5) * drift * (0.25 + 0.75 * turb);
      const vy = -speed * (0.20 + 0.85 * Math.random()) * speedBoost * (0.65 + 0.6 * hSmooth);

      particles.push({
        x: sx, y: sy,
        vx, vy,
        grav,
        life: life * (0.7 + 0.7 * Math.random()),
        t: 0,
        size: size * (0.7 + 0.9 * Math.random()) * lerp(0.85, 1.25, hSmooth),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * lerp(7, 14, hSmooth),
        hueSeed: Math.random(),
        isSpark: false
      });
    }

    // Sparks (Tier 2+)
    if (tier >= 2 && cfg.sparksEnabled) {
      const sBase = clamp(cfg.sparkRate, 0, 240);
      const sBoost = clamp(cfg.sparkBoost, 0, 600);
      const sRate = sBase + sBoost * clamp01(0.45 * hSmooth + 0.85 * spikeEnergy);

      sparkCarry += sRate * dt;
      let sCount = Math.floor(sparkCarry);
      sparkCarry -= sCount;

      sCount = Math.min(sCount, 60);

      const sLife = clamp(cfg.sparkLife, 0.15, 2);
      const sSize = clamp(cfg.sparkSize, 0.5, 10);

      for (let i = 0; i < sCount; i++) {
        if (particles.length >= max) particles.shift();

        const side = Math.random() < 0.5 ? -1 : 1;
        const sx = sigil.x + side * sigil.r * (0.6 + 0.35 * Math.random());
        const sy = sigil.y + sigil.r * (0.05 + 0.25 * Math.random());

        const vx = side * (0.6 + 0.6 * Math.random()) * drift * 0.18 + (Math.random() - 0.5) * drift * 0.06;
        const vy = - (180 + 320 * Math.random()) * (0.7 + 0.9 * hSmooth);

        particles.push({
          x: sx, y: sy,
          vx, vy,
          grav: grav * 0.65,
          life: sLife * (0.7 + 0.7 * Math.random()),
          t: 0,
          size: sSize * (0.7 + 0.9 * Math.random()) * (0.85 + 0.8 * hSmooth),
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 18,
          hueSeed: Math.random(),
          isSpark: true
        });
      }
    }
  }

  function stepParticles(dt, w, h, t) {
    const drift = clamp(cfg.drift, 0, 3000);
    const turb = clamp01(cfg.turbulence);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;

      const n = Math.sin((p.hueSeed * 9 + t * 2.2) * Math.PI * 2);
      p.vx += n * drift * 0.10 * turb * dt;

      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      p.vx *= Math.pow(0.35, dt);
      p.vy *= Math.pow(0.82, dt);

      if (p.t >= p.life || p.y < -120 || p.y > h + 120) particles.splice(i, 1);
    }
  }

  function drawParticles(ctx, t) {
    const tier = tierFromH(hSmooth);
    const glow = clamp01(cfg.glowStrength);
    const trail = clamp(cfg.trailStrength, 0, 2);

    ctx.save();
    ctx.globalCompositeOperation = (tier >= 2) ? 'lighter' : 'source-over';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = (6 + 70 * glow) * (0.18 + 1.12 * hSmooth) * (0.65 + 0.75 * trail);

    for (const p of particles) {
      const u = clamp01(p.t / p.life);
      const fade = 1 - u;

      // Hue can subtly animate with time, but keep it tied to faction tint too
      const h = frac(p.hueSeed + t * 0.08 + u * 0.25);
      const rgb = hsvToRgb(h, 0.92, 1);

      // Blend toward current faction color (so “embers” feel themed)
      const br = colorSmooth.r / 255;
      const bg = colorSmooth.g / 255;
      const bb = colorSmooth.b / 255;
      const bias = lerp(0.18, 0.55, hSmooth);
      rgb.r = lerp(rgb.r, br, bias);
      rgb.g = lerp(rgb.g, bg, bias);
      rgb.b = lerp(rgb.b, bb, bias);

      const a = (0.55 * fade) * (0.25 + 0.85 * hSmooth) * (0.55 + 0.6 * trail);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.isSpark) {
        const sz = p.size;
        ctx.fillStyle = `rgba(${(rgb.r*255)|0},${(rgb.g*255)|0},${(rgb.b*255)|0},${a})`;
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
        const sz = p.size;
        ctx.fillStyle = `rgba(${(rgb.r*255)|0},${(rgb.g*255)|0},${(rgb.b*255)|0},${a})`;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.35, -sz * 1.15);
        ctx.lineTo(sz * 0.75, -sz * 0.25);
        ctx.lineTo(sz * 0.35, sz * 1.15);
        ctx.lineTo(-sz * 0.85, sz * 0.25);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${a * lerp(0.22, 0.42, hSmooth)})`;
        ctx.fillRect(-sz * 0.08, -sz * 0.95, sz * 0.16, sz * 1.9);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  function drawSigil(ctx, sigil, t) {
    const tier = tierFromH(hSmooth);

    const baseA = clamp01(cfg.baseOpacity);
    const glow = clamp01(cfg.glowStrength);
    const intensity = clamp(cfg.intensity, 0, 2);

    // opacity rises with hype
    const op = clamp01(baseA + 0.22 * hSmooth) * clamp01(0.75 + 0.35 * intensity);

    const r = sigil.r;
    const x = sigil.x;
    const y = sigil.y;

    // “breathing” at high tiers
    const breathe = (tier >= 2) ? (Math.sin(t * 2.2) * r * 0.02) : 0;
    const rot = (cfg.sigilTilt || 0) + (tier === 3 ? Math.sin(t * 1.2) * 0.02 : 0);

    // subtle motion to keep it alive
    const bob = Math.cos(t * 1.6) * r * 0.015 * lerp(0.0, 1.0, hSmooth);

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(rot);

    // glow ring
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = op;

    ctx.shadowColor = `rgba(${colorSmooth.r|0},${colorSmooth.g|0},${colorSmooth.b|0},1)`;
    ctx.shadowBlur = (16 + 90 * glow) * (0.18 + 1.12 * hSmooth);

    // outer ring
    ctx.lineWidth = lerp(2.0, 6.5, hSmooth);
    ctx.strokeStyle = `rgba(${colorSmooth.r|0},${colorSmooth.g|0},${colorSmooth.b|0},${0.55 + 0.35*hSmooth})`;
    ctx.beginPath();
    ctx.arc(0, 0, r + breathe, 0, Math.PI * 2);
    ctx.stroke();

    // inner ring
    ctx.globalAlpha = op * 0.65;
    ctx.lineWidth = lerp(1.2, 4.2, hSmooth);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    // rune spokes (changes with tier)
    const spokes = tier === 0 ? 3 : tier === 1 ? 5 : tier === 2 ? 7 : 9;
    ctx.globalAlpha = op * lerp(0.35, 0.85, hSmooth);
    ctx.lineWidth = lerp(1.0, 3.2, hSmooth);

    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + t * lerp(0.0, 0.12, hSmooth);
      const r0 = r * 0.22;
      const r1 = r * (0.78 + 0.08 * Math.sin(t * 1.7 + i));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.75);
      ctx.stroke();
    }

    // core gem
    ctx.globalAlpha = op * (0.45 + 0.55 * hSmooth);
    ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.22*hSmooth})`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Tier 3: dominance flare (quick additive bloom)
    if (tier === 3) {
      const flare = clamp01(0.25 + 0.85 * spikeEnergy);
      ctx.globalAlpha = op * (0.22 + 0.38 * flare);
      const g = ctx.createRadialGradient(0, 0, r * 0.10, 0, 0, r * 1.35);
      g.addColorStop(0, `rgba(255,255,255,${0.28 * flare})`);
      g.addColorStop(0.25, `rgba(${colorSmooth.r|0},${colorSmooth.g|0},${colorSmooth.b|0},${0.22 * flare})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawShockwave(ctx, sigil) {
    const tier = tierFromH(hSmooth);
    if (tier < 3) return;

    const s = clamp(cfg.shockwaveStrength ?? 1.0, 0, 2);
    if (s <= 0) return;

    // advance shock
    shockV *= Math.pow(0.08, 1 / 60);
    shockT = clamp01(shockT + shockV * 0.016);

    if (shockT <= 0.0001) return;

    const r = lerp(sigil.r * 0.20, Math.max(sigil.w, sigil.h) * 0.55, shockT);
    const a = clamp01((1 - shockT) * (0.22 + 0.35 * spikeEnergy + 0.20 * hSmooth)) * s;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = lerp(2, 10, hSmooth) * s;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = lerp(12, 40, hSmooth) * s;

    ctx.beginPath();
    ctx.arc(sigil.x, sigil.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    shockV *= 0.92;
    shockT *= 0.98;
  }

  function kickShock() {
    if (tierFromH(hSmooth) < 3) return;
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

    // smooth hype
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));

    // smooth color
    colorSmooth.r = lerp(colorSmooth.r, colorTarget.r, 1 - Math.exp(-8 * dt));
    colorSmooth.g = lerp(colorSmooth.g, colorTarget.g, 1 - Math.exp(-8 * dt));
    colorSmooth.b = lerp(colorSmooth.b, colorTarget.b, 1 - Math.exp(-8 * dt));

    // spike energy
    spikeVel *= Math.pow(0.12, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.60);
    spikeVel *= Math.pow(0.65, dt);

    // big moment trigger
    if (spikeEnergy > 0.72 && hSmooth > 0.72) kickShock();

    const { w, h } = resize();
    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    // optional dim
    const dim = clamp(cfg.backgroundDim, 0, 0.25) * lerp(0.25, 1.0, hSmooth);
    if (dim > 0.001) {
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // compute sigil position
    const minSide = Math.min(w, h);
    const size = clamp(cfg.sigilSize, 0.08, 0.55) * minSide;
    const r = size * 0.5;

    const baseY = clamp(cfg.baseY, 0.55, 0.98) * h;
    const rise = clamp(cfg.riseHeight, 0.05, 0.9) * h;

    // ease rise so it feels “earned”
    const ease = hSmooth * hSmooth * (3 - 2 * hSmooth);

    let x = clamp(cfg.anchorX, 0, 1) * w;
    let y = baseY - rise * ease;

    // optional “safe zone” influence (very mild)
    const sz = clamp(cfg.safeZoneRadius ?? 0, 0, 0.4) * minSide;
    if (sz > 0.001) {
      const dx = x - w * 0.5;
      const dy = y - h * 0.5;
      const d = Math.sqrt(dx*dx + dy*dy) || 1;
      if (d < sz) {
        const push = (1 - d / sz);
        x += (dx / d) * push * r * 0.10;
        y += (dy / d) * push * r * 0.10;
      }
    }

    const sigil = { x, y, r, w, h };

    // particles trail behind movement (spawn around sigil)
    spawnParticles(dt, w, h, sigil);
    stepParticles(dt, w, h, t);

    // draw order: sigil -> shockwave -> particles (particles on top feels better)
    drawSigil(ctx, sigil, t);
    drawShockwave(ctx, sigil);
    drawParticles(ctx, t);
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    // re-evaluate immediately from latest snapshot
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;

    const forceWinner = !!cfg.dominanceAtTier3 && tierFromH(hTarget) === 3;
    if (forceWinner && res.factions.length) {
      const wCol = hexToRgb(res.factions[res.winnerIndex]?.colorHex);
      colorTarget = wCol || res.rgb;
    } else {
      colorTarget = res.rgb;
    }
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    particles.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  // start
  resize();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
