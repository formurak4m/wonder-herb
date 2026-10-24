# Turning the admin into a Wix-like editor for wonder-herb.com

**Status:** plan only, nothing built yet. Written 4 September 2026.

This answers four questions:

1. What does the client actually use in Wix, and which parts do we need?
2. How would our admin become that, and how does it connect to the live site?
3. What do we need to *run* it: a VPS, a database, what else, and why?
4. What is the architecture of the finished product, and how long does it take?

---

## 0. One thing to say plainly, once

A literal 1-to-1 copy of Wix is not a project, it is a company. Wix is a
public company with thousands of staff; the editor alone has been built and
rebuilt over fifteen years, and it sits on a rendering engine, an app market,
a media pipeline and a hosting platform. Nobody clones that.

The good news is that **the client does not need Wix. They need to feel at
home.** What they actually do in Wix each week is a small, well-defined set of
things: change a headline, swap a photo, add a section, add a product, mark an
order paid, publish. That set is buildable, and once it is built the client
cannot tell the difference in daily use, because their daily use never leaves
those screens.

So the goal in this plan is: **the parts of Wix they use, at the same quality,
on our own stack** - not a clone of the whole product. Everywhere below, where
a Wix feature is out of scope, it says so and why.

Worth knowing: their old site *was* on Wix. Seven images and two videos on the
current pages are still served from `static.wixstatic.com`. So the familiarity
is real and recent.

---

## 1. What Wix actually is, split in two

Wix is two separate products behind one login. Our admin needs both halves,
and we already have a good start on the second one.

### Half A - the Editor (what the site looks like)

| Wix feature | What it does | Do we have it? |
|---|---|---|
| Canvas with the real page | You see the actual site while editing | No |
| Sections | Page is a stack of sections you add, reorder, duplicate, delete | No |
| Add panel | Left panel: text, image, button, gallery, video, strip, form | No |
| Inline text editing | Click a heading, type, it changes | No |
| Element settings panel | Right panel: the selected thing's fields, colour, spacing, link | No |
| Media manager | Upload, keep and reuse images and video | No |
| Pages menu | Add/rename/reorder/hide pages, set the home page | No |
| Mobile editor | A separate mobile view you can adjust | No |
| Preview / Publish | See it before it is live; publish when ready | Partly (`npm run export`) |
| Site history | Roll back to an earlier version | No |
| Site settings & SEO | Title, description, social image, favicon, redirects | No |
| Multilingual | The same page in several languages | Partly (7 languages, hand-coded) |
| App market | Bookings, chat, forms, reviews as installable apps | **Out of scope** |
| Free-form drag anywhere | Absolute positioning of any element | **Deliberately out of scope - see 3.3** |

### Half B - the Dashboard (running the business)

Wix's dashboard is grouped as Home, Sales, Getting Paid, Customers & Leads,
Apps, Site & Mobile App, Settings.

| Wix area | What it does | Do we have it? |
|---|---|---|
| Home | Overview: sessions, submissions, sales | **Yes** - Dashboard module |
| Catalog / products | Product list, prices, images, stock | **Yes** - Products + Inventory |
| Sales / orders | Orders, status, refunds | **Partly** - Sales invoices (staff-entered) |
| Getting Paid / invoices | Send invoices, track paid/unpaid | **Yes** - invoices, unpaid flag |
| Customers & Leads | Contacts, segments, form submissions | **Partly** - sales customers only |
| Roles & permissions | Who may do what | **Yes** - admin / staff ticks / member |
| Settings | Business info, language, domains | Partly |
| Analytics | Traffic and sales reporting | No |
| Marketing / email campaigns | Newsletters, automations | **Out of scope** |

**Read that table again, because it is the good news:** the business half is
roughly 60% done already. The work in front of us is mostly Half A.

---

## 2. The real obstacle, in one paragraph

Our site is 18 hand-written HTML files, about 49,000 lines, each one carrying
its own CSS and JavaScript, with the words baked into the markup and a
`translations` object per page holding 204 unique text keys across seven
languages. **You cannot visually edit hard-coded HTML and still have it be
hard-coded.** For "every single thing on the site is editable" to be true, a
page has to stop being a file somebody typed and become *data* that a template
turns into a file. That conversion - not the drag-and-drop - is the bulk of
this project. It is also the thing that makes everything afterwards easy.

---

## 3. How it will work

### 3.1 The shape of it

