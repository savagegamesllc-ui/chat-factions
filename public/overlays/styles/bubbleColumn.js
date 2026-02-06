// public/overlays/styles/bubbleColumn.js
// Overlay: Bubble Column (Vertical, cute + light)
// - 4 floating bubble-panels stacked vertically
// - bubbly “string” connections between panels (soft bead chain + occasional tiny pop)
// - hype increases bubble activity + shimmer; panels tint to hype leader color (pastel-leaning)
// - NEW: heart “blups” on hype spikes (tiny floating hearts near links)

'use strict';

export const meta = {
  styleKey: 'bubbleColumn',
  name: 'Bubble Column',
  tier: 'FREE',
  description:
    'A cute, light vertical stack of four bubbly panels linked by soft bubble-bead connections. Hype increases bubble drift and shimmer; panels tint toward the hype leader color. Hype spikes trigger tiny heart blups.',

  defaultConfig: {
    // Layout
    anchorX: 0.88,             // 0..1 (column position)
    anchorY: 0.50,             // 0..1 (center of column)
    columnHeight: 0.72,        // 0.35..0.95 (fraction of screen height)
    panelWidth: 0.26,          // 0.16..0.38 (fraction of screen width)
    panelGap: 0.022,           // 0..0.07 (fraction of screen height)
    panels: 4,

    // Bubble panel look
    bubbleFill: 0.16,          // 0..0.35 background opacity
    bubbleRim: 0.55,           // 0..1 rim opacity
    bubbleGlow: 0.70,          // 0..1
    rimThickness: 2.2,         // px
    softness: 1.0,             // 0.5..1.5 (blur-ish feel)
    pastelize: 0.55,           // 0..1 (push leader color toward pastel)
    shimmer: 0.55,             // 0..1 (highlight sweep)
    sparkle: 0.35,             // 0..1 (tiny sparkles)

    // Floating motion
    floatAmount: 7.0,          // px
    floatSpeed: 0.85,          // 0.1..2.5

    // Connections (bubble bead chain)
    linkEnabled: true,
    beadSize: 5.5,             // px
    beadDensity: 1.0,          // 0.5..2.0
    linkOpacity: 0.55,         // 0..1

    // Background bubbles
    bgBubbles: 22,             // 0..60
    bgBubbleSize: 0.65,        // 0.3..1.6
    bgBubbleSpeed: 0.85,       // 0.2..2.0

    // Heart blups (cute spike accent)
    heartsEnabled: true,
    heartRate: 0.35,           // 0..1 chance on spike gate
    heartSize: 6.5,            // px base
    heartFloatSpeed: 0.9,      // 0.2..2.0
    heartLifetime: 1.6,        // seconds
    heartsMax: 28,             // cap for safety

    // Hype mapping
    mixMode: 'winner',         // winner | weighted
    intensity: 1.0,            // 0..2
    hypeK: 200,                // scale for h = 1-exp(-total/k)
    maxTotalClamp: 2400,
    hypeSmoothing: 0.18,       // 0.05..0.5

    // Text
    titles: ['Latest Follower', 'Latest Sub', 'Latest Cheer', 'Latest Gift Sub'],
    values: ['—', '—', '—', '—'],
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    labelSize: 13,             // px
    valueSize: 20,             // px
    textOpacity: 0.92,
    labelOpacity: 0.72
  },

  controls: [
    { key: 'anchorX', label: 'Anchor X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.88 },
    { key: 'anchorY', label: 'Anchor Y', type: 'range', min: 0, max: 1, step: 0.01, default: 0.50 },
    { key: 'columnHeight', label: 'Column Height', type: 'range', min: 0.35, max: 0.95, step: 0.01, default: 0.72 },
    { key: 'panelWidth', label: 'Panel Width', type: 'range', min: 0.16, max: 0.38, step: 0.01, default: 0.26 },
    { key: 'panelGap', label: 'Panel Gap', type: 'range', min: 0, max: 0.07, step: 0.001, default: 0.022 },

    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['winner', 'weighted'], default: 'winner' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'bgBubbles', label: 'Background Bubbles', type: 'number', min: 0, max: 60, step: 1, default: 22 },
    { key: 'sparkle', label: 'Sparkle', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },

    { key: 'linkEnabled', label: 'Enable Links', type: 'checkbox', default: true },
    { key: 'beadSize', label: 'Bead Size', type: 'range', min: 2, max: 10, step: 0.1, default: 5.5 },

    { key: 'heartsEnabled', label: 'Enable Hearts', type: 'checkbox', default: true },
    { key: 'heartRate', label: 'Heart Rate', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'heartSize', label: 'Heart Size', type: 'range', min: 3, max: 14, step: 0.1, default: 6.5 }
  ]
};

