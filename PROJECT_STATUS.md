# Wonder Herb — Project Status & Dev Handoff

Last updated: 2026-08-13. Read this first when continuing development.

---

## 1. What this project is

- **Site:** `formurak4m/wonder-herb` — a **static, hand-coded HTML site** (16 pages)
  hosted on **GitHub Pages**. No server, no database, no build step (yet).
- **Market/lang:** Hong Kong, primary language **zh-Hant**. Client-side language
  switcher (zh/en/de/es/fr/ja/ru) via a `translations` JS object + `data-i18n`.
- **Tech in pages:** inline `<script type="application/ld+json">` structured data,
  a three.js 3D model viewer on the homepage (`.glb` files), per-page inline CSS/JS.
- **Deploy:** `.github/workflows/static.yml` auto-publishes **only on push to `main`**.
  → Nothing on other branches goes live until merged to `main`.
- **Custom domain:** `www.wonder-herb.com` (see DNS note below).

## 2. Branch state

- All work is on branch **`geo`** (pushed to origin). `main` is untouched.
- 9 commits on `geo` (oldest → newest):
  1. `2d59dc4` crawler files (robots/sitemap/llms/CNAME)
  2. `45b6640` lang=zh-Hant + static i18n defaults
  3. `95672c9` structured data (price+rating, WebSite, inLanguage)
  4. `e4dcb09` meta/social (OG, Twitter, hreflang, cart noindex)
  5. `7f2b492` performance (preconnect)
  6. `97b2c59` CMS pilot: cases → data/cases.json
  7. `89125dd` CMS pilot: .pages.yml + ADMIN_GUIDE.md
  8. `a0fead5` sample /admin dashboard
  9. `aadb924` admin demo → English UI
- To publish: open a PR `geo → main` and merge. **See DNS caveat before merging CNAME.**

## 3. What was done — GEO / SEO (done)

All aimed at making the site readable & citable by Google + AI engines. No visual change.

- **Crawler files** (new, repo root): `robots.txt` (allows AI bots, blocks cart,
  links sitemap), `sitemap.xml` (15 content pages, percent-encoded, real lastmod),
  `llms.txt` (LLM index).
- **`<html lang>`** `zh` → `zh-Hant` on all 16 pages.
- **Static i18n defaults:** 18 empty `data-i18n` elements on the homepage were filled
  with their default zh-Hant text so non-JS crawlers can read them. JS still swaps
  language on switch. (Other pages already had inline defaults.)
- **Structured data (JSON-LD):** homepage Products got real `price` +
  `priceValidUntil` + `aggregateRating` (values copied from each product page, never
  invented); added a `WebSite` node; added `inLanguage: zh-Hant` to homepage +
  all 14 subpage FAQPage nodes. All JSON-LD validated as parseable.
- **Meta/social:** homepage OG `name=` → `property=` (+ `og:url`, `og:site_name`),
  Twitter `summary_large_image` card; `hreflang` (zh-Hant + x-default,
  self-referencing) on all 15 indexable pages; `<meta robots noindex>` on the cart.
- **Performance:** `preconnect` for fonts.googleapis / fonts.gstatic / cdnjs on all pages.
- Titles + meta descriptions were audited — already unique per page (titles use
  `<title id="pageTitle">`).

## 4. What was done — Admin / CMS pilot (demo stage)

Goal: let a non-technical editor (ex-WordPress user) manage content.

- **Approach chosen:** git-based CMS editing **data files**, so content stays static
  in HTML (protects the GEO work) rather than client-side rendered.
- **Cases externalized:** the 15-case `caseDataList` array was moved out of
  `典型病例.html` into **`data/cases.json`** (all 7 languages preserved). The page now
  does `fetch('./data/cases.json')` on load, then renders with the existing logic.
  **Tested in-browser: identical to before, no console errors.**
- **`.pages.yml`** — a Pages CMS config exposing a "Cases" collection editing
  `data/cases.json` (all 7 languages declared so saves never drop data).
