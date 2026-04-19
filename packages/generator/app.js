// ====================================================================
// Sampo Web Graphics — app
// ====================================================================

let LIBRARY = window.SampoLibrary.loadLibrary();
function DIAGNOSTICS() { return window.SampoLibrary.flattenDiagnostics(LIBRARY); }

window.addEventListener('library:changed', (e) => {
  LIBRARY = e.detail;
  populateCanvas();
  populateGeneratorSelect(true);
  renderGenerator();
  populateExportGrid();
  renderLibrary();
});

const VARIANTS = [
  { key: 'og',       W: 1200, H: 630,  label: 'OG / Twitter Card',   purpose: 'Social share preview',            fileTpl: 'og_{slug}.png' },
  { key: 'square',   W: 1200, H: 1200, label: 'Square (Google Discover)', purpose: 'Image search, Pinterest',   fileTpl: 'og_square_{slug}.png' },
  { key: 'github',   W: 1280, H: 640,  label: 'GitHub social preview', purpose: 'Repo Settings → Social preview', fileTpl: 'github_{slug}.png' },
  { key: 'substack', W: 1100, H: 220,  label: 'Substack header',     purpose: 'Publication banner',              fileTpl: 'substack_header.png' },
];

// ====================================================================
// Theme toggle — now provided by @sampo/brand.
// initThemeToggle() is called later (after brandInit is defined), see
// the tail of this file. `onChange: applyBrand` re-renders all the
// theme-sensitive SVGs (lockup, favicons, watermarks, corner marks)
// whenever the toggle cycles or the system preference flips.

// ====================================================================
// Tabs
// ====================================================================
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
    localStorage.setItem('sampo.tab', tab);
  });
});
const savedTab = localStorage.getItem('sampo.tab');
if (savedTab) document.querySelector(`nav.tabs button[data-tab="${savedTab}"]`)?.click();

// ====================================================================
// Brand — inject lockup mark + set favicons from the mill system
// ====================================================================
// getTheme() is provided by @sampo/brand at window.SampoTheme.getTheme.
const getTheme = () => window.SampoTheme.getTheme();

function brandInit() {
  // Wire up the toggle and arrange for applyBrand() to fire on every
  // cycle or system-preference change. initThemeToggle also calls
  // onChange once at init so the initial paint is correct.
  window.SampoTheme.initThemeToggle({
    buttonSelector: '#themeToggle',
    onChange: applyBrand,
  });
}

function applyBrand() {
  const theme = getTheme();
  // Header lockup: transparent-bg mill mark, no outer ring (tighter at small scale)
  const lockupMark = document.getElementById('lockupMark');
  if (lockupMark) {
    lockupMark.innerHTML = SampoMill.iconMark(44, { transparent: true, showOuter: false, theme });
  }

  // Favicons: SVG data URIs, theme-aware so the hub inverts in dark.
  const fav32Svg = SampoMill.iconMark(64, { showOuter: false, theme });
  addLink('icon', 'image/svg+xml', 'data:image/svg+xml;utf8,' + encodeURIComponent(fav32Svg));

  const touchSvg = SampoMill.iconMark(180, { showOuter: true, theme });
  addLink('apple-touch-icon', null, 'data:image/svg+xml;utf8,' + encodeURIComponent(touchSvg));

  // Decorative marks elsewhere in the UI re-render on theme change.
  renderDecorativeMarks(theme);
}

function renderDecorativeMarks(theme) {
  // Canvas watermark
  const wm = document.getElementById('canvasWatermark');
  if (wm) wm.innerHTML = SampoMill.iconMark(180, { transparent: true, showOuter: true, theme });

  // Empty-state background mills
  document.querySelectorAll('[data-empty-mark]').forEach(el => {
    el.innerHTML = SampoMill.iconMark(140, { transparent: true, showOuter: false, theme });
  });

  // Library kit corner marks — each kit card's decorative mill (rotated by kit id)
  document.querySelectorAll('[data-kit-mark]').forEach(el => {
    el.innerHTML = SampoMill.iconMark(52, { transparent: true, showOuter: false, theme });
  });
}

