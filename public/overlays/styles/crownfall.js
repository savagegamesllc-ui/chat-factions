'use strict';

export const meta = {
  styleKey: 'crownfall',
  name: 'Crownfall (PRO)',
  tier: 'PRO',
  defaultConfig: {
    fpsCap: 60,
    crownRenderScale: 0.55,

    hypeK: 160,
    maxTotalClamp: 2200,
    hypeSmoothing: 0.18,

    crownX: 0.5,
    crownY: 0.115,
    crownWidth: 0.56,
    crownHeight: 0.18,
    crownTilt: 0.0,

    crownOpacity: 0.16,
    crownGlow: 0.92,
    crownLineWidth: 3.5,
    crownGemCount: 5,

    crownDepth: 1.0,
    crownCastShadow: 0.85,
    crownShadowSoftness: 1.0,
    crownShadowOffset: 1.0,

    flareAttack: 9.0,
    flareRelease: 2.2,
    flareStrength: 0.9,
    eventBoost: 1.0,
    spikeSensitivity: 0.95,

    emberEnabled: true,
    emberMax: 420,
    emberSpawnCapPerFrame: 90,
    emberRate: 18,
    emberBoost: 150,
    emberLife: 1.25,
    emberSize: 2.6,
    emberSpeed: 420,
    emberGravity: 920,
    emberDrift: 120,
    emberTurbulence: 0.55,
    emberGlow: 0.85,
    emberAlpha: 0.55,
    emberHueSpeed: 1.15,

    sparkEnabled: true,
    sparkRate: 6,
    sparkBoost: 35,
    sparkSize: 1.4,
    sparkLife: 0.55,

    // Visual shaping
    backgroundDim: 0.0,
    vignette: 0.22,
    saturation: 0.95,
    biasStrength: 0.24,

    // NOTE: chromaSplit intentionally not used in render anymore
    chromaSplit: 0.75
  }
};

function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function clampInt(x, a, b) { return Math.max(a, Math.min(b, (x | 0))); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

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

function computeWinnerRgb(snap) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let best = null, bestM = -Infinity;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > bestM) { bestM = m; best = f; }
  }
  return best ? hexToRgb(best?.colorHex) : { r: 140, g: 210, b: 255 };
}

function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2200, 200, 6000));

  let rgb = { r: 140, g: 210, b: 255 };
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = mixWeighted(colors, weights);
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

function smoothstep01(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

function resizeCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(r.width * dpr));
  const H = Math.max(1, Math.floor(r.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: W / dpr, h: H / dpr, dpr };
}

