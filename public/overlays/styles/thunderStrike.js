// public/overlays/styles/thunderStrike.js
// PRO Overlay: ThunderStrike
// Big-moment lightning strikes that slam the bottom/edges, driven by hype + meter deltas.
// - placement: edges|bottom
// - mixMode: weighted|winner
// - intensity: 0..2
// - Event detection from meter deltas (no backend changes)
// - Performance: keeps particle counts bounded; focuses on a few high-impact bolts
//
// Contract: export meta + init({ canvas, app, config })

'use strict';

export const meta = {
  styleKey: 'thunderStrike',
  name: 'ThunderStrike (PRO)',
  tier: 'PRO',
  description: 'Cinematic lightning strikes that slam the bottom (or full frame) during big hype moments, with faction-colored energy.',
  defaultConfig: {
    placement: 'bottom',      // edges | bottom
    mixMode: 'winner',        // weighted | winner
    intensity: 1.0,           // 0..2

    // Strike behavior
    strikeRate: 0.18,         // strikes/sec baseline (at low hype)
    strikeBoost: 1.15,        // extra strikes/sec at max hype
    eventSensitivity: 1.0,    // 0..2 how much meter delta triggers strikes
    cooldownMs: 220,          // minimum time between strikes

    // Bolt visuals
    boltThickness: 2.6,       // px
    boltJag: 0.65,            // 0..1 how jagged the bolt is
    boltSegments: 14,         // 6..28 how many segments per bolt
    boltForkChance: 0.22,     // 0..0.6 chance of fork branches
    boltForkDepth: 2,         // 0..3 recursion depth

    // Impact zone (where it hits)
    impactWidth: 220,         // px width of impact flash along bottom/edge
    impactHeight: 80,         // px height of impact flash
    impactGlow: 0.9,          // 0..1 glow strength at impact
    impactShake: 0.35,        // 0..1 subtle camera shake (canvas jitter)

    // Ambient energy
    ambientGlow: 0.55,        // 0..1 border glow even without strikes
    arcCount: 7,              // 0..25 small arcs per second (ambient)
    arcLife: 0.45,            // sec
    arcSize: 1.6,             // px

    // Global visuals
    padding: 10,              // px inset from edge
    alpha: 0.95,              // 0..1 overall opacity
    backgroundDim: 0.0        // 0..0.25 optional dim
  },
  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'bottom'], default: 'bottom' },
    { key: 'mixMode', label: 'Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'winner' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },

    { key: 'strikeRate', label: 'Strike Rate', type: 'range', min: 0, max: 1.5, step: 0.01, default: 0.18 },
    { key: 'strikeBoost', label: 'Strike Boost', type: 'range', min: 0, max: 3.0, step: 0.05, default: 1.15 },
    { key: 'eventSensitivity', label: 'Event Sensitivity', type: 'range', min: 0, max: 2.0, step: 0.05, default: 1.0 },
    { key: 'cooldownMs', label: 'Strike Cooldown (ms)', type: 'range', min: 80, max: 800, step: 10, default: 220 },

    { key: 'boltThickness', label: 'Bolt Thickness', type: 'range', min: 1, max: 7, step: 0.1, default: 2.6 },
    { key: 'boltJag', label: 'Bolt Jaggedness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: 'boltSegments', label: 'Bolt Segments', type: 'range', min: 6, max: 28, step: 1, default: 14 },
    { key: 'boltForkChance', label: 'Fork Chance', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.22 },
    { key: 'boltForkDepth', label: 'Fork Depth', type: 'range', min: 0, max: 3, step: 1, default: 2 },

    { key: 'impactWidth', label: 'Impact Width', type: 'range', min: 80, max: 520, step: 10, default: 220 },
    { key: 'impactHeight', label: 'Impact Height', type: 'range', min: 20, max: 200, step: 5, default: 80 },
    { key: 'impactGlow', label: 'Impact Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
    { key: 'impactShake', label: 'Impact Shake', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },

    { key: 'ambientGlow', label: 'Ambient Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'arcCount', label: 'Ambient Arc Count', type: 'range', min: 0, max: 25, step: 1, default: 7 },
    { key: 'arcLife', label: 'Ambient Arc Life', type: 'range', min: 0.1, max: 1.5, step: 0.05, default: 0.45 },
    { key: 'arcSize', label: 'Ambient Arc Size', type: 'range', min: 0.5, max: 6, step: 0.1, default: 1.6 },

    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 40, step: 1, default: 10 },
    { key: 'alpha', label: 'Opacity', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.95 },
    { key: 'backgroundDim', label: 'Background Dim', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.0 }
  ]
};

export function init({ canvas, app, config }) {
  const resolved = ensureCanvas(canvas, meta.styleKey);
  canvas = resolved.canvas;
  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let factions = [];
  let meters = [];
  let totalHype = 0;

  // Event detection from meter deltas
  let lastMeterMap = new Map();
  let eventVel = 0;
  let eventEnergy = 0;

  // Lightning state
  const bolts = []; // active bolt paths
  const arcs = [];  // ambient micro arcs
  const impacts = []; // impact flashes

  let lastStrikeAt = 0;

  // Subscribe (defensive)
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

    // total hype 0..1 soft normalize
    const base = clamp01(1 - Math.exp(-sum / 180));
    totalHype = clamp01(base * clamp(cfg.intensity, 0, 2));

    // meter delta => event bump
    let delta = 0;
    for (const [id, v] of cur.entries()) {
      const prev = lastMeterMap.get(id) ?? 0;
      delta += Math.abs(v - prev);
    }
    for (const [id, prev] of lastMeterMap.entries()) {
      if (!cur.has(id)) delta += Math.abs(prev);
    }
    lastMeterMap = cur;

    const sens = clamp(cfg.eventSensitivity, 0, 2);
    const bump = clamp01(delta / 28) * sens;
    eventVel += bump * 1.4;
  }

  function getColors() {
    const a = clamp01(cfg.alpha ?? 1);
    const main = pickFactionColorCss({ factions, meters }, cfg.mixMode, a);
    const win = pickFactionColorCss({ factions, meters }, 'winner', a);
    return { main, win };
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return dpr;
  }

  function spawnBolt(w, h, colorCss, now) {
    const pad = clamp(cfg.padding, 0, 80);

    // Choose strike position based on placement
    const placement = cfg.placement === 'edges' ? 'edges' : 'bottom';
    let target = { x: w * (0.2 + 0.6 * Math.random()), y: h - pad };
    let start = { x: target.x + (Math.random() - 0.5) * 60, y: pad };

    if (placement === 'edges') {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) { target = { x: w * (0.2 + 0.6 * Math.random()), y: pad }; start = { x: target.x, y: h - pad }; }
      if (edge === 1) { target = { x: w - pad, y: h * (0.2 + 0.6 * Math.random()) }; start = { x: pad, y: target.y }; }
      if (edge === 2) { target = { x: w * (0.2 + 0.6 * Math.random()), y: h - pad }; start = { x: target.x, y: pad }; }
      if (edge === 3) { target = { x: pad, y: h * (0.2 + 0.6 * Math.random()) }; start = { x: w - pad, y: target.y }; }
    } else {
      // bottom: start above, hit bottom
      start = { x: target.x + (Math.random() - 0.5) * 90, y: pad + 10 };
    }

    const seg = clampInt(cfg.boltSegments, 6, 28);
    const jag = clamp(cfg.boltJag, 0, 1);

    const pts = [];
    pts.push(start);

    for (let i = 1; i < seg; i++) {
      const t = i / seg;
      const x = lerp(start.x, target.x, t);
      const y = lerp(start.y, target.y, t);

      // Perpendicular jitter
      const nx = -(target.y - start.y);
      const ny = (target.x - start.x);
      const nl = Math.max(0.001, Math.hypot(nx, ny));
      const ux = nx / nl;
      const uy = ny / nl;

      const amp = (1 - Math.abs(0.5 - t) * 2) * (18 + 55 * jag);
      const j = (Math.random() - 0.5) * amp;

      pts.push({ x: x + ux * j, y: y + uy * j });
    }
    pts.push(target);

    const life = 0.14 + 0.18 * totalHype + 0.22 * eventEnergy;

    bolts.push({
      pts,
      born: now,
      life,
      color: colorCss,
      thickness: clamp(cfg.boltThickness, 1, 10) * (0.85 + 0.6 * totalHype + 0.8 * eventEnergy),
      forks: buildForks(pts, clamp(cfg.boltForkChance, 0, 0.6), clampInt(cfg.boltForkDepth, 0, 3))
    });

    // Impact flash
    impacts.push({
      x: target.x,
      y: target.y,
      born: now,
      life: 0.22 + 0.25 * eventEnergy,
      w: clamp(cfg.impactWidth, 60, 800),
      h: clamp(cfg.impactHeight, 20, 320),
      glow: clamp01(cfg.impactGlow),
      color: colorCss
    });
  }

  function buildForks(mainPts, chance, depth) {
    if (depth <= 0 || chance <= 0) return [];
    const forks = [];
    const forkCount = (Math.random() < chance) ? (1 + (Math.random() < 0.35 ? 1 : 0)) : 0;
    for (let k = 0; k < forkCount; k++) {
      const i = clampInt(Math.floor(mainPts.length * (0.25 + 0.55 * Math.random())), 2, mainPts.length - 3);
      const a = mainPts[i];
      const b = mainPts[i + 1];
      const dirx = b.x - a.x;
      const diry = b.y - a.y;
      const len = Math.max(0.001, Math.hypot(dirx, diry));
      const ux = dirx / len;
      const uy = diry / len;

      // fork goes off perpendicular-ish
      const px = -uy;
      const py = ux;
      const sign = Math.random() < 0.5 ? -1 : 1;

      const forkLen = 40 + 120 * Math.random();
      const end = { x: a.x + (ux * 0.35 + px * sign) * forkLen, y: a.y + (uy * 0.35 + py * sign) * forkLen };

      // make small jagged fork
      const pts = [a];
      const seg = 5 + Math.floor(Math.random() * 7);
      for (let j = 1; j < seg; j++) {
        const t = j / seg;
        const x = lerp(a.x, end.x, t);
        const y = lerp(a.y, end.y, t);
        pts.push({ x: x + (Math.random() - 0.5) * 18, y: y + (Math.random() - 0.5) * 18 });
      }
      pts.push(end);

      forks.push({
        pts,
        forks: buildForks(pts, chance * 0.55, depth - 1)
      });
    }
    return forks;
  }

  function spawnAmbientArc(w, h, colorCss, now) {
    const pad = clamp(cfg.padding, 0, 80);
    const placement = cfg.placement === 'edges' ? 'edges' : 'bottom';

    let x = pad + Math.random() * (w - pad * 2);
    let y = h - pad;
    if (placement === 'edges') {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) { x = pad + Math.random() * (w - pad * 2); y = pad; }
      if (edge === 1) { x = w - pad; y = pad + Math.random() * (h - pad * 2); }
      if (edge === 2) { x = pad + Math.random() * (w - pad * 2); y = h - pad; }
      if (edge === 3) { x = pad; y = pad + Math.random() * (h - pad * 2); }
    } else {
      y = h - pad;
    }

    const size = clamp(cfg.arcSize, 0.5, 10);
    arcs.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (40 + 120 * totalHype),
      vy: (Math.random() - 0.5) * (30 + 90 * totalHype),
      born: now,
      life: clamp(cfg.arcLife, 0.1, 2),
      size,
      color: colorCss
    });
  }

  function drawBoltPath(path, now, baseAlpha) {
    const age = now - path.born;
    const p = clamp01(age / path.life);
    const fade = (1 - p);

    // bright core + glow stroke
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const a = baseAlpha * fade;
    ctx.strokeStyle = withAlpha(path.color, a);
    ctx.lineWidth = path.thickness;
    ctx.beginPath();
    const pts = path.pts;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // inner hot line
    ctx.strokeStyle = withAlpha(path.color, a * 0.9);
    ctx.lineWidth = Math.max(1, path.thickness * 0.42);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // forks
    for (const f of path.forks || []) drawFork(f, now, baseAlpha * 0.85);

    ctx.restore();
  }

  function drawFork(f, now, baseAlpha) {
    const pts = f.pts;
    // treat as very short lived using parent's fade
    ctx.strokeStyle = withAlpha(currentColorCss, baseAlpha);
    ctx.lineWidth = Math.max(0.8, cfg.boltThickness * 0.7);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    for (const ff of f.forks || []) drawFork(ff, now, baseAlpha * 0.7);
  }

  function drawImpact(imp, now) {
    const age = now - imp.born;
    const p = clamp01(age / imp.life);
    const fade = 1 - p;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;

    // Glow
    ctx.shadowColor = imp.color;
    ctx.shadowBlur = (25 + 85 * imp.glow) * (0.8 + 0.8 * totalHype + 1.0 * eventEnergy);

    // Impact rectangle gradient-ish
    const x = imp.x - imp.w / 2;
    const y = imp.y - imp.h;
    ctx.fillStyle = withAlpha(imp.color, 0.25 + 0.55 * fade);
    ctx.fillRect(x, y, imp.w, imp.h);

    // Hot core
    ctx.fillStyle = withAlpha(imp.color, 0.55 * fade);
    ctx.fillRect(x + imp.w * 0.2, y + imp.h * 0.2, imp.w * 0.6, imp.h * 0.6);

    ctx.restore();
  }

  let currentColorCss = 'rgba(120,200,255,1)';

  let raf = 0;
  let last = performance.now();
  function loop(nowMs) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;

    const dpr = resize();
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // decay event energy
    eventVel *= Math.pow(0.15, dt);
    eventEnergy = clamp01(eventEnergy * Math.pow(0.45, dt) + eventVel * 0.55);
    eventVel *= Math.pow(0.65, dt);

    // Compute strike probability (baseline + hype + event)
    const baseRate = clamp(cfg.strikeRate, 0, 4);
    const boost = clamp(cfg.strikeBoost, 0, 8);
    const wantRate = baseRate + boost * totalHype + 2.2 * eventEnergy;
    const cooldown = clamp(cfg.cooldownMs, 0, 2000);

    // Choose color
    const { main, win } = getColors();
    currentColorCss = (cfg.mixMode === 'winner') ? win : main;

    // Background dim
    ctx.clearRect(0, 0, w, h);
    if (cfg.backgroundDim > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(cfg.backgroundDim, 0, 0.25);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Ambient border glow line (subtle)
    const pad = clamp(cfg.padding, 0, 80);
    const amb = clamp01(cfg.ambientGlow);
    if (amb > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(currentColorCss, 0.08 + 0.22 * amb * (0.35 + 0.65 * totalHype));
      ctx.lineWidth = 2;
      ctx.shadowColor = currentColorCss;
      ctx.shadowBlur = 12 + 30 * amb;
      if (cfg.placement === 'bottom') {
        ctx.beginPath();
        ctx.moveTo(pad, h - pad);
        ctx.lineTo(w - pad, h - pad);
        ctx.stroke();
      } else {
        ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
      }
      ctx.restore();
    }

    // Spawn ambient arcs
    const arcCount = clamp(cfg.arcCount, 0, 50);
    const arcRate = arcCount * (0.25 + 1.25 * totalHype + 0.9 * eventEnergy);
    spawnPoisson(arcs, arcRate, dt, () => spawnAmbientArc(w, h, currentColorCss, nowMs / 1000), 500);

    // Spawn strikes (cooldown + poisson)
    const now = nowMs;
    const canStrike = (now - lastStrikeAt) >= cooldown;

    const strikeChance = wantRate * dt;
    if (canStrike && Math.random() < strikeChance) {
      lastStrikeAt = now;
      spawnBolt(w, h, currentColorCss, nowMs / 1000);
    }

    // Update/draw arcs
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i];
      const age = nowMs / 1000 - a.born;
      if (age >= a.life) { arcs.splice(i, 1); continue; }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vx *= (1 - 0.8 * dt);
      a.vy *= (1 - 0.8 * dt);

      const p = clamp01(age / a.life);
      const fade = 1 - p;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = withAlpha(a.color, 0.25 * fade);
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 10 + 30 * totalHype;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size * (0.7 + 1.3 * fade), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw bolts / impacts and cull old
    const nowSec = nowMs / 1000;

    // impacts
    for (let i = impacts.length - 1; i >= 0; i--) {
      const imp = impacts[i];
      if ((nowSec - imp.born) >= imp.life) { impacts.splice(i, 1); continue; }
      drawImpact(imp, nowSec);
    }

    // bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      if ((nowSec - b.born) >= b.life) { bolts.splice(i, 1); continue; }

      // optional shake during impact
      const shake = clamp01(cfg.impactShake) * (0.15 + 0.85 * eventEnergy);
      if (shake > 0.001) {
        const sx = (Math.random() - 0.5) * 8 * shake;
        const sy = (Math.random() - 0.5) * 6 * shake;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.shadowColor = currentColorCss;
        ctx.shadowBlur = 25 + 90 * clamp01(cfg.impactGlow) * (0.4 + 0.9 * totalHype + 1.0 * eventEnergy);
        drawBoltPath(b, nowSec, 0.95);
        ctx.restore();
      } else {
        ctx.shadowColor = currentColorCss;
        ctx.shadowBlur = 25 + 90 * clamp01(cfg.impactGlow) * (0.4 + 0.9 * totalHype + 1.0 * eventEnergy);
        drawBoltPath(b, nowSec, 0.95);
      }
    }
  }

  loop(last);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      bolts.length = 0;
      arcs.length = 0;
      impacts.length = 0;
      if (resolved.created && canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
    setConfig(next) {
      cfg = { ...cfg, ...(next || {}) };
    }
  };
}

