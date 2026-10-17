# Design brief: Wonder Herb Admin and Website Manager

**Client:** 康草堂 Wonder Herb Health Products Ltd., Hong Kong
**Product:** One admin site where the client runs the business and edits the public website
**Purpose of this brief:** Get front-end designs for the finished product so we can confirm direction before building the rest.
**Status:** The back end, the page editor engine and most business tools already exist and work. They are functional but visually unfinished, and they are currently two separate apps. This brief describes the **finished, unified product**.

---

## 1. The product in one paragraph

Wonder Herb sells natural health supplements (Yunzhi PSP, T3, PT3 and others) in Hong Kong. Their website used to run on Wix. We are replacing Wix with their own system: a fast public website plus a private admin. In the admin, staff sign in once and can do two kinds of work from one left-hand menu: **run the business** (products, stock, invoices, customers, users) and **edit the website** (a Wix-like visual page editor). The public site stays exactly as it looks today. The admin is the thing being designed.

---

## 2. Who uses it

| User | What they do | What they need from the design |
|---|---|---|
| **Owner / admin** (1 to 2 people) | Edits pages, sets prices, publishes the site, manages staff | Confidence nothing will break. Clear "what goes live and when". |
| **Staff** (a few) | Updates stock, records invoices, answers enquiries | Fast, simple forms. Only sees modules they are allowed to use. |

Important facts about these users:

- **Not technical.** They came from Wix. They know "add section", "preview", "publish". They do not know "deploy", "JSON" or "render".
- **Chinese first.** They read Traditional Chinese (Hong Kong) and type through a Chinese input method (IME). English is second.
- **They edit weekly, not daily.** They will forget where things are between visits. Navigation must be obvious every time.
- **They are nervous about breaking the live site.** The design must make safety visible: drafts, preview, undo, version history.

---

## 3. Scope: every screen to design

### 3.1 App shell (shared by every screen)

- **Left sidebar navigation**, grouped:
  - **Overview:** Dashboard
  - **Business:** Products, Inventory, Sales (invoices), Customers, Enquiries
  - **Content:** Cases (patient case studies), FAQ, Homepage text
  - **Website:** Edit site (opens the page editor), Media library, Version history
  - **Admin:** Users and permissions, Site settings
- Each item shows a count badge where useful (e.g. unread enquiries, low-stock items).
- Items a staff member has no permission for are **hidden**, not greyed out.
- **Top bar:** Wonder Herb logo, a site status indicator (see 3.2), the **admin language switch (中 / EN)**, the signed-in user, sign out.
- Admin UI language (the buttons and labels) is **separate** from content language (which language of the website you are editing). Both exist; they must never be confused. See section 5.

### 3.2 Site status indicator (always visible in top bar)

A small, persistent indicator that answers "is what I changed live yet?":

- **Up to date:** everything published.
- **Unpublished changes (n):** click to see the list (e.g. "PSP 500 stock changed", "About page edited") and a **Publish** button.
- **Publishing…:** progress.
- **Publish stopped:** a problem blocked it; click for the reason.

This matters because **stock and price changes go live only when you publish, not instantly.** Users must see this without reading a manual.

### 3.3 Dashboard

- Unpublished changes (same list as 3.2)
- Low stock: products at or below their reorder point
- Unpaid invoices: count and total in HKD
- New enquiries from the contact form
- Recent activity: "Ankur changed PT3 price", "Staff member added invoice #1042" (who, what, when)
- Last published: time, and whether all pages passed their checks
- Quick actions: Add product, Record invoice, Edit homepage

### 3.4 Products (catalogue)

**List view:** product photo, name, SKU, price (HKD), stock status, flags (Clinic only, Price on hold), last edited. Search and filter by category and status.

**Edit view:** the most important business form. Fields:

