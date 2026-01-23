// public/overlays/styles/marqueeBorder.js
// Marquee Border (FREE) + "burst sparks"
// - Lit “bulb” marquee border around edges or bottom
// - Bulb chase speed + brightness scale with hype
// - Faction-weighted color mixing (weighted|winner)
// - NEW: Sparks that appear more often as hype grows, like bulbs are bursting
// - Defensive canvas resolution (works even if {canvas} isn't passed)
//
// Contract: export meta + init({ canvas, app, config }) -> { destroy(), setConfig(next) }

export const meta = {
  styleKey: "marqueeBorder",
  name: "Marquee Border",
  tier: "FREE",
  description:
    "A classic lit marquee border of animated bulbs. Bulb color blends by faction meters; hype increases speed and brightness. Includes burst sparks at high hype.",
  defaultConfig: {
    placement: "edges",      // "bottom" | "edges"
    mixMode: "weighted",     // "weighted" | "winner"
    intensity: 1.0,          // 0..2

    // Bulbs
    bulbSize: 7,             // px radius
    bulbSpacing: 22,         // px between bulbs
    inset: 16,               // px inset from screen edge
    edgeThickness: 34,       // px band thickness for edges placement
    bottomHeight: 90,        // px band height for bottom placement

    // Motion + hype response
    chaseSpeed: 1.2,         // bulbs per second (base)
    hypeSpeedBoost: 2.2,     // additional speed at max hype
    twinkle: 0.35,           // 0..1 per-bulb twinkle noise
    pulse: 0.25,             // 0..1 global breathing pulse

    // Lighting look
    glow: 14,                // shadow blur
    lineWidth: 2,            // border line width
    lineAlpha: 0.22,         // border line transparency
    bulbAlpha: 0.9,          // base bulb transparency
    dimFactor: 0.25,         // how dim “off” bulbs can be
    hotSpot: 0.6,            // 0..1 highlight dot intensity

    // Sparks (NEW)
    sparks: true,
    sparkRate: 6,            // base sparks/sec at low hype
    sparkRateMax: 42,        // sparks/sec at max hype (scaled by intensity)
    sparkLife: 0.55,         // seconds
    sparkSize: 2.2,          // px (base)
    sparkSpeed: 160,         // px/sec (base)
    sparkSpread: 1.1,        // radians around outward normal
    sparkGlow: 14,           // extra blur
    sparkAlpha: 0.9,         // cap alpha
    sparkFromBrightOnly: true, // spawn mostly from "lit" bulbs (wave head)
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

    { key: "bulbSize", label: "Bulb Size", type: "range", min: 3, max: 18, step: 1, default: 7 },
    { key: "bulbSpacing", label: "Bulb Spacing", type: "range", min: 10, max: 60, step: 1, default: 22 },
    { key: "inset", label: "Inset", type: "range", min: 0, max: 80, step: 1, default: 16 },
    { key: "edgeThickness", label: "Edge Thickness", type: "range", min: 18, max: 90, step: 1, default: 34 },
    { key: "bottomHeight", label: "Bottom Height", type: "range", min: 50, max: 240, step: 5, default: 90 },

    { key: "chaseSpeed", label: "Chase Speed", type: "range", min: 0, max: 6, step: 0.1, default: 1.2 },
    { key: "hypeSpeedBoost", label: "Hype Speed Boost", type: "range", min: 0, max: 8, step: 0.1, default: 2.2 },
    { key: "twinkle", label: "Twinkle", type: "range", min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: "pulse", label: "Pulse", type: "range", min: 0, max: 1, step: 0.05, default: 0.25 },

    { key: "glow", label: "Glow", type: "range", min: 0, max: 40, step: 1, default: 14 },
    { key: "lineWidth", label: "Line Width", type: "range", min: 0, max: 8, step: 0.5, default: 2 },
    { key: "lineAlpha", label: "Line Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: "bulbAlpha", label: "Bulb Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.9 },
    { key: "dimFactor", label: "Dim Factor", type: "range", min: 0, max: 0.8, step: 0.02, default: 0.25 },
    { key: "hotSpot", label: "Hot Spot", type: "range", min: 0, max: 1, step: 0.05, default: 0.6 },

    // Sparks controls
    { key: "sparks", label: "Sparks", type: "checkbox", default: true },
    { key: "sparkRate", label: "Spark Rate (base)", type: "range", min: 0, max: 40, step: 1, default: 6 },
    { key: "sparkRateMax", label: "Spark Rate (max hype)", type: "range", min: 0, max: 120, step: 1, default: 42 },
    { key: "sparkLife", label: "Spark Life (s)", type: "range", min: 0.1, max: 2, step: 0.05, default: 0.55 },
    { key: "sparkSize", label: "Spark Size", type: "range", min: 0.6, max: 8, step: 0.1, default: 2.2 },
    { key: "sparkSpeed", label: "Spark Speed", type: "range", min: 30, max: 450, step: 5, default: 160 },
    { key: "sparkSpread", label: "Spark Spread", type: "range", min: 0.2, max: 2.4, step: 0.05, default: 1.1 },
    { key: "sparkGlow", label: "Spark Glow", type: "range", min: 0, max: 40, step: 1, default: 14 },
    { key: "sparkAlpha", label: "Spark Alpha", type: "range", min: 0.1, max: 1, step: 0.05, default: 0.9 },
    { key: "sparkFromBrightOnly", label: "Sparks From Bright Bulbs", type: "checkbox", default: true },
  ],
};

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function parseHex(hex) {
  const h = String(hex || "").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return { r: 255, g: 210, b: 120 };
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
  if (sum <= 0) return { r: 255, g: 210, b: 120 };
  return { r: r / sum, g: g / sum, b: b / sum };
}
function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 255, g: 210, b: 120 };
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
      const colorHex = it?.colorHex ?? it?.color ?? it?.hex ?? "#FFD278";
      out.factions.push({ key, value, colorHex });
      out.total += Math.max(0, value);
    }
    if (typeof metersLike.totalHype === "number") out.total = metersLike.totalHype;
    if (typeof metersLike.total === "number") out.total = metersLike.total;
    return out;
  }

  if (typeof metersLike === "object") {
    for (const [key, v] of Object.entries(metersLike)) {
      if (!v || typeof v !== "object") continue;
      const value = Number(v.value ?? v.meter ?? v.hype ?? 0) || 0;
      const colorHex = v.colorHex ?? v.color ?? v.hex ?? "#FFD278";
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
  if (!colors.length) return { r: 255, g: 210, b: 120 };
  return mixMode === "winner" ? pickWinner(colors, weights) : mixWeighted(colors, weights);
}

function computeHype01(total) {
  const t = Math.max(0, Number(total) || 0);
  return clamp01(1 - Math.exp(-t / 30));
}

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
    c.style.pointerEvents = "none";
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

// Build a list of bulb positions (with outward normals) along the border path
function buildBulbPath(w, h, cfg) {
  const inset = Math.max(0, Number(cfg.inset) || 0);
  const spacing = Math.max(6, Number(cfg.bulbSpacing) || 22);
  const placement = cfg.placement === "bottom" ? "bottom" : "edges";

  const pts = [];

  if (placement === "bottom") {
    const bh = Math.max(20, Number(cfg.bottomHeight) || 90);
    const y = h - inset - (Number(cfg.bulbSize) || 7) - 2;
    const x0 = inset;
    const x1 = w - inset;
    const len = Math.max(1, Math.floor((x1 - x0) / spacing));
    for (let i = 0; i <= len; i++) {
      const x = lerp(x0, x1, i / len);
      // outward normal for bottom is +y (down)
      pts.push({ x, y, nx: 0, ny: 1, side: "bottom" });
    }
    return { pts, band: { x0: 0, y0: h - bh, x1: w, y1: h } };
  }

  // edges perimeter, clockwise
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;

  const topLen = x1 - x0;
  const rightLen = y1 - y0;
  const botLen = x1 - x0;
  const leftLen = y1 - y0;

  const perim = 2 * (topLen + rightLen);
  const count = Math.max(8, Math.floor(perim / spacing));

  for (let i = 0; i < count; i++) {
    const d = (i / count) * perim;
    let x = x0, y = y0, nx = 0, ny = 0;
    let t = d;

    if (t <= topLen) {
      x = x0 + t; y = y0; nx = 0; ny = -1;
    } else if ((t -= topLen) <= rightLen) {
      x = x1; y = y0 + t; nx = 1; ny = 0;
    } else if ((t -= rightLen) <= botLen) {
      x = x1 - t; y = y1; nx = 0; ny = 1;
    } else {
      t -= botLen;
      x = x0; y = y1 - t; nx = -1; ny = 0;
    }

    pts.push({ x, y, nx, ny, side: "edges" });
  }

  const thick = Math.max(10, Number(cfg.edgeThickness) || 34);
  return { pts, band: { x0: 0, y0: 0, x1: w, y1: h, thickness: thick } };
}

// tiny deterministic noise
function hash01(n) {
  let x = n | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10000) / 10000;
}

