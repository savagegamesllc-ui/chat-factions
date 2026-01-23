// public/js/streamer/layouts.js
'use strict';

const elPlan = document.getElementById('plan');
const elStatus = document.getElementById('status');
const elLayouts = document.getElementById('layouts');

function setStatus(msg, isError = false) {
  elStatus.textContent = msg || '';
  elStatus.style.color = isError ? '#b00020' : '#444';
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}

  if (!res.ok) {
    const errMsg = (json && json.error) ? json.error : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }

  return json;
}

function renderPlan(streamer) {
  if (!streamer) return;
  const pro = streamer.planTier === 'PRO' || streamer.proOverride === true;
  elPlan.innerHTML = `
    <p>
      Plan: <strong>${escapeHtml(streamer.planTier)}</strong>
      ${streamer.proOverride ? '(override)' : ''}
      ${pro ? '' : ' — <a href="/admin/billing">Upgrade</a>'}
    </p>
  `;
}

function layoutCard(l) {
  const wrap = document.createElement('div');
  wrap.style.border = '1px solid #ccc';
  wrap.style.padding = '10px';
  wrap.style.marginBottom = '10px';

  const locked = !l.isAccessible;
  const selected = l.isSelected;

  const title = document.createElement('div');
  title.innerHTML = `
    <strong>${escapeHtml(l.name)}</strong>
    <span style="margin-left:8px; font-size:12px; padding:2px 6px; border:1px solid #aaa;">
      ${escapeHtml(l.tier)}
    </span>
    ${selected ? '<span style="margin-left:8px; font-size:12px; padding:2px 6px; border:1px solid #2e7d32; color:#2e7d32;">SELECTED</span>' : ''}
    ${locked ? '<span style="margin-left:8px; font-size:12px; padding:2px 6px; border:1px solid #b00020; color:#b00020;">PRO REQUIRED</span>' : ''}
  `;
  wrap.appendChild(title);

  const meta = document.createElement('div');
  meta.style.fontSize = '12px';
  meta.style.color = '#444';
  meta.textContent = `styleKey=${l.styleKey}`;
  wrap.appendChild(meta);

  const btn = document.createElement('button');
  btn.textContent = selected ? 'Selected' : 'Select';
  btn.disabled = selected || locked;
  btn.style.marginTop = '8px';

  btn.addEventListener('click', async () => {
    setStatus('Selecting...');
    try {
      await api('/admin/api/layouts/select', {
        method: 'POST',
        body: JSON.stringify({ layoutId: l.id })
      });
      setStatus('Selected.');
      await refresh();
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  wrap.appendChild(btn);

  return wrap;
}

async function refresh() {
  elLayouts.innerHTML = '';
  const data = await api('/admin/api/layouts', { method: 'GET' });

  renderPlan(data.streamer);

  const layouts = (data && data.layouts) ? data.layouts : [];
  if (layouts.length === 0) {
    elLayouts.textContent = 'No active layouts available. Ask the owner to create one.';
    return;
  }

  layouts.forEach(l => elLayouts.appendChild(layoutCard(l)));
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

refresh().catch(err => setStatus(err.message, true));
