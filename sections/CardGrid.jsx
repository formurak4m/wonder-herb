/* Card grid - a grid of cards that each link somewhere, plus a list variant.
 *
 * Four of the six content pages are this same block in four shapes, so this is
 * one section with one variant per REAL shape on the site (P9 batch; owner
 * approved four variants over the usual two or three, because they are one
 * thing: a grid of linked cards):
 *
 *   badges     產品_T3.html:1     <div class="trust-badges">: icon, <h4>, a line
 *                                  of copy. Four per product page, no links.
 *   brochure   小册子.html:1       <a class="brochure-card">: image, title,
 *                                  "click to enlarge" hint. Wrapper
 *                                  .brochure-grid, no role.
 *   report     有效成份檢測.html:1  .report-card: an image LINK, then title,
 *                                  description and a download button.
 *                                  Wrapper .reports-grid role="list".
 *   icon       研究報告.html:1      <a class="report-card">: icon circle,
 *                                  title, description, "read more". Same
 *                                  wrapper as report.
 *   article    微信發表文章.html:1   <article class="article-card"> wrapping one
 *                                  link: badge, title, excerpt, read-more.
 *                                  Wrapper .articles-grid role="list".
 *   link-list  研究報告.html:1      .pdf-list: a heading and a <ul> of linked
 *                                  files, each with its own icon. Not a grid,
 *                                  but the same content shape - a list of
 *                                  links - so it lives here rather than in a
 *                                  section of its own.
 *
 * Real classes throughout: brochure-grid, brochure-card, brochure-image,
 * brochure-info, zoom-hint, reports-grid, report-card, report-image-link,
 * report-image, report-info, download-btn, report-icon, report-link,
 * articles-grid, article-card, badge-simple, article-title, article-excerpt,
 * article-link, pdf-list, sr-only.
 *
 * ITEMS LIVE IN THE TREE, not in a data file. These lists are page content
 * with no admin screen and no data/*.json behind them (the WeChat articles are
 * an inline per-language array in the page, the same shape the catalogue was
 * in - finding 8). `items` is an array field, so the client edits them in
 * Puck. A list that grows an admin screen later becomes data-backed like
 * product-grid, by adding a `source`; nothing else here changes.
 *
 * The live cards' per-card aria-labels are kept as an optional `aria` field:
 * several of them say more than the visible title ("open page 1 of the
 * brochure, cover and product introduction"), so dropping them would cost a
 * screen-reader user information. Where a card has none, none is emitted.
 */
export const config = {
  label: 'Card grid',
  fields: {
    heading: { type: 'text' },
    headingHidden: { type: 'radio', options: [
      { label: 'Visible', value: false }, { label: 'Screen readers only', value: true }
    ] },
    items: {
      type: 'array',
      arrayFields: {
        title: { type: 'text' },
        text: { type: 'textarea' },     // description / excerpt
        badge: { type: 'text' },        // article only
        href: { type: 'text' },
        image: { type: 'text' },        // brochure / report
        imageAlt: { type: 'text' },
        icon: { type: 'text' },         // icon / link-list
        aria: { type: 'text' }
      }
    },
    linkLabel: { type: 'text' },        // "閱讀全文 →", "下載報告 (PDF)", "Read More"
    linkIcon: { type: 'text' },
    hint: { type: 'text' },             // brochure: "點擊圖片放大"
    hintIcon: { type: 'text' },
    noReferrer: { type: 'radio', options: [
      { label: 'Normal', value: false }, { label: 'No referrer (Drive images)', value: true }
    ] },
    variant: {
      type: 'select',
      options: [
        { label: 'Trust badges', value: 'badges' },
        { label: 'Brochure pages', value: 'brochure' },
        { label: 'Reports with images', value: 'report' },
        { label: 'Cards with icons', value: 'icon' },
        { label: 'Articles', value: 'article' },
        { label: 'List of file links', value: 'link-list' }
      ]
    }
  },
  defaultProps: {
    heading: '', headingHidden: false, items: [], linkLabel: '', linkIcon: '',
    hint: '', hintIcon: '', noReferrer: false, variant: 'brochure'
  },
  variants: ['badges', 'brochure', 'report', 'icon', 'article', 'link-list']
};

