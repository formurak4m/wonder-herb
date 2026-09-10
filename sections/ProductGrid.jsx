/* Product grid - the catalogue listing.
 * Source: 產品介紹.html:1454 (the container) and :1835 (the card the page's
 * own renderProducts() builds).
 * Real classes: products-grid, product-card, product-image, product-badge,
 * product-info, product-title, product-price, product-desc, card-buttons,
 * btn-quickview, btn-detail.
 *
 * DATA SHAPE - read this before changing it.
 *
 * The renderer passes `data` keyed by data file, so `source: 'products.json'`
 * means `data.products`. The keys used here are the ones that ACTUALLY exist
 * in data/products.json today:
 *
 *     id, title, sku, price, status, cat, badges, model, desc
 *
 * Two keys the live page uses do NOT exist in that file: `image` and `link`.
 * The live page carries its own hard-coded productData array with image URLs
 * and detail-page links; data/products.json has neither. This component reads
 * `image` and `link` if they are present and degrades cleanly if not - no
 * broken <img>, no dead link - so it is correct today and correct once those
 * fields are added. They MUST be added before a real page migration in Phase 9,
 * or the grid publishes without photos. See docs/FINDINGS.md.
 *
 * `badges` in the data ("GMP 認證, 有效成份>90%") is a trust-badge list, NOT
 * the corner ribbon the live card shows. They are different things, so the
 * ribbon comes from an explicit `ribbon` key rather than being mis-mapped.
 */
export const config = {
  label: 'Product grid',
  fields: {
    source: { type: 'text' },
    quickViewLabel: { type: 'text' },
    detailLabel: { type: 'text' },
    priceNote: { type: 'text' }
  },
  defaultProps: {
    source: 'products.json', quickViewLabel: '', detailLabel: '', priceNote: ''
  },
  variants: ['default']
};

export function priceText(product, fallback) {
  const n = parseFloat(product && product.price);
  if (!isFinite(n) || n <= 0) return product && product.priceNote ? product.priceNote : (fallback || '');
  return 'HK$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductGrid({ source, data, quickViewLabel, detailLabel, priceNote }) {
  const key = String(source || 'products.json').replace(/\.json$/, '');
  const items = (data && Array.isArray(data[key])) ? data[key] : [];

  return (
    <div className="products-grid" id="productGrid" role="list" aria-label="产品列表">
      {items.map(p => {
        const titleId = 'product-title-' + p.id;
        return (
          <article className="product-card" data-id={p.id} aria-labelledby={titleId} role="listitem" key={p.id}>
            <div className="product-image">
              {p.ribbon ? <div className="product-badge">{p.ribbon}</div> : null}
              {p.image ? <img src={p.image} alt={p.title} loading="lazy" /> : null}
            </div>
            <div className="product-info">
              <h2 className="product-title" id={titleId}>{p.title}</h2>
              <div className="product-price">{priceText(p, priceNote)}</div>
              {p.desc ? <p className="product-desc">{p.desc}</p> : null}
              <div className="card-buttons">
                {quickViewLabel
                  ? <button className="btn-quickview" data-id={p.id}>{quickViewLabel}</button>
                  : null}
                {p.link && detailLabel
                  ? <a href={p.link} className="btn-detail">{detailLabel}</a>
                  : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
