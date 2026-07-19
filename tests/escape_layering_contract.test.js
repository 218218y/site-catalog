'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const hierarchySource = fs.readFileSync(path.join(root, 'src', 'js', '20-shared-ui.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'src', 'js', '90-bootstrap.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const favoriteWorkspace = fs.readFileSync(path.join(root, 'src', 'js', '35-favorites-workspace.js'), 'utf8');
const favoritesShare = fs.readFileSync(path.join(root, 'src', 'js', '30-favorites-share.js'), 'utf8');
const viewerActions = fs.readFileSync(path.join(root, 'src', 'js', '62-viewer-actions.js'), 'utf8');

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

function createHarness(overrides = {}) {
  const calls = [];
  const state = {
    favoriteNoteEditingKey: '',
    favoritesTransferPending: null,
    favoritesOpen: false,
    lightboxOpen: false,
    viewerInquiryOpen: false,
    viewerMobileMoreOpen: false,
    viewerOnboardingOpen: false,
    lightboxMobileSearchOpen: false,
    ...overrides
  };
  const context = {
    state,
    els: {
      globalSearchScopeMenu: null,
      catalogMenu: null,
      lightboxCatalogMenu: null,
      lightboxSearchScopeMenu: null
    },
    isMobileCategoryMenuOpen: () => false,
    closeMobileCategoryMenu: () => calls.push('mobile-category'),
    isGlobalSearchPanelOpen: () => false,
    closeGlobalSearchScopeMenu: () => calls.push('global-search-scope'),
    closeGlobalSearchPanel: () => calls.push('global-search'),
    closeDetailCatalogMenu: () => calls.push('catalog-menu'),
    closeFavoriteNoteEditor: () => {
      calls.push('favorite-note');
      state.favoriteNoteEditingKey = '';
    },
    closeFavoritesTransferDialog: () => {
      calls.push('favorites-transfer');
      state.favoritesTransferPending = null;
    },
    closeFavoritesPanel: () => {
      calls.push('favorites');
      state.favoritesOpen = false;
    },
    closeViewerInquiry: () => {
      calls.push('viewer-inquiry');
      state.viewerInquiryOpen = false;
    },
    closeViewerMobileMoreMenu: () => {
      calls.push('viewer-more');
      state.viewerMobileMoreOpen = false;
    },
    closeViewerOnboarding: () => {
      calls.push('viewer-onboarding');
      state.viewerOnboardingOpen = false;
    },
    setLightboxMobileSearchOpen: () => {
      calls.push('viewer-search');
      state.lightboxMobileSearchOpen = false;
    },
    closeLightboxCatalogMenu: () => calls.push('viewer-catalog-menu'),
    closeLightboxSearchScopeMenu: () => calls.push('viewer-search-scope'),
    isBrowserFullscreenActive: () => false,
    exitBrowserFullscreen: () => Promise.resolve(),
    hideLightboxSearchResults: () => calls.push('viewer-search-results'),
    closeLightbox: () => {
      calls.push('lightbox');
      state.lightboxOpen = false;
    }
  };
  const handler = vm.runInNewContext(`(${extractFunction(hierarchySource, 'handleTopLayerEscape')})`, context);
  const event = () => ({
    key: 'Escape',
    defaultPrevented: false,
    target: null,
    preventDefault() {
      this.defaultPrevented = true;
    }
  });
  return { calls, state, handler, event };
}

assert.match(bootstrap, /if \(event\.defaultPrevented\) return;\s*if \(handleTopLayerEscape\(event\)\) return;/);
assert.match(app, /function handleTopLayerEscape\(event\)/);
assert.match(favoriteWorkspace, /event\.key === "Escape"[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?closeCallback\(\)/);
assert.match(favoritesShare, /function handleFavoritesTransferKeydown\(event\)[\s\S]*?event\.key === "Escape"[\s\S]*?event\.stopPropagation\(\);[\s\S]*?closeFavoritesTransferDialog/);
assert.match(viewerActions, /function handleViewerInquiryKeydown\(event\)[\s\S]*?event\.key === "Escape"[\s\S]*?event\.stopPropagation\(\);[\s\S]*?closeViewerInquiry\(\)/);

{
  const harness = createHarness({ favoriteNoteEditingKey: 'catalog\u00001', favoritesOpen: true });
  assert.equal(harness.handler(harness.event()), true);
  assert.deepEqual(harness.calls, ['favorite-note']);
  assert.equal(harness.state.favoritesOpen, true, 'first Escape must keep the favorites screen open');

  assert.equal(harness.handler(harness.event()), true);
  assert.deepEqual(harness.calls, ['favorite-note', 'favorites']);
}

{
  const harness = createHarness({ viewerInquiryOpen: true, lightboxOpen: true });
  assert.equal(harness.handler(harness.event()), true);
  assert.deepEqual(harness.calls, ['viewer-inquiry']);
  assert.equal(harness.state.lightboxOpen, true, 'first Escape must keep the viewer open');

  assert.equal(harness.handler(harness.event()), true);
  assert.deepEqual(harness.calls, ['viewer-inquiry', 'lightbox']);
}

{
  const harness = createHarness({ favoritesTransferPending: { source: 'link' }, favoritesOpen: true });
  assert.equal(harness.handler(harness.event()), true);
  assert.deepEqual(harness.calls, ['favorites-transfer']);
  assert.equal(harness.state.favoritesOpen, true, 'transfer dialog must close before the favorites screen');
}

{
  const harness = createHarness({ favoriteNoteEditingKey: 'catalog\u00001', favoritesOpen: true });
  const alreadyHandled = harness.event();
  alreadyHandled.defaultPrevented = true;
  assert.equal(harness.handler(alreadyHandled), false);
  assert.deepEqual(harness.calls, [], 'an Escape consumed by a child dialog must not reach its parent layer');
}

console.log('escape_layering_contract.test.js: PASS');
