# FINDINGS.md — known issues, and the phase that fixes each

Findings 1–5 come from recording the Phase 0 baseline (`node scripts/baseline.js`); finding 6 from
adding the Phase 1 toolchain; 7 from adding the page routes at P2-T1; 8–11 from building the
section library at P4-T2; 12–13 from actually looking at the rendered sections at P4-T3; 14 from the
fidelity waivers at P4-T4; 15 from rendering a real page end to end at P5-T1.
8–10 September 2026.
**Nothing here is fixed.** Each is logged against the phase that owns it, so it gets fixed in the
right place rather than opportunistically. Do not fix these out of their phase.

Evidence for all of them is in `baseline/manifest.json` (gitignored) — per page: rendered text
length, image load counts, JSON-LD blocks, `<h1>` count and failed requests.

| # | Finding | Severity | Fixed in |
|---|---|---|---|
| 1 | Homepage background video hosted on the client's Wix CDN | High — breaks at cutover | Phase 10 |
| 2 | Product photos hotlinked from Google Drive, and rate-limited | High | Phase 10 |
| 3 | `購物車.html` has no `<h1>` — will fail the SEO gate | Medium — needs a decision | Phase 6 |
| 4 | All 18 pages overflow horizontally on a 390px viewport | Low | Phase 9 / 13 |
| 5 | `<img src="">` placeholder fires a spurious request | Cosmetic | Phase 13 |
| 6 | Pages deploys the whole repo, so editor source and build output ship publicly | Medium | Phase 8 |
| 7 | `/api/inventory.csv` drops the reorder point for untracked products | Medium | Phase 12 |
| 8 | `products.json` has no `image` or `link` — **hard blocker for Phase 9** | **High** | Phase 9 (blocking) |
| 9 | The data and the live site disagree on two product prices | **Client decision** | Raise with client |
| 10 | `faq-accordion` is a static list, not an accordion | Client decision | Client, if ever |
| 11 | No text+image block exists; the P4-T2 section list was wrong | Resolved | Closed at P4-T2 |
| 12 | Pre-rendered pages publish **visually blank** without the reveal script | **High — passes green, looks broken** | Phase 5 (P5-T1 template) |
| 13 | Sections silently dropped markup from their source blocks | Resolved | Closed at P4-T4 |
| 14 | Body copy uses **bold, lists and links**; plain-text fields drop them | Decided — option (c) | P4-T5 |
| 15 | Chrome's layout depends on JS, and there is no shared stylesheet | Medium — partly handled | P5-T1 / Phase 9 |

---

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

## 3 · `購物車.html` has no `<h1>` and will fail the Phase 6 SEO gate

**What.** The cart page renders **zero `<h1>` elements** and carries **no JSON-LD**. Its
`<title>`, `<meta name="description">` and `<link rel="canonical">` are all present and correct:

```
title      : "購物車 | Wonder Herb – 雲芝糖肽精華"
description: present
canonical  : present
h1 count   : 0
```

**Where.** `購物車.html`; evidence in `baseline/head/購物車.html` and the manifest row.

**Why it matters.** BUILD_TASKS P6-T1 asserts **exactly one `<h1>` per page** and treats the SEO
check as a gate, not a report — so as written, this page cannot publish. It is the only page of the
18 in this state.

**Decision needed at Phase 6 — do not guess:**
- **(a)** Give the cart a visible `<h1>` (e.g. 購物車). Simplest, and arguably a real accessibility
  improvement, but it changes the visible page against the baseline.
- **(b)** Exempt utility pages (cart, account) from the `<h1>` and JSON-LD assertions, with an
  explicit allow-list in `scripts/test-seo.js` so the exemption is visible and deliberate.

Recommendation: **(b)** — a cart is a transactional page, not a document. It also has no business
carrying JSON-LD. But an exemption list is a hole in a gate, so it must be explicit and small, and
the project owner should choose. `account.html` is in the same category (also 0 JSON-LD) and should
be decided at the same time.

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

- **42 are a bold lead-in label** — `<li><strong>超強抗氧化：</strong> 比一般合成維生素E高出60倍…`
- 6 are bold mid-sentence — `…由<strong>澳洲昆士蘭科技大學前列腺頑疾研究中心</strong>進行臨床研究…`
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

Both were confirmed by the project owner at P5-T1 review. They are decisions to be **made**, not
notes to be remembered, and neither is optional.

**D1 · Triage the per-page inline chrome script.** Each page carries roughly 500 lines of inline
JavaScript that the chrome depends on. At Phase 9 every behaviour in it gets sorted into exactly one
of three buckets, and the sorting is recorded:

| Bucket | Meaning | Action |
|---|---|---|
| Load-bearing layout | the page is wrong without it, at any moment | needs a **pre-render-safe equivalent** — CSS, not JS |
| Genuine enhancement | the page is correct without it, just less nice | keep as progressive JS |
| Dies with pre-rendering | only exists because content arrives client-side | drop |

The **nav offset is the first load-bearing case**, and it is the one that shows why the bucket
matters: `NAV_OFFSET_SCRIPT` fixes it with scripts on, and **scripts-off cannot be fixed at
runtime** — the nav height has to become a known value in CSS. Expect the same shape from anything
else that lands in this bucket. Cart badge, mobile menu and the language switch are the obvious
candidates for the other two buckets (the language switch becomes plain links and dies).

**D2 · Extract a shared stylesheet. This is a Phase 9 precondition, not an optional cleanup.**
Pages built from sections cannot each carry a private copy of their own CSS — that is what makes
`<link rel="stylesheet">` in the template mean anything, and it is why the P5-T1 proof page is 47 KB
of which 27 KB is lifted CSS. Until it is done, `assets.stylesFrom` stays, and **the `!` warning
that `renderer/render.js` prints on every lift stays with it**, so the stopgap cannot go quiet and
become permanent.
