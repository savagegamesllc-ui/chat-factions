// public/overlays/styles/constellationDrift.js
// FREE Overlay: Constellation Drift
// - Twinkling star nodes drift gently and connect when near each other
// - Hype increases star count, drift speed, and connect distance (still subtle)
// - OBS-safe: single canvas, capped nodes, capped connections, no bloom passes
//
// Contract:
//   export const meta
//   export function init({ root, config, api }) -> { destroy(), setConfig(next) }

'use strict';

export const meta = {
  styleKey: 'constellationDrift',
  name: 'Constellation Drift (FREE)',
  tier: 'FREE',
  description:
    'A calm starfield that forms delicate constellations as hype rises. Twinkles, drifts, and connects—never invasive.',

  defaultConfig: {
    placement: 'edges',          // edges | full (edges biases spawns toward edges)
    mixMode: 'weighted',         // weighted | winner
    intensity: 1.0,              // 0..2

    // Hype mapping
    hypeK: 180,                  // higher = slower ramp
    maxTotalClamp: 2200,
    hypeSmoothing: 0.20,         // 0.05..0.5

    // Performance
    fpsCap: 60,                  // 15..60
    renderScale: 1.0,            // 0.5..1 (downscale if needed)

    // Stars
    starMax: 44,                 // hard cap (FREE)
    starMin: 14,                 // baseline at low hype
    starRadius: 1.6,             // px
    starRadiusMax: 2.4,          // px at high hype
    driftSpeed: 12,              // px/sec baseline
    driftSpeedMax: 44,           // px/sec at high hype
    twinkleSpeed: 1.15,          // 0.2..3
    twinkleDepth: 0.55,          // 0..1
    starAlpha: 0.65,             // 0..1

    // Connections
    connectDist: 78,             // px baseline
    connectDistMax: 140,         // px at high hype
    connectAlpha: 0.18,          // 0..1
    maxLinksPerStar: 2,          // cap lines per star (FREE)
    maxTotalLinks: 60,           // cap total links (FREE)

    // Color
    saturation: 0.60,            // 0..1 (keep tasteful for FREE)
    biasStrength: 0.28,          // 0..0.75 (faction tint influence)

    // Screen shaping
    vignette: 0.18               // 0..0.6
  },

  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'full'], default: 'edges' },
    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'renderScale', label: 'Render Scale', type: 'range', min: 0.5, max: 1, step: 0.05, default: 1.0 },

    { key: 'starMax', label: 'Max Stars', type: 'range', min: 10, max: 60, step: 1, default: 44 },
    { key: 'connectDist', label: 'Connect Distance', type: 'range', min: 40, max: 140, step: 1, default: 78 },
    { key: 'connectAlpha', label: 'Line Opacity', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 180 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.20 },

    { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18 },
  ],
};

// ---------------- utils ----------------
function clamp(n, a, b) { n = +n; return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a)); }
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
  if (sum <= 0) return { r: 170, g: 215, b: 255 };
  return { r: r / sum, g: g / sum, b: b / sum };
}
function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 170, g: 215, b: 255 };
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

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'constellationDrift';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';
  c.style.willChange = 'transform';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas, renderScale) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const rs = clamp(renderScale ?? 1, 0.5, 1);
  const W = Math.max(1, Math.floor(rect.width * dpr * rs));
  const H = Math.max(1, Math.floor(rect.height * dpr * rs));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  // Return CSS-space w/h (not scaled by renderScale)
  return { w: rect.width, h: rect.height, dpr, rs, rw: W / dpr, rh: H / dpr };
}

function drawVignette(ctx, w, h, strength) {
  const s = clamp01(strength);
  if (s <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = s;
  const r = Math.max(w, h) * 0.78;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, r * 0.15, w * 0.5, h * 0.5, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) total += Math.max(0, Number(f?.meter) || 0);

  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 2200, 200, 6000);
  total = clamp(total, 0, maxTotalClamp);

  let rgb = { r: 170, g: 215, b: 255 };
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === 'winner') ? pickWinner(colors, weights) : mixWeighted(colors, weights);
  }

  const k = clamp(cfg.hypeK ?? 180, 40, 600);
  let h = 1 - Math.exp(-total / k);
  h = clamp01(h);

  return { total, h, rgb };
}

