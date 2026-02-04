// public/overlays/styles/treeOfHype.js
// PRO Overlay: Tree Of Hype (sapling -> full tree; names on branches)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Notes:
// - Grows only after "deadzone" hype (default 20).
// - Names appear only if the meters snapshot includes `recentUsers`.
//   Example snapshot extension (non-breaking):
//     { factions:[...], recentUsers:["jay","alice","bob"] }
//
// Efficient:
// - Single canvas, procedural draw.
// - Stable branch points and stable name assignment using hashing.

'use strict';

export const meta = {
  styleKey: 'treeOfHype',
  name: 'Tree Of Hype (PRO)',
  tier: 'PRO',
  description:
    'A living tree that grows from nothing into a full canopy as hype rises. Optional chatter-name “leaf tags” appear on branches if the backend provides recentUsers.',

  defaultConfig: {
    // Hype mapping
    hypeK: 180,              // higher = slower response
    maxTotalClamp: 2200,     // safety clamp for total
    hypeSmoothing: 0.20,     // 0.05..0.5

    // Deadzone: show nothing until total hype exceeds this
    deadzone: 20,            // 0..200

    // Placement
    anchorX: 0.5,            // 0..1 (tree base)
    anchorY: 0.94,           // 0..1
    treeHeight: 0.78,        // 0.2..0.95 (fraction of screen height)
    treeLean: -0.04,         // -0.2..0.2

    // Visual tuning
    intensity: 1.0,          // 0..2
    wind: 0.55,              // 0..1 (wind strength)
    windSpeed: 0.7,          // 0.1..2
    swayMax: 0.10,           // radians, max sway at full hype

    // Branching
    branchLevels: 6,         // 3..9
    branchSplit: 0.68,       // 0.5..0.85  (length multiplier per level)
    branchSpread: 0.75,      // 0.35..1.25 (angle spread)
    branchJitter: 0.18,      // 0..0.5     (randomness)
    branchCountBase: 2,      // per node at low hype
    branchCountMax: 4,       // per node at high hype

    // Stroke
    trunkWidth: 10,          // px at base (scaled with screen)
    minWidth: 1.1,           // px
    barkAlpha: 0.85,         // 0..1
    glow: 0.25,              // 0..1

    // Leaves / canopy
    leafAlpha: 0.28,         // 0..0.9
    leafSize: 1.8,           // 0.5..6
    leafDensity: 1.0,        // 0..2 (more = more leaf dots)
    canopyHueShift: 0.08,    // 0..0.25

    // Names (requires `recentUsers`)
    namesEnabled: true,
    maxNames: 16,            // 0..48
    nameFontPx: 16,          // 10..26 (scaled by dpr)
    nameAlpha: 0.88,         // 0..1
    nameHalo: 0.55,          // 0..1
    nameMinHype: 0.18,       // 0..1 (don’t show names until tree is visible)

    // Performance
    fpsCap: 60,              // 15..60
    dprMax: 2.0,             // 1..2
    backgroundDim: 0.0       // 0..0.25
  },

  controls: [
    { key: 'deadzone', label: 'Deadzone (no tree under)', type: 'number', min: 0, max: 200, step: 1, default: 20 },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'wind', label: 'Wind Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'windSpeed', label: 'Wind Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.7 },

    { key: 'treeHeight', label: 'Tree Height', type: 'range', min: 0.2, max: 0.95, step: 0.01, default: 0.78 },
    { key: 'treeLean', label: 'Tree Lean', type: 'range', min: -0.2, max: 0.2, step: 0.01, default: -0.04 },

    { key: 'branchLevels', label: 'Branch Levels', type: 'range', min: 3, max: 9, step: 1, default: 6 },
    { key: 'branchSpread', label: 'Branch Spread', type: 'range', min: 0.35, max: 1.25, step: 0.01, default: 0.75 },
    { key: 'branchJitter', label: 'Branch Jitter', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'namesEnabled', label: 'Show Names', type: 'checkbox', default: true },
    { key: 'maxNames', label: 'Max Names', type: 'range', min: 0, max: 48, step: 1, default: 16 },
    { key: 'nameFontPx', label: 'Name Font Size', type: 'range', min: 10, max: 26, step: 1, default: 16 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 180 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.20 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.0 },
  ],
};

function clamp(n, a, b) { n = Number(n); return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a)); }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'treeOfHype';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';
  c.style.willChange = 'transform';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas, dprMax) {
  const dpr = Math.min(Number(dprMax) || 2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: W / dpr, h: H / dpr, dpr };
}