export function init({ canvas, app, config } = {}) {
  const resolvedCanvas = resolveCanvas(canvas);
  if (!resolvedCanvas) return { destroy() {}, setConfig() {} };

  const ctx = resolvedCanvas.getContext("2d", { alpha: true });
  if (!ctx) return { destroy() {}, setConfig() {} };

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // meters state
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

  // sparks
  const sparks = [];
  let sparkCarry = 0;

  let raf = 0;
  let isDestroyed = false;

  let path = null;
  let w = 0, h = 0;

  function rebuildPath() {
    const fit = fitCanvasToDisplay(resolvedCanvas);
    w = fit.w; h = fit.h;
    path = buildBulbPath(w, h, cfg);
  }

  rebuildPath();

  function clear() { ctx.clearRect(0, 0, w, h); }

  function spawnSparks(dt, time, hype01, intensity, mix, pts, offset, glow) {
    if (!cfg.sparks) { sparks.length = 0; sparkCarry = 0; return; }

    const base = Math.max(0, Number(cfg.sparkRate) || 0);
    const maxR = Math.max(0, Number(cfg.sparkRateMax) || 0);
    const rate = lerp(base, maxR, hype01) * lerp(0.6, 1.5, intensity / 2);

    sparkCarry += rate * dt;

    const nSpawn = Math.min(80, Math.floor(sparkCarry));
    sparkCarry -= nSpawn;
    if (nSpawn <= 0) return;

    const lifeBase = Math.max(0.1, Number(cfg.sparkLife) || 0.55);
    const sizeBase = Math.max(0.4, Number(cfg.sparkSize) || 2.2);
    const speedBase = Math.max(10, Number(cfg.sparkSpeed) || 160);
    const spread = clamp(Number(cfg.sparkSpread) || 1.1, 0.1, 3.14);
    const onlyBright = !!cfg.sparkFromBrightOnly;

    for (let k = 0; k < nSpawn; k++) {
      let i = (Math.random() * pts.length) | 0;

      // Prefer bulbs near the chase head so it feels like "bulbs bursting"
      if (onlyBright) {
        // chase head is where d~0, so pick indices near offset
        const head = ((offset | 0) % pts.length + pts.length) % pts.length;
        const jitter = ((Math.random() * 26) | 0) - 13; // +/- 13 bulbs
        i = (head + jitter + pts.length) % pts.length;
      }

      const p = pts[i];
      const nx = p.nx ?? 0;
      const ny = p.ny ?? 0;

      // random direction around outward normal
      const ang0 = Math.atan2(ny, nx);
      const ang = ang0 + (Math.random() * 2 - 1) * spread;

      const hypeBoost = 0.45 + hype01 * 1.15;
      const sp = speedBase * hypeBoost * lerp(0.8, 1.2, Math.random());

      const vx = Math.cos(ang) * sp + (Math.random() * 40 - 20);
      const vy = Math.sin(ang) * sp + (Math.random() * 40 - 20);

      sparks.push({
        x: p.x + nx * 2,
        y: p.y + ny * 2,
        vx,
        vy,
        age: 0,
        life: lifeBase * lerp(0.65, 1.15, Math.random()) * (0.85 + hype01 * 0.35),
        size: sizeBase * lerp(0.7, 1.3, Math.random()) * (0.8 + hype01 * 0.5),
        // slightly hotter sparks: blend toward white at high hype
        r: mix.r + (255 - mix.r) * (0.10 + 0.55 * hype01),
        g: mix.g + (255 - mix.g) * (0.10 + 0.55 * hype01),
        b: mix.b + (255 - mix.b) * (0.10 + 0.55 * hype01),
        glow: glow * (0.6 + 0.9 * hype01),
      });
    }

    // cap
    if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
  }

  function updateSparks(dt) {
    const drag = 0.88;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) { sparks.splice(i, 1); continue; }
      const k = Math.pow(drag, dt * 60);
      s.vx *= k; s.vy *= k;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
  }

  function drawSparks(glow) {
    if (!sparks.length) return;

    const aCap = clamp01(Number(cfg.sparkAlpha) || 0.9);
    const extraGlow = Math.max(0, Number(cfg.sparkGlow) || 14);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const s of sparks) {
      const k = 1 - s.age / s.life; // 1..0
      const a = clamp01(aCap * (0.15 + 0.85 * k));

      ctx.globalAlpha = a;
      ctx.fillStyle = `rgba(${s.r|0},${s.g|0},${s.b|0},${a})`;
      ctx.shadowColor = `rgba(${s.r|0},${s.g|0},${s.b|0},${a})`;
      ctx.shadowBlur = (s.glow ?? glow) + extraGlow * k;

      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.5, s.size * (0.55 + 0.95 * k)), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function draw(tms) {
    if (isDestroyed) return;

    // Resize-safe
    const fit = fitCanvasToDisplay(resolvedCanvas);
    if (fit.w !== w || fit.h !== h) {
      w = fit.w; h = fit.h;
      path = buildBulbPath(w, h, cfg);
    }

    const time = tms / 1000;
    const pts = path?.pts || [];
    if (!pts.length) {
      raf = requestAnimationFrame(draw);
      return;
    }

    const hype01 = computeHype01(metersState.total);
    const mix = computeMixColor(metersState, cfg.mixMode);

    const intensity = clamp(Number(cfg.intensity) || 1, 0, 2);
    const bulbR = Math.max(1, Number(cfg.bulbSize) || 7) * lerp(0.85, 1.25, intensity / 2);

    const glow = Math.max(0, Number(cfg.glow) || 14) * lerp(0.7, 1.4, intensity / 2) * (0.65 + hype01 * 0.9);

    const chaseBase = Math.max(0, Number(cfg.chaseSpeed) || 1.2);
    const chaseBoost = Math.max(0, Number(cfg.hypeSpeedBoost) || 2.2);
    const chase = (chaseBase + chaseBoost * hype01) * lerp(0.85, 1.25, intensity / 2);

    const twinkle = clamp01(Number(cfg.twinkle) || 0.35);
    const pulse = clamp01(Number(cfg.pulse) || 0.25);

    const lineWidth = Math.max(0, Number(cfg.lineWidth) || 2);
    const lineAlpha = clamp01(Number(cfg.lineAlpha) || 0.22) * (0.55 + hype01 * 0.9) * (0.65 + 0.35 * intensity);
    const bulbAlpha = clamp01(Number(cfg.bulbAlpha) || 0.9);
    const dimFactor = clamp(Number(cfg.dimFactor) || 0.25, 0, 0.9);
    const hotSpot = clamp01(Number(cfg.hotSpot) || 0.6);

    // dt for sparks
    const dt = (draw._lastT ? Math.min(0.05, time - draw._lastT) : 0.016);
    draw._lastT = time;

    clear();

    // Subtle border line
    if (lineWidth > 0 && lineAlpha > 0.001) {
      ctx.save();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = rgbToCss(mix, clamp01(lineAlpha));
      ctx.shadowBlur = glow * 0.7;
      ctx.shadowColor = rgbToCss(mix, clamp01(lineAlpha * 0.9));
      ctx.beginPath();

      const inset = Math.max(0, Number(cfg.inset) || 0);
      if (cfg.placement === "bottom") {
        const bh = Math.max(20, Number(cfg.bottomHeight) || 90);
        ctx.rect(inset, h - bh + inset, w - inset * 2, bh - inset * 2);
      } else {
        ctx.rect(inset, inset, w - inset * 2, h - inset * 2);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Bulb chase
    const globalPulse = 1 - pulse * 0.5 + pulse * (0.5 + 0.5 * Math.sin(time * 2 * Math.PI * 0.6));
    const offset = (time * chase) % pts.length;

    ctx.save();
    ctx.shadowBlur = glow;
    ctx.shadowColor = rgbToCss(mix, 0.85);

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];

      const d = (i - offset + pts.length) % pts.length;
      const wave = Math.exp(-Math.pow(d / 6.5, 2)); // head width
      const base = dimFactor + (1 - dimFactor) * wave;

      const tw = twinkle > 0
        ? (1 - twinkle) + twinkle * (0.6 + 0.4 * Math.sin(time * 8.0 + i * 0.73))
        : 1;

      const heat = (0.55 + hype01 * 0.9);
      const a = clamp01(bulbAlpha * base * tw * globalPulse * heat * (0.65 + 0.35 * intensity));

      ctx.fillStyle = rgbToCss(mix, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, bulbR, 0, Math.PI * 2);
      ctx.fill();

      // hot spot highlight
      if (hotSpot > 0.01) {
        const hx = p.x - bulbR * 0.28;
        const hy = p.y - bulbR * 0.28;
        ctx.shadowBlur = glow * 0.4;
        ctx.shadowColor = "rgba(255,255,255,0.35)";
        ctx.fillStyle = `rgba(255,255,255,${clamp01(a * hotSpot)})`;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(0.8, bulbR * 0.33), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = glow;
        ctx.shadowColor = rgbToCss(mix, 0.85);
      }

      // occasional micro "pop" at very high hype: tiny bloom dot
      if (hype01 > 0.75 && wave > 0.55) {
        const chance = (hype01 - 0.75) * 0.25 * (0.5 + intensity * 0.5);
        if (Math.random() < chance * 0.02) {
          ctx.shadowBlur = glow * 1.6;
          ctx.shadowColor = rgbToCss(mix, 0.95);
          ctx.fillStyle = rgbToCss(mix, clamp01(a * 0.35));
          ctx.beginPath();
          ctx.arc(p.x, p.y, bulbR * 1.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = glow;
          ctx.shadowColor = rgbToCss(mix, 0.85);
        }
      }
    }

    ctx.restore();

    // Sparks (spawn/update/draw after bulbs so they sit “above”)
    spawnSparks(dt, time, hype01, intensity, mix, pts, offset, glow);
    updateSparks(dt);
    drawSparks(glow);

    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    rebuildPath();
  }

  function destroy() {
    isDestroyed = true;
    try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
    for (const fn of unsub) { try { fn(); } catch (_) {} }
    sparks.length = 0;
    clear();
  }

  const onResize = () => { try { rebuildPath(); } catch (_) {} };
  window.addEventListener("resize", onResize);
  unsub.push(() => window.removeEventListener("resize", onResize));

  return { destroy, setConfig };
}