function addLink(rel, type, href) {
  document.querySelectorAll(`link[rel="${rel}"]`).forEach(l => l.remove());
  const link = document.createElement('link');
  link.rel = rel;
  if (type) link.type = type;
  link.href = href;
  document.head.appendChild(link);
}

// ====================================================================
// Toast
// ====================================================================
const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// ====================================================================
// Canvas tab — render the generic kit assets + one per-diagnostic sample
// ====================================================================
function card(title, dimLabel, svgMarkup, exportFn) {
  const wrap = document.createElement('div');
  wrap.className = 'preview-card';
  wrap.innerHTML = `
    <div class="meta">
      <div class="title">${title}</div>
      <div class="dim">${dimLabel}</div>
      <div class="actions">
        <button class="btn" data-action="copy-svg">Copy SVG</button>
        <button class="btn primary" data-action="png">Download PNG</button>
      </div>
    </div>
    <div class="preview-frame">${svgMarkup}</div>
  `;
  wrap.querySelector('[data-action="png"]').addEventListener('click', exportFn);
  wrap.querySelector('[data-action="copy-svg"]').addEventListener('click', () => {
    navigator.clipboard.writeText(svgMarkup).then(() => toast('SVG copied'));
  });
  return wrap;
}

function populateCanvas() {
  const grid = document.getElementById('canvasGrid');
  grid.innerHTML = '';

  // 1) Generic kit landing assets (no dimension label)
  const genericData = { kitLabel: '', subtitle: 'Measuring the health of human–AI exchange' };
  for (const v of VARIANTS) {
    const { svg } = SampoMill.composePreview(v.key, genericData);
    const file = v.fileTpl.replace('{slug}', '').replace('_.', '.').replace('__', '_');
    const outName = v.key === 'substack' ? 'substack_header.png'
                   : v.key === 'og'       ? 'og_image.png'
                   : v.key === 'square'   ? 'og_square.png'
                   : 'github_social_preview.png';
    grid.appendChild(card(
      `Generic · ${v.label}`,
      `${v.W}×${v.H} · ${outName}`,
      svg,
      () => downloadSvgAsPng(svg, v.W, v.H, outName)
    ));
  }

  // 2) One sample per-diagnostic (D3 Epistemic Overreach) to show the extra line
  const sample = { kitLabel: 'D3: Epistemic Overreach', subtitle: 'Measuring the health of human–AI exchange' };
  for (const v of VARIANTS) {
    if (v.key === 'substack') continue;
    const { svg } = SampoMill.composePreview(v.key, sample);
    const outName = v.fileTpl.replace('{slug}', 'kit2d3');
    grid.appendChild(card(
      `Per-diagnostic · ${v.label}`,
      `${v.W}×${v.H} · ${outName}`,
      svg,
      () => downloadSvgAsPng(svg, v.W, v.H, outName)
    ));
  }
}

// ====================================================================
// Generator tab
// ====================================================================
function populateGeneratorSelect(preserveSelection = false) {
  const sel = document.getElementById('genDim');
  const prev = sel.value;
  sel.innerHTML = '<option value="">(generic kit — no dimension)</option>';
  for (const d of DIAGNOSTICS()) {
    const opt = document.createElement('option');
    opt.value = d.slug;
    opt.textContent = `${d.kitTitle || 'Kit ' + d.kit} · ${d.label}`;
    sel.appendChild(opt);
  }
  if (preserveSelection && (prev === '' || [...sel.options].some(o => o.value === prev))) {
    sel.value = prev;
  } else if (!preserveSelection) {
    sel.value = 'kit2d3';
  }
}

let generatorWired = false;
function wireGenerator() {
  if (generatorWired) return;
  generatorWired = true;
  const sel = document.getElementById('genDim');
  sel.addEventListener('change', () => {
    const d = DIAGNOSTICS().find(x => x.slug === sel.value);
    if (d) {
      document.getElementById('genLabel').value = d.label;
      document.getElementById('genSlug').value = d.slug;
    } else {
      document.getElementById('genLabel').value = '';
      document.getElementById('genSlug').value = 'kit';
    }
    renderGenerator();
  });
  ['genLabel','genSubtitle','genAttribution','genSlug'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderGenerator);
  });
}

