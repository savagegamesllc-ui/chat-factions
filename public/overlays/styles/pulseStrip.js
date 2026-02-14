/* pulseStrip.js — Chat Factions (FREE)
   Silver utility strip with subtle faction accent + numeric hype readout.
*/

export const defaultConfig = {
  meta: {
    styleKey: 'pulseStrip',
    name: 'Pulse Strip',
    tier: 'free',
  },

  config: {
    // Placement + layout
    placement: 'bottom',          // top | bottom | left | right
    thickness: 0.06,              // % of screen (0.02 - 0.14)
    inset: 0.03,                  // % margin from edges
    cornerRadius: 18,

    // Color / hype
    mixMode: 'winner',            // winner | weighted
    intensity: 1.0,

    // Silver base styling
    silverStrength: 0.92,         // how “silver” the base is (0..1)
    spectrumShrink: 0.35,         // desaturate faction color use (0..1, lower = more muted)

    // Strip look
    backgroundAlpha: 0.55,
    borderAlpha: 0.70,
    borderWidth: 2.0,
    glowStrength: 0.35,

    // Pulses (accent packets)
    pulseEnabled: true,
    pulseCount: 5,
    pulseSpeed: 0.18,
    pulseWidth: 0.20,
    pulseSoftness: 0.75,

    // Text
    textEnabled: true,
    textUppercase: true,
    textAlpha: 0.92,
    fontSize: 0.40,               // relative to strip thickness
    titleText: 'CHAT FACTIONS',   // tucked left corner label

    // Numeric readout
    showActiveFactions: true,     // show count of factions with meter > 0
    numberFormat: 'int',          // int | compact (compact = 1.2k etc)
    labelHype: 'HYPE',            // right-side label

    // Tuning + performance
    fpsCap: 60,
    hypeK: 180,
    maxTotalClamp: 2200,
    hypeSmoothing: 0.18,
  },

  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['top', 'bottom', 'left', 'right'], default: 'bottom' },
    { key: 'thickness', label: 'Thickness', type: 'range', min: 0.02, max: 0.14, step: 0.005, default: 0.06 },
    { key: 'inset', label: 'Inset', type: 'range', min: 0.0, max: 0.10, step: 0.005, default: 0.03 },
    { key: 'cornerRadius', label: 'Corner Radius', type: 'range', min: 0, max: 60, step: 1, default: 18 },

    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['winner', 'weighted'], default: 'winner' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'silverStrength', label: 'Silver Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.92 },
    { key: 'spectrumShrink', label: 'Spectrum Shrink', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },

    { key: 'backgroundAlpha', label: 'Background Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'borderAlpha', label: 'Border Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.70 },
    { key: 'borderWidth', label: 'Border Width', type: 'range', min: 0, max: 8, step: 0.1, default: 2.0 },
    { key: 'glowStrength', label: 'Glow Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },

    { key: 'pulseEnabled', label: 'Enable Pulses', type: 'checkbox', default: true },
    { key: 'pulseCount', label: 'Pulse Count', type: 'range', min: 0, max: 12, step: 1, default: 5 },
    { key: 'pulseSpeed', label: 'Pulse Speed', type: 'range', min: 0.02, max: 1.0, step: 0.01, default: 0.18 },
    { key: 'pulseWidth', label: 'Pulse Width', type: 'range', min: 0.05, max: 0.6, step: 0.01, default: 0.20 },
    { key: 'pulseSoftness', label: 'Pulse Softness', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.75 },

    { key: 'textEnabled', label: 'Enable Text', type: 'checkbox', default: true },
    { key: 'textUppercase', label: 'Uppercase Text', type: 'checkbox', default: true },
    { key: 'textAlpha', label: 'Text Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.92 },
    { key: 'fontSize', label: 'Font Size', type: 'range', min: 0.25, max: 0.7, step: 0.01, default: 0.40 },

    { key: 'showActiveFactions', label: 'Show Active Factions', type: 'checkbox', default: true },
    { key: 'numberFormat', label: 'Number Format', type: 'select', options: ['int', 'compact'], default: 'int' },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 180 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
  ],
};

