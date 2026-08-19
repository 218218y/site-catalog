'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { importFrontendModule } = require('./frontend_test_module');
const { findCalls, hasCall, hasFunction, hasPropertyPath, inventoryProjectFiles } = require('./helpers/frontend_ast');

const root = path.join(__dirname, '..');
const inventories = inventoryProjectFiles(root, [
  'src/js/21-ui-runtime.js',
  'src/js/30-favorites-share.js',
  'src/js/32-shared-inquiry.js',
  'src/js/35-favorites-workspace.js',
  'src/js/40-catalog-grid.js',
  'src/js/50-search-ui.js',
  'src/js/60-viewer.js',
  'src/js/80-app-shell.js',
  'src/js/90-bootstrap.js',
]);
const hierarchyAst = inventories['src/js/21-ui-runtime.js'];
const appShellAst = inventories['src/js/80-app-shell.js'];
const bootstrapAst = inventories['src/js/90-bootstrap.js'];
const favoriteWorkspaceAst = inventories['src/js/35-favorites-workspace.js'];
const favoritesShareAst = inventories['src/js/30-favorites-share.js'];
const sharedInquiryAst = inventories['src/js/32-shared-inquiry.js'];

global.window = { location: { href: 'https://example.test/' } };
Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
global.requiredElement = () => ({});
const { handleTopLayerEscape } = importFrontendModule('src/js/21-ui-runtime.js');

function createHarness(layerResults) {
  const calls = [];
  const interfaces = layerResults.map(([name, priority, closes]) => ({
    name,
    escapePriority: priority,
    closeTopLayer() {
      calls.push(name);
      return closes;
    }
  })).sort((first, second) => second.escapePriority - first.escapePriority);
  global.featureInterfacesByEscapePriority = () => interfaces;
  const event = {
    key: 'Escape',
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }
  };
  return { calls, event };
}

assert.ok(hasPropertyPath(appShellAst, 'event.defaultPrevented'));
assert.ok(hasCall(appShellAst, 'handleTopLayerEscape'));
assert.equal(hasCall(bootstrapAst, 'handleTopLayerEscape'), false, 'bootstrap must remain a startup-only composition entry');
assert.equal(bootstrapAst.calls.some((call) => call.callee?.endsWith('.addEventListener')), false, 'bootstrap must not own browser events');
assert.ok(hasFunction(hierarchyAst, 'handleTopLayerEscape'));
assert.ok(hasCall(hierarchyAst, 'featureInterfacesByEscapePriority', 'handleTopLayerEscape'));
assert.ok(hasCall(hierarchyAst, 'api.closeTopLayer', 'handleTopLayerEscape'));

for (const [inventory, handler, closer] of [
  [favoriteWorkspaceAst, 'trapFavoriteWorkspaceDialogFocus', 'closeCallback'],
  [favoritesShareAst, 'handleFavoritesTransferKeydown', 'closeFavoritesTransferDialog'],
  [sharedInquiryAst, 'handleViewerInquiryKeydown', 'closeViewerInquiry'],
]) {
  assert.ok(hasPropertyPath(inventory, 'event.key', handler));
  assert.ok(hasCall(inventory, 'event.preventDefault', handler));
  assert.ok(hasCall(inventory, 'event.stopPropagation', handler));
  assert.ok(hasCall(inventory, closer, handler));
}

for (const [filename, name, priority] of [
  ['src/js/32-shared-inquiry.js', 'inquiry', 600],
  ['src/js/30-favorites-share.js', 'favorites', 500],
  ['src/js/40-catalog-grid.js', 'catalog-navigation', 400],
  ['src/js/50-search-ui.js', 'search', 300],
  ['src/js/40-catalog-grid.js', 'catalog-detail', 200],
  ['src/js/60-viewer.js', 'viewer', 100],
]) {
  const registration = findCalls(inventories[filename], 'registerFeatureInterface')
    .find((call) => call.arguments[0] === name);
  assert.ok(registration, `missing ${name} feature registration`);
  assert.equal(registration.objectArguments[1]?.literalProperties.escapePriority, priority);
}

{
  const harness = createHarness([
    ['inquiry', 600, false],
    ['favorites', 500, false],
    ['catalog-navigation', 400, false],
    ['search', 300, true],
    ['viewer', 100, true]
  ]);
  assert.equal(handleTopLayerEscape(harness.event), true);
  assert.deepEqual(harness.calls, ['inquiry', 'favorites', 'catalog-navigation', 'search']);
  assert.equal(harness.event.defaultPrevented, true);
}

{
  const harness = createHarness([
    ['inquiry', 600, true],
    ['favorites', 500, true],
    ['viewer', 100, true]
  ]);
  assert.equal(handleTopLayerEscape(harness.event), true);
  assert.deepEqual(harness.calls, ['inquiry'], 'the first closing feature owns the Escape event');
}

{
  const harness = createHarness([['viewer', 100, true]]);
  harness.event.defaultPrevented = true;
  assert.equal(handleTopLayerEscape(harness.event), false);
  assert.deepEqual(harness.calls, [], 'a child-owned Escape must not reach feature layers');
}

console.log('escape_layering_contract.test.js: PASS');
