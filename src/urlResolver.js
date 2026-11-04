const fs = require('fs');
const path = require('path');

const EXCLUSIVE_DIR = path.join(__dirname, '..', 'Extra exclusive URLS');
const REGISTRY_PATH = path.join(EXCLUSIVE_DIR, 'registry.json');

function loadRegistry() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function saveRegistry(registry) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function extractHostname(input) {
  let candidate = input;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = 'http://' + candidate;
  }
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Looks like a real domain: has a dot, no spaces, valid label chars.
function looksLikeDomain(input) {
  const trimmed = input.trim();
  if (/\s/.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return true; // explicit scheme
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+(:[0-9]+)?(\/.*)?$/i.test(trimmed);
}

/**
 * Resolve what the user typed in the address bar into a navigation target.
 * Returns one of:
 *   { type: 'custom', entryPath, hostname, entry }
 *   { type: 'url', url }
 *   { type: 'search', url }
 */
function resolveInput(input, searchEngineUrl) {
  const trimmed = input.trim();
  if (!trimmed) return { type: 'url', url: 'about:blank' };

  const registry = loadRegistry();
  const hostname = extractHostname(trimmed);

  if (hostname && registry[hostname]) {
    const entry = registry[hostname];
    const entryPath = entry.entry ? path.join(EXCLUSIVE_DIR, entry.entry) : null;
    return { type: 'custom', entryPath, hostname, entry };
  }

  if (looksLikeDomain(trimmed)) {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
    return { type: 'url', url: withScheme };
  }

  const query = encodeURIComponent(trimmed);
  return { type: 'search', url: searchEngineUrl.replace('%s', query) };
}

module.exports = {
  EXCLUSIVE_DIR,
  REGISTRY_PATH,
  loadRegistry,
  saveRegistry,
  extractHostname,
  looksLikeDomain,
  resolveInput,
};
