/* Case list - the patient case studies, with the filter panel above them.
 * Source: 典型病例.html:1 <div class="filter-panel"> and <div class="cases-grid">,
 * both built at runtime by that page's own script. Real classes: filter-panel,
 * search-row, search-box, reset-btn, result-count, disease-filters,
 * filter-label, filter-chip, filter-chip-icon, cases-grid, case-card,
 * case-title, case-subtitle, disease-icon, case-content, case-summary,
 * case-full, read-more-btn, read-more-text.
 *
 * DATA-BACKED, like product-grid and faq-accordion: `source: 'cases.json'` ->
 * data.cases, the list the admin and Pages CMS already edit. Each entry is a
 * per-language object with title, subtitle (the diagnosis), summary and
 * content; renderer/render.js resolves the language before this runs.
 *
 * PRE-RENDERED, NOT BUILT IN THE BROWSER. The live page renders zero cards
 * without JavaScript and builds all fifteen on load, so a crawler sees an
 * empty shell - the gap this project exists to close. Everything here is in
 * the HTML; assets/behaviour/case-list.js only filters what is already there.
 *
 * `content` IS HTML, and is injected as HTML. It is the one field on the site
 * that carries markup (<p>, <strong>) rather than plain text: the live page
 * does the same (`${data.content}`, unescaped, while every other field goes
 * through escapeHtml). It comes from data/cases.json, which only an
 * authenticated admin can write, so this is the same trust boundary the admin
 * form already has - but it IS a trust boundary, so it is stated here and
 * nowhere else in the section library.
 *
 * The diagnosis icons are a page-level map (`diseaseIcons`: match -> icon),
 * not data: the live page keys the same map by the disease name in each
 * language. An entry may also carry its own `icon`, which wins.
 */
export const config = {
  label: 'Case list',
  fields: {
    source: { type: 'text' },
    searchPlaceholder: { type: 'text' },
    searchLabel: { type: 'text' },
    resetLabel: { type: 'text' },
    resetIcon: { type: 'text' },
    resultPrefix: { type: 'text' },
    resultSuffix: { type: 'text' },
    filterLabel: { type: 'text' },
    filterIcon: { type: 'text' },
    allLabel: { type: 'text' },
    allIcon: { type: 'text' },
    moreLabel: { type: 'text' },
    lessLabel: { type: 'text' },
    moreIcon: { type: 'text' },
    emptyText: { type: 'text' },
    defaultIcon: { type: 'text' },
    diseaseIcons: {
      type: 'array',
      arrayFields: { match: { type: 'text' }, icon: { type: 'text' } }
    },
    /* highlights only */
    heading: { type: 'text' },
    headingId: { type: 'text' },
    sub: { type: 'textarea' },
    moreLinkLabel: { type: 'text' },   // "查看更多典型病例 →", the link under the grid
    moreHref: { type: 'text' },
    limit: { type: 'number' },
    excerptLimit: { type: 'number' },
    linkLabel: { type: 'text' },
    linkHref: { type: 'text' },
    gridId: { type: 'text' },
    variant: {
      type: 'select',
      options: [
        { label: 'Full list with filters', value: 'default' },
        { label: 'Highlights (homepage)', value: 'highlights' }
      ]
    }
  },
  defaultProps: {
    source: 'cases.json', searchPlaceholder: '', searchLabel: '', resetLabel: '',
    resetIcon: 'fas fa-eraser', resultPrefix: '', resultSuffix: '', filterLabel: '',
    filterIcon: 'fas fa-tags', allLabel: '', allIcon: 'fas fa-list-ul',
    moreLabel: '', lessLabel: '', moreIcon: 'fas fa-chevron-down', emptyText: '',
    defaultIcon: 'fa-solid fa-virus', diseaseIcons: [],
    heading: '', headingId: '', sub: '', moreHref: '典型病例.html',
    limit: 3, excerptLimit: 110, linkLabel: '', linkHref: '典型病例.html',
    moreLinkLabel: '', gridId: 'featuredCasesGrid', variant: 'default'
  },
  variants: ['default', 'highlights']
};

/* The homepage's excerpt rule, kept exactly: take the case's content as plain
   text, cut at 110 characters, and append an ellipsis only when the text
   reached that length (index.html:3541 - `substring(0,110)`, then
   `plain.length >= 110`). The live page strips the tags by assigning the HTML
   to a throwaway element and reading textContent; there is no DOM here, so the
   tags come off with a regex and the entities the data actually contains are
   decoded. Same input, same output. */
