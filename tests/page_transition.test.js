'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'page-transition.js'), 'utf8');
const classNames = new Set(['site-transition-pending']);
const attributes = new Map();
const prefetchHints = [];
const documentListeners = new Map();
const windowListeners = new Map();
const rafQueue = [];
const timers = new Map();
let timerId = 0;
let assignedUrl = '';
let replacedUrl = '';
let backCalls = 0;

const document = {
  head: {
    appendChild(node) { prefetchHints.push(node); }
  },
  createElement(tagName) { return { tagName: String(tagName).toUpperCase() }; },
  documentElement: {
    classList: {
      add(...names) { names.forEach((name) => classNames.add(name)); },
      remove(...names) { names.forEach((name) => classNames.delete(name)); },
      contains(name) { return classNames.has(name); }
    }
  },
  body: {
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); }
  },
  addEventListener(name, handler) { documentListeners.set(name, handler); }
};

const window = {
  location: {
    href: 'https://bargig-furniture.com/viewer.html?catalog=test&page=2',
    protocol: 'https:',
    origin: 'https://bargig-furniture.com',
    assign(url) { assignedUrl = url; },
    replace(url) { replacedUrl = url; }
  },
  history: {
    back() { backCalls += 1; }
  },
  matchMedia() { return { matches: false }; },
  getComputedStyle() {
    return {
      getPropertyValue(name) {
        if (name === '--page-transition-cover-duration') return '30ms';
        if (name === '--page-transition-reveal-duration') return '30ms';
        return '';
      }
    };
  },
  requestAnimationFrame(callback) {
    rafQueue.push(callback);
    return rafQueue.length;
  },
  setTimeout(callback, delay) {
    timerId += 1;
    timers.set(timerId, { callback, delay, canceled: false });
    return timerId;
  },
  clearTimeout(id) {
    const timer = timers.get(id);
    if (timer) timer.canceled = true;
  },
  addEventListener(name, handler) { windowListeners.set(name, handler); }
};
window.window = window;
window.document = document;

const context = { window, document, URL, Set, Object, Boolean, String, Number };
vm.createContext(context);
vm.runInContext(source, context);

const transition = window.BargigPageTransition;
assert.ok(transition, 'transition API should be exported');
assert.equal(transition.isManagedUrl('catalog.html?catalog=test'), true);
assert.equal(transition.isManagedUrl('https://example.com/catalog.html'), false);

transition.ready();
assert.equal(rafQueue.length, 1, 'ready should wait for the covered document to paint');
rafQueue.shift()();
assert.equal(rafQueue.length, 1, 'ready should use two animation frames');
rafQueue.shift()();
assert.equal(classNames.has('site-transition-pending'), false);
assert.equal(classNames.has('site-transition-entering'), true);
assert.equal(attributes.has('aria-busy'), false);
const revealTimer = [...timers.values()].find((timer) => !timer.canceled);
assert.ok(revealTimer, 'ready should schedule removal of the entering state');
assert.equal(revealTimer.delay, 164);

for (const timer of timers.values()) {
  if (!timer.canceled) timer.callback();
}
assert.equal(classNames.has('site-transition-entering'), false);
timers.clear();

assert.equal(transition.navigate('catalog.html?catalog=test'), true);
assert.equal(prefetchHints.length, 1, 'managed navigation should prefetch the exact destination during the fade');
assert.equal(prefetchHints[0].rel, 'prefetch');
assert.equal(prefetchHints[0].href, 'https://bargig-furniture.com/catalog.html?catalog=test');
assert.equal(classNames.has('site-transition-leaving'), true);
assert.equal(attributes.get('aria-busy'), 'true');
const navigationTimer = [...timers.values()].find((timer) => !timer.canceled);
assert.ok(navigationTimer, 'navigation should wait for the cover animation');
assert.equal(navigationTimer.delay, 80);
navigationTimer.callback();
assert.equal(assignedUrl, 'https://bargig-furniture.com/catalog.html?catalog=test');

// Simulate a restored page before testing the explicit Back path.
classNames.delete('site-transition-leaving');
attributes.delete('aria-busy');
windowListeners.get('pageshow')({ persisted: true });
rafQueue.shift()();
rafQueue.shift()();
for (const timer of timers.values()) {
  if (!timer.canceled) timer.callback();
}
timers.clear();

assert.equal(transition.back(), true);
const backTimer = [...timers.values()].find((timer) => !timer.canceled);
assert.ok(backTimer);
backTimer.callback();
assert.equal(backCalls, 1);
assert.equal(replacedUrl, '');
assert.ok(documentListeners.has('click'), 'managed links should be intercepted at document level');

console.log('page_transition.test.js: PASS');
