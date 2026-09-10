# FINDINGS.md — known issues, and the phase that fixes each

Issues found while recording the Phase 0 baseline (`node scripts/baseline.js`, 8–10 September 2026).
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

**Do not cancel Wix until this is done.** Add a check at Phase 18: `grep -rn "wixstatic" *.html`
must return nothing.

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
