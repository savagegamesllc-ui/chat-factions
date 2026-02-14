// public/overlays/styles/rgbPulseBorder.js
// PRO Overlay: RGB Pulse Border (Outer RGB random blink + inner LED leader color)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Visual goals:
// - Outer-most border: full RGB “addressable” look, with slow random blinking.
// - As hype grows: blink accelerates and adds stronger rhythmic pulsing.
// - Inner border: LED-like line in the current hype leader color.
// - Scales smoothly at any resolution (DPR-aware, resize observer).

'use strict';

export const meta = {
  styleKey: 'rgbPulseBorder',
  name: 'RGB Pulse Border (PRO)',
  tier: 'PRO',
  description: 'A full-screen RGB border with random blinking that intensifies with hype, plus an inner LED border in the hype leader’s color.',

  defaultConfig: {
    // Layout / sizing (uses % of the shorter screen dimension)
    cornerRadiusPct: 0.035,     // 0..0.12
    outerThicknessPct: 0.010,   // 0.002..0.03
    outerGapPct: 0.006,         // space between outer + inner lines (0..0.03)
    innerThicknessPct: 0.006,   // 0.001..0.02
    safeInsetPct: 0.012,        // keep away from edge (0..0.05)

    // Outer RGB behavior
    segmentDensity: 0.70,       // segments per 1000px of perimeter (0.2..1.5)
    rgbScrollSpeed: 0.10,       // hue scroll speed (0..0.6)
    outerBaseAlpha: 0.55,       // 0..1
    outerGlow: 0.55,            // 0..1
    blinkStrength: 0.65,        // 0..1 (how “off” a blink gets)
    blinkRandomness: 0.85,      // 0..1 (variance in timing)
    baseBlinkHz: 0.25,          // low hype blink frequency (0.05..2)
    maxBlinkHz: 2.4,            // high hype blink frequency (0.5..8)

    // Hype mapping
    hypeK: 220,                 // higher => slower to reach max intensity
    hypeSmoothing: 0.18,        // 0.05..0.5

    // Pulse behavior (layered on top of blinking)
    pulseStrength: 0.60,        // 0..1
    pulseHzAtMax: 1.8,          // 0.2..6

    // Inner LED behavior
    innerAlpha: 0.78,           // 0..1
    innerGlow: 0.85,            // 0..1
    innerGlowBoostAtMax: 0.9,   // 0..2
    leaderFallback: '#66ccff',

    // Performance
    fpsCap: 60,                 // 15..60
    dprCap: 2                   // 1..3 (OBS friendly)
  },

  controls: [
    { key: 'cornerRadiusPct', label: 'Corner Radius', type: 'range', min: 0, max: 0.12, step: 0.001, default: 0.035 },
    { key: 'outerThicknessPct', label: 'Outer Thickness', type: 'range', min: 0.002, max: 0.03, step: 0.001, default: 0.010 },
    { key: 'outerGapPct', label: 'Outer/Inner Gap', type: 'range', min: 0, max: 0.03, step: 0.001, default: 0.006 },
    { key: 'innerThicknessPct', label: 'Inner Thickness', type: 'range', min: 0.001, max: 0.02, step: 0.001, default: 0.006 },
    { key: 'safeInsetPct', label: 'Safe Inset', type: 'range', min: 0, max: 0.05, step: 0.001, default: 0.012 },

    { key: 'segmentDensity', label: 'RGB Segment Density', type: 'range', min: 0.2, max: 1.5, step: 0.01, default: 0.70 },
    { key: 'rgbScrollSpeed', label: 'RGB Scroll Speed', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.10 },
    { key: 'outerBaseAlpha', label: 'Outer Base Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'outerGlow', label: 'Outer Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },

    { key: 'blinkStrength', label: 'Blink Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: 'blinkRandomness', label: 'Blink Randomness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'baseBlinkHz', label: 'Base Blink Rate', type: 'range', min: 0.05, max: 2, step: 0.01, default: 0.25 },
    { key: 'maxBlinkHz', label: 'Max Blink Rate', type: 'range', min: 0.5, max: 8, step: 0.05, default: 2.4 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 800, step: 10, default: 220 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'pulseStrength', label: 'Pulse Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.60 },
    { key: 'pulseHzAtMax', label: 'Pulse Rate at Max', type: 'range', min: 0.2, max: 6, step: 0.05, default: 1.8 },

    { key: 'innerAlpha', label: 'Inner Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.78 },
    { key: 'innerGlow', label: 'Inner Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'innerGlowBoostAtMax', label: 'Inner Glow Boost at Max', type: 'range', min: 0, max: 2, step: 0.05, default: 0.9 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'dprCap', label: 'DPR Cap', type: 'range', min: 1, max: 3, step: 0.5, default: 2 }
  ]
};

function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const h = String(hex || '#66ccff').trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToCss({ r, g, b }, a = 1) {
  return `rgba(${r|0},${g|0},${b|0},${clamp01(a)})`;
}

// HSV-ish hue to RGB (fast, good enough for border)
function hueToRgb(h) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const q = 1 - f;
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = 1; g = f; b = 0; break;
    case 1: r = q; g = 1; b = 0; break;
    case 2: r = 0; g = 1; b = f; break;
    case 3: r = 0; g = q; b = 1; break;
    case 4: r = f; g = 0; b = 1; break;
    case 5: r = 1; g = 0; b = q; break;
  }
  return { r: (r * 255), g: (g * 255), b: (b * 255) };
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'rgbPulseBorder';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.display = 'block';
  c.style.pointerEvents = 'none';
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

// Perimeter segmentation helpers
function buildPerimeterPoints(x, y, w, h, r, segments) {
  // We approximate the rounded rect by sampling along the 4 sides (not perfect arc sampling,
  // but visually solid for LED borders).
  // Points are arranged sequentially around the rectangle.
  const pts = [];
  const left = x, top = y, right = x + w, bottom = y + h;

  const inset = r; // keep corners from duplicating points
  const usableTop = Math.max(0, w - 2 * inset);
  const usableSide = Math.max(0, h - 2 * inset);

  const perim = 2 * (usableTop + usableSide) + 2 * Math.PI * r;
  const step = perim / segments;

  // We walk a “pseudo perimeter” where corners take up ~pi/2 * r.
  // This keeps color distribution and blink segmentation stable.
  let t = 0;

  function push(px, py) { pts.push({ x: px, y: py }); }

  while (pts.length < segments + 1) {
    const u = t % perim;

    const cornerLen = (Math.PI / 2) * r;
    const topLen = usableTop;
    const sideLen = usableSide;

    let u2 = u;

    // Top edge (left->right), after top-left corner
    if (u2 < cornerLen) {
      // top-left corner arc
      const a = -Math.PI + (u2 / cornerLen) * (Math.PI / 2);
      push(left + inset + Math.cos(a) * r, top + inset + Math.sin(a) * r);
    } else if ((u2 -= cornerLen) < topLen) {
      push(left + inset + u2, top);
    } else if ((u2 -= topLen) < cornerLen) {
      // top-right corner
      const a = -Math.PI / 2 + (u2 / cornerLen) * (Math.PI / 2);
      push(right - inset + Math.cos(a) * r, top + inset + Math.sin(a) * r);
    } else if ((u2 -= cornerLen) < sideLen) {
      // right edge (top->bottom)
      push(right, top + inset + u2);
    } else if ((u2 -= sideLen) < cornerLen) {
      // bottom-right corner
      const a = 0 + (u2 / cornerLen) * (Math.PI / 2);
      push(right - inset + Math.cos(a) * r, bottom - inset + Math.sin(a) * r);
    } else if ((u2 -= cornerLen) < topLen) {
      // bottom edge (right->left)
      push(right - inset - u2, bottom);
    } else if ((u2 -= topLen) < cornerLen) {
      // bottom-left corner
      const a = Math.PI / 2 + (u2 / cornerLen) * (Math.PI / 2);
      push(left + inset + Math.cos(a) * r, bottom - inset + Math.sin(a) * r);
    } else {
      // left edge (bottom->top)
      u2 -= cornerLen;
      push(left, bottom - inset - u2);
    }

    t += step;
  }

  return pts;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function init({ root, config, api }) {
  const cfg = { ...meta.defaultConfig, ...(config || {}) };

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true });

  let W = 0, H = 0, dpr = 1;

  // Meter state
  let leaderColor = cfg.leaderFallback;
  let totalHype = 0;
  let hype01 = 0;          // smoothed 0..1
  let targetHype01 = 0;

  // Animation / blink state
  let lastTs = performance.now();
  let rafId = 0;
  let acc = 0;
  let frameMs = 1000 / clamp(cfg.fpsCap, 15, 60);

  // Segment blink model
  let segments = [];
  let points = [];
  let segCount = 0;
  let rng = mulberry32(0xC0FFEE);

  function rebuildSegments() {
    const insetPx = Math.min(W, H) * clamp(cfg.safeInsetPct, 0, 0.05);
    const radius = Math.min(W, H) * clamp(cfg.cornerRadiusPct, 0, 0.12);

    const basePerim = 2 * ((W - 2 * insetPx) + (H - 2 * insetPx));
    const density = clamp(cfg.segmentDensity, 0.2, 1.5);
    segCount = Math.max(80, Math.floor((basePerim / 1000) * (density * 220)));

    points = buildPerimeterPoints(
      insetPx,
      insetPx,
      W - 2 * insetPx,
      H - 2 * insetPx,
      radius,
      segCount
    );

    // Seed per segment timings
    segments = new Array(segCount).fill(0).map((_, i) => ({
      // blink envelope 0..1 (1 = fully on)
      on: 1,
      // when next blink event should start
      next: performance.now() + 500 + rng() * 2500,
      // blink duration
      dur: 120 + rng() * 180,
      // phase offset used for hue distribution
      phase: i / segCount,
      // transient blink timer
      t0: 0
    }));
  }

  function doResize() {
    const s = resizeCanvas(canvas, cfg.dprCap);
    W = s.w;
    H = s.h;
    dpr = s.dpr;

    rebuildSegments();
  }

  // Resize observer for smooth scaling in OBS/browser
  const ro = new ResizeObserver(() => doResize());
  ro.observe(container);

  doResize();

  // Consume meters from the overlay API runtime
  api.onMeters((snap) => {
    const factions = Array.isArray(snap?.factions) ? snap.factions : [];
    let best = null;
    let sum = 0;

    for (const f of factions) {
      const m = Number(f?.meter || 0);
      if (Number.isFinite(m)) sum += m;
      if (!best || m > best.m) {
        best = { m, colorHex: f?.colorHex || cfg.leaderFallback };
      }
    }

    totalHype = sum;

    const k = clamp(cfg.hypeK, 40, 800);
    targetHype01 = 1 - Math.exp(-Math.max(0, sum) / k);

    if (best?.colorHex) leaderColor = String(best.colorHex);
  });

  function updateBlink(ts, dt) {
    // Blink frequency rises with hype
    const baseHz = clamp(cfg.baseBlinkHz, 0.05, 2);
    const maxHz = clamp(cfg.maxBlinkHz, 0.5, 8);
    const hz = lerp(baseHz, maxHz, hype01);

    // Randomness skews how often segments “spark” independently
    const rand = clamp(cfg.blinkRandomness, 0, 1);

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];

      if (ts >= s.next && s.t0 === 0) {
        s.t0 = ts;

        // Next schedule:
        // baseline interval from hz, with randomness
        const baseInterval = 1000 / hz;
        const jitter = baseInterval * (0.25 + rand * 1.25) * (rng() - 0.5);
        const extra = baseInterval * (0.35 + rand * 1.2) * rng();

        s.dur = 80 + rng() * 220;
        s.next = ts + Math.max(40, baseInterval + extra + jitter);
      }

      // If currently blinking, compute envelope
      if (s.t0 !== 0) {
        const t = (ts - s.t0) / s.dur; // 0..1+
        if (t >= 1) {
          s.t0 = 0;
          s.on = 1;
        } else {
          // Smooth “dip” then recover: 1 -> low -> 1
          const dip = Math.sin(Math.PI * t); // 0..1..0
          const strength = clamp(cfg.blinkStrength, 0, 1);
          const minOn = 1 - strength; // if strength=1 => can go to 0
          s.on = lerp(1, minOn, dip);
        }
      } else {
        s.on = 1;
      }
    }
  }

  function draw(ts) {
    // Smooth hype tracking
    const smooth = clamp(cfg.hypeSmoothing, 0.05, 0.5);
    hype01 = lerp(hype01, targetHype01, 1 - Math.pow(1 - smooth, 60 / clamp(cfg.fpsCap, 15, 60)));

    // Time-based pulse layered on top
    const pulseHz = lerp(0.35, clamp(cfg.pulseHzAtMax, 0.2, 6), hype01);
    const pulse = (Math.sin((ts / 1000) * Math.PI * 2 * pulseHz) + 1) / 2; // 0..1
    const pulseAmt = clamp(cfg.pulseStrength, 0, 1) * hype01 * (0.35 + 0.65 * pulse); // 0..~1

    // Clear
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const minDim = Math.min(W, H);

    const insetPx = minDim * clamp(cfg.safeInsetPct, 0, 0.05);
    const radius = minDim * clamp(cfg.cornerRadiusPct, 0, 0.12);

    const outerTh = minDim * clamp(cfg.outerThicknessPct, 0.002, 0.03);
    const gap = minDim * clamp(cfg.outerGapPct, 0, 0.03);
    const innerTh = minDim * clamp(cfg.innerThicknessPct, 0.001, 0.02);

    // --- OUTER RGB (segmented stroke) ---
    // Color scroll is subtle at low hype, stronger at high.
    const scroll = (ts / 1000) * clamp(cfg.rgbScrollSpeed, 0, 0.6) * (0.35 + 0.95 * hype01);

    // Glow + alpha ramp with hype + pulse
    const baseA = clamp(cfg.outerBaseAlpha, 0, 1);
    const glow = clamp(cfg.outerGlow, 0, 1);
    const outerAlpha = clamp01(baseA + 0.25 * hype01 + 0.25 * pulseAmt);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = outerTh;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = (6 + 18 * glow) * (1 + 1.2 * hype01 + 0.9 * pulseAmt);
    ctx.shadowColor = 'rgba(255,255,255,0.35)';

    // Update blink envelopes
    // (We drive this once per drawn frame)
    // Segment points include +1 extra point so i->i+1 is safe
    for (let i = 0; i < segCount; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      if (!p0 || !p1) continue;

      const s = segments[i];

      // Random blink dims: on is 1..(1-blinkStrength)..
      // Then combine with global pulse
      const segOn = clamp01(s.on * (0.60 + 0.40 * (1 + pulseAmt)));

      // Hue across the perimeter gives full RGB “strip”
      const hue = (segments[i].phase + scroll) % 1;
      const rgb = hueToRgb(hue);

      const a = outerAlpha * segOn;
      ctx.strokeStyle = rgbToCss(rgb, a);

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();

    // --- INNER LED (leader color) ---
    const lc = hexToRgb(leaderColor);

    const innerInset = insetPx + outerTh / 2 + gap + innerTh / 2;
    const iw = W - innerInset * 2;
    const ih = H - innerInset * 2;
    const ir = Math.max(0, radius - (outerTh + gap));

    // Inner glow intensifies with hype
    const innerGlowBase = clamp(cfg.innerGlow, 0, 1);
    const innerBoost = clamp(cfg.innerGlowBoostAtMax, 0, 2);
    const innerGlowAmt = (6 + 22 * innerGlowBase) * (1 + innerBoost * hype01 + 0.9 * pulseAmt);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = innerTh;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = clamp01(clamp(cfg.innerAlpha, 0, 1) + 0.18 * hype01 + 0.22 * pulseAmt);
    ctx.shadowBlur = innerGlowAmt;
    ctx.shadowColor = rgbToCss(lc, 0.8);

    ctx.strokeStyle = rgbToCss(lc, 1);
    roundedRectPath(ctx, innerInset, innerInset, iw, ih, ir);
    ctx.stroke();

    // A subtle “hot core” line (thin) for LED feel
    ctx.shadowBlur = 0;
    ctx.globalAlpha = clamp01(0.18 + 0.22 * hype01 + 0.25 * pulseAmt);
    ctx.lineWidth = Math.max(1, innerTh * 0.35);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    roundedRectPath(ctx, innerInset, innerInset, iw, ih, ir);
    ctx.stroke();

    ctx.restore();
  }

  function tick(ts) {
    const dt = Math.max(0, ts - lastTs);
    lastTs = ts;

    acc += dt;
    if (acc >= frameMs) {
      // prevent spiral of death if tab hiccups
      acc = Math.min(acc, frameMs * 3);

      updateBlink(ts, dt);
      draw(ts);

      acc = 0;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  // Cleanup if root is removed
  const mo = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      try { cancelAnimationFrame(rafId); } catch {}
      try { ro.disconnect(); } catch {}
      try { mo.disconnect(); } catch {}
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
