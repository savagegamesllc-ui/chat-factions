// public/js/streamer/layouts.js
'use strict';

const planEl = document.getElementById('plan');
const statusEl = document.getElementById('status');
const layoutsEl = document.getElementById('layouts');
const overrideJsonEl = document.getElementById('overrideJson');

// styleControls.js exports these in your build
const StyleControls = window.StyleControls || null;

function showStatus(msg, kind = 'ok') {
  if (!statusEl) return;
  statusEl.className = `notice ${kind}`;
  statusEl.textContent = msg;
  statusEl.style.display = msg ? 'block' : 'none';
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function safeParseJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!isObject(obj)) return { __parseError: true, message: 'Override must be a JSON object.' };
    return obj;
  } catch (e) {
    return { __parseError: true, message: e.message };
  }
}

function badgeTier(tier) {
  const cls = tier === 'PRO' ? 'badge pro' : 'badge free';
  return `<span class="${cls}">${tier}</span>`;
}

function planBadge(planTier) {
  const cls = planTier === 'PRO' ? 'badge pro' : 'badge free';
  return `<span class="${cls}">${planTier}</span>`;
}

function hasProAccess(streamer) {
  return streamer && (streamer.planTier === 'PRO' || streamer.proOverride === true);
}

function renderPlan(streamer) {
  planEl.innerHTML = `
    <div class="row">
      <div>
        <div><strong>${esc(streamer.displayName || 'Streamer')}</strong></div>
        <div class="small muted">Plan status</div>
      </div>
      ${planBadge(streamer.planTier)}
    </div>
    ${streamer.proOverride ? `<div class="small" style="margin-top:8px;">proOverride: <span class="mono">true</span></div>` : ''}
  `;
}

/** -------- Slot UI -------- */

let activeSlot = 0;

function getSlotLabel(n) {
  return n === 0 ? 'Slot 0 (Main)' : `Slot ${n}`;
}

function ensureSlotPicker(streamer) {
  const existing = document.getElementById('slotPickerWrap');
  if (existing) return;

  const proOk = hasProAccess(streamer);

  const wrap = document.createElement('div');
  wrap.id = 'slotPickerWrap';
  wrap.className = 'card';
  wrap.style.padding = '14px';
  wrap.style.marginBottom = '14px';

  wrap.innerHTML = `
    <div class="row">
      <div>
        <div style="font-weight:800;">Overlay Slot</div>
        <div class="small muted">Choose which OBS overlay slot you are configuring</div>
      </div>

      <div style="display:flex; align-items:center; gap:10px;">
        <select id="slotPick" class="input" style="min-width: 180px;">
          <option value="0">${getSlotLabel(0)}</option>
          <option value="1" ${proOk ? '' : 'disabled'}>${getSlotLabel(1)} ${proOk ? '' : '🔒 PRO'}</option>
          <option value="2" ${proOk ? '' : 'disabled'}>${getSlotLabel(2)} ${proOk ? '' : '🔒 PRO'}</option>
          <option value="3" ${proOk ? '' : 'disabled'}>${getSlotLabel(3)} ${proOk ? '' : '🔒 PRO'}</option>
        </select>
      </div>
    </div>

    <div id="slotHint" class="small" style="margin-top:10px; color: rgba(255,255,255,0.78); display:${proOk ? 'none' : 'block'};">
      Additional slots (1–3) are a PRO feature. Upgrade in Billing to unlock multiple simultaneous overlays.
    </div>
  `;

  // Insert slot picker before layouts grid
  layoutsEl.insertAdjacentElement('beforebegin', wrap);

  const sel = document.getElementById('slotPick');
  sel.value = String(activeSlot);

  sel.addEventListener('change', async () => {
    activeSlot = Number(sel.value) || 0;
    showStatus(`Switched to ${getSlotLabel(activeSlot)}.`, 'ok');

    // Choose the layout selected for this slot (if any) to edit
    const l = findSelectedForSlot(activeSlot);
    if (l) loadOverridePane(l);
  });
}

