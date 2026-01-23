// public/overlays/styles/runeStorm.js
// PRO Overlay: RuneStorm (Arcane perimeter + sparks) — HYPE-AMPLIFIED
// - MUST export meta + init() (compat)
// - Defensive: if canvas is missing, create one under #overlayRoot
// - FIX: accepts meters as object-map OR array OR wrapper { meters: [...] }
// - FIX: uses normalized hype01 (0..1) so "max hype" produces BIG growth
// - BIG MOMENT: thickness, glow, rune alpha, bloom, spark rate/size/speed scale hard with hype

'use strict';

export const meta = {
  styleKey: 'runeStorm',
  name: 'RuneStorm (PRO)',
  tier: 'PRO',
  description: 'Glowing arcane runes around the frame with spark storms driven by faction hype.',
  defaultConfig: {
    placement: 'edges',           // 'edges' | 'bottom'
    intensity: 1.0,               // 0..2
    mixMode: 'weighted',          // 'weighted' | 'winner'
    defaultColor: '#78C8FF',      // fallback if no factions/meters

    // Rune field
    runeDensity: 0.65,            // 0..1
    runeSpeed: 0.8,               // 0.1..2
    glow: 0.75,                   // 0..1
    thickness: 16,                // px (base) — scales with hype
    padding: 10,                  // px
    jitter: 0.35,                 // 0..1

    // Sparks
    sparkRate: 28,                // sparks/sec
    sparkBoost: 140,              // additional sparks/sec at max hype
    sparkSize: 2.2,               // px (base) — scales with hype
    sparkLife: 0.9,               // sec

    // NEW: hype scaling (this is what makes it feel PRO at max hype)
    hypeCurve: 1.35,              // 0.6..2.2 (higher = ramps harder near top)
    hypeScale: 180,               // soft-normalize constant (lower = hits max hype sooner)
    maxThicknessBoost: 2.25,      // 1..3.5 multiplier at max hype
    maxGlowBoost: 2.1,            // 1..3 multiplier at max hype
    auraBloom: 0.85,              // 0..1 extra bloom at high hype
    auraFlash: 0.75               // 0..1 quick flash on hype spikes (delta-driven)
  },
  controls: [
    { key: 'placement', label: 'Placement', type: 'select', options: ['edges', 'bottom'], default: 'edges' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.05, default: 1.0 },
    { key: 'mixMode', label: 'Color Mix', type: 'select', options: ['weighted', 'winner'], default: 'weighted' },

    { key: 'runeDensity', label: 'Rune Density', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: 'runeSpeed', label: 'Rune Speed', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.8 },
    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },
    { key: 'thickness', label: 'Thickness', type: 'range', min: 6, max: 42, step: 1, default: 16 },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 40, step: 1, default: 10 },

    { key: 'sparkRate', label: 'Spark Rate', type: 'range', min: 0, max: 120, step: 1, default: 28 },
    { key: 'sparkBoost', label: 'Spark Boost', type: 'range', min: 0, max: 300, step: 5, default: 140 },
    { key: 'sparkSize', label: 'Spark Size', type: 'range', min: 1, max: 6, step: 0.1, default: 2.2 },
    { key: 'sparkLife', label: 'Spark Life', type: 'range', min: 0.2, max: 2, step: 0.05, default: 0.9 },
    { key: 'jitter', label: 'Edge Jitter', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },

    { key: 'hypeCurve', label: 'Hype Curve', type: 'range', min: 0.6, max: 2.2, step: 0.05, default: 1.35 },
    { key: 'hypeScale', label: 'Hype Scale', type: 'range', min: 60, max: 420, step: 10, default: 180 },
    { key: 'maxThicknessBoost', label: 'Max Thickness Boost', type: 'range', min: 1, max: 3.5, step: 0.05, default: 2.25 },
    { key: 'maxGlowBoost', label: 'Max Glow Boost', type: 'range', min: 1, max: 3, step: 0.05, default: 2.1 },
    { key: 'auraBloom', label: 'Aura Bloom', type: 'range', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'auraFlash', label: 'Aura Flash', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 }
  ]
};

/* ================= Helpers ================= */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clamp01(v) { return clamp(v, 0, 1); }
function rand() { return Math.random(); }
function lerp(a, b, t) { return a + (b - a) * t; }
function frac(x) { return x - Math.floor(x); }

