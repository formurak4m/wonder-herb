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
import { priceText, priceValue } from './ProductGrid.jsx';

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
    headingId: { type: 'text' },
    headingBadge: { type: 'text' },     // the smaller tagline inside the <h1>
    /* shown INSTEAD of the quantity selector and the add button when the data
       says this product cannot be bought online - see below */
    clinicNote: { type: 'text' },
    clinicIcon: { type: 'text' },           // live: "fas fa-hospital-user"
    clinicButtonLabel: { type: 'text' },
    clinicButtonIcon: { type: 'text' },  // live: "fas fa-ban"
    clinicButtonAria: { type: 'text' }
  },
  defaultProps: {
    source: 'products.json', sku: '', quantityLabel: '', addLabel: '', addIcon: '',
    detailLabel: '', detailHref: '#detailedInfo', detailIcon: '', descIcon: '',
    badgeIcons: [], unit: '', priceNote: '', headingId: '', headingBadge: '',
    clinicNote: '', clinicIcon: '', clinicButtonLabel: '', clinicButtonIcon: '', clinicButtonAria: ''
  },
  // renders nothing at all until it has content: an empty panel would be worse
  emptyWithoutContent: true,
  variants: ['default']
};

export default function ProductDetail({
  source, data, sku, quantityLabel, addLabel, addIcon, detailLabel, detailHref, detailIcon,
  descIcon, badgeIcons, unit, priceNote, headingId, headingBadge,
  clinicNote, clinicIcon, clinicButtonLabel, clinicButtonIcon, clinicButtonAria
}) {
  const key = String(source || 'products.json').replace(/\.json$/, '');
  const items = (data && Array.isArray(data[key])) ? data[key] : [];
  const p = items.find(x => x && x.sku === sku);
  if (!p) return null;

  const id = headingId ? headingId : undefined;
  const badges = String(p.badges || '').split(',').map(b => b.trim()).filter(Boolean);

  /* WHETHER IT CAN BE BOUGHT COMES FROM THE DATA, not from the tree (owner,
     16 Sep 2026). 產品_PT3 hard-codes a disabled "無庫存 (診所專供)" button and a
     clinic note into its markup; carrying that as fields would keep saying so
     after the flag changed - the class of bug findings 19 and 23 came from.
     The product grid already decides this way, and the cart refuses on the
     same two values, so the panel and the cart cannot disagree. The WORDING is
     still the client's, in the tree. */
  const clinicOnly = Boolean(p.clinicOnly);

  /* CLINIC-ONLY is a panel state; OUT OF STOCK is not.
     產品_PT3 shows a clinic note and a disabled button because that product is
     never sold online - a permanent fact about the product, which the live
     page states too, so the panel states it.
     Stock is different: it changes, it goes live only at publish (an accepted
     decision), and the live pages show no stock cue at all (finding 23, cue
     waived by the owner). So an out-of-stock product keeps its normal button
     and the CART refuses the click with the approved message, exactly as the
     product grid's quick view already does. The panel and the cart read the
     same two data fields, so they cannot disagree. */
  const sellable = !clinicOnly;

  return (
    <div className="product-info" data-sku={p.sku || undefined} data-price={priceValue(p)}
         data-status={p.status || undefined} data-clinic-only={clinicOnly ? '' : undefined}>
      {/* The live heading is TWO spans: the product's name, then a smaller
          maroon tagline ("Cov-1菌絲體提取 | 初次體驗推薦", "澳洲昆士蘭科大臨床實證").
          It is page copy - data/products.json has no such field - so it lives
          in the tree. Dropping it lost a visible line from every product page
          and, at 390, changed how the heading wrapped. The style is the live
          markup's own, identical on all six. */}
      <h1 className="product-title" id={id}>
        <span>{p.title}</span>
        {headingBadge ? <> <span style={{ fontSize: '1rem', color: '#9b2e2e' }}>{headingBadge}</span></> : null}
      </h1>
      <div className="product-price">
        {priceText(p, priceNote)}
        {unit ? <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>{' ' + unit}</span> : null}
      </div>
      {p.desc ? (
        <div className="product-short-desc">
          {/* the teal is the live markup's own, identical on all six pages */}
          {descIcon ? <i className={descIcon} style={{ color: '#2EADA5' }} aria-hidden="true"></i> : null}
          {' '}{p.desc}
        </div>
      ) : null}
      {sellable && quantityLabel ? (
        <div className="quantity-selector">
          <label htmlFor="quantity">{quantityLabel}</label>
          <input type="number" id="quantity" className="quantity-input"
                 defaultValue={1} min={1} max={50} />
        </div>
      ) : null}
      {!sellable && clinicOnly && clinicNote ? (
        <div className="clinic-note">
          {clinicIcon ? <i className={clinicIcon} aria-hidden="true"></i> : null} {clinicNote}
        </div>
      ) : null}
      {addLabel || detailLabel ? (
        <div className="action-buttons">
          {addLabel && sellable ? (
            <button id="addToCartBtn" className="btn-primary" data-sku={p.sku}>
              {addIcon ? <i className={addIcon} aria-hidden="true"></i> : null}
              {addLabel}
            </button>
          ) : null}
          {addLabel && !sellable && clinicButtonLabel ? (
            <button className="btn-primary" disabled aria-label={clinicButtonAria || undefined}>
              {clinicButtonIcon ? <i className={clinicButtonIcon} aria-hidden="true"></i> : null}
              {clinicButtonLabel}
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
        /* The inline style is the live markup's own, on all six product pages:
           .trust-badges is a page-level block with 40px margins, and inside the
           buy panel those margins are cancelled and the row is left-aligned.
           Dropping it grew the panel by 38px and moved everything below it -
           caught by the 產品_T3 visual diff, not by fidelity, which compares
           tags and classes rather than style. */
        <div className="trust-badges" style={{ margin: 0, justifyContent: 'flex-start' }}>
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