function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

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
  if (sum <= 0) return { r: 170, g: 220, b: 255 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 170, g: 220, b: 255 };
}

function rgbCss(rgb, a = 1) {
  return `rgba(${rgb.r | 0},${rgb.g | 0},${rgb.b | 0},${a})`;
}

function pastelize(rgb, amt) {
  const t = clamp01(amt);
  return {
    r: lerp(rgb.r, 255, t),
    g: lerp(rgb.g, 255, t),
    b: lerp(rgb.b, 255, t),
  };
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'bubbleColumn';
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

function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2400, 200, 6000));

  let rgb = { r: 170, g: 220, b: 255 };
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === 'weighted') ? mixWeighted(colors, weights) : pickWinner(colors, weights);
  }

  const k = clamp(cfg.hypeK ?? 200, 40, 800);
  let h = 1 - Math.exp(-total / k);
  h = clamp01(h);

  return { total, h, rgb };
}

// deterministic RNG-ish helpers
function hash01(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawSoftBubble(ctx, cx, cy, r, tint, alpha, rimAlpha, rimW, glow) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  ctx.shadowColor = rgbCss(tint, 1);
  ctx.shadowBlur = (12 + 38 * glow) * (r / 18);

  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.15, cx, cy, r);
  g.addColorStop(0, `rgba(255,255,255,${0.12 * alpha})`);
  g.addColorStop(0.35, rgbCss(tint, 0.10 * alpha));
  g.addColorStop(1, `rgba(255,255,255,${0.02 * alpha})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur *= 0.6;
  ctx.lineWidth = rimW;
  ctx.strokeStyle = rgbCss(tint, rimAlpha);
  ctx.beginPath();
  ctx.arc(cx, cy, r - rimW * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255,255,255,${0.18 * alpha})`;
  ctx.lineWidth = Math.max(1, rimW * 0.6);
  ctx.beginPath();
  ctx.arc(cx - r * 0.18, cy - r * 0.18, r * 0.72, Math.PI * 1.15, Math.PI * 1.55);
  ctx.stroke();

  ctx.restore();
}

