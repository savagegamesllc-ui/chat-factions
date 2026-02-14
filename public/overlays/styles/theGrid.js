// public/overlays/styles/theGrid.js
// PRO Overlay: theGrid
//
// UPDATE (this redraw):
// - Rail endpoints now terminate with a PCB-style via (circle) on EVERY rail.
// - Optional polish:
//    • Primary rails get a slightly larger end via.
//    • Leader-faction rails get a slightly brighter/larger end via.
// - Routing rules unchanged. CPU draw remains LOCKED.

'use strict';

export const meta = {
  styleKey: 'theGrid',
  name: 'theGrid',
  tier: 'PRO',
  description:
    'TRON-style edge rails routed from a CPU hub. Faction-colored data packets flow from the CPU based on hype. Bits spark a faction rail; subs trigger pandemonium overload.',

  defaultConfig: {
    top_edge: 'yes',
    right_edge: 'yes',
    bottom_edge: 'yes',
    left_edge: 'yes',

    baseGlowColor: 'cyberBlue',
    baseGlowStrength: 0.45,

    // Corner PCB Life
    cornerPcb_enabled: 'yes',
    cornerPcb_zonePct: 0.14,
    cornerPcb_traces: 7,
    cornerPcb_traceAlpha: 0.22,
    cornerPcb_glow: 0.45,
    cornerPcb_pulseMinHz: 0.18,
    cornerPcb_pulseMaxHz: 0.55,
    cornerPcb_pulseJitter: 0.12,
    cornerPcb_viaRadiusPct: 0.0065,
    cornerPcb_traceThicknessPct: 0.0026,

    // Rail PCB Flavor
    railPcb_enabled: 'yes',
    railPcb_viaRadiusPct: 0.0062,
    railPcb_padLenPct: 0.020,
    railPcb_padAlpha: 0.22,
    railPcb_viaAlpha: 0.26,
    railPcb_parallelChance: 0.45, // chance a rail gets 1-2 short parallel segments
    railPcb_parallelOffsetPct: 0.007,
    railPcb_parallelAlpha: 0.18,
    railPcb_pulseMinHz: 0.16,
    railPcb_pulseMaxHz: 0.48,
    railPcb_pulseJitter: 0.12,

    // NEW: Endpoint via accents
    railPcb_endViaScalePrimary: 1.12,
    railPcb_endViaScaleLeader: 1.18,
    railPcb_endViaAlphaBoostLeader: 0.10,

    demo_enabled: 'yes',
    demo_noDataMs: 1500,
    demo_cycleSeconds: 12,
    demo_lowMeter: 35,
    demo_maxMeter: 850,
    demo_factions: 3,
    demo_leaderIndex: 0,
    demo_colors: 'cyberBlue,neonGreen,ledRed,digitalWhite',

    safeInsetPct: 0.02,
    edgeRailInsetPct: 0.010,
    edgeRailLaneGapPct: 0.007,
    cornerRadiusPct: 0.02,

    cpuY: 0.50,
    cpuScalePct: 0.092,
    cpuInsetPct: 0.010,
    cpuGlow: 0.90,
    cpuGlowBoostAtMax: 0.85,

    cpuPinCount: 12,
    cpuPinLengthPct: 0.020,
    cpuPinThicknessPct: 0.0032,
    cpuPinGapPct: 0.0035,

    railsPerEdge: 6,
    railThicknessPct: 0.0054,
    railGlow: 0.62,
    railAlpha: 0.74,
    stubDepthPct: 0.10,
    stubChancePerLane: 0.55,
    exitChance: 0.50,

    end45Chance: 0.30,
    end45LenPct: 0.020,

    packetSpeed: 0.36,
    packetSpeedAtMax: 1.20,
    packetGlow: 0.80,
    packetAlpha: 0.98,
    packetSizeMul: 1.30,
    packetTrail: 0.55,
    packetBaseRate: 0.80,
    packetBoostRate: 18.0,
    packetMaxLive: 420,

    hypeK: 180,
    maxTotalClamp: 2400,
    hypeSmoothing: 0.18,

    bitsSparkLife: 0.60,
    bitsSparkSpeed: 2.8,
    bitsSparkBurstMin: 2,
    bitsSparkBurstMax: 7,
    bitsSparkCooldownMs: 200,

    subPandemoniumMs: 2400,
    subLockMs: 260,
    subRecoverMs: 650,
    subSparkRate: 160,
    subPacketRate: 75,

    fpsCap: 60,
    dprCap: 2
  },

  controls: [
    { key: 'top_edge', label: 'Top Edge', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'right_edge', label: 'Right Edge', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'bottom_edge', label: 'Bottom Edge', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'left_edge', label: 'Left Edge', type: 'select', options: ['yes', 'no'], default: 'yes' },

    { key: 'baseGlowColor', label: 'Base Glow Color', type: 'select', options: ['cyberBlue', 'neonGreen', 'ledRed', 'digitalWhite'], default: 'cyberBlue' },
    { key: 'baseGlowStrength', label: 'Base Glow Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },

    { key: 'cornerPcb_enabled', label: 'Corner PCB Life', type: 'select', options: ['yes', 'no'], default: 'yes' },
    { key: 'railPcb_enabled', label: 'Rail PCB Flavor', type: 'select', options: ['yes', 'no'], default: 'yes' },

    { key: 'demo_enabled', label: 'Demo Mode', type: 'select', options: ['yes', 'no'], default: 'yes' },

    { key: 'railsPerEdge', label: 'Rails Per Edge', type: 'range', min: 1, max: 6, step: 1, default: 6 },
    { key: 'railThicknessPct', label: 'Rail Thickness', type: 'range', min: 0.0015, max: 0.014, step: 0.0001, default: 0.0054 },
    { key: 'end45Chance', label: '45° Termination Chance', type: 'range', min: 0, max: 1, step: 0.05, default: 0.30 }
  ]
};

// ---------- utilities ----------
function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function yes(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' || s === 'on';
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex) {
  const h = String(hex || '#66ccff').trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba({ r, g, b }, a) {
  return `rgba(${r|0},${g|0},${b|0},${clamp01(a)})`;
}

function paletteRgb(name) {
  switch (String(name || '').trim()) {
    case 'neonGreen': return { r: 60, g: 255, b: 140 };
    case 'ledRed': return { r: 255, g: 60, b: 85 };
    case 'digitalWhite': return { r: 240, g: 248, b: 255 };
    case 'cyberBlue':
    default: return { r: 90, g: 210, b: 255 };
  }
}

function parseDemoColors(str) {
  const parts = String(str || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return [paletteRgb('cyberBlue'), paletteRgb('neonGreen'), paletteRgb('ledRed')];
  return parts.map(paletteRgb);
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'theGrid';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas, dprCap = 2) {
  const dpr = Math.min(clamp(dprCap, 1, 3), window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: rect.width, h: rect.height, dpr };
}

function pathPrecompute(points) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    seg.push({ a, b, len, total0: total, dx, dy });
    total += len;
  }
  return { points, seg, total: Math.max(1e-6, total) };
}

function pathPointAt(path, t01) {
  const d = clamp01(t01) * path.total;
  const segs = path.seg;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (d <= s.total0 + s.len || i === segs.length - 1) {
      const u = (d - s.total0) / Math.max(1e-6, s.len);
      return { x: s.a.x + s.dx * u, y: s.a.y + s.dy * u };
    }
  }
  return { x: path.points[0].x, y: path.points[0].y };
}

