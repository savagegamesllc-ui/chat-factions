// public/overlays/styles/morphBubble.js
// FREE Overlay: morphBubble (Single glossy bubble morphs into a selected shape as hype grows)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Shape options (FREE): Bubble | Heart | GG
// Size options: Small | Medium | Large
// Motion options: Calm | Expressive | Energetic

'use strict';

export const meta = {
  styleKey: 'morphBubble',
  name: 'morphBubble (FREE)',
  tier: 'FREE',
  description:
    'A single glossy bubble that smoothly morphs its silhouette as hype rises, becoming more expressive at big moments. Color follows the hype-leading faction.',

  // IMPORTANT: dashboard relies on this
  defaultConfig: {
    shapeMode: 'Heart',          // Bubble | Heart | GG
    bubbleSize: 'Medium',         // Small | Medium | Large
    motionIntensity: 'Expressive' // Calm | Expressive | Energetic
  },

  // Optional but strongly recommended if your dashboard auto-renders controls
  controls: [
    { key: 'shapeMode', label: 'Shape Mode', type: 'select', options: ['Bubble', 'Heart', 'GG'], default: 'Bubble' },
    { key: 'bubbleSize', label: 'Bubble Size', type: 'select', options: ['Small', 'Medium', 'Large'], default: 'Medium' },
    { key: 'motionIntensity', label: 'Motion Intensity', type: 'select', options: ['Calm', 'Expressive', 'Energetic'], default: 'Expressive' },
  ],
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  const s = String(hex || '').trim().replace('#', '');
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return { r, g, b };
  }
  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 255, g: 255, b: 255 };
}

