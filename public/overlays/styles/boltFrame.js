// public/overlays/styles/boltFrame.js
// PRO Overlay: Bolt Frame (Horizontal strip of 4 floating stat frames + live electricity links)
// Cyberpunk frame styling + scanlines + corner brackets + animated data ticker

'use strict';

export const meta = {
  styleKey: 'boltFrame',
  name: 'Bolt Frame (PRO)',
  tier: 'PRO',
  description:
    'Four floating stat frames in a horizontal strip (Latest Follower/Sub/Cheer/Gift Sub) linked by live electricity that intensifies with hype and shifts to the hype leader color.',

  defaultConfig: {
    // Layout
    anchorX: 0.5,              // 0..1 (center of the strip)
    anchorY: 0.86,             // 0..1 (vertical position of the strip)
    stripWidth: 0.86,          // 0.4..0.98 (fraction of screen width)
    frameHeight: 0.115,        // 0.06..0.22 (fraction of screen height)
    frameGap: 0.018,           // 0..0.06 (fraction of screen width)

    // Floating motion
    floatAmount: 6.0,          // px
    floatSpeed: 0.85,          // 0.1..2.5

    // Base visual style
    panelFill: 0.12,           // 0..0.35 (panel background opacity)
    panelStroke: 0.55,         // 0..1   (border opacity)
    panelGlow: 0.85,           // 0..1   (outer glow strength)
    innerSheen: 0.40,          // 0..1   (subtle top sheen)
    textOpacity: 0.92,         // 0..1
    labelOpacity: 0.72,        // 0..1

    // Cyberpunk frame styling
    frameStyle: 'cyber',       // cyber | rounded
    cornerRadius: 16,          // px (only for rounded)
    chamfer: 18,               // px (corner cut)
    notch: 14,                 // px (side notch depth)
    bracketSize: 16,           // px
    accentStrip: 0.55,         // 0..1
    scanlines: 0.22,           // 0..1

    // Data ticker (animated HUD line)
    tickerEnabled: true,
    tickerStrength: 0.55,      // 0..1
    tickerDensity: 0.62,       // 0..1 (more = more segments)
    tickerSpeed: 0.95,         // 0.2..2.5
    tickerHeight: 10,          // px
    tickerYOffset: 14,         // px from bottom inside panel

    // Electricity
    electricEnabled: true,
    electricThickness: 1.8,    // px base
    electricGlow: 0.9,         // 0..1
    electricWiggle: 1.0,       // 0.2..2 (arc noise amount)
    electricBranchChance: 0.35,// 0..1 (extra branches at high hype)
    electricJitterRate: 2.5,   // 0.5..8 (reroute frequency)

    // Hype mapping
    mixMode: 'winner',         // winner | weighted
    intensity: 1.0,            // 0..2 (overall energy)
    hypeK: 180,                // scale for h = 1-exp(-total/k)
    maxTotalClamp: 2400,
    hypeSmoothing: 0.18,       // 0.05..0.5
    eventBoost: 1.0,           // 0..2
    spikeSensitivity: 1.0,     // 0..2

    // Text (placeholders — you can later inject real values via config overrides)
    titles: ['Latest Follower', 'Latest Sub', 'Latest Cheer', 'Latest Gift Sub'],
    values: ['—', '—', '—', '—'],
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    labelSize: 14,             // px
    valueSize: 22              // px
  },

  controls: [
    { key: 'anchorX', label: 'Anchor X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'anchorY', label: 'Anchor Y', type: 'range', min: 0, max: 1, step: 0.01, default: 0.86 },
    { key: 'stripWidth', label: 'Strip Width', type: 'range', min: 0.4, max: 0.98, step: 0.01, default: 0.86 },
    { key: 'frameHeight', label: 'Frame Height', type: 'range', min: 0.06, max: 0.22, step: 0.005, default: 0.115 },
    { key: 'frameGap', label: 'Frame Gap', type: 'range', min: 0, max: 0.06, step: 0.001, default: 0.018 },

    { key: 'frameStyle', label: 'Frame Style', type: 'select', options: ['cyber', 'rounded'], default: 'cyber' },
    { key: 'chamfer', label: 'Chamfer', type: 'range', min: 0, max: 40, step: 1, default: 18 },
    { key: 'notch', label: 'Notch', type: 'range', min: 0, max: 30, step: 1, default: 14 },
    { key: 'scanlines', label: 'Scanlines', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22 },
    { key: 'tickerEnabled', label: 'Enable Data Ticker', type: 'checkbox', default: true },
    { key: 'tickerStrength', label: 'Ticker Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },

    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['winner', 'weighted'], default: 'winner' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'electricEnabled', label: 'Enable Electricity', type: 'checkbox', default: true },
    { key: 'electricThickness', label: 'Electric Thickness', type: 'range', min: 0.5, max: 6, step: 0.1, default: 1.8 },
    { key: 'electricJitterRate', label: 'Electric Jitter Rate', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.5 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 180 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2400 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 }
  ]
};

function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
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

function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 140, g: 210, b: 255 };
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
  c.dataset.style = styleKey || 'boltFrame';
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

