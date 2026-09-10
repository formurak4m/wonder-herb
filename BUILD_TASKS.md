# BUILD_TASKS.md — Wonder Herb Admin Rebuild (for Claude Code)

A sequenced, detailed build guide. Work through it top to bottom. Do not skip the **Verify** step in each task before moving to the next. If the repo differs from what a task assumes, fix the task to match reality and note the change in a short comment, do not force it.

Read `CLAUDE.md` first for the non-negotiables. This file is the *how*; CLAUDE.md is the *rules*.

> Honest note: no document guarantees zero errors. This one removes ambiguity and gives you an acceptance test per task so you catch breakage immediately instead of three phases later. Run `npm run test:all` at every phase gate.

---

## 0. How to use this file

- Each task has: **Goal · Depends on · Files · Steps · Verify (done-when) · Gotchas.**
- Task IDs are stable (P1-T2 etc.). Tick the checklist as you go.
- After each task that changes behaviour, run its **Verify** and, at phase gates, `npm run test:all`.
- Never break the two non-negotiables: (1) the public site stays static HTML on GitHub Pages, (2) if the API is off, the admin and site fall back to committed files.
- Currency is HKD. Languages are `zh` (primary) + `en, de, es, fr, ja, ru` (fall back to `zh`).
- When you finish a phase, update `CLAUDE.md` "Current state" so the next session is accurate.

### Progress checklist
```
[ ] Phase 0  Baseline, branch, safety net
[ ] Phase 1  Toolchain (React/Vite/esbuild) added without touching the live site
[ ] Phase 2  Page-tree data model in Mongo + export
[ ] Phase 3  i18n resolver (per-language field -> value, zh fallback)
[ ] Phase 4  Section components (core 8-10), shared by editor + renderer
[ ] Phase 5  Renderer: page tree + data -> pre-rendered static HTML
[ ] Phase 6  SEO assertion gate (blocks a bad publish)
[ ] Phase 7  Wire renderer into the publish pipeline
[ ] Phase 8  Puck editor app (canvas, add/reorder, save to API)
[ ] Phase 9  Migrate the core pages (zh) and verify visually
[ ] Phase 10 Media + 72MB .glb moved to R2/CDN
[ ] Phase 11 Host API + MongoDB (off the laptop)
[ ] Phase 12 Permissions + version history + rollback
[ ] --- Month 1 done: usable slice, Wix still live ---
[ ] Phase 13 All 18 pages, full ~22 sections
[ ] Phase 14 All 7 languages pre-rendered + hreflang
[ ] Phase 15 Forms (visitor submissions -> dashboard)
[ ] Phase 16 Dashboard parity (contacts, orders, analytics)
[ ] Phase 17 Security hardening + staging
[ ] Phase 18 Cutover from Wix
```

---

## Architecture in one picture (what you are building)

```
Editor (Puck, React)  ─┐
Admin + Pages CMS ─────┤─► API + MongoDB ──export──► data/ (content + page trees, in Git)
                        │                                   │
                        │                          renderer (React server render)
                        │                                   ▼
                        │                     pre-rendered static HTML + JSON-LD + hreflang
                        │                                   │
                        └──────────────────────────────────┴──► commit to main ─► GitHub Pages
Media + .glb ──► R2 / CDN (not in Git)
```

The one idea that makes it work: **section components are React and are used by BOTH the Puck canvas and the Node renderer.** One source of truth, so the editor preview matches the published page.

---

## Phase 0 — Baseline, branch, safety net

### P0-T1 · Snapshot and branch
- **Goal:** never lose the working state.
- **Steps:**
  1. `git status` and `git stash` or commit anything local first.
  2. Create a branch: `git checkout -b rebuild/editor`.
  3. Confirm the current pipeline still works end to end: `npm run seed` (into a scratch DB), `npm run dev`, open `admin/index.html` via the API, `npm run export`, `git diff data/` shows sensible output.
- **Verify:** `npm run test:all` passes on a clean checkout before you change anything.
- **Gotcha:** do all new work on the branch. `main` auto-deploys to production via `.github/workflows/static.yml`.

