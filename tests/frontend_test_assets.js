'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ROUTE_BUNDLES = Object.freeze({
  catalog: 'app-catalog.js',
  favorites: 'app-favorites.js',
  viewer: 'app-viewer.js',
  payment: 'app-payment.js'
});
const ROUTE_STYLES = Object.freeze({
  core: 'styles.css',
  catalog: 'styles-catalog.css',
  favorites: 'styles-favorites.css',
  viewer: 'styles-viewer.css'
});

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readBundle(route) {
  const filename = ROUTE_BUNDLES[route];
  if (!filename) throw new Error(`Unknown frontend route bundle: ${route}`);
  return readFile(filename);
}

function readCssBundle(route) {
  const filename = ROUTE_STYLES[route];
  if (!filename) throw new Error(`Unknown frontend CSS bundle: ${route}`);
  return readFile(filename);
}

function readAllBundles() {
  return Object.values(ROUTE_BUNDLES).map(readFile).join('\n');
}

function readAllCssBundles() {
  return Object.values(ROUTE_STYLES).map(readFile).join('\n');
}

module.exports = { readBundle, readCssBundle, readAllBundles, readAllCssBundles };
