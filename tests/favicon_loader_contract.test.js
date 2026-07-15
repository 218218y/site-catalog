'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'favicon-loader.js'), 'utf8');

assert.doesNotMatch(source, /\bfetch\s*\(/, 'favicon setup must not probe assets at runtime');
assert.doesNotMatch(source, /method\s*:\s*["']HEAD["']/, 'favicon setup must not issue HEAD requests');
assert.match(source, /href:\s*["']favicon\.ico["']/);
assert.match(source, /href:\s*["']apple-touch-icon\.png["']/);

console.log('favicon_loader_contract.test.js: PASS');