### P0-T2 · Record the baseline of the live pages
- **Goal:** be able to prove "the site still looks the same" after migration.
- **Steps:**
  1. For each of the 18 HTML pages, save a rendered screenshot at 1280px and 390px (desktop + phone). Use Playwright: `npx playwright screenshot`.
  2. Store under `baseline/screens/<page>.<width>.png`. Add `baseline/` to `.gitignore` (do not deploy it).
  3. Save each page's current `<head>` (title, meta description, canonical, JSON-LD, hreflang) to `baseline/head/<page>.html` for later comparison.
- **Verify:** `baseline/` contains 18 pages × 2 widths of screenshots and 18 head snapshots.
- **Gotcha:** these are your visual and SEO regression references. The renderer must match them within tolerance.

---

## Phase 1 — Toolchain, added safely

### P1-T1 · Add React + a bundler for the editor and the renderer
- **Goal:** introduce React without shipping it to the public site.
- **Files:** `package.json`, new `editor/`, new `sections/`, new `renderer/`.
- **Steps:**
  1. Install dev deps: `npm i -D vite @vitejs/plugin-react esbuild playwright` and runtime deps `npm i react react-dom`.
  2. Install Puck: check the current package name and version at https://puckeditor.com/docs first (it is currently published as `@measured/puck`; confirm before installing), then `npm i @measured/puck`.
  3. Create three folders: `sections/` (shared React components), `editor/` (Vite React app for Puck), `renderer/` (Node script that server-renders sections to HTML).
  4. Add scripts to `package.json` (do NOT remove existing ones):
     ```json
     "editor:dev": "vite --config editor/vite.config.js",
     "editor:build": "vite build --config editor/vite.config.js",
     "sections:build": "node renderer/build-sections.js",
     "render": "node renderer/render.js",
     "test:seo": "node scripts/test-seo.js"
     ```
- **Verify:** `npm run editor:dev` starts Vite with an empty React page; the public site and API are untouched (`npm run dev` still works).
- **Gotcha:** keep the public pages framework-free. React is only for the editor and for server-side rendering, never a runtime dependency of the live pages.

### P1-T2 · esbuild bundle of sections for Node
- **Goal:** let the Node renderer import the same JSX section components.
- **Files:** `renderer/build-sections.js`.
- **Steps:**
  1. Write `renderer/build-sections.js` to bundle `sections/index.js` to `renderer/.build/sections.cjs` (format `cjs`, platform `node`, `jsx: automatic`, external `react`/`react-dom`).
     ```js
     const esbuild = require('esbuild');
     esbuild.build({
       entryPoints: ['sections/index.js'],
       outfile: 'renderer/.build/sections.cjs',
       bundle: true, format: 'cjs', platform: 'node',
       jsx: 'automatic', external: ['react', 'react-dom'],
       logLevel: 'info',
     }).catch(() => process.exit(1));
     ```
  2. Add `renderer/.build/` to `.gitignore`.
- **Verify:** `npm run sections:build` produces `renderer/.build/sections.cjs` and `node -e "console.log(Object.keys(require('./renderer/.build/sections.cjs')))"` lists your section names.
- **Gotcha:** `external: ['react','react-dom']` so the Node process uses one React instance.

---

## Phase 2 — Page-tree data model

### P2-T1 · Define the page-tree schema and Mongo collection
- **Goal:** store page layouts as data, next to existing content.
- **Files:** `server/db.js` (add a `pages` collection), `data/pages/` (exported trees).
- **Steps:**
  1. Add `pages` to `COLLECTIONS` in `server/db.js` and ensure an index on `{ slug: 1 }` unique.
  2. Page-tree shape (store one document per page):
     ```json
     {
       "slug": "products",
       "title":  { "zh": "產品介紹", "en": "Products" },
       "seo":    { "description": { "zh": "...", "en": "..." }, "image": "..." },
       "path":   { "zh": "產品介紹.html", "en": "en/products.html" },
       "sections": [
         { "type": "page-header", "id": "s1",
           "fields": { "heading": { "zh": "產品介紹", "en": "Our Products" } } },
         { "type": "product-grid", "id": "s2",
           "fields": { "source": "products.json", "columns": 3, "showPrices": true } },
         { "type": "cta-band", "id": "s3", "fields": { } }
       ]
     }
     ```
  3. Add API routes in `server/index.js`: `GET /api/pages`, `GET /api/pages/:slug`, `PUT /api/pages/:slug` (upsert, admin only). Follow the existing route + auth patterns in that file.
