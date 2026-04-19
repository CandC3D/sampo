// ====================================================================
// sync-deploys.mjs
// Mirror one or more packages to their deploy repos.
//
// Each package in the workspace maps to a sibling deploy repo. This
// script copies the package's source files into that deploy repo,
// commits the changes, and pushes. The workspace is the single source
// of truth; deploy repos are thin mirrors of their package's shipped
// assets.
//
// Usage:
//   node scripts/sync-deploys.mjs brand
//   node scripts/sync-deploys.mjs generator site
//   node scripts/sync-deploys.mjs all
//
// The deploy repos are expected to live at:
//   ../sampo-brand/       (candc3d/sampo-brand)
//   ../sampo-graphics/    (candc3d/sampo-graphics)
//   ../sampo-site/        (candc3d/sampo-site)
// relative to the workspace root.
//
// No npm deps. Node ≥18.
// ====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SIBLINGS = path.resolve(ROOT, '..');

// Path rewrite for deployed consumers. Locally the generator and site
// pull brand assets via `../brand/src/...`. When deployed each lives
// in its own repo, so relative paths don't reach the brand package —
// we rewrite to the deployed brand URL instead.
const BRAND_HTTPS_BASE = 'https://candc3d.github.io/sampo-brand/src';

const PACKAGES = {
  brand: {
    src: path.join(ROOT, 'packages', 'brand'),
    deploy: path.join(SIBLINGS, 'sampo-brand'),
    // Files shipped to consumers. README/package.json ride along for
    // context on the deployed site; `src/` holds the actual assets;
    // `demos/` is publicly browseable at /sampo-brand/demos/.
    include: ['index.html', 'src', 'demos', 'README.md', 'package.json'],
    // Baseline files every deploy carries — copied from the deploy
    // repo itself (don't track in monorepo).
    baseline: ['google5315ac0eabfa5ec3.html', 'sitemap.xml'],
    rewrite: null, // no rewrites — brand is the source
  },
  generator: {
    src: path.join(ROOT, 'packages', 'generator'),
    deploy: path.join(SIBLINGS, 'sampo-graphics'),
    include: ['index.html', 'app.js', 'library.js'],
    baseline: ['google5315ac0eabfa5ec3.html', 'sitemap.xml'],
    rewrite: rewriteBrandPathsHTTPS,
  },
  site: {
    src: path.join(ROOT, 'packages', 'site'),
    deploy: path.join(SIBLINGS, 'sampo-site'),
    include: ['index.html', 'site.css', 'app.js', 'kits', 'about', '404.html'],
    baseline: ['google5315ac0eabfa5ec3.html', 'sitemap.xml'],
    rewrite: rewriteBrandPathsHTTPS,
  },
};

/**
 * For each text file, rewrite `<any number of ../>brand/src/...` to
 * the deployed HTTPS URL. Depth depends on where the consumer file
 * lives in the monorepo — generator is 1 up, site root is 1 up,
 * site's /kits/[slug]/ pages are 3 up. Preserves ?v=N cache-busting.
 */
function rewriteBrandPathsHTTPS(filePath) {
  // Only touch text formats that might reference brand paths.
  if (!/\.(html|css|js|md)$/i.test(filePath)) return;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = before.replace(
    /(?:\.\.\/)+brand\/src\//g,
    BRAND_HTTPS_BASE + '/',
  );
  if (after !== before) {
    fs.writeFileSync(filePath, after);
  }
}

function copyRecursive(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function walkFiles(dir, fn) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkFiles(p, fn);
    else fn(p);
  }
}

function sync(name) {
  const cfg = PACKAGES[name];
  if (!cfg) {
    console.error(`Unknown package: ${name}. Known: ${Object.keys(PACKAGES).join(', ')}`);
    process.exit(1);
  }
  if (!fs.existsSync(cfg.src)) {
    console.error(`Source missing: ${cfg.src}`);
    process.exit(1);
  }
  if (!fs.existsSync(cfg.deploy)) {
    console.error(`Deploy repo missing: ${cfg.deploy}. Clone it first.`);
    process.exit(1);
  }

  console.log(`\n━━━ ${name} ━━━`);
  console.log(`src:    ${cfg.src}`);
  console.log(`deploy: ${cfg.deploy}`);

  // Snapshot baseline files that live only in the deploy repo.
  const baselineSnapshot = {};
  for (const f of cfg.baseline) {
    const p = path.join(cfg.deploy, f);
    if (fs.existsSync(p)) baselineSnapshot[f] = fs.readFileSync(p);
  }

  // Wipe everything in the deploy repo except .git and baseline files.
  for (const entry of fs.readdirSync(cfg.deploy)) {
    if (entry === '.git') continue;
    if (cfg.baseline.includes(entry)) continue;
    fs.rmSync(path.join(cfg.deploy, entry), { recursive: true, force: true });
  }

  // Copy include list.
  for (const rel of cfg.include) {
    const s = path.join(cfg.src, rel);
    if (!fs.existsSync(s)) {
      console.warn(`  skip ${rel} (not in source)`);
      continue;
    }
    copyRecursive(s, path.join(cfg.deploy, rel));
    console.log(`  + ${rel}`);
  }

  // Path rewrites (for consumers — brand has none).
  if (cfg.rewrite) {
    walkFiles(cfg.deploy, (p) => {
      if (p.includes(path.sep + '.git' + path.sep)) return;
      cfg.rewrite(p);
    });
    console.log('  ~ rewrote ../brand/src/ paths to HTTPS');
  }

  // Restore baseline snapshots (in case .gitignore ate them).
  for (const [f, buf] of Object.entries(baselineSnapshot)) {
    fs.writeFileSync(path.join(cfg.deploy, f), buf);
  }

  // Stage, commit, push.
  const status = execSync('git status --porcelain', { cwd: cfg.deploy }).toString().trim();
  if (!status) {
    console.log('  (no changes)');
    return;
  }

  execSync('git add -A', { cwd: cfg.deploy, stdio: 'inherit' });
  const msg = `Sync from workspace (${name})`;
  execSync(`git commit -q -m "${msg}"`, { cwd: cfg.deploy, stdio: 'inherit' });
  execSync('git push', { cwd: cfg.deploy, stdio: 'inherit' });
  console.log(`  pushed.`);
}

const args = process.argv.slice(2);
const targets = args.includes('all') || args.length === 0
  ? Object.keys(PACKAGES)
  : args;

for (const t of targets) sync(t);
