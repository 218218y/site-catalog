'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles } = require('./frontend_test_assets');
const { importFrontendTestModule } = require('./frontend_test_module');

const root = path.join(__dirname, '..');
const hierarchySource = fs.readFileSync(path.join(root, 'src', 'js', '20-shared-ui.js'), 'utf8');
const appShell = fs.readFileSync(path.join(root, 'src', 'js', '80-app-shell.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'src', 'js', '90-bootstrap.js'), 'utf8');
const app = readAllBundles();
const favoriteWorkspace = fs.readFileSync(path.join(root, 'src', 'js', '35-favorites-workspace.js'), 'utf8');
const favoritesShare = fs.readFileSync(path.join(root, 'src', 'js', '30-favorites-share.js'), 'utf8');
const catalogGrid = fs.readFileSync(path.join(root, 'src', 'js', '40-catalog-grid.js'), 'utf8');
const searchUi = fs.readFileSync(path.join(root, 'src', 'js', '50-search-ui.js'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'src', 'js', '60-viewer.js'), 'utf8');
const sharedInquiry = fs.readFileSync(path.join(root, 'src', 'js', '32-shared-inquiry.js'), 'utf8');

global.window = { BARGIG_CATALOG_TAXONOMY: { categories: [], subcategories: [] }, location: { href: 'https://example.test/' } };
Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
global.requiredElement = () => ({});
const { handleTopLayerEscape } = importFrontendTestModule('src/js/20-shared-ui.js', 'shared-ui');

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

assert.match(appShell, /if \(event\.defaultPrevented\) return;\s*if \(handleTopLayerEscape\(event\)\) return;/);
assert.doesNotMatch(bootstrap, /addEventListener|handleTopLayerEscape/, 'bootstrap must remain a startup-only composition entry');
assert.match(hierarchySource, /function handleTopLayerEscape\(event\)/);
assert.match(hierarchySource, /for \(const api of featureInterfacesByEscapePriority\(\)\)/);
assert.match(favoriteWorkspace, /event\.key === "Escape"[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?closeCallback\(\)/);
assert.match(favoritesShare, /function handleFavoritesTransferKeydown\(event\)[\s\S]*?event\.key === "Escape"[\s\S]*?event\.stopPropagation\(\);[\s\S]*?closeFavoritesTransferDialog/);
assert.match(sharedInquiry, /function handleViewerInquiryKeydown\(event\)[\s\S]*?event\.key === "Escape"[\s\S]*?event\.stopPropagation\(\);[\s\S]*?closeViewerInquiry\(\)/);

for (const [source, name, priority] of [
  [sharedInquiry, 'inquiry', 600],
  [favoritesShare, 'favorites', 500],
  [catalogGrid, 'catalog-navigation', 400],
  [searchUi, 'search', 300],
  [catalogGrid, 'catalog-detail', 200],
  [viewer, 'viewer', 100]
]) {
  assert.match(source, new RegExp(`registerFeatureInterface\\("${name}",[\\s\\S]*?escapePriority: ${priority}`));
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
