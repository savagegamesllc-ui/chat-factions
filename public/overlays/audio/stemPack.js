// public/overlays/audio/stemPack.js
// StemPack: PRO audio engine for reactive overlays
// - Loads up to N stems named: <PACK><001..N>.<ext>
// - Ext selection:
//    * options.fileExt: 'wav' (legacy; forces one ext)
//    * options.fileExts: ['ogg','mp3','wav'] (preferred; tries in order)
//    * default: ['ogg','mp3','wav']
// - API: createStemPack({ packId, baseUrl, options }) -> { start, setHype, setMasterVolume, destroy }

'use strict';

function clamp(n, a, b) { n = +n; return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function clamp01(n) { return clamp(n, 0, 1); }
function pad3(n) { return String(n).padStart(3, '0'); }

function normalizeBaseUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '/public/overlays/audio';
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function getAudioContext() {
  // Reuse one AudioContext across packs; OBS/Chromium behaves better.
  if (window.__CF_AUDIO_CTX && window.__CF_AUDIO_CTX.state !== 'closed') return window.__CF_AUDIO_CTX;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) throw new Error('WebAudio not supported');
  const ctx = new Ctor();
  window.__CF_AUDIO_CTX = ctx;
  return ctx;
}

async function resumeCtx(ctx) {
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
}

