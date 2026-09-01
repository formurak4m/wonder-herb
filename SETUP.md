# Local database setup

The public site is **static** and stays that way. MongoDB is the place you
*edit*; `npm run export` writes the database back into `data/` so the site keeps
serving plain files. Nothing about hosting, the SEO work or the deploy changes.

```
   MongoDB (localhost:27017, db "wonderherb")
        |
   Node API (localhost:4000)      server/index.js
        |
   /admin   +   the site pages
        |
   npm run export  ->  data/*.json + data/inventory.csv  ->  git commit
```

## One-time

```bash
npm install
npm run seed      # loads data/*.json + data/inventory.csv into MongoDB
```

`seed` is safe to re-run: it replaces each collection with what is in `data/`.
Stock movements are kept.

## Every day

```bash
npm run dev                  # API on http://localhost:4000
python -m http.server 8747   # the site, as before
```

Then open <http://localhost:8747/admin/>. The chip in the top bar tells you
where data is coming from:

- **MongoDB connected** — every save goes into the database. A second tab, or a
  colleague on the same database, sees the same numbers.
- **Local files (MongoDB offline)** — the API is not running. The admin works
  exactly as it did before: this browser's storage, then the committed files.

## Publishing

```bash
npm run export     # MongoDB -> data/
git diff data/     # check what changed
git commit -am "Update stock"
```

Only files whose content actually changed are written, so an export with no
edits leaves the working tree clean.

## What lives where

| Collection | Holds | Exported to |
|---|---|---|
| `products` | catalogue + stock levels | `data/products.json` (+ stock into `data/inventory.csv`) |
| `cases` | patient cases, all 7 languages | `data/cases.json` |
| `faq` | questions and answers | `data/faq.json` |
| `homepage` | the 10 homepage text fields (one document) | `data/homepage.json` |
| `movements` | stock movement audit trail | `data/inventory-log.json` |
| `activity` | the dashboard's "Recent changes" trail | `data/activity-log.json` |

Every document carries `pos` (the order the editor sees) and `updatedAt`. Both
are stripped before the data reaches the browser. Numbers are stored as numbers;
`price` stays the `"3800.00"` string the site's markup renders.

`movements` and `activity` are history: `npm run seed` never overwrites them.

Saving a list writes to a temporary collection and renames it over the real one,
so a failed save leaves the existing data intact rather than emptying it.

Stock is deliberately kept out of `products.json` and written only to
`inventory.csv`, so a stock change touches one small file instead of the whole
catalogue.

## Precedence

Both the admin and the site read in this order, falling through when something
is unavailable:

**MongoDB → this browser's storage → committed `data/` files**

The published site never looks for a local API — that only happens on
`localhost`. So a visitor to www.wonder-herb.com always reads the committed
files, and a broken or missing database can never take the site down.

## Tests

```bash
npm run test:api        # Express + MongoDB, no stubs (throwaway db)
node scripts/test-ui-mongo.js   # admin + site pages against the live API
```

Both use the database `wonderherb_test` and clean up after themselves.

## Config

Copy `.env.example` to `.env` to change the connection:

```
MONGO_URL=mongodb://127.0.0.1:27017
MONGO_DB=wonderherb
PORT=4000
```

To point a page at a different API (for example a staging server), set
`window.WH_API_BASE` before the page's scripts run.
