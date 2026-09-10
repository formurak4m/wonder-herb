/* Hero - the homepage banner. Source: index.html:1 <section class="hero">.
 * Real classes: hero, container hero-grid, hero-content, hero-badge,
 * hero-stats, stat-item, stat-number, cta-group, btn-primary, btn-secondary,
 * hero-image, carousel-container, carousel-slides, carousel-btn, carousel-dots.
 *
 * One variant: the homepage has exactly one hero. Not padded to hit a quota.
 *
 * The canvas and the carousel are enhanced by the page's existing client
 * script after load - here they are emitted as the empty elements that script
 * expects, which is the placeholder pattern the contract calls for. Nothing in
 * this component touches window or document.
 */
export const config = {
  label: 'Hero',
  fields: {
    badge: { type: 'text' },
    heading: { type: 'text' },
    headingAccent: { type: 'text' },
    headingLine2: { type: 'text' },
    body: { type: 'textarea' },
    stats: {
      type: 'array',
      arrayFields: { number: { type: 'text' }, label: { type: 'text' } }
    },
    primaryLabel: { type: 'text' },
    primaryHref: { type: 'text' },
    secondaryLabel: { type: 'text' },
    secondaryHref: { type: 'text' },
    headingId: { type: 'text' },
    showCarousel: { type: 'radio', options: [
      { label: 'Yes', value: true }, { label: 'No', value: false }
    ] }
  },
  defaultProps: {
    badge: '', heading: '', headingAccent: '', headingLine2: '', body: '',
    stats: [], primaryLabel: '', primaryHref: '', secondaryLabel: '',
    secondaryHref: '', headingId: '', showCarousel: true
  },
  variants: ['default']
};

export default function Hero({
  badge, heading, headingAccent, headingLine2, body, stats,
  primaryLabel, primaryHref, secondaryLabel, secondaryHref,
  headingId, showCarousel = true
}) {
  const id = headingId ? headingId : undefined;
  const list = Array.isArray(stats) ? stats : [];

  return (
    <section className="hero" id="heroSection" aria-labelledby={id}>
      <canvas id="heroCanvas" aria-hidden="true"></canvas>
      <div className="container hero-grid">
        <div className="hero-content reveal-on-scroll reveal-left">
          {badge ? <div className="hero-badge">{badge}</div> : null}
          <h1 id={id}>
            <span>
              {heading}
              {headingAccent ? <span style={{ color: '#9b2e2e' }}>{headingAccent}</span> : null}
              {headingLine2 ? <><br />{headingLine2}</> : null}
            </span>
          </h1>
          {body ? <p>{body}</p> : null}
          {list.length ? (
            <div className="hero-stats">
              {list.map((s, i) => (
                <div className="stat-item" key={i}>
                  <div className="stat-number">{s.number}</div>
                  <div>{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}
          {primaryLabel || secondaryLabel ? (
            <div className="cta-group">
              {primaryLabel ? <a href={primaryHref || '#'} className="btn-primary">{primaryLabel}</a> : null}
              {secondaryLabel ? <a href={secondaryHref || '#'} className="btn-secondary">{secondaryLabel}</a> : null}
            </div>
          ) : null}
        </div>
        {showCarousel ? (
          <div className="hero-image reveal-on-scroll reveal-right">
            <div className="carousel-container" id="heroCarousel" role="region"
                 aria-roledescription="carousel" aria-label="產品形象輪播展示">
              <div className="glass-thickness-layer" aria-hidden="true"></div>
              <div className="carousel-slides" id="heroSlides" aria-live="polite"></div>
              <button className="carousel-btn prev" id="heroPrev" aria-label="上一張圖片"></button>
              <button className="carousel-btn next" id="heroNext" aria-label="下一張圖片"></button>
              <div className="carousel-dots" id="heroDots" role="tablist" aria-label="輪播導航點"></div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
