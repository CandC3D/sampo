// ====================================================================
// @sampo/brand — theme.js
// Theme resolution + manual toggle, portable across generator and site.
//
// Registers on window.SampoTheme for plain <script> consumption.
// (No ESM exports — matches the @sampo/brand convention of loading
// via plain <script> tags, no bundler required.)
//
// Contract:
//   window.SampoTheme.getTheme() → 'light' | 'dark'
//       Single source of truth is the --theme CSS custom prop; JS
//       reads the resolved value rather than duplicating the @media
//       / [data-theme] decision.
//
//   window.SampoTheme.applyTheme(theme)
//       Sets [data-theme] on <html> + persists to localStorage under
//       'sampo.theme'. Pass `null` to clear (system pref takes over).
//
//   window.SampoTheme.initThemeToggle({ buttonSelector, onChange })
//       Wires up a toggle button. Cycles system → light → dark →
//       system. Calls `onChange()` after each cycle so consumers can
//       re-render theme-sensitive SVGs (mill marks, favicons,
//       watermarks). `onChange` is also called once at init and
//       whenever the system preference flips.
//
// Call initThemeToggle() once per page load, after the DOM is ready.
// ====================================================================

(function () {
  'use strict';

  const LS_KEY = 'sampo.theme';

  function getTheme() {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--theme');
    return raw.trim().replace(/['"]/g, '') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
      localStorage.setItem(LS_KEY, theme);
    } else {
      root.removeAttribute('data-theme');
      localStorage.removeItem(LS_KEY);
    }
  }

  function initThemeToggle(opts) {
    opts = opts || {};
    const selector = opts.buttonSelector || '#themeToggle';
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

    const root = document.documentElement;

    // Restore persisted explicit choice (if any).
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'light' || saved === 'dark') {
      root.setAttribute('data-theme', saved);
    }

    // Re-notify when the system preference flips.
    if (onChange && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      onChange();
    }

    const btn = document.querySelector(selector);
    if (!btn) return;

    btn.addEventListener('click', function () {
      const current = root.getAttribute('data-theme');
      // system → light → dark → system
      let next;
      if (!current) next = 'light';
      else if (current === 'light') next = 'dark';
      else next = null;
      applyTheme(next);
      if (onChange) onChange();
    });
  }

  window.SampoTheme = { getTheme, applyTheme, initThemeToggle };
})();
