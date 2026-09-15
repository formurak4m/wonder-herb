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
 *
 * BEHAVIOUR (P9-T1, finding 23). The quick view is ported as
 * assets/behaviour/quick-view.js, which the template loads whenever a tree has
 * this section. What this component owns is the markup it binds to:
 *   - each card carries data-sku, data-price, data-status and, for a product
 *     flagged clinicOnly in the data, data-clinic-only. Identity is the SKU.
 *     The card used to carry data-id, the DATABASE id, which is not the id the
 *     cart and the detail pages use (標準裝 is 1 here and 2 there); it is gone
 *     so nothing can bind to it by mistake.
 *   - the quick view modal, hidden, after the grid (the live page's markup).
 * The 快速瀏覽 button renders only when the modal can: a button with nothing
 * behind it is worse than no button.
 */
export const config = {
  label: 'Product grid',
  fields: {
    source: { type: 'text' },
    quickViewLabel: { type: 'text' },
    detailLabel: { type: 'text' },
    priceNote: { type: 'text' },
    quantityLabel: { type: 'text' },    // quick view: "數量："
    addLabel: { type: 'text' }          // quick view: "加入購物車"
  },
  defaultProps: {
    source: 'products.json', quickViewLabel: '', detailLabel: '', priceNote: '',
    quantityLabel: '', addLabel: ''
  },
  variants: ['default']
};

/* The number the cart is charged, or nothing: never a formatted string. */
function priceValue(product) {
  const n = parseFloat(product && product.price);
  return isFinite(n) && n > 0 ? String(n) : undefined;
}

export function priceText(product, fallback) {
  const n = parseFloat(product && product.price);
  if (!isFinite(n) || n <= 0) return product && product.priceNote ? product.priceNote : (fallback || '');
  return 'HK$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductGrid({ source, data, quickViewLabel, detailLabel, priceNote, quantityLabel, addLabel }) {
  const key = String(source || 'products.json').replace(/\.json$/, '');
  const items = (data && Array.isArray(data[key])) ? data[key] : [];
  const quickView = Boolean(quickViewLabel && addLabel);

  const grid = (
    <div className="products-grid" id="productGrid" role="list" aria-label="产品列表">
      {items.map(p => {
        const titleId = 'product-title-' + p.id;
        return (
          <article className="product-card" data-sku={p.sku || undefined} data-price={priceValue(p)}
                   data-status={p.status || undefined} data-clinic-only={p.clinicOnly ? '' : undefined}
                   aria-labelledby={titleId} role="listitem" key={p.id}>
            <div className="product-image">
              {p.ribbon ? <div className="product-badge">{p.ribbon}</div> : null}
              {p.image ? <img src={p.image} alt={p.title} loading="lazy" /> : null}
            </div>
            <div className="product-info">
              <h2 className="product-title" id={titleId}>{p.title}</h2>
              <div className="product-price">{priceText(p, priceNote)}</div>
              {p.desc ? <p className="product-desc">{p.desc}</p> : null}
              <div className="card-buttons">
                {/* The live labels are "<i class='fas fa-eye'></i> 快速瀏覽" - the icon is
                    part of the label (產品介紹.html:1529). ' ' + label is one text node on
                    purpose: two adjacent children make React emit <!-- --> between them. */}
                {quickView && p.sku
                  ? <button type="button" className="btn-quickview" data-sku={p.sku}><i className="fas fa-eye"></i>{' ' + quickViewLabel}</button>
                  : null}
                {p.link && detailLabel
                  ? <a href={p.link} className="btn-detail"><i className="fas fa-info-circle"></i>{' ' + detailLabel}</a>
                  : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  if (!quickView) return grid;

  /* 產品介紹.html:1459, the live modal. Hidden by the page CSS (.modal
     display:none); assets/behaviour/quick-view.js fills and opens it. */
  return (
    <>
      {grid}
      <div id="quickViewModal" className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="modal-content">
          <span className="close-modal" role="button" tabIndex={0} aria-label="关闭">&times;</span>
          <img id="modalImage" className="modal-product-image" alt="" />
          <h2 id="modalTitle" className="modal-product-title"></h2>
          <div id="modalPrice" className="modal-product-price"></div>
          <p id="modalDesc" className="modal-product-desc"></p>
          {quantityLabel ? (
            <div className="modal-quantity">
              <label htmlFor="modalQty">{quantityLabel}</label>
              <input type="number" id="modalQty" defaultValue={1} min={1} max={99} />
            </div>
          ) : <input type="hidden" id="modalQty" value="1" />}
          {/* why an add was refused, shown inline by quick-view.js - never alert() */}
          <p id="modalMessage" className="modal-message" role="alert" hidden></p>
          <button type="button" id="modalAddToCart" className="modal-add-to-cart"><i className="fas fa-cart-plus"></i>{' ' + addLabel}</button>
        </div>
      </div>
    </>
  );
}
