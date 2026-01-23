// public/overlays/styles/constellationTwinkle.js
// Constellation Twinkle (FREE)
// Contract: export meta + init({ root, config, api })
//
// Goals:
// - Subtle at low hype, spectacular at high hype
// - Total hype = sum(snap.factions[].meter)
// - h = 1 - exp(-total / k) with k configurable
// - Tiered visuals (0..3) + at least 5 distinct changes as hype rises
// - Efficient: single canvas, fixed pools, no DOM churn per update

export const meta = {
  styleKey: "constellationTwinkle",
  name: "Constellation Twinkle",
  tier: "FREE",
  description:
    "Twinkling star constellations that connect with lines, fading and respawning faster as hype rises. Constellations appear in different screen regions; lines connect and shimmer more as hype grows.",

  // Keep existing defaults but add sane hype defaults
  defaultConfig: {
    placement: "edges",
    mixMode: "weighted",
    intensity: 1.0,

    starCount: 12,
    starSize: 1.6,
    starSizeHype: 1.2,
    lineWidth: 1.1,
    glow: 10,

    twinkleSpeed: 1.2,
    twinkleDepth: 0.6,
    drift: 8,
    jitter: 0.12,

    lifeSeconds: 8.0,
    lifeMinSeconds: 2.5,
    respawnBias: 0.9,

    padding: 18,
    bottomHeight: 180,
    edgeThickness: 140,

    // --- new defaults ---
    hypeK: 160,          // reacts by ~50–100, big by ~300–500
    maxTotalClamp: 2000, // safety clamp
    shimmerStrength: 1.0,
    sparkleRate: 1.0,
    sparkleMax: 220,
    chromaticSplit: 0.8, // tier3 "lens/prism" vibe
    pulseStrength: 1.0,  // tier3 screen-wide pulse
  },

  controls: [
    {
      key: "placement",
      label: "Placement",
      type: "select",
      options: [
        { label: "Bottom", value: "bottom" },
        { label: "Edges", value: "edges" },
      ],
      default: "edges",
    },
    {
      key: "mixMode",
      label: "Faction Mix Mode",
      type: "select",
      options: [
        { label: "Weighted Blend", value: "weighted" },
        { label: "Winner Takes Color", value: "winner" },
      ],
      default: "weighted",
    },
    { key: "intensity", label: "Intensity", type: "range", min: 0, max: 2, step: 0.05, default: 1 },

    { key: "starCount", label: "Star Count", type: "range", min: 5, max: 24, step: 1, default: 12 },
    { key: "starSize", label: "Star Size", type: "range", min: 0.6, max: 4.0, step: 0.1, default: 1.6 },
    { key: "starSizeHype", label: "Star Size (Hype Boost)", type: "range", min: 0, max: 3.0, step: 0.1, default: 1.2 },
    { key: "lineWidth", label: "Line Width", type: "range", min: 0.2, max: 3.5, step: 0.1, default: 1.1 },
    { key: "glow", label: "Glow", type: "range", min: 0, max: 24, step: 1, default: 10 },

    { key: "twinkleSpeed", label: "Twinkle Speed", type: "range", min: 0.1, max: 4.0, step: 0.1, default: 1.2 },
    { key: "twinkleDepth", label: "Twinkle Depth", type: "range", min: 0, max: 1.0, step: 0.05, default: 0.6 },
    { key: "drift", label: "Drift", type: "range", min: 0, max: 30, step: 1, default: 8 },
    { key: "jitter", label: "Jitter", type: "range", min: 0, max: 1.5, step: 0.05, default: 0.12 },

    { key: "lifeSeconds", label: "Life (Seconds)", type: "range", min: 2, max: 20, step: 0.5, default: 8 },
    { key: "lifeMinSeconds", label: "Min Life (High Hype)", type: "range", min: 1, max: 10, step: 0.5, default: 2.5 },
    { key: "respawnBias", label: "Respawn Bias", type: "range", min: 0, max: 2, step: 0.05, default: 0.9 },

    { key: "padding", label: "Padding", type: "range", min: 0, max: 60, step: 1, default: 18 },
    { key: "bottomHeight", label: "Bottom Height", type: "range", min: 80, max: 420, step: 10, default: 180 },
    { key: "edgeThickness", label: "Edge Thickness", type: "range", min: 80, max: 360, step: 10, default: 140 },

    // ---- New controls (appended) ----
    { key: "hypeK", label: "Hype Scale (k)", type: "number", min: 40, max: 600, step: 5, default: 160 },
    { key: "maxTotalClamp", label: "Max Total Clamp", type: "number", min: 200, max: 6000, step: 50, default: 2000 },
    { key: "shimmerStrength", label: "Shimmer Strength", type: "range", min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: "sparkleRate", label: "Sparkle Rate", type: "range", min: 0, max: 3, step: 0.05, default: 1.0 },
    { key: "sparkleMax", label: "Max Sparkles", type: "range", min: 0, max: 800, step: 10, default: 220 },
    { key: "chromaticSplit", label: "Chromatic Split", type: "range", min: 0, max: 2, step: 0.05, default: 0.8 },
    { key: "pulseStrength", label: "Pulse Strength", type: "range", min: 0, max: 2, step: 0.05, default: 1.0 },
  ],
};

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function parseHex(hex) {
  const h = String(hex || "").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return { r: 200, g: 220, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToCss({ r, g, b }, a = 1) {
  return `rgba(${Math.round(clamp(r, 0, 255))},${Math.round(clamp(g, 0, 255))},${Math.round(clamp(b, 0, 255))},${clamp(a, 0, 1)})`;
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
  if (sum <= 0) return { r: 200, g: 220, b: 255 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 200, g: 220, b: 255 };
}

function makeRng(seed = 1) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function randBetween(rng, a, b) { return a + (b - a) * rng(); }

function nowMs() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }

function resolveRootAndCanvas(root) {
  // Ensure OBS-safe full-screen canvas inside root
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "999999";
  container.style.transform = "translateZ(0)";
  container.style.willChange = "transform, opacity";

  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  canvas.style.transform = "translateZ(0)";
  canvas.style.willChange = "transform, filter, opacity";

  container.appendChild(canvas);
  root.appendChild(container);
  return { container, canvas };
}

function fitCanvasToDisplay(canvas) {
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2); // cap for perf
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.max(1, Math.floor(rect.width * dpr));
  const targetH = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  return { w: canvas.width, h: canvas.height, dpr };
}

