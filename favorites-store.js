(function initBargigFavorites(globalScope) {
  "use strict";

  const STORAGE_KEY = "bargig.catalog-favorites.v1";
  const STORAGE_VERSION = 2;
  const MAX_ITEMS = 500;
  const MAX_NOTE_LENGTH = 280;

  function normalizeNote(value) {
    const normalized = String(value || "")
      .replace(/\r\n?/g, "\n")
      .trim();
    return normalized.slice(0, MAX_NOTE_LENGTH);
  }

  function normalizeItem(value) {
    if (!value || typeof value !== "object") return null;
    const catalogId = String(value.catalogId || "").trim();
    const page = Number.parseInt(value.page, 10);
    const savedAt = Number(value.savedAt);
    if (!catalogId || !Number.isFinite(page) || page < 1) return null;
    const item = {
      catalogId,
      page,
      savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0
    };
    const note = normalizeNote(value.note);
    if (note) item.note = note;
    return item;
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
        const existing = memoryItems.find((candidate) => itemKey(candidate) === key);
        const merged = existing ? { ...existing, ...normalized } : normalized;
        const nextItems = [merged, ...memoryItems.filter((candidate) => itemKey(candidate) !== key)];
        persist(nextItems);
        return true;
      },
      update(item, patch) {
        const key = itemKey(item);
        if (!key || !patch || typeof patch !== "object") return false;
        const index = memoryItems.findIndex((candidate) => itemKey(candidate) === key);
        if (index < 0) return false;
        const current = memoryItems[index];
        const next = normalizeItem({ ...current, ...patch });
        if (!next) return false;
        const nextItems = memoryItems.slice();
        nextItems[index] = next;
        persist(nextItems);
        return true;
      },
      setNote(item, note) {
        return this.update(item, { note: normalizeNote(note) });
      },
      reorder(keys) {
        if (!Array.isArray(keys)) return false;
        const normalizedKeys = keys.map((value) => String(value || "")).filter(Boolean);
        if (normalizedKeys.length !== memoryItems.length) return false;
        const currentByKey = new Map(memoryItems.map((item) => [itemKey(item), item]));
        if (new Set(normalizedKeys).size !== memoryItems.length) return false;
        if (normalizedKeys.some((key) => !currentByKey.has(key))) return false;
        persist(normalizedKeys.map((key) => currentByKey.get(key)));
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
    MAX_NOTE_LENGTH,
    normalizeNote,
    normalizeItem,
    normalizeItems,
    itemKey,
    parsePayload,
    serializePayload,
    createStore
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.BargigFavorites = api;
})(typeof window !== "undefined" ? window : globalThis);