function buildCrownPaths(sw, sh, peakCount) {
  const left = -sw * 0.5;
  const right = sw * 0.5;
  const top = -sh * 0.5;
  const base = sh * 0.35;
  const toothW = sw / (peakCount + 1);

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

  const body = new Path2D(outline);
  body.lineTo(right * 0.92, base + sh * 0.26);
  body.lineTo(left * 0.92, base + sh * 0.26);
  body.closePath();

  const rim = new Path2D();
  rim.moveTo(left, base);
  for (let i = 0; i <= peakCount; i++) {
    const x = left + toothW * (i + 0.5);
    const ph = (0.55 + 0.45 * Math.sin((i / peakCount) * Math.PI));
    const yPeak = top + sh * 0.13 * ph;
    rim.lineTo(x, yPeak);
    rim.lineTo(x + toothW * 0.5, base);
  }
  rim.lineTo(right, base);

  return { outline, body, rim, left, right, top, base, toothW };
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

export function init({ root, config, api }) {
  // ---- HARD SINGLETON GUARD (prevents stacked crowns) ----
  try { window.__CHATFACTIONS_CROWNFALL__?.destroy?.(); } catch {}
  window.__CHATFACTIONS_CROWNFALL__ = null;

  // Remove any leftover canvases from prior runs, anywhere
  try {
    document.querySelectorAll('canvas[data-cf-style="crownfall"]').forEach(n => n.remove());
    document.querySelectorAll('div[data-cf-container="crownfall"]').forEach(n => n.remove());
  } catch {}

  // Clear root
  while (root.firstChild) root.removeChild(root.firstChild);

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  const container = document.createElement('div');
  container.dataset.cfContainer = 'crownfall';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const canvas = document.createElement('canvas');
  canvas.dataset.cfStyle = 'crownfall';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.display = 'block';
  canvas.style.transform = 'translateZ(0)';
  canvas.style.willChange = 'transform, opacity, filter';

  container.appendChild(canvas);
  root.appendChild(container);

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  const crownOff = document.createElement('canvas');
  const crownCtx = crownOff.getContext('2d', { alpha: true });

  let latestSnap = { factions: [] };
  let { total: totalRaw, h: hTarget, rgb: biasRgb } = computeBlendAndHype(latestSnap, cfg);
  let winnerRgb = computeWinnerRgb(latestSnap);

  let hSmooth = 0;
  let biasSmooth = { ...biasRgb };
  let winnerSmooth = { ...winnerRgb };

  let lastTotal = 0;
  let spikeVel = 0;
  let spikeEnergy = 0;
  let flare = 0;
  let flash = 0;

  const embers = [];
  let emberCarry = 0;
  let sparkCarry = 0;

  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  let size = { w: 1, h: 1, dpr: 1, ow: 2, oh: 2 };
  let sizeDirty = true;

  let crownPathKey = '';
  let crownPaths = null;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    biasRgb = res.rgb;

    winnerRgb = computeWinnerRgb(latestSnap);

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

    count = Math.min(count, clampInt(cfg.emberSpawnCapPerFrame ?? 90, 1, 250));

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
        hueSeed: Math.random(),
        power,
        isSpark: false,
      });
    }
  }

  function spawnSparks(dt, crown, t) {
    if (!cfg.sparkEnabled) return;
    if (hSmooth < 0.35) return;

    const base = clamp(cfg.sparkRate, 0, 240);
    const boost = clamp(cfg.sparkBoost, 0, 600);
    const rate = base + boost * clamp01(0.45 * hSmooth + 0.8 * spikeEnergy + 0.45 * flare);

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

      e.vx *= Math.pow(0.35, dt);
      e.vy *= Math.pow(0.82, dt);

      if (e.t >= e.life || e.y > h + 120) embers.splice(i, 1);
    }
  }

  function drawParticles(ctx, t) {
    if (!cfg.emberEnabled) return;

    const glow = clamp01(cfg.emberGlow);
    const alphaBase = clamp01(cfg.emberAlpha);
    const sat = clamp01(cfg.saturation);
    const hueSpeed = clamp(cfg.emberHueSpeed, 0.05, 6);

    ctx.save();
    ctx.globalCompositeOperation = (hSmooth >= 0.35) ? 'lighter' : 'source-over';

    const pressure = clamp01(embers.length / Math.max(1, clampInt(cfg.emberMax, 1, 20000)));
    const blurCap = lerp(1.0, 0.55, pressure);

    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = (6 + 70 * glow) * (0.20 + 1.20 * hSmooth) * (0.7 + 0.6 * flare) * blurCap;

    for (const e of embers) {
      const p = clamp01(e.t / e.life);
      const fade = (1 - p);
      const a = alphaBase * fade * (0.25 + 0.85 * e.power) * (0.45 + 0.95 * hSmooth + 0.35 * flare);

      if (e.isSpark) {
        // Sparks are WINNER color (highest hype)
        const wr = winnerSmooth.r | 0, wg = winnerSmooth.g | 0, wb = winnerSmooth.b | 0;
        const coreA = a * (0.85 + 0.45 * flare);
        const len = e.size * lerp(9, 20, hSmooth);
        const wth = Math.max(1.0, e.size * 0.55);

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.globalAlpha = coreA;

        ctx.strokeStyle = `rgba(${wr},${wg},${wb},${coreA})`;
        ctx.lineWidth = wth;
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.65);
        ctx.lineTo(0, len * 0.65);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255,255,255,${coreA * 0.55})`;
        ctx.lineWidth = Math.max(1, wth * 0.45);
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.35);
        ctx.lineTo(0, len * 0.35);
        ctx.stroke();

        ctx.restore();
        continue;
      }

      const hue = frac(e.hueSeed + t * 0.12 * hueSpeed * lerp(0.85, 1.35, hSmooth) + p * 0.25);
      const rgb = hsvToRgb(hue, sat, 1);
      const rr = (rgb.r * 255) | 0, gg = (rgb.g * 255) | 0, bb = (rgb.b * 255) | 0;

      const sz = e.size;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.globalAlpha = a;

      ctx.fillStyle = `rgba(${rr},${gg},${bb},${a})`;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.35, -sz * 1.15);
      ctx.lineTo(sz * 0.75, -sz * 0.25);
      ctx.lineTo(sz * 0.35, sz * 1.15);
      ctx.lineTo(-sz * 0.85, sz * 0.25);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(255,255,255,${a * lerp(0.24, 0.42, hSmooth)})`;
      ctx.fillRect(-sz * 0.08, -sz * 0.95, sz * 0.16, sz * 1.9);

      ctx.restore();
    }

    ctx.restore();
  }

  function drawCrownToOffscreen(ow, oh, t, crown) {
    crownCtx.clearRect(0, 0, ow, oh);

    const energy = clamp01(0.12 + 0.88 * hSmooth + 0.85 * flare + 0.55 * flash);
    const glow = clamp01(cfg.crownGlow);
    const baseA = clamp01(cfg.crownOpacity);

    const sx = (crown.cx / crown.wScreen) * ow;
    const sy = (crown.cy / crown.hScreen) * oh;
    const sw = (crown.w / crown.wScreen) * ow;
    const sh = (crown.h / crown.hScreen) * oh;

    const peaks = clampInt(cfg.crownGemCount, 3, 9);
    const key = `${(sw * 10) | 0}:${(sh * 10) | 0}:${peaks}`;
    if (key !== crownPathKey) {
      crownPathKey = key;
      crownPaths = buildCrownPaths(sw, sh, peaks);
    }

    const hueBase = frac(t * lerp(0.08, 0.16, hSmooth));

    crownCtx.save();
    crownCtx.translate(sx, sy);
    crownCtx.rotate(cfg.crownTilt || 0);

    // shadow (3D)
    const cast = clamp(cfg.crownCastShadow ?? 0.85, 0, 2);
    const depth = clamp(cfg.crownDepth ?? 1.0, 0, 2);
    if (cast > 0.001) {
      const off = (1.2 + 6.0 * depth) * clamp(cfg.crownShadowOffset ?? 1.0, 0, 2) * (0.55 + 0.65 * hSmooth);
      const soft = clamp(cfg.crownShadowSoftness ?? 1.0, 0.2, 2);
      crownCtx.save();
      crownCtx.globalAlpha = (0.18 + 0.22 * cast) * (0.6 + 0.55 * energy);
      crownCtx.shadowColor = 'rgba(0,0,0,0.85)';
      crownCtx.shadowBlur = Math.min(26, (10 + 20 * cast) * soft * (0.6 + 0.7 * hSmooth));
      crownCtx.shadowOffsetX = off * 0.55;
      crownCtx.shadowOffsetY = off;
      crownCtx.fillStyle = 'rgba(0,0,0,0.85)';
      crownCtx.fill(crownPaths.body);
      crownCtx.restore();
    }

    // body
    const bodyA = baseA * lerp(0.35, 0.78, smoothstep01(hSmooth)) * (0.35 + 0.65 * energy);
    const bodyGrad = crownCtx.createLinearGradient(0, crownPaths.top, 0, crownPaths.base + sh * 0.28);
    bodyGrad.addColorStop(0.00, `rgba(20,24,30,${bodyA * (0.70 + 0.20 * depth)})`);
    bodyGrad.addColorStop(0.28, `rgba(70,78,92,${bodyA * (0.55 + 0.30 * depth)})`);
    bodyGrad.addColorStop(0.58, `rgba(26,30,40,${bodyA * (0.65 + 0.22 * depth)})`);
    bodyGrad.addColorStop(1.00, `rgba(0,0,0,${bodyA * (0.75 + 0.20 * depth)})`);

    crownCtx.fillStyle = bodyGrad;
    crownCtx.fill(crownPaths.body);

    // outline glow
    crownCtx.save();
    crownCtx.globalCompositeOperation = 'lighter';
    crownCtx.shadowColor = 'rgba(255,255,255,0.9)';
    crownCtx.shadowBlur = Math.min(80, (10 + 90 * glow) * (0.18 + 1.05 * energy) * lerp(0.85, 1.45, hSmooth));

    const grad = crownCtx.createLinearGradient(crownPaths.left, crownPaths.top, crownPaths.right, crownPaths.base);
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      const hue = frac(hueBase + u * 0.75);
      const rgb = hsvToRgb(hue, clamp01(cfg.saturation), 1);
      grad.addColorStop(u, `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},${0.30 + 0.62 * energy})`);
    }

    const lw = clamp(cfg.crownLineWidth, 1, 20) * (0.70 + 1.05 * flare) * lerp(0.85, 1.25, hSmooth);
    crownCtx.strokeStyle = grad;
    crownCtx.lineWidth = lw;
    crownCtx.stroke(crownPaths.outline);

    crownCtx.restore();
    crownCtx.restore();
  }

  function compositeCrown(ctx, w, h) {
    // IMPORTANT: only one crown draw + one bloom draw at same coordinates (no offsets)
    const op = clamp01(cfg.crownOpacity + 0.18 * hSmooth + 0.28 * flare) * clamp01(0.75 + 0.35);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;

    ctx.globalAlpha = op;
    ctx.drawImage(crownOff, 0, 0, w, h);

    // bloom pass (same position)
    const bloom = clamp01(cfg.flareStrength) * (0.18 + 1.05 * flare);
    if (bloom > 0.001) {
      ctx.globalAlpha = op * (0.35 + 0.70 * bloom);
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = Math.min(90, 18 + 110 * clamp01(cfg.crownGlow));
      ctx.drawImage(crownOff, 0, 0, w, h);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
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

    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth);

    // color smoothing
    biasSmooth.r = lerp(biasSmooth.r, biasRgb.r, 1 - Math.exp(-8 * dt));
    biasSmooth.g = lerp(biasSmooth.g, biasRgb.g, 1 - Math.exp(-8 * dt));
    biasSmooth.b = lerp(biasSmooth.b, biasRgb.b, 1 - Math.exp(-8 * dt));
    winnerSmooth.r = lerp(winnerSmooth.r, winnerRgb.r, 1 - Math.exp(-10 * dt));
    winnerSmooth.g = lerp(winnerSmooth.g, winnerRgb.g, 1 - Math.exp(-10 * dt));
    winnerSmooth.b = lerp(winnerSmooth.b, winnerRgb.b, 1 - Math.exp(-10 * dt));

    // flare/spike
    spikeVel *= Math.pow(0.12, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.60);
    spikeVel *= Math.pow(0.65, dt);

    const atk = clamp(cfg.flareAttack, 0.1, 60);
    const rel = clamp(cfg.flareRelease, 0.05, 60);
    const target = clamp01(0.06 + 0.70 * hSmooth + 0.95 * spikeEnergy) * clamp01(cfg.flareStrength);
    flare = (target > flare)
      ? lerp(flare, target, 1 - Math.exp(-atk * dt))
      : lerp(flare, target, 1 - Math.exp(-rel * dt));

    flash = clamp01(flash * Math.pow(0.10, dt) + (0.35 * spikeEnergy + 0.22 * flare) * 0.55);

    applyResizeIfNeeded();
    const { w, h, ow, oh } = size;
    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    // growth
    const grow = 0.88 + 0.18 * smoothstep01(hSmooth);

    const crown = {
      wScreen: w,
      hScreen: h,
      cx: (clamp(cfg.crownX, 0, 1) * w),
      cy: (clamp(cfg.crownY, 0, 1) * h),
      w: clamp(cfg.crownWidth, 0.1, 1) * w * grow,
      h: clamp(cfg.crownHeight, 0.05, 0.7) * h * grow
    };

    drawCrownToOffscreen(ow, oh, t, crown);
    compositeCrown(ctx, w, h);

    spawnEmbers(dt, crown, t);
    spawnSparks(dt, crown, t);
    stepParticles(dt, w, h, t);
    drawParticles(ctx, t);

    const vig = clamp(cfg.vignette, 0, 0.9);
    if (vig > 0.001) drawVignette(ctx, w, h, vig);
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    biasRgb = res.rgb;
    winnerRgb = computeWinnerRgb(latestSnap);
    sizeDirty = true;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    embers.length = 0;
    try { container.remove(); } catch {}
  }

  // store instance globally so next init can kill it
  window.__CHATFACTIONS_CROWNFALL__ = { destroy };

  sizeDirty = true;
  applyResizeIfNeeded();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
