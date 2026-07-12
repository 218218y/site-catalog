/**
 * Short blackout transitions between the site's separate HTML documents.
 *
 * The destination document starts behind an opaque cover before its first
 * paint. app.js removes that cover only after rendering the requested route.
 * Managed link navigation waits only for a brief fade-to-black, preventing the
 * empty document shell or footer from leaking through without showing a loader.
 */
/* global window, document, URL */
(function (global) {
  'use strict';

  var ROOT_PENDING = 'site-transition-pending';
  var ROOT_LEAVING = 'site-transition-leaving';
  var ROOT_ENTERING = 'site-transition-entering';
  var MANAGED_DOCUMENTS = new Set(['index.html', 'catalog.html', 'favorites.html', 'viewer.html']);
  var FALLBACK_COVER_DURATION_MS = 80;
  var FALLBACK_REVEAL_DURATION_MS = 130;
  var root = document.documentElement;
  var navigationStarted = false;
  var navigationTimer = 0;
  var revealTimer = 0;
  var prefetchedUrls = new Set();

  function reducedMotionRequested() {
    return Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function cssDurationMs(customProperty, fallbackDurationMs) {
    if (reducedMotionRequested()) return 0;
    if (!global.getComputedStyle) return fallbackDurationMs;

    var value = global.getComputedStyle(root).getPropertyValue(customProperty).trim();
    if (!value) return fallbackDurationMs;
    if (value.endsWith('ms')) return Math.max(0, Number.parseFloat(value) || fallbackDurationMs);
    if (value.endsWith('s')) return Math.max(0, (Number.parseFloat(value) || 0) * 1000);
    return fallbackDurationMs;
  }

  function coverDurationMs() {
    return cssDurationMs('--page-transition-cover-duration', FALLBACK_COVER_DURATION_MS);
  }

  function revealDurationMs() {
    return cssDurationMs('--page-transition-reveal-duration', FALLBACK_REVEAL_DURATION_MS);
  }

  function resolveUrl(target) {
    try {
      return new URL(String(target || ''), global.location.href);
    } catch (_error) {
      return null;
    }
  }

  function documentName(url) {
    var pathname = String(url && url.pathname || '').replace(/\/+$/, '');
    var filename = pathname.slice(pathname.lastIndexOf('/') + 1);
    return filename || 'index.html';
  }

  function isManagedUrl(target) {
    var url = target instanceof URL ? target : resolveUrl(target);
    if (!url) return false;
    if (url.protocol !== global.location.protocol) return false;
    if (url.origin !== global.location.origin) return false;
    return MANAGED_DOCUMENTS.has(documentName(url));
  }

  function isSameDocumentHash(url) {
    var current = resolveUrl(global.location.href);
    if (!current || !url.hash) return false;
    return current.origin === url.origin
      && current.pathname === url.pathname
      && current.search === url.search;
  }

  function prefetchDocument(url) {
    if (!url || !document.head || !document.createElement || prefetchedUrls.has(url.href)) return;

    var hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = url.href;
    document.head.appendChild(hint);
    prefetchedUrls.add(url.href);
  }

  function setBusy(isBusy) {
    if (!document.body) return;
    if (isBusy) document.body.setAttribute('aria-busy', 'true');
    else document.body.removeAttribute('aria-busy');
  }

  function clearTimers() {
    global.clearTimeout(navigationTimer);
    global.clearTimeout(revealTimer);
    navigationTimer = 0;
    revealTimer = 0;
  }

  function coverThen(callback) {
    if (navigationStarted) return false;
    navigationStarted = true;
    clearTimers();
    setBusy(true);

    root.classList.remove(ROOT_ENTERING);
    root.classList.remove(ROOT_PENDING);
    root.classList.add(ROOT_LEAVING);

    navigationTimer = global.setTimeout(function () {
      navigationTimer = 0;
      callback();
    }, coverDurationMs());
    return true;
  }

  function navigate(target, options) {
    var url = resolveUrl(target);
    if (!url) return false;
    var settings = options || {};

    if (isSameDocumentHash(url)) {
      if (settings.replace) global.location.replace(url.href);
      else global.location.assign(url.href);
      return true;
    }

    // Start fetching the exact destination while the short blackout runs.
    // Browsers may reuse this response for the following document navigation.
    prefetchDocument(url);

    return coverThen(function () {
      if (settings.replace) global.location.replace(url.href);
      else global.location.assign(url.href);
    });
  }

  function back() {
    return coverThen(function () {
      global.history.back();
    });
  }

  function ready() {
    navigationStarted = false;
    clearTimers();
    setBusy(false);

    var reveal = function () {
      root.classList.remove(ROOT_PENDING);
      root.classList.remove(ROOT_LEAVING);
      root.classList.add(ROOT_ENTERING);

      revealTimer = global.setTimeout(function () {
        root.classList.remove(ROOT_ENTERING);
        revealTimer = 0;
      }, revealDurationMs() + 34);
    };

    if (reducedMotionRequested() || !global.requestAnimationFrame) {
      reveal();
      return;
    }

    // Two frames guarantee that the fully covered destination is painted once
    // before the cover fades away. This is what prevents the empty footer shell
    // from leaking through during a cold document boot.
    global.requestAnimationFrame(function () {
      global.requestAnimationFrame(reveal);
    });
  }

  function shouldInterceptClick(event, anchor) {
    if (!anchor || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.hasAttribute('download')) return false;
    var target = String(anchor.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return false;

    var url = resolveUrl(anchor.getAttribute('href'));
    return Boolean(url && isManagedUrl(url) && !isSameDocumentHash(url));
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.nodeType === 1
      ? event.target
      : event.target && event.target.parentElement;
    var anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!shouldInterceptClick(event, anchor)) return;

    event.preventDefault();
    navigate(anchor.href);
  }, true);

  global.addEventListener('pageshow', function (event) {
    // A page restored from the back-forward cache retains the leaving class it
    // had when it was frozen. Reveal it again without re-running app.js.
    if (event.persisted) ready();
  });

  global.BargigPageTransition = Object.freeze({
    navigate: navigate,
    back: back,
    ready: ready,
    isManagedUrl: isManagedUrl
  });
})(window);