function rgba({ r, g, b }, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${clamp(a, 0, 1)})`;
}

function mixRgb(a, b, t) {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

function normEnum(v, allowed, fallback) {
  const s = String(v ?? '').trim();
  const hit = allowed.find((x) => x.toLowerCase() === s.toLowerCase());
  return hit || fallback;
}

function safeConfig(cfg) {
  return {
    shapeMode: normEnum(cfg?.shapeMode, ['Bubble', 'Heart', 'GG'], meta.defaultConfig.shapeMode),
    bubbleSize: normEnum(cfg?.bubbleSize, ['Small', 'Medium', 'Large'], meta.defaultConfig.bubbleSize),
    motionIntensity: normEnum(cfg?.motionIntensity, ['Calm', 'Expressive', 'Energetic'], meta.defaultConfig.motionIntensity),
  };
}

/**
 * Shape target functions return a radius multiplier for a given angle.
 * r(theta) = baseR * (1 + wobble + morph * (target(theta) - 1))
 */

function targetBubble(theta) {
  return 1.0 + 0.03 * Math.sin(theta * 3.0) + 0.02 * Math.cos(theta * 5.0);
}

function targetHeart(theta) {
  // Soft heart-ish polar feel (rounded, bubbly, no sharp point)
  const s = Math.sin(theta);
  const c = Math.cos(theta);

  // Upper lobes
  const lobes = 0.20 * Math.pow(Math.max(0, s), 2) * (1 + 0.6 * Math.cos(2 * theta));

  // Soft bottom point
  const bottom = (s < 0) ? 0.22 * Math.pow(-s, 1.25) : 0;

  // Slight cleft hint
  const cleft = 0.10 * Math.pow(Math.max(0, c), 2.2) * Math.pow(Math.max(0, s), 1.6);

  const m = 1.0 + lobes + bottom - cleft;
  return clamp(m, 0.72, 1.32);
}

function targetGG(theta) {
  // “GG suggested” silhouette, not literal text
  let m = 1.0 - 0.06 * Math.cos(2 * theta);

  // Two main bulges
  m += 0.18 * Math.pow(Math.cos(theta - Math.PI * 0.25), 2);
  m += 0.18 * Math.pow(Math.cos(theta - Math.PI * 0.75), 2);

  // Gentle inward notches on right side
  const right = Math.cos(theta);
  const up = Math.sin(theta);
  const notch = Math.max(0, right) * (0.10 + 0.08 * Math.max(0, up));
  m -= notch;

  // Small lower-right “bar” suggestion
  const bar = Math.max(0, right) * Math.max(0, -up) * 0.10;
  m -= bar;

  return clamp(m, 0.70, 1.30);
}

function pickTarget(shapeMode) {
  switch (shapeMode) {
    case 'Heart': return targetHeart;
    case 'GG': return targetGG;
    case 'Bubble':
    default: return targetBubble;
  }
}

function sizeScale(bubbleSize) {
  switch (bubbleSize) {
    case 'Small': return 0.24;
    case 'Large': return 0.40;
    case 'Medium':
    default: return 0.32;
  }
}

function motionParams(motionIntensity) {
  switch (motionIntensity) {
    case 'Calm':
      return { wobbleAmp: 0.035, wobbleSpeed: 0.55, driftAmp: 0.010, shimmer: 0.35 };
    case 'Energetic':
      return { wobbleAmp: 0.085, wobbleSpeed: 1.10, driftAmp: 0.020, shimmer: 0.70 };
    case 'Expressive':
    default:
      return { wobbleAmp: 0.060, wobbleSpeed: 0.80, driftAmp: 0.015, shimmer: 0.55 };
  }
}

function computeLeader(factions) {
  if (!Array.isArray(factions) || factions.length === 0) return null;
  let best = factions[0];
  for (const f of factions) {
    if ((f?.meter ?? 0) > (best?.meter ?? 0)) best = f;
  }
  return best || null;
}

function computeTotal(factions) {
  if (!Array.isArray(factions)) return 0;
  return factions.reduce((sum, f) => sum + (Number(f?.meter) || 0), 0);
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
  c.dataset.style = styleKey || 'morphBubble';
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
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: W / dpr, h: H / dpr, dpr };
}

export function init({ root, config, api }) {
  const cfg = safeConfig(config);
  const mp = motionParams(cfg.motionIntensity);

  const { canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true });

  let dims = resizeCanvas(canvas);
  const ro = new ResizeObserver(() => { dims = resizeCanvas(canvas); });
  ro.observe(canvas);

  // Live meters snapshot
  let lastSnap = { factions: [] };
  api.onMeters((snap) => {
    lastSnap = (snap && typeof snap === 'object') ? snap : { factions: [] };
  });

  // Keep this safe on OBS Chromium
  const POINTS = 140;

  function drawBubble(params) {
    const { cx, cy, baseR, leaderRgb, morph, wobblePhase, hypeGlow, shimmer } = params;
    const tf = pickTarget(cfg.shapeMode);

    ctx.save();

    // Shape path
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const a = (i / POINTS) * Math.PI * 2;
      const wobble =
        mp.wobbleAmp * (0.55 * Math.sin(a * 3 + wobblePhase) + 0.45 * Math.sin(a * 5 - wobblePhase * 0.7));
      const targetMul = tf(a);
      const mul = 1 + wobble + morph * (targetMul - 1);
      const r = baseR * mul;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Glossy gradient fill
    const edge = mixRgb(leaderRgb, { r: 255, g: 255, b: 255 }, 0.35);
    const core = mixRgb(leaderRgb, { r: 255, g: 255, b: 255 }, 0.70);

    const g = ctx.createRadialGradient(
      cx - baseR * 0.22, cy - baseR * 0.30, baseR * 0.12,
      cx, cy, baseR * 1.10
    );
    g.addColorStop(0.00, rgba(core, 0.22 + 0.18 * morph));
    g.addColorStop(0.45, rgba(leaderRgb, 0.10 + 0.15 * morph));
    g.addColorStop(1.00, rgba(leaderRgb, 0.02));

    ctx.shadowColor = rgba(leaderRgb, 0.15 + 0.18 * hypeGlow);
    ctx.shadowBlur = 18 + 20 * hypeGlow;

    ctx.fillStyle = g;
    ctx.fill();

    // Rim highlight
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = rgba(edge, 0.32 + 0.22 * morph);
    ctx.stroke();

    // Inner highlight streak
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.ellipse(cx - baseR * 0.18, cy - baseR * 0.24, baseR * 0.36, baseR * 0.22, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, 0.06 + 0.08 * morph);
    ctx.fill();

    // Shimmer ring
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.ellipse(cx + baseR * 0.10, cy + baseR * 0.18, baseR * 0.48, baseR * 0.36, 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.02 + 0.06 * shimmer);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  let raf = 0;
  let t = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    t += 1 / 60;

    ctx.clearRect(0, 0, dims.w, dims.h);

    const factions = lastSnap?.factions || lastSnap?.meters || [];
    const leader = computeLeader(factions);
    const total = computeTotal(factions);

    // Smooth, scale-free hype curve
    const morph = smoothstep(10, 600, total);

    // Gentle pulse at higher hype
    const pulse = 0.5 + 0.5 * Math.sin(t * (2.2 + 2.5 * morph));
    const hypeGlow = morph * (0.55 + 0.45 * pulse);

    const leaderRgb = hexToRgb(leader?.colorHex || '#8ad7ff');

    const baseR = Math.min(dims.w, dims.h) * sizeScale(cfg.bubbleSize);

    // Centered with mild drift
    const drift = mp.driftAmp * baseR;
    const cx = dims.w * 0.5 + drift * Math.sin(t * 0.65);
    const cy = dims.h * 0.5 + drift * Math.cos(t * 0.55);

    const wobblePhase = t * (2.0 * mp.wobbleSpeed);

    // Shimmer reacts slightly more during close races
    let shimmer = mp.shimmer;
    if (Array.isArray(factions) && factions.length >= 2) {
      const sorted = [...factions].sort((a, b) => (Number(b?.meter) || 0) - (Number(a?.meter) || 0));
      const top = Number(sorted[0]?.meter) || 0;
      const second = Number(sorted[1]?.meter) || 0;
      const contest = top > 0 ? clamp(second / top, 0, 1) : 0;
      shimmer *= 0.6 + 0.8 * contest;
    }

    drawBubble({ cx, cy, baseR, leaderRgb, morph, wobblePhase, hypeGlow, shimmer });
  }

  raf = requestAnimationFrame(frame);

  // Cleanup if OBS scene removes the root
  const mo = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