// ---------------- overlay ----------------
export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // state from meters
  let latestSnap = { factions: [] };
  let { h: hTarget, rgb: biasRgb } = computeBlendAndHype(latestSnap, cfg);

  let hSmooth = 0;
  let biasSmooth = { r: 170, g: 215, b: 255 };

  // star nodes
  // { x,y,vx,vy,phase,seed,layer,lifeT,lifeDur }
  const stars = [];

  // loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;
    biasRgb = res.rgb;
  });

  const onResize = () => { /* handled in loop via resize */ };
  window.addEventListener('resize', onResize, { passive: true });

  function desiredStarCount() {
    const minS = clamp(cfg.starMin ?? 14, 5, 60);
    const maxS = clamp(cfg.starMax ?? 44, minS, 80); // still enforce “free-ish” cap via defaults
    // ease curve so low hype still has some life
    const t = clamp01((hSmooth * 0.92) + 0.08 * Math.sqrt(hSmooth));
    return Math.round(lerp(minS, maxS, t));
  }

  function spawnStar(w, h) {
    const placement = String(cfg.placement || 'edges');
    const edgeBias = (placement === 'edges') ? 0.72 : 0.22;

    // choose spawn position (bias to edges in edges mode)
    let x, y;
    if (Math.random() < edgeBias) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = Math.random() * w; y = -8; }
      else if (side === 1) { x = w + 8; y = Math.random() * h; }
      else if (side === 2) { x = Math.random() * w; y = h + 8; }
      else { x = -8; y = Math.random() * h; }
    } else {
      x = Math.random() * w;
      y = Math.random() * h;
    }

    const speedBase = clamp(cfg.driftSpeed ?? 12, 0, 180);
    const speedMax = clamp(cfg.driftSpeedMax ?? 44, speedBase, 260);
    const spd = lerp(speedBase, speedMax, clamp01(hSmooth)) * (0.55 + Math.random() * 0.9);

    const ang = Math.random() * Math.PI * 2;
    const vx = Math.cos(ang) * spd;
    const vy = Math.sin(ang) * spd;

    const seed = Math.random();
    const phase = Math.random() * Math.PI * 2;

    // gentle lifetime so it “breathes” instead of piling up
    const lifeDur = lerp(10, 22, Math.random());
    const lifeT = 0;

    stars.push({
      x, y, vx, vy,
      seed, phase,
      layer: Math.random(), // 0..1 used for slight size/alpha variation
      lifeT, lifeDur
    });
  }

  function pruneAndFill(w, h) {
    const target = desiredStarCount();

    // prune extras softly (prefer removing oldest)
    while (stars.length > target) stars.shift();

    // spawn up to target
    while (stars.length < target) spawnStar(w, h);
  }

  function step(dt, w, h, t) {
    // update stars
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.lifeT += dt;

      // tiny, deterministic drift wobble
      const wob = 0.15 + 0.35 * s.layer;
      const nx = Math.sin((t * 0.7 + s.seed * 7.1) * Math.PI * 2) * wob;
      const ny = Math.cos((t * 0.6 + s.seed * 5.9) * Math.PI * 2) * wob;

      s.x += (s.vx + nx) * dt;
      s.y += (s.vy + ny) * dt;

      // wrap with padding
      const pad = 18;
      if (s.x < -pad) s.x = w + pad;
      else if (s.x > w + pad) s.x = -pad;
      if (s.y < -pad) s.y = h + pad;
      else if (s.y > h + pad) s.y = -pad;

      // recycle by lifetime (keeps distribution fresh)
      if (s.lifeT > s.lifeDur) {
        stars.splice(i, 1);
      }
    }
  }

  function draw(w, h, t) {
    ctx.clearRect(0, 0, w, h);

    // compute dynamic knobs
    const baseAlpha = clamp01(cfg.starAlpha ?? 0.65);
    const twSpeed = clamp(cfg.twinkleSpeed ?? 1.15, 0.1, 6);
    const twDepth = clamp01(cfg.twinkleDepth ?? 0.55);

    const r0 = clamp(cfg.starRadius ?? 1.6, 0.6, 6);
    const r1 = clamp(cfg.starRadiusMax ?? 2.4, r0, 8);
    const radius = lerp(r0, r1, clamp01(hSmooth));

    const cd0 = clamp(cfg.connectDist ?? 78, 20, 260);
    const cd1 = clamp(cfg.connectDistMax ?? 140, cd0, 320);
    const connectDist = lerp(cd0, cd1, clamp01(hSmooth));

    const lineA = clamp01(cfg.connectAlpha ?? 0.18) * (0.65 + 0.55 * hSmooth);

    // build a tasteful tint:
    // - subtle hue sweep based on time
    // - gently biased toward faction blended color
    const sat = clamp01(cfg.saturation ?? 0.60);
    const bias = clamp(cfg.biasStrength ?? 0.28, 0, 0.75);

    const hue = frac(t * 0.03);
    let baseRgb = hsvToRgb(hue, sat, 1);
    // bias towards faction color
    baseRgb.r = lerp(baseRgb.r, biasSmooth.r / 255, bias);
    baseRgb.g = lerp(baseRgb.g, biasSmooth.g / 255, bias);
    baseRgb.b = lerp(baseRgb.b, biasSmooth.b / 255, bias);

    const cr = (baseRgb.r * 255) | 0;
    const cg = (baseRgb.g * 255) | 0;
    const cb = (baseRgb.b * 255) | 0;

    // ---- connections ----
    const maxLinksPer = clamp(cfg.maxLinksPerStar ?? 2, 1, 4) | 0;
    const maxTotalLinks = clamp(cfg.maxTotalLinks ?? 60, 10, 140) | 0;

    let totalLinks = 0;

    // draw lines first (behind stars)
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1;

    // nearest-neighbor links: for each star, connect to up to maxLinksPer closest within connectDist
    // O(n^2) but n is small (<= ~60) by design.
    for (let i = 0; i < stars.length; i++) {
      if (totalLinks >= maxTotalLinks) break;

      const a = stars[i];
      const candidates = [];

      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= connectDist * connectDist) candidates.push({ j, d2, dx, dy });
      }

      if (!candidates.length) continue;
      candidates.sort((p, q) => p.d2 - q.d2);

      const take = Math.min(maxLinksPer, candidates.length);
      for (let k = 0; k < take; k++) {
        if (totalLinks >= maxTotalLinks) break;
        const c = candidates[k];
        const d = Math.sqrt(c.d2);
        const fade = clamp01(1 - (d / connectDist));

        // subtle line flicker/twinkle
        const flick = 0.85 + 0.15 * Math.sin((t * 0.9 + a.seed * 3.7 + k) * Math.PI * 2);
        const aLine = lineA * fade * flick;

        if (aLine <= 0.001) continue;

        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${aLine})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(stars[c.j].x, stars[c.j].y);
        ctx.stroke();

        totalLinks++;
      }
    }
    ctx.restore();

    // ---- stars ----
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    for (const s of stars) {
      // twinkle = alpha + slight size change
      const tw = (Math.sin((t * twSpeed + s.phase + s.seed * 3.1) * Math.PI * 2) * 0.5 + 0.5);
      const twk = lerp(1 - twDepth, 1, tw);

      // fade-in/out over lifetime so stars “breathe”
      const lp = clamp01(s.lifeT / Math.max(0.001, s.lifeDur));
      const lifeFade = Math.sin(lp * Math.PI); // 0..1..0

      const aStar = baseAlpha * (0.35 + 0.65 * twk) * (0.35 + 0.65 * lifeFade);
      const rStar = radius * (0.80 + 0.45 * twk) * (0.85 + 0.35 * s.layer);

      // main star
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${aStar})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rStar, 0, Math.PI * 2);
      ctx.fill();

      // tiny white core (keeps it crisp without bloom)
      const coreA = aStar * (0.25 + 0.35 * hSmooth);
      if (coreA > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${coreA})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.6, rStar * 0.38), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // vignette
    drawVignette(ctx, w, h, clamp(cfg.vignette ?? 0.18, 0, 0.6));
  }

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const cap = clamp(cfg.fpsCap ?? 60, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // resize + transform (support renderScale)
    const { w, h, dpr, rs } = resizeCanvas(canvas, cfg.renderScale);
    // draw in CSS pixels, but map to the scaled backing store:
    // canvas backing is smaller when renderScale < 1, so scale up to CSS size.
    ctx.setTransform(dpr * rs, 0, 0, dpr * rs, 0, 0);

    // smooth hype + color
    const smooth = clamp(cfg.hypeSmoothing ?? 0.20, 0.05, 0.5);
    const hT = clamp01(hTarget) * clamp(cfg.intensity ?? 1, 0, 2);
    hSmooth = lerp(hSmooth, hT, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth);

    biasSmooth.r = lerp(biasSmooth.r, biasRgb.r, 1 - Math.exp(-6 * dt));
    biasSmooth.g = lerp(biasSmooth.g, biasRgb.g, 1 - Math.exp(-6 * dt));
    biasSmooth.b = lerp(biasSmooth.b, biasRgb.b, 1 - Math.exp(-6 * dt));

    // keep star population where it should be
    pruneAndFill(w, h);

    const t = nowMs / 1000;

    // step + draw
    step(dt, w, h, t);
    draw(w, h, t);
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    // recompute immediately so changes feel responsive
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;
    biasRgb = res.rgb;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    stars.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  raf = requestAnimationFrame(loop);
  return { destroy, setConfig };
}