function hexToRgb(hex) {
  const h = String(hex || '#78c8ff').trim().replace('#', '');
  const n = parseInt(h.length === 3 ? (h[0]+h[0]+h[1]+h[1]+h[2]+h[2]) : h.padEnd(6,'0').slice(0,6), 16);
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
  if (sum <= 0) return { r: 120, g: 220, b: 150 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r, g, b };
}

function hash32(str) {
  // small stable hash for user names
  const s = String(str || '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Compute total hype + smoothed “h” (0..1) with deadzone handling
function computeHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];

  let total = 0;
  for (const f of factions) total += Math.max(0, Number(f?.meter) || 0);

  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2200, 200, 6000));

  // deadzone: nothing happens below this
  const dz = clamp(cfg.deadzone ?? 20, 0, 200);
  const adj = Math.max(0, total - dz);

  const k = clamp(cfg.hypeK ?? 180, 40, 600);
  let h = 1 - Math.exp(-adj / k);

  // tiny lift so it doesn’t pop harshly
  h = clamp01(h + (1 - h) * 0.05 * Math.min(1, adj / 80));

  // faction tint (green-biased fallback)
  let rgb = { r: 120, g: 220, b: 150 };
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = mixWeighted(colors, weights);
  }

  return { total, h, rgb };
}

function smoothstep01(x) {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
}

/**
 * Precompute branch endpoints (in normalized “tree space”):
 * tree space coordinates: (0,0) at base, +y upward, x sideways.
 * We build a deterministic “skeleton” that we can partially reveal by growth.
 */
