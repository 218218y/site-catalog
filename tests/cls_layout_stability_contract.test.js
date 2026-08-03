"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readAllCssBundles } = require("./frontend_test_assets");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const template = read("site.template.html");
const viewerHtml = read("viewer.html");
const catalogHtml = read("catalog.html");
const pageBuilder = read("tools/build_site_pages.py");
const geometry = read("src/js/54-viewer-geometry.js");
const viewerImage = read("src/js/53-viewer-image.js");
const sharedUi = read("src/js/20-shared-ui.js");
const catalogGrid = read("src/js/40-catalog-grid.js");
const css = readAllCssBundles();
const catalogs = JSON.parse(read("catalogs.generated.json"));

assert.match(template, /class="has-bargig-logo\{\{ROOT_CLASS_SUFFIX\}\}"/);
assert.match(pageBuilder, /"\{\{ROOT_CLASS_SUFFIX\}\}": " viewer-open" if page\.mode == "viewer" else ""/);
assert.match(viewerHtml, /<html\b[^>]*class="has-bargig-logo viewer-open"/s);
assert.doesNotMatch(catalogHtml, /<html\b[^>]*class="[^"]*\bviewer-open\b/s);

assert.match(geometry, /const viewportWidth = Math\.max\(0, Number\(window\.visualViewport\?\.width\) \|\| Number\(window\.innerWidth\) \|\| 0\);/);
assert.match(geometry, /const stageWidth = Math\.max\(0, Number\(stage\.clientWidth\) \|\| viewportWidth\);/);
assert.match(geometry, /const stageHeight = Math\.max\(0, Number\(stage\.clientHeight\) \|\| viewportHeight\);/);
assert.doesNotMatch(geometry, /Math\.max\(260, stage\.clientWidth - 18\)/);

assert.match(viewerImage, /function applyStableViewerPageGeometry\(catalog, page, image, options = \{\}\)/);
assert.match(viewerImage, /const declaredSize = pageSize\(catalog, page\);/);
assert.match(viewerImage, /Number\(declaredSize\?\.width\) \|\| Number\(image\?\.naturalWidth\)/);
assert.equal(
  (viewerImage.match(/applyStableViewerPageGeometry\(catalog, page, image, \{ updateFitScale: false \}\);/g) || []).length,
  2,
  "both the already-loaded and recovered image paths must retain declared page geometry"
);
assert.doesNotMatch(viewerImage, /applyLightboxFrameGeometry\(image\.naturalWidth, image\.naturalHeight, \{ updateFitScale: false \}\)/);

for (const catalog of catalogs) {
  const pageCount = Math.max(1, Number(catalog.pages) || 1);
  assert.equal(Array.isArray(catalog.pageSizes), true, `${catalog.id} must expose pageSizes`);
  assert.equal(catalog.pageSizes.length, pageCount, `${catalog.id} must provide one declared size per page`);
  catalog.pageSizes.forEach((size, index) => {
    assert.equal(Array.isArray(size) && size.length >= 2, true, `${catalog.id} page ${index + 1} must provide width and height`);
    assert.ok(Number(size[0]) > 0 && Number(size[1]) > 0, `${catalog.id} page ${index + 1} dimensions must be positive`);
  });
}

assert.match(catalogGrid, /catalogImageDimensionAttributes\(catalog, 1\)/);
assert.match(catalogGrid, /pageAspectVariableStyle\(catalog, page, "--page-thumb-aspect-ratio"\)/);
assert.match(sharedUi, /function catalogImageDimensionAttributes\(catalog, page\)/);
assert.match(sharedUi, /return size \? ` width="\$\{size\.width\}" height="\$\{size\.height\}"` : "";/);
assert.match(sharedUi, /const observedCatalogPageSizes = new WeakMap\(\);/);
assert.doesNotMatch(sharedUi, /catalog\.pageSizes\s*=|catalog\.pageSizes\s*\[/);
assert.match(css, /html\s*\{[\s\S]*?scrollbar-gutter:\s*stable;/);
assert.match(css, /html\.viewer-open\s*\{[\s\S]*?scrollbar-gutter:\s*auto;/);
assert.match(css, /\.lightbox-image-frame\s*\{[\s\S]*?contain:\s*layout paint style;[\s\S]*?transition:\s*\n?\s*box-shadow/);
assert.doesNotMatch(css, /\.lightbox-image-frame\s*\{[^}]*transition:[^}]*\b(?:width|height)\b/s);
assert.match(css, /img\[data-brand-logo="1"\]\s*\{[\s\S]*?aspect-ratio:\s*786\s*\/\s*317;/);

console.log("cls_layout_stability_contract.test.js: PASS");
