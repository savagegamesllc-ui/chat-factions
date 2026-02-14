// public/overlays/styles/flagpolePro.js
// PRO Overlay: Flagpole PRO
//
// Adds:
// - Optional image flag (stretched/compressed to fit the flag area)
// - Subtle distant fireworks at (near) max hype
//
// Contract:
//   export const meta
//   export function init({ root, config, api })

'use strict';

export const meta = {
  styleKey: 'flagpolePro',
  name: 'Flagpole (PRO)',
  tier: 'PRO',
  description:
    'A retro-inspired flagpole where hype raises a gently waving flag. PRO adds an optional custom flag image and distant fireworks at max hype.',

  defaultConfig: {
    // Placement
    anchor: 'left',          // left | center | right
    poleX: 0.12,             // 0..1 (used when anchor is left/center/right as a bias)
    poleTopPad: 0.08,        // fraction of height
    poleBottomPad: 0.10,     // fraction of height

    // Flag sizing (fractions of screen)
    flagWidth: 0.22,
    flagHeight: 0.12,

    // Hype mapping
    hypeK: 180,              // higher = slower raise
    maxTotalClamp: 5000,     // safety clamp
    hypeSmoothing: 0.18,     // higher = snappier

    // Wind (always on)
    windSpeed: 0.9,
    windAmp: 6,

    // Visual
    poleGlow: 0.22,
    flagAlpha: 0.9,

    // PRO: Custom flag image
    // Provide a URL accessible by the overlay browser source.
    // Recommended template size (for best results): 1024x600 (wide)
    // Any size is accepted; it will be fit into the flag area.
    flagImageUrl: '',
    flagImageFit: 'stretch', // stretch | contain | cover  (stretch always fills; contain/cover preserve aspect)

    // PRO: Fireworks (distant) at max hype
    fireworksEnabled: true,
    fireworksStartAt: 0.97,   // 0..1 hype threshold to begin
    fireworksIntensity: 0.85, // 0..1 overall density
    fireworksMaxActive: 10,   // cap concurrent bursts
    fireworksScale: 0.65,     // 0.3..1.2 smaller = more distant
    fireworksRegionTop: 0.08, // fraction of height
    fireworksRegionBottom: 0.45, // fraction of height

    // Performance
    fpsCap: 60,
    dprCap: 2
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
    { key: 'flagAlpha', label: 'Flag Opacity', type: 'range', min: 0.2, max: 1, step: 0.01, default: 0.9 },

    { key: 'flagImageUrl', label: 'Flag Image URL', type: 'text', default: '' },
    { key: 'flagImageFit', label: 'Flag Image Fit', type: 'select', options: ['stretch', 'contain', 'cover'], default: 'stretch' },

    { key: 'fireworksEnabled', label: 'Fireworks Enabled', type: 'checkbox', default: true },
    { key: 'fireworksStartAt', label: 'Fireworks Start', type: 'range', min: 0.85, max: 1, step: 0.01, default: 0.97 },
    { key: 'fireworksIntensity', label: 'Fireworks Intensity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'fireworksMaxActive', label: 'Fireworks Max Bursts', type: 'range', min: 2, max: 20, step: 1, default: 10 },
    { key: 'fireworksScale', label: 'Fireworks Scale', type: 'range', min: 0.3, max: 1.2, step: 0.05, default: 0.65 },

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
  c.dataset.style = styleKey || 'flagpolePro';
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

  const fit = String(c.flagImageFit ?? base.flagImageFit);
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

    flagImageUrl: String(c.flagImageUrl ?? base.flagImageUrl ?? '').trim(),
    flagImageFit: (['stretch', 'contain', 'cover'].includes(fit) ? fit : base.flagImageFit),

    fireworksEnabled: !!(c.fireworksEnabled ?? base.fireworksEnabled),
    fireworksStartAt: clamp(c.fireworksStartAt ?? base.fireworksStartAt, 0.85, 1),
    fireworksIntensity: clamp(c.fireworksIntensity ?? base.fireworksIntensity, 0, 1),
    fireworksMaxActive: Math.round(clamp(c.fireworksMaxActive ?? base.fireworksMaxActive, 2, 20)),
    fireworksScale: clamp(c.fireworksScale ?? base.fireworksScale, 0.3, 1.2),
    fireworksRegionTop: clamp(c.fireworksRegionTop ?? base.fireworksRegionTop, 0, 0.5),
    fireworksRegionBottom: clamp(c.fireworksRegionBottom ?? base.fireworksRegionBottom, 0.15, 0.8),

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

// Very small RNG (deterministic-ish by seed)
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function computeFitRect(srcW, srcH, dstW, dstH, mode) {
  // Returns source rect + dest rect for drawImage to achieve contain/cover.
  if (mode === 'stretch') {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: dstW, dh: dstH };
  }
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;

  if (mode === 'contain') {
    let dw = dstW, dh = dstH, dx = 0, dy = 0;
    if (srcAspect > dstAspect) {
      // letterbox top/bottom
      dh = dstW / srcAspect;
      dy = (dstH - dh) / 2;
    } else {
      // pillarbox left/right
      dw = dstH * srcAspect;
      dx = (dstW - dw) / 2;
    }
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx, dy, dw, dh };
  }

  // cover
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (srcAspect > dstAspect) {
    // crop left/right
    sw = srcH * dstAspect;
    sx = (srcW - sw) / 2;
  } else {
    // crop top/bottom
    sh = srcW / dstAspect;
    sy = (srcH - sh) / 2;
  }
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
}

export function init({ root, config, api }) {
  let cfg = parseConfig(config);

  const { canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true });

  let W = 1920, H = 1080;

  // Meter-driven state
  let leaderColor = '#ffffff';
  let total = 0;

  // Smoothed hype -> raise
  let hNow = 0;
  let hTarget = 0;

  // Flag image
  let flagImg = null;
  let flagImgOk = false;
  let flagImgUrlLoaded = '';

  function loadFlagImage(url) {
    flagImgOk = false;
    flagImg = null;
    flagImgUrlLoaded = url || '';
    if (!url) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      flagImg = img;
      flagImgOk = true;
    };
    img.onerror = () => {
      flagImg = null;
      flagImgOk = false;
    };
    img.src = url;
  }

  // Fireworks state
  const fireworks = [];
  let fwSeedBase = (Date.now() ^ ((Math.random() * 1e9) | 0)) >>> 0;

  function refreshConfig(nextConfig) {
    cfg = parseConfig(nextConfig || cfg);

    if (cfg.flagImageUrl !== flagImgUrlLoaded) {
      loadFlagImage(cfg.flagImageUrl);
    }
  }

  // initial load
  refreshConfig(cfg);

  // If your runtime supports config hot updates, this will work; if not, it just won’t be called.
  if (typeof api?.onConfig === 'function') {
    api.onConfig((newCfg) => refreshConfig(newCfg));
  }

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
  let stepMs = 1000 / cfg.fpsCap;

  // Wind time
  let windT = 0;

  function frame(now) {
    const dtMs = now - last;
    last = now;
    acc += dtMs;

    // update step in case fpsCap changed
    stepMs = 1000 / cfg.fpsCap;

    // advance wind smoothly even if we skip draw
    const dt = Math.min(0.05, dtMs / 1000);
    windT += dt * cfg.windSpeed;

    // Fireworks ticking
    tickFireworks(dt);

    if (acc >= stepMs) {
      // smooth toward target
      hNow = lerp(hNow, hTarget, cfg.hypeSmoothing);

      // potentially spawn fireworks
      maybeSpawnFireworks(hNow);

      draw(ctx, W, H, {
        cfg,
        h: hNow,
        leaderColor,
        windT,
        flagImg,
        flagImgOk,
        fireworks
      });

      acc = acc % stepMs;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  function maybeSpawnFireworks(h) {
    if (!cfg.fireworksEnabled) return;
    if (h < cfg.fireworksStartAt) return;

    // spawn chance grows as we approach 1.0
    const t = clamp01((h - cfg.fireworksStartAt) / Math.max(1e-6, (1 - cfg.fireworksStartAt)));
    const intensity = cfg.fireworksIntensity * (0.25 + 0.75 * t);

    // Cap bursts
    if (fireworks.length >= cfg.fireworksMaxActive) return;

    // probabilistic spawn (small distant bursts)
    const chance = 0.08 * intensity; // per draw tick
    if (Math.random() > chance) return;

    const rng = mulberry32((fwSeedBase + ((performance.now() * 10) | 0) + fireworks.length * 17) >>> 0);

    const regionTop = cfg.fireworksRegionTop * H;
    const regionBottom = cfg.fireworksRegionBottom * H;

    const x = lerp(W * 0.20, W * 0.92, rng());
    const y = lerp(regionTop, regionBottom, rng());
    const scale = cfg.fireworksScale * lerp(0.8, 1.15, rng());

    // Color: a softened version of leader color (keeps it cohesive)
    const rgb = hexToRgb(leaderColor);
    const burst = {
      x, y,
      age: 0,
      life: lerp(0.9, 1.35, rng()),
      scale,
      rgb,
      sparks: []
    };

    const sparkCount = Math.round(lerp(10, 18, rng()) * (0.7 + 0.6 * intensity));
    for (let i = 0; i < sparkCount; i++) {
      const ang = rng() * Math.PI * 2;
      const spd = lerp(40, 85, rng()) * scale;
      burst.sparks.push({
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        // slight gravity-ish droop
        g: lerp(60, 110, rng()) * scale,
        // brightness variation
        a0: lerp(0.55, 0.9, rng())
      });
    }

    fireworks.push(burst);
  }

  function tickFireworks(dt) {
    if (!fireworks.length) return;
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const b = fireworks[i];
      b.age += dt;
      if (b.age >= b.life) {
        fireworks.splice(i, 1);
        continue;
      }
    }
  }
}