function genState() {
  return {
    kitLabel: document.getElementById('genLabel').value,
    subtitle: document.getElementById('genSubtitle').value,
    attribution: document.getElementById('genAttribution').value,
    slug: document.getElementById('genSlug').value || 'kit',
  };
}

function renderGenerator() {
  const s = genState();
  const wrap = document.getElementById('genPreviews');
  wrap.innerHTML = '';
  for (const v of VARIANTS) {
    if (v.key === 'substack') continue;
    const { svg } = SampoMill.composePreview(v.key, s);
    const outName = v.fileTpl.replace('{slug}', s.slug);
    wrap.appendChild(card(
      v.label,
      `${v.W}×${v.H} · ${outName}`,
      svg,
      () => downloadSvgAsPng(svg, v.W, v.H, outName)
    ));
  }
}

async function exportOne(variantKey) {
  const s = genState();
  const v = VARIANTS.find(x => x.key === variantKey);
  const { svg } = SampoMill.composePreview(variantKey, s);
  const outName = v.fileTpl.replace('{slug}', s.slug);
  await downloadSvgAsPng(svg, v.W, v.H, outName);
}

async function exportAllForOneDiagnostic() {
  const s = genState();
  const zip = new JSZip();
  for (const v of VARIANTS) {
    if (v.key === 'substack') continue;
    const { svg } = SampoMill.composePreview(v.key, s);
    const blob = await svgToPngBlob(svg, v.W, v.H);
    zip.file(v.fileTpl.replace('{slug}', s.slug), blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, `sampo_${s.slug}.zip`);
}

// ====================================================================
// Favicons tab
// ====================================================================
function populateFavicons() {
  const row = document.getElementById('faviconRow');
  row.innerHTML = '';

  const tiles = [
    { size: 32,  label: 'favicon-32x32.png',    file: 'favicon-32x32.png',   displayScale: 4,  opts: { showOuter: false } },
    { size: 64,  label: 'favicon.svg (64 ref)', file: 'favicon.svg',         displayScale: 2,  opts: { showOuter: true }, isSvg: true },
    { size: 180, label: 'apple-touch-icon.png', file: 'apple-touch-icon.png', displayScale: 1,  opts: { showOuter: true } },
    { size: 512, label: 'mill_standalone',      file: 'mill_icon_standalone.png', displayScale: 0.5, opts: { showOuter: true } },
  ];
  for (const t of tiles) {
    const tile = document.createElement('div');
    tile.className = 'favicon-tile';
    const svg = SampoMill.iconMark(t.size, t.opts);
    tile.innerHTML = `
      <div class="tile-inner">
        <div style="width:${t.size * t.displayScale}px; height:${t.size * t.displayScale}px;">${svg}</div>
      </div>
      <div class="tile-label">
        <strong>${t.size}×${t.size}</strong>
        ${t.file}
      </div>
      <div style="margin-top:10px; display:flex; gap:6px; justify-content:center;">
        <button class="btn primary" data-action="png">Download PNG</button>
        ${t.isSvg ? '<button class="btn" data-action="svg">Download SVG</button>' : ''}
      </div>
    `;
    tile.querySelector('[data-action="png"]').addEventListener('click', () => {
      downloadSvgAsPng(svg, t.size, t.size, t.file.replace('.svg', '.png'));
    });
    const svgBtn = tile.querySelector('[data-action="svg"]');
    if (svgBtn) svgBtn.addEventListener('click', () => downloadSvg(svg, 'favicon.svg'));
    row.appendChild(tile);
  }

  // also scale the SVGs inside
  row.querySelectorAll('.tile-inner svg').forEach(s => {
    s.setAttribute('width', '100%');
    s.setAttribute('height', '100%');
  });
}

// ====================================================================
// Export tab — batch
// ====================================================================
function populateExportGrid() {
  const grid = document.getElementById('exportGrid');
  grid.innerHTML = '';

  const items = [];
  // Generic
  items.push({ section: 'Generic',  file: 'og_image.png',              desc: '1200×630 · OG/Twitter card',       render: () => SampoMill.composePreview('og',       { kitLabel: '' }) });
  items.push({ section: 'Generic',  file: 'og_square.png',             desc: '1200×1200 · Discover/search',       render: () => SampoMill.composePreview('square',   { kitLabel: '' }) });
  items.push({ section: 'Generic',  file: 'github_social_preview.png', desc: '1280×640 · Repo social preview',    render: () => SampoMill.composePreview('github',   { kitLabel: '' }) });
  items.push({ section: 'Generic',  file: 'substack_header.png',       desc: '1100×220 · Publication header',     render: () => SampoMill.composePreview('substack', { kitLabel: '' }) });

  // Favicons
  items.push({ section: 'Favicons', file: 'favicon-32x32.png',         desc: '32×32 · browser tab',               render: () => ({ svg: SampoMill.iconMark(32,  { showOuter: false }), W: 32,  H: 32 }) });
  items.push({ section: 'Favicons', file: 'apple-touch-icon.png',      desc: '180×180 · iOS home',                render: () => ({ svg: SampoMill.iconMark(180, { showOuter: true }),  W: 180, H: 180 }) });
  items.push({ section: 'Favicons', file: 'favicon.svg',               desc: 'Scalable · vector favicon',         render: () => ({ svg: SampoMill.iconMark(64,  { showOuter: true }),  W: 64,  H: 64, asSvg: true }) });
  items.push({ section: 'Favicons', file: 'mill_icon_standalone.png',  desc: '1200×1200 · reuse',                 render: () => ({ svg: SampoMill.iconMark(1200,{ showOuter: true }),  W: 1200, H: 1200 }) });

  // Per-diagnostic
  for (const d of DIAGNOSTICS()) {
    for (const v of ['og', 'square', 'github']) {
      const va = VARIANTS.find(x => x.key === v);
      const file = va.fileTpl.replace('{slug}', d.slug);
      items.push({
        section: `${d.kitTitle || 'Kit ' + d.kit} · ${d.label}`,
        file,
        desc: `${va.W}×${va.H} · ${va.label}`,
        render: () => SampoMill.composePreview(v, { kitLabel: d.label })
      });
    }
  }

  // Group by section
  const groups = {};
  for (const it of items) (groups[it.section] ||= []).push(it);

  for (const [section, arr] of Object.entries(groups)) {
    const h = document.createElement('div');
    h.style.cssText = 'grid-column: 1 / -1; margin: 12px 0 -4px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted);';
    h.textContent = section;
    grid.appendChild(h);
    for (const it of arr) {
      const cell = document.createElement('div');
      cell.className = 'export-cell';
      cell.innerHTML = `
        <h4>${it.file}</h4>
        <div class="desc">${it.desc}</div>
        <div class="actions">
          <button class="btn primary" data-kind="png">Download</button>
        </div>
      `;
      cell.querySelector('[data-kind="png"]').addEventListener('click', async () => {
        const r = it.render();
        if (r.asSvg) {
          downloadSvg(r.svg, it.file);
        } else {
          await downloadSvgAsPng(r.svg, r.W, r.H, it.file);
        }
      });
      grid.appendChild(cell);
    }
  }
}

async function exportEverything() {
  toast('Rendering all assets…');
  const zip = new JSZip();

  // Generic
  const generic = zip.folder('sampo-assets');
  const addPng = async (folder, name, svg, W, H) => {
    const blob = await svgToPngBlob(svg, W, H);
    folder.file(name, blob);
  };

  // Favicons
  await addPng(generic, 'favicon-32x32.png',        SampoMill.iconMark(32,  { showOuter: false }), 32,  32);
  await addPng(generic, 'apple-touch-icon.png',     SampoMill.iconMark(180, { showOuter: true }),  180, 180);
  await addPng(generic, 'mill_icon_standalone.png', SampoMill.iconMark(1200,{ showOuter: true }),  1200, 1200);
  generic.file('favicon.svg', SampoMill.iconMark(64, { showOuter: true }));

  // Generic kit assets
  for (const v of VARIANTS) {
    const { svg } = SampoMill.composePreview(v.key, { kitLabel: '' });
    const name =
      v.key === 'og'       ? 'og_image.png' :
      v.key === 'square'   ? 'og_square.png' :
      v.key === 'github'   ? 'github_social_preview.png' :
                             'substack_header.png';
    await addPng(generic, name, svg, v.W, v.H);
  }

  // Per-diagnostic
  for (const d of DIAGNOSTICS()) {
    const dirName = `kit${d.kit}_${d.slug}`;
    const sub = generic.folder(dirName);
    for (const vkey of ['og','square','github']) {
      const v = VARIANTS.find(x => x.key === vkey);
      const { svg } = SampoMill.composePreview(vkey, { kitLabel: d.label });
      const name = v.fileTpl.replace('{slug}', d.slug);
      await addPng(sub, name, svg, v.W, v.H);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, 'sampo-web-graphics.zip');
  toast('Done.');
}

async function exportGenericOnly() {
  const zip = new JSZip();
  for (const v of VARIANTS) {
    const { svg } = SampoMill.composePreview(v.key, { kitLabel: '' });
    const name =
      v.key === 'og'       ? 'og_image.png' :
      v.key === 'square'   ? 'og_square.png' :
      v.key === 'github'   ? 'github_social_preview.png' :
                             'substack_header.png';
    const blob = await svgToPngBlob(svg, v.W, v.H);
    zip.file(name, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, 'sampo-generic.zip');
}

async function exportFaviconsOnly() {
  const zip = new JSZip();
  zip.file('favicon-32x32.png',     await svgToPngBlob(SampoMill.iconMark(32,  { showOuter: false }), 32,  32));
  zip.file('apple-touch-icon.png',  await svgToPngBlob(SampoMill.iconMark(180, { showOuter: true }),  180, 180));
  zip.file('mill_icon_standalone.png', await svgToPngBlob(SampoMill.iconMark(1200,{ showOuter: true }), 1200, 1200));
  zip.file('favicon.svg', SampoMill.iconMark(64, { showOuter: true }));
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, 'sampo-favicons.zip');
}

// ====================================================================
// SVG → PNG
// ====================================================================
function svgToPngBlob(svgMarkup, W, H) {
  return new Promise((resolve, reject) => {
    const svg = svgMarkup.includes('xmlns="http://www.w3.org/2000/svg"')
      ? svgMarkup
      : svgMarkup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F5F0E8';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function downloadSvgAsPng(svgMarkup, W, H, filename) {
  try {
    const blob = await svgToPngBlob(svgMarkup, W, H);
    triggerDownload(blob, filename);
    toast(`Saved ${filename}`);
  } catch (e) {
    console.error(e);
    toast('Export failed — see console');
  }
}

function downloadSvg(svgMarkup, filename) {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename);
  toast(`Saved ${filename}`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ====================================================================
// Library tab
// ====================================================================
function renderLibrary() {
  const wrap = document.getElementById('libKits');
  if (!wrap) return;
  wrap.innerHTML = '';

  for (const kit of LIBRARY.kits) {
    const kitEl = document.createElement('div');
    kitEl.className = 'lib-kit';
    kitEl.dataset.kitId = kit.id;

    const diagCount = kit.diagnostics.length;
    const metaText = diagCount === 0
      ? 'no diagnostics yet'
      : `${diagCount} diagnostic${diagCount === 1 ? '' : 's'}`;

    kitEl.innerHTML = `
      <div class="lib-kit-head">
        <span class="lib-kit-corner-mark" data-kit-mark aria-hidden="true"></span>
        <input class="lib-kit-title" value="${escapeAttr(kit.title)}" data-action="rename-kit"/>
        <span class="lib-kit-meta">${metaText}</span>
        <div class="lib-kit-actions">
          <button class="btn" data-action="remove-kit">Remove kit</button>
        </div>
      </div>
      <div class="lib-diags"></div>
      <button class="lib-add-diag" data-action="add-diag">+ Add diagnostic to ${escapeAttr(kit.title)}</button>
    `;

    const diagsWrap = kitEl.querySelector('.lib-diags');
    for (const dx of kit.diagnostics) {
      const diagEl = document.createElement('div');
      diagEl.className = 'lib-diag';
      diagEl.dataset.d = dx.d;
      const slug = `kit${kit.id}d${dx.d}`;
      diagEl.innerHTML = `
        <span class="diag-slug">${slug}</span>
        <input class="diag-label" value="${escapeAttr(dx.label)}" data-action="rename-diag"/>
        <button class="remove-btn" data-action="remove-diag" title="Remove">×</button>
      `;
      diagsWrap.appendChild(diagEl);
    }

    // Kit-level wiring
    kitEl.querySelector('[data-action="rename-kit"]').addEventListener('change', (e) => {
      LIBRARY = window.SampoLibrary.renameKit(LIBRARY, kit.id, e.target.value.trim() || `Kit ${kit.id}`);
      window.SampoLibrary.saveLibrary(LIBRARY);
    });
    kitEl.querySelector('[data-action="remove-kit"]').addEventListener('click', () => {
      if (!confirm(`Remove ${kit.title}? Its ${diagCount} diagnostic${diagCount === 1 ? '' : 's'} will be deleted.`)) return;
      LIBRARY = window.SampoLibrary.removeKit(LIBRARY, kit.id);
      window.SampoLibrary.saveLibrary(LIBRARY);
    });
    kitEl.querySelector('[data-action="add-diag"]').addEventListener('click', () => {
      LIBRARY = window.SampoLibrary.addDiagnostic(LIBRARY, kit.id);
      window.SampoLibrary.saveLibrary(LIBRARY);
    });

    // Diagnostic wiring
    diagsWrap.querySelectorAll('.lib-diag').forEach(diagEl => {
      const d = parseInt(diagEl.dataset.d, 10);
      diagEl.querySelector('[data-action="rename-diag"]').addEventListener('change', (e) => {
        LIBRARY = window.SampoLibrary.renameDiagnostic(LIBRARY, kit.id, d, e.target.value.trim() || `D${d}: (untitled)`);
        window.SampoLibrary.saveLibrary(LIBRARY);
      });
      diagEl.querySelector('[data-action="remove-diag"]').addEventListener('click', () => {
        LIBRARY = window.SampoLibrary.removeDiagnostic(LIBRARY, kit.id, d);
        window.SampoLibrary.saveLibrary(LIBRARY);
      });
    });

    wrap.appendChild(kitEl);
  }

  // Re-render decorative kit marks after re-building DOM
  if (typeof renderDecorativeMarks === 'function') {
    renderDecorativeMarks(getTheme());
  }
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

let libraryToolbarWired = false;
function wireLibraryToolbar() {
  if (libraryToolbarWired) return;
  libraryToolbarWired = true;

  document.getElementById('libAddKit').addEventListener('click', () => {
    LIBRARY = window.SampoLibrary.addKit(LIBRARY);
    window.SampoLibrary.saveLibrary(LIBRARY);
  });

  document.getElementById('libReset').addEventListener('click', () => {
    if (!confirm('Reset all kits and diagnostics to defaults? Your custom entries will be lost.')) return;
    LIBRARY = window.SampoLibrary.resetLibrary();
    // resetLibrary dispatches the event already
  });

  document.getElementById('libExportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(LIBRARY, null, 2)], { type: 'application/json' });
    triggerDownload(blob, 'sampo-library.json');
    toast('Library exported');
  });

  document.getElementById('libImportJson').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.kits)) throw new Error('Invalid library shape — expected { kits: [...] }');
        LIBRARY = parsed;
        window.SampoLibrary.saveLibrary(LIBRARY);
        toast('Library imported');
      } catch (e) {
        alert('Import failed: ' + e.message);
      }
    });
    input.click();
  });
}

// ====================================================================
// Init
// ====================================================================
brandInit();
populateCanvas();
populateGeneratorSelect();
wireGenerator();
renderGenerator();
populateFavicons();
populateExportGrid();
renderLibrary();
wireLibraryToolbar();
