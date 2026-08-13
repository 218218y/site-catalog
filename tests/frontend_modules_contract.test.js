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
const expectedEsbuildVersion = packageJson.devDependencies.esbuild;

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
  assert.ok(bundle.includes(`Bundler: esbuild ${expectedEsbuildVersion} (lockfile-selected direct devDependency)`));
  assert.match(bundle, /Output format: native browser ES module/);
  assert.equal((bundle.match(/\binitResult\s*=\s*(?:true|!0)\s*;/g) || []).length, 1);
  assert.equal((bundle.match(/\binitResult\s*=\s*init\(\)\s*;/g) || []).length, 1);
  assert.equal(hasLegacyTopLevelIifeWrapper(bundle), false);
  assert.doesNotMatch(bundle, /__BARGIG_TEST_EXPORTS__/);
}
for (const css of [catalogCss, favoritesCss, viewerCss]) {
  assert.match(css, /GENERATED FILE — DO NOT EDIT DIRECTLY/);
  assert.match(css, /Cascade layer: bargig\.application/);
  assert.equal((css.match(/@layer bargig\.application;/g) || []).length, 1);
  assert.equal((css.match(/@layer bargig\.application \{/g) || []).length, 1);
}

assert.match(expectedEsbuildVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.equal(packageLock.packages[''].devDependencies.esbuild, expectedEsbuildVersion);
assert.equal(packageLock.packages['node_modules/esbuild'].version, expectedEsbuildVersion);
assert.ok(packageLock.packages['node_modules/esbuild'].resolved.endsWith(`/esbuild-${expectedEsbuildVersion}.tgz`));
assert.ok(packageLock.packages['node_modules/esbuild'].integrity);
assert.equal(packageLock.packages['node_modules/@esbuild/linux-x64'].version, expectedEsbuildVersion);
assert.ok(packageLock.packages['node_modules/@esbuild/linux-x64'].integrity);

assert.match(frontendBuilder, /BUNDLE_SPECS:\s*tuple\[FrontendBundleSpec, \.\.\.\]/);
assert.match(frontendBuilder, /entrypoint="src\/entries\/catalog\.js"/);
assert.match(frontendBuilder, /entrypoint="src\/entries\/favorites\.js"/);
assert.match(frontendBuilder, /entrypoint="src\/entries\/viewer\.js"/);
assert.match(frontendBuilder, /CAPABILITY_BOUNDARIES/);
assert.match(frontendBuilder, /Disabled capability/);
assert.match(frontendBuilder, /required input boundaries/);
assert.match(frontendBuilder, /ROUTE_ASSETS:/);
assert.match(frontendBuilder, /DEPLOY_GENERATED_FILES/);
assert.match(frontendBuilder, /def atomic_write_text/);
assert.match(frontendBuilder, /def build_frontend_assets/);
assert.match(frontendBuilder, /def validate_module_manifest/);
assert.match(frontendBuilder, /CSS_CASCADE_LAYER = \"bargig\.application\"/);
assert.match(frontendBuilder, /return tuple\(build_one/);
assert.match(frontendBuilder, /_partition_metafile_inputs/);
assert.match(esbuildRunner, /import \{ build, version as esbuildVersion \} from "esbuild"/);
assert.match(esbuildRunner, /expectedEsbuildVersion = args\["expected-version"\]/);
assert.match(esbuildRunner, /from package-lock\.json/);
assert.doesNotMatch(esbuildRunner, /EXPECTED_ESBUILD_VERSION/);
assert.match(esbuildRunner, /entryPoints: \[entry\]/);
assert.match(esbuildRunner, /bundle: true/);
assert.match(esbuildRunner, /format: "esm"/);
assert.match(esbuildRunner, /treeShaking: true/);
assert.match(esbuildRunner, /metafile: true/);

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
assert.ok(!catalogBundle.includes(sourceMarker("catalog-snapshot.js")));

assert.match(favoritesBundle, /ES module entrypoint: src\/entries\/favorites\.js/);
assert.ok(favoritesBundle.includes(sourceMarker('src/js/35-favorites-workspace.js')));
assert.ok(favoritesBundle.includes(sourceMarker('src/js/40-catalog-grid.js')));
assert.ok(favoritesBundle.includes(sourceMarker('src/js/32-shared-inquiry.js')));
assert.ok(!favoritesBundle.includes(sourceMarker('src/js/16-viewer-state.js')));
assert.ok(!favoritesBundle.includes(sourceMarker('src/js/60-viewer.js')));
assert.ok(!favoritesBundle.includes(sourceMarker("catalog-snapshot.js")));

assert.match(viewerBundle, /ES module entrypoint: src\/entries\/viewer\.js/);
assert.ok(viewerBundle.includes(sourceMarker("catalog-snapshot.js")));
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
assert.doesNotMatch(contractChecker, /APPROVED_IMPORT_CYCLES/);
assert.match(contractChecker, /ES-module dependency cycle is forbidden/);
assert.match(contractChecker, /Viewer implementation reaches into search internals/);
assert.match(contractChecker, /Search implementation reaches into Viewer internals/);
assert.match(contractChecker, /_has_legacy_top_level_iife_wrapper/);
assert.doesNotMatch(contractChecker, /if \"\(\(\) => \\{\" in text/);
assert.match(contractChecker, /native ES module depends on document\.currentScript/);
assert.match(contractChecker, /def check_css_architecture/);
assert.match(contractChecker, /unreviewed z-index declaration/);
assert.doesNotMatch(telemetrySource, /document\.currentScript/);
assert.match(telemetrySource, /script\[type=module\]\[data-bargig-route-module\]/);

console.log('frontend_modules_contract.test.js: PASS');
