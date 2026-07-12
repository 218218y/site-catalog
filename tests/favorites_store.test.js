'use strict';

const assert = require('node:assert/strict');
const {
  STORAGE_KEY,
  createStore,
  parsePayload,
  serializePayload
} = require('../favorites-store.js');

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    dump(key) { return data.get(key); }
  };
}

function run() {
  assert.deepEqual(parsePayload('{not-json'), []);
  assert.deepEqual(parsePayload(JSON.stringify({ version: 99, items: [] })), []);

  const normalized = parsePayload(serializePayload([
    { catalogId: 'chairs', page: 3, savedAt: 20 },
    { catalogId: 'chairs', page: 3, savedAt: 10 },
    { catalogId: '', page: 2 },
    { catalogId: 'tables', page: '4', savedAt: 30 }
  ]));
  assert.deepEqual(normalized, [
    { catalogId: 'chairs', page: 3, savedAt: 20 },
    { catalogId: 'tables', page: 4, savedAt: 30 }
  ]);

  const storage = createMemoryStorage();
  const store = createStore({ storage });
  assert.equal(store.storageKey, STORAGE_KEY);
  assert.deepEqual(store.read(), []);

  assert.equal(store.add({ catalogId: 'chairs', page: 2, savedAt: 100 }), true);
  assert.equal(store.has({ catalogId: 'chairs', page: 2 }), true);
  assert.equal(store.toggle({ catalogId: 'tables', page: 7, savedAt: 200 }), true);
  assert.deepEqual(store.read(), [
    { catalogId: 'tables', page: 7, savedAt: 200 },
    { catalogId: 'chairs', page: 2, savedAt: 100 }
  ]);

  assert.equal(store.toggle({ catalogId: 'chairs', page: 2 }), false);
  assert.equal(store.has({ catalogId: 'chairs', page: 2 }), false);
  assert.equal(store.remove({ catalogId: 'missing', page: 1 }), false);

  const secondStore = createStore({ storage });
  assert.deepEqual(secondStore.read(), [{ catalogId: 'tables', page: 7, savedAt: 200 }]);
  store.clear();
  secondStore.reload();
  assert.deepEqual(secondStore.read(), []);

  const throwingStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  const fallbackStore = createStore({ storage: throwingStorage });
  fallbackStore.add({ catalogId: 'fallback', page: 1, savedAt: 1 });
  assert.equal(fallbackStore.has({ catalogId: 'fallback', page: 1 }), true);

  console.log('favorites_store.test.js: PASS');
}

run();
