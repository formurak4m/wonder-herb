/* The editor's talk to the existing Express API. No new endpoints for loading
 * or saving, and no new auth path.
 *
 *   GET  /api/pages            list the page trees            (open, like the rest of the content API)
 *   GET  /api/pages/:slug      load one tree                  (open)
 *   PUT  /api/pages/:slug      save one tree                  (requireAdmin - already gated, P2-T1)
 *   POST /api/auth/login       sign in                        (the admin's own login route)
 *   POST /api/preview          render a draft, publish-path   (requireAdmin, P8-T2)
 *
 * The token is a Bearer token in the Authorization header, exactly as
 * admin/index.html does it (admin/index.html:1370), stored under the same
 * `wh_admin_token` key.
 *
 * ONE THING WORTH KNOWING: the editor runs on its own origin (Vite, :5173)
 * while the admin is served from the API's origin (:4000). localStorage is
 * per-origin, so the editor cannot borrow the admin's existing session - it
 * signs in through the SAME endpoint and stores the SAME kind of token, but it
 * has to do it once for itself. That is a browser rule, not a second auth
 * system: there is still one users collection, one sessions collection and one
 * `requireAdmin`.
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'wh_admin_token';                 // the same key admin/index.html uses

export const apiBase = () => API_BASE;

export function token() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

async function call(path, method, body) {
  const t = token();
  const res = await fetch(API_BASE + path, {
    method: method || 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' },
                           t ? { Authorization: 'Bearer ' + t } : {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ('Request failed (' + res.status + ')'));
    err.status = res.status;
    throw err;
  }
  return data;
}

export const login = (email, password) =>
  call('/api/auth/login', 'POST', { email, password });

export const listPages  = () => call('/api/pages');
export const loadPage   = slug => call('/api/pages/' + encodeURIComponent(slug));
export const savePage   = (slug, tree) => call('/api/pages/' + encodeURIComponent(slug), 'PUT', tree);

/* Content for the data-backed sections, in the shape a section's
   `source: 'products.json'` resolves against - the same shape
   renderer/render.js loadData() builds. Served by the existing content API,
   with the committed files as the fallback when the API is down, which is the
   behaviour the whole project rests on (CLAUDE.md hard rule 1). */
export async function loadContent() {
  /* One call to the existing content route. NOTE the shape: the API speaks
     /api/cms?type=…, NOT /api/products - getting that wrong is silent, because
     a failed fetch just leaves the list empty and the product grid renders as
     an empty box rather than an error. */
  try {
    const all = await call('/api/cms');
    return all && typeof all === 'object' ? all : {};
  } catch (e) {
    // API down: the committed files, same fallback the admin and the site use
    const out = {};
    await Promise.all(['products', 'cases', 'faq'].map(async n => {
      try { out[n] = await (await fetch(API_BASE + '/data/' + n + '.json')).json(); }
      catch (e2) { out[n] = []; }
    }));
    return out;
  }
}

/* Render a draft through the REAL renderer, server-side. See the comment on
   the route in server/index.js for why the preview cannot be done in the
   browser and still be honest. */
export const preview = (slug, tree, lang) =>
  call('/api/preview', 'POST', { slug, tree, lang });