- **Verify:** `curl localhost:4000/api/pages` returns `[]`; a `PUT` then `GET` round-trips a page tree.
- **Gotcha:** reuse the existing auth middleware from `server/auth.js`; do not invent a new auth path.

### P2-T2 · Extend export to write page trees
- **Goal:** page trees follow the same publish path as content.
- **Files:** `scripts/export.js`.
- **Steps:**
  1. In `export.js`, read the `pages` collection and write each tree to `data/pages/<slug>.json` using the existing `writeIfChanged` helper.
  2. Keep the existing "empty DB" guard so an empty database can never wipe `data/`.
- **Verify:** `npm run export` writes `data/pages/*.json` only when changed; an unchanged run prints `unchanged` and leaves `git status` clean.
- **Gotcha:** match the existing formatting (`JSON.stringify(x, null, 2) + '\n'`) so diffs stay small.

---

## Phase 3 — i18n resolver

### P3-T1 · Per-language field resolver with zh fallback
- **Goal:** one helper that turns a per-language field object into a value for a given language.
- **Files:** `renderer/i18n.js` (also importable by the editor).
- **Steps:**
  1. Implement `resolveField(value, lang, primary='zh')`:
     - If `value` is a plain object whose keys are a subset of the 7 language codes, return `value[lang]` if non-empty, else `value[primary]`.
     - If `value` is an array, map each item through `resolveField`.
     - If `value` is a nested object of fields, recurse into each key.
     - Otherwise return `value` unchanged.
  2. Export `LANGS = ['zh','en','de','es','fr','ja','ru']` and `PRIMARY = 'zh'`.
- **Verify:** unit test in `scripts/test-i18n.js`: `resolveField({zh:'產品', en:'Products'}, 'en')` -> `'Products'`; `resolveField({zh:'產品', en:''}, 'en')` -> `'產品'`; nested and array cases pass.
- **Gotcha:** treat empty string and missing as "fall back", so a half-translated field still shows Chinese, matching how `.pages.yml` already behaves.

---

## Phase 4 — Section components (core set)

Build 8 to 10 first, from the markup already on the live pages so nothing looks different. Full set (~22) is Phase 13.

### P4-T1 · Section component contract
- **Goal:** a shape every section follows, usable by Puck and the renderer.
- **Files:** `sections/<Name>.jsx`, `sections/index.js`.
- **Contract:** each file default-exports a React component and named-exports a `config`:
  ```jsx
  // sections/PageHeader.jsx
  export const config = {
    label: 'Page header',
    fields: {                       // Puck field definitions
      heading: { type: 'text' },
      sub:     { type: 'textarea' },
      variant: { type: 'select', options: [
        { label: 'Centered', value: 'centered' },
        { label: 'Left',     value: 'left' },
      ]},
    },
    defaultProps: { heading: '', sub: '', variant: 'centered' },
  };
  export default function PageHeader({ heading, sub, variant = 'centered' }) {
    return (
      <header className={`wh-page-header wh-${variant}`}>
        <h1>{heading}</h1>
        {sub ? <p className="wh-sub">{sub}</p> : null}
      </header>
    );
  }
  ```
  ```js
  // sections/index.js  — the single registry both sides import
  import * as PageHeader from './PageHeader.jsx';
  import * as ProductGrid from './ProductGrid.jsx';
  // ...
  export const registry = {
    'page-header': PageHeader,
    'product-grid': ProductGrid,
    // ...
  };
  export default Object.fromEntries(
    Object.entries(registry).map(([k, m]) => [k, m.default])
  ); // { 'page-header': Component, ... } for the renderer
  ```
