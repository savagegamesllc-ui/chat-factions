// public/overlays/styles/tacticalHudPro.js
// PRO Overlay: Tactical HUD (Team Shooters)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Notes:
// - Uses api.onMeters(snap) (same as your other overlays).
// - Includes "screen scrubber" scaffolding that can be driven via window.postMessage.
//   This is intentionally simple + future-proof: you can pipe game telemetry / OCR / capture
//   events into the overlay without changing the overlay runtime contract.

'use strict';

export const meta = {
  styleKey: 'tacticalHudPro',
  name: 'Tactical HUD (PRO)',
  tier: 'PRO',
  description:
    'A team-shooter HUD: top duel bar for the top two factions plus a bottom squad strip for up to four factions. Includes optional screen-scrubber scaffolding for future game interaction.',

  // IMPORTANT: defaults live here (Crownfall-style)
  defaultConfig: {
    // Layout / readability
    sizePreset: 'md',          // sm | md | lg
    scale: 1.0,                // 0.6..1.4
    safeMarginPct: 0.03,       // 0..0.12
    maxSquadCards: 4,          // 2..4
    scanlines: true,           // subtle texture

    // Hype mapping (stable across stream sizes)
    hypeK: 2000,               // larger => slower rise, smaller => faster rise
    maxTotalClamp: 4000,       // clamp total so extreme meters don't blow out visuals

    // Scrubber (scaffolding)
    scrubber: {
      enabled: false,          // master switch
      mode: 'external',        // external | auto | off
      beamWidthPct: 0.10,      // 0.02..0.30 (soft beam width)
      softnessPct: 0.35,       // 0..1 (edge softness)
      intensity: 1.0,          // 0..2 (how much the beam "energizes" the HUD)
      autoSpeed: 0.35,         // auto sweep speed (only used in mode:auto)
      invert: false,           // if true, beam "dims" instead of boosts
      debugReticle: false      // draw target ring to verify feed
    }
  }
};

/* ---------------------------
   helpers
--------------------------- */

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return {
    r: isFinite(r) ? r : 255,
    g: isFinite(g) ? g : 255,
    b: isFinite(b) ? b : 255
  };
}

function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}

function hypeFromTotal(total, hypeK) {
  // Crownfall-style exponential response: h = 1 - exp(-total/k)
  const k = Math.max(1, Number(hypeK || 2000));
  return 1 - Math.exp(-Math.max(0, total) / k);
}

