// ====================================================================
// @sampo/site — diagnostic.js
// Per-diagnostic page interactivity. Loaded alongside app.js on
// kits/[slug]/ pages.
//   - Tab switching for the Option A/B/C prompt panels
//   - Copy-to-clipboard for prompt blocks
//
// All behavior is idempotent and bails cleanly if its target DOM
// isn't present — safe to load on any page in the site.
// ====================================================================

(function () {
  'use strict';

  // ── Tab switching ────────────────────────────────────────────────
  const tabs = document.querySelectorAll('.version-tab');
  const panels = document.querySelectorAll('.version-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const match = t === tab;
        t.classList.toggle('active', match);
        t.setAttribute('aria-selected', match ? 'true' : 'false');
      });
      panels.forEach((p) => {
        p.classList.toggle('active', p.id === 'panel-' + target);
      });
    });
  });

  // ── Copy-to-clipboard ────────────────────────────────────────────
  document.querySelectorAll('.prompt-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.copyTarget;
      const el = document.getElementById(targetId);
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.textContent);
        const original = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      } catch (err) {
        console.warn('clipboard write failed', err);
      }
    });
  });
})();
