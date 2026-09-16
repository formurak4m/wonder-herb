# FINDINGS.md — known issues, and the phase that fixes each

Findings 1–5 come from recording the Phase 0 baseline (`node scripts/baseline.js`); finding 6 from
adding the Phase 1 toolchain; 7 from adding the page routes at P2-T1; 8–11 from building the
section library at P4-T2; 12–13 from actually looking at the rendered sections at P4-T3; 14 from the
fidelity waivers at P4-T4; 15 from rendering a real page end to end at P5-T1; 16–17 from
running the real publish pipeline for the first time at P7-T1; 18–19 from building the editor
app at P8-T2; 20 from migrating the product data model at P9-T1; 21–23 from migrating the first real
page (產品介紹) at P9-T1; 27 from migrating 常見問題 at P9 (page two); 28–29 from the P9 content-page batch; 30–31 from the P9 product-page batch.
8–10 September 2026.
**Nothing here is fixed.** Each is logged against the phase that owns it, so it gets fixed in the
right place rather than opportunistically. Do not fix these out of their phase.

Evidence for all of them is in `baseline/manifest.json` (gitignored) — per page: rendered text
length, image load counts, JSON-LD blocks, `<h1>` count and failed requests.

| # | Finding | Severity | Fixed in |
|---|---|---|---|
| 1 | Homepage background video hosted on the client's Wix CDN | High — breaks at cutover | Phase 10. Since P9 the URL is a tree field (`cta-band/video-band`, `videoUrl`), so the swap is a data edit, not a code change |
| 2 | Product photos hotlinked from Google Drive, and rate-limited | High | Phase 10 |
| 3 | `購物車.html` has no `<h1>`; it and `account.html` have no JSON-LD | Resolved — allow-list | Closed at P6-T1a |
| 4 | All 18 pages overflow horizontally on a 390px viewport | Low | Phase 9 / 13 |
| 5 | `<img src="">` placeholder fires a spurious request | Cosmetic | Phase 13 |
| 6 | Pages deploys the whole repo, so editor source and build output ship publicly | Medium | Phase 8 |
| 7 | `/api/inventory.csv` drops the reorder point for untracked products | Medium | Phase 12 |
| 8 | `products.json` has no `image` or `link` — **hard blocker for Phase 9** | **High** | Phase 9 (blocking) |
| 9 | The data and the live site disagree on two product prices | Background (owner, 15 Sep 2026: site content not authoritative) | Closed for the build: `data/products.json` prices are used; a change is a data edit |
| 10 | `faq-accordion` is a static list, not an accordion | Client decision | Client, if ever |
| 11 | No text+image block exists; the P4-T2 section list was wrong | Resolved | Closed at P4-T2 |
| 12 | Pre-rendered pages publish **visually blank** without the reveal script | **High — passes green, looks broken** | Phase 5 (P5-T1 template) |
| 13 | Sections silently dropped markup from their source blocks | Resolved | Closed at P4-T4 |
| 14 | Body copy uses **bold, lists and links**; plain-text fields drop them | Decided — option (c) | P4-T5 |
| 15 | Chrome's layout depends on JS, and there is no shared stylesheet | **High — D1 required, not optional** | P5-T1 / Phase 9 |
| 16 | **`export` published staff emails and an internal audit trail to a public URL** | **HIGH — security** | Fixed at P7-T1a |
| 17 | `export` wrote `updatedAt` bookkeeping into public site data; one real stock change was unpublished | Medium — fixed | P7-T1a; stock change committed 15 Sep 2026 (`e567a69`), data/ matches the database |
| 18 | `renderer/i18n.js` is CommonJS, so the editor cannot import it; Vite shim is a stopgap | Medium | Phase 9 |
| 19 | Product data has no per-language `title`/`desc` — same root cause as finding 8 | Medium — **client decision** | Phase 14 (decide at 9) |
| 20 | **A plain-string write silently deleted a language map** (admin product form) | **HIGH — data loss** | Guarded at P9-T1; form at P12-T3 |
| 21 | **The visual baseline records a localhost-only page**, not what production serves | **High — the migration gate's reference is wrong** | Re-captured 15 Sep 2026; font stack held |
| 22 | **Staff login addresses and an invented health claim in public git history** (page-tree export + finding 16's own excerpt); publish gate checked a fixture | **HIGH — security** (same as 16) | Paths fixed at P9-T1; identities rotated; no history rewrite (owner) |
| 23 | **A migrated page loses cart, mobile menu, quick view and language switch** | High — was blocking retirement | Ported + `test:behaviour`; 產品介紹 retired 15 Sep 2026 (`8d29617`) |
| 24 | **Migrated pages are Chinese only: a visitor who chose another language lands in Chinese** | Medium — accepted regression (owner) | Phase 14 (per-language URLs) |
| 25 | **A write path deletes every field its caller was not shown**: rule "the store merges, never replaces"; bites today in the product form (`link`, `ribbon`, `priceNote`) and the Puck save (section `wrap`) | **HIGH — data loss** (finding 20 was one case) | Puck path fixed at P9-T1 (`mergeTree`); every write path in the API: P12-T3; blocks lifting PT3's price hold |
| 26 | **Patient cases published as five-star product reviews, with invented ratings**: real case-study patients' identities attached to fabricated reviews, publicly served on the GitHub Pages copy 4 Jun – 15 Sep 2026 (not on the client's Wix site) | **CRITICAL — potentially legal / privacy (HK PDPO), needs legal advice** | Removed from `main` (`6503a01`, verified clean) and the branch; gated in `test:seo`. **Evidence preserved in history, do not rewrite.** Owner handles with the client |
| 27 | **The admin's FAQ editor changed nothing a visitor could see**: no public page read `data/faq.json`; 常見問題 was hand-coded, and the two had drifted to different questions | Medium — an invisible feature the client believes they have | **Fixed by the P9 page-two migration** (`fc8c6e8`); name it in `ADMIN_GUIDE.md` |
| 28 | **Per-language images and links exist, but a tree cannot hold them**: 小册子 swaps the brochure scan per language; rendering the markup verbatim would have shown Chinese visitors the German brochure | Medium — caught by the visual diff, no gate saw it | zh carried now (Chinese-only, finding 24); model per-language assets at **Phase 14** |
| 29 | **典型病例 ItemList says 15 items, lists 3, types them `Testimonial`** (not a schema.org type), naming real patients | Background (content not authoritative); owner + client | Carried verbatim at P9; fix or derive only if the owner asks |
| 30 | **產品_雲芝糖肽精華_A publishes the wrong product's title**: its script overwrites the trial pack's correct `<title>` with the standard pack's | Medium — SEO, live today on 1 of 6 product pages | **Fixed by migrating the page** (no script to overwrite it); `test:seo` now compares against the page it replaces; on the client list as a fix (docs/CLIENT-QUESTIONS.md §6) |
| 32 | **The homepage hero, product carousel and featured cases were built entirely in JavaScript**: with scripts off the live page shows 0 slides, 0 product cards, 0 case cards and 768 characters of text | High — the largest crawler-visibility gap on the site | **Fixed by migrating index.html** (P9, 16 Sep 2026): 6 slides, 3 product cards, 3 case cards, 1,331 characters |
| 33 | **index.html defines an SVG filter (`#glass-distortion`) that five of its CSS rules apply, and it sits outside every block the chrome lift copied**: dropping it costs the carousel and every glass card their frosted look, and the element is `position:absolute; width:0; height:0`, so no gate can see it go | Medium — silent visual loss, found by hand at P9 | **Fixed**: `loadChrome` lifts it. The live page declares it TWICE, which is a duplicate element id — one is lifted |
| 31 | **PT3 is clinic-only on its page and sellable in the data**: no `clinicOnly` flag on WH-PT3-090, so the grid and the migrated panel both offer it at HK$2,480 | Medium — a visitor can buy what the page says is clinic-only | One data edit (`clinicOnly: true`) fixes panel, grid and cart at once — **owner + client**, like finding 9 |

---

