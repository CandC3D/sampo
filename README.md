# sampo (workspace)

Source-of-truth monorepo for the Sampo Diagnostic Kit's visual system
and public web presence. Three packages, each deployed as its own
GitHub Pages site:

| Package | Deploy repo | Live URL |
|---|---|---|
| `packages/brand` | `candc3d/sampo-brand` | `https://candc3d.github.io/sampo-brand/` |
| `packages/generator` | `candc3d/sampo-graphics` | `https://candc3d.github.io/sampo-graphics/` |
| `packages/site` | `candc3d/sampo-site` | `https://candc3d.github.io/sampo-site/` |

The generator and the site both consume `@sampo/brand` via HTTPS —
one palette edit in `packages/brand/` ripples to every surface on the
next page load (bump `?v=N` on script/link tags to bust caches).

## Quick start

```
# Serve a package locally on its own port
npm run serve:brand      # http://localhost:3020
npm run serve:generator  # http://localhost:3021
npm run serve:site       # http://localhost:3022

# Mirror a package's files into its deploy repo and push
npm run sync:brand       # → candc3d/sampo-brand
npm run sync:generator   # → candc3d/sampo-graphics
npm run sync:site        # → candc3d/sampo-site
npm run sync:all
```

`scripts/sync-deploys.mjs` is a ~50-line file-copy + `git add/commit/push`
script. It's the only build step in the workspace. Packages don't
transpile; they ship plain HTML/CSS/JS.

## Why a workspace, not three loose repos

- One palette edit → one file in `packages/brand/` → both consumer
  deployments pick it up on their next sync.
- Local dev uses relative paths (`../brand/src/tokens.css`). Deployed
  pages use HTTPS paths to `candc3d.github.io/sampo-brand/`. Same
  filenames, different resolution.
- Git history stays in one place for the system as a whole.

## Why separate deploy repos

GitHub Pages serves one directory per repo (root or `/docs`). Three
consumer URLs require three repos. The monorepo is the upstream; the
three repos are downstream mirrors.

## Status

- **Phase 0** — complete. `@sampo/brand` extracted; generator consumes it.
- **Phase 1** — in progress. Self-host Instrument fonts; expand tokens.
- **Phase 2** — planned. Component demos, `.sampo-lockup`, `.sampo-watermark`.
- **Phase 3** — planned. Scaffold `packages/site/` (landing, kits
  index, per-diagnostic pages, 404). New parallel public site — the
  existing 14 diagnostic page repos under `candc3d/sampo-diagnostic-*`
  remain live and untouched.
- **Phases 5–6** — planned. Motion layer, polished system pages.