function hexToRgb(hex) {
  const s = String(hex || '').trim().replace('#', '');
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return { r, g, b };
  }
  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 120, g: 200, b: 255 };
}

function rgbToCss({ r, g, b }, a = 1) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

function mixRgb(colors) {
  let tw = 0;
  let r = 0, g = 0, b = 0;
  for (const c of colors) {
    const w = c.w || 0;
    if (w <= 0) continue;
    tw += w;
    r += c.rgb.r * w;
    g += c.rgb.g * w;
    b += c.rgb.b * w;
  }
  if (tw <= 0) return { r: 120, g: 200, b: 255 };
  return { r: r / tw, g: g / tw, b: b / tw };
}

function pickEdgePoint(w, h, pad, placement) {
  if (placement === 'bottom') {
    const x = pad + rand() * (w - pad * 2);
    const y = h - pad;
    return { x, y, nx: 0, ny: -1 };
  }
  const e = Math.floor(rand() * 4);
  if (e === 0) { // top
    const x = pad + rand() * (w - pad * 2);
    return { x, y: pad, nx: 0, ny: 1 };
  }
  if (e === 1) { // right
    const y = pad + rand() * (h - pad * 2);
    return { x: w - pad, y, nx: -1, ny: 0 };
  }
  if (e === 2) { // bottom
    const x = pad + rand() * (w - pad * 2);
    return { x, y: h - pad, nx: 0, ny: -1 };
  }
  const y = pad + rand() * (h - pad * 2);
  return { x: pad, y, nx: 1, ny: 0 };
}

