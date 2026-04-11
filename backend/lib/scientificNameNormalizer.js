const INVALID_SPECIES_TOKENS = new Set([
  'ex',
  'de',
  'del',
  'da',
  'di',
  'van',
  'von',
  'la',
  'le',
  'and',
  'et'
]);

function normalizeSpace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseScientificName(value = '') {
  const raw = normalizeSpace(value);
  if (!raw) return null;

  // Canonical form: Genus + optional hybrid marker + species epithet.
  const match = raw.match(/^([A-Z][a-zA-Z-]+)(?:\s+([xX\u00D7]))?\s+([a-z][a-zA-Z-]+)(?:\s|$)/);
  if (!match) return null;

  const genus = match[1];
  const species = match[3];
  const isHybrid = Boolean(match[2]);
  if (INVALID_SPECIES_TOKENS.has(species.toLowerCase())) return null;

  return {
    raw,
    genus,
    species,
    isHybrid,
    canonical: `${genus}${isHybrid ? ' \u00D7' : ''} ${species}`
  };
}

function normalizeScientificName(value = '') {
  const parsed = parseScientificName(value);
  return parsed ? parsed.canonical : null;
}

function getScientificNameLookupCandidates(value = '') {
  const candidates = [];
  const seen = new Set();
  const push = (item) => {
    const normalized = normalizeSpace(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  const raw = normalizeSpace(value);
  push(raw);

  const canonical = normalizeScientificName(raw);
  if (canonical) {
    push(canonical);
    // Some sources still use " x " as hybrid marker.
    push(canonical.replace(' \u00D7 ', ' x '));
  }

  return candidates;
}

function isHybridScientificName(value = '') {
  const parsed = parseScientificName(value);
  return Boolean(parsed && parsed.isHybrid);
}

module.exports = {
  parseScientificName,
  normalizeScientificName,
  getScientificNameLookupCandidates,
  isHybridScientificName
};