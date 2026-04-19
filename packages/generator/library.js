// ====================================================================
// Sampo Diagnostic — Library
// Mutable kit/diagnostic definitions with localStorage persistence.
// ====================================================================

const DEFAULT_LIBRARY = {
  version: 1,
  kits: [
    {
      id: 1,
      title: 'Kit 1 · User → System',
      diagnostics: [
        { d: 1, label: 'D1: Deference Language' },
        { d: 2, label: 'D2: Anthropomorphization' },
        { d: 3, label: 'D3: Authority Ceding' },
        { d: 4, label: 'D4: Correction Behavior' },
        { d: 5, label: 'D5: Emotional Disclosure' },
        { d: 6, label: 'D6: Prompt Structure' },
      ],
    },
    {
      id: 2,
      title: 'Kit 2 · System → User',
      diagnostics: [
        { d: 1, label: 'D1: Sycophancy Language' },
        { d: 2, label: 'D2: Assumed Familiarity' },
        { d: 3, label: 'D3: Epistemic Overreach' },
        { d: 4, label: 'D4: Autonomy Erosion' },
        { d: 5, label: 'D5: Register Drift' },
        { d: 6, label: 'D6: Framing and Agenda' },
        { d: 7, label: 'D7: Emotional Initiation' },
      ],
    },
    { id: 3, title: 'Kit 3 · System → Subject Matter', diagnostics: [] },
    { id: 4, title: 'Kit 4 · User → Subject Matter', diagnostics: [] },
  ],
};

const LS_KEY = 'sampo.library.v1';

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredClone(DEFAULT_LIBRARY);
    const parsed = JSON.parse(raw);
    if (!parsed.kits) throw new Error('bad shape');
    return parsed;
  } catch (e) {
    console.warn('library: falling back to defaults', e);
    return structuredClone(DEFAULT_LIBRARY);
  }
}

function saveLibrary(lib) {
  localStorage.setItem(LS_KEY, JSON.stringify(lib));
  window.dispatchEvent(new CustomEvent('library:changed', { detail: lib }));
}

function resetLibrary() {
  const fresh = structuredClone(DEFAULT_LIBRARY);
  saveLibrary(fresh);
  return fresh;
}

// Flatten for lookup: [{ kit, d, slug, label }, …]
function flattenDiagnostics(lib) {
  const out = [];
  for (const k of lib.kits) {
    for (const dx of k.diagnostics) {
      out.push({
        kit: k.id,
        kitTitle: k.title,
        d: dx.d,
        slug: `kit${k.id}d${dx.d}`,
        label: dx.label,
      });
    }
  }
  return out;
}

// Mutation helpers — all take the library, return a NEW library.
function addKit(lib) {
  const next = structuredClone(lib);
  const nextId = (Math.max(0, ...next.kits.map(k => k.id)) + 1);
  next.kits.push({ id: nextId, title: `Kit ${nextId}`, diagnostics: [] });
  return next;
}

function removeKit(lib, kitId) {
  const next = structuredClone(lib);
  next.kits = next.kits.filter(k => k.id !== kitId);
  return next;
}

function renameKit(lib, kitId, title) {
  const next = structuredClone(lib);
  const k = next.kits.find(k => k.id === kitId);
  if (k) k.title = title;
  return next;
}

function addDiagnostic(lib, kitId, label = '') {
  const next = structuredClone(lib);
  const k = next.kits.find(k => k.id === kitId);
  if (!k) return next;
  const nextD = (Math.max(0, ...k.diagnostics.map(d => d.d)) + 1);
  const defaultLabel = label || `D${nextD}: (untitled)`;
  k.diagnostics.push({ d: nextD, label: defaultLabel });
  return next;
}

function removeDiagnostic(lib, kitId, d) {
  const next = structuredClone(lib);
  const k = next.kits.find(k => k.id === kitId);
  if (k) k.diagnostics = k.diagnostics.filter(x => x.d !== d);
  return next;
}

function renameDiagnostic(lib, kitId, d, label) {
  const next = structuredClone(lib);
  const k = next.kits.find(k => k.id === kitId);
  if (!k) return next;
  const dx = k.diagnostics.find(x => x.d === d);
  if (dx) dx.label = label;
  return next;
}

window.SampoLibrary = {
  DEFAULT_LIBRARY,
  loadLibrary, saveLibrary, resetLibrary,
  flattenDiagnostics,
  addKit, removeKit, renameKit,
  addDiagnostic, removeDiagnostic, renameDiagnostic,
};