function drawShimmer(ctx, x, y, w, h, t, strength) {
  const s = clamp01(strength);
  if (s <= 0.001) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const sweep = (t * 0.22) % 1;
  const sx = x - w * 0.35 + (w * 1.7) * sweep;

  const g = ctx.createLinearGradient(sx, y, sx + w * 0.35, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, `rgba(255,255,255,${0.14 * s})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  ctx.restore();
}

function drawBeadLink(ctx, ax, ay, bx, by, beadR, tint, alpha, density, t) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const steps = Math.max(6, Math.min(42, Math.floor((dist / (beadR * 2.4)) * density)));

  const nx = -dy / dist;
  const ny = dx / dist;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const wob = Math.sin(t * 1.6 + u * 6.0) * (beadR * 0.55);
    const px = ax + dx * u + nx * wob;
    const py = ay + dy * u + ny * wob;

    const rr = beadR * (0.80 + 0.25 * Math.sin(u * Math.PI));
    drawSoftBubble(ctx, px, py, rr, tint, alpha * 0.85, alpha * 0.42, Math.max(1, rr * 0.22), 0.35);
  }

  ctx.restore();
}

function drawHeart(ctx, x, y, s, a) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;

  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.25);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.25);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.25);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.25);
  ctx.closePath();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 8;
  ctx.fill();

  ctx.restore();
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let latestSnap = { factions: [] };
  let { total: totalRaw, h: hTarget, rgb: leaderRgb } = computeBlendAndHype(latestSnap, cfg);

  let hSmooth = 0;
  let rgbSmooth = { r: 170, g: 220, b: 255 };

  // Spike tracking (for heart blups)
  let lastTotal = 0;
  let spikeVel = 0;
  let spikeEnergy = 0;

  // Heart particles
  const hearts = [];

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

    // simple spike impulse
    spikeVel += clamp01(d / 80) * 1.15;
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
    if (accMs < (1000 / 60)) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // Smooth hype + leader color
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth * clamp(cfg.intensity ?? 1, 0, 2));

    rgbSmooth.r = lerp(rgbSmooth.r, leaderRgb.r, 1 - Math.exp(-7 * dt));
    rgbSmooth.g = lerp(rgbSmooth.g, leaderRgb.g, 1 - Math.exp(-7 * dt));
    rgbSmooth.b = lerp(rgbSmooth.b, leaderRgb.b, 1 - Math.exp(-7 * dt));

    // Spike energy decay
    spikeVel *= Math.pow(0.10, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.65);
    spikeVel *= Math.pow(0.60, dt);

    const { w, h } = resize();
    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    // Pastel leader tint
    const tint = pastelize(rgbSmooth, clamp01(cfg.pastelize ?? 0.55));

    // Energy for “cute activity”
    const energy = clamp01(0.08 + 0.92 * hSmooth);

    // Column geometry
    const panels = clamp(cfg.panels ?? 4, 1, 6) | 0;
    const colH = clamp(cfg.columnHeight ?? 0.72, 0.35, 0.95) * h;
    const pw = clamp(cfg.panelWidth ?? 0.26, 0.16, 0.38) * w;
    const gap = clamp(cfg.panelGap ?? 0.022, 0, 0.07) * h;

    const ph = (colH - gap * (panels - 1)) / panels;

    const ax = clamp(cfg.anchorX ?? 0.88, 0, 1) * w;
    const ay = clamp(cfg.anchorY ?? 0.50, 0, 1) * h;

    const left = ax - pw * 0.5;
    const top = ay - colH * 0.5;

    // Background bubbles
    const bgCount = clamp(cfg.bgBubbles ?? 22, 0, 80) | 0;
    const bgSizeMul = clamp(cfg.bgBubbleSize ?? 0.65, 0.3, 1.6);
    const bgSpd = clamp(cfg.bgBubbleSpeed ?? 0.85, 0.2, 2.0) * (0.35 + 0.95 * energy);

    for (let i = 0; i < bgCount; i++) {
      const rx = hash01(i * 3 + 1);
      const ry = hash01(i * 3 + 2);
      const rr = hash01(i * 3 + 3);

      const baseX = w * rx;
      const baseY = h * ry;

      const drift = ((t * (18 + 34 * rr) * bgSpd) % (h + 120)) - 60;
      const yb = (baseY - drift + h + 120) % (h + 120) - 60;

      const r = (10 + 26 * rr) * bgSizeMul * (0.65 + 0.65 * energy);
      const a = (0.06 + 0.12 * rr) * (0.55 + 0.85 * energy);

      drawSoftBubble(ctx, baseX, yb, r, tint, a, a * 0.55, Math.max(1.2, r * 0.12), 0.30);
    }

    // Panel positions + float
    const floatAmt = clamp(cfg.floatAmount ?? 7, 0, 22);
    const floatSpd = clamp(cfg.floatSpeed ?? 0.85, 0.1, 2.5);

    const rects = [];
    for (let i = 0; i < panels; i++) {
      const bx = left;
      const by = top + i * (ph + gap);

      const bob = Math.sin(t * (floatSpd * 1.1) + i * 0.7) * floatAmt * (0.35 + 0.85 * energy);
      const sway = Math.cos(t * (floatSpd * 0.9) + i * 1.2) * floatAmt * 0.45 * (0.35 + 0.85 * energy);

      rects.push({
        x: bx + sway,
        y: by + bob,
        w: pw,
        h: ph,
        cx: bx + sway + pw * 0.5,
        cy: by + bob + ph * 0.5
      });
    }

    // Links behind panels
    if (cfg.linkEnabled && rects.length > 1) {
      const beadR = clamp(cfg.beadSize ?? 5.5, 2, 12) * (0.80 + 0.85 * energy);
      const den = clamp(cfg.beadDensity ?? 1.0, 0.5, 2.0);
      const a = clamp01(cfg.linkOpacity ?? 0.55) * (0.55 + 0.65 * energy);

      for (let i = 0; i < rects.length - 1; i++) {
        const A = rects[i];
        const B = rects[i + 1];

        const ax1 = A.cx;
        const ay1 = A.y + A.h - 10;
        const bx1 = B.cx;
        const by1 = B.y + 10;

        drawBeadLink(ctx, ax1, ay1, bx1, by1, beadR, tint, a, den, t + i * 0.6);

        // tiny occasional “pop” sparkle
        const sp = clamp01(cfg.sparkle ?? 0.35) * (0.25 + 0.85 * energy);
        if (sp > 0.05 && Math.sin(t * 2.2 + i * 1.7) > 0.985) {
          const px = lerp(ax1, bx1, 0.55);
          const py = lerp(ay1, by1, 0.55);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(px + 6, py - 4, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Heart blup spawn gate: based on spikeEnergy (tasteful, not constant)
    if (cfg.heartsEnabled && rects.length > 1) {
      const gate = clamp01((spikeEnergy - 0.12) / 0.88); // only once spike is noticeable
      if (gate > 0.001) {
        // A periodic window so it doesn't spawn every frame
        const pulse = (Math.sin(t * 2.4) + 1) * 0.5; // 0..1
        if (pulse > 0.92) {
          const chance = clamp01(cfg.heartRate ?? 0.35) * gate;
          if (Math.random() < chance && hearts.length < (cfg.heartsMax ?? 28)) {
            const idx = Math.floor(Math.random() * (rects.length - 1));
            const A = rects[idx];
            const B = rects[idx + 1];

            const baseX = lerp(A.cx, B.cx, 0.5) + (Math.random() - 0.5) * 14;
            const baseY = lerp(A.cy, B.cy, 0.5) + (Math.random() - 0.5) * 10;

            hearts.push({
              x: baseX,
              y: baseY,
              vy: -(14 + 26 * Math.random()) * clamp(cfg.heartFloatSpeed ?? 0.9, 0.2, 2.0),
              wob: Math.random() * Math.PI * 2,
              life: clamp(cfg.heartLifetime ?? 1.6, 0.6, 3.5),
              age: 0,
              size: clamp(cfg.heartSize ?? 6.5, 3, 14) * (0.75 + 0.5 * Math.random())
            });
          }
        }
      }
    }

    // Panels
    const fillA = clamp(cfg.bubbleFill ?? 0.16, 0, 0.5) * (0.70 + 0.55 * energy);
    const rimA = clamp01(cfg.bubbleRim ?? 0.55) * (0.60 + 0.65 * energy);
    const glow = clamp01(cfg.bubbleGlow ?? 0.70) * (0.45 + 0.75 * energy);
    const rimW = clamp(cfg.rimThickness ?? 2.2, 1, 6) * (0.90 + 0.55 * energy);

    for (let i = 0; i < rects.length; i++) {
      const R = rects[i];

      const r = Math.min(R.w, R.h) * 0.22;

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 14 * (0.6 + (cfg.softness ?? 1));
      ctx.shadowOffsetY = 8;

      // Rounded capsule
      ctx.beginPath();
      ctx.moveTo(R.x + r, R.y);
      ctx.arcTo(R.x + R.w, R.y, R.x + R.w, R.y + R.h, r);
      ctx.arcTo(R.x + R.w, R.y + R.h, R.x, R.y + R.h, r);
      ctx.arcTo(R.x, R.y + R.h, R.x, R.y, r);
      ctx.arcTo(R.x, R.y, R.x + R.w, R.y, r);
      ctx.closePath();

      const g = ctx.createRadialGradient(R.x + R.w * 0.35, R.y + R.h * 0.30, 2, R.cx, R.cy, Math.max(R.w, R.h));
      g.addColorStop(0, `rgba(255,255,255,${0.10 * (0.7 + energy)})`);
      g.addColorStop(0.38, rgbCss(tint, fillA));
      g.addColorStop(1, `rgba(255,255,255,${0.02 * (0.5 + energy)})`);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = rgbCss(tint, 1);
      ctx.shadowBlur = (10 + 55 * glow) * (0.35 + (cfg.softness ?? 1));

      ctx.lineWidth = rimW;
      ctx.strokeStyle = rgbCss(tint, rimA);
      ctx.stroke();

      ctx.shadowBlur *= 0.5;
      ctx.lineWidth = Math.max(1, rimW * 0.45);
      ctx.strokeStyle = `rgba(255,255,255,${0.14 + 0.18 * energy})`;
      ctx.stroke();

      drawShimmer(ctx, R.x, R.y, R.w, R.h, t + i * 0.07, (cfg.shimmer ?? 0.55) * (0.35 + 0.85 * energy));

      ctx.restore();

      // Inner sparkles
      const sp = clamp01(cfg.sparkle ?? 0.35) * (0.25 + 0.85 * energy);
      if (sp > 0.001) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.10 * sp})`;
        for (let k = 0; k < 6; k++) {
          const u = hash01(i * 100 + k * 7 + 1);
          const v = hash01(i * 100 + k * 7 + 2);
          const px = R.x + 10 + u * (R.w - 20);
          const py = R.y + 10 + v * (R.h - 20);
          const rr = 1.2 + 1.8 * hash01(i * 100 + k * 7 + 3);
          const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + k * 0.2) + u * 6.0);
          ctx.globalAlpha = (0.35 + 0.65 * tw) * (0.22 + 0.65 * sp);
          ctx.beginPath();
          ctx.arc(px, py, rr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Text
      const title = (cfg.titles && cfg.titles[i]) ? String(cfg.titles[i]) : '';
      const value = (cfg.values && cfg.values[i]) ? String(cfg.values[i]) : '—';

      const labelSize = clamp(cfg.labelSize ?? 13, 10, 22);
      const valueSize = clamp(cfg.valueSize ?? 20, 14, 40);
      const textA = clamp01(cfg.textOpacity ?? 0.92);
      const labelA = clamp01(cfg.labelOpacity ?? 0.72);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;

      const padX = 16;
      const padY = 14;

      ctx.fillStyle = `rgba(255,255,255,${labelA})`;
      ctx.font = `600 ${labelSize}px ${cfg.fontFamily || 'system-ui, sans-serif'}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(title, R.x + padX, R.y + padY + labelSize * 0.9);

      ctx.fillStyle = `rgba(255,255,255,${textA})`;
      ctx.font = `800 ${valueSize}px ${cfg.fontFamily || 'system-ui, sans-serif'}`;
      ctx.fillText(value, R.x + padX, R.y + R.h - padY);

      ctx.restore();
    }

    // Draw hearts above panels (cute spike accent)
    if (hearts.length) {
      for (let i = hearts.length - 1; i >= 0; i--) {
        const p = hearts[i];
        p.age += dt;
        if (p.age > p.life) {
          hearts.splice(i, 1);
          continue;
        }

        const u = p.age / p.life;
        const a = (1 - u) * 0.9;

        p.y += p.vy * dt;
        p.x += Math.sin(t * 2.2 + p.wob) * 0.35;

        drawHeart(ctx, p.x, p.y, p.size, a);
      }
    }

    // Ultra-subtle “alive” drift to keep it cute
    const ox = Math.sin(t * 0.9) * (1.0 + 1.6 * energy);
    const oy = Math.cos(t * 0.8) * (0.8 + 1.3 * energy);
    container.style.transform = `translate3d(${ox.toFixed(2)}px,${oy.toFixed(2)}px,0)`;
  }

  resize();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
