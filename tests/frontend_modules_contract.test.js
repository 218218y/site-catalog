'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readBundle, readCssBundle } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const catalogBundle = readBundle('catalog');
const favoritesBundle = readBundle('favorites');
const viewerBundle = readBundle('viewer');
const catalogCss = readCssBundle('catalog');
const favoritesCss = readCssBundle('favorites');
const viewerCss = readCssBundle('viewer');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');
const deployBuilder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');
const frontendBuilder = fs.readFileSync(path.join(root, 'tools', 'build_frontend_assets.py'), 'utf8');
const esbuildRunner = fs.readFileSync(path.join(root, 'tools', 'build_frontend_esbuild.mjs'), 'utf8');
const contractChecker = fs.readFileSync(path.join(root, 'tools', 'check_frontend_contracts.py'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const telemetrySource = fs.readFileSync(path.join(root, 'src', 'js', '15-telemetry.js'), 'utf8');

const sourceMarker = (relativePath) => ` *   - ${relativePath}`;

function stripLeadingJavaScriptComments(source) {
  let remaining = source.replace(/^\uFEFF/, '').trimStart();
  for (;;) {
    if (remaining.startsWith('/*')) {
      const end = remaining.indexOf('*/', 2);
      if (end < 0) return remaining;
      remaining = remaining.slice(end + 2).trimStart();
      continue;
    }
    if (remaining.startsWith('//')) {
      const newline = remaining.indexOf('\n', 2);
      if (newline < 0) return '';
      remaining = remaining.slice(newline + 1).trimStart();
      continue;
    }
    return remaining;
  }
}

function hasLegacyTopLevelIifeWrapper(source) {
  const body = stripLeadingJavaScriptComments(source);
  const beginsWithWrapper = /^(?:\(\(\)\s*=>\s*\{|\(function(?:\s+[A-Za-z_$][A-Za-z0-9_$]*)?\s*\(\)\s*\{)/.test(body);
  return beginsWithWrapper && /\}\)\(\);?\s*$/.test(body);
}

for (const bundle of [catalogBundle, favoritesBundle, viewerBundle]) {
  assert.match(bundle, /GENERATED FILE — DO NOT EDIT DIRECTLY/);
  assert.match(bundle, /Bundler: esbuild 0\.28\.1 \(direct pinned devDependency\)/);
  assert.match(bundle, /Output format: native browser ES module/);
  assert.equal((bundle.match(/\binitResult\s*=\s*(?:true|!0)\s*;/g) || []).length, 1);
  assert.equal((bundle.match(/\binitResult\s*=\s*init\(\)\s*;/g) || []).length, 1);
  assert.equal(hasLegacyTopLevelIifeWrapper(bundle), false);
  assert.doesNotMatch(bundle, /__BARGIG_TEST_EXPORTS__/);
}
for (const css of [catalogCss, favoritesCss, viewerCss]) {
  assert.match(css, /GENERATED FILE — DO NOT EDIT DIRECTLY/);
}

assert.equal(packageJson.devDependencies.esbuild, '0.28.1');
assert.equal(packageLock.packages[''].devDependencies.esbuild, '0.28.1');
assert.equal(packageLock.packages['node_modules/esbuild'].version, '0.28.1');
assert.match(packageLock.packages['node_modules/esbuild'].resolved, /esbuild-0\.28\.1\.tgz$/);
assert.ok(packageLock.packages['node_modules/esbuild'].integrity);
assert.equal(packageLock.packages['node_modules/@esbuild/linux-x64'].version, '0.28.1');
assert.ok(packageLock.packages['node_modules/@esbuild/linux-x64'].integrity);

assert.match(frontendBuilder, /BUNDLE_SPECS:\s*tuple\[FrontendBundleSpec, \.\.\.\]/);
assert.match(frontendBuilder, /entrypoint="src\/entries\/catalog\.js"/);
assert.match(frontendBuilder, /entrypoint="src\/entries\/favorites\.js"/);
assert.match(frontendBuilder, /entrypoint="src\/entries\/viewer\.js"/);
assert.match(frontendBuilder, /Unexpected esbuild graph/);
assert.match(frontendBuilder, /ROUTE_ASSETS:/);
assert.match(frontendBuilder, /DEPLOY_GENERATED_FILES/);
assert.match(frontendBuilder, /def atomic_write_text/);
assert.match(frontendBuilder, /def build_frontend_assets/);
assert.match(frontendBuilder, /def validate_module_manifest/);
assert.match(frontendBuilder, /def remove_obsolete_generated_files/);
assert.match(frontendBuilder, /results = tuple\(build_one/);
assert.match(frontendBuilder, /_partition_metafile_inputs/);
assert.match(esbuildRunner, /import \{ build, version as esbuildVersion \} from "esbuild"/);
assert.match(esbuildRunner, /EXPECTED_ESBUILD_VERSION = "0\.28\.1"/);
assert.match(esbuildRunner, /entryPoints: \[entry\]/);
assert.match(esbuildRunner, /bundle: true/);
assert.match(esbuildRunner, /format: "esm"/);
assert.match(esbuildRunner, /treeShaking: true/);
assert.match(esbuildRunner, /metafile: true/);
assert.equal(fs.existsSync(path.join(root, 'app.js')), false, 'obsolete compatibility loader must be removed');

assert.match(pageBuilder, /from build_frontend_assets import ROUTE_ASSETS, build_frontend_assets/);
assert.match(pageBuilder, /ROUTE_STYLESHEET/);
assert.match(pageBuilder, /ROUTE_SCRIPT/);
assert.match(deployBuilder, /DEPLOY_GENERATED_FILES as FRONTEND_GENERATED_FILES/);
assert.doesNotMatch(deployBuilder, /src\/js|src\/css/);

for (const bundle of [catalogBundle, favoritesBundle, viewerBundle]) {
  assert.ok(bundle.includes(sourceMarker('src/js/02-dom-contracts.js')));
  assert.ok(bundle.includes(sourceMarker('src/js/03-runtime-context.js')));
  assert.ok(bundle.includes(sourceMarker('src/js/17-catalog-asset-urls.js')));
  assert.ok(bundle.includes(sourceMarker('src/js/80-app-shell.js')));
}

assert.match(catalogBundle, /ES module entrypoint: src\/entries\/catalog\.js/);
assert.ok(catalogBundle.includes(sourceMarker('src/js/40-catalog-grid.js')));
assert.ok(catalogBundle.includes(sourceMarker('src/js/50-search-ui.js')));
assert.ok(!catalogBundle.includes(sourceMarker('src/js/16-viewer-state.js')));
assert.ok(!catalogBundle.includes(sourceMarker('src/js/60-viewer.js')));
assert.ok(!catalogBundle.includes(sourceMarker('src/js/35-favorites-workspace.js')));

assert.match(favoritesBundle, /ES module entrypoint: src\/entries\/favorites\.js/);
assert.ok(favoritesBundle.includes(sourceMarker('src/js/35-favorites-workspace.js')));
assert.ok(favoritesBundle.includes(sourceMarker('src/js/40-catalog-grid.js')));
assert.ok(favoritesBundle.includes(sourceMarker('src/js/32-shared-inquiry.js')));
assert.ok(!favoritesBundle.includes(sourceMarker('src/js/16-viewer-state.js')));
assert.ok(!favoritesBundle.includes(sourceMarker('src/js/60-viewer.js')));

assert.match(viewerBundle, /ES module entrypoint: src\/entries\/viewer\.js/);
assert.ok(viewerBundle.includes(sourceMarker('src/js/16-viewer-state.js')));
assert.ok(viewerBundle.includes(sourceMarker('src/js/31-viewer-share.js')));
assert.ok(viewerBundle.includes(sourceMarker('src/js/32-shared-inquiry.js')));
assert.ok(viewerBundle.includes(sourceMarker('src/js/60-viewer.js')));
assert.ok(viewerBundle.includes(sourceMarker('src/js/35-favorites-workspace.js')));
assert.ok(viewerBundle.includes(sourceMarker('src/js/40-catalog-grid.js')));
assert.match(viewerBundle, /getFeatureInterface\("search"\)/);

for (const route of ['catalog', 'favorites', 'viewer']) {
  const entry = fs.readFileSync(path.join(root, 'src', 'entries', `${route}.js`), 'utf8');
  assert.match(entry, /^\/\*\* Route entry:/);
  assert.match(entry, /import "\.\.\/js\/80-app-shell\.js";/);
  assert.match(entry, /import "\.\.\/js\/90-bootstrap\.js";/);
  assert.doesNotMatch(entry, /import\s*\(/);
}

assert.match(contractChecker, /runtime source is not an ES module/);
assert.match(contractChecker, /APPROVED_IMPORT_CYCLES/);
assert.match(contractChecker, /unapproved ES-module dependency cycle/);
assert.match(contractChecker, /Viewer implementation reaches into search internals/);
assert.match(contractChecker, /Search implementation reaches into Viewer internals/);
assert.match(contractChecker, /obsolete compatibility loader remains/);
assert.match(contractChecker, /_has_legacy_top_level_iife_wrapper/);
assert.doesNotMatch(contractChecker, /if \"\(\(\) => \\{\" in text/);
assert.match(contractChecker, /native ES module depends on document\.currentScript/);
assert.doesNotMatch(telemetrySource, /document\.currentScript/);
assert.match(telemetrySource, /script\[type=module\]\[data-bargig-route-module\]/);

console.log('frontend_modules_contract.test.js: PASS');
