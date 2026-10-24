/* assets/behaviour/product-detail.js - the buy panel on a product page.
 *
 * Loaded only on pages whose tree contains a product-detail section
 * (renderer/template.js BEHAVIOURS). Needs assets/site.js, which loads first.
 *
 * The product-grid has quick-view.js; a detail page has this. Without it the
 * page publishes with a dead "加入購物車" button - the finding 23 failure, which
 * is silent: nothing throws, the page looks right, and the cart never fills.
 *
 * Everything it needs is already in the pre-rendered panel, as data hooks on
 * .product-info: data-sku, data-price, data-status and data-clinic-only, the
 * same four the cards carry. Identity is the SKU, never a database id
 * (findings 19, 23). There is no product table in this file to drift.
 *
 * REFUSALS ARE SHOWN, NOT SWALLOWED. A product the cart refuses (out of stock,
 * clinic-only, price held) gets the owner-approved message in a live region
 * beside the button, and the button stays put so the reason is next to what
 * was pressed - the same rule quick-view.js follows inside the modal. Never
 * alert(). A clinic-only product does not even render an enabled button
 * (sections/ProductDetail.jsx), so in practice this path is stock and holds.
 */
(function () {
  'use strict';

  var panel = document.querySelector('.product-info[data-sku]');
  if (!panel) return;
  var btn = document.getElementById('addToCartBtn');
  if (!btn) return;                       // clinic-only panel: nothing to bind

  var qty = document.getElementById('quantity');

  /* One live region under the buttons, created on demand so the panel's markup
     stays clean when nothing has gone wrong. */
  var message = null;
  function say(text) {
    if (!text) {
      if (message) { message.remove(); message = null; }
      return;
    }
    if (!message) {
      message = document.createElement('p');
      message.id = 'addMessage';
      message.className = 'add-message';
      message.setAttribute('role', 'alert');
      message.style.cssText = 'margin:12px 0 0;padding:10px 12px;border-radius:6px;background:#fdf3e7;' +
                              'color:#6b3d00;border:1px solid #f0c98f;font-size:0.95rem;line-height:1.5';
      var actions = btn.parentNode;
      actions.parentNode.insertBefore(message, actions.nextSibling);
    }
    message.textContent = text;
  }

  function productFromPanel() {
    var title = panel.querySelector('.product-title');
    var photo = document.querySelector('.product-gallery .main-image img, .product-gallery img');
    return {
      sku: panel.getAttribute('data-sku'),
      price: panel.getAttribute('data-price'),
      status: panel.getAttribute('data-status'),
      clinicOnly: panel.hasAttribute('data-clinic-only'),
      name: title ? title.textContent.trim() : '',
      image: photo ? photo.getAttribute('src') : ''
    };
  }

  btn.addEventListener('click', function () {
    if (!window.WonderHerb) {
      console.error('[wonder-herb] product detail: assets/site.js is not loaded, cannot add to cart');
      return;
    }
    var result = window.WonderHerb.add(productFromPanel(), qty ? qty.value : 1);
    if (!result.ok) { say(result.message); return; }
    say('');
    window.WonderHerb.notify(result.message);
  });

  if (qty) qty.addEventListener('input', function () { say(''); });
})();
