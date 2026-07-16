'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return app.slice(start, end);
}

function createImage() {
  const listeners = new Map();
  const attrs = new Map();
  return {
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
    dataset: {},
    addEventListener(type, listener) { listeners.set(type, listener); },
    getAttribute(name) { return attrs.get(name) || null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    emit(type) { listeners.get(type)?.(); }
  };
}

{
  const source = sourceBetween(
    'function showSingleLightboxImage(catalog, page, src)',
    'function pad(num)'
  );
  const image = createImage();
  const frameClasses = new Set();
  const catalog = { title: 'Catalog' };
  const calls = [];
  const state = {
    singleImageLoadToken: 0,
    lightboxOpen: true,
    catalog,
    page: 4
  };
  const els = {
    lightboxImage: image,
    lightbox: { classList: { add: (value) => calls.push(['lightbox-class', value]) } },
    lightboxImageFrame: { classList: { add: (value) => frameClasses.add(value) } }
  };

  const showSingleLightboxImage = new Function(
    'els', 'state', 'finishSingleImageSwap', 'applyLightboxFrameGeometry',
    'setViewerLoading', 'prepareImagePlaceholder', 'telemetryTrackImageFailure',
    'runSingleImageSwapAnimation', 'setCatalogImageSource', 'queueMicrotask',
    `${source}; return showSingleLightboxImage;`
  )(
    els,
    state,
    (token) => calls.push(['finish', token]),
    (width, height) => calls.push(['geometry', width, height]),
    (loading) => calls.push(['loading', loading]),
    () => calls.push(['placeholder']),
    () => calls.push(['failure']),
    () => calls.push(['animation']),
    (target, src) => {
      calls.push(['source', src]);
      target.setAttribute('src', src);
    },
    (callback) => callback()
  );

  showSingleLightboxImage(catalog, 4, 'page-004.webp');
  assert.equal(image.getAttribute('src'), 'page-004.webp', 'visible image must receive src synchronously');
  assert.equal(calls.some(([name]) => name === 'finish'), false, 'load must still settle asynchronously');
  assert.equal(frameClasses.has('is-preparing-swap'), true);

  image.complete = true;
  image.naturalWidth = 2048;
  image.naturalHeight = 1188;
  image.emit('load');
  assert.deepEqual(calls.filter(([name]) => name === 'geometry').at(-1), ['geometry', 2048, 1188]);
  assert.equal(calls.some(([name]) => name === 'finish'), true);
  assert.equal(calls.some(([name]) => name === 'animation'), true);
}

{
  const source = sourceBetween(
    'function loadViewerScrollPage(page, priority = "low")',
    'function loadViewerScrollWindow(centerPage)'
  );
  const image = createImage();
  const frame = { querySelector: () => image };
  const catalog = { pages: 10 };
  const state = { viewerScrollLoadToken: 3, catalog };
  const calls = [];

  const loadViewerScrollPage = new Function(
    'isScrollViewerMode', 'state', 'getViewerScrollPageFrame', 'pageSrc',
    'prepareImagePlaceholder', 'telemetryTrackImageFailure', 'syncImagePlaceholderState',
    'setCatalogImageSource', 'queueMicrotask',
    `${source}; return loadViewerScrollPage;`
  )(
    () => true,
    state,
    () => frame,
    (_catalog, page) => `page-${page}.webp`,
    () => calls.push(['placeholder']),
    () => calls.push(['failure']),
    () => calls.push(['sync']),
    (target, src) => {
      calls.push(['source', src]);
      target.setAttribute('src', src);
    },
    (callback) => callback()
  );

  loadViewerScrollPage(4, 'high');
  assert.equal(image.getAttribute('src'), 'page-4.webp', 'scroll image must receive src synchronously');
  assert.equal(image.loading, 'eager');
  assert.equal(image.fetchPriority, 'high');

  image.complete = true;
  image.naturalWidth = 2048;
  image.naturalHeight = 1188;
  image.emit('load');
  assert.equal(image.dataset.loadedSrc, 'page-4.webp');
  assert.equal(image.dataset.loadingSrc, undefined);
  assert.equal(calls.some(([name]) => name === 'sync'), true);
}

console.log('viewer_image_loading_logic.test.js: PASS');