/**
 * Standard utility: computeBlendAndHype(snap)
 * Returns { total, h, rgb, baseColorCss, hotColorCss }
 */
function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  // total hype = sum(meter)
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }

  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 2000, 200, 6000);
  total = clamp(total, 0, maxTotalClamp);

  // blend color
  let rgb;
  if (factions.length) {
    const colors = factions.map(f => parseHex(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === "winner") ? pickWinner(colors, weights) : mixWeighted(colors, weights);
  } else {
    rgb = { r: 200, g: 220, b: 255 };
  }

  // compressing curve: h = 1 - exp(-total/k)
  // defaults tuned for typical total 0..500
  const k = clamp(cfg.hypeK ?? 160, 40, 600);
  let h = 1 - Math.exp(-total / k);

  // keep small hype slightly visible without jumping
  // (tiny “lift” that fades away)
  h = clamp01(h + (1 - h) * 0.08 * Math.min(1, total / 70));

  const baseColorCss = rgbToCss(rgb, 1);
  // hot color leans toward white/cyan at high hype for a “stellar” bloom
  const hotT = smoothstep(0.15, 0.95, h);
  const hotRgb = {
    r: lerp(rgb.r, 255, 0.55 * hotT),
    g: lerp(rgb.g, 255, 0.70 * hotT),
    b: lerp(rgb.b, 255, 0.95 * hotT),
  };
  const hotColorCss = rgbToCss(hotRgb, 1);

  return { total, h, rgb, baseColorCss, hotColorCss };
}

