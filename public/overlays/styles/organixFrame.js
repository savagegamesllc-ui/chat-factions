// public/overlays/styles/organixFrame.js
'use strict';

/*
  Organix Frame (FREE)
  Organic, living-tech label bar that pulses with hype
  and shifts toward the leading faction color.
*/

export const meta = {
  styleKey: 'organixFrame',
  name: 'Organix Frame',
  tier: 'FREE',
  description:
    'An organic, living-tech label frame that pulses with hype and flows toward the leading faction color. Designed to frame streamer stats like latest follower or subscriber.',

  defaultConfig: {
    labelText: 'Latest Follower',
    valueText: 'username_here',

    position: 'bottom-left', // bottom-left | bottom-center | top-left | top-right
    width: 360,
    height: 64,

    hypeK: 140,
    hypeSmoothing: 0.18,

    baseGlow: 0.25,
    maxGlow: 0.85,

    pulseSpeed: 10.2,
    veinIntensity: 0.6
  }
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
}

function computeHype(snap, k) {
  let total = 0;
  let winner = null;
  let best = -1;

  for (const f of snap.factions || []) {
    total += f.meter || 0;
    if ((f.meter || 0) > best) {
      best = f.meter;
      winner = f;
    }
  }

  const h = 1 - Math.exp(-total / k);
  return {
    h: clamp(h, 0, 1),
    color: winner?.colorHex || '#88ccff'
  };
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const cfg = { ...meta.defaultConfig, ...(config || {}) };

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';

  const canvas = document.createElement('canvas');
  canvas.width = cfg.width * 2;
  canvas.height = cfg.height * 2;
  canvas.style.width = `${cfg.width}px`;
  canvas.style.height = `${cfg.height}px`;

  container.appendChild(canvas);
  root.appendChild(container);

  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Positioning
  const pad = 20;
  const positions = {
    'bottom-left': { left: pad, bottom: pad },
    'bottom-center': { left: '50%', bottom: pad, transform: 'translateX(-50%)' },
    'top-left': { left: pad, top: pad },
    'top-right': { right: pad, top: pad }
  };
  Object.assign(container.style, positions[cfg.position] || positions['bottom-left']);

  let hypeSmooth = 0;
  let colorSmooth = { r: 140, g: 210, b: 255 };
  let lastSnap = { factions: [] };

  api.onMeters((snap) => {
    lastSnap = snap || { factions: [] };
  });

  function draw(t) {
    requestAnimationFrame(draw);

    const { h, color } = computeHype(lastSnap, cfg.hypeK);
    hypeSmooth = lerp(hypeSmooth, h, cfg.hypeSmoothing);

    const rgb = hexToRgb(color);
    colorSmooth.r = lerp(colorSmooth.r, rgb.r, 0.08);
    colorSmooth.g = lerp(colorSmooth.g, rgb.g, 0.08);
    colorSmooth.b = lerp(colorSmooth.b, rgb.b, 0.08);

    const glow =
      lerp(cfg.baseGlow, cfg.maxGlow, hypeSmooth) *
      (0.85 + 0.15 * Math.sin(t * cfg.pulseSpeed));

    ctx.clearRect(0, 0, cfg.width, cfg.height);

    // Organic frame background
    ctx.fillStyle = 'rgba(10,10,16,0.65)';
    ctx.beginPath();
    ctx.moveTo(18, 6);
    ctx.lineTo(cfg.width - 22, 8);
    ctx.quadraticCurveTo(cfg.width - 6, cfg.height / 2, cfg.width - 22, cfg.height - 8);
    ctx.lineTo(18, cfg.height - 6);
    ctx.quadraticCurveTo(6, cfg.height / 2, 18, 6);
    ctx.closePath();
    ctx.fill();

    // Organic glow outline
    ctx.strokeStyle = `rgba(${colorSmooth.r},${colorSmooth.g},${colorSmooth.b},${glow})`;
    ctx.lineWidth = 2 + hypeSmooth * 2;
    ctx.shadowBlur = 18 + hypeSmooth * 24;
    ctx.shadowColor = ctx.strokeStyle;

    ctx.stroke();

    ctx.shadowBlur = 0;

    // Vein lines
    ctx.strokeStyle = `rgba(${colorSmooth.r},${colorSmooth.g},${colorSmooth.b},${0.15 + hypeSmooth * 0.35})`;
    ctx.lineWidth = 1;

    const veinCount = 4;
    for (let i = 0; i < veinCount; i++) {
      const y = (cfg.height / (veinCount + 1)) * (i + 1);
      ctx.beginPath();
      ctx.moveTo(22, y);
      ctx.bezierCurveTo(
        cfg.width * 0.35,
        y + Math.sin(t * 0.001 + i) * 6,
        cfg.width * 0.65,
        y - Math.sin(t * 0.001 + i) * 6,
        cfg.width - 22,
        y
      );
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.labelText, 18, cfg.height / 2 - 10);

    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(cfg.valueText, 18, cfg.height / 2 + 10);
  }

  requestAnimationFrame(draw);

  return {
    destroy() {
      while (root.firstChild) root.removeChild(root.firstChild);
    },
    setConfig(next) {
      Object.assign(cfg, next || {});
    }
  };
}
