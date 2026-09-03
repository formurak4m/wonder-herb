# Local database setup

The public site is **static** and stays that way. MongoDB is the place you
*edit*; `npm run export` writes the database back into `data/` so the site keeps
serving plain files. Nothing about hosting, the SEO work or the deploy changes.

```
   MongoDB (localhost:27017, db "wonderherb")
        |
   Node API (localhost:4000)      server/index.js
        |                          also serves the pages locally
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
npm run dev
```

One command, one server: the site, the admin and the API are all on
<http://localhost:4000> — pages at `/`, the console at `/admin/`, the API under
`/api/`. Serving the pages is a development convenience only; in production
they are static files and this server does not exist.

A separate static server still works if you prefer it:

```bash
python -m http.server 8747   # the site, as before
```

The pages look for the API on port 4000 either way. If you run it on a
different port, set `window.WH_API_BASE` before the page's scripts.

Then open <http://localhost:4000/admin/>. The chip in the top bar tells you
where data is coming from:

- **MongoDB connected** — every save goes into the database. A second tab, or a
  colleague on the same database, sees the same numbers.
- **Local files (MongoDB offline)** — the API is not running. The admin works
  exactly as it did before: this browser's storage, then the committed files.

## Accounts

Signing up, signing in and signing out are handled by the API and stored in
MongoDB. Visitors use `account.html`; the console at `/admin/` uses the same
accounts, but only lets an administrator in.

**Three kinds of account.**

| Type | What it can do |
|---|---|
| `admin` | everything, including creating accounts and changing privileges |
| `staff` | only the modules an administrator ticked, at the level ticked |
| `customer` | a website account; no way into the console at all |

A staff account carries one level per module - `none`, `view` or `edit` - for
Cases, Products, Inventory, FAQ and Homepage text. Managing accounts is never
one of them: that stays with administrators. Signing up on the site always
creates a `customer`; privileges are only ever granted by an administrator on
the console's **Users** screen.

**Privileges are enforced by the server.** `GET` stays open, because the public
site reads products, cases and FAQ. Every write - saving a module, adjusting
stock, writing to the activity trail - requires a signed-in account with the
right level, so a view-only account calling the API directly is refused with a
403. Hiding a button is not the protection; this is.

Changing someone's ticks takes effect on their next click - they do not need to
sign in again. Disabling an account, deleting it, or resetting its password
ends its sessions immediately.

**You cannot lock yourself out.** Nobody can change their own account type,
disable themselves or delete themselves, and the last remaining administrator
cannot be demoted, disabled or deleted.

**The first administrator.** On a fresh database the console's sign-in card
offers to create one - the account you make there becomes the administrator.
Afterwards nobody can grant themselves that role from a form; use:

```bash
npm run admin:create -- you@wonder-herb.com "a good password" "Your Name"
```

The same command resets the password of an existing administrator, and signs
out every session that account had.

**What is stored.** A user document holds the name, the lowercased email, the
role, and a salted scrypt hash - never the password. Email is unique at the
database level, so one address cannot register twice. A session document holds
a *hash* of the token the browser was given, so a copy of the database is not a
set of usable logins; MongoDB expires sessions on its own after 30 days.

Signing out deletes the session on the server, not just the token in the
browser. Changing a password signs out every other device. Five wrong
passwords in a row for one address are refused for 15 minutes.

`users` and `sessions` are deliberately outside the content collections: they
cannot be read through `/api/cms`, and `npm run export` never writes them into
`data/`. Accounts stay in the database only, and never reach the repository.

**Without the API.** The published static site has no API to talk to, so the
account link stays hidden and the page says accounts are unavailable - the
public pages look exactly as they did. The console falls back to the
"continue without signing in" mode it had before, editing this browser's copy.

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
| `users` | accounts: name, email, role, privileges, salted password hash | nothing - never exported |
| `sessions` | who is signed in; expired by MongoDB itself | nothing - never exported |

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
npm run test:auth       # signup, login, logout, sessions, roles
npm run test:ui         # admin + site pages against the live API
npm run test:ui:auth    # account.html and the admin sign-in, in a real DOM
```

The two UI suites need `jsdom` available to node; it is not a dependency of
the site itself.

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
