// public/js/streamer/chat.js
'use strict';

async function fetchJSON(url, opts) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || text || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function $(id) { return document.getElementById(id); }

function showStatus(msg, kind = 'ok') {
  const el = $('status');
  if (!el) return;
  el.className = `notice ${kind}`;
  el.textContent = msg || '';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function renderCommands(commands) {
  const wrap = $('commandsWrap');
  if (!wrap) return;

  if (!commands || !commands.length) {
    wrap.innerHTML = `<div class="small muted">No commands found.</div>`;
    return;
  }

  const rows = commands.map((c) => {
    const trigger = c.trigger ? `!${c.trigger}` : '!(unset)';
    const aliases = (c.aliases || []).map(a =>
      `<span class="pill mono">!${esc(a.alias)}
        <button class="btn xs danger" data-del-alias="${esc(a.id)}" title="Remove alias" style="margin-left:6px;">×</button>
      </span>`
    ).join(' ');

    return `
      <div class="card" style="margin-top:12px;">
        <div class="card-title">
          <h3 style="margin:0;">${esc(c.type)} <span class="pill mono">${esc(trigger)}</span></h3>
          <div class="hint">Command ID: <span class="mono">${esc(c.id)}</span></div>
        </div>

        <div class="grid two" style="margin-top:10px;">
          <div>
            <label class="small">Trigger (without !)</label>
            <input class="input mono" data-field="trigger" data-id="${esc(c.id)}" value="${esc(c.trigger)}" placeholder="hype" />
            <div class="small muted">Example: <span class="mono">hype</span> → chat uses <span class="mono">!hype</span></div>
          </div>

          <div>
            <label class="small">Enabled</label>
            <div style="display:flex; gap:10px; align-items:center; margin-top:6px;">
              <label class="pill" style="cursor:pointer;">
                <input type="checkbox" data-field="isEnabled" data-id="${esc(c.id)}" ${c.isEnabled ? 'checked' : ''} />
                Enabled
              </label>
            </div>
          </div>
        </div>

        <div class="grid two" style="margin-top:10px;">
          <div>
            <label class="small">Cooldown (seconds)</label>
            <input class="input mono" data-field="cooldownSec" data-id="${esc(c.id)}" value="${esc(c.cooldownSec)}" />
            <div class="small muted">How often each viewer can use this command.</div>
          </div>

          <div>
            <label class="small">Bypass</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
              <label class="pill" style="cursor:pointer;">
                <input type="checkbox" data-field="bypassBroadcaster" data-id="${esc(c.id)}" ${c.bypassBroadcaster ? 'checked' : ''} />
                Broadcaster
              </label>
              <label class="pill" style="cursor:pointer;">
                <input type="checkbox" data-field="bypassMods" data-id="${esc(c.id)}" ${c.bypassMods ? 'checked' : ''} />
                Mods
              </label>
            </div>
          </div>
        </div>

        <div class="grid two" style="margin-top:10px;">
          <div>
            <label class="small">Max Delta</label>
            <input class="input mono" data-field="maxDelta" data-id="${esc(c.id)}" value="${esc(c.maxDelta ?? '')}" placeholder="25" />
            <div class="small muted">Clamp for safety.</div>
          </div>

          <div>
            <label class="small">Default Delta</label>
            <input class="input mono" data-field="defaultDelta" data-id="${esc(c.id)}" value="${esc(c.defaultDelta ?? '')}" placeholder="1" />
            <div class="small muted">Used when chat omits the delta (future parsing).</div>
          </div>
        </div>

        <div style="margin-top:12px;">
          <label class="small">Aliases</label>
          <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
            ${aliases || `<span class="small muted">No aliases</span>`}
          </div>

          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
            <input class="input mono" data-alias-input="${esc(c.id)}" placeholder="cfhype" />
            <button class="btn" data-add-alias="${esc(c.id)}">Add Alias</button>
            <button class="btn primary" data-save="${esc(c.id)}">Save</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  wrap.innerHTML = rows;
}

async function loadCommands() {
  const data = await fetchJSON('/admin/api/chat/commands');
  renderCommands(data.commands || []);
}

function collectPatch(commandId) {
  const patch = {};
  const inputs = document.querySelectorAll(`[data-id="${commandId}"]`);

  inputs.forEach(el => {
    const field = el.getAttribute('data-field');
    if (!field) return;

    if (el.type === 'checkbox') patch[field] = !!el.checked;
    else patch[field] = el.value;
  });

  // numeric coercion
  if (patch.cooldownSec != null) patch.cooldownSec = Number(patch.cooldownSec);
  if (patch.maxDelta != null && patch.maxDelta !== '') patch.maxDelta = Number(patch.maxDelta);
  if (patch.defaultDelta != null && patch.defaultDelta !== '') patch.defaultDelta = Number(patch.defaultDelta);

  return patch;
}

async function saveCommand(commandId) {
  const patch = collectPatch(commandId);
  const out = await fetchJSON(`/admin/api/chat/commands/${encodeURIComponent(commandId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  showStatus('Saved command settings.', 'ok');
  return out;
}

async function addAlias(commandId) {
  const inp = document.querySelector(`[data-alias-input="${commandId}"]`);
  const alias = String(inp?.value || '').trim();
  if (!alias) {
    showStatus('Alias is required.', 'error');
    return;
  }

  await fetchJSON(`/admin/api/chat/commands/${encodeURIComponent(commandId)}/aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias })
  });

  showStatus('Alias added.', 'ok');
  await loadCommands();
}

async function delAlias(aliasId) {
  await fetchJSON(`/admin/api/chat/aliases/${encodeURIComponent(aliasId)}`, {
    method: 'DELETE'
  });
  showStatus('Alias removed.', 'ok');
  await loadCommands();
}

function wireEvents() {
  document.addEventListener('click', async (e) => {
    const t = e.target;

    const saveId = t?.getAttribute?.('data-save');
    if (saveId) {
      try {
        await saveCommand(saveId);
        await loadCommands();
      } catch (err) {
        showStatus(err.message || 'Failed to save.', 'error');
      }
      return;
    }

    const addId = t?.getAttribute?.('data-add-alias');
    if (addId) {
      try {
        await addAlias(addId);
      } catch (err) {
        showStatus(err.message || 'Failed to add alias.', 'error');
      }
      return;
    }

    const delId = t?.getAttribute?.('data-del-alias');
    if (delId) {
      try {
        await delAlias(delId);
      } catch (err) {
        showStatus(err.message || 'Failed to remove alias.', 'error');
      }
      return;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    wireEvents();
    await loadCommands();
    showStatus('', 'ok');
  } catch (err) {
    showStatus(err.message || 'Failed to load chat commands.', 'error');
  }
});