- **Name** and **Description**, per language (see section 5)
- **SKU** (read-only once set; it is the product's permanent identity)
- **Price (HKD):** a single number. Shown formatted per language on the site.
- **Price note** per language (e.g. 僅限診所 / "Clinic only")
- **Stock status:** In stock / Out of stock
- **Stock count** and **Reorder point**
- **Clinic only:** toggle. When on, the site shows the product but visitors cannot add it to the cart.
- **Ribbon** per language: the corner badge on the product card (e.g. "GMP certified")
- **Badges / certifications:** chips
- **Photo:** chosen from the Media library
- **3D model** (optional): chosen from the Media library
- **Detail page link**
- Footer note: "Changes go live when you publish."

**Design requirement:** the form must never delete information it does not show. If a field exists in the data but not on this screen, it survives a save. (This is an engineering rule, but it means the design should not suggest "Save replaces everything".)

### 3.5 Inventory

- Table of all products with stock count, reorder point, status
- Inline editing of stock counts (fast, keyboard-friendly, for staff doing a stock take)
- Movement log: every stock change with who, when, and quantity
- Low-stock highlight
- Export to spreadsheet

### 3.6 Sales (invoices)

Already exists; needs to fit the new design.

- Invoice list: number, customer, date, total (HKD), **Paid / Unpaid** status
- Invoice detail and "Record invoice" form (staff-entered; there is no online checkout)
- Filters by month, status, customer
- Download sales workbook (Excel)

### 3.7 Customers

- Customer list linked to their invoices
- Customer detail: contact info, invoice history, notes

### 3.8 Enquiries (contact form submissions)

- Inbox of messages sent from the website's contact form
- Read / unread, mark as handled, reply via WhatsApp or email link
- Empty state: "No enquiries yet. Messages from your website's contact form appear here."

### 3.9 Cases (patient case studies)

- List and edit form for case studies shown on the 典型病例 page
- Fields: title, patient summary, condition category, story text, outcome, per language
- Category filter matches the site's filter

### 3.10 FAQ

- Ordered list of questions and answers, per language
- Drag to reorder (reordering items in a list is fine; this is not page layout)
- Category per question
- Answers support a **bold lead-in label** (e.g. **Dosage:** Take two capsules…) and **bullet lists**. There is no free rich-text toolbar. See 4.6.

### 3.11 Homepage text

- The short text blocks on the homepage that are not part of page layout (e.g. company intro, stats)
- Simple form, per language

### 3.12 Edit site (the page editor)

**This is the centrepiece and the main reason for this brief.** Full description in section 4.

### 3.13 Media library

- Grid of all images, 3D models, videos and PDFs
- Upload (drag and drop or browse), with progress
- Filter by type, search by name, sort by date
- Detail panel: preview, file size, dimensions, **alt text per language**, where it is used ("Used on 3 pages")
- Replace a file (everywhere it is used updates)
- Delete, with a warning if it is still used
- Used as a **picker** from the page editor and the product form
- Upload rules shown plainly: accepted types, size limit, "Large photos are resized automatically"

### 3.14 Version history

- A timeline of every publish: date, time, who, summary of what changed
- Preview any past version
- **Restore** a past version (with a confirm step that says exactly what will change)
- This is the main safety net. It should feel reassuring, not technical. Never show commit hashes or code.

### 3.15 Missing translations

- A view listing every field that has Chinese content but is missing another language
- Grouped by page and by language
- Click a row to jump straight to that field in the editor
- A progress bar per language ("English: 82% translated")

### 3.16 Users and permissions

- User list: name, email, role, last active
- Roles: **Admin** (everything) and **Staff** (per-module permissions)
- Per module, a staff member can have **None / View / Edit**. Modules: Cases, Products, Inventory, FAQ, Homepage, Sales.
- Separate permissions for website editing: **Edit pages**, **Delete pages**, **Edit SEO settings**, **Publish**. Admins decide who gets these.
- One protected owner account that cannot be deleted or demoted (show a lock).

### 3.17 Site settings (admins only)

- Site title and description per language
- Social share image
- Favicon
- Contact details used across the site (phone, WhatsApp, email, address)
- Languages enabled on the site

### 3.18 Sign in

- Email and password, "Forgot password"
- Bilingual
- Clear error on wrong password, and a clear message after too many attempts

---

## 4. The page editor in detail

### 4.1 Layout (Wix-familiar on purpose)

```
+--------------------------------------------------------------------------------+
| Page: [產品介紹 v]   Editing language: [中文 (primary) v]    Undo Redo  Preview  Publish |
| Status line: "Editing Chinese, the primary language"                            |
+-------------+----------------------------------------------+-------------------+
| ADD         |                                              | SETTINGS           |
|  Hero       |                                              | for the selected   |
|  Text block |        CANVAS                                |  block             |
|  Product    |        the real page, styled like            |                    |
|   grid      |        the live site                         |  Heading           |
|  Gallery    |                                              |  Subheading        |
|  FAQ list   |        click a block to select it            |  Layout: [Centred] |
|  ...        |                                              |                    |
|             |                                              |                    |
| PAGE        |    [ Desktop | Tablet | Mobile ] preview      |                    |
|  outline    |                                              |                    |
+-------------+----------------------------------------------+-------------------+
```

- **Left:** "Add" panel (blocks to add) and a "Page outline" tab (list of blocks on this page, reorderable).
- **Centre:** the real page, **styled like the live site**. Device toggle: desktop, tablet, mobile.
- **Right:** settings for whatever is selected. When nothing is selected, it shows page settings (page title, description).
- **Top:** page picker, content-language picker, undo, redo, Preview, Publish.

### 4.2 What users can and cannot do

**Can:**
- Add a block from the library
- Move a block up or down
- Duplicate a block
- Delete a block
- Edit a block's text and pictures
- Choose a layout variant for a block (2 to 5 fixed options)
- Add a new page from a template
- Rename, reorder, or hide pages

**Cannot, by design:**
- Drag an element to any pixel position. There is **no free-form positioning**. This was a deliberate choice: free dragging is the main way Wix sites break, especially on phones.
- Change fonts, colours or spacing per block. The site's style is fixed.

When a block is selected, show a small toolbar on the block: **Move up, Move down, Duplicate, Delete.**

### 4.3 The block library (15 types)

Design the "Add" panel with a small thumbnail per block. Grouped:

| Group | Blocks |
|---|---|
| **Headers** | Page header (centred, or with background video), Hero (big homepage banner with carousel) |
| **Text** | Text block (glass card, plain card, intro), Callout (highlighted note, info box, video box, quality highlight) |
| **Products** | Product grid, Product carousel, Product detail, Related products |
| **Media** | Gallery, Map |
| **Lists** | Card grid (brochures, reports, articles, icons, trust badges, link list), FAQ list, Case list (with filters) |
| **Actions** | Call-to-action band (banner, button, video band), Contact cards |

### 4.4 Blocks that show catalogue data

Product grid, Product carousel, Product detail, Related products, FAQ list and Case list show content from the business modules, not text typed into the block.

The settings panel for these blocks must say so clearly, e.g.:

> **Products come from your catalogue.**
> To change a name, price or photo, edit it in Products.
> [Open Products]

The block settings only control things like labels ("Quick view" button text) and which products or category to show. This keeps one source of truth. Design this "linked data" state so it does not look like a bug or an empty form.

### 4.5 Content language editing (critical)

The site has **7 languages**: 繁體中文 (primary), English, Deutsch, Español, Français, 日本語, Русский.

- The **content-language picker** in the top bar chooses which language you are editing.
- The canvas shows the page in that language.
- The status line changes with it:
  - Chinese: "Editing Chinese, the primary language"
  - Other: "Editing English. Empty fields are untranslated and will show Chinese on the site. Saving cannot change the Chinese."
- A field with no translation should look **clearly different** from a field that is intentionally blank (e.g. show the Chinese as a faint hint, with a "Not translated" tag).
- After saving: "Saved English. Other languages unchanged."
- Link from here to the Missing translations view (3.15).

This is the feature the client is most anxious about. The design must make it obvious that editing one language can never damage another.

### 4.6 Text editing rules

- Plain text fields, not a free rich-text toolbar. Reason: Chinese input methods and formatting toolbars fight each other, and free formatting breaks the site's consistency.
- Two structured formats are supported:
  - **Bold lead-in label:** a short bold label then normal text. Show it as two inputs: "Label" and "Text".
  - **Bullet list:** add, remove and reorder bullet items.
- Also a toggle to make a whole paragraph **emphasised (bold)**.

### 4.7 Preview and Publish

- **Preview** opens the page exactly as it will look when published, in a new tab.
- **Publish** shows a short sequence the user can follow:
  1. Saving your changes
  2. Building the pages
  3. Checking every page for search engines
  4. Published
- **If a check fails**, publishing stops and nothing goes live. Show:
  - What happened, in plain words ("The Products page lost its FAQ information for Google.")
  - Which page
  - What to do ("Undo your last change to this page, or ask your developer.")
  - Reassurance: "Your live site has not changed."
- After success: "Published. Your site is updated." with a link to view it and to Version history.

### 4.8 Pages list

- All pages with title, last edited, last published, and status (Published / Unpublished changes / Hidden)
- A few pages (Cart, Account, Product lookup) are **not editable in the page editor**. Show them with a lock and the note "This page is managed by the system."
- Add page from template

---

## 5. The two language switches (do not confuse them)

| | Admin UI language | Content language |
|---|---|---|
| What it changes | The admin's own buttons and labels | Which language of the website you are editing |
| Where | Top bar, next to the user menu | Page editor top bar, and on multi-language fields in forms |
| Options | 中 / EN | 7 site languages |
| Remembered | Per user | Per session |

Design them to look different. A user must never switch the website's language when they meant to switch the admin's, or the other way round.

---

## 6. Business rules the design must express

| Rule | How it should show |
|---|---|
| Stock and price changes go live only at publish | Site status indicator (3.2), "Changes go live when you publish" notes |
| A product can be **Clinic only** | Toggle in Products; a clear tag in lists; on the site it shows but cannot be added to the cart |
| A product's price can be **on hold** | Tag "Price on hold" in lists; on the site the product cannot be added to the cart |
| SKU is permanent identity | SKU field read-only after creation, with a lock icon and a short explanation |
| Staff only see modules they are allowed to use | Hidden menu items, no disabled clutter |
| Only admins edit SEO settings and delete pages | Those controls absent for staff |
| Every publish can be undone | "Restore" in Version history; mention it in the publish success message |

---

## 7. States to design (for every main screen)

- **Empty:** first-time, no data yet. Always an invitation to act ("Add your first product").
- **Loading:** skeletons, not spinners, for lists.
- **Error:** says what failed and what to do. Never vague, never apologising.
- **Unsaved changes:** a clear indicator, and a warning if the user tries to leave.
- **Saving / saved:** brief confirmation using the same verb as the button ("Save" then "Saved").
- **Offline / server unreachable:** "Can't reach the server. Your live website is not affected. Try again in a moment."
- **No permission:** only if a user reaches a page by link; normally hidden.

---

## 8. Visual direction

### 8.1 Brand grounding

Wonder Herb is a **Hong Kong natural health brand**: herbal extracts, GMP-certified manufacturing in Canada, university research, case studies of recovery. The feeling is **trustworthy, calm, clinical but warm**. Not spa, not pharmacy-cold, not tech-startup.

### 8.2 Colours to take from the live site

Sample exact values from **www.wonder-herb.com**. Approximate references:

- **Teal:** the site's top bar and primary buttons (the "Consult" / 諮詢專員 button)
- **Maroon / deep red:** the logo, prices, product ribbons
- **White:** page backgrounds
- **Dark charcoal:** body text

The admin should feel like **the same brand** as the public site, but calmer: an admin is a workplace, so the colour should support the work, not compete with it. Use the maroon sparingly (brand mark, prices). Use teal for primary actions.

### 8.3 Typography

- The live site uses **Playfair Display** (headings) and **Inter** (body), with system Chinese fonts.
- The admin needs excellent **Traditional Chinese** rendering at small sizes. Choose a Chinese stack deliberately (e.g. Noto Sans TC / PingFang HK), and make sure Chinese and Latin sit well together at equal visual weight.
- Admin screens are dense; prioritise legibility of tables and forms over display flair.

### 8.4 Layout

- Editor: desktop first, minimum 1280 px wide.
- Business screens (Products, Inventory, Invoices, Enquiries): must work on **tablet and phone**, because staff will update stock from a phone.
- Tables collapse to cards on small screens.

### 8.5 Please avoid

- Generic SaaS dashboard look (identical rounded cards with the same soft shadow everywhere, gradient decoration)
- All-caps tracked-out labels above every heading
- Dark mode as the default
- Any visual that suggests free-form drag-and-drop positioning
- Icons from a pre-release or beta icon set (the current site uses a beta Font Awesome; do not copy that)

### 8.6 Accessibility

- WCAG 2.1 AA contrast
- Visible keyboard focus everywhere
- Full keyboard use of the editor (select block, move, duplicate, delete)
- Respect reduced motion
- Screen-reader labels in the current admin language

---

## 9. Vocabulary (use these words, in both languages)

Use Wix-familiar, plain words. Never "deploy", "render", "commit", "JSON", "tree", "section type".

| English | 中文 |
|---|---|
| Dashboard | 儀表板 |
| Products | 產品 |
| Inventory | 庫存 |
| Sales / Invoices | 銷售 / 發票 |
| Customers | 客戶 |
| Enquiries | 查詢 |
| Cases | 典型病例 |
| FAQ | 常見問題 |
| Homepage text | 首頁文字 |
| Edit site | 編輯網站 |
| Media library | 媒體庫 |
| Version history | 版本記錄 |
| Missing translations | 待翻譯內容 |
| Users and permissions | 用戶與權限 |
| Site settings | 網站設定 |
| Add block | 加入區塊 |
| Preview | 預覽 |
| Publish / Published | 發佈 / 已發佈 |
| Unpublished changes | 未發佈的更改 |
| Restore | 還原 |
| Clinic only | 僅限診所 |
| Price on hold | 價格待定 |
| In stock / Out of stock | 有貨 / 缺貨 |

Please have the Chinese labels checked by a native Hong Kong reader before build.

---

## 10. Real content to use in mockups

Use real product names so the designs feel real:

| Product | SKU |
|---|---|
| 雲芝糖肽精華 PSP (標準裝 500粒) | WH-PSP-500 |
| 雲芝糖肽精華 PSP (試用裝 60粒) | WH-PSP-060 |
| T3 複合配方 (120粒) | WH-T3-120 |
| PT3 強化配方 (90粒), clinic only | WH-PT3-090 |
| 乙肝清 草本護肝膠囊 | WH-HB-180 |
| 憶活素 腦部保健膠囊 | WH-MB-060 |

- Currency: **HKD**, formatted `HK$3,800.00`
- Site pages include: 首頁, 產品介紹, 研究報告, 成份檢測, 典型病例, 小册子, 文章, 常見問題, 聯絡我們, and six product pages
- **Do not invent** customer reviews, star ratings, testimonials or health claims in any mockup. Use neutral placeholder text for those.

---

## 11. What to deliver, in priority order

1. **App shell + Dashboard** (with the site status indicator)
2. **Page editor** in its main state: a real page loaded, one block selected, settings visible
3. **Page editor, language states:** editing Chinese; editing English with untranslated fields; the "Saved English, other languages unchanged" confirmation
4. **Publish flow:** progress, success, and the "publish stopped" failure
5. **Linked-data block** (Product grid selected, settings pointing to Products)
6. **Product edit form** (desktop and phone)
7. **Media library** (grid, upload in progress, detail panel, picker mode)
8. **Version history** with restore confirmation
9. **Missing translations** view
10. **Users and permissions**
11. **Inventory** on a phone
12. **Empty, error and offline states** for at least Products and Enquiries
13. **Sign in**

For each: desktop first, plus phone where section 8.4 says it matters.

---

## 12. Out of scope (do not design)

- The public website itself (it stays as it is)
- Online checkout and payments (invoices are staff-entered)
- Free-form drag-and-drop page building
- An app store or plugin system
- Email marketing
- Multi-site support

---

## 13. Questions the design should help us answer

- Does the site status indicator make "not live until published" obvious enough?
- Can a Chinese-first user tell the two language switches apart at a glance?
- Does the linked-data state (4.4) feel natural, or like a dead end?
- Does the editor feel as familiar as Wix to someone who used Wix for years?
- Is the publish failure message calm and actionable for a non-technical owner?
