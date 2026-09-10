/* Text block - a titled run of paragraphs. Two real shapes on the live site,
 * so two real variants:
 *
 *   glass - index.html:  <h2 class="section-title"> + <div class="section-sub">
 *                        + <div class="company-glass-card"><p>...</p></div>
 *   card  - 產品_T3.html:16 <div class="product-details-card">
 *                        <h2 class="section-title"> + <p> / <ul>
 *
 * Real classes: section-title, section-sub, company-glass-card,
 * product-details-card, reveal-on-scroll.
 *
 * `paragraphs` is a list of strings. `bullets` is an optional list rendered as
 * a <ul>, which the product pages use heavily. Inline <strong> in the live
 * copy is not supported here on purpose: plain text with a constrained
 * formatter beats raw HTML from an editor (see CLAUDE.md conventions).
 */
export const config = {
  label: 'Text block',
  fields: {
    heading: { type: 'text' },
    sub: { type: 'textarea' },
    paragraphs: { type: 'array', arrayFields: { text: { type: 'textarea' } } },
    bullets: { type: 'array', arrayFields: { text: { type: 'text' } } },
    variant: {
      type: 'select',
      options: [
        { label: 'Glass card (homepage)', value: 'glass' },
        { label: 'Details card (product pages)', value: 'card' }
      ]
    },
    headingId: { type: 'text' }
  },
  defaultProps: {
    heading: '', sub: '', paragraphs: [], bullets: [], variant: 'glass', headingId: ''
  },
  variants: ['glass', 'card']
};

export default function TextBlock({ heading, sub, paragraphs, bullets, variant = 'glass', headingId }) {
  const id = headingId ? headingId : undefined;
  const paras = Array.isArray(paragraphs) ? paragraphs : [];
  const points = Array.isArray(bullets) ? bullets : [];
  const textOf = p => (p && typeof p === 'object' ? p.text : p);

  const body = (
    <>
      {paras.map((p, i) => <p key={i}>{textOf(p)}</p>)}
      {points.length ? <ul>{points.map((b, i) => <li key={i}>{textOf(b)}</li>)}</ul> : null}
    </>
  );

  if (variant === 'card') {
    return (
      <div className="product-details-card">
        {heading ? <h2 className="section-title" id={id}>{heading}</h2> : null}
        {sub ? <div className="section-sub">{sub}</div> : null}
        {body}
      </div>
    );
  }

  return (
    <section aria-labelledby={id}>
      <div className="container">
        {heading ? <h2 id={id} className="section-title reveal-on-scroll">{heading}</h2> : null}
        {sub ? <div className="section-sub reveal-on-scroll reveal-delay-1">{sub}</div> : null}
        <div className="company-glass-card reveal-on-scroll reveal-delay-2">{body}</div>
      </div>
    </section>
  );
}
