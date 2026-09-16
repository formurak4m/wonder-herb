/* CTA band - the "talk to us" prompt.
 * Three real shapes on the live site, so three real variants:
 *
 *   banner     聯絡我們.html:1 <div class="cta-banner">, heading + text + button
 *              (also used on account.html)
 *   button     常見問題.html:6 <div class="cta-button">, just the button
 *   video-band index.html:3089 the 真實康復見證 block: a full-bleed background
 *              video with a dark overlay and a glass card on top carrying a
 *              heading, a line of copy and THREE buttons.
 *
 * Real classes: cta-banner, cta-button, btn-primary, case-studies-section-video,
 * case-studies-section-overlay, case-studies, shimmer-overlay,
 * glass-thickness-layer, case-action-buttons, case-btn, case-btn-primary,
 * case-btn-outline.
 *
 * video-band takes `buttons` rather than the single label/href the other two
 * use: the live block has three. The other variants ignore it.
 *
 * THE VIDEO URL IS A FIELD, not markup, and that is the point. It is hosted on
 * the client's own Wix CDN (video.wixstatic.com), which dies at cutover -
 * finding 1, Phase 10 moves it to R2. Carried as `videoUrl`, that move is one
 * data edit and a re-render; welded into this component it would be a code
 * change. Nothing here solves finding 1, it only refuses to make it worse.
 */
export const config = {
  label: 'CTA band',
  fields: {
    heading: { type: 'text' },
    body: { type: 'textarea' },
    label: { type: 'text' },
    href: { type: 'text' },
    icon: { type: 'text' },      // live: "fab fa-whatsapp"
    headingId: { type: 'text' },
    videoUrl: { type: 'text' },  // video-band; Phase 10 repoints this at R2
    videoType: { type: 'text' },
    buttons: {
      type: 'array',
      arrayFields: {
        label: { type: 'text' },
        href: { type: 'text' },
        icon: { type: 'text' },
        style: { type: 'select', options: [
          { label: 'Primary', value: 'primary' }, { label: 'Outline', value: 'outline' }
        ] }
      }
    },
    variant: {
      type: 'select',
      options: [
        { label: 'Banner with heading', value: 'banner' },
        { label: 'Button only', value: 'button' },
        { label: 'Background video band', value: 'video-band' }
      ]
    }
  },
  defaultProps: {
    heading: '', body: '', label: '', href: '', icon: '', headingId: '',
    videoUrl: '', videoType: 'video/mp4', buttons: [], variant: 'banner'
  },
  variants: ['banner', 'button', 'video-band']
};

export default function CtaBand({ heading, body, label, href, icon, headingId,
                                  videoUrl, videoType, buttons, variant = 'banner' }) {
  const button = label ? (
    <a href={href || '#'} className="btn-primary">
      {icon ? <i className={icon} aria-hidden="true"></i> : null}
      {label}
    </a>
  ) : null;

  if (variant === 'button') {
    return <div className="cta-button">{button}</div>;
  }

  if (variant === 'video-band') {
    const list = Array.isArray(buttons) ? buttons : [];
    return (
      <>
        {videoUrl ? (
          <video className="case-studies-section-video" autoPlay muted loop playsInline aria-hidden="true">
            <source src={videoUrl} type={videoType || 'video/mp4'} />
          </video>
        ) : null}
        <div className="case-studies-section-overlay" aria-hidden="true"></div>
        <div className="case-studies shimmer-overlay" id="caseStudiesCard">
          <div className="glass-thickness-layer" id="caseStudiesThicknessLayer" aria-hidden="true"></div>
          {heading ? <h2 id={headingId || undefined}>{heading}</h2> : null}
          {body ? <p>{body}</p> : null}
          {list.length ? (
            <div className="case-action-buttons" id="caseActionButtons">
              {list.map((b, i) => (
                <a key={i} href={b.href || '#'}
                   className={'case-btn case-btn-' + (b.style === 'primary' ? 'primary' : 'outline')}>
                  {b.icon ? <><i className={b.icon} aria-hidden="true"></i> </> : null}{b.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="cta-banner">
      {heading ? <h2>{heading}</h2> : null}
      {body ? <p style={{ marginBottom: '24px' }}>{body}</p> : null}
      {button}
    </div>
  );
}
