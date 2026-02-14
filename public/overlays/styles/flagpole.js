// public/overlays/styles/flagpole.js
// FREE Overlay: Flagpole (Hype raises the flag + gentle wind)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Behavior:
// - total hype = sum(snap.factions[].meter)
// - raise amount uses h = 1 - exp(-total / k)
// - flag color = current hype leader color
// - wind always blows gently (continuous cloth wave)

'use strict';

export const meta = {
  styleKey: 'flagpole',
  name: 'Flagpole (FREE)',
  tier: 'FREE',
  description:
    'A retro-inspired flagpole where hype raises a gently waving flag. The flag always matches the current hype leader color.',

  defaultConfig: {
    // Placement
    anchor: 'left',          // left | center | right
    poleX: 0.12,             // 0..1 (used when anchor is left/center/right as a bias)
    poleTopPad: 0.08,        // 0..0.4 (fraction of height)
    poleBottomPad: 0.10,     // 0..0.4 (fraction of height)

    // Flag sizing (fractions of screen)
    flagWidth: 0.22,         // 0.08..0.6
    flagHeight: 0.12,        // 0.05..0.35

    // Hype mapping
    hypeK: 180,              // higher = slower raise
    maxTotalClamp: 5000,     // safety clamp
    hypeSmoothing: 0.18,     // 0.05..0.5 (higher = snappier)

    // Wind (always on)
    windSpeed: 0.9,          // 0.1..2.5
    windAmp: 12,              // px (scaled by flag size)

    // Visual
    poleGlow: 0.22,          // 0..0.7
    flagAlpha: 0.85,         // 0..1

    // Performance
    fpsCap: 60,              // 15..60
    dprCap: 2                // 1..2
  },

  controls: [
    { key: 'anchor', label: 'Anchor', type: 'select', options: ['left', 'center', 'right'], default: 'left' },
    { key: 'poleX', label: 'Pole X Bias', type: 'range', min: 0, max: 1, step: 0.01, default: 0.12 },
    { key: 'poleTopPad', label: 'Top Padding', type: 'range', min: 0.02, max: 0.4, step: 0.005, default: 0.08 },
    { key: 'poleBottomPad', label: 'Bottom Padding', type: 'range', min: 0.02, max: 0.4, step: 0.005, default: 0.10 },

    { key: 'flagWidth', label: 'Flag Width', type: 'range', min: 0.08, max: 0.6, step: 0.01, default: 0.22 },
    { key: 'flagHeight', label: 'Flag Height', type: 'range', min: 0.05, max: 0.35, step: 0.01, default: 0.12 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 180 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 12000, step: 100, default: 5000 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'windSpeed', label: 'Wind Speed', type: 'range', min: 0.1, max: 2.5, step: 0.05, default: 0.9 },
    { key: 'windAmp', label: 'Wind Amplitude', type: 'range', min: 0, max: 20, step: 0.5, default: 6 },

    { key: 'poleGlow', label: 'Pole Glow', type: 'range', min: 0, max: 0.7, step: 0.01, default: 0.22 },
    { key: 'flagAlpha', label: 'Flag Opacity', type: 'range', min: 0.2, max: 1, step: 0.01, default: 0.85 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'dprCap', label: 'DPR Cap', type: 'range', min: 1, max: 2, step: 1, default: 2 }
  ]
};

function clamp(n, a, b) { n = Number.isFinite(+n) ? +n : a; return Math.max(a, Math.min(b, n)); }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'flagpole';
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
  const dpr = Math.min(dprCap || 2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: W / dpr, h: H / dpr, dpr };
}

function parseConfig(userCfg) {
  const base = meta.defaultConfig;
  const c = userCfg || {};

  return {
    anchor: ['left', 'center', 'right'].includes(String(c.anchor)) ? String(c.anchor) : base.anchor,
    poleX: clamp(c.poleX ?? base.poleX, 0, 1),
    poleTopPad: clamp(c.poleTopPad ?? base.poleTopPad, 0.02, 0.4),
    poleBottomPad: clamp(c.poleBottomPad ?? base.poleBottomPad, 0.02, 0.4),

    flagWidth: clamp(c.flagWidth ?? base.flagWidth, 0.08, 0.6),
    flagHeight: clamp(c.flagHeight ?? base.flagHeight, 0.05, 0.35),

    hypeK: clamp(c.hypeK ?? base.hypeK, 40, 600),
    maxTotalClamp: clamp(c.maxTotalClamp ?? base.maxTotalClamp, 200, 12000),
    hypeSmoothing: clamp(c.hypeSmoothing ?? base.hypeSmoothing, 0.05, 0.5),

    windSpeed: clamp(c.windSpeed ?? base.windSpeed, 0.1, 2.5),
    windAmp: clamp(c.windAmp ?? base.windAmp, 0, 20),

    poleGlow: clamp(c.poleGlow ?? base.poleGlow, 0, 0.7),
    flagAlpha: clamp(c.flagAlpha ?? base.flagAlpha, 0.2, 1),

    fpsCap: clamp(c.fpsCap ?? base.fpsCap, 15, 60),
    dprCap: clamp(c.dprCap ?? base.dprCap, 1, 2)
  };
}

function computeLeaderAndTotal(snap, maxTotalClamp) {
  const factions = Array.isArray(snap?.factions) ? snap.factions : [];
  let total = 0;
  let leader = null;
  let leaderMeter = -Infinity;

  for (const f of factions) {
    const m = Number(f?.meter ?? 0) || 0;
    total += m;
    if (m > leaderMeter) {
      leaderMeter = m;
      leader = f;
    }
  }

  total = clamp(total, 0, maxTotalClamp);
  const leaderColor = String(leader?.colorHex || '#ffffff');
  return { total, leaderColor };
}

