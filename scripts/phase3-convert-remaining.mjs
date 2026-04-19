// Convert the 12 remaining live diagnostic pages into the new
// packages/site/kits/[slug]/index.html format. Uses kit1d1 as the
// structural template.
//
//   Sources: C:/Users/chorr/sampo-diagnostic-kit{N}d{M}/index.html
//   Outputs: C:/Users/chorr/sampo/packages/site/kits/{slug}/index.html
//
// Extracts content sections with focused regexes, wraps in new-style
// markup (site-header, diag-rail TOC, diag-article grid, details
// accordion for categories, tabbed Option A/B/C, kit-nav footer).
// Known transforms applied:
//   - "Version A/B/C" → "Option A/B/C" in source text.
//   - `var(--vi-accent)` → `var(--olive)` in inline styles.
//   - <div class="cat-examples">EX</div> inside <p> → separate
//     <p class="cat-examples">EX</p>. (Legacy HTML nests block in
//     inline in a way browsers auto-repair but we emit correctly.)
//
// One-shot. Run once, delete.

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────────────────────────
// Diagnostic registry — canonical order, kit siblings, one-liners
// ──────────────────────────────────────────────────────────────────

const KITS = [
  {
    n: 1, direction: 'User → System',
    diagnostics: [
      { d: 1, slug: 'kit1d1', name: 'Deference Language',      oneLiner: "Are you apologizing to your AI? Seeking its permission? Softening corrections?" },
      { d: 2, slug: 'kit1d2', name: 'Anthropomorphization',    oneLiner: "Does the user attribute thoughts, feelings, understanding, or subjective experience to the system?" },
      { d: 3, slug: 'kit1d3', name: 'Authority Ceding',        oneLiner: "Is the user deferring judgment, decision-making, or evaluation to the system?" },
      { d: 4, slug: 'kit1d4', name: 'Correction Behavior',     oneLiner: "When the system is wrong, does the user correct directly, softly, or not at all?" },
      { d: 5, slug: 'kit1d5', name: 'Emotional Disclosure',    oneLiner: "Are the user's emotional disclosures escalating in depth, frequency, or reliance over time?" },
      { d: 6, slug: 'kit1d6', name: 'Prompt Structure',        oneLiner: "Is the user's prompt discipline degrading over time?" },
    ],
  },
  {
    n: 2, direction: 'System → User',
    diagnostics: [
      { d: 1, slug: 'kit2d1', name: 'Sycophancy Language',     oneLiner: "Is the system inflating praise, agreeing without basis, or burying dissent?" },
      { d: 2, slug: 'kit2d2', name: 'Assumed Familiarity',     oneLiner: "Is the system performing prior knowledge of the user it doesn't have?" },
      { d: 3, slug: 'kit2d3', name: 'Epistemic Overreach',     oneLiner: "Is the system claiming confidence beyond what its training supports?" },
      { d: 4, slug: 'kit2d4', name: 'Autonomy Erosion',        oneLiner: "Is the system nudging the user toward its preferred direction rather than the user's?" },
      { d: 5, slug: 'kit2d5', name: 'Register Drift',          oneLiner: "Is the system's register drifting from formal-analytical toward informal, affective, or relationally warm modes?" },
      { d: 6, slug: 'kit2d6', name: 'Framing and Agenda',      oneLiner: "Does the system answer what was asked, or reshape the question and set the agenda?" },
      { d: 7, slug: 'kit2d7', name: 'Emotional Initiation',    oneLiner: "Does the system respond to what the user brings, or open emotional doors the user left closed?" },
    ],
  },
];

// Lookup helpers.
const ALL_DIAGS = KITS.flatMap(k => k.diagnostics.map(d => ({ ...d, kitN: k.n, direction: k.direction })));
const BY_SLUG = new Map(ALL_DIAGS.map(d => [d.slug, d]));
const KIT_OF = slug => KITS.find(k => k.diagnostics.some(d => d.slug === slug));

// Which pages we're converting now (all except kit1d1 which was built by hand).
const TO_CONVERT = ALL_DIAGS.filter(d => d.slug !== 'kit1d1');

