// public/overlays/styles/eventDance.js
// PRO Overlay: EventDance (v2 - new contract + true "dance" tiers)
//
// Spectacular, event-reactive "dance" frame:
// - Flowing ribbons along edges (or bottom-only)
// - Corner/region sigils that "hop" on surges
// - Burst particles that pop in different regions when meters change
// - TRUE hype computed from snap.factions[].meter (sum) with h = 1 - exp(-total/k)
// - Tiered escalation (0..3): more layers, more movement, more spectacle
//
// Contract:
// - export const meta
// - export function init({ root, config, api }) returning { destroy, setConfig }
//
// Notes:
// - Efficient: single canvas + capped particles, fixed polyline steps.
// - OBS-safe: fixed container, pointer-events:none, no per-frame DOM churn.

'use strict';

export const meta = {
  styleKey: 'eventDance',
  name: 'EventDance (PRO)',
  tier: 'PRO',
  description:
    'A dancing, event-reactive frame: flowing ribbons, corner sigils, and bursts that pop in different regions as hype shifts.',

  defaultConfig: {
    placement: 'edges',        // bottom|edges
    mixMode: 'weighted',       // weighted|winner
    intensity: 1.0,            // 0..2

    // Hype mapping (NEW, matches your Crownfall standard)
    hypeK: 150,                // smaller = reacts sooner
    maxTotalClamp: 2200,       // safety clamp for very large totals
    hypeSmoothing: 0.18,       // seconds-ish. higher = smoother

    // Ribbons
    ribbonCount: 3,            // 1..6
    ribbonSpeed: 0.8,          // 0.1..2
    ribbonWidth: 18,           // px
    ribbonTurbulence: 0.55,    // 0..1
    ribbonAlpha: 0.65,         // 0..1

    // Sigil blooms (corners/regions)
    sigilSize: 120,            // px
    sigilGlow: 0.9,            // 0..1
    sigilDetail: 0.65,         // 0..1 (more lines)
    regionDance: 0.85,         // 0..1 (how much it hops around regions)

    // Bursts
    burstRate: 0.6,            // baseline bursts/sec when hype is moving
    burstBoost: 2.2,           // added bursts/sec at high hype
    burstParticles: 46,        // particles per burst
    burstLife: 0.9,            // sec
    burstSpread: 1.0,          // 0..2

    // Global visuals
    glow: 0.85,                // 0..1
    alpha: 0.95,               // 0..1
    padding: 10,               // px inset from edge
    backgroundDim: 0.0,        // 0..0.6 dim behind edges

    // Tier 3 polish (NEW)
    chromaSplit: 0.75,         // 0..2 subtle RGB offset at max hype
    pulseStrobe: 0.0,          // 0..1 (keep 0 by default; can be intense)
    maxParticles: 2600         // hard cap
  },

  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: [
      { label: 'Edges', value: 'edges' },
      { label: 'Bottom', value: 'bottom' }
    ], default: 'edges' },

    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: [
      { label: 'Weighted', value: 'weighted' },
      { label: 'Winner', value: 'winner' }
    ], default: 'weighted' },

    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    // Hype mapping
    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 150 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'ribbonCount', label: 'Ribbon Count', type: 'range', min: 1, max: 6, step: 1, default: 3 },
    { key: 'ribbonSpeed', label: 'Ribbon Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.8 },
    { key: 'ribbonWidth', label: 'Ribbon Width', type: 'range', min: 6, max: 42, step: 1, default: 18 },
    { key: 'ribbonTurbulence', label: 'Ribbon Turbulence', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'ribbonAlpha', label: 'Ribbon Opacity', type: 'range', min: 0.05, max: 1, step: 0.01, default: 0.65 },

    { key: 'sigilSize', label: 'Sigil Size', type: 'range', min: 50, max: 260, step: 1, default: 120 },
    { key: 'sigilGlow', label: 'Sigil Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
    { key: 'sigilDetail', label: 'Sigil Detail', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: 'regionDance', label: 'Region Dance', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },

    { key: 'burstRate', label: 'Burst Rate', type: 'range', min: 0, max: 5, step: 0.05, default: 0.6 },
    { key: 'burstBoost', label: 'Burst Boost', type: 'range', min: 0, max: 6, step: 0.05, default: 2.2 },
    { key: 'burstParticles', label: 'Burst Particles', type: 'range', min: 8, max: 140, step: 1, default: 46 },
    { key: 'burstLife', label: 'Burst Life (s)', type: 'range', min: 0.2, max: 2.0, step: 0.05, default: 0.9 },
    { key: 'burstSpread', label: 'Burst Spread', type: 'range', min: 0.2, max: 2.0, step: 0.05, default: 1.0 },

    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'alpha', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.01, default: 0.95 },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 40, step: 1, default: 10 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.0 },

    { key: 'chromaSplit', label: 'Chroma Split', type: 'range', min: 0, max: 2, step: 0.05, default: 0.75 },
    { key: 'pulseStrobe', label: 'Pulse Strobe', type: 'range', min: 0, max: 1, step: 0.01, default: 0.0 },
    { key: 'maxParticles', label: 'Max Particles', type: 'number', min: 400, max: 6000, step: 50, default: 2600 },
  ]
};

