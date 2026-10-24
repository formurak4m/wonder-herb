/* The chat widget (P13-T5) — FRONT END ONLY.
 *
 * WHAT THIS DOES AND DOES NOT DO. It owns the launcher, the panel, the message
 * list, the composer and every visible state. It owns NO answer logic: there is
 * no keyword matching, no FAQ lookup, no heuristics. That was deliberate — a
 * scripted matcher would be thrown away the moment Phase 15 adds a real answer
 * API, so it was never written.
 *
 * ===================================================================
 * THE ANSWER BOUNDARY — the one thing Phase 15 changes.
 * ===================================================================
 * `requestAnswer(text, lang)` below is the ONLY place that knows where an
 * answer comes from. It returns a typed result and nothing else in this file
 * inspects anything but `kind`. Phase 15 replaces its body with an API call;
 * the UI, the states, the strings and the markup do not move.
 *
 * Today it answers `{ kind: 'unavailable' }`, because there is no backend, and
 * the UI tells the truth about that: the input is DISABLED with a visible
 * reason, and there is no typing indicator, because nothing is typing. A dead
 * input that swallows what someone types would be worse than no widget.
 *
 * THE REFUSAL STATE IS BUILT NOW, though nothing can trigger it yet. This is a
 * health-products site: a question about treating a condition must be refused
 * and referred to a practitioner, and retrofitting that after the answers start
 * flowing is how it gets missed. The rendering path, the styling and the
 * announcement are all here and tested; Phase 15 only has to return
 * `{ kind: 'refusal' }`.
 *
 * NOTHING IS STORED. No transcript, no localStorage, no analytics. PDPO
 * retention is a Phase 15 decision and nothing may be kept before it is taken.
 */
(function () {
  'use strict';

  var panel = document.getElementById('wh-chat-panel');
  var launcher = document.getElementById('wh-chat-launcher');
  if (!panel || !launcher) return;        /* a page without the chrome: do nothing */

  var closeBtn = document.getElementById('wh-chat-close');
  var log = document.getElementById('wh-chat-log');
  var composer = document.getElementById('wh-chat-composer');
  var input = document.getElementById('wh-chat-input');

  /* The wording comes from data/site.json, rendered into the markup. Read it
     back off the DOM rather than duplicating it here, so there is exactly one
     copy of every string and changing one stays a data edit. */
  var strings = {
    refusal: panel.getAttribute('data-refusal') || '',
    error: panel.getAttribute('data-error') || '',
    offline: panel.getAttribute('data-offline') || ''
  };

  var lang = (document.documentElement.getAttribute('lang') || 'zh').toLowerCase();

  /* ------------------------------------------------- the answer boundary */

  /* Returns { kind, text }. kind is one of:
       'answer'      a real reply to show
       'refusal'     a clinical question; show the referral, never an answer
       'unavailable' there is no answer service (today's only outcome)
       'offline'     the browser says there is no network
       'error'       the request failed
     PHASE 15: replace this body with the API call. Change nothing else. */
  function requestAnswer(text, pageLang) {        // eslint-disable-line no-unused-vars
    if (navigator && navigator.onLine === false) {
      return Promise.resolve({ kind: 'offline' });
    }
    return Promise.resolve({ kind: 'unavailable' });
  }

  /* --------------------------------------------------------- rendering */

  function addMessage(kind, text) {
    if (!text) return null;
    var p = document.createElement('p');
    p.className = 'wh-chat-msg wh-chat-msg-' + kind;
    p.textContent = text;          /* textContent, never innerHTML: these
                                      strings are editable content */
    log.appendChild(p);
    scrollToEnd();
    return p;
  }

  /* Keep the newest message in view. Called after every append; on a phone the
     panel is near-full-screen, so this is the difference between seeing a
     reply and not knowing one arrived. */
  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  /* Present for Phase 15 and never shown before there is something to wait
     for. Kept here rather than invented later so the markup, the styling and
     the removal path are already proven. */
  function showTyping() {
    var el = document.createElement('div');
    el.className = 'wh-chat-typing';
    el.setAttribute('aria-hidden', 'true');   /* the result is announced, not the wait */
    el.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(el);
    scrollToEnd();
    return el;
  }

  function render(result) {
    if (!result) return;
    if (result.kind === 'refusal') return addMessage('refusal', strings.refusal);
    if (result.kind === 'offline') return addMessage('error', strings.offline);
    if (result.kind === 'error') return addMessage('error', strings.error);
    if (result.kind === 'answer') return addMessage('system', result.text);
    /* 'unavailable' is already on screen as the panel's opening message, so
       repeating it on every send would be noise rather than information. */
    return null;
  }

  /* ------------------------------------------------------------ opening */

  var lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    /* focus the close button, not the input: the input is disabled today, and
       focusing a disabled control strands a keyboard user */
    (input && !input.disabled ? input : closeBtn).focus();
    document.addEventListener('keydown', onKeydown);
    scrollToEnd();
  }

  function close() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    (lastFocus && lastFocus.focus ? lastFocus : launcher).focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(); }
  }

  launcher.addEventListener('click', function () {
    if (panel.hidden) open(); else close();
  });
  if (closeBtn) closeBtn.addEventListener('click', close);

  /* ------------------------------------------------------------ sending */

  if (composer) {
    composer.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input || input.disabled) return;      /* cannot happen today */
      var text = (input.value || '').trim();
      if (!text) return;
      addMessage('user', text);
      input.value = '';
      var typing = showTyping();
      requestAnswer(text, lang).then(function (result) {
        if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
        render(result);
      }).catch(function () {
        if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
        render({ kind: 'error' });
      });
    });
  }

  /* Exposed for test:behaviour, which asserts the refusal and error states by
     effect. They cannot be reached through the UI until Phase 15 enables the
     input, and a state nobody can reach is a state nobody has checked. */
  window.WonderHerbChat = {
    open: open,
    close: close,
    render: render,
    requestAnswer: requestAnswer
  };
})();