const WRAPPER = {
  badges: { cls: 'trust-badges', role: undefined },
  brochure: { cls: 'brochure-grid', role: undefined },
  report: { cls: 'reports-grid', role: 'list' },
  icon: { cls: 'reports-grid', role: 'list' },
  article: { cls: 'articles-grid', role: 'list' }
};

const icon = cls => cls ? <i className={cls} aria-hidden="true"></i> : null;
const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' };

export default function CardGrid({ heading, headingHidden, items, linkLabel, linkIcon,
                                   hint, hintIcon, noReferrer, variant = 'brochure' }) {
  const list = Array.isArray(items) ? items : [];
  const title = heading
    ? <h2 className={headingHidden ? 'sr-only' : undefined}>{heading}</h2>
    : null;

  if (variant === 'link-list') {
    return (
      <div className="pdf-list">
        {heading ? <h3>{heading}</h3> : null}
        <ul>
          {list.map((it, i) => (
            <li key={i}>
              {icon(it.icon || linkIcon)}{' '}
              <a href={it.href || '#'} {...NEW_TAB} aria-label={it.aria || undefined}>{it.title}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const w = WRAPPER[variant] || WRAPPER.brochure;
  const card = (it, i) => {
    /* badges - 產品_T3.html:1 <div class="trust-badges"> BELOW the details card
       (four items): icon, an <h4> and a line of copy. Not to be confused with
       the small icon+label row INSIDE the buy panel, which product-detail
       renders from the product's own `badges` field. These have no links. */
    if (variant === 'badges') {
      return (
        <div className="badge-item" key={i}>
          {icon(it.icon)}
          <h4>{it.title}</h4>
          {it.text ? <p>{it.text}</p> : null}
        </div>
      );
    }
    if (variant === 'brochure') {
      return (
        <a key={i} href={it.href || '#'} target="_blank" className="brochure-card" aria-label={it.aria || undefined}>
          <img className="brochure-image" src={it.image} alt={it.imageAlt || ''} loading="lazy"
               referrerPolicy={noReferrer ? 'no-referrer' : undefined} />
          <div className="brochure-info">
            <h3>{it.title}</h3>
            {hint ? <div className="zoom-hint">{icon(hintIcon)} {hint}</div> : null}
          </div>
        </a>
      );
    }
    if (variant === 'report') {
      return (
        <div key={i} className="report-card" role="listitem">
          <a href={it.href || '#'} className="report-image-link" {...NEW_TAB} aria-label={it.aria || undefined}>
            <img className="report-image" src={it.image} alt={it.imageAlt || ''} loading="lazy"
                 referrerPolicy={noReferrer ? 'no-referrer' : undefined} />
          </a>
          <div className="report-info">
            <h3>{it.title}</h3>
            {it.text ? <p>{it.text}</p> : null}
            {linkLabel ? <a href={it.href || '#'} className="download-btn" {...NEW_TAB}>{icon(linkIcon)} {linkLabel}</a> : null}
          </div>
        </div>
      );
    }
    if (variant === 'icon') {
      return (
        <a key={i} href={it.href || '#'} target="_blank" className="report-card" role="listitem" aria-label={it.aria || undefined}>
          <div className="report-icon">{icon(it.icon || linkIcon)}</div>
          <h3>{it.title}</h3>
          {it.text ? <p>{it.text}</p> : null}
          {linkLabel ? <span className="report-link">{linkLabel}</span> : null}
        </a>
      );
    }
    /* article: the live card puts the whole card inside one link, with the
       layout as an inline style because .article-card a has no rule. */
    const id = 'article-title-' + i;
    return (
      <article key={i} className="article-card" role="listitem" aria-labelledby={id}>
        <a href={it.href || '#'} {...NEW_TAB}
           style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {it.badge ? <span className="badge-simple">{it.badge}</span> : null}
          <h2 className="article-title" id={id}>{it.title}</h2>
          {it.text ? <p className="article-excerpt">{it.text}</p> : null}
          {linkLabel ? <div className="article-link">{linkLabel} {icon(linkIcon)}</div> : null}
        </a>
      </article>
    );
  };

  return (
    <>
      {title}
      <div className={w.cls} role={w.role}>{list.map(card)}</div>
    </>
  );
}
