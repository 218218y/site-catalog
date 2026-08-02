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

console.log("css_important_reduction_contract.test.js: PASS");
