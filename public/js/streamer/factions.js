// public/js/streamer/factions.js
'use strict';

const statusEl = document.getElementById('status');
const listEl = document.getElementById('factions');
const createForm = document.getElementById('createForm');

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

function normalizeHex(s) {
  const v = String(s || '').trim();
  if (!v) return '#78C8FF';
  return v.startsWith('#') ? v : `#${v}`;
}

function parseIntSafe(v, fallback = 0) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Expected API (typical):
 * - GET    /admin/api/factions            -> { factions: [...] } or [...]
 * - POST   /admin/api/factions            -> create
 * - PUT    /admin/api/factions/:id        -> update
 * - DELETE /admin/api/factions/:id        -> delete
 */
async function loadFactions() {
  showStatus('', 'ok');
  listEl.innerHTML = '<div class="muted">Loading…</div>';

  const data = await fetchJSON('/admin/api/factions');
  const factions = Array.isArray(data) ? data : (data.factions || []);

  if (!factions.length) {
    listEl.innerHTML = `
      <div class="notice">
        No factions yet. Create 2–10 factions to enable voting + color blending.
      </div>
    `;
    return;
  }

  listEl.innerHTML = factions
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(f => renderFactionCard(f))
    .join('');

  wireFactionEvents();
}

function renderFactionCard(f) {
  const color = normalizeHex(f.colorHex);
  const active = Boolean(f.isActive);

  return `
    <div class="card" style="padding:14px; margin-bottom:12px;">
      <div class="row">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="
            width:14px; height:14px; border-radius:5px;
            background:${esc(color)};
            box-shadow: 0 0 0 4px rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.18);
          "></span>

          <div>
            <div style="font-weight:800;">
              ${esc(f.name)} <span class="small muted">(${esc(f.key)})</span>
            </div>
            <div class="small muted">
              ${f.description ? esc(f.description) : '—'}
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span class="badge ${active ? 'free' : ''}">
            ${active ? 'Active' : 'Disabled'}
          </span>
          <span class="pill">Sort: <span class="mono">${esc(f.sortOrder ?? 0)}</span></span>
        </div>
      </div>

      <div class="hr"></div>

      <form data-edit-form data-id="${esc(f.id)}">
        <div class="grid two">
          <div>
            <label class="small">Name</label>
            <input class="input" name="name" value="${esc(f.name)}" />
          </div>

          <div>
            <label class="small">Key</label>
            <input class="input mono" name="key" value="${esc(f.key)}" />
          </div>

          <div>
            <label class="small">Color Hex</label>
            <input class="input mono" name="colorHex" value="${esc(color)}" />
          </div>

          <div>
            <label class="small">Sort Order</label>
            <input class="input mono" name="sortOrder" type="number" value="${esc(f.sortOrder ?? 0)}" />
          </div>

          <div style="grid-column: 1 / -1;">
            <label class="small">Description</label>
            <input class="input" name="description" value="${esc(f.description ?? '')}" placeholder="Optional" />
          </div>

          <div style="grid-column: 1 / -1;">
            <label class="small">
              <input type="checkbox" name="isActive" ${active ? 'checked' : ''} />
              Active
            </label>
          </div>
        </div>

        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" type="submit">Save</button>
          <button class="btn danger" type="button" data-delete="${esc(f.id)}">Delete</button>
        </div>
      </form>
    </div>
  `;
}

function wireFactionEvents() {
  // Save
  document.querySelectorAll('[data-edit-form]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.getAttribute('data-id');

      const fd = new FormData(form);
      const payload = {
        name: String(fd.get('name') || '').trim(),
        key: String(fd.get('key') || '').trim(),
        colorHex: normalizeHex(fd.get('colorHex')),
        sortOrder: parseIntSafe(fd.get('sortOrder'), 0),
        description: String(fd.get('description') || '').trim() || null,
        isActive: fd.get('isActive') === 'on'
      };

      showStatus('Saving…', 'ok');
      try {
        await fetchJSON(`/admin/api/factions/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showStatus('Saved.', 'ok');
        await loadFactions();
      } catch (err) {
        showStatus(err.message || 'Failed to save faction.', 'error');
      }
    });
  });

  // Delete
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete');
      if (!confirm('Delete this faction? This cannot be undone.')) return;

      showStatus('Deleting…', 'ok');
      try {
        await fetchJSON(`/admin/api/factions/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        showStatus('Deleted.', 'ok');
        await loadFactions();
      } catch (err) {
        showStatus(err.message || 'Failed to delete faction.', 'error');
      }
    });
  });
}

// Create
if (createForm) {
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fd = new FormData(createForm);
    const payload = {
      key: String(fd.get('key') || '').trim(),
      name: String(fd.get('name') || '').trim(),
      colorHex: normalizeHex(fd.get('colorHex')),
      sortOrder: parseIntSafe(fd.get('sortOrder'), 0),
      description: String(fd.get('description') || '').trim() || null,
      isActive: fd.get('isActive') === 'on'
    };

    showStatus('Creating…', 'ok');
    try {
      await fetchJSON('/admin/api/factions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      createForm.reset();
      // re-apply default color + active checked if browser clears it
      const colorInput = createForm.querySelector('input[name="colorHex"]');
      if (colorInput) colorInput.value = '#78C8FF';
      const activeBox = createForm.querySelector('input[name="isActive"]');
      if (activeBox) activeBox.checked = true;

      showStatus('Faction created.', 'ok');
      await loadFactions();
    } catch (err) {
      showStatus(err.message || 'Failed to create faction.', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadFactions().catch(err => showStatus(err.message || 'Failed to load factions.', 'error'));
});