function rgbCss(rgb, a = 1) {
  return `rgba(${rgb.r | 0},${rgb.g | 0},${rgb.b | 0},${a})`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function cyberPanelPath(ctx, x, y, w, h, chamfer, notch) {
  const c = Math.max(0, Math.min(chamfer, Math.min(w, h) * 0.25));
  const n = Math.max(0, Math.min(notch, Math.min(w, h) * 0.20));

  const midY = y + h * 0.52;
  const notchH = Math.min(h * 0.22, 22);

  ctx.beginPath();

  // top edge
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);

  // right edge -> notch
  ctx.lineTo(x + w, midY - notchH * 0.5);
  ctx.lineTo(x + w - n, midY);
  ctx.lineTo(x + w, midY + notchH * 0.5);

  // down right -> bottom
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);

  // left edge -> notch
  ctx.lineTo(x, midY + notchH * 0.5);
  ctx.lineTo(x + n, midY);
  ctx.lineTo(x, midY - notchH * 0.5);

  // up left -> close
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function drawCornerBrackets(ctx, x, y, w, h, s, color, a) {
  const b = Math.max(6, Math.min(s, Math.min(w, h) * 0.25));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = a;
  ctx.lineWidth = 2;

  // top-left
  ctx.beginPath();
  ctx.moveTo(x + 8, y + b);
  ctx.lineTo(x + 8, y + 8);
  ctx.lineTo(x + b, y + 8);
  ctx.stroke();

  // top-right
  ctx.beginPath();
  ctx.moveTo(x + w - 8 - b, y + 8);
  ctx.lineTo(x + w - 8, y + 8);
  ctx.lineTo(x + w - 8, y + b);
  ctx.stroke();

  // bottom-left
  ctx.beginPath();
  ctx.moveTo(x + 8, y + h - b);
  ctx.lineTo(x + 8, y + h - 8);
  ctx.lineTo(x + b, y + h - 8);
  ctx.stroke();

  // bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - 8 - b, y + h - 8);
  ctx.lineTo(x + w - 8, y + h - 8);
  ctx.lineTo(x + w - 8, y + h - b);
  ctx.stroke();

  ctx.restore();
}

function drawScanlines(ctx, x, y, w, h, strength) {
  const s = clamp01(strength);
  if (s <= 0.001) return;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.10 * s;
  ctx.fillStyle = 'rgba(255,255,255,1)';

  const step = 5; // px
  for (let yy = y + 2; yy < y + h - 2; yy += step) {
    ctx.fillRect(x + 2, yy, w - 4, 1);
  }

  ctx.restore();
}

