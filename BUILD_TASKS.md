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
  2. Install Puck: `npm i -D @puckeditor/core`.
     > **The package was renamed.** It used to be `@measured/puck`, which is now formally deprecated
     > on npm ("Puck has moved. Please use @puckeditor/core instead") and stuck at 0.20.2 from
     > September 2025. The current package is **`@puckeditor/core`** (0.23.0 as of September 2026,
     > still MIT, repo moved to `puckeditor/puck`). React peer is `^18.0.0 || ^19.0.0`, so Puck does
     > not dictate the React version. Confirm the current name and version before installing anyway;
     > it has changed once already.
  3. Create three folders: `sections/` (shared React components), `editor/` (Vite React app for Puck), `renderer/` (Node script that server-renders sections to HTML).
  4. Add scripts to `package.json` (do NOT remove existing ones):
     ```json
     "editor:dev": "vite --config editor/vite.config.mjs",
     "editor:build": "vite build --config editor/vite.config.mjs",
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
- **Verify:** `npm run sections:build` produces `renderer/.build/sections.cjs` and `node -e "console.log(Object.keys(require('./renderer/.build/sections.cjs').default))"` lists your section names. (Note the `.default`: the bundle's own keys are `['default','registry']`, so without it the command prints the module's exports and looks like it passed.)
- **Gotcha:** `external: ['react','react-dom']` so the Node process uses one React instance.

---

## Phase 2 — Page-tree data model

### P2-T1 · Define the page-tree schema and Mongo collection
- **Goal:** store page layouts as data, next to existing content.
- **Files:** `server/db.js` (add a `pages` collection), `data/pages/` (exported trees).
- **Steps:**
  1. Add a **separate** `PAGE_COLLECTIONS = { pages: 'pages' }` map in `server/db.js` with its own routes, and ensure an index on `{ slug: 1 }` unique.
     > **Not in `COLLECTIONS`.** That map is enumerated by `LIST_MODULES`, so adding `pages` to it would silently change `/api/health` and `/api/cms`, and the generic POST would treat a page tree as an ordered list that `writeList` replaces wholesale — data loss for per-slug documents. `AUTH_COLLECTIONS` and `SALES_COLLECTIONS` are kept out for the same structural reason.
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
> ### Use the real class names. This is the easiest way to waste a day.
>
> A section must reuse the class names **already in the live stylesheet**, so the existing CSS
> styles it with no new CSS at all. Do not invent a naming scheme, and in particular do not use
> `wh-`prefixed names — **no such classes exist in this site**. A section built on invented
> classes renders unstyled while passing every test, because the tests check markup, not paint.
>
> The method: find the block on the live page (`grep -n '<class you expect>' *.html`), copy its
> markup, and keep the classes exactly. Take the **variants from the pages too** — the real
> differences between pages are the variants; anything else is invention.
>
> Worked example, `sections/PageHeader.jsx` (built at P4-T1, use it as the reference):
> markup taken from `產品介紹.html:1446`, which ten of the eighteen pages share. Real classes
> `page-header` / `container` / `video-background`. Real variants `centered` (nine pages) and
> `video` (`研究報告.html`, which has a background `<video>` in the header). `aria-labelledby`
> is optional because `典型病例.html` omits it.

- **Contract:** each file default-exports a React component and named-exports a `config`:
  ```jsx
  // sections/PageHeader.jsx — abridged; see the file for the shipped version
  export const config = {
    label: 'Page header',
    fields: {                       // Puck field definitions
      heading:   { type: 'text' },
      sub:       { type: 'textarea' },
      variant:   { type: 'select', options: [
        { label: 'Centered',         value: 'centered' },
        { label: 'Background video', value: 'video' },
      ]},
      headingId: { type: 'text' },
    },
    // every field needs a default, or the editor starts with undefined props
    defaultProps: { heading: '', sub: '', variant: 'centered', headingId: '' },
    variants: ['centered', 'video'],
    // emptyWithoutContent: true,   <- only if the section renders nothing when empty
  };
  export default function PageHeader({ heading, sub, variant = 'centered', headingId }) {
    const id = headingId ? headingId : undefined;   // never render id=""
    return (
      <section className="page-header" aria-labelledby={id}>
        <div className="container">
          <h1 id={id}>{heading}</h1>
          {sub ? <p>{sub}</p> : null}
        </div>
      </section>
    );
  }
  ```
  Do not emit the live pages' `data-i18n` attributes: those exist so the browser can swap
  languages after load, which pre-rendering replaces with plain per-language links.

  **`emptyWithoutContent: true`** — a section may render nothing until it has content: an
  unmatched sku, an empty gallery or an empty related list should disappear rather than publish
  a broken shell. Where that is intended, declare it in the config. `test:sections` then requires
  the section to render empty with its defaults, and still fails any *other* section that renders
  blank by accident. Rendering nothing is a decision to review once, not a silent blank.
  Currently declared by `product-detail`, `gallery` and `related-products`.
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
- **Verify:** `npm run sections:build` succeeds and the registry lists every section; `npm run test:sections` passes. That suite loops the whole registry, so a new section is checked by it the moment it is registered — contract shape, one-source-of-truth, renders on the server, and no editor-only attributes in the output. Add the exact-HTML assertions for the new section alongside.
- **Gotcha:** components must be pure and must not use browser-only APIs at render time (no `window`, `document`) so they render on the server. Interactive bits (3D viewer, cart button) render a placeholder element that a tiny client script enhances after load.
- **Gotcha:** React 19 writes some boolean attributes in camelCase (`autoPlay=""`, `playsInline=""`) rather than lowercasing them. HTML attribute names are case-insensitive so browsers parse them identically — assert case-insensitively rather than "fixing" it.

### P4-T2 · Build the core sections
- **Goal:** cover the core pages (home, products, product-detail, contact).
- **Sections to build now:** `page-header`, `hero`, `text-block`, `related-products`, `product-grid`, `product-detail`, `contact-cards`, `cta-band`, `gallery`, `faq-accordion`. (All ten built at P4-T2.)
  > `text-and-image` was in this list and has been **removed**: the site has no two-column text+image block anywhere — a survey of every plausible class and every `*grid*` across all 18 pages found none — so building one meant inventing markup and CSS. `related-products` replaces it: real, on all six product pages, and needed by the Phase 9 migration.
  > `faq-accordion` keeps its name but renders a **static list, not an accordion**. The live block on `常見問題.html` has no toggle, no collapse and no `aria-expanded`; every answer is always visible. Adding collapse is a behaviour change for the client to approve, not something to introduce behind the name.
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
     const sections = require('./.build/sections.cjs').default;  // { type: Component }
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
- **Files:** `editor/App.jsx`, `editor/main.jsx`, `editor/vite.config.mjs`.
- **Steps:**
  1. On load, `GET /api/pages/:slug` and pass the tree as Puck `data`.
  2. On publish/save in Puck, `PUT /api/pages/:slug` with the updated tree.
  3. Add a language picker (which content language you are editing) and an admin UI language toggle (EN/中文), keyed strings in one dictionary.
  4. Preview button: render the current draft server-side to a private URL (call a `POST /api/preview` that renders one tree to a temp file, or render client-side using the same components).
- **Verify:** edit a heading in the editor, save, run `npm run publish`, confirm the change appears in the pre-rendered HTML.
- **Gotcha:** selection/instrumentation attributes Puck adds are for the canvas only. The renderer output must be clean (already true, since the renderer calls the components directly, not through Puck).

### P8-T3 · Publish an allow-list of directories, not the whole repo
- **Goal:** close **findings 6 and 16 together** — they are one root cause: *the deploy is the entire repository, so anything written into the working tree is published by default.* Finding 6 is build artefacts (editor source, bundles) shipping publicly; finding 16 was an internal audit trail with staff emails one commit away from a public URL. Fixing them one at a time leaves the mechanism intact and the next leak unblocked.
- **Files:** `.github/workflows/static.yml`. **This is the only file in the project that can change the live deploy, so it gets its own isolated review — show the diff and stop before applying it.** Do not fold this into another task's commit.
- **Steps:**
  1. Assemble the published site into a build directory from an **explicit allow-list**, and upload only that: the 18 static HTML pages, `data/` content files, `admin/`, `api/`, and the site metadata (`sitemap.xml`, `robots.txt`, `llms.txt`, `CNAME`, favicons, media still in the repo).
  2. **Excluded by not being listed:** `editor/`, `sections/`, `renderer/` (including `.build/` and `.out/`), `server/`, `scripts/`, `docs/`, `baseline/`, `preview/`, `node_modules/`, `.env*`, and any log or report file.
  2b. **But note P11-T2:** the client gets one admin site, which means the BUILT editor (`editor/dist/`, produced by `npm run editor:build`) is part of what ships, served under the admin's origin. So the allow-list is `editor/dist/` **in**, `editor/` source **out** — build output and source are not the same decision, and lumping them together either leaks the source or breaks the editor. Write the list that way now even though P11-T2 lands later; a list that has to be reopened is a list someone will get wrong.
  3. Prefer an allow-list over an ignore-list. An ignore-list fails **open** — a new folder ships unless someone remembers to exclude it. An allow-list fails **closed**, which is the behaviour that would have prevented finding 16.
- **Verify:** deploy to a branch or preview environment first, never straight to `main`. Then assert on the **published output**, not on the repo: the 18 pages and `data/*.json` are reachable, and `editor/`, `server/`, `scripts/`, `renderer/` and any `*-log.json` return 404. Wire that assertion into the publish gate so the exclusion cannot silently regress.
- **Gotcha:** `admin/index.html` and `api/cms.js` ARE part of the published site and must stay in the allow-list — the admin is served from Pages and falls back to the committed files when the API is down (CLAUDE.md hard rule 1). Dropping them would break that fallback. Excluding `server/` and `scripts/` does not: nothing the browser loads reads them.

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

#### 產品介紹 (the first page): DONE 15 Sep 2026, awaiting owner review before page two

**Retired.** The hand-coded original is `legacy/產品介紹.html` (`8d29617`), and `/產品介紹.html` is
the pre-rendered page, written by `renderer/render.js`. `test:all` is green: 14 suites, 879 checks.

**Owner decisions that unblocked it (15 Sep 2026):**
- **The site content is not authoritative;** the client will replace all of it. Content disputes
  are no longer blockers. Findings 9, 17, 22 and 26 stay recorded as background, with no further
  action or data changes on them.
- **Prices come from `data/products.json`:** 憶活素 HK$880, PT3 HK$2,480. The price hold was
  removed (`45106f0`); a different number later is a data edit.
- **PSP-500 stock:** Group B was committed (`e567a69`), so `data/` and the database agree.

**The five build items, as built:**
1. **Render to the site root** (`6187f62`): a tree is written to its page's root path once its
   original is in `legacy/`, only if changed. A page not retired is never written over.
2. **Chrome/CSS sources repointed** (`6187f62`): `renderer/source-page.js` (legacy/ first) feeds
   `loadStyles` / `loadChrome`, the preview route, `extract-css.js`, `migrate-products.js` and the
   fidelity maps. It is a repoint, not the shared chrome partial; that is still open, for when a
   second page needs chrome.
3. **UI tests retargeted** (`3505123`): `test-ui-mongo` now proves that the database reaches the
   published card, and that the committed page needs no database and no scripts.
   `test-ui-sweep` names the pre-rendered pages it doesn't language-switch. `test-ui-auth` is
   unchanged.
4. **`legacy/` kept off the public site** (`8d29617`): `noindex` on the retired copy, `/legacy/`
   disallowed in every `robots.txt` crawler group, and `test:data` enforcing both, plus "nothing
   links to it", with a negative control. P8-T3's deploy allow-list, the proper fix, is still not
   applied.
5. **Visual diff against the 15 Sep baseline, fully reconciled.**
   - **Scripts on:** 15.1% at 1280, 14.8% at 390, and all of it has a known cause. Rendered in
     memory with the old product order, the two old prices and `lang="zh"`, the page equals the
     control exactly: 2,602 / 785 px, the page-header marquee only. So the difference is **product
     order** (database order), **the two accepted prices**, and **the `lang` font effect** (finding
     21b).
   - **Scripts off:** the old page is an empty shell (0 product cards); the migrated page shows all
     6. Migrated scripts-off vs scripts-on differs only by the hidden JS-only controls.

**Recorded, accepted:**
- stock changes go live at publish (flag for `ADMIN_GUIDE.md`);
- the Chinese-only regression (finding 24);
- definition-of-done waivers: "heavy assets from R2" (Phase 10 dependency); "editable in Puck"
  passes after the `mergeTree` fix.

#### The six content pages (the batch): DONE 16 Sep 2026, 07:40–09:01

All six retired to `legacy/`, each its own commit. `test:all` green: 14 suites, **1,203 checks**.
**81 minutes for six pages**, including the three new section types and one behaviour file.

| page | commit | new work | done |
|---|---|---|---|
| 聯絡我們 | `4442997` | section wrappers in the renderer; multi-line contact details | 08:08 |
| 小册子 | `057e879` | — (caught the per-language brochure scan, finding 28) | 08:19 |
| 有效成份檢測 | `36a91d0` | — | 08:28 |
| 微信發表文章 | `3b95641` | stylesheet-exists guard in the renderer | 08:36 |
| 研究報告 | `a82ea26` | first use of the page-header video variant | 08:44 |
| 典型病例 | `84fc473` | `case-list` section + `assets/behaviour/case-list.js` | 09:01 |

**Sections built once, up front** (`7382cc7`, owner-approved before building): `card-grid` with five
variants (brochure, report, icon, article, link-list), `map-embed`, plus `text-block/intro` and
`callout/info`. `case-list` came later with its page. 14 section types now.

**Three things the batch found that no gate had:**
1. **The live pages' `<section>` wrappers carry padding** (`2f428e0`). Dropping them moved
   everything below and left 聯絡我們 10px short. `wrap` now takes `{ section, label, container }`,
   and adjacent nodes naming the same section share one wrapper, as the live markup does.
2. **小册子 swaps its brochure image AND link per language** (finding 28). The `src` in the markup
   is the German scan; pre-rendering it verbatim would have published that to Chinese visitors.
   Nothing but the visual diff caught it.
3. **A page could link a stylesheet that does not exist** (`3b95641`). 微信發表文章 rendered happily
   against a `page-articles.css` nobody had generated and would have published unstyled at 969px
   wide. The renderer now refuses it, as it already did for behaviour scripts.

**Every page reconciled to the pixel.** At `lang="zh"` five of the six equal the control exactly,
region for region. 研究報告 differs only inside the page-header band, where its background video
plays a different frame per capture; every pixel outside that band is identical. 有效成份檢測 carries
212 px of FontAwesome icon-edge antialiasing, whose only cause is D1 itself (`body{overflow-x:clip}`
vs `hidden`), with identical geometry to three decimals.

**Scripts off**, every migrated page now differs from its original for two deliberate reasons: the
original needs JavaScript to clear its fixed nav (D1, finding 15), and our JS-only controls are
hidden rather than left dead. On 典型病例 the difference is the point: the old page rendered **no
cases at all** without JavaScript; ours renders all fifteen with their full text.

#### Effort: actual for page one, and the revised Phase 9 estimate (15 Sep 2026, replaces the earlier estimate)

**Actual, page one (from the commit timeline):** P9-T1 ran from Fri 11 Sep midday to Tue 15 Sep
late morning, i.e. **~2.5 working days** (Fri afternoon, Mon, Tue; the weekend was not worked). The
earlier "~4 days" counted calendar days.
- **Roughly 1.5 days were one-time work or incidents** that the other pages won't repeat: the
  catalogue data migration, D1 sticky nav, D2 per-page CSS, the baseline re-capture, the behaviour
  framework and `test:behaviour`, the export email leak and identity rotation (finding 22), and the
  invented ratings (finding 26).
- **Roughly 1 day was page work:** the tree, product-grid fixes, behaviour wiring and
  reconciliation.
- **The five build items plus the move took under half a day**, against the 1.5–2.5 days
  estimated. The harnesses already existed, item 2 was a repoint rather than a chrome partial, and
  item 4 was noindex + robots rather than P8-T3.

**Revised estimate for the other 17 pages: ~10–14 working days.** Content is no longer a blocker,
so the main variable is now **engineering**: new section types and the interactive pages.

| pages | count | estimate | why |
|---|---|---|---|
| Content pages: 典型病例, 小册子, 常見問題, 微信發表文章, 有效成份檢測, 研究報告, 聯絡我們 | 7 | ½ day each → **3.5–4.5 days** | sections exist (faq, text, gallery, contact cards); tree + reconcile + scripts-off, little behaviour |
| Product detail pages: 產品_T3, _PT3, _乙肝清, _憶活素, _雲芝糖肽精華_A / _B | 6 | first ~1 day, then 2–3 h each → **2–2.5 days** | one shared pattern: product-detail section, quantity + add to cart through `site.js`, and the 3D viewer where a page has one |
| `index.html` (homepage) | 1 | **1–1.5 days** | hero video, 3D viewer, the most sections |
| `product.html` (generic `?sku=` page, noindex) | 1 | **½–1 day** | client-side by design; either keep it hand-coded or replace it with the static detail pages |
| `購物車.html` (cart/checkout, noindex) | 1 | **1.5–2.5 days** | the heaviest script on the site; may stay a hand-coded app page |
| `account.html` (sign-in) | 1 | **1–2 days, likely deferred** | depends on the hosted API (Phase 11) |

- **One-time items still ahead,** inside the range above: the shared chrome partial (~1 day, once),
  and whatever new section types these pages need beyond the core 10.
- **Re-estimate after the first content page and the first product detail page.** Those two
  patterns cover 13 of the 17 pages.

#### Re-estimate after the batch, 16 Sep 2026 — 9 pages left

Eight content pages took **~1.75 hours of machine time in total**, against 3.5–4.5 days estimated.
The estimate was wrong about what the work IS: with the sections built, a content page is a tree
lifted from the original by script, a CSS line, a render and a reconcile. What costs real time is a
**new section type**, a **behaviour file**, or a **difference the diff will not explain**.

| pages | count | estimate | what actually drives it |
|---|---|---|---|
| Product detail pages (產品_T3, _PT3, _乙肝清, _憶活素, _雲芝糖肽精華_A / _B) | 6 | **½–1 day for the first, then ~30 min each: 1–1.5 days total** | `product-detail`, `gallery` and `related-products` already exist and are fidelity-mapped to these pages. The quantity/add-to-cart path is `site.js`, already proven on 產品介紹. Real risks: the **3D `<model-viewer>`** (no section for it, and the models are the 75MB `.glb` files Phase 10 moves), and per-language images (finding 28) |
| `index.html` (homepage) | 1 | **½–1 day** | the most sections (hero, stats, glass card, featured cases, product grid), a background video, a 3D viewer, and the homepage-specific JS. `hero` and `text-block/glass` exist and are mapped |
| `product.html` (generic `?sku=`) | 1 | **¼–½ day, or leave it** | it exists to render any SKU from a query string, which a pre-rendered page cannot do. Either keep it hand-coded (it is `noindex`) or drop it in favour of the six static detail pages. **Owner decision, not effort** |
| `購物車.html` (cart/checkout) | 1 | **½–1 day, or leave it** | a transactional app page, `noindex`, no document subject (finding 3). Pre-rendering buys nothing for SEO; the case for migrating is editable chrome and copy, not crawlability |
| `account.html` (sign-in) | 1 | **defer to Phase 11** | depends on the hosted API; same reasoning as the cart |

**So: ~2–3 working days for the six product pages plus the homepage, and two of the remaining three
are decisions rather than work.** The one-time costs left are the same two as before — the shared
chrome partial and any new section type (a `model-viewer` section is the likely one).

**What would make this slower:** a page that needs a new section type the owner must review first
(that is the intended gate), a behaviour file (典型病例's took about half of that page's 17 minutes),
or per-language media (finding 28) on the product pages, which must be checked per page before
migrating, because only the visual diff catches it.

#### 常見問題 (page two, first content page): DONE 15 Sep 2026, awaiting owner review

**Retired** (`fc8c6e8`). `legacy/常見問題.html` (git rename, noindex), and `/常見問題.html` is rendered
from `data/pages/faq.json`, which is also in the database (export leaves `data/` unchanged).
`test:all` is green: 14 suites, 943 passing checks.

**Actual elapsed: ~25 minutes** (11:31 → about 11:56 IST, docs included). The ½-day estimate was
~10× too high for a page whose sections exist.

**What was novel** (`79a2d39`, `1f52e61`):
- **`callout` section** (11th type): `.highlight-box` + `.expert-link`, and the tinted note with an
  inline link (`body` + `label` + `after`). Unique to this page.
- **FAQPage is derived, not carried.** `render.js faqPageNode` builds it from the data the
  faq-accordion renders. A tree carrying its own FAQPage alongside is refused. `test:seo` check 7
  fails any page whose FAQPage names different questions from its visible list.
- **`test:behaviour` PART 5** runs the shared `site.js` effects on every other published tree:
  - menu, badge, cross-tab, language;
  - scripts off;
  - per-page negative controls.

  `test:editor:lang` round-trips every tree. Both find pages from `data/pages/`, so later content
  pages get this coverage without test edits.

**What was mechanical:**
- **The tree:** lifted from the original by jsdom.
- **Page CSS:** one `MIGRATED` line in `extract-css.js`.
- **Chrome:** per-page `chromeFrom`.
- **Legacy guard** and render-to-root: no change needed.
- **Existing gates:** SEO, fidelity and publish needed none either.
- **Visual diff harness:** generalised once to take any page (scratchpad).

**Visible change, recorded:** the list now shows `data/faq.json`, the list the admin edits, instead
of the 5 hand-coded Q&As. No data was changed (owner: content not authoritative).
- This is also the first time an admin FAQ edit reaches the site; the admin screen already said it
  did.
- The seven-language `translations` for the old Q&As go with them (Chinese-only, finding 24).

**Visual diff, reconciled:**
- **Scripts on:** 39.0% at 1280 and 47.4% at 390. The data answers are shorter, so everything below
  them moves up.
- **The proof:** the same tree was rendered in memory with the original's own Q&As and icons.
  - Under `lang="zh"` the page is the same height as the baseline.
  - Its only difference is **one mid-sentence bold run in Q2**, which the copy model cannot express
    (finding 14: lead-ins only).
  - With that `<strong>` restored it **equals the control pixel for pixel**, region by region
    (32,373 px at 1280, 15,006 at 390; the control is drift in the original itself).
- **Scripts off vs scripts on** differs only in the nav switcher.

**Small differences, accepted without a visual effect:**
- the list is no longer inside `<section class="faq-section" aria-label>`, whose padding is 0;
  the region label is gone;
- the WeChat link's Simplified-Chinese `aria-label` is dropped, so the visible label is its name;
- the carried Product node for PSP-500 still says `InStock` / price 0, as the original did
  (background, content not authoritative).

**Chrome partial: still optional, not blocking.** Per-page `chromeFrom` gave this page its own nav
and footer with no extra work. It becomes worth building when chrome must change once for all pages,
or when a page has no original to lift from (add-page-from-template).

**Recorded, accepted (owner):**
- **Stock goes live at publish, not instantly.** The rendered page bakes stock in; the old page read
  `inventory.csv` when it loaded. **FLAG FOR `ADMIN_GUIDE.md`**, written when the page actually
  retires: an admin stock change reaches the website only after publish.
- **Chinese-only regression** (finding 24).
- **Definition-of-done waivers for Phase 9:**
  - *"Editable in Puck"*: waived only until the `mergeTree` fix, which has landed, so it now passes
    (`test:editor:lang`, with a negative control against the pre-fix code).
  - *"Heavy assets from R2/CDN"*: waived. Product photos are Google Drive hotlinks, and moving them
    is Phase 10, which comes after Phase 9 by design. Re-check at Phase 10.

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

> **HARD GATE — no exposed identity in the hosted database.** Hosting does not go live until this
> passes. Not a note.
>
> Three login addresses from the local dev database are in public git history (docs/FINDINGS.md
> finding 22). The decision was to rotate identities, not rewrite history, which is only safe if
> **none of those identities ever reaches a reachable system**. So:
>
> - **Never import the dev `users` or `sessions` collections into the hosted database** — no
>   `mongodump`/`mongorestore` of the dev DB wholesale. Content may be seeded from `data/`; accounts
>   are created fresh (step 4) with addresses the business controls.
> - **Check, don't trust:** before go-live, hash every hosted account's email (`sha256` of the
>   trimmed, lower-cased address) and assert none matches these. They are fingerprints, not the
>   addresses — the addresses are not quoted anywhere, by standing practice:
>   ```
>   87924606b4131a8aceeeae8868531fbb9712aaa07a5d3a756b26ce0f5d6ca674
>   2fbd33c012587b73ab496d79e764917c7c40b0874531c77267b3a83c45aeeb9d
>   7932b2e116b076a54f452848eaabd5857f61bd957fe8a218faf216f24c9885bb
>   ```
>   A fingerprint of a guessable address can be brute-forced, so this hides nothing from a
>   determined reader — the addresses are already public. It exists so the check never re-quotes them.
> - Also assert every hosted account uses a domain the business controls, and no account is a
>   free-mail address (`gmail.com` etc.) that nobody here owns — that becomes a takeover route the
>   moment password-reset email exists.
> - **Verify:** run the check against the hosted DB and show it pass; insert a throwaway account whose
>   email hashes to one of the fingerprints in a scratch DB and show it fail.

### P11-T3 · Login throttle that survives hosting — security, owner Phase 11

Owned by Phase 11 rather than Phase 17 because hosting is what breaks it. Today's throttle
(`server/auth.js`) counts 5 failures per **email + IP** per 15 minutes in an **in-memory `Map`**:

- **On Vercel serverless (an option in P11-T1) it is not a weak throttle, it is no throttle.** Each
  instance has its own `Map`, and a cold start empties it.
- On a VPS a restart clears it, and **rotating IPs defeats email+IP keying** everywhere — which matters
  more now that every admin login name has been public (finding 22).

- **Steps:** store failure counts in MongoDB (a collection with a TTL index), so they survive restarts
  and are shared by every instance. Lock **per account** after N failures regardless of IP, with an
  exponential back-off; keep a separate per-IP limit for spraying across accounts. Answer identically
  for unknown and known accounts so the lockout is not a username oracle. Log lockouts to the activity
  trail (never to `data/`). Give the super-admin a documented out-of-band unlock.
- **Verify:** N wrong passwords from N different IPs lock the account; a restart (or a second instance)
  does not reset the count; a correct password during lockout is still refused; the lock expires; an
  unknown email gets the same response and timing class as a known one.

### P11-T2 · ONE admin site, one login — a client requirement, not a nicety
- **Goal:** the client reaches sales, inventory, products, customers, users **and** the visual page editor from **one place**, signing in **once**. They must never be given two URLs or asked to log in twice. The two-app split stays underneath; it must not surface.
- **Why here and not earlier:** this needs (a) an editor that works — P8-T2, done; (b) real pages to edit, or "Edit site" opens onto one demo tree — Phase 9; (c) **a decision about which origin serves what**, which is exactly what Phase 11 decides. Building it before hosting means building against `localhost:5173` assumptions and redoing it. Doing it as part of hosting means hosting delivers one product rather than two.
- **Files:** `admin/index.html` (a nav entry), `editor/vite.config.mjs` (`base`), `server/index.js` (serve the built editor), the host's routing config, `.github/workflows/static.yml` (via P8-T3's allow-list).
- **Proposed shape — cheapest thing that actually solves it:**
  1. `npm run editor:build` emits `editor/dist/`. Serve that **under the admin's own origin** at a subpath, e.g. `/admin/pages/`. Locally that is one `express.static` line; in production it is one routing rule on whatever hosts the admin.
  2. Add a left-nav entry to `admin/index.html` — 頁面編輯 / "Edit site" — linking to that subpath. That is the entire client-visible change.
  3. **Same origin means single sign-in comes for free.** The editor already reads the same `wh_admin_token` key from `localStorage` that `admin/index.html` writes (`admin/index.html:1354`). On one origin they are the same storage, so the editor's own sign-in screen becomes a fallback that is never seen. **No change to the auth model, no shared-cookie work, no second session.**
  4. Set Vite `base` to the subpath, or the built asset URLs resolve at the wrong path.
- **Verify:** sign in to `/admin` once, click 頁面編輯, edit and save a page **without being asked to log in again**; sign out in the admin and confirm the editor is signed out too; confirm there is exactly one URL to hand the client.
- **Depends on:** **P8-T3** (the deploy allow-list must ship `editor/dist/` while still excluding `editor/` source — see the note there), **Phase 9** (pages worth editing), **Phase 12** (who is allowed to open the editor at all).
- **Decisions this forces — take them at Phase 11, not now:**
  1. **Same origin, or a separate host?** Same-origin subpath costs nothing and changes no auth. A separate host (`editor.wonder-herb.com`) means `localStorage` cannot be shared and single sign-in becomes a real auth change — a cookie on the parent domain, which means httpOnly + SameSite + CSRF handling the project does not have today. **This is the decision everything else hangs off.**
  2. **Does the admin (and now the editor) stay on GitHub Pages, or move to the API host?** Moving them makes findings 6 and 16 largely vanish, because the deploy stops being "the whole repo". But `admin/index.html` is served from Pages *on purpose*: it falls back to the committed files when the API is down (CLAUDE.md hard rule 1). Moving it breaks that. Decide deliberately — **and note the split need not be all-or-nothing: hard rule 1 exists to protect the PUBLIC SITE, which stays static on Pages, non-negotiable. The admin and editor are tools, not the public site; if the API is down the client simply cannot edit for a while, which is tolerable in a way a dead public site never is. So moving admin+editor to the API host may well be fine even though moving the public site never would be.**
  3. **Is the editor a public URL?** The admin already is — anyone can load it; the API is what gates writes. The editor is the same shape (`noindex` is already set). Acceptable, but say so out loud rather than discovering it.
  4. **Is "may edit pages" a new permission,** or does it ride on the existing module ticks? Today `PUT /api/pages/:slug` uses `requireAdmin`; the editor UI itself is loadable by any signed-in user. Phase 12's question, but P11-T2 is when the client first sees the door.
- **Gotcha:** the business half is NOT rebuilt in the editor. Sales, inventory, products, customers and users stay exactly where they are, in `admin/index.html` and its API. This task adds a doorway and a shared session — nothing more. CLAUDE.md non-negotiable 3.

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

### P12-T3 · Make the admin's product form multilingual
- **Goal:** give staff a way to edit product names and descriptions in all seven languages. Today they can edit `zh` and **cannot reach the other six at all** — the form is a single `<input>` per field.
- **Why it is a task and not a bug:** the data became per-language at P9-T1 (finding 19), recovering seven translations the live site already shipped. `server/index.js` `protectLangMaps()` stops a plain-string save from deleting them (finding 20, HIGH), so nothing is at risk — but a guard is not an editor. **This form is the client's only route to their own translations.** Until it lands, a typo in the German product name can only be fixed by a developer.
- **Files:** `admin/index.html` (the product form and its save path).
- **Steps:**
  1. Add a content-language picker to the product form, matching the Puck editor's — one language at a time, not seven inputs per field (the P8-T1 reasoning: seven inputs bury the form, and one-at-a-time is how a person actually works, especially through a Chinese IME).
  2. **Reuse `editor/lang.js`'s `project` / `merge`.** That logic is already proven by the 26 checks in `scripts/test-editor-lang.js`, including the two bugs it was written to catch: fallback poisoning, and losing translations when items are reordered. Do not write a second implementation — a second one will get the same two things wrong.
  3. Keep the API guard afterwards. It is the floor for every caller, not a substitute for this.
  4. **The store merges, never replaces (finding 25, HIGH, added at P9-T1).** The rule is general: **no write path may delete a field its caller was not shown.** `protectLangMaps` covers one field type (language maps); this covers the class. Implement it once, in the API, for **every content write path**:
     - `POST /api/cms` lists: match items by SKU/`id`, start from the stored item, apply incoming fields, `null` removes a field, an absent *item* is still deleted.
     - `POST /api/cms?type=homepage`: the same, at the top level.
     - `PUT /api/pages/:slug`: top level **and per section**. Persist a stable section id first, because stored trees derive one from position.
     - Report what was kept in the response.

     It bites **today** in two places: the admin product form deletes `link`, `ribbon` and `priceNote` (and would delete `clinicOnly`), and an unchanged Puck save deletes the product grid's section-level `"wrap": "container"` (proven by running `mergeTree`). Homepage and FAQ are the same shape waiting for their first new field. The forms and `mergeTree` get fixed too, as defence in depth, not as the fix. The Puck side of it was fixed narrowly at P9-T1 (`mergeTree` keeps node-level keys), so saving 產品介紹 in the editor is safe; the API rule for every path is still this step. **Blocks** lifting PT3's price hold (`assets/site.js` `PRICE_HOLD`).
- **Verify:** edit a product's German name in the admin, save, confirm `zh` and the other five are untouched — the same round-trip `scripts/test-editor-lang.js` runs for page trees. Confirm an untranslated field shows **empty**, never the Chinese fallback. **For step 4:** one test loops **every** content write path. For each, it saves through the real caller (admin form, `mergeTree`) with fields the caller doesn't show present in the store, and confirms they survive in MongoDB and in `data/` after export. Include PT3 with `link`/`ribbon`/`priceNote`/`clinicOnly`, and 產品介紹's tree with `wrap`. Negative control: the same saves against the pre-fix API lose them. A new write path must fail this test until it merges.
- **Gotcha:** `admin/index.html` is vanilla JS with no build step, and `editor/lang.js` is an ES module importing CommonJS (finding 18). Settle how the admin loads it — a small shared build, or the `<script type="module">` the page can already use — rather than copying the functions across, which would fork the logic the moment either side changes.

---

## MONTH 1 GATE
When Phases 0-12 are done: the client can log in over the internet, edit the core pages visually like Wix, publish, and the pages are pre-rendered and crawlable. Wix is still live as backup. Run `npm run test:all` and `npm run test:seo`, update `CLAUDE.md`, and demo.

---

## Phase 13 — All pages, full section set
- Build the remaining sections to reach ~22: `feature-grid`, `product-carousel`, `case-list`, `case-detail`, `research-list`, `report-list`, `article-list`, `brochure`, `map`, `testimonials`, `video`, `spacer/divider`.
- Migrate the remaining 13-14 pages to trees, each verified against baseline, each passing `test:seo`, old files moved to `legacy/`.
- **Verify:** all 18 pages render from trees; `legacy/` holds the retired originals; full test suite green.

## Phase 13G — GEO: AI-crawler visibility, as deliberate work

Lettered, not numbered, so Phases 14–18 keep their existing numbers.

**Why this exists as its own phase.** GEO is a stated goal of this project alongside SEO, and right
now it is being *protected* rather than *advanced* — and nothing in the project says so out loud,
which is how it ends up assumed-covered by `test:seo`. It is not covered. `test:seo` asserts
per-page head correctness (JSON-LD parses, canonical, hreflang reciprocity, meta present, heading
order). It never opens `llms.txt`, `robots.txt` or `sitemap.xml`. Those three files are the GEO
surface and **no gate reads any of them.**

What already exists and must not be lost (all hand-made, all currently correct):
- `robots.txt` explicitly allows **GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot,
  Google-Extended, Applebot-Extended, Bingbot**, and points at the sitemap. This is real GEO work
  that someone did on purpose; a careless edit silently un-publishes the site to AI crawlers.
- `llms.txt`: 24 lines, a curated index of 14 pages with one-line descriptions. All 14 links
  currently resolve. It does not list `index.html`.
- `sitemap.xml`: 15 URLs. It deliberately omits `account.html`, `product.html` and `購物車.html`
  — the same utility/transactional pages `test:seo` allow-lists. Consistent, and worth asserting
  rather than leaving as a coincidence.

### P13G-T1 · Guard what exists, BEFORE the pages migrate — owner Phase 10

Do this early. It is cheap, it is protective, and its whole value is that it runs *while* pages are
being rebuilt. Migration is exactly when these rot: a page moves to `legacy/`, a slug changes, and
`llms.txt` keeps pointing at a URL that 404s. Nothing would report it today.

- Extend the gate (or add `test:geo`, wired into `test:all` like every other suite) to assert:
  every `llms.txt` link resolves to a page that will actually be published; every non-utility page
  is listed; `robots.txt` still carries each AI-crawler allow block by name, with a comment saying
  removing one is a deliberate act; `sitemap.xml` covers exactly the published set minus the
  utility allow-list; the three files agree with each other.
- **`sitemap.xml` must track the rendered page set, not the files on disk.** Every sitemap entry
  resolves to a page that is actually published, and every published non-utility page has one. A
  page migrated to a tree, or moved to `legacy/`, must not leave a stale entry pointing at the old
  file or at nothing. `legacy/` itself is never in the sitemap.
- **Every `llms.txt` link resolves** — to a published page, checked by the gate on every run, not
  once by hand. (Today all 14 do; that is a fact about today, not a guarantee.)
- **Verify:** delete one AI-crawler block, point one `llms.txt` link at a missing page, or leave a
  sitemap entry for a page moved to `legacy/` — the gate fails each time. Prove it bites, then
  restore.

### P13G-T2 · Advance GEO deliberately — owner after Phase 13

Correctly sequenced after migration, not before: tuning GEO now would tune for pages that are about
to be rebuilt, and `llms.txt` in particular is a description of a page set that is still changing.

> **SUPERSEDED (owner, 15 Sep 2026, later the same day):** the current site content is not authoritative; the client will replace all of it. The rule below is **not** a Phase 9 gate and is not to be acted on. It stays as background for whenever the client's replacement content is reviewed.
>
> **CLAIMS PROVENANCE: added 15 Sep 2026, and NOT deferred to after Phase 13 (docs/FINDINGS.md
> finding 26).**
> - **Why it can't wait.** The June 2026 uploads that put invented ratings into the live pages also
>   turned patients' cases into five-star "reviews" and cited an unsupported patient-feedback
>   statistic. Whoever wrote that was writing health persuasion copy, and the same uploads carried
>   the pages' visible text. **So no health claim on the current pages can be presumed to be the
>   client's own words.**
> - **Examples:** 產品_T3.html's statement about inhibiting tumour growth, the efficacy multipliers,
>   the "university-proven" phrasing.
> - **Rule, applied per page at Phase 9 migration, not at the end:** before a migrated page
>   publishes a health or efficacy claim, trace it to a client-approved source (their Wix site,
>   their printed materials, or their written approval). An unsourced claim is **held**: not
>   carried into the page tree, not rewritten by us.
> - **Patient case material** (典型病例) needs the client's confirmation that the patients
>   consented to its publication. It must never again be presented as a review or rating.

- Regenerate `llms.txt` from the page trees rather than maintaining it by hand, so it cannot drift
  from what is published. Decide then whether to add `llms-full.txt`.
- **Fix the existing gap: `llms.txt` does not list `index.html`**, the homepage. Found at the Phase
  13G registration; not fixed then because the file is about to be generated rather than edited.
- Revisit the JSON-LD now that content is modelled: `Product` nodes can carry real `offers` from
  `data/products.json`, and FAQ/Article types can be derived rather than carried verbatim.

> **HARD RULE — never emit `aggregateRating`, `review` or any rating data that does not exist.**
> `data/products.json` holds no ratings or reviews. Fabricating them violates Google's structured
> data policies (manual action risk, loss of rich results), and on a **health products** site it
> is a real-world harm: invented ratings make a medical product look more trusted than any evidence
> supports. This is not a preference to weigh against rich-result gains. If genuine, attributable
> review data is ever collected, adding it is a new decision with the client — not a default.
> The gate should assert the absence, so this cannot be added by accident.
- Assess extractability for answer engines: heading hierarchy, question-shaped headings, whether
  key claims sit in text rather than images. The site's evidence pages (`有效成份檢測`, `研究報告`,
  `典型病例`) are its GEO strength and are currently the least structured.
- Settle the medical-claims posture with the client before amplifying anything. This is a health
  products site: making claims *more* machine-extractable raises the stakes on their accuracy.
- **Verify:** `llms.txt` is generated and matches the published pages exactly; JSON-LD validates;
  a crawl of the published output shows key claims as text.

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
- Upload validation on the media library (content-type allowlist, size cap, reject executables). CSRF protection on state-changing routes. Rate limiting for the remaining routes — **login throttling is NOT here**, it is P11-T3 and must land before hosting. Rotate and store deploy secrets properly. Add a staging environment (second cheap host or a separate branch that deploys to a preview URL).
- Test the backup by restoring it into staging.
- **Verify:** an upload of a disallowed type is rejected; a restored backup boots on staging; secrets are not in Git.

## Phase 18 — Cutover
- Point the domain fully at the new pre-rendered site (already GitHub Pages via CNAME; confirm DNS and that all pages/languages are live). Submit the new sitemap to Search Console. Watch analytics and crawl stats for a week. Only then cancel Wix.
- **Gate — the site still depends on Wix for media.** `grep -rn "wixstatic" *.html` must return **nothing** before Wix is switched off. It currently returns 45 hits across all 18 pages: the homepage background video plus the `og:image` / `twitter:image` social previews. Cancelling Wix with any of these left breaks the homepage and every link preview. Phase 10 is what clears it. See `docs/FINDINGS.md` finding 1.
- **Correction (15 Sep 2026):** the domain is **not** "already GitHub Pages via CNAME". `www.wonder-herb.com` and the apex resolve to Wix today; the `CNAME` file in the repo does not point DNS anywhere. Cutover is a DNS change plus a deliberate re-enable of GitHub Pages, which the owner unpublished on 15 Sep 2026 (finding 26).
- **Gate — finding 26 must not ship again.**
  1. **Stale "Review" comments on `main`.** 13 pages still carry an HTML comment listing "Review" among their structured-data types, including one naming social proof as its purpose. Remove them before cutover; `rebuild/editor` already did (`d2ee9c4`). Check: `git grep -n -e '<!--[^>]*[Rr]eview[^>]*-->' -- '*.html'` on the branch being deployed returns **nothing**.
  2. **No rating or review data anywhere in the deployed tree**, pre-rendered or hand-coded. `npm run test:seo` covers rendered pages. Also check that `git grep -n -e aggregateRating -e reviewCount -e ratingValue -e '"Review"' -- '*.html' 'data/'` returns nothing.
  3. **No `noindex` anywhere** in what deploys: `git grep -n -i noindex -- '*.html'`, except the ones that deliberately carry it: `account.html`, `購物車.html`, `product.html`, `admin/index.html`, `editor/index.html`, and every retired original under `legacy/` (which must also stay out of the deploy). A stray one de-indexes the client's real site. That risk is why the Pages copy was taken down rather than noindexed.
  4. **No patient case material presented as a review or rating** in what deploys. (Health-claim review applies to the client's replacement content, not the current copy: owner, 15 Sep 2026.)
- **Verify:** all URLs resolve, redirects from old Wix paths are in place, Search Console shows the new pages indexed, the `wixstatic` grep is clean, and the four finding-26 checks above are clean. Then, and only then, switch Wix off.

---

## Appendix A — Definition of done for any migrated page
- Renders from its tree; visually matches baseline within tolerance at 1280px and 390px.
- Pre-rendered: content is in the HTML, not fetched client-side.
- `npm run test:seo` passes (h1, title, description, canonical, hreflang reciprocity, valid JSON-LD, matches baseline schema types).
- Editable in Puck; all in-scope language fields present or falling back to zh.
- No editor-only attributes in the output.
- Heavy assets referenced from R2/CDN, not the repo.
- **Interactive behaviour ported and verified BEFORE the original is retired.** Every behaviour the
  live page offers is either ported, or explicitly recorded as dying with pre-rendering (with the
  reason), or explicitly deferred with an owner and the owner's sign-off. Verified by a test that
  asserts the **effect** — the menu opened, the right product (by SKU) reached the cart, an
  out-of-stock or clinic-only product was refused — at 1280 and 390, with a negative control proving
  the test fails when the behaviour script is absent. "No errors thrown" is **not** verification: a
  page with nothing bound throws nothing (docs/FINDINGS.md finding 23). Added at P9-T1 after
  產品介紹 passed SEO, fidelity and the visual diff while its cart, phone menu, quick view and language
  switch were all dead — the finding-12 pattern: passes every gate, broken for humans.
- Old hand-coded file moved to `legacy/`, not deleted, until the phase is signed off.

## Appendix B — Commands quick reference
```
npm run dev           # Express API + admin at :4000
npm run seed          # seed MongoDB from data/
npm run export        # DB -> data/*.json (content + page trees)
npm run sections:build# bundle sections for the Node renderer
npm run render        # render page trees -> pre-rendered static HTML
npm run test:seo      # SEO assertion gate (blocks bad publish)
npm run publish       # export + sections:build + render + test:seo + test:data
npm run test:behaviour# migrated pages' cart/menu/quick view/language, by effect, with negative controls
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
