// public/overlays/styles/controlPoint.js
// PRO Overlay: Control Point (Overwatch-inspired tactical HUD)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Notes:
// - Uses 4 corner PNGs (TL/TR/BL/BR) for premium bevel look.
// - Keeps faction-reactive glow + objective bar procedural.
// - Low visual noise: designed to be streamer-safe.

'use strict';

export const meta = {
  styleKey: 'controlPoint',
  name: 'Control Point (PRO)',
  tier: 'PRO',
  description:
    'A tactical, esports HUD: clean beveled corner modules plus a slim objective bar that fills with hype and tints to the current faction leader.',

  defaultConfig: {
    // --- core ---
    mixMode: 'winner',          // winner | weighted (weighted = blended)
    intensity: 1.0,             // 0..2 overall effect multiplier

    // Hype mapping
    hypeK: 170,
    maxTotalClamp: 2200,
    hypeSmoothing: 0.18,

    // Performance
    fpsCap: 60,
    dprCap: 2,

    // --- corner art (PNG assets) ---
    cornerArt_enabled: 'yes',
    cornerArt_pathBase: '/overlays/assets/controlPoint', // public path
    cornerArt_opacity: 1.0,
    cornerArt_scalePct: 0.22,     // relative to min(W,H)
    cornerArt_insetPct: 0.020,    // inset from edges

    // Corner glow underlay (tinted by faction color)
    cornerGlow_enabled: 'yes',
    cornerGlow_strength: 0.55,    // 0..1
    cornerGlow_blurMax: 34,       // px
    cornerGlow_alpha: 0.22,       // silhouette alpha (kept subtle)
    cornerGlow_insetPx: 10,       // pull glow inward (avoids edge spill)
    cornerGlow_pulse: 0.18,       // 0..0.5 (tiny breathing)

    // --- objective bar ---
    bar_enabled: 'yes',
    bar_position: 'top',          // top | bottom
    bar_widthPct: 34,             // % of screen width
    bar_heightPx: 10,
    bar_radiusPx: 7,

    bar_backAlpha: 0.20,
    bar_fillAlpha: 0.50,
    bar_edgeAlpha: 0.85,

    // scan sheen over fill (Overwatch-ish polish)
    scan_enabled: 'yes',
    scan_strength: 0.35,

    // center notch
    notch_enabled: 'yes',

    // capture pips
    pips_enabled: 'yes',
    pips_countMode: 'activeFactions', // activeFactions | fixed
    pips_countFixed: 3,               // 2..6
    pips_sizePx: 6,
    pips_gapPx: 10,
    pips_alpha: 0.85,

    // --- spike hit (reacts to meter jumps) ---
    eventBoost: 1.0,
    spikeSensitivity: 1.0,

    // --- demo (optional; helpful in dashboard preview) ---
    demo_enabled: 'yes',
    demo_noDataMs: 1500,
    demo_cycleSeconds: 10,
    demo_factions: 3,
    demo_leaderIndex: 0,
    demo_lowMeter: 25,
    demo_highMeter: 900,
    demo_colors: '#78c8ff,#37ff9a,#ff5a7a,#f1f6ff'
  },

  controls: [
    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['winner', 'weighted'], default: 'winner' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'dprCap', label: 'DPR Cap', type: 'range', min: 1, max: 3, step: 0.5, default: 2 },

    { key: 'cornerArt_enabled', label: 'Corner Art', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'cornerArt_opacity', label: 'Corner Opacity', type: 'range', min: 0.1, max: 1, step: 0.01, default: 1.0 },
    { key: 'cornerArt_scalePct', label: 'Corner Size', type: 'range', min: 0.12, max: 0.34, step: 0.005, default: 0.22 },
    { key: 'cornerArt_insetPct', label: 'Corner Inset', type: 'range', min: 0, max: 0.06, step: 0.002, default: 0.02 },

    { key: 'cornerGlow_enabled', label: 'Corner Glow', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'cornerGlow_strength', label: 'Corner Glow Strength', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },

    { key: 'bar_enabled', label: 'Objective Bar', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'bar_position', label: 'Bar Position', type: 'select', options: ['top', 'bottom'], default: 'top' },
    { key: 'bar_widthPct', label: 'Bar Width (%)', type: 'range', min: 22, max: 52, step: 1, default: 34 },
    { key: 'bar_heightPx', label: 'Bar Height (px)', type: 'range', min: 6, max: 18, step: 1, default: 10 },

    { key: 'scan_enabled', label: 'Scan Sheen', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'scan_strength', label: 'Scan Strength', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },

    { key: 'pips_enabled', label: 'Capture Pips', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'pips_countMode', label: 'Pip Count Mode', type: 'select', options: ['activeFactions', 'fixed'], default: 'activeFactions' },
    { key: 'pips_countFixed', label: 'Pip Count (Fixed)', type: 'range', min: 2, max: 6, step: 1, default: 3 }
  ]
};

