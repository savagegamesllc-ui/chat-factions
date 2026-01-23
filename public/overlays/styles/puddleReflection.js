// public/overlays/styles/puddleReflection.js
// Puddle Reflection (FREE)
// - Small reflective puddle with ripples + shimmer highlights
// - Abstract “reflection” tint based on faction color mixing
// - placement: bottom|edges, mixMode: weighted|winner, intensity: 0..2
// - Defensive canvas resolution (works even if {canvas} isn't passed)
//
// Contract: export meta + init({ canvas, app, config }) -> { destroy(), setConfig(next) }

export const meta = {
  styleKey: "puddleReflection",
  name: "Puddle Reflection",
  tier: "FREE",
  description:
    "A subtle reflective puddle with ripples and shimmer. Color tints blend by faction meters; hype increases motion and sparkle.",
  defaultConfig: {
    placement: "bottom",     // "bottom" | "edges"
    mixMode: "weighted",     // "weighted" | "winner"
    intensity: 1.0,          // 0..2

    // Size/position
    puddleSize: 180,         // px diameter-ish
    puddleAlpha: 0.28,       // 0..1 body opacity
    padding: 22,             // inset within region
    bottomHeight: 220,       // bottom band height when placement=bottom
    edgeInset: 40,           // inward offset when placement=edges

    // Edge look
    edgeSoftness: 28,        // feather radius (px)
    outlineWidth: 0.0,       // optional outline width
    outlineAlpha: 0.12,      // outline opacity

    // Ripples
    rippleSpeed: 0.8,        // base speed
    rippleStrength: 0.55,    // distortion amount (0..1-ish)
    hypeRippleBoost: 1.1,    // extra ripple at high hype
    rippleScale: 0.065,      // frequency of ripple pattern
    rippleBands: 3,          // number of ripple layers

    // Shimmer / highlights
    shimmer: 0.45,           // 0..1
    shimmerSpeed: 1.2,       // highlight motion speed
    sparkle: 0.18,           // random sparkles intensity
    sparkleRate: 0.35,       // sparkles per second (scaled by hype)
    glow: 10                 // shadow blur for highlights
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

    { key: "puddleSize", label: "Puddle Size", type: "range", min: 80, max: 520, step: 10, default: 180 },
    { key: "puddleAlpha", label: "Puddle Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.28 },
    { key: "edgeSoftness", label: "Edge Softness", type: "range", min: 6, max: 90, step: 1, default: 28 },

    { key: "padding", label: "Padding", type: "range", min: 0, max: 120, step: 1, default: 22 },
    { key: "bottomHeight", label: "Bottom Height", type: "range", min: 120, max: 520, step: 10, default: 220 },
    { key: "edgeInset", label: "Edge Inset", type: "range", min: 0, max: 240, step: 5, default: 40 },

    { key: "rippleSpeed", label: "Ripple Speed", type: "range", min: 0, max: 3, step: 0.05, default: 0.8 },
    { key: "rippleStrength", label: "Ripple Strength", type: "range", min: 0, max: 1.5, step: 0.05, default: 0.55 },
    { key: "hypeRippleBoost", label: "Hype Ripple Boost", type: "range", min: 0, max: 2.5, step: 0.05, default: 1.1 },
    { key: "rippleScale", label: "Ripple Scale", type: "range", min: 0.02, max: 0.15, step: 0.005, default: 0.065 },
    { key: "rippleBands", label: "Ripple Bands", type: "range", min: 1, max: 6, step: 1, default: 3 },

    { key: "shimmer", label: "Shimmer", type: "range", min: 0, max: 1, step: 0.02, default: 0.45 },
    { key: "shimmerSpeed", label: "Shimmer Speed", type: "range", min: 0, max: 4, step: 0.05, default: 1.2 },
    { key: "sparkle", label: "Sparkle", type: "range", min: 0, max: 1, step: 0.02, default: 0.18 },
    { key: "sparkleRate", label: "Sparkle Rate", type: "range", min: 0, max: 2.5, step: 0.05, default: 0.35 },
    { key: "glow", label: "Glow", type: "range", min: 0, max: 30, step: 1, default: 10 },

    { key: "outlineWidth", label: "Outline Width", type: "range", min: 0, max: 6, step: 0.5, default: 0 },
    { key: "outlineAlpha", label: "Outline Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.12 }
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

// Region selection for puddle center
function pickPuddleCenter(w, h, cfg) {
  const pad = Math.max(0, Number(cfg.padding) || 0);
  const placement = cfg.placement === "edges" ? "edges" : "bottom";

  if (placement === "bottom") {
    const bh = Math.max(60, Number(cfg.bottomHeight) || 220);
    const y0 = Math.max(0, h - bh);
    const x = lerp(pad, w - pad, 0.5); // centered by default
    const y = lerp(y0 + pad, h - pad, 0.62); // sits in lower half of band
    return { x, y };
  }

  // edges: choose a gentle location near bottom-left/right edges by default
  const inset = Math.max(0, Number(cfg.edgeInset) || 40);
  const x = inset + pad + (w - 2 * (inset + pad)) * 0.18;
  const y = inset + pad + (h - 2 * (inset + pad)) * 0.78;
  return { x, y };
}

// Soft puddle mask alpha at point (dx,dy) relative to center
function puddleMask(dx, dy, radius, softness) {
  const r = Math.sqrt(dx * dx + dy * dy);
  const edge0 = radius;
  const edge1 = radius + Math.max(1, softness);
  const t = clamp01((edge1 - r) / (edge1 - edge0)); // 1 inside, 0 outside
  // Smoothstep-ish
  return t * t * (3 - 2 * t);
}

// Cheap ripple field (sum of sines) for distortion + shimmer
function rippleField(nx, ny, t, scale, bands) {
  let v = 0;
  for (let i = 1; i <= bands; i++) {
    const f = scale * i * 18;
    v += Math.sin((nx * f + ny * f * 0.9) + t * (1.2 + i * 0.35) + i * 3.1);
  }
  return v / Math.max(1, bands);
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
  let center = { x: 0, y: 0 };
  let sparkle = [];

  function rebuild() {
    const fit = fitCanvasToDisplay(resolvedCanvas);
    w = fit.w; h = fit.h;
    center = pickPuddleCenter(w, h, cfg);

    // Re-seed sparkles inside puddle area
    sparkle = [];
    const r = Math.max(40, Number(cfg.puddleSize) || 180) / 2;
    const count = Math.max(8, Math.min(120, Math.floor(r / 6)));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * r * 0.95;
      sparkle.push({
        x: center.x + Math.cos(a) * rr,
        y: center.y + Math.sin(a) * rr,
        phase: Math.random() * Math.PI * 2,
        tw: 0.5 + Math.random() * 0.5
      });
    }
  }

  rebuild();

  function clear() { ctx.clearRect(0, 0, w, h); }

  // Render puddle via a clipped region with gradient + shimmer highlights
  function draw(tms) {
    if (isDestroyed) return;

    const fit = fitCanvasToDisplay(resolvedCanvas);
    if (fit.w !== w || fit.h !== h) rebuild();

    const time = tms / 1000;

    const hype01 = computeHype01(metersState.total);
    const mix = computeMixColor(metersState, cfg.mixMode);

    const intensity = Math.max(0, Math.min(2, Number(cfg.intensity) || 1));
    const size = Math.max(60, Number(cfg.puddleSize) || 180) * lerp(0.9, 1.15, intensity / 2) * (1 + 0.06 * hype01);
    const radius = size / 2;

    const alpha = clamp01(Number(cfg.puddleAlpha) || 0.28) * (0.65 + 0.7 * intensity) * (0.7 + 0.6 * hype01);
    const softness = Math.max(2, Number(cfg.edgeSoftness) || 28);

    const rippleSpeed = Math.max(0, Number(cfg.rippleSpeed) || 0.8);
    const rippleStrengthBase = Math.max(0, Number(cfg.rippleStrength) || 0.55);
    const hypeBoost = Math.max(0, Number(cfg.hypeRippleBoost) || 1.1);
    const rippleStrength = rippleStrengthBase * (1 + hypeBoost * hype01) * lerp(0.75, 1.25, intensity / 2);

    const rippleScale = Math.max(0.01, Number(cfg.rippleScale) || 0.065);
    const rippleBands = Math.max(1, Math.min(6, Number(cfg.rippleBands) || 3));

    const shimmer = clamp01(Number(cfg.shimmer) || 0.45) * (0.55 + 0.7 * hype01) * (0.65 + 0.7 * intensity);
    const shimmerSpeed = Math.max(0, Number(cfg.shimmerSpeed) || 1.2);
    const glow = Math.max(0, Number(cfg.glow) || 10) * lerp(0.7, 1.4, intensity / 2);

    const sparkleAmt = clamp01(Number(cfg.sparkle) || 0.18) * (0.5 + 0.9 * hype01);
    const sparkleRate = Math.max(0, Number(cfg.sparkleRate) || 0.35) * (0.6 + 1.6 * hype01);

    const outlineW = Math.max(0, Number(cfg.outlineWidth) || 0);
    const outlineA = clamp01(Number(cfg.outlineAlpha) || 0.12);

    clear();

    // Clip to puddle shape (circle-ish with subtle wobble)
    ctx.save();
    ctx.beginPath();

    // Organic edge: radius + tiny wave
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const wobble =
        1 +
        0.03 * Math.sin(a * 3 + time * rippleSpeed * 1.3) +
        0.02 * Math.sin(a * 5 - time * rippleSpeed * 0.9);
      const rr = radius * wobble;
      const x = center.x + Math.cos(a) * rr;
      const y = center.y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.clip();

    // Base body gradient (tinted)
    const grad = ctx.createRadialGradient(center.x, center.y - radius * 0.25, radius * 0.2, center.x, center.y, radius * 1.05);
    grad.addColorStop(0, rgbToCss({ r: mix.r * 0.85 + 35, g: mix.g * 0.85 + 35, b: mix.b * 0.85 + 35 }, alpha * 0.9));
    grad.addColorStop(1, rgbToCss(mix, alpha * 0.65));

    ctx.fillStyle = grad;
    ctx.fillRect(center.x - radius - 2, center.y - radius - 2, radius * 2 + 4, radius * 2 + 4);

    // Shimmer highlights using a few moving bands
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowBlur = glow;
    ctx.shadowColor = rgbToCss({ r: 255, g: 255, b: 255 }, 0.45);

    const bandCount = 3;
    for (let i = 0; i < bandCount; i++) {
      const off = (time * shimmerSpeed * (0.55 + i * 0.22) + i * 1.7) % 10;
      const y = center.y - radius * 0.3 + (off - 5) * (radius * 0.07);
      const bandH = radius * 0.10;

      const g2 = ctx.createLinearGradient(center.x - radius, y, center.x + radius, y + bandH);
      g2.addColorStop(0, "rgba(255,255,255,0)");
      g2.addColorStop(0.35, `rgba(255,255,255,${shimmer * 0.35})`);
      g2.addColorStop(0.5, `rgba(255,255,255,${shimmer * 0.55})`);
      g2.addColorStop(0.65, `rgba(255,255,255,${shimmer * 0.35})`);
      g2.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = g2;
      ctx.fillRect(center.x - radius, y - bandH, radius * 2, bandH * 3);
    }

    // Sparkles (random twinkles) – probabilistic intensity
    if (sparkleAmt > 0.01 && sparkle.length) {
      const wantSpawn = Math.random() < (sparkleRate / 60); // ~frame-based
      if (wantSpawn) {
        // kick a random sparkle phase
        const idx = (Math.random() * sparkle.length) | 0;
        if (sparkle[idx]) sparkle[idx].phase = Math.random() * Math.PI * 2;
      }

      for (let i = 0; i < sparkle.length; i++) {
        const s = sparkle[i];
        const dx = s.x - center.x;
        const dy = s.y - center.y;
        const m = puddleMask(dx, dy, radius * 0.98, softness);
        if (m <= 0) continue;

        const nx = dx / radius;
        const ny = dy / radius;

        const rf = rippleField(nx, ny, time * rippleSpeed, rippleScale, rippleBands);
        const tw = 0.5 + 0.5 * Math.sin(time * (6.5 + hype01 * 6) + s.phase + rf * 2.2);

        const a = clamp01(sparkleAmt * tw * s.tw * m * 0.55);
        if (a < 0.02) continue;

        const rr = Math.max(0.7, radius * 0.012);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x + rf * rippleStrength * 2, s.y + rf * rippleStrength * 2, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Distortion suggestion: faint refractive dark-to-light noise “ripples”
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    const cells = 22; // keep low for performance
    const step = (radius * 2) / cells;

    for (let yi = 0; yi < cells; yi++) {
      for (let xi = 0; xi < cells; xi++) {
        const x = center.x - radius + xi * step + step * 0.5;
        const y = center.y - radius + yi * step + step * 0.5;
        const dx = x - center.x;
        const dy = y - center.y;
        const m = puddleMask(dx, dy, radius, softness);
        if (m <= 0) continue;

        const nx = dx / radius;
        const ny = dy / radius;

        const rf = rippleField(nx, ny, time * rippleSpeed, rippleScale, rippleBands);
        const v = rf * rippleStrength;

        // tiny per-cell shading
        const a = clamp01(Math.abs(v) * 0.12 * m * (0.6 + hype01 * 0.8) * intensity);
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
        ctx.fillRect(x - step * 0.55, y - step * 0.55, step * 1.1, step * 1.1);
      }
    }
    ctx.restore();

    ctx.restore(); // end clip

    // Feather edge (soft alpha falloff)
    // Draw a soft edge ring by painting a radial gradient over the whole puddle area
    ctx.save();
    const edgeG = ctx.createRadialGradient(center.x, center.y, radius * 0.75, center.x, center.y, radius + softness);
    edgeG.addColorStop(0, "rgba(0,0,0,0)");
    edgeG.addColorStop(1, `rgba(0,0,0,${clamp01(alpha * 0.55)})`);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = edgeG;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius + softness, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Optional outline
    if (outlineW > 0.01 && outlineA > 0.001) {
      ctx.save();
      ctx.lineWidth = outlineW;
      ctx.strokeStyle = rgbToCss(mix, clamp01(outlineA * (0.65 + hype01 * 0.6)));
      ctx.shadowBlur = glow * 0.8;
      ctx.shadowColor = rgbToCss(mix, 0.35);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 0.98, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    rebuild();
  }

  function destroy() {
    isDestroyed = true;
    try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
    for (const fn of unsub) { try { fn(); } catch (_) {} }
    clear();
  }

  const onResize = () => { try { rebuild(); } catch (_) {} };
  window.addEventListener("resize", onResize);
  unsub.push(() => window.removeEventListener("resize", onResize));

  return { destroy, setConfig };
}
