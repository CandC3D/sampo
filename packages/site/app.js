// ====================================================================
// @sampo/site — app.js
// Wires up theme toggle, injects the mill mark into the lockup and
// any .sampo-watermark elements, sets favicons from SampoMill.iconMark.
//
// Intentionally small: the plan treats this site as static HTML with
// a glue layer for the handful of JS-required interactions (theme,
// SVG injection). Everything else is CSS.
// ====================================================================

(function () {
  'use strict';

  function injectMill() {
    const theme = window.SampoTheme.getTheme();

    // Header lockup (44px mill, no outer ring — tighter at small scale).
    const lockup = document.getElementById('lockupMark');
    if (lockup) {
      lockup.innerHTML = window.SampoMill.iconMark(44, {
        transparent: true,
        showOuter: false,
        theme,
      });
    }

    // Hero watermark (explicit ID) — default 420px if unsized.
    const heroWm = document.getElementById('heroWatermark');
    if (heroWm) {
      const size = parseInt(heroWm.dataset.size, 10) || 420;
      heroWm.innerHTML = window.SampoMill.iconMark(size, {
        transparent: true,
        showOuter: true,
        theme,
      });
    }

    // Generic watermarks (class-only). Read size from data-size
    // attribute, default 260. Same render options.
    document.querySelectorAll('.sampo-watermark:not(#heroWatermark)').forEach((el) => {
      const size = parseInt(el.dataset.size, 10) || 260;
      el.innerHTML = window.SampoMill.iconMark(size, {
        transparent: true,
        showOuter: true,
        theme,
      });
    });

    // 404 mill — standalone, no outer ring (matches the rotation trick).
    const nfMill = document.querySelector('.nf-mill');
    if (nfMill) {
      nfMill.innerHTML = window.SampoMill.iconMark(220, {
        transparent: true,
        showOuter: true,
        theme,
      });
    }

    // Kit card corner marks — subtle brand ornament per card.
    document.querySelectorAll('.sampo-corner-mark').forEach((el) => {
      el.innerHTML = window.SampoMill.iconMark(28, {
        transparent: true,
        showOuter: false,
        theme,
      });
    });

    // Favicons via data URI.
    setFavicons(theme);
  }

  function setFavicons(theme) {
    // 32px standard favicon.
    const favSvg = window.SampoMill.iconMark(64, { showOuter: false, theme });
    setLink('icon', 'image/svg+xml', 'data:image/svg+xml;utf8,' + encodeURIComponent(favSvg));

    // Apple touch icon — larger, with outer ring.
    const touchSvg = window.SampoMill.iconMark(180, { showOuter: true, theme });
    setLink('apple-touch-icon', null, 'data:image/svg+xml;utf8,' + encodeURIComponent(touchSvg));
  }

  function setLink(rel, type, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    if (type) el.type = type;
    el.href = href;
  }

  // Wire up the toggle. Also fires at init + on system-preference
  // flip, which is when we want to re-render the SVGs.
  window.SampoTheme.initThemeToggle({
    buttonSelector: '#themeToggle',
    onChange: injectMill,
  });
})();
