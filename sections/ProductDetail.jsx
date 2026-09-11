/* Product detail - the buy panel on a product page.
 * Source: 產品_T3.html:26 <div class="product-info">, inside the page's
 * <div class="product-grid"> two-column wrapper.
 * Real classes: product-info, product-title, product-price,
 * product-short-desc, quantity-selector, quantity-input, action-buttons,
 * btn-primary, btn-secondary, trust-badges, badge-item.
 *
 * Careful: `product-grid` here is the product page's two-column wrapper. It is
 * NOT `products-grid`, the catalogue listing on 產品介紹.html. Different
 * classes, different CSS - do not merge them.
 *
 * DATA SHAPE. `source: 'products.json'` -> `data.products`, matched by `sku`.
 * Uses only keys that exist in data/products.json today:
 *
 *     id, title, sku, price, status, cat, badges, model, desc
 *
 * `badges` is the real comma-separated trust list ("GMP 認證, 有效成份>90%")
 * and is split into .badge-item elements, which is what that data is for.
 * If the sku is not found the section renders nothing rather than a broken
 * panel, so a mistyped sku fails visibly in review instead of silently
 * publishing an empty price.
 */
import { priceText } from './ProductGrid.jsx';

export const config = {
  label: 'Product detail',
  fields: {
    source: { type: 'text' },
    sku: { type: 'text' },
    quantityLabel: { type: 'text' },
    addLabel: { type: 'text' },
    addIcon: { type: 'text' },          // live: "fas fa-cart-plus"
    detailLabel: { type: 'text' },
    detailHref: { type: 'text' },
    detailIcon: { type: 'text' },       // live: "fas fa-chevron-down"
    descIcon: { type: 'text' },         // live: "fas fa-flask", opens the short description
    badgeIcons: { type: 'array', arrayFields: { icon: { type: 'text' } } },
    unit: { type: 'text' },
    priceNote: { type: 'text' },
    headingId: { type: 'text' }
  },
  defaultProps: {
    source: 'products.json', sku: '', quantityLabel: '', addLabel: '', addIcon: '',
    detailLabel: '', detailHref: '#detailedInfo', detailIcon: '', descIcon: '',
    badgeIcons: [], unit: '', priceNote: '', headingId: ''
  },
  // renders nothing at all until it has content: an empty panel would be worse
  emptyWithoutContent: true,
  variants: ['default']
};

export default function ProductDetail({
  source, data, sku, quantityLabel, addLabel, addIcon, detailLabel, detailHref, detailIcon,
  descIcon, badgeIcons, unit, priceNote, headingId
}) {
  const key = String(source || 'products.json').replace(/\.json$/, '');
  const items = (data && Array.isArray(data[key])) ? data[key] : [];
  const p = items.find(x => x && x.sku === sku);
  if (!p) return null;

  const id = headingId ? headingId : undefined;
  const badges = String(p.badges || '').split(',').map(b => b.trim()).filter(Boolean);

  return (
    <div className="product-info">
      <h1 className="product-title" id={id}>{p.title}</h1>
      <div className="product-price">
        {priceText(p, priceNote)}
        {unit ? <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>{' ' + unit}</span> : null}
      </div>
      {p.desc ? (
        <div className="product-short-desc">
          {descIcon ? <i className={descIcon} aria-hidden="true"></i> : null}
          {p.desc}
        </div>
      ) : null}
      {quantityLabel ? (
        <div className="quantity-selector">
          <label htmlFor="quantity">{quantityLabel}</label>
          <input type="number" id="quantity" className="quantity-input"
                 defaultValue={1} min={1} max={50} />
        </div>
      ) : null}
      {addLabel || detailLabel ? (
        <div className="action-buttons">
          {addLabel ? (
            <button id="addToCartBtn" className="btn-primary" data-sku={p.sku}>
              {addIcon ? <i className={addIcon} aria-hidden="true"></i> : null}
              {addLabel}
            </button>
          ) : null}
          {detailLabel ? (
            <a href={detailHref || '#detailedInfo'} className="btn-secondary">
              {detailLabel}
              {detailIcon ? <i className={detailIcon} aria-hidden="true"></i> : null}
            </a>
          ) : null}
        </div>
      ) : null}
      {badges.length ? (
        <div className="trust-badges">
          {badges.map((b, i) => {
            const ic = (Array.isArray(badgeIcons) ? badgeIcons : [])[i];
            const cls = ic && typeof ic === 'object' ? ic.icon : ic;
            return (
              <div className="badge-item" key={i}>
                {cls ? <i className={cls} aria-hidden="true"></i> : null}
                <span>{b}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
