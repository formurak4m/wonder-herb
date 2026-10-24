/* Where the ORIGINAL hand-coded version of a page lives.
 *
 * Until Phase 9 every page existed once, in the repo root. When a page is
 * migrated, its hand-coded original is retired to legacy/<name> and the
 * pre-rendered page takes its place at the root (renderer/render.js writes it
 * there). From then on "the live page" at the root is OUR output, and anything
 * that needs the ORIGINAL - the chrome and CSS it is lifted from, the
 * catalogue scripts/migrate-products.js reads, the fidelity maps, the
 * behaviour test's cross-check sources - must read legacy/ instead, or it
 * would read the renderer's own output back (circular, and silently wrong).
 *
 * One rule, one place: legacy/<name> if it exists, otherwise <name> at the root.
 * `name` must be a bare page file name (no directories), which also keeps the
 * preview route's path-traversal guard intact.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY_DIR = 'legacy';
const PAGE_NAME_OK = /^[^/\\]+\.html$/;

function isRetired(name) {
  return PAGE_NAME_OK.test(String(name || '')) && fs.existsSync(path.join(ROOT, LEGACY_DIR, name));
}

/* Absolute path of the original page, or null if the name is not a bare page
   name or no such page exists in legacy/ or the root. */
function originalPagePath(name) {
  const n = String(name || '').trim();
  if (!PAGE_NAME_OK.test(n)) return null;
  const legacy = path.join(ROOT, LEGACY_DIR, n);
  if (fs.existsSync(legacy)) return legacy;
  const root = path.join(ROOT, n);
  return fs.existsSync(root) ? root : null;
}

function readOriginalPage(name) {
  const file = originalPagePath(name);
  if (!file) throw new Error('No original page named ' + JSON.stringify(name) + ' in legacy/ or the repo root');
  return fs.readFileSync(file, 'utf8');
}

module.exports = { ROOT, LEGACY_DIR, PAGE_NAME_OK, isRetired, originalPagePath, readOriginalPage };