- **`admin/index.html`** — a **self-contained sample admin dashboard** at `/admin`
  (noindex). English UI, WordPress-style: login screen → sidebar (Cases active;
  Products/FAQ/Text = "Soon") → case list (loads real cases.json) → editor with
  language tabs + live content preview. **DEMO ONLY: edits are in-browser, not saved.**
- **`ADMIN_GUIDE.md`** — plain-language editor instructions.

## 5. Open items / next steps

### Must-do (external, not code)
- **DNS:** point `www.wonder-herb.com` at GitHub Pages and enable the custom domain
  in repo **Settings → Pages**. robots/sitemap/llms only work once served at the root
  domain. Don't merge the `CNAME` file to `main` until DNS is ready, or the live
  domain can break.
- After go-live: submit `sitemap.xml` in Google Search Console + Bing Webmaster Tools.

### Deferred by client decision
- **PT3 price** still `"0.00"` in `產品_PT3.html` + `產品介紹.html` (client to provide
  real price or mark not-sold-online).
- **Homepage self-authored Review** left in place (in `index.html` JSON-LD).
- **Article schema** (C8) for `研究報告.html` / `微信發表文章.html` — needs real
  author + publish date.

### CMS — to turn the demo into a real editor
1. **Make Save actually work.** Two paths:
   - **Pages CMS** (hosted, zero backend): user authorizes at app.pagescms.org on the
     repo; `.pages.yml` already present. Least setup.
   - **Decap CMS at `/admin`** (own domain): replace the demo `admin/index.html` with
     Decap + a small **OAuth helper** (e.g. a free Cloudflare Worker) for GitHub login.
2. **GEO upgrade for cases:** cases are currently JS-rendered (invisible to crawlers).
   Add a **build step (e.g. Eleventy)** so `data/cases.json` is baked into static HTML
   at deploy time — makes case text crawlable while keeping the same editor. This is
   the recommended architecture before externalizing more content.
3. **Extend** the same data-file pattern to Products, FAQ, homepage text.

## 6. Dev notes / gotchas

- **Line endings are MIXED in this repo.** `index.html` is **LF**; most other pages
  are **CRLF**. `.gitattributes` marks only `.glb` as binary and does NOT force eol,
  so per-file endings are preserved. When editing programmatically, **read/write bytes
  and preserve each file's existing newline** or you'll get a whole-file diff. `git
  config core.autocrlf` is `false` in this clone.
- **Filenames are Chinese** (e.g. `產品_乙肝清.html`). URLs/sitemap use percent-encoding;
  canonical/hreflang use the raw UTF-8 form.
- **Local preview** (needed because `fetch` requires http, not file://):
  ```bash
  python -m http.server 8747
  # then open http://localhost:8747/  and  http://localhost:8747/admin/
  ```
- **Validate JSON-LD** after schema edits:
  ```bash
  python - <<'PY'
  import re,json,glob
  for f in glob.glob('*.html'):
      for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', open(f,encoding='utf-8').read(), re.S):
          try: json.loads(b)
          except Exception as e: print('BROKEN', f, e)
  print('done')
  PY
  ```
- **Don'ts (from the GEO plan):** don't fabricate prices/ratings/reviews/authors;
  don't add medical-efficacy schema types (`MedicalWebPage`, `Drug`, `MedicalEntity`);
  don't convert content to client-side-only rendering; don't block crawlers except the
  cart; don't change the visual design.

## 7. File map (key files)

```
robots.txt, sitemap.xml, llms.txt   GEO crawler files (root)
CNAME                               custom domain (merge only after DNS)
.gitattributes                      marks .glb binary
index.html                          homepage (schema, OG, 3D viewer) — LF endings
產品_*.html, 產品介紹.html          product pages (GEO header tags only)
典型病例.html                       cases page — now loads data/cases.json
data/cases.json                     15 cases, editable content (NEW)
.pages.yml                          Pages CMS config (NEW)
admin/index.html                    sample admin dashboard, /admin (NEW, demo)
ADMIN_GUIDE.md                      editor instructions (NEW)
.github/workflows/static.yml        deploy on push to main
```
