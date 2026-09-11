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
 * `paragraphs` and `bullets` hold COPY ITEMS, not plain strings. See copyBody
 * below: a bold lead-in is a field, not markup the client has to type.
 */

/* A copy item is a plain string, or { label, text, emphasis }:
 *
 *   label     a bold lead-in   -> <strong>{label}</strong>{text}
 *   emphasis  the whole item is bold
 *   neither   plain text
 *
 * This is the structural answer to inline formatting (docs/FINDINGS.md finding
 * 14, option c). 42 of the 54 bold runs in the site's body copy are this one
 * lead-in pattern, so it is modelled as structure rather than parsed back out
 * of a string - no markdown, nothing for a client typing Chinese through an
 * IME to get wrong.
 *
 * No separator is inserted between label and text on purpose: the product
 * pages put the colon INSIDE the <strong> ("超強抗氧化：" + " 比一般…") while
 * the FAQ puts it outside ("獨特提取技術" + "：在生產…"). The content carries
 * its own punctuation and spacing, so both render exactly as they do today.
 */
export function copyBody(item) {
  const o = (item && typeof item === 'object') ? item : { text: item };
  if (o.label) return <><strong>{o.label}</strong>{o.text}</>;
  if (o.emphasis) return <strong>{o.text}</strong>;
  return o.text;
}

export const config = {
  label: 'Text block',
  fields: {
    heading: { type: 'text' },
    sub: { type: 'textarea' },
    paragraphs: {
      type: 'array',
      arrayFields: {
        label: { type: 'text' },        // bold lead-in, optional
        text: { type: 'textarea' },
        emphasis: { type: 'radio', options: [
          { label: 'Normal', value: false }, { label: 'Bold', value: true }
        ] }
      }
    },
    bullets: {
      type: 'array',
      arrayFields: {
        label: { type: 'text' },        // bold lead-in, optional
        text: { type: 'text' }
      }
    },
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

  const body = (
    <>
      {paras.map((p, i) => <p key={i}>{copyBody(p)}</p>)}
      {points.length ? <ul>{points.map((b, i) => <li key={i}>{copyBody(b)}</li>)}</ul> : null}
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
