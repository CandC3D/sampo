// Sampo mill mark — web variant (no crank, no rotation arc)
// All geometry computed from a single scale factor to prevent drift.

const SAMPO = {
  // Palette
  BG: '#F5F0E8',
  INK: '#2C2C2A',
  MUTED: '#8C8A5C',
  FAINT: '#B4B2AC',
  PUMPKIN: '#FF7A05',
  OLIVE: '#65A30D',
  STEEL: '#7B8FA1',
};

// Dashed circle as a single <circle> with stroke-dasharray.
// Period 5° at radius r  =>  dash length ≈ (3/360) * 2πr, gap ≈ (2/360) * 2πr.
function dashedCircleProps(r) {
  const C = 2 * Math.PI * r;
  const dash = C * (3 / 360);
  const gap  = C * (2 / 360);
  return { 'stroke-dasharray': `${dash.toFixed(2)} ${gap.toFixed(2)}` };
}

/**
 * Render the mill mark SVG group at (cx, cy) with a given scale.
 * Base values from the design system (Section 4, Scale Reference).
 *   radial line radius   = 65 × scale
 *   hub radius           = 12 × scale
 *   hex orbit radius     = 82 × scale
 *   hex circle radius    = 13 × scale
 *   outer ring radius    = 100 × scale
 * Strokes are beefed up vs the original Pillow renders so they read at
 * small preview sizes (the user flagged "lines too thin").
 */
function millMark(cx, cy, scale = 2.0, opts = {}) {
  const showInnerRing = opts.showInnerRing !== false;
  const showOuterRing = opts.showOuterRing !== false;
  const theme = opts.theme === 'dark' ? 'dark' : 'light';

  const rRadial  = 65  * scale;
  const rHub     = 12  * scale;
  const rOrbit   = 82  * scale;
  const rHex     = 13  * scale;
  const rOuter   = 100 * scale;

  // Stroke weights — scale with size, but with a floor so tiny variants still read.
  const wRadial  = Math.max(2.5, 2.2 * scale);
  const wHex     = Math.max(2.5, 2.0 * scale);
  const wDashed  = Math.max(1.5, 1.2 * scale);

  // Theme-aware neutrals. Pumpkin/olive stay; they read on either ground.
  // Dark theme: hub is cream (so it reads on dark bg), steel/faint brighten.
  const steel = theme === 'dark' ? '#B0BDC8' : SAMPO.STEEL;   // brighter blue-gray on dark
  const faint = theme === 'dark' ? '#8A8780' : SAMPO.FAINT;   // dimmer on light, visible on dark
  const hub   = theme === 'dark' ? SAMPO.BG  : SAMPO.INK;     // invert hub tone

  let g = `<g class="mill" transform="translate(${cx} ${cy})">`;

  // 12 radial lines at 30° intervals, rotated 15° so no line is vertical.
  g += `<g stroke="${steel}" stroke-width="${wRadial}" stroke-opacity="0.7" stroke-linecap="round">`;
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 + 15) * Math.PI / 180;
    const x = Math.cos(a) * rRadial;
    const y = Math.sin(a) * rRadial;
    g += `<line x1="0" y1="0" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/>`;
  }
  g += `</g>`;

  // Inner dashed ring (between radials and hex circles)
  if (showInnerRing) {
    const rInner = (rRadial + rOrbit - rHex) / 2 + 2;
    const dashedInner = dashedCircleProps(rInner);
    g += `<circle r="${rInner.toFixed(2)}" fill="none" stroke="${faint}" stroke-width="${wDashed}" stroke-dasharray="${dashedInner['stroke-dasharray']}"/>`;
  }

  // Hub — solid
  g += `<circle r="${rHub}" fill="${hub}"/>`;

  // Hex circles — 6, first at −60°, alternating pumpkin / olive.
  for (let i = 0; i < 6; i++) {
    const a = (60 * i - 60) * Math.PI / 180;
    const hx = Math.cos(a) * rOrbit;
    const hy = Math.sin(a) * rOrbit;
    const color = (i % 2 === 0) ? SAMPO.PUMPKIN : SAMPO.OLIVE;
    g += `<circle cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="${rHex}" fill="none" stroke="${color}" stroke-width="${wHex}"/>`;
  }

  // Outer dashed ring
  if (showOuterRing) {
    const dashedOuter = dashedCircleProps(rOuter);
    g += `<circle r="${rOuter}" fill="none" stroke="${faint}" stroke-width="${wDashed}" stroke-dasharray="${dashedOuter['stroke-dasharray']}"/>`;
  }

  g += `</g>`;
  return g;
}

