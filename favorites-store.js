(function initBargigFavorites(globalScope) {
  "use strict";

  const STORAGE_KEY = "bargig.catalog-favorites.v1";
  const STORAGE_VERSION = 1;
  const MAX_ITEMS = 500;

  function normalizeItem(value) {
    if (!value || typeof value !== "object") return null;
    const catalogId = String(value.catalogId || "").trim();
    const page = Number.parseInt(value.page, 10);
    const savedAt = Number(value.savedAt);
    if (!catalogId || !Number.isFinite(page) || page < 1) return null;
    return {
      catalogId,
      page,
      savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0
    };
  }

  function itemKey(item) {
    const normalized = normalizeItem(item);
    return normalized ? `${normalized.catalogId}\u0000${normalized.page}` : "";
  }

  function normalizeItems(values) {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    const normalized = [];

    for (const value of values) {
      const item = normalizeItem(value);
      if (!item) continue;
      const key = itemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(item);
      if (normalized.length >= MAX_ITEMS) break;
    }

    return normalized;
  }

  function parsePayload(rawValue) {
    if (!rawValue) return [];
    try {
      const payload = JSON.parse(rawValue);
      if (Array.isArray(payload)) return normalizeItems(payload);
      if (!payload || typeof payload !== "object") return [];
      if (payload.version !== STORAGE_VERSION) return [];
      return normalizeItems(payload.items);
    } catch (_error) {
      return [];
    }
  }

  function serializePayload(items) {
    return JSON.stringify({
      version: STORAGE_VERSION,
      items: normalizeItems(items)
    });
  }

  function createStore(options) {
    const config = options || {};
    const storageKey = String(config.storageKey || STORAGE_KEY);
    const storage = config.storage || null;
    let memoryItems = [];

    function readFromStorage() {
      if (!storage || typeof storage.getItem !== "function") return memoryItems.slice();
      try {
        return parsePayload(storage.getItem(storageKey));
      } catch (_error) {
        return memoryItems.slice();
      }
    }

    function persist(items) {
      memoryItems = normalizeItems(items);
      if (!storage || typeof storage.setItem !== "function") return false;
      try {
        storage.setItem(storageKey, serializePayload(memoryItems));
        return true;
      } catch (_error) {
        return false;
      }
    }

    memoryItems = readFromStorage();

    return {
      storageKey,
      read() {
        return memoryItems.slice();
      },
      reload() {
        memoryItems = readFromStorage();
        return memoryItems.slice();
      },
      has(item) {
        const key = itemKey(item);
        return Boolean(key && memoryItems.some((candidate) => itemKey(candidate) === key));
      },
      add(item) {
        const normalized = normalizeItem(item);
        if (!normalized) return false;
        const key = itemKey(normalized);
        const nextItems = [normalized, ...memoryItems.filter((candidate) => itemKey(candidate) !== key)];
        persist(nextItems);
        return true;
      },
      remove(item) {
        const key = itemKey(item);
        if (!key) return false;
        const nextItems = memoryItems.filter((candidate) => itemKey(candidate) !== key);
        if (nextItems.length === memoryItems.length) return false;
        persist(nextItems);
        return true;
      },
      toggle(item) {
        if (this.has(item)) {
          this.remove(item);
          return false;
        }
        this.add(item);
        return true;
      },
      clear() {
        if (!memoryItems.length) return false;
        persist([]);
        return true;
      },
      replace(items) {
        persist(items);
        return memoryItems.slice();
      }
    };
  }

  const api = {
    STORAGE_KEY,
    STORAGE_VERSION,
    MAX_ITEMS,
    normalizeItem,
    normalizeItems,
    parsePayload,
    serializePayload,
    createStore
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.BargigFavorites = api;
})(typeof window !== "undefined" ? window : globalThis);
