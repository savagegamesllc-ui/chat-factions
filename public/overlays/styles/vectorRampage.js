// public/overlays/styles/vectorRampage.js
// PRO Overlay: VectorRampage (Vectorman-inspired sprite shooter)
//
// Contract:
//   export const meta
//   export function init({ root, config, api }) -> { destroy(), setConfig(next) }
//
// Goals:
// - OBS-safe: one canvas, pointer-events none, no DOM churn
// - Hype ramps spectacle (power, glow, flash, shake) without killing FPS
// - Fixed object caps + pooling for stable performance
// - Works code-first with placeholder art; atlas support can be added later

'use strict';

export const meta = {
  styleKey: 'vectorRampage',
  name: 'VectorRampage (PRO)',
  tier: 'PRO',
  description:
    'Vectorman-inspired orb-bot fires at drifting junk. Shots upgrade with hype (power, glow, flash, shake) while strict caps protect FPS.',

  defaultConfig: {
    // Placement
    anchor: 'bottomLeft', // bottomLeft | bottomRight | custom
    anchorX: 0.12,        // used when anchor=custom
    anchorY: 0.82,        // used when anchor=custom
    avatarSafePad: 0.08,  // 0..0.25 extra padding from edges

    // Playfield (where targets drift)
    playfieldTop: 0.08,   // 0..0.4
    playfieldBottom: 0.68,// 0.3..0.9
    playfieldPadPx: 18,

    // Hype mapping
    hypeK: 170,           // higher = slower ramp
    maxTotalClamp: 2200,
    hypeSmoothing: 0.18,  // 0.05..0.5
    intensity: 1.0,       // 0..2

    // Performance
    fpsCap: 60,           // 30..60 recommended
    renderScale: 1.0,     // 0.5..1.0 (downsample for weak machines)
    dprCap: 2,

    // Caps (primary perf knobs)
    targetCap: 7,
    projectileCap: 12,
    impactCap: 8,

    // Feel
    aggression: 0.55,     // 0..1 (how often to fire as hype rises)
    targetSpeed: 55,      // px/sec base drift
    projectileSpeed: 640, // px/sec base
    projectileLife: 0.9,  // sec
    impactLife: 0.45,     // sec
    shakeStrength: 1.0,   // 0..2
    flashStrength: 1.0,   // 0..2

    // Visual style (placeholder)
    botSize: 44,          // px
    botGlow: 0.9,         // 0..1
    dither: 0.20,         // 0..0.35
    vignette: 0.18,       // 0..0.7

    // Faction tint mixing (if your meter snapshots include factions w/ colors)
    mixMode: 'weighted',  // weighted | winner
    biasStrength: 0.35,   // 0..0.75
  },

  controls: [
    { key: 'anchor', label: 'Anchor', type: 'select', options: ['bottomLeft', 'bottomRight', 'custom'], default: 'bottomLeft' },
    { key: 'anchorX', label: 'Anchor X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.12 },
    { key: 'anchorY', label: 'Anchor Y', type: 'range', min: 0, max: 1, step: 0.01, default: 0.82 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 30, max: 60, step: 1, default: 60 },
    { key: 'renderScale', label: 'Render Scale', type: 'range', min: 0.5, max: 1, step: 0.05, default: 1.0 },

    { key: 'targetCap', label: 'Target Cap', type: 'range', min: 2, max: 14, step: 1, default: 7 },
    { key: 'projectileCap', label: 'Projectile Cap', type: 'range', min: 4, max: 24, step: 1, default: 12 },
    { key: 'impactCap', label: 'Impact Cap', type: 'range', min: 2, max: 16, step: 1, default: 8 },

    { key: 'aggression', label: 'Aggression', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'shakeStrength', label: 'Shake', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'flashStrength', label: 'Flash', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 170 },
    { key: 'hypeSmoothing', label: 'Hype Smoothing', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
  ],
};

/* --------------------------- helpers --------------------------- */

function clamp(n, a, b) { n = +n; return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a)); }
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function frac(x) { return x - Math.floor(x); }

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