function clamp(n, min, max) { return Math.max(min, Math.min(max, Number.isFinite(+n) ? +n : min)); }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

function hexToRgb(hex) {
  const h = String(hex || '#8cd2ff').trim().replace('#', '');
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
  if (sum <= 0) return { r: 160, g: 200, b: 220 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 160, g: 200, b: 220 };
}

function shrinkSpectrum(rgb, shrink) {
  // shrink=0 => original; shrink=1 => near-gray
  const s = clamp01(shrink);
  const gray = (rgb.r + rgb.g + rgb.b) / 3;
  return {
    r: lerp(rgb.r, gray, s),
    g: lerp(rgb.g, gray, s),
    b: lerp(rgb.b, gray, s),
  };
}

function toCompact(n) {
  const x = Math.max(0, n);
  if (x < 1000) return String(x | 0);
  if (x < 1_000_000) return `${(x / 1000).toFixed(x < 10_000 ? 1 : 0)}k`;
  return `${(x / 1_000_000).toFixed(x < 10_000_000 ? 1 : 0)}m`;
}

/** Returns { total, activeCount, h, rgbAccent } */
function computeState(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  let total = 0;
  let activeCount = 0;

  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) {
      total += m;
      activeCount += 1;
    }
  }

  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 2200, 200, 6000);
  total = clamp(total, 0, maxTotalClamp);

  let rgb = { r: 160, g: 200, b: 220 };
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === 'weighted') ? mixWeighted(colors, weights) : pickWinner(colors, weights);
  }

  // “Shrink spectrum” so the accent is muted
  const rgbAccent = shrinkSpectrum(rgb, clamp01(cfg.spectrumShrink ?? 0.35));

  const k = clamp(cfg.hypeK ?? 180, 40, 600);
  const h = clamp01(total / k);

  return { total, activeCount, h, rgbAccent };
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'pulseStrip';
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

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function getStripRect(cfg, w, h) {
  const inset = clamp(cfg.inset, 0, 0.12);
  const thick = clamp(cfg.thickness, 0.02, 0.16);

  const pxInsetX = w * inset;
  const pxInsetY = h * inset;

  const place = cfg.placement || 'bottom';

  if (place === 'top') {
    return { x: pxInsetX, y: pxInsetY, w: w - pxInsetX * 2, h: h * thick, t: h * thick };
  }
  if (place === 'bottom') {
    return { x: pxInsetX, y: h - pxInsetY - h * thick, w: w - pxInsetX * 2, h: h * thick, t: h * thick };
  }
  if (place === 'left') {
    return { x: pxInsetX, y: pxInsetY, w: w * thick, h: h - pxInsetY * 2, t: w * thick };
  }
  return { x: w - pxInsetX - w * thick, y: pxInsetY, w: w * thick, h: h - pxInsetY * 2, t: w * thick };
}

function drawText(ctx, rect, cfg, h, total, activeCount, accentCss) {
  if (!cfg.textEnabled) return;

  const place = cfg.placement || 'bottom';
  // Keep it clean: no sideways font for left/right in this version.
  if (place === 'left' || place === 'right') return;

  const pad = rect.t * 0.33;
  const fsTitle = Math.max(10, rect.t * 0.28);
  const fsMain = Math.max(12, rect.t * clamp(cfg.fontSize, 0.25, 0.7));

  const alpha = clamp01(cfg.textAlpha) * (0.78 + 0.22 * h);

  let title = String(cfg.titleText || 'CHAT FACTIONS');
  if (cfg.textUppercase) title = title.toUpperCase();

  const label = String(cfg.labelHype || 'HYPE');
  const num = (cfg.numberFormat === 'compact') ? toCompact(total) : String(total | 0);
  const rightText = cfg.showActiveFactions
    ? `${label} ${num}  •  ${activeCount | 0}`
    : `${label} ${num}`;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textBaseline = 'middle';

  // subtle shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = fsMain * 0.35;

  const midY = rect.y + rect.h * 0.5;

  // Left corner: small title tucked
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `700 ${fsTitle | 0}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillText(title, rect.x + pad, midY);

  // Right: numeric readout
  ctx.textAlign = 'right';
  ctx.font = `700 ${fsMain | 0}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(rightText, rect.x + rect.w - pad, midY);

  // Accent underline (thin)
  ctx.shadowBlur = 0;
  ctx.globalAlpha *= 0.30;
  ctx.strokeStyle = accentCss;
  ctx.lineWidth = Math.max(1, fsMain * 0.06);
  ctx.beginPath();
  ctx.moveTo(rect.x + pad, rect.y + rect.h - pad * 0.55);
  ctx.lineTo(rect.x + rect.w - pad, rect.y + rect.h - pad * 0.55);
  ctx.stroke();

  ctx.restore();
}

