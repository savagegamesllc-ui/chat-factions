// public/overlays/styles/bubbleBloom.js
// FREE Overlay: Bubble Bloom
// Full-screen bubbles that rise and wobble. More hype => more bubbles.
// Tint is biased toward the primary faction color (winner or weighted mix).
//
// Contract: export const meta + export function init({ root, config, api })

'use strict';

export const meta = {
  styleKey: 'bubbleBloom',
  name: 'Bubble Bloom (FREE)',
  tier: 'FREE',
  description:
    'Rising bubble field that intensifies with hype, tinted toward the leading (or blended) faction color. Clean, light, OBS-safe.',

  defaultConfig: {
    // Core behavior
    mixMode: 'winner',          // winner | weighted
    intensity: 1.0,             // 0..2 overall strength

    // Hype mapping
    hypeK: 160,                 // higher = needs more total to reach max
    maxTotalClamp: 2200,        // safety clamp
    hypeSmoothing: 0.18,        // 0.05..0.5 (higher = snappier)

    // Performance
    fpsCap: 60,                 // 15..60
    renderScale: 0.85,          // 0.5..1 (lower = faster, blurrier)

    // Bubble population
    bubbleMax: 180,             // cap (main perf knob)
    bubbleSpawnBase: 2.5,       // per second at ~0 hype
    bubbleSpawnBoost: 55,       // additional per second at max hype
    bubbleSpawnCapPerFrame: 22, // hard safety cap

    // Bubble motion
    riseSpeedMin: 22,           // px/sec
    riseSpeedMax: 140,          // px/sec
    wobbleStrength: 26,         // px
    wobbleSpeed: 0.9,           // Hz-ish

    // Bubble look
    sizeMin: 10,                // px
    sizeMax: 86,                // px
    alphaMin: 0.06,
    alphaMax: 0.22,
    rimAlpha: 0.40,             // rim highlight intensity
    tintStrength: 0.55,         // 0..1 how much faction color influences bubbles
    sparkleStrength: 0.20,      // 0..1 tiny inner highlight

    // Screen shaping
    edgeFade: 0.18              // 0..0.6 fades bubbles near edges
  },

  controls: [
    { key: 'mixMode', label: 'Faction Mix', type: 'select', options: ['winner', 'weighted'], default: 'winner' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'renderScale', label: 'Render Scale', type: 'range', min: 0.5, max: 1, step: 0.01, default: 0.85 },

    { key: 'bubbleMax', label: 'Max Bubbles', type: 'range', min: 20, max: 800, step: 10, default: 180 },
    { key: 'bubbleSpawnBase', label: 'Base Spawn/sec', type: 'range', min: 0, max: 30, step: 0.5, default: 2.5 },
    { key: 'bubbleSpawnBoost', label: 'Spawn Boost/sec', type: 'range', min: 0, max: 160, step: 2, default: 55 },

    { key: 'sizeMin', label: 'Min Size', type: 'range', min: 4, max: 60, step: 1, default: 10 },
    { key: 'sizeMax', label: 'Max Size', type: 'range', min: 12, max: 160, step: 1, default: 86 },

    { key: 'tintStrength', label: 'Tint Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'edgeFade', label: 'Edge Fade', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 160 },
    { key: 'maxTotalClamp', label: 'Max Total Clamp', type: 'number', min: 200, max: 6000, step: 50, default: 2200 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 }
  ],
};

function clamp(n, a, b) { n = Number(n); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'bubbleBloom';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';
  c.style.willChange = 'transform, opacity';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas, renderScale) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const scale = clamp(renderScale, 0.5, 1);

  const W = Math.max(1, Math.floor(rect.width * dpr * scale));
  const H = Math.max(1, Math.floor(rect.height * dpr * scale));

  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  // Return CSS-pixel space for drawing (we draw in "scaled CSS px")
  const w = rect.width * scale;
  const h = rect.height * scale;

  return { w, h, dpr, scale };
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

function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }

  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 2200, 200, 6000);
  total = clamp(total, 0, maxTotalClamp);

  let rgb;
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === 'weighted') ? mixWeighted(colors, weights) : pickWinner(colors, weights);
  } else {
    rgb = { r: 140, g: 210, b: 255 };
  }

  const k = clamp(cfg.hypeK ?? 160, 40, 600);
  let h = 1 - Math.exp(-total / k);

  // small lift so low hype still visible (optional)
  h = clamp01(h + (1 - h) * 0.05 * Math.min(1, total / 70));

  return { total, h, rgb };
}