function pickTopFactions(snap, max = 4) {
  const list = Array.isArray(snap?.factions) ? snap.factions.slice() : [];
  list.sort((x, y) => (y?.meter || 0) - (x?.meter || 0));
  return list.slice(0, max).map((f, i) => ({
    idx: i,
    name: String(f?.name || f?.factionKey || `Faction ${i + 1}`),
    key: String(f?.factionKey || f?.name || `f${i + 1}`),
    color: String(f?.colorHex || '#ffffff'),
    meter: Number(f?.meter || 0),
  }));
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawScanLines(ctx, x, y, w, h, alpha, spacing) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineWidth = 1;
  for (let yy = y; yy < y + h; yy += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, yy + 0.5);
    ctx.lineTo(x + w, yy + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function getScaleFromPreset(preset) {
  const p = String(preset || 'md').toLowerCase();
  if (p === 'sm') return 0.85;
  if (p === 'lg') return 1.15;
  return 1.0;
}

function makeLayout(cfg, w, h) {
  const safe = clamp(Number(cfg.safeMarginPct ?? 0.03), 0, 0.12);
  const margin = Math.round(Math.min(w, h) * safe);

  const scale = clamp(Number(cfg.scale ?? 1), 0.6, 1.4) * getScaleFromPreset(cfg.sizePreset);

  const topBarH = Math.round(72 * scale);
  const bottomStripH = Math.round(110 * scale);

  return {
    margin,
    scale,
    top: { x: margin, y: margin, w: w - margin * 2, h: topBarH },
    bottom: { x: margin, y: h - margin - bottomStripH, w: w - margin * 2, h: bottomStripH },
  };
}

/* ---------------------------
   main draw pieces
--------------------------- */

function drawTopDuelBar(ctx, box, a, b, vibe) {
  const { x, y, w, h } = box;

  ctx.save();

  drawRoundedRect(ctx, x, y, w, h, Math.round(h * 0.22));
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.stroke();

  const total = Math.max(1, (a?.meter || 0) + (b?.meter || 0));
  const aPct = clamp((a?.meter || 0) / total, 0, 1);

  const innerPad = Math.round(h * 0.16);
  const ix = x + innerPad;
  const iy = y + innerPad;
  const iw = w - innerPad * 2;
  const ih = h - innerPad * 2;

  drawRoundedRect(ctx, ix, iy, iw, ih, Math.round(ih * 0.35));
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  const aW = Math.round(iw * aPct);
  const bW = iw - aW;

  if (aW > 0) {
    ctx.save();
    drawRoundedRect(ctx, ix, iy, aW, ih, Math.round(ih * 0.35));
    ctx.clip();
    ctx.fillStyle = rgba(a?.color || '#ffffff', 0.38 + vibe.hype * 0.22 + vibe.scrubBoost * 0.12);
    ctx.fillRect(ix, iy, aW, ih);
    ctx.fillStyle = rgba(a?.color || '#ffffff', 0.75);
    ctx.fillRect(ix + aW - 3, iy, 3, ih);
    ctx.restore();
  }

  if (bW > 0) {
    ctx.save();
    drawRoundedRect(ctx, ix + aW, iy, bW, ih, Math.round(ih * 0.35));
    ctx.clip();
    ctx.fillStyle = rgba(b?.color || '#ffffff', 0.28 + vibe.hype * 0.18 + vibe.scrubBoost * 0.08);
    ctx.fillRect(ix + aW, iy, bW, ih);
    ctx.fillStyle = rgba(b?.color || '#ffffff', 0.55);
    ctx.fillRect(ix + aW, iy, 3, ih);
    ctx.restore();
  }

  const midX = ix + Math.round(iw / 2);
  const pulseA = 0.06 + vibe.hype * 0.18 + vibe.hit * 0.25 + vibe.scrubBoost * 0.10;
  ctx.fillStyle = `rgba(255,255,255,${pulseA.toFixed(3)})`;
  ctx.fillRect(midX - 1, iy - 4, 2, ih + 8);

  ctx.font = `${Math.round(h * 0.26)}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  const leftLabel = a ? `${a.name}` : '—';
  const rightLabel = b ? `${b.name}` : '—';

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(leftLabel, x + Math.round(h * 0.45) + 1, y + Math.round(h / 2) + 1);

  const rw = ctx.measureText(rightLabel).width;
  ctx.fillText(rightLabel, x + w - Math.round(h * 0.45) - rw + 1, y + Math.round(h / 2) + 1);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(leftLabel, x + Math.round(h * 0.45), y + Math.round(h / 2));
  ctx.fillText(rightLabel, x + w - Math.round(h * 0.45) - rw, y + Math.round(h / 2));

  if (vibe.scanlines) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    drawScanLines(ctx, x, y, w, h, 0.35 + vibe.hype * 0.25, 6);
  }

  ctx.restore();
}

function drawSquadStrip(ctx, box, squad, vibe, cfg) {
  const { x, y, w, h } = box;

  ctx.save();

  drawRoundedRect(ctx, x, y, w, h, Math.round(h * 0.22));
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();

  const maxCards = clamp(Number(cfg.maxSquadCards ?? 4), 2, 4);
  const cards = squad.slice(0, maxCards);

  const gap = Math.round(10 * vibe.scale);
  const pad = Math.round(14 * vibe.scale);

  const cardW = Math.floor((w - pad * 2 - gap * (maxCards - 1)) / maxCards);
  const cardH = h - pad * 2;

  const leader = (cards[0]?.meter || 1);

  for (let i = 0; i < maxCards; i++) {
    const cx = x + pad + i * (cardW + gap);
    const cy = y + pad;

    const f = cards[i] || null;

    drawRoundedRect(ctx, cx, cy, cardW, cardH, Math.round(cardH * 0.18));
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.fill();

    const railW = Math.max(6, Math.round(10 * vibe.scale));
    ctx.fillStyle = rgba(f?.color || '#ffffff', 0.65 + vibe.hype * 0.22 + vibe.scrubBoost * 0.10);
    ctx.fillRect(cx, cy, railW, cardH);

    ctx.font = `${Math.round(16 * vibe.scale)}px Arial, sans-serif`;
    ctx.textBaseline = 'top';
    const label = f ? f.name : '—';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(label, cx + railW + Math.round(10 * vibe.scale), cy + Math.round(8 * vibe.scale));

    const barX = cx + railW + Math.round(10 * vibe.scale);
    const barY = cy + Math.round(36 * vibe.scale);
    const barW = cardW - (barX - cx) - Math.round(10 * vibe.scale);
    const barH = Math.round(14 * vibe.scale);

    drawRoundedRect(ctx, barX, barY, barW, barH, Math.round(barH / 2));
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();

    const m = f ? f.meter : 0;
    const pct = clamp(leader > 0 ? m / leader : 0, 0, 1);
    const fillW = Math.round(barW * pct);

    if (fillW > 0) {
      drawRoundedRect(ctx, barX, barY, fillW, barH, Math.round(barH / 2));
      ctx.fillStyle = rgba(f?.color || '#ffffff', 0.55 + vibe.hype * 0.20 + vibe.scrubBoost * 0.10);
      ctx.fill();
    }

    const ringR = Math.round(16 * vibe.scale);
    const ringCX = cx + cardW - Math.round(22 * vibe.scale);
    const ringCY = cy + Math.round(22 * vibe.scale);
    const ult = clamp(pct * 0.85 + vibe.hype * 0.20, 0, 1);

    ctx.lineWidth = Math.max(2, Math.round(3 * vibe.scale));
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = rgba(f?.color || '#ffffff', 0.85);
    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ult);
    ctx.stroke();

    if (vibe.hype > 0.65) {
      const shimmerA = (vibe.hype - 0.65) / 0.35;
      ctx.strokeStyle = rgba(f?.color || '#ffffff', 0.08 + shimmerA * 0.12);
      ctx.lineWidth = 1;
      drawScanLines(ctx, cx, cy, cardW, cardH, 0.35 + shimmerA * 0.35, 5);
    }
  }

  const seamA = 0.05 + vibe.hype * 0.18 + vibe.hit * 0.25 + vibe.scrubBoost * 0.10;
  ctx.fillStyle = `rgba(255,255,255,${seamA.toFixed(3)})`;
  ctx.fillRect(x + 12, y + h - 2, w - 24, 2);

  ctx.restore();
}

/* ---------------------------
   screen scrubber scaffolding
--------------------------- */

/**
 * External feed format (postMessage):
 *
 * window.postMessage({
 *   type: 'CF_SCRUB',
 *   x: 0.0..1.0,           // normalized screen x
 *   y: 0.0..1.0,           // normalized screen y (optional)
 *   active: true|false,    // optional
 *   strength: 0..1,        // optional (beam intensity)
 *   width: 0.02..0.30      // optional (beam width)
 * }, '*');
 *
 * Reset:
 * window.postMessage({ type:'CF_SCRUB_RESET' }, '*');
 *
 * This gives you a clean “flagship hook” for later:
 * - game state integration
 * - OCR regions
 * - bounding boxes from a capture service
 * - telemetry-driven “highlight the objective” moments
 */

function makeScrubberState(cfg) {
  return {
    enabled: !!cfg?.enabled,
    mode: String(cfg?.mode || 'external'), // external | auto | off
    x: 0.5,
    y: 0.5,
    widthPct: clamp(Number(cfg?.beamWidthPct ?? 0.10), 0.02, 0.30),
    softnessPct: clamp(Number(cfg?.softnessPct ?? 0.35), 0, 1),
    intensity: clamp(Number(cfg?.intensity ?? 1.0), 0, 2),
    autoSpeed: clamp(Number(cfg?.autoSpeed ?? 0.35), 0.05, 2.0),
    invert: !!cfg?.invert,
    debugReticle: !!cfg?.debugReticle,
    active: true,
    strength: 0.0
  };
}

function updateScrubberAuto(scrub, dt) {
  // simple saw wave left->right (stable, predictable)
  const speed = scrub.autoSpeed;
  scrub.x += dt * 0.12 * speed;
  if (scrub.x > 1.15) scrub.x = -0.15;
  scrub.active = true;
  scrub.strength = 1.0;
}

function applyScrubberBeam(ctx, w, h, scrub, leaderColor) {
  if (!scrub.enabled) return { boost: 0 };

  if (scrub.mode === 'off') return { boost: 0 };

  const xPx = clamp(scrub.x, 0, 1) * w;
  const beamW = scrub.widthPct * w;
  const soft = clamp(scrub.softnessPct, 0, 1);
  const inner = beamW * (1 - soft);
  const outer = beamW;

  // strength 0..1 mapped with intensity
  const s = clamp(scrub.strength, 0, 1) * scrub.intensity;
  if (s <= 0.001) return { boost: 0 };

  ctx.save();

  // beam gradient (soft edges)
  const g = ctx.createLinearGradient(xPx - outer, 0, xPx + outer, 0);
  const baseA = 0.10 + s * 0.22;
  const midA = 0.22 + s * 0.28;

  const beamColor = leaderColor || '#ffffff';

  if (!scrub.invert) {
    g.addColorStop(0.00, rgba(beamColor, 0.00));
    g.addColorStop(clamp((outer - inner) / (2 * outer), 0, 1), rgba(beamColor, baseA));
    g.addColorStop(0.50, rgba(beamColor, midA));
    g.addColorStop(clamp(1 - (outer - inner) / (2 * outer), 0, 1), rgba(beamColor, baseA));
    g.addColorStop(1.00, rgba(beamColor, 0.00));
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(0, 0, w, h);
  } else {
    // invert mode: dim within beam
    g.addColorStop(0.00, 'rgba(0,0,0,0.00)');
    g.addColorStop(0.50, `rgba(0,0,0,${(0.12 + s * 0.20).toFixed(3)})`);
    g.addColorStop(1.00, 'rgba(0,0,0,0.00)');
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(0, 0, w, h);
  }

  if (scrub.debugReticle) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(leaderColor || '#ffffff', 0.65);
    ctx.beginPath();
    ctx.arc(xPx, clamp(scrub.y, 0, 1) * h, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // return a normalized “boost” so HUD elements can react subtly
  return { boost: clamp(s, 0, 1) };
}

/* ---------------------------
   init
--------------------------- */

export function init({ root, config, api }) {
  // Merge meta defaults with provided config
  const cfg = {
    ...meta.defaultConfig,
    ...(config && typeof config === 'object' ? config : {})
  };

  // Root setup (OBS safe)
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.pointerEvents = 'none';

  // Single onscreen canvas
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // meters
  let lastSnap = { factions: [] };

  api.onMeters((snap) => {
    lastSnap = snap || { factions: [] };
  });

  // scrubber state + listener scaffolding
  const scrub = makeScrubberState(cfg.scrubber);

  function onMessage(ev) {
    const msg = ev?.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'CF_SCRUB') {
      // external drive
      if (scrub.mode !== 'external') return;

      if (typeof msg.x === 'number') scrub.x = clamp(msg.x, -0.2, 1.2);
      if (typeof msg.y === 'number') scrub.y = clamp(msg.y, -0.2, 1.2);
      if (typeof msg.active === 'boolean') scrub.active = msg.active;
      if (typeof msg.strength === 'number') scrub.strength = clamp(msg.strength, 0, 1);
      if (typeof msg.width === 'number') scrub.widthPct = clamp(msg.width, 0.02, 0.30);

      // if no explicit strength provided, treat activity as “on”
      if (typeof msg.strength !== 'number') scrub.strength = scrub.active ? 1.0 : 0.0;
    }

    if (msg.type === 'CF_SCRUB_RESET') {
      scrub.x = 0.5;
      scrub.y = 0.5;
      scrub.active = true;
      scrub.strength = 0.0;
    }
  }

  window.addEventListener('message', onMessage);

  // resize
  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(root.clientWidth * dpr);
    canvas.height = Math.floor(root.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  // vibe state
  let hit = 0;
  let hitVel = 0;
  let lastTotal = 0;

  let lastTime = performance.now();

  function frame(now) {
    const w = root.clientWidth;
    const h = root.clientHeight;

    // dt in seconds (clamped)
    const dt = clamp((now - lastTime) / 1000, 0, 0.05);
    lastTime = now;

    ctx.clearRect(0, 0, w, h);

    const top4 = pickTopFactions(lastSnap, 4);
    const a = top4[0] || null;
    const b = top4[1] || null;

    // total + clamp
    let total = top4.reduce((acc, f) => acc + (f.meter || 0), 0);
    total = Math.min(total, Number(cfg.maxTotalClamp || 4000));

    // hype curve
    const hype = clamp(hypeFromTotal(total, cfg.hypeK), 0, 1);

    // spike -> "hit"
    const delta = total - lastTotal;
    lastTotal = lerp(lastTotal, total, 0.18);

    const spike = clamp(delta / 250, 0, 1);
    hitVel += spike * 0.12;
    hitVel *= 0.88;
    hit += hitVel;
    hit *= 0.90;
    hit = clamp(hit, 0, 1);

    // layout
    const layout = makeLayout(cfg, w, h);

    // scrubber update (auto mode)
    if (scrub.enabled && scrub.mode === 'auto') {
      updateScrubberAuto(scrub, dt);
    }

    // decay scrub strength if external feed goes quiet (keeps it responsive but not sticky)
    if (scrub.enabled && scrub.mode === 'external') {
      scrub.strength = lerp(scrub.strength, 0.0, dt * 2.2);
    }

    // Apply scrubber beam first (so HUD can react)
    const leaderColor = a?.color || '#ffffff';
    const scrubBoost = scrub.enabled && scrub.active ? applyScrubberBeam(ctx, w, h, scrub, leaderColor).boost : 0;

    const vibe = {
      hype,
      hit,
      scale: layout.scale,
      scanlines: !!cfg.scanlines,
      scrubBoost
    };

    // HUD draw
    drawTopDuelBar(ctx, layout.top, a, b, vibe);
    drawSquadStrip(ctx, layout.bottom, top4, vibe, cfg);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // Optional cleanup hook pattern (if you add teardown later in runtime)
  // return () => {
  //   window.removeEventListener('message', onMessage);
  //   ro.disconnect();
  // };
}
