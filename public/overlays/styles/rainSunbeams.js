// public/overlays/styles/rainSunbeams.js
//
// FREE/PRO-friendly Overlay: Rainstorm -> Sunbeams
// - Low hype: stormy rain + mist + occasional lightning glow
// - High hype: rain fades out, clouds brighten, soft sun beams sweep slowly
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Notes:
// - Uses a single canvas (OBS-safe), pointer-events:none
// - Hype computed from meters snapshot: sum(factions[].meter)
// - Maps "clear" = hypeNormalized (0 = storm, 1 = sunny beams)

'use strict';

export const meta = {
  styleKey: 'rainSunbeams',
  name: 'Rain → Sunbeams',
  tier: 'FREE',
  description:
    'Starts as a rainstorm and gradually clears into soft sunbeams as hype rises. Designed to stay gentle and readable in OBS.',

  defaultConfig: {
    // --- performance ---
    fpsCap: 60,                 // 15..60
    renderScale: 1.0,           // 0.5..1 (lower = faster)

    // --- hype mapping ---
    intensity: 1.0,             // 0..2
    hypeK: 160,                 // larger = slower to clear
    maxTotalClamp: 2200,
    hypeSmoothing: 0.18,        // 0.05..0.5

    // --- rain ---
    rainMax: 900,               // particle cap
    rainRate: 520,              // drops/sec at full storm
    rainSpeed: 1050,            // px/sec
    rainAngleDeg: 12,           // wind tilt
    rainDropLength: 18,         // px
    rainThickness: 1.25,        // px
    rainAlpha: 0.30,            // 0..1
    rainJitter: 0.25,           // 0..1

    // --- storm atmosphere ---
    cloudOpacity: 0.30,         // base cloud layer alpha
    mistOpacity: 0.18,          // base mist alpha
    vignette: 0.22,             // edge darkening

    // --- lightning (subtle) ---
    lightningEnabled: true,
    lightningChancePerSec: 0.06, // at full storm (scaled down as it clears)
    lightningFlash: 0.28,        // max flash alpha
    lightningDecay: 2.6,         // higher = faster fade

    // --- sunbeams ---
    beamCount: 5,               // number of beams
    beamOpacity: 0.16,          // base beam alpha
    beamWidth: 0.22,            // fraction of screen width
    beamSoftness: 0.45,         // 0..1
    beamSpeed: 0.06,            // sweep speed
    beamAngleDeg: -18,          // beam tilt
    beamFlicker: 0.18,          // 0..1 subtle shimmer

    // --- overall color shaping ---
    stormTint: [90, 140, 190],  // bluish rain color
    sunTint: [255, 245, 220],   // warm beam color
  },

  controls: [
    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 },
    { key: 'renderScale', label: 'Render Scale', type: 'range', min: 0.5, max: 1, step: 0.05, default: 1.0 },

    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 160 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },

    { key: 'rainMax', label: 'Max Raindrops', type: 'range', min: 100, max: 2000, step: 25, default: 900 },
    { key: 'rainRate', label: 'Rain Rate', type: 'range', min: 0, max: 1200, step: 10, default: 520 },
    { key: 'rainSpeed', label: 'Rain Speed', type: 'range', min: 200, max: 2600, step: 25, default: 1050 },
    { key: 'rainAngleDeg', label: 'Rain Angle', type: 'range', min: -35, max: 35, step: 1, default: 12 },
    { key: 'rainAlpha', label: 'Rain Alpha', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.30 },

    { key: 'cloudOpacity', label: 'Cloud Opacity', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.30 },
    { key: 'mistOpacity', label: 'Mist Opacity', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18 },
    { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.22 },

    { key: 'beamCount', label: 'Beam Count', type: 'range', min: 0, max: 12, step: 1, default: 5 },
    { key: 'beamOpacity', label: 'Beam Opacity', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.16 },
    { key: 'beamWidth', label: 'Beam Width', type: 'range', min: 0.05, max: 0.6, step: 0.01, default: 0.22 },
    { key: 'beamSpeed', label: 'Beam Speed', type: 'range', min: 0.0, max: 0.25, step: 0.01, default: 0.06 },
    { key: 'beamAngleDeg', label: 'Beam Angle', type: 'range', min: -45, max: 45, step: 1, default: -18 },
  ],
};

