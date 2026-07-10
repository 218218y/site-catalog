'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'catalog-snapshot.js'), 'utf8');

function createHarness() {
  const imageRequests = [];
  let canvasTainted = false;

  class FakeImage {
    constructor() {
      this.crossOrigin = '';
      this.naturalWidth = 2800;
      this.naturalHeight = 2008;
      this.width = this.naturalWidth;
      this.height = this.naturalHeight;
      this.onload = null;
      this.onerror = null;
    }

    set src(value) {
      this._src = String(value);
      const url = new URL(this._src, 'https://catalog.example.com/');
      this.isCrossOriginHttp = /^https?:$/.test(url.protocol) && url.origin !== 'https://catalog.example.com';
      imageRequests.push({ src: this._src, crossOrigin: this.crossOrigin });
      queueMicrotask(() => this.onload && this.onload());
    }

    get src() {
      return this._src;
    }
  }

  const context2d = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    fillRect() {},
    save() {},
    restore() {},
    drawImage(image) {
      if (image.isCrossOriginHttp && image.crossOrigin !== 'anonymous') {
        canvasTainted = true;
      }
    }
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext() { return context2d; },
    toBlob(callback) {
      callback(canvasTainted ? null : { type: 'image/jpeg', size: 123 });
    }
  };

  const windowObject = {
    location: {
      origin: 'https://catalog.example.com',
      href: 'https://catalog.example.com/index.html'
    },
    WP_LOGO_DATA_URI: 'data:image/png;base64,AA=='
  };

  const context = vm.createContext({
    window: windowObject,
    document: {
      baseURI: 'https://catalog.example.com/index.html',
      createElement(tagName) {
        assert.equal(tagName, 'canvas');
        return canvas;
      }
    },
    Image: FakeImage,
    URL,
    Promise,
    Math,
    String,
    Error,
    queueMicrotask
  });

  vm.runInContext(source, context, { filename: 'catalog-snapshot.js' });
  return { windowObject, imageRequests };
}

async function run() {
  {
    const harness = createHarness();
    const blob = await harness.windowObject.CatalogSnapshot.buildSnapshotBlob(
      'https://cdn.example.com/assets/pages/catalog/page-001.webp?v=abc'
    );
    assert.equal(blob.type, 'image/jpeg');
    assert.equal(harness.imageRequests[0].crossOrigin, 'anonymous');
    assert.match(harness.imageRequests[0].src, /[?&]snapshot-cors=1(?:&|$)/);
    assert.match(harness.imageRequests[0].src, /[?&]v=abc(?:&|$)/);
    assert.equal(harness.imageRequests[1].src, 'data:image/png;base64,AA==');
  }

  {
    const harness = createHarness();
    await harness.windowObject.CatalogSnapshot.buildSnapshotBlob(
      'https://catalog.example.com/assets/pages/catalog/page-001.webp'
    );
    assert.equal(harness.imageRequests[0].crossOrigin, '');
    assert.equal(
      harness.imageRequests[0].src,
      'https://catalog.example.com/assets/pages/catalog/page-001.webp'
    );
  }

  console.log('catalog_snapshot_cors.test.js: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
