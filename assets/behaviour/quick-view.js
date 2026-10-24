/* assets/behaviour/quick-view.js - the product-grid section's quick view.
 *
 * Loaded only on pages whose tree contains a product-grid (renderer/template.js
 * BEHAVIOURS). Needs assets/site.js, which loads first.
 *
 * On 產品介紹 this modal is the ONLY way to buy (docs/FINDINGS.md finding 23).
 *
 * Everything it shows comes from the card the visitor clicked, found by SKU:
 * the title, price text, description and photo are already in the pre-rendered
 * card, so there is no product table here to drift from the page, and nothing
 * is built with innerHTML. The modal markup itself is emitted, hidden, by
 * sections/ProductGrid.jsx.
 */
(function () {
  'use strict';

  var modal = document.getElementById('quickViewModal');
  var grid = document.getElementById('productGrid');
  if (!modal || !grid) return;

  var img = document.getElementById('modalImage');
  var title = document.getElementById('modalTitle');
  var price = document.getElementById('modalPrice');
  var desc = document.getElementById('modalDesc');
  var qty = document.getElementById('modalQty');
  var addBtn = document.getElementById('modalAddToCart');
  var message = document.getElementById('modalMessage');
  var closeBtn = modal.querySelector('.close-modal');
  var lastFocus = null;

  /* A refusal is shown INSIDE the modal, next to the button the visitor just
     pressed, and the modal stays open - they read why, and can close it. It is a
     role="alert" region, so a screen reader announces it. No alert(). */
  function say(text) {
    if (!message) return;
    message.textContent = text || '';
    message.hidden = !text;
    message.style.cssText = text
      ? 'margin:12px 0 0;padding:10px 12px;border-radius:6px;background:#fdf3e7;color:#6b3d00;' +
        'border:1px solid #f0c98f;font-size:0.95rem;line-height:1.5'
      : '';
  }

  function text(card, sel) {
    var el = card.querySelector(sel);
    return el ? el.textContent.trim() : '';
  }

  function cardFor(sku) {
    var cards = grid.querySelectorAll('.product-card[data-sku]');
    for (var i = 0; i < cards.length; i++) if (cards[i].getAttribute('data-sku') === sku) return cards[i];
    return null;
  }

  function productFrom(card) {
    var photo = card.querySelector('.product-image img');
    return {
      sku: card.getAttribute('data-sku'),
      price: card.getAttribute('data-price'),
      status: card.getAttribute('data-status'),
      clinicOnly: card.hasAttribute('data-clinic-only'),
      name: text(card, '.product-title'),
      image: photo ? photo.getAttribute('src') : ''
    };
  }

  function open(sku) {
    var card = cardFor(sku);
    if (!card) { console.error('[wonder-herb] quick view: no card for SKU ' + sku); return; }
    var photo = card.querySelector('.product-image img');
    modal.setAttribute('data-sku', sku);
    if (photo) { img.src = photo.getAttribute('src'); img.alt = photo.getAttribute('alt') || ''; img.hidden = false; }
    else { img.removeAttribute('src'); img.hidden = true; }
    title.textContent = text(card, '.product-title');
    price.textContent = text(card, '.product-price');
    desc.textContent = text(card, '.product-desc');
    qty.value = 1;
    say('');
    lastFocus = document.activeElement;
    modal.style.display = 'flex';
    addBtn.focus();
  }

  function close() {
    modal.style.display = 'none';
    modal.removeAttribute('data-sku');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.btn-quickview[data-sku]') : null;
    if (btn) open(btn.getAttribute('data-sku'));
  });

  addBtn.addEventListener('click', function () {
    var sku = modal.getAttribute('data-sku');
    var card = sku && cardFor(sku);
    if (!card) return;
    if (!window.WonderHerb) {
      console.error('[wonder-herb] quick view: assets/site.js is not loaded, cannot add to cart');
      return;
    }
    var result = window.WonderHerb.add(productFrom(card), qty.value);
    if (!result.ok) { say(result.message); return; }     // stay open: the reason is right here
    close();
    window.WonderHerb.notify(result.message);
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', close);
    closeBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } });
  }
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') close();
  });
})();