> **Status note, 15 Sep 2026 (owner):** the current site content is **not authoritative**; the
> client will replace all of it. Content findings (9, 17, 22's claims, 26) stay recorded as
> **background**. They no longer block the build, and no further investigation, escalation or data
> change is to be made on them unless the owner asks.

## 1 · The homepage video, and 45 other assets, are hosted on Wix

**What.** The homepage plays a background video served from the client's own Wix CDN:

```
https://video.wixstatic.com/video/11062b_d578b9d4ffba48c68d086ec29fe9e6f0/1080p/mp4/file.mp4
```

It was the only genuine asset failure in the final baseline run. The visible consequence is in
`baseline/screens/index.1280.png`: the 真實康復故事 band renders as washed-out text over a
background that never arrives.

Wider than the video: **`wixstatic.com` appears 45 times across all 18 pages**, including the
`og:image` and `twitter:image` social preview images on `index.html` and `account.html`.

**Where.** `index.html:3146` (the video). `index.html:12`, `index.html:18`, `account.html:16`,
`account.html:1921` (social images). Full list: `grep -n wixstatic *.html`.

**Why it matters.** Phase 18 cancels Wix. Every one of these 45 references dies at that moment —
including the link-preview images used when the site is shared. This is a hard dependency on the
platform we are migrating *away from*, and it is easy to miss because the pages look fine today.

**Fixed in Phase 10**, whose scope must be read as *all* heavy and external media, not only the
`.glb` files:
- the `.glb` 3D models (~72 MB, 4 references, currently in Git),
- this video,
- the Wix-hosted images including `og:`/`twitter:` social previews,
- the Google Drive photos in finding 2.

**Do not cancel Wix until this is done.** The Phase 18 gate must check **two** patterns, not one:

```
grep -rn "wixstatic" *.html        # CDN-hosted media: the video, og:/twitter: images
grep -rn "_files/ugd" *.html       # Wix's FILE STORE, served from wonder-herb.com
```

Both must return nothing. The second is easy to miss because the URL is on the client's **own
domain** — `https://www.wonder-herb.com/_files/ugd/…` — and so looks self-hosted. It is not: that
path is Wix's user-file store and dies with the account. It currently serves the two research PDFs
linked from `研究報告.html`. Found while surveying in-copy links for finding 14.

---

## 2 · Product photos are hotlinked from Google Drive and get rate-limited

**What.** Product and content images are served from `lh3.googleusercontent.com/d/<file-id>` —
Google Drive hotlinks. **162 references across all 18 pages.** Drive throttles this. Measured
during the baseline capture:

```
Referer: http://localhost:4177/        ->  429 Too Many Requests   (text/html)
Referer: https://www.wonder-herb.com/  ->  200 OK                  (image/png)
```

Chrome then refuses the 429 HTML as an image (`ERR_BLOCKED_BY_ORB`) and the page shows broken
images with no error visible to the site owner.

**Where.** All 18 root pages; heaviest in `product.html` and `產品介紹.html` (45 references each).
Note the URLs are in the **page markup**, not in `data/products.json` — `grep -c googleusercontent data/*` is 0.
That means moving them is an HTML edit today, and becomes a section-component change after migration.

**Why it matters.** It served a 429 to a single local browser. Real traffic, a shared IP, or a
crawler burst can black out the product images site-wide with no warning and no logs. Drive is not
a CDN and its hotlink URLs are not a stable contract.

**Fixed in Phase 10** — move to R2 with the long-cache + CORS headers already modelled in
`vercel.json`, and build URLs from `MEDIA_BASE_URL`.

**Note for Phase 0 tooling:** `scripts/baseline.js` works around this by re-requesting these hosts
from Node with the production `Referer`. Once the images live on R2 that workaround can go, and the
baseline should be re-recorded.

---

## 3 · `購物車.html` has no `<h1>`, and neither utility page has JSON-LD — RESOLVED at P6-T1a

**What.** The cart page renders **zero `<h1>` elements** and carries **no JSON-LD**. Its
`<title>`, `<meta name="description">` and `<link rel="canonical">` are all present and correct:

```
title      : "購物車 | Wonder Herb – 雲芝糖肽精華"
description: present
canonical  : present
h1 count   : 0
```

**Where.** `購物車.html`; evidence in `baseline/head/購物車.html` and the manifest row.

**Correction, made at P6-T1a.** The original wording put `account.html` "in the same category". A
survey of all 18 baseline heads at P6-T1 showed the two pages are **not** the same case:

| Page | `<h1>` | JSON-LD blocks | Assertions it fails |
|---|---|---|---|
| `購物車.html` (cart) | **0** | **0** | **two** — the `<h1>` check and the typed-JSON-LD check |
| `account.html` | 1 | **0** | **one** — the typed-JSON-LD check only |
| the other 16 | 1 | 1–5 | none |

So the cart is the only page missing a heading, and the two pages share only the missing JSON-LD.
They still want the same treatment, but for a slightly different reason each.

**Why it mattered.** BUILD_TASKS P6-T1 asserts exactly one `<h1>` per page and treats the SEO check
as a gate, not a report — so as written, neither page could publish.

**The two options that were put to the project owner:**
- **(a)** Give the cart a visible `<h1>` (e.g. 購物車). Simplest, arguably an accessibility
  improvement, but it changes the visible page against the baseline — and it does not settle the
  JSON-LD question on either page, which would still need the same exemption.
- **(b)** Exempt utility pages from the `<h1>` and JSON-LD assertions with an explicit allow-list in
  `scripts/test-seo.js`.

## RESOLVED at P6-T1a — option (b), with three conditions

The project owner chose **(b)**. A cart and an account page are transactional UI, not documents:
they have no `<h1>`-worthy subject and no honest schema.org type, and inventing either to satisfy a
checker is the tail wagging the dog. But an exemption is a hole in a gate, so three conditions were
attached, all implemented and all asserted by the suite itself:

1. **Named pages only** — `購物車.html` and `account.html`. No patterns, no directories. Asserted:
   every key must match `/^[^/\\*?]+\.html$/`.
2. **Every entry carries a reason, printed on every run**, passing or failing. An exemption you see
   each time is one you can argue with; one buried in a file is one nobody revisits.
3. **The list is asserted to be exactly those two.** The agreed set is spelled out in a separate
   `AGREED` constant, so adding a third page fails the gate until someone edits the assertion too —
   two deliberate edits, both visible in one diff. The list cannot grow by accident.

**The exemption is narrow, and that is the point.** These pages are excused from having a *subject*
and a *schema type*. Title, description, canonical and hreflang are asserted on them in full.
Being a utility page is not a reason to be uncrawlable.

**One thing the exemption had to be widened to cover, worth recording.** `renderer/head.js` derives
an `Organization` node on **every** page, so a migrated cart carries one JSON-LD block where the
hand-coded cart carries none. The baseline `@types` comparison would therefore fail forever. That
extra node is an SEO *improvement*, not a loss, so the comparison is waived for exempt pages rather
than the node being suppressed in `head.js` — and both sides are still printed on every run, so the
difference stays on screen instead of disappearing. "Any JSON-LD present must be valid JSON" still
applies to them: not needing a schema type is not permission to ship a broken one.

Proved at P6-T1a: a non-exempt page with no `<h1>` still fails; a third entry in the list fails the
"exactly these" assertion; and the cart passes with no `<h1>` but still fails the moment its
canonical is broken.

---

## 4 · Every page overflows horizontally at 390px

**What.** Full-page captures at a 390px mobile viewport come out **404–410px wide — all 18 pages**.
Something in the shared layout is 14–20px wider than the viewport, so phone users get a small
horizontal scroll.

**Where.** All 18 pages, so it is in shared header/footer/ticker CSS rather than per page. The
widths are recorded in `baseline/manifest.json`.

**Why it matters.** Minor and pre-existing — the site has shipped like this. Worth fixing while the
markup is being rebuilt anyway, not before.

**Fixed in Phase 9 / 13**, as pages migrate to sections: the shared section stylesheet should not
reproduce the overflow. Do not chase it in the old hand-coded HTML — that code is being retired.

---

## 5 · `<img src="">` placeholder fires a request to the page's own URL

**What.** The quick-view modal ships with an empty-src image. An empty `src` resolves to the
document URL, so every load fetches the page again as an image and fails to decode it. This is the
`16/17` and `22/23` image counts in the baseline output.

**Where.** `產品介紹.html:1462` and `product.html:1529`:
```html
<img id="modalImage" class="modal-product-image" src="" alt="产品图片">
```

**Why it matters.** Harmless in practice, one wasted request. Recorded only so the non-loading
image in the baseline manifest is explained and nobody re-investigates it later.

**Fixed in Phase 13** when these pages become sections — the modal should render no `<img>` until
it has a source.

---

## 6 · The Pages deploy publishes the editor source and the build toolchain

**What.** `.github/workflows/static.yml` uploads the **entire repository**:

```yaml
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          # Upload entire repository
          path: '.'
```

So once the Phase 1 work reaches `main`, `editor/`, `sections/` and `renderer/` — the Puck editor
source, the shared section components, and later the renderer's build output — are all served from
the public site. `renderer/.build/` is gitignored and so never reaches the deploy, but
`editor/dist/` from `npm run editor:build` would if it were ever committed.

**Where.** `.github/workflows/static.yml`, the `path: '.'` upload step.

**Why it matters.** Not a visitor-facing break: none of the 18 static pages load anything from
these folders, so the site behaves identically and the fallback-to-committed-files guarantee is
untouched. The problems are narrower:
- the editor's source is published to anyone who guesses the path,
- the deploy artifact grows with build output that has no business on a CDN,
- it sits awkwardly against non-negotiable 4 ("editor instrumentation must not ship to
  production") — the spirit of that rule is that the public site carries nothing editor-related.

**Fixed in Phase 8**, when the editor app becomes real and is first worth excluding. Two options,
decide then:
- **(a)** Exclude the folders from the Pages upload — build a clean publish directory, or add an
  ignore step before `upload-pages-artifact`. Keeps one workflow.
- **(b)** Build the editor to an output directory outside the deployed tree entirely, and host it
  with the API rather than on Pages — which is where it belongs anyway once Phase 11 hosts the API,
  since the editor is useless without it.

Recommendation: **(b)**, with (a) as the interim if the editor needs to be reachable before Phase 11.

**Do not fix this before Phase 8.** Changing the deploy workflow is the one thing that can take the
live site down, and there is no reason to touch it while this work is still on a branch.

---

## 7 · `/api/inventory.csv` drops the reorder point for untracked products

**What.** The live API's CSV route emits the reorder point only when the product has stock:

```js
tracked ? (p.reorder === undefined ? 10 : p.reorder) : '',
```

A reorder point is set per product and does not depend on stock being counted, so for any product
without an `On hand` figure the column comes out blank and the configured value is lost to anything
reading that endpoint.

**Where.** `server/index.js`, the `GET /api/inventory.csv` route.

**Why it matters.** This is the **same defect** that was fixed in `scripts/export.js` at P0-T1a — the
publish path was corrected, this one was not, so the two now disagree. Today all six SKUs are
untracked with the default reorder of 10, so nothing visible is wrong. The moment the client sets a
real reorder point, `npm run export` writes it correctly to `data/inventory.csv` while this endpoint
serves it blank — and the CSV route exists precisely so the site's reader works against the live
database "with no change to how it parses". A silent disagreement between the live API and the
published file is worse than either being wrong alone.

**Fix.** Identical to the export fix:
```js
p.reorder === undefined || p.reorder === null ? (tracked ? 10 : '') : p.reorder,
```
Better still, have this route and `buildInventoryCsv` in `scripts/export.js` share one function, so
they cannot drift again.

**Fixed in Phase 12**, alongside the other API-hardening work — or sooner if inventory editing is
demoed to the client before then, since it is a four-character change. Not fixed at P2-T1: that task
was scoped to adding page routes, and refactoring an unrelated live route while in the file is how
regressions get in.

---

## 8 · `products.json` has no `image` or `link` — HARD BLOCKER for Phase 9

**What.** The product grid on the live site shows a photo and a "詳細介紹" link per card. Neither
field exists in `data/products.json`. Its keys are exactly:

```
id, title, sku, price, status, cat, badges, model, desc
```

**Where the data really lives.** The source of truth today is a **hard-coded array inside the
page**: `productData` at `產品介紹.html:1733`, duplicated per language, with the shape

```js
{ id, name, price, priceText, desc, image, badge, link }
```

`data/products.json` supplies only stock, status and price; the page's own array supplies the
photo, the detail-page link and all seven languages of the name and description. **That array is
what has to move into the data model.**

**Why it matters — this blocks the migration, it does not merely inconvenience it.** Phase 9
migrates 產品介紹 to a page tree rendered by `product-grid`. Rendered against today's data, the
grid publishes **with no product photos and no links to the detail pages** — a visibly broken
catalogue on a commerce site, and a visual diff that cannot pass. The section is written to
degrade cleanly rather than emit a broken `<img>`, and `test:sections` asserts both halves
(`no broken <img> when the data has no image`, and `it DOES render them once the data has them`),
so the code is ready; the *data* is not.

**Two further gaps in the same place:**
- `title` is a **plain string**, not a per-language object, unlike `cases.json`. This breaks
  non-negotiable 6 for products specifically. `resolveField` passes strings through unchanged, so
  sections work with either shape and the migration can be staged.
- `badges` ("GMP 認證, 有效成份>90%") is a trust-badge list, **not** the corner ribbon the live card
  shows ("只在指定中西醫診所出售"). They are different things; the ribbon has no home in the data
  at all. `product-grid` reads an explicit `ribbon` key rather than mis-mapping `badges`.

**Required before Phase 9 can start on 產品介紹 or any product page:**
1. Add `image` and `link` to the product model (API, seed, export, and the admin's product form).
2. Migrate `productData` from `產品介紹.html:1733` into `data/products.json`, including the
   per-language `title`/`desc`, and delete the hard-coded array.
3. Re-check the prices while doing it — see finding 9.

Sequencing note: this overlaps finding 2. The image URLs move to R2 at Phase 10, so doing the data
migration first and the R2 move second means editing the same field twice. Worth deciding the order
before either starts.

---

## 9 · The data and the live site disagree on two product prices — client decision

**What.** Two products carry different prices in the database than the website shows the customer:

| SKU | `data/products.json` | Live page (`產品介紹.html`) |
|---|---|---|
| `WH-MB-060` (憶活素 MemoProve) | **880.00** | **HK$520.00** |
| `WH-PT3-090` (PT3) | **2480.00** | 僅限診所 — clinic only, no price shown |

**Where.** `data/products.json` versus the `productData` array at `產品介紹.html:1733`. Both are
visible in the Phase 0 baseline screenshot `baseline/screens/產品介紹.1280.png`, which shows
HK$520.00 and 僅限診所.

**Why it matters — and why it is not a build issue.** This is not a bug in anything being built; it
is a discrepancy in the client's own records that the migration happened to surface. It matters to
them in two directions: the storefront may be charging HK$520 for something booked at HK$880, and
the admin's **inventory valuation multiplies the database figure by stock on hand**, so their stock
value report is wrong if the site price is the correct one. The PT3 case is different in kind —
the site deliberately hides the price because it is clinic-only, while the database carries a real
2480.00 used by the customer price list.

**Do not change either number.** Whichever is right is a question only the client can answer, and
guessing would corrupt either the storefront or their books. **Raise with the client**, then correct
the losing side once, in the data, as part of finding 8's migration.

---

## 10 · `faq-accordion` is a static list, not an accordion — client decision

**What.** The section registered as `faq-accordion` renders a plain always-open list, because that
is what the live page does. `常見問題.html` has no toggle, no collapse, no `aria-expanded` and no
JavaScript for it — every answer is permanently visible.

**Where.** `常見問題.html:1` `<div class="faq-list">`; the section is `sections/FaqAccordion.jsx`.

**Why it matters.** Only so nobody "fixes" it later by adding collapse behaviour on the assumption
that the name describes the intent. Making the FAQ collapsible is a **change to how the site behaves
for visitors** — it affects how much text is visible on landing, and therefore how the page reads to
both customers and crawlers. That is the client's call, not a refactor.

**No phase owns this.** The name was kept because it is the identifier BUILD_TASKS P4-T2 fixes and
page trees will reference. If the client does want collapsing, it is a small change to one section
plus a little client script — but ask first.

---

## 11 · There is no text+image block on this site — RESOLVED at P4-T2

**What.** BUILD_TASKS P4-T2 listed `text-and-image` among the ten core sections. No such block
exists anywhere on the site. A survey of every plausible class (`text-image`, `image-text`,
`media-block`, `split-block`, `content-image`, `two-col`, `info-grid`, `feature-row`, …) and of
every `*grid*` class across all 18 pages found nothing that pairs a column of text with an image.

**Why it matters.** Building it would have meant inventing both the markup and the CSS to style it
— the same failure mode as the `wh-page-header` class names, and one the tests cannot catch because
they check markup, not paint.

**Resolved.** `related-products` was built instead: real markup from `產品_T3.html:1`, present on all
six product pages, and required by the Phase 9 product-page migration. BUILD_TASKS P4-T2's section
list has been corrected. Recorded here so the absence is not rediscovered as a gap later — if a
text+image layout is ever wanted, it is a **new design**, to be agreed with the client, not a
migration of something that exists.

---

## 12 · Pre-rendered pages publish visually blank without the reveal script

**This is the dangerous class: it passes every gate green and looks broken to humans.**

**What.** The live pages hide most content until JavaScript reveals it:

```css
.reveal-on-scroll { opacity: 0; transform: translateY(var(--reveal-distance)); }   /* index.html:359 */
.reveal-on-scroll.is-visible { ... }
```

`initScrollReveal()` (`index.html:4310`) attaches an `IntersectionObserver` that adds `.is-visible`
as each block scrolls into view. Without that script the elements are present in the DOM at
`opacity: 0` — invisible.

The section components emit `reveal-on-scroll` deliberately, to match the live markup: `hero`
(`hero-content reveal-on-scroll reveal-left`, `hero-image reveal-on-scroll reveal-right`) and
`text-block` (`section-title reveal-on-scroll`, `company-glass-card reveal-on-scroll reveal-delay-2`)
do today, and more will as Phase 13 adds sections.

**How it was found.** Rendering the hero to a standalone preview at P4-T3 produced a **completely
blank teal gradient** — correct markup, correct CSS, nothing visible. Not a preview artefact: the
same thing happens to any pre-rendered page served without the reveal script.

**Why it is the dangerous kind.** Every automated gate would pass:
- `test:sections` passes — the markup is correct.
- `test:seo` (Phase 6) passes — `<h1>`, title, description, canonical, JSON-LD and the body text
  are all in the HTML.
- A crawler sees the full text, so **the SEO work is genuinely fine**.

Only a human looking at the page sees that it is empty. A build can go green, ship, rank, and show
customers a blank page. Automated checks cannot catch it because the text *is* there — it is the CSS
plus a missing script that hides it.

**Fixed in Phase 5, P5-T1 — `renderer/template.js`. Hard requirement, not a nicety.**
`baseTemplate({ head, body, lang })` MUST include the scroll-reveal script (the `IntersectionObserver`
that adds `.is-visible`) among its enhancement scripts. BUILD_TASKS P5-T1 step 3 already says the
template carries "any small enhancement scripts"; this names the one that is load-bearing.

Belt and braces, worth doing at the same time:
- Ship a `<noscript>` rule that forces `.reveal-on-scroll { opacity: 1; transform: none }`, so a
  visitor with JavaScript off sees the content rather than a blank page. The live site does not do
  this today — pre-rendering makes it cheap and correct.
- At Phase 9, do the visual diff against the baseline **with scripts enabled and again with them
  disabled**. The second run is what would have caught this.

---

## 13 · Sections silently dropped markup from their source blocks — RESOLVED at P4-T4

**What.** `contact-cards` dropped all fifteen `<i>` icons from the live markup and passed every
check: the contract checks test the *shape* of a section, and hand-written HTML assertions only test
what their author remembered to look at. The icons were missed precisely because nobody remembered
them, so nothing asserted on them.

**The fix — the expectation is no longer hand-written.** `test:sections` now parses the real block
out of the real page, collects every tag name and class token, and requires the rendered section to
contain them all. The source page is the authority; the test author's memory is not. Anything
deliberately not emitted goes in `allow` **with a reason**, so a drop is either caught or waived
consciously — never silent.

**What it found.** Declared for all ten sections at P4-T4. **Seven of the ten were dropping
markup**, every one of them an icon:

| Section | Dropped |
|---|---|
| `contact-cards` | 15 `<i>` — map pin, phone, WhatsApp, envelope, person (found at P4-T3) |
| `hero` | WhatsApp glyph on the primary CTA; both carousel chevrons |
| `product-detail` | cart-plus, chevron-down, flask, and all three trust-badge glyphs |
| `related-products` | seedling / heartbeat / box on each related card |
| `cta-band` (banner) | WhatsApp glyph on the button |
| `faq-accordion` | question-circle, flask, leaf, shield-alt, chart-line on the questions |

`page-header`, `text-block`, `product-grid` and `gallery` were already faithful.

**Two things worth keeping in mind.** `product-grid`'s source is a **template literal inside
`renderProducts()`**, not static HTML, so the check extracts it with a nesting-aware scanner that
keeps markup from conditional fragments. And the only waivers across all ten are inline copy
formatting (`strong`, `em`, `span`, `br`, `ul`, `li`) — that is a separate content-model question,
logged as finding 14.

**Where.** `scripts/test-sections.js`, the `FIDELITY` map. A new section needs one entry: source
page, selector (or template regex), sample props, and any `allow` waivers. `every registered section
has a fidelity map` fails if a section is added without one, so the coverage cannot silently rot.

---

## 14 · Body copy uses bold, lists and links — plain-text fields drop them

**DECISION NEEDED, and it is a content-model decision, not an implementation detail.** The section
fields are plain text today. The live copy is not. Whatever is chosen here is hard to change later,
because it decides what the client can type and what every future section's fields look like.

### What the site actually contains

Measured across all 18 pages, counting only inline tags inside body copy (`p`, `li`, `h2`–`h4`),
excluding header, footer, nav and modal chrome:

| Inline tag | Count | Where it lives |
|---|---|---|
| `<strong>` | **48** | `.product-details-card` (42), `.faq-answer` (6) |
| `<em>` | 6 | the same two |
| `<a>` | 4 | `.faq-answer` (1 → 研究報告.html), 研究報告.html copy (3 → PDFs) |
| `<br>` | 5 | inside copy strings |
| `<span>` | 21 | styling-only wrappers |
| `<ul>` in copy | **18 blocks** | `.product-details-card` (16), `.faq-answer` (2) |

**It is confined to two containers.** Every single `<strong>`/`<em>` in body copy is inside
`.product-details-card` or `.faq-answer` — that is, **two sections: `text-block` (card variant) and
`faq-accordion`**. No other current section is affected. Phase 13 adds one more case: 研究報告.html
has three PDF links inside copy, which will belong to a future `report-list`.

### The shape of it matters more than the count

Of the 54 emphasis instances:

- **42 are a bold lead-in label** — shape `<li><strong>標籤：</strong> 內容…` (e.g. a benefit name, then its sentence)
- 6 are bold mid-sentence — shape `…<strong>機構名稱</strong>…` (e.g. a research institution's name)

(Placeholders, not the client's copy: the originals are efficacy claims, and this file does not
reproduce them. They are on the product pages, e.g. 產品_T3.html's benefits list.)
- 6 are a whole paragraph in bold

So **78% is one repeating structural pattern**, not free-form formatting. That changes which option
is cheapest.

Note also that lists are only a gap in **`faq-accordion`**: `text-block` already has a `bullets`
field and emits real `<ul>`/`<li>`, which is why its fidelity waiver covers only `strong`/`em`/
`br`/`span`.

### The options

**(a) A constrained inline formatter.** A tiny markdown subset — bold, and probably links — parsed
into React elements. Never `dangerouslySetInnerHTML`; the parser emits elements, so there is no raw
HTML from the editor and no XSS surface. Lives in `sections/`, so the editor canvas and the renderer
use the same parser and cannot diverge.
- *Cost:* a parser plus tests, a `rich: true` marker on the fields that use it, and a Puck field
  that teaches the syntax.
- *Risk:* the client types Chinese through an IME. Asking them to type ASCII `**` around CJK text is
  awkward and will be got wrong. It is also a door: once bold exists, colour and size get requested.
- *Gain:* full parity, including the 6 mid-sentence bolds and the links.

**(b) Keep plain text and accept the loss.**
- *Cost:* nothing now.
- *Risk:* 48 bold lead-ins disappear from the **product pages — the client's main sales copy** — and
  the benefit lists read as undifferentiated runs of text. The Phase 9 visual diff will show it, and
  it has to be signed off as an accepted permanent difference. The client has bold today in Wix;
  losing it in a migration sold as an upgrade is a visible downgrade on the pages that sell.

**(c) Model the pattern structurally instead of parsing it.** Because 78% is a bold lead-in,
represent it as fields rather than markup: a paragraph/bullet becomes `{ label, text }`, and the
section renders `<strong>{label}</strong> {text}`. Whole-paragraph bold becomes a per-item
`emphasis: true`. No parser, no syntax for the client to learn, no XSS surface, and the editor shows
two ordinary text boxes.
- *Covers:* the 42 lead-ins plus the 6 whole-paragraph bolds ≈ **89%**.
- *Leaves:* 6 mid-sentence bolds (plain, or reword), the 2 FAQ lists (give `faq-accordion` the
  `bullets` treatment `text-block` already has), and the 4 in-copy links.
- *Cost:* small, and confined to the two affected sections.

### DECISION TAKEN — option (c), structural modelling. 11 September 2026.

No formatter and no markdown syntax. Two reasons, both decisive:

1. **The client types Chinese through an IME.** Asking them to wrap CJK text in ASCII `**` is a bug
   factory — the wrong asterisks, full-width characters, half-closed pairs — and every mistake ships
   as literal punctuation on a customer-facing page.
2. **A pattern that repeats 78% of the time is structure, not formatting.** Parsing it back out of a
   string would be reconstructing information we could simply have kept.

Implemented at **P4-T5**, scoped to the two affected sections:

- `text-block` (card variant) and `faq-accordion` take `{ label, text }` per paragraph/bullet,
  rendering `<strong>{label}</strong> {text}` — this is the bold lead-in, 42 of the 54 instances.
- Whole-paragraph bold (6 instances) becomes a per-item `emphasis: true`.
- `faq-accordion` also gains the `bullets` field that `text-block` already has, covering the two
  `<ul>` blocks inside FAQ answers.
- The fidelity maps drop the corresponding waivers: `strong`, `ul` and `li` become **emitted and
  checked**, not waived.

### Accepted leftovers — deliberately not solved, recorded so they are not rediscovered

| Leftover | Count | Decision |
|---|---|---|
| Bold **mid-sentence** | 6 | Accepted as a minor known loss. Reword if it ever matters. |
| Links inside copy | 4 | Not solved now. |
| `<br>` / `<span>` in copy strings | 5 / 21 | Stay waived: line breaks and styling-only wrappers are copy, not structure. |

On the four links: **three are the PDF downloads on 研究報告.html** and belong in a structured report
list at Phase 13, at which point they stop being in-copy links at all. **One is a real in-copy link**
(a FAQ answer pointing at 研究報告.html). If that single case proves it needs solving, revisit option
(a) — a formatter limited to links only — rather than reopening bold.

Also recorded in finding 1: those three PDFs live on Wix's file store, so the Phase 18 cutover gate
was widened to grep `_files/ugd` as well as `wixstatic`.

---

## 15 · Site chrome carries load-bearing scripts and there is no shared stylesheet

**Found at P5-T1, while proving the renderer on a real page.** Two facts about this site that the
renderer has to work around, both of which will shape the Phase 9 chrome decision.

### (a) The fixed nav reserves its own space from JavaScript

`.fixed-nav-wrapper` is `position: fixed` and **nothing in the CSS reserves room for it**. Every
live page measures the nav at runtime and sets the offset by hand:

```js
document.body.style.paddingTop = nav.getBoundingClientRect().height + 'px';   // 產品介紹.html:1963
```

Render a page with the chrome markup but without that script and the page's own `<h1>` sits
underneath the nav bar. Measured: `<h1>` at y=55 instead of y=245. **Same class as finding 12** —
the markup is right, the text is in the HTML, every gate passes, and a human sees a broken page.

**Handled at P5-T1**: `renderer/template.js` ships `NAV_OFFSET_SCRIPT` next to the reveal script,
emitted only when the page has chrome. That fixes the scripts-on case. **It does not fix
scripts-off** — with JavaScript disabled the overlap returns, because the height is only knowable at
runtime. The real fix is a known nav height in CSS, and it belongs with the Phase 9 decision about
whether chrome becomes sections or a shared partial.

**The general lesson: lifting chrome markup lifts only half of it.** The behaviour lives in a 500-line
inline `<script>` at the bottom of each page (nav offset, cart badge, mobile menu, language switch).
Phase 9 has to decide, per behaviour, which are load-bearing layout (must ship), which are genuine
enhancements, and which die with pre-rendering (the language switch becomes plain links).

**Measured chrome gap, for whoever picks this up:** the lifted chrome renders 164 px tall against the
live page's 190 px. All 26 px are in `.header-nav-panel` (40 px vs 76 px). Not chased at P5-T1
because chrome is not modelled yet; it is a fidelity item for the Phase 9 visual diff, not a
renderer bug — everything the renderer itself emits matched (`<h1>` 1232×67, same colour, same size,
`.page-header` padding 55/55 on both).

> **Corrected at P9-T1 — the 26 px was never a chrome gap.** It is the account icon, which the live
> page's auth script shows only when `location.hostname` is `localhost`. The P5-T1 comparison was
> against a localhost capture, so it compared against a header production never serves. Under a
> production hostname the live nav is 164 px, exactly what the renderer emits. The D2 note that
> attributed a 164/190 difference to webfont timing was also wrong about the cause. See finding 21.

### (b) There is no shared stylesheet

BUILD_TASKS P5-T1 step 3 says the template emits "the shared stylesheet link". There isn't one. Each
of the 18 pages carries its own CSS **inline** in `<head>` — 27 KB on 產品介紹.html, 80 KB on
index.html — and the rules differ page to page.

**Stopgap at P5-T1**: a page tree names the page whose CSS it needs (`assets.stylesFrom`) and
`renderer/render.js` lifts the `<style>` blocks verbatim. The render log prints a `!` warning every
time it does this, so it cannot quietly become permanent.

**Owner: Phase 9.** Extracting one shared sheet is the precondition for pages built from sections
rather than copied from each other, and it is what makes `<link rel="stylesheet">` in the template
mean anything. Until then, every rendered page inlines a full copy of its source page's CSS — which
is also why the proof page is 47 KB.

### Registered as explicit Phase 9 decisions — owner Phase 9

Both were confirmed by the project owner at P5-T1 review. Neither is optional. **D1 is a
requirement, not an open decision** — it was promoted after the owner looked at the scripts-off
screenshot. D2 is a precondition.

**D1 · Triage the per-page inline chrome script.** Each page carries roughly 500 lines of inline
JavaScript that the chrome depends on. At Phase 9 every behaviour in it gets sorted into exactly one
of three buckets, and the sorting is recorded:

| Bucket | Meaning | Action |
|---|---|---|
| Load-bearing layout | the page is wrong without it, at any moment | needs a **pre-render-safe equivalent** — CSS, not JS |
| Genuine enhancement | the page is correct without it, just less nice | keep as progressive JS |
| Dies with pre-rendering | only exists because content arrives client-side | drop |

The **nav offset is the first load-bearing case**, and it shows why the bucket matters:
`NAV_OFFSET_SCRIPT` fixes it with scripts on, and **scripts-off cannot be fixed at runtime**. Expect
the same shape from anything else that lands in this bucket. Cart badge, mobile menu and the
language switch are the obvious candidates for the other two buckets (the language switch becomes
plain links and dies).

#### REQUIRED at Phase 9 — the nav height must be a known CSS value — **DONE at P9-T1**

Promoted from a decision to a requirement by the project owner at the P5-T1a review, having seen the
scripts-off screenshot. The reasoning, in their words: *a pre-rendered page whose heading hides under
the nav with JS off is still secretly JavaScript-dependent for layout, which defeats part of why we
pre-render.* Pre-rendering that only pays off when scripts run is not pre-rendering.

So, not negotiable at Phase 9:

- **The chrome must lay out correctly with zero JavaScript.** The space below the fixed nav is
  reserved in CSS, from a known height, not measured at runtime.
- **`NAV_OFFSET_SCRIPT` stays, but only as enhancement on top** — it may refine the value when the
  nav actually changes height (mobile menu open, fonts settling, resize). **The layout must not
  depend on it.** Delete the script and the page must still be correct.

**Acceptance reference: `preview/shot-07-rendered-js-off.png`** (P5-T1a). Today that screenshot shows
the `<h1>` clipped behind the nav at **y=55**, against **y=219** with scripts on. When D1 is done,
re-render the same page and the scripts-off `<h1>` y-position must match the scripts-on one within
tolerance. That is the test: same page, scripts off, heading where it belongs.

This is also the concrete form of finding 12's "do the visual diff with scripts enabled AND again
with them disabled". The second run is not a formality — it is the only run that can catch this
class, and it has now caught it twice.

##### Fixed at P9-T1 (D1). What shipped, and the two things that were not obvious

`renderer/template.js` emits `CHROME_LAYOUT_CSS` into `<head>`, after the lifted page CSS so it
outranks it, and only when the page actually has chrome:

```css
body { overflow-x: clip; }
.fixed-nav-wrapper { position: sticky; }
```

**It is NOT a known height, and that turned out to matter.** The requirement above says "from a known
height". There isn't one. `.header-inner` is `flex-wrap: wrap`, so across a width sweep the nav
measures **190, 164, 141, 139 and 136 px** — and it is *taller* at 900–1100 px (190) than at 1280
(164), so a constant read off a desktop screenshot would be 26 px short in the middle of the range.
It is not even stable between runs of the same page: at 1100 px it measured 164 once and 190 another
time, depending on whether the webfont had loaded when the measurement was taken. `sticky` pins the
bar the way `fixed` did while leaving it in flow, so it reserves exactly its own height whatever that
turns out to be. Measured gap between the nav's bottom edge and the start of page content: **0 px at
all ten widths tested.**

**`body { overflow-x: clip }` is load-bearing, and leaving it out passes the acceptance test.** All 18
pages set `overflow-x: hidden` on both `html` and `body` (verified: the `.fixed-nav-wrapper` rule is
byte-identical across all 18). The root element's value propagates to the viewport, which leaves
body's own `hidden` making **body** a scroll container — and a sticky box sticks to its nearest
scrollport. With `sticky` alone the `<h1>` lands in exactly the right place at both widths **and the
nav scrolls off the screen** (measured: nav y = −1085 after scrolling 1085 px). `clip` clips
identically without creating a scroll container. Recorded because the stated acceptance test — the
heading's y-position — cannot see this failure at all.

**`NAV_OFFSET_SCRIPT` was deleted, not kept as an enhancement.** The requirement above assumed it
could stay on top to refine the value. It cannot: with the nav in flow, `body { padding-top }` is
double-counting, and re-adding the script pushes the heading down by a second nav height (**+165 px**
at 1280, **+138 px** at 390). A thing that is wrong whenever it runs is not a progressive
enhancement. Nothing else referenced it.

**Acceptance, met.** Same page, re-rendered, `<h1>` y-position:

| width | scripts on | scripts off | delta | before D1 (scripts off) |
|---|---|---|---|---|
| 1280 | 219 | **219** | **0 px** | 55 |
| 390 | 194 | **194** | **0 px** | 55 |

The two 1280 screenshots are byte-identical PNGs. `preview/shot-07-rendered-js-off.png` — the
acceptance reference named above — now reads y=219, matching scripts-on exactly.

Spot-checked by lifting the same chrome from **`index.html`, `聯絡我們.html` and `購物車.html`** and
rendering each at both widths: scripts-on/scripts-off delta **0 px** on all six, nav pinned on all
six, no horizontal scrollbar introduced anywhere. Guarded by 5 checks in `scripts/test-render.js`,
proven to bite (disable the emission → 3 of them fail, exit 1).

**The 18 live hand-coded pages were not touched.** They keep `position: fixed` plus their own inline
offset script, which is correct for them — they are not pre-rendered. When D2 extracts the shared
stylesheet, this rule is one of the things that moves into it.

**D2 · Extract a shared stylesheet. This is a Phase 9 precondition, not an optional cleanup.**
Pages built from sections cannot each carry a private copy of their own CSS — that is what makes
`<link rel="stylesheet">` in the template mean anything, and it is why the P5-T1 proof page is 47 KB
of which 27 KB is lifted CSS. Until it is done, `assets.stylesFrom` stays, and **the `!` warning
that `renderer/render.js` prints on every lift stays with it**, so the stopgap cannot go quiet and
become permanent.

**D2 also blocks the editor canvas, found at P8-T2.** Puck renders its canvas in an iframe, and
there is no stylesheet to give it: the CSS the page needs is inlined in one of the 18 HTML files,
not available as a link. So the canvas shows correct structure and correct content, **unstyled** —
which for a client being sold a Wix-like editor is a visible shortfall, not a technical detail. The
Preview button is the styled view until D2 lands (it renders through the real renderer, so it is
accurate), and the canvas becomes properly styled for free once one sheet exists. This is the same
finding, not a separate one: do not open a new ticket for "the canvas looks plain".

##### Done at P9-T1 (D2) — as ONE SHEET PER PAGE, not one shared sheet

`scripts/extract-css.js` writes `assets/page-<slug>.css` (that page's whole stylesheet, in its own
original order) and `assets/chrome.css` (the D1 rules, linked last). `assets/site.css` was built,
measured, and **deliberately not shipped**.

**Why the shared extract was abandoned — the numbers.** Of 1073 distinct rule units across the 18
pages, 97 are byte-identical on 15 or more of them, and 118 of 產品介紹's 198 rules matched. That
looked like a 60% win. It was not, because hoisting a rule moves it ahead of every page rule, and
**for two rules that tie on specificity the winner is whichever comes last**. Once every rule that
cannot be safely reordered is held back, **24 rules survive — about 12% of the page, 3 KB against a
21 KB page sheet.** That does not pay for the cascade risk it carries, so each page keeps its whole
stylesheet. Per-page is reorder-proof by construction: same rules, same order, so the cascade is
identical to the inline original by definition rather than by testing.

**The first attempt shipped a broken page and every gate passed.** Worth recording in full, because
it is the exact trap D2 was warned about:

```
div.container.header-inner   padding 16px 0px       ->  0px 24px
div.container.copyright      padding 32px 24px 0px  ->  0px 24px
```

`.container` and `.header-inner` are **different selectors of equal specificity** on the same
element. `.header-inner` was shareable, `.container` was not, so the hoist put `.container` after
the rule it used to lose to. The nav went 190px → 158px, the footer 326px → 262px, and the page
96px shorter. The safety check in place at the time compared rules with the **same selector** and
could not see it. The generalised check — equal specificity, same media context, any shared
property, reordered — catches it, and is what collapses the shareable set to 24.

**The cascade gate: inline vs linked, not against the baseline.** The question D2 asks is whether
delivering the *same* CSS as a linked sheet instead of an inline block changes any pixel, so the
strict comparison is the D1-era inline render against the D2 linked render — identical content,
identical renderer, only the delivery differs. Result, full-page screenshots:

| case | differing pixels |
|---|---|
| 1280 scripts on | **0** |
| 1280 scripts off | **0** |
| 390 scripts on | **0** |
| 390 scripts off | **0** |

The first run of that gate showed 0.14% differing at 390 only. It was not the cascade: the product
photos are hotlinked from Google Drive and lose their race non-deterministically (see the media
finding). Blocking every remote request identically on both sides takes it to zero. A diff against
`baseline/screens/` still shows ~20–28% and **is not this gate** — the rendered page legitimately
differs from the live hand-coded one (the 26px chrome gap above, the migrated product names, and
the live grid ships empty). That comparison belongs to the page migration, not to D2.

**Consequences, all verified.** The `!` CSS-lift warning is gone for 產品介紹 — `assets.stylesFrom`
is off its tree entirely. The rendered page dropped 48 KB → 21 KB. Puck's canvas now has a real
sheet to link. D1 still passes unchanged: 0px scripts-on/off delta at both widths, nav sticky,
`overflow-x: clip`, pinned on scroll, no horizontal scrollbar.

**What this costs, stated plainly.** No cross-page CSS caching: 18 pages will ship 18 sheets with
substantial overlap. That is a performance trade, not a correctness one, and it is recoverable —
`scripts/extract-css.js` still computes and prints the shareable set on every run, so the shared
sheet can be revisited later with a real cascade model (matching rules against an actual DOM rather
than guessing from selector text). `SHARED_MIN` and the analysis stay in the script for exactly that.

`scripts/extract-css.js` uses **css-tree**, which is present transitively rather than as a declared
devDependency. It should be declared before anything depends on it staying.

---

## 16 · `npm run export` published an internal audit trail to a public URL — SECURITY, fixed at P7-T1a

**Severity: HIGH.** Same class as the customers/invoices rule, reached by a path nobody had walked
until P7-T1 ran a real publish for the first time.

**What.** `scripts/export.js` wrote two database collections straight into `data/`:

```js
changed += writeIfChanged('inventory-log.json', JSON.stringify(movements, null, 2) + '\n');   // :145
changed += writeIfChanged('activity-log.json',  JSON.stringify(activity,  null, 2) + '\n');   // :146
```

`data/` is deployed to GitHub Pages and **this repository is public**. So every admin action was one
`npm run export` plus one commit away from `https://www.wonder-herb.com/data/activity-log.json`.

What that file contains — the seven records present when this was found. **Addresses redacted at
P9-T1:** this excerpt originally quoted the two real staff login addresses verbatim, which put them
in public git history (commit `4df742a`) — the leak this finding describes, re-committed as its
own evidence. See finding 22.

```
2026-09-08  sales      <staff account A>   Downloaded the 2026 sales workbook
2026-09-08  sales      <staff account A>   Downloaded the Sep 2026 sales workbook
2026-09-07  sales      <staff account A>   Downloaded the 2026 sales workbook
2026-09-07  sales      <staff account A>   Downloaded the Sep 2026 sales workbook
2026-09-04  inventory  <staff account A>   Started tracking stock for 雲芝糖肽精華 PSP (標準裝 500粒)
2026-09-04  inventory  <staff account A>   Downloaded the inventory report
2026-09-04  users      <staff account A>   Added staff: <staff account B>
```

Staff **email addresses**, who added whom, who downloaded the sales workbook, and when. With a real
admin account instead of `<staff account A>`, that is a named person's internal activity on a public
URL. `inventory-log.json` is the stock-movement ledger and is the same category.

**Nothing leaked.** Both files were untracked and were never committed or deployed. The accounts in
them are test accounts. This was caught before the first real publish, which is the entire reason
P7-T1 ran the pipeline for real instead of assuming it worked.

**Why it was easy to miss.** The rule everyone remembers is "customers and invoices never leave the
database". These are neither — they are operational logs, they sound harmless, and the two lines
that emit them sit among five lines that emit legitimate site content. Nothing read them back:
`admin/index.html:1332` writes a file called `inventory-log.json` as a **browser download**, not a
fetch of `data/`, so removing them breaks nothing.

**Fixed at P7-T1a.** Both are gone from `scripts/export.js` entirely — the collections are no longer
read and no longer written. They stay in MongoDB, reachable only through the authenticated API,
which is where an audit trail belongs.

**Deleted, not gitignored, and that distinction is the point.** A `.gitignore` entry would leave the
files being written into the deployed folder and rely on one line of config to keep them out of the
build forever. The landmine has to go, not be covered over.

**Cross-reference finding 6** (`Pages deploys the whole repo, so editor source and build output ship
publicly`). Same root cause: **the deploy is the entire repository, so anything written into the
working tree is published by default.** Finding 6 is about build artefacts; this one is about data.
Phase 8 should treat them together — the durable fix is publishing an explicit allow-list of
directories rather than everything.

---

## 17 · The export wrote database bookkeeping into public site data — fixed at P7-T1a

**What.** Every exported record carried an `updatedAt` timestamp:

```json
{ "id": 1, "title": "雲芝糖肽精華 PSP (標準裝 500粒)", "...": "...",
  "updatedAt": "2026-09-04T03:35:14.523Z" }
```

`updatedAt` is how the database tracks its own writes. It is not site content, nothing on the public
pages renders it, and no section component reads it.

**Why it matters more than it looks.** It appears on the **last** field of every record, so adding
it moves the trailing comma on the line above. A five-record content change becomes a diff touching
every record in the file. That makes `git diff data/` — the human review step that stands between an
edit and the live site — much harder to read, which is precisely the check that must stay sharp.
Measured: the real content change in the drift found at P7-T1 was **one field on one product**, in a
diff reporting 56 insertions across five files.

**Fixed at P7-T1a.** `forSite()` now strips `updatedAt`, and it is applied to every content list
(cases, products, faq, homepage), not only products. Products additionally keep their existing strip
of `stock`, `reorder` and `stockUpdated`.

### The one real change underneath the noise — NOT a build issue, do not "fix" it

**The true stock state, recorded here because nothing else durable holds it.**

> **`WH-PSP-500` — 雲芝糖肽精華 PSP, 標準裝 500粒, product id 2 — is *Out of Stock* in the
> admin as of 2026-09-04.** That is the real-world fact. The committed `data/` says `In Stock`,
> and has since before this branch started, because the change has never been published.

Identify the row by **SKU**, never by title or id. The title was rewritten at P9-T1 (it now reads
`雲芝糖肽精華 (PSP) – 標準裝`) and five of six product ids cross-map to a different SKU
(finding 19).

The exact field values, so the state is recoverable even if the database is dropped and reseeded
from `data/`:

| field | committed `data/` | the truth (admin, 2026-09-04) |
|---|---|---|
| `status` | `In Stock` | `Out of Stock` |
| `stock` | *(absent)* | `0` |
| `reorder` | `10` | `10` — unchanged |
| `data/inventory.csv`, same row | `…,3800.00,,10,In Stock,,` | `…,3800.00,0,10,Out of Stock,0.00,` |

It is a genuine admin action, not corruption — the audit log records it as *"Started tracking stock
for 雲芝糖肽精華 PSP (標準裝 500粒)"* on 2026-09-04, and it has simply never been published.

**Status: with the client.** Whether a flagship product shows as out of stock on a customer-facing
page is a business decision, not a build side-effect, so it must not ride along in a tooling commit.
**The database holds the truth; `data/` holds the last published value.** The divergence is
deliberate and is recorded here so it is not rediscovered as a bug. Resolve it by publishing
deliberately or by correcting the stock in the admin — either way, on purpose.

**Do not un-park it to tidy a diff.** The database is the source of truth and `data/` is a view of
it; editing the truth to make `git diff` easier to read inverts that relationship. If a commit needs
to exclude the stock line, stage around it or accept the messier diff — never by writing a value
into the database that is known to be false.

---

## 18 · `renderer/i18n.js` is CommonJS, so the editor cannot import it — owner Phase 9

**What.** `renderer/i18n.js` ends in `module.exports = { resolveField, isLangMap, LANGS, PRIMARY }`.
Plain Node loads it happily — the renderer, `scripts/export.js` and the test suite all do. The
editor cannot: Vite's dev server serves source files as native ES modules, and a CommonJS file has
no `default` export to import. The editor died on load with

```
The requested module '/renderer/i18n.js' does not provide an export named 'default'
```

**Why it was not caught by a test.** `scripts/test-editor-lang.js` bundles with esbuild, and
esbuild's **bundler** does synthesise a default export for a CJS module. So the test passed while
the app was broken. Only starting the real dev server showed it — a bundled test and a dev server
are different loaders, and this file is consumed by both.

**Stopgap, in place at P8-T2:** a 15-line `wh-cjs-interop` plugin in `editor/vite.config.mjs` wraps
that one file in the standard `const module = { exports: {} }` shim. The alternative was to copy
`LANGS`, `PRIMARY` and `isLangMap` into the editor, which would put the seven-language list in two
places — exactly the duplication the shared `sections/` registry exists to prevent.

**The real fix, owner Phase 9:** make `renderer/i18n.js` an ES module and let Node consume it
through the same esbuild path `sections/` already uses. It is a change to `renderer/`, which P8-T2
was not allowed to touch, and it is small — the file is 80 lines, pure, and has no imports of its
own. **When it lands, delete the plugin.** The plugin's own comment says so, and it names this
finding, so the stopgap cannot go quiet: a shim with no expiry date becomes architecture.

Worth noting for whoever does it: this is the mirror image of the problem `renderer/build-sections.js`
solves. Sections are ESM and Node needs CJS, so esbuild bundles one way. `i18n.js` is CJS and the
editor needs ESM, and nothing bundles the other way. One module system for shared source, with
esbuild as the single bridge, removes the whole class.

---

## 19 · The product data model is thinner than the page-tree model — owner Phase 14

**What.** Page-tree content is per-language (`{ zh: '…', en: '…' }`) and the P8-T2 editor edits one
language at a time. **Catalogue content is not.** `data/products.json` holds:

```
id, title, sku, price, status, cat, badges, model, desc
```

`title` and `desc` are plain strings. So in the editor, switching the content language to English
translates the page heading and the copy blocks, and the **product cards stay in Chinese** — visible
in `preview/shot-editor-4-language-en.png`. That is correct behaviour for the data as it stands, and
it is not something the renderer or the editor can fix: there is no English title to render.

**This is the same root cause as finding 8.** That one is `products.json` having no `image` or
`link`; this one is no per-language `title` or `desc`. Both are the same sentence: **the product
data model is thinner than the page-tree model, and the gap only shows up once something tries to
render products properly.** Expect more of these. They should be fixed in one pass, as one schema
decision, not one field at a time as each is rediscovered.

**Owner: Phase 14** (all 7 languages), but the schema decision is worth taking with finding 8 at
Phase 9, because that is when the product grid gets migrated for real and the missing `image` is
already a hard blocker. Deciding "what shape is a product" once beats deciding it twice.

**The decision, when it is taken:** do `title` and `desc` become per-language objects like every
other text field on the site, or does the catalogue stay single-language on purpose? The second is
defensible — product names are often left untranslated deliberately — but it has to be a decision.
Right now it is an accident, and an accident that renders as a half-translated page. The client
should be asked: are the product names and descriptions meant to be translated at all?

---

## 20 · A plain-string write silently deleted a language map — SECURITY-CLASS DATA LOSS, guarded at P9-T1

**Severity: HIGH.** Not a leak this time — a deletion. Of content the client paid a translator for.

**What.** P9-T1 turned product `title` and `desc` into per-language objects, recovering seven
languages that the live site already shipped. But `admin/index.html` edits a title in an `<input>`,
and an input holds a **string**:

```js
admin/index.html:3332   document.getElementById('f_prod_title').value = p.title;   // load
admin/index.html:3368   title: document.getElementById('f_prod_title').value       // save
```

So the first ordinary product edit — fixing a typo, changing a price — would `POST` a plain string
over the language map and **delete six languages of that product's title and description**. No
error, no warning; the admin would look like it had worked. The loss would surface weeks later, when
someone opened the German site.

**This is the same class as the editor's fallback-poisoning bug (P8-T2)**, reached through the
business half instead of the editor: a UI that shows one language, writing back as though it were
the whole truth. Expect this shape wherever a single-language control meets multilingual data.

### The fix, and why it is at the API

`server/index.js` `protectLangMaps()`, applied in `POST /api/cms`: a plain string arriving where a
language map is stored is an edit to the **primary language**, not a replacement of the map. The
other languages are preserved and **the merge is reported in the response** rather than happening
silently:

```json
{ "success": true, "type": "products", "count": 6,
  "mergedIntoPrimary": [ { "item": "WH-T3-120", "field": "title",
                           "keptLanguages": ["en","de","es","fr","ja","ru"] } ],
  "notice": "2 field(s) arrived as plain text where a translated value is stored…" }
```

**It lives at the API, not in the form, deliberately.** The API is the only way into the database, so
the invariant holds for every caller — the admin today, the Puck editor, a migration script, whatever
is written next. Fixing the form protects the form, and only until someone writes another one. The
proper multilingual admin form is registered separately as **BUILD_TASKS P12-T3**; until it lands,
staff can edit `zh` safely and simply cannot reach the other six.

### The sequencing rule this teaches — the part worth keeping

**A schema change is not safe to commit until the write path is guarded. The gap between them is
when data dies.**

Had the migration been committed on its own — it was correct, it passed its own tests, and the
recovered translations were right — the very next product edit in the admin would have destroyed
them. The migration and the guard are one unit: they land together or not at all. Generalised: when
a stored shape becomes richer than the UI that edits it, ship the protection in the same change as
the enrichment.

### What it cost to find

Seven separate breakages, discovered one gate-run at a time: the CSV export, the renderer, the
editor canvas, two test files, the admin product list (a crash, not a cosmetic problem), the admin
dashboard (another crash), and `product.html`'s fallback. **Every one was "something assumed `title`
was a string."** A five-minute `grep` for the consumers of that shape, run BEFORE the migration,
would have listed all of them up front. Survey the consumers of a shared data shape before changing
it, not after the crashes.

---

## 21 · The visual baseline records a localhost-only page — owner: re-capture before page two

**Found at P9-T1**, reconciling the first real migration's visual diff against `baseline/screens/`.
The baseline was meant to reflect "what GitHub Pages actually serves" (CLAUDE.md). For two things,
on every one of the 18 pages, it does not.

### (a) The header is a localhost header

The live pages' auth script decides whether to show the account icon by **hostname**, not by
whether an API answers:

```js
if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'http://localhost:4000';
return null;   // www.wonder-herb.com: icon hidden
```

`scripts/baseline.js` served from `localhost`, so the icon showed. With it, `.header-actions` is 36 px
wider, the nav menu wraps 聯絡我們 onto a second row, and the header is **190 px** at 1280. On a
production hostname it is **164 px**. Proven by serving the *same live file* both ways (Chromium
host-resolver mapping, no hosts-file edit):

| page | host | account icon | nav | `<h1>` y |
|---|---|---|---|---|
| live | localhost | shown | 190 | 245 |
| live | production-like | hidden | **164** | **219** |
| migrated | either | hidden | **164** | **219** |

All 18 pages carry `wh-account-link`. Every 1280 baseline therefore records a header production
never serves, with everything below it shifted 26 px. On 產品介紹 the localhost baseline differs from
the live page on a production host by **19.3%** of pixels on its own.

### (b) The typography is a scripts-on-only typography

All 18 pages declare `<html lang="zh-Hant">`. The live language script then runs
`document.documentElement.lang = lang` with `lang = 'zh'` — its internal code, not a language tag.
Chromium picks the CJK **fallback font** from `lang`, so the baseline was captured in the
generic-Chinese fallback (on Windows, a Simplified-style face: real bold, `，。` set low-left). The
pre-rendered page keeps `zh-Hant` and gets the Traditional-style face: **punctuation centred and, on
this machine, visibly weaker bold** on product titles, footer headings and nav.

Proven by changing only that attribute on the migrated page: **nav, page-header and footer went to
0 differing pixels** at both widths.

**A decision, not a fix to force.** Setting the migrated page to `lang="zh"` would turn the diff green
by regressing the page's language semantics — the SEO gate asserts `zh-Hant`, the correct tag for a
Hong Kong site. The real fix is to stop depending on `lang`-based fallback: declare an explicit CJK
font stack after Inter (e.g. `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei"`), so every visitor
gets the intended face regardless of platform or script state. A typography choice for the client.

### Before page two

1. Re-capture the baseline under a **production hostname**, and add a **scripts-off** capture —
   today there is none, so every scripts-off comparison is made against a scripts-on reference.
2. Decide the CJK font stack, then re-capture.
3. Until then, the honest reference for a migration diff is the live page captured under a
   production hostname — what P9-T1 used to reconcile.

### Re-captured (15 Sep 2026) — step 1 done, step 2 held

`scripts/baseline.js` now serves from a production-like host (`wonder-herb.test`, Chromium host
mapping) and captures scripts **on and off** (`screens/`, `screens-nojs/`). It was run against a
checkout of commit 571a513. The old localhost set is kept in `baseline/_previous-localhost-2026-09-08/`.
A third, localhost-only capture of the same commit splits old→new into content drift and the
hostname effect:

- **At 1280, the difference is the hostname.** Mean old→new is 14.7%: drift 0.2%, hostname 14.6%.
  Every page is between 10% and 21%, and nearly all of it is the hostname. On 17 pages the account
  icon goes, the nav goes from 190 to 164 px, and the page is 26 px shorter. account.html instead
  grows 36 px, because its own content also depends on the hostname. 產品介紹 is 19.2%, all
  hostname: that is the "19%" first read as a migration difference.
- **At 390, there is almost no difference.** The icon does not affect the phone header. Only
  account.html differs (23.9%). 有效成份檢測 shows 26.7% drift in the attribution pass, but that is a
  Drive image failing to load in that pass only; old→new is 0.0%.
- **Scripts-off vs scripts-on is 46% at both widths.** Most of it is unrevealed animation content;
  the rest is client-rendered text that is missing without scripts. For example, 微信發表文章 has
  420 characters of text scripts-off vs 1,704 scripts-on, and 產品介紹 has 409 vs 838.
- **The head snapshots did not change on any page.** The SEO gate passes against the new set.
- **Asset failures come from third-party hosts, not the site.** Failures are counted once per
  capture. index.html shows 4: the same Wix video (finding 1), failing once in each of the four
  captures. 聯絡我們 shows 2: the Google Maps embed script, which failed on this host and did not
  fail on localhost.
- **Step 2 is still open.** The typography in (b) is unchanged: the pages still switch `lang` to
  `zh` when scripts run.

---

## 22 · Page-tree export published the editor's email; the gate checked a fixture — SECURITY, fixed at P9-T1

**Severity: HIGH — security.** Same class and severity as finding 16, arriving through two new doors.

**(a) PII in `data/`.** `PUT /api/pages/:slug` stamps `updatedBy` with the editor's email, and
`scripts/export.js` wrote page trees **raw**. The committed `data/pages/products.json` carried the
super-admin's login address, which is meant to exist only in `.env`. Same class as finding 16, on a
path the P7-T1a fix never covered because page trees did not exist yet.

**(a2) The second door was this file.** Finding 16 quoted the leaked audit trail as evidence,
verbatim, including two more staff login addresses. Committed in `4df742a`. Redacted in the working
tree at P9-T1; history is part of the decision below.

### Blast radius — measured, all refs, read-only

| what | where | commits | branches |
|---|---|---|---|
| super-admin login address (`updatedBy`) + one timestamp | `data/pages/products.json` | `deee63b`, `70390bb`, `6fd2752`, `571a513` | `origin/rebuild/editor` only |
| two more login addresses + 7 audit lines (who downloaded the sales workbook, who added whom, dates) | `docs/FINDINGS.md` finding 16 | 12 commits, `4df742a` → tip | `origin/rebuild/editor` only |

- **Exposed: login names only.** No password, scrypt hash, salt, session token, customer data or
  invoice data appears in any commit on any ref. Finding 16's leak files (`activity-log.json`,
  `inventory-log.json`) were never committed. `.env` was never committed.
- **Those are every account that exists.** The database holds exactly three users, all active: the
  super-admin, a second **admin**, and a staff account. All three login names are now public.
- **Not on `main` or `geo`**, never deployed to the site. The only pull request (#1) is `geo → main`
  and contains none of these commits. **No forks.** One star.
- **Not exploitable today:** `MONGO_URL` is `127.0.0.1`; the API is not hosted, so there is no
  reachable login endpoint. It becomes exploitable at **Phase 11** if these identities are carried
  into the hosted system.
- **What an attacker gets then:** a known admin username, removing half of a credential guess.
  Passwords are scrypt-hashed with per-user salts (good), minimum length 8, and the login throttle is
  5 failures per **email + IP** per 15 minutes, in memory — so it is bypassed by rotating IPs and reset
  by a restart. Not a per-account lockout.
- **No outbound email exists** in the app (no reset links), so the addresses being third-party gmail
  mailboxes is not a takeover path today. It would be the moment password-reset email is added.

### Options (project owner's decision)

- **Rewrite history.** Rewrites 12 commits (`4df742a` onward) and force-pushes `rebuild/editor`.
  Costs: every SHA changes, including ones cited in docs (`4df742a`, `deee63b`) and a commit message
  (`6fd2752`); any other clone must re-clone. `git filter-repo` is not installed (it would be a new
  tool — ask first). **It does not un-expose anything by itself:** GitHub keeps orphaned commits
  readable by SHA until GitHub Support purges them, and anyone who already fetched keeps them. With no
  forks and no PR pinning these commits, a Support purge is realistic.
- **Change the identities.** Give the super-admin and admin addresses the business controls, remove
  or disable the exposed accounts, strong unique passwords. Makes the exposed names worthless
  regardless of history. Cheap; it is a local dev database, and Phase 11 starts a fresh hosted one.
- **Accept.** Defensible only as "login names of a local dev database, never reachable" — and only if
  a precondition is recorded that none of these identities reaches production.

Recommendation: change the identities (and make "no exposed identity in the hosted DB" a Phase 11
gate) regardless; rewrite + Support purge only if discoverability matters beyond that. Separately,
harden the throttle to a per-account lockout before hosting.

### DECIDED (project owner, 15 Sep 2026): rotate identities, do NOT rewrite history

Recorded so nobody relitigates it, and so nobody assumes the history is clean. **It is not.** The
exposed addresses remain readable in commits `4df742a`–`571a513` on `rebuild/editor`, and will stay
readable on GitHub by commit hash indefinitely.

**Why rotation beats a rewrite:** a rewrite costs 12 rehashed commits, a force-push, broken references
to commit hashes in these docs and a commit message, and a new tool — and it would **not un-expose
anything**, because GitHub serves the old commits by hash until Support purges them and every existing
clone keeps them. Rotating the identities makes the leaked names worthless whatever history says, and
is nearly free on a local dev database that Phase 11 replaces anyway.

**What that obliges:**
- All three accounts replaced with addresses the business controls, strong unique passwords, and the
  exposed accounts **deleted**, not renamed. Owner's choices: **one account only** (the new
  super-admin; real staff are created later with their own addresses), the new address supplied by the
  owner **via `.env`** so it never passes through chat, a **random password written straight into
  `.env`** and never printed, and the **audit trail left as is** (append-only, never exported; the
  accounts it names will not exist).

  **Rotation status: RUN on the dev database by the owner, 15 Sep 2026 — all four checks passed**
  (one account, the new super-admin, no exposed fingerprint, old login refused).
  `scripts/rotate-super-admin.js` works only through the app's own
  rules (startup bootstrap, sign-in, `DELETE /api/auth/users/:id`), refuses the three exposed addresses
  (by fingerprint) and the current address, never prints an address or password, leaves both new
  values readable in `.env` for the owner to save, and restores `.env` exactly on failure.

  **No domain or free-mail rule on this local rotation — owner's decision, 15 Sep 2026.**
  wonder-herb.com has no mailboxes yet, so requiring that domain would have forced an *invented*
  address: precisely the takeover hole being closed. The real requirement is an inbox a real person
  can open, which no script can verify, so it rests with the owner. The domain and free-mail rules
  belong on the hosted system and stay, unchanged, in the Phase 11 hard gate. Re-rehearsed after the
  change with a non-business address: refusal of an exposed fingerprint, dry run, apply, all checks.
  Rehearsed end-to-end in an isolated copy against a throwaway database seeded to the same shape:
  3 accounts deleted, 1 super-admin left, old super-admin gets 401, no orphaned sessions; the failure
  path left `.env` byte-identical. The exposed accounts no longer exist locally.
- `.gitignore` ignored only the exact name `.env`, so a backup or `.env.production` would have been
  committed with credentials in it. Now `.env.*` is ignored, `.env.example` excepted.
- **BUILD_TASKS Phase 11 hard gate:** no exposed identity in the hosted database — the dev `users`
  collection is never imported, and hosted accounts are checked against fingerprints of the exposed
  addresses before go-live.
- **BUILD_TASKS P11-T3:** a login throttle that survives hosting (persistent, per-account lockout).
  Owned by Phase 11, not 17: on serverless the in-memory throttle is no throttle at all.

> **STANDING PRACTICE — never quote leaked material verbatim as evidence.**
> When documenting a leak: *describe* what was exposed, *cite* where (file, commit, field), and
> *redact* the values. Never paste the leaked addresses, names, tokens or records into a finding, a
> commit message, a test, a PR or a chat log to "show" the problem. Where a check has to recognise a
> leaked value, store a fingerprint (e.g. sha256), never the value.
>
> This is not hypothetical: finding 16's evidence block quoted the audit trail word for word and put
> two more staff logins into public history, turning a one-address exposure into three. The
> repo-wide scan in `test:data` now catches an address quoted into any tracked file — but the scan has
> limits (below), so the practice is the primary control and the scan is the backstop.

**Fixed:** `pageForSite()` in `scripts/export.js` strips `updatedBy`, `updatedAt` and `_id` from
published trees; the database keeps them. **Guarded:** new suite `scripts/test-published-data.js`
(`test:data`) checks the **output** — every file under `data/` — for any email not on an exact
public list (`info@wonder-herb.com`), bookkeeping and identity keys, private collections and personal
CSV columns. It failed on the real committed file before the fix and passes after.

**"Can an email still reach `data/` by any route?" — honestly, yes, as content, and the gate catches
it.** No server route stamps identity onto exported content any more, and users, invoices,
movements and activity are never exported. But `POST /api/cms` stores whatever fields a client sends,
and `forSite()` removes only `updatedAt`, so an email can arrive typed into a case or FAQ, or as an
extra field. Two gaps in the first version of the gate, both closed at P9-T1:
- it allowed any `@wonder-herb.com` address, so `owner@wonder-herb.com` would have **passed**. Now an
  exact list;
- **`npm run publish` did not run it**, so a publish could write a leak and exit 0. It is now the last
  publish stage, after export.

Proven on the real `data/faq.json`, restored byte-identical afterwards: a gmail address typed into an
answer, a company-domain staff address, and an extra `updatedBy` field each fail the gate.

**Extended to the whole repository (P9-T1, after the owner's decision).** A `data/`-only scan
structurally could not see this finding's second door, `docs/FINDINGS.md`. `test:data` now also scans
**every tracked file plus every untracked file git would add** (so a new file is checked before its
first commit), 100 text files today, with **per-location** allow-lists: the business contact on the
public pages and in `data/`; the three distributor contacts on `聯絡我們.html` only; documentation
placeholders in the setup files; one npm package author in `package-lock.json`. RFC 2606 reserved
`example.*` addresses are allowed anywhere, because they can never be a real mailbox. The scanner file
itself may contain only the addresses its own allow-list names — derived, not a blanket exemption.
Every allowance prints its reason on each run. Proven on real files and restored byte-identical: an
address appended to `docs/FINDINGS.md`, and one in a brand-new never-committed file, each fail.

**Still not covered — the limits of this gate, written down so nobody assumes it is complete:**
- **disguised addresses** (`name [at] gmail dot com`, split across lines or HTML entities);
- **phone numbers, personal names and medical remarks inside free text** — only JSON keys named
  `phone` / `remarks` are checked, and only under `data/`;
- **binary files** (8 skipped today: images, `.glb`, spreadsheets that are not gitignored);
- **git history** — the scan reads the working tree; it cannot see what is already committed, which
  is exactly why the history in this finding stays exposed;
- anything **outside the repository**: chat logs, PR descriptions, issue comments, the database itself.

**(b) The publish gate never saw the real tree.** `npm run publish` and `test:seo` both rendered the
P5-T1 fixture in `renderer/sample/`, never `data/pages/`. The tree the editor saves — the one that
ships — had never been rendered or gated. That is how an **editor demo section** sat in the committed
tree: a `text-block` lifted from 產品_T3.html, with English strings typed during the P8-T2 proof,
including an **invented English efficacy claim** about the product's antioxidant strength, typed as test
copy and never approved by anyone. None of it was on 產品介紹. It is not quoted here on purpose: a
fabricated health claim should not be re-published as evidence any more than a leaked address should.
**Fixed:** `renderer/render.js` renders `data/pages/*.json` by default (`publishedTrees()`), and
`test:seo` gates that same list; the fixture is used only by `test:render`, by explicit path. The real
tree was rebuilt through the API from the gated content.

### What history still holds: an invented health claim, not only an email

The rebuilt tree was committed on its own as `9749d61` (15 Sep 2026). The working tree and HEAD now
contain neither the invented claim nor the address. **History does.** The same four commits carry
both: `deee63b` introduced them, and `70390bb`, `6fd2752` and `571a513` carry them. Checked with a
read-only `git log --all -S` search. `origin/rebuild/editor` points at `571a513`, so until the owner
pushes, the public branch tip itself still carries the claim. Not on `main` or `geo`, and never
deployed.

What exactly is in history, described rather than quoted:
- A Chinese sentence copied from 產品_T3.html. It is the client's own copy, placed on a page where the
  client never put it.
- An **English rendering that adds a claim of verification**. No source supports it; it was typed as
  editor test copy. This is the fabricated part.

**The decision stands: no history rewrite.** The same reason applies, and more strongly: a rewrite
does not un-publish. GitHub serves old commits by hash until Support purges them, and clones keep
them. The claim was never on the live site, and GitHub Pages serves only `main`'s tip, so no visitor
and no crawler of wonder-herb.com has been shown it as the business's claim.

**What is different, recorded so nobody reads rotation as covering it:**
- **Rotation cannot neutralise a claim.** A leaked login becomes worthless once the account is gone.
  A fabricated efficacy statement in the business's public repository stays exactly what it is, for
  as long as the commit is readable. The email residual is now inert; this one is not.
- **Two remedies stay open, and neither is taken now:**
  - a GitHub Support purge of the four commits, if the client or a regulator ever raises it (costs as
    above);
  - **squash-merging `rebuild/editor` into `main` at cutover**. That keeps these commits out of
    `main`'s history altogether; a normal merge would carry them into it. A Phase 11/cutover decision.
- **The live site carries a larger claims exposure than this.** 產品_T3.html's own copy makes efficacy
  statements, including one about tumour growth, and the site is served today. That is client copy and
  belongs to the P13G-T2 claims review, not to this finding.
- `scripts/test-sections.js` (fidelity fixture, commit `50e1d3c`) still copies that same client
  Chinese sentence from 產品_T3.html. It is not fabricated, but it is a health claim reproduced in test
  code. It should be replaced with neutral fixture text when that suite is next touched.

---

## 23 · A migrated page loses its behaviour — blocks retiring any page — owner Phase 9

**Found at P9-T1**, before moving 產品介紹 to `legacy/`. Finding 15/D1 said Phase 9 must triage each
page's inline script (~940 lines on this page). Measured, live vs migrated, static server, API off:

| behaviour | live | migrated | bucket |
|---|---|---|---|
| add to cart | works, badge → 1 | **impossible** | load-bearing |
| mobile menu @390 | opens (565 px panel) | **does not open** — no navigation on a phone | load-bearing |
| 快速瀏覽 quick view | opens modal | nothing; modal not in page | enhancement, but the button is rendered |
| language switch | 產品系列 → Product Series | dead | dies — per-language URLs, Phase 14 |
| signed-in header | painted | not painted | enhancement |
| live stock overlay | from `/api` or `inventory.csv` | not applied | decide — see below |
| page errors | none | **none** | — |

**The last row matters.** `test:ui-sweep` asserts every page "loads, switches language and takes
clicks with no errors". The migrated page throws nothing because nothing is bound, so it **passes that
check for the wrong reason**. A behaviour gate must assert the effect (menu opened, cart changed).

**Now a definition-of-done requirement (owner, 15 Sep 2026).** BUILD_TASKS Appendix A: a migrated
page must have its interactive behaviour ported and verified — by effect, with a negative control —
before the original is retired. SEO + fidelity + visual diff are necessary and not sufficient: this
page passed all three while functionally dead, with zero errors. Same class as finding 12.

**Do not port the live script as-is.** Two measured traps:
- `renderProducts()` and the CMS sync rebuild the grid client-side, overwriting the pre-rendered
  content.
- Card `data-id` comes from `data/products.json`, where **標準裝 is id 1**; the live script's array
  calls 標準裝 **id 2**. A copied quick-view or cart lookup would open and sell the *trial pack* when a
  visitor picks the standard pack — finding 19's SKU-vs-id trap again. Bind by SKU.

**Stock.** The rendered grid shows no stock state; the live overlay applies it at runtime. With the
PSP-500 change still parked (finding 17) nothing visible differs today, but a pre-rendered page must
either bake stock in at publish or keep a small overlay. Decide with the behaviour port.

### Ported at P9-T1 (15 Sep 2026): built, tested, NOT yet retired

Built to the plan the owner approved. Behaviour lives in static files:
- `assets/site.js`, shared by every page: the cart store, badges, phone menu and language switcher.
- `assets/behaviour/quick-view.js`, loaded only when a tree contains `product-grid`.

`renderer/template.js` derives both from the tree's section types. It refuses to render a body
without them, so no caller can skip the derivation. Hooks are `data-sku` / `data-price` /
`data-status` / `data-clinic-only`. The database `data-id` is removed from the card, so nothing can
bind to it. The modal markup is emitted, hidden, by the section. The quick view fills it from the
clicked card with `textContent`, so there is no product table in the script.

**`npm run test:behaviour`** runs on a static server with no API, the production-like host, 1280
and 390:
- **Cart ids, checked against three sources.** The SKU → cart id table matches
  `migrate-products.js` MATCH, `WH_SKU_PAGES` (identical on all 18 pages) and each detail page's own
  cart id. A negative control shows the database's ids would fail: 5 of 6 name a different product.
- **Effects.** The menu opens and closes. The quick view shows the right product for all 6 SKUs.
  標準裝 x2 lands in the cart as cart id 2 / WH-PSP-500 / 3800, and the existing 購物車.html names
  it correctly. Adds merge with items written by the old detail pages and by the cart page. The
  badge follows the cart in a second tab. Refusals are visible and logged.
- **Real data.** Every product on the unchanged catalogue is accepted or refused exactly as its data
  says.
- **Scripts off.** No visible control that needs JavaScript. All content and detail links present.
  `<h1>` at the same y as with scripts on.
- **Negative controls.** Without `site.js`, 6 of 6 dependent checks fail. Without `quick-view.js`, 4
  of 4 fail, while independent checks still pass. Without the scripts-off rules, 13 (1280) and 8
  (390) dead controls are found. A one-off mutation swapping the two PSP cart ids failed 7 checks,
  including the cart page naming the wrong product. The file was restored byte-identical; the
  mutation is not kept in the suite.
- **Visual effect of the port** (pre-port vs ported, same conditions): **0 px** at both widths with
  scripts on. With scripts off the change is deliberate: the hidden quick view buttons and switcher
  differ by 2.1% at 1280; at 390 the cards' stacked button row goes, so the page is 90 px shorter.

**Price hold: the disputed prices refuse, they do not pick a price.** `PRICE_HOLD` in
`assets/site.js` lists 憶活素 and PT3. `test:behaviour` fails if that list drifts from
`migrate-products.js` DISPUTED, **if a held SKU's sources stop disagreeing** (the hold is stale),
or if a sellable SKU's sources start to (a new dispute). Adding a held product shows the visitor a
message and logs the reason. `npm run render` prints `! PRICE HOLD` on every run. So 4 products are
sellable, not the 5 in the owner's instruction. PT3 is held too: its dispute is between HK$2,480 and
clinic-only. It also has no purchase path on the live site, so for a visitor the effect is unchanged.
**The grid still DISPLAYS 憶活素 at HK$880 and PT3 at HK$2,480** (database values, as since the
migration). The hold stops the cart, not the display; the displayed price is part of the client's
answer.

**Clinic-only is an explicit data flag** (`clinicOnly: true` → `data-clinic-only`), supported and
tested with a fixture. **It is NOT in the data yet, on purpose:** the admin product form would
delete it on the next save (finding 25). PT3 is refused by the price hold today. A test requires any
product the live site sells only at clinics to be held or flagged, so lifting the hold without the
flag fails.

**Not ported, recorded:**
- ~~Visible stock state~~ **Correction (15 Sep 2026): there was nothing to port.** The live
  產品介紹 has no visual stock cue. Its inventory overlay (`whApplyInventory`) sets each product's
  `status`, and the only thing that reads it is the add-to-cart refusal. The card template
  (`renderProducts`) never renders status. Across all 18 pages the only visible stock label
  (現貨供應 / 暫時缺貨 / 接受預訂) is on `product.html`. The migrated grid therefore matches the live page:
  status is baked in as `data-status` and enforced at the cart. Showing stock on the grid would be a
  **new** feature, and a client decision, since it would also publish PSP-500's out-of-stock state
  (finding 17). It is not a P9-T1 gap. When 產品_* detail pages migrate, product.html's label is
  their parity item.
- **Phone navigation with scripts off.** The menu toggle is hidden rather than dead, so a phone
  visitor without JavaScript has footer links only. The live page is the same today (its toggle is
  dead). A no-JavaScript menu needs a chrome markup change, which belongs to the chrome modelling
  decision.
- **Signed-in header.** The API is not hosted; the owner agreed it can wait.
- ~~New visitor-facing copy, for client review~~ **Approved by the owner, 15 Sep 2026, and shown
  inline.** The price-hold line is now 此產品暫未開放網上訂購，歡迎透過 WhatsApp 查詢購買方式。
  (EN: "This product isn't available to order online. Message us on WhatsApp and we'll tell you how
  to buy it."). It gives a reason and a next step, and it does not tell a customer who can see a
  price that we are unsure of our own price.
  - **No `alert()` anywhere in the cart any more.** A refusal appears inside the quick view, next to
    the button, in a `role="alert"` region, and the modal stays open. A successful add closes the
    modal and shows a dismissible status bar.
  - `test:behaviour` asserts the exact approved wording, where it appears, and that **no dialog
    ever opens**. A one-off mutation that reinstated `alert()` failed 3 checks; the file was
    restored byte-identical.

**Accepted behaviour change (owner, 15 Sep 2026): stock goes live at publish, not instantly.** The
old page read `inventory.csv` when it loaded, so a stock change in the admin showed up once
exported. The pre-rendered page bakes status in at render, so the change reaches the site only
through `npm run publish` and a commit. **Flagged for `ADMIN_GUIDE.md`**, to be written when the page
actually retires (BUILD_TASKS P9-T1).

**Definition of done, 產品介紹, Phase 9 waivers (owner, 15 Sep 2026):**
- **"Editable in Puck"** was waived only until the `mergeTree` fix landed (finding 25). It has, so
  this now passes.
- **"Heavy assets from R2/CDN"** is waived for Phase 9. The product photos are Google Drive
  hotlinks, and moving them is Phase 10, which the plan puts after Phase 9. Re-check at Phase 10.

### Also found and fixed at P9-T1

- **product-grid dropped its button icons** (快速瀏覽's eye, 詳細介紹's info). The P4-T4 fidelity check
  reads the live card *template*, and its scanner turns every `${...}` hole into a placeholder — while
  the icons arrive through a hole, `${translations[currentLang].quickview_btn}`. The check built to
  catch dropped icons could not see these. Fixed in `sections/ProductGrid.jsx`; the fidelity map gained
  `holes`, so hole-filled markup joins the expectation. Proven: it failed with
  `MISSING i, .fas, .fa-eye, .fa-info-circle` before the fix.
- **The floating WhatsApp button was missing.** It sits after `<footer>`, and `loadChrome` lifted only
  nav and footer. Fixed; guarded in `test:render`.

### Structured data now disagrees with the visible page — client + P13G-T2

On the live page, JSON-LD and the grid agree because both come from the page. On the migrated page
the grid reads the database, so the two disputed prices diverge: **憶活素 JSON-LD 520.00 vs visible
HK$880; PT3 JSON-LD 0.00 ("clinic only") vs visible HK$2,480.** PT3 at 0 is what triggers the live
page's clinic-only purchase block, so the database price would put a clinic-only product up for sale.
The JSON-LD `sku` values are also placeholders (`WH-YGQ-300`, `WH-MEMO-60`, `WH-PT3-PRO`) matching no
real SKU. Both resolve when the client answers the prices and P13G-T2 derives `Product` from data.

---

## 24 · Migrated pages are Chinese only — ACCEPTED REGRESSION (owner, 15 Sep 2026) — owner Phase 14

**User impact, plainly: an English-speaking visitor who chose English on another page opens 產品介紹
and gets it in Chinese.** The same applies to German, Spanish, French, Japanese and Russian. Every
live page switches language in the browser, and the choice persists (`localStorage wonderherb_lang`),
so today that visitor sees the products page in English. A pre-rendered page has one URL per
language, and Month 1 renders `zh` only. Each page that migrates before Phase 14 adds itself to this
list.

**Why accepted, rather than the alternatives (owner):**
- **Not "keep the old page live until languages render":** P9-T1 would never finish, and we would
  learn nothing about the real per-page cost of a migration.
- **Not "pull this page's languages forward":** that breaks the phase sequencing for one page.

**The switcher is NOT dead**, which would be worse than Chinese-only. `test:behaviour` verifies at
1280 (desktop spans) and 390 (phone dropdown):
- choosing a language saves it, so every other page still follows it;
- the page tells the visitor, in the chosen language, that it is not yet available in that language
  (e.g. "Sorry, this page is only available in Chinese for now.");
- a visitor arriving with a saved non-Chinese choice sees that notice on landing, rather than a page
  that looks broken;
- the live page opened next renders in the chosen language (checked on 常見問題).

When a page declares an alternate for the language (`<link rel="alternate" hreflang>`, Phase 14),
the same click goes to that URL instead. No switcher change is needed at Phase 14.

**Copy approved by the owner, 15 Sep 2026.** "Sorry, this page is only available in Chinese for
now." / 本頁暫時只提供中文版本。 It says what the visitor *is* looking at, not only what is
missing. It exists in all seven languages (`assets/site.js`, `UNAVAILABLE`). The notice's text, its
`lang` attribute and its **close button's screen-reader label** are all in the chosen language
(e.g. 閉じる on the Japanese notice); the label had been English-only. `test:behaviour` asserts all
three at 1280 (English) and 390 (Japanese).

**Not covered:** the page does not redirect a visitor with a saved language to an alternate on
load. Whether it should is a Phase 14 decision, with SEO consequences, and is not made here.

---

## 25 · A write path deletes every field its caller was not shown — HIGH, data loss — owner P12-T3

> **THE RULE (general, and the reason this finding exists):**
> **No write path may delete a field its caller was not shown.** A save means "these fields now have
> these values". It never means "and every other field no longer exists". The store merges; it does
> not replace. Removing a field takes an explicit instruction (`null`), never an omission.
>
> The invariant lives **in the store (the API), not in any form or editor**, for the same reason as
> finding 20: the API is the only way into the database, so a rule there holds for every caller
> (the admin, Puck, a script, whatever is written next). A fix in one form protects that form, and
> only until someone writes another one.

**Finding 20 was one case of this rule, and the guard built for it does not cover the rule.**
`protectLangMaps` stops a plain string from flattening a stored language map. That is one field
type. It does nothing for a field that simply isn't sent, and nothing for the next field type
anyone adds. Fixing each field type as it bites would give findings 30, 35, 40. **Fix the class
once.**

### Where it bites today, by write path

| write path | caller | what it deletes today | how established |
|---|---|---|---|
| `POST /api/cms?type=products` (whole list replaced) | admin `saveProd()`, `admin/index.html` ~3367: builds the product from its inputs alone | **`link`** (the 詳細介紹 button disappears from the pre-rendered grid), **`ribbon`** (PT3's clinic-only ribbon), **`priceNote`**, and any later flag, e.g. **`clinicOnly`**, whose loss would make a clinic-only product sellable, silently | reading the code (running it needs a dev-database write) |
| `PUT /api/pages/:slug` (document replaced) | Puck editor `mergeTree()`, `editor/lang.js`: rebuilds each section as `{ id, type, fields }` | **section-level keys**, today `"wrap": "container"` on 產品介紹's product-grid, so the next publish renders the grid without its container. A save with **no edits** loses it | **run:** the real `projectTree` → `mergeTree` on `data/pages/products.json`; the result lacks `wrap` |
| `POST /api/cms?type=homepage` (document replaced) | admin `saveHomepageText()`: 10 inputs | nothing yet: the form happens to cover all 10 stored keys. **The first key added anywhere else is lost on the next save** | reading the code + `data/homepage.json` keys |
| `POST /api/cms?type=faq` (whole list replaced) | admin `saveFaq()`: `id, cat, q, a` | nothing yet, for the same reason | same |

The first two are losing data now; the last two are the same shape waiting for their first new
field. `link`, `ribbon` and `priceNote` were recovered at P9-T1 (finding 19), and the product form
is what would lose them again.

### Fix, owner P12-T3 (merge, not replace, for every content write)

1. **Lists** (`products`, `faq`, `cases`): match each incoming item to the stored one by a stable
   identity (SKU for products, `id` otherwise; `identityOf` already exists). Start from the stored
   item and apply the incoming fields over it. A field set to `null` is removed. An unmatched item
   is new; a stored item absent from the list is deleted, so deleting a *record* still works.
   **Only omitted *fields* are protected.** One known edge: a staff edit that *changes* the SKU
   finds no match. Match by `id` as well, or treat an SKU change as its own explicit operation.
2. **Single documents** (`homepage`): the same, at the top level.
3. **Page trees**: apply the same merge at the top level and **per section**. Sections in stored
   trees carry no stable id today (the editor derives one from position), so persist the section id
   first, then merge node-level keys by it. Until then, fix `mergeTree` to start each section from
   the stored node.
4. **The response reports what was kept**, like `mergedIntoPrimary`, so a merge is visible.
5. Then make each form carry what it doesn't edit. That's defence in depth, not the fix.

**Verify, with a negative control, per write path:** save through the real caller with fields it
doesn't show present in the store, and confirm they survive in MongoDB and in `data/` after export.
Then run the same save against the pre-fix API and confirm they are lost. Add one test that loops
every content write path, so a new path is covered by default.

**Consequences now:**
- `clinicOnly` stays out of the data until this is fixed.
- **PT3's price hold cannot be lifted before it is.** `test:behaviour` fails a lifted hold without
  the flag.
- ~~Nobody should save 產品介紹 in the Puck editor until item 3 lands~~ **Narrow fix landed at
  P9-T1 (owner, 15 Sep 2026: the editor was corrupting the page just migrated, which can't wait).**
  `mergeTree` in `editor/lang.js` now starts each edited section from its stored node. Unknown
  node-level keys (`wrap`, and any added later) survive. A different section type at the same id
  inherits nothing, and a new section has nothing to inherit. Top-level keys were already kept.
  - `test:editor:lang` adds 5 checks: a no-edit save keeps `wrap` and an unknown future key; the key
    travels with its section when reordered; a replacement inherits nothing; and **the real
    `data/pages/products.json` through the app's own round trip changes nothing but gaining ids**.
  - **Negative control:** against HEAD's pre-fix `mergeTree`, 4 of the 5 fail, including the real
    tree losing `wrap`. The file was restored byte-identical.
  - This covers the Puck write path only, at the client. The rule in the store (the API) for every
    write path, items 1–5 above, stays P12-T3.

---

## 26 · Patient cases published as five-star product reviews, with invented ratings — publicly served 4 Jun – 15 Sep 2026 — CRITICAL

**Severity: CRITICAL — medical testimonial content presented as customer reviews of health
products.** The worst thing found in this project. It is worse than the invented claim (finding 22)
and worse than invented star ratings alone.

**What was published** (described, not quoted: standing practice, finding 22):
- **Reviews built from patients' medical cases.** Each `Review` restated a patient's case as a
  five-star product review: an author name or honorific, a **diagnosis, including cancer**, and a
  treatment outcome attributed to the product.
- **Some of those patients are real case-study subjects.** Of the 12 distinct review authors on
  `main`, 3 match patients named in the client's own case studies (`data/cases.json` and 典型病例's
  visible text). So the client's clinical case material was repurposed as star-rated product
  endorsements.
- **The other 9 appear in no case content at all.** Their origin is unknown; they may be invented
  people. Checked by string match only; no names reproduced here.
- **Invented ratings beside them:** `aggregateRating` values of 4.6–4.9 with review counts of 89–328,
  repeated across pages including ones with no product. One carried an "explanation" citing a large
  patient-feedback statistic that nothing in `data/` or any client source seen supports.
- **No real data behind any of it:** nothing in `data/` holds a single rating or review.

**Why this severity.**
- A star rating with a review count is a trust signal a customer acts on.
- Presenting patient outcomes, cancer included, as customer reviews **turns clinical anecdote into
  product endorsement**. On a health products site that misleads a sick reader about what the
  product does.
- It is also structured data a search engine may show as rich results.
- BUILD_TASKS P13G-T2's hard rule already said never emit rating data; this was its first real
  test.

**Publicly served from 4 June 2026** (the GitHub web uploads that introduced it on `main`) **until
15 Sep 2026**, on this repo's GitHub Pages copy under the client's brand. The client's own Wix site
never carried it, as far as was checked: homepage and 產品介紹 only. Wix rate-limited further
checks (429), so those were stopped, not retried.

> ### ⚠ POTENTIALLY A LEGAL AND PRIVACY MATTER, NOT ONLY AN SEO ONE (recorded 15 Sep 2026, project owner)
>
> **Real patients' identities, drawn from the client's own case studies, were attached to
> fabricated product reviews with invented ratings, and published publicly for about three months**
> (4 June – 15 September 2026).
>
> Under Hong Kong's Personal Data (Privacy) Ordinance (PDPO), information about a named person's
> diagnosis and treatment is personal data, and health data is among the most sensitive kinds. Here
> it was **used for a purpose it was almost certainly not collected for**: endorsing a product in
> star-rated reviews the patients never wrote. The same content also presents clinical outcomes,
> cancer included, as customer testimony for health products. That may raise questions beyond
> privacy, e.g. about health-product advertising and misleading trade descriptions.
>
> **The project owner is not a lawyer, and nothing here is legal advice. This needs proper legal
> advice.** It is stated plainly so that nobody treats it as a tidy-up. The SEO fix is done; the
> exposure it created is not closed by the fix.
>
> **Handling (owner's decision, 15 Sep 2026):**
> - The owner handles this with the client, including who produced the content.
> - **No further investigation from this project's side:** no more fetching of the client's Wix
>   site, and **no tracing of authorship through commit metadata**.
> - **Do not delete the evidence.** No history rewrite on `main` for this content (see below).

### Exposure window and URLs, recorded for the client and their advisers

- **Window: 4 June 2026 → 15 September 2026, 05:12 UTC.**
  - **Start:** the commits that added the content to `main` are dated 4 June 2026 (`503c22d`,
    `ac197ae`, `b00c05a`), and `main` deploys to GitHub Pages on push. The exact first-served time
    was not verified: the repository's Pages deployment history would show it, and that is the
    owner's to retrieve.
  - **End:** the deploy of `6503a01` completed at 05:12:19 UTC on 15 September 2026. All 16 live
    pages were then fetched and verified free of rating data.
  - The owner is unpublishing GitHub Pages, which ends public serving of the copy altogether.
- **Where: `https://formurak4m.github.io/wonder-herb/`**, these 15 pages, including the site root (served as
  `index.html`), each of which carried rating and/or review data on `main` at `1201c70`:
  `index.html`, `典型病例.html`, `小册子.html`, `常見問題.html`, `微信發表文章.html`,
  `有效成份檢測.html`, `產品_PT3.html`, `產品_T3.html`, `產品_乙肝清.html`, `產品_憶活素.html`,
  `產品_雲芝糖肽精華_A.html`, `產品_雲芝糖肽精華_B.html`, `產品介紹.html`, `研究報告.html`,
  `聯絡我們.html`.
- **The client's own website was unaffected.** `www.wonder-herb.com` is served by Wix, not by this
  repository. Basis: DNS on 15 Sep 2026, and the Wix homepage and 產品介紹 carried no rating data.
  The other Wix pages were not checked (Wix rate-limited, and the owner has closed further checks).
- **STILL PUBLICLY READABLE: the repository's history on github.com.** The repository is public, and
  the removed content remains viewable in its history, including the case-derived reviews. That is
  the evidence to preserve, and it is also continuing exposure. Whether to keep the repository
  public while this is handled (e.g. making it private preserves every commit) is a decision for the
  owner and the client's advisers. It is recorded, not taken.

### Where the removed content is preserved: recoverable exactly, do not rewrite

Git history holds every byte of what was published. To reproduce it:
`git show <commit>:<path>`, or `https://github.com/formurak4m/wonder-herb/blob/<commit>/<path>`.

| what | last commit that CONTAINS it | removed by | paths (rating/review objects at that commit) |
|---|---|---|---|
| **The publicly served copy** (`main`) | **`1201c70`** | `6503a01` | `index.html` 1, `典型病例.html` 4, `小册子.html` 4, `常見問題.html` 3, `微信發表文章.html` 3, `有效成份檢測.html` 3, `產品_PT3.html` 3, `產品_T3.html` 3, `產品_乙肝清.html` 3, `產品_憶活素.html` 3, `產品_雲芝糖肽精華_A.html` 3, `產品_雲芝糖肽精華_B.html` 3, `產品介紹.html` 10, `研究報告.html` 3, `聯絡我們.html` 3 |
| The same pages on this branch (never deployed) | `c6c4237` | `7a918b6` | the 15 above, plus `product.html` (10); `index.html` holds 6 here |
| The rebuild's page tree and render fixture (never deployed) | `472ad4a` | `2923574` | `data/pages/products.json` 5, `renderer/sample/products.json` 5 |

- `1201c70` is contained in `origin/main`, `origin/geo` and `origin/rebuild/editor`. `c6c4237` is on
  `origin/rebuild/editor`.
- The commits that introduced the content on `main` are dated 4 June 2026 (`503c22d`, `ac197ae`,
  `b00c05a`), listed as dates only: authorship is not examined here.
- **Rules:**
  - **Never rewrite `main`'s history, never force-push, and never delete `geo` or `rebuild/editor`
    while this matter is open.** Doing so would destroy the record of exactly what was published
    and when.
  - If the repository's visibility changes, the history must be kept intact.
  - Anyone needing the record should get it from these commits, not from a recollection or a
    summary.

**Removed at P9-T1 (15 Sep 2026)** from everything this rebuild publishes:
- **The products page tree**, through the API then export. The 5 `aggregateRating` + 5 `review`
  objects are gone; 25 rating keys became 0. The JSON-LD `@types` are unchanged, so the baseline
  gate still passes.
- **The `test:render` fixture** (`renderer/sample/products.json`), same removal.
- **Guarded.** `test:seo` now fails any published page whose JSON-LD holds `aggregateRating`,
  `review`, `reviewRating`, `ratingValue`, `reviewCount` or a Rating/Review type. Not waivable.
  Proven both ways: a planted node is flagged, and the committed (rated) tree fails the real gate.
  The file was restored byte-identical.

**Where they are live TODAY. Checked 15 Sep 2026, read-only GETs and DNS:**

| where | ratings? |
|---|---|
| `www.wonder-herb.com`, the client's real site (DNS → **Wix**) | **none**: homepage and 產品介紹 carry 0 `aggregateRating` |
| `formurak4m.github.io/wonder-herb/`, **this repo's GitHub Pages deploy of `main`** | **yes, publicly**: `產品介紹.html` returns 200 with all five, no `noindex`, canonical pointing at wonder-herb.com |
| `main` in this repo | **14 of 16 HTML pages** carry them, including pages with no product (the FAQ, articles, contact, research). Most repeat the same review count |
| the 18 live pages on `rebuild/editor` | yes, the same markup; they would ship if merged |

**So this is not the client publishing fake reviews on their own site**: their Wix site doesn't.
It is **this project's public copy** that serves invented ratings under the client's brand. The
markup first appears in the repo through GitHub web uploads on 4 June 2026 (`main`, e.g.
`503c22d`, `b00c05a`), i.e. before and outside this rebuild. Whether a search engine has picked
up the GitHub Pages copy: see the indexing check below.

**Owner decisions, 15 Sep 2026: handle today.**
1. **`main` (the public copy): stripped as its own commit, `6503a01`. Diff approved by the owner,
   pushed 15 Sep 2026 05:12 UTC, alone.**
   - 15 pages: `review`/`aggregateRating` keys on 14, plus a **standalone `Review` node in
     `index.html`'s `@graph`**, which the first key-based pass missed and a node-level pass caught.
     All 50 JSON-LD blocks on `main` parse, and none holds rating data.
   - **Deploy verified:** the "Deploy static content to Pages" run for `6503a01` completed
     successfully. All 16 pages on `formurak4m.github.io/wonder-herb/` were fetched live, with and
     without cache-busting: **0 rating data** in any JSON-LD block.2. **The live pages on `rebuild/editor`: stripped, own commit `7a918b6`.** 16 pages, 90 removals.
   This branch carried more than `main`, including `product.html` and extra `index.html` nodes.
   All 51 JSON-LD blocks parse; no rating data remains in any tracked file.
   - The stale HTML comments naming "Review" in each page's JSON-LD list were left alone, so the
     commit is data only. One of them states the intent: building social proof.
   - `test:seo`'s baseline comparison now ignores `Review` / `AggregateRating` types. The captured
     heads contain them, and losing them is the fix, not a regression.
   - **Stale comments cleaned in a separate follow-up, `d2ee9c4`** (so `7a918b6` stayed
     data-only). 14 comment lines in 14 files no longer list "Review", and 小册子's social-proof
     comment now describes its block as `Product`. `main` still carries the same 13 comments.
     They're harmless text, but `main` was authorised for the data fix only; they go at cutover or
     on the owner's say.

**Is the public copy indexed? Checked 15 Sep 2026, with limits stated:**
- A `site:formurak4m.github.io` search and exact-URL searches through this session's web-search tool
  returned **no `github.io` pages**. They did return the **github.com repository page** itself,
  which shows the source files. That tool's backend is **not Google**, so this is not proof of
  absence in Google or Bing.
- **Nothing tells crawlers to stay away:** crawlers read `robots.txt` only at the host root,
  `formurak4m.github.io/robots.txt`, which returns 404, so crawling is allowed. The project's own
  `robots.txt` under `/wonder-herb/` is never read.
- The pages' canonicals point at `www.wonder-herb.com/<page>.html` URLs that don't exist on the Wix
  site. That makes it more likely, not less, that a search engine treats the github.io copy as the
  real page.
- **Wayback Machine:** no snapshot of the homepage or 產品介紹 (the full index lookup was
  unavailable, 503).
- GitHub API: the repository is **public**, `has_pages: true`, default branch `main`, 0 forks.
- **Verdict so far: "fix it and move on" is likely, but it is not confirmed.** The owner should run
  `site:formurak4m.github.io` in **Google and Bing** directly. Any hit makes it "fix and request
  removal": after the copy is taken down (404), submit each URL to Google's *Refresh Outdated
  Content* tool and Bing's *Content Removal* tool.

**Recommendation: take the GitHub Pages copy down (unpublish), don't `noindex` it.**
- **Nothing depends on it.** The client's real site is Wix until cutover, and development runs
  locally.
- **`noindex` would have to be committed into the very pages that cut over to production.**
  Forgetting to remove it at Phase 18 would de-index the client's real site. A deploy-level
  takedown carries no such risk.
- **`noindex` leaves the content reachable** and only takes effect when re-crawled. A takedown
  returns 404 at once, which is also the precondition for removal requests.
- **How:** GitHub → Settings → Pages → *Unpublish site*, or disable the `static.yml` workflow. This
  is a repository-settings change the owner makes; this session has no GitHub access. At cutover,
  Pages is re-enabled deliberately, with the custom domain.
- **Order:** push `6503a01` first, so the last served version is clean for any cache, then
  unpublish.
- **Residual:** the repository itself is public, so the source, including history with the
  ratings, stays readable on github.com (the same position as finding 22). Making the repo private
  would also end Pages on a free plan. That is a bigger decision, noted and not taken.
3. **The client conversation.** The client should hear three things. First, that a copy of their
   site built for this project carried invented ratings, and reviews built from patient cases
   (including some of their own case-study patients), publicly from 4 June to 15 September 2026.
   Second, what was removed, and when. Third, that it was never on their Wix site, as far as was
   checked. If they have genuine, attributable reviews, publishing those is a new decision with
   them (P13G-T2), and patient case material needs the patients' consent for that use regardless.
4. **With the owner (15 Sep 2026):**
   - **Unpublish GitHub Pages** (Settings → Pages → Unpublish). Takedown was chosen over `noindex`,
     because a stray `noindex` left at the Phase 18 cutover would de-index the client's real site.
   - **Run `site:formurak4m.github.io` in Google and Bing.** Any hit means removal requests
     (Google Refresh Outdated Content, Bing Content Removal); no hits means fix-and-move-on.

**For the claims review (BUILD_TASKS P13G-T2): the source of this content may have supplied the
on-page copy too.**
- Whoever produced medical-case "reviews" and an unsupported patient-feedback statistic in June
  2026 was writing health persuasion copy for these pages, and the same uploads carried the pages'
  visible copy.
- **So the on-page claims can no longer be presumed to be the client's own words.** That includes
  產品_T3.html's statement about inhibiting tumour growth (noted at finding 22), the efficacy
  multipliers, and the "university-proven" phrasing.
- P13G-T2 must trace each health claim to a client-approved source (their Wix site, their
  brochures, their written approval) before any migrated page publishes it. Unsourced claims are
  held, not carried over.
- Not established: whether the Wix site carries the same claims. Wix rate-limited the check (429),
  so it wasn't retried.
---

## 27 · The admin's FAQ editor changed nothing a visitor could see — FIXED by the page-two migration (P9)

**What.** The admin has an FAQ screen. It writes to the `faq` collection, `export` writes
`data/faq.json`, and the file is committed and deployed. Its own help text says:

> edits question & answer accordions on the **FAQ Page** (`常見問題.html`) and JSON-LD schema for
> Google Rich Snippets

**None of that reached the site.** Until 15 Sep 2026 `常見問題.html` was hand-coded: its five
questions, their answers and its `FAQPage` JSON-LD were literal markup in the page. **No public page
read `data/faq.json` at all** — the only readers were the admin itself, the editor, the API and the
renderer. A client could edit the FAQ, see it save, see it in the admin afterwards, and the website
would never change.

**How established.** Searched every tracked file for readers of `faq.json` / `type=faq`: admin,
editor, renderer, server and scripts only, no public page. Confirmed by comparing content: the five
questions in `data/faq.json` and the five on the page were **different questions**, and had drifted
apart with nobody noticing — which is what an unused editing surface looks like.

**Severity.** Medium, and worse than its severity suggests in client terms: not a broken feature but
an **invisible** one. The client believes they can maintain their own FAQ. The failure mode is
silent (a successful save), so it can persist indefinitely.

**Not caused by the migration — fixed by it.** Since `fc8c6e8`, `常見問題.html` renders the
`faq-accordion` section from `data/faq.json`, and its `FAQPage` JSON-LD is derived from the same
data (`renderer/render.js faqPageNode`), so an admin edit reaches both the visible list and the
schema at the next publish. `test:seo` fails any page whose `FAQPage` names questions its visible
list does not.

**The visitor-facing consequence, recorded:** the page now shows the five questions in
`data/faq.json`, not the five that were hand-coded into it. No data was changed (owner: site content
is not authoritative).

### Still to do

- **`ADMIN_GUIDE.md` (at cutover):** say that FAQ edits now reach the site, and that like stock they
  go live at **publish**, not instantly. Worth naming to the client as a fix: the FAQ editor works
  now, and did nothing before.
- **Check the same class elsewhere before each page migrates.** `cases.json` and `homepage.json`
  have admin screens too, and 典型病例 and `index.html` are still hand-coded — the same
  "edits that reach nothing" shape until those pages migrate. Establish it per page, in the
  migration, rather than assuming either way.

---

## 28 · Per-language IMAGES and LINKS exist, but a tree cannot hold them — Phase 14

**What.** 小册子 swaps the brochure scan AND the link to it per language, on load:

```
translations.zh.brochure_page1_img   / _href     (the Chinese scan)
translations.en / es / fr / ja / ru  .._img      (the English scan)
(de falls through to the src hard-coded in the HTML)
```

The `src` written into the markup is **the German/English scan**, not the Chinese one. So
pre-rendering the page's own markup verbatim would have published the German brochure to Chinese
visitors — the page a Chinese reader sees today would have changed, silently, on a page whose whole
purpose is to show them the brochure. Caught by the visual diff at P9 page two of the batch (the
grid differed by 104k pixels), not by any gate: SEO, fidelity and the behaviour tests all passed.

**Why it is a finding and not just a bug.** The tree holds `image` and `href` as **structural**
fields (`editor/lang.js STRUCTURAL`), i.e. deliberately not per-language, because a URL is not
copy. That is right for a product photo and wrong for a scan of a translated brochure. Today the
migrated page carries the `zh` values and the other six languages' scans are simply not carried —
the same accepted Chinese-only regression as finding 24, now covering **media and links**, not just
text.

**Where else it bites.** Checked during the batch: 有效成份檢測, 微信發表文章, 研究報告, 聯絡我們 and
典型病例 swap only the flag icon, so 小册子 is the only page in the batch affected. The remaining
pages (`index.html`, the six product pages, `product.html`) have not been checked yet — check each
before migrating it, the same way.

### Fix, Phase 14 (with per-language URLs)

Phase 14 already has to give every page a per-language URL. The same task should decide how a
**per-language asset** is modelled: either make `image` / `href` translatable for the sections that
need it (a language map like every text field), or keep one asset per language variant of the page.
Until then a migrated page is Chinese only, media included.

---

## 29 · 典型病例's ItemList JSON-LD contradicts its own page — background, carried as-is

**What.** The hand-coded 典型病例 carries an `ItemList` whose `numberOfItems` is **15** while its
`itemListElement` holds **3**, and whose entries are typed **`Testimonial`** — not a schema.org
type, so a consumer sees an untyped blob. The three entries name real patients and attach treatment
outcomes to them, in machine-readable form.

**Status: carried verbatim into the page tree, not corrected, not derived.** Site content is not
authoritative (owner, 15 Sep 2026) and the migration's job was to change nothing a visitor sees, so
the node publishes exactly as it does today. Deriving it from `data/cases.json` — the FAQPage
treatment — would have made the structured data *more* complete, which for patient identities is a
decision for the owner and the client, not a migration step.

**Related, not the same:** finding 26 is fabricated five-star *product reviews* carrying patient
identities, and is a live legal/privacy matter. This is the cases page's own content, described
badly. Both concern patient identities in structured data; both are the owner's to settle with the
client.

### If the owner wants it fixed

- correct it (15 entries, a real type, or drop the node), or
- derive it from `data/cases.json` so it cannot go stale — the rule `renderer/render.js faqPageNode`
  already applies to FAQPage, and `test:seo` check 7 is the model for gating it.

---

## 30 · 產品_雲芝糖肽精華_A publishes the WRONG product's title, from its own script — fixed by migrating it

**What.** The trial-pack page's static `<title>` is right:

```
雲芝糖肽精華 (PSP) 試用裝 | Wonder Herb – 天然雲芝糖肽專家
```

and its own script then overwrites it with the STANDARD pack's:

```
document.title = ({ zh: '雲芝糖肽精華 (PSP) 標準裝 | Wonder Herb – 天然雲芝糖肽專家', … })
```

So every visitor sees 標準裝 in the tab, and any crawler that executes JavaScript indexes the trial
pack's page under the standard pack's title — two pages competing for one title, on the page that
sells the cheaper product. A copy-paste bug: checked all six product pages, the other five set the
same title their markup already has.

**How established.** Compared each page's static `<title>` with the string its script assigns. Also
visible in `baseline/head/產品_雲芝糖肽精華_A.html`, which was captured with scripts on and therefore
records 標準裝, while the page's own file says 試用裝.

**Fixed by the migration, not by an edit.** A pre-rendered page has no script to overwrite anything:
it publishes the `<title>` in its tree, which was lifted from the page's own markup — the correct
one. Nothing was changed by hand.

**The gate had to learn the difference.** `test:seo` compared the rendered title against the
baseline, so the correct title failed against a baseline recording the bug. The check now compares
against the page it replaces and accepts either the baseline's title or the ORIGINAL page's own
`<title>`, **printing the disagreement when there is one**. Matching neither still fails, so a title
lost in migration is still caught.

### Still to do

- Nothing on this branch. Worth telling the client: the trial-pack page had the wrong title in
  search results and in the browser tab, and the migration corrects it.

---

## 31 · PT3 is clinic-only on its page and sellable in the data — the site now sells it

**What.** `產品_PT3.html` states, in markup, that the product is not sold online: a clinic note and a
disabled "無庫存 (診所專供)" button. `data/products.json` disagrees — `WH-PT3-090` is `"status": "In
Stock"` at `HK$2,480` with **no `clinicOnly` flag**, and the cart's refusal rule
(`assets/site.js`) keys on exactly that flag.

**Consequence, live on this branch since page one:** the migrated 產品介紹 grid accepts PT3 into the
cart, and since 16 Sep the migrated 產品_PT3 panel offers a quantity box and an add button. A visitor
can buy, at HK$2,480, a product whose own page says it is only available through clinics.

**Why it is this way, deliberately.** Site content is not authoritative (owner, 15 Sep 2026) and the
panel derives availability from the data rather than carrying the page's markup (owner, 16 Sep
2026) — otherwise the page would keep saying "clinic only" after the flag changed, which is the
class of bug findings 19 and 23 came from. So the disagreement is now visible and in one place
instead of hidden in two.

**The fix is one data edit, and it is the owner's.** Setting `clinicOnly: true` on `WH-PT3-090`
restores the page's position everywhere at once — the detail panel renders the clinic note and the
disabled button, the grid shows its ribbon, and the cart refuses with the approved message. Nothing
in code needs to change; `test:behaviour` already covers both states.

### Not established

- Which is right. The product's own title says 指定診所發售, and the clinic note has been on the page
  since before this project; but the price and stock in the database look deliberate too. That is a
  question for the client, like the disputed prices in finding 9.