/* ---------- Helpers ---------- */
function ensureCanvas(existing, styleKey) {
  if (existing && typeof existing.getContext === 'function') {
    styleCanvas(existing);
    return { canvas: existing, created: false };
  }
  const root = document.getElementById('overlayRoot') || document.body;
  const c = document.createElement('canvas');
  c.dataset.style = styleKey || 'thunderStrike';
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

function withAlpha(rgbaOrHex, a) {
  // If already rgba(), replace alpha; else assume hex-ish and convert
  const s = String(rgbaOrHex || '').trim();
  if (s.startsWith('rgba(')) {
    const inside = s.slice(5, -1).split(',').map(x => x.trim());
    if (inside.length >= 3) return `rgba(${inside[0]},${inside[1]},${inside[2]},${clamp01(a)})`;
  }
  if (s.startsWith('rgb(')) {
    const inside = s.slice(4, -1).split(',').map(x => x.trim());
    if (inside.length >= 3) return `rgba(${inside[0]},${inside[1]},${inside[2]},${clamp01(a)})`;
  }
  const rgb = hexToRgb(s || '#78c8ff');
  return `rgba(${rgb.r|0},${rgb.g|0},${rgb.b|0},${clamp01(a)})`;
}

function spawnPoisson(arr, ratePerSec, dt, spawnFn, cap) {
  const want = ratePerSec * dt;
  const count = Math.floor(want);
  const extra = (Math.random() < (want - count)) ? 1 : 0;
  const n = count + extra;
  for (let i = 0; i < n; i++) {
    if (arr.length >= cap) break;
    spawnFn();
  }
}

function num(v, fallback) {
  const n = (typeof v === 'string') ? Number(v) : v;
  return (typeof n === 'number' && isFinite(n)) ? n : fallback;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function clamp01(x) { return clamp(x, 0, 1); }
function clampInt(x, a, b) { return Math.max(a, Math.min(b, x | 0)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function sq(x) { return x * x; }
