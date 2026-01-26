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
    maxTotalClamp: 2200,       // safety clamp to keep totals reasonable
    hypeSmoothing: 0.18,       // seconds to smooth

    // Aesthetic: global
    alpha: 0.95,               // 0..1 overall alpha
    glow: 0.85,                // 0..1 glow intensity
    backgroundDim: 0.06,       // 0..0.6 dim behind edges
    padding: 18,               // px inset from edge

    // Ribbons (edge flow)
    ribbonCount: 3,            // 1..6
    ribbonWidth: 22,           // 6..60
    ribbonSpeed: 0.9,          // 0.1..2.0
    ribbonTurbulence: 0.7,     // 0..1
    ribbonAlpha: 0.55,         // 0..1

    // Sigils (corner/region hops)
    sigilCount: 4,             // 1..8
    sigilSize: 120,            // 40..220
    sigilSpin: 0.9,            // 0..2
    sigilHop: 0.75,            // 0..1
    regionDance: 0.65,         // 0..1 (how much bursts move regions)

    // Bursts (particles)
    burstRate: 3.2,            // bursts/sec base
    burstBoost: 2.2,           // additional bursts/sec at max hype
    burstParticles: 46,        // 8..140 per burst (scaled by hype + tier + headroom)
    burstLife: 0.85,           // seconds (0.2..2.0)
    burstSpread: 1.0,          // 0.2..2.0
    maxParticles: 2600,        // safety cap (400..6000)

    // Tier 3 extras
    chromaSplit: 1.2,          // 0..2
    pulseStrobe: 0.0           // 0..1 (kept default 0 for readability)
  },

  // Optional UI schema (used by your dashboard if present)
  schema: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'bottom'], default: 'edges' },
    { key: 'mixMode', label: 'Mix Mode', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'number', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'hypeK', label: 'Hype K', type: 'number', min: 40, max: 600, step: 10, default: 150 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 500, max: 5000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'number', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'alpha', label: 'Alpha', type: 'number', min: 0, max: 1, step: 0.01, default: 0.95 },
    { key: 'glow', label: 'Glow', type: 'number', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'number', min: 0, max: 0.6, step: 0.01, default: 0.06 },
    { key: 'padding', label: 'Padding', type: 'number', min: 0, max: 60, step: 1, default: 18 },

    { key: 'ribbonCount', label: 'Ribbon Count', type: 'number', min: 1, max: 6, step: 1, default: 3 },
    { key: 'ribbonWidth', label: 'Ribbon Width', type: 'number', min: 6, max: 60, step: 1, default: 22 },
    { key: 'ribbonSpeed', label: 'Ribbon Speed', type: 'number', min: 0.1, max: 2.0, step: 0.05, default: 0.9 },
    { key: 'ribbonTurbulence', label: 'Ribbon Turbulence', type: 'number', min: 0, max: 1, step: 0.01, default: 0.7 },
    { key: 'ribbonAlpha', label: 'Ribbon Alpha', type: 'number', min: 0, max: 1, step: 0.01, default: 0.55 },

    { key: 'sigilCount', label: 'Sigil Count', type: 'number', min: 1, max: 8, step: 1, default: 4 },
    { key: 'sigilSize', label: 'Sigil Size', type: 'number', min: 40, max: 220, step: 2, default: 120 },
    { key: 'sigilSpin', label: 'Sigil Spin', type: 'number', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'sigilHop', label: 'Sigil Hop', type: 'number', min: 0, max: 1, step: 0.01, default: 0.75 },
    { key: 'regionDance', label: 'Region Dance', type: 'number', min: 0, max: 1, step: 0.01, default: 0.65 },

    { key: 'burstRate', label: 'Burst Rate', type: 'number', min: 0, max: 10, step: 0.1, default: 3.2 },
    { key: 'burstBoost', label: 'Burst Boost', type: 'number', min: 0, max: 10, step: 0.1, default: 2.2 },
    { key: 'burstParticles', label: 'Burst Particles', type: 'number', min: 8, max: 140, step: 1, default: 46 },
    { key: 'burstLife', label: 'Burst Life', type: 'number', min: 0.2, max: 2.0, step: 0.05, default: 0.85 },
    { key: 'burstSpread', label: 'Burst Spread', type: 'number', min: 0.2, max: 2.0, step: 0.05, default: 1.0 },
    { key: 'maxParticles', label: 'Max Particles', type: 'number', min: 400, max: 6000, step: 50, default: 2600 }
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

  // cached canvas size (avoid layout work every frame; OBS-friendly)
  let W = 1, H = 1;
  function doResize() {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h;
  }

  const ro = ('ResizeObserver' in window)
    ? new ResizeObserver(() => doResize())
    : null;

  try { ro?.observe(container); } catch {}
  doResize();

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

  const onResize = () => doResize();
  window.addEventListener('resize', onResize, { passive: true });

  function tierFromH(h) {
    if (h < 0.10) return 0;
    if (h < 0.35) return 1;
    if (h < 0.70) return 2;
    return 3;
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

    const w = W, h = H;
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
      if (cfg.placement === 'bottom') {
        const band = Math.max(0, h * 0.23);
        ctx.fillRect(0, h - band, w, band);
      } else {
        const band = Math.max(0, Math.min(140, 0.085 * Math.min(w, h) + 60 * hSmooth));
        ctx.fillRect(0, 0, w, band);
        ctx.fillRect(0, h - band, w, band);
        ctx.fillRect(0, 0, band, h);
        ctx.fillRect(w - band, 0, band, h);
      }
      ctx.restore();
    }

    // bursts spawn scaling by hype & motion
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
    const maxP = clampInt(cfg.maxParticles, 400, 6000);

    // Budget-aware spawning:
    // As we approach max particles, taper spawn rate hard to avoid churn (push+splice storms).
    const remaining = Math.max(0, maxP - particles.length);
    const budget01 = remaining / maxP; // 0..1

    // No spawn when basically full; taper earlier for stability.
    const rateScale = clamp01((budget01 - 0.08) / 0.30);

    burstCarry += (burstRate * rateScale) * dt;

    const spawnN = Math.min(8, Math.floor(burstCarry));
    burstCarry -= spawnN;

    for (let i = 0; i < spawnN; i++) spawnBurst(w, h, t, tier, remaining);

    // hard cap (should trigger rarely now)
    if (particles.length > maxP) particles.splice(0, particles.length - maxP);
  }

  function spawnBurst(w, h, t, tier, remainingBudget) {
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

    // Scale down particles-per-burst if we're low on headroom
    const maxP = clampInt(cfg.maxParticles, 400, 6000);
    const headroom01 = clamp01((remainingBudget || 0) / maxP);
    const countScale = 0.35 + 0.65 * headroom01; // never drop below 35%

    const count = Math.floor(countBase * countScale * (0.55 + hype * 0.95) * (0.85 + 0.18 * tier));
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

    const maxP = clampInt(cfg.maxParticles, 400, 6000);
    const load = maxP > 0 ? (particles.length / maxP) : 0;

    // Adaptive quality: when we're heavily loaded, draw fewer particles
    // to preserve frame time while keeping the overall look.
    const stride =
      load > 0.92 ? 3 :
      load > 0.82 ? 2 :
      1;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = hex;

    // IMPORTANT: don't vary shadowBlur per particle when loaded
    const shadowBase = 10 + 28 * glow;
    const heavyBlur = (stride === 1);
    ctx.shadowBlur = heavyBlur ? shadowBase : Math.min(18, shadowBase);

    const strobe = clamp01(cfg.pulseStrobe || 0) * (tier === 3 ? 1 : 0);
    const strobePulse = strobe > 0 ? (0.7 + 0.3 * Math.sin(performance.now() * 0.03)) : 1;

    for (let idx = 0; idx < particles.length; idx += stride) {
      const p = particles[idx];
      const k = 1 - p.age / p.life;
      const a = alphaBase * (0.10 + 0.90 * k) * strobePulse;

      // hue shimmer at tier 2/3 for extra "dance" (only at full quality)
      let fill = hex;
      if (tier >= 2 && stride === 1) {
        const hue = frac(p.hueSeed + performance.now() * 0.00012 + (1 - k) * 0.2);
        const rgb = hsvToRgb(hue, 0.95, 1);
        fill = `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},1)`;
      }

      ctx.globalAlpha = a;
      ctx.fillStyle = fill;

      // only do per-particle blur when not overloaded
      if (heavyBlur) ctx.shadowBlur = shadowBase * k;

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
      const phase = i / count;
      const amp = (0.40 + 0.55 * turb) * (0.35 + 0.65 * (0.3 + 0.7 * hype));
      const wob = (0.25 + 0.85 * turb) * (0.55 + 0.45 * motion);

      ctx.globalAlpha = alpha * (0.55 + 0.45 * (1 - phase));
      ctx.lineWidth = width * (0.75 + 0.5 * (1 - phase));

      if (cfg.placement === 'bottom') {
        const yBase = h - pad - width * 0.45;
        const steps = 32;
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const x = lerp(pad, w - pad, u);
          const n = Math.sin((u * 6.5 + t * speed * 1.25 + phase * 4.2) * Math.PI * 2) *
                    Math.cos((u * 2.1 + t * speed * 0.75 + phase * 2.8) * Math.PI * 2);
          const y = yBase - (n * amp * 26 + Math.sin(t * speed * 2.2 + u * 9.0) * wob * 12);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // edges: draw a loop-ish ribbon that "hugs" the frame
        const steps = 48;
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;

          // 0..1 around border
          const p = (u + t * speed * 0.06 + phase * 0.17) % 1;
          const pos = borderPoint(p, w, h, pad);

          const n = Math.sin((p * 7.0 + t * speed * 0.8 + phase * 6.0) * Math.PI * 2) *
                    Math.cos((p * 2.6 + t * speed * 0.55) * Math.PI * 2);

          const nx = pos.nx, ny = pos.ny;
          const off = (n * amp * 22) + Math.sin(t * speed * 1.6 + p * 10.0) * wob * 10;

          const x = pos.x + nx * off;
          const y = pos.y + ny * off;

          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ---- sigils ----
  function drawSigils(ctx, w, h, t, hex, hype, motion, tier) {
    const pad = clamp(cfg.padding, 0, 60);
    const baseCount = clampInt(cfg.sigilCount, 1, 8);
    const count = clampInt(baseCount + (tier >= 3 ? 2 : tier >= 2 ? 1 : 0), 1, 8);

    const size = clamp(cfg.sigilSize, 40, 220) * (0.75 + 0.5 * hype) * (0.9 + 0.12 * tier);
    const spin = clamp(cfg.sigilSpin, 0, 2) * (0.35 + 1.2 * hype) * (0.85 + 0.18 * tier);
    const hop = clamp01(cfg.sigilHop) * (0.25 + 0.9 * motion);

    const glow = clamp01(cfg.glow) * (0.55 + hype * 0.95) * (0.85 + 0.20 * tier);
    const alpha = clamp01(cfg.alpha) * (0.55 + 0.45 * smoothstep01(hype));

    // anchor points
    const anchors = (cfg.placement === 'bottom')
      ? [
          { x: 0.18, y: 0.82 },
          { x: 0.50, y: 0.80 },
          { x: 0.82, y: 0.82 },
          { x: 0.35, y: 0.86 },
          { x: 0.65, y: 0.86 }
        ]
      : [
          { x: 0.12, y: 0.14 },
          { x: 0.88, y: 0.14 },
          { x: 0.12, y: 0.86 },
          { x: 0.88, y: 0.86 },
          { x: 0.50, y: 0.12 },
          { x: 0.50, y: 0.88 },
          { x: 0.12, y: 0.50 },
          { x: 0.88, y: 0.50 }
        ];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hex;
    ctx.shadowColor = hex;
    ctx.shadowBlur = 10 + 30 * glow;

    for (let i = 0; i < count; i++) {
      const a = anchors[i % anchors.length];

      const x0 = a.x * w;
      const y0 = a.y * h;

      // hop offset
      const hopPhase = (i * 0.73 + t * (0.7 + 1.8 * hop)) % 1;
      const hopAmt = Math.sin(hopPhase * Math.PI * 2) * (8 + 16 * hop) * (0.35 + 0.65 * hype);

      // direction bias
      const dx = (a.x < 0.5) ? -1 : 1;
      const dy = (a.y < 0.5) ? -1 : 1;

      const x = clamp(pad, w - pad, x0 + dx * hopAmt);
      const y = clamp(pad, h - pad, y0 + dy * hopAmt);

      const rot = t * spin + i * 0.9;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      ctx.globalAlpha = alpha * (0.60 + 0.40 * (1 - (i / count)));
      ctx.lineWidth = 1.6 + 1.2 * glow;

      // base: a rotating sigil star
      drawSigilStar(ctx, size * (0.55 + 0.45 * (1 - i / count)), tier);

      // tier details
      if (tier >= 2) drawSigilInner(ctx, size * 0.42, tier);
      if (tier >= 3) drawSigilRays(ctx, size * 0.65, t, i);

      ctx.restore();
    }

    ctx.restore();
  }

  function drawSigilStar(ctx, r, tier) {
    const points = tier >= 3 ? 7 : tier >= 2 ? 6 : 5;
    const step = Math.PI * 2 / points;

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = i * step;
      const rr = (i % 2 === 0) ? r : r * 0.55;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawSigilInner(ctx, r, tier) {
    ctx.save();
    ctx.globalAlpha *= 0.65;

    // inner ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // cross-lines
    const k = tier >= 3 ? 4 : 3;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + Math.PI) * r, Math.sin(a + Math.PI) * r);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSigilRays(ctx, r, t, i) {
    ctx.save();
    ctx.globalAlpha *= 0.45;
    const rays = 10;
    for (let k = 0; k < rays; k++) {
      const a = (k / rays) * Math.PI * 2 + Math.sin(t * 1.7 + i) * 0.2;
      const rr = r * (0.75 + 0.25 * Math.sin(t * 2.3 + k));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (rr * 0.55), Math.sin(a) * (rr * 0.55));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Tier 3 “afterglow” edge accent
  function drawChromaEdgeGlow(ctx, w, h, t, hex, ox, oy, cs) {
    const pad = clamp(cfg.padding, 0, 60);
    const steps = 64;

    ctx.strokeStyle = hex;
    ctx.lineWidth = 1.2 + 0.8 * cs;

    // top edge wave
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = u * w + ox;
      const y = pad + 10 + Math.sin(t * 2.4 + u * 10.0) * (6 + 10 * cs) + oy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // start
  doResize();
  raf = requestAnimationFrame(tick);

  function setConfig(next) {
    cfg = normalizeConfig({ ...cfg, ...(next || {}) });

    // Recompute target hype from current total using new mapping
    total = computeTotal(latestSnap, cfg.maxTotalClamp);
    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { ro?.disconnect(); } catch {}
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
  container.style.willChange = 'transform';

  const canvas = document.createElement('canvas');
  canvas.id = `overlay-${styleKey}`;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  container.appendChild(canvas);
  root.appendChild(container);

  return { container, canvas };
}

function normalizeConfig(c) {
  const cfg = { ...(c || {}) };
  if (cfg.placement !== 'bottom') cfg.placement = 'edges';
  if (cfg.mixMode !== 'winner') cfg.mixMode = 'weighted';
  return cfg;
}

function computeTotal(snap, clampMax) {
  const factions = (snap && snap.factions) ? snap.factions : [];
  let sum = 0;
  for (const f of factions) sum += Math.max(0, +f.meter || 0);
  const maxC = clampInt(clampMax, 500, 5000);
  return Math.min(sum, maxC);
}

function pickMixedColorFromSnap(snap, mixMode) {
  const factions = (snap && snap.factions) ? snap.factions : [];
  if (!factions.length) return '#ffffff';

  if (mixMode === 'winner') {
    let best = factions[0];
    for (const f of factions) if ((+f.meter || 0) > (+best.meter || 0)) best = f;
    return normalizeHex(best.color || '#ffffff');
  }

  // weighted mix
  let total = 0;
  let r = 0, g = 0, b = 0;

  for (const f of factions) {
    const w = Math.max(0, +f.meter || 0);
    total += w;
    const rgb = hexToRgb(normalizeHex(f.color || '#ffffff'));
    r += rgb.r * w;
    g += rgb.g * w;
    b += rgb.b * w;
  }

  if (total <= 0.0001) return normalizeHex(factions[0].color || '#ffffff');

  r = Math.round(r / total);
  g = Math.round(g / total);
  b = Math.round(b / total);

  return rgbToHex(r, g, b);
}

function borderPoint(p01, w, h, pad) {
  // Traverse rectangle perimeter clockwise; returns point + outward normal.
  const per = 2 * ((w - 2 * pad) + (h - 2 * pad));
  const d = (p01 * per) % per;

  const top = (w - 2 * pad);
  const right = (h - 2 * pad);
  const bottom = top;
  const left = right;

  if (d < top) {
    // top edge
    return { x: pad + d, y: pad, nx: 0, ny: -1 };
  }
  if (d < top + right) {
    // right edge
    const dd = d - top;
    return { x: w - pad, y: pad + dd, nx: 1, ny: 0 };
  }
  if (d < top + right + bottom) {
    // bottom edge
    const dd = d - (top + right);
    return { x: w - pad - dd, y: h - pad, nx: 0, ny: 1 };
  }
  // left edge
  const dd = d - (top + right + bottom);
  return { x: pad, y: h - pad - dd, nx: -1, ny: 0 };
}

function resizeCanvas(canvas) {
  // OBS can momentarily report 0x0; keep it safe.
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const dpr = Math.max(1, Math.min(3, Math.floor(window.devicePixelRatio || 1)));

  const pw = w * dpr;
  const ph = h * dpr;

  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  return { w, h, dpr };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function clampInt(v, a, b) {
  const n = (v == null) ? a : Math.round(+v || 0);
  return Math.max(a, Math.min(b, n));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function frac(x) {
  return x - Math.floor(x);
}
function smoothstep01(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

function normalizeHex(h) {
  let s = String(h || '').trim();
  if (!s) return '#ffffff';
  if (s[0] !== '#') s = `#${s}`;
  if (s.length === 4) {
    const r = s[1], g = s[2], b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 7) return '#ffffff';
  return s.toLowerCase();
}
function hexToRgb(hex) {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  return { r, g, b };
}
function rgbToHex(r, g, b) {
  const rr = Math.max(0, Math.min(255, r | 0)).toString(16).padStart(2, '0');
  const gg = Math.max(0, Math.min(255, g | 0)).toString(16).padStart(2, '0');
  const bb = Math.max(0, Math.min(255, b | 0)).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}
function hsvToRgb(h, s, v) {
  // h,s,v: 0..1
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return { r: v, g: t, b: p };
    case 1: return { r: q, g: v, b: p };
    case 2: return { r: p, g: v, b: t };
    case 3: return { r: p, g: q, b: v };
    case 4: return { r: t, g: p, b: v };
    case 5: return { r: v, g: p, b: q };
    default: return { r: v, g: t, b: p };
  }
}