function edgeFadeFactor(x, w, edgeFade) {
  const ef = clamp(edgeFade, 0, 0.9);
  if (ef <= 0) return 1;
  const t = Math.min(x / (w * ef), (w - x) / (w * ef));
  return clamp01(t);
}

export function init({ root, config, api }) {
  // mount
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let latestSnap = { factions: [] };
  let { h: hTarget, rgb: rgbTarget } = computeBlendAndHype(latestSnap, cfg);

  let hSmooth = 0;
  let rgbSmooth = { r: 140, g: 210, b: 255 };

  const bubbles = []; // {x,y,r,vy,phase,ws,life,t,alpha}
  let spawnCarry = 0;

  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;
    rgbTarget = res.rgb;
  });

  const onResize = () => { /* canvas resizes inside loop */ };
  window.addEventListener('resize', onResize, { passive: true });

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeBlendAndHype(latestSnap, cfg);
    hTarget = res.h;
    rgbTarget = res.rgb;
  }

  function spawnBubbles(dt, w, h, t) {
    const max = Math.max(0, (cfg.bubbleMax | 0));
    if (max <= 0) return;

    const base = clamp(cfg.bubbleSpawnBase, 0, 300);
    const boost = clamp(cfg.bubbleSpawnBoost, 0, 1200);

    const intensity = clamp(cfg.intensity, 0, 2);
    const hype = clamp01(hSmooth) * intensity;

    const rate = base + boost * hype;

    spawnCarry += rate * dt;
    let count = Math.floor(spawnCarry);
    spawnCarry -= count;

    count = Math.min(count, Math.max(1, (cfg.bubbleSpawnCapPerFrame | 0) || 22));

    const sizeMin = clamp(cfg.sizeMin, 2, 400);
    const sizeMax = Math.max(sizeMin, clamp(cfg.sizeMax, sizeMin, 800));

    const riseMin = clamp(cfg.riseSpeedMin, 0, 900);
    const riseMax = Math.max(riseMin, clamp(cfg.riseSpeedMax, riseMin, 2200));

    const aMin = clamp(cfg.alphaMin, 0, 1);
    const aMax = Math.max(aMin, clamp(cfg.alphaMax, aMin, 1));

    // As hype rises: slightly more medium/small bubbles (reads better, less screen-block)
    const smallBias = lerp(0.0, 0.38, hype);

    for (let i = 0; i < count; i++) {
      if (bubbles.length >= max) bubbles.shift();

      const u = Math.random();
      const biased = (u < smallBias) ? Math.random() * Math.random() : Math.random();
      const r = lerp(sizeMin, sizeMax, biased);

      const x = Math.random() * w;
      const y = h + r + Math.random() * (h * 0.15);

      const vy = lerp(riseMin, riseMax, Math.random()) * (0.55 + 0.75 * hype) * (0.9 + 0.25 * Math.random());

      // wobble depends a bit on size
      const phase = Math.random() * Math.PI * 2;
      const ws = (0.6 + Math.random() * 0.9) * clamp(cfg.wobbleSpeed, 0, 3.5);

      // life based on travel distance + speed
      const travel = (h + r * 2) * (0.85 + 0.35 * Math.random());
      const life = Math.max(0.8, travel / Math.max(1, vy));

      bubbles.push({
        x, y, r,
        vy,
        phase,
        ws,
        life,
        t: 0,
        alpha: lerp(aMin, aMax, Math.random()) * (0.7 + 0.6 * hype)
      });
    }
  }

  function stepBubbles(dt, w, h, t) {
    const wobble = clamp(cfg.wobbleStrength, 0, 200);

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.t += dt;

      // rise
      b.y -= b.vy * dt;

      // wobble: sin wave + a little size-based drift
      const wob = Math.sin(b.phase + t * b.ws * Math.PI * 2) * wobble * (0.35 + 0.65 * (b.r / Math.max(1, cfg.sizeMax || 80)));
      b.x += wob * dt;

      // wrap horizontal
      if (b.x < -b.r) b.x = w + b.r;
      if (b.x > w + b.r) b.x = -b.r;

      // kill when offscreen or expired
      if (b.t >= b.life || b.y < -b.r * 2) bubbles.splice(i, 1);
    }
  }

  function drawBubbles(ctx, w, h, t) {
    if (!bubbles.length) return;

    // color bias
    const tr = rgbSmooth.r | 0, tg = rgbSmooth.g | 0, tb = rgbSmooth.b | 0;
    const tint = clamp01(cfg.tintStrength);
    const rimA = clamp01(cfg.rimAlpha);
    const sparkle = clamp01(cfg.sparkleStrength);
    const edgeFade = clamp(cfg.edgeFade, 0, 0.9);

    // Composite: lighter reads “bubbly” without darkening scene
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const b of bubbles) {
      const p = clamp01(b.t / b.life);
      const fade = (1 - p);

      // extra fade near edges
      const ef = edgeFadeFactor(b.x, w, edgeFade);

      const a = b.alpha * fade * ef;
      if (a <= 0.001) continue;

      // Soft body gradient (transparent center, brighter rim)
      const g = ctx.createRadialGradient(b.x - b.r * 0.18, b.y - b.r * 0.18, b.r * 0.12, b.x, b.y, b.r);

      // Base “water” color (slightly cool)
      const baseR = lerp(200, tr, tint) | 0;
      const baseG = lerp(225, tg, tint) | 0;
      const baseB = lerp(255, tb, tint) | 0;

      g.addColorStop(0.00, `rgba(255,255,255,${a * (0.08 + 0.08 * sparkle)})`);
      g.addColorStop(0.35, `rgba(${baseR},${baseG},${baseB},${a * 0.12})`);
      g.addColorStop(0.72, `rgba(${baseR},${baseG},${baseB},${a * 0.18})`);
      g.addColorStop(1.00, `rgba(255,255,255,${a * (0.10 + 0.30 * rimA)})`);

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      // Rim stroke
      ctx.lineWidth = Math.max(1, b.r * 0.045);
      ctx.strokeStyle = `rgba(255,255,255,${a * (0.10 + 0.45 * rimA)})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.985, 0, Math.PI * 2);
      ctx.stroke();

      // Tiny specular highlight
      if (sparkle > 0.01) {
        const hx = b.x - b.r * 0.32;
        const hy = b.y - b.r * 0.38;
        ctx.fillStyle = `rgba(255,255,255,${a * (0.12 + 0.38 * sparkle)})`;
        ctx.beginPath();
        ctx.ellipse(hx, hy, b.r * 0.18, b.r * 0.12, -0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const cap = clamp(cfg.fpsCap, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // Smooth hype
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth);

    // Smooth color
    rgbSmooth.r = lerp(rgbSmooth.r, rgbTarget.r, 1 - Math.exp(-8 * dt));
    rgbSmooth.g = lerp(rgbSmooth.g, rgbTarget.g, 1 - Math.exp(-8 * dt));
    rgbSmooth.b = lerp(rgbSmooth.b, rgbTarget.b, 1 - Math.exp(-8 * dt));

    // Resize + scale mapping
    const { w, h, dpr, scale } = resizeCanvas(canvas, cfg.renderScale);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // draw in scaled CSS px coordinates
    ctx.scale(scale, scale);

    // Clear
    ctx.clearRect(0, 0, w / scale, h / scale);

    const t = nowMs / 1000;

    // Simpler: keep bubble field calm at 0 hype but still alive
    spawnBubbles(dt, w, h, t);
    stepBubbles(dt, w, h, t);
    drawBubbles(ctx, w, h, t);
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    bubbles.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  raf = requestAnimationFrame(loop);
  return { destroy, setConfig };
}