function buildTreeSkeleton(seed, levels, split, spread, jitter) {
  const rnd = mulberry32(seed);
  const nodes = [];

  // Node: { x, y, ang, len, level, parentIndex, id }
  // Start trunk
  nodes.push({ x: 0, y: 0, ang: -Math.PI / 2, len: 1.0, level: 0, parentIndex: -1, id: 0 });

  let id = 1;
  let cursor = 0;

  while (cursor < nodes.length) {
    const n = nodes[cursor++];
    if (n.level >= levels) continue;

    const baseChildren = 2; // actual branching count modulated later by hype
    const childLen = n.len * split;

    for (let i = 0; i < baseChildren; i++) {
      const side = (i === 0) ? -1 : 1;
      const j = (rnd() - 0.5) * jitter;
      const a = n.ang + side * spread * (0.55 + 0.55 * rnd()) + j;

      const nx = n.x + Math.cos(n.ang) * n.len;
      const ny = n.y + Math.sin(n.ang) * n.len;

      nodes.push({
        x: nx,
        y: ny,
        ang: a,
        len: childLen * (0.85 + 0.35 * rnd()),
        level: n.level + 1,
        parentIndex: (cursor - 1),
        id: id++
      });
    }
  }

  return nodes;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function init({ root, config, api }) {
  // mount root (keep it simple like crownfall)
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Live state
  let latestSnap = { factions: [] };
  let hTarget = 0;
  let biasRgb = { r: 120, g: 220, b: 150 };

  // smooth
  let hSmooth = 0;
  let rgbSmooth = { r: 120, g: 220, b: 150 };

  // name state (stable)
  const userMap = new Map(); // name -> { name, addedAtMs }
  let lastUsersTouchMs = 0;

  // skeleton is deterministic per streamer session, not per frame
  // seed is based on token-ish randomness if present in snap, otherwise time
  let skeletonSeed = (Date.now() & 0xffffffff) >>> 0;
  let skeleton = null;

  // loop
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };

    // If your backend adds usernames, it can be either:
    // - recentUsers: ["name1","name2"]
    // - recentUsers: [{name:"x"}, ...]
    // - chatters: similar
    const rawUsers =
      latestSnap.recentUsers ??
      latestSnap.chatters ??
      latestSnap.users ??
      null;

    if (rawUsers && Array.isArray(rawUsers)) {
      const now = Date.now();
      lastUsersTouchMs = now;
      for (const u of rawUsers) {
        const name = (typeof u === 'string') ? u : (u && (u.name || u.displayName || u.login));
        const clean = String(name || '').trim();
        if (!clean) continue;
        if (!userMap.has(clean)) userMap.set(clean, { name: clean, addedAtMs: now });
      }
      // Trim to a safe size, prefer newest
      const maxKeep = Math.max(16, clamp(cfg.maxNames, 0, 96) * 3);
      if (userMap.size > maxKeep) {
        const arr = Array.from(userMap.values()).sort((a, b) => b.addedAtMs - a.addedAtMs);
        userMap.clear();
        for (let i = 0; i < maxKeep; i++) userMap.set(arr[i].name, arr[i]);
      }
    }

    const res = computeHype(latestSnap, cfg);
    hTarget = res.h;
    biasRgb = res.rgb;

    // if skeleton not built, build it once
    if (!skeleton) {
      skeletonSeed ^= ((res.total * 997) | 0);
      skeleton = buildTreeSkeleton(
        skeletonSeed,
        clamp(cfg.branchLevels, 3, 9),
        clamp(cfg.branchSplit, 0.5, 0.85),
        clamp(cfg.branchSpread, 0.35, 1.25),
        clamp(cfg.branchJitter, 0, 0.5)
      );
    }
  });

  function resize() {
    const { w, h, dpr } = resizeCanvas(canvas, cfg.dprMax ?? 2.0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize, { passive: true });

  function drawDim(w, h, amount) {
    if (amount <= 0) return;
    ctx.save();
    ctx.globalAlpha = amount;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawTree(w, h, t) {
    if (!skeleton) return;

    const intensity = clamp(cfg.intensity, 0, 2);
    const hVis = clamp01(hSmooth * intensity);

    // if still basically “off”, do nothing
    if (hVis < 0.001) return;

    // Tree placement
    const baseX = clamp(cfg.anchorX, 0, 1) * w;
    const baseY = clamp(cfg.anchorY, 0, 1) * h;
    const H = clamp(cfg.treeHeight, 0.2, 0.95) * h;

    // Wind + sway
    const wind = clamp01(cfg.wind);
    const ws = clamp(cfg.windSpeed, 0.1, 2);
    const swayMax = clamp(cfg.swayMax, 0.01, 0.25);
    const sway = Math.sin(t * 1.2 * ws) * swayMax * wind * (0.15 + 0.85 * hVis);

    // Lean
    const lean = clamp(cfg.treeLean, -0.2, 0.2);

    // Stroke widths scale with screen
    const trunkBase = clamp(cfg.trunkWidth, 2, 24) * (w / 1280);
    const minW = clamp(cfg.minWidth, 0.6, 4);

    // Bark color biased by factions (muted)
    const br = biasRgb.r | 0, bg = biasRgb.g | 0, bb = biasRgb.b | 0;
    const barkA = clamp01(cfg.barkAlpha);
    const bark = `rgba(${(br*0.45+60)|0},${(bg*0.45+50)|0},${(bb*0.45+35)|0},${barkA})`;

    // Glow
    const glow = clamp01(cfg.glow);

    // Growth: reveals more depth & more branch count
    const g = smoothstep01(hVis);
    const levels = clamp(cfg.branchLevels, 3, 9);
    const visibleLevel = Math.floor(lerp(1, levels, g));
    const extraBranchChance = g; // more forks at higher hype

    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(lean + sway);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = bark;

    ctx.shadowColor = `rgba(255,255,255,${0.35 * glow})`;
    ctx.shadowBlur = (6 + 30 * glow) * (0.25 + 0.9 * g);

    // Draw each node as a segment from its parent endpoint to its own endpoint
    for (let i = 0; i < skeleton.length; i++) {
      const n = skeleton[i];
      if (n.level === 0) continue;
      if (n.level > visibleLevel) continue;

      // endpoint of parent
      const p = skeleton[n.parentIndex];

      // compute parent end in tree space
      const px = p.x + Math.cos(p.ang) * p.len;
      const py = p.y + Math.sin(p.ang) * p.len;

      // compute this end
      const ex = n.x + Math.cos(n.ang) * n.len;
      const ey = n.y + Math.sin(n.ang) * n.len;

      // map to screen pixels: tree space y is up (-), so invert y
      const sx0 = (p.x) * H;
      const sy0 = (-p.y) * H;
      const sx1 = (px) * H;
      const sy1 = (-py) * H;

      const sx2 = (n.x) * H;
      const sy2 = (-n.y) * H;
      const sx3 = (ex) * H;
      const sy3 = (-ey) * H;

      // thickness: taper by level + grow by hype
      const taper = Math.pow(0.62, n.level);
      const w0 = Math.max(minW, trunkBase * (0.60 + 0.75 * g) * taper);

      // partial reveal within the current visibleLevel for smooth growth
      let localReveal = 1;
      if (n.level === visibleLevel) {
        const fracLevel = (lerp(1, levels, g) - visibleLevel); // 0..1
        localReveal = clamp01(fracLevel + 0.15);
      }

      ctx.lineWidth = w0;

      ctx.beginPath();
      // gentle curve to feel organic
      const cx = lerp(sx1, sx3, 0.45) + Math.sin(t * 0.7 + n.id) * H * 0.005 * wind * g;
      const cy = lerp(sy1, sy3, 0.45) + Math.cos(t * 0.8 + n.id) * H * 0.005 * wind * g;

      const tx = lerp(sx1, sx3, localReveal);
      const ty = lerp(sy1, sy3, localReveal);

      ctx.moveTo(sx1, sy1);
      ctx.quadraticCurveTo(cx, cy, tx, ty);
      ctx.stroke();

      // extra forks at higher hype: draw a subtle “twig” occasionally
      if (n.level >= 2 && n.level < visibleLevel && Math.random() < (0.015 + 0.06 * extraBranchChance)) {
        const twigAng = n.ang + (Math.random() < 0.5 ? -1 : 1) * (0.35 + 0.45 * Math.random());
        const tl = n.len * (0.35 + 0.25 * Math.random());
        const tx2 = (n.x + Math.cos(n.ang) * n.len) * H;
        const ty2 = -(n.y + Math.sin(n.ang) * n.len) * H;
        const tx3 = (n.x + Math.cos(twigAng) * tl + Math.cos(n.ang) * n.len) * H;
        const ty3 = -(n.y + Math.sin(twigAng) * tl + Math.sin(n.ang) * n.len) * H;

        ctx.lineWidth = Math.max(minW, w0 * 0.55);
        ctx.beginPath();
        ctx.moveTo(tx2, ty2);
        ctx.lineTo(tx3, ty3);
        ctx.stroke();
      }
    }

    // Leaves / canopy at higher hype
    const leafOn = clamp01((g - 0.25) / 0.75);
    if (leafOn > 0.001) {
      const leafA = clamp01(cfg.leafAlpha) * leafOn;
      const size = clamp(cfg.leafSize, 0.5, 6) * (w / 1280);
      const density = clamp(cfg.leafDensity, 0, 2);

      // A gentle hue shift from faction tint + time
      const hue = frac((biasRgb.g / 255) * 0.15 + t * 0.03 * (0.6 + leafOn) + cfg.canopyHueShift);
      const rgb = hsvToRgb(hue, 0.55, 1.0);
      const leafFill = `rgba(${(rgb.r*255)|0},${(rgb.g*255)|0},${(rgb.b*255)|0},${leafA})`;

      ctx.shadowBlur = (8 + 26 * glow) * (0.35 + 0.65 * leafOn);
      ctx.shadowColor = `rgba(255,255,255,${0.22 * glow})`;
      ctx.fillStyle = leafFill;

      // pick endpoints (higher-level nodes) and sprinkle around them
      const sprinkleCount = Math.floor(lerp(40, 420, leafOn) * density);

      for (let i = 0; i < sprinkleCount; i++) {
        const idx = 1 + ((i * 97) % (skeleton.length - 1));
        const n = skeleton[idx];
        if (n.level < Math.max(2, Math.floor(visibleLevel * 0.55))) continue;

        const ex = (n.x + Math.cos(n.ang) * n.len) * H;
        const ey = -(n.y + Math.sin(n.ang) * n.len) * H;

        const r = (0.01 + 0.045 * Math.random()) * H * (0.4 + 0.6 * leafOn);
        const a = Math.random() * Math.PI * 2;

        const lx = ex + Math.cos(a) * r + Math.sin(t * 1.3 + i) * H * 0.003 * wind;
        const ly = ey + Math.sin(a) * r + Math.cos(t * 1.2 + i) * H * 0.003 * wind;

        ctx.beginPath();
        ctx.arc(lx, ly, size * (0.7 + 1.1 * Math.random()), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawNames(w, h, t) {
    if (!cfg.namesEnabled) return;

    const intensity = clamp(cfg.intensity, 0, 2);
    const hVis = clamp01(hSmooth * intensity);
    if (hVis < clamp01(cfg.nameMinHype ?? 0.18)) return;

    const maxNames = Math.max(0, Math.min(48, (cfg.maxNames | 0) || 0));
    if (maxNames <= 0) return;
    if (!skeleton) return;

    // If chat isn’t feeding users, nothing to draw
    if (userMap.size === 0) return;

    // Prefer newest users
    const users = Array.from(userMap.values())
      .sort((a, b) => b.addedAtMs - a.addedAtMs)
      .slice(0, maxNames);

    const baseX = clamp(cfg.anchorX, 0, 1) * w;
    const baseY = clamp(cfg.anchorY, 0, 1) * h;
    const H = clamp(cfg.treeHeight, 0.2, 0.95) * h;

    const wind = clamp01(cfg.wind);
    const ws = clamp(cfg.windSpeed, 0.1, 2);
    const swayMax = clamp(cfg.swayMax, 0.01, 0.25);
    const sway = Math.sin(t * 1.2 * ws) * swayMax * wind * (0.15 + 0.85 * hVis);
    const lean = clamp(cfg.treeLean, -0.2, 0.2);

    const fontPx = clamp(cfg.nameFontPx, 10, 26) * (w / 1280);
    const alpha = clamp01(cfg.nameAlpha) * (0.55 + 0.45 * hVis);
    const halo = clamp01(cfg.nameHalo);

    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(lean + sway);

    ctx.font = `600 ${fontPx | 0}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textBaseline = 'middle';

    ctx.shadowBlur = (6 + 18 * halo) * (0.6 + 0.4 * hVis);
    ctx.shadowColor = `rgba(0,0,0,${0.55 * halo})`;

    // Choose a pool of “label points” from higher-level endpoints
    const candidates = [];
    for (let i = 0; i < skeleton.length; i++) {
      const n = skeleton[i];
      if (n.level < 3) continue;
      // endpoint
      const ex = (n.x + Math.cos(n.ang) * n.len) * H;
      const ey = -(n.y + Math.sin(n.ang) * n.len) * H;
      candidates.push({ x: ex, y: ey, n });
    }
    if (candidates.length === 0) { ctx.restore(); return; }

    // Place each user at a stable candidate index based on hash
    const used = new Set();
    for (const u of users) {
      const h32 = hash32(u.name);
      let idx = h32 % candidates.length;

      // resolve collisions lightly
      for (let tries = 0; tries < 8 && used.has(idx); tries++) idx = (idx + 13) % candidates.length;
      used.add(idx);

      const p = candidates[idx];

      // jitter slightly for organic placement
      const jx = (Math.sin(t * 1.15 + (h32 % 997)) * 0.004 + (frac(h32 / 65535) - 0.5) * 0.004) * H;
      const jy = (Math.cos(t * 1.08 + (h32 % 1237)) * 0.004 + (frac(h32 / 131071) - 0.5) * 0.004) * H;

      // color: near-white with a hint of faction tint
      const br = biasRgb.r | 0, bg = biasRgb.g | 0, bb = biasRgb.b | 0;
      const r = (lerp(245, br, 0.15)) | 0;
      const g = (lerp(250, bg, 0.15)) | 0;
      const b = (lerp(245, bb, 0.15)) | 0;

      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;

      // choose alignment by which side of trunk it’s on
      const alignRight = p.x >= 0;
      ctx.textAlign = alignRight ? 'left' : 'right';

      const pad = 10 + 18 * (w / 1280);
      const x = p.x + jx + (alignRight ? pad : -pad);
      const y = p.y + jy;

      // little “tag stem”
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * alpha})`;
      ctx.lineWidth = Math.max(1, (w / 1280) * 1.2);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(x + (alignRight ? -6 : 6), y);
      ctx.stroke();
      ctx.restore();

      ctx.fillText(u.name, x, y);
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
    const smooth = clamp(cfg.hypeSmoothing ?? 0.2, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth);

    // Smooth color
    rgbSmooth.r = lerp(rgbSmooth.r, biasRgb.r, 1 - Math.exp(-8 * dt));
    rgbSmooth.g = lerp(rgbSmooth.g, biasRgb.g, 1 - Math.exp(-8 * dt));
    rgbSmooth.b = lerp(rgbSmooth.b, biasRgb.b, 1 - Math.exp(-8 * dt));

    // If chat isn’t sending users anymore, slowly expire oldest entries
    // (keeps tree “fresh” but not flickery)
    if (userMap.size && Date.now() - lastUsersTouchMs > 15_000) {
      const arr = Array.from(userMap.values()).sort((a, b) => a.addedAtMs - b.addedAtMs);
      // expire a couple
      for (let i = 0; i < Math.min(2, arr.length); i++) userMap.delete(arr[i].name);
    }

    const { w, h } = resize();
    const t = nowMs / 1000;

    ctx.clearRect(0, 0, w, h);

    const dim = clamp(cfg.backgroundDim, 0, 0.25) * (0.25 + 0.75 * smoothstep01(hSmooth));
    drawDim(w, h, dim);

    // Use smoothed rgb as bias for canopy/names
    biasRgb = rgbSmooth;

    drawTree(w, h, t);
    drawNames(w, h, t);
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    // rebuild skeleton if branching params changed a lot
    skeleton = null;
    const res = computeHype(latestSnap, cfg);
    hTarget = res.h;
    biasRgb = res.rgb;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    userMap.clear();
    skeleton = null;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  // kick
  resize();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