export function init({ root, config, api }) {
  const { container, canvas } = ensureContainerAndCanvas(root, 'pulseStrip');
  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = { ...(defaultConfig.config), ...(config || {}) };
  let latestSnap = null;

  // smoothing
  let hSmooth = 0;
  let accentSmooth = { r: 160, g: 200, b: 220 };
  let totalSmooth = 0;
  let activeSmooth = 0;

  // animation timing / fps cap
  let rafId = null;
  let lastMs = performance.now();
  let accMs = 0;

  const off = api?.onMeters?.((snap) => { latestSnap = snap; }) || null;

  function draw(nowMs) {
    const { w, h, dpr } = resizeCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fpsCap = clamp(cfg.fpsCap ?? 60, 15, 60);
    const minStep = 1000 / fpsCap;

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;
    if (accMs < minStep) {
      rafId = requestAnimationFrame(draw);
      return;
    }
    const dt = accMs / 1000;
    accMs = 0;

    const s = computeState(latestSnap, cfg);

    // smooth
    const hs = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    const a = 1 - Math.exp(-hs * 60 * dt);

    hSmooth = lerp(hSmooth, s.h, a);
    totalSmooth = lerp(totalSmooth, s.total, a);
    activeSmooth = lerp(activeSmooth, s.activeCount, a);

    accentSmooth.r = lerp(accentSmooth.r, s.rgbAccent.r, a);
    accentSmooth.g = lerp(accentSmooth.g, s.rgbAccent.g, a);
    accentSmooth.b = lerp(accentSmooth.b, s.rgbAccent.b, a);

    // accent css
    const ar = accentSmooth.r | 0, ag = accentSmooth.g | 0, ab = accentSmooth.b | 0;
    const accentCss = `rgb(${ar},${ag},${ab})`;
    const accentHot = `rgb(${Math.min(255, (ar * 1.08 + 22) | 0)},${Math.min(255, (ag * 1.08 + 22) | 0)},${Math.min(255, (ab * 1.08 + 22) | 0)})`;

    ctx.clearRect(0, 0, w, h);

    const rect = getStripRect(cfg, w, h);
    const rad = clamp(cfg.cornerRadius, 0, 120) * (0.75 + 0.35 * hSmooth);

    // Silver base gradient (neutral)
    const silver = clamp01(cfg.silverStrength ?? 0.92);
    const baseDark = 18 + 40 * (1 - silver);
    const baseMid = 45 + 60 * (1 - silver);
    const baseLight = 80 + 70 * (1 - silver);

    const bgA = clamp01(cfg.backgroundAlpha) * (0.85 + 0.25 * hSmooth) * clamp01(cfg.intensity ?? 1);

    ctx.save();
    roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, rad);

    // neutral metal gradient (along long axis)
    const place = cfg.placement || 'bottom';
    const grad = (place === 'left' || place === 'right')
      ? ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h)
      : ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);

    grad.addColorStop(0.0, `rgba(${baseMid},${baseMid},${baseMid},${bgA})`);
    grad.addColorStop(0.5, `rgba(${baseLight},${baseLight},${baseLight},${bgA * 0.85})`);
    grad.addColorStop(1.0, `rgba(${baseDark},${baseDark},${baseDark},${bgA})`);

    ctx.fillStyle = grad;
    ctx.fill();

    // Accent glow (subtle)
    const glow = clamp01(cfg.glowStrength) * (0.25 + 0.70 * hSmooth) * clamp01(cfg.intensity ?? 1);
    if (glow > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = `rgba(${ar},${ag},${ab},0.85)`;
      ctx.shadowBlur = (8 + 65 * glow) * (0.65 + 0.65 * hSmooth);
      ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.08 * hSmooth})`;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Border uses accent, but muted by design
    const bw = clamp(cfg.borderWidth, 0, 12) * (0.9 + 0.25 * hSmooth);
    const bA = clamp01(cfg.borderAlpha) * (0.60 + 0.40 * hSmooth) * clamp01(cfg.intensity ?? 1);
    if (bw > 0.001 && bA > 0.001) {
      ctx.lineWidth = bw;
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${bA})`;
      ctx.stroke();
    }

    ctx.restore();

    // Pulses: only in accent color, not rainbow
    if (cfg.pulseEnabled && (cfg.pulseCount | 0) > 0) {
      const count = clamp(cfg.pulseCount | 0, 0, 32);
      const speed = clamp(cfg.pulseSpeed, 0.02, 1.5) * (0.55 + 1.10 * hSmooth) * (0.70 + 0.55 * clamp01(cfg.intensity ?? 1));
      const widthRel = clamp(cfg.pulseWidth, 0.05, 0.7);
      const soft = clamp01(cfg.pulseSoftness);

      ctx.save();
      roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, rad);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';

      const t = nowMs / 1000;
      for (let i = 0; i < count; i++) {
        const phase = frac((t * speed) + i / count);

        const pulseA = (0.06 + 0.35 * hSmooth) *
          (0.55 + 0.45 * (Math.sin((phase + 0.12) * Math.PI * 2) * 0.5 + 0.5));

        const a = pulseA * clamp01(cfg.intensity ?? 1);

        let px, py, pw, ph;
        if (place === 'left' || place === 'right') {
          pw = rect.w * (0.70 + 0.25 * hSmooth);
          ph = rect.h * widthRel * (0.55 + 0.75 * hSmooth);
          px = rect.x + (rect.w - pw) * 0.5;
          py = rect.y + phase * (rect.h + ph) - ph * 0.5;
        } else {
          pw = rect.w * widthRel * (0.55 + 0.75 * hSmooth);
          ph = rect.h * (0.70 + 0.25 * hSmooth);
          px = rect.x + phase * (rect.w + pw) - pw * 0.5;
          py = rect.y + (rect.h - ph) * 0.5;
        }

        const rr = Math.min(rad * 0.9, Math.min(pw, ph) * 0.5);

        const g = (place === 'left' || place === 'right')
          ? ctx.createLinearGradient(px, py, px, py + ph)
          : ctx.createLinearGradient(px, py, px + pw, py);

        const edgeA = a * (0.10 + 0.45 * (1 - soft));
        const midA = a * (0.35 + 0.75 * soft);

        g.addColorStop(0.0, `rgba(${ar},${ag},${ab},${edgeA})`);
        g.addColorStop(0.5, `rgba(255,255,255,${midA})`);
        g.addColorStop(1.0, `rgba(${ar},${ag},${ab},${edgeA})`);

        ctx.fillStyle = g;
        roundedRectPath(ctx, px, py, pw, ph, rr);
        ctx.fill();

        // Hot core
        ctx.globalAlpha = clamp01(a * 0.45);
        ctx.fillStyle = accentHot;
        roundedRectPath(ctx, px + pw * 0.18, py + ph * 0.22, pw * 0.64, ph * 0.56, rr * 0.8);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    // Text: left corner “Chat Factions”, right numeric hype + active factions
    drawText(
      ctx,
      rect,
      cfg,
      hSmooth,
      Math.round(totalSmooth),
      Math.round(activeSmooth),
      accentCss
    );

    rafId = requestAnimationFrame(draw);
  }

  const onResize = () => {};
  window.addEventListener('resize', onResize, { passive: true });

  rafId = requestAnimationFrame(draw);

  function setConfig(next) {
    cfg = { ...(cfg || {}), ...(next || {}) };
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    if (typeof off === 'function') off();
    container.remove();
  }

  return { setConfig, destroy };
}
