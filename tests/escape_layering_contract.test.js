'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readAllBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const hierarchySource = fs.readFileSync(path.join(root, 'src', 'js', '20-shared-ui.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'src', 'js', '90-bootstrap.js'), 'utf8');
const app = readAllBundles();
const favoriteWorkspace = fs.readFileSync(path.join(root, 'src', 'js', '35-favorites-workspace.js'), 'utf8');
const favoritesShare = fs.readFileSync(path.join(root, 'src', 'js', '30-favorites-share.js'), 'utf8');
const catalogGrid = fs.readFileSync(path.join(root, 'src', 'js', '40-catalog-grid.js'), 'utf8');
const searchUi = fs.readFileSync(path.join(root, 'src', 'js', '50-search-ui.js'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'src', 'js', '60-viewer.js'), 'utf8');
const sharedInquiry = fs.readFileSync(path.join(root, 'src', 'js', '32-shared-inquiry.js'), 'utf8');

function extractFunction(text, name) {
  const signature = `function ${name}(`;
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = text.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

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
  const context = {
    featureInterfacesByEscapePriority: () => interfaces
  };
  const handler = vm.runInNewContext(`(${extractFunction(hierarchySource, 'handleTopLayerEscape')})`, context);
  const event = {
    key: 'Escape',
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }
  };
  return { calls, handler, event };
}

assert.match(bootstrap, /if \(event\.defaultPrevented\) return;\s*if \(handleTopLayerEscape\(event\)\) return;/);
assert.match(app, /function handleTopLayerEscape\(event\)/);
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
  assert.equal(harness.handler(harness.event), true);
  assert.deepEqual(harness.calls, ['inquiry', 'favorites', 'catalog-navigation', 'search']);
  assert.equal(harness.event.defaultPrevented, true);
}

{
  const harness = createHarness([
    ['inquiry', 600, true],
    ['favorites', 500, true],
    ['viewer', 100, true]
  ]);
  assert.equal(harness.handler(harness.event), true);
  assert.deepEqual(harness.calls, ['inquiry'], 'the first closing feature owns the Escape event');
}

{
  const harness = createHarness([['viewer', 100, true]]);
  harness.event.defaultPrevented = true;
  assert.equal(harness.handler(harness.event), false);
  assert.deepEqual(harness.calls, [], 'a child-owned Escape must not reach feature layers');
}

console.log('escape_layering_contract.test.js: PASS');
