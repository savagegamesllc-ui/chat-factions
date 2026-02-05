// public/overlays/styles/saiyanAura.js
// PRO Overlay: Saiyan Aura (Faction-powered “Super Saiyan” swirl shell)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Visual goals:
// - 0 hype: barely-visible white “air swirl”
// - rising hype: aura thickens, speeds up, gains faction-mixed inner color
// - always: gold/yellow rim border
// - illusion: 3D-ish shell via depth shading + twisted vertical flow bands
//
// OBS-safe:
// - Single canvas, no per-frame DOM churn
// - Capped band count and segment count
// - FPS cap + DPR cap

'use strict';

export const meta = {
  styleKey: 'saiyanAura',
  name: 'Saiyan Aura (PRO)',
  tier: 'PRO',
  description:
    'A Super Saiyan-style aura that starts as a faint white airflow swirl and powers up into a faction-tinted energy shell with a constant golden rim.',

  defaultConfig: {
    // Placement (center of “character”)
    centerX: 0.5,          // 0..1
    centerY: 0.58,         // 0..1 (slightly below center feels more “body”)
    auraWidth: 0.42,       // fraction of screen width (shell radius)
    auraHeight: 0.82,      // fraction of screen height (vertical span)

    // Hype mapping
    hypeK: 170,            // bigger = slower power-up curve
    maxTotalClamp: 2200,
    hypeSmoothing: 0.18,   // 0.05..0.5

    // Faction mixing
    mixMode: 'weighted',   // weighted | winner
    biasStrength: 0.30,    // 0..0.8 (how much faction color influences)

    // Aura look
    bandCount: 12,         // 6..20
    segments: 42,          // 18..80 (perf knob)
    twist: 2.15,           // vertical twist amount
    swirlSpeed: 1.0,       // base rotation speed
    riseSpeed: 1.0,        // upward scroll speed

    // Thickness / intensity
    baseOpacity: 0.10,     // 0..0.35 (how visible at low hype)
    intensity: 1.0,        // 0..2 (global multiplier)

    rimStrength: 1.0,      // 0..2
    rimWidth: 1.25,        // 0.5..2.5 (rim width multiplier)
    rimGlow: 0.85,         // 0..1
    innerGlow: 0.85,       // 0..1

    // “Air swirl” at low hype
    airWhiteness: 1.0,     // 0..1 (keeps low hype mostly white)
    airStart: 0.00,        // hype at which the air becomes visible
    colorStart: 0.18,      // hype at which faction color starts appearing
    whiteHotAtMax: 0.30,   // 0..1 (how much it goes white-hot near max hype)

    // Background shaping
    backgroundDim: 0.00,   // 0..0.25
    vignette: 0.22,        // 0..0.8

    // Performance
    fpsCap: 60,            // 15..60
    dprCap: 2.0            // 1..2
  },

  controls: [
    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'centerX', label: 'Center X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'centerY', label: 'Center Y', type: 'range', min: 0, max: 1, step: 0.01, default: 0.58 },
    { key: 'auraWidth', label: 'Aura Width', type: 'range', min: 0.15, max: 0.75, step: 0.01, default: 0.42 },
    { key: 'auraHeight', label: 'Aura Height', type: 'range', min: 0.35, max: 1.25, step: 0.01, default: 0.82 },

    { key: 'bandCount', label: 'Band Count', type: 'range', min: 6, max: 20, step: 1, default: 12 },
    { key: 'segments', label: 'Segments', type: 'range', min: 18, max: 80, step: 1, default: 42 },

    { key: 'twist', label: 'Twist', type: 'range', min: 0.6, max: 4.0, step: 0.05, default: 2.15 },
    { key: 'swirlSpeed', label: 'Swirl Speed', type: 'range', min: 0, max: 3.0, step: 0.05, default: 1.0 },
    { key: 'riseSpeed', label: 'Rise Speed', type: 'range', min: 0, max: 3.0, step: 0.05, default: 1.0 },

    { key: 'baseOpacity', label: 'Base Opacity', type: 'range', min: 0, max: 0.35, step: 0.01, default: 0.10 },
    { key: 'rimStrength', label: 'Rim Strength', type: 'range', min: 0, max: 2.0, step: 0.05, default: 1.0 },
    { key: 'rimWidth', label: 'Rim Width', type: 'range', min: 0.5, max: 2.5, step: 0.05, default: 1.25 },
    { key: 'rimGlow', label: 'Rim Glow', type: 'range', min: 0, max: 1.0, step: 0.01, default: 0.85 },
    { key: 'innerGlow', label: 'Inner Glow', type: 'range', min: 0, max: 1.0, step: 0.01, default: 0.85 },

    { key: 'colorStart', label: 'Color Start (h)', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18 },
    { key: 'whiteHotAtMax', label: 'White-Hot at Max', type: 'range', min: 0, max: 1.0, step: 0.01, default: 0.30 },

    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.00 },
    { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.22 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'dprCap', label: 'DPR Cap', type: 'range', min: 1, max: 2, step: 0.05, default: 2.0 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 800, step: 5, default: 170 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 }
  ]
};