- **Verify:** `npm run sections:build` succeeds and the registry lists every section.
- **Gotcha:** components must be pure and must not use browser-only APIs at render time (no `window`, `document`) so they render on the server. Interactive bits (3D viewer, cart button) render a placeholder element that a tiny client script enhances after load.

### P4-T2 · Build the core sections
- **Goal:** cover the core pages (home, products, product-detail, contact).
- **Sections to build now:** `page-header`, `hero`, `text-block`, `text-and-image`, `product-grid`, `product-detail`, `contact-cards`, `cta-band`, `gallery`, `faq-accordion`.
- **Steps:**
  1. For each, copy the exact HTML from the matching current page, convert to JSX, extract editable bits into `fields`, keep the existing CSS class names so current styles apply unchanged.
  2. Data-backed sections (`product-grid`, `product-detail`, `faq-accordion`) take a `source` field naming the data file (`products.json`, `faq.json`) and receive the loaded `data` prop from the renderer.
  3. 1 to 3 layout variants per section via a `variant` select. No absolute positioning.
- **Verify:** render each section in isolation via the renderer to an HTML snippet and eyeball it against the baseline screenshot.
- **Gotcha:** move all inline per-page CSS these sections rely on into one shared stylesheet the pre-rendered pages link, so a page built from sections is styled without its old inline `<style>`.

---

## Phase 5 — Renderer

### P5-T1 · Core render functions
- **Goal:** turn a page tree + data + language into a full HTML document.
- **Files:** `renderer/render.js`, `renderer/template.js`, `renderer/head.js`.
- **Steps:**
  1. `renderer/render.js`:
     ```js
     const React = require('react');
     const { renderToStaticMarkup } = require('react-dom/server');
     const sections = require('./.build/sections.cjs');
     const { resolveField, LANGS, PRIMARY } = require('./i18n');
     const { buildHead } = require('./head');
     const { baseTemplate } = require('./template');

     function renderSection(node, lang, data) {
       const Comp = sections[node.type];
       if (!Comp) throw new Error('Unknown section type: ' + node.type);
       const props = resolveField(node.fields || {}, lang);
       return renderToStaticMarkup(React.createElement(Comp, { ...props, data, lang }));
     }
     function renderPage(tree, lang, data) {
       const body = (tree.sections || []).map(s => renderSection(s, lang, data)).join('\n');
       const head = buildHead(tree, lang);           // title, meta, canonical, hreflang, JSON-LD
       return baseTemplate({ head, body, lang });
     }
     module.exports = { renderSection, renderPage };
     ```
  2. `renderer/head.js` `buildHead(tree, lang)` must output: `<title>`, `<meta name="description">`, `<link rel="canonical">`, a full set of `<link rel="alternate" hreflang="...">` for every language plus `x-default`, Open Graph tags, and any JSON-LD the current page has (copy the schema types from the baseline head snapshots).
  3. `renderer/template.js` `baseTemplate({head, body, lang})` returns the `<!doctype html>` shell with `<html lang="...">`, the shared stylesheet link, the body, and any small enhancement scripts (language switch = plain links, 3D viewer loader).
- **Verify:** `node -e "const {renderPage}=require('./renderer/render'); ..."` renders `products` in `zh` to a string containing the product names from `data/products.json` (not an empty shell) and a `<script type=\"application/ld+json\">` block.
- **Gotcha:** the language switcher must be links to the per-language URLs, not client-side i18n. That is the whole point of pre-rendering.

### P5-T2 · Full-site build script
- **Goal:** render every page for the languages currently in scope.
- **Files:** `renderer/render.js` (add a `buildSite()`), driven by `npm run render`.
- **Steps:**
  1. Load all page trees from `data/pages/*.json` and all content from `data/*.json`.
  2. For Month 1, render only `zh` to the canonical paths. For Month 2, loop all `LANGS`, writing non-primary languages under `/<lang>/...` and adding them to the sitemap.
  3. Write files to the repo root (same locations the current pages occupy) and regenerate `sitemap.xml`.