// Fast deterministic PRNG (per frame) so ticker looks stable and not random-jittery
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function drawDataTicker(ctx, x, y, w, h, t, energy, tintRgb, cfg, frameIndex) {
  if (!cfg.tickerEnabled) return;
  const strength = clamp01(cfg.tickerStrength ?? 0.55) * (0.25 + 0.75 * energy);
  if (strength <= 0.001) return;

  const density = clamp01(cfg.tickerDensity ?? 0.62);
  const spd = clamp(cfg.tickerSpeed ?? 0.95, 0.2, 2.5);

  const th = clamp(cfg.tickerHeight ?? 10, 6, 18);
  const yOff = clamp(cfg.tickerYOffset ?? 14, 8, Math.max(8, h - 8));
  const ty = y + h - yOff - th;
  const tx = x + 14;
  const tw = w - 28;

  // Clip to interior ticker band
  ctx.save();
  ctx.beginPath();
  ctx.rect(tx, ty, tw, th);
  ctx.clip();

  // Subtle band background
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.10 * strength;
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(tx, ty + th * 0.55, tw, 1);

  // Segment stream: repeating pattern that scrolls horizontally
  const seed = (frameIndex + 1) * 1337;
  const rnd = mulberry32(seed);

  const baseSegs = Math.floor(18 + density * 26); // 18..44
  const segs = Math.max(12, Math.min(48, baseSegs));

  const scroll = (t * (120 * spd) + frameIndex * 37) % (tw + 240);
  const hot = clamp01((energy - 0.25) / 0.75);

  // Color: tinted + white highlights as hype rises
  const tintA = 0.10 + 0.30 * strength;
  const hiA = 0.06 + 0.22 * strength * (0.35 + 0.65 * hot);

  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 10 * (0.25 + 0.9 * strength);

  for (let i = 0; i < segs; i++) {
    const u = i / segs;
    const lane = (i % 3); // 3 micro lanes for depth
    const laneY = ty + 2 + lane * (th / 3);

    const segLen = lerp(8, 34, rnd() * rnd());
    const segH = lerp(1, 3, rnd());
    const gap = lerp(6, 22, rnd());

    // phase offset so segments are distributed, then scroll
    const px0 = tx + u * (tw + 160) - scroll + (lane * 18);
    const px = px0 + Math.sin((t * 1.7 + i) * 0.9) * (0.8 + 2.2 * strength);

    // occasional “packet” flashes
    const pulse = 0.5 + 0.5 * Math.sin(t * (2.0 + spd) + i * 0.8 + frameIndex * 1.1);
    const packet = (pulse > 0.92) ? 1 : 0;

    ctx.fillStyle = rgbCss(tintRgb, tintA + packet * 0.12);
    ctx.fillRect(px, laneY + 1, segLen, segH);

    // highlight line
    ctx.fillStyle = `rgba(255,255,255,${hiA + packet * 0.10})`;
    ctx.fillRect(px + segLen * 0.25, laneY + 1, Math.max(2, segLen * 0.18), 1);

    // extra mini-dot
    if (rnd() < 0.33 * density) {
      ctx.fillStyle = `rgba(255,255,255,${hiA * 0.85})`;
      ctx.fillRect(px - gap * 0.35, laneY + 1, 2, 2);
    }
  }

  ctx.restore();
}

function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2400, 200, 6000));

  let rgb = { r: 140, g: 210, b: 255 };
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === 'weighted') ? mixWeighted(colors, weights) : pickWinner(colors, weights);
  }

  const k = clamp(cfg.hypeK ?? 180, 40, 600);
  let h = 1 - Math.exp(-total / k);
  h = clamp01(h + (1 - h) * 0.06 * Math.min(1, total / 70));

  return { total, h, rgb };
}

function noise1(t) {
  return (
    Math.sin(t * 1.31) * 0.55 +
    Math.sin(t * 2.17 + 1.4) * 0.30 +
    Math.sin(t * 3.71 + 0.2) * 0.15
  );
}