function clamp(n, a, b) { n = Number(n); return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a)); }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function toRad(deg) { return (deg * Math.PI) / 180; }

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'rainSunbeams';
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.pointerEvents = 'none';
  c.style.display = 'block';
  c.style.transform = 'translateZ(0)';
  c.style.willChange = 'transform, opacity, filter';

  container.appendChild(c);
  root.appendChild(container);
  return { container, canvas: c };
}

function resizeCanvas(canvas, renderScale) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();

  const scale = clamp(renderScale ?? 1, 0.5, 1);
  const W = Math.max(1, Math.floor(rect.width * dpr * scale));
  const H = Math.max(1, Math.floor(rect.height * dpr * scale));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  // Return CSS pixels (unscaled) plus internal scale factor
  return { w: rect.width, h: rect.height, dpr, scale };
}

function computeTotalAndClear(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2200, 200, 6000));

  const k = clamp(cfg.hypeK ?? 160, 40, 600);
  let h = 1 - Math.exp(-total / k);         // 0..1
  h = clamp01(h + (1 - h) * 0.06 * Math.min(1, total / 70));
  // "clear" is hype: 0 = storm, 1 = clear sunbeams
  return { total, clear: clamp01(h * clamp(cfg.intensity ?? 1, 0, 2)) };
}

