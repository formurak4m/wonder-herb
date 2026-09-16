/* Product carousel - the homepage's 皇牌產品系列 block: one featured product
 * between two smaller neighbours, with prev/next arrows that rotate the three.
 * Source: index.html:3081 <section id="products" class="product-carousel-section">
 * and renderProductTriple() (index.html:3524), which builds the three cards.
 * Real classes: product-carousel-section, triple-product-layout, product-nav-btn,
 * control-btn, side-card, featured-card, shimmer-overlay, product-img,
 * product-description, side-desc, btn-detail-main, section-title.
 *
 * DATA-BACKED, like product-grid: `source: 'products.json'` -> data.products,
 * the catalogue the admin edits. The live page uses its own inline
 * `productsData` array of six links and image URLs, with the titles and
 * descriptions coming from that page's `translations` map - a third copy of
 * the catalogue (finding 8 again). This reads the one the admin owns, so an
 * edit in the admin reaches the homepage.
 *
 * PRE-RENDERED, NOT BUILT IN THE BROWSER. The live page ships the three card
 * divs EMPTY and fills them on load, so the homepage's product block is
 * invisible to a crawler and blank with scripts off. The three visible cards
 * are rendered here.
 *
 * WHY THE JSON ISLAND. Rotating the carousel needs all six products, not the
 * three on screen, and re-fetching data/products.json in the browser would put
 * back the client-side fetch this project exists to remove. So the list the
 * arrows rotate through is emitted once as inert
 * `<script type="application/json">` - data, never executed, ignored by
 * crawlers - and assets/behaviour/product-carousel.js reads it from there. The
 * three cards on screen are real HTML either way; the island only exists so
 * the arrows work. Nothing in it is private: it is the same six public
 * products already rendered on 產品介紹.
 *
 * SCRIPTS OFF: the arrows are hidden (template.js BEHAVIOURS noscript) and the
 * three cards stay. The live page shows three empty boxes and two dead arrows.
 */
export const config = {
  label: 'Product carousel',
  fields: {
    source: { type: 'text' },
    heading: { type: 'text' },
    headingId: { type: 'text' },
    detailLabel: { type: 'text' },      // "瞭解更多"
    detailIcon: { type: 'text' },       // "fas fa-arrow-right"
    prevLabel: { type: 'text' },
    nextLabel: { type: 'text' },
    groupLabel: { type: 'text' },       // aria-label on the layout
    sideLimit: { type: 'number' }       // side-card description cut, live: 70
  },
  defaultProps: {
    source: 'products.json', heading: '', headingId: '', detailLabel: '',
    detailIcon: 'fas fa-arrow-right', prevLabel: '', nextLabel: '',
    groupLabel: '', sideLimit: 70
  },
  variants: ['default']
};

/* The live side cards cut the description at 70 characters and add an ellipsis
   only when it was actually longer - `substring(0,70)` then
   `length>70?'…':''`. Same rule here, so the two agree character for character. */
const cut = (s, n) => {
  const t = String(s || '');
  return t.length > n ? t.substring(0, n) + '…' : t.substring(0, n);
};

const img = p => (
  <div className="product-img">
    <img src={p.img || p.image || ''} alt={p.title || ''} loading="lazy" />
  </div>
);

export default function ProductCarousel({
  source, data, heading, headingId, detailLabel, detailIcon,
  prevLabel, nextLabel, groupLabel, sideLimit
}) {
  const key = String(source || 'products.json').replace(/\.json$/, '');
  const products = (data && Array.isArray(data[key])) ? data[key] : [];
  const n = products.length;
  const limit = Number(sideLimit) || 70;

  /* The live page opens at index 0, so the left card is the LAST product
     (wrapping backwards) and the right card is the second. */
  const featured = n ? products[0] : null;
  const left = n ? products[(n - 1) % n] : null;
  const right = n ? products[1 % n] : null;

  const side = (p, id) => (
    <div className="side-card" id={id}>
      {p ? (
        <>
          {img(p)}
          <h4>{p.title}</h4>
          <div className="side-desc">{cut(p.desc, limit)}</div>
        </>
      ) : null}
    </div>
  );

  /* Only what the arrows need, and only fields already on the public page. */
  const island = products.map(p => ({
    img: p.img || p.image || '', title: p.title || '',
    desc: p.desc || '', link: p.link || ''
  }));

  return (
    <>
      {heading ? <h2 id={headingId || undefined} className="section-title reveal-on-scroll">{heading}</h2> : null}
      <div className="triple-product-layout reveal-on-scroll reveal-delay-1" id="tripleProductLayout"
           role="group" aria-label={groupLabel || undefined}>
        <div className="product-nav-btn">
          <button className="control-btn prev" id="productPrevManual" aria-label={prevLabel || undefined}>
            <i className="fas fa-chevron-left" aria-hidden="true"></i>
          </button>
        </div>
        {side(left, 'leftSideCard')}
        <div className="featured-card shimmer-overlay" id="featuredCard">
          {featured ? (
            <>
              {img(featured)}
              <h3>{featured.title}</h3>
              <div className="product-description">{featured.desc}</div>
              {detailLabel ? (
                <a href={featured.link || '#'} className="btn-detail-main">
                  {detailLabel} {detailIcon ? <i className={detailIcon} aria-hidden="true"></i> : null}
                </a>
              ) : null}
            </>
          ) : null}
        </div>
        {side(right, 'rightSideCard')}
        <div className="product-nav-btn">
          <button className="control-btn next" id="productNextManual" aria-label={nextLabel || undefined}>
            <i className="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <script type="application/json" id="productCarouselItems"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(island).replace(/</g, '\\u003c') }}></script>
    </>
  );
}
