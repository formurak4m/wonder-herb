# CLAUDE.md — Wonder Herb Admin Rebuild

Context for Claude Code. Read this before making changes. Keep it updated as the project moves.
Reflects the actual repo as of 8 September 2026.

## What this project is

Turn the Wonder Herb (康草堂) website into a site the client edits themselves through a Wix-like admin,
while the public site stays fast static HTML on GitHub Pages.

- The client is currently on Wix. We are offering a switch. The admin must feel very similar to Wix.
- We are NOT cloning Wix. We rebuild only the parts the client actually uses.
- Deadline: roughly one month for a usable slice, a second month for the full switch.

## Current state (read first — a lot already works)

Stack: Node + Express + MongoDB. No framework, no build step, no React. Public pages are plain HTML.

**Build progress: Phase 0 done** (see `BUILD_TASKS.md`). Work happens on the `rebuild/editor` branch, off `geo`.
Hosting is deliberately deferred to Phase 11 — everything runs locally until then.

Already built:
- **Express + MongoDB API** in `server/`: auth (with a protected super-admin), products, stock, sales, invoices, reports, roles. Real test suite in `scripts/`.
- **Hybrid publish model that works**: MongoDB is the editing surface. `npm run export` writes the DB back into `data/*.json`. Commit to `main`. GitHub Actions (`.github/workflows/static.yml`) deploys the repo to GitHub Pages. Custom domain via `CNAME`. If the API is off, admin and site fall back to the committed files.
- **Content already lives as data**: `data/products.json`, `data/cases.json`, `data/faq.json`, `data/homepage.json`, `data/inventory.csv`.
- **Pages CMS pilot** (`.pages.yml`): git-based, WordPress-style form editor. Wired for Cases only so far. Uses the 7-language object model.
- **Admin** is a single vanilla file: `admin/index.html`.
- **7 languages**: `zh` (primary) + `en, de, es, fr, ja, ru` (optional, fall back to `zh`). Every text field is a per-language object.
- **Visual + SEO baseline captured** (Phase 0): `node scripts/baseline.js` records all 18 pages at 1280px and 390px plus each page's rendered `<head>` into `baseline/` (gitignored, ~13 MB). Captured from a static server with the API off, so it reflects what GitHub Pages actually serves. These are the regression references the renderer must match. Re-run it if the live pages change before migration.
- **Test suite**: `npm run test:all` = 404 checks, green. `jsdom` and `playwright` are devDependencies; nothing new ships to the public site.

The two real gaps:
1. **Content is rendered client-side.** Public pages are static shells that `fetch('./data/*.json')` and build content in the browser, so crawlers mostly see an empty shell. This undercuts the SEO/GEO work.
2. **No visual editor and no section model.** The 18 page layouts are still hand-coded HTML. The client cannot add or reorder sections.

Other issues:
- ~72 MB of `.glb` 3D models are committed and redeploy on every push. Move to R2/CDN.
- **Media is not only the `.glb` files.** The homepage background video is hosted on the client's Wix CDN and the product photos are hotlinked from Google Drive. Both must move to R2 in Phase 10 — the Wix video dies at cutover. See `docs/FINDINGS.md`.
- Hosting is split: static site on GitHub Pages, admin/API config points at Vercel (`vercel.json`). API + MongoDB are not hosted for production yet (MONGO_URL is localhost).
- Currency is HKD.

Known issues found while recording the baseline are logged in `docs/FINDINGS.md` with the phase that fixes each.
None are fixed yet; do not fix them out of their phase.

## The two changes we are adding (in order of value)

### Change 1 — Pre-render the pages (highest value, protects SEO/GEO)
Change the publish step so the renderer writes content **into** the HTML instead of leaving the browser to fetch it. Same data, same `export -> commit -> deploy` pipeline. Output must include content, JSON-LD, hreflang, canonical, and meta so crawlers see the real page. Fixes gap 1 and is the most important thing in the project.

### Change 2 — A Wix-like visual editor (Puck)
Add **Puck** (`@puckeditor/core`, MIT, self-hosted, React) for visual page building: click the real page, edit, add / reorder / duplicate / delete sections, publish. Puck is the first React in the project, so run it as its own editor app that talks to the existing Express API. Use Puck's permissions API to lock destructive actions.

## Non-negotiables (do not violate)

1. **Public site stays static HTML on GitHub Pages.** A broken admin must never take the live site down. Preserve the existing fallback-to-committed-files behaviour.
2. **SEO must survive and improve.** Every page passes an SEO assertion check (JSON-LD valid, hreflang reciprocal, canonical correct, meta present, headings preserved) before publish. Do NOT chase byte-identical HTML; gate on the SEO/semantic check plus a visual diff within tolerance.
3. **Two editors, clear boundary.** Pages CMS / existing admin for content lists (products, cases, FAQ, homepage). Puck for page layouts. Do not rebuild in Puck what forms + API already do.
4. **Editor instrumentation must not ship to production.** `data-wh-*` selection attributes are editor/preview only. Published output is clean.
5. **Sections, not free-form dragging.** Add / move / duplicate / delete + 2 to 3 layout variants per section. No absolute pixel positioning.
6. **Every text field is a per-language object.** 7 languages, fall back to `zh`. This model already exists in `.pages.yml` and `data/` — keep it.
7. **Heavy assets leave the repo.** New media and `.glb` models go to R2/CDN, not Git.

