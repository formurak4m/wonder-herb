/* Hero - the homepage banner. Source: index.html:1 <section class="hero">.
 * Real classes: hero, container hero-grid, hero-content, hero-badge,
 * hero-stats, stat-item, stat-number, cta-group, btn-primary, btn-secondary,
 * hero-image, carousel-container, carousel-slides, carousel-btn, carousel-dots.
 *
 * One variant: the homepage has exactly one hero. Not padded to hit a quota.
 *
 * THE CAROUSEL IS PRE-RENDERED (P9, index.html). The live page ships
 * `<div class="carousel-slides" id="heroSlides">` EMPTY and fills it in
 * buildHeroCarousel() from a JS array, so with scripts off the hero's whole
 * right-hand side is blank and a crawler sees no product image at all. Given
 * `slides`, this component emits the slides and the dots that script used to
 * build, and assets/behaviour/home-hero.js drives what is already there
 * instead of rebuilding it. With no `slides` the empty shell still renders, so
 * a draft or an older tree behaves as before. Nothing here touches window or
 * document.
 *
 * A 3D SLIDE DEGRADES TO A PHOTOGRAPH. Four of the six slides are `.glb`
 * models (18-19 MB each) drawn with three.js, GLTFLoader and OrbitControls -
 * there is no <model-viewer> on this site and so no built-in poster to lean
 * on. Each model slide renders the container the loader looks for, with a real
 * <img> of the same bottle inside it, taken from the product the model shows.
 * The loader's first act is `container.innerHTML = ''`, so where WebGL works
 * nothing changes; where it does not - scripts off, no WebGL, or 19 MB still
 * in flight - the visitor keeps a photograph instead of a blank box or a
 * permanent "載入 3D 模型中...".
 *
 * THE MODEL URL IS A TREE FIELD, which is what makes Phase 10 a data edit.
 * `src` reaches the DOM as data-model and the behaviour file reads it from
 * there, naming no file itself; repointing all four at R2 is four fields in
 * Puck plus a re-render. Today those URLs are string literals inside a 5,000
 * line HTML file.
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
    primaryIcon: { type: 'text' },        // live: "fab fa-whatsapp"
    secondaryLabel: { type: 'text' },
    secondaryHref: { type: 'text' },
    secondaryIcon: { type: 'text' },
    headingId: { type: 'text' },
    showCarousel: { type: 'radio', options: [
      { label: 'Yes', value: true }, { label: 'No', value: false }
    ] },
    slides: {
      type: 'array',
      arrayFields: {
        type: { type: 'select', options: [
          { label: 'Photograph', value: 'image' },
          { label: '3D model', value: 'model' }
        ] },
        src: { type: 'text' },        // the image, or the .glb (Phase 10: repoint here)
        alt: { type: 'text' },
        poster: { type: 'text' },     // model only: what shows when 3D cannot render
        posterAlt: { type: 'text' }
      }
    },
    carouselLabel: { type: 'text' },
    slideLabel: { type: 'text' },     // "圖片" -> aria-label "圖片 1/6"
    dotLabel: { type: 'text' },       // "切換至圖片" -> each dot: "切換至圖片 1"
    dotsLabel: { type: 'text' },      // the dot strip itself: "輪播導航點"
    prevLabel: { type: 'text' },
    nextLabel: { type: 'text' }
  },
  defaultProps: {
    badge: '', heading: '', headingAccent: '', headingLine2: '', body: '',
    stats: [], primaryLabel: '', primaryHref: '', primaryIcon: '', secondaryLabel: '',
    secondaryHref: '', secondaryIcon: '', headingId: '', showCarousel: true,
    slides: [], carouselLabel: '', slideLabel: '', dotLabel: '', dotsLabel: '',
    prevLabel: '', nextLabel: ''
  },
  variants: ['default']
};

export default function Hero({
  badge, heading, headingAccent, headingLine2, body, stats,
  primaryLabel, primaryHref, primaryIcon, secondaryLabel, secondaryHref, secondaryIcon,
  headingId, showCarousel = true, slides, carouselLabel, slideLabel, dotLabel, dotsLabel,
  prevLabel, nextLabel
}) {
  const id = headingId ? headingId : undefined;
  const list = Array.isArray(stats) ? stats : [];
  const deck = Array.isArray(slides) ? slides : [];

  /* The first slide is eager: it is the hero image, above the fold. The live
     page makes the same call (`loading="${i===0?'eager':'lazy'}"`). */
  const slide = (s, i) => {
    const model = s.type === 'model';
    const inner = model
      ? (
        <div className="carousel-3d-container" data-model={s.src}>
          {s.poster
            ? <img src={s.poster} alt={s.posterAlt || s.alt || ''} loading={i === 0 ? 'eager' : 'lazy'} />
            : null}
        </div>
      )
      : <img src={s.src} alt={s.alt || ''} loading={i === 0 ? 'eager' : 'lazy'} />;
    return (
      <div key={i} className={'carousel-slide' + (i === 0 ? ' active' : '')} role="tabpanel"
           aria-label={slideLabel ? slideLabel + ' ' + (i + 1) + '/' + deck.length : undefined}>
        {inner}
      </div>
    );
  };

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
              {primaryLabel ? (
                <a href={primaryHref || '#'} className="btn-primary">
                  {primaryIcon ? <i className={primaryIcon} aria-hidden="true"></i> : null}
                  {primaryLabel}
                </a>
              ) : null}
              {secondaryLabel ? (
                <a href={secondaryHref || '#'} className="btn-secondary">
                  {secondaryIcon ? <i className={secondaryIcon} aria-hidden="true"></i> : null}
                  {secondaryLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        {showCarousel ? (
          <div className="hero-image reveal-on-scroll reveal-right">
            <div className="carousel-container" id="heroCarousel" role="region"
                 aria-roledescription="carousel" aria-label={carouselLabel || undefined}>
              <div className="glass-thickness-layer" aria-hidden="true"></div>
              <div className="carousel-slides" id="heroSlides" aria-live="polite">
                {deck.map(slide)}
              </div>
              <button className="carousel-btn prev" id="heroPrev" aria-label={prevLabel || undefined}>
                <i className="fas fa-chevron-left" aria-hidden="true"></i>
              </button>
              <button className="carousel-btn next" id="heroNext" aria-label={nextLabel || undefined}>
                <i className="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
              <div className="carousel-dots" id="heroDots" role="tablist" aria-label={dotsLabel || undefined}>
                {deck.map((s, i) => (
                  <div key={i} className={'dot' + (i === 0 ? ' active' : '')} role="tab"
                       aria-label={dotLabel ? dotLabel + ' ' + (i + 1) : undefined}
                       aria-selected={i === 0 ? 'true' : 'false'}></div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
