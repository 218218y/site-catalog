'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const panel = fs.readFileSync(path.join(root, 'catalog-control-panel.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'tools', 'catalog_control_server.py'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'tools', 'taxonomy_editor.py'), 'utf8');

assert.match(panel, /<h2>ניהול קטגוריות וכתובות SEO<\/h2>/);
assert.match(panel, /id="taxonomyCategories"/);
assert.match(panel, /id="taxonomySubcategories"/);
assert.match(panel, /id="saveTaxonomy"/);
assert.match(panel, /function reconcileTaxonomyDraftFromCatalogs/);
assert.match(panel, /function renderTaxonomyEditor/);
assert.match(panel, /api\('\/api\/taxonomy'/);
assert.match(panel, /taxonomy: taxonomyPayload\(\)/);
assert.match(panel, /placeholder="חסר — לדוגמה dining-tables"/);
assert.match(panel, /\['bundle_r2', 'cloudflare_pages_deploy'\]/);

assert.match(server, /if path == "\/api\/taxonomy"/);
assert.match(server, /atomic_write_catalogs_and_taxonomy/);
assert.match(server, /refresh_taxonomy_outputs_if_complete/);
assert.match(server, /taxonomy_action_availability/);
assert.match(server, /"taxonomy": taxonomy/);

assert.match(editor, /def reconcile_taxonomy_with_catalogs/);
assert.match(editor, /def apply_taxonomy_renames_to_catalogs/);
assert.match(editor, /def taxonomy_completion_issues/);
assert.match(editor, /"slug": ""/);
assert.match(editor, /"description": ""/);

console.log('catalog_taxonomy_control_panel_contract.test.js: PASS');