async function decode(ctx, arrayBuffer) {
  // decodeAudioData has callback + promise variants across Chromium builds
  return await new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(
        arrayBuffer.slice(0),
        (buf) => resolve(buf),
        (err) => reject(err || new Error('decodeAudioData failed'))
      );
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

async function tryFetchBuffer({ ctx, url, signal, debug }) {
  const res = await fetch(url, { cache: 'force-cache', signal });
  if (!res.ok) {
    if (debug) console.warn('[StemPack] fetch failed', res.status, url);
    throw new Error(`fetch ${res.status}: ${url}`);
  }
  const ab = await res.arrayBuffer();
  return await decode(ctx, ab);
}

function extCandidatesFromOptions(options) {
  // Legacy support
  const one = String(options?.fileExt || '').trim();
  if (one) return [one.toLowerCase()];

  // Preferred new option
  const many = options?.fileExts;
  if (Array.isArray(many) && many.length) {
    return many.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  }

  // Default order
  return ['ogg', 'mp3', 'wav'];
}

function defaultThresholds(maxStems) {
  // 1 always on; higher stems fade in as hype increases.
  // Keep these conservative so it feels “earned”.
  if (maxStems <= 1) return [0.0];
  if (maxStems === 2) return [0.0, 0.35];
  if (maxStems === 3) return [0.0, 0.25, 0.55];
  if (maxStems === 4) return [0.0, 0.20, 0.45, 0.70];
  return [0.0, 0.20, 0.40, 0.65, 0.85];
}

export async function createStemPack({ packId, baseUrl, options } = {}) {
  const id = String(packId || '').trim();
  if (!id) throw new Error('createStemPack requires packId');

  const opts = options || {};
  const maxStems = Math.max(1, Math.min(5, (opts.maxStems ?? 5) | 0));
  const base = normalizeBaseUrl(baseUrl);

  const thresholds = Array.isArray(opts.thresholds) && opts.thresholds.length
    ? opts.thresholds.map((x) => clamp01(x))
    : defaultThresholds(maxStems);

  const fadeInMs = clamp(opts.fadeInMs ?? 350, 30, 4000);
  const fadeOutMs = clamp(opts.fadeOutMs ?? 600, 30, 6000);
  const loop = opts.loop !== false; // default true
  const masterVolume = clamp(opts.masterVolume ?? 0.7, 0, 1);
  const stopAtFirstMissing = opts.stopAtFirstMissing !== false; // default true
  const debug = !!opts.debug;

  const exts = extCandidatesFromOptions(opts);
  if (debug) console.log('[StemPack] ext candidates:', exts);

  const ctx = getAudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(ctx.destination);

  // Per-stem
  const stemGains = [];
  const buffers = [];
  const sources = [];
  let startedAt = 0;
  let destroyed = false;

  let hype = 0;

  const abort = new AbortController();

  function makeUrl(stemIndex1Based, ext) {
    const filename = `${id}${pad3(stemIndex1Based)}.${ext}`;
    return `${base}/${filename}`;
  }

  async function loadOneStem(i1) {
    // Try each extension until one decodes successfully.
    let lastErr = null;
    for (const ext of exts) {
      const url = makeUrl(i1, ext);
      try {
        const buf = await tryFetchBuffer({ ctx, url, signal: abort.signal, debug });
        if (debug) console.log('[StemPack] loaded', url, buf?.duration);
        return buf;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error(`Unable to load stem ${i1}`);
  }

  async function loadAll() {
    // Load sequentially if stopAtFirstMissing, else parallel best-effort.
    if (stopAtFirstMissing) {
      for (let i = 1; i <= maxStems; i++) {
        buffers[i - 1] = await loadOneStem(i);
      }
      return;
    }

    // Best-effort parallel
    const ps = [];
    for (let i = 1; i <= maxStems; i++) {
      ps.push(
        loadOneStem(i)
          .then((buf) => { buffers[i - 1] = buf; })
          .catch((e) => {
            buffers[i - 1] = null;
            if (debug) console.warn('[StemPack] stem missing', i, e);
          })
      );
    }
    await Promise.all(ps);

    // At least stem 1 must exist to be usable
    if (!buffers[0]) throw new Error('Stem 001 missing; cannot start pack');
  }

  function buildGraph() {
    for (let i = 0; i < maxStems; i++) {
      const g = ctx.createGain();
      g.gain.value = 0; // we’ll ramp based on hype
      g.connect(masterGain);
      stemGains[i] = g;
    }
  }

  function desiredGainForStem(i /*0-based*/, h01) {
    // Stem 0 always on (but still affected by master volume)
    if (i === 0) return 1;

    const t = thresholds[i] ?? clamp01(i / Math.max(1, (maxStems - 1)));
    // smooth-ish ramp around threshold (avoid “hard steps”)
    const w = 0.12; // width of transition band
    const x = (h01 - (t - w)) / (2 * w);
    const s = clamp01(x);
    // cubic smoothstep
    return s * s * (3 - 2 * s);
  }

  function rampGain(gainNode, target, ms) {
    const now = ctx.currentTime;
    const t = now + Math.max(0.001, ms / 1000);
    try {
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(target, t);
    } catch {}
  }

  function applyHype(h01) {
    const h = clamp01(h01);
    hype = h;

    for (let i = 0; i < stemGains.length; i++) {
      const g = stemGains[i];
      const desired = desiredGainForStem(i, h);

      // Decide fade direction for timing
      const current = g.gain.value;
      const isUp = desired >= current;
      rampGain(g, desired, isUp ? fadeInMs : fadeOutMs);
    }
  }

  function startSources() {
    // Start all stems at the same time for tight sync
    startedAt = ctx.currentTime + 0.05;

    for (let i = 0; i < maxStems; i++) {
      const buf = buffers[i];
      if (!buf) continue;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = !!loop;
      src.connect(stemGains[i]);

      src.start(startedAt);
      sources[i] = src;
    }

    applyHype(hype);
  }

  async function start() {
    if (destroyed) return;
    await resumeCtx(ctx);

    // Build gains before loading so we can “warm” structure.
    if (!stemGains.length) buildGraph();

    // Load + decode
    await loadAll();

    // Start playback
    startSources();
  }

  function setHype(h01) {
    if (destroyed) return;
    applyHype(h01);
  }

  function setMasterVolume(v) {
    if (destroyed) return;
    masterGain.gain.value = clamp(v, 0, 1);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    try { abort.abort(); } catch {}

    for (const src of sources) {
      try { src?.stop?.(); } catch {}
      try { src?.disconnect?.(); } catch {}
    }
    for (const g of stemGains) {
      try { g?.disconnect?.(); } catch {}
    }
    try { masterGain.disconnect(); } catch {}
  }

  // Back-compat: some older overlay code may call stop()
  function stop() { destroy(); }

  return { start, setHype, setMasterVolume, destroy, stop };
}