/* ================= Canvas attachment ================= */
function ensureCanvas(existing) {
  if (existing && typeof existing.getContext === 'function') {
    styleCanvas(existing);
    return { canvas: existing, created: false };
  }
  const root = document.getElementById('overlayRoot') || document.body;
  const c = document.createElement('canvas');
  c.dataset.style = 'runeStorm';
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

function resizeCanvasToDisplaySize(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
}

/* ================= Meter coercion (BIG FIX) ================= */
function coerceMetersToMap(mLike) {
  // Returns { map: { [key]: number }, sum: number }
  const out = Object.create(null);
  let sum = 0;

  if (!mLike) return { map: out, sum: 0 };

  // wrapper: { meters: [...] }
  if (Array.isArray(mLike?.meters)) mLike = mLike.meters;

  // already a map
  if (!Array.isArray(mLike) && typeof mLike === 'object') {
    for (const [k, v] of Object.entries(mLike)) {
      const n = (typeof v === 'object' && v) ? (Number(v.value ?? v.hype ?? v.meter ?? 0) || 0) : (Number(v) || 0);
      const vv = Math.max(0, n);
      out[k] = vv;
      sum += vv;
    }
    return { map: out, sum };
  }

  // array of meters: [{factionId|id|key|faction, value|hype}, ...]
  if (Array.isArray(mLike)) {
    for (const it of mLike) {
      const key = it?.factionId ?? it?.id ?? it?.key ?? it?.faction ?? null;
      if (key == null) continue;
      const vv = Math.max(0, Number(it?.value ?? it?.hype ?? it?.meter ?? 0) || 0);
      out[key] = (out[key] || 0) + vv;
      sum += vv;
    }
    return { map: out, sum };
  }

  return { map: out, sum: 0 };
}

/* ================= Style ================= */
export function createStyle({ canvas, app, config } = {}) {
  const resolved = ensureCanvas(canvas);
  canvas = resolved.canvas;

  const ctx = canvas.getContext('2d', { alpha: true });

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let factions = [];          // [{id|key,colorHex,isActive}]
  let metersMap = {};         // { [key]: number }
  let sumHype = 0;

  // delta-driven "flash" so big moments feel huge even if the sum is already high
  let lastSum = 0;
  let flashVel = 0;
  let flash = 0;

  const sparks = []; // {x,y,vx,vy,t,life,size,rgb}

  function readAppState() {
    try {
      const st = (app && typeof app.getState === 'function') ? app.getState() : null;
      if (st?.factions) factions = st.factions;

      // accept st.meters (map or array) or st.meter(s) wrappers
      const mLike = st?.meters ?? st?.meter ?? st?.hype ?? null;
      if (mLike != null) {
        const { map, sum } = coerceMetersToMap(mLike);
        metersMap = map;
        sumHype = sum;
      }
    } catch {}
  }

  // subscribe (optional)
  if (app && typeof app.on === 'function') {
    try {
      app.on('state', (st) => {
        if (st?.factions) factions = st.factions;
        const mLike = st?.meters ?? st?.meter ?? st?.hype ?? null;
        if (mLike != null) {
          const { map, sum } = coerceMetersToMap(mLike);
          metersMap = map;
          sumHype = sum;
        }
      });

      app.on('factions', (f) => { if (Array.isArray(f)) factions = f; });

      // meters may arrive as array or map or wrapper
      app.on('meters', (m) => {
        const { map, sum } = coerceMetersToMap(m);
        metersMap = map;
        sumHype = sum;
      });
    } catch {}
  }

  function computeColor() {
    const act = Array.isArray(factions)
      ? factions.filter(f => f && (f.isActive !== false))
      : [];

    if (!act.length) {
      const fallback = hexToRgb(cfg.defaultColor || '#78C8FF');
      return { mixed: fallback, winner: fallback };
    }

    let winnerKey = act[0]?.key ?? act[0]?.id;
    let winnerVal = -Infinity;
    const weights = [];

    for (const f of act) {
      const key = f?.key ?? f?.id;
      if (key == null) continue;

      const v = Math.max(0, Number(metersMap?.[key] ?? 0) || 0);
      const rgb = hexToRgb(f.colorHex || f.color || cfg.defaultColor || '#78C8FF');
      weights.push({ key, v, rgb });

      if (v > winnerVal) {
        winnerVal = v;
        winnerKey = key;
      }
    }

    const winner = weights.find(w => w.key === winnerKey)?.rgb || hexToRgb(cfg.defaultColor || '#78C8FF');
    const mixed = mixRgb(weights.map(w => ({ rgb: w.rgb, w: w.v })));
    return { mixed, winner };
  }

  function hype01() {
    // Normalize sum -> 0..1, then apply intensity and curve.
    const scale = clamp(cfg.hypeScale || 180, 40, 1200);
    const base = 1 - Math.exp(-(Math.max(0, sumHype)) / scale);

    const intensity = clamp(cfg.intensity || 1, 0, 2);
    const curved = Math.pow(clamp01(base * intensity), clamp(cfg.hypeCurve || 1.35, 0.4, 3));

    return clamp01(curved);
  }

  function updateFlash(dt) {
    // flash reacts to *changes* in total hype
    const delta = Math.abs(sumHype - lastSum);
    lastSum = sumHype;

    // convert delta to 0..1-ish impulse
    const impulse = clamp01(delta / 28);
    flashVel += impulse * 1.6;

    // decay + integrate
    flashVel *= Math.pow(0.12, dt);
    flash = clamp01(flash * Math.pow(0.06, dt) + flashVel * (cfg.auraFlash || 0.75));
  }

  function spawnSparks(dt, colorRgb, wCss, hCss, h01) {
    const pad = cfg.padding || 0;
    const placement = cfg.placement || 'edges';

    const base = clamp(cfg.sparkRate || 0, 0, 500);
    const boost = clamp(cfg.sparkBoost || 0, 0, 1200);

    // sparks scale harder at high hype
    const rate = base + boost * (0.15 + 0.85 * h01);

    const want = rate * dt;
    const count = Math.floor(want);
    const extra = (rand() < (want - count)) ? 1 : 0;
    const n = count + extra;

    const life = clamp(cfg.sparkLife || 0.9, 0.1, 3) * (0.75 + 0.65 * h01);
    const jitter = clamp(cfg.jitter || 0, 0, 1);

    for (let i = 0; i < n; i++) {
      const p = pickEdgePoint(wCss, hCss, pad, placement);

      const speed = 90 + 380 * h01 + 180 * flash;
      const vx = (p.nx * speed) + (rand() - 0.5) * speed * jitter;
      const vy = (p.ny * speed) + (rand() - 0.5) * speed * jitter;

      const sizeBase = clamp(cfg.sparkSize || 2.2, 0.5, 12);
      const size = sizeBase * (0.85 + 1.35 * h01 + 0.9 * flash);

      sparks.push({
        x: p.x + (rand() - 0.5) * 7 * jitter,
        y: p.y + (rand() - 0.5) * 7 * jitter,
        vx, vy,
        t: 0,
        life,
        size,
        rgb: colorRgb
      });
    }
  }

  function stepSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // drag (less drag at high speed for streaky feel)
      s.vx *= (1 - 0.75 * dt);
      s.vy *= (1 - 0.75 * dt);
      if (s.t >= s.life) sparks.splice(i, 1);
    }
    // safety cap
    if (sparks.length > 2600) sparks.splice(0, sparks.length - 2600);
  }

  function drawRunes(colorRgb, timeSec, wCss, hCss, h01) {
    const pad = clamp(cfg.padding || 10, 0, 80);
    const placement = cfg.placement || 'edges';

    const baseThick = clamp(cfg.thickness || 16, 4, 120);
    const thickBoost = clamp(cfg.maxThicknessBoost || 2.25, 1, 4);
    const thick = baseThick * (0.85 + thickBoost * h01) * (1 + 0.55 * flash);

    const baseGlow = clamp01(cfg.glow || 0);
    const glowBoost = clamp(cfg.maxGlowBoost || 2.1, 1, 4);
    const glow = clamp01(baseGlow * (0.75 + glowBoost * h01) + 0.45 * flash);

    ctx.clearRect(0, 0, wCss, hCss);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const speed = clamp(cfg.runeSpeed || 1, 0.05, 3);
    const density = clamp(cfg.runeDensity || 0.65, 0, 1);

    // More segments at high hype (looks like "growth")
    const segments = Math.floor(28 + 70 * density + 60 * h01);
    const segOn = density;

    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * 2.25 * speed + h01 * 1.4));
    const baseAlpha = 0.10 + 0.18 * density + 0.68 * h01 + 0.35 * flash;

    const phase = (timeSec * 0.35 * speed + h01 * 0.25) % 1;

    // Outer aura "bloom" on the perimeter (THIS is the big PRO growth)
    const bloomAmt = clamp01(cfg.auraBloom || 0);
    if (bloomAmt > 0.001) {
      ctx.save();
      ctx.globalAlpha = clamp01((0.06 + 0.26 * h01 + 0.22 * flash) * bloomAmt);
      ctx.shadowColor = rgbToCss(colorRgb, 1);
      ctx.shadowBlur = (18 + 120 * bloomAmt) * (0.25 + 1.15 * h01 + 1.15 * flash);
      ctx.strokeStyle = rgbToCss(colorRgb, 0.35);
      ctx.lineWidth = thick * (0.55 + 0.85 * h01);

      if (placement === 'bottom') {
        const y = hCss - pad - thick / 2;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(wCss - pad, y);
        ctx.stroke();
      } else {
        const left = pad + thick / 2;
        const right = wCss - pad - thick / 2;
        const top = pad + thick / 2;
        const bottom = hCss - pad - thick / 2;
        ctx.strokeRect(left, top, right - left, bottom - top);
      }
      ctx.restore();
    }

    function strokeSegment(x1, y1, x2, y2, a) {
      // thick outer
      ctx.strokeStyle = rgbToCss(colorRgb, a);
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // inner hot core
      ctx.strokeStyle = rgbToCss(colorRgb, a * (0.75 + 0.25 * h01));
      ctx.lineWidth = Math.max(1.4, thick * (0.18 + 0.14 * h01));
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (placement === 'bottom') {
      const y = hCss - pad - thick / 2;
      const span = wCss - pad * 2;

      for (let i = 0; i < segments; i++) {
        const t = (i / segments + phase) % 1;
        const on = (Math.sin((t * Math.PI * 2) + i * 0.95) * 0.5 + 0.5);

        // denser “glyph on/off” at hype
        const gate = (1 - segOn) * (1 - 0.55 * h01);
        if (on < gate) continue;

        const xA = pad + span * (i / segments);
        const xB = pad + span * ((i + 1) / segments);

        // rune wobble/jitter grows with hype
        const jit = clamp01(cfg.jitter || 0) * (0.35 + 0.95 * h01);
        const wob = (Math.sin(i * 2.1 + timeSec * 6.0 * speed) + Math.cos(i * 1.4 + timeSec * 4.6 * speed)) * 0.5;
        const yW = y + wob * (1.5 + 10 * jit);

        const a = clamp01(baseAlpha * (0.55 + 0.45 * on) * pulse);
        strokeSegment(xA, yW, xB, yW, a);
      }
    } else {
      const left = pad + thick / 2;
      const right = wCss - pad - thick / 2;
      const top = pad + thick / 2;
      const bottom = hCss - pad - thick / 2;

      for (let i = 0; i < segments; i++) {
        const t = (i / segments + phase) % 1;
        const on = (Math.sin((t * Math.PI * 2) + i * 1.08) * 0.5 + 0.5);

        const gate = (1 - segOn) * (1 - 0.55 * h01);
        if (on < gate) continue;

        const a = clamp01(baseAlpha * (0.55 + 0.45 * on) * pulse);
        const p = i / segments;

        const jit = clamp01(cfg.jitter || 0) * (0.35 + 0.95 * h01);
        const wob = (Math.sin(i * 1.9 + timeSec * 5.9 * speed) + Math.cos(i * 1.3 + timeSec * 4.4 * speed)) * 0.5;
        const jw = wob * (1.5 + 10 * jit);

        if (p < 0.25) {
          const xA = left + (right - left) * (p / 0.25);
          const xB = left + (right - left) * ((p + 1 / segments) / 0.25);
          strokeSegment(xA, top + jw, xB, top + jw, a);
        } else if (p < 0.5) {
          const yA = top + (bottom - top) * ((p - 0.25) / 0.25);
          const yB = top + (bottom - top) * ((p - 0.25 + 1 / segments) / 0.25);
          strokeSegment(right + jw, yA, right + jw, yB, a);
        } else if (p < 0.75) {
          const xA = right - (right - left) * ((p - 0.5) / 0.25);
          const xB = right - (right - left) * ((p - 0.5 + 1 / segments) / 0.25);
          strokeSegment(xA, bottom - jw, xB, bottom - jw, a);
        } else {
          const yA = bottom - (bottom - top) * ((p - 0.75) / 0.25);
          const yB = bottom - (bottom - top) * ((p - 0.75 + 1 / segments) / 0.25);
          strokeSegment(left - jw, yA, left - jw, yB, a);
        }
      }
    }

    // glow wash (subtle at idle, very present at max hype)
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = clamp01(glow * (0.035 + 0.22 * h01 + 0.18 * flash));
      ctx.fillStyle = rgbToCss(colorRgb, 1);
      ctx.fillRect(0, 0, wCss, hCss);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawSparks(h01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const bloom = clamp01(cfg.auraBloom || 0);
    const sBlur = (6 + 40 * bloom) * (0.25 + 1.2 * h01 + 1.0 * flash);
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = sBlur;

    for (const s of sparks) {
      const p = clamp01(s.t / s.life);
      const a = (1 - p) * (0.85 + 0.25 * Math.sin(p * Math.PI));
      ctx.fillStyle = rgbToCss(s.rgb, a);

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();

      // streak
      ctx.strokeStyle = rgbToCss(s.rgb, a * 0.75);
      ctx.lineWidth = Math.max(1, s.size * (0.45 + 0.35 * h01));
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.022, s.y - s.vy * 0.022);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ================= Animation loop ================= */
  let raf = null;
  let last = performance.now() / 1000;

  function tick() {
    raf = requestAnimationFrame(tick);

    const now = performance.now() / 1000;
    const dt = clamp(now - last, 0, 0.05);
    last = now;

    const dpr = resizeCanvasToDisplaySize(canvas);

    // draw in CSS pixels
    const wCss = canvas.width / dpr;
    const hCss = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    readAppState();

    // compute hype + flash
    const h01 = hype01();
    updateFlash(dt);

    // pick color
    const { mixed, winner } = computeColor();
    const color = (cfg.mixMode === 'winner') ? winner : mixed;

    // spawn/step/draw
    spawnSparks(dt, color, wCss, hCss, h01);
    stepSparks(dt);

    drawRunes(color, now, wCss, hCss, h01);
    drawSparks(h01);
  }

  tick();

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      sparks.length = 0;

      if (resolved.created && canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
    setConfig(next) {
      cfg = { ...cfg, ...(next || {}) };
    }
  };
}

// ✅ Back-compat export
export function init(args) {
  return createStyle(args || {});
}