// ---------- init ----------
export function init({ root, config, api }) {
  // mount container + canvas
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = normalizeConfig({ ...meta.defaultConfig, ...(config || {}) });

  // latest snapshot from api
  let latestSnap = { factions: [] };

  // hype + tiers
  let total = 0;
  let hTarget = 0;     // 0..1 (computed from total)
  let hSmooth = 0;     // smoothed hype

  // motion from meter changes
  let lastTotal = 0;
  let motionVel = 0;
  let motion = 0;

  // particles
  const particles = []; // {x,y,vx,vy,age,life,size,twirl,hueSeed}

  // timing
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;
  const startMs = lastMs;

  // subscribe
  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };

    // --- total hype calculation (REQUIRED contract) ---
    total = computeTotal(latestSnap, cfg.maxTotalClamp);
    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));

    // motion bump from changes (total delta)
    const d = Math.abs(total - lastTotal);
    lastTotal = total;
    motionVel += clamp01(d / 70) * 1.15;
  });

  const onResize = () => resize();
  window.addEventListener('resize', onResize, { passive: true });

  function tierFromH(h) {
    if (h < 0.10) return 0;
    if (h < 0.35) return 1;
    if (h < 0.70) return 2;
    return 3;
  }

  function resize() {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function tick(nowMs) {
    raf = requestAnimationFrame(tick);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    // optional fps cap (inherit idea from other styles without exposing control)
    const cap = 60;
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    const { w, h } = resize();
    const t = (nowMs - startMs) / 1000;

    // smooth hype
    const smooth = clamp(cfg.hypeSmoothing, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));

    // motion decay
    motionVel *= Math.pow(0.10, dt);
    motion = clamp01(motion * Math.pow(0.55, dt) + motionVel * 0.35);
    motionVel *= Math.pow(0.55, dt);

    const tier = tierFromH(hSmooth);

    // mixed faction color (css hex)
    const mixedHex = pickMixedColorFromSnap(latestSnap, cfg.mixMode);

    // clear
    ctx.clearRect(0, 0, w, h);

    // optional dim behind edges
    const dim = clamp(cfg.backgroundDim, 0, 0.6) * lerp(0.25, 1.0, smoothstep01(hSmooth));
    if (dim > 0.001) {
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#000';
      if (cfg.placement === 'bottom') ctx.fillRect(0, h * 0.72, w, h * 0.28);
      else ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // spawn bursts based on motion + hype
    const burstRate =
      (cfg.burstRate + cfg.burstBoost * hSmooth) *
      (0.25 + motion * 1.25) *
      (0.65 + 0.6 * tier) *
      clamp(cfg.intensity, 0, 2);

    spawnBursts(dt, w, h, t, mixedHex, burstRate, tier);

    // update particles
    stepParticles(dt);

    // draw ribbons (tier influences layers + color treatment)
    drawRibbons(ctx, w, h, t, mixedHex, hSmooth, motion, tier);

    // draw sigils (tier influences count + detail)
    drawSigils(ctx, w, h, t, mixedHex, hSmooth, motion, tier);

    // draw bursts last
    drawParticles(ctx, mixedHex, hSmooth, tier);

    // Tier 3: chroma split “afterglow” (cheap re-draw with offsets)
    if (tier === 3 && cfg.chromaSplit > 0.001) {
      const cs = clamp(cfg.chromaSplit, 0, 2) * smoothstep01((hSmooth - 0.7) / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.10 + 0.10 * cs;
      const ox = Math.sin(t * 2.2) * cs * 2.0;
      const oy = Math.cos(t * 1.7) * cs * 1.4;
      // re-draw a tiny subset effect: a soft border wave
      drawChromaEdgeGlow(ctx, w, h, t, mixedHex, ox, oy, cs);
      ctx.restore();
    }
  }

  // ---- burst spawn/update/draw ----
  let burstCarry = 0;

  function spawnBursts(dt, w, h, t, mixedHex, burstRate, tier) {
    burstCarry += burstRate * dt;
    const spawnN = Math.min(8, Math.floor(burstCarry));
    burstCarry -= spawnN;

    for (let i = 0; i < spawnN; i++) spawnBurst(w, h, t, tier);

    // perf cap
    const maxP = clampInt(cfg.maxParticles, 400, 6000);
    if (particles.length > maxP) particles.splice(0, particles.length - maxP);
  }

  function spawnBurst(w, h, t, tier) {
    // regions: corners + mid edges
    const regions = [
      { x: 0.14, y: 0.18 }, { x: 0.86, y: 0.18 },
      { x: 0.14, y: 0.82 }, { x: 0.86, y: 0.82 },
      { x: 0.50, y: 0.14 }, { x: 0.50, y: 0.86 },
      { x: 0.14, y: 0.50 }, { x: 0.86, y: 0.50 }
    ];

    let pick = regions[(Math.random() * regions.length) | 0];

    if (cfg.placement === 'bottom') {
      pick = { x: 0.18 + Math.random() * 0.64, y: 0.78 + Math.random() * 0.18 };
    } else {
      const dance = clamp01(cfg.regionDance) * (0.45 + 0.65 * motion);
      if (Math.random() < dance) {
        pick = {
          x: clamp01(pick.x + (Math.random() - 0.5) * 0.22),
          y: clamp01(pick.y + (Math.random() - 0.5) * 0.22)
        };
      }
    }

    const cx = pick.x * w;
    const cy = pick.y * h;

    const hype = hSmooth;
    const intensity = clamp(cfg.intensity, 0, 2);

    const countBase = clampInt(cfg.burstParticles, 8, 140);
    const count = Math.floor(countBase * (0.55 + hype * 0.95) * (0.85 + 0.18 * tier));
    const lifeS = clamp(cfg.burstLife, 0.2, 2.0) * (0.7 + Math.random() * 0.6) * (0.9 + 0.15 * tier);
    const spread = clamp(cfg.burstSpread, 0.2, 2.0) * (0.7 + hype * 1.1) * (0.85 + 0.10 * tier);

    const baseSpeed = (140 + 360 * hype) * spread * intensity * (0.85 + 0.18 * tier);

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;

      // tier escalations:
      // - tier 0/1: mostly radial
      // - tier 2: add "spiral" twist
      // - tier 3: stronger twist + slight outward bias toward nearest edge
      const spiral = (tier >= 2) ? (0.6 + 0.8 * Math.random()) : (0.15 + 0.35 * Math.random());
      const s = baseSpeed * (0.18 + Math.random());

      let vx = Math.cos(a) * s;
      let vy = Math.sin(a) * s;

      // edge bias at tier 3 (makes it feel like it "dances the frame")
      if (tier === 3) {
        const ex = (cx < w * 0.5) ? -1 : 1;
        const ey = (cy < h * 0.5) ? -1 : 1;
        vx += ex * 80 * (0.15 + 0.6 * Math.random());
        vy += ey * 80 * (0.15 + 0.6 * Math.random());
      }

      particles.push({
        x: cx,
        y: cy,
        vx,
        vy,
        age: 0,
        life: lifeS,
        size: (1.2 + Math.random() * 2.6) * (0.8 + hype * 0.9) * (0.9 + 0.12 * tier),
        twirl: (Math.random() - 0.5) * (4.8 + 5.2 * spiral),
        hueSeed: Math.random()
      });
    }
  }

  function stepParticles(dt) {
    const drag = 0.86;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }

      // twirl
      const tw = p.twirl * dt;
      const vx = p.vx, vy = p.vy;
      const c = Math.cos(tw), s = Math.sin(tw);
      p.vx = vx * c - vy * s;
      p.vy = vx * s + vy * c;

      p.vx *= Math.pow(drag, dt * 60);
      p.vy *= Math.pow(drag, dt * 60);

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawParticles(ctx, hex, hype, tier) {
    const alphaBase = clamp01(cfg.alpha);
    const glow = clamp01(cfg.glow) * (0.55 + hype * 1.05) * (0.85 + 0.20 * tier);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = hex;

    const strobe = clamp01(cfg.pulseStrobe || 0) * (tier === 3 ? 1 : 0);
    const strobePulse = strobe > 0 ? (0.7 + 0.3 * Math.sin(performance.now() * 0.03)) : 1;

    for (const p of particles) {
      const k = 1 - p.age / p.life;
      const a = alphaBase * (0.10 + 0.90 * k) * strobePulse;

      // hue shimmer at tier 2/3 for extra "dance"
      let fill = hex;
      if (tier >= 2) {
        const hue = frac(p.hueSeed + performance.now() * 0.00012 + (1 - k) * 0.2);
        const rgb = hsvToRgb(hue, 0.95, 1);
        fill = `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},1)`;
      }

      ctx.globalAlpha = a;
      ctx.fillStyle = fill;
      ctx.shadowBlur = 10 + 28 * glow * k;

      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, p.size * (0.6 + 0.9 * k)), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---- ribbons ----
  function drawRibbons(ctx, w, h, t, hex, hype, motion, tier) {
    const pad = clamp(cfg.padding, 0, 60);
    const baseCount = clampInt(cfg.ribbonCount, 1, 6);
    const count = clampInt(baseCount + (tier >= 2 ? 1 : 0), 1, 6);

    const speed = clamp(cfg.ribbonSpeed, 0.1, 2) * (0.55 + hype * 1.25) * (0.85 + 0.18 * tier);
    const width = clamp(cfg.ribbonWidth, 6, 60) * (0.8 + hype * 0.45) * (0.9 + 0.12 * tier);
    const turb = clamp01(cfg.ribbonTurbulence) * (0.35 + hype * 0.95) * (0.75 + 0.45 * motion);
    const alpha = clamp01(cfg.ribbonAlpha) * clamp01(cfg.alpha);

    const glow = clamp01(cfg.glow) * (0.45 + hype * 0.95) * (0.85 + 0.20 * tier);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = hex;
    ctx.shadowColor = hex;
    ctx.shadowBlur = 12 + 34 * glow;

    for (let i = 0; i < count; i++) {
      const phase = t * speed + i * 0.65;
      const a = alpha * (0.35 + 0.65 * (0.35 + hype * 0.85));

      ctx.globalAlpha = a;
      ctx.lineWidth = width * (0.52 + 0.48 * Math.sin(phase * 1.8 + i));

      if (cfg.placement === 'bottom') {
        const y0 = h - pad - (i + 1) * (width * 0.7);
        drawWaveLine(ctx, pad, y0, w - pad, y0, phase, turb, true, tier);
      } else {
        const inset = pad + i * (width * 0.55);
        drawEdgeRibbon(ctx, w, h, inset, phase, turb, tier);
      }

      // Tier 3: add a faint “ghost” ribbon offset for more depth
      if (tier === 3) {
        ctx.save();
        ctx.globalAlpha = a * 0.22;
        ctx.shadowBlur = (12 + 34 * glow) * 0.65;
        const off = 2.5 + 2.5 * Math.sin(phase * 1.2);
        if (cfg.placement === 'bottom') {
          const y0 = h - pad - (i + 1) * (width * 0.7) + off;
          drawWaveLine(ctx, pad, y0, w - pad, y0, phase + 1.6, turb * 0.9, true, tier);
        } else {
          const inset = pad + i * (width * 0.55) + off;
          drawEdgeRibbon(ctx, w, h, inset, phase + 1.6, turb * 0.9, tier);
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawEdgeRibbon(ctx, w, h, inset, phase, turb, tier) {
    const left = inset;
    const right = w - inset;
    const top = inset;
    const bottom = h - inset;

    drawWaveLine(ctx, left, top, right, top, phase + 0.0, turb, true, tier);
    drawWaveLine(ctx, right, top, right, bottom, phase + 1.7, turb, false, tier);
    drawWaveLine(ctx, right, bottom, left, bottom, phase + 3.4, turb, true, tier);
    drawWaveLine(ctx, left, bottom, left, top, phase + 5.1, turb, false, tier);
  }

  function drawWaveLine(ctx, x1, y1, x2, y2, phase, turb, horizontal, tier) {
    // steps fixed for perf; slight increase at higher tiers
    const steps = (tier >= 2) ? 30 : 26;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const x = x1 + (x2 - x1) * p;
      const y = y1 + (y2 - y1) * p;

      const wob =
        Math.sin(phase * 2.1 + p * 8.0) * (6 + 18 * turb) +
        Math.sin(phase * 3.7 + p * 15.0) * (2 + 8 * turb) +
        (tier >= 2 ? Math.sin(phase * 5.1 + p * 22.0) * (1 + 5 * turb) : 0);

      const xx = horizontal ? x : x + wob;
      const yy = horizontal ? y + wob : y;

      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }

  // ---- sigils ----
  function drawSigils(ctx, w, h, t, hex, hype, motion, tier) {
    const sizeBase = clamp(cfg.sigilSize, 50, 320) * (0.75 + hype * 0.6) * (0.9 + 0.10 * tier);
    const glow = clamp01(cfg.sigilGlow) * (0.5 + hype * 0.95) * (0.9 + 0.15 * tier);
    const detail = clamp01(cfg.sigilDetail) * (0.85 + 0.12 * tier);
    const dance = clamp01(cfg.regionDance);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hex;
    ctx.shadowColor = hex;
    ctx.shadowBlur = 18 + 48 * glow;

    const sigilCount = clampInt(2 + Math.floor(2 * clamp01(hype + motion)) + (tier >= 2 ? 1 : 0), 2, 6);

    for (let i = 0; i < sigilCount; i++) {
      const ph = t * (0.6 + 1.4 * hype) + i * 1.7;

      // hop strength
      const hop = (Math.sin(ph * 1.4) * 0.5 + 0.5) * dance * (0.55 + 0.65 * motion);

      let xN, yN;
      if (cfg.placement === 'bottom') {
        xN = 0.2 + 0.6 * frac(ph * 0.18 + i * 0.13);
        yN = 0.76 + 0.18 * frac(ph * 0.22 + i * 0.41);
      } else {
        const pts = [
          [0.14, 0.18], [0.86, 0.18], [0.14, 0.82], [0.86, 0.82],
          [0.50, 0.14], [0.86, 0.50], [0.50, 0.86], [0.14, 0.50],
        ];
        const idx = Math.floor(frac(ph * 0.12 + i * 0.33) * pts.length);
        const base = pts[idx];
        xN = clamp01(base[0] + (Math.sin(ph * 2.1) * 0.12) * hop);
        yN = clamp01(base[1] + (Math.cos(ph * 1.7) * 0.12) * hop);
      }

      const cx = xN * w;
      const cy = yN * h;

      const pulse = 0.55 + 0.45 * Math.sin(ph * 2.3 + hype * 3.0);
      const a = clamp01(cfg.alpha) * (0.09 + 0.26 * pulse) * (0.6 + 0.7 * (0.35 + hype * 0.85));
      ctx.globalAlpha = a;

      // Tier 3: “lock-in” on surges (quick micro-scale)
      const surge = (tier === 3) ? (1 + 0.06 * Math.sin(t * 18 + i)) : 1;
      drawSigil(ctx, cx, cy, sizeBase * (0.72 + 0.38 * pulse) * surge, detail, ph, tier);
    }

    ctx.restore();
  }

  function drawSigil(ctx, cx, cy, size, detail, ph, tier) {
    // circles + spokes + rotating chords + (tier2+) star polygon
    const rings = 2 + Math.floor(2 * detail);
    const spokes = 6 + Math.floor(10 * detail);
    const chords = 2 + Math.floor(4 * detail);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ph * 0.35);

    // rings
    for (let i = 0; i < rings; i++) {
      const r = (size * 0.22) + (i / Math.max(1, rings - 1)) * (size * 0.48);
      ctx.lineWidth = Math.max(1.0, size * (0.008 + 0.006 * detail));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // spokes
    ctx.lineWidth = Math.max(1.0, size * (0.006 + 0.006 * detail));
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const r1 = size * (0.10 + 0.08 * Math.sin(ph * 1.7 + i));
      const r2 = size * (0.55 + 0.10 * Math.cos(ph * 1.2 + i * 0.4));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }

    // rotating chords
    for (let i = 0; i < chords; i++) {
      const a = ph * (0.7 + i * 0.12) + i;
      const r = size * (0.42 + 0.10 * Math.sin(ph * 1.3 + i));
      ctx.lineWidth = Math.max(1.0, size * (0.006 + 0.004 * detail));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + Math.PI * 0.62) * r, Math.sin(a + Math.PI * 0.62) * r);
      ctx.stroke();
    }

    // Tier 2+: star polygon “bloom”
    if (tier >= 2) {
      const points = 7 + Math.floor(5 * clamp01(detail));
      const inner = size * (0.18 + 0.06 * Math.sin(ph * 1.9));
      const outer = size * (0.62 + 0.08 * Math.cos(ph * 1.2));
      ctx.lineWidth = Math.max(1.0, size * 0.006);
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = (i % 2 === 0) ? outer : inner;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // Tier 3 chroma edge glow helper
  function drawChromaEdgeGlow(ctx, w, h, t, hex, ox, oy, cs) {
    const pad = clamp(cfg.padding, 0, 60);
    const inset = pad + 2;
    ctx.save();
    ctx.strokeStyle = hex;
    ctx.shadowColor = hex;
    ctx.shadowBlur = 18 + 26 * cs;
    ctx.lineWidth = 6 + 6 * cs;
    ctx.globalAlpha = 0.16 + 0.08 * cs;
    // simple rounded rect stroke with offsets (no expensive pathing)
    roundedRectStroke(ctx, inset + ox, inset + oy, w - (inset * 2), h - (inset * 2), 18 + 12 * cs);
    ctx.restore();
  }

  function roundedRectStroke(ctx, x, y, ww, hh, r) {
    const rr = Math.min(r, ww * 0.25, hh * 0.25);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, rr);
    ctx.arcTo(x + ww, y + hh, x, y + hh, rr);
    ctx.arcTo(x, y + hh, x, y, rr);
    ctx.arcTo(x, y, x + ww, y, rr);
    ctx.closePath();
    ctx.stroke();
  }

  // start
  resize();
  raf = requestAnimationFrame(tick);

  function setConfig(next) {
    cfg = normalizeConfig({ ...cfg, ...(next || {}) });
    // recompute hTarget immediately from current latestSnap
    total = computeTotal(latestSnap, cfg.maxTotalClamp);
    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    particles.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  return { destroy, setConfig };
}

// ---------- helpers (shared-ish) ----------
function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'eventDance';
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
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w: w / dpr, h: h / dpr, dpr };
}

function normalizeConfig(c) {
  const out = { ...c };
  out.placement = out.placement === 'bottom' ? 'bottom' : 'edges';
  out.mixMode = out.mixMode === 'winner' ? 'winner' : 'weighted';
  out.intensity = clamp(num(out.intensity, 1.0), 0, 2);

  out.hypeK = clamp(num(out.hypeK, 150), 40, 600);
  out.maxTotalClamp = clamp(num(out.maxTotalClamp, 2200), 200, 6000);
  out.hypeSmoothing = clamp(num(out.hypeSmoothing, 0.18), 0.05, 0.5);

  out.ribbonCount = clampInt(Math.round(num(out.ribbonCount, 3)), 1, 6);
  out.ribbonSpeed = clamp(num(out.ribbonSpeed, 0.8), 0.1, 2);
  out.ribbonWidth = clamp(num(out.ribbonWidth, 18), 6, 60);
  out.ribbonTurbulence = clamp01(num(out.ribbonTurbulence, 0.55));
  out.ribbonAlpha = clamp01(num(out.ribbonAlpha, 0.65));

  out.sigilSize = clamp(num(out.sigilSize, 120), 50, 320);
  out.sigilGlow = clamp01(num(out.sigilGlow, 0.9));
  out.sigilDetail = clamp01(num(out.sigilDetail, 0.65));
  out.regionDance = clamp01(num(out.regionDance, 0.85));

  out.burstRate = clamp(num(out.burstRate, 0.6), 0, 5);
  out.burstBoost = clamp(num(out.burstBoost, 2.2), 0, 6);
  out.burstParticles = clampInt(Math.round(num(out.burstParticles, 46)), 8, 140);
  out.burstLife = clamp(num(out.burstLife, 0.9), 0.2, 2.0);
  out.burstSpread = clamp(num(out.burstSpread, 1.0), 0.2, 2.0);

  out.glow = clamp01(num(out.glow, 0.85));
  out.alpha = clamp01(num(out.alpha, 0.95));
  out.padding = clamp(num(out.padding, 10), 0, 60);
  out.backgroundDim = clamp(num(out.backgroundDim, 0.0), 0, 0.6);

  out.chromaSplit = clamp(num(out.chromaSplit, 0.75), 0, 2);
  out.pulseStrobe = clamp01(num(out.pulseStrobe, 0.0));
  out.maxParticles = clamp(num(out.maxParticles, 2600), 400, 6000);

  return out;
}

// total = sum(snap.factions[].meter) with clamp
function computeTotal(snap, maxClamp) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let sum = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) sum += m;
  }
  return clamp(sum, 0, clamp(maxClamp, 200, 6000));
}

