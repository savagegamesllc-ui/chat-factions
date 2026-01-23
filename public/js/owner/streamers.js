// public/js/owner/streamers.js
'use strict';

const statusEl = document.getElementById('status');
const rootEl = document.getElementById('streamers');

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

function badgePlan(planTier, proOverride) {
  const isPro = planTier === 'PRO' || proOverride === true;
  const cls = isPro ? 'badge pro' : 'badge free';
  const label = isPro ? 'PRO' : 'FREE';
  return `<span class="${cls}">${label}</span>`;
}

function cardHtml(s) {
  const overlayUrl = `${location.origin}/overlay/${s.overlayToken}`;
  return `
    <div class="card" style="padding:14px; margin-top:12px;">
      <div class="row">
        <div>
          <div style="font-weight:800;">${esc(s.displayName || s.login || 'Streamer')}</div>
          <div class="small muted">id: <span class="mono">${esc(s.id)}</span></div>
        </div>
        ${badgePlan(s.planTier, s.proOverride)}
      </div>

      <div class="grid two" style="margin-top:10px;">
        <div>
          <div class="small muted">planTier</div>
          <div class="mono">${esc(s.planTier || 'FREE')}</div>
        </div>
        <div>
          <div class="small muted">proOverride</div>
          <div class="mono">${s.proOverride ? 'true' : 'false'}</div>
        </div>
      </div>

      <div style="margin-top:10px;">
        <div class="small muted">Overlay URL</div>
        <div class="mono" style="word-break:break-all;">${esc(overlayUrl)}</div>
      </div>

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" data-set-plan="${esc(s.id)}" data-plan="PRO" data-override="${s.proOverride ? '1' : '0'}">Set planTier=PRO</button>
        <button class="btn" data-set-plan="${esc(s.id)}" data-plan="FREE" data-override="${s.proOverride ? '1' : '0'}">Set planTier=FREE</button>
        <button class="btn danger" data-toggle-override="${esc(s.id)}" data-plan="${esc(s.planTier || 'FREE')}" data-override="${s.proOverride ? '1' : '0'}">
          Toggle proOverride
        </button>
      </div>

      <div class="small" style="margin-top:10px; opacity:0.85;">
        Stripe fields:
        cust=<span class="mono">${esc(s.stripeCustomerId || '-')}</span>,
        sub=<span class="mono">${esc(s.stripeSubscriptionId || '-')}</span>
      </div>
    </div>
  `;
}

function wireActions() {
  rootEl.querySelectorAll('[data-set-plan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-set-plan');
      const planTier = btn.getAttribute('data-plan');
      const proOverride = btn.getAttribute('data-override') === '1';

      showStatus('Updating plan…', 'ok');
      try {
        await fetchJSON(`/owner/api/streamers/${encodeURIComponent(id)}/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planTier, proOverride })
        });
        showStatus('Updated.', 'ok');
        await load();
      } catch (e) {
        showStatus(e.message || 'Failed.', 'error');
      }
    });
  });

  rootEl.querySelectorAll('[data-toggle-override]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-toggle-override');
      const planTier = btn.getAttribute('data-plan');
      const current = btn.getAttribute('data-override') === '1';
      const proOverride = !current;

      showStatus('Toggling override…', 'ok');
      try {
        await fetchJSON(`/owner/api/streamers/${encodeURIComponent(id)}/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planTier, proOverride })
        });
        showStatus('Updated.', 'ok');
        await load();
      } catch (e) {
        showStatus(e.message || 'Failed.', 'error');
      }
    });
  });
}

async function load() {
  rootEl.innerHTML = '<div class="muted">Loading…</div>';

  const data = await fetchJSON('/owner/api/streamers');
  const list = data.streamers || [];

  if (!list.length) {
    rootEl.innerHTML = `<div class="notice">No streamers found.</div>`;
    return;
  }

  rootEl.innerHTML = list.map(cardHtml).join('');
  wireActions();
}

document.addEventListener('DOMContentLoaded', () => {
  load().catch(e => showStatus(e.message || 'Failed to load streamers.', 'error'));
});