function mixWeighted(colors, weights) {
  let sum = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < colors.length; i++) {
    const w = Math.max(0, weights[i] ?? 0);
    sum += w;
    r += colors[i].r * w;
    g += colors[i].g * w;
    b += colors[i].b * w;
  }
  if (sum <= 0) return { r: 140, g: 210, b: 255 };
  return { r: r / sum, g: g / sum, b: b / sum };
}

function pickWinner(colors, weights) {
  let bestI = 0, bestW = -Infinity;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  return colors[bestI] || { r: 140, g: 210, b: 255 };
}

// returns { total, h, rgb }
function computeBlendAndHype(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  const maxTotalClamp = clamp(cfg.maxTotalClamp ?? 2200, 200, 6000);
  total = clamp(total, 0, maxTotalClamp);

  let rgb;
  if (factions.length) {
    const colors = factions.map(f => hexToRgb(f?.colorHex));
    const weights = factions.map(f => Math.max(0, Number(f?.meter) || 0));
    rgb = (cfg.mixMode === 'winner') ? pickWinner(colors, weights) : mixWeighted(colors, weights);
  } else {
    rgb = { r: 140, g: 210, b: 255 };
  }

  const k = clamp(cfg.hypeK ?? 170, 40, 600);
  let h = 1 - Math.exp(-total / k);
  // gentle lift so low hype still visible
  h = clamp01(h + (1 - h) * 0.06 * Math.min(1, total / 70));
  return { total, h, rgb };
}

function ensureContainerAndCanvas(root, styleKey) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity, filter';

  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'vectorRampage';
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

function resizeCanvas(canvas, cfg) {
  const dpr = Math.min(cfg.dprCap ?? 2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width * dpr));
  const H = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  return { w: rect.width, h: rect.height, dpr };
}