function pickMixedColorFromSnap(snap, mixMode) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  if (!factions.length) return '#78c8ff';

  // weights are meters
  let best = null;
  let bestV = -Infinity;

  let r = 0, g = 0, b = 0, sum = 0;
  for (const f of factions) {
    const v = Math.max(0, Number(f?.meter) || 0);
    if (v <= 0) continue;

    const col = normalizeHex(f?.colorHex || f?.color || f?.hex || '#78c8ff');
    const rgb = hexToRgb(col);

    if (v > bestV) { bestV = v; best = rgb; }

    r += rgb.r * v; g += rgb.g * v; b += rgb.b * v;
    sum += v;
  }

  if (mixMode === 'winner' && best) {
    return rgbToHex(best.r | 0, best.g | 0, best.b | 0);
  }

  if (sum <= 0) return '#78c8ff';
  return rgbToHex(Math.round(r / sum), Math.round(g / sum), Math.round(b / sum));
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

function num(v, fallback) {
  const n = typeof v === 'string' ? Number(v) : v;
  return (typeof n === 'number' && isFinite(n)) ? n : fallback;
}
function clamp01(x) { return clamp(x, 0, 1); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, Number.isFinite(+x) ? +x : a)); }
function clampInt(x, a, b) { return Math.max(a, Math.min(b, (x | 0))); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

function normalizeHex(hex) {
  if (typeof hex !== 'string') return '#78c8ff';
  let h = hex.trim();
  if (!h) return '#78c8ff';
  if (h[0] !== '#') h = '#' + h;
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (h.length !== 7) return '#78c8ff';
  return h.toLowerCase();
}
function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  const rr = clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0');
  const gg = clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0');
  const bb = clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}