- **Verify:** `npm run sections:build && npm run render` regenerates the core pages; opening them with JavaScript disabled still shows full content.
- **Gotcha:** do not delete pages you have not migrated yet. Render only the migrated slugs and leave the rest as the existing hand-coded files until Phase 13.

---

## Phase 6 — SEO assertion gate

### P6-T1 · SEO test that blocks a bad publish
- **Goal:** never ship a page that loses SEO.
- **Files:** `scripts/test-seo.js`.
- **Steps:** for each rendered page, assert:
  1. exactly one `<h1>`;
  2. non-empty `<title>` and `<meta name="description">`;
  3. a `<link rel="canonical">` whose URL matches the page path;
  4. `hreflang` links present for every in-scope language plus `x-default`, and reciprocal across the language variants;
  5. every `<script type="application/ld+json">` block is valid JSON and has an `@type`;
  6. compare against `baseline/head/<page>.html`: the JSON-LD `@type`s and canonical host must match the baseline.
- **Verify:** `npm run test:seo` exits 0 for migrated pages; deliberately break a canonical and confirm it exits non-zero.
- **Gotcha:** this is a gate, not a report. Wire it into publish (Phase 7) so a failing page cannot deploy.

---

## Phase 7 — Wire renderer into publish

### P7-T1 · One publish command
- **Goal:** `export -> render -> seo check -> commit` in one place.
- **Files:** `package.json`, optional `scripts/publish.js`.
- **Steps:**
  1. Add `"publish": "npm run export && npm run sections:build && npm run render && npm run test:seo"`.
  2. Document: after `npm run publish` succeeds, `git add -A && git commit -m "publish" && git push` triggers the existing GitHub Pages deploy.
  3. Optionally add the SEO check to `.github/workflows/static.yml` as a pre-deploy job so a bad commit is caught in CI too.
- **Verify:** a full `npm run publish` on the core pages succeeds and produces a clean, crawlable set of files; a page with a broken schema fails the command before commit.
- **Gotcha:** keep `writeIfChanged` semantics so `git diff` stays meaningful.

---

## Phase 8 — Puck editor app

### P8-T1 · Puck config from the section registry
- **Goal:** the editor offers exactly the sections the renderer knows.
- **Files:** `editor/puck.config.js`.
- **Steps:**
  1. Build Puck's `config.components` by mapping `sections/index.js` `registry`: for each `[type, module]`, set `{ fields: module.config.fields, defaultProps: module.config.defaultProps, render: module.default }`.
  2. Set the root config (page-level fields: title, seo.description, per language).
- **Verify:** the Puck left panel lists every core section; dragging one onto the canvas renders the real component.
- **Gotcha:** the canvas uses the same components as the renderer, so previews match the live page. Do not write separate "editor-only" versions.

### P8-T2 · Editor shell wired to the API
- **Goal:** load a page tree, edit, save.
- **Files:** `editor/App.jsx`, `editor/main.jsx`, `editor/vite.config.js`.
- **Steps:**
  1. On load, `GET /api/pages/:slug` and pass the tree as Puck `data`.
  2. On publish/save in Puck, `PUT /api/pages/:slug` with the updated tree.
  3. Add a language picker (which content language you are editing) and an admin UI language toggle (EN/中文), keyed strings in one dictionary.
  4. Preview button: render the current draft server-side to a private URL (call a `POST /api/preview` that renders one tree to a temp file, or render client-side using the same components).
- **Verify:** edit a heading in the editor, save, run `npm run publish`, confirm the change appears in the pre-rendered HTML.
- **Gotcha:** selection/instrumentation attributes Puck adds are for the canvas only. The renderer output must be clean (already true, since the renderer calls the components directly, not through Puck).

---

## Phase 9 — Migrate the core pages (zh)

### P9-T1 · Convert 4 to 5 core pages to trees
- **Goal:** home, 產品介紹 (products), a product-detail page, 聯絡我們 (contact), and one more, fully editable and pre-rendered in Chinese.
- **Steps:**
  1. For each page, build its `data/pages/<slug>.json` tree from the sections it needs.
  2. `npm run publish` and compare the output to the baseline screenshots at 1280px and 390px.
  3. Adjust section markup/CSS until the visual diff is within tolerance.
  4. Only then retire the old hand-coded file for that page (move it to `legacy/` first, do not delete outright).
