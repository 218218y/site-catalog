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

const placeholderFrameSource = sourceBetween(
  'function imagePlaceholderFrame(img)',
  'function syncImagePlaceholderState(img)'
);
const imagePlaceholderFrame = new Function(
  'IMAGE_PLACEHOLDER_POLICY_PRESERVE_FRAME',
  'IMAGE_PLACEHOLDER_FRAME_SELECTOR',
  `${placeholderFrameSource}; return imagePlaceholderFrame;`
)('preserve-frame', '.frame');

let closestCalls = 0;
assert.equal(imagePlaceholderFrame({
  dataset: { placeholderPolicy: 'preserve-frame' },
  closest() {
    closestCalls += 1;
    return { id: 'unexpected' };
  }
}), null);
assert.equal(closestCalls, 0, 'silent resolution layers must not inspect or mutate the shared placeholder frame');

const regularFrame = { id: 'regular-frame' };
assert.equal(imagePlaceholderFrame({
  dataset: {},
  closest(selector) {
    assert.equal(selector, '.frame');
    return regularFrame;
  }
}), regularFrame);

const recoverySource = sourceBetween(
  'function loadCatalogImageWithRecovery(img, options = {})',
  'function prepareCatalogImage(url, options = {})'
);

async function runRecovery(managePlaceholder) {
  let prepareCalls = 0;
  let syncCalls = 0;
  const listeners = new Map();
  const img = {
    dataset: {},
    complete: false,
    naturalWidth: 0,
    src: '',
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    getAttribute(name) {
      return name === 'src' ? this.src : null;
    }
  };

  const loadCatalogImageWithRecovery = new Function(
    'catalogImageRecoveryCandidates',
    'telemetryCleanText',
    'prepareImagePlaceholder',
    'syncImagePlaceholderState',
    'telemetryTrackImageAttemptFailure',
    'telemetryTrackImageRecovery',
    'telemetryTrackImageTerminalFailure',
    'setCatalogImageSource',
    `${recoverySource}; return loadCatalogImageWithRecovery;`
  )(
    () => [{ src: 'https://cdn.example.test/full.webp', role: 'primary', tier: 'full' }],
    () => '',
    () => { prepareCalls += 1; },
    () => { syncCalls += 1; },
    () => {},
    () => {},
    () => {},
    (target, src) => {
      target.src = src;
      queueMicrotask(() => {
        target.complete = true;
        target.naturalWidth = 2800;
        listeners.get('load')?.();
      });
    }
  );

  await new Promise((resolve, reject) => {
    loadCatalogImageWithRecovery(img, {
      primarySrc: 'https://cdn.example.test/full.webp',
      managePlaceholder,
      onSuccess: resolve,
      onExhausted: () => reject(new Error('unexpected image load exhaustion'))
    });
  });

  return { prepareCalls, syncCalls, pending: img.dataset.imageLoadPending };
}

(async () => {
  const silent = await runRecovery(false);
  assert.deepEqual(silent, { prepareCalls: 0, syncCalls: 0, pending: undefined });

  const managed = await runRecovery(true);
  assert.ok(managed.prepareCalls > 0);
  assert.ok(managed.syncCalls > 0);
  assert.equal(managed.pending, undefined);

  console.log('viewer_resolution_upgrade_placeholder_logic.test.js: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