// ---------- utilities ----------
function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function yes(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' || s === 'on';
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

function parseDemoColors(str) {
  const parts = String(str || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return ['#78c8ff', '#37ff9a', '#ff5a7a'];
  return parts;
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'controlPoint';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas, dprCap = 2) {
  const dpr = Math.min(clamp(dprCap, 1, 3), window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: rect.width, h: rect.height, dpr };
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function mixWeightedRgb(colors, weights) {
  let sum = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < colors.length; i++) {
    const w = Math.max(0, weights[i] ?? 0);
    sum += w;
    r += colors[i].r * w;
    g += colors[i].g * w;
    b += colors[i].b * w;
  }
  if (sum <= 0) return { r: 120, g: 200, b: 255 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function pickWinnerRgb(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 120, g: 200, b: 255 };
}

// ---------- main ----------
export function init({ root, config, api }) {
  const cfg = { ...meta.defaultConfig, ...(config || {}) };

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true });

  let W = 0, H = 0, dpr = 1, minDim = 0;

  // meters
  let hasEverReceivedMeters = false;
  let lastMeterAt = 0;

  let hTarget = 0;
  let hSmooth = 0;

  let accentTarget = { r: 120, g: 200, b: 255 };
  let accentSmooth = { r: 120, g: 200, b: 255 };

  let lastTotal = 0;
  let spikeVel = 0;
  let spikeEnergy = 0;

  // corner art
  const corner = { ready: false, tl: null, tr: null, bl: null, br: null };

  // loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  function computeFromSnap(snap) {
    const factions = Array.isArray(snap?.factions) ? snap.factions : [];
    const maxClamp = clamp(cfg.maxTotalClamp, 200, 6000);
    const k = clamp(cfg.hypeK, 40, 600);

    let total = 0;
    let activeCount = 0;
    const colors = [];
    const weights = [];

    for (const f of factions) {
      const m = clamp(+f?.meter || 0, 0, maxClamp);
      total += m;
      if (m > 0) activeCount++;

      const rgb = hexToRgb(f?.colorHex || '#78c8ff');
      colors.push(rgb);
      weights.push(m);
    }

    total = clamp(total, 0, maxClamp);
    let h = 1 - Math.exp(-total / k);
    h = clamp01(h);

    let rgb;
    if (!colors.length) rgb = { r: 120, g: 200, b: 255 };
    else rgb = (cfg.mixMode === 'winner') ? pickWinnerRgb(colors, weights) : mixWeightedRgb(colors, weights);

    return { total, h, rgb, activeCount };
  }

  const unsubMeters = api.onMeters((snap) => {
    hasEverReceivedMeters = true;
    lastMeterAt = performance.now();

    const res = computeFromSnap(snap || { factions: [] });
    hTarget = res.h;
    accentTarget = res.rgb;

    const d = Math.abs(res.total - lastTotal);
    lastTotal = res.total;

    // spike impulse from meter jumps
    const bump01 = clamp01(d / 70) * clamp(cfg.eventBoost, 0, 2) * clamp(cfg.spikeSensitivity, 0, 2);
    spikeVel += bump01 * 1.25;
  });

  async function loadCornerArt() {
    if (!yes(cfg.cornerArt_enabled)) return;

    const base = String(cfg.cornerArt_pathBase || '/overlays/assets/controlPoint').replace(/\/$/, '');
    try {
      const [tl, tr, bl, br] = await Promise.all([
        loadImage(`${base}/cornerTL@2x.png`),
        loadImage(`${base}/cornerTR@2x.png`),
        loadImage(`${base}/cornerBL@2x.png`),
        loadImage(`${base}/cornerBR@2x.png`)
      ]);
      corner.tl = tl; corner.tr = tr; corner.bl = bl; corner.br = br;
      corner.ready = true;
    } catch (e) {
      corner.ready = false;
      // keep the overlay functional even if art fails
      console.warn('[controlPoint] corner art failed to load:', e);
    }
  }
  loadCornerArt();

  const ro = new ResizeObserver(() => doResize());
  ro.observe(container);

  function doResize() {
    const s = resizeCanvas(canvas, cfg.dprCap);
    W = s.w; H = s.h; dpr = s.dpr;
    minDim = Math.min(W, H);
  }
  doResize();

  function applyDemoIfNoData(nowMs) {
    if (!yes(cfg.demo_enabled)) return;

    const noDataMs = clamp(cfg.demo_noDataMs, 250, 20000);
    const stale = !hasEverReceivedMeters || (nowMs - lastMeterAt > noDataMs);
    if (!stale) return;

    const demoCount = clamp(cfg.demo_factions, 2, 4) | 0;
    const colors = parseDemoColors(cfg.demo_colors).map(hexToRgb);
    const leaderIdx = clamp(cfg.demo_leaderIndex, 0, demoCount - 1) | 0;

    const cycle = clamp(cfg.demo_cycleSeconds, 4, 60);
    const phase = (nowMs / 1000) % cycle;
    const half = cycle / 2;
    let t = phase < half ? (phase / half) : ((phase - half) / half);
    const isMax = phase >= half;
    t = t * t * (3 - 2 * t);

    const low = clamp(cfg.demo_lowMeter, 0, cfg.maxTotalClamp);
    const high = clamp(cfg.demo_highMeter, low, cfg.maxTotalClamp);
    const meterVal = isMax ? lerp(low, high, t) : lerp(high, low, t);

    // build weights
    const weights = [];
    for (let i = 0; i < demoCount; i++) {
      weights.push(meterVal * (0.92 + 0.16 * ((i + 1) / demoCount)));
    }

    // total and hype
    let total = 0;
    for (const w of weights) total += w;
    const k = clamp(cfg.hypeK, 40, 600);
    hTarget = clamp01(1 - Math.exp(-total / k));

    // choose leader color for winner mode
    if (cfg.mixMode === 'winner') accentTarget = colors[leaderIdx] || colors[0];
    else accentTarget = mixWeightedRgb(colors.slice(0, demoCount), weights);

    // nudge spikes a bit so demo feels alive
    spikeVel += 0.0025;
  }

  function drawCornerArt(nowMs) {
    if (!yes(cfg.cornerArt_enabled) || !corner.ready) return;

    const opacity = clamp(cfg.cornerArt_opacity, 0.05, 1);
    if (opacity <= 0) return;

    const inset = minDim * clamp(cfg.cornerArt_insetPct, 0, 0.08);
    const target = minDim * clamp(cfg.cornerArt_scalePct, 0.10, 0.40);

    const glowOn = yes(cfg.cornerGlow_enabled);
    const glowStrengthBase = clamp01(cfg.cornerGlow_strength);
    const glowBlurMax = clamp(cfg.cornerGlow_blurMax, 0, 120);
    const glowAlpha = clamp01(cfg.cornerGlow_alpha);
    const glowInsetPx = clamp(cfg.cornerGlow_insetPx, 0, 60);
    const glowPulse = clamp(cfg.cornerGlow_pulse, 0, 0.5);

    const pulse = (Math.sin((nowMs / 1000) * 1.7) * 0.5 + 0.5);
    const pulseMul = 1 + glowPulse * (pulse * 2 - 1);

    function drawOne(img, x, y, anchorX, anchorY) {
      if (!img) return;

      const ar = img.width / img.height;
      let w = target, h = target;
      if (ar >= 1) h = w / ar;
      else w = h * ar;

      // anchor: 0 = left/top, 1 = right/bottom
      const px = x - w * anchorX;
      const py = y - h * anchorY;

      // Glow underlay (draw a faint silhouette with shadow)
      if (glowOn) {
        const g = glowStrengthBase * (0.15 + 0.85 * hSmooth) * pulseMul;
        const blur = glowBlurMax * g;

        if (blur > 0.01 && g > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.shadowBlur = blur;
          ctx.shadowColor = `rgba(${accentSmooth.r | 0},${accentSmooth.g | 0},${accentSmooth.b | 0},${0.60 * g})`;
          ctx.globalAlpha = glowAlpha * g;

          // pull inward slightly so glow doesn't bleed off-screen
          const gx = px + glowInsetPx * (anchorX ? -1 : 1);
          const gy = py + glowInsetPx * (anchorY ? -1 : 1);

          ctx.drawImage(img, gx, gy, w, h);
          ctx.restore();
        }
      }

      // Main art
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, px, py, w, h);
      ctx.restore();
    }

    // TL (anchor left/top)
    drawOne(corner.tl, inset, inset, 0, 0);
    // TR (anchor right/top)
    drawOne(corner.tr, W - inset, inset, 1, 0);
    // BL (anchor left/bottom)
    drawOne(corner.bl, inset, H - inset, 0, 1);
    // BR (anchor right/bottom)
    drawOne(corner.br, W - inset, H - inset, 1, 1);
  }

  function drawObjectiveBar(nowMs) {
    if (!yes(cfg.bar_enabled)) return;

    const barW = clamp(W * (clamp(cfg.bar_widthPct, 15, 70) / 100), 180, W - 24);
    const barH = clamp(cfg.bar_heightPx, 4, 28);
    const rad = clamp(cfg.bar_radiusPx, 0, 80);

    const y = (cfg.bar_position === 'bottom') ? (H - 12 - barH) : 12;
    const x = (W - barW) * 0.5;

    // breathing and spike hit
    const breathe = (0.5 + 0.5 * Math.sin((nowMs / 1000) * 1.6)) * 0.35;
    const a = clamp01(0.18 + 0.62 * hSmooth + 0.55 * spikeEnergy + breathe);

    const backA = clamp01(cfg.bar_backAlpha) * (0.65 + 0.55 * hSmooth);
    const fillA = clamp01(cfg.bar_fillAlpha) * (0.60 + 0.70 * hSmooth + 0.30 * spikeEnergy);
    const edgeA = clamp01(cfg.bar_edgeAlpha) * (0.70 + 0.45 * hSmooth);

    // background plate
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,255,255,${backA * 0.35})`;
    roundedRectPath(ctx, x, y, barW, barH, rad);
    ctx.fill();

    // inner fill
    const pad = Math.max(2, barH * 0.18);
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = Math.max(1, barW - pad * 2);
    const innerH = Math.max(1, barH - pad * 2);

    const fillW = innerW * clamp01(hSmooth * clamp(cfg.intensity, 0, 2));
    ctx.fillStyle = `rgba(${accentSmooth.r | 0},${accentSmooth.g | 0},${accentSmooth.b | 0},${fillA})`;
    roundedRectPath(ctx, innerX, innerY, fillW, innerH, Math.max(1, rad - pad));
    ctx.fill();

    // scan sheen
    if (yes(cfg.scan_enabled) && clamp01(cfg.scan_strength) > 0.001) {
      const sStr = clamp01(cfg.scan_strength) * (0.20 + 0.80 * hSmooth);
      const sweep = ((nowMs / 1000) * 0.22) % 1; // 0..1
      const sx = innerX + (innerW + 120) * sweep - 120;

      const grad = ctx.createLinearGradient(sx, 0, sx + 120, 0);
      grad.addColorStop(0.0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.45, `rgba(255,255,255,${0.20 * sStr})`);
      grad.addColorStop(0.55, `rgba(255,255,255,${0.35 * sStr})`);
      grad.addColorStop(1.0, 'rgba(255,255,255,0)');

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      roundedRectPath(ctx, innerX, innerY, innerW, innerH, Math.max(1, rad - pad));
      ctx.fill();
      ctx.restore();
    }

    // edge line (with subtle glow at higher hype)
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${edgeA * a})`;
    ctx.lineWidth = 1.5;

    const glow = clamp01(0.25 + 0.85 * hSmooth + 0.35 * spikeEnergy);
    if (glow > 0.2) {
      ctx.shadowColor = `rgba(${accentSmooth.r | 0},${accentSmooth.g | 0},${accentSmooth.b | 0},0.55)`;
      ctx.shadowBlur = 14 * glow;
    }

    roundedRectPath(ctx, x, y, barW, barH, rad);
    ctx.stroke();
    ctx.restore();

    // center notch line
    if (yes(cfg.notch_enabled)) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`;
      ctx.lineWidth = 1.25;
      const cx = x + barW * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, y - 2.5);
      ctx.lineTo(cx, y + barH + 2.5);
      ctx.stroke();
      ctx.restore();
    }

    // capture pips
    if (yes(cfg.pips_enabled)) {
      const count = (cfg.pips_countMode === 'fixed')
        ? (clamp(cfg.pips_countFixed, 2, 6) | 0)
        : clamp(lastTotal > 0 ? (latestActiveCount || 2) : 2, 2, 6) | 0;

      const size = clamp(cfg.pips_sizePx, 3, 14);
      const gap = clamp(cfg.pips_gapPx, 6, 28);
      const py = (cfg.bar_position === 'bottom') ? (y - 12) : (y + barH + 12);

      const cx = x + barW * 0.5;
      const totalW = (count - 1) * gap;
      const startX = cx - totalW * 0.5;

      const prog = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));
      const filled = prog * (count - 1);

      for (let i = 0; i < count; i++) {
        const px = startX + i * gap;
        const fillAmt = clamp01(filled - (i - 1));
        const on = clamp01(0.15 + 0.85 * fillAmt);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.PI / 4);

        const pipA = clamp01(cfg.pips_alpha) * (0.55 + 0.45 * a);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = pipA;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(-size * 0.5, -size * 0.5, size, size);

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pipA * on;
        ctx.fillStyle = `rgba(${accentSmooth.r | 0},${accentSmooth.g | 0},${accentSmooth.b | 0},0.95)`;
        ctx.fillRect(-size * 0.5, -size * 0.5, size, size);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = pipA;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.1;
        ctx.strokeRect(-size * 0.5, -size * 0.5, size, size);

        ctx.restore();
      }
    }

    ctx.restore();
  }

  // track active factions for pips (demo uses fake value)
  let latestActiveCount = 3;

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(60, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const cap = clamp(cfg.fpsCap, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    applyDemoIfNoData(nowMs);

    // smooth hype
    const smooth = clamp(cfg.hypeSmoothing, 0.05, 0.5);
    const a = 1 - Math.exp(-(1 / smooth) * dt);
    hSmooth = lerp(hSmooth, hTarget, a);
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity, 0, 2));

    // smooth color
    const ca = 1 - Math.exp(-8 * dt);
    accentSmooth.r = lerp(accentSmooth.r, accentTarget.r, ca);
    accentSmooth.g = lerp(accentSmooth.g, accentTarget.g, ca);
    accentSmooth.b = lerp(accentSmooth.b, accentTarget.b, ca);

    // spike energy
    spikeVel *= Math.pow(0.12, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.60);
    spikeVel *= Math.pow(0.65, dt);

    // resize + clear
    const s = resizeCanvas(canvas, cfg.dprCap);
    W = s.w; H = s.h; dpr = s.dpr;
    minDim = Math.min(W, H);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // draw
    drawCornerArt(nowMs);
    drawObjectiveBar(nowMs);
  }

  raf = requestAnimationFrame(loop);

  // cleanup
  return () => {
    try { unsubMeters && unsubMeters(); } catch {}
    try { ro && ro.disconnect(); } catch {}
    cancelAnimationFrame(raf);
    try { container.remove(); } catch {}
  };
}