function drawVignette(ctx, w, h, strength) {
  const s = clamp01(strength);
  if (s <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = s;
  const r = Math.max(w, h) * 0.78;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, r * 0.12, w * 0.5, h * 0.5, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function tierFromH(h) {
  if (h < 0.15) return 0;
  if (h < 0.45) return 1;
  if (h < 0.75) return 2;
  return 3;
}

/* --------------------------- overlay --------------------------- */

export function init({ root, config, api }) {
  // mount
  while (root.firstChild) root.removeChild(root.firstChild);
  const { container, canvas } = ensureContainerAndCanvas(root, meta.styleKey);

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Optional low-res offscreen for renderScale
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: true, desynchronized: true });

  // Live snap state
  let latestSnap = { factions: [] };
  let { h: hTarget, rgb: biasRgb } = computeBlendAndHype(latestSnap, cfg);

  // Smoothed hype + color
  let hSmooth = 0;
  let biasSmooth = { r: 140, g: 210, b: 255 };

  // Spike energy from total deltas (drama on events)
  let lastTotal = 0;
  let spikeVel = 0;
  let spikeEnergy = 0;
  let flash = 0;

  // Shake
  let shake = 0; // 0..1

  // Bot state
  const bot = {
    x: 0, y: 0,
    vx: 0,
    facing: 1,         // 1 right, -1 left
    shootT: 0,         // animation timer
    idleT: 0,
    fireCooldown: 0,
    aimX: 0, aimY: 0,
  };

  // Pools
  const targets = [];
  const projectiles = [];
  const impacts = [];

  function allocTarget() {
    if (targets.length >= (cfg.targetCap | 0)) targets.shift();
    const t = {
      x: 0, y: 0,
      vx: 0, vy: 0,
      r: 18,
      rot: 0, vr: 0,
      kind: (Math.random() * 6) | 0,
      hp: 1,
      alive: true,
    };
    targets.push(t);
    return t;
  }

  function allocProjectile() {
    if (projectiles.length >= (cfg.projectileCap | 0)) projectiles.shift();
    const p = {
      x: 0, y: 0,
      vx: 0, vy: 0,
      life: 0,
      tier: 1,
      size: 6,
      power: 1,       // damage-ish
      hueSeed: Math.random(),
      chain: 0,       // extra pops at tier 3
      alive: true,
    };
    projectiles.push(p);
    return p;
  }

  function allocImpact() {
    if (impacts.length >= (cfg.impactCap | 0)) impacts.shift();
    const e = {
      x: 0, y: 0,
      life: 0,
      big: false,
      hueSeed: Math.random(),
      alive: true,
    };
    impacts.push(e);
    return e;
  }

  function spawnInitialTargets(w, h) {
    targets.length = 0;
    const n = clamp(cfg.targetCap, 2, 20) | 0;
    for (let i = 0; i < n; i++) {
      spawnTarget(w, h, true);
    }
  }

  function playfield(w, h) {
    const padPx = clamp(cfg.playfieldPadPx ?? 18, 0, 120);
    const top = clamp(cfg.playfieldTop ?? 0.08, 0, 0.45) * h + padPx;
    const bottom = clamp(cfg.playfieldBottom ?? 0.68, 0.25, 0.95) * h - padPx;

    // keep a center-safe circle (facecam)
    const cx = w * 0.5;
    const cy = h * 0.38;
    const avoidR = Math.max(w, h) * 0.18;

    return { top, bottom, cx, cy, avoidR };
  }

  function spawnTarget(w, h, initial = false) {
    const pf = playfield(w, h);
    const t = allocTarget();

    // pick a spot not too close to center
    for (let tries = 0; tries < 12; tries++) {
      const x = rand(40, w - 40);
      const y = rand(pf.top, pf.bottom);
      const dx = x - pf.cx, dy = y - pf.cy;
      if ((dx * dx + dy * dy) > (pf.avoidR * pf.avoidR) * 0.55) {
        t.x = x; t.y = y;
        break;
      }
    }

    const base = clamp(cfg.targetSpeed ?? 55, 10, 180);
    const sp = base * (0.75 + 0.65 * Math.random()) * (initial ? 1 : (0.95 + 0.25 * hSmooth));
    const dir = (Math.random() < 0.5) ? -1 : 1;

    t.vx = dir * sp * (0.55 + 0.45 * Math.random());
    t.vy = (Math.random() - 0.5) * sp * 0.18;
    t.r = rand(14, 22);
    t.rot = Math.random() * Math.PI * 2;
    t.vr = (Math.random() - 0.5) * 1.8;
    t.kind = (Math.random() * 8) | 0;
    t.hp = 1; // keep it simple
    t.alive = true;
  }

  function botAnchor(w, h) {
    const pad = clamp01(cfg.avatarSafePad ?? 0.08);
    if (cfg.anchor === 'bottomRight') return { x: w * (1 - pad), y: h * (1 - pad) };
    if (cfg.anchor === 'custom') return { x: w * clamp01(cfg.anchorX ?? 0.12), y: h * clamp01(cfg.anchorY ?? 0.82) };
    return { x: w * pad, y: h * (1 - pad) };
  }

  function aimAtTarget(w, h) {
    // aim at nearest target; fallback to center playfield
    if (!targets.length) return { x: w * 0.55, y: h * 0.35 };

    let best = null;
    let bestD = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      const dx = t.x - bot.x;
      const dy = t.y - bot.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return { x: w * 0.55, y: h * 0.35 };
    return { x: best.x, y: best.y };
  }

  function maybeFire(dt, w, h) {
    // fire chance + cooldown scales with hype and aggression, but projectile cap protects FPS
    const tier = tierFromH(hSmooth);
    const ag = clamp01(cfg.aggression ?? 0.55);

    // baseline: almost none at tier 0
    const baseRate =
      (tier === 0) ? 0.08 :
      (tier === 1) ? 0.65 :
      (tier === 2) ? 1.25 :
      1.65; // shots/sec target

    // hype + spike adds punch
    const rate = baseRate * (0.55 + 1.05 * hSmooth) * (0.65 + 0.7 * ag) * (1 + 0.55 * spikeEnergy);

    bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);

    if (bot.fireCooldown > 0) return;

    // probabilistic fire
    const p = clamp01(rate * dt);
    if (Math.random() > p) return;

    // if cap reached, recycle oldest (allocProjectile already does this)
    const aim = aimAtTarget(w, h);
    bot.aimX = aim.x; bot.aimY = aim.y;

    const dx = aim.x - bot.x;
    const dy = aim.y - bot.y;
    const len = Math.max(1e-3, Math.hypot(dx, dy));
    const nx = dx / len;
    const ny = dy / len;

    bot.facing = (nx >= 0) ? 1 : -1;
    bot.shootT = 0.14; // small recoil window

    // projectile tier and params
    const pTier = (tier <= 1) ? 1 : (tier === 2 ? 2 : 3);

    const speedBase = clamp(cfg.projectileSpeed ?? 640, 240, 1600);
    const speed = speedBase * (0.85 + 0.35 * pTier) * (0.90 + 0.25 * hSmooth);

    const pr = allocProjectile();
    pr.x = bot.x + bot.facing * 18;
    pr.y = bot.y - 18;
    pr.vx = nx * speed;
    pr.vy = ny * speed;
    pr.life = clamp(cfg.projectileLife ?? 0.9, 0.25, 2.5);
    pr.tier = pTier;
    pr.size = (pTier === 1 ? 5 : pTier === 2 ? 8 : 12) * (0.9 + 0.3 * hSmooth);
    pr.power = (pTier === 1 ? 1 : pTier === 2 ? 1.2 : 1.5) * (0.9 + 0.6 * hSmooth);
    pr.chain = (pTier === 3) ? (Math.random() < (0.25 + 0.35 * hSmooth) ? 1 : 0) : 0;
    pr.hueSeed = Math.random();
    pr.alive = true;

    // cooldown gets shorter with hype, but never crazy
    const cd =
      (pTier === 1 ? 0.40 : pTier === 2 ? 0.30 : 0.24) *
      (1.0 - 0.35 * hSmooth) *
      (1.0 - 0.20 * ag);

    bot.fireCooldown = clamp(cd, 0.08, 0.55);
  }

  function doImpact(x, y, big = false) {
    const e = allocImpact();
    e.x = x;
    e.y = y;
    e.life = clamp(cfg.impactLife ?? 0.45, 0.2, 1.2) * (big ? 1.15 : 1.0);
    e.big = !!big;
    e.hueSeed = Math.random();
    e.alive = true;

    // flash scales with hype + spike
    const fs = clamp(cfg.flashStrength ?? 1.0, 0, 2);
    flash = clamp01(flash + (big ? 0.35 : 0.18) * fs * (0.55 + 0.75 * hSmooth + 0.9 * spikeEnergy));
    // shake too
    const ss = clamp(cfg.shakeStrength ?? 1.0, 0, 2);
    shake = clamp01(shake + (big ? 0.34 : 0.18) * ss * (0.35 + 0.85 * hSmooth + 0.95 * spikeEnergy));
  }

  function hitTargetAt(x, y, radius, power, chainAllowed) {
    // find closest target within radius
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!t.alive) continue;
      const dx = t.x - x;
      const dy = t.y - y;
      const d = dx * dx + dy * dy;
      const rr = (t.r + radius);
      if (d <= rr * rr && d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return false;

    const t = targets[best];
    t.hp -= power;
    if (t.hp <= 0) {
      t.alive = false;
      doImpact(t.x, t.y, chainAllowed); // big for chained / tier3 feel
      // respawn
      // (Keep count stable for perf)
    } else {
      doImpact(t.x, t.y, false);
    }
    return true;
  }

  function stepTargets(dt, w, h) {
    const pf = playfield(w, h);
    for (const t of targets) {
      if (!t.alive) {
        spawnTarget(w, h, false);
        continue;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rot += t.vr * dt;

      // bounce/warp within playfield
      if (t.y < pf.top) { t.y = pf.top; t.vy = Math.abs(t.vy) * (0.75 + 0.25 * Math.random()); }
      if (t.y > pf.bottom) { t.y = pf.bottom; t.vy = -Math.abs(t.vy) * (0.75 + 0.25 * Math.random()); }

      if (t.x < 20) { t.x = 20; t.vx = Math.abs(t.vx); }
      if (t.x > w - 20) { t.x = w - 20; t.vx = -Math.abs(t.vx); }
    }
  }

  function stepProjectiles(dt, w, h) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p.alive) { projectiles.splice(i, 1); continue; }

      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // collision radius slightly scales with hype
      const r = p.size * (0.75 + 0.45 * hSmooth);
      const hit = hitTargetAt(p.x, p.y, r, p.power, p.tier === 3);

      if (hit) {
        // chain: allow one extra hit without spawning extra projectiles
        if (p.chain > 0) {
          p.chain -= 1;
          // nudge direction randomly for a second pop
          const ang = Math.atan2(p.vy, p.vx) + rand(-0.55, 0.55);
          const sp = Math.hypot(p.vx, p.vy) * (0.92 + 0.18 * Math.random());
          p.vx = Math.cos(ang) * sp;
          p.vy = Math.sin(ang) * sp;
          // shorten remaining life
          p.life *= 0.55;
          continue;
        }
        p.alive = false;
      }

      // offscreen / dead
      if (p.life <= 0 || p.x < -80 || p.x > w + 80 || p.y < -80 || p.y > h + 80) {
        p.alive = false;
      }

      if (!p.alive) projectiles.splice(i, 1);
    }
  }

  function stepImpacts(dt) {
    for (let i = impacts.length - 1; i >= 0; i--) {
      const e = impacts[i];
      e.life -= dt;
      if (e.life <= 0) impacts.splice(i, 1);
    }
  }

  function stepBot(dt, w, h) {
    const a = botAnchor(w, h);

    // small horizontal “patrol” with hype (keeps it alive)
    const patrol = lerp(0, 32, clamp01((hSmooth - 0.15) / 0.85));
    const tt = performance.now() / 1000;
    const px = Math.sin(tt * lerp(0.8, 1.8, hSmooth)) * patrol;

    bot.x = a.x + px;
    bot.y = a.y;

    bot.idleT += dt;
    bot.shootT = Math.max(0, bot.shootT - dt);
  }

  function drawTarget(g, t, bias, tier) {
    // placeholder “junk” variations; cheap but readable
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.rot);

    const glow = 8 + 22 * hSmooth;
    g.shadowBlur = glow * 0.35;
    g.shadowColor = `rgba(${bias.r | 0},${bias.g | 0},${bias.b | 0},0.85)`;

    const baseA = 0.65 + 0.25 * hSmooth;
    g.globalAlpha = baseA;

    // varied shapes by kind
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.strokeStyle = `rgba(${bias.r | 0},${bias.g | 0},${bias.b | 0},${0.55 + 0.35 * hSmooth})`;
    g.lineWidth = 2.25 + 1.5 * hSmooth;

    const r = t.r;
    g.beginPath();
    if (t.kind % 4 === 0) {
      g.rect(-r, -r * 0.7, r * 2, r * 1.4);
    } else if (t.kind % 4 === 1) {
      g.arc(0, 0, r, 0, Math.PI * 2);
    } else if (t.kind % 4 === 2) {
      g.moveTo(-r, r * 0.6);
      g.lineTo(0, -r);
      g.lineTo(r, r * 0.6);
      g.closePath();
    } else {
      // hex-ish
      const rr = r * 0.9;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const x = Math.cos(ang) * rr;
        const y = Math.sin(ang) * rr;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    }
    g.fill();
    g.stroke();

    // tier adds inner shine
    if (tier >= 2) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25 + 0.35 * hSmooth;
      g.fillStyle = `rgba(255,255,255,${0.15 + 0.25 * hSmooth})`;
      g.beginPath();
      g.arc(-r * 0.15, -r * 0.15, r * 0.35, 0, Math.PI * 2);
      g.fill();
    }

    g.restore();
  }

  function drawBot(g, bias, tier) {
    const size = clamp(cfg.botSize ?? 44, 22, 90);
    const glowK = clamp01(cfg.botGlow ?? 0.9);

    const bob = Math.sin(bot.idleT * 6) * (1.2 + 2.8 * hSmooth);
    const recoil = (bot.shootT > 0) ? lerp(6, 12, hSmooth) : 0;

    g.save();
    g.translate(bot.x - bot.facing * recoil, bot.y + bob);

    // glow
    g.shadowColor = `rgba(${bias.r | 0},${bias.g | 0},${bias.b | 0},0.95)`;
    g.shadowBlur = (12 + 40 * hSmooth) * glowK;

    // body
    g.globalAlpha = 0.85;
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.strokeStyle = `rgba(${bias.r | 0},${bias.g | 0},${bias.b | 0},${0.65 + 0.30 * hSmooth})`;
    g.lineWidth = 2.8 + 1.6 * hSmooth;

    // orb stack: 5 circles like vectorman “balls”
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const u = i / (rows - 1);
      const rr = size * (0.20 + 0.08 * (1 - u));
      const yy = -size * 0.55 + u * size * 0.95;
      const xx = Math.sin((bot.idleT * 3 + i) * 1.3) * (2 + 4 * hSmooth) * 0.12;
      g.beginPath();
      g.arc(xx, yy, rr, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // shine
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.18 + 0.18 * hSmooth;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc(xx - rr * 0.25, yy - rr * 0.25, rr * 0.35, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.85;
      g.fillStyle = 'rgba(255,255,255,0.10)';
    }

    // “arm” when shooting
    if (bot.shootT > 0) {
      const armLen = size * (0.55 + 0.25 * hSmooth);
      const ax = bot.facing * armLen;
      const ay = -size * 0.18;
      g.save();
      g.translate(0, ay);
      g.strokeStyle = `rgba(${bias.r | 0},${bias.g | 0},${bias.b | 0},${0.85})`;
      g.lineWidth = 3.2 + 2.2 * hSmooth;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(ax, 0);
      g.stroke();

      // muzzle glow
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25 + 0.35 * hSmooth;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath();
      g.arc(ax, 0, 6 + 10 * hSmooth, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // Tier 3 aura
    if (tier === 3) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.10 + 0.18 * hSmooth;
      const auraR = size * (0.95 + 0.25 * Math.sin(performance.now() * 0.003));
      const grd = g.createRadialGradient(0, -size * 0.2, 0, 0, -size * 0.2, auraR);
      grd.addColorStop(0, `rgba(255,255,255,${0.18 + 0.25 * hSmooth})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, -size * 0.2, auraR, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    g.restore();
  }

  function drawProjectile(g, p, bias, tier) {
    const a = clamp01(p.life / clamp(cfg.projectileLife ?? 0.9, 0.25, 2.5));
    const fade = clamp01(a);
    const hue = frac(p.hueSeed + performance.now() * 0.00025 * (0.8 + 1.3 * hSmooth));

    // simple HSV-ish to RGB (fast approximation)
    const r = Math.floor(180 + 75 * Math.sin(hue * Math.PI * 2));
    const gg = Math.floor(180 + 75 * Math.sin((hue + 0.33) * Math.PI * 2));
    const bb = Math.floor(180 + 75 * Math.sin((hue + 0.66) * Math.PI * 2));

    g.save();
    g.translate(p.x, p.y);

    // trails: draw a cheap streak (no extra objects)
    const speed = Math.hypot(p.vx, p.vy);
    const tx = -p.vx / Math.max(1e-3, speed);
    const ty = -p.vy / Math.max(1e-3, speed);

    const trailLen = (tier === 1 ? 18 : tier === 2 ? 34 : 48) * (0.7 + 0.7 * hSmooth);
    g.globalCompositeOperation = (tier >= 2) ? 'lighter' : 'source-over';

    g.globalAlpha = (0.20 + 0.35 * hSmooth) * fade;
    g.strokeStyle = `rgba(${r},${gg},${bb},1)`;
    g.lineWidth = (tier === 1 ? 2 : tier === 2 ? 3 : 4) * (0.8 + 0.7 * hSmooth);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(tx * trailLen, ty * trailLen);
    g.stroke();

    // core
    g.shadowBlur = (8 + 28 * hSmooth) * (tier === 3 ? 1.2 : 1.0);
    g.shadowColor = `rgba(${bias.r | 0},${bias.g | 0},${bias.b | 0},0.9)`;
    g.globalAlpha = (0.55 + 0.35 * hSmooth) * fade;

    const sz = p.size;
    g.fillStyle = `rgba(${r},${gg},${bb},0.95)`;
    g.beginPath();
    g.arc(0, 0, sz, 0, Math.PI * 2);
    g.fill();

    // spec highlight
    g.globalAlpha *= 0.6;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.arc(-sz * 0.25, -sz * 0.25, sz * 0.35, 0, Math.PI * 2);
    g.fill();

    g.restore();
  }

  function drawImpact(g, e, bias, tier) {
    const life0 = clamp(cfg.impactLife ?? 0.45, 0.2, 1.2)