function draw(ctx, W, H, s) {
  const { cfg, h, leaderColor, windT, flagImg, flagImgOk, fireworks } = s;

  ctx.clearRect(0, 0, W, H);

  // Draw fireworks first (behind everything)
  if (cfg.fireworksEnabled && fireworks && fireworks.length) {
    drawFireworks(ctx, W, H, fireworks);
  }

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

  // Flag (either solid leader color, or custom image)
  drawFlag(ctx, {
    x: poleX,
    y: flagY,
    w: flagW,
    h: flagH,
    leaderColorHex: leaderColor,
    alpha: cfg.flagAlpha,
    windT,
    ampPx: cfg.windAmp * Math.max(0.6, Math.min(1.3, flagH / 140)),
    flagImg,
    flagImgOk,
    fitMode: cfg.flagImageFit
  });
}

function drawFlag(ctx, p) {
  const {
    x, y, w, h,
    leaderColorHex, alpha,
    windT, ampPx,
    flagImg, flagImgOk,
    fitMode
  } = p;

  const ax = x + 10;
  const ay = y;

  const segs = 24; // slightly higher for texture slicing
  const dx = w / segs;

  // Create a clipping path for the cloth shape (wavy top/bottom)
  ctx.save();
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

  // Fill either:
  // - image (sliced vertical strips to approximate cloth warp), or
  // - solid leader color
  if (flagImgOk && flagImg) {
    // Clip to cloth
    ctx.save();
    ctx.clip();

    // draw image into the flag area with selected fit,
    // then apply "wave" by drawing vertical slices offset in Y.
    const srcW = flagImg.naturalWidth || flagImg.width;
    const srcH = flagImg.naturalHeight || flagImg.height;

    // Precompute fit mapping into (0..w, 0..h) local flag coords
    const fit = computeFitRect(srcW, srcH, w, h, fitMode);

    // Global alpha
    ctx.globalAlpha = clamp(alpha, 0, 1);

    for (let i = 0; i < segs; i++) {
      const x0 = ax + dx * i;
      const localX0 = dx * i;
      const localX1 = dx * (i + 1);

      // Corresponding source slice: map localX via fitted dst rect
      // Only draw slices that overlap the fitted dst rect.
      const overlap0 = Math.max(localX0, fit.dx);
      const overlap1 = Math.min(localX1, fit.dx + fit.dw);

      if (overlap1 <= overlap0) continue;

      const t0 = (overlap0 - fit.dx) / fit.dw;
      const t1 = (overlap1 - fit.dx) / fit.dw;

      const sx0 = fit.sx + fit.sw * t0;
      const sx1 = fit.sx + fit.sw * t1;
      const sw = Math.max(1, sx1 - sx0);

      const dxDraw = overlap0;
      const dwDraw = overlap1 - overlap0;

      // Wave offset for this strip (fabric displacement)
      const waveTop = Math.sin(windT + (i + 0.5) * 0.55) * ampPx * ((i + 0.5) / segs);
      const waveBot = Math.sin(windT + (i + 0.5) * 0.55 + 1.2) * ampPx * ((i + 0.5) / segs);

      // Use average to keep it subtle; keeps slice "together"
      const waveY = (waveTop * 0.55 + waveBot * 0.45);

      // Destination rect within flag
      const dy = fit.dy + waveY;
      const dh = fit.dh;

      ctx.drawImage(
        flagImg,
        sx0, fit.sy, sw, fit.sh,
        ax + dxDraw, ay + dy, dwDraw, dh
      );
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  } else {
    // Solid color
    const rgb = hexToRgb(leaderColorHex);
    ctx.fillStyle = rgba(rgb, alpha);
    ctx.fill();
  }

  // Outline highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // seam at pole + grommets (always)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 2);
  ctx.lineTo(ax, ay + h + 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let k = 0; k < 4; k++) {
    const gy = ay + (h * (k + 1)) / 5;
    ctx.beginPath();
    ctx.arc(ax, gy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawFireworks(ctx, W, H, bursts) {
  ctx.save();

  for (const b of bursts) {
    const t = clamp01(b.age / b.life);
    // quick pop then fade
    const pop = Math.sin(Math.min(1, t) * Math.PI);
    const fade = 1 - t;

    const baseA = 0.55 * pop * fade;

    const rgb = b.rgb || { r: 255, g: 255, b: 255 };
    const rSoft = { r: Math.min(255, rgb.r + 40), g: Math.min(255, rgb.g + 40), b: Math.min(255, rgb.b + 40) };

    // faint center glow
    ctx.fillStyle = rgba(rSoft, baseA * 0.35);
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.0 * b.scale * (0.6 + pop), 0, Math.PI * 2);
    ctx.fill();

    // sparks
    for (const s of b.sparks) {
      // integrate approx position (no storing position for simplicity)
      const tt = b.age;
      const px = b.x + s.vx * tt * 0.35;
      const py = b.y + s.vy * tt * 0.35 + 0.5 * s.g * tt * tt * 0.06;

      const a = baseA * s.a0;

      // small distant dot
      ctx.fillStyle = rgba(rgb, a);
      ctx.beginPath();
      ctx.arc(px, py, 1.6 * b.scale, 0, Math.PI * 2);
      ctx.fill();

      // tiny trailing shimmer
      ctx.fillStyle = rgba(rSoft, a * 0.35);
      ctx.beginPath();
      ctx.arc(px - s.vx * 0.01, py - s.vy * 0.01, 2.4 * b.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function computeFitRect(srcW, srcH, dstW, dstH, mode) {
  if (mode === 'stretch') {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: dstW, dh: dstH };
  }
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;

  if (mode === 'contain') {
    let dw = dstW, dh = dstH, dx = 0, dy = 0;
    if (srcAspect > dstAspect) {
      dh = dstW / srcAspect;
      dy = (dstH - dh) / 2;
    } else {
      dw = dstH * srcAspect;
      dx = (dstW - dw) / 2;
    }
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx, dy, dw, dh };
  }

  // cover
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (srcAspect > dstAspect) {
    sw = srcH * dstAspect;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / dstAspect;
    sy = (srcH - sh) / 2;
  }
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
}
