/**
 * catalog-snapshot.js
 * Builds lightweight downloadable catalog-page screenshots that include the
 * same Bargig logo overlay shown in the browser UI.
 */
/* global window, Image */
(function () {
  'use strict';

  var EXPORT_MIME = 'image/jpeg';
  var EXPORT_EXTENSION = 'jpg';
  var EXPORT_QUALITY = 0.82;
  var MAX_EXPORT_EDGE = 2200;
  var LOGO_WIDTH_RATIO = 0.13;
  var LOGO_TOP_RATIO = 0.02;
  var LOGO_ASPECT_RATIO = 786 / 317;

  function snapshotAssetsRuntimeConfig() {
    var config = window.BARGIG_CATALOG_ASSETS || {};
    return (config && typeof config === 'object') ? config : {};
  }

  function snapshotCrossOriginValue(src) {
    if (!src || /^(?:data|blob):/i.test(String(src))) return '';
    var value = snapshotAssetsRuntimeConfig().crossOrigin;
    if (value === false || value === null || String(value || '').toLowerCase() === 'none') return '';
    if (!/^(?:https?:)?\/\//i.test(String(src))) return '';
    return String(value || 'anonymous').trim();
  }

  function loadSnapshotImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var crossOrigin = snapshotCrossOriginValue(src);
      if (crossOrigin) img.crossOrigin = crossOrigin;
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('image-load-failed')); };
      img.src = src;
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
    return typeof window.WP_LOGO_DATA_URI === 'string' ? window.WP_LOGO_DATA_URI : '';
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
