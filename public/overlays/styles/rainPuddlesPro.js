// public/overlays/styles/rainPuddlesPro.js
// Rain Puddles (PRO)
// - Multiple small reflective puddles + dynamic rain
// - Rain intensity/speed responds strongly to hype (primary dynamic element)
// - Puddles shimmer + ripple when raindrops “hit”
// - placement: bottom|edges, mixMode: weighted|winner, intensity: 0..2
// - Defensive canvas resolution (works even if {canvas} isn't passed)
//
// Contract: export meta + init({ canvas, app, config }) -> { destroy(), setConfig(next) }

export const meta = {
  styleKey: "rainPuddlesPro",
  name: "Rain Puddles (PRO)",
  tier: "PRO",
  description:
    "Several small puddles with reflective shimmer while dynamic rain intensifies with hype. Raindrops create ripples when they hit puddles. PRO tier.",
  defaultConfig: {
    placement: "bottom",     // "bottom" | "edges"
    mixMode: "weighted",     // "weighted" | "winner"
    intensity: 1.0,          // 0..2

    // Region / layout
    padding: 22,
    bottomHeight: 260,
    edgeInset: 50,

    // Puddles
    puddleCount: 5,
    puddleMinSize: 90,
    puddleMaxSize: 190,
    puddleAlpha: 0.22,
    edgeSoftness: 26,
    puddleDrift: 6,          // px slow drift for life
    puddleRespawnSeconds: 18, // 0 disables respawn
    puddleRespawnMinSeconds: 8, // min at high hype

    // Puddle surface
    shimmer: 0.42,
    shimmerSpeed: 1.15,
    glow: 10,
    rippleSpeed: 0.7,
    rippleStrength: 0.45,
    hypeRippleBoost: 1.2,
    rippleScale: 0.06,
    rippleBands: 3,

    // Rain (dynamic portion)
    rainRate: 140,           // drops per second (base)
    rainRateBoost: 380,      // extra drops/sec at high hype
    rainSpeed: 820,          // px/sec base fall
    rainSpeedBoost: 520,     // extra px/sec at high hype
    rainLength: 14,          // px streak length
    rainThickness: 1.3,      // px
    rainAlpha: 0.18,         // base opacity
    rainGlow: 0,             // 0..20 optional glow
    wind: 0.10,              // -1..1 horizontal drift factor
    windGust: 0.22,          // 0..1 gustiness (time-varying wind)

    // Splash / ripple events when rain hits puddles
    splashChance: 0.55,      // 0..1 probability a puddle hit spawns a ripple
    rippleLife: 1.25,        // seconds
    rippleWidth: 1.4,        // px
    rippleMaxRadiusFactor: 0.42, // fraction of puddle radius
    rippleAlpha: 0.28,       // overall ripple opacity
    maxRipples: 60           // cap for performance
  },
  controls: [
    {
      key: "placement",
      label: "Placement",
      type: "select",
      options: [
        { label: "Bottom", value: "bottom" },
        { label: "Edges", value: "edges" }
      ],
      default: "bottom"
    },
    {
      key: "mixMode",
      label: "Faction Mix Mode",
      type: "select",
      options: [
        { label: "Weighted Blend", value: "weighted" },
        { label: "Winner Takes Color", value: "winner" }
      ],
      default: "weighted"
    },
    { key: "intensity", label: "Intensity", type: "range", min: 0, max: 2, step: 0.05, default: 1 },

    { key: "padding", label: "Padding", type: "range", min: 0, max: 140, step: 1, default: 22 },
    { key: "bottomHeight", label: "Bottom Height", type: "range", min: 140, max: 620, step: 10, default: 260 },
    { key: "edgeInset", label: "Edge Inset", type: "range", min: 0, max: 260, step: 5, default: 50 },

    { key: "puddleCount", label: "Puddle Count", type: "range", min: 2, max: 10, step: 1, default: 5 },
    { key: "puddleMinSize", label: "Min Puddle Size", type: "range", min: 60, max: 260, step: 10, default: 90 },
    { key: "puddleMaxSize", label: "Max Puddle Size", type: "range", min: 80, max: 360, step: 10, default: 190 },
    { key: "puddleAlpha", label: "Puddle Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: "edgeSoftness", label: "Edge Softness", type: "range", min: 6, max: 90, step: 1, default: 26 },
    { key: "puddleDrift", label: "Puddle Drift", type: "range", min: 0, max: 40, step: 1, default: 6 },

    { key: "puddleRespawnSeconds", label: "Puddle Respawn (Seconds)", type: "range", min: 0, max: 60, step: 1, default: 18 },
    { key: "puddleRespawnMinSeconds", label: "Min Respawn (High Hype)", type: "range", min: 0, max: 30, step: 1, default: 8 },

    { key: "shimmer", label: "Shimmer", type: "range", min: 0, max: 1, step: 0.02, default: 0.42 },
    { key: "shimmerSpeed", label: "Shimmer Speed", type: "range", min: 0, max: 4, step: 0.05, default: 1.15 },
    { key: "glow", label: "Glow", type: "range", min: 0, max: 30, step: 1, default: 10 },

    { key: "rippleSpeed", label: "Ripple Speed", type: "range", min: 0, max: 3, step: 0.05, default: 0.7 },
    { key: "rippleStrength", label: "Ripple Strength", type: "range", min: 0, max: 1.5, step: 0.05, default: 0.45 },
    { key: "hypeRippleBoost", label: "Hype Ripple Boost", type: "range", min: 0, max: 2.5, step: 0.05, default: 1.2 },
    { key: "rippleScale", label: "Ripple Scale", type: "range", min: 0.02, max: 0.15, step: 0.005, default: 0.06 },
    { key: "rippleBands", label: "Ripple Bands", type: "range", min: 1, max: 6, step: 1, default: 3 },

    { key: "rainRate", label: "Rain Rate", type: "range", min: 0, max: 800, step: 10, default: 140 },
    { key: "rainRateBoost", label: "Rain Rate Boost (Hype)", type: "range", min: 0, max: 1200, step: 20, default: 380 },
    { key: "rainSpeed", label: "Rain Speed", type: "range", min: 100, max: 2000, step: 20, default: 820 },
    { key: "rainSpeedBoost", label: "Rain Speed Boost (Hype)", type: "range", min: 0, max: 1500, step: 20, default: 520 },
    { key: "rainLength", label: "Rain Length", type: "range", min: 4, max: 50, step: 1, default: 14 },
    { key: "rainThickness", label: "Rain Thickness", type: "range", min: 0.5, max: 4, step: 0.1, default: 1.3 },
    { key: "rainAlpha", label: "Rain Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.18 },
    { key: "rainGlow", label: "Rain Glow", type: "range", min: 0, max: 20, step: 1, default: 0 },

    { key: "wind", label: "Wind", type: "range", min: -1, max: 1, step: 0.02, default: 0.10 },
    { key: "windGust", label: "Wind Gust", type: "range", min: 0, max: 1, step: 0.02, default: 0.22 },

    { key: "splashChance", label: "Splash Chance", type: "range", min: 0, max: 1, step: 0.02, default: 0.55 },
    { key: "rippleLife", label: "Ripple Life", type: "range", min: 0.2, max: 3, step: 0.05, default: 1.25 },
    { key: "rippleWidth", label: "Ripple Width", type: "range", min: 0.5, max: 6, step: 0.1, default: 1.4 },
    { key: "rippleMaxRadiusFactor", label: "Max Ripple Radius", type: "range", min: 0.1, max: 0.9, step: 0.02, default: 0.42 },
    { key: "rippleAlpha", label: "Ripple Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.28 },
    { key: "maxRipples", label: "Max Ripples", type: "range", min: 0, max: 200, step: 5, default: 60 }
  ]
};

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function parseHex(hex) {
  const h = String(hex || "").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return { r: 120, g: 170, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToCss({ r, g, b }, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }

function mixWeighted(colors, weights) {
  let sum = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < colors.length; i++) {
    const w = Math.max(0, weights[i] ?? 0);
    sum += w;
    r += colors[i].r * w;
    g += colors[i].g * w;
    b += colors[i].b * w;
  }
  if (sum <= 0) return { r: 120, g: 170, b: 255 };
  return { r: r / sum, g: g / sum, b: b / sum };
}
function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 120, g: 170, b: 255 };
}

function normalizeMeters(metersLike) {
  const out = { factions: [], total: 0 };
  if (!metersLike) return out;

  const arr =
    Array.isArray(metersLike) ? metersLike
      : Array.isArray(metersLike.factions) ? metersLike.factions
      : Array.isArray(metersLike.meters) ? metersLike.meters
      : null;

  if (arr) {
    for (const it of arr) {
      const key = it?.key ?? it?.factionKey ?? it?.id ?? "";
      const value = Number(it?.value ?? it?.meter ?? it?.hype ?? 0) || 0;
      const colorHex = it?.colorHex ?? it?.color ?? it?.hex ?? "#78AAFF";
      out.factions.push({ key, value, colorHex });
      out.total += Math.max(0, value);
    }
    return out;
  }

  if (typeof metersLike === "object") {
    for (const [key, v] of Object.entries(metersLike)) {
      if (!v || typeof v !== "object") continue;
      const value = Number(v.value ?? v.meter ?? v.hype ?? 0) || 0;
      const colorHex = v.colorHex ?? v.color ?? v.hex ?? "#78AAFF";
      out.factions.push({ key, value, colorHex });
      out.total += Math.max(0, value);
    }
  }

  if (typeof metersLike.totalHype === "number") out.total = metersLike.totalHype;
  if (typeof metersLike.total === "number") out.total = metersLike.total;

  return out;
}

function computeMixColor(metersState, mixMode) {
  const factions = metersState.factions || [];
  const colors = factions.map((f) => parseHex(f.colorHex));
  const weights = factions.map((f) => Math.max(0, Number(f.value) || 0));
  if (!colors.length) return { r: 120, g: 170, b: 255 };
  return mixMode === "winner" ? pickWinner(colors, weights) : mixWeighted(colors, weights);
}

function computeHype01(total) {
  const t = Math.max(0, Number(total) || 0);
  return clamp01(1 - Math.exp(-t / 30));
}

// Defensive canvas helpers
function resolveCanvas(maybeCanvas) {
  if (maybeCanvas && typeof maybeCanvas.getContext === "function") return maybeCanvas;

  const byId =
    document.getElementById("overlayCanvas") ||
    document.querySelector("#overlayRoot canvas") ||
    document.querySelector("canvas");

  if (byId && typeof byId.getContext === "function") return byId;

  const root = document.getElementById("overlayRoot");
  if (root) {
    const c = document.createElement("canvas");
    c.id = "overlayCanvas";
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.display = "block";
    root.appendChild(c);
    return c;
  }
  return null;
}

function fitCanvasToDisplay(canvas) {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.max(1, Math.floor(rect.width * dpr));
  const targetH = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  return { w: canvas.width, h: canvas.height, dpr };
}

// Puddle mask and ripple field
function puddleMask(dx, dy, radius, softness) {
  const r = Math.sqrt(dx * dx + dy * dy);
  const edge0 = radius;
  const edge1 = radius + Math.max(1, softness);
  const t = clamp01((edge1 - r) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function rippleField(nx, ny, t, scale, bands) {
  let v = 0;
  for (let i = 1; i <= bands; i++) {
    const f = scale * i * 18;
    v += Math.sin((nx * f + ny * f * 0.9) + t * (1.2 + i * 0.35) + i * 3.1);
  }
  return v / Math.max(1, bands);
}

// Region bounds for puddle placement
function getRegionBounds(w, h, cfg) {
  const pad = Math.max(0, Number(cfg.padding) || 0);
  const placement = cfg.placement === "edges" ? "edges" : "bottom";

  if (placement === "bottom") {
    const bh = Math.max(80, Number(cfg.bottomHeight) || 260);
    return { x0: pad, y0: Math.max(pad, h - bh), x1: w - pad, y1: h - pad };
  }

  const inset = Math.max(0, Number(cfg.edgeInset) || 50);
  return { x0: inset + pad, y0: inset + pad, x1: w - inset - pad, y1: h - inset - pad };
}

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

// Create puddles (positions + size) and keep them separated a bit
function buildPuddles(w, h, cfg, hype01) {
  const bounds = getRegionBounds(w, h, cfg);

  const count = Math.max(1, Math.min(12, Number(cfg.puddleCount) || 5));
  const minSize = Math.max(50, Number(cfg.puddleMinSize) || 90);
  const maxSize = Math.max(minSize, Number(cfg.puddleMaxSize) || 190);

  const puddles = [];
  const tries = 220;

  for (let i = 0; i < count; i++) {
    let placed = false;

    for (let t = 0; t < tries; t++) {
      const size = randRange(minSize, maxSize) * (1 + 0.04 * hype01);
      const r = size / 2;

      const x = randRange(bounds.x0 + r, bounds.x1 - r);
      const y = randRange(bounds.y0 + r, bounds.y1 - r);

      // separation check
      let ok = true;
      for (const p of puddles) {
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (r + p.r) * 0.75) { ok = false; break; }
      }
      if (!ok) continue;

      puddles.push({
        x, y,
        baseX: x, baseY: y,
        r,
        wobbleSeed: Math.random() * Math.PI * 2,
        shimmerSeed: Math.random() * Math.PI * 2
      });
      placed = true;
      break;
    }

    if (!placed) {
      // fallback: place anyway
      const size = randRange(minSize, maxSize);
      const r = size / 2;
      const x = randRange(bounds.x0 + r, bounds.x1 - r);
      const y = randRange(bounds.y0 + r, bounds.y1 - r);
      puddles.push({ x, y, baseX: x, baseY: y, r, wobbleSeed: Math.random() * Math.PI * 2, shimmerSeed: Math.random() * Math.PI * 2 });
    }
  }

  return puddles;
}

export function init({ canvas, app, config } = {}) {
  const resolvedCanvas = resolveCanvas(canvas);
  if (!resolvedCanvas) return { destroy() {}, setConfig() {} };

  const ctx = resolvedCanvas.getContext("2d");
  if (!ctx) return { destroy() {}, setConfig() {} };

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let metersState = normalizeMeters(app?.getState?.()?.meters || app?.getState?.() || null);
  const onMeters = (payload) => {
    const m = payload?.meters ?? payload;
    metersState = normalizeMeters(m);
  };

  const unsub = [];
  try {
    if (app?.on) {
      app.on("meters", onMeters);
      unsub.push(() => app.off?.("meters", onMeters));
    }
  } catch (_) {}

  let raf = 0;
  let isDestroyed = false;

  let w = 0, h = 0;

  // State: puddles, rain particles, ripples
  let puddles = [];
  let lastPuddleRebuild = 0;

  const rain = [];
  let rainCarry = 0;

  const ripples = [];

  function rebuildPuddles(hype01) {
    const fit = fitCanvasToDisplay(resolvedCanvas);
    w = fit.w; h = fit.h;
    puddles = buildPuddles(w, h, cfg, hype01);
    lastPuddleRebuild = (typeof performance !== "undefined" ? performance.now() : Date.now());
  }

  function maybeAutoRespawnPuddles(tms, hype01) {
    const base = Math.max(0, Number(cfg.puddleRespawnSeconds) || 0);
    if (base <= 0) return;

    const minS = Math.max(0, Number(cfg.puddleRespawnMinSeconds) || 0);
    const target = lerp(base, (minS > 0 ? minS : base), clamp01(hype01));
    if (tms - lastPuddleRebuild >= target * 1000) rebuildPuddles(hype01);
  }

  function clear() { ctx.clearRect(0, 0, w, h); }

  // Spawn rain drops across full screen, but prioritize the region that contains puddles
  function spawnRain(dt, hype01, intensity) {
    const baseRate = Math.max(0, Number(cfg.rainRate) || 0);
    const boost = Math.max(0, Number(cfg.rainRateBoost) || 0);
    const rate = (baseRate + boost * hype01) * lerp(0.7, 1.35, intensity / 2);

    rainCarry += rate * dt;
    const toSpawn = Math.min(2000, Math.floor(rainCarry));
    rainCarry -= toSpawn;

    if (toSpawn <= 0) return;

    for (let i = 0; i < toSpawn; i++) {
      const x = Math.random() * w;
      const y = -20 - Math.random() * 120;

      // speed and wind
      const spBase = Math.max(50, Number(cfg.rainSpeed) || 820);
      const spBoost = Math.max(0, Number(cfg.rainSpeedBoost) || 520);
      const vy = (spBase + spBoost * hype01) * (0.85 + Math.random() * 0.35);

      const wind = Number(cfg.wind) || 0;
      const gust = clamp01(Number(cfg.windGust) || 0.22);
      const wx = (wind + gust * Math.sin((Date.now() / 1000) * 0.9 + i * 0.03)) * vy * 0.12;

      rain.push({
        x, y,
        vx: wx,
        vy,
        life: 0.9 + Math.random() * 0.7
      });
    }
  }

  function updateRain(dt) {
    for (let i = rain.length - 1; i >= 0; i--) {
      const d = rain[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      if (d.y > h + 40 || d.x < -60 || d.x > w + 60 || d.life <= 0) {
        rain.splice(i, 1);
      }
    }

    // cap for perf
    const cap = 2600;
    if (rain.length > cap) rain.splice(0, rain.length - cap);
  }

  // Check for rain hits on puddles; spawn ripples primarily (dynamic interaction)
  function handleRainHits(dt, hype01, mix, intensity) {
    const splashChance = clamp01(Number(cfg.splashChance) || 0.55);
    const maxRipples = Math.max(0, Number(cfg.maxRipples) || 60);

    // To keep perf, sample only a subset each frame when many drops
    const sampleCount = Math.min(rain.length, 280);
    for (let s = 0; s < sampleCount; s++) {
      const d = rain[(Math.random() * rain.length) | 0];
      if (!d) continue;

      // only consider near the bottom half where puddles likely exist (micro-opt)
      if (d.y < h * 0.25) continue;

      for (let pi = 0; pi < puddles.length; pi++) {
        const p = puddles[pi];
        const dx = d.x - p.x;
        const dy = d.y - p.y;
        const rr = p.r;

        // if inside puddle
        if ((dx * dx + dy * dy) <= rr * rr) {
          if (Math.random() <= splashChance) {
            if (ripples.length < maxRipples) {
              const life = Math.max(0.15, Number(cfg.rippleLife) || 1.25);
              ripples.push({
                x: p.x + dx * 0.35,
                y: p.y + dy * 0.35,
                r0: Math.max(1, rr * 0.05),
                t: 0,
                life,
                maxR: rr * Math.max(0.1, Number(cfg.rippleMaxRadiusFactor) || 0.42),
                alpha: clamp01(Number(cfg.rippleAlpha) || 0.28) * (0.65 + hype01 * 0.7) * intensity,
                width: Math.max(0.5, Number(cfg.rippleWidth) || 1.4),
                // slight color variation: mix + white
                col: mix
              });
            }
          }
          break;
        }
      }
    }

    // update ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.t += dt;
      if (r.t >= r.life) ripples.splice(i, 1);
    }
  }

  // Draw puddles (base + shimmer + subtle surface noise)
  function drawPuddles(tms, hype01, mix, intensity) {
    const time = tms / 1000;

    const alpha = clamp01(Number(cfg.puddleAlpha) || 0.22) * (0.6 + 0.75 * intensity) * (0.7 + 0.55 * hype01);
    const softness = Math.max(2, Number(cfg.edgeSoftness) || 26);

    const shimmer = clamp01(Number(cfg.shimmer) || 0.42) * (0.55 + 0.7 * hype01) * (0.65 + 0.7 * intensity);
    const shimmerSpeed = Math.max(0, Number(cfg.shimmerSpeed) || 1.15);
    const glow = Math.max(0, Number(cfg.glow) || 10) * lerp(0.7, 1.4, intensity / 2);

    const rippleSpeed = Math.max(0, Number(cfg.rippleSpeed) || 0.7);
    const rippleStrengthBase = Math.max(0, Number(cfg.rippleStrength) || 0.45);
    const hypeBoost = Math.max(0, Number(cfg.hypeRippleBoost) || 1.2);
    const rippleStrength = rippleStrengthBase * (1 + hypeBoost * hype01) * lerp(0.75, 1.25, intensity / 2);

    const rippleScale = Math.max(0.01, Number(cfg.rippleScale) || 0.06);
    const rippleBands = Math.max(1, Math.min(6, Number(cfg.rippleBands) || 3));

    const drift = Math.max(0, Number(cfg.puddleDrift) || 0) * (0.35 + 0.8 * hype01);

    for (const p of puddles) {
      // tiny drift to keep scene alive without being the “dynamic” focus
      const ox = drift * Math.sin(time * 0.35 + p.wobbleSeed);
      const oy = drift * Math.cos(time * 0.28 + p.wobbleSeed * 1.4);
      p.x = p.baseX + ox;
      p.y = p.baseY + oy;

      const radius = p.r;

      ctx.save();
      ctx.beginPath();

      // organic edge
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const wobble =
          1 +
          0.03 * Math.sin(a * 3 + time * rippleSpeed * 1.2 + p.wobbleSeed) +
          0.02 * Math.sin(a * 5 - time * rippleSpeed * 0.9 + p.wobbleSeed * 0.7);
        const rr = radius * wobble;
        const x = p.x + Math.cos(a) * rr;
        const y = p.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();

      // base gradient tint
      const grad = ctx.createRadialGradient(p.x, p.y - radius * 0.22, radius * 0.18, p.x, p.y, radius * 1.05);
      grad.addColorStop(0, rgbToCss({ r: mix.r * 0.85 + 35, g: mix.g * 0.85 + 35, b: mix.b * 0.85 + 35 }, alpha * 0.9));
      grad.addColorStop(1, rgbToCss(mix, alpha * 0.62));

      ctx.fillStyle = grad;
      ctx.fillRect(p.x - radius - 2, p.y - radius - 2, radius * 2 + 4, radius * 2 + 4);

      // shimmer bands
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.shadowBlur = glow;
      ctx.shadowColor = "rgba(255,255,255,0.35)";

      const bandCount = 3;
      for (let i = 0; i < bandCount; i++) {
        const off = (time * shimmerSpeed * (0.55 + i * 0.22) + p.shimmerSeed + i * 1.7) % 10;
        const y = p.y - radius * 0.25 + (off - 5) * (radius * 0.08);
        const bandH = radius * 0.10;

        const g2 = ctx.createLinearGradient(p.x - radius, y, p.x + radius, y + bandH);
        g2.addColorStop(0, "rgba(255,255,255,0)");
        g2.addColorStop(0.35, `rgba(255,255,255,${shimmer * 0.32})`);
        g2.addColorStop(0.5, `rgba(255,255,255,${shimmer * 0.55})`);
        g2.addColorStop(0.65, `rgba(255,255,255,${shimmer * 0.32})`);
        g2.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(p.x - radius, y - bandH, radius * 2, bandH * 3);
      }
      ctx.restore();

      // subtle ripple shading grid (kept moderate for perf)
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      const cells = 16;
      const step = (radius * 2) / cells;

      for (let yi = 0; yi < cells; yi++) {
        for (let xi = 0; xi < cells; xi++) {
          const x = p.x - radius + xi * step + step * 0.5;
          const y = p.y - radius + yi * step + step * 0.5;
          const dx = x - p.x;
          const dy = y - p.y;
          const m = puddleMask(dx, dy, radius, softness);
          if (m <= 0) continue;

          const nx = dx / radius;
          const ny = dy / radius;

          // local field + active ripples influence
          let rf = rippleField(nx, ny, time * rippleSpeed, rippleScale, rippleBands);

          // add ripple rings from splash events (stronger in the dynamic rain moments)
          for (let rI = 0; rI < ripples.length; rI++) {
            const rr = ripples[rI];
            const ddx = x - rr.x;
            const ddy = y - rr.y;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            const phase = (dist - (rr.r0 + (rr.maxR * (rr.t / rr.life)))) / (radius * 0.06);
            rf += Math.sin(phase) * 0.25 * (1 - rr.t / rr.life);
          }

          const v = rf * rippleStrength;
          const a = clamp01(Math.abs(v) * 0.12 * m * (0.6 + hype01 * 0.9) * intensity);
          ctx.fillStyle = v > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
          ctx.fillRect(x - step * 0.55, y - step * 0.55, step * 1.1, step * 1.1);
        }
      }

      ctx.restore();

      ctx.restore(); // end clip

      // Feather edge
      ctx.save();
      const edgeG = ctx.createRadialGradient(p.x, p.y, radius * 0.75, p.x, p.y, radius + softness);
      edgeG.addColorStop(0, "rgba(0,0,0,0)");
      edgeG.addColorStop(1, `rgba(0,0,0,${clamp01(alpha * 0.55)})`);
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = edgeG;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + softness, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw ripple rings (explicit rings on top for clarity)
    if (ripples.length) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = glow * 0.6;
      ctx.shadowColor = rgbToCss(mix, 0.35);

      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i];
        const tt = clamp01(r.t / r.life);
        const rad = r.r0 + r.maxR * tt;
        const a = r.alpha * (1 - tt) * 0.9;

        if (a <= 0.001) continue;

        ctx.strokeStyle = rgbToCss({ r: 255, g: 255, b: 255 }, a * 0.65);
        ctx.lineWidth = r.width;

        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawRain(tms, hype01, mix, intensity) {
    const time = tms / 1000;
    const len = Math.max(2, Number(cfg.rainLength) || 14);
    const thick = Math.max(0.4, Number(cfg.rainThickness) || 1.3);
    const baseA = clamp01(Number(cfg.rainAlpha) || 0.18) * (0.65 + hype01 * 0.9) * (0.65 + intensity * 0.7);
    const rainGlow = Math.max(0, Number(cfg.rainGlow) || 0);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = thick;

    if (rainGlow > 0) {
      ctx.shadowBlur = rainGlow;
      ctx.shadowColor = rgbToCss(mix, 0.35);
    } else {
      ctx.shadowBlur = 0;
    }

    // Rain tint is slightly desaturated toward white for realism
    const rainCol = {
      r: mix.r * 0.45 + 255 * 0.55,
      g: mix.g * 0.45 + 255 * 0.55,
      b: mix.b * 0.45 + 255 * 0.55
    };

    ctx.strokeStyle = rgbToCss(rainCol, baseA);

    ctx.beginPath();
    for (let i = 0; i < rain.length; i++) {
      const d = rain[i];
      // angle based on vx/vy
      const vx = d.vx;
      const vy = d.vy;
      const mag = Math.max(1, Math.sqrt(vx * vx + vy * vy));
      const ux = vx / mag;
      const uy = vy / mag;

      // subtle flicker variation
      const a = baseA * (0.8 + 0.2 * Math.sin(time * 9 + i * 0.17));
      ctx.strokeStyle = rgbToCss(rainCol, a);

      const x2 = d.x;
      const y2 = d.y;
      const x1 = x2 - ux * len;
      const y1 = y2 - uy * len;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Initial build
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  rebuildPuddles(computeHype01(metersState.total));
  lastPuddleRebuild = t0;

  let lastT = t0;

  function frame(tms) {
    if (isDestroyed) return;

    const fit = fitCanvasToDisplay(resolvedCanvas);
    if (fit.w !== w || fit.h !== h) {
      // rebuild on resize to keep puddles in valid region
      rebuildPuddles(computeHype01(metersState.total));
    } else {
      w = fit.w; h = fit.h;
    }

    const dt = Math.min(0.05, Math.max(0.001, (tms - lastT) / 1000));
    lastT = tms;

    const hype01 = computeHype01(metersState.total);
    const mix = computeMixColor(metersState, cfg.mixMode);
    const intensity = Math.max(0, Math.min(2, Number(cfg.intensity) || 1));

    // Optional auto-respawn puddles (subtle; rain is the dynamic focus)
    maybeAutoRespawnPuddles(tms, hype01);

    // Rain is the primary dynamic portion: spawn + update each frame
    spawnRain(dt, hype01, intensity);
    updateRain(dt);
    handleRainHits(dt, hype01, mix, intensity);

    // Draw order: puddles first, rain over top
    ctx.clearRect(0, 0, w, h);
    drawPuddles(tms, hype01, mix, intensity);
    drawRain(tms, hype01, mix, intensity);

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame((tms) => {
    lastT = tms;
    frame(tms);
  });

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    rebuildPuddles(computeHype01(metersState.total));
    rain.length = 0;
    ripples.length = 0;
    rainCarry = 0;
  }

  function destroy() {
    isDestroyed = true;
    try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
    for (const fn of unsub) { try { fn(); } catch (_) {} }
    ctx.clearRect(0, 0, w, h);
  }

  const onResize = () => {
    try {
      rebuildPuddles(computeHype01(metersState.total));
    } catch (_) {}
  };
  window.addEventListener("resize", onResize);
  unsub.push(() => window.removeEventListener("resize", onResize));

  return { destroy, setConfig };
}
