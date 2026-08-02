"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const viewer = fs.readFileSync(path.join(root, "src/css/20-viewer.css"), "utf8");
const actions = fs.readFileSync(path.join(root, "src/css/25-viewer-actions.css"), "utf8");
const responsive = fs.readFileSync(path.join(root, "src/css/80-responsive-shell.css"), "utf8");
const routing = fs.readFileSync(path.join(root, "src/css/85-favorites-routing.css"), "utf8");
const polish = fs.readFileSync(path.join(root, "src/css/90-visual-polish.css"), "utf8");
const onboarding = fs.readFileSync(path.join(root, "src/css/92-viewer-onboarding.css"), "utf8");
const accessibility = fs.readFileSync(path.join(root, "src/css/95-accessibility-consistency.css"), "utf8");
const builder = fs.readFileSync(path.join(root, "tools/build_frontend_assets.py"), "utf8");

function ruleBody(source, selectorPattern, label) {
  const match = source.match(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${label}: rule is missing`);
  return match[1];
}

for (const [selector, label] of [
  ["\\.viewer-fit-control\\[aria-pressed=\\\"true\\\"\\]", "fit active state"],
  ["\\.viewer-fullscreen-toggle\\[data-fullscreen-active=\\\"true\\\"\\]", "fullscreen active state"],
  ["\\.top-ui-pin-button\\[data-pinned=\\\"true\\\"\\]", "pin active state"],
  ["\\.reader-button\\.viewer-fullscreen-float", "fullscreen floating control"],
  ["\\.reader-button\\.favorite-open-catalog-button", "favorite catalog control"],
  ["\\.reader-icon-button", "reader icon control"],
  ["\\.reader-catalog-menu-toggle", "catalog menu control"],
]) {
  assert.doesNotMatch(ruleBody(viewer, selector, label), /!important/, `${label}: ordinary cascade must remain sufficient`);
}

assert.doesNotMatch(ruleBody(actions, "\\.viewer-mobile-more-toggle\\.is-active", "mobile more active state"), /!important/);
assert.doesNotMatch(ruleBody(responsive, "\\.viewer-auto-zoom-button", "auto zoom control"), /!important/);
assert.doesNotMatch(ruleBody(routing, "body\\[data-page=\\\"viewer\\\"\\][^}]+", "standalone viewer shell"), /!important/);
assert.doesNotMatch(ruleBody(polish, "\\.favorites-transfer-copy \\.favorites-transfer-summary", "transfer summary"), /!important/);


assert.doesNotMatch(responsive, /!important/, "responsive shell must not use forced declarations");
assert.doesNotMatch(routing, /!important/, "favorites routing must own viewer controls through source order and selector scope");
assert.equal((onboarding.match(/!important/g) || []).length, 2, "only explicit reduced-motion overrides remain in onboarding");
assert.match(onboarding, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important;[\s\S]*transition: none !important;/);
assert.doesNotMatch(
  onboarding.replace(/@media \(prefers-reduced-motion: reduce\)[\s\S]*$/m, ""),
  /!important/,
  "onboarding chrome must use late cascade ownership rather than forced declarations",
);
assert.match(viewer, /\.reader-button\.reader-icon-button-done\s*\{/);
assert.doesNotMatch(ruleBody(viewer, "\\.reader-button\\.reader-icon-button-done", "reader feedback state"), /!important/);
assert.doesNotMatch(ruleBody(polish, "\\.viewer-favorite-button\\.reader-icon-button-done", "favorite feedback state"), /!important/);
assert.match(accessibility, /input:not\(\.reader-search-input\)/, "composite search input delegates its focus ring to the field");
assert.doesNotMatch(ruleBody(viewer, "\\.reader-search-input:focus-visible", "delegated search focus"), /!important/);

const visualIndex = builder.lastIndexOf('"src/css/90-visual-polish.css"');
const onboardingIndex = builder.lastIndexOf('"src/css/92-viewer-onboarding.css"');
const accessibilityIndex = builder.lastIndexOf('"src/css/95-accessibility-consistency.css"');
assert.ok(visualIndex >= 0 && onboardingIndex > visualIndex, "onboarding overrides must follow permanent viewer visual polish");
assert.ok(accessibilityIndex > onboardingIndex, "accessibility guarantees must remain authoritative after onboarding");
assert.doesNotMatch(builder, /05-viewer-onboarding\.css/, "the early onboarding module must not return");

console.log("css_important_reduction_contract.test.js: PASS");