function drawVignette(ctx, w, h, strength) {
  const s = clamp01(strength);
  if (s <= 0.0001) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = s;
  const r = Math.max(w, h) * 0.75;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, r * 0.15, w * 0.5, h * 0.5, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function noise2(x, y) {
  // cheap hash noise 0..1 (no allocations)
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function init({ root, config, api }) {
  // Mount (keep consistent with your other overlays)
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Rain particles: {x,y,vx,vy,len,life}
  const drops = [];
  let rainCarry = 0;

  // Hype state
  let latestSnap = { factions: [] };
  let clearTarget = 0;
  let clearSmooth = 0;

  // Lightning flash
  let flash = 0;

  // Loop control
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeTotalAndClear(latestSnap, cfg);
    clearTarget = res.clear;
  });

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    const res = computeTotalAndClear(latestSnap, cfg);
    clearTarget = res.clear;
  }

  function maybeResize() {
    const r = resizeCanvas(canvas, cfg.renderScale);
    // Draw in CSS pixel coordinates (so config values feel normal)
    ctx.setTransform(r.dpr * r.scale, 0, 0, r.dpr * r.scale, 0, 0);
    return r;
  }

  const onResize = () => { maybeResize(); };
  window.addEventListener('resize', onResize, { passive: true });

  function spawnRain(dt, w, h, storm) {
    // storm: 0..1 (1 = full storm)
    const max = clamp(cfg.rainMax ?? 900, 0, 5000);
    if (max <= 0) return;

    const rate = clamp(cfg.rainRate ?? 520, 0, 2500) * storm;
    rainCarry += rate * dt;
    let count = Math.floor(rainCarry);
    rainCarry -= count;

    // Safety cap
    count = Math.min(count, 120);

    const angle = toRad(clamp(cfg.rainAngleDeg ?? 12, -45, 45));
    const spd = clamp(cfg.rainSpeed ?? 1050, 0, 5000);
    const len = clamp(cfg.rainDropLength ?? 18, 4, 80);

    // Wind components
    const vx = Math.sin(angle) * spd;
    const vy = Math.cos(angle) * spd;

    for (let i = 0; i < count; i++) {
      if (drops.length >= max) drops.shift();

      // Spawn slightly above/left so angled rain fills screen
      const x = (Math.random() * (w + 200)) - 100;
      const y = -40 - Math.random() * 120;

      drops.push({
        x, y,
        vx: vx * (0.85 + 0.3 * Math.random()),
        vy: vy * (0.85 + 0.3 * Math.random()),
        len: len * (0.7 + 0.8 * Math.random()),
        life: 0
      });
    }
  }

  function stepRain(dt, w, h) {
    const jitter = clamp01(cfg.rainJitter ?? 0.25);
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life += dt;

      // subtle flutter
      const n = (Math.sin(d.life * 8.0 + d.x * 0.01) * 0.5 + 0.5);
      const j = (n - 0.5) * 2 * 120 * jitter;

      d.x += (d.vx + j) * dt;
      d.y += d.vy * dt;

      if (d.y > h + 60 || d.x < -260 || d.x > w + 260) drops.splice(i, 1);
    }
  }

  function drawClouds(ctx, w, h, storm, clear, t) {
    // A soft moving “cloud” veil. Storm = darker, Clear = brighter & thinner.
    const baseA = clamp01(cfg.cloudOpacity ?? 0.30);
    const a = baseA * lerp(1.25, 0.35, clear);

    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;

    // Build a few large radial blobs
    const driftX = (t * 12) % (w + 400);
    const driftY = (t * 6) % (h + 300);

    for (let i = 0; i < 6; i++) {
      const px = ((i * 0.18 * w) + driftX) % (w + 400) - 200;
      const py = ((i * 0.13 * h) + driftY) % (h + 300) - 150;

      const r = (0.35 + 0.25 * Math.sin(t * 0.35 + i)) * Math.max(w, h);
      const g = ctx.createRadialGradient(px, py, r * 0.15, px, py, r);

      const dark = 0.08 + 0.18 * storm;
      const light = 0.06 + 0.10 * (1 - storm);

      g.addColorStop(0, `rgba(0,0,0,${dark})`);
      g.addColorStop(1, `rgba(0,0,0,0)`);

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // faint bright breaks as it clears (cloud gaps)
      if (clear > 0.25) {
        const gg = ctx.createRadialGradient(px + r * 0.12, py + r * 0.06, r * 0.05, px, py, r * 0.55);
        gg.addColorStop(0, `rgba(255,255,255,${light * clear})`);
        gg.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, w, h);
      }
    }

    ctx.restore();
  }

  function drawMist(ctx, w, h, storm, clear, t) {
    const base = clamp01(cfg.mistOpacity ?? 0.18);
    const a = base * lerp(1.2, 0.55, clear) * (0.65 + 0.35 * storm);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = a;

    const bandY = h * 0.78;
    const g = ctx.createLinearGradient(0, bandY - h * 0.22, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;

    // slight horizontal waviness
    const wig = Math.sin(t * 0.35) * 12;
    ctx.translate(wig, 0);
    ctx.fillRect(-40, bandY - h * 0.22, w + 80, h);
    ctx.restore();
  }

  function maybeLightning(dt, storm) {
    if (!cfg.lightningEnabled) return;

    const chance = clamp(cfg.lightningChancePerSec ?? 0.06, 0, 1) * storm;
    if (Math.random() < chance * dt) {
      flash = Math.max(flash, clamp01(cfg.lightningFlash ?? 0.28));
    }
  }

  function drawLightningFlash(ctx, w, h) {
    if (flash <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = flash;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawRain(ctx, w, h, storm, t) {
    if (storm <= 0.001) return;

    const tint = cfg.stormTint || [90, 140, 190];
    const aBase = clamp01(cfg.rainAlpha ?? 0.30) * storm;
    const thick = clamp(cfg.rainThickness ?? 1.25, 0.5, 4);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';

    // draw in batches
    for (const d of drops) {
      const p = (d.life * 0.9) % 1;
      const aa = aBase * (0.55 + 0.45 * (1 - p));

      // subtle per-drop shimmer
      const shimmer = (noise2(d.x * 0.02, t * 0.5) - 0.5) * 0.25;
      const r = tint[0] + 40 * shimmer;
      const g = tint[1] + 50 * shimmer;
      const b = tint[2] + 60 * shimmer;

      ctx.strokeStyle = `rgba(${r|0},${g|0},${b|0},${aa})`;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - (d.vx / d.vy) * d.len * 0.9, d.y - d.len);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSunbeams(ctx, w, h, clear, t) {
    const count = Math.max(0, (cfg.beamCount | 0));
    if (count <= 0 || clear <= 0.02) return;

    const baseOp = clamp01(cfg.beamOpacity ?? 0.16);
    const op = baseOp * clamp01((clear - 0.10) / 0.90);

    const widthFrac = clamp(cfg.beamWidth ?? 0.22, 0.05, 0.9);
    const soft = clamp01(cfg.beamSoftness ?? 0.45);
    const speed = clamp(cfg.beamSpeed ?? 0.06, 0, 0.6);
    const ang = toRad(clamp(cfg.beamAngleDeg ?? -18, -80, 80));
    const flick = clamp01(cfg.beamFlicker ?? 0.18);

    const sun = cfg.sunTint || [255, 245, 220];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Rotate space so beams can be drawn as vertical gradients
    const cx = w * 0.5, cy = h * 0.5;
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.translate(-cx, -cy);

    const beamW = w * widthFrac;
    const sweep = (t * speed) % 1;

    for (let i = 0; i < count; i++) {
      const phase = (i / count + sweep) % 1;
      const x = lerp(-beamW, w + beamW, phase);

      // shimmer modulation
      const mod = 1 + (Math.sin(t * 1.3 + i * 2.1) * 0.5 + 0.5) * flick;

      const g = ctx.createLinearGradient(x - beamW * 0.5, 0, x + beamW * 0.5, 0);

      const edgeA = op * (0.12 + 0.22 * soft) * mod;
      const midA = op * (0.42 + 0.55 * (1 - soft)) * mod;

      g.addColorStop(0.0, `rgba(${sun[0]},${sun[1]},${sun[2]},0)`);
      g.addColorStop(0.25, `rgba(${sun[0]},${sun[1]},${sun[2]},${edgeA})`);
      g.addColorStop(0.5, `rgba(${sun[0]},${sun[1]},${sun[2]},${midA})`);
      g.addColorStop(0.75, `rgba(${sun[0]},${sun[1]},${sun[2]},${edgeA})`);
      g.addColorStop(1.0, `rgba(${sun[0]},${sun[1]},${sun[2]},0)`);

      ctx.fillStyle = g;
      ctx.globalAlpha = 1;

      // beam "shaft" that fades vertically (brighter near top)
      const vg = ctx.createLinearGradient(0, 0, 0, h);
      vg.addColorStop(0.0, 'rgba(255,255,255,1)');
      vg.addColorStop(0.6, 'rgba(255,255,255,0.35)');
      vg.addColorStop(1.0, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillRect(x - beamW * 0.6, 0, beamW * 1.2, h);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = vg;
      ctx.fillRect(x - beamW * 0.6, 0, beamW * 1.2, h);
      ctx.restore();

      // re-apply horizontal color softness
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(x - beamW * 0.6, 0, beamW * 1.2, h);
      ctx.restore();
    }

    ctx.restore();
  }

  function loop(nowMs) {
    raf = requestAnimationFrame(loop);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const cap = clamp(cfg.fpsCap ?? 60, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // Smooth "clear" (storm -> sunny)
    const smooth = clamp(cfg.hypeSmoothing ?? 0.18, 0.05, 0.5);
    clearSmooth = lerp(clearSmooth, clearTarget, 1 - Math.exp(-(1 / smooth) * dt));
    clearSmooth = clamp01(clearSmooth);

    const storm = clamp01(1 - clearSmooth);
    maybeLightning(dt, storm);

    // Fade flash
    const decay = clamp(cfg.lightningDecay ?? 2.6, 0.5, 10);
    flash = Math.max(0, flash - decay * dt);

    const { w, h } = maybeResize();
    const t = nowMs / 1000;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Spawn/step rain
    spawnRain(dt, w, h, storm);
    stepRain(dt, w, h);

    // Atmosphere layers (clouds + mist)
    drawClouds(ctx, w, h, storm, clearSmooth, t);
    drawMist(ctx, w, h, storm, clearSmooth, t);

    // Rain layer
    drawRain(ctx, w, h, storm, t);

    // Lightning flash over storm (subtle)
    drawLightningFlash(ctx, w, h);

    // Sunbeams come in as it clears
    drawSunbeams(ctx, w, h, clearSmooth, t);

    // Vignette (slightly stronger in storm)
    const vig = clamp01(cfg.vignette ?? 0.22) * lerp(1.15, 0.65, clearSmooth);
    drawVignette(ctx, w, h, vig);
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    try { window.removeEventListener('resize', onResize); } catch {}
    drops.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  maybeResize();
  raf = requestAnimationFrame(loop);

  return { destroy, setConfig };
}