```
                     ADMIN (browser)
   +-------------------------------------------------+
   |  top bar: site picker | Preview | Publish | EN/中 |
   +-----------+-------------------------+-----------+
   | Add       |                         | Settings  |
   | Pages     |   CANVAS  (iframe)      | panel for |
   | Media     |   the real page,        | whatever  |
   | Sections  |   click to edit         | is picked |
   | Layers    |                         |           |
   +-----------+-------------------------+-----------+
                          |  postMessage
                          v
   +-------------------------------------------------+
   |  API (Node/Express)   auth, privileges, publish  |
   +-------------------------------------------------+
        |                    |                   |
        v                    v                   v
   +---------+        +-------------+     +-------------+
   | MongoDB |        | media store |     |  renderer   |
   | pages,  |        | R2/S3 + CDN |     | tree -> HTML|
   | products|        | images,video|     +------+------+
   | orders, |        +-------------+            |
   | users   |                                   v
   +---------+                          +--------------------+
                                        | published static   |
                                        | site (as today)    |
                                        | www.wonder-herb.com|
                                        +--------------------+
```

The important property: **the public site stays static HTML**. Visitors and
Google get plain files exactly as now, so the SEO/GEO work in
`PROJECT_STATUS.md` survives untouched. The editor is a private tool that
*produces* those files. This is the single biggest design decision in the plan
and it is worth defending: it keeps the site fast, keeps hosting nearly free,
and means a broken admin can never take the site down.

### 3.2 A page becomes a tree

Today: `產品介紹.html` is 2,324 lines of typed markup.

Tomorrow, in MongoDB:

```json
{ "slug": "products", "title": { "zh": "產品介紹", "en": "Products" },
  "seo": { "description": {...}, "image": "..." },
  "sections": [
    { "type": "page-header", "id": "s1",
      "fields": { "heading": { "zh": "產品介紹", "en": "Our Products" },
                  "sub": { "zh": "...", "en": "..." } } },
    { "type": "product-grid", "id": "s2",
      "fields": { "source": "catalogue", "columns": 3, "showPrices": true } },
    { "type": "cta-band", "id": "s3", "fields": { ... } }
  ] }
```

Each `type` is a **section component** we write once, from the markup already
on the page, so the site looks identical after the migration. The editor can
then add, reorder, duplicate and delete sections, and edit the fields inside
them - and every text field is a per-language object, which is how "everything
editable, in seven languages" stops being a special case and becomes normal.

From the survey of the current pages, the section library needs roughly these
to cover the whole site:

`page-header` · `hero` · `text-block` · `text-and-image` · `feature-grid` ·
`product-carousel` · `product-grid` · `product-detail` · `case-list` ·
`case-detail` · `faq-accordion` · `research-list` · `report-list` ·
`article-list` · `brochure` · `contact-cards` · `map` · `cta-band` ·
`testimonials` · `video` · `gallery` · `spacer/divider`

About 22 components. That is a knowable amount of work, and it is the honest
unit of estimation for this project.

### 3.3 Sections, not free-form dragging - and why

Wix's classic editor lets you drag anything anywhere. It is also the single
biggest source of broken Wix sites: elements overlap, the mobile view falls
apart, and the owner cannot fix it. Wix themselves moved toward a
**section-based** model with a Quick Edit panel for exactly this reason.

Recommendation: **section-based editing with constrained choices** (pick a
layout variant, not arbitrary pixels). The client gets: add a section, move it
up, duplicate it, change its words and pictures, choose from 2-3 layouts.
They do not get: drag a heading 12px to the left and break the phone view.

If free-form positioning turns out to be a hard requirement, it can be added
later for specific sections, but it should be a deliberate decision, not the
default.

### 3.4 How the editing actually happens

The canvas is an `<iframe>` showing the real rendered page, with the editor
talking to it over `postMessage` - the same architecture the current
generation of visual editors uses (Sanity, Storyblok, Builder.io all work this
way).

- Page renders with `data-wh-section="<id>"` and `data-wh-field="<name>"`
  attributes on editable things.
- Hovering shows an outline; clicking selects and opens the right panel.
- Text fields are edited **in place** (`contenteditable`), so what they type is
  what they see.
- Images open the media library; picking one swaps it instantly.
- Every change goes into an in-memory document with **undo/redo**, and is
  auto-saved as a draft.
- **Preview** shows the draft at a private URL. **Publish** renders the whole
  site and deploys it.

### 3.5 Connecting the admin to the live site

```
edit -> draft saved in MongoDB -> Preview (private URL, instant)
                                     |
                                  Publish
                                     |
              renderer writes .html files + sitemap + JSON-LD
                                     |
                    deploy: git commit to main  (GitHub Pages, as now)
                            or rsync to the server
                                     |
                            www.wonder-herb.com
```

Publishing keeps a **version history**: every publish stores the page tree, so
"undo yesterday's mess" is one click. That is a Wix feature the client will
expect, and it is cheap once pages are data.

### 3.6 The EN / 中文 toggle in the admin

