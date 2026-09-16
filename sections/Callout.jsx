/* Callout - one boxed aside with a heading, a line of copy and a link.
 * Two real shapes on the live site, so two real variants, both from
 * 常見問題.html (P9, page two):
 *
 *   highlight - <div class="highlight-box">: an h3 with an icon, a <p>, and
 *               the link as a button (<a class="expert-link">, icon before and
 *               an arrow after, opens in a new tab)
 *   note      - <div class="faq-item" style="background: #f1fffe;">: styled
 *               like an FAQ entry (h3.faq-question + div.faq-answer), with the
 *               link INLINE at the end of the sentence
 *
 * Real classes: highlight-box, expert-link, faq-item, faq-question, faq-answer.
 * The inline styles are the live page's own (the icon colour in the highlight
 * heading, the note's tint and its link colour); they are part of the variant,
 * not fields, so the client picks a shape rather than typing CSS.
 *
 * THE INLINE LINK. The note's link sits mid-sentence: "…詳情請參考<a>…</a>。"
 * Rather than accept markup in `body`, the sentence is three plain fields -
 * `body`, the link `label`, and `after` (the text that follows the link) - the
 * same structural answer copyBody gives bold lead-ins (finding 14, option c).
 *
 * Dropped on purpose: the live link's aria-label ("打开微信文章：专科医生解答",
 * Simplified Chinese on a Traditional page). Without it the accessible name is
 * the visible label, which says the same thing in the page's own script.
 */
export const config = {
  label: 'Callout',
  fields: {
    heading: { type: 'text' },
    icon: { type: 'text' },        // live: "fas fa-video", "fas fa-university"
    body: { type: 'textarea' },
    label: { type: 'text' },       // the link's text
    href: { type: 'text' },
    linkIcon: { type: 'text' },    // highlight only; live: "fab fa-weixin"
    after: { type: 'text' },       // note only: text after the inline link
    variant: {
      type: 'select',
      options: [
        { label: 'Highlight box with button', value: 'highlight' },
        { label: 'Tinted note with inline link', value: 'note' },
        { label: 'One-line info bar', value: 'info' }
      ]
    }
  },
  defaultProps: {
    heading: '', icon: '', body: '', label: '', href: '', linkIcon: '', after: '', variant: 'highlight'
  },
  variants: ['highlight', 'note', 'info']
};

const icon = (cls, style) =>
  cls ? <i className={cls} style={style} aria-hidden="true"></i> : null;

export default function Callout({ heading, icon: iconClass, body, label, href, linkIcon, after, variant = 'highlight' }) {
  /* info - 微信發表文章.html:1 <div class="info-note">: one line of text in a
     tinted bar, no heading and no link. */
  if (variant === 'info') {
    return <div className="info-note"><span>{body}</span></div>;
  }

  if (variant === 'note') {
    return (
      <div className="faq-item" style={{ background: '#f1fffe' }}>
        <h3 className="faq-question">
          {icon(iconClass)} <span>{heading}</span>
        </h3>
        <div className="faq-answer">
          <p>
            {body}
            {label ? <a href={href || '#'} style={{ color: '#2EADA5', fontWeight: 500 }}>{label}</a> : null}
            {after}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="highlight-box">
      <h3>{icon(iconClass, { color: '#9b2e2e', marginRight: '8px' })} <span>{heading}</span></h3>
      {body ? <p>{body}</p> : null}
      {label ? (
        <a href={href || '#'} target="_blank" rel="noopener" className="expert-link">
          {icon(linkIcon)} <span>{label}</span> <i className="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
      ) : null}
    </div>
  );
}
