# 網站管理教學 · How to Edit the Website

A simple guide to editing Wonder Herb content — no coding needed.
簡單教學：修改康草堂網站內容，完全不需要寫程式。

---

## What you can edit right now (現在可以編輯的)

- **病例 Cases** — add, edit, or remove patient cases (試點功能／pilot).

More sections (products, prices, FAQ, homepage text) will be added the same
way once this pilot is confirmed working.
之後會用同樣方法加入：產品、價格、常見問題、首頁文字。

---

## One-time setup (只需做一次)

The editor is a free tool called **Pages CMS**. It uses your GitHub login,
so there is **no new password to remember and nothing to leak**.

1. Go to **https://app.pagescms.org**
2. Click **Sign in with GitHub** and log in.
3. Allow it to access the repository **`formurak4m/wonder-herb`**.
4. Open that project. You will see a menu with **病例 Cases**.

That's it — bookmark `app.pagescms.org` like you used to bookmark WordPress.

> Note: the editing only works after the `geo` branch is merged into `main`
> (or after we point Pages CMS at the `geo` branch for testing). Tell your
> developer which branch to use.

---

## How to edit a case (點樣改病例)

1. Click **病例 Cases** in the left menu.
2. Click a case to open it (or **＋ Add** to create a new one).
3. Edit the **中文（主要）** section:
   - **標題** – the name/age, e.g. `麥女士（77歲）`
   - **副標題／病症** – the condition, e.g. `肛門惡性腫瘤`
   - **摘要** – the short text shown on the card
   - **內容** – the full story
4. Click **Save**.
5. Wait about 1 minute — the live website updates by itself.

The **other-language sections (English, 日本語…)** are optional. If you only
fill in Chinese, the site simply shows Chinese. You can ignore them.

---

## Safe to try (可以放心試)

- Every change is saved with a history, so nothing is ever truly lost — a
  developer can undo any change.
- Nothing goes public until the site rebuilds, and the whole site is backed
  up in GitHub.

---

## Good to know (技術備註 · for the developer)

- Content lives in `data/cases.json`; the page `典型病例.html` loads it at
  runtime via `fetch('./data/cases.json')`.
- The editor form is defined in `.pages.yml` (Pages CMS schema). All 7
  languages are declared so a save never drops other-language data.
- **Recommended next step:** add a build step (e.g. Eleventy) so cases are
  written into the static HTML at deploy time. Today cases are rendered by
  JavaScript, so search engines / AI do not see them. A build step would make
  the case text crawlable (a GEO win) while keeping the same editor.
