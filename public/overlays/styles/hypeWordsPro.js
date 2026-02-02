// public/overlays/styles/hypeWordsPro.js
// PRO Overlay: Hype Words PRO
//
// Adds:
// - Phrase banks (3x6 = 18 phrases)
// - Optional faction-tint + top-faction bias
// - "Big Moment" center slam on hype spikes
//
// Contract:
//   export const meta
//   export function init({ root, config, api })

'use strict';

export const meta = {
  styleKey: 'hypeWordsPro',
  name: 'Hype Words (PRO)',
  tier: 'PRO',
  description:
    'Phrase banks + faction tinting + hype spike “Big Moment” slams. More hype = more frequent words.',

  defaultConfig: {
    // Bank A (up to 6)
    a1: 'HYPE!',
    a2: 'LET’S GO!',
    a3: 'WOOO!',
    a4: 'BIG MOMENT',
    a5: '',
    a6: '',

    // Bank B (up to 6)
    b1: 'CLUTCH',
    b2: 'NO WAY',
    b3: 'ABSOLUTE UNIT',
    b4: '',
    b5: '',
    b6: '',

    // Bank C (up to 6)
    c1: 'CHAT IS WILD',
    c2: 'WE TAKE THOSE',
    c3: '',
    c4: '',
    c5: '',
    c6: '',

    // Which banks are enabled
    bankAEnabled: true,
    bankBEnabled: true,
    bankCEnabled: true,

    // Hype mapping
    hypeK: 160,
    maxTotalClamp: 2600,

    // Spawn tuning
    baseSpawnPerSec: 0.55,
    boostSpawnPerSec: 6.25,
    maxActive: 22,
    maxSpawnPerFrame: 5,

    // Word behavior
    minLifeSec: 1.2,
    maxLifeSec: 3.1,
    driftPxPerSec: 32,
    wanderPxPerSec: 18,

    // Appearance
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    minFontPx: 18,
    maxFontPx: 64,
    fontWeight: 900,
    letterSpacingPx: 0.35,

    // Base color + FX
    baseColor: 'rgba(255,255,255,0.92)',
    outlinePx: 3,
    outlineAlpha: 0.58,
    glowStrength: 0.75,
    glowAlpha: 0.25,

    // Placement
    marginPx: 36,
    safeTopBias: 0.12,

    // Faction-aware features
    factionTintMode: 'top',     // 'off' | 'top' | 'random'
    tintStrength: 0.80,         // 0..1 (multiplies into rgba)
    biasToTopFaction: 0.45,     // 0..1 (higher = more likely to use top faction color when hype is high)

    // Big Moment (spike slam)
    bigMomentEnabled: true,
    bigMomentSpikeThreshold: 0.18, // delta-h threshold (0..1)
    bigMomentCooldownSec: 4.0,
    bigMomentLifeSec: 0.95,
    bigMomentFontBoost: 1.35,
    bigMomentUseBank: 'any',       // 'any' | 'A' | 'B' | 'C'
    bigMomentText: '',             // if set, always use this

    // Performance
    fpsCap: 60
  },

  controls: [
    // Bank toggles
    { key: 'bankAEnabled', label: 'Enable Bank A', type: 'boolean', default: true },
    { key: 'bankBEnabled', label: 'Enable Bank B', type: 'boolean', default: true },
    { key: 'bankCEnabled', label: 'Enable Bank C', type: 'boolean', default: true },

    // Bank A
    { key: 'a1', label: 'Bank A — 1', type: 'text', default: 'HYPE!' },
    { key: 'a2', label: 'Bank A — 2', type: 'text', default: 'LET’S GO!' },
    { key: 'a3', label: 'Bank A — 3', type: 'text', default: 'WOOO!' },
    { key: 'a4', label: 'Bank A — 4', type: 'text', default: 'BIG MOMENT' },
    { key: 'a5', label: 'Bank A — 5', type: 'text', default: '' },
    { key: 'a6', label: 'Bank A — 6', type: 'text', default: '' },

    // Bank B
    { key: 'b1', label: 'Bank B — 1', type: 'text', default: 'CLUTCH' },
    { key: 'b2', label: 'Bank B — 2', type: 'text', default: 'NO WAY' },
    { key: 'b3', label: 'Bank B — 3', type: 'text', default: 'ABSOLUTE UNIT' },
    { key: 'b4', label: 'Bank B — 4', type: 'text', default: '' },
    { key: 'b5', label: 'Bank B — 5', type: 'text', default: '' },
    { key: 'b6', label: 'Bank B — 6', type: 'text', default: '' },

    // Bank C
    { key: 'c1', label: 'Bank C — 1', type: 'text', default: 'CHAT IS WILD' },
    { key: 'c2', label: 'Bank C — 2', type: 'text', default: 'WE TAKE THOSE' },
    { key: 'c3', label: 'Bank C — 3', type: 'text', default: '' },
    { key: 'c4', label: 'Bank C — 4', type: 'text', default: '' },
    { key: 'c5', label: 'Bank C — 5', type: 'text', default: '' },
    { key: 'c6', label: 'Bank C — 6', type: 'text', default: '' },

    // Hype/spawn
    { key: 'hypeK', label: 'Hype Scale (k)', type: 'number', min: 40, max: 800, step: 5, default: 160 },
    { key: 'baseSpawnPerSec', label: 'Base Spawn / sec', type: 'range', min: 0, max: 4, step: 0.05, default: 0.55 },
    { key: 'boostSpawnPerSec', label: 'Boost Spawn / sec', type: 'range', min: 0, max: 14, step: 0.1, default: 6.25 },
    { key: 'maxActive', label: 'Max On Screen', type: 'range', min: 1, max: 60, step: 1, default: 22 },

    // Looks
    { key: 'minFontPx', label: 'Min Font (px)', type: 'range', min: 10, max: 90, step: 1, default: 18 },
    { key: 'maxFontPx', label: 'Max Font (px)', type: 'range', min: 12, max: 160, step: 1, default: 64 },
    { key: 'outlinePx', label: 'Outline (px)', type: 'range', min: 0, max: 12, step: 1, default: 3 },
    { key: 'glowStrength', label: 'Glow Strength', type: 'range', min: 0, max: 1, step: 0.05, default: 0.75 },

    // Faction tinting
    {
      key: 'factionTintMode',
      label: 'Faction Tint Mode',
      type: 'select',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'top', label: 'Top Faction' },
        { value: 'random', label: 'Random Faction' }
      ],
      default: 'top'
    },
    { key: 'tintStrength', label: 'Tint Strength', type: 'range', min: 0, max: 1, step: 0.05, default: 0.8 },
    { key: 'biasToTopFaction', label: 'Bias to Top (at high hype)', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },

    // Big moment
    { key: 'bigMomentEnabled', label: 'Enable Big Moment', type: 'boolean', default: true },
    { key: 'bigMomentSpikeThreshold', label: 'Spike Threshold', type: 'range', min: 0.05, max: 0.6, step: 0.01, default: 0.18 },
    { key: 'bigMomentCooldownSec', label: 'Big Moment Cooldown (sec)', type: 'range', min: 1, max: 30, step: 0.5, default: 4.0 },
    { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 15, max: 60, step: 1, default: 60 }
  ]
};

