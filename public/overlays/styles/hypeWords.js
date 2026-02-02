// public/overlays/styles/hypeWords.js
// FREE Overlay: Hype Words (random phrases that appear more often as hype rises)
//
// Contract:
//   export const meta
//   export function init({ root, config, api })
//
// Notes:
// - total hype = sum(snap.factions[].meter)
// - h = 1 - exp(-total / hypeK)
// - spawn rate increases with h
// - DOM elements are capped + auto-cleaned for performance
// - pointer-events:none for OBS safety

'use strict';

export const meta = {
  styleKey: 'hypeWords',
  name: 'Hype Words (FREE)',
  tier: 'FREE',
  description:
    'Choose up to 7 words/phrases. They appear randomly on screen, more frequently as hype increases.',

  defaultConfig: {
    // Up to 7 phrases (blank = ignored)
    word1: 'HYPE!',
    word2: 'LET’S GO!',
    word3: 'WOOO!',
    word4: 'BIG MOMENT',
    word5: '',
    word6: '',
    word7: '',

    // Hype mapping
    hypeK: 140,              // higher = needs more hype to ramp
    maxTotalClamp: 2200,     // safety clamp on total

    // Spawn tuning
    baseSpawnPerSec: 0,   // at ~0 hype
    boostSpawnPerSec: 4.25,  // additional at max hype
    maxActive: 16,           // max words on screen at once (perf cap)

    // Word behavior
    minLifeSec: 1.2,
    maxLifeSec: 2.6,
    driftPxPerSec: 28,       // upward drift speed
    wanderPxPerSec: 14,      // slight sideways drift

    // Appearance
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    minFontPx: 18,
    maxFontPx: 56,
    fontWeight: 800,
    letterSpacingPx: 0.2,

    // Color/FX (kept simple + OBS friendly)
    color: 'rgba(255,255,255,0.92)',
    outlinePx: 3,            // faux stroke via text-shadow
    outlineAlpha: 0.55,
    glowStrength: 0.65,      // 0..1
    glowAlpha: 0.22,

    // Screen placement
    marginPx: 36,            // keep away from extreme edges
    safeTopBias: 0.12,       // keep a little more space near top overlays (0..0.35)

    // Performance
    fpsCap: 60
  },

  controls: [
    { key: 'word1', label: 'Word / Phrase 1', type: 'text', default: 'HYPE!' },
    { key: 'word2', label: 'Word / Phrase 2', type: 'text', default: 'LET’S GO!' },
    { key: 'word3', label: 'Word / Phrase 3', type: 'text', default: 'WOOO!' },
    { key: 'word4', label: 'Word / Phrase 4', type: 'text', default: 'BIG MOMENT' },
    { key: 'word5', label: 'Word / Phrase 5', type: 'text', default: '' },
    { key: 'word6', label: 'Word / Phrase 6', type: 'text', default: '' },
    { key: 'word7', label: 'Word / Phrase 7', type: 'text', default: '' },

    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 600, step: 5, default: 140 },
    { key: 'baseSpawnPerSec', label: 'Base Spawn / sec', type: 'range', min: 0, max: 3, step: 0.05, default: 0.45 },
    { key: 'boostSpawnPerSec', label: 'Boost Spawn / sec', type: 'range', min: 0, max: 12, step: 0.1, default: 4.25 },
    { key: 'maxActive', label: 'Max On Screen', type: 'range', min: 1, max: 40, step: 1, default: 16 },

    { key: 'minLifeSec', label: 'Min Life (sec)', type: 'range', min: 0.5, max: 6, step: 0.1, default: 1.2 },
    { key: 'maxLifeSec', label: 'Max Life (sec)', type: 'range', min: 0.5, max: 10, step: 0.1, default: 2.6 },

    { key: 'minFontPx', label: 'Min Font (px)', type: 'range', min: 10, max: 80, step: 1, default: 18 },
    { key: 'maxFontPx', label: 'Max Font (px)', type: 'range', min: 12, max: 140, step: 1, default: 56 },

    { key: 'driftPxPerSec', label: 'Upward Drift', type: 'range', min: 0, max: 120, step: 1, default: 28 },
    { key: 'wanderPxPerSec', label: 'Side Wander', type: 'range', min: 0, max: 80, step: 1, default: 14 },

    { key: 'marginPx', label: 'Edge Margin (px)', type: 'range', min: 0, max: 120, step: 1, default: 36 },
    { key: 'safeTopBias', label: 'Top Safe Bias', type: 'range', min: 0, max: 0.35, step: 0.01, default: 0.12 },

    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 }
  ]
};

