// public/js/streamer/companionKey.js
'use strict';

const statusEl = document.getElementById('status');
const keyLoadingEl = document.getElementById('keyLoading');
const keyNoneEl = document.getElementById('keyNone');
const keyExistsEl = document.getElementById('keyExists');
const keyPrefixDisplay = document.getElementById('keyPrefixDisplay');
const keyBadge = document.getElementById('keyBadge');
const keyMeta = document.getElementById('keyMeta');
const keyHint = document.getElementById('keyHint');
const btnGenerate = document.getElementById('btnGenerate');
const btnGenerate2 = document.getElementById('btnGenerate2');
const btnRotate = document.getElementById('btnRotate');
const btnRevoke = document.getElementById('btnRevoke');
const revealModal = document.getElementById('revealModal');
const revealTitle = document.getElementById('revealTitle');
const revealKeyValue = document.getElementById('revealKeyValue');
const btnRevealCopy = document.getElementById('btnRevealCopy');
const btnRevealClose = document.getElementById('btnRevealClose');

function showStatus(msg, kind = 'ok') {
  if (!statusEl) return;
  statusEl.className = `notice ${kind}`;
  statusEl.textContent = msg;
  statusEl.style.display = msg ? 'block' : 'none';
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

function fmt(dateStr) {
  if (!dateStr) return 'never';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
}

function setButtons(active) {
  if (!btnRotate || !btnRevoke || !btnGenerate2) return;
  if (active) {
    btnRotate.style.display = '';
    btnRevoke.style.display = '';
    btnGenerate2.style.display = 'none';
  } else {
    btnRotate.style.display = 'none';
    btnRevoke.style.display = 'none';
    btnGenerate2.style.display = '';
  }
}

function renderKey(info) {
  if (keyLoadingEl) keyLoadingEl.style.display = 'none';

  if (!info) {
    if (keyNoneEl) keyNoneEl.style.display = '';
    if (keyExistsEl) keyExistsEl.style.display = 'none';
    return;
  }

  if (keyNoneEl) keyNoneEl.style.display = 'none';
  if (keyExistsEl) keyExistsEl.style.display = '';

  const isActive = !info.revokedAt;
  const prefix = info.keyPrefix || '';
  if (keyPrefixDisplay) keyPrefixDisplay.textContent = prefix + '...';

  if (keyBadge) {
    keyBadge.className = isActive ? 'badge-active' : 'badge-revoked';
    keyBadge.textContent = isActive ? 'Active' : 'Revoked';
  }

  const metaParts = [
    `Created: ${fmt(info.createdAt)}`,
    `Last used: ${fmt(info.lastUsedAt)}`
  ];
  if (!isActive) metaParts.push(`Revoked: ${fmt(info.revokedAt)}`);
  if (keyMeta) keyMeta.textContent = metaParts.join('   ·   ');

  setButtons(isActive);

  if (keyHint) {
    keyHint.textContent = isActive
      ? 'Rotating generates a new key and immediately invalidates the old one.'
      : 'This key is revoked. Generate a new one to use the companion app.';
  }
}

function openRevealModal(rawKey, title = 'Your companion app key') {
  if (!revealModal) return;
  if (revealTitle) revealTitle.textContent = title;
  if (revealKeyValue) revealKeyValue.textContent = rawKey;
  revealModal.classList.add('open');
}

function closeRevealModal() {
  if (revealModal) revealModal.classList.remove('open');
  if (revealKeyValue) revealKeyValue.textContent = '';
  refresh();
}

async function refresh() {
  if (keyLoadingEl) keyLoadingEl.style.display = '';
  if (keyNoneEl) keyNoneEl.style.display = 'none';
  if (keyExistsEl) keyExistsEl.style.display = 'none';

  try {
    const data = await fetchJSON('/admin/api/companion/key');
    renderKey(data.key);
  } catch (err) {
    if (keyLoadingEl) keyLoadingEl.style.display = 'none';
    showStatus('Failed to load key info: ' + err.message, 'error');
  }
}

async function generateKey() {
  showStatus('Generating key…', 'ok');
  try {
    const data = await fetchJSON('/admin/api/companion/key/generate', { method: 'POST' });
    showStatus('', 'ok');
    openRevealModal(data.key, 'Your new companion app key');
  } catch (err) {
    showStatus('Generate failed: ' + err.message, 'error');
  }
}

async function rotateKey() {
  if (!confirm('Rotate companion key? The old key will stop working immediately.')) return;
  showStatus('Rotating key…', 'ok');
  try {
    const data = await fetchJSON('/admin/api/companion/key/rotate', { method: 'POST' });
    showStatus('', 'ok');
    openRevealModal(data.key, 'Your rotated companion app key');
  } catch (err) {
    showStatus('Rotate failed: ' + err.message, 'error');
  }
}

async function revokeKey() {
  if (!confirm('Revoke this key? The companion app will lose access immediately.')) return;
  showStatus('Revoking key…', 'ok');
  try {
    await fetchJSON('/admin/api/companion/key/revoke', { method: 'POST' });
    showStatus('Key revoked.', 'ok');
    await refresh();
  } catch (err) {
    showStatus('Revoke failed: ' + err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (btnGenerate) btnGenerate.addEventListener('click', generateKey);
  if (btnGenerate2) btnGenerate2.addEventListener('click', generateKey);
  if (btnRotate) btnRotate.addEventListener('click', rotateKey);
  if (btnRevoke) btnRevoke.addEventListener('click', revokeKey);

  if (btnRevealCopy) {
    btnRevealCopy.addEventListener('click', async () => {
      const val = revealKeyValue ? revealKeyValue.textContent : '';
      try {
        await navigator.clipboard.writeText(val);
        btnRevealCopy.textContent = 'Copied!';
        setTimeout(() => { btnRevealCopy.textContent = 'Copy key'; }, 1500);
      } catch {
        alert('Copy failed — please select and copy the key manually.');
      }
    });
  }

  if (btnRevealClose) {
    btnRevealClose.addEventListener('click', closeRevealModal);
  }

  if (revealModal) {
    revealModal.addEventListener('click', (e) => {
      if (e.target === revealModal) closeRevealModal();
    });
  }

  refresh();
});