function clamp(n, a, b) {
  n = Number.isFinite(+n) ? +n : a;
  return Math.max(a, Math.min(b, n));
}
function clamp01(x) { return clamp(x, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const s = String(hex || '').trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
function rgbaFromRgb(rgb, a) {
  if (!rgb) return null;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp01(a)})`;
}

function getFactions(snap) {
  return (snap && Array.isArray(snap.factions)) ? snap.factions : [];
}

function computeTotalAndH(snap, cfg) {
  const factions = getFactions(snap);
  let total = 0;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > 0) total += m;
  }
  total = clamp(total, 0, clamp(cfg.maxTotalClamp ?? 2600, 200, 8000));
  const k = clamp(cfg.hypeK ?? 160, 40, 1000);
  const h = 1 - Math.exp(-total / k);
  return { total, h: clamp01(h) };
}

function getTopFaction(snap) {
  const factions = getFactions(snap);
  let best = null;
  let bestM = -1;
  for (const f of factions) {
    const m = Number(f?.meter) || 0;
    if (m > bestM) {
      bestM = m;
      best = f;
    }
  }
  return best && bestM > 0 ? best : null;
}

function getRandomFaction(snap) {
  const factions = getFactions(snap).filter(f => (Number(f?.meter) || 0) > 0);
  if (!factions.length) return null;
  return factions[(Math.random() * factions.length) | 0];
}

function pickBankPhrases(cfg, bankKey) {
  const map = {
    A: ['a1','a2','a3','a4','a5','a6'],
    B: ['b1','b2','b3','b4','b5','b6'],
    C: ['c1','c2','c3','c4','c5','c6']
  };
  const keys = map[bankKey] || [];
  const out = [];
  for (const k of keys) {
    const s = String(cfg?.[k] ?? '').trim();
    if (s) out.push(s);
  }
  return out;
}

function getEnabledPhrases(cfg) {
  const out = [];
  if (cfg.bankAEnabled) out.push(...pickBankPhrases(cfg, 'A'));
  if (cfg.bankBEnabled) out.push(...pickBankPhrases(cfg, 'B'));
  if (cfg.bankCEnabled) out.push(...pickBankPhrases(cfg, 'C'));
  return out;
}

export function init({ root, config, api }) {
  while (root.firstChild) root.removeChild(root.firstChild);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.overflow = 'hidden';
  container.style.transform = 'nudgeZ()';
  root.appendChild(container);

  function nudgeZ() {
    return 'translateZ(0)';
  }

  let cfg = { ...meta.defaultConfig, ...(config || {}) };

  let latestSnap = { factions: [] };
  let hTarget = 0;
  let hSmooth = 0;

  // spike detection
  let lastH = 0;
  let lastBigMomentAt = -999;

  const active = []; // moving words
  const maxNodesHard = 80;
  let spawnCarry = 0;

  const unsub = api.onMeters((snap) => {
    latestSnap = snap || { factions: [] };
    hTarget = computeTotalAndH(latestSnap, cfg).h;
  });

  let raf = 0;
  let lastMs = performance.now();
  let accMs = 0;

  function computeTintColor() {
    const mode = String(cfg.factionTintMode || 'off');
    if (mode === 'off') return null;

    const top = getTopFaction(latestSnap);
    const rnd = getRandomFaction(latestSnap);

    let chosen = null;
    if (mode === 'top') chosen = top;
    else if (mode === 'random') chosen = rnd;

    if (!chosen) return null;

    const rgb = hexToRgb(chosen.colorHex || chosen.color || chosen.hex);
    if (!rgb) return null;

    // tint alpha is scaled a bit by tintStrength
    const str = clamp01(cfg.tintStrength ?? 0.8);
    return rgbaFromRgb(rgb, 0.78 * str);
  }

  function chooseColorForWord() {
    const base = String(cfg.baseColor || 'rgba(255,255,255,0.92)');

    const tint = computeTintColor();
    if (!tint) return base;

    // Bias to top faction at higher hype
    const bias = clamp01(cfg.biasToTopFaction ?? 0.45);
    const p = clamp01(0.15 + 0.85 * hSmooth) * bias;

    // If tintMode is top: use tint most of the time at high hype
    // If random: sometimes keep base so it doesn't get too uniform
    if (Math.random() < p) return tint;
    return base;
  }

  function removeOldestIfNeeded() {
    const cap = clamp(cfg.maxActive ?? 22, 1, maxNodesHard);
    while (active.length > cap) {
      const old = active.shift();
      try { old?.el?.remove(); } catch {}
    }
    // ultimate safety
    while (active.length > maxNodesHard) {
      const old = active.shift();
      try { old?.el?.remove(); } catch {}
    }
  }

  function addWord({ phrase, x, y, size, life, vx, vy, isBig }) {
    removeOldestIfNeeded();

    const el = document.createElement('div');
    el.textContent = phrase;
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    el.style.transformOrigin = 'center';
    el.style.whiteSpace = 'nowrap';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';

    el.style.fontFamily = String(cfg.fontFamily || meta.defaultConfig.fontFamily);
    el.style.fontSize = `${size.toFixed(0)}px`;
    el.style.fontWeight = String(cfg.fontWeight ?? 900);
    el.style.letterSpacing = `${clamp(cfg.letterSpacingPx ?? 0.35, -2, 6)}px`;
    el.style.lineHeight = '1';

    const color = chooseColorForWord();
    el.style.color = color;

    const outlinePx = clamp(cfg.outlinePx ?? 3, 0, 14);
    const outlineA = clamp01(cfg.outlineAlpha ?? 0.58);
    const glow = clamp01(cfg.glowStrength ?? 0.75);
    const glowA = clamp01(cfg.glowAlpha ?? 0.25);

    const shadowParts = [];
    if (outlinePx > 0.1) {
      const o = outlinePx;
      const stroke = `rgba(0,0,0,${outlineA})`;
      shadowParts.push(
        `${-o}px 0 ${0}px ${stroke}`,
        `${o}px 0 ${0}px ${stroke}`,
        `0 ${-o}px ${0}px ${stroke}`,
        `0 ${o}px ${0}px ${stroke}`,
        `${-o}px ${-o}px ${0}px ${stroke}`,
        `${o}px ${-o}px ${0}px ${stroke}`,
        `${-o}px ${o}px ${0}px ${stroke}`,
        `${o}px ${o}px ${0}px ${stroke}`
      );
    }
    if (glow > 0.001) {
      const gBlur = (12 + 44 * glow) * (0.55 + 0.85 * hSmooth);
      shadowParts.push(
        `0 0 ${gBlur.toFixed(1)}px rgba(255,255,255,${(glowA * (0.55 + 0.85 * hSmooth)).toFixed(3)})`
      );
    }
    el.style.textShadow = shadowParts.join(', ');
    el.style.opacity = '0';

    if (isBig) {
      el.style.willChange = 'transform, opacity, filter';
      el.style.filter = 'saturate(1.15) contrast(1.15)';
    }

    container.appendChild(el);

    active.push({
      el,
      x, y,
      vx, vy,
      born: performance.now() / 1000,
      life,
      fadeIn: Math.min(0.18, life * 0.25),
      fadeOut: Math.min(0.32, life * 0.35),
      isBig: !!isBig
    });

    // keep DOM bounded
    if (active.length > maxNodesHard) {
      const old = active.shift();
      try { old?.el?.remove(); } catch {}
    }
  }

  function spawnNormal(nowS, w, h, phrases) {
    if (!phrases.length) return;

    const phrase = phrases[(Math.random() * phrases.length) | 0];

    const life = clamp(
      lerp(cfg.minLifeSec ?? 1.2, cfg.maxLifeSec ?? 3.1, Math.random()),
      0.5,
      12
    );

    const minPx = clamp(cfg.minFontPx ?? 18, 8, 220);
    const maxPx = clamp(cfg.maxFontPx ?? 64, minPx, 300);
    const size = lerp(minPx, maxPx, clamp01(0.22 + 0.60 * hSmooth + 0.25 * Math.random()));

    const margin = clamp(cfg.marginPx ?? 36, 0, 240);
    const topBias = clamp(cfg.safeTopBias ?? 0.12, 0, 0.35);

    const x = margin + Math.random() * Math.max(1, (w - margin * 2));
    const yMin = margin + h * topBias;
    const y = yMin + Math.random() * Math.max(1, (h - yMin - margin));

    const drift = clamp(cfg.driftPxPerSec ?? 32, 0, 520);
    const wander = clamp(cfg.wanderPxPerSec ?? 18, 0, 360);

    const vx = (Math.random() - 0.5) * wander * (0.35 + 0.9 * Math.random());
    const vy = -drift * (0.55 + 0.9 * Math.random());

    addWord({ phrase, x, y, size, life, vx, vy, isBig: false });
  }

  function triggerBigMoment(w, h) {
    if (!cfg.bigMomentEnabled) return;

    const nowS = performance.now() / 1000;
    const cd = clamp(cfg.bigMomentCooldownSec ?? 4.0, 0.5, 60);
    if (nowS - lastBigMomentAt < cd) return;

    const spike = clamp(cfg.bigMomentSpikeThreshold ?? 0.18, 0.05, 0.85);
    const dh = hSmooth - lastH;
    if (dh < spike) return;

    lastBigMomentAt = nowS;

    let phrase = String(cfg.bigMomentText || '').trim();
    if (!phrase) {
      const bank = String(cfg.bigMomentUseBank || 'any').toUpperCase();
      let phrases = [];
      if (bank === 'A') phrases = pickBankPhrases(cfg, 'A');
      else if (bank === 'B') phrases = pickBankPhrases(cfg, 'B');
      else if (bank === 'C') phrases = pickBankPhrases(cfg, 'C');
      else phrases = getEnabledPhrases(cfg);

      if (!phrases.length) return;
      phrase = phrases[(Math.random() * phrases.length) | 0];
    }

    const life = clamp(cfg.bigMomentLifeSec ?? 0.95, 0.35, 4.0);

    const minPx = clamp(cfg.minFontPx ?? 18, 8, 240);
    const maxPx = clamp(cfg.maxFontPx ?? 64, minPx, 320);

    const boost = clamp(cfg.bigMomentFontBoost ?? 1.35, 1.0, 2.5);
    const size = clamp(lerp(minPx, maxPx, clamp01(0.6 + 0.4 * hSmooth)) * boost, 12, 420);

    // center with slight random offset
    const x = w * 0.5 + (Math.random() - 0.5) * 40;
    const y = h * 0.42 + (Math.random() - 0.5) * 28;

    addWord({
      phrase,
      x,
      y,
      size,
      life,
      vx: (Math.random() - 0.5) * 10,
      vy: -18 - 22 * Math.random(),
      isBig: true
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

    // smooth hype
    const smooth = 0.14;
    hSmooth = lerp(hSmooth, hTarget, 1 - Math.exp(-(1 / smooth) * dt));
    hSmooth = clamp01(hSmooth);

    const rect = container.getBoundingClientRect();
    const w = rect.width || 1920;
    const h = rect.height || 1080;

    // Big moment check (before spawning)
    triggerBigMoment(w, h);

    // spawn
    const phrases = getEnabledPhrases(cfg);
    const base = clamp(cfg.baseSpawnPerSec ?? 0.55, 0, 40);
    const boost = clamp(cfg.boostSpawnPerSec ?? 6.25, 0, 80);

    const ramp = clamp01(0.12 + 0.88 * Math.pow(hSmooth, 0.85));
    const rate = base + boost * ramp;

    spawnCarry += rate * dt;
    const maxToSpawn = clamp(cfg.maxSpawnPerFrame ?? 5, 1, 10);
    let toSpawn = Math.min(maxToSpawn, Math.floor(spawnCarry));
    if (toSpawn > 0) spawnCarry -= toSpawn;

    for (let i = 0; i < toSpawn; i++) {
      spawnNormal(nowMs / 1000, w, h, phrases);
    }

    // update active
    const margin = clamp(cfg.marginPx ?? 36, 0, 240);

    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      const t = (nowMs / 1000) - a.born;

      if (t >= a.life) {
        try { a.el.remove(); } catch {}
        active.splice(i, 1);
        continue;
      }

      // motion
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // keep in frame
      if (a.x < margin) { a.x = margin; a.vx *= -0.7; }
      if (a.x > w - margin) { a.x = w - margin; a.vx *= -0.7; }

      // opacity envelope
      let op = 1;
      if (t < a.fadeIn) op = clamp01(t / a.fadeIn);
      const tail = a.life - t;
      if (tail < a.fadeOut) op = Math.min(op, clamp01(tail / a.fadeOut));

      // Big moment slam: quick scale-in then settle
      let scale = 1;
      if (a.isBig) {
        const p = clamp01(t / Math.max(0.001, a.fadeIn));
        const slam = 1.18 - 0.18 * p; // starts bigger, settles to 1
        scale = slam;
      } else {
        // subtle pulse
        scale = 1 + 0.02 * Math.sin((nowMs * 0.004) + i) * (0.25 + 0.75 * hSmooth);
      }

      a.el.style.opacity = op.toFixed(3);
      a.el.style.transform =
        `translate3d(${a.x.toFixed(2)}px, ${a.y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    }

    lastH = hSmooth;
  }

  function setConfig(next) {
    cfg = { ...cfg, ...(next || {}) };
    hTarget = computeTotalAndH(latestSnap, cfg).h;
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