function roundCapsule(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function maybeAddEnd45(points, edge, rng, lenPx, chance, keepOut) {
  if (rng() > chance) return;
  const last = points[points.length - 1];
  const s = lenPx / Math.SQRT2;

  let dx = 0, dy = 0;
  switch (edge) {
    case 'top':    dx = +s; dy = +s; break;
    case 'bottom': dx = +s; dy = -s; break;
    case 'left':   dx = +s; dy = +s; break;
    case 'right':  dx = -s; dy = +s; break;
    default:       dx = +s; dy = +s; break;
  }
  if (rng() < 0.5) dy = -dy;

  const x = last.x + dx;
  const y = last.y + dy;

  if (keepOut?.length) {
    for (const z of keepOut) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return;
    }
  }

  points.push({ x, y });
}

function buildTerminationPlan({ lanes, innerToOuter, rng, boundsMin, boundsMax, minStep }) {
  const raw = new Array(lanes).fill(0);
  for (let lane = 0; lane < lanes; lane++) raw[lane] = lerp(boundsMin, boundsMax, 0.18 + rng() * 0.64);
  let prev = -Infinity;
  for (let i = 0; i < innerToOuter.length; i++) {
    const lane = innerToOuter[i];
    raw[lane] = Math.min(boundsMax, Math.max(raw[lane], prev + minStep));
    prev = raw[lane];
  }
  return raw;
}

// Rail “pads/vias” discovery (turn points + start pad + END via)
function computeRailNodes(points, rng) {
  const nodes = [];

  // turns -> vias
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const abx = b.x - a.x, aby = b.y - a.y;
    const bcx = c.x - b.x, bcy = c.y - b.y;
    const abH = Math.abs(abx) > Math.abs(aby) ? 'h' : 'v';
    const bcH = Math.abs(bcx) > Math.abs(bcy) ? 'h' : 'v';
    if (abH !== bcH) nodes.push({ x: b.x, y: b.y, kind: 'via' });
  }

  // start: small pad (near CPU)
  if (points.length) {
    const p0 = points[0];
    nodes.push({ x: p0.x, y: p0.y, kind: 'pad' });
  }

  // 1–2 mid pads
  const mids = 1 + (rng() < 0.45 ? 1 : 0);
  for (let k = 0; k < mids; k++) {
    const idx = 1 + ((rng() * Math.max(1, points.length - 2)) | 0);
    const p = points[idx];
    nodes.push({ x: p.x, y: p.y, kind: 'pad' });
  }

  // END: termination via (circle)
  if (points.length) {
    const pN = points[points.length - 1];
    nodes.push({ x: pN.x, y: pN.y, kind: 'endVia' });
  }

  return nodes;
}

// short “parallel trace” segments near a rail (visual only)
function computeParallelSegments(points, rng, chance) {
  if (rng() > chance) return [];
  const segs = [];

  const count = 1 + (rng() < 0.50 ? 1 : 0);

  for (let i = 0; i < count; i++) {
    const sidx = (rng() * Math.max(1, points.length - 1)) | 0;
    const a = points[sidx];
    const b = points[Math.min(points.length - 1, sidx + 1)];
    const t0 = 0.18 + rng() * 0.20;
    const t1 = 0.62 + rng() * 0.22;

    segs.push({
      ax: lerp(a.x, b.x, t0),
      ay: lerp(a.y, b.y, t0),
      bx: lerp(a.x, b.x, t1),
      by: lerp(a.y, b.y, t1),
      phase: rng() * Math.PI * 2,
      hz: 0.16 + rng() * 0.40
    });
  }

  return segs;
}

