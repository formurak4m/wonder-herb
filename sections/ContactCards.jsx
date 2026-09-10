/* Contact cards - the offices and distributors grid.
 * Source: 聯絡我們.html:1 <div class="contact-grid">, five cards
 * (亞洲總部, 中國辦事處, 加拿大分銷商, 澳洲分銷商, 美國分銷商).
 * Real classes: contact-grid, contact-card, contact-icon, contact-detail.
 *
 * One variant: all five cards share one shape. The differences between them
 * are data, not layout - the HQ card has a company line (<h4>) and the others
 * do not, and each has a different number of detail rows. Both are handled by
 * optional fields rather than by inventing variants.
 *
 * Each detail row is { icon, text, href } - the live markup wraps the address,
 * the WhatsApp number and the email in links, and leaves the phone as plain
 * text, and every row opens with a FontAwesome glyph:
 *
 *   <div class="contact-detail"><i class="fas fa-map-marker-alt"></i><span>…</span></div>
 *
 * The icon is markup, not decoration that can be skipped: the live grid has
 * fifteen of them (fas fa-map-marker-alt / fa-phone-alt / fa-user, fab
 * fa-whatsapp / fa-envelope) and the row layout is built around one. Leaving
 * them out is what the P4-T3 fidelity check now catches.
 */
export const config = {
  label: 'Contact cards',
  fields: {
    cards: {
      type: 'array',
      arrayFields: {
        flag: { type: 'text' },
        flagAlt: { type: 'text' },
        title: { type: 'text' },
        company: { type: 'text' },
        details: {
          type: 'array',
          arrayFields: {
            icon: { type: 'text' },   // e.g. "fas fa-map-marker-alt", "fab fa-whatsapp"
            text: { type: 'text' },
            href: { type: 'text' }
          }
        }
      }
    }
  },
  defaultProps: { cards: [] },
  variants: ['default']
};

export default function ContactCards({ cards }) {
  const list = Array.isArray(cards) ? cards : [];

  return (
    <div className="contact-grid">
      {list.map((c, i) => (
        <article className="contact-card" key={i}>
          {c.flag ? (
            <div className="contact-icon">
              <img src={c.flag} alt={c.flagAlt || ''} loading="lazy" />
            </div>
          ) : null}
          {c.title ? <h3>{c.title}</h3> : null}
          {c.company ? <h4>{c.company}</h4> : null}
          {(Array.isArray(c.details) ? c.details : []).map((d, j) => (
            <div className="contact-detail" key={j}>
              {d.icon ? <i className={d.icon} aria-hidden="true"></i> : null}
              <span>{d.href ? <a href={d.href}>{d.text}</a> : d.text}</span>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
