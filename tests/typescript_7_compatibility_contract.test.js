'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const jsconfig = JSON.parse(fs.readFileSync(path.join(root, 'jsconfig.json'), 'utf8'));
const contracts = fs.readFileSync(path.join(root, 'src', 'js', '05-app-contracts.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src', 'js', '00-navigation.js'), 'utf8');
const compilerApiBoundary = fs.readFileSync(path.join(root, 'tools', 'typescript_compiler_api.js'), 'utf8');
const runtimeSymbolChecker = fs.readFileSync(path.join(root, 'tools', 'check_frontend_runtime_symbols.js'), 'utf8');
const frontendTestModule = fs.readFileSync(path.join(root, 'tests', 'frontend_test_module.js'), 'utf8');
const compilerApi = require('../tools/typescript_compiler_api.js');

assert.equal(packageJson.devDependencies.typescript, '7.0.2');
assert.equal(packageJson.devDependencies['typescript-legacy-api'], 'npm:typescript@5.8.3');
assert.equal(packageLock.packages[''].devDependencies.typescript, '7.0.2');
assert.equal(packageLock.packages[''].devDependencies['typescript-legacy-api'], 'npm:typescript@5.8.3');
assert.equal(packageLock.packages['node_modules/typescript'].version, '7.0.2');
assert.equal(packageLock.packages['node_modules/typescript-legacy-api'].name, 'typescript');
assert.equal(packageLock.packages['node_modules/typescript-legacy-api'].version, '5.8.3');
assert.equal(packageLock.packages['node_modules/@typescript/typescript-win32-x64'].version, '7.0.2');
assert.equal(packageLock.packages['node_modules/@typescript/typescript-linux-x64'].version, '7.0.2');
assert.deepEqual(jsconfig.compilerOptions.types, []);
assert.match(contracts, /@typedef \{\{replace\?:boolean\}\} AppNavigationOptions/);
assert.doesNotMatch(contracts, /@typedef \{\{replace\?:boolean\}\} NavigationOptions/);
assert.equal((navigation.match(/@param \{AppNavigationOptions\} \[options\]/g) || []).length, 2);
assert.equal(compilerApi.version, '5.8.3');
assert.match(compilerApiBoundary, /require\("typescript-legacy-api"\)/);
assert.match(compilerApiBoundary, /requiredFunctions/);
assert.doesNotMatch(runtimeSymbolChecker, /require\("typescript"\)/);
assert.match(runtimeSymbolChecker, /require\("\.\/typescript_compiler_api\.js"\)/);
assert.doesNotMatch(frontendTestModule, /require\("typescript"\)/);
assert.match(frontendTestModule, /require\("\.\.\/tools\/typescript_compiler_api\.js"\)/);

console.log('typescript_7_compatibility_contract.test.js: PASS');