function slotBadgeHtml(slotNum) {
  return `<span class="pill" style="font-weight:700;">${esc(getSlotLabel(slotNum))}</span>`;
}

/** -------- Layout cards + selection state -------- */

let cached = {
  streamer: null,
  layouts: []
};

let activeLayoutId = null; // which layout is currently being edited in the override pane

function findLayout(id) {
  return cached.layouts.find(x => x.id === id) || null;
}

function findSelectedForSlot(slotNum) {
  // prefer selectedSlot
  let hit = cached.layouts.find(l => Number(l.selectedSlot) === Number(slotNum));
  if (hit) return hit;

  // legacy fallback for slot0
  if (Number(slotNum) === 0) {
    hit = cached.layouts.find(l => !!l.isSelected);
    if (hit) return hit;
  }
  return null;
}

function effectiveConfig(layout) {
  const base = isObject(layout.defaultConfig) ? layout.defaultConfig : {};
  const over = isObject(layout.overrideConfig) ? layout.overrideConfig : {};
  return { ...base, ...over };
}

function layoutCardHtml(l) {
  const locked = !l.isAccessible;
  const enabled = l.isEnabled !== false;

  const selectedSlot = (l.selectedSlot === 0 || l.selectedSlot === 1 || l.selectedSlot === 2 || l.selectedSlot === 3)
    ? Number(l.selectedSlot)
    : null;

  // legacy slot0 selection (for older rows)
  const legacySelected = !!l.isSelected;
  const isSelectedForAnySlot = (selectedSlot != null) || legacySelected;

  const lockLine = locked
    ? `<div class="small" style="color: rgba(255,255,255,0.70); margin-top:6px;">🔒 Requires PRO</div>`
    : '';

  const slotLine = isSelectedForAnySlot
    ? `<div class="pills" style="margin-top:8px;">
        ${selectedSlot != null ? slotBadgeHtml(selectedSlot) : ''}
        ${legacySelected && selectedSlot == null ? slotBadgeHtml(0) : ''}
      </div>`
    : '';

  const disabledLine = !enabled
    ? `<div class="small" style="margin-top:6px; color: rgba(255,255,255,0.65);">Disabled</div>`
    : '';

  const border = (selectedSlot === activeSlot) || (legacySelected && activeSlot === 0)
    ? 'border:1px solid rgba(139,92,246,0.55); box-shadow: 0 0 0 4px rgba(139,92,246,0.16), var(--shadow);'
    : '';

  // Button label based on current active slot
  const selectedForActiveSlot =
    (selectedSlot != null && selectedSlot === activeSlot) ||
    (activeSlot === 0 && legacySelected);

  const selectLabel = selectedForActiveSlot ? 'Selected' : `Set for ${getSlotLabel(activeSlot)}`;

  return `
    <div class="card" style="padding:14px; ${border}">
      <div class="row">
        <div>
          <div style="font-weight:800;">${esc(l.name)}</div>
          <div class="small muted">Style: <span class="mono">${esc(l.styleKey)}</span></div>
        </div>
        ${badgeTier(l.tier)}
      </div>

      ${slotLine}
      ${lockLine}
      ${disabledLine}

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary"
          data-select="${esc(l.id)}"
          ${locked || !enabled ? 'disabled' : ''}>
          ${selectLabel}
        </button>

        <button class="btn"
          data-edit="${esc(l.id)}"
          ${!enabled ? 'disabled' : ''}>
          Edit Config
        </button>
      </div>
    </div>
  `;
}

