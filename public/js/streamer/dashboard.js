// public/js/streamer/dashboard.js
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

function badgePlan(planTier) {
  const cls = planTier === 'PRO' ? 'badge pro' : 'badge free';
  return `<span class="${cls}">${planTier}</span>`;
}

function renderStatus(el, html, kind = 'ok') {
  if (!el) return;
  el.className = `notice ${kind}`;
  el.textContent = '';
  el.insertAdjacentHTML('afterbegin', html);
}

async function copyToClipboard(value, btn) {
  try {
    await navigator.clipboard.writeText(value);
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = prev), 1100);
    }
  } catch {
    alert('Copy failed');
  }
}

function setOverlayUrl(overlayUrl) {
  const overlayInput = document.getElementById('overlayUrl');
  const btnCopy = document.getElementById('btnCopyOverlayUrl');

  if (overlayInput) overlayInput.value = overlayUrl || '';
  if (btnCopy) btnCopy.onclick = () => copyToClipboard(overlayUrl, btnCopy);
}

function setSlotUrl(slot, url) {
  const input = document.getElementById(`overlayUrl${slot}`);
  const btn = document.getElementById(`btnCopyOverlayUrl${slot}`);
  if (input) input.value = url || '';
  if (btn) btn.onclick = () => copyToClipboard(url, btn);
}

function showProSlots(show) {
  const wrap = document.getElementById('proSlotUrls');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}

function renderSummary(summaryEl, selectedLayout) {
  if (!summaryEl) return;

  if (!selectedLayout) {
    summaryEl.innerHTML = `
      <div class="notice">
        <div style="font-weight:800; margin-bottom:6px;">No layout selected</div>
        <div class="small muted">Go to Layouts to choose one.</div>
        <div style="margin-top:10px;">
          <a class="btn primary" href="/admin/layouts">Choose a layout</a>
        </div>
      </div>
    `;
    return;
  }

  summaryEl.innerHTML = `
    <div class="row" style="align-items:flex-start;">
      <div>
        <div style="font-weight:900; font-size:16px;">${selectedLayout.name}</div>
        <div class="small muted" style="margin-top:4px;">
          Style: <span class="mono">${selectedLayout.styleKey}</span>
        </div>
        <div class="small muted" style="margin-top:2px;">
          Tier: ${badgePlan(selectedLayout.tier)}
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
        <a class="btn" href="/admin/layouts">Layouts</a>
        <a class="btn" href="/admin/meters">Meters</a>
      </div>
    </div>
  `;
}

/** Overlay preview wiring */
function initOverlayPreview(overlayUrl) {
  const frame = document.getElementById('overlayPreviewFrame');
  const wrap = document.getElementById('previewWrap');
  const note = document.getElementById('previewNote');

  const btnRefresh = document.getElementById('btnPreviewRefresh');
  const btnOpen = document.getElementById('btnPreviewOpen');
  const btnToggle = document.getElementById('btnPreviewToggle');

  // ✅ NEW
  const btnMaxHype = document.getElementById('btnPreviewMaxHype');
  let maxHypeOn = false;

  if (!frame || !wrap) return;

  const setNote = (msg) => {
    if (!note) return;
    note.textContent = msg || '';
  };

  const load = (cacheBust = false) => {
    if (!overlayUrl) return;
    const u = new URL(overlayUrl, location.origin);
    u.searchParams.set('preview', '1');
    if (cacheBust) u.searchParams.set('_t', String(Date.now()));
    frame.src = u.toString();
    setNote('Preview loaded from your overlay URL.');
  };

  // Initial load
  load(false);

  // Buttons
  if (btnRefresh) btnRefresh.onclick = () => load(true);

  // (leave open behavior unchanged; opens real overlay URL)
  if (btnOpen) btnOpen.onclick = () => window.open(overlayUrl, '_blank', 'noopener,noreferrer');

  if (btnToggle) {
    btnToggle.onclick = () => {
      const hidden = wrap.style.display === 'none';
      wrap.style.display = hidden ? 'block' : 'none';
      btnToggle.textContent = hidden ? 'Hide Preview' : 'Show Preview';
    };
  }

  // ✅ NEW: Max Hype toggle (preview iframe only)
  if (btnMaxHype) {
    btnMaxHype.onclick = () => {
      maxHypeOn = !maxHypeOn;

      frame.contentWindow?.postMessage(
        { type: 'DEV_PREVIEW_MAX_HYPE', enabled: maxHypeOn },
        '*'
      );

      btnMaxHype.textContent = maxHypeOn ? 'Max Hype: ON' : 'Max Hype';
    };
  }

  // Helpful note if the browser blocks framing
  frame.addEventListener('load', () => {
    setNote('Preview loaded. If you see nothing, trigger hype or meters to animate the overlay.');
  });

  frame.addEventListener('error', () => {
    setNote('Preview failed to load. If this persists, your overlay route may be sending frame-blocking headers.');
  });
}

async function loadDashboard() {
  const statusEl = document.getElementById('status');
  const summaryEl = document.getElementById('summary');

  try {
    const data = await fetchJSON('/admin/api/summary');
    const { streamer, selectedLayout } = data;

    renderStatus(
      statusEl,
      `
      <div class="row">
        <div>
          <div style="font-weight:900;">${streamer.displayName}</div>
          <div class="small muted">Logged in</div>
        </div>
        ${badgePlan(streamer.planTier)}
      </div>
      `,
      'ok'
    );

    const overlayUrl = `${location.origin}/overlay/${streamer.overlayToken}`;
    setOverlayUrl(overlayUrl);

    const isPro = streamer.planTier === 'PRO' || streamer.proOverride === true;
    showProSlots(isPro);

    if (isPro) {
      const url1 = `${location.origin}/overlay/${streamer.overlayToken}/1`;
      const url2 = `${location.origin}/overlay/${streamer.overlayToken}/2`;
      const url3 = `${location.origin}/overlay/${streamer.overlayToken}/3`;

      setSlotUrl(1, url1);
      setSlotUrl(2, url2);
      setSlotUrl(3, url3);
    }

    renderSummary(summaryEl, selectedLayout);

    // iframe preview
    initOverlayPreview(overlayUrl);
  } catch (err) {
    renderStatus(statusEl, err.message || 'Failed to load dashboard', 'error');
    if (summaryEl) summaryEl.textContent = '';
    setOverlayUrl('');
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