function hexToRgb(hex) {
  const h = String(hex || '#ffffff').trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba({ r, g, b }, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${clamp(a, 0, 1)})`;
}

export function init({ root, config, api }) {
  const cfg = parseConfig(config);

  const { canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true });

  let W = 1920, H = 1080;

  // Meter-driven state
  let leaderColor = '#ffffff';
  let total = 0;

  // Smoothed hype -> raise
  let hNow = 0;
  let hTarget = 0;

  api.onMeters((snap) => {
    const res = computeLeaderAndTotal(snap, cfg.maxTotalClamp);
    total = res.total;
    leaderColor = res.leaderColor;

    // Standard hype curve
    const k = Math.max(1, cfg.hypeK);
    const h = 1 - Math.exp(-total / k);
    hTarget = clamp01(h);
  });

  // Resize handling
  const ro = new ResizeObserver(() => {
    const r = resizeCanvas(canvas, cfg.dprCap);
    W = r.w; H = r.h;
  });
  ro.observe(root);
  (() => {
    const r = resizeCanvas(canvas, cfg.dprCap);
    W = r.w; H = r.h;
  })();

  // Animation loop w/ fps cap
  let last = performance.now();
  let acc = 0;
  const stepMs = 1000 / cfg.fpsCap;

  // Wind time
  let windT = 0;

  function frame(now) {
    const dtMs = now - last;
    last = now;
    acc += dtMs;

    // advance wind smoothly even if we skip draw
    const dt = Math.min(0.05, dtMs / 1000);
    windT += dt * cfg.windSpeed;

    if (acc >= stepMs) {
      // smooth toward target
      hNow = lerp(hNow, hTarget, cfg.hypeSmoothing);

      draw(ctx, W, H, {
        cfg,
        h: hNow,
        leaderColor,
        windT
      });

      acc = acc % stepMs;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function draw(ctx, W, H, s) {
  const { cfg, h, leaderColor, windT } = s;

  ctx.clearRect(0, 0, W, H);

  // Pole placement
  let poleXn;
  if (cfg.anchor === 'left') poleXn = clamp(cfg.poleX, 0.02, 0.35);
  else if (cfg.anchor === 'right') poleXn = clamp(cfg.poleX, 0.65, 0.98);
  else poleXn = clamp(cfg.poleX, 0.35, 0.65);

  const poleX = poleXn * W;
  const topY = cfg.poleTopPad * H;
  const bottomY = H - (cfg.poleBottomPad * H);

  // Pole
  ctx.save();
  ctx.lineCap = 'round';

  // glow
  if (cfg.poleGlow > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${cfg.poleGlow})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(poleX + 1, topY);
    ctx.lineTo(poleX + 1, bottomY);
    ctx.stroke();
  }

  // main shaft
  ctx.strokeStyle = 'rgba(240,240,240,0.92)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(poleX, topY);
  ctx.lineTo(poleX, bottomY);
  ctx.stroke();

  // cap ball
  ctx.fillStyle = 'rgba(245,245,245,0.95)';
  ctx.beginPath();
  ctx.arc(poleX, topY - 10, 10, 0, Math.PI * 2);
  ctx.fill();

  // small base
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(poleX - 40, bottomY, 80, 10);

  ctx.restore();

  // Flag sizing (pixels)
  const flagW = cfg.flagWidth * W;
  const flagH = cfg.flagHeight * H;

  // Raise: start near bottom, end near top
  const flagMinY = bottomY - flagH * 0.15;
  const flagMaxY = topY + flagH * 0.15;
  const flagY = lerp(flagMinY, flagMaxY, h);

  // Rope hint (subtle)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(poleX + 8, topY - 5);
  ctx.lineTo(poleX + 8, flagY + 10);
  ctx.stroke();
  ctx.restore();

  // Flag
  drawFlag(ctx, {
    x: poleX,
    y: flagY,
    w: flagW,
    h: flagH,
    colorHex: leaderColor,
    alpha: cfg.flagAlpha,
    windT,
    ampPx: cfg.windAmp * Math.max(0.6, Math.min(1.3, flagH / 140)) // scale a bit with size
  });
}

function drawFlag(ctx, p) {
  const { x, y, w, h, colorHex, alpha, windT, ampPx } = p;

  const rgb = hexToRgb(colorHex);

  // cloth anchor just right of pole
  const ax = x + 10;
  const ay = y;

  const segs = 18;
  const dx = w / segs;

  ctx.save();

  // Fill path (wavy top + bottom)
  ctx.beginPath();
  ctx.moveTo(ax, ay);

  for (let i = 1; i <= segs; i++) {
    const px = ax + dx * i;
    const wave = Math.sin(windT + i * 0.55) * ampPx * (i / segs);
    ctx.lineTo(px, ay + wave);
  }

  for (let i = segs; i >= 0; i--) {
    const px = ax + dx * i;
    const wave = Math.sin(windT + i * 0.55 + 1.2) * ampPx * (i / segs);
    ctx.lineTo(px, ay + h + wave);
  }

  ctx.closePath();

  // body
  ctx.fillStyle = rgba(rgb, alpha);
  ctx.fill();

  // outline highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // seam at pole
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 2);
  ctx.lineTo(ax, ay + h + 2);
  ctx.stroke();

  // grommets
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let k = 0; k < 4; k++) {
    const gy = ay + (h * (k + 1)) / 5;
    ctx.beginPath();
    ctx.arc(ax, gy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