## Repo layout (actual)

```
/                         public static site + config
  index.html              homepage (client-side i18n, ~141 lang refs)
  product.html            fetches ./data/products.json
  account.html
  產品介紹.html etc.        the other CJK-named pages (18 pages total, ~49k lines)
  *.glb                   3D bottle models (~72MB, in Git — move out)
  sitemap.xml robots.txt llms.txt CNAME
  data/                   products.json, cases.json, faq.json, homepage.json, inventory.csv
  admin/index.html        vanilla admin (single file, no framework)
  api/cms.js              small helper
  server/                 Express API
    index.js              main API (~27k); MongoDB is the editing surface
    auth.js db.js sales.js sales-report.js stock.js reports.js
  scripts/                export.js, seed.js, create-admin.js, import-sales.js, test-*.js
  .github/workflows/static.yml   deploy repo to GitHub Pages on push to main
  .pages.yml              Pages CMS config (Cases pilot; extend to more sections)
  vercel.json             /admin rewrite + CORS headers for /api and /*.glb
  package.json            deps: cors, exceljs, express, mongodb
  .env / .env.example     MONGO_URL, MONGO_DB=wonderherb, PORT=4000, SUPER_ADMIN_*
```

Suggested new folders for the additions:
```
  sections/               shared section components (used by Puck AND the renderer)
  renderer/               page tree + data -> pre-rendered static HTML
  editor/                 Puck React app (talks to the Express API)
```

## Commands (actual, from package.json)

```
npm run dev            # start Express API (node server/index.js), admin/API at :4000
npm run seed           # seed MongoDB from data/
npm run export         # THE PUBLISH STEP: write MongoDB back to data/*.json, then commit
npm run admin:create   # create an admin account
npm run import:sales   # import the sales spreadsheet
npm run test:all       # full test suite (api, auth, sales, ui-mongo, ui-auth, sweep)
# deploy: commit to main -> GitHub Actions (.github/workflows/static.yml) -> GitHub Pages
```

When adding the renderer, wire it into the publish step so `export` (or a new `build`) also writes pre-rendered HTML, keeping the existing `writeIfChanged` behaviour so unchanged runs leave the tree clean.

## Month 1 scope (usable slice, Wix stays live)

1. Host the API + MongoDB for real (Vercel + MongoDB Atlas free tier, or a small VPS). Confirm the fallback-to-files behaviour still holds.
2. Move media + the 72 MB of `.glb` to R2/CDN; update references and `vercel.json`/page markup.
3. **Renderer: pre-render the core pages** (home, products, product-detail, contact) with the SEO assertion check passing.
4. **Puck**: stand up the editor app, build 8 to 10 core section components, wire permissions.
5. Migrate the core 4 to 5 page layouts to data, Chinese first (other 6 languages fall back to `zh`).
6. Keep Pages CMS as the content-editing path so the client has something usable from week one.
7. Demo. Wix stays live as backup.

Month 2: all 18 pages, all 7 languages, full ~22 sections, add-page-from-template, forms (visitor submissions), dashboard parity (contacts / orders / analytics), security hardening, staging, then cut over and cancel Wix.

## Conventions

- Section components are pure, take a per-language `fields` object, and render identically in Puck and in the renderer (one source of truth avoids Puck's canvas-vs-site fidelity gap).
- Keep `zh` as the fallback everywhere, matching `.pages.yml`.
- Prefer plain-text fields with a constrained formatter over raw `contenteditable`; watch Chinese IME across all 7 languages.
- Any new section type needs: the component, its Puck field config, 1 to 3 layout variants, and a renderer path that emits SEO-safe HTML.
- Preserve the existing test culture: add an SEO assertion test that runs on every migrated page.

## Open questions to confirm with the project owner

- Confirm pre-rendering is in scope (the key SEO decision).
- Confirm the two-editor split (Pages CMS for content, Puck for pages).
- Where the API + database are hosted: Vercel + Atlas, or a small VPS. Pick one hosting story (currently split between Pages and Vercel).
- How much can the client change: delete a page, edit SEO, or admin-only?
- Does the shop need real online orders + payment, or stay staff-entered?

## Definition of done for a migrated page

- Renders from the tree, visually matches the current page within tolerance.
- Pre-rendered: content is in the HTML, not fetched client-side.
- SEO check passes: JSON-LD valid, hreflang reciprocal, canonical correct, meta present, heading order preserved.
- Editable in Puck; all target-language fields present or falling back to `zh`.
- Published output contains no editor-only attributes.
- Heavy assets referenced from R2/CDN, not the repo.
- Old hand-coded HTML retired only after the above pass.