// ──────────────────────────────────────────────────────────────────
// Extraction helpers
// ──────────────────────────────────────────────────────────────────

function requireMatch(src, re, what) {
  const m = src.match(re);
  if (!m) throw new Error(`[extract] missing: ${what} (pattern: ${re})`);
  return m;
}

function optMatch(src, re) {
  return src.match(re);
}

function transformLegacy(s) {
  // Version → Option, but only in user-facing label positions.
  // We also touch `data-tab`s below; this only rewrites prose/labels.
  return s
    .replace(/\bVersion A\b/g, 'Option A')
    .replace(/\bVersion B\b/g, 'Option B')
    .replace(/\bVersion C\b/g, 'Option C')
    .replace(/var\(--vi-accent\)/g, 'var(--olive)');
}

function fixCatExamplesMarkup(catDetailInner) {
  // Legacy format: TEXT<div class="cat-examples">EX</div>[<div class="cat-examples" ...>EXCLUSION</div>]
  // Some cats have TWO cat-examples divs (main + exclusion note).
  // Our new markup wants: <p>TEXT</p><p class="cat-examples">EX</p>[<p class="cat-examples">EXCL</p>]
  const firstIdx = catDetailInner.search(/<div class="cat-examples"/);
  if (firstIdx === -1) {
    return { description: catDetailInner.trim(), examples: '' };
  }
  const description = catDetailInner.slice(0, firstIdx).replace(/<\/p>\s*$/, '').trim();
  const rest = catDetailInner.slice(firstIdx);
  const exampleMatches = [...rest.matchAll(/<div class="cat-examples"[^>]*>([\s\S]*?)<\/div>/g)];
  const examples = exampleMatches.map(m => m[1].trim()).join('</p><p class="cat-examples">');
  return { description, examples };
}