function drawElectricArc(ctx, ax, ay, bx, by, t, energy, colorRgb, cfg, seed = 0) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.max(1, Math.hypot(dx, dy));

  const segs = Math.max(12, Math.min(44, Math.floor(dist / 18)));
  const nx = -dy / dist;
  const ny = dx / dist;

  const wiggle = clamp(cfg.electricWiggle ?? 1.0, 0.2, 2.0);
  const amp = (3 + 16 * energy) * wiggle;

  ctx.beginPath();
  ctx.moveTo(ax, ay);

  for (let i = 1; i < segs; i++) {
    const u = i / segs;
    const px = ax + dx * u;
    const py = ay + dy * u;

    const n = noise1(t * 2.2 + u * 8.0 + seed * 10.0);
    const falloff = Math.sin(u * Math.PI);
    const off = n * amp * falloff;

    ctx.lineTo(px + nx * off, py + ny * off);
  }

  ctx.lineTo(bx, by);

  const thickBase = clamp(cfg.electricThickness ?? 1.8, 0.5, 8);
  const lw = thickBase * (0.75 + 1.65 * energy);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const glow = clamp01(cfg.electricGlow ?? 0.9);
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.shadowBlur = (10 + 45 * glow) * (0.35 + 1.0 * energy);

  ctx.lineWidth = lw;
  ctx.strokeStyle = rgbCss(colorRgb, 0.28 + 0.55 * energy);
  ctx.stroke();

  ctx.shadowBlur *= 0.55;
  ctx.lineWidth = lw * 0.45;
  ctx.strokeStyle = `rgba(255,255,255,${0.18 + 0.42 * energy})`;
  ctx.stroke();

  ctx.restore();
}

function framePath(ctx, x, y, w, h, cfg) {
  const style = String(cfg.frameStyle || 'cyber');
  if (style === 'rounded') {
    const r = clamp(cfg.cornerRadius ?? 16, 6, 28);
    roundRectPath(ctx, x, y, w, h, r);
  } else {
    const chamfer = clamp(cfg.chamfer ?? 18, 0, 40);
    const notch = clamp(cfg.notch ?? 14, 0, 30);
    cyberPanelPath(ctx, x, y, w, h, chamfer, notch);
  }
}

