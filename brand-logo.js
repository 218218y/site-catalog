/**
 * brand-logo.js
 * Applies the embedded Bargig logo from wp_logo_data.js to the site UI and
 * exposes it as a CSS variable for non-destructive catalog image watermarks.
 */
/* global window, document */
(function () {
  'use strict';

  function getLogoUri() {
    return typeof window.WP_LOGO_DATA_URI === 'string' ? window.WP_LOGO_DATA_URI : '';
  }

  function cssUrl(value) {
    return 'url("' + String(value).replace(/"/g, '%22') + '")';
  }

  function applyBargigLogo() {
    var uri = getLogoUri();
    if (!uri) return;

    document.documentElement.style.setProperty('--bargig-logo-url', cssUrl(uri));
    document.documentElement.classList.add('has-bargig-logo');

    var logos = document.querySelectorAll('img[data-brand-logo="1"], img[data-wp-logo="1"], #wpHeaderLogo');
    for (var i = 0; i < logos.length; i += 1) {
      var img = logos[i];
      img.setAttribute('src', uri);
      if (!img.getAttribute('alt')) img.setAttribute('alt', 'רהיטי ברגיג');
      img.decoding = 'async';
    }
  }

  window.applyBargigLogo = applyBargigLogo;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBargigLogo);
  } else {
    applyBargigLogo();
  }
})();