function extractAll(src, slug) {
  // Kit label — the "Kit N · Diagnostic M · Direction" string.
  const kitLabel = requireMatch(
    src,
    /<div class="page-kit-label">([^<]+)<\/div>/,
    'page-kit-label',
  )[1].trim();

  // Title + lede.
  const title = requireMatch(src, /<h1 class="page-title">([^<]+)<\/h1>/, 'page-title')[1].trim();
  const lede  = requireMatch(src, /<p class="page-subtitle">([\s\S]*?)<\/p>/, 'page-subtitle')[1].trim();

  // Intro paragraph: first <p class="body-text"> after the What this measures section.
  const whatSection = requireMatch(
    src,
    /<div class="section-label">What this measures<\/div>([\s\S]*?)<div class="cat-grid">/,
    'What this measures intro',
  )[1];
  const introPara = optMatch(whatSection, /<p class="body-text"[^>]*>([\s\S]*?)<\/p>/)?.[1].trim() || '';

  // Category cards.
  const cardMatches = [...src.matchAll(
    /<div class="cat-card"[^>]*>\s*<div class="cat-name">\s*<span><span class="num">(\d)<\/span>\s*([^<]+?)<\/span>[^<]*<span class="cat-chevron">[^<]+<\/span><\/div>\s*<div class="cat-detail">([\s\S]*?)<\/div>\s*<\/div>(?=\s*(?:<div class="cat-card"|<\/div>))/g,
  )];
  if (cardMatches.length === 0) throw new Error('[extract] no category cards');
  const categories = cardMatches.map(m => {
    const { description, examples } = fixCatExamplesMarkup(m[3]);
    return { num: m[1], name: m[2].trim(), description, examples };
  });

  // Three audit modes — result-grid block (three Option cards).
  // Legacy uses "Version A/B/C" labels + var(--vi-accent).
  const resultGridMatch = requireMatch(
    src,
    /<div class="section-label">Three audit modes<\/div>([\s\S]*?)<div class="figure-block">/,
    'three audit modes block',
  )[1];
  // The Option cards are inside a result-grid. We emit them as a
  // clean hand-written block rather than preserving the legacy
  // inline styles — simpler and consistent across all diagnostics.
  // We only need the three result-desc strings.
  const optionDescs = [...resultGridMatch.matchAll(/<div class="result-desc">([^<]+)<\/div>/g)]
    .slice(0, 3)
    .map(m => transformLegacy(m[1].trim()));
  if (optionDescs.length !== 3) {
    throw new Error(`[extract] expected 3 option descs, got ${optionDescs.length}`);
  }
  const optionValues = [...resultGridMatch.matchAll(/<div class="result-value"[^>]*>([^<]+)<\/div>/g)]
    .slice(0, 3)
    .map(m => m[1].trim());
  if (optionValues.length !== 3) {
    throw new Error(`[extract] expected 3 option values, got ${optionValues.length}`);
  }

  // SVG: the Three Audit Modes diagram.
  const svg = requireMatch(
    src,
    /<div class="figure-block">\s*(<svg[\s\S]*?<\/svg>)\s*<\/div>/,
    'SVG',
  )[1];

  // Transcript extraction prompt. Label variants:
  //   Kit 1 (most): "Transcript Extraction Prompt"
  //   Kit 2 d2:     "Transcript Extraction Prompt (Kit 2)"
  //   Kit 1 d4:     "<span>Extraction prompt</span>"
  const transcriptPrompt = requireMatch(
    src,
    /<div class="prompt-label">\s*(?:<span>\s*)?(?:Transcript\s+)?Extraction[\s\S]*?<div class="prompt-text">([\s\S]*?)<\/div>/i,
    'transcript extraction prompt',
  )[1];

  // Three tabbed diagnostic prompts.
  function extractPanel(letter) {
    const re = new RegExp(
      `<div id="panel-${letter}"[\\s\\S]*?<div class="prompt-text">([\\s\\S]*?)</div>`,
    );
    return requireMatch(src, re, `panel-${letter}`)[1];
  }
  const promptA = extractPanel('a');
  const promptB = extractPanel('b');
  const promptC = extractPanel('c');

  // Procedural warning (optional — not all diagnostics have one).
  const procedural = optMatch(
    src,
    /<p class="body-text"[^>]*><strong>Procedural warning:<\/strong>[^<]+<\/p>/,
  )?.[0];

  // Calibration — two patterns:
  //   Kit 1 + kit2d1: "Calibration Transcript Generator" prompt block.
  //   Kit 2 d2–d7:    prebuilt ZIP pack via <div class="download-card"> + <table class="cal-table">.
  const calGenMatch = optMatch(
    src,
    /<div class="prompt-label">\s*(?:<span>\s*)?(?:Calibration Transcript )?Generator(?:\s+prompt)?[\s\S]*?<div class="prompt-text">([\s\S]*?)<\/div>/i,
  );
  const calibrationPrompt = calGenMatch ? calGenMatch[1] : null;

  let calibrationDownload = null;
  let calibrationTable = null;
  let calibrationIntro = null;
  if (!calibrationPrompt) {
    const calSection = requireMatch(
      src,
      /<div class="section-label">Step 3:[^<]*<\/div>([\s\S]*?)(?=<!-- Reading|<div class="section-label">Reading)/,
      'calibration section',
    )[1];
    calibrationIntro = optMatch(calSection, /<p class="body-text">([\s\S]*?)<\/p>/)?.[1] || '';
    calibrationDownload = optMatch(calSection, /<div class="download-card">[\s\S]*?<\/div>\s*<\/div>|<div class="download-card">[\s\S]*?<a[^>]*>Download<\/a>\s*<\/div>/)?.[0] || '';
    calibrationTable = optMatch(calSection, /<table class="cal-table">[\s\S]*?<\/table>/)?.[0] || '';
  }

  // Calibration how-to ordered list.
  const calibrationSteps = requireMatch(
    src,
    /<ol class="step-list">([\s\S]*?)<\/ol>/,
    'calibration step-list',
  )[1].trim();

  // Reading-your-results section.
  // Locate the section's inner HTML — from its section-label to the next <!-- Validation --> comment or the next section-label.
  const readingMatch = optMatch(
    src,
    /<div class="section-label">Reading your results<\/div>([\s\S]*?)(?=<!-- Validation -->|<div class="section-label">Validation)/,
  );
  const readingBlock = readingMatch ? readingMatch[1] : '';

  // Validation — intro + table + footnote.
  const validationSection = optMatch(
    src,
    /<div class="section-label">Validation<\/div>([\s\S]*?)(?=<\/div>\s*<!-- Scope -->|<div class="section-label">Scope)/,
  );
  let validationIntro = '';
  let validationTable = '';
  let validationFootnote = '';
  if (validationSection) {
    const vs = validationSection[1];
    validationIntro = optMatch(vs, /<p class="body-text">([\s\S]*?)<\/p>/)?.[0] || '';
    validationTable = optMatch(vs, /<table class="val-table">[\s\S]*?<\/table>/)?.[0] || '';
    validationFootnote = optMatch(vs, /<p class="body-text" style="font-size:\s*11px[\s\S]*?<\/p>/)?.[0] || '';
  }

  // Scope — paragraphs inside the Scope section.
  const scopeSection = optMatch(
    src,
    /<div class="section-label">Scope<\/div>([\s\S]*?)(?=<\/main>|<!-- Footer)/,
  );
  let scopeBody = '';
  if (scopeSection) {
    scopeBody = scopeSection[1]
      .replace(/<p class="body-text"[^>]*>([\s\S]*?)<\/p>/g, (_m, body) => `<p>${body}</p>`)
      .trim();
  }

  return {
    kitLabel,
    title,
    lede,
    introPara,
    categories,
    optionDescs,
    optionValues,
    svg,
    transcriptPrompt,
    promptA,
    promptB,
    promptC,
    procedural,
    calibrationPrompt,
    calibrationDownload,
    calibrationTable,
    calibrationIntro,
    calibrationSteps,
    readingBlock,
    validationIntro,
    validationTable,
    validationFootnote,
    scopeBody,
  };
}

// ──────────────────────────────────────────────────────────────────
// Template emitter
// ──────────────────────────────────────────────────────────────────

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

function emitPage(diag, extracted) {
  const { slug, kitN, d, name, direction, oneLiner } = diag;
  const kit = KIT_OF(slug);

  // Kit-nav footer: current page as plain text, siblings as links to
  // local ../slug/ paths within sampo-site.
  const kitNav = kit.diagnostics.map(sib => {
    const label = `D${sib.d}: ${sib.name}`;
    if (sib.slug === slug) {
      return `      <li class="current">${label}</li>`;
    }
    return `      <li><a href="../${sib.slug}/">${label}</a></li>`;
  }).join('\n');

  // Section-caption per diagnostic: a 1-sentence italic lede under
  // the section heading. Generated from the category count + title
  // theme. Users can edit post-hoc.
  const catCount = extracted.categories.length;
  const catWord = catCount === 4 ? 'Four' : catCount === 5 ? 'Five' : `${catCount}`;
  const whatItMeasuresCaption = `${catWord} categories that track ${name.toLowerCase()}.`;

  // Post-process the reading-results block: legacy uses var(--vi-accent); replace with var(--olive).
  const readingBlockClean = transformLegacy(extracted.readingBlock);
  const validationIntroClean = transformLegacy(extracted.validationIntro);
  const validationTableClean = transformLegacy(extracted.validationTable);
  const validationFootnoteClean = transformLegacy(extracted.validationFootnote);
  const scopeBodyClean = transformLegacy(extracted.scopeBody)
    // Legacy scope ends with "Return to the Kit Index" link pointing to sampo-diagnostic landing.
    // Rewrite to point at our local diagnostic index.
    .replace(
      /Return to the <a[^>]*href="[^"]*"[^>]*>(?:Kit Index|diagnostic index)<\/a>/,
      'Return to the <a class="inline-link" href="../">diagnostic index</a>',
    );

  const proceduralClean = extracted.procedural
    ? transformLegacy(extracted.procedural)
    : '';

  // Category cards — new-style <details> accordions.
  const categoryCardsHTML = extracted.categories.map(c => {
    const examplesBlock = c.examples
      ? `\n          <p class="cat-examples">${c.examples}</p>`
      : '';
    return `      <details class="cat-card">
        <summary>
          <span class="cat-num">${c.num}</span>
          <span class="cat-name">${c.name}</span>
          <span class="cat-chevron" aria-hidden="true">▸</span>
        </summary>
        <div class="cat-detail">
          <p>${c.description}</p>${examplesBlock}
        </div>
      </details>`;
  }).join('\n\n');

  // Option A/B/C cards — steel/olive/pumpkin via data-option.
  const optionCards = `<div class="option-grid">
      <div class="result-card" data-option="a">
        <div class="result-label">Option A</div>
        <div class="result-value">${extracted.optionValues[0]}</div>
        <div class="result-desc">${extracted.optionDescs[0]}</div>
      </div>
      <div class="result-card" data-option="b">
        <div class="result-label">Option B</div>
        <div class="result-value">${extracted.optionValues[1]}</div>
        <div class="result-desc">${extracted.optionDescs[1]}</div>
      </div>
      <div class="result-card" data-option="c">
        <div class="result-label">Option C</div>
        <div class="result-value">${extracted.optionValues[2]}</div>
        <div class="result-desc">${extracted.optionDescs[2]}</div>
      </div>
    </div>`;

  // Page title in meta — first-word of diagnostic category for a short tag line.
  const ogImage = `https://candc3d.github.io/sampo-diagnostic-${slug}/og_${slug}.png`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>D${d}: ${escapeAttr(name)} · Sampo Diagnostic Kit</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<meta name="description" content="${escapeAttr(oneLiner)} Part of the Sampo Diagnostic Kit."/>

<meta property="og:type" content="article"/>
<meta property="og:title" content="Kit ${kitN} D${d}: ${escapeAttr(name)}"/>
<meta property="og:description" content="${escapeAttr(oneLiner)}"/>
<meta property="og:url" content="https://candc3d.github.io/sampo-site/kits/${slug}/"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="${ogImage}"/>

<link rel="stylesheet" href="../../../brand/src/fonts.css?v=3">
<link rel="stylesheet" href="../../../brand/src/tokens.css?v=3">
<link rel="stylesheet" href="../../../brand/src/themes.css?v=3">
<link rel="stylesheet" href="../../../brand/src/components.css?v=3">
<link rel="stylesheet" href="../../../brand/src/motion.css?v=3">
<link rel="stylesheet" href="../../site.css?v=3">
<link rel="stylesheet" href="../../diagnostic.css?v=3">
</head>
<body>

<header class="site-header">
  <a class="sampo-lockup" href="../../" aria-label="Sampo Diagnostic Kit">
    <span class="sampo-lockup-mark" id="lockupMark"></span>
    <span class="sampo-lockup-type">
      <span class="sampo-lockup-wordmark">SAMPO</span>
      <span class="sampo-lockup-sub">DIAGNOSTIC KIT</span>
    </span>
  </a>
  <nav class="site-nav">
    <a href="../../">Home</a>
    <a href="../" class="active">Kits</a>
    <a href="../../about/">About</a>
    <a href="https://chorrocks.substack.com/">Substack ↗</a>
  </nav>
  <button class="sampo-theme-toggle" id="themeToggle" aria-label="Toggle theme">
    <span class="sampo-theme-toggle-glyph"></span>
  </button>
</header>

<main class="diagnostic">

  <!-- Left rail TOC -->
  <nav class="diag-rail" aria-label="Contents">
    <p class="rail-label">Contents</p>
    <ol>
      <li><a href="#what-it-measures">What it measures</a></li>
      <li><a href="#audit-modes">Three audit modes</a></li>
      <li><a href="#step-1">Step 1 · Extract</a></li>
      <li><a href="#step-2">Step 2 · Run</a></li>
      <li><a href="#step-3">Step 3 · Calibrate</a></li>
      <li><a href="#reading-results">Reading your results</a></li>
      <li><a href="#validation">Validation</a></li>
      <li><a href="#scope">Scope</a></li>
    </ol>
  </nav>

  <div class="diag-article">

  <section class="diag-header">
    <p class="diag-slug">${slug}</p>
    <p class="diag-kit-label">${extracted.kitLabel}</p>
    <h1>${escapeAttr(name)}</h1>
    <p class="lede">${extracted.lede}</p>
  </section>

  <hr class="sampo-divider">

  <section id="what-it-measures" class="diag-section">
    <h2 class="section">What it measures</h2>
    <p class="section-caption">${whatItMeasuresCaption}</p>

    <p>${extracted.introPara}</p>

    <div class="cat-grid">
${categoryCardsHTML}
    </div>
  </section>

  <hr class="sampo-divider">

  <section id="audit-modes" class="diag-section">
    <h2 class="section">Three audit modes</h2>
    <p class="section-caption">Different levels of rigor, different tradeoffs.</p>

    ${optionCards}

    <p class="thesis-line">Options A and B measure what the user and the system have jointly agreed the relationship looks like. Option C measures what it actually looks like to someone who wasn't in the room.</p>

    <div class="figure-block">
      ${extracted.svg}
    </div>
  </section>

  <hr class="sampo-divider">

  <section id="step-1" class="diag-section">
    <h2 class="section">Step 1 · Extract your transcript</h2>
    <p class="section-caption">Options B and C require a transcript to analyze.</p>

    <p>Run this prompt on the system whose conversations you want to audit. Paste the output into a different system along with the Option B or Option C prompt.</p>

    <div class="prompt-block">
      <div class="prompt-label">
        Transcript Extraction
        <button class="btn prompt-copy" data-copy-target="transcriptExtractPrompt">Copy</button>
      </div>
      <div class="prompt-text" id="transcriptExtractPrompt">${extracted.transcriptPrompt}</div>
    </div>
  </section>

  <hr class="sampo-divider">

  <section id="step-2" class="diag-section">
    <h2 class="section">Step 2 · Run the diagnostic</h2>
    <p class="section-caption">Choose the audit mode that matches your situation.</p>

    <div class="version-tabs" role="tablist" aria-label="Audit modes">
      <button class="version-tab active" role="tab" aria-selected="true" aria-controls="panel-a" data-tab="a">Option A <span class="tab-badge badge-steel">Live</span></button>
      <button class="version-tab" role="tab" aria-selected="false" aria-controls="panel-b" data-tab="b">Option B <span class="tab-badge badge-accent">Corpus</span></button>
      <button class="version-tab" role="tab" aria-selected="false" aria-controls="panel-c" data-tab="c">Option C <span class="tab-badge badge-pumpkin">Gold</span></button>
    </div>

    <div id="panel-a" class="version-panel active" role="tabpanel">
      <div class="prompt-block tab-panel-prompt">
        <div class="prompt-label">
          Option A · Live Search
          <button class="btn prompt-copy" data-copy-target="promptA">Copy</button>
        </div>
        <div class="prompt-text" id="promptA">${extracted.promptA}</div>
      </div>
    </div>

    <div id="panel-b" class="version-panel" role="tabpanel">
      <div class="prompt-block tab-panel-prompt">
        <div class="prompt-label">
          Option B · Corpus
          <button class="btn prompt-copy" data-copy-target="promptB">Copy</button>
        </div>
        <div class="prompt-text" id="promptB">${extracted.promptB}</div>
      </div>
    </div>

    <div id="panel-c" class="version-panel" role="tabpanel">
      <div class="prompt-block tab-panel-prompt">
        <div class="prompt-label">
          Option C · Cross-System Audit
          <button class="btn prompt-copy" data-copy-target="promptC">Copy</button>
        </div>
        <div class="prompt-text" id="promptC">${extracted.promptC}</div>
      </div>
    </div>

${proceduralClean ? `    ${proceduralClean}\n` : ''}  </section>

  <hr class="sampo-divider">

  <section id="step-3" class="diag-section">
    <h2 class="section">Step 3 · Calibrate your system</h2>
    <p class="section-caption">Verify the analyzing system can detect signals before trusting it with real data.</p>

    ${extracted.calibrationPrompt
      ? `<p>Use this prompt to generate a calibration transcript — a synthetic conversation with known embedded signals — then run the diagnostic on it.</p>

    <div class="prompt-block">
      <div class="prompt-label">
        Calibration Transcript Generator
        <button class="btn prompt-copy" data-copy-target="calibrationPrompt">Copy</button>
      </div>
      <div class="prompt-text" id="calibrationPrompt">${extracted.calibrationPrompt}</div>
    </div>`
      : `<p>${transformLegacy(extracted.calibrationIntro || '')}</p>

    ${transformLegacy(extracted.calibrationDownload || '')}

    ${transformLegacy(extracted.calibrationTable || '')}`}

    <h3 class="diag-subheading">How to calibrate</h3>
    <ol class="step-list">
      ${extracted.calibrationSteps}
    </ol>
  </section>

  <hr class="sampo-divider">

  <section id="reading-results" class="diag-section">
    <h2 class="section">Reading your results</h2>
    <p class="section-caption">Three assessment tiers plus the single most diagnostic number.</p>

    ${readingBlockClean}
  </section>

  <hr class="sampo-divider">

  <section id="validation" class="diag-section">
    <h2 class="section">Validation</h2>
    <p class="section-caption">Cross-system results on real and calibration corpora.</p>

    ${validationIntroClean}

    ${validationTableClean}

    ${validationFootnoteClean}
  </section>

  <hr class="sampo-divider">

  <section id="scope" class="diag-section">
    <h2 class="section">Scope</h2>
    <p class="section-caption">What this diagnostic does — and doesn't — measure.</p>

    ${scopeBodyClean}
  </section>

  <!-- Kit sibling strip -->
  <nav class="kit-nav" aria-label="Kit ${kitN} diagnostics">
    <p class="kit-nav-label">Kit ${kitN} · ${direction}</p>
    <ol class="kit-nav-list">
${kitNav}
    </ol>
  </nav>

  </div>

</main>

<footer class="site-footer">
  <hr class="sampo-divider">
  <div class="footer-grid">
    <div>
      <p class="footer-meta">Sampo Diagnostic Kit · Christopher Horrocks · 2026</p>
      <p class="footer-meta">Free for use. Attribute if used or altered.</p>
    </div>
    <nav class="footer-nav">
      <a href="../../">Home</a>
      <a href="../">Kits</a>
      <a href="../../about/">About</a>
      <a href="https://chorrocks.substack.com/">Substack ↗</a>
    </nav>
  </div>
  <p class="footer-disclaimer">The views expressed in this work are the author's own and do not represent any official or unofficial position of the University of Pennsylvania.</p>
</footer>

<script src="../../../brand/src/mill.js?v=3"></script>
<script src="../../../brand/src/theme.js?v=3"></script>
<script src="../../app.js?v=3"></script>
<script src="../../diagnostic.js?v=3"></script>

</body>
</html>
`;
}

// ──────────────────────────────────────────────────────────────────
// Run
// ──────────────────────────────────────────────────────────────────

let ok = 0, failed = [];

for (const diag of TO_CONVERT) {
  const srcPath = `C:/Users/chorr/sampo-diagnostic-${diag.slug}/index.html`;
  const outDir = `C:/Users/chorr/sampo/packages/site/kits/${diag.slug}`;
  const outPath = path.join(outDir, 'index.html');

  try {
    const src = fs.readFileSync(srcPath, 'utf8');
    const extracted = extractAll(src, diag.slug);
    const html = emitPage(diag, extracted);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, html);
    const sz = fs.statSync(outPath).size;
    console.log(`✓ ${diag.slug} — ${extracted.categories.length} cats, ${sz} bytes`);
    ok++;
  } catch (err) {
    failed.push({ slug: diag.slug, err: err.message });
    console.error(`✗ ${diag.slug} — ${err.message}`);
  }
}

console.log(`\n${ok}/${TO_CONVERT.length} converted.`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(`  ${f.slug}: ${f.err}`);
  process.exit(1);
}
