/* CTA band - the "talk to us" prompt.
 * Two real shapes on the live site, so two real variants:
 *
 *   banner - 聯絡我們.html:1 <div class="cta-banner">, heading + text + button
 *            (also used on account.html)
 *   button - 常見問題.html:6 <div class="cta-button">, just the button
 *
 * Real classes: cta-banner, cta-button, btn-primary.
 */
export const config = {
  label: 'CTA band',
  fields: {
    heading: { type: 'text' },
    body: { type: 'textarea' },
    label: { type: 'text' },
    href: { type: 'text' },
    icon: { type: 'text' },      // live: "fab fa-whatsapp"
    variant: {
      type: 'select',
      options: [
        { label: 'Banner with heading', value: 'banner' },
        { label: 'Button only', value: 'button' }
      ]
    }
  },
  defaultProps: { heading: '', body: '', label: '', href: '', icon: '', variant: 'banner' },
  variants: ['banner', 'button']
};

export default function CtaBand({ heading, body, label, href, icon, variant = 'banner' }) {
  const button = label ? (
    <a href={href || '#'} className="btn-primary">
      {icon ? <i className={icon} aria-hidden="true"></i> : null}
      {label}
    </a>
  ) : null;

  if (variant === 'button') {
    return <div className="cta-button">{button}</div>;
  }

  return (
    <div className="cta-banner">
      {heading ? <h2>{heading}</h2> : null}
      {body ? <p style={{ marginBottom: '24px' }}>{body}</p> : null}
      {button}
    </div>
  );
}