Two different things, and they should not be confused:

- **Admin UI language** - the buttons and labels of the admin itself. A toggle
  in the top bar, one dictionary file, every string keyed. Small: a few days,
  mostly translation work. The site already does exactly this pattern.
- **Content language** - which language of the *site* you are editing. A
  separate picker near the canvas: edit the Chinese version, switch to
  English, see what is missing. Wix calls this Multilingual.

Both are in the plan; they are different controls and belong in different
places on screen.

---

## 4. What we need to run it, and why

Today everything is on your laptop: MongoDB local, API local, admin opened at
`localhost:4000`. **The client cannot use any of it.** So hosting is required
the moment this becomes a real tool, independent of the Wix work.

| What | Why it is needed | Option | Rough cost/month |
|---|---|---|---|
| **A small server (VPS)** | The admin is now an application: sign-in, uploads, publishing. Static hosting cannot do that. | Hetzner / DigitalOcean / Vultr, 2 vCPU 4 GB | **$6-12** |
| **Database** | Pages, products, orders, customers, users. Already MongoDB. | On the same VPS, or MongoDB Atlas (free M0 for a start, shared ~$9) | **$0-9** |
| **Media storage + CDN** | Images and video must live somewhere permanent and fast. Today they are on Google Drive and leftover Wix URLs - fragile and not ours. | Cloudflare R2 (no egress fees) or S3 | **$0-2** at this size |
| **Static site hosting** | Serving the published site. | GitHub Pages (as now) or Cloudflare Pages - both free | **$0** |
| **Domain + SSL** | Already owned; SSL free via Cloudflare / Let's Encrypt | - | already paid |
| **Backups** | A client editing their own site *will* break something. Nightly DB dump + media copy, kept 30 days. | R2 bucket + cron | **~$1** |
| **Transactional email** | Password resets, order notifications | Resend / Brevo free tier | **$0** |
| **Uptime monitoring** | Know before the client does | UptimeRobot free | **$0** |
| **Staging environment** | Try changes without touching the live site | Second cheap VPS or same box, second port | **$0-6** |

**Realistic total: about $10-25 a month.** For comparison, Wix Business plans
run roughly $30-50/month per site, so this is not a cost increase.

Two non-money requirements that matter more than the bill:

- **Someone must own the server.** Patching, certificate renewal, watching
  disk space: budget 2-4 hours a month. If nobody will do that, use managed
  services (Render/Railway + Atlas) and pay roughly $25-60/month instead.
- **A second pair of eyes on publishing.** Once the client can publish, they
  can publish a mistake. Version history plus staging is the answer.

### What we do *not* need

- Kubernetes, containers, a CDN contract, or a load balancer. This is a
  brochure site with a shop. One small box is plenty for years.
- A separate search service, message queue, or Redis - not at this size.
- Wix, Webflow or Shopify licences.

---

## 5. Three honest scopes, with timelines

Estimates assume one developer working steadily, and are effort, not promises.

### Option 1 - "Everything is editable" (4-6 weeks)

Every heading, paragraph, image, price and link on all 18 pages becomes
editable in the admin, in all seven languages. Layout is fixed: you can change
*what it says*, not *what order the blocks are in*. Media library included.

Gets you: the client can run the site's content without a developer.
Does not get you: adding a new section, building a new page.

### Option 2 - "Section builder" (3-4 months) - **recommended**

Everything in Option 1, plus the real editor: canvas, click-to-edit, add /
reorder / duplicate / delete sections from a library of ~22, new pages from
templates, preview, publish, version history, site settings and SEO panel,
mobile check, admin EN/中 toggle, and the dashboard rounded out to match Wix's
(contacts, orders, analytics basics).

Gets you: the client builds pages themselves, the way they did in Wix.
This is the sweet spot, and what the rest of this document plans for.

### Option 3 - "As close to Wix as is sane" (9-12+ months)

Everything above, plus free-form positioning, responsive breakpoint editing,
an app/plugin system, multi-site support, collaborative editing, an ADI-style
"build me a site" flow. Still not 1-to-1, and each item adds permanent
maintenance.

Not recommended unless the admin becomes a product you intend to sell.

---

## 6. Phase plan for Option 2

