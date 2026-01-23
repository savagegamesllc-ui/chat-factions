// public/overlays/styles/ruckheimerFireworksPro.js
// Ruckheimer Fireworks (PRO)
// "Fourth of July meets Jerry Bruckheimer" — big cinematic moments.
//
// - Massive fireworks bursts driven by hype + spike detection
// - Shockwaves, spark trails, glitter, bloom-y lens flare accents (stylized)
// - Faction-weighted color mixing (weighted|winner) + optional per-faction bursts
// - placement: bottom|edges (launch origin zone)
// - intensity: 0..2 (global energy)
//
// Contract: export meta + init({ canvas, app, config }) -> { destroy(), setConfig(next) }

export const meta = {
  styleKey: "ruckheimerFireworksPro",
  name: "Ruckheimer Fireworks (PRO)",
  tier: "PRO",
  description:
    "Cinematic fireworks for big moments: bursts, shockwaves, glitter trails, and faction-driven color. Hype triggers escalation and dramatic spike blasts.",
  defaultConfig: {
    placement: "bottom",        // bottom|edges
    mixMode: "weighted",        // weighted|winner
    intensity: 1.4,             // 0..2

    // Overall pacing
    baseLaunchRate: 0.35,       // rockets/sec baseline
    hypeLaunchBoost: 2.8,       // extra rockets/sec at high hype
    spikeSensitivity: 0.55,     // 0..1; higher = easier to trigger mega bursts

    // Rocket / burst shape
    rocketSpeed: 780,           // px/sec
    rocketSpeedBoost: 520,      // px/sec extra at high hype
    burstParticles: 140,        // sparks per burst
    burstParticlesBoost: 260,   // extra sparks at high hype
    burstSpread: 1.0,           // 0.5..2 (angle spread multiplier)
    gravity: 760,               // px/sec^2

    // Trails and glitter
    trailLength: 10,            // how many trail samples per spark
    trailAlpha: 0.55,           // trail visibility
    glitter: 0.55,              // 0..1 (sparkle twinkles)
    emberFade: 1.15,            // seconds (spark life base)

    // Shockwave + bloom accents
    shockwave: 0.75,            // 0..1 amount of ring shockwaves
    shockwaveWidth: 3.0,        // px
    shockwaveLife: 0.75,        // seconds
    bloom: 0.7,                 // 0..1 “hot core” brightness
    flare: 0.45,                // 0..1 lens flare accents

    // Screen drama
    shake: 0.35,                // 0..1 (micro screen shake on spikes)
    vignette: 0.18,             // 0..0.6 (cinematic vignette)

    // Faction styling
    perFactionBursts: true,     // if true, spawn some bursts colored per faction
    factionBias: 0.55,          // 0..1; higher = more likely to pick leading factions
    colorSaturation: 1.0,       // 0.5..1.6
    whiteHot: 0.35,             // 0..1; amount of white in hottest sparks

    // Placement controls
    bottomHeight: 240,          // px band used for bottom placement origins
    edgeInset: 42,              // px inset used for edges placement origins

    // Performance / caps
    maxRockets: 16,
    maxSparks: 4200,
    maxShockwaves: 24,
    maxFlares: 18,
    pixelRatioCap: 2.0          // cap DPR for performance
  },
  controls: [
    { key: "placement", label: "Placement", type: "select", options: [{ label: "Bottom", value: "bottom" }, { label: "Edges", value: "edges" }], default: "bottom" },
    { key: "mixMode", label: "Faction Mix Mode", type: "select", options: [{ label: "Weighted Blend", value: "weighted" }, { label: "Winner Takes Color", value: "winner" }], default: "weighted" },
    { key: "intensity", label: "Intensity", type: "range", min: 0, max: 2, step: 0.05, default: 1.4 },

    { key: "baseLaunchRate", label: "Base Launch Rate", type: "range", min: 0, max: 3, step: 0.05, default: 0.35 },
    { key: "hypeLaunchBoost", label: "Hype Launch Boost", type: "range", min: 0, max: 8, step: 0.1, default: 2.8 },
    { key: "spikeSensitivity", label: "Spike Sensitivity", type: "range", min: 0, max: 1, step: 0.02, default: 0.55 },

    { key: "rocketSpeed", label: "Rocket Speed", type: "range", min: 200, max: 1600, step: 20, default: 780 },
    { key: "rocketSpeedBoost", label: "Rocket Speed Boost", type: "range", min: 0, max: 1600, step: 20, default: 520 },
    { key: "burstParticles", label: "Burst Particles", type: "range", min: 20, max: 400, step: 10, default: 140 },
    { key: "burstParticlesBoost", label: "Burst Particles Boost", type: "range", min: 0, max: 800, step: 20, default: 260 },
    { key: "burstSpread", label: "Burst Spread", type: "range", min: 0.5, max: 2.5, step: 0.05, default: 1.0 },
    { key: "gravity", label: "Gravity", type: "range", min: 200, max: 1600, step: 20, default: 760 },

    { key: "trailLength", label: "Trail Length", type: "range", min: 0, max: 30, step: 1, default: 10 },
    { key: "trailAlpha", label: "Trail Alpha", type: "range", min: 0, max: 1, step: 0.02, default: 0.55 },
    { key: "glitter", label: "Glitter", type: "range", min: 0, max: 1, step: 0.02, default: 0.55 },
    { key: "emberFade", label: "Ember Fade", type: "range", min: 0.3, max: 3.0, step: 0.05, default: 1.15 },

    { key: "shockwave", label: "Shockwave", type: "range", min: 0, max: 1, step: 0.02, default: 0.75 },
    { key: "shockwaveWidth", label: "Shockwave Width", type: "range", min: 0.5, max: 10, step: 0.1, default: 3.0 },
    { key: "shockwaveLife", label: "Shockwave Life", type: "range", min: 0.2, max: 2.0, step: 0.05, default: 0.75 },
    { key: "bloom", label: "Bloom", type: "range", min: 0, max: 1, step: 0.02, default: 0.7 },
    { key: "flare", label: "Flare", type: "range", min: 0, max: 1, step: 0.02, default: 0.45 },

    { key: "shake", label: "Shake", type: "range", min: 0, max: 1, step: 0.02, default: 0.35 },
    { key: "vignette", label: "Vignette", type: "range", min: 0, max: 0.6, step: 0.02, default: 0.18 },

    { key: "perFactionBursts", label: "Per-Faction Bursts", type: "checkbox", default: true },
    { key: "factionBias", label: "Faction Bias", type: "range", min: 0, max: 1, step: 0.02, default: 0.55 },
    { key: "colorSaturation", label: "Color Saturation", type: "range", min: 0.5, max: 1.6, step: 0.05, default: 1.0 },
    { key: "whiteHot", label: "White Hot", type: "range", min: 0, max: 1, step: 0.02, default: 0.35 },

    { key: "bottomHeight", label: "Bottom Height", type: "range", min: 100, max: 520, step: 10, default: 240 },
    { key: "edgeInset", label: "Edge Inset", type: "range", min: 0, max: 180, step: 2, default: 42 },

    { key: "maxRockets", label: "Max Rockets", type: "range", min: 0, max: 40, step: 1, default: 16 },
    { key: "maxSparks", label: "Max Sparks", type: "range", min: 0, max: 12000, step: 200, default: 4200 },
    { key: "maxShockwaves", label: "Max Shockwaves", type: "range", min: 0, max: 80, step: 2, default: 24 },
    { key: "maxFlares", label: "Max Flares", type: "range", min: 0, max: 60, step: 2, default: 18 },
    { key: "pixelRatioCap", label: "Pixel Ratio Cap", type: "range", min: 1, max: 3, step: 0.1, default: 2.0 }
  ]
};

