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
 * pages put the colon INSIDE the <strong> ("標籤：" + " 內容…") while
 * the FAQ puts it outside ("標籤" + "：內容…"). The content carries
 * its own punctuation and spacing, so both render exactly as they do today.
 */
/* `text` may also be an ARRAY of lines, rendered with <br> between them. The
   live copy uses a line break inside a paragraph where two statements belong
   together but on separate lines (產品_PT3's 包裝規格: "每瓶 300 粒膠囊" then
   "大學科研配方…"). Dropping the break silently joined them into one line and
   made that paragraph half as tall - caught by the visual diff. Lines are a
   field, not markup the client types, exactly like the bold lead-in. */
function lines(text) {
  if (!Array.isArray(text)) return text;
  return text.flatMap((line, i) => i === 0 ? [line] : [<br key={'br' + i} />, line]);
}

export function copyBody(item) {
  const o = (item && typeof item === 'object') ? item : { text: item };
  if (o.label) return <><strong>{o.label}</strong>{lines(o.text)}</>;
  if (o.emphasis) return <strong>{lines(o.text)}</strong>;
  return lines(o.text);
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
        { label: 'Details card (product pages)', value: 'card' },
        { label: 'Intro line above a grid', value: 'intro' },
        { label: 'Group inside a shared card', value: 'group' }
      ]
    },
    headingId: { type: 'text' },
    blockId: { type: 'text' },     // the block's own id: product pages anchor 詳細介紹 at #detailedInfo
    spacedHeading: { type: 'radio', options: [
      { label: 'Normal', value: false }, { label: 'Extra space above', value: true }
    ] },
    spacerAfter: { type: 'radio', options: [
      { label: 'No spacer', value: false }, { label: 'Line break after', value: true }
    ] }
  },
  defaultProps: {
    heading: '', sub: '', paragraphs: [], bullets: [], variant: 'glass', headingId: '', blockId: '', spacedHeading: false, spacerAfter: false
  },
  variants: ['glass', 'card', 'intro', 'group']
};

export default function TextBlock({ heading, sub, paragraphs, bullets, variant = 'glass', headingId, blockId, spacedHeading, spacerAfter }) {
  const id = headingId ? headingId : undefined;
  const paras = Array.isArray(paragraphs) ? paragraphs : [];
  const points = Array.isArray(bullets) ? bullets : [];

  const body = (
    <>
      {paras.map((p, i) => <p key={i}>{copyBody(p)}</p>)}
      {points.length ? <ul>{points.map((b, i) => <li key={i}>{copyBody(b)}</li>)}</ul> : null}
    </>
  );

  /* group - one heading + body INSIDE a shared card, not a card of its own.
     The product pages' <div id="detailedInfo" class="product-details-card">
     holds six of these in a row (產品介紹, 產品功效及特性, 適合對象 …). The card
     itself comes from the node's wrapper, so each group is its own node and
     the client can reorder or delete one (owner, 16 Sep 2026).
     `spacedHeading` is the live inline margin on some of those headings, and
     `spacerAfter` the bare <br> the live markup puts between some groups -
     both are the page's own spacing, kept so the card's height matches. */
  if (variant === 'group') {
    return (
      <>
        {heading ? (
          <h2 className="section-title" id={id}
              style={spacedHeading ? { marginTop: '32px' } : undefined}>{heading}</h2>
        ) : null}
        {sub ? <div className="section-sub">{sub}</div> : null}
        {body}
        {spacerAfter ? <br /> : null}
      </>
    );
  }

  /* intro - 研究報告.html:1 <div class="research-intro">: a lead-in line above
     a grid, styled by that class. The live block holds plain text with no <p>
     inside it, so the copy is emitted as text; a second paragraph would run
     on, which is what the live styling does with it. */
  if (variant === 'intro') {
    return <div className="research-intro">{paras.map((p, i) => <span key={i}>{copyBody(p)}</span>)}</div>;
  }

  if (variant === 'card') {
    return (
      <div className="product-details-card" id={blockId || undefined}>
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