| # | Phase | What is delivered | Effort |
|---|---|---|---|
| 0 | Decisions & setup | This document agreed, hosting chosen, staging up | 1 week |
| 1 | Get it online | Server, database, media storage, deploy pipeline, backups. The admin we have today, usable by the client over the internet, safely. | 1-1.5 weeks |
| 2 | Media library | Upload, browse, pick, replace. Move the Google Drive and wixstatic images into it. | 1-1.5 weeks |
| 3 | Page model + renderer | Pages as trees; renderer produces byte-identical HTML for one page; publish pipeline writes files and deploys. | 2-3 weeks |
| 4 | Editor shell | Canvas iframe, selection, right panel, inline text editing, undo/redo, drafts, preview. One page fully editable. | 3-4 weeks |
| 5 | Section library | The ~22 components, built from existing markup, each with fields and 1-3 layout variants. | 3-4 weeks |
| 6 | Migrate the site | All 18 pages converted to trees, verified identical, old HTML retired. | 2-3 weeks |
| 7 | Multilingual editing | Language picker, per-language fields, "what is missing" view, all 7 languages. | 2 weeks |
| 8 | Pages, settings, history | Add/rename/reorder/hide pages, SEO panel, favicon/social, version history and rollback. | 2 weeks |
| 9 | Dashboard parity | Contacts/leads, orders view, analytics basics, tidy the existing modules to match. | 2-3 weeks |
| 10 | Admin EN/中 toggle | Every admin string keyed and translated. | 3-4 days |
| 11 | Hardening & handover | Full test sweep, performance, backups tested by restoring, written guide, training session with the client. | 2 weeks |

**Total: roughly 20-26 weeks (5-6 months) of steady work.**

Sensible checkpoints where the client sees something real:

- **End of Phase 1 (~2 weeks in):** they can log in from home and manage
  products, stock, invoices and users. Immediate value, before the editor
  exists.
- **End of Phase 4 (~2.5 months in):** they can edit a real page visually.
- **End of Phase 6 (~4 months in):** the whole site is theirs to edit.

---

## 7. Risks, and what we do about them

| Risk | Why it matters | What we do |
|---|---|---|
| The rewrite breaks the SEO/GEO work | It is the most valuable thing about the current site | Renderer must reproduce the existing HTML, JSON-LD, hreflang and canonicals exactly. Phase 3 ends with a byte-comparison test on every page. |
| "It doesn't feel like Wix" | The whole point is familiarity | Copy Wix's *vocabulary and layout* (Add panel left, settings right, Preview/Publish top right). Show the client Phase 4 early and adjust. |
| Client publishes something broken | They will, eventually | Preview before publish, version history, one-click rollback, nightly backups. |
| Scope creep toward Option 3 | Endless project, no delivery | This document is the scope. New features go on a list for after Phase 11. |
| Nobody maintains the server | Silent decay, then an outage | Decide the owner in Phase 0, or pay for managed hosting. |
| Media still on Google Drive | Those links can vanish | Phase 2 moves everything into storage we control. |
| Seven languages multiply the work | Every text field is 7 fields | Built into the model from day one, not bolted on. Untranslated falls back to Chinese. |

---

## 8. What I need from you before Phase 0 ends

1. **Which option** - 1, 2 or 3. (Recommended: 2.)
2. **Who owns the server** - you, me, or pay for managed hosting.
3. **Free-form dragging** - accept the section model (recommended), or is
   pixel-level placement a hard requirement from the client?
4. **How much can the client break?** Should they be able to delete a page or
   change SEO settings, or should those stay with an administrator?
5. **Does the shop need real online orders** (payment, checkout, order
   emails), or do invoices stay staff-entered as they are today?
6. **Any deadline** to work back from - a launch, a campaign, a client meeting.

---

## Sources

- [Wix Editor: Working with Elements](https://support.wix.com/en/article/wix-editor-working-with-elements)
- [Studio Editor: Adding and Managing Sections](https://support.wix.com/en/article/studio-editor-adding-and-managing-sections)
- [Wix Editor: Using the Quick Edit Panel with Sections](https://support.wix.com/en/article/wix-editor-using-the-quick-edit-panel-with-sections)
- [About Your Wix Dashboard](https://support.wix.com/en/article/about-your-wix-dashboard)
- [Wix eCommerce: manage orders and inventory](https://www.wix.com/ecommerce/manage)
- [Sanity: Visual editing architecture overview](https://www.sanity.io/docs/visual-editing/visual-editing-architecture)
- [Headless CMS with the best visual editing (2026)](https://prismic.io/blog/best-headless-cms-with-visual-editing)
- [GrapesJS vs Webflow vs Builder.io vs Puck (2026)](https://gjs.market/blogs/grapesjs-vs-webflow-vs-builderio-vs-puck-which-visual-builde)
- [Top 5 Page Builders for React in 2026](https://dev.to/fede_bonel_tozzi/top-5-page-builders-for-react-190g)
- [MongoDB pricing](https://www.mongodb.com/pricing) ·
  [Cloudflare R2 pricing](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/) ·
  [Best VPS providers 2026](https://hosting-atlas.com/blog/best-vps-hosting-providers-2026/)