function loadOverridePane(layout) {
  activeLayoutId = layout.id;

  const over = isObject(layout.overrideConfig) ? layout.overrideConfig : null;
  overrideJsonEl.value = over ? JSON.stringify(over, null, 2) : '';

  if (StyleControls && typeof StyleControls.mount === 'function') {
    try {
      StyleControls.mount({
        styleKey: layout.styleKey,
        containerId: 'styleControls',
        value: effectiveConfig(layout),
        onChange: (newObj) => {
          overrideJsonEl.value = JSON.stringify(newObj || {}, null, 2);
        }
      });
    } catch (e) {
      console.warn('[layouts] StyleControls mount failed:', e);
    }
  } else {
    const sc = document.getElementById('styleControls');
    if (sc) sc.innerHTML = `<div class="notice">No style control metadata found for <span class="mono">${esc(layout.styleKey)}</span>.</div>`;
  }
}

async function refresh() {
  showStatus('', 'ok');
  layoutsEl.innerHTML = '<div class="muted">Loading layouts…</div>';
  planEl.innerHTML = '<div class="muted">Loading plan…</div>';

  const data = await fetchJSON('/admin/api/layouts');

  cached.streamer = data.streamer;
  cached.layouts = data.layouts || [];

  renderPlan(cached.streamer);
  ensureSlotPicker(cached.streamer);

  // Render layout grid
  const cards = cached.layouts.map(l => layoutCardHtml(l)).join('');
  layoutsEl.innerHTML = `<div class="grid two">${cards}</div>`;

  // Default editor target: selected for activeSlot (fallbacks)
  const selectedForSlot = findSelectedForSlot(activeSlot);
  const anySelected = cached.layouts.find(l => l.selectedSlot != null) || cached.layouts.find(l => l.isSelected);
  const fallback = selectedForSlot || anySelected || cached.layouts.find(l => l.isEnabled) || cached.layouts[0] || null;

  if (fallback) loadOverridePane(fallback);

  wireEvents();
}

async function selectLayoutForActiveSlot(layoutId) {
  // Slot 0 uses legacy endpoint (keeps old contracts / minimal changes)
  if (activeSlot === 0) {
    return fetchJSON('/admin/api/layouts/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layoutId })
    });
  }

  // Slots 1-3 use new endpoint
  return fetchJSON('/admin/api/layouts/select-slot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layoutId, slot: activeSlot })
  });
}

function wireEvents() {
  // Select for active slot
  layoutsEl.querySelectorAll('[data-select]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-select');
      const l = findLayout(id);
      if (!l) return;

      // UI gate: if FREE and activeSlot>0, block early
      if (activeSlot > 0 && !hasProAccess(cached.streamer)) {
        showStatus('Additional slots (1–3) require PRO. Upgrade in Billing.', 'error');
        return;
      }

      showStatus(`Selecting layout for ${getSlotLabel(activeSlot)}…`, 'ok');

      try {
        await selectLayoutForActiveSlot(id);
        showStatus(`Layout set for ${getSlotLabel(activeSlot)}.`, 'ok');
        await refresh();
      } catch (err) {
        showStatus(err.message || 'Failed to select layout.', 'error');
      }
    });
  });

  // Edit Config
  layoutsEl.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit');
      const l = findLayout(id);
      if (!l) return;
      loadOverridePane(l);
      showStatus(`Editing overrideConfig for "${l.name}".`, 'ok');
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  });

  // Autosave override on blur
  overrideJsonEl.addEventListener('blur', async () => {
    if (!activeLayoutId) return;

    const parsed = safeParseJson(overrideJsonEl.value);
    if (parsed && parsed.__parseError) {
      showStatus(`Invalid JSON: ${parsed.message}`, 'error');
      return;
    }

    showStatus('Saving overrideConfig…', 'ok');

    try {
      await fetchJSON('/admin/api/layouts/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layoutId: activeLayoutId,
          overrideConfigText: overrideJsonEl.value
        })
      });

      showStatus('Override saved.', 'ok');
      await refresh();
    } catch (err) {
      showStatus(err.message || 'Failed to save overrideConfig.', 'error');
    }
  }, { once: true }); // important: avoid stacking listeners after refresh()
}

document.addEventListener('DOMContentLoaded', () => {
  refresh().catch(err => showStatus(err.message || 'Failed to load layouts.', 'error'));
});