- **Verify:** the migrated core pages render from trees, pass `npm run test:seo`, and match baseline visually. `npm run test:all` still green.
- **Gotcha:** keep the 3D product viewer working: the `product-detail` section outputs the `<model-viewer>` (or current viewer) element pointing at the model URL, enhanced by the existing client script.

---

## Phase 10 — Media + 3D to R2/CDN

### P10-T1 · Move heavy assets out of the repo
- **Goal:** stop shipping 72 MB of `.glb` on every deploy.
- **Steps:**
  1. Create a Cloudflare R2 bucket (or S3). Upload all `*.glb` and site images. Note the public/CDN base URL.
  2. Add an env var `MEDIA_BASE_URL` and make section components and `data` references build asset URLs from it.
  3. Update `vercel.json` `.glb` headers only if still serving any locally; otherwise remove that rule.
  4. `git rm --cached *.glb`, add `*.glb` to `.gitignore`, keep a copy in R2. Rewrite history only if the repo size is a real problem (optional, risky, do last).
- **Verify:** the live product pages load models from the CDN; the repo no longer contains the `.glb` files; deploy artifact size drops sharply.
- **Gotcha:** set long cache + CORS on the CDN (the current `vercel.json` already shows the needed headers: `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=31536000, immutable`).

---

## Phase 11 — Host the API + MongoDB

### P11-T1 · Get off the laptop
- **Goal:** the client can reach the admin over the internet.
- **Steps:**
  1. Provision MongoDB (Atlas free M0 to start). Put the connection string in the host's secret store, not in Git.
  2. Host the Express API. Two options, pick one and document it:
     - Small VPS (Hetzner/DigitalOcean, 2 vCPU / 4 GB), run with a process manager, TLS via Caddy/Let's Encrypt.
     - Vercel serverless: adapt `server/index.js` to the platform's handler; confirm MongoDB connection reuse across invocations.
  3. Seed production data with `npm run seed` pointed at the prod DB (or import the current `data/`).
  4. Create the super-admin via `npm run admin:create` using the `SUPER_ADMIN_*` env values.
  5. Nightly backup: `mongodump` to R2 on a cron, keep 30 days.
- **Verify:** log in to the admin from a different machine; edit and publish a page; restore last night's backup into a scratch DB successfully.
- **Gotcha:** preserve the fallback behaviour: if the API is down, the committed `data/` still serves the site. Never make the live site depend on the API being up.

---

## Phase 12 — Permissions, versioning, rollback

### P12-T1 · Lock down destructive actions
- **Goal:** the client cannot delete a page or change SEO unless allowed.
- **Steps:**
  1. Use Puck's permissions API to hide delete/duplicate where the role forbids it.
  2. Enforce the same on the API: `PUT /api/pages/:slug` and any delete route check role from `server/auth.js`. UI hiding is not security.
  3. Gate SEO fields (title, description, canonical) behind an admin-only flag.
- **Verify:** a `staff` token cannot delete a page or edit SEO via the API (returns 403); an `admin` token can.

### P12-T2 · Version history and rollback
- **Goal:** one-click undo of a bad publish.
- **Steps:**
  1. Since every publish is a Git commit, add an admin action that lists recent `data/pages` commits and can revert one (call a server endpoint that runs the git revert + re-render, or document the manual `git revert` for now).
  2. Also snapshot the page tree in a `pages_history` collection on each save.
- **Verify:** make a bad edit, publish, roll back, confirm the previous version is live again.

---

## MONTH 1 GATE
When Phases 0-12 are done: the client can log in over the internet, edit the core pages visually like Wix, publish, and the pages are pre-rendered and crawlable. Wix is still live as backup. Run `npm run test:all` and `npm run test:seo`, update `CLAUDE.md`, and demo.

---

