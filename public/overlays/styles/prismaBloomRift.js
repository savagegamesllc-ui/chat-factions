// public/overlays/styles/prismBloomRift.js
// PRO Overlay: PrismBloom Rift (Ground Fracture)
// A fixed-position "ground fracture" rift along the bottom that opens on hype spikes,
// glows with prismatic energy, emits shards, and heals as hype decays.
//
// - Downsampled offscreen canvas for the prismatic glow layer (performance)
// - Shard count capped (OBS friendly)
// - placement: bottom|edges (bottom recommended; edges supported)
// - mixMode: weighted|winner (faction tint bias)
// - intensity: 0..2
//
// Contract: export meta + init({ canvas, app, config })

'use strict';

export const meta = {
  styleKey: 'prismBloomRift',
  name: 'PrismBloom Rift (PRO)',
  tier: 'PRO',
  description: 'A fixed ground fracture at the bottom that opens on spikes, glows with rainbow energy, emits shards, and heals over time.',
  defaultConfig: {
    placement: 'bottom',          // bottom | edges
    mixMode: 'weighted',          // weighted | winner
    intensity: 1.0,               // 0..2

    // Performance
    fpsCap: 60,                   // 15..60
    renderScale: 0.38,            // 0.2..0.75 (offscreen prism layer)

    // Base visibility
    baseOpacity: 0.08,            // 0..0.35
    hypeOpacityBoost: 0.55,       // 0..1
    bloomStrength: 0.85,          // 0..1
    backgroundDim: 0.0,           // 0..0.25 (optional dim behind)

    // Rift shape / position (fixed)
    riftY: 0.86,                  // 0..1 as fraction of height (0.86 = near bottom)
    riftWidth: 0.78,              // 0.2..1 fraction of screen width
    riftTilt: -0.06,              // -0.3..0.3 slight tilt in normalized space
    riftJaggedness: 0.65,         // 0..1 crack detail
    riftSegments: 34,             // 10..90
    riftThickness: 10,            // px base crack thickness
    riftOpenMax: 56,              // px maximum opening height
    riftGlow: 0.95,               // 0..1 glow intensity
    riftPulseSpeed: 1.1,          // 0.2..3

    // Spike response
    eventBoost: 1.0,              // 0..2
    spikeSensitivity: 0.9,        // 0..2 (how easily the rift “pops” open)
    openAttack: 7.0,              // 1..20 (how fast it opens)
    openRelease: 1.8,             // 0.2..6 (how fast it heals)

    // Shards
    shardsEnabled: true,
    shardRate: 14,                // base shards/sec
    shardBoost: 80,               // additional shards/sec at max spike/hype
    shardMax: 280,                // cap
    shardLife: 1.1,               // sec
    shardSize: 2.2,               // px
    shardSpeed: 520,              // px/sec
    shardSpread: 0.45,            // 0..1 (angle spread upward)
    shardSpin: 6.0,               // 0..18 (rotation speed)
    shardGravity: 980,            // px/sec^2
    shardGlow: 0.85,              // 0..1
    shardAlpha: 0.55,             // 0..1

    // Prism / rainbow behavior
    rainbowSpeed: 0.9,            // 0.1..2
    rainbowHueShift: 1.1,         // 0..2 (how quickly hues move along rift)
    saturation: 0.95,             // 0..1
    contrast: 1.05,               // 0.6..1.6
    biasStrength: 0.22,           // 0..0.75 faction tint influence

    // Vignette
    vignette: 0.30                // 0..0.8
  },
  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['bottom', 'edges'], default: 'bottom' },
    { key: 'mixMode', label: 'Bias Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'renderScale', label: 'Render Scale', type: 'range', min: 0.2, max: 0.75, step: 0.01, default: 0.38 },

    { key: 'baseOpacity', label: 'Base Opacity', type: 'range', min: 0, max: 0.35, step: 0.01, default: 0.08 },
    { key: 'hypeOpacityBoost', label: 'Hype Opacity Boost', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'bloomStrength', label: 'Bloom Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.0 },

    { key: 'riftY', label: 'Rift Height', type: 'range', min: 0.6, max: 0.95, step: 0.01, default: 0.86 },
    { key: 'riftWidth', label: 'Rift Width', type: 'range', min: 0.2, max: 1, step: 0.01, default: 0.78 },
    { key: 'riftTilt', label: 'Rift Tilt', type: 'range', min: -0.3, max: 0.3, step: 0.01, default: -0.06 },
    { key: 'riftJaggedness', label: 'Jaggedness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: 'riftSegments', label: 'Segments', type: 'range', min: 10, max: 90, step: 1, default: 34 },
    { key: 'riftThickness', label: 'Crack Thickness', type: 'range', min: 2, max: 30, step: 1, default: 10 },
    { key: 'riftOpenMax', label: 'Max Opening', type: 'range', min: 10, max: 140, step: 2, default: 56 },
    { key: 'riftGlow', label: 'Rift Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.95 },
    { key: 'riftPulseSpeed', label: 'Pulse Speed', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1.1 },

    { key: 'eventBoost', label: 'Event Boost', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'spikeSensitivity', label: 'Spike Sensitivity', type: 'range', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'openAttack', label: 'Open Attack', type: 'range', min: 1, max: 20, step: 0.5, default: 7.0 },
    { key: 'openRelease', label: 'Open Release', type: 'range', min: 0.2, max: 6, step: 0.1, default: 1.8 },

    { key: 'shardsEnabled', label: 'Enable Shards', type: 'checkbox', default: true },
    { key: 'shardRate', label: 'Shard Rate', type: 'range', min: 0, max: 120, step: 1, default: 14 },
    { key: 'shardBoost', label: 'Shard Boost', type: 'range', min: 0, max: 220, step: 5, default: 80 },
    { key: 'shardMax', label: 'Max Shards', type: 'range', min: 40, max: 800, step: 10, default: 280 },
    { key: 'shardLife', label: 'Shard Life', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1.1 },
    { key: 'shardSize', label: 'Shard Size', type: 'range', min: 0.8, max: 8, step: 0.1, default: 2.2 },
    { key: 'shardSpeed', label: 'Shard Speed', type: 'range', min: 120, max: 1400, step: 20, default: 520 },
    { key: 'shardSpread', label: 'Shard Spread', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'shardSpin', label: 'Shard Spin', type: 'range', min: 0, max: 18, step: 0.1, default: 6.0 },
    { key: 'shardGravity', label: 'Gravity', type: 'range', min: 0, max: 2200, step: 20, default: 980 },
    { key: 'shardGlow', label: 'Shard Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'shardAlpha', label: 'Shard Alpha', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },

    { key: 'rainbowSpeed', label: 'Rainbow Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.9 },
    { key: 'rainbowHueShift', label: 'Hue Shift', type: 'range', min: 0, max: 2, step: 0.05, default: 1.1 },
    { key: 'saturation', label: 'Saturation', type: 'range', min: 0, max: 1, step: 0.01, default: 0.95 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.6, max: 1.6, step: 0.01, default: 1.05 },
    { key: 'biasStrength', label: 'Faction Bias Strength', type: 'range', min: 0, max: 0.75, step: 0.01, default: 0.22 },

    { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.30 }
  ]
};

export function init({ canvas, app, config }) {
  const resolved = ensureCanvas(canvas, meta.styleKey);
  canvas = resolved.canvas;
  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Offscreen prism glow layer
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { willReadFrequently: false });

  // App state
  let factions = [];
  let meters = [];
  let totalHype = 0;

  // Spike / energy
  let lastMeterMap = new Map();
  let spikeVel = 0;     // instantaneous spike velocity
  let spikeEnergy = 0;  // smoothed spike energy 0..1
  let openAmt = 0;      // rift openness 0..1
  let flash = 0;

  // Shards
  const shards = []; // {x,y,vx,vy,life,t,rot,vr,hueSeed,power}
  let shardCarry = 0;

  // Loop
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  // Subscriptions (defensive)
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

  function ingestMeters(m) {
    meters = Array.isArray(m) ? m : [];

    let sum = 0;
    const cur = new Map();
    for (const it of meters) {
      const id = it?.factionId ?? it?.id ?? it?.faction ?? null;
      const v = Math.max(0, num(it?.value, num(it?.hype, 0)));
      if (id != null) cur.set(id, v);
      sum += v;
    }

    const base = clamp01(1 - Math.exp(-sum / 180));
    totalHype = clamp01(base * clamp(cfg.intensity, 0, 2));

    // delta -> spike
    let delta = 0;
    for (const [id, v] of cur.entries()) {
      const prev = lastMeterMap.get(id) ?? 0;
      delta += Math.abs(v - prev);
    }
    for (const [id, prev] of lastMeterMap.entries()) {
      if (!cur.has(id)) delta += Math.abs(prev);
    }
    lastMeterMap = cur;

    const bump01 = clamp01(delta / 28) * clamp(cfg.eventBoost, 0, 2);
    spikeVel += bump01 * 1.35 * clamp(cfg.spikeSensitivity, 0, 2);
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

  function computeRiftPath(w, h, t) {
    const y0 = clamp(cfg.riftY, 0, 1) * h;
    const width = clamp(cfg.riftWidth, 0.1, 1) * w;
    const x0 = (w - width) * 0.5;
    const x1 = x0 + width;

    const segs = clampInt(cfg.riftSegments, 6, 180);
    const jag = clamp01(cfg.riftJaggedness);
    const tilt = clamp(cfg.riftTilt, -1, 1);

    // create a jagged polyline baseline
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const x = lerp(x0, x1, u);
      // deterministic-ish noise from sines (fast and stable)
      const n =
        Math.sin((u * 9.7 + 0.13) * Math.PI * 2 + t * 0.35) * 0.45 +
        Math.sin((u * 21.3 + 0.41) * Math.PI * 2 - t * 0.22) * 0.32 +
        Math.cos((u * 37.1 + 0.77) * Math.PI * 2 + t * 0.18) * 0.23;

      const y = y0
        + (u - 0.5) * tilt * 120
        + n * (10 + 28 * jag);

      pts.push({ x, y, u });
    }
    return pts;
  }

  function spawnShards(dt, w, h, pts, t, biasRgb) {
    if (!cfg.shardsEnabled) return;

    const base = clamp(cfg.shardRate, 0, 600);
    const boost = clamp(cfg.shardBoost, 0, 1200);

    const rate = base + boost * clamp01(0.55 * totalHype + 0.75 * spikeEnergy);
    shardCarry += rate * dt;

    let count = Math.floor(shardCarry);
    shardCarry -= count;

    // cap by max
    const max = clampInt(cfg.shardMax, 0, 5000);
    if (max <= 0) return;

    const life = clamp(cfg.shardLife, 0.1, 8);
    const size = clamp(cfg.shardSize, 0.2, 40);
    const speed = clamp(cfg.shardSpeed, 0, 4000);
    const spread = clamp01(cfg.shardSpread);
    const spin = clamp(cfg.shardSpin, 0, 50);
    const grav = clamp(cfg.shardGravity, 0, 10000);

    // choose spawn points along rift proportional to energy
    const power = clamp01(0.25 + 0.75 * openAmt);
    count = Math.min(count, 60); // hard cap per frame

    for (let i = 0; i < count; i++) {
      if (shards.length >= max) shards.shift();

      const p = pts[(Math.random() * pts.length) | 0];
      const hueSeed = Math.random();

      // upward biased velocity, with spread
      const angBase = -Math.PI / 2;
      const ang = angBase + (Math.random() - 0.5) * spread * Math.PI * 0.85;
      const sp = speed * (0.35 + 0.85 * power) * (0.65 + 0.75 * Math.random());

      shards.push({
        x: p.x,
        y: p.y - 2,
        vx: Math.cos(ang) * sp + (Math.random() - 0.5) * 50,
        vy: Math.sin(ang) * sp,
        life: life * (0.75 + 0.7 * Math.random()),
        t: 0,
        size: size * (0.7 + 0.8 * Math.random()),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * spin * 2,
        grav,
        hueSeed,
        power
      });
    }
  }

  function stepShards(dt) {
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.t += dt;
      s.vy += s.grav * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vr * dt;

      // mild drag
      s.vx *= Math.pow(0.45, dt);
      s.vy *= Math.pow(0.78, dt);

      if (s.t >= s.life) shards.splice(i, 1);
    }
  }

  function renderPrismGlow(offCtx, ow, oh, t, biasRgb, openAmt) {
    // Render a bottom-region prism glow with hue shifts, then scale up.
    const img = offCtx.getImageData(0, 0, ow, oh);
    const data = img.data;

    const energy = clamp01(0.20 + 0.80 * totalHype + 0.95 * flash);
    const hueShift = clamp(cfg.rainbowHueShift, 0, 3);
    const sat = clamp01(cfg.saturation);
    const contrast = clamp(cfg.contrast, 0.4, 2.0);
    const bias = clamp(cfg.biasStrength, 0, 1);

    const br = biasRgb.r / 255;
    const bg = biasRgb.g / 255;
    const bb = biasRgb.b / 255;

    // glow band near bottom
    for (let y = 0; y < oh; y++) {
      const ny = y / Math.max(1, oh - 1); // 0 top .. 1 bottom
      for (let x = 0; x < ow; x++) {
        const nx = x / Math.max(1, ow - 1);

        // band intensity concentrated near bottom + opening
        const band = clamp01((ny - 0.45) / 0.55);
        const ridge = Math.pow(band, 2.2) * (0.35 + 0.9 * openAmt);
        const wave = 0.5 + 0.5 * Math.sin((nx * 3.2 + t * 0.75 * clamp(cfg.rainbowSpeed, 0.05, 3)) * Math.PI * 2);

        const hue = frac(nx * (0.7 + 0.6 * energy) + t * 0.12 * hueShift + wave * 0.12);
        let rgb = hsvToRgb(hue, sat * (0.65 + 0.35 * energy), clamp01(ridge * (0.45 + 0.85 * wave)));

        // bias tint
        rgb.r = lerp(rgb.r, rgb.r * (1 - bias) + br * bias, 0.6);
        rgb.g = lerp(rgb.g, rgb.g * (1 - bias) + bg * bias, 0.6);
        rgb.b = lerp(rgb.b, rgb.b * (1 - bias) + bb * bias, 0.6);

        // contrast
        rgb.r = clamp01((rgb.r - 0.5) * contrast + 0.5);
        rgb.g = clamp01((rgb.g - 0.5) * contrast + 0.5);
        rgb.b = clamp01((rgb.b - 0.5) * contrast + 0.5);

        const idx = (y * ow + x) * 4;
        data[idx + 0] = (rgb.r * 255) | 0;
        data[idx + 1] = (rgb.g * 255) | 0;
        data[idx + 2] = (rgb.b * 255) | 0;
        data[idx + 3] = 255;
      }
    }

    offCtx.putImageData(img, 0, 0);
  }

  function drawRift(ctx, w, h, pts, t, biasRgb) {
    const thick = clamp(cfg.riftThickness, 1, 80);
    const openPx = clamp(cfg.riftOpenMax, 4, 220) * openAmt;
    const glow = clamp01(cfg.riftGlow);
    const pulse = 0.65 + 0.35 * Math.sin(t * (2.0 * clamp(cfg.riftPulseSpeed, 0.2, 6)));

    const energy = clamp01(0.18 + 0.82 * totalHype + 0.95 * flash);

    // Draw fracture shadow
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = clamp01(cfg.baseOpacity + cfg.hypeOpacityBoost * totalHype) * 0.55;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = thick * (0.9 + 0.7 * openAmt);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const y = p.y + openPx * 0.12; // slight offset
      if (i === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Draw crack core + rainbow edges
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const hueSpeed = clamp(cfg.rainbowSpeed, 0.05, 3);
    const hueShift = clamp(cfg.rainbowHueShift, 0, 3);
    const sat = clamp01(cfg.saturation);

    // glow
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = (10 + 80 * glow) * (0.25 + 0.95 * energy);

    // we draw in small segments so hue can shift along the crack
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];

      const u = (a.u + b.u) * 0.5;
      const hue = frac(u * (0.35 + 0.85 * hueShift) + t * 0.12 * hueSpeed + openAmt * 0.08);
      const rgb = hsvToRgb(hue, sat, 1);

      const alpha = clamp01(0.08 + 0.65 * openAmt) * pulse * (0.5 + 0.85 * energy);

      // outer glow stroke
      ctx.strokeStyle = `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},${alpha})`;
      ctx.lineWidth = thick * (1.25 + 0.65 * openAmt);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // bright inner seam
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
      ctx.lineWidth = Math.max(1, thick * (0.18 + 0.18 * openAmt));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.restore();

    // Draw the open "rift mouth" as a filled gradient above the crack
    if (openPx > 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp01(0.10 + 0.55 * openAmt) * (0.55 + 0.75 * energy);

      const g = ctx.createLinearGradient(0, h, 0, h - openPx * 2.2);
      g.addColorStop(0, 'rgba(255,255,255,0.8)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = g;

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const yTop = p.y - openPx * (0.65 + 0.22 * Math.sin(p.u * 9 + t * 2.2));
        if (i === 0) ctx.moveTo(p.x, yTop);
        else ctx.lineTo(p.x, yTop);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  function compositeGlowLayer(ctx, w, h, t, openAmt) {
    const baseOp = clamp(cfg.baseOpacity, 0, 0.6);
    const boostOp = clamp(cfg.hypeOpacityBoost, 0, 1.2);
    const op = clamp01(baseOp + boostOp * totalHype + 0.30 * flash);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = op * (0.55 + 0.85 * openAmt);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);

    const bloom = clamp01(cfg.bloomStrength);
    if (bloom > 0.001) {
      ctx.globalAlpha = op * (0.65 + 0.7 * bloom) * (0.55 + 0.85 * openAmt);
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = (20 + 100 * bloom) * (0.25 + 0.95 * totalHype + 0.85 * flash);
      ctx.drawImage(off, 0, 0, w, h);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function drawShards(ctx, w, h, t) {
    if (!cfg.shardsEnabled) return;
    const glow = clamp01(cfg.shardGlow);
    const alphaBase = clamp01(cfg.shardAlpha);
    const sat = clamp01(cfg.saturation);
    const hueSpeed = clamp(cfg.rainbowSpeed, 0.05, 3);

    const energy = clamp01(0.20 + 0.80 * totalHype + 0.95 * flash);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = (6 + 60 * glow) * (0.25 + 0.95 * energy);

    for (const s of shards) {
      const p = clamp01(s.t / s.life);
      const fade = (1 - p);
      const a = alphaBase * fade * (0.25 + 0.85 * s.power) * (0.55 + 0.85 * energy);

      const hue = frac(s.hueSeed + t * 0.12 * hueSpeed + p * 0.15);
      const rgb = hsvToRgb(hue, sat, 1);

      ctx.fillStyle = `rgba(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0},${a})`;

      // draw shard as a small rotated quad
      const sz = s.size;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);

      ctx.beginPath();
      ctx.moveTo(-sz * 0.4, -sz * 1.2);
      ctx.lineTo(sz * 0.7, -sz * 0.2);
      ctx.lineTo(sz * 0.35, sz * 1.2);
      ctx.lineTo(-sz * 0.75, sz * 0.25);
      ctx.closePath();
      ctx.fill();

      // small highlight
      ctx.globalAlpha *= 0.8;
      ctx.fillStyle = `rgba(255,255,255,${a * 0.35})`;
      ctx.fillRect(-sz * 0.12, -sz * 0.9, sz * 0.24, sz * 1.8);

      ctx.restore();
    }

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

    // smooth spike energy
    spikeVel *= Math.pow(0.12, dt);
    spikeEnergy = clamp01(spikeEnergy * Math.pow(0.40, dt) + spikeVel * 0.60);
    spikeVel *= Math.pow(0.65, dt);

    // openAmt dynamics: fast attack, slower release
    const atk = clamp(cfg.openAttack, 0.1, 60);
    const rel = clamp(cfg.openRelease, 0.05, 60);

    const target = clamp01(0.10 + 0.70 * totalHype + 0.95 * spikeEnergy);
    if (target > openAmt) openAmt = lerp(openAmt, target, 1 - Math.exp(-atk * dt));
    else openAmt = lerp(openAmt, target, 1 - Math.exp(-rel * dt));

    // flash
    const f = clamp01(0.35 * spikeEnergy + 0.25 * openAmt);
    flash = clamp01(flash * Math.pow(0.12, dt) + f * clamp01(cfg.bloomStrength) * 0.55);

    const { w, h, ow, oh } = resize();
    const t = nowMs / 1000;

    // clear + optional dim
    ctx.clearRect(0, 0, w, h);
    if (cfg.backgroundDim > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(cfg.backgroundDim, 0, 0.25);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    const biasRgb = getBiasRgb();

    // rift path (fixed location)
    const pts = computeRiftPath(w, h, t);

    // prism glow layer
    renderPrismGlow(offCtx, ow, oh, t, biasRgb, openAmt);
    compositeGlowLayer(ctx, w, h, t, openAmt);

    // rift itself
    drawRift(ctx, w, h, pts, t, biasRgb);

    // shards
    spawnShards(dt, w, h, pts, t, biasRgb);
    stepShards(dt);
    drawShards(ctx, w, h, t);

    // vignette
    const vig = clamp(cfg.vignette, 0, 0.9);
    if (vig > 0.001) drawVignette(ctx, w, h, vig);

    emphasizePlacement(ctx, w, h, cfg.placement, totalHype, flash);
  }

  loop(lastMs);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      shards.length = 0;
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
  c.dataset.style = styleKey || 'prismBloomRift';
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
      return { r: clampInt(Number(inside[0]), 0, 255), g: clampInt(Number(inside[1]), 0, 255), b: clampInt(Number(inside[2]), 0, 255) };
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
