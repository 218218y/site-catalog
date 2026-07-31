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

assert.equal(packageJson.devDependencies.typescript, '7.0.2');
assert.equal(packageLock.packages[''].devDependencies.typescript, '7.0.2');
assert.equal(packageLock.packages['node_modules/typescript'].version, '7.0.2');
assert.equal(packageLock.packages['node_modules/@typescript/typescript-win32-x64'].version, '7.0.2');
assert.equal(packageLock.packages['node_modules/@typescript/typescript-linux-x64'].version, '7.0.2');
assert.deepEqual(jsconfig.compilerOptions.types, []);
assert.match(contracts, /@typedef \{\{replace\?:boolean\}\} AppNavigationOptions/);
assert.doesNotMatch(contracts, /@typedef \{\{replace\?:boolean\}\} NavigationOptions/);
assert.equal((navigation.match(/@param \{AppNavigationOptions\} \[options\]/g) || []).length, 2);

console.log('typescript_7_compatibility_contract.test.js: PASS');