function pickRegionBounds({ w, h, cfg, rng }) {
  const placement = (cfg.placement === "bottom") ? "bottom" : "edges";
  const pad = Math.max(0, Number(cfg.padding) || 0);
  const edgeT = Math.max(40, Number(cfg.edgeThickness) || 140);

  if (placement === "bottom") {
    const bh = Math.max(40, Number(cfg.bottomHeight) || 180);
    return { x0: pad, y0: Math.max(pad, h - bh), x1: w - pad, y1: h - pad };
  }

  // edges: choose a side randomly so constellation appears in different locations
  const side = (rng() * 4) | 0;
  if (side === 0) return { x0: pad, y0: pad, x1: w - pad, y1: Math.min(h - pad, pad + edgeT) }; // top
  if (side === 1) return { x0: Math.max(pad, w - pad - edgeT), y0: pad, x1: w - pad, y1: h - pad }; // right
  if (side === 2) return { x0: pad, y0: Math.max(pad, h - pad - edgeT), x1: w - pad, y1: h - pad }; // bottom
  return { x0: pad, y0: pad, x1: Math.min(w - pad, pad + edgeT), y1: h - pad }; // left
}

function buildConstellation({ w, h, cfg, rng }) {
  const bounds = pickRegionBounds({ w, h, cfg, rng });

  const starCount = clamp((cfg.starCount | 0) || 12, 3, 40);
  const stars = [];

  // pick a center inside bounds
  const cx = randBetween(rng, bounds.x0, bounds.x1);
  const cy = randBetween(rng, bounds.y0, bounds.y1);

  // radius depends on screen size but clamped
  const maxR = Math.max(40, Math.min(w, h) * 0.22);
  const minR = Math.max(18, maxR * 0.35);

  for (let i = 0; i < starCount; i++) {
    const ang = rng() * Math.PI * 2;
    const rr = lerp(minR, maxR, Math.pow(rng(), 0.7));
    let x = cx + Math.cos(ang) * rr;
    let y = cy + Math.sin(ang) * rr;
    x = clamp(x, bounds.x0, bounds.x1);
    y = clamp(y, bounds.y0, bounds.y1);

    stars.push({
      x, y,
      phase: rng() * Math.PI * 2,
      tw: 0.45 + rng() * 0.55,
      dx: (rng() - 0.5) * 2,
      dy: (rng() - 0.5) * 2,
      seed: rng() * 1000,
    });
  }

  // edges: nearest neighbor per star
  const edges = [];
  for (let i = 0; i < stars.length; i++) {
    let bestJ = -1;
    let bestD2 = Infinity;
    for (let j = 0; j < stars.length; j++) {
      if (i === j) continue;
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; bestJ = j; }
    }
    if (bestJ >= 0) edges.push([i, bestJ]);
  }

  // extra random edges
  const extras = Math.max(1, Math.floor(starCount * 0.25));
  for (let k = 0; k < extras; k++) {
    const a = (rng() * starCount) | 0;
    let b = (rng() * starCount) | 0;
    if (b === a) b = (b + 1) % starCount;
    edges.push([a, b]);
  }

  return { stars, edges, bounds };
}

// Fixed sparkle pool (Tier 2+)
function makeSparklePool(max) {
  const arr = new Array(max);
  for (let i = 0; i < max; i++) arr[i] = null;
  return arr;
}