function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

function smoothstep01(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
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

  const k = clamp(cfg.hypeK ?? 170, 40, 800);
  let h = 1 - Math.exp(-total / k);

  // slight lift so small hype isn’t totally invisible
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
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'saiyanAura';
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

function resizeCanvas(canvas, dprCap) {
  const dpr = Math.min(dprCap ?? 2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: W / dpr, h: H / dpr, dpr };
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

function rgba(r, g, b, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${clamp01(a)})`;
}

function goldColor(a) {
  // warm gold rim with a tiny bit of orange
  // blend is baked-in by drawing 2 strokes (bright + deeper)
  return `rgba(255, 211, 74, ${clamp01(a)})`;
}
function goldDeep(a) {
  return `rgba(255, 176, 0, ${clamp01(a)})`;
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // live snap
  let latestSnap = { factions: [] };
  let { h: hTarget, rgb: biasRgb } = computeBlendAndHype(latestSnap, cfg);

  // smoothed
  let hSmooth = 0;
  let biasSmooth = { r: 140, g: 210, b: 255 };

  // band setup
  let bands = [];
  function rebuildBands() {
    const n = clamp(cfg.bandCount, 6, 20) | 0;
    bands = Array.from({ length: n }, (_, i) => ({
      seed: Math.random() * 9999,
      phase: Math.random() * Math.PI * 2,
      layer: i / Math.max(1, n - 1), // 0..1 (inner->outer)
      dir: (Math.random() < 0.5 ? -1 : 1)
    }));
  }
  rebuildBands();

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;
    biasRgb = res.rgb;
  });

  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const onResize = () => {};
  window.addEventListener('resize', onResize, { passive: true });

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    // rebuild if perf knobs changed
    rebuildBands();
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;
    biasRgb = res.rgb;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function drawAura(w, h, t) {
    // smoothed hype
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * (1 / 60)));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));

    // smooth color
    biasSmooth.r = lerp(biasSmooth.r, biasRgb.r, 0.12);
    biasSmooth.g = lerp(biasSmooth.g, biasRgb.g, 0.12);
    biasSmooth.b = lerp(biasSmooth.b, biasRgb.b, 0.12);

    // background dim
    const dim = clamp(cfg.backgroundDim, 0, 0.25) * lerp(0.15, 1.0, smoothstep01(hSmooth));
    if (dim > 0.001) {
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    const cx = clamp(cfg.centerX, 0, 1) * w;
    const cy = clamp(cfg.centerY, 0, 1) * h;

    const shellRx = clamp(cfg.auraWidth, 0.1, 0.95) * w;
    const shellRy = clamp(cfg.auraHeight, 0.2, 1.4) * h;

    // A clear-ish center so it feels like “around” a body:
    // stronger at high hype (shell is more defined)
    const centerClear = lerp(0.35, 0.42, smoothstep01(hSmooth));

    // Motion tuning
    const swirl = clamp(cfg.swirlSpeed, 0, 5) * (0.35 + 1.25 * hSmooth);
    const rise = clamp(cfg.riseSpeed, 0, 5) * (0.45 + 1.35 * hSmooth);
    const twist = clamp(cfg.twist, 0.2, 6);

    // Color blending: start white, then fade to faction tint after colorStart
    const colorStart = clamp(cfg.colorStart ?? 0.18, 0, 0.8);
    const colorT = smoothstep01((hSmooth - colorStart) / Math.max(0.001, (1 - colorStart)));

    const bias = clamp(cfg.biasStrength ?? 0.3, 0, 0.9);

    // “White-hot” push near max hype (classic SSJ flare)
    const hot = clamp(cfg.whiteHotAtMax ?? 0.3, 0, 1) * smoothstep01((hSmooth - 0.72) / 0.28);

    const rT = (biasSmooth.r / 255);
    const gT = (biasSmooth.g / 255);
    const bT = (biasSmooth.b / 255);

    // Base opacity grows with hype, but never fully blocks the stream view
    const baseOp = clamp(cfg.baseOpacity, 0, 0.35) * (0.18 + 1.15 * smoothstep01(hSmooth));

    // Rim tuning
    const rimStrength = clamp(cfg.rimStrength, 0, 2);
    const rimGlow = clamp01(cfg.rimGlow);
    const rimWmul = clamp(cfg.rimWidth, 0.5, 3);

    // Inner tuning
    const innerGlow = clamp01(cfg.innerGlow);

    // Add a subtle “breathing” sway to sell energy without being invasive
    const breathe = lerp(0.0, 6.0, smoothstep01(hSmooth));
    container.style.transform =
      (breathe > 0.01)
        ? `translate3d(${(Math.sin(t * 2.0) * breathe * 0.18).toFixed(2)}px,${(Math.cos(t * 1.7) * breathe * 0.12).toFixed(2)}px,0)`
        : 'translateZ(0)';

    // Composite modes:
    // - rim in 'lighter' for glow
    // - inner in 'lighter' but lower alpha
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Precompute segment step
    const seg = clamp(cfg.segments, 18, 110) | 0;
    const y0 = cy - shellRy * 0.55;
    const y1 = cy + shellRy * 0.55;
    const dy = (y1 - y0) / seg;

    // Band ordering: draw back layers first, front layers last
    // We'll fake “depth” by using cos(theta) and shifting alpha/width.
    for (let bi = 0; bi < bands.length; bi++) {
      const b = bands[bi];

      // layer radius: inner->outer
      const layer = b.layer;
      const rBase = shellRx * lerp(0.42, 1.0, layer);
      const bandThick = lerp(2.2, 10.5, smoothstep01(hSmooth)) * lerp(0.7, 1.15, layer);

      // time offsets per band
      const phase = b.phase + b.dir * t * swirl * (0.35 + 0.85 * layer);
      const scroll = t * rise * (0.55 + 0.55 * layer) + b.seed * 0.0007;

      // Rim stroke is wider and slightly blurrier
      const rimWidth = bandThick * 1.45 * rimWmul;
      const innerWidth = bandThick * 0.95;

      // Rim glow
      ctx.shadowBlur = (8 + 60 * rimGlow) * (0.35 + 1.15 * hSmooth);
      ctx.shadowColor = 'rgba(255, 220, 110, 0.9)';

      // Draw a single ribbon path per band
      // Construct as a polyline; “width” is achieved with strokes.
      ctx.beginPath();
      for (let si = 0; si <= seg; si++) {
        const y = y0 + dy * si;

        // normalized vertical position (-1..1)
        const yn = (y - cy) / Math.max(1, shellRy * 0.55);

        // theta: twist over vertical + rotation + scroll wobble
        const theta = phase + yn * Math.PI * twist + Math.sin((yn * 1.2 + scroll) * Math.PI * 2) * 0.18;

        // depth: -1..1 (back to front)
        const depth = Math.cos(theta);

        // horizontal “shell” scale compresses slightly near top/bottom (egg shape)
        const yShape = 1 - 0.28 * (yn * yn);
        const xShell = rBase * yShape;

        // x offset with slight noise to feel like turbulent air
        const wobble = Math.sin(b.seed + t * 2.1 + yn * 6.0) * lerp(1.5, 9.0, hSmooth) * (0.35 + 0.65 * layer);

        // shell x position (fake 3D wrap: sin(theta) gives left/right)
        const x = cx + Math.sin(theta) * xShell + wobble;

        if (si === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        // We’ll use depth later by stroking twice with different alpha;
        // for performance, keep it single polyline and use globalAlpha per stroke.
        // (Depth is approximated by using band index ordering + varying alpha with layer.)
      }

      // Rim alpha:
      // - stays visible even at low hype (but subtle)
      // - stronger on outer layers
      const rimA =
        baseOp *
        rimStrength *
        lerp(0.35, 0.95, layer) *
        lerp(0.20, 1.0, smoothstep01(hSmooth)) *
        (0.65 + 0.35 * Math.sin(t * 6.0 + b.seed) * (0.15 + 0.85 * hSmooth));

      // Draw rim (two-pass gold for richer border)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.globalAlpha = rimA * 0.85;
      ctx.strokeStyle = goldDeep(0.95);
      ctx.lineWidth = rimWidth * 1.05;
      ctx.stroke();

      ctx.globalAlpha = rimA;
      ctx.strokeStyle = goldColor(1.0);
      ctx.lineWidth = rimWidth * 0.72;
      ctx.stroke();

      // Inner glow stroke: start mostly white, then move toward faction color
      ctx.shadowBlur = (6 + 55 * innerGlow) * (0.30 + 1.20 * hSmooth);
      ctx.shadowColor = 'rgba(255,255,255,0.85)';

      // Inner color: white → faction → white-hot at max
      // Start with a soft white airflow tone
      const airWhite = clamp01(cfg.airWhiteness ?? 1.0);
      const baseWhite = 245;

      // faction blended toward white at low hype; “hot” pushes back toward white at max
      const cr = lerp(baseWhite, lerp(baseWhite, rT * 255, bias), colorT);
      const cg = lerp(baseWhite, lerp(baseWhite, gT * 255, bias), colorT);
      const cb = lerp(baseWhite, lerp(baseWhite, bT * 255, bias), colorT);

      const hr = lerp(cr, 255, hot);
      const hg = lerp(cg, 255, hot);
      const hb = lerp(cb, 255, hot);

      // Inner alpha grows with hype, but keep center clearer
      const innerA =
        baseOp *
        lerp(0.20, 0.95, smoothstep01(hSmooth)) *
        lerp(0.50, 1.10, layer);

      // Apply center clear by reducing alpha near x≈cx (approximated via layer)
      const clearMul = lerp(0.70, 1.0, layer) * (1 - centerClear * lerp(0.40, 0.70, 1 - layer));

      ctx.globalAlpha = innerA * clearMul;

      // If hype is very low, force inner toward air-white
      const airOnly = smoothstep01((hSmooth - clamp(cfg.airStart ?? 0.0, 0, 0.25)) / 0.20);
      const ww = lerp(1.0, airWhite, 1 - airOnly);

      ctx.strokeStyle = rgba(
        lerp(hr, 255, ww * 0.25),
        lerp(hg, 255, ww * 0.25),
        lerp(hb, 255, ww * 0.25),
        1
      );
      ctx.lineWidth = innerWidth;
      ctx.stroke();

      // Reset shadows for next band
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
    accMs = 0;

    const { w, h, dpr } = resizeCanvas(canvas, clamp(cfg.dprCap, 1, 2));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    drawAura(w, h, t);

    const vig = clamp(cfg.vignette, 0, 0.9) * lerp(0.8, 1.15, smoothstep01(hSmooth));
    if (vig > 0.001) drawVignette(ctx, w, h, vig);
  }

  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
