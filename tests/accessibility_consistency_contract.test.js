'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const accessibility = fs.readFileSync(path.join(root, 'accessibility.html'), 'utf8');
const verify = fs.readFileSync(path.join(root, 'tools', 'verify_project.py'), 'utf8');

assert.match(css, /--focus-ring-color:/);
assert.match(css, /--shadow-control:/);
assert.match(css, /--shadow-panel:/);
assert.match(css, /--shadow-dialog:/);
assert.match(css, /--icon-stroke-width:\s*1\.8/);
assert.match(css, /\.ui-state\[data-state="error"\]/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(template, /id="catalogLoadStatus" role="status" aria-live="polite"/);
assert.match(template, /id="catalogGrid" aria-busy="true"/);
assert.match(template, /id="viewerImageFeedback"[\s\S]*?aria-atomic="true"/);
assert.match(app, /setAttribute\("role", isError \? "alert" : "status"\)/);
assert.match(app, /function searchIndexErrorMarkup\(/);
assert.match(app, /data-global-search-index-retry/);
assert.match(app, /frame\.setAttribute\("aria-busy", "true"\)/);
assert.match(accessibility, /הצהרת נגישות/);
assert.match(accessibility, /עמודי קטלוג שמקורם בתמונות/);
assert.match(verify, /Static accessibility audit/);

console.log('accessibility_consistency_contract.test.js: PASS');
