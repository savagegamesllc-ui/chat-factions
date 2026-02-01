// public/js/wikiDrawer.js
'use strict';

(function () {
  const drawer = document.getElementById('wikiDrawer');
  const toggle = document.getElementById('wikiToggleBtn');
  if (!drawer || !toggle) return;

  const closeEls = drawer.querySelectorAll('[data-wiki-close]');
  const panel = drawer.querySelector('.wiki-drawer__panel');

  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    // focus for accessibility
    setTimeout(() => panel?.focus?.(), 0);
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function isOpen() {
    return drawer.classList.contains('open');
  }

  toggle.addEventListener('click', () => (isOpen() ? closeDrawer() : openDrawer()));

  closeEls.forEach(el => el.addEventListener('click', closeDrawer));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeDrawer();
  });
})();
