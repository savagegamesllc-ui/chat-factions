'use strict';

/**
 * Neon Circuit (PRO)
 * A routed RGB circuit border with directional energy flow,
 * hype-driven activation, and event-based overload reactions.
 */

export const meta = {
  styleKey: 'neonCircuit',
  name: 'Neon Circuit',
  tier: 'PRO',
  description: 'A cyberpunk-style neon circuit border that routes energy around the screen, reacting to hype, bits, and subs.',

  defaultConfig: {
    // Geometry (percent of shortest dimension)
    safeInsetPct: 0.02,
    cornerRadiusPct: 0.035,

    circuitThicknessPct: 0.006,
    innerRailThicknessPct: 0.004,
    outerHaloStrength: 0.6,

    // Motion
    baseFlowSpeed: 0.18,
    maxFlowSpeed: 1.2,
    energyPacketSpacing: 0.06,

    // Hype
    hypeK: 220,
    hypeSmoothing: 0.15,

    // Overload timing (ms)
    bitsBoostDuration: 1400,
    rareOverloadCooldown: 15000,
    massOverloadDuration: 2600,

    // Performance
    fpsCap: 60,
    dprCap: 2
  }
};

export function init({ root, config, api }) {
  const cfg = { ...meta.defaultConfig, ...(config || {}) };

  /* -----------------------------
     Canvas + container
  ----------------------------- */
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';

  container.appendChild(canvas);
  root.appendChild(container);

  const ctx = canvas.getContext('2d');

  /* -----------------------------
     State
  ----------------------------- */
  let W = 0, H = 0, dpr = 1;
  let lastTs = performance.now();

  let hype = 0;
  let hypeTarget = 0;

  let leaderColor = '#66ccff';

  // Event state
  let bitsBoostUntil = 0;
  let massOverloadUntil = 0;
  let lastRareOverload = 0;

  /* -----------------------------
     Resize
  ----------------------------- */
  function resize() {
    const rect = container.getBoundingClientRect();
    dpr = Math.min(cfg.dprCap, window.devicePixelRatio || 1);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    W = rect.width;
    H = rect.height;
  }

  new ResizeObserver(resize).observe(container);
  resize();

  /* -----------------------------
     API Hooks
  ----------------------------- */
  api.onMeters(snapshot => {
    let sum = 0;
    let leader = null;

    snapshot?.factions?.forEach(f => {
      const v = Number(f.meter || 0);
      sum += v;
      if (!leader || v > leader.v) {
        leader = { v, color: f.colorHex };
      }
    });

    hypeTarget = 1 - Math.exp(-sum / cfg.hypeK);
    if (leader?.color) leaderColor = leader.color;
  });

  api.onEvent?.('bits', () => {
    bitsBoostUntil = performance.now() + cfg.bitsBoostDuration;
  });

  api.onEvent?.('sub', () => {
    massOverloadUntil = performance.now() + cfg.massOverloadDuration;
  });

  /* -----------------------------
     Helpers
  ----------------------------- */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hexToRGB(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255
    };
  }

  /* -----------------------------
     Drawing
  ----------------------------- */
  function draw(ts) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Smooth hype
    hype = lerp(hype, hypeTarget, cfg.hypeSmoothing);

    const minDim = Math.min(W, H);
    const inset = minDim * cfg.safeInsetPct;
    const radius = minDim * cfg.cornerRadiusPct;

    const circuitTh = minDim * cfg.circuitThicknessPct;
    const railTh = minDim * cfg.innerRailThicknessPct;

    const now = ts;

    const isBitsBoost = now < bitsBoostUntil;
    const isMassOverload = now < massOverloadUntil;

    // Rare overload (ambient)
    const canRare =
      hype > 0.75 &&
      now - lastRareOverload > cfg.rareOverloadCooldown &&
      Math.random() < 0.002;

    if (canRare) lastRareOverload = now;

    const overloadStrength =
      isMassOverload ? 1 :
      isBitsBoost ? 0.6 :
      canRare ? 0.8 : hype;

    const flowSpeed =
      lerp(cfg.baseFlowSpeed, cfg.maxFlowSpeed, overloadStrength);

    /* -------- OUTER HALO -------- */
    if (overloadStrength > 0.5) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.15 * overloadStrength})`;
      ctx.lineWidth = circuitTh * 2.4;
      ctx.shadowBlur = 30 * overloadStrength;
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      roundedRect(ctx, inset, inset, W - inset * 2, H - inset * 2, radius);
      ctx.stroke();
      ctx.restore();
    }

    /* -------- CIRCUIT PATH -------- */
    ctx.save();
    ctx.lineWidth = circuitTh;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 18 * overloadStrength;
    ctx.shadowColor = 'rgba(255,255,255,0.5)';

    const t = (ts * flowSpeed) % 1;

    for (let i = 0; i < 40; i++) {
      const hue = (i / 40 + t) % 1;
      ctx.strokeStyle = `hsl(${hue * 360}, 100%, ${50 + overloadStrength * 20}%)`;

      ctx.globalAlpha = 0.6 + overloadStrength * 0.4;

      roundedRect(
        ctx,
        inset + i * 0.5,
        inset + i * 0.5,
        W - inset * 2 - i,
        H - inset * 2 - i,
        radius
      );
      ctx.stroke();
    }
    ctx.restore();

    /* -------- INNER LED RAIL -------- */
    const lc = hexToRGB(leaderColor);

    ctx.save();
    ctx.strokeStyle = `rgb(${lc.r},${lc.g},${lc.b})`;
    ctx.lineWidth = railTh;
    ctx.shadowBlur = 20 + overloadStrength * 30;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.globalAlpha = 0.8 + overloadStrength * 0.2;

    roundedRect(
      ctx,
      inset + circuitTh * 2,
      inset + circuitTh * 2,
      W - inset * 2 - circuitTh * 4,
      H - inset * 2 - circuitTh * 4,
      radius * 0.9
    );
    ctx.stroke();
    ctx.restore();
  }

  /* -----------------------------
     Animation loop
  ----------------------------- */
  function loop(ts) {
    draw(ts);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  /* -----------------------------
     Rounded Rect
  ----------------------------- */
  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