// ---------- main ----------
export function init({ root, config, api }) {
  const cfg = { ...meta.defaultConfig, ...(config || {}) };

  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true });

  let W = 0, H = 0, dpr = 1, minDim = 0;

  let hTarget = 0;
  let hSmooth = 0;
  let factions = [];
  let leader = { idx: 0, colorHex: '#66ccff', rgb: hexToRgb('#66ccff') };

  let lastMeterAt = 0;
  let hasEverReceivedMeters = false;

  let cpu = { x: 0, y: 0, w: 0, h: 0, r: 0, pinLen: 0, pinTh: 0, pinGap: 0 };
  let cpuPins = [];

  let enabledEdges = [];
  let rails = [];
  let railsByFaction = new Map();
  let packetCarry = new Map();

  let lastEdgeMask = '';
  let lastLayoutSeed = 0;

  let termPlan = { top: null, bottom: null, left: null, right: null };

  let pcbKeepOut = [];
  let pcbCorners = [];

  const particles = [];
  const maxLive = () => (cfg.packetMaxLive | 0) || 420;

  let pandemoniumUntil = 0;
  let pandemoniumLockUntil = 0;
  let pandemoniumRecoverUntil = 0;
  let lastBitsSparkAt = 0;

  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  function computeEdgeMask() {
    return [
      yes(cfg.top_edge) ? 'T' : '-',
      yes(cfg.right_edge) ? 'R' : '-',
      yes(cfg.bottom_edge) ? 'B' : '-',
      yes(cfg.left_edge) ? 'L' : '-'
    ].join('');
  }

  function rebuildIfNeeded(force = false) {
    const mask = computeEdgeMask();
    if (!force && mask === lastEdgeMask) return;
    lastEdgeMask = mask;
    rebuildGeometry(mask);
  }

  function computeFactionsAndHype(snap) {
    const list = Array.isArray(snap?.factions) ? snap.factions : [];
    const maxClamp = clamp(cfg.maxTotalClamp, 200, 6000);
    const k = clamp(cfg.hypeK, 40, 600);

    let total = 0;
    let bestIdx = 0;
    let bestMeter = -Infinity;

    factions = list.map((f, idx) => {
      const m = clamp(+f.meter || 0, 0, maxClamp);
      total += m;
      if (m > bestMeter) { bestMeter = m; bestIdx = idx; }
      const colorHex = f.colorHex || '#66ccff';
      return { idx, meter: m, colorHex, rgb: hexToRgb(colorHex), h01: 0 };
    });

    total = clamp(total, 0, maxClamp);
    hTarget = 1 - Math.exp(-total / k);

    if (factions.length > 0) {
      const lf = factions[bestIdx] || factions[0];
      leader = { idx: lf.idx, colorHex: lf.colorHex, rgb: lf.rgb };
    } else {
      leader = { idx: 0, colorHex: '#66ccff', rgb: hexToRgb('#66ccff') };
    }

    const fk = Math.max(20, k * 0.55);
    for (const f of factions) f.h01 = 1 - Math.exp(-Math.max(0, f.meter) / fk);

    for (const f of factions) if (!packetCarry.has(f.idx)) packetCarry.set(f.idx, 0);
  }

  const unsubMeters = api.onMeters((snap) => {
    lastMeterAt = performance.now();
    hasEverReceivedMeters = true;
    computeFactionsAndHype(snap || { factions: [] });
  });

  function applyDemoIfNoData(nowMs) {
    if (!yes(cfg.demo_enabled)) return;

    const noDataMs = clamp(cfg.demo_noDataMs, 250, 20000);
    const stale = !hasEverReceivedMeters || (nowMs - lastMeterAt > noDataMs);
    if (!stale) return;

    const demoCount = clamp(cfg.demo_factions, 2, 4) | 0;
    const colors = parseDemoColors(cfg.demo_colors);
    const k = clamp(cfg.hypeK, 40, 600);
    const maxClamp = clamp(cfg.maxTotalClamp, 200, 6000);

    const cycle = clamp(cfg.demo_cycleSeconds, 4, 60);
    const phase = (nowMs / 1000) % cycle;
    const half = cycle / 2;
    let t = phase < half ? (phase / half) : ((phase - half) / half);
    const isMax = phase >= half;
    t = t * t * (3 - 2 * t);

    const low = clamp(cfg.demo_lowMeter, 0, maxClamp);
    const high = clamp(cfg.demo_maxMeter, low, maxClamp);
    const meterVal = isMax ? lerp(low, high, t) : lerp(high, low, t);

    const leaderIdx = clamp(cfg.demo_leaderIndex, 0, demoCount - 1) | 0;

    const demo = [];
    for (let i = 0; i < demoCount; i++) {
      const c = colors[i % colors.length];
      demo.push({ idx: i, meter: meterVal * (0.92 + 0.16 * ((i + 1) / demoCount)), colorHex: '#000000', rgb: c, h01: 0 });
    }

    let total = 0;
    for (const f of demo) total += f.meter;
    total = clamp(total, 0, maxClamp);
    hTarget = 1 - Math.exp(-total / k);

    const lf = demo[leaderIdx] || demo[0];
    leader = { idx: lf.idx, colorHex: '#000000', rgb: lf.rgb };

    const fk = Math.max(20, k * 0.55);
    for (const f of demo) f.h01 = 1 - Math.exp(-Math.max(0, f.meter) / fk);

    factions = demo;
    for (const f of factions) if (!packetCarry.has(f.idx)) packetCarry.set(f.idx, 0);
  }

  function hookEventsIfPresent() {
    const bitsHandler = (payload) => triggerBitsSparks(payload);
    const subHandler = () => triggerPandemonium();

    try {
      if (typeof api.onEvent === 'function') {
        api.onEvent('bits', bitsHandler);
        api.onEvent('cheer', bitsHandler);
        api.onEvent('sub', subHandler);
        api.onEvent('subscription', subHandler);
      }
    } catch {}

    try { if (typeof api.onBits === 'function') api.onBits(bitsHandler); } catch {}
    try { if (typeof api.onCheer === 'function') api.onCheer(bitsHandler); } catch {}
    try { if (typeof api.onSub === 'function') api.onSub(subHandler); } catch {}
    try { if (typeof api.onSubscription === 'function') api.onSubscription(subHandler); } catch {}
  }
  hookEventsIfPresent();

  function chooseFactionForBits(payload) {
    if (payload && Number.isFinite(+payload.factionIdx)) {
      const idx = Math.max(0, Math.min(factions.length - 1, payload.factionIdx | 0));
      return factions[idx] || factions[0];
    }
    return factions[0] || { idx: 0, rgb: paletteRgb('cyberBlue'), h01: 0.35 };
  }

  function triggerBitsSparks(payload) {
    const now = performance.now();
    if (now - lastBitsSparkAt < clamp(cfg.bitsSparkCooldownMs, 0, 2000)) return;
    lastBitsSparkAt = now;

    const f = chooseFactionForBits(payload);
    const list = railsByFaction.get(f.idx) || [];
    if (!list.length) return;

    const burstMin = clamp(cfg.bitsSparkBurstMin, 0, 24) | 0;
    const burstMax = clamp(cfg.bitsSparkBurstMax, burstMin, 48) | 0;

    const r = mulberry32((lastLayoutSeed ^ (now | 0)) >>> 0);
    const burst = burstMin + ((r() * (burstMax - burstMin + 1)) | 0);

    for (let i = 0; i < burst; i++) {
      const railIndex = list[(r() * list.length) | 0];
      spawnSpark(railIndex, f.idx);
    }
  }

  function triggerPandemonium() {
    const now = performance.now();
    const dur = clamp(cfg.subPandemoniumMs, 600, 8000);
    const lock = clamp(cfg.subLockMs, 0, dur);
    const recover = clamp(cfg.subRecoverMs, 0, 4000);

    pandemoniumUntil = now + dur;
    pandemoniumLockUntil = now + lock;
    pandemoniumRecoverUntil = Math.max(pandemoniumUntil, now + dur + recover);
  }

  const ro = new ResizeObserver(() => doResize());
  ro.observe(container);

  function doResize() {
    const s = resizeCanvas(canvas, cfg.dprCap);
    W = s.w; H = s.h; dpr = s.dpr;
    minDim = Math.min(W, H);
    rebuildIfNeeded(true);
  }

  function rebuildCornerPcb(rng, pad) {
    pcbKeepOut = [];
    pcbCorners = [];
    if (!yes(cfg.cornerPcb_enabled)) return;

    const zone = minDim * clamp(cfg.cornerPcb_zonePct, 0.08, 0.22);
    const inset = pad;
    const z = zone;

    const zones = [
      { name: 'tl', x: inset,         y: inset,         w: z, h: z },
      { name: 'tr', x: W - inset - z, y: inset,         w: z, h: z },
      { name: 'br', x: W - inset - z, y: H - inset - z, w: z, h: z },
      { name: 'bl', x: inset,         y: H - inset - z, w: z, h: z }
    ];

    for (const zone of zones) pcbKeepOut.push({ x: zone.x, y: zone.y, w: zone.w, h: zone.h });

    const tracesPer = clamp(cfg.cornerPcb_traces, 2, 18) | 0;

    for (const zone of zones) {
      const traces = [];
      for (let i = 0; i < tracesPer; i++) {
        const m = 0.14 * zone.w;
        const x0 = zone.x + m + rng() * (zone.w - 2 * m);
        const y0 = zone.y + m + rng() * (zone.h - 2 * m);

        const edgePick = rng();
        let x1 = x0, y1 = y0;
        if (edgePick < 0.25) { x1 = zone.x + m;              y1 = zone.y + m + rng() * (zone.h - 2 * m); }
        else if (edgePick < 0.50) { x1 = zone.x + zone.w - m; y1 = zone.y + m + rng() * (zone.h - 2 * m); }
        else if (edgePick < 0.75) { x1 = zone.x + m + rng() * (zone.w - 2 * m); y1 = zone.y + m; }
        else { x1 = zone.x + m + rng() * (zone.w - 2 * m);   y1 = zone.y + zone.h - m; }

        const bendFirstX = rng() < 0.5;
        const mid = bendFirstX ? { x: x1, y: y0 } : { x: x0, y: y1 };

        traces.push({
          a: { x: x0, y: y0 }, mid, b: { x: x1, y: y1 },
          hz: lerp(clamp(cfg.cornerPcb_pulseMinHz, 0.05, 2.0), clamp(cfg.cornerPcb_pulseMaxHz, 0.06, 3.0), rng()),
          phase: rng() * Math.PI * 2,
          jitter: clamp01(cfg.cornerPcb_pulseJitter) * (0.6 + 0.8 * rng())
        });
      }
      pcbCorners.push({ zone, traces });
    }
  }

  function rebuildGeometry(edgeMask) {
    lastLayoutSeed = hash32(`theGrid|${edgeMask}|${Math.round(W)}x${Math.round(H)}`);
    const rng = mulberry32(lastLayoutSeed);

    enabledEdges = [];
    if (yes(cfg.top_edge)) enabledEdges.push('top');
    if (yes(cfg.right_edge)) enabledEdges.push('right');
    if (yes(cfg.bottom_edge)) enabledEdges.push('bottom');
    if (yes(cfg.left_edge)) enabledEdges.push('left');

    rails = [];
    railsByFaction = new Map();

    const safe = minDim * clamp(cfg.safeInsetPct, 0, 0.10);
    const cpuInset = minDim * clamp(cfg.cpuInsetPct, 0, 0.06);
    const cpuS = minDim * clamp(cfg.cpuScalePct, 0.05, 0.20);

    const cpuW = cpuS * 1.08;
    const cpuH = cpuS * 0.74;

    const cpuX = safe + cpuInset + cpuW * 0.50;
    const cpuY = safe + (H - 2 * safe) * clamp(cfg.cpuY, 0.10, 0.90);

    const pinLen = minDim * clamp(cfg.cpuPinLengthPct, 0.005, 0.06);
    const pinTh = minDim * clamp(cfg.cpuPinThicknessPct, 0.001, 0.012);
    const pinGap = minDim * clamp(cfg.cpuPinGapPct, 0, 0.02);

    cpu = {
      x: cpuX,
      y: cpuY,
      w: cpuW,
      h: cpuH,
      r: Math.max(4, Math.min(cpuW, cpuH) * clamp(cfg.cornerRadiusPct, 0.01, 0.14)),
      pinLen,
      pinTh,
      pinGap
    };

    const pad = safe;
    const xL = pad, xR = W - pad;
    const yT = pad, yB = H - pad;

    rebuildCornerPcb(rng, pad);

    const lanes = Math.min(6, Math.max(1, cfg.railsPerEdge | 0));
    const railInset = minDim * clamp(cfg.edgeRailInsetPct, 0, 0.05);
    const laneGap = minDim * clamp(cfg.edgeRailLaneGapPct, 0.002, 0.03);
    const stubDepth = minDim * clamp(cfg.stubDepthPct, 0.03, 0.22);

    const railsNeeded = enabledEdges.length * lanes;
    const pinCountBase = Math.max(6, Math.min(24, cfg.cpuPinCount | 0));
    const pinCount = Math.max(pinCountBase, Math.min(24, railsNeeded));

    cpuPins = [];
    const usableH = cpu.h * 0.82;
    for (let i = 0; i < pinCount; i++) {
      const t = (i + 0.5) / pinCount;
      const rowY = cpuY - usableH / 2 + usableH * t + (i - (pinCount - 1) / 2) * (pinGap * 0.08);
      const base = { x: cpuX + cpuW / 2, y: rowY };
      const tip  = { x: cpuX + cpuW / 2 + pinLen, y: rowY };
      cpuPins.push({ base, tip, idx: i });
    }

    const cornerZone = yes(cfg.cornerPcb_enabled) ? (minDim * clamp(cfg.cornerPcb_zonePct, 0.08, 0.22)) : 0;
    const keepOutMargin = Math.max(70, cornerZone + 14);

    const innerToOuter = Array.from({ length: lanes }, (_, i) => i).sort((a, b) => b - a);
    const minStep = Math.max(4, laneGap * 0.80);

    termPlan.top = yes(cfg.top_edge)
      ? buildTerminationPlan({ lanes, innerToOuter, rng, boundsMin: xL + keepOutMargin, boundsMax: xR - keepOutMargin, minStep })
      : null;

    termPlan.bottom = yes(cfg.bottom_edge)
      ? buildTerminationPlan({ lanes, innerToOuter, rng, boundsMin: xL + keepOutMargin, boundsMax: xR - keepOutMargin, minStep })
      : null;

    termPlan.left = yes(cfg.left_edge)
      ? buildTerminationPlan({ lanes, innerToOuter, rng, boundsMin: yT + keepOutMargin, boundsMax: yB - keepOutMargin, minStep })
      : null;

    termPlan.right = yes(cfg.right_edge)
      ? buildTerminationPlan({ lanes, innerToOuter, rng, boundsMin: yT + keepOutMargin, boundsMax: yB - keepOutMargin, minStep })
      : null;

    const factionCount = Math.max(1, factions.length);
    const fallbackFaction = factions[0] || { idx: 0, rgb: paletteRgb('cyberBlue') };
    const factionAt = (i) => factions.length ? factions[i % factionCount] : { idx: 0, rgb: fallbackFaction.rgb };

    const escapeBaseX = cpuX + cpuW / 2 + pinLen;
    const escapeColGap = Math.max(4, laneGap * 1.10);
    const escapeBundleGap = Math.max(6, laneGap * 0.95);
    const escapeX = (edgeIndex, lane) =>
      escapeBaseX + (lane + 1) * escapeColGap + edgeIndex * escapeBundleGap;

    let pinCursor = 0;
    for (let ei = 0; ei < enabledEdges.length; ei++) {
      const edge = enabledEdges[ei];
      const primaryLane = (rng() * lanes) | 0;

      for (let lane = 0; lane < lanes; lane++) {
        const isPrimary = lane === primaryLane;

        const f = factionAt((ei * 31 + lane * 7) >>> 0);
        const factionIdx = f.idx;
        const rgb = f.rgb;

        const pinIdx = pinCursor % cpuPins.length;
        pinCursor++;

        const pts = buildRail({
          edge, lane, isPrimary,
          xL, xR, yT, yB,
          railInset, laneGap,
          stubDepth,
          cpuPin: cpuPins[pinIdx],
          escapeX: escapeX(ei, lane),
          keepOut: pcbKeepOut,

          xEndPlan: (edge === 'top' && termPlan.top) ? termPlan.top[lane] : null,
          xEndPlanBottom: (edge === 'bottom' && termPlan.bottom) ? termPlan.bottom[lane] : null,
          yEndPlanLeft: (edge === 'left' && termPlan.left) ? termPlan.left[lane] : null,
          yEndPlanRight: (edge === 'right' && termPlan.right) ? termPlan.right[lane] : null,

          end45Chance: clamp01(cfg.end45Chance),
          end45LenPx: minDim * clamp(cfg.end45LenPct, 0.003, 0.06),
          stubChance: clamp01(cfg.stubChancePerLane),
          exitChance: clamp01(cfg.exitChance),
          rng
        });

        const path = pathPrecompute(pts);
        const railIndex = rails.length;

        const nodes = computeRailNodes(pts, rng);
        const parallel = computeParallelSegments(pts, rng, clamp01(cfg.railPcb_parallelChance));
        const pulseHz = lerp(clamp(cfg.railPcb_pulseMinHz, 0.05, 2.0), clamp(cfg.railPcb_pulseMaxHz, 0.06, 3.0), rng());
        const pulsePhase = rng() * Math.PI * 2;
        const pulseJitter = clamp01(cfg.railPcb_pulseJitter) * (0.6 + 0.8 * rng());

        rails.push({
          edge, lane, isPrimary, factionIdx, rgb, pinIdx, path,
          pcb: { nodes, parallel, pulseHz, pulsePhase, pulseJitter }
        });

        if (!railsByFaction.has(factionIdx)) railsByFaction.set(factionIdx, []);
        railsByFaction.get(factionIdx).push(railIndex);

        if (!packetCarry.has(factionIdx)) packetCarry.set(factionIdx, 0);
      }
    }
  }

  function buildRail({
    edge, lane, isPrimary,
    xL, xR, yT, yB,
    railInset, laneGap,
    stubDepth,
    cpuPin,
    escapeX,
    keepOut,

    xEndPlan,
    xEndPlanBottom,
    yEndPlanLeft,
    yEndPlanRight,

    end45Chance,
    end45LenPx,
    stubChance, exitChance,
    rng
  }) {
    const offset = railInset + lane * laneGap;

    const leftLaneX  = xL + offset;
    const topLaneY   = yT + offset;
    const botLaneY   = yB - offset;
    const rightLaneX = xR - offset;

    const pts = [];
    pts.push({ x: cpuPin.base.x, y: cpuPin.base.y });
    pts.push({ x: cpuPin.tip.x,  y: cpuPin.tip.y  });

    pts.push({ x: escapeX, y: cpuPin.tip.y });
    pts.push({ x: leftLaneX, y: cpuPin.tip.y });

    const clampOutX = (x, yFixed) => {
      if (!keepOut?.length) return x;
      for (const z of keepOut) {
        const insideY = (yFixed >= z.y && yFixed <= z.y + z.h);
        if (insideY && x >= z.x && x <= z.x + z.w) {
          const left = z.x - 10;
          const right = z.x + z.w + 10;
          return (Math.abs(x - left) < Math.abs(x - right)) ? left : right;
        }
      }
      return x;
    };

    const clampOutY = (y, xFixed) => {
      if (!keepOut?.length) return y;
      for (const z of keepOut) {
        const insideX = (xFixed >= z.x && xFixed <= z.x + z.w);
        if (insideX && y >= z.y && y <= z.y + z.h) {
          const up = z.y - 10;
          const down = z.y + z.h + 10;
          return (Math.abs(y - up) < Math.abs(y - down)) ? up : down;
        }
      }
      return y;
    };

    if (edge === 'left') {
      let yEnd = (typeof yEndPlanLeft === 'number') ? yEndPlanLeft : cpuPin.tip.y;
      yEnd = clampOutY(yEnd, leftLaneX);
      pts.push({ x: leftLaneX, y: yEnd });

      if (!isPrimary) addStub(pts, 'right', stubDepth, stubChance, exitChance, rng, end45Chance, end45LenPx, keepOut);
      maybeAddEnd45(pts, 'left', rng, end45LenPx, end45Chance, keepOut);
      return pts;
    }

    if (edge === 'top') {
      pts.push({ x: leftLaneX, y: topLaneY });

      let xEnd = (typeof xEndPlan === 'number') ? xEndPlan : (xL + 200);
      xEnd = clampOutX(xEnd, topLaneY);
      pts.push({ x: xEnd, y: topLaneY });

      if (!isPrimary) addStub(pts, 'down', stubDepth, stubChance, exitChance, rng, end45Chance, end45LenPx, keepOut);
      maybeAddEnd45(pts, 'top', rng, end45LenPx, end45Chance, keepOut);
      return pts;
    }

    if (edge === 'bottom') {
      pts.push({ x: leftLaneX, y: botLaneY });

      let xEnd = (typeof xEndPlanBottom === 'number') ? xEndPlanBottom : (xL + 200);
      xEnd = clampOutX(xEnd, botLaneY);
      pts.push({ x: xEnd, y: botLaneY });

      if (!isPrimary) addStub(pts, 'up', stubDepth, stubChance, exitChance, rng, end45Chance, end45LenPx, keepOut);
      maybeAddEnd45(pts, 'bottom', rng, end45LenPx, end45Chance, keepOut);
      return pts;
    }

    // right edge
    {
      let yEnd = (typeof yEndPlanRight === 'number') ? yEndPlanRight : (yT + 200);
      yEnd = clampOutY(yEnd, rightLaneX);

      const viaTop = lane < Math.ceil((Math.min(6, cfg.railsPerEdge | 0)) / 2);

      if (viaTop) {
        pts.push({ x: leftLaneX, y: topLaneY });
        pts.push({ x: rightLaneX, y: topLaneY });
        pts.push({ x: rightLaneX, y: yEnd });
      } else {
        pts.push({ x: leftLaneX, y: botLaneY });
        pts.push({ x: rightLaneX, y: botLaneY });
        pts.push({ x: rightLaneX, y: yEnd });
      }

      if (!isPrimary) addStub(pts, 'left', stubDepth, stubChance, exitChance, rng, end45Chance, end45LenPx, keepOut);
      maybeAddEnd45(pts, 'right', rng, end45LenPx, end45Chance, keepOut);
      return pts;
    }
  }

  function addStub(pts, dir, stubDepth, stubChance, exitChance, rng, end45Chance, end45LenPx, keepOut) {
    if (rng() > stubChance) return;

    const last = pts[pts.length - 1];
    const len = stubDepth * (0.30 + rng() * 0.42);
    const isExit = rng() < exitChance;
    const adj = isExit ? 0.75 : 1.0;

    const p = { x: last.x, y: last.y };
    if (dir === 'down') p.y += len * adj;
    if (dir === 'up') p.y -= len * adj;
    if (dir === 'right') p.x += len * adj;
    if (dir === 'left') p.x -= len * adj;

    if (keepOut?.length) {
      for (const z of keepOut) {
        if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return;
      }
    }

    pts.push(p);
    maybeAddEnd45(
      pts,
      dir === 'up' ? 'bottom' : dir === 'down' ? 'top' : dir === 'left' ? 'right' : 'left',
      rng,
      end45LenPx * 0.85,
      end45Chance * 0.65,
      keepOut
    );
  }

  // ---- spawning ----
  function spawnPacket(railIndex, factionIdx, factionH01, dt, rateOverride) {
    if (particles.length >= maxLive()) return;

    const list = railsByFaction.get(factionIdx) || [railIndex];
    const perFactionRails = Math.max(1, list.length);

    const base = clamp(cfg.packetBaseRate, 0, 60);
    const boost = clamp(cfg.packetBoostRate, 0, 300);

    const rate = (typeof rateOverride === 'number')
      ? Math.max(0, rateOverride)
      : (base + boost * clamp01(factionH01));

    const perRailRate = rate / perFactionRails;

    const carry0 = packetCarry.get(factionIdx) || 0;
    let carry = carry0 + perRailRate * dt;

    let count = Math.floor(carry);
    carry -= count;
    packetCarry.set(factionIdx, carry);

    while (count-- > 0) {
      if (particles.length >= maxLive()) break;
      particles.push({ railIndex, factionIdx, type: 'packet', t: 0, life: 0.95 + Math.random() * 0.55, trail: clamp01(cfg.packetTrail) });
    }
  }

  function spawnSpark(railIndex, factionIdx) {
    if (particles.length >= maxLive()) return;
    particles.push({ railIndex, factionIdx, type: 'spark', t: 0, life: clamp(cfg.bitsSparkLife, 0.1, 2.0) * (0.75 + Math.random() * 0.5), trail: 0.85 });
  }

  // ---- drawing ----
  function drawBaseGlow() {
    const c = paletteRgb(cfg.baseGlowColor);
    const s = clamp01(cfg.baseGlowStrength);
    if (s <= 0) return;

    const cx = W * 0.22;
    const cy = H * 0.50;
    const r0 = Math.min(W, H) * 0.10;
    const r1 = Math.min(W, H) * 0.98;

    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    g.addColorStop(0, rgba(c, 0.22 * s));
    g.addColorStop(0.45, rgba(c, 0.09 * s));
    g.addColorStop(1, rgba(c, 0));

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const e = ctx.createLinearGradient(0, 0, 0, H);
    e.addColorStop(0, rgba(c, 0.06 * s));
    e.addColorStop(0.5, rgba(c, 0.02 * s));
    e.addColorStop(1, rgba(c, 0.06 * s));
    ctx.fillStyle = e;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  function drawCornerPcb(now) {
    if (!yes(cfg.cornerPcb_enabled) || !pcbCorners.length) return;

    const base = paletteRgb(cfg.baseGlowColor);
    const traceA = clamp01(cfg.cornerPcb_traceAlpha);
    const glow = clamp01(cfg.cornerPcb_glow);
    const viaR = Math.max(1.5, minDim * clamp(cfg.cornerPcb_viaRadiusPct, 0.002, 0.02));
    const th = Math.max(1, minDim * clamp(cfg.cornerPcb_traceThicknessPct, 0.001, 0.01));
    const jitterAmt = clamp01(cfg.cornerPcb_pulseJitter);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = th;

    for (const corner of pcbCorners) {
      for (const t of corner.traces) {
        const pulse = (Math.sin((now / 1000) * Math.PI * 2 * t.hz + t.phase) + 1) / 2;
        const flick = 1 + (Math.sin((now / 1000) * 13.7 + t.phase * 3.1) * 0.5 + 0.5) * jitterAmt;
        const a = clamp01((0.10 + 0.55 * pulse) * flick) * traceA;

        ctx.shadowBlur = (10 + 30 * glow) * (0.35 + 0.65 * pulse);
        ctx.shadowColor = rgba(base, 0.55);

        ctx.strokeStyle = rgba(base, a);
        ctx.beginPath();
        ctx.moveTo(t.a.x, t.a.y);
        ctx.lineTo(t.mid.x, t.mid.y);
        ctx.lineTo(t.b.x, t.b.y);
        ctx.stroke();

        ctx.shadowBlur = (12 + 34 * glow) * (0.45 + 0.55 * pulse);
        ctx.fillStyle = rgba(base, clamp01(a + 0.10));
        ctx.beginPath(); ctx.arc(t.a.x, t.a.y, viaR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.b.x, t.b.y, viaR, 0, Math.PI * 2); ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(10,14,20,0.85)';
        ctx.beginPath(); ctx.arc(t.a.x, t.a.y, viaR * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.b.x, t.b.y, viaR * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();
  }

  // Rails with PCB pads/vias/parallel + endpoint via accents
  function drawRails(now, alphaMul) {
    const thick = minDim * clamp(cfg.railThicknessPct, 0.0015, 0.020);
    const glow = clamp01(cfg.railGlow);
    const a0 = clamp01(cfg.railAlpha) * alphaMul;

    const isP = now < pandemoniumUntil;
    const isLock = now < pandemoniumLockUntil;
    const isRecover = now < pandemoniumRecoverUntil && now >= pandemoniumUntil;
    const recT = isRecover ? clamp01(1 - (now - pandemoniumUntil) / Math.max(1, cfg.subRecoverMs)) : 0;

    const pcbOn = yes(cfg.railPcb_enabled);
    const viaRBase = Math.max(1.4, minDim * clamp(cfg.railPcb_viaRadiusPct, 0.002, 0.02));
    const padLen = Math.max(3, minDim * clamp(cfg.railPcb_padLenPct, 0.004, 0.08));
    const padA = clamp01(cfg.railPcb_padAlpha);
    const viaA = clamp01(cfg.railPcb_viaAlpha);
    const parA = clamp01(cfg.railPcb_parallelAlpha);
    const parOff = Math.max(2, minDim * clamp(cfg.railPcb_parallelOffsetPct, 0.002, 0.03));

    const endScalePrimary = clamp(cfg.railPcb_endViaScalePrimary, 1.0, 1.6);
    const endScaleLeader = clamp(cfg.railPcb_endViaScaleLeader, 1.0, 1.8);
    const endAlphaBoostLeader = clamp(cfg.railPcb_endViaAlphaBoostLeader, 0, 0.35);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    ctx.lineWidth = thick;

    ctx.shadowBlur = (12 + 30 * glow) * (0.75 + 0.65 * hSmooth + (isP ? 0.55 : 0) + 0.35 * recT);
    ctx.shadowColor = 'rgba(255,255,255,0.18)';

    for (const r of rails) {
      const col = r.rgb;

      let a = a0;
      if (isLock) a = clamp01(a0 + 0.25);
      else if (isP) a = clamp01(a0 + 0.20);
      else if (isRecover) a = clamp01(a0 + 0.10 * recT);

      // primary rail stroke
      ctx.strokeStyle = `rgba(${col.r|0},${col.g|0},${col.b|0},${a})`;
      const pts = r.path.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // white core
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, thick * 0.34);
      ctx.globalAlpha = clamp01(0.14 + 0.22 * hSmooth + (isP ? 0.22 : 0) + 0.12 * recT);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();

      if (!pcbOn || !r.pcb) continue;

      // subtle independent pulse (NOT hype-based)
      const p = r.pcb;
      const pulse = (Math.sin((now / 1000) * Math.PI * 2 * p.pulseHz + p.pulsePhase) + 1) / 2;
      const flick = 1 + (Math.sin((now / 1000) * 12.9 + p.pulsePhase * 2.7) * 0.5 + 0.5) * p.pulseJitter;

      // parallel traces
      if (p.parallel?.length) {
        ctx.save();
        ctx.shadowBlur = (10 + 24 * glow) * (0.35 + 0.65 * pulse);
        ctx.shadowColor = rgba(col, 0.45);

        ctx.lineWidth = Math.max(1, thick * 0.36);
        ctx.strokeStyle = `rgba(${col.r|0},${col.g|0},${col.b|0},${clamp01(parA * (0.35 + 0.65 * pulse) * flick)})`;

        for (const s of p.parallel) {
          const dx = s.bx - s.ax;
          const dy = s.by - s.ay;
          const isH = Math.abs(dx) >= Math.abs(dy);

          const ox = isH ? 0 : (dx >= 0 ? -parOff : parOff);
          const oy = isH ? (dy >= 0 ? parOff : -parOff) : 0;

          ctx.beginPath();
          ctx.moveTo(s.ax + ox, s.ay + oy);
          ctx.lineTo(s.bx + ox, s.by + oy);
          ctx.stroke();

          // tiny vias at ends of parallel segment
          const vr = viaRBase * 0.82;
          ctx.fillStyle = rgba(col, clamp01(viaA * 0.85 * (0.35 + 0.65 * pulse) * flick));
          ctx.beginPath(); ctx.arc(s.ax + ox, s.ay + oy, vr, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(s.bx + ox, s.by + oy, vr, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(10,14,20,0.86)';
          ctx.beginPath(); ctx.arc(s.ax + ox, s.ay + oy, vr * 0.35, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(s.bx + ox, s.by + oy, vr * 0.35, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
      }

      // vias & pads (including endpoint via)
      if (p.nodes?.length) {
        ctx.save();
        const nodeA = clamp01((0.35 + 0.65 * pulse) * flick);

        ctx.shadowBlur = (10 + 28 * glow) * (0.35 + 0.65 * pulse);
        ctx.shadowColor = rgba(col, 0.55);

        const isLeaderRail = (r.factionIdx === leader.idx);

        for (const n of p.nodes) {
          if (n.kind === 'via' || n.kind === 'endVia') {
            let vr = viaRBase;
            let va = viaA;

            if (n.kind === 'endVia') {
              if (r.isPrimary) vr *= endScalePrimary;
              if (isLeaderRail) {
                vr *= endScaleLeader;
                va = clamp01(va + endAlphaBoostLeader);
              }
            }

            ctx.fillStyle = rgba(col, clamp01(va * nodeA));
            ctx.beginPath(); ctx.arc(n.x, n.y, vr, 0, Math.PI * 2); ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(10,14,20,0.86)';
            ctx.beginPath(); ctx.arc(n.x, n.y, vr * 0.45, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = (10 + 28 * glow) * (0.35 + 0.65 * pulse);

          } else {
            // pad: small capsule
            ctx.fillStyle = rgba(col, clamp01(padA * nodeA));
            const w = padLen * (0.9 + 0.3 * pulse);
            const h = Math.max(2, thick * 0.70);
            roundCapsule(ctx, n.x - w / 2, n.y - h / 2, w, h, h / 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(255,255,255,${clamp01(0.10 + 0.22 * pulse)})`;
            roundCapsule(ctx, n.x - (w * 0.28), n.y - (h * 0.28), w * 0.56, h * 0.56, (h * 0.56) / 2);
            ctx.fill();
            ctx.shadowBlur = (10 + 28 * glow) * (0.35 + 0.65 * pulse);
          }
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawParticles(now, dt) {
    const basePx = minDim * (160 + 560 * clamp01(cfg.packetSpeed));
    const maxMul = clamp(cfg.packetSpeedAtMax, 0.5, 4);

    const thick = minDim * clamp(cfg.railThicknessPct, 0.0015, 0.020);
    const size = Math.max(2, thick * 2.05) * clamp(cfg.packetSizeMul, 0.6, 2.4);
    const glow = clamp01(cfg.packetGlow);
    const alpha = clamp01(cfg.packetAlpha);

    const isLock = now < pandemoniumLockUntil;
    const speedMulGlobal = isLock ? 0 : 1;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const rail = rails[p.railIndex];
      if (!rail) { particles.splice(i, 1); continue; }

      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }

      const f = factions.find(x => x.idx === p.factionIdx) || factions[0];
      const f01 = clamp01(f?.h01 ?? 0.35);

      const pxPerSec = basePx * lerp(1, maxMul, f01) * speedMulGlobal;
      const sparkMul = (p.type === 'spark') ? clamp(cfg.bitsSparkSpeed, 1.2, 10.0) : 1.0;
      const fracPerSec = (pxPerSec * sparkMul) / rail.path.total;

      p.t += fracPerSec * dt;
      if (p.t >= 1) {
        if (p.type === 'spark') { particles.splice(i, 1); continue; }
        p.t = 0;
      }

      const col = rail.rgb;
      const pos = pathPointAt(rail.path, p.t);

      const trail = clamp01(p.trail ?? 0);
      if (trail > 0.01) {
        const tBack = Math.max(0, p.t - 0.03 - 0.05 * trail);
        const pos2 = pathPointAt(rail.path, tBack);
        ctx.shadowBlur = (10 + 40 * glow) * 0.8;
        ctx.shadowColor = rgba(col, 0.65);
        const w2 = size * 0.92;
        const h2 = size * 0.40;
        ctx.fillStyle = rgba(col, alpha * 0.35 * trail);
        roundCapsule(ctx, pos2.x - w2 / 2, pos2.y - h2 / 2, w2, h2, h2 / 2);
        ctx.fill();
      }

      ctx.shadowBlur = (10 + 40 * glow) * (p.type === 'spark' ? 1.10 : 0.95);
      ctx.shadowColor = rgba(col, 0.82);

      const w = size * (p.type === 'spark' ? 1.20 : 1.0);
      const h = size * (p.type === 'spark' ? 0.56 : 0.46);

      ctx.fillStyle = rgba(col, alpha * (p.type === 'spark' ? 1.0 : 0.95));
      roundCapsule(ctx, pos.x - w / 2, pos.y - h / 2, w, h, h / 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255,255,255,${clamp01(0.34 + (p.type === 'spark' ? 0.32 : 0))})`;
      roundCapsule(ctx, pos.x - w * 0.28, pos.y - h * 0.28, w * 0.56, h * 0.56, (h * 0.56) / 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function spawnTraffic(now, dt) {
    if (!rails.length) return;

    const isP = now < pandemoniumUntil;
    const isLock = now < pandemoniumLockUntil;

    if (isP) {
      if (isLock) return;

      const edgeCount = Math.max(1, enabledEdges.length);
      const perEdge = clamp(cfg.subPacketRate, 0, 800);
      const totalRate = perEdge * edgeCount;
      const perRail = totalRate / Math.max(1, rails.length);

      for (let ri = 0; ri < rails.length; ri++) {
        const r = rails[ri];
        spawnPacket(ri, r.factionIdx, 1.0, dt, perRail);
      }

      const sparkRate = clamp(cfg.subSparkRate, 0, 1000);
      const sparkCount = Math.floor(sparkRate * dt);
      for (let i = 0; i < sparkCount; i++) {
        const ri = (Math.random() * rails.length) | 0;
        const r = rails[ri];
        spawnSpark(ri, r.factionIdx);
      }
      return;
    }

    if (factions.length === 0) {
      for (let ri = 0; ri < rails.length; ri++) spawnPacket(ri, 0, 0.30, dt);
      return;
    }

    for (const f of factions) {
      const list = railsByFaction.get(f.idx) || [];
      for (const ri of list) spawnPacket(ri, f.idx, f.h01, dt);
    }
  }

  // CPU DRAW IS LOCKED (unchanged)
  function drawCPU(now) {
    const c = leader.rgb;

    const glow = clamp01(cfg.cpuGlow);
    const boost = clamp(cfg.cpuGlowBoostAtMax, 0, 2);
    const isP = now < pandemoniumUntil;
    const isLock = now < pandemoniumLockUntil;
    const isRecover = now < pandemoniumRecoverUntil && now >= pandemoniumUntil;

    const pulseHz = 0.35 + 1.15 * hSmooth + (isP ? 1.2 : 0);
    const pulse = (Math.sin((now / 1000) * Math.PI * 2 * pulseHz) + 1) / 2;

    let alpha = 0.78 + 0.18 * hSmooth;
    if (isLock) alpha += 0.20;
    if (isP) alpha += 0.10;
    if (isRecover) alpha += 0.10 * (1 - (now - pandemoniumUntil) / Math.max(1, cfg.subRecoverMs));

    const glowAmt = (18 + 46 * glow) * (1 + boost * hSmooth + (isP ? 0.65 : 0)) * (0.75 + 0.50 * pulse);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(cpu.x, cpu.y);

    ctx.shadowBlur = glowAmt;
    ctx.shadowColor = rgba(c, 0.85);

    roundRectPath(ctx, -cpu.w / 2, -cpu.h / 2, cpu.w, cpu.h, cpu.r);
    ctx.fillStyle = `rgba(10,14,20,${clamp01(0.74 + 0.10 * hSmooth)})`;
    ctx.fill();

    ctx.lineWidth = Math.max(1, minDim * 0.0017);
    ctx.strokeStyle = rgba(c, clamp01(alpha));
    ctx.stroke();

    ctx.shadowBlur = 0;
    roundRectPath(ctx, -cpu.w * 0.33, -cpu.h * 0.22, cpu.w * 0.66, cpu.h * 0.44, cpu.r * 0.6);
    ctx.fillStyle = rgba(c, clamp01(0.10 + 0.22 * hSmooth + (isP ? 0.15 : 0)));
    ctx.fill();

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, cpu.pinTh);

    const pinAlpha = clamp01(0.32 + 0.35 * hSmooth + (isP ? 0.25 : 0));
    ctx.strokeStyle = rgba(c, pinAlpha);
    ctx.shadowBlur = (10 + 22 * glow) * (0.7 + 0.6 * hSmooth);
    ctx.shadowColor = rgba(c, 0.65);

    for (const p of cpuPins) {
      ctx.beginPath();
      ctx.moveTo(p.base.x, p.base.y);
      ctx.lineTo(p.tip.x, p.tip.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p.tip.x, p.tip.y, Math.max(2, cpu.pinTh * 1.1), 0, Math.PI * 2);
      ctx.fillStyle = rgba(c, clamp01(pinAlpha + 0.12));
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cpu.x + cpu.w * 0.34, cpu.y - cpu.h * 0.22, Math.max(2, cpu.w * 0.04), 0, Math.PI * 2);
    ctx.fillStyle = rgba(c, clamp01(isP ? 0.85 : 0.35 + 0.35 * hSmooth));
    ctx.fill();

    ctx.restore();
  }

  function loop(ms) {
    const fps = clamp(cfg.fpsCap, 15, 60);
    const frameMs = 1000 / fps;

    const dtMs = Math.max(0, ms - lastMs);
    lastMs = ms;

    accMs += dtMs;
    if (accMs < frameMs) { raf = requestAnimationFrame(loop); return; }
    accMs = Math.min(accMs, frameMs * 3);

    const dt = accMs / 1000;
    accMs = 0;

    applyDemoIfNoData(ms);
    rebuildIfNeeded(false);

    const smooth = clamp(cfg.hypeSmoothing, 0.05, 0.5);
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.pow(1 - smooth, 60 / fps));

    for (let i = particles.length - 1; i >= 0; i--) {
      if (!rails[particles[i].railIndex]) particles.splice(i, 1);
    }
    while (particles.length > maxLive()) particles.shift();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawBaseGlow();
    drawCornerPcb(ms);

    spawnTraffic(ms, dt);

    const alphaMul = clamp01(0.82 + 0.18 * hSmooth);
    drawRails(ms, alphaMul);
    drawParticles(ms, dt);

    drawCPU(ms);

    raf = requestAnimationFrame(loop);
  }

  // init
  doResize();
  raf = requestAnimationFrame(loop);

  const onWinResize = () => doResize();
  window.addEventListener('resize', onWinResize, { passive: true });

  const mo = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      try { cancelAnimationFrame(raf); } catch {}
      try { window.removeEventListener('resize', onWinResize); } catch {}
      try { ro.disconnect(); } catch {}
      try { mo.disconnect(); } catch {}
      try { unsubMeters && unsubMeters(); } catch {}
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
