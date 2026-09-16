/* Map embed - an embedded map and the address line under it.
 * Source: 聯絡我們.html:1 <div class="map-placeholder"><iframe> followed by
 * <div class="map-caption">. Real classes: map-placeholder, map-caption.
 *
 * One shape on the site, so one variant. The iframe keeps the live page's
 * loading="lazy" and its title, which is the frame's accessible name - an
 * untitled iframe is a screen-reader dead end, so `title` is not optional in
 * practice even though an empty one emits nothing.
 *
 * `src` is a full embed URL from the map provider (Google Maps "share ->
 * embed"), stored as a structural field: it is a URL, not copy, and must not
 * be translated.
 */
export const config = {
  label: 'Map',
  fields: {
    src: { type: 'text' },
    title: { type: 'text' },
    caption: { type: 'textarea' },
    captionIcon: { type: 'text' },     // live: "fas fa-map-pin"
    allowFullscreen: { type: 'radio', options: [
      { label: 'Allow fullscreen', value: true }, { label: 'No fullscreen', value: false }
    ] }
  },
  defaultProps: { src: '', title: '', caption: '', captionIcon: '', allowFullscreen: true },
  variants: ['default']
};

export default function MapEmbed({ src, title, caption, captionIcon, allowFullscreen = true }) {
  return (
    <>
      <div className="map-placeholder">
        {src ? <iframe src={src} allowFullScreen={allowFullscreen ? true : undefined}
                       loading="lazy" title={title || undefined}></iframe> : null}
      </div>
      {caption ? (
        <div className="map-caption">
          {captionIcon ? <i className={captionIcon} aria-hidden="true"></i> : null} {caption}
        </div>
      ) : null}
    </>
  );
}
