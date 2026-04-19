# @sampo/brand

Shared visual system for the Sampo Diagnostic Kit. The single source of
truth for palette, typography, component primitives, and the mill brand
mark. Consumed by **sampo-graphics** (the generator) and **sampo-site**
(the public pages).

---

## What's in here

```
src/
├── mill.js         — brand compositor (pure SVG strings, no DOM)
├── theme.js        — getTheme / applyTheme / initThemeToggle
├── tokens.css      — palette, type scale, spacing, radii
├── themes.css      — @media dark + [data-theme] overrides
├── components.css  — theme toggle, preview card, corner mark, toast,
│                     section headings, canvas watermark
├── motion.css      — prefers-reduced-motion policy (shared)
└── fonts/          — self-hosted Instrument Sans + Instrument Serif
                      (added in Phase 1)
```

No build step. Every file is consumed as-is: CSS via `<link>` tags,
JS via plain `<script>` tags that register on `window.*`.

## How consumers load it

Two mechanisms, depending on whether you're running the monorepo
locally or loading from the deployed `@sampo/brand` GitHub Pages site.

### Local (inside the monorepo)

Relative paths from a sibling package:

```html
<link rel="stylesheet" href="../brand/src/tokens.css">
<link rel="stylesheet" href="../brand/src/themes.css">
<link rel="stylesheet" href="../brand/src/components.css">
<link rel="stylesheet" href="../brand/src/motion.css">
<script src="../brand/src/mill.js"></script>
<script src="../brand/src/theme.js"></script>
```

### Deployed

Each consumer's deploy repo pulls from the sampo-brand GitHub Pages
site (CDN-style, cache-busted with `?v=N`):

```html
<link rel="stylesheet" href="https://candc3d.github.io/sampo-brand/src/tokens.css?v=1">
<link rel="stylesheet" href="https://candc3d.github.io/sampo-brand/src/themes.css?v=1">
<link rel="stylesheet" href="https://candc3d.github.io/sampo-brand/src/components.css?v=1">
<link rel="stylesheet" href="https://candc3d.github.io/sampo-brand/src/motion.css?v=1">
<script src="https://candc3d.github.io/sampo-brand/src/mill.js?v=1"></script>
<script src="https://candc3d.github.io/sampo-brand/src/theme.js?v=1"></script>
```

## API surface

### `window.SampoMill` (from mill.js)

| Export | Purpose |
|---|---|
| `SAMPO` | Palette constants (`BG`, `INK`, `PUMPKIN`, `OLIVE`, `STEEL`, …) |
| `millMark(cx, cy, scale, opts)` | 8-spoke brand mill. `opts.theme: 'light' \| 'dark'` for palette swap. |
| `iconMark(size, opts)` | Favicon-safe mill — no text, no outer ring, optional solid bg. |
| `composePreview(variant, data)` | Full-bleed compositor. `variant` is `'og' \| 'og_square' \| 'github' \| 'substack'`; `data` is `{ kitLabel?, diagnosticLabel?, slug? }`. Omit `kitLabel` for a generic kit-level preview. |

### `window.SampoTheme` (from theme.js)

| Export | Purpose |
|---|---|
| `getTheme()` | Returns `'light'` or `'dark'`. Reads from `--theme` CSS custom prop. |
| `applyTheme(theme)` | Sets `[data-theme]` on `<html>` and persists. `theme = null` clears the override. |
| `initThemeToggle({ buttonSelector, onChange })` | Wires a toggle button. `onChange` fires on every cycle + whenever the system preference flips — consumers use it to re-render theme-sensitive SVGs. |

## Typography

**Instrument Serif** (display, italic accents) paired with **Instrument
Sans** (body, UI, wordmark) and a **system mono** stack for slugs and
code. Self-hosted in `src/fonts/`.

The pairing is carried forward from the generator's original
`<link href="https://fonts.googleapis.com/...">` load. The italic
Instrument Serif is a brand hallmark — it appears in the generator's
subtitle, section captions, kit meta strings, and preview-card dim
labels. Keep the italic usage consistent across surfaces.

Fallback stack favors warm humanist counters (Iowan Old Style, Cambria)
over Georgia when the woff2 fails to load.

## Design rules that show up across files

1. **Cream in both themes.** `--card-bg` stays at `#F2EEDC` in dark
   mode too. Preview cards show what the exported asset looks like.
   Inverting them to dark would lie about what ships.
2. **CSS is the source of truth for the theme decision.** `--theme`
   resolves to `'light'` or `'dark'` based on the cascade; JS reads
   the resolved value rather than re-deriving it from localStorage +
   matchMedia.
3. **Graphic-palette tokens never change.** `--g-bg`, `--g-ink`,
   `--g-pumpkin`, `--g-olive`, `--g-steel` are theme-invariant. They
   match the exported PNG cards exactly.
4. **Mill geometry is computed from a single `scale` factor.** Rings,
   spokes, and hex circles never drift across sizes. See `mill.js`.

## Do not

- **Do not use `<foreignObject>` inside any SVG.** It breaks the
  SVG-to-PNG pipeline in `app.js`.
- **Do not inline new palette values.** Grab them from `SAMPO` in
  `mill.js` or the tokens above.
- **Do not cache `getTheme()`.** The media-query listener re-fires on
  system preference change; always read at render time.

## Changelog

**0.1.0 — Phase 0** (April 2026)
- Extracted tokens, themes, components, motion from the generator.
- Mill compositor ported verbatim.
- `window.SampoTheme` lifted out of the generator's `app.js`.

**0.2.0 — Phase 1** *(upcoming)*
- Self-hosted Instrument Sans + Instrument Serif (woff2).
- Full type scale + spacing + radius tokens.

**0.3.0 — Phase 2** *(upcoming)*
- Component demos at `demos/`.
- `.sampo-lockup`, `.sampo-divider`, `.sampo-watermark` primitives.
