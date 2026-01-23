// public/js/streamer/styleControls.js
'use strict';

/**
 * Reads the selected layout's styleKey from #selectedLayoutMeta[data-style-key],
 * dynamically imports /public/overlays/styles/<styleKey>.js, reads export `meta.controls`,
 * renders a form, and syncs into the override JSON textarea.
 *
 * This keeps templates clean and uses the style module as source of truth.
 */

const elMeta = document.getElementById('selectedLayoutMeta');
const elControls = document.getElementById('styleControls');
const elOverride = document.getElementById('overrideJson');

function clampNum(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function safeParse(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return { __parseError: true }; }
}

function setHelp(msg, isError) {
  if (!elControls) return;
  let el = document.getElementById('styleControlsHelp');
  if (!el) {
    el = document.createElement('div');
    el.id = 'styleControlsHelp';
    el.style.margin = '6px 0';
    el.style.fontSize = '12px';
    elControls.prepend(el);
  }
  el.textContent = msg || '';
  el.style.color = isError ? '#b00020' : '#444';
}

function toInputValue(v, type) {
  if (type === 'checkbox') return Boolean(v);
  if (type === 'number') return Number.isFinite(Number(v)) ? String(v) : '';
  if (type === 'color') return String(v || '#ffffff');
  return String(v ?? '');
}

function normalizeValueFromInput(ctrl, inputEl) {
  const t = ctrl.type;

  if (t === 'checkbox') return Boolean(inputEl.checked);

  if (t === 'number') {
    const min = (ctrl.min != null) ? Number(ctrl.min) : -1e12;
    const max = (ctrl.max != null) ? Number(ctrl.max) :  1e12;
    const fallback = (ctrl.default != null) ? Number(ctrl.default) : 0;
    return clampNum(inputEl.value, min, max, fallback);
  }

  if (t === 'color') {
    const val = String(inputEl.value || '').trim();
    return val.startsWith('#') ? val : `#${val}`;
  }

  return String(inputEl.value ?? '');
}

function renderControl(ctrl, cfg, onChange) {
  const row = document.createElement('div');
  row.style.margin = '10px 0';

  const label = document.createElement('label');
  label.textContent = ctrl.label || ctrl.key;
  label.style.display = 'block';
  label.style.fontWeight = '600';
  label.style.marginBottom = '4px';

  let input;

  if (ctrl.type === 'select') {
    input = document.createElement('select');
    (ctrl.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = String(opt.value);
      o.textContent = opt.label || opt.value;
      input.appendChild(o);
    });
    input.value = toInputValue(cfg[ctrl.key] ?? ctrl.default, 'text');
  } else if (ctrl.type === 'checkbox') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(cfg[ctrl.key] ?? ctrl.default ?? false);
  } else if (ctrl.type === 'color') {
    input = document.createElement('input');
    input.type = 'color';
    input.value = toInputValue(cfg[ctrl.key] ?? ctrl.default ?? '#ffffff', 'color');
  } else if (ctrl.type === 'number') {
    input = document.createElement('input');
    input.type = 'number';
    if (ctrl.min != null) input.min = String(ctrl.min);
    if (ctrl.max != null) input.max = String(ctrl.max);
    if (ctrl.step != null) input.step = String(ctrl.step);
    input.value = toInputValue(cfg[ctrl.key] ?? ctrl.default, 'number');
  } else {
    // default: text
    input = document.createElement('input');
    input.type = 'text';
    input.value = toInputValue(cfg[ctrl.key] ?? ctrl.default, 'text');
  }

  input.style.width = '100%';
  input.style.maxWidth = '920px';
  input.style.padding = '6px 8px';

  const hint = document.createElement('div');
  hint.style.fontSize = '12px';
  hint.style.color = '#666';
  hint.style.marginTop = '3px';
  hint.textContent = ctrl.hint || '';

  input.addEventListener('change', () => onChange(ctrl, input));
  input.addEventListener('input', () => onChange(ctrl, input));

  row.appendChild(label);
  row.appendChild(input);
  if (hint.textContent) row.appendChild(hint);

  return row;
}

async function loadStyleMeta(styleKey) {
  const url = `/public/overlays/styles/${encodeURIComponent(styleKey)}.js`;
  const mod = await import(url);
  if (!mod) throw new Error(`Failed to import style module: ${styleKey}`);
  const meta = mod.meta || mod.default?.meta;
  if (!meta || !Array.isArray(meta.controls)) {
    throw new Error(`Style "${styleKey}" missing export meta.controls`);
  }
  return meta;
}

async function main() {
  if (!elMeta || !elControls || !elOverride) return;

  const styleKey = String(elMeta.dataset.styleKey || '').trim();
  if (!styleKey) {
    setHelp('No selected layout/styleKey found on page.', true);
    return;
  }

  // Start with current override JSON if valid; otherwise empty object
  const parsed = safeParse(elOverride.value);
  if (parsed && parsed.__parseError) {
    setHelp('Override JSON is invalid; generated controls disabled until JSON is fixed or cleared.', true);
    return;
  }

  // Build config object from override JSON
  const cfg = parsed || {};

  // Load style controls schema
  let meta;
  try {
    meta = await loadStyleMeta(styleKey);
  } catch (err) {
    setHelp(err.message, true);
    return;
  }

  // Render controls
  elControls.innerHTML = '';
  setHelp(`Loaded controls for style: ${styleKey}`, false);

  const form = document.createElement('div');

  function syncJson() {
    elOverride.value = JSON.stringify(cfg, null, 2);
  }

  function onChange(ctrl, inputEl) {
    cfg[ctrl.key] = normalizeValueFromInput(ctrl, inputEl);
    syncJson();
  }

  for (const ctrl of meta.controls) {
    if (!ctrl || !ctrl.key) continue;
    // If missing value, set default once (but don’t overwrite existing)
    if (cfg[ctrl.key] == null && ctrl.default != null) cfg[ctrl.key] = ctrl.default;
    form.appendChild(renderControl(ctrl, cfg, onChange));
  }

  elControls.appendChild(form);
  syncJson();
}

main().catch(() => {});