// ---------- helpers ----------
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return (a + Math.floor(Math.random() * (b - a + 1))); }

function parseHex(hex) {
  const h = String(hex || "").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return { r: 255, g: 210, b: 140 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(c, a) { return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${a})`; }
function mix(a, b, t) { return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) }; }

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
      const colorHex = it?.colorHex ?? it?.color ?? it?.hex ?? "#FFD28C";
      out.factions.push({ key, value, colorHex });
      out.total += Math.max(0, value);
    }
    return out;
  }

  if (typeof metersLike === "object") {
    for (const [key, v] of Object.entries(metersLike)) {
      if (!v || typeof v !== "object") continue;
      const value = Number(v.value ?? v.meter ?? v.hype ?? 0) || 0;
      const colorHex = v.colorHex ?? v.color ?? v.hex ?? "#FFD28C";
      out.factions.push({ key, value, colorHex });
      out.total += Math.max(0, value);
    }
  }

  if (typeof metersLike.totalHype === "number") out.total = metersLike.totalHype;
  if (typeof metersLike.total === "number") out.total = metersLike.total;

  return out;
}

function computeHype01(total) {
  const t = Math.max(0, Number(total) || 0);
  return clamp01(1 - Math.exp(-t / 30));
}

function computeMixColor(metersState, mixMode) {
  const factions = metersState.factions || [];
  if (!factions.length) return { r: 255, g: 210, b: 140 };

  const colors = factions.map(f => parseHex(f.colorHex));
  const weights = factions.map(f => Math.max(0, Number(f.value) || 0));

  if (mixMode === "winner") {
    let bestI = 0, bestW = -Infinity;
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > bestW) { bestW = weights[i]; bestI = i; }
    }
    return colors[bestI] || { r: 255, g: 210, b: 140 };
  }

  let sum = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < colors.length; i++) {
    const w = weights[i];
    sum += w;
    r += colors[i].r * w;
    g += colors[i].g * w;
    b += colors[i].b * w;
  }
  if (sum <= 0) return { r: 255, g: 210, b: 140 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function pickFactionColor(metersState, bias /*0..1*/, fallbackColor) {
  const factions = metersState.factions || [];
  if (!factions.length) return fallbackColor;

  // Build weighted list with optional bias toward leaders
  const vals = factions.map(f => Math.max(0, Number(f.value) || 0));
  const cols = factions.map(f => parseHex(f.colorHex));

  // Normalize weights; add bias by squaring weights as bias increases
  let wsum = 0;
  const w = vals.map(v => {
    const vv = v <= 0 ? 0.0001 : v;
    const b = lerp(1, 2.2, clamp01(bias));
    const ww = Math.pow(vv, b);
    wsum += ww;
    return ww;
  });

  if (wsum <= 0) return cols[0] || fallbackColor;

  let r = Math.random() * wsum;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return cols[i];
  }
  return cols[cols.length - 1] || fallbackColor;
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

function fitCanvasToDisplay(canvas, pixelRatioCap = 2) {
  const dprRaw = window.devicePixelRatio || 1;
  const dpr = Math.max(1, Math.min(pixelRatioCap, dprRaw));
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.max(1, Math.floor(rect.width * dpr));
  const targetH = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  return { w: canvas.width, h: canvas.height, dpr };
}

// ---------- style runtime ----------
export function init({ canvas, app, config } = {}) {
  const c = resolveCanvas(canvas);
  if (!c) return { destroy() {}, setConfig() {} };

  const ctx = c.getContext("2d");
  if (!ctx) return { destroy() {}, setConfig() {} };

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let metersState = normalizeMeters(app?.getState?.()?.meters || app?.getState?.() || null);
  const onMeters = (payload) => { metersState = normalizeMeters(payload?.meters ?? payload); };

  const unsub = [];
  try {
    if (app?.on) {
      app.on("meters", onMeters);
      unsub.push(() => app.off?.("meters", onMeters));
    }
  } catch (_) {}

  // world state
  let w = 0, h = 0;
  let raf = 0;
  let destroyed = false;

  const rockets = [];
  const sparks = [];
  const shockwaves = [];
  const flares = [];

  // spike detection
  let lastHype01 = 0;
  let spikeCooldown = 0;

  // screen shake
  let shakeX = 0, shakeY = 0;
  let shakeVel = 0;

  function resize() {
    const fit = fitCanvasToDisplay(c, Math.max(1, Number(cfg.pixelRatioCap) || 2));
    w = fit.w; h = fit.h;
  }
  resize();

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
  }

  function originPoint(placement) {
    if (placement === "edges") {
      const inset = Math.max(0, Number(cfg.edgeInset) || 0);
      const side = randInt(0, 3);
      if (side === 0) return { x: rand(inset, w - inset), y: inset + 2 };              // top
      if (side === 1) return { x: w - inset - 2, y: rand(inset, h - inset) };          // right
      if (side === 2) return { x: rand(inset, w - inset), y: h - inset - 2 };          // bottom
      return { x: inset + 2, y: rand(inset, h - inset) };                              // left
    }
    // bottom
    const bh = Math.max(80, Number(cfg.bottomHeight) || 240);
    return { x: rand(0.08 * w, 0.92 * w), y: h - rand(0.05 * bh, 0.85 * bh) };
  }

  function spawnRocket(hype01, colorBase, isMega = false) {
    if (rockets.length >= Math.max(0, Number(cfg.maxRockets) || 16)) return;

    const placement = cfg.placement === "edges" ? "edges" : "bottom";
    const o = originPoint(placement);

    // aim: bottom launches upward; edges aim inward
    let angle = -Math.PI / 2;
    if (placement === "edges") {
      const cx = w * 0.5, cy = h * 0.35;
      angle = Math.atan2(cy - o.y, cx - o.x) + rand(-0.35, 0.35);
    } else {
      angle = -Math.PI / 2 + rand(-0.35, 0.35);
    }

    const intensity = Math.max(0, Math.min(2, Number(cfg.intensity) || 1));
    const spBase = Math.max(100, Number(cfg.rocketSpeed) || 780);
    const spBoost = Math.max(0, Number(cfg.rocketSpeedBoost) || 520);
    const sp = (spBase + spBoost * hype01) * (0.85 + Math.random() * 0.3) * lerp(0.8, 1.25, intensity / 2) * (isMega ? 1.1 : 1);

    const vx = Math.cos(angle) * sp;
    const vy = Math.sin(angle) * sp;

    rockets.push({
      x: o.x, y: o.y,
      vx, vy,
      life: isMega ? rand(0.5, 0.95) : rand(0.45, 0.85),
      color: colorBase,
      mega: isMega,
      seed: Math.random() * Math.PI * 2
    });
  }

  function spawnBurst(x, y, hype01, baseColor, mega = false) {
    const intensity = Math.max(0, Math.min(2, Number(cfg.intensity) || 1));
    const sat = Math.max(0.5, Math.min(1.6, Number(cfg.colorSaturation) || 1));
    const whiteHot = clamp01(Number(cfg.whiteHot) || 0.35);

    const cSat = {
      r: Math.min(255, baseColor.r * sat),
      g: Math.min(255, baseColor.g * sat),
      b: Math.min(255, baseColor.b * sat)
    };

    const countBase = Math.max(5, Number(cfg.burstParticles) || 140);
    const countBoost = Math.max(0, Number(cfg.burstParticlesBoost) || 260);
    const count = Math.floor((countBase + countBoost * hype01) * lerp(0.75, 1.35, intensity / 2) * (mega ? 1.45 : 1));

    const spread = Math.max(0.5, Number(cfg.burstSpread) || 1) * (mega ? 1.15 : 1);

    const lifeBase = Math.max(0.25, Number(cfg.emberFade) || 1.15) * (mega ? 1.15 : 1);
    const trailLen = Math.max(0, Number(cfg.trailLength) || 10);
    const glitter = clamp01(Number(cfg.glitter) || 0.55);

    const maxSparks = Math.max(0, Number(cfg.maxSparks) || 4200);
    const budget = Math.max(0, maxSparks - sparks.length);
    const spawnN = Math.min(count, budget);

    for (let i = 0; i < spawnN; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(120, 780) * spread * (mega ? rand(0.85, 1.25) : 1);
      const vx = Math.cos(a) * v;
      const vy = Math.sin(a) * v;

      // white-hot core mixing for hottest sparks
      const hot = Math.pow(Math.random(), mega ? 0.35 : 0.6);
      const col = mix({ r: 255, g: 255, b: 255 }, cSat, lerp(whiteHot, 1, hot));

      sparks.push({
        x, y, vx, vy,
        life: lifeBase * rand(0.65, 1.25),
        age: 0,
        col,
        glitter,
        trail: trailLen ? new Array(Math.min(trailLen, 30)).fill(0).map(() => ({ x, y })) : null
      });
    }

    // shockwave
    const swAmt = clamp01(Number(cfg.shockwave) || 0.75) * (mega ? 1 : 0.85);
    if (Math.random() < swAmt) {
      const maxShock = Math.max(0, Number(cfg.maxShockwaves) || 24);
      if (shockwaves.length < maxShock) {
        shockwaves.push({
          x, y,
          r: mega ? 24 : 18,
          life: Math.max(0.15, Number(cfg.shockwaveLife) || 0.75) * (mega ? 1.15 : 1),
          age: 0,
          width: Math.max(0.5, Number(cfg.shockwaveWidth) || 3) * (mega ? 1.25 : 1),
          col: cSat
        });
      }
    }

    // flare accents (small cross + ring glints)
    const flareAmt = clamp01(Number(cfg.flare) || 0.45);
    if (flareAmt > 0 && Math.random() < flareAmt * (mega ? 1 : 0.7)) {
      const maxF = Math.max(0, Number(cfg.maxFlares) || 18);
      if (flares.length < maxF) {
        flares.push({
          x, y,
          life: mega ? rand(0.25, 0.55) : rand(0.18, 0.42),
          age: 0,
          col: cSat,
          s: (mega ? rand(18, 42) : rand(12, 28)) * lerp(0.9, 1.25, intensity / 2),
          rot: rand(0, Math.PI),
          a: flareAmt * (mega ? 1 : 0.75)
        });
      }
    }

    // shake on mega
    const shakeAmt = clamp01(Number(cfg.shake) || 0.35);
    if (mega && shakeAmt > 0.01) {
      shakeVel += (0.9 + hype01) * shakeAmt * 18;
    }
  }

  function maybeSpawnPerFactionBursts(hype01, mixColor) {
    const on = !!cfg.perFactionBursts;
    if (!on) return;

    // Occasionally spawn a burst that is explicitly one faction’s color,
    // biased toward top factions if factionBias is high.
    if (Math.random() < (0.08 + 0.22 * hype01)) {
      const col = pickFactionColor(metersState, clamp01(Number(cfg.factionBias) || 0.55), mixColor);
      spawnRocket(hype01, col, false);
    }
  }

  function drawVignette(amount) {
    const v = clamp01(amount);
    if (v <= 0.001) return;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${v})`);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  let lastT = (typeof performance !== "undefined" ? performance.now() : Date.now());
  function frame(tms) {
    if (destroyed) return;

    // Resize-safe
    const fit = fitCanvasToDisplay(c, Math.max(1, Number(cfg.pixelRatioCap) || 2));
    if (fit.w !== w || fit.h !== h) { w = fit.w; h = fit.h; }

    const dt = Math.min(0.05, Math.max(0.001, (tms - lastT) / 1000));
    lastT = tms;

    const hype01 = computeHype01(metersState.total);
    const mixColor = computeMixColor(metersState, cfg.mixMode);

    // spike detection: big delta in hype triggers mega blasts
    const dh = hype01 - lastHype01;
    lastHype01 = lerp(lastHype01, hype01, 0.25); // smooth
    spikeCooldown = Math.max(0, spikeCooldown - dt);

    const spikeSens = clamp01(Number(cfg.spikeSensitivity) || 0.55);
    const spikeThreshold = lerp(0.22, 0.08, spikeSens); // higher sensitivity => lower threshold
    const isSpike = (dh > spikeThreshold) && spikeCooldown <= 0;

    const intensity = Math.max(0, Math.min(2, Number(cfg.intensity) || 1));
    const rate = Math.max(0, Number(cfg.baseLaunchRate) || 0.35) + Math.max(0, Number(cfg.hypeLaunchBoost) || 2.8) * hype01;
    const spawnRate = rate * lerp(0.7, 1.45, intensity / 2);

    // integrate rocket spawns
    let carry = (frame._carry || 0) + spawnRate * dt;
    const spawnN = Math.min(6, Math.floor(carry));
    carry -= spawnN;
    frame._carry = carry;

    // on spike: immediate mega rockets + instant burst(s)
    if (isSpike) {
      spikeCooldown = 0.9; // cooldown
      const megaCount = 1 + (hype01 > 0.55 ? 1 : 0) + (hype01 > 0.8 ? 1 : 0);

      for (let i = 0; i < megaCount; i++) {
        const col = cfg.perFactionBursts
          ? pickFactionColor(metersState, clamp01(Number(cfg.factionBias) || 0.55), mixColor)
          : mixColor;
        spawnRocket(hype01, col, true);
      }

      // instant "camera flash" flare near top for cinematic pop
      const maxF = Math.max(0, Number(cfg.maxFlares) || 18);
      if (flares.length < maxF && clamp01(Number(cfg.flare) || 0.45) > 0) {
        flares.push({
          x: w * 0.5 + rand(-w * 0.1, w * 0.1),
          y: h * 0.18 + rand(-h * 0.05, h * 0.08),
          life: rand(0.18, 0.35),
          age: 0,
          col: { r: 255, g: 255, b: 255 },
          s: rand(26, 56) * lerp(0.9, 1.3, intensity / 2),
          rot: rand(0, Math.PI),
          a: clamp01(Number(cfg.flare) || 0.45) * 1.15
        });
      }
    }

    // normal spawns
    for (let i = 0; i < spawnN; i++) {
      spawnRocket(hype01, mixColor, false);
    }
    maybeSpawnPerFactionBursts(hype01, mixColor);

    // update rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.life -= dt;

      // rocket motion
      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // slight "wiggle" for cinematic arcs
      const wig = Math.sin((tms / 1000) * 7 + r.seed) * 18 * dt;
      r.x += wig;

      // if rocket expires or goes offscreen: burst
      const shouldBurst = (r.life <= 0) || (r.y < -40) || (r.x < -80) || (r.x > w + 80);
      if (shouldBurst) {
        const bx = Math.max(40, Math.min(w - 40, r.x));
        const by = Math.max(60, Math.min(h * 0.75, r.y));

        spawnBurst(bx, by, hype01, r.color, !!r.mega);
        rockets.splice(i, 1);
      }
    }

    // update sparks
    const g = Math.max(0, Number(cfg.gravity) || 760);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      s.life -= dt;

      // motion + gravity + slight drag
      s.vx *= Math.pow(0.985, dt * 60);
      s.vy *= Math.pow(0.985, dt * 60);
      s.vy += g * dt;

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // trail
      if (s.trail) {
        s.trail.pop();
        s.trail.unshift({ x: s.x, y: s.y });
      }

      if (s.life <= 0 || s.y > h + 120 || s.x < -160 || s.x > w + 160) {
        sparks.splice(i, 1);
      }
    }

    // update shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.age += dt;
      if (sw.age >= sw.life) { shockwaves.splice(i, 1); continue; }
      sw.r += (520 + 820 * hype01) * dt;
    }

    // update flares
    for (let i = flares.length - 1; i >= 0; i--) {
      const f = flares[i];
      f.age += dt;
      if (f.age >= f.life) { flares.splice(i, 1); continue; }
      f.rot += dt * 0.6;
    }

    // update shake
    shakeVel *= Math.pow(0.86, dt * 60);
    const shakeAmt = clamp01(Number(cfg.shake) || 0.35) * (0.35 + hype01 * 0.85) * intensity;
    shakeX = (Math.random() - 0.5) * shakeVel * shakeAmt;
    shakeY = (Math.random() - 0.5) * shakeVel * shakeAmt;

    // ---------- render ----------
    clear();

    // apply shake transform
    ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

    // sparks are additive for “Bruckheimer pop”
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const bloom = clamp01(Number(cfg.bloom) || 0.7) * (0.6 + hype01 * 0.7) * (0.65 + intensity * 0.7);

    // draw rocket heads as bright dots
    for (let i = 0; i < rockets.length; i++) {
      const r = rockets[i];
      ctx.beginPath();
      ctx.fillStyle = rgba(mix({ r: 255, g: 255, b: 255 }, r.color, 0.55), 0.75);
      ctx.arc(r.x, r.y, r.mega ? 3.6 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // draw spark trails
    const trailA = clamp01(Number(cfg.trailAlpha) || 0.55);
    if (trailA > 0.001) {
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        if (!s.trail) continue;

        const a0 = clamp01(trailA * (s.life / (s.life + s.age + 0.0001)));
        ctx.strokeStyle = rgba(s.col, a0 * 0.65);
        ctx.lineWidth = 1.4;

        ctx.beginPath();
        const t = s.trail;
        ctx.moveTo(t[0].x, t[0].y);
        for (let k = 1; k < t.length; k++) ctx.lineTo(t[k].x, t[k].y);
        ctx.stroke();
      }
    }

    // draw sparks (hot core + outer glow)
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const t = clamp01(s.life / (s.life + s.age + 0.0001));
      const baseA = (0.25 + 0.75 * t) * bloom;

      // glitter twinkle
      const gl = clamp01(s.glitter);
      const tw = gl > 0 ? (0.7 + 0.3 * Math.sin((tms / 1000) * 18 + i * 0.17)) : 1;
      const a = clamp01(baseA * tw);

      // outer glow dot
      ctx.beginPath();
      ctx.fillStyle = rgba(s.col, a * 0.20);
      ctx.arc(s.x, s.y, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // inner hot dot
      ctx.beginPath();
      ctx.fillStyle = rgba(s.col, a * 0.85);
      ctx.arc(s.x, s.y, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // shockwaves (still additive, slightly colored)
    for (let i = 0; i < shockwaves.length; i++) {
      const sw = shockwaves[i];
      const tt = clamp01(1 - sw.age / sw.life);
      const a = tt * 0.35 * (0.7 + hype01 * 0.6) * intensity;

      ctx.lineWidth = sw.width;
      ctx.strokeStyle = rgba(mix(sw.col, { r: 255, g: 255, b: 255 }, 0.55), a);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // flares (cross + ring)
    for (let i = 0; i < flares.length; i++) {
      const f = flares[i];
      const tt = clamp01(1 - f.age / f.life);
      const a = clamp01(f.a * tt * (0.65 + hype01 * 0.6) * intensity);

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);

      // ring
      ctx.strokeStyle = rgba(mix(f.col, { r: 255, g: 255, b: 255 }, 0.6), a * 0.35);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, f.s * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      // cross
      ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, a * 0.6);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-f.s, 0);
      ctx.lineTo(f.s, 0);
      ctx.moveTo(0, -f.s * 0.55);
      ctx.lineTo(0, f.s * 0.55);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore(); // end additive

    // cinematic vignette on top
    drawVignette(Number(cfg.vignette) || 0);

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame((tms) => {
    lastT = tms;
    frame(tms);
  });

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };

    // keep system stable after big changes
    rockets.length = 0;
    sparks.length = 0;
    shockwaves.length = 0;
    flares.length = 0;
    spikeCooldown = 0;
    shakeVel = 0;
    lastHype01 = 0;

    resize();
  }

  function destroy() {
    destroyed = true;
    try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
    for (const fn of unsub) { try { fn(); } catch (_) {} }
    clear();
  }

  const onResize = () => { try { resize(); } catch (_) {} };
  window.addEventListener("resize", onResize);
  unsub.push(() => window.removeEventListener("resize", onResize));

  return { destroy, setConfig };
}
