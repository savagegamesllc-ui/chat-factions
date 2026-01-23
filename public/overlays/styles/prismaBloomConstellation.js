// public/overlays/styles/prismBloomConstellation.js
// PRO Overlay: PrismBloom Constellation
// Full-screen prismatic aurora + event-driven "constellation" nodes + rainbow energy links.
// - Downsampled offscreen canvas for performance (aurora base)
// - Nodes/links are capped for OBS safety
// - placement: edges|bottom (bias spawn region)
// - mixMode: weighted|winner (bias tint)
// - intensity: 0..2
//
// Contract: export meta + init({ canvas, app, config })

'use strict';

export const meta = {
  styleKey: 'prismBloomConstellation',
  name: 'PrismBloom Constellation (PRO)',
  tier: 'PRO',
  description:
    'Full-screen rainbow aurora with event-driven constellation nodes that connect into prismatic energy webs during big moments.',
  defaultConfig: {
    placement: 'edges',         // edges | bottom
    mixMode: 'weighted',        // weighted | winner
    intensity: 1.0,             // 0..2

    // Performance
    renderScale: 0.33,          // 0.2..0.75
    fpsCap: 60,                 // 15..60

    // Base aurora field
    baseOpacity: 0.075,         // 0..0.4
    hypeOpacityBoost: 0.52,     // 0..1
    bloomStrength: 0.72,        // 0..1
    fieldComplexity: 0.75,      // 0..1
    flowSpeed: 0.85,            // 0.1..2

    rainbowSpeed: 0.9,          // 0.1..2
    rainbowScale: 1.0,          // 0.4..2
    saturation: 0.95,           // 0..1
    contrast: 1.05,             // 0.6..1.6
    vignette: 0.35,             // 0..0.8

    // Event response
    eventBoost: 1.0,            // 0..2
    flashStrength: 0.5,         // 0..1
    biasStrength: 0.22,         // 0..0.75 faction tint influence
    backgroundDim: 0.0,         // 0..0.25

    // Constellation system
    constellationEnabled: true,

    nodeSpawnSensitivity: 0.9,  // 0..2 (how easily nodes spawn on spikes)
    nodeCooldownMs: 120,        // min ms between node spawns
    nodeMax: 26,                // cap active nodes
    nodeLife: 2.8,              // seconds (base)
    nodeSize: 2.4,              // px
    nodeGlow: 0.9,              // 0..1
    nodeDrift: 34,              // px/sec (drift magnitude)

    linkMaxPerNode: 2,          // how many links each node tries to form (cap)
    linkDistance: 360,          // px max distance for connecting
    linkThickness: 2.0,         // px
    linkGlow: 0.85,             // 0..1
    linkAlpha: 0.38,            // 0..1
    linkPulseSpeed: 1.2,        // 0.2..3
    linkHueSpin: 1.0,           // 0..2 hue drift along links
    linkJitter: 0.18,           // 0..0.6 noisy lightning edge
    linkZapChance: 0.15         // 0..0.6 occasional zaps along links
  },
  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'bottom'], default: 'edges' },
    { key: 'mixMode', label: 'Bias Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'renderScale', label: 'Render Scale', type: 'range', min: 0.2, max: 0.75, step: 0.01, default: 0.33 },
    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },

    { key: 'baseOpacity', label: 'Base Opacity', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.075 },
    { key: 'hypeOpacityBoost', label: 'Hype Opacity Boost', type: 'range', min: 0, max: 1, step: 0.01, default: 0.52 },
    { key: 'bloomStrength', label: 'Bloom Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.72 },
    { key: 'fieldComplexity', label: 'Field Complexity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },
    { key: 'flowSpeed', label: 'Flow Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.85 },

    { key: 'rainbowSpeed', label: 'Rainbow Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.9 },
    { key: 'rainbowScale', label: 'Rainbow Scale', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1.0 },
    { key: 'saturation', label: 'Saturation', type: 'range', min: 0, max: 1, step: 0.01, default: 0.95 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.6, max: 1.6, step: 0.01, default: 1.05 },
    { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.35 },

    { key: 'eventBoost', label: 'Event Boost', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'flashStrength', label: 'Flash Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'biasStrength', label: 'Faction Bias Strength', type: 'range', min: 0, max: 0.75, step: 0.01, default: 0.22 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.0 },

    { key: 'constellationEnabled', label: 'Enable Constellation', type: 'checkbox', default: true },
    { key: 'nodeSpawnSensitivity', label: 'Node Sensitivity', type: 'range', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'nodeCooldownMs', label: 'Node Cooldown (ms)', type: 'range', min: 60, max: 600, step: 10, default: 120 },
    { key: 'nodeMax', label: 'Max Nodes', type: 'range', min: 4, max: 60, step: 1, default: 26 },
    { key: 'nodeLife', label: 'Node Life (sec)', type: 'range', min: 0.6, max: 8, step: 0.1, default: 2.8 },
    { key: 'nodeSize', label: 'Node Size', type: 'range', min: 1, max: 10, step: 0.1, default: 2.4 },
    { key: 'nodeGlow', label: 'Node Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
    { key: 'nodeDrift', label: 'Node Drift', type: 'range', min: 0, max: 120, step: 1, default: 34 },

    { key: 'linkMaxPerNode', label: 'Links Per Node', type: 'range', min: 0, max: 5, step: 1, default: 2 },
    { key: 'linkDistance', label: 'Link Distance', type: 'range', min: 120, max: 900, step: 10, default: 360 },
    { key: 'linkThickness', label: 'Link Thickness', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.0 },
    { key: 'linkGlow', label: 'Link Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'linkAlpha', label: 'Link Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.38 },
    { key: 'linkPulseSpeed', label: 'Link Pulse Speed', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1.2 },
    { key: 'linkHueSpin', label: 'Link Hue Spin', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'linkJitter', label: 'Link Jitter', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18 },
    { key: 'linkZapChance', label: 'Link Zap Chance', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.15 }
  ]
};

export function init({ canvas, app, config } = {}) {
  const resolved = ensureCanvas(canvas, meta.styleKey);
  canvas = resolved.canvas;
  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Offscreen aurora field
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { willReadFrequently: false });

  // App state
  let factions = [];
  let meters = [];
  let totalHype = 0;

  // Event energy
  let lastMeterMap = new Map();
  let eventVel = 0;
  let eventEnergy = 0;
  let flash = 0;

  // Constellation state
  const nodes = []; // {x,y,vx,vy,born,life,power,hueSeed}
  let lastNodeAt = 0;

  // Loop timing
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;
  let running = true;

  // Subscribe defensive
  try {
    if (app && typeof app.on === 'function') {
      app.on('state', (s) => {
        if (s?.factions) factions = s.factions;
        if (s?.meters) ingestMeters(s.meters);
      });
      app.on('meters', (m) => ingestMeters(m));
      app.on('factions', (f) => { factions = Array.isArray(f) ? f : factions; });
    }
    if (app && typeof app.getState === 'function') {
      const s = app.getState();
      if (s?.factions) factions = s.factions;
      if (s?.meters) ingestMeters(s.meters);
    }
  } catch {}

  // IMPORTANT FIX:
  // ingestMeters now accepts arrays OR wrappers like { meters:[...] } OR { factions:[...] } OR object maps.
  function ingestMeters(mLike) {
    meters = coerceMetersArray(mLike);

    let sum = 0;
    const cur = new Map();

    for (const it of meters) {
      const id = it?.factionId ?? it?.id ?? it?.faction ?? it?.key ?? null;
      const v = Math.max(0, num(it?.value, num(it?.hype, num(it?.meter, 0))));
      if (id != null) cur.set(id, v);
      sum += v;
    }

    // total hype 0..1 soft normalize + intensity
    const base = clamp01(1 - Math.exp(-sum / 180));
    totalHype = clamp01(base * clamp(cfg.intensity, 0, 2));

    // delta bump
    let delta = 0;
    for (const [id, v] of cur.entries()) {
      const prev = lastMeterMap.get(id) ?? 0;
      delta += Math.abs(v - prev);
    }
    for (const [id, prev] of lastMeterMap.entries()) {
      if (!cur.has(id)) delta += Math.abs(prev);
    }
    lastMeterMap = cur;

    const bump = clamp01(delta / 28) * clamp(cfg.eventBoost, 0, 2);
    eventVel += bump * 1.25;

    if (cfg.constellationEnabled) maybeSpawnNode(bump);
  }

  function coerceMetersArray(mLike) {
    if (!mLike) return [];

    // common wrapper: { meters: [...] }
    if (Array.isArray(mLike?.meters)) return mLike.meters;

    // sometimes wrapper: { factions: [...] } (treat factions as meters)
    if (Array.isArray(mLike?.factions)) {
      return mLike.factions.map((f) => ({
        factionId: f?.id ?? f?.key,
        value: num(f?.value, num(f?.hype, 0)),
        color: f?.colorHex ?? f?.color
      }));
    }

    // direct array
    if (Array.isArray(mLike)) return mLike;

    // object map: { factionKey: {value, colorHex}, ... }
    if (typeof mLike === 'object') {
      const out = [];
      for (const [key, v] of Object.entries(mLike)) {
        if (!v || typeof v !== 'object') continue;
        out.push({
          factionId: key,
          value: num(v.value, num(v.hype, num(v.meter, 0))),
          color: v.colorHex ?? v.color ?? v.hex
        });
      }
      return out;
    }

    return [];
  }

  function maybeSpawnNode(bump01) {
    const now = performance.now();
    const cd = clamp(cfg.nodeCooldownMs, 0, 2000);
    if ((now - lastNodeAt) < cd) return;

    const sens = clamp(cfg.nodeSpawnSensitivity, 0, 2);
    const threshold = 0.16 / Math.max(0.05, sens);
    if (bump01 < threshold) return;

    lastNodeAt = now;

    // cap nodes
    const cap = clampInt(cfg.nodeMax, 1, 200);
    while (nodes.length >= cap) nodes.shift();

    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 1280;
    const h = rect.height || 720;

    // spawn location bias
    let x = w * (0.2 + 0.6 * Math.random());
    let y = h * (0.2 + 0.6 * Math.random());

    if (cfg.placement === 'bottom') {
      y = h * (0.55 + 0.4 * Math.random());
    } else {
      // edges: spawn more toward outer region
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) { y = h * (0.10 + 0.18 * Math.random()); }
      if (edge === 1) { x = w * (0.72 + 0.18 * Math.random()); }
      if (edge === 2) { y = h * (0.72 + 0.18 * Math.random()); }
      if (edge === 3) { x = w * (0.10 + 0.18 * Math.random()); }
    }

    const power = clamp01(0.35 + 0.65 * bump01 + 0.35 * totalHype);
    const drift = clamp(cfg.nodeDrift, 0, 300) * (0.35 + 0.85 * power);

    nodes.push({
      x, y,
      vx: (Math.random() - 0.5) * drift,
      vy: (Math.random() - 0.5) * drift,
      born: performance.now() / 1000,
      life: clamp(cfg.nodeLife, 0.2, 20) * (0.65 + 0.9 * power),
      power,
      hueSeed: Math.random()
    });
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.floor(rect.width * dpr));
    const H = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = clamp(cfg.renderScale, 0.2, 0.75);
    const ow = Math.max(2, Math.floor((W / dpr) * scale));
    const oh = Math.max(2, Math.floor((H / dpr) * scale));
    if (off.width !== ow || off.height !== oh) {
      off.width = ow;
      off.height = oh;
    }
    return { w: W / dpr, h: H / dpr, ow, oh };
  }

  function getBiasRgb() {
    const rgba = pickFactionColorCss({ factions, meters }, cfg.mixMode, 1.0);
    const rgb = rgbaToRgb(rgba);
    return rgb || { r: 140, g: 210, b: 255 };
  }

  function loop(nowMs) {
    if (!running) return;
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const cap = clamp(cfg.fpsCap, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;
    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // decay event energy
    eventVel *= Math.pow(0.12, dt);
    eventEnergy = clamp01(eventEnergy * Math.pow(0.40, dt) + eventVel * 0.60);
    eventVel *= Math.pow(0.65, dt);

    const flashStrength = clamp01(cfg.flashStrength);
    flash = clamp01(flash * Math.pow(0.10, dt) + eventEnergy * flashStrength * 0.55);

    const { w, h, ow, oh } = resize();

    // clear + optional dim
    ctx.clearRect(0, 0, w, h);
    if (cfg.backgroundDim > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(cfg.backgroundDim, 0, 0.25);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    const t = nowMs / 1000;
    const biasRgb = getBiasRgb();

    // base aurora field
    renderField(offCtx, ow, oh, t, biasRgb);
    compositeField(ctx, off, w, h);

    // constellation overlay
    if (cfg.constellationEnabled) {
      stepNodes(w, h, dt);
      drawLinks(ctx, w, h, t);
      drawNodes(ctx, t);
    }

    // vignette
    const vig = clamp(cfg.vignette, 0, 0.9);
    if (vig > 0.001) drawVignette(ctx, w, h, vig);

    // placement emphasis
    emphasizePlacement(ctx, w, h, cfg.placement, totalHype, flash);
  }

  function renderField(ictx, W, H, t, biasRgb) {
    const img = ictx.getImageData(0, 0, W, H);
    const data = img.data;

    const cx = W * 0.5, cy = H * 0.5;

    const flow = clamp(cfg.flowSpeed, 0.05, 3);
    const rs = clamp(cfg.rainbowSpeed, 0.05, 3);
    const scale = clamp(cfg.rainbowScale, 0.3, 3);

    const sat = clamp01(cfg.saturation);
    const contrast = clamp(cfg.contrast, 0.4, 2.0);
    const complexity = clamp01(cfg.fieldComplexity);
    const bias = clamp(cfg.biasStrength, 0, 1);

    const energy = clamp01(0.15 + 0.85 * totalHype + 0.9 * flash);

    const k1 = 1.6 * scale;
    const k2 = 2.4 * scale;
    const k3 = 3.2 * scale;

    const br = biasRgb.r / 255;
    const bg = biasRgb.g / 255;
    const bb = biasRgb.b / 255;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;

        const nx = (x - cx) / Math.max(1, W);
        const ny = (y - cy) / Math.max(1, H);
        const r = Math.sqrt(nx * nx + ny * ny);

        const w1 = Math.sin((nx * k1 + t * 0.35 * flow) * 6.283);
        const w2 = Math.cos((ny * k2 - t * 0.27 * flow) * 6.283);
        const w3 = Math.sin(((nx + ny) * k3 + t * 0.18 * flow) * 6.283);
        const warp = (w1 + w2 + w3) / 3;

        const hue = frac(
          (nx * 0.9 + ny * 0.6) * (0.85 + 0.85 * complexity) * scale
          + t * 0.10 * rs * (0.75 + 1.25 * energy)
          + warp * (0.20 + 0.55 * complexity)
        );

        const band = 0.5 + 0.5 * Math.sin((ny * 2.4 + warp * 0.9 + t * 0.55 * flow) * 6.283);
        const center = 1 - clamp01(r * 1.6);
        let v = (0.25 + 0.75 * band) * (0.40 + 0.60 * center);
        v = v * (0.55 + 0.85 * energy);

        let rgb = hsvToRgb(hue, sat * (0.6 + 0.4 * energy), clamp01(v));

        // bias tint
        rgb.r = lerp(rgb.r, rgb.r * (1 - bias) + br * bias, 0.65);
        rgb.g = lerp(rgb.g, rgb.g * (1 - bias) + bg * bias, 0.65);
        rgb.b = lerp(rgb.b, rgb.b * (1 - bias) + bb * bias, 0.65);

        // contrast
        rgb.r = clamp01((rgb.r - 0.5) * contrast + 0.5);
        rgb.g = clamp01((rgb.g - 0.5) * contrast + 0.5);
        rgb.b = clamp01((rgb.b - 0.5) * contrast + 0.5);

        data[idx + 0] = (rgb.r * 255) | 0;
        data[idx + 1] = (rgb.g * 255) | 0;
        data[idx + 2] = (rgb.b * 255) | 0;
        data[idx + 3] = 255;
      }
    }

    ictx.putImageData(img, 0, 0);
  }

  function compositeField(ctx, off, w, h) {
    const baseOp = clamp(cfg.baseOpacity, 0, 0.6);
    const boostOp = clamp(cfg.hypeOpacityBoost, 0, 1.2);
    const op = clamp01(baseOp + boostOp * totalHype + 0.35 * flash);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = op;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);

    const bloom = clamp01(cfg.bloomStrength);
    if (bloom > 0.001) {
      ctx.globalAlpha = op * (0.55 + 0.65 * bloom);
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = (18 + 90 * bloom) * (0.25 + 0.95 * totalHype + 0.85 * flash);
      ctx.drawImage(off, 0, 0, w, h);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function stepNodes(w, h, dt) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const age = (performance.now() / 1000) - n.born;
      if (age > n.life) { nodes.splice(i, 1); continue; }

      // drift
      n.x += n.vx * dt;
      n.y += n.vy * dt;

      // gentle pull back into frame
      const pad = 20;
      if (n.x < pad) n.vx += (pad - n.x) * 0.8 * dt;
      if (n.x > w - pad) n.vx -= (n.x - (w - pad)) * 0.8 * dt;
      if (n.y < pad) n.vy += (pad - n.y) * 0.8 * dt;
      if (n.y > h - pad) n.vy -= (n.y - (h - pad)) * 0.8 * dt;

      // damping
      n.vx *= Math.pow(0.25, dt);
      n.vy *= Math.pow(0.25, dt);
    }
  }

  function drawNodes(ctx, t) {
    const size = clamp(cfg.nodeSize, 0.5, 30);
    const glow = clamp01(cfg.nodeGlow);
    const energy = clamp01(0.20 + 0.80 * totalHype + 0.95 * flash);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = (6 + 60 * glow) * (0.25 + 0.95 * energy);

    for (const n of nodes) {
      const age = (performance.now() / 1000) - n.born;
      const p = clamp01(age / n.life);
      const fade = (1 - p);
      const a = clamp01(0.15 + 0.75 * n.power) * fade * (0.5 + 0.8 * energy);

      // node hue cycles
      const hue = frac(n.hueSeed + t * 0.15);
      const rgb = hsvToRgb(hue, clamp01(cfg.saturation), 1);

      ctx.fillStyle = `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},${a})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, size * (0.85 + 0.95 * n.power), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawLinks(ctx, w, h, t) {
    if (nodes.length < 2) return;

    const maxPer = clampInt(cfg.linkMaxPerNode, 0, 12);
    if (maxPer <= 0) return;

    const maxDist = clamp(cfg.linkDistance, 40, 4000);
    const thick = clamp(cfg.linkThickness, 0.2, 40);
    const glow = clamp01(cfg.linkGlow);
    const baseA = clamp01(cfg.linkAlpha);
    const pulseSpd = clamp(cfg.linkPulseSpeed, 0.05, 6);
    const hueSpin = clamp(cfg.linkHueSpin, 0, 4);
    const jit = clamp(cfg.linkJitter, 0, 1);
    const zapChance = clamp(cfg.linkZapChance, 0, 1);

    const energy = clamp01(0.20 + 0.80 * totalHype + 0.95 * flash);

    // Build nearest-neighbor links (limited)
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      const candidates = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= maxDist) candidates.push({ j, d });
      }
      candidates.sort((p, q) => p.d - q.d);
      for (let k = 0; k < Math.min(maxPer, candidates.length); k++) {
        const j = candidates[k].j;
        if (j < i) continue; // avoid duplicates
        links.push({ a: i, b: j, d: candidates[k].d });
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = (4 + 50 * glow) * (0.25 + 0.95 * energy);

    for (const L of links) {
      const A = nodes[L.a];
      const B = nodes[L.b];

      const ageA = (performance.now() / 1000) - A.born;
      const ageB = (performance.now() / 1000) - B.born;
      const fadeA = 1 - clamp01(ageA / A.life);
      const fadeB = 1 - clamp01(ageB / B.life);
      const fade = Math.min(fadeA, fadeB);

      const power = clamp01(0.45 * A.power + 0.45 * B.power + 0.25 * energy);

      const pulse = 0.55 + 0.45 * Math.sin(t * (2.2 * pulseSpd) + L.d * 0.01);
      const zap = (Math.random() < (zapChance * 0.03 * (0.35 + 0.65 * power))) ? 1 : 0;

      const a = baseA * fade * (0.25 + 0.85 * power) * (0.55 + 0.75 * pulse) * (1 + 0.65 * zap);

      // segmented polyline to simulate jitter
      const segs = 10;
      const points = [];
      for (let i = 0; i <= segs; i++) {
        const tt = i / segs;
        let x = lerp(A.x, B.x, tt);
        let y = lerp(A.y, B.y, tt);

        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const nx = -dy / len;
        const ny = dx / len;

        const amp = jit * (8 + 22 * power) * (1 - Math.abs(tt - 0.5) * 1.8);
        const noise = (Math.sin(tt * 17 + t * 6.2) + Math.cos(tt * 11.3 + t * 4.7)) * 0.5;
        x += nx * amp * noise;
        y += ny * amp * noise;

        points.push({ x, y, tt });
      }

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];

        const hue = frac(
          (p0.tt * 0.25) +
          t * 0.18 +
          (A.hueSeed + B.hueSeed) * 0.5 +
          (hueSpin * 0.15 * pulse)
        );
        const rgb = hsvToRgb(hue, clamp01(cfg.saturation), 1);

        ctx.strokeStyle = `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},${a})`;
        ctx.lineWidth = thick * (0.65 + 0.95 * power) * (zap ? 1.25 : 1);

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function emphasizePlacement(ctx, w, h, placement, hype, flash) {
    const a = clamp01(0.06 + 0.14 * hype + 0.18 * flash);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (placement === 'bottom') {
      g.addColorStop(0.0, 'rgba(0,0,0,0)');
      g.addColorStop(0.62, 'rgba(0,0,0,0)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.9)');
    } else {
      g.addColorStop(0.0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.22, 'rgba(0,0,0,0)');
      g.addColorStop(0.78, 'rgba(0,0,0,0)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.85)');
    }

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawVignette(ctx, w, h, strength) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = clamp01(strength);

    const r = Math.max(w, h) * 0.75;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, r * 0.15, w * 0.5, h * 0.5, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  loop(lastMs);

  return {
    destroy() {
      running = false;
      try { if (raf) cancelAnimationFrame(raf); } catch {}
      raf = 0;
      nodes.length = 0;
      if (resolved.created && canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
    setConfig(next) {
      cfg = { ...cfg, ...(next || {}) };
    }
  };
}

/* ---------- Utilities ---------- */
function ensureCanvas(existing, styleKey) {
  if (existing && typeof existing.getContext === 'function') {
    styleCanvas(existing);
    return { canvas: existing, created: false };
  }
  const root = document.getElementById('overlayRoot') || document.body;
  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'prismBloomConstellation';
  styleCanvas(c);
  root.appendChild(c);
  return { canvas: c, created: true };
}

function styleCanvas(c) {
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
}

function pickFactionColorCss(state, mixMode, alpha) {
  const factions = Array.isArray(state?.factions) ? state.factions : [];
  const meters = Array.isArray(state?.meters) ? state.meters : [];
  const a = clamp01(alpha ?? 1);

  if (!factions.length || !meters.length) return `rgba(120,200,255,${a})`;

  const idToColor = new Map();
  for (const f of factions) {
    const id = f?.id ?? f?.key ?? null;
    if (id == null) continue;
    idToColor.set(id, f?.colorHex || f?.color || '#78c8ff');
  }

  let bestId = null;
  let bestV = -1;
  let sum = 0, r = 0, g = 0, b = 0;

  for (const m of meters) {
    const id = m?.factionId ?? m?.id ?? m?.faction ?? null;
    const v = Math.max(0, num(m?.value, num(m?.hype, 0)));
    if (id == null || v <= 0) continue;

    const rgb = hexToRgb(idToColor.get(id) || m?.color || '#78c8ff');
    if (v > bestV) { bestV = v; bestId = id; }

    r += rgb.r * v; g += rgb.g * v; b += rgb.b * v;
    sum += v;
  }

  if (mixMode === 'winner' && bestId != null) {
    const rgb = hexToRgb(idToColor.get(bestId) || '#78c8ff');
    return `rgba(${rgb.r|0},${rgb.g|0},${rgb.b|0},${a})`;
  }

  if (sum <= 0) return `rgba(120,200,255,${a})`;
  return `rgba(${(r/sum)|0},${(g/sum)|0},${(b/sum)|0},${a})`;
}

function rgbaToRgb(rgba) {
  const s = String(rgba || '').trim();
  if (s.startsWith('rgba(') || s.startsWith('rgb(')) {
    const inside = s.substring(s.indexOf('(') + 1, s.lastIndexOf(')')).split(',').map(x => x.trim());
    if (inside.length >= 3) {
      return {
        r: clampInt(Number(inside[0]), 0, 255),
        g: clampInt(Number(inside[1]), 0, 255),
        b: clampInt(Number(inside[2]), 0, 255)
      };
    }
  }
  return hexToRgb(s || '#78c8ff');
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

function num(v, fallback) {
  const n = (typeof v === 'string') ? Number(v) : v;
  return (typeof n === 'number' && isFinite(n)) ? n : fallback;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function clamp01(x) { return clamp(x, 0, 1); }
function clampInt(x, a, b) { return Math.max(a, Math.min(b, x | 0)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }
