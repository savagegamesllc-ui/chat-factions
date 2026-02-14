// public/overlays/styles/photonWords.js
// Photon Words (PRO) — off-screen lasers “write” words into the scene based on hype thresholds + events.
// Update: Added user-facing beam configs (strength/alpha/glow/length/duration + linger).

export const meta = {
  tier: 'PRO',
  styleKey: 'photonWords',
  name: 'Photon Words',
  description: 'Off-screen laser beams write hype + event words that glow, spark, then cool and fade.',
  supports: ['canvas'],
  defaultConfig: {
    // Triggering
    hype_thresholds: '15,20',
    hype_edgeTriggerCooldownMs: 1400,

    // Words
    hype_words_low: 'HYPE,LET’S GO,OK OK',
    bits_word: 'CHEERS',
    subs_word: 'THANK YOU',
    max_words: 'LETS GO CHAT,GG,Hack the planet!',

    // Placement + sizing behavior
    low_edgeInsetPct: 6,
    max_edgeInsetPct: 22,
    low_scale: 0.72,
    mid_scale: 1.05,
    max_scale: 1.45,

    // Visual flavor
    glow_strength: 'mid',     // low | mid | high
    sparks: 'mid',            // off | low | mid | high
    laser_thickness: 'mid',   // thin | mid | thick
    laser_perspective: 'mid', // low | mid | high

    // NEW: Beam controls
    beam_strength: 'mid',     // low | mid | high (overall visibility multiplier)
    beam_alpha: 1.0,          // 0.1..1.0 (core alpha scaling)
    beam_glow: 'mid',         // low | mid | high (shadow blur scaling)
    beam_length: 'full',      // full | mid | short (draw entire origin->head, or shorten for “closer emitter” feel)
    beam_linger_ms: 0,        // 0..1200 keeps a faint beam after write ends (ms)

    // NEW: Beam timing (duration stuff)
    beam_write_speed: 'mid',  // slow | mid | fast (affects write head progression; independent of fade)
    beam_duration_ms: 0,      // 0 disables override. If >0, forces write duration (ms) for all words.

    // Cooling / fade
    fade_speed: 'mid',        // quick | mid | slow

    // Font
    font_family: 'system-ui, Segoe UI, Arial, sans-serif',
    font_weight: 800,

    // Demo / preview
    demo_noDataMs: 250,
    demo_cycleSeconds: 12,
    demo_lowMeter: 0,
    demo_maxMeter: 70
  },

  controls: [
    { key: 'hype_thresholds', label: 'Hype Thresholds', type: 'text', help: 'Comma-separated hype points that trigger laser words (e.g., 15,20,30).' },
    { key: 'hype_words_low', label: 'Hype Words (Low/Mid)', type: 'text', help: 'Comma-separated list used for hype threshold triggers.' },
    { key: 'bits_word', label: 'Bits Word', type: 'text', help: 'Word written when bits/cheers happen.' },
    { key: 'subs_word', label: 'Subs Word', type: 'text', help: 'Word written when a sub event happens.' },
    { key: 'max_words', label: 'Max Hype Words', type: 'text', help: 'Comma-separated list used at max hype. Defaults to 3 options.' },

    { key: 'fade_speed', label: 'Fade Speed', type: 'select', options: ['quick', 'mid', 'slow'] },
    { key: 'glow_strength', label: 'Glow Strength', type: 'select', options: ['low', 'mid', 'high'] },
    { key: 'sparks', label: 'Sparks', type: 'select', options: ['off', 'low', 'mid', 'high'] },
    { key: 'laser_thickness', label: 'Laser Thickness', type: 'select', options: ['thin', 'mid', 'thick'] },
    { key: 'laser_perspective', label: 'Laser Perspective', type: 'select', options: ['low', 'mid', 'high'] },

    // NEW beam controls
    { key: 'beam_strength', label: 'Beam Strength', type: 'select', options: ['low', 'mid', 'high'], help: 'Overall laser visibility multiplier.' },
    { key: 'beam_alpha', label: 'Beam Alpha', type: 'range', min: 0.1, max: 1.0, step: 0.05, help: 'Core laser opacity.' },
    { key: 'beam_glow', label: 'Beam Glow', type: 'select', options: ['low', 'mid', 'high'], help: 'Controls how strong the beam bloom looks.' },
    { key: 'beam_length', label: 'Beam Length', type: 'select', options: ['full', 'mid', 'short'], help: 'Shorter beams feel like a closer emitter.' },
    { key: 'beam_linger_ms', label: 'Beam Linger (ms)', type: 'range', min: 0, max: 1200, step: 25, help: 'Keeps a faint beam after writing finishes.' },

    { key: 'beam_write_speed', label: 'Beam Write Speed', type: 'select', options: ['slow', 'mid', 'fast'], help: 'How quickly the beam writes the word.' },
    { key: 'beam_duration_ms', label: 'Beam Duration Override (ms)', type: 'range', min: 0, max: 4000, step: 50, help: 'If set, forces beam write duration for all words.' },

    { key: 'low_edgeInsetPct', label: 'Low Edge Inset %', type: 'number', min: 0, max: 40, step: 1 },
    { key: 'max_edgeInsetPct', label: 'Max Edge Inset %', type: 'number', min: 0, max: 40, step: 1 },
    { key: 'low_scale', label: 'Low Scale', type: 'number', min: 0.4, max: 2.5, step: 0.05 },
    { key: 'mid_scale', label: 'Mid Scale', type: 'number', min: 0.4, max: 2.5, step: 0.05 },
    { key: 'max_scale', label: 'Max Scale', type: 'number', min: 0.4, max: 2.5, step: 0.05 },

    { key: 'font_family', label: 'Font Family', type: 'text' },
    { key: 'font_weight', label: 'Font Weight', type: 'number', min: 100, max: 900, step: 50 }
  ]
};

export function init({ root, config, api }) {
  const cfg = { ...meta.defaultConfig, ...(config || {}) };

  // Coordinates in CSS pixels
  let viewW = 1920;
  let viewH = 1080;

  // Layer order (bottom -> top): heat, text, laser
  const { wrap, canvases } = ensureContainerAndCanvases(root, meta.styleKey, 3, [
    { z: 1, name: 'heat' },
    { z: 2, name: 'text' },
    { z: 3, name: 'laser' }
  ]);

  const cHeat  = canvases[0];
  const cText  = canvases[1];
  const cLaser = canvases[2];

  const gHeat  = cHeat.getContext('2d', { alpha: true });
  const gText  = cText.getContext('2d', { alpha: true });
  const gLaser = cLaser.getContext('2d', { alpha: true });

  let raf = 0;
  let destroyed = false;

  let hasEverReceivedMeters = false;
  let lastMeterAt = 0;

  let leader = { idx: 0, rgb: [255, 255, 255] };
  let hNow = 0;
  let hTarget = 0;

  let lastTotal = 0;
  let lastEdgeTriggerAt = 0;

  const words = [];
  const MAX_ACTIVE_WORDS = 12;

  api.onMeters?.((packet) => {
    try {
      hasEverReceivedMeters = true;
      lastMeterAt = performance.now();

      const arr = (packet?.factions || packet?.meters || []);
      if (!Array.isArray(arr) || arr.length === 0) return;

      let total = 0;
      let best = null;
      for (let i = 0; i < arr.length; i++) {
        const m = Math.max(0, Number(arr[i]?.meter || 0));
        total += m;
        if (!best || m > best.m) best = { i, m, c: arr[i]?.rgb, hex: arr[i]?.colorHex };
      }

      const rgb = coerceRgb(best?.c, best?.hex) || [255, 255, 255];
      leader = { idx: best?.i ?? 0, rgb };

      const k = 220;
      hTarget = clamp01(1 - Math.exp(-total / k));

      handleThresholdCrossings(total);
      lastTotal = total;
    } catch {}
  });

  hookEventsIfPresent(api, {
    onBits: () => spawnWord(pickSingle(cfg.bits_word, 'CHEERS'), 'bits'),
    onSub: () => spawnWord(pickSingle(cfg.subs_word, 'THANK YOU'), 'sub')
  });

  function applyDemoIfStale(nowMs) {
    const noDataMs = clamp(Number(cfg.demo_noDataMs || 250), 200, 20000);
    const stale = !hasEverReceivedMeters || (nowMs - lastMeterAt > noDataMs);
    if (!stale) return;

    const cycle = clamp(Number(cfg.demo_cycleSeconds || 12), 4, 60);
    const phase = (nowMs / 1000) % cycle;
    const half = cycle / 2;

    let t = phase < half ? (phase / half) : ((phase - half) / half);
    const isMax = phase >= half;
    t = t * t * (3 - 2 * t);

    const low = clamp(Number(cfg.demo_lowMeter || 0), 0, 5000);
    const high = clamp(Number(cfg.demo_maxMeter || 70), low, 8000);
    const total = isMax ? lerp(low, high, t) : lerp(high, low, t);

    const demoRgb = hsvToRgb(((nowMs / 1000) * 0.08) % 1, 0.85, 1.0);
    leader = { idx: 0, rgb: demoRgb };

    const k = 220;
    hTarget = clamp01(1 - Math.exp(-total / k));

    handleThresholdCrossings(total, true);
    lastTotal = total;
  }

  function handleThresholdCrossings(total, isDemo = false) {
    const thresholds = parseNumberList(cfg.hype_thresholds, [15, 20]);
    if (!thresholds.length) return;

    const now = performance.now();
    const cd = clamp(Number(cfg.hype_edgeTriggerCooldownMs || 1400), 200, 10000);
    if (now - lastEdgeTriggerAt < cd) return;

    const prev = lastTotal;
    for (const th of thresholds) {
      if (prev < th && total >= th) {
        lastEdgeTriggerAt = now;
        spawnHypeWord(total);
        break;
      }
    }

    if (isDemo && words.length < 2 && Math.random() < 0.006) {
      lastEdgeTriggerAt = now;
      spawnHypeWord(total);
    }
  }

  function spawnHypeWord(total) {
    const h01 = hype01FromTotal(total);
    const atMax = h01 > 0.92;

    if (atMax) {
      const picks = pickList(cfg.max_words, ['LETS GO CHAT', 'GG', 'Hack the planet!']);
      spawnWord(picks[(Math.random() * picks.length) | 0] || 'LETS GO CHAT', 'max');
      return;
    }

    const low = pickList(cfg.hype_words_low, ['HYPE', 'LET’S GO', 'OK OK']);
    spawnWord(low[(Math.random() * low.length) | 0] || 'HYPE', 'hype');
  }

  function spawnWord(text, kind) {
    if (!text) return;
    while (words.length >= MAX_ACTIVE_WORDS) words.shift();

    const W = viewW;
    const H = viewH;
    if (!W || !H) return;

    const h01 = hNow;

    const edgeInsetPct = lerp(
      clamp(Number(cfg.low_edgeInsetPct || 6), 0, 40),
      clamp(Number(cfg.max_edgeInsetPct || 22), 0, 40),
      clamp01(h01)
    );
    const edgeInset = (Math.min(W, H) * edgeInsetPct) / 100;

    const side = Math.random() < 0.5 ? 'left' : 'right';
    const baseX = side === 'left' ? edgeInset : (W - edgeInset);

    const inward = lerp(0, Math.min(W, H) * 0.18, clamp01(h01));
    const x = side === 'left'
      ? baseX + inward * randRange(0.2, 1.0)
      : baseX - inward * randRange(0.2, 1.0);

    const y = clamp(randRange(H * 0.18, H * 0.82), edgeInset, H - edgeInset);
    const scale = pickScaleForHype(h01);

    const persp = mapSelect(cfg.laser_perspective, { low: 0.65, mid: 1.0, high: 1.35 }, 1.0);
    const origin = pickLaserOrigin(W, H, side, persp);

    const jitterSeed = (Math.random() * 1e9) | 0;

    // NEW: per-word linger bookkeeping (beam can persist briefly after write)
    words.push({
      text: String(text),
      kind,
      bornMs: performance.now(),
      x, y,
      scale,
      w: 0, h: 0,
      progress01: 0,
      phase: 'write',
      doneAtMs: 0,
      origin,
      jitterSeed,
      sparks: [],
      lastHead: { x, y },
      beamGoneAtMs: 0
    });
  }

  let lastT = performance.now();

  function frame(now) {
    if (destroyed) return;

    applyDemoIfStale(now);

    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;

    const smooth = 1 - Math.pow(0.0007, dt);
    hNow = hNow + (hTarget - hNow) * smooth;

    const { wCss, hCss } = resizeAllCanvases(wrap, canvases);
    viewW = wCss;
    viewH = hCss;

    // Clear layers
    coolHeat(gHeat, wCss, hCss, dt);
    clearText(gText, wCss, hCss);
    clearLaser(gLaser, wCss, hCss);

    const col = leader.rgb;

    // Existing look controls
    const glowK = mapSelect(cfg.glow_strength, { low: 0.7, mid: 1.0, high: 1.35 }, 1.0);
    const thick = mapSelect(cfg.laser_thickness, { thin: 0.85, mid: 1.1, thick: 1.5 }, 1.1);
    const sparksK = mapSelect(cfg.sparks, { off: 0, low: 0.55, mid: 1.0, high: 1.6 }, 1.0);
    const fadeT = mapSelect(cfg.fade_speed, { quick: 1.15, mid: 2.25, slow: 3.8 }, 2.25);

    // NEW: beam configs
    const beamStrengthK = mapSelect(cfg.beam_strength, { low: 0.7, mid: 1.0, high: 1.35 }, 1.0);
    const beamGlowK = mapSelect(cfg.beam_glow, { low: 0.75, mid: 1.0, high: 1.35 }, 1.0);
    const beamAlpha = clamp(Number(cfg.beam_alpha ?? 1.0), 0.1, 1.0);
    const beamLenMode = String(cfg.beam_length || 'full').toLowerCase().trim();
    const beamLenK = beamLenMode === 'short' ? 0.55 : (beamLenMode === 'mid' ? 0.78 : 1.0);
    const beamLingerMs = clamp(Number(cfg.beam_linger_ms || 0), 0, 1200);

    const speedMode = String(cfg.beam_write_speed || 'mid').toLowerCase().trim();
    const speedK = speedMode === 'fast' ? 1.35 : (speedMode === 'slow' ? 0.78 : 1.0);
    const forcedDur = clamp(Number(cfg.beam_duration_ms || 0), 0, 4000);

    const fontPxBase = Math.max(18, Math.min(wCss, hCss) * 0.065);
    const font = (scale) => `${cfg.font_weight || 800} ${Math.round(fontPxBase * scale)}px ${cfg.font_family || 'system-ui, Arial'}`;

    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];

      // Measure text
      gText.save();
      gText.font = font(w.scale);
      gText.textAlign = 'center';
      gText.textBaseline = 'middle';
      const metrics = gText.measureText(w.text);
      const textW = metrics.width;
      const textH = Math.max(20, (metrics.actualBoundingBoxAscent || 18) + (metrics.actualBoundingBoxDescent || 6));
      w.w = textW;
      w.h = textH;
      gText.restore();

      // Write duration: either forced override, or derived from length; speedK scales it.
      const len = Math.max(2, w.text.length);
      const derivedWriteDur = clamp(0.55 + (len / 16) * 0.55, 0.55, 2.0) * lerp(1.1, 0.75, clamp01(hNow));
      const writeDur = forcedDur > 0 ? (forcedDur / 1000) : (derivedWriteDur / speedK);
      const writeRate = 1 / Math.max(0.18, writeDur);

      if (w.phase === 'write') {
        w.progress01 = clamp01(w.progress01 + dt * writeRate);
        if (w.progress01 >= 1) {
          w.phase = 'cool';
          w.doneAtMs = now;
          w.beamGoneAtMs = now + beamLingerMs;
        }
      } else {
        const age = (now - w.doneAtMs) / 1000;
        if (age > fadeT) {
          words.splice(i, 1);
          continue;
        }
      }

      // Head position
      const left = w.x - textW / 2;
      const right = w.x + textW / 2;
      const headX = lerp(left, right, w.progress01);
      const headY = w.y + laserJitter(now, w.jitterSeed, 0.9 + 0.6 * hNow);
      w.lastHead.x = headX;
      w.lastHead.y = headY;

      // Beam endpoints (optionally shortened)
      // If shortened, we bring the origin closer along the line so it looks like a nearer emitter.
      const a = w.origin;
      const b = { x: headX, y: headY };
      const drawA = shortenOriginTowardHead(a, b, beamLenK);

      // Beam visibility:
      // - during write: full alpha
      // - during linger: fades out quickly
      let beamA = 1;
      if (w.phase !== 'write' && beamLingerMs > 0) {
        const rem = clamp01((w.beamGoneAtMs - now) / beamLingerMs);
        beamA = rem * rem;
      } else if (w.phase !== 'write' && beamLingerMs === 0) {
        beamA = 0;
      }

      if (beamA > 0.001) {
        drawLaserBeam(
          gLaser,
          drawA,
          b,
          col,
          glowK * beamGlowK,
          thick,
          beamStrengthK,
          beamAlpha * beamA
        );
      }

      if (w.phase === 'write' && sparksK > 0) {
        maybeSpawnSparks(w, headX, headY, sparksK, hNow);
      }
      updateAndDrawSparks(gLaser, w, col, dt, glowK);

      // Heat + text
      drawHeatTrail(gHeat, w, col, glowK, font(w.scale));
      drawWrittenText(gText, gHeat, w, col, glowK, font(w.scale), now, fadeT);
    }

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  const ro = new ResizeObserver(() => resizeAllCanvases(wrap, canvases));
  ro.observe(wrap);

  return {
    destroy() {
      destroyed = true;
      try { cancelAnimationFrame(raf); } catch {}
      try { ro.disconnect(); } catch {}
      try { wrap.remove(); } catch {}
    }
  };

  // ===== Helpers =====

  function shortenOriginTowardHead(a, b, k) {
    k = clamp01(k);
    if (k >= 0.999) return a;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return { x: b.x - dx * k, y: b.y - dy * k };
  }

  function drawHeatTrail(ctx, word, rgb, glowK, font) {
    if (word.phase !== 'write') return;

    const textW = word.w || 10;
    const textH = word.h || 20;

    const writeClipW = textW * clamp01(word.progress01);
    const clipL = (word.x - textW / 2);
    const clipT = (word.y - textH / 2) - 8;
    const clipH = textH + 16;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.beginPath();
    ctx.rect(clipL, clipT, writeClipW, clipH);
    ctx.clip();

    ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.22)`;
    ctx.shadowBlur = 28 * glowK;
    ctx.lineWidth = 5.2 * glowK;
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.12)`;
    ctx.strokeText(word.text, word.x, word.y);

    ctx.restore();
  }

  function drawWrittenText(ctxText, ctxHeat, word, rgb, glowK, font, now, fadeT) {
    const laserSoft = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.20)`;

    const textW = word.w || 10;
    const textH = word.h || 20;

    const writeClipW = textW * clamp01(word.progress01);
    const clipL = (word.x - textW / 2);
    const clipT = (word.y - textH / 2) - 8;
    const clipH = textH + 16;

    let coolA = 1;
    if (word.phase === 'cool') {
      const age = (now - word.doneAtMs) / 1000;
      coolA = clamp01(1 - age / fadeT);
      coolA = coolA * coolA;
    }

    ctxText.save();
    ctxText.globalCompositeOperation = 'lighter';
    ctxText.font = font;
    ctxText.textAlign = 'center';
    ctxText.textBaseline = 'middle';

    ctxText.beginPath();
    ctxText.rect(clipL, clipT, writeClipW, clipH);
    ctxText.clip();

    ctxText.shadowColor = laserSoft;
    ctxText.shadowBlur = 22 * glowK;
    ctxText.lineJoin = 'round';
    ctxText.lineCap = 'round';
    ctxText.lineWidth = 6.5 * glowK;
    ctxText.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.20 * coolA})`;
    ctxText.strokeText(word.text, word.x, word.y);

    ctxText.shadowBlur = 12 * glowK;
    ctxText.lineWidth = 3.0 * glowK;
    ctxText.strokeStyle = `rgba(255,210,60,${0.55 * coolA})`;
    ctxText.strokeText(word.text, word.x, word.y);

    ctxText.shadowBlur = 9 * glowK;
    ctxText.lineWidth = 2.1 * glowK;
    ctxText.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.85 * coolA})`;
    ctxText.strokeText(word.text, word.x, word.y);

    ctxText.shadowBlur = 16 * glowK;
    ctxText.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.10 * coolA})`;
    ctxText.fillText(word.text, word.x, word.y);

    ctxText.restore();

    if (word.phase === 'cool' && coolA > 0.05) {
      ctxHeat.save();
      ctxHeat.globalCompositeOperation = 'lighter';
      ctxHeat.font = font;
      ctxHeat.textAlign = 'center';
      ctxHeat.textBaseline = 'middle';

      ctxHeat.beginPath();
      ctxHeat.rect(clipL, clipT, textW, clipH);
      ctxHeat.clip();

      ctxHeat.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.25 * coolA})`;
      ctxHeat.shadowBlur = 26 * glowK;
      ctxHeat.lineWidth = 4.8 * glowK;
      ctxHeat.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.08 * coolA})`;
      ctxHeat.strokeText(word.text, word.x, word.y);

      ctxHeat.restore();
    }
  }

  function drawLaserBeam(ctx, a, b, rgb, glowK, thickK, strengthK, alphaK) {
    // strengthK scales beam width + glow a bit
    const s = Math.max(0.25, strengthK);

    const coreW = (1.4 + 1.7 * thickK) * glowK * s;
    const softW = (7.0 + 10.0 * thickK) * glowK * s;

    const core = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.98 * alphaK})`;
    const soft = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.34 * alphaK})`;
    const gold = `rgba(255, 210, 60, ${0.62 * alphaK})`;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.shadowColor = soft;
    ctx.shadowBlur = 34 * glowK * s;
    ctx.lineWidth = softW;
    ctx.strokeStyle = soft;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.shadowColor = gold;
    ctx.shadowBlur = 18 * glowK * s;
    ctx.lineWidth = (coreW + 2.8) * 1.05;
    ctx.strokeStyle = gold;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.shadowColor = core;
    ctx.shadowBlur = 12 * glowK * s;
    ctx.lineWidth = coreW;
    ctx.strokeStyle = core;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.shadowBlur = 24 * glowK * s;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.4 * thickK * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function maybeSpawnSparks(word, x, y, sparksK, h01) {
    const p = 0.075 * sparksK * (0.55 + 0.75 * h01);
    if (Math.random() > p) return;

    const count = 1 + ((Math.random() * (2 + 2 * sparksK)) | 0);
    for (let i = 0; i < count; i++) {
      const ang = randRange(-Math.PI * 0.9, Math.PI * 0.9);
      const spd = randRange(90, 260) * (0.75 + sparksK * 0.35);
      word.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: randRange(0.10, 0.26) * (0.9 + 0.2 * sparksK),
        age: 0,
        r: randRange(1.1, 2.2) * (0.9 + 0.25 * sparksK)
      });
    }
  }

  function updateAndDrawSparks(ctx, word, rgb, dt, glowK) {
    if (!word.sparks || word.sparks.length === 0) return;

    const core = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`;
    const gold = `rgba(255, 210, 60, 0.95)`;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = word.sparks.length - 1; i >= 0; i--) {
      const s = word.sparks[i];
      s.age += dt;
      if (s.age >= s.life) {
        word.sparks.splice(i, 1);
        continue;
      }

      s.vy += 420 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const a = 1 - (s.age / s.life);
      const a2 = a * a;

      ctx.shadowBlur = 18 * glowK;
      ctx.shadowColor = core;

      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.40 * a2})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 2.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 10 * glowK;
      ctx.shadowColor = gold;

      ctx.fillStyle = `rgba(255, 210, 60, ${0.70 * a2})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 1.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 6 * glowK;
      ctx.shadowColor = core;

      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.98 * a2})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function clearLaser(ctx, w, h) { ctx.clearRect(0, 0, w, h); }
  function clearText(ctx, w, h)  { ctx.clearRect(0, 0, w, h); }
  function coolHeat(ctx, w, h, dt) {
    const fadeK = mapSelect(cfg.fade_speed, { quick: 0.22, mid: 0.12, slow: 0.075 }, 0.12);
    const a = clamp01(fadeK * (dt / (1 / 60)));
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function pickScaleForHype(h01) {
    const low = clamp(Number(cfg.low_scale || 0.72), 0.4, 3);
    const mid = clamp(Number(cfg.mid_scale || 1.05), 0.4, 3);
    const max = clamp(Number(cfg.max_scale || 1.45), 0.4, 3);

    if (h01 < 0.35) return lerp(low, mid, h01 / 0.35);
    if (h01 < 0.85) return lerp(mid, max, (h01 - 0.35) / 0.50);
    return max;
  }

  function pickLaserOrigin(W, H, side, persp) {
    const pad = Math.max(W, H) * (0.22 * persp);
    const fromLeft = side === 'left';

    const ox = fromLeft ? -pad : (W + pad);
    const oy = clamp(randRange(-pad * 0.35, H + pad * 0.35), -pad, H + pad);

    const bias = (fromLeft ? -1 : 1) * randRange(-H * 0.10, H * 0.10) * (0.6 * persp);
    return { x: ox, y: oy + bias };
  }

  function laserJitter(nowMs, seed, amp) {
    const t = nowMs / 1000;
    const r1 = fract(Math.sin((seed * 0.000001 + 1) * 123.45) * 9876.543);
    const r2 = fract(Math.sin((seed * 0.000002 + 7) * 77.77) * 3333.111);
    const f1 = 3.5 + r1 * 2.2;
    const f2 = 7.0 + r2 * 3.1;
    return (Math.sin(t * f1) * 0.9 + Math.sin(t * f2) * 0.45) * (2.0 * amp);
  }

  function hype01FromTotal(total) {
    const k = 220;
    return clamp01(1 - Math.exp(-Math.max(0, total) / k));
  }
}