## Phase 13 — All pages, full section set
- Build the remaining sections to reach ~22: `feature-grid`, `product-carousel`, `case-list`, `case-detail`, `research-list`, `report-list`, `article-list`, `brochure`, `map`, `testimonials`, `video`, `spacer/divider`.
- Migrate the remaining 13-14 pages to trees, each verified against baseline, each passing `test:seo`, old files moved to `legacy/`.
- **Verify:** all 18 pages render from trees; `legacy/` holds the retired originals; full test suite green.

## Phase 14 — All 7 languages
- In `buildSite()`, loop all `LANGS`. Write non-primary languages under `/<lang>/` paths, add each to `sitemap.xml`, and complete the `hreflang` set with `x-default` -> zh.
- Add a "what is missing" view in the editor listing fields not yet translated per language.
- **Verify:** every page exists in all 7 languages, `test:seo` confirms reciprocal hreflang across all variants, untranslated fields fall back to zh.

## Phase 15 — Forms
- Add a public form endpoint (`POST /api/forms/:name`) that writes submissions to Mongo. The static contact page posts to it. Handle spam (honeypot + rate limit) and validate input server-side.
- Surface submissions in the dashboard under Customers & Leads.
- **Verify:** submit the contact form on the static site; the entry appears in the dashboard; the site still works if the API is briefly down (form degrades, page does not break).

## Phase 16 — Dashboard parity
- Round out contacts/leads, an orders view, and analytics basics (pick a privacy-friendly analytics source, e.g. Plausible/Umami; note HK PDPO). Tidy the existing modules to match Wix vocabulary.
- **Verify:** the dashboard covers Home, Catalog, Orders, Customers/Leads, basic Analytics.

## Phase 17 — Security hardening + staging
- Upload validation on the media library (content-type allowlist, size cap, reject executables). CSRF protection on state-changing routes. Rate limiting. Rotate and store deploy secrets properly. Add a staging environment (second cheap host or a separate branch that deploys to a preview URL).
- Test the backup by restoring it into staging.
- **Verify:** an upload of a disallowed type is rejected; a restored backup boots on staging; secrets are not in Git.

## Phase 18 — Cutover
- Point the domain fully at the new pre-rendered site (already GitHub Pages via CNAME; confirm DNS and that all pages/languages are live). Submit the new sitemap to Search Console. Watch analytics and crawl stats for a week. Only then cancel Wix.
- **Verify:** all URLs resolve, redirects from old Wix paths are in place, Search Console shows the new pages indexed. Then, and only then, switch Wix off.

---

## Appendix A — Definition of done for any migrated page
- Renders from its tree; visually matches baseline within tolerance at 1280px and 390px.
- Pre-rendered: content is in the HTML, not fetched client-side.
- `npm run test:seo` passes (h1, title, description, canonical, hreflang reciprocity, valid JSON-LD, matches baseline schema types).
- Editable in Puck; all in-scope language fields present or falling back to zh.
- No editor-only attributes in the output.
- Heavy assets referenced from R2/CDN, not the repo.
- Old hand-coded file moved to `legacy/`, not deleted, until the phase is signed off.

## Appendix B — Commands quick reference
```
npm run dev           # Express API + admin at :4000
npm run seed          # seed MongoDB from data/
npm run export        # DB -> data/*.json (content + page trees)
npm run sections:build# bundle sections for the Node renderer
npm run render        # render page trees -> pre-rendered static HTML
npm run test:seo      # SEO assertion gate (blocks bad publish)
npm run publish       # export + sections:build + render + test:seo
npm run editor:dev    # Puck editor app (Vite)
npm run test:all      # existing full test suite
# deploy: commit to main -> GitHub Actions -> GitHub Pages
```

## Appendix C — Do not do these
- Do not ship React to the public pages. It is for the editor and server-render only.
- Do not chase byte-identical HTML. Gate on the SEO check + visual diff.
- Do not rebuild content editing in Puck; Pages CMS / the admin already do lists. Puck is for page layouts.
- Do not let the live site depend on the API being up.
- Do not delete original pages before their replacement passes the definition of done.
- Do not commit secrets or the `.glb` files.