export function init({ root, config, api }) {
  // Clear and mount
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = resolveRootAndCanvas(root);

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let latestSnap = { factions: [] };
  let mixState = computeBlendAndHype(latestSnap, cfg);

  // smoothing
  let hSmooth = 0;
  let colorSmooth = { r: 200, g: 220, b: 255 };

  // constellation state
  let seedBase = ((Math.random() * 1e9) | 0) ^ ((Date.now() / 1000) | 0);
  let rng = makeRng(seedBase);

  let size = fitCanvasToDisplay(canvas);
  let w = size.w, h = size.h, dpr = size.dpr;

  let constellation = buildConstellation({ w, h, cfg, rng });
  let born = nowMs();

  // sparkle pool
  let sparkleMax = clamp(cfg.sparkleMax ?? 220, 0, 800) | 0;
  let sparkles = makeSparklePool(sparkleMax);
  let sparkleHead = 0;

  function resetSparklesIfNeeded() {
    const nextMax = clamp(cfg.sparkleMax ?? 220, 0, 800) | 0;
    if (nextMax !== sparkleMax) {
      sparkleMax = nextMax;
      sparkles = makeSparklePool(sparkleMax);
      sparkleHead = 0;
    }
  }

  function getLifeMs(h01) {
    const base = Math.max(0.5, Number(cfg.lifeSeconds) || 8);
    const minL = Math.max(0.5, Number(cfg.lifeMinSeconds) || 2.5);
    const bias = clamp01(Number(cfg.respawnBias) || 1);
    const l = lerp(base, minL, clamp01(h01 * bias));
    return l * 1000;
  }

  function respawn() {
    seedBase = (seedBase + 1337) ^ ((Math.random() * 1e9) | 0);
    rng = makeRng(seedBase);
    size = fitCanvasToDisplay(canvas);
    w = size.w; h = size.h; dpr = size.dpr;
    constellation = buildConstellation({ w, h, cfg, rng });
    born = nowMs();
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
  }

  // Tier 3 pulse
  let pulse = 0;
  let pulseVel = 0;
  let pulseCooldown = 0;

  function kickPulse(amount) { pulseVel += amount; }

  // Sparkle spawn (Tier 2+)
  function spawnSparkle(x, y, rgb, h01) {
    if (!sparkleMax) return;
    const life = lerp(0.35, 1.05, h01) * (0.75 + 0.6 * rng());
    const size = lerp(0.8, 2.2, h01) * (0.7 + 0.8 * rng());
    const vx = (rng() - 0.5) * lerp(18, 90, h01);
    const vy = (rng() - 0.5) * lerp(18, 90, h01);

    sparkles[sparkleHead] = {
      x, y, vx, vy,
      life,
      age: 0,
      size,
      r: clamp(rgb.r + lerp(25, 80, h01), 0, 255),
      g: clamp(rgb.g + lerp(25, 80, h01), 0, 255),
      b: clamp(rgb.b + lerp(35, 110, h01), 0, 255),
    };
    sparkleHead = (sparkleHead + 1) % sparkleMax;
  }

  // Subscribe to meters (contract: api.onMeters)
  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    mixState = computeBlendAndHype(latestSnap, cfg);
  });

  // Resize safety
  const onResize = () => { size = fitCanvasToDisplay(canvas); w = size.w; h = size.h; dpr = size.dpr; };
  window.addEventListener("resize", onResize, { passive: true });

  let raf = 0;
  let lastTs = 0;

  function draw(ts) {
    raf = requestAnimationFrame(draw);
    const dt = Math.min(0.033, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;

    resetSparklesIfNeeded();

    // Fit to display
    size = fitCanvasToDisplay(canvas);
    w = size.w; h = size.h; dpr = size.dpr;

    const { total, h: hTarget, rgb, baseColorCss, hotColorCss } = mixState;

    // Smooth
    const s = 1 - Math.pow(0.0001, dt);
    hSmooth = lerp(hSmooth, hTarget, 0.10 + 0.25 * s);
    colorSmooth.r = lerp(colorSmooth.r, rgb.r, 0.08 + 0.22 * s);
    colorSmooth.g = lerp(colorSmooth.g, rgb.g, 0.08 + 0.22 * s);
    colorSmooth.b = lerp(colorSmooth.b, rgb.b, 0.08 + 0.22 * s);

    // Tier logic
    const tier = (hSmooth >= 0.70) ? 3 : (hSmooth >= 0.35) ? 2 : (hSmooth >= 0.10) ? 1 : 0;

    // Distinct changes with hype:
    // 1) star size (and "bloom")
    // 2) line width
    // 3) glow blur
    // 4) twinkle speed
    // 5) complexity: extra connections + sparkles + shimmer + pulse + chromatic split

    const intensity = clamp(Number(cfg.intensity) || 1, 0, 2);

    const twSpeedBase = Math.max(0.05, Number(cfg.twinkleSpeed) || 1);
    const twSpeed = twSpeedBase * lerp(0.75, 2.6, Math.pow(hSmooth, 1.05)) * lerp(0.8, 1.35, intensity / 2);

    const twDepth = clamp01(Number(cfg.twinkleDepth) ?? 0.6);

    const baseStar = Math.max(0.1, Number(cfg.starSize) || 1.6);
    const hypeStar = Math.max(0, Number(cfg.starSizeHype) || 1.2);
    const starR = (baseStar + hypeStar * hSmooth) * lerp(0.85, 1.35, intensity / 2);

    const lwBase = Math.max(0.1, Number(cfg.lineWidth) || 1.1);
    const lw = lwBase * lerp(0.7, 1.85, smoothstep(0.10, 1.0, hSmooth)) * lerp(0.85, 1.25, intensity / 2);

    const glowBase = Math.max(0, Number(cfg.glow) || 10);
    const glow = clamp(glowBase * lerp(0.6, 2.2, Math.pow(hSmooth, 1.2)) * lerp(0.8, 1.35, intensity / 2), 0, 34);

    const driftBase = Math.max(0, Number(cfg.drift) || 0);
    const drift = driftBase * (0.35 + 1.15 * hSmooth);
    const jitter = Math.max(0, Number(cfg.jitter) || 0.12);

    // Life / respawn faster with hype
    const lifeMs = getLifeMs(hSmooth);
    const age = nowMs() - born;
    const p = clamp01(age / lifeMs);
    const fadeIn = clamp01(p / 0.12);
    const fadeOut = clamp01((1 - p) / 0.22);
    const lifeAlpha = Math.min(1, fadeIn, fadeOut);

    // Keep low hype "boring"
    container.style.opacity = tier === 0 ? "0.75" : "1.0";

    // Optional slight camera float at high hype (transform only)
    if (tier >= 2) {
      const floatAmt = lerp(0.0, 6.0, smoothstep(0.35, 1.0, hSmooth)) * intensity;
      const fx = Math.sin(ts * 0.0008) * floatAmt;
      const fy = Math.cos(ts * 0.0006) * floatAmt * 0.65;
      container.style.transform = `translate3d(${fx.toFixed(2)}px,${fy.toFixed(2)}px,0)`;
    } else {
      container.style.transform = "translateZ(0)";
    }

    // Clear and scale to CSS pixels
    clear();
    ctx.save();
    ctx.scale(1, 1); // we're already in backing pixels; draw in backing coords

    // Helpers for deterministic (no per-frame Math.random jitter spikes)
    function wiggle(i, t, amp) {
      // cheap pseudo-noise based on sin (stable across frames)
      return Math.sin(t * 0.9 + i * 12.345 + (constellation.stars[i]?.seed || 0)) * amp;
    }

    // Build shimmer/composite settings
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = glow;
    ctx.shadowColor = rgbToCss(colorSmooth, 0.85);

    // Base alpha scales with hype and life
    const alphaBase = lifeAlpha * lerp(0.20, 0.95, smoothstep(0.0, 1.0, hSmooth)) * lerp(0.7, 1.25, intensity / 2);

    // Region wander (constellation "moves" more at higher hype but stays in bounds)
    const b = constellation.bounds;
    const wander = (tier >= 1) ? lerp(0.0, 22.0, smoothstep(0.10, 1.0, hSmooth)) * intensity : 0;
    const wx = Math.sin(ts * 0.0005 + seedBase * 0.001) * wander;
    const wy = Math.cos(ts * 0.0006 + seedBase * 0.001) * wander * 0.7;

    // LINE LAYER
    // Tier-based line intensity + additional "ghost" layer at tier 2+
    const lineAlpha = alphaBase * lerp(0.16, 0.50, smoothstep(0.10, 1.0, hSmooth));
    const lineAlphaTier = (tier === 0) ? lineAlpha * 0.7 : (tier === 1) ? lineAlpha : (tier === 2) ? lineAlpha * 1.12 : lineAlpha * 1.22;

    ctx.lineWidth = lw;
    ctx.strokeStyle = rgbToCss(colorSmooth, clamp01(lineAlphaTier));
    ctx.beginPath();

    const tSec = (ts / 1000) * twSpeed;
    for (let e = 0; e < constellation.edges.length; e++) {
      const [ai, bi] = constellation.edges[e];
      const A = constellation.stars[ai];
      const B = constellation.stars[bi];
      if (!A || !B) continue;

      // drift peaks mid-life for a "breathing" feel
      const dd = drift * (0.5 - Math.abs(0.5 - p));
      const ax = A.x + wx + A.dx * dd + wiggle(ai, tSec, jitter);
      const ay = A.y + wy + A.dy * dd + wiggle(ai + 7, tSec, jitter);
      const bx = B.x + wx + B.dx * dd + wiggle(bi, tSec, jitter);
      const by = B.y + wy + B.dy * dd + wiggle(bi + 7, tSec, jitter);

      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();

    // Tier 2+ "shimmering" second line pass
    if (tier >= 2 && (cfg.shimmerStrength ?? 1) > 0) {
      const shimmerStrength = clamp(Number(cfg.shimmerStrength) || 1, 0, 2);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = glow * 1.35;
      ctx.lineWidth = lw * lerp(0.9, 1.6, hSmooth);
      const shimmerA = clamp01(alphaBase * 0.18 * shimmerStrength * (0.6 + 0.6 * Math.sin(tSec * 2.2)));
      ctx.strokeStyle = rgbToCss({ r: 255, g: 255, b: 255 }, shimmerA);
      ctx.beginPath();

      // only draw a subset for perf + style
      const step = tier === 2 ? 2 : 1;
      for (let e = 0; e < constellation.edges.length; e += step) {
        const [ai, bi] = constellation.edges[e];
        const A = constellation.stars[ai];
        const B = constellation.stars[bi];
        if (!A || !B) continue;

        const dd = drift * (0.5 - Math.abs(0.5 - p));
        const ax = A.x + wx + A.dx * dd + wiggle(ai, tSec * 1.2, jitter);
        const ay = A.y + wy + A.dy * dd + wiggle(ai + 7, tSec * 1.2, jitter);
        const bx = B.x + wx + B.dx * dd + wiggle(bi, tSec * 1.2, jitter);
        const by = B.y + wy + B.dy * dd + wiggle(bi + 7, tSec * 1.2, jitter);

        // shimmer waves: small perpendicular offset
        const ox = Math.sin(tSec * 3.0 + e) * 2.2 * shimmerStrength;
        const oy = Math.cos(tSec * 2.8 + e) * 2.2 * shimmerStrength;

        ctx.moveTo(ax + ox, ay + oy);
        ctx.lineTo(bx + ox, by + oy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // STAR LAYER
    for (let i = 0; i < constellation.stars.length; i++) {
      const S = constellation.stars[i];
      const tw = 0.5 + 0.5 * Math.sin(tSec * 2 * Math.PI + S.phase);
      const bright = lerp(1 - twDepth, 1, tw) * S.tw;

      const dd = drift * (0.5 - Math.abs(0.5 - p));
      const x = S.x + wx + S.dx * dd + wiggle(i, tSec, jitter);
      const y = S.y + wy + S.dy * dd + wiggle(i + 11, tSec, jitter);

      // Tier-based twinkle punch + alpha
      const twPunch = (tier === 0) ? 0.85 : (tier === 1) ? 1.0 : (tier === 2) ? 1.18 : 1.28;
      const a = clamp01(alphaBase * bright * twPunch);

      // outer glow star
      ctx.shadowBlur = glow * lerp(0.95, 1.35, bright);
      ctx.fillStyle = rgbToCss(colorSmooth, a * 0.92);
      ctx.beginPath();
      ctx.arc(x, y, starR * (0.85 + bright * 0.9), 0, Math.PI * 2);
      ctx.fill();

      // inner white core
      ctx.shadowBlur = glow * 1.25;
      ctx.fillStyle = rgbToCss({ r: 255, g: 255, b: 255 }, a * lerp(0.30, 0.75, hSmooth));
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.6, starR * 0.32), 0, Math.PI * 2);
      ctx.fill();

      // Tier 2+: occasional sparkle emission near brightest twinkles
      if (tier >= 2 && (cfg.sparkleRate ?? 1) > 0) {
        const sparkleRate = clamp(Number(cfg.sparkleRate) || 1, 0, 3);
        const chance = lerp(0.02, 0.18, smoothstep(0.35, 1.0, hSmooth)) * sparkleRate;
        if (bright > 0.9 && rng() < chance * dt * 60) {
          spawnSparkle(x, y, colorSmooth, hSmooth);
        }
      }
    }

    // SPARKLES (Tier 2+)
    if (tier >= 2 && sparkleMax > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const blur = clamp(lerp(0.5, 3.0, hSmooth), 0, 4);
      ctx.shadowBlur = glow * 0.9;
      ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";

      for (let i = 0; i < sparkles.length; i++) {
        const p = sparkles[i];
        if (!p) continue;
        p.age += dt;
        if (p.age >= p.life) { sparkles[i] = null; continue; }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= (1 - 0.8 * dt);
        p.vy *= (1 - 0.8 * dt);

        const t = p.age / p.life;
        const fade = (1 - t) * (1 - t);
        const a = clamp01(alphaBase * 0.55 * fade);
        const rr = p.size * (0.8 + 0.6 * (1 - t));

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 4.0);
        grad.addColorStop(0.0, `rgba(${p.r | 0},${p.g | 0},${p.b | 0},${a})`);
        grad.addColorStop(0.35, `rgba(255,255,255,${a * 0.35})`);
        grad.addColorStop(1.0, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr * 4.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.filter = "none";
    }

    // TIER 3: pulse + chromatic split (spectacle)
    if (tier === 3) {
      pulseCooldown = Math.max(0, pulseCooldown - dt);

      if (pulseCooldown <= 0 && rng() < lerp(0.06, 0.22, smoothstep(0.70, 1.0, hSmooth)) * dt * 60) {
        const pulseStr = clamp(Number(cfg.pulseStrength) || 1, 0, 2);
        kickPulse(lerp(0.35, 0.95, hSmooth) * pulseStr);
        pulseCooldown = lerp(0.35, 0.16, hSmooth);
      }

      pulseVel *= Math.pow(0.22, dt);
      pulse = clamp01(pulse + pulseVel * dt);
      pulseVel -= pulse * lerp(2.2, 5.0, hSmooth) * dt;

      // Screen-wide bloom pulse
      if (pulse > 0.001) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = glow * 1.8;
        ctx.filter = `blur(${clamp(lerp(8, 26, hSmooth), 6, 28)}px)`;
        const pA = clamp01(alphaBase * 0.22 * pulse);
        const grad = ctx.createRadialGradient(
          (constellation.bounds.x0 + constellation.bounds.x1) / 2 + wx,
          (constellation.bounds.y0 + constellation.bounds.y1) / 2 + wy,
          0,
          (constellation.bounds.x0 + constellation.bounds.x1) / 2 + wx,
          (constellation.bounds.y0 + constellation.bounds.y1) / 2 + wy,
          Math.max(w, h) * 0.35
        );
        grad.addColorStop(0.0, rgbToCss({ r: 255, g: 255, b: 255 }, pA));
        grad.addColorStop(0.35, rgbToCss(colorSmooth, pA * 0.55));
        grad.addColorStop(1.0, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        ctx.filter = "none";
      }

      // Chromatic split: tiny offsets of the whole constellation region for prism vibe
      const cs = clamp(Number(cfg.chromaticSplit) || 0.8, 0, 2) * smoothstep(0.70, 1.0, hSmooth);
      if (cs > 0.001) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.filter = "none";

        const ox = Math.sin(ts * 0.002) * (cs * 3.0);
        const oy = Math.cos(ts * 0.0017) * (cs * 2.2);

        // draw three faint tinted copies (cheap and effective)
        ctx.globalAlpha = clamp01(alphaBase * 0.08);
        ctx.fillStyle = "rgba(255,80,120,0.22)";
        ctx.fillRect(constellation.bounds.x0 + wx + ox, constellation.bounds.y0 + wy + oy, 1, 1); // no-op "touch" to keep consistent
        ctx.drawImage(canvas, -ox * 0.35, 0); // subtle reuse (fast on most GPUs)

        ctx.globalAlpha = clamp01(alphaBase * 0.07);
        ctx.drawImage(canvas, ox * 0.25, -oy * 0.25);

        ctx.globalAlpha = clamp01(alphaBase * 0.06);
        ctx.drawImage(canvas, -ox * 0.18, oy * 0.22);

        ctx.restore();
      }
    } else {
      pulse = 0;
      pulseVel = 0;
      pulseCooldown = 0;
    }

    ctx.restore();

    // Respawn constellation when life ends (appears in new location)
    if (age >= lifeMs) respawn();
  }

  raf = requestAnimationFrame(draw);

  // Expose optional cleanup + config update (overlayClient may ignore, but safe)
  return {
    destroy() {
      try { unsub?.(); } catch {}
      try { cancelAnimationFrame(raf); } catch {}
      try { window.removeEventListener("resize", onResize); } catch {}
      try { clear(); } catch {}
    },
    setConfig(next) {
      cfg = { ...cfg, ...(next || {}) };
      // rebuild with new placement/starCount/etc so users see immediate effect
      respawn();
      // recompute blend/hype with new k/clamps/mix mode
      mixState = computeBlendAndHype(latestSnap, cfg);
    },
  };
}
