'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const checker = fs.readFileSync(path.join(root, 'tools', 'check_frontend_runtime_symbols.js'), 'utf8');
const compilerApiBoundary = fs.readFileSync(path.join(root, 'tools', 'typescript_compiler_api.js'), 'utf8');
const verifier = fs.readFileSync(path.join(root, 'tools', 'verify_project.py'), 'utf8');
const jsconfig = JSON.parse(fs.readFileSync(path.join(root, 'jsconfig.json'), 'utf8'));

assert.equal(packageJson.scripts['check:runtime-symbols'], 'node tools/check_frontend_runtime_symbols.js');
assert.equal(packageJson.scripts['check:types'], 'tsc -p jsconfig.json --pretty false');
assert.equal(jsconfig.compilerOptions.checkJs, true);
assert.equal(jsconfig.compilerOptions.noEmit, true);
assert.match(checker, /\["app-catalog\.js", "app-favorites\.js", "app-viewer\.js", "app-payment\.js"\]/);
assert.match(checker, /require\("\.\/typescript_compiler_api\.js"\)/);
assert.doesNotMatch(checker, /require\("typescript"\)/);
assert.match(checker, /diagnostic\.code !== 2304/);
assert.match(compilerApiBoundary, /require\("typescript-legacy-api"\)/);
assert.match(compilerApiBoundary, /createProgram/);
assert.match(compilerApiBoundary, /ScriptTarget/);
assert.match(verifier, /Frontend route runtime symbols/);

const completed = spawnSync(process.execPath, ['tools/check_frontend_runtime_symbols.js'], {
  cwd: root,
  encoding: 'utf8'
});
assert.equal(completed.status, 0, completed.stderr || completed.stdout);
assert.match(completed.stdout, /passed for 4 route bundles/);

console.log('frontend_runtime_symbol_contract.test.js: PASS');
