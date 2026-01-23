// public/overlays/styles/spectrumBorder.js
// FREE Overlay: SpectrumBorder
// Full-frame equalizer-style border that reacts to total hype
// Clean, performant, premium-feeling FREE option

'use strict';

export const meta = {
  styleKey: 'spectrumBorder',
  name: 'Spectrum Border (FREE)',
  tier: 'FREE',
  description: 'A full-frame music equalizer border that pulses and dances with chat hype.',
  defaultConfig: {
    placement: 'edges',      // edges | bottom
    mixMode: 'weighted',     // weighted | winner
    intensity: 1.0,          // 0..2

    barCount: 64,            // number of equalizer bars per edge
    barWidth: 6,             // px
    barGap: 3,               // px
    maxBarHeight: 46,        // px
    smoothing: 0.85,         // 0..0.98 (higher = smoother motion)

    glow: 0.6,               // 0..1
    alpha: 0.9,              // 0..1
    padding: 10              // px inset from edge
  },
  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'bottom'], default: 'edges' },
    { key: 'mixMode', label: 'Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'barCount', label: 'Bar Count', type: 'range', min: 16, max: 128, step: 4, default: 64 },
    { key: 'barWidth', label: 'Bar Width', type: 'range', min: 2, max: 14, step: 1, default: 6 },
    { key: 'barGap', label: 'Bar Gap', type: 'range', min: 1, max: 10, step: 1, default: 3 },
    { key: 'maxBarHeight', label: 'Max Bar Height', type: 'range', min: 10, max: 120, step: 2, default: 46 },
    { key: 'smoothing', label: 'Smoothing', type: 'range', min: 0.6, max: 0.98, step: 0.01, default: 0.85 },

    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: 'alpha', label: 'Opacity', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.9 },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 40, step: 1, default: 10 }
  ]
};

export function init({ canvas, app, config }) {
  const resolved = ensureCanvas(canvas);
  canvas = resolved.canvas;
  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };
  let bars = [];
  let targetBars = [];

  let factions = [];
  let meters = [];
  let totalHype = 0;

  if (app?.on) {
    app.on('state', s => ingestState(s));
    app.on('meters', m => ingestMeters(m));
  }
  if (app?.getState) ingestState(app.getState());

  function ingestState(s) {
    if (s?.factions) factions = s.factions;
    if (s?.meters) ingestMeters(s.meters);
  }

  function ingestMeters(m) {
    meters = Array.isArray(m) ? m : [];
    let t = 0;
    for (const v of meters) t += Math.max(0, Number(v?.value ?? 0));
    totalHype = Math.min(1, t / 200);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function mixColor() {
    if (!factions.length || !meters.length) return '#78c8ff';

    let best = null;
    let sum = 0, r = 0, g = 0, b = 0;

    for (const f of factions) {
      const m = meters.find(x => x.factionId === f.id);
      const v = Math.max(0, Number(m?.value ?? 0));
      if (!v) continue;

      const col = hexToRgb(f.colorHex || '#78c8ff');
      if (!best || v > best.v) best = { v, col };

      r += col.r * v;
      g += col.g * v;
      b += col.b * v;
      sum += v;
    }

    if (cfg.mixMode === 'winner' && best) {
      return rgbToCss(best.col, cfg.alpha);
    }

    if (sum <= 0) return '#78c8ff';
    return rgbToCss({ r: r / sum, g: g / sum, b: b / sum }, cfg.alpha);
  }

  function updateBars(dt) {
    const count = cfg.barCount;
    if (bars.length !== count) {
      bars = new Array(count).fill(0);
      targetBars = new Array(count).fill(0);
    }

    for (let i = 0; i < count; i++) {
      const noise = Math.sin(performance.now() * 0.002 + i * 0.4);
      targetBars[i] =
        noise *
        cfg.maxBarHeight *
        totalHype *
        cfg.intensity;
      bars[i] += (targetBars[i] - bars[i]) * (1 - cfg.smoothing);
    }
  }

  function drawBars(color) {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    const pad = cfg.padding;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = color;
    ctx.shadowBlur = cfg.glow * 30;

    ctx.fillStyle = color;

    const drawEdge = (x, y, dx, dy, length) => {
      for (let i = 0; i < bars.length; i++) {
        const bh = bars[i];
        const px = x + dx * (i * (cfg.barWidth + cfg.barGap));
        const py = y + dy * (i * (cfg.barWidth + cfg.barGap));
        ctx.fillRect(px, py, dx ? cfg.barWidth : bh, dy ? cfg.barWidth : bh);
      }
    };

    if (cfg.placement === 'bottom') {
      drawEdge(pad, h - pad, 1, 0);
    } else {
      drawEdge(pad, pad, 1, 0);                     // top
      drawEdge(w - pad, pad, 0, 1);                 // right
      drawEdge(pad, h - pad, 1, 0);                 // bottom
      drawEdge(pad, pad, 0, 1);                     // left
    }
  }

  let last = performance.now();
  let raf;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    resize();
    updateBars(dt);
    drawBars(mixColor());
  }
  tick(last);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      if (resolved.created && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
    setConfig(next) {
      cfg = { ...cfg, ...(next || {}) };
    }
  };
}

/* ---------- helpers ---------- */
function ensureCanvas(existing) {
  if (existing?.getContext) return { canvas: existing, created: false };
  const root = document.getElementById('overlayRoot') || document.body;
  const c = document.createElement('canvas');
  c.style.position = 'absolute';
  c.style.inset = '0';
  c.style.pointerEvents = 'none';
  root.appendChild(c);
  return { canvas: c, created: true };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToCss({ r, g, b }, a = 1) {
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
}