/**
 * Full preview composition. `variant` is one of:
 *   'og'       — 1200×630  (landscape, wordmark left, mill right)
 *   'github'   — 1280×640  (same layout, slightly taller)
 *   'square'   — 1200×1200 (mill top, stacked text below)
 *   'substack' — 1100×220  (compact landscape)
 *
 * `data` = { kitLabel?: 'D3: Epistemic Overreach', subtitle?: '…', attribution?: '…' }
 * Omit kitLabel for the generic kit-level preview.
 */
function composePreview(variant, data = {}) {
  const {
    kitLabel = '',
    subtitle = 'Measuring the health of human–AI exchange',
    attribution = 'Christopher Horrocks · chorrocks.substack.com',
  } = data;

  let W, H, mill, textX, textCenterY, fontSizes, millScale, ringR, ringCx, ringCy, textPad;
  if (variant === 'og') {
    W = 1200; H = 630;
    mill = { cx: 920, cy: 315 };
    millScale = 2.0;
    textX = 80;
    textCenterY = 315;
    ringCx = 920; ringCy = 315;
    ringR = 1140;
    fontSizes = { sampo: 92, kit: 38, dim: 26, sub: 24, attr: 18 };
    textPad = { x0: 60, y0: 150, x1: 560, y1: 460 };
  } else if (variant === 'github') {
    W = 1280; H = 640;
    mill = { cx: 970, cy: 320 };
    millScale = 2.0;
    textX = 90;
    textCenterY = 320;
    ringCx = 970; ringCy = 320;
    ringR = 1180;
    fontSizes = { sampo: 96, kit: 40, dim: 28, sub: 25, attr: 19 };
    textPad = { x0: 65, y0: 150, x1: 580, y1: 470 };
  } else if (variant === 'square') {
    W = 1200; H = 1200;
    mill = { cx: 600, cy: 440 };
    millScale = 2.4;
    textX = 600;
    textCenterY = 960;
    ringCx = 600; ringCy = 700;
    ringR = 540;
    fontSizes = { sampo: 104, kit: 46, dim: 34, sub: 30, attr: 22 };
    textPad = { x0: 100, y0: 820, x1: 1100, y1: 1100 };
  } else if (variant === 'substack') {
    W = 1100; H = 220;
    mill = { cx: 990, cy: 110 };
    millScale = 0.9;
    textX = 50;
    textCenterY = 110;
    ringCx = 990; ringCy = 110;
    ringR = 280;
    fontSizes = { sampo: 56, kit: 26, dim: 20, sub: 19, attr: 0 };
    textPad = { x0: 0, y0: 30, x1: 660, y1: 200 };
  } else {
    throw new Error('Unknown variant ' + variant);
  }

  const FF_SANS  = "'Instrument Sans', 'Helvetica Neue', Arial, sans-serif";
  const FF_SERIF = "'Instrument Serif', 'Georgia', serif";

  let svg = '';
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" font-family="${FF_SANS}">`;
  svg += `<rect width="${W}" height="${H}" fill="${SAMPO.BG}"/>`;

  // Encompassing ring — the unifying element
  const dashedEncomp = dashedCircleProps(ringR);
  svg += `<circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="none" stroke="${SAMPO.FAINT}" stroke-width="2" stroke-dasharray="${dashedEncomp['stroke-dasharray']}" stroke-opacity="0.85"/>`;

  // Cream mask — no visible edge; extended to canvas where needed
  if (textPad) {
    const { x0, y0, x1, y1 } = textPad;
    // Extend mask to left/right canvas edges based on layout
    let mx0 = x0, mx1 = x1, my0 = y0, my1 = y1;
    if (variant === 'og' || variant === 'github') {
      mx0 = 0; // bleed to left edge (text is left-aligned)
    }
    if (variant === 'square') {
      // keep centered, don't bleed
    }
    svg += `<rect x="${mx0}" y="${my0}" width="${mx1 - mx0}" height="${my1 - my0}" fill="${SAMPO.BG}"/>`;
  }

  // ---------- TEXT BLOCK ----------
  // Layout: compute stacked y positions around textCenterY.
  const lines = [];
  lines.push({ kind: 'sampo',  text: 'SAMPO',           size: fontSizes.sampo, color: SAMPO.INK,   weight: 800, tracking: -0.02, ff: FF_SANS });
  lines.push({ kind: 'kit',    text: 'DIAGNOSTIC KIT',  size: fontSizes.kit,   color: SAMPO.INK,   weight: 700, tracking:  0.04, ff: FF_SANS });
  if (kitLabel) {
    lines.push({ kind: 'dim',  text: kitLabel,          size: fontSizes.dim,   color: SAMPO.OLIVE, weight: 700, tracking:  0.01, ff: FF_SANS });
  }
  lines.push({ kind: 'sub',    text: subtitle,          size: fontSizes.sub,   color: SAMPO.MUTED, weight: 400, italic: true,  ff: FF_SERIF });
  if (fontSizes.attr > 0) {
    lines.push({ kind: 'accent' });
    lines.push({ kind: 'attr', text: attribution,       size: fontSizes.attr,  color: SAMPO.FAINT, weight: 400, tracking: 0,    ff: FF_SANS });
  }

  // Compute vertical offsets. Use line-height factors.
  const gaps = { sampo: 0.22, kit: 0.5, dim: 0.6, sub: 0.45, accent: 0.7, attr: 0.7 };
  const heights = lines.map(l => l.kind === 'accent' ? 0 : l.size);
  // total height
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === 'accent') {
      total += heights[i - 1] * gaps.accent;
    } else {
      total += heights[i];
      if (i < lines.length - 1) {
        const nextKind = lines[i + 1].kind;
        total += heights[i] * (gaps[nextKind] ?? 0.4);
      }
    }
  }
  let y = textCenterY - total / 2;

  const anchor = (variant === 'square') ? 'middle' : 'start';
  const isSquare = variant === 'square';

  // Track the width of the longest visible line so the accent line can match.
  // SVG can't measure text server-side; approximate via char count × 0.55 × size.
  const approxWidth = (text, size, weight) => {
    const perChar = (weight >= 700 ? 0.58 : 0.52);
    return text.length * size * perChar;
  };
  let maxLineWidth = 0;
  for (const l of lines) {
    if (l.kind === 'accent' || !l.text) continue;
    const w = approxWidth(l.text, l.size, l.weight ?? 400);
    if (w > maxLineWidth) maxLineWidth = w;
  }

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === 'accent') {
      const prev = lines[i - 1];
      const gap = heights[i - 1] * gaps.accent;
      const lineY = y + gap * 0.55;
      const accentWidth = Math.min(maxLineWidth * 1.02, isSquare ? 460 : 480);
      const x1 = isSquare ? textX - accentWidth / 2 : textX + 4;
      const x2 = isSquare ? textX + accentWidth / 2 : textX + 4 + accentWidth;
      svg += `<line x1="${x1}" y1="${lineY}" x2="${x2}" y2="${lineY}" stroke="${SAMPO.OLIVE}" stroke-width="2"/>`;
      y += gap;
      continue;
    }
    // baseline ≈ y + size (since we're stacking tops).
    const baseline = y + l.size * 0.82;
    const style = `font-family:${l.ff}; font-size:${l.size}px; font-weight:${l.weight}; fill:${l.color};` +
                  (l.italic ? ' font-style:italic;' : '') +
                  (l.tracking ? ` letter-spacing:${(l.tracking * l.size).toFixed(2)}px;` : '');
    svg += `<text x="${textX}" y="${baseline.toFixed(2)}" text-anchor="${anchor}" style="${style}">${escapeXml(l.text)}</text>`;
    y += l.size;
    if (i < lines.length - 1) {
      const nextKind = lines[i + 1].kind;
      y += l.size * (gaps[nextKind] ?? 0.4);
    }
  }

  // Mill mark on top
  svg += millMark(mill.cx, mill.cy, millScale);

  svg += `</svg>`;
  return { svg, W, H };
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}

// Favicon / touch-icon standalone mill (no text, no encompassing ring)
function iconMark(size, opts = {}) {
  const cx = size / 2, cy = size / 2;
  // Map the mill to `size` so the outer hex circles touch the edges with small margin.
  // outer hex bbox ≈ (orbit + hexR) = 82s + 13s = 95s  →  s = (size/2 - margin) / 95
  const margin = opts.margin ?? size * 0.06;
  const scale = (size / 2 - margin) / 95;

  const transparent = opts.transparent === true;
  const theme = opts.theme === 'dark' ? 'dark' : 'light';
  let svg = '';
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  if (!transparent) {
    const bg = theme === 'dark' ? '#1B1916' : SAMPO.BG;
    svg += `<rect width="${size}" height="${size}" fill="${bg}"/>`;
  }
  svg += millMark(cx, cy, scale, { showInnerRing: false, showOuterRing: opts.showOuter ?? (size >= 64), theme });
  svg += `</svg>`;
  return svg;
}

// Browser global — so plain <script> consumers pick it up without bundling.
if (typeof window !== 'undefined') {
  window.SampoMill = { SAMPO, millMark, composePreview, iconMark };
}
