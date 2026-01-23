// public/js/streamer/billing.js
'use strict';

const statusEl = document.getElementById('status');
const billingEl = document.getElementById('billing');
const btnUpgrade = document.getElementById('btnUpgrade');
const btnManage = document.getElementById('btnManage');

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

function badgePlan(planTier) {
  const cls = planTier === 'PRO' ? 'badge pro' : 'badge free';
  return `<span class="${cls}">${esc(planTier || 'FREE')}</span>`;
}

// Endpoint candidates (so we don’t block if naming differs slightly)
const STATUS_URLS = [
  '/admin/api/billing/status',
  '/admin/billing/status',
  '/api/billing/status'
];

const UPGRADE_URLS = [
  '/admin/api/billing/checkout',
  '/admin/api/billing/upgrade',
  '/admin/billing/checkout',
  '/admin/billing/upgrade'
];

const PORTAL_URLS = [
  '/admin/api/billing/portal',
  '/admin/billing/portal'
];

async function tryGet(urls) {
  let lastErr = null;
  for (const u of urls) {
    try {
      return await fetchJSON(u);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No status endpoint worked.');
}

async function tryPost(urls, bodyObj) {
  let lastErr = null;
  for (const u of urls) {
    try {
      return await fetchJSON(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyObj ? JSON.stringify(bodyObj) : undefined
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No endpoint worked.');
}

function isPro(status) {
  const tier = String(status?.planTier || status?.streamer?.planTier || 'FREE').toUpperCase();
  const override = Boolean(status?.proOverride || status?.streamer?.proOverride);
  return tier === 'PRO' || override;
}

function render(status) {
  const tier = String(status?.planTier || status?.streamer?.planTier || 'FREE').toUpperCase();
  const override = Boolean(status?.proOverride || status?.streamer?.proOverride);
  const customer = status?.stripeCustomerId || status?.streamer?.stripeCustomerId || null;
  const sub = status?.stripeSubscriptionId || status?.streamer?.stripeSubscriptionId || null;

  const pro = isPro(status);

  // buttons
  if (btnUpgrade) btnUpgrade.disabled = pro; // can still allow “upgrade” if override; but pro is pro
  if (btnManage) btnManage.disabled = !customer; // portal usually requires customer

  const overrideLine = override
    ? `<div class="small" style="margin-top:8px;">Override: <span class="mono">proOverride=true</span></div>`
    : '';

  const stripeLine = `
    <div class="small muted" style="margin-top:10px;">
      Stripe customer: <span class="mono">${customer ? esc(customer) : '—'}</span><br/>
      Subscription: <span class="mono">${sub ? esc(sub) : '—'}</span>
    </div>
  `;

  billingEl.innerHTML = `
    <div class="row">
      <div>
        <div style="font-weight:800;">Current plan</div>
        <div class="small muted">Updated by webhooks</div>
      </div>
      ${badgePlan(tier)}
    </div>

    ${overrideLine}
    ${stripeLine}

    <div class="notice" style="margin-top:12px;">
      ${pro
        ? 'You have PRO access. PRO layouts and assets are unlocked.'
        : 'You are on FREE. PRO layouts will display a locked message in OBS until upgraded.'
      }
    </div>
  `;
}

async function refresh() {
  showStatus('', 'ok');
  billingEl.innerHTML = '<div class="muted">Loading billing status…</div>';

  const status = await tryGet(STATUS_URLS);
  render(status);
}

function wireButtons() {
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', async () => {
      showStatus('Opening Stripe Checkout…', 'ok');
      try {
        // Most implementations return { url }
        const out = await tryPost(UPGRADE_URLS);
        const url = out?.url || out?.checkoutUrl || null;
        if (!url) throw new Error('Checkout URL missing from response.');
        window.location.href = url;
      } catch (e) {
        showStatus(`Upgrade failed: ${e.message}`, 'error');
      }
    });
  }

  if (btnManage) {
    btnManage.addEventListener('click', async () => {
      showStatus('Opening Stripe Customer Portal…', 'ok');
      try {
        const out = await tryPost(PORTAL_URLS);
        const url = out?.url || out?.portalUrl || null;
        if (!url) throw new Error('Portal URL missing from response.');
        window.location.href = url;
      } catch (e) {
        showStatus(`Portal failed: ${e.message}`, 'error');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireButtons();
  refresh().catch(err => showStatus(err.message || 'Failed to load billing status.', 'error'));
});