function clamp(n, a, b) {
  n = Number.isFinite(+n) ? +n : a;
  return Math.max(a, Math.min(b, n));
}
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function pickPhrases(cfg) {
  const keys = ['word1','word2','word3','word4','word5','word6','word7'];
  const out = [];
  for (const k of keys) {
    const s = String(cfg?.[k] ?? '').trim();
    if (s) out.push(s);
  }
  return out;
}

function computeTotalAndH(snap, cfg) {
  const factions = (snap && Array.isArray(snap.factions)) ? snap.factions : [];
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2200, 200, 6000));

  const k = clamp(cfg.hypeK ?? 140, 40, 800);
  const h = 1 - Math.exp(-total / k);
  return { total, h: clamp01(h) };
}

export function init({ root, config, api }) {
  // Clear mount
  while (root.firstChild) root.removeChild(root.firstChild);

  // Container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.overflow = 'hidden';
  container.style.transform = 'translateZ(0)';
  container.style.willChange = 'transform, opacity';
  root.appendChild(container);

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  // live hype
  let latestSnap = { factions: [] };
  let hTarget = 0;
  let hSmooth = 0;

  const active = []; // { el, x,y, vx,vy, born, life, size, fadeIn, fadeOut }

  let spawnCarry = 0;

  // meters subscription (same pattern as crownfall)
  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    const res = computeTotalAndH(latestSnap, cfg);
    hTarget = res.h;
  });

  // perf loop
  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  function spawnOne(nowS, w, h, phrases) {
    if (!phrases.length) return;
    if (active.length >= clamp(cfg.maxActive ?? 16, 1, 80)) {
      // remove oldest (keeps it bounded)
      const old = active.shift();
      try { old?.el?.remove(); } catch {}
    }

    const phrase = phrases[(Math.random() * phrases.length) | 0];

    const life = clamp(
      lerp(cfg.minLifeSec ?? 1.2, cfg.maxLifeSec ?? 2.6, Math.random()),
      0.4,
      12
    );

    // font size scales a bit with hype + randomness
    const minPx = clamp(cfg.minFontPx ?? 18, 8, 220);
    const maxPx = clamp(cfg.maxFontPx ?? 56, minPx, 280);
    const size = lerp(minPx, maxPx, clamp01(0.25 + 0.55 * hSmooth + 0.25 * Math.random()));

    const margin = clamp(cfg.marginPx ?? 36, 0, 240);
    const topBias = clamp(cfg.safeTopBias ?? 0.12, 0, 0.35);

    const x = margin + Math.random() * Math.max(1, (w - margin * 2));
    const yMin = margin + h * topBias;
    const y = yMin + Math.random() * Math.max(1, (h - yMin - margin));

    const drift = clamp(cfg.driftPxPerSec ?? 28, 0, 400);
    const wander = clamp(cfg.wanderPxPerSec ?? 14, 0, 300);

    // movement: upward drift + small sideways random
    const vx = (Math.random() - 0.5) * wander * (0.35 + 0.9 * Math.random());
    const vy = -drift * (0.55 + 0.9 * Math.random());

    const el = document.createElement('div');
    el.textContent = phrase;

    // positioning
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    el.style.transformOrigin = 'center';
    el.style.whiteSpace = 'nowrap';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';

    // typography
    el.style.fontFamily = String(cfg.fontFamily || meta.defaultConfig.fontFamily);
    el.style.fontSize = `${size.toFixed(0)}px`;
    el.style.fontWeight = String(cfg.fontWeight ?? 800);
    el.style.letterSpacing = `${clamp(cfg.letterSpacingPx ?? 0.2, -2, 6)}px`;
    el.style.lineHeight = '1';

    // color + faux outline/glow using text-shadow (fast + simple)
    const color = String(cfg.color || 'rgba(255,255,255,0.92)');
    const outlinePx = clamp(cfg.outlinePx ?? 3, 0, 12);
    const outlineA = clamp01(cfg.outlineAlpha ?? 0.55);
    const glow = clamp01(cfg.glowStrength ?? 0.65);
    const glowA = clamp01(cfg.glowAlpha ?? 0.22);

    el.style.color = color;

    const shadowParts = [];
    if (outlinePx > 0.1) {
      const o = outlinePx;
      // 8-direction faux stroke
      const stroke = `rgba(0,0,0,${outlineA})`;
      shadowParts.push(
        `${-o}px 0 ${0}px ${stroke}`,
        `${o}px 0 ${0}px ${stroke}`,
        `0 ${-o}px ${0}px ${stroke}`,
        `0 ${o}px ${0}px ${stroke}`,
        `${-o}px ${-o}px ${0}px ${stroke}`,
        `${o}px ${-o}px ${0}px ${stroke}`,
        `${-o}px ${o}px ${0}px ${stroke}`,
        `${o}px ${o}px ${0}px ${stroke}`,
      );
    }

    if (glow > 0.001) {
      const gBlur = (10 + 36 * glow) * (0.55 + 0.85 * hSmooth);
      shadowParts.push(`0 0 ${gBlur.toFixed(1)}px rgba(255,255,255,${(glowA * (0.55 + 0.85 * hSmooth)).toFixed(3)})`);
    }

    el.style.textShadow = shadowParts.join(', ');

    // opacity animation is done manually (no CSS keyframes needed)
    el.style.opacity = '0';

    container.appendChild(el);

    active.push({
      el, x, y, vx, vy,
      born: nowS,
      life,
      size,
      // timings
      fadeIn: Math.min(0.22, life * 0.22),
      fadeOut: Math.min(0.35, life * 0.30),
    });
  }

  function step(nowMs) {
    raf = requestAnimationFrame(step);

    const dtMs = Math.min(50, nowMs - lastMs);
    lastMs = nowMs;
    accMs += dtMs;

    const cap = clamp(cfg.fpsCap ?? 60, 15, 60);
    const frameEvery = 1000 / cap;
    if (accMs < frameEvery) return;

    const dt = Math.min(0.05, accMs / 1000);
    accMs = 0;

    // smooth hype (simple)
    const smooth = 0.14; // fixed smoothing feels good for this overlay
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth);

    const rect = container.getBoundingClientRect();
    const w = rect.width || 1920;
    const h = rect.height || 1080;

    // spawn logic
    const phrases = pickPhrases(cfg);
    const base = clamp(cfg.baseSpawnPerSec ?? 0.45, 0, 20);
    const boost = clamp(cfg.boostSpawnPerSec ?? 4.25, 0, 60);

    // non-linear ramp so low hype still feels alive
    const ramp = clamp01(0.15 + 0.85 * Math.pow(hSmooth, 0.85));
    const rate = base + boost * ramp;

    spawnCarry += rate * dt;
    const maxToSpawn = 4; // safety per frame
    let toSpawn = Math.min(maxToSpawn, Math.floor(spawnCarry));
    if (toSpawn > 0) spawnCarry -= toSpawn;

    for (let i = 0; i < toSpawn; i++) {
      spawnOne(nowMs / 1000, w, h, phrases);
    }

    // update active words
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      const t = (nowMs / 1000) - a.born;

      // lifetime end
      if (t >= a.life) {
        try { a.el.remove(); } catch {}
        active.splice(i, 1);
        continue;
      }

      // motion
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // gentle bounce off edges (keeps words in frame)
      const margin = clamp(cfg.marginPx ?? 36, 0, 240);
      if (a.x < margin) { a.x = margin; a.vx *= -0.7; }
      if (a.x > w - margin) { a.x = w - margin; a.vx *= -0.7; }

      // opacity envelope
      let op = 1;
      if (t < a.fadeIn) op = clamp01(t / a.fadeIn);
      const tail = a.life - t;
      if (tail < a.fadeOut) op = Math.min(op, clamp01(tail / a.fadeOut));

      // slight scale pulse with hype (tiny)
      const pulse = 1 + 0.02 * Math.sin((nowMs * 0.004) + i) * (0.25 + 0.75 * hSmooth);

      a.el.style.opacity = op.toFixed(3);
      a.el.style.transform = `translate3d(${a.x.toFixed(2)}px, ${a.y.toFixed(2)}px, 0) scale(${pulse.toFixed(4)})`;
    }
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };

    // recompute immediately (so changing hypeK etc feels instant)
    const res = computeTotalAndH(latestSnap, cfg);
    hTarget = res.h;
  }

  function destroy() {
    try { unsub?.(); } catch {}
    try { cancelAnimationFrame(raf); } catch {}
    for (const a of active) {
      try { a.el.remove(); } catch {}
    }
    active.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  raf = requestAnimationFrame(step);

  return { destroy, setConfig };
}
