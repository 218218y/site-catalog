/**
 * catalog-snapshot.js
 * Builds lightweight downloadable catalog-page screenshots that include the
 * same Bargig logo overlay shown in the browser UI.
 */
/* global window, document, Image, URL */
(function () {
  'use strict';

  var EXPORT_MIME = 'image/jpeg';
  var EXPORT_EXTENSION = 'jpg';
  var EXPORT_QUALITY = 0.82;
  var MAX_EXPORT_EDGE = 2200;
  var LOGO_WIDTH_RATIO = 0.13;
  var LOGO_TOP_RATIO = 0.02;
  var LOGO_ASPECT_RATIO = 786 / 317;
  var LOGO_ASSET_PATH = 'brand-logo.svg';
  var SNAPSHOT_CORS_VERSION = '1';

  function resolveUrl(src) {
    try {
      return new URL(String(src || ''), document.baseURI || window.location.href);
    } catch (_error) {
      return null;
    }
  }

  function isCrossOriginHttpUrl(src) {
    var url = resolveUrl(src);
    if (!url || !/^https?:$/.test(url.protocol)) return false;
    return url.origin !== window.location.origin;
  }

  function withSnapshotCorsVersion(src) {
    var url = resolveUrl(src);
    if (!url) return src;
    url.searchParams.set('snapshot-cors', SNAPSHOT_CORS_VERSION);
    return url.href;
  }

  function loadSnapshotImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var imageSrc = src;

      // Canvas export requires a CORS-enabled image request whenever catalog
      // pages are served from the external R2/CDN origin. The attribute must be
      // set before src; otherwise the browser loads an opaque image that can be
      // displayed but taints the canvas when drawImage() is used.
      if (isCrossOriginHttpUrl(src)) {
        img.crossOrigin = 'anonymous';
        imageSrc = withSnapshotCorsVersion(src);
      }

      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('image-load-failed')); };
      img.src = imageSrc;
    });
  }

  function getNaturalImageSize(img) {
    return {
      width: Math.max(1, Math.round(img.naturalWidth || img.width || 1)),
      height: Math.max(1, Math.round(img.naturalHeight || img.height || 1))
    };
  }

  function getExportSize(img) {
    var size = getNaturalImageSize(img);
    var longestEdge = Math.max(size.width, size.height);
    if (longestEdge <= MAX_EXPORT_EDGE) return size;

    var scale = MAX_EXPORT_EDGE / longestEdge;
    return {
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale))
    };
  }

  function getLogoUri() {
    var url = resolveUrl(LOGO_ASSET_PATH);
    return url ? url.href : LOGO_ASSET_PATH;
  }

  function drawLogoOverlay(ctx, canvas) {
    var uri = getLogoUri();
    if (!uri) return Promise.resolve(false);

    return loadSnapshotImage(uri).then(function (logo) {
      var logoWidth = Math.max(1, Math.round(canvas.width * LOGO_WIDTH_RATIO));
      var aspectRatio = (logo.naturalWidth && logo.naturalHeight)
        ? logo.naturalWidth / logo.naturalHeight
        : LOGO_ASPECT_RATIO;
      var logoHeight = Math.max(1, Math.round(logoWidth / aspectRatio));
      var logoX = Math.round((canvas.width - logoWidth) / 2);
      var logoY = Math.max(1, Math.round(canvas.height * LOGO_TOP_RATIO));

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.16)';
      ctx.shadowBlur = Math.max(8, Math.round(canvas.width * 0.01));
      ctx.shadowOffsetY = Math.max(3, Math.round(canvas.height * 0.004));
      ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      ctx.restore();
      return true;
    }).catch(function () {
      return false;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('snapshot-blob-failed'));
      }, EXPORT_MIME, EXPORT_QUALITY);
    });
  }

  function buildSnapshotBlob(src) {
    return loadSnapshotImage(src).then(function (pageImage) {
      var canvas = document.createElement('canvas');
      var size = getExportSize(pageImage);
      canvas.width = size.width;
      canvas.height = size.height;

      var ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('snapshot-context-failed');

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(pageImage, 0, 0, canvas.width, canvas.height);

      return drawLogoOverlay(ctx, canvas).then(function () {
        return canvasToBlob(canvas);
      });
    });
  }

  window.CatalogSnapshot = {
    buildSnapshotBlob: buildSnapshotBlob,
    extension: EXPORT_EXTENSION
  };
})();