function drawFrame(ctx, x, y, w, h, tintRgb, energy, i, t, cfg) {
  const fillA = clamp(cfg.panelFill ?? 0.12, 0, 0.5) * (0.85 + 0.35 * energy);
  const strokeA = clamp01(cfg.panelStroke ?? 0.55) * (0.75 + 0.55 * energy);
  const glow = clamp01(cfg.panelGlow ?? 0.85);

  // panel fill
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  // depth shadow
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;

  framePath(ctx, x, y, w, h, cfg);
  ctx.fillStyle = `rgba(0,0,0,${fillA})`;
  ctx.fill();

  // interior scanlines
  drawScanlines(ctx, x, y, w, h, (cfg.scanlines ?? 0.22) * (0.35 + 0.65 * energy));

  // sheen
  const sheen = clamp01(cfg.innerSheen ?? 0.4) * (0.25 + 0.65 * energy);
  if (sheen > 0.001) {
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `rgba(255,255,255,${0.10 * sheen})`);
    g.addColorStop(0.35, `rgba(255,255,255,${0.04 * sheen})`);
    g.addColorStop(1, `rgba(255,255,255,0)`);
    framePath(ctx, x + 1, y + 1, w - 2, h - 2, cfg);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // data ticker (clipped band near bottom)
  // (draw it before border so border stays crisp)
  drawDataTicker(ctx, x, y, w, h, t, energy, tintRgb, cfg, i);

  // border + glow
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = rgbCss(tintRgb, 1);
  ctx.shadowBlur = (10 + 55 * glow) * (0.25 + 0.95 * energy);
  ctx.lineWidth = 2.0 + 2.2 * energy;

  framePath(ctx, x, y, w, h, cfg);
  ctx.strokeStyle = rgbCss(tintRgb, strokeA);
  ctx.stroke();

  // top accent strip (HUD vibe)
  const accent = clamp01(cfg.accentStrip ?? 0.55) * (0.25 + 0.75 * energy);
  if (accent > 0.001) {
    ctx.shadowBlur *= 0.45;
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgbCss(tintRgb, 0.10 + 0.30 * accent);

    ctx.beginPath();
    ctx.moveTo(x + 16, y + 10);
    ctx.lineTo(x + w - 16, y + 10);
    ctx.stroke();
  }

  // corner brackets
  drawCornerBrackets(
    ctx,
    x, y, w, h,
    clamp(cfg.bracketSize ?? 16, 8, 28),
    rgbCss(tintRgb, 1),
    0.12 + 0.30 * energy
  );

  // micro flicker
  if (energy > 0.55) {
    const flick = (0.5 + 0.5 * Math.sin(t * 10.0 + i * 2.2)) * (energy - 0.5);
    ctx.shadowBlur *= 0.6;
    ctx.lineWidth *= 0.55;
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.35 * flick})`;
    ctx.stroke();
  }

  ctx.restore();

  // text
  const title = (cfg.titles && cfg.titles[i]) ? String(cfg.titles[i]) : '';
  const value = (cfg.values && cfg.values[i]) ? String(cfg.values[i]) : '—';

  const labelSize = clamp(cfg.labelSize ?? 14, 10, 24);
  const valueSize = clamp(cfg.valueSize ?? 22, 14, 44);
  const textA = clamp01(cfg.textOpacity ?? 0.92);
  const labelA = clamp01(cfg.labelOpacity ?? 0.72);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;

  const padX = 18;
  const padY = 18;

  ctx.fillStyle = `rgba(255,255,255,${labelA})`;
  ctx.font = `600 ${labelSize}px ${cfg.fontFamily || 'system-ui, sans-serif'}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, x + padX, y + padY + labelSize * 0.9);

  ctx.fillStyle = `rgba(255,255,255,${textA})`;
  ctx.font = `800 ${valueSize}px ${cfg.fontFamily || 'system-ui, sans-serif'}`;
  ctx.fillText(value, x + padX, y + h - padY);

  ctx.restore();
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // State
  let latestSnap = { factions: [] };
  let { total: totalRaw, h: hTarget, rgb: leaderRgb } = computeBlendAndHype(latestSnap, cfg);

  let hSmooth = 0;
  let rgbSmooth = { r: 140, g: 210, b: 255 };

  let lastTotal = 0;
  let spikeVel = 0;
  let spikeEnergy = 0; // 0..1

  // Electricity reroute timing
  let arcPhase = 0;

  // Loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    leaderRgb = res.rgb;

    const d = Math.abs(totalRaw - lastTotal);
    lastTotal = totalRaw;

    const bump01 =
      clamp01(d / 70) *
      clamp(cfg.eventBoost ?? 1, 0, 2) *
      clamp(cfg.spikeSensitivity ?? 1, 0, 2);

    spikeVel += bump01 * 1.2;
  });

  const onResize = () => resize();
  window.addEventListener('resize', onResize, { passive: true });

  function resize() {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeBlendAndHype(latestSnap, cfg);
    totalRaw = res.total;
    hTarget = res.h;
    leaderRgb = res.rgb;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    // 60fps cap (simple and stable)
    if (accMs < (1000 / 60)) return;
    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // Smooth hype
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity ?? 1, 0, 2));

    // Smooth leader color
    rgbSmooth.r = lerp(rgbSmooth.r, leaderRgb.r, 1 - Math.exp(-7 * dt));
    rgbSmooth.g = lerp(rgbSmooth.g, leaderRgb.g, 1 - Math.exp(-7 * dt));
    rgbSmooth.b = lerp(rgbSmooth.b, leaderRgb.b, 1 - Math.exp(-7 * dt));

    // Spike energy
    spikeVel *= Math.pow(0.12, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.60);
    spikeVel *= Math.pow(0.65, dt);

    // Electricity reroute phase
    arcPhase += dt * clamp(cfg.electricJitterRate ?? 2.5, 0.5, 8) * (0.35 + 1.1 * hSmooth + 0.9 * spikeEnergy);

    const { w, h } = resize();
    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    // Geometry
    const stripW = clamp(cfg.stripWidth ?? 0.86, 0.4, 0.98) * w;
    const frameH = clamp(cfg.frameHeight ?? 0.115, 0.06, 0.22) * h;
    const gap = clamp(cfg.frameGap ?? 0.018, 0, 0.06) * w;

    const frames = 4;
    const frameW = (stripW - gap * (frames - 1)) / frames;

    const ax = clamp(cfg.anchorX ?? 0.5, 0, 1) * w;
    const ay = clamp(cfg.anchorY ?? 0.86, 0, 1) * h;

    const left = ax - stripW * 0.5;
    const top = ay - frameH * 0.5;

    const floatAmt = clamp(cfg.floatAmount ?? 6, 0, 18);
    const floatSpd = clamp(cfg.floatSpeed ?? 0.85, 0.1, 2.5);

    const energy = clamp01(0.10 + 0.80 * hSmooth + 0.65 * spikeEnergy);

    // Precompute frame rects + floating offset
    const rects = [];
    for (let i = 0; i < frames; i++) {
      const baseX = left + i * (frameW + gap);
      const baseY = top;

      const bob = Math.sin(t * (floatSpd * 1.15) + i * 0.9) * floatAmt * (0.25 + 0.85 * energy);
      const sway = Math.cos(t * (floatSpd * 0.95) + i * 1.1) * floatAmt * 0.35 * (0.25 + 0.85 * energy);

      rects.push({
        x: baseX + sway,
        y: baseY + bob,
        w: frameW,
        h: frameH,
        cx: baseX + sway + frameW * 0.5,
        cy: baseY + bob + frameH * 0.5
      });
    }

    // Electricity (behind frames)
    if (cfg.electricEnabled) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Tint is leader color, lifted toward white-hot with energy
      const hotLift = clamp01((energy - 0.25) / 0.75);
      const tint = {
        r: lerp(rgbSmooth.r, 255, 0.45 * hotLift),
        g: lerp(rgbSmooth.g, 255, 0.55 * hotLift),
        b: lerp(rgbSmooth.b, 255, 0.75 * hotLift)
      };

      // Main links: 0-1, 1-2, 2-3
      for (let i = 0; i < frames - 1; i++) {
        const A = rects[i];
        const B = rects[i + 1];

        const ax1 = A.x + A.w - 10;
        const ay1 = A.cy;
        const bx1 = B.x + 10;
        const by1 = B.cy;

        const seed = i * 1.7 + frac(arcPhase * 0.12 + i * 0.2);
        drawElectricArc(ctx, ax1, ay1, bx1, by1, t + arcPhase * 0.15, energy, tint, cfg, seed);

        // Branches at higher hype
        const branchChance = clamp01(cfg.electricBranchChance ?? 0.35) * clamp01((energy - 0.35) / 0.65);
        if (Math.random() < branchChance * 0.10) {
          const midx = (ax1 + bx1) * 0.5;
          const midy = (ay1 + by1) * 0.5;
          const bx2 = midx + (Math.random() - 0.5) * 120;
          const by2 = midy + (Math.random() - 0.5) * 90;
          drawElectricArc(ctx, midx, midy, bx2, by2, t + arcPhase * 0.2, energy * 0.75, tint, cfg, seed + 3.3);
        }
      }

      // Occasional cross arc (0->2 or 1->3) when spicy
      if (energy > 0.62 && (Math.sin(arcPhase * 1.7) > 0.65)) {
        const pick = (Math.sin(arcPhase * 0.9) > 0) ? [0, 2] : [1, 3];
        const A = rects[pick[0]];
        const B = rects[pick[1]];
        drawElectricArc(
          ctx,
          A.cx, A.y + 10,
          B.cx, B.y + 10,
          t + arcPhase * 0.22,
          energy * 0.85,
          tint,
          cfg,
          9.1 + frac(arcPhase * 0.33)
        );
      }

      ctx.restore();
    }

    // Frames (on top)
    for (let i = 0; i < frames; i++) {
      drawFrame(ctx, rects[i].x, rects[i].y, rects[i].w, rects[i].h, rgbSmooth, energy, i, t, cfg);
    }

    // Subtle strip presence glow (very light)
    if (energy > 0.18) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = (energy - 0.15) * 0.10;
      ctx.fillStyle = rgbCss(rgbSmooth, a);
      ctx.shadowColor = rgbCss(rgbSmooth, 1);
      ctx.shadowBlur = 40 * energy;
      ctx.fillRect(left - 20, top - 16, stripW + 40, frameH + 32);
      ctx.restore();
    }

    // Tiny “alive” container drift at higher energy (super subtle)
    if (energy > 0.35) {
      const ox = Math.sin(t * 1.2) * 1.2 * (energy - 0.25);
      const oy = Math.cos(t * 1.05) * 0.9 * (energy - 0.25);
      container.style.transform = `translate3d(${ox.toFixed(2)}px,${oy.toFixed(2)}px,0)`;
    } else {
      container.style.transform = 'translateZ(0)';
    }
  }

  resize();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