// =========================
// Runtime compatibility bits
// =========================

function hookEventsIfPresent(api, handlers) {
  const bitsHandler = () => handlers.onBits?.();
  const subHandler = () => handlers.onSub?.();

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

// =========================
// DOM + canvas scaffolding
// =========================

function ensureContainerAndCanvases(root, styleKey, count, layerDefs) {
  const wrap = document.createElement('div');
  wrap.className = `cf-wrap cf-${styleKey}`;
  Object.assign(wrap.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none'
  });

  const canvases = [];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('canvas');
    const def = layerDefs?.[i] || { z: 1 + i };
    c.className = `cf-canvas cf-${styleKey}-layer${i}`;
    Object.assign(c.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: String(def.z ?? (1 + i))
    });
    wrap.appendChild(c);
    canvases.push(c);
  }

  root.innerHTML = '';
  root.appendChild(wrap);

  resizeAllCanvases(wrap, canvases);

  return { wrap, canvases };
}

function resizeAllCanvases(wrap, canvases) {
  const rect = wrap.getBoundingClientRect();
  const wCss = Math.max(1, rect.width);
  const hCss = Math.max(1, rect.height);

  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);

  for (const c of canvases) {
    const w = Math.max(1, Math.round(wCss * dpr));
    const h = Math.max(1, Math.round(hCss * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  return { wCss, hCss, dpr };
}

// =========================
// Small utilities
// =========================

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clamp01(v) { return clamp(v, 0, 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function randRange(a, b) { return a + Math.random() * (b - a); }
function fract(x) { return x - Math.floor(x); }

function mapSelect(val, map, fallback) {
  const k = String(val || '').toLowerCase().trim();
  return (k in map) ? map[k] : fallback;
}

function parseNumberList(v, fallback = []) {
  if (Array.isArray(v)) {
    const out = v.map(Number).filter((n) => Number.isFinite(n));
    return out.length ? out : fallback;
  }
  const s = String(v || '').trim();
  if (!s) return fallback;
  const out = s
    .split(',')
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return out.length ? out : fallback;
}

function pickList(v, fallback) {
  if (Array.isArray(v)) return v.length ? v : fallback;
  const s = String(v || '').trim();
  if (!s) return fallback;
  const out = s.split(',').map((x) => String(x).trim()).filter(Boolean);
  return out.length ? out : fallback;
}

function pickSingle(v, fallback) {
  const s = String(v || '').trim();
  return s ? s : fallback;
}

function coerceRgb(maybeRgb, maybeHex) {
  if (Array.isArray(maybeRgb) && maybeRgb.length >= 3) {
    const r = clamp(Number(maybeRgb[0]), 0, 255);
    const g = clamp(Number(maybeRgb[1]), 0, 255);
    const b = clamp(Number(maybeRgb[2]), 0, 255);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
  }
  const hex = String(maybeHex || '').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
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
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