const plainText = html => String(html || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export default function CaseList({
  source, data, searchPlaceholder, searchLabel, resetLabel, resetIcon,
  resultPrefix, resultSuffix, filterLabel, filterIcon, allLabel, allIcon,
  moreLabel, lessLabel, moreIcon, emptyText, defaultIcon, diseaseIcons,
  heading, headingId, sub, moreLinkLabel, moreHref,
  limit, excerptLimit, linkLabel, linkHref, gridId, variant = 'default'
}) {
  const key = String(source || 'cases.json').replace(/\.json$/, '');
  const cases = (data && Array.isArray(data[key])) ? data[key] : [];

  /* highlights - index.html:3087, the 真實康復故事精選 block. The first few
     cases as mini cards linking to the full page. The live page builds these
     from its own inline three-case array, not from data/cases.json; this
     renders the data file, which is the list the admin edits, so the excerpts
     differ from the live page's (recorded, not reconciled - the content rule). */
  if (variant === 'highlights') {
    const n = Number(limit) || 3;
    const cut = Number(excerptLimit) || 110;
    return (
      <>
      {heading ? <h2 id={headingId || undefined} className="section-title reveal-on-scroll">{heading}</h2> : null}
      {sub ? <div className="section-sub reveal-on-scroll reveal-delay-1">{sub}</div> : null}
      <div id={gridId || undefined} className="featured-cases-grid">
        {cases.slice(0, n).map((c, i) => {
          const plain = plainText(c.content).substring(0, cut);
          return (
            <div className={'mini-case-card reveal-on-scroll reveal-delay-' + (i + 1)} key={i}>
              <h3 className="mini-case-title">{c.title}</h3>
              <div className="mini-case-subtitle">{c.subtitle}</div>
              <div className="mini-case-excerpt">{plain.length >= cut ? plain + '…' : plain}</div>
              {linkLabel ? <a href={linkHref || '#'} className="read-more-link">{linkLabel}</a> : null}
            </div>
          );
        })}
      </div>
      {moreLinkLabel ? (
        /* the live block's own inline centring; it has no class of its own */
        <div style={{ textAlign: 'center', marginTop: '20px' }} className="reveal-on-scroll reveal-delay-2">
          <a href={moreHref || '#'} className="btn-secondary">{moreLinkLabel}</a>
        </div>
      ) : null}
      </>
    );
  }
  const icons = Array.isArray(diseaseIcons) ? diseaseIcons : [];
  const iconFor = c => c.icon ||
    (icons.find(m => m && m.match === c.subtitle) || {}).icon || defaultIcon;

  /* One chip per diagnosis, in the order the cases appear - the same list the
     live page derives, minus duplicates. */
  const diseases = [];
  cases.forEach(c => { if (c && c.subtitle && diseases.indexOf(c.subtitle) === -1) diseases.push(c.subtitle); });

  return (
    <>
      <div className="filter-panel" role="search" aria-label={searchLabel || undefined}>
        <div className="search-row">
          <div className="search-box">
            <i className="fas fa-search" aria-hidden="true"></i>
            <input type="text" id="caseSearch" placeholder={searchPlaceholder || undefined}
                   autoComplete="off" aria-label={searchLabel || undefined} />
          </div>
          <button id="caseReset" className="reset-btn" aria-label={resetLabel || undefined}>
            {resetIcon ? <i className={resetIcon} aria-hidden="true"></i> : null} {resetLabel}
          </button>
          {/* the count is rendered for the full list; the behaviour keeps it in step */}
          <div className="result-count" id="caseCount" aria-live="polite">
            {resultPrefix}{cases.length}{resultSuffix}
          </div>
        </div>
        <div className="disease-filters">
          <span className="filter-label">
            {filterIcon ? <i className={filterIcon} aria-hidden="true"></i> : null} {filterLabel}
          </span>
          <button data-disease="" className="filter-chip active" aria-pressed="true">
            {allIcon ? <i className={allIcon + ' filter-chip-icon'} aria-hidden="true"></i> : null} {allLabel}
          </button>
          {diseases.map((name, i) => {
            const icon = (icons.find(m => m && m.match === name) || {}).icon || defaultIcon;
            return (
              <button key={i} data-disease={name} className="filter-chip" aria-pressed="false">
                <i className={'filter-chip-icon ' + icon} aria-hidden="true"></i> {name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cases-grid" role="list" aria-label={searchLabel || undefined}
           data-empty-text={emptyText || undefined}>
        {cases.map((c, i) => (
          <article className="case-card" role="listitem" key={i}
                   data-disease={c.subtitle || ''} aria-labelledby={'case-title-' + i}>
            <h2 className="case-title" id={'case-title-' + i}>{c.title}</h2>
            <p className="case-subtitle">
              <i className={'disease-icon ' + iconFor(c)} aria-hidden="true"></i> {c.subtitle}
            </p>
            <div className="case-content">
              <div className="case-summary">{c.summary}</div>
              <div className="case-full" id={'case-full-' + i}
                   dangerouslySetInnerHTML={{ __html: c.content || '' }}></div>
              <button className="read-more-btn" data-target={'case-full-' + i}
                      data-more={moreLabel} data-less={lessLabel}
                      aria-expanded="false" aria-controls={'case-full-' + i}>
                <span className="read-more-text">{moreLabel}</span>
                {moreIcon ? <i className={moreIcon} aria-hidden="true"></i> : null}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
