/* Page header - the banner at the top of an inner page.
 *
 * Taken from the live markup, not invented. Ten of the eighteen pages already
 * share this block; 產品介紹.html is the reference:
 *
 *   <section class="page-header" aria-labelledby="products-heading">
 *     <div class="container">
 *       <h1 id="products-heading">產品系列</h1>
 *       <p>加拿大GMP藥廠 · 有效成份 >90% · 大學研究證實</p>
 *     </div>
 *   </section>
 *
 * The class names are the existing ones (`page-header`, `container`,
 * `video-background`), so the current stylesheet styles this unchanged. Note
 * they are NOT the `wh-`prefixed names in the BUILD_TASKS sample - those do
 * not exist in this site's CSS.
 *
 * Two real variants, both observed in the live pages:
 *   centered - the plain banner, nine pages
 *   video    - the same banner over a looping background video, 研究報告.html
 *
 * The `data-i18n` attributes on the live markup are deliberately not emitted.
 * They exist so the browser can swap languages after load; a pre-rendered page
 * already has the right language baked in, and the language switch becomes
 * plain links. That is the point of the renderer.
 *
 * Pure: no window, no document, no effects. It renders on the server.
 *
 * One quirk of the video variant: React 19 writes `autoPlay=""` and
 * `playsInline=""` in camelCase instead of lowercasing them. HTML attribute
 * names are case-insensitive, so browsers parse them identically - checked in
 * a real browser, `hasAttribute('autoplay')` and `video.autoplay` are both
 * true. Cosmetic only, but expect it when diffing published HTML against the
 * hand-written original.
 */
export const config = {
  label: 'Page header',
  fields: {
    heading: { type: 'text' },
    sub: { type: 'textarea' },
    variant: {
      type: 'select',
      options: [
        { label: 'Centered', value: 'centered' },
        { label: 'Background video', value: 'video' }
      ]
    },
    headingId: { type: 'text' },
    videoUrl: { type: 'text' }
  },
  defaultProps: {
    heading: '',
    sub: '',
    variant: 'centered',
    headingId: '',
    videoUrl: ''
  },
  variants: ['centered', 'video']
};

export default function PageHeader({ heading, sub, variant = 'centered', headingId, videoUrl }) {
  // an empty id must not become id="" - some pages have no aria-labelledby
  const id = headingId ? headingId : undefined;
  const showVideo = variant === 'video' && !!videoUrl;

  return (
    <section className="page-header" aria-labelledby={id}>
      {showVideo ? (
        <video className="video-background" autoPlay muted loop playsInline aria-hidden="true">
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : null}
      <div className="container">
        <h1 id={id}>{heading}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
    </section>
  );
}
