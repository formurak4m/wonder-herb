/* Gallery - the product image viewer with thumbnails.
 * Source: 產品_T3.html:9 <div class="product-gallery">, shared by all six
 * product pages (產品_PT3, 產品_T3, 產品_乙肝清, 產品_憶活素,
 * 產品_雲芝糖肽精華_A, 產品_雲芝糖肽精華_B).
 * Real classes: product-gallery, main-image, thumbnail-list, thumbnail, active.
 *
 * One variant: every product page uses the same shape.
 *
 * The thumbnails are switched by the page's existing client script, which
 * reads data-img and toggles `active`. This renders those hooks and nothing
 * else - no window, no document.
 */
export const config = {
  label: 'Gallery',
  fields: {
    images: {
      type: 'array',
      arrayFields: { src: { type: 'text' }, alt: { type: 'text' } }
    },
    mainAlt: { type: 'text' }
  },
  defaultProps: { images: [], mainAlt: '' },
  // renders nothing at all until it has content: an empty panel would be worse
  emptyWithoutContent: true,
  variants: ['default']
};

export default function Gallery({ images, mainAlt }) {
  const list = (Array.isArray(images) ? images : []).filter(i => i && i.src);
  if (!list.length) return null;
  const main = list[0];

  return (
    <div className="product-gallery">
      <div className="main-image" id="mainImageContainer">
        <img id="mainProductImage" src={main.src} alt={mainAlt || main.alt || ''} />
      </div>
      <div className="thumbnail-list" role="list" aria-label="产品缩略图">
        {list.map((img, i) => (
          <div className={i === 0 ? 'thumbnail active' : 'thumbnail'}
               data-img={img.src} role="listitem" key={i}>
            <img src={img.src} alt={img.alt || ''} />
          </div>
        ))}
      </div>
    </div>
  );
}
