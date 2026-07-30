'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function createHarness() {
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
    }
  };

  global.window = windowObject;
  global.document = {
    baseURI: 'https://catalog.example.com/index.html',
    createElement(tagName) {
      assert.equal(tagName, 'canvas');
      return canvas;
    }
  };
  global.Image = FakeImage;
  const modulePath = path.join(__dirname, '..', 'catalog-snapshot.js');
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bargig-catalog-snapshot-'));
  const temporaryModule = path.join(temporaryDirectory, 'catalog-snapshot.mjs');
  fs.writeFileSync(temporaryModule, fs.readFileSync(modulePath, 'utf8'), 'utf8');
  const snapshotApi = (await import(pathToFileURL(temporaryModule).href)).default;
  return {
    windowObject,
    imageRequests,
    snapshotApi,
    cleanup() {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    },
  };
}

async function run() {
  {
    const harness = await createHarness();
    const blob = await harness.snapshotApi.buildSnapshotBlob(
      'https://cdn.example.com/assets/pages/catalog/page-001.webp?v=abc'
    );
    assert.equal(blob.type, 'image/jpeg');
    assert.equal(harness.imageRequests[0].crossOrigin, 'anonymous');
    assert.match(harness.imageRequests[0].src, /[?&]snapshot-cors=1(?:&|$)/);
    assert.match(harness.imageRequests[0].src, /[?&]v=abc(?:&|$)/);
    assert.equal(harness.imageRequests[1].src, 'https://catalog.example.com/brand-logo.svg');
    assert.equal(harness.imageRequests[1].crossOrigin, '');
    harness.cleanup();
  }

  {
    const harness = await createHarness();
    await harness.snapshotApi.buildSnapshotBlob(
      'https://catalog.example.com/assets/pages/catalog/page-001.webp'
    );
    assert.equal(harness.imageRequests[0].crossOrigin, '');
    assert.equal(
      harness.imageRequests[0].src,
      'https://catalog.example.com/assets/pages/catalog/page-001.webp'
    );
    harness.cleanup();
  }

  console.log('catalog_snapshot_cors.test.js: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
