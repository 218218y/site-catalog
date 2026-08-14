'use strict';

const assert = require('node:assert/strict');
const { importFrontendModule } = require('./frontend_test_module');

const api = importFrontendModule('src/js/70-viewer-input.js');

const missingPointer = new Error('missing pointer');
missingPointer.name = 'NotFoundError';
assert.equal(api.captureViewerPointer({
  setPointerCapture() { throw missingPointer; }
}, 71), false, 'synthetic pointerdown without an active browser pointer must remain non-fatal');

let releaseCalls = 0;
assert.equal(api.releaseViewerPointerCapture({
  hasPointerCapture() { return false; },
  releasePointerCapture() { releaseCalls += 1; }
}, 72), false);
assert.equal(releaseCalls, 0, 'release must not run when the element no longer owns capture');

assert.equal(api.releaseViewerPointerCapture({
  hasPointerCapture() { return true; },
  releasePointerCapture() { releaseCalls += 1; }
}, 73), true);
assert.equal(releaseCalls, 1);

assert.equal(api.releaseViewerPointerCapture({
  releasePointerCapture() { throw missingPointer; }
}, 74), false, 'implicit browser release before pointerup must remain non-fatal');

assert.throws(() => api.releaseViewerPointerCapture({
  releasePointerCapture() { throw new TypeError('unexpected'); }
}, 75), TypeError, 'unexpected pointer lifecycle defects must not be hidden');

console.log('viewer_pointer_capture_logic.test.js: PASS');
