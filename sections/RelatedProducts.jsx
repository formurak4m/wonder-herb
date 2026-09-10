/* Related products - the "你可能也感興趣" strip at the foot of a product page.
 * Source: 產品_T3.html:1 <div class="related-products">, on all six product
 * pages (related-card appears 3x per page).
 * Real classes: related-products, section-title, related-grid, related-card.
 *
 * This section stands in for the `text-and-image` in the BUILD_TASKS P4-T2
 * list. There is no two-column text+image block anywhere on this site - the
 * class survey found none - so building one would have meant inventing markup
 * and CSS, the exact mistake the P4-T1 callout now warns against. This block
 * is real, appears on six pages, and is needed by the product pages that
 * Phase 9 migrates. See docs/FINDINGS.md.
 *
 * DATA SHAPE. Optional. With `source: 'products.json'` and a list of skus it
 * pulls title, price and desc from data/products.json (keys: id, title, sku,
 * price, status, cat, badges, model, desc). Each entry may also carry its own
 * `href` and `label`, because the live cards link to hand-written page names
 * and data/products.json has no `link` key.
 */
import { priceText } from './ProductGrid.jsx';

export const config = {
  label: 'Related products',
  fields: {
    heading: { type: 'text' },
    source: { type: 'text' },
    items: {
      type: 'array',
      arrayFields: {
        sku: { type: 'text' },
        href: { type: 'text' },
        label: { type: 'text' },
        desc: { type: 'text' }
      }
    },
    headingId: { type: 'text' }
  },
  defaultProps: { heading: '', source: 'products.json', items: [], headingId: '' },
  // renders nothing at all until it has content: an empty panel would be worse
  emptyWithoutContent: true,
  variants: ['default']
};

export default function RelatedProducts({ heading, source, data, items, headingId }) {
  const key = String(source || 'products.json').replace(/\.json$/, '');
  const products = (data && Array.isArray(data[key])) ? data[key] : [];
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  const id = headingId ? headingId : undefined;

  return (
    <div className="related-products">
      {heading ? <h2 className="section-title" id={id}>{heading}</h2> : null}
      <div className="related-grid">
        {list.map((item, i) => {
          const p = products.find(x => x && x.sku === item.sku) || {};
          const name = item.label || p.title || '';
          const desc = item.desc || p.desc || '';
          const price = p.sku ? priceText(p, '') : '';
          return (
            <a href={item.href || '#'} className="related-card" key={i} aria-label={name}>
              <h3>{name}</h3>
              {desc ? <p>{desc}</p> : null}
              {price ? <span style={{ color: '#9b2e2e', fontWeight: 'bold' }}>{price}</span> : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}
