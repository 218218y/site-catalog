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

  function persistenceFailureReason(error, fallback = "write-failed") {
    const name = String(error?.name || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    if (name.includes("quota") || message.includes("quota")) return "quota-exceeded";
    if (name.includes("security") || message.includes("denied") || message.includes("blocked")) return "blocked";
    return fallback;
  }

  function createStore(options) {
    const config = options || {};
    const storageKey = String(config.storageKey || STORAGE_KEY);
    const storage = config.storage || null;
    let memoryItems = [];
    let persistence = {
      persisted: Boolean(storage && typeof storage.setItem === "function"),
      reason: storage ? "" : "unavailable"
    };
    let lastMutation = null;

    function persistenceSnapshot() {
      return { ...persistence };
    }

    function mutationResult(operation, changed, writeResult, extra = {}) {
      const result = {
        operation,
        changed: Boolean(changed),
        persisted: Boolean(writeResult?.persisted),
        reason: String(writeResult?.reason || ""),
        items: memoryItems.slice(),
        ...extra
      };
      lastMutation = result;
      return result;
    }

    function readFromStorage() {
      if (!storage || typeof storage.getItem !== "function") {
        persistence = { persisted: false, reason: "unavailable" };
        return memoryItems.slice();
      }
      try {
        const items = parsePayload(storage.getItem(storageKey));
        persistence = { persisted: true, reason: "" };
        return items;
      } catch (error) {
        persistence = { persisted: false, reason: persistenceFailureReason(error, "read-failed") };
        return memoryItems.slice();
      }
    }

    function persist(items) {
      memoryItems = normalizeItems(items);
      if (!storage || typeof storage.setItem !== "function") {
        persistence = { persisted: false, reason: "unavailable" };
        return persistenceSnapshot();
      }

      const serialized = serializePayload(memoryItems);
      try {
        storage.setItem(storageKey, serialized);
        if (typeof storage.getItem === "function" && storage.getItem(storageKey) !== serialized) {
          persistence = { persisted: false, reason: "verification-failed" };
          return persistenceSnapshot();
        }
        persistence = { persisted: true, reason: "" };
      } catch (error) {
        persistence = { persisted: false, reason: persistenceFailureReason(error) };
      }
      return persistenceSnapshot();
    }

    function unchanged(operation, extra = {}) {
      return mutationResult(operation, false, persistenceSnapshot(), extra);
    }

    memoryItems = readFromStorage();

    const store = {
      storageKey,
      read() {
        return memoryItems.slice();
      },
      reload() {
        memoryItems = readFromStorage();
        return memoryItems.slice();
      },
      status() {
        return persistenceSnapshot();
      },
      lastMutation() {
        return lastMutation ? { ...lastMutation, items: lastMutation.items.slice() } : null;
      },
      has(item) {
        const key = itemKey(item);
        return Boolean(key && memoryItems.some((candidate) => itemKey(candidate) === key));
      },
      addDetailed(item) {
        const normalized = normalizeItem(item);
        if (!normalized) return unchanged("add", { active: false, reason: "invalid-item" });
        const key = itemKey(normalized);
        const existing = memoryItems.find((candidate) => itemKey(candidate) === key);
        const merged = existing ? { ...existing, ...normalized } : normalized;
        const nextItems = [merged, ...memoryItems.filter((candidate) => itemKey(candidate) !== key)];
        return mutationResult("add", true, persist(nextItems), { active: true });
      },
      add(item) {
        return this.addDetailed(item).changed;
      },
      updateDetailed(item, patch) {
        const key = itemKey(item);
        if (!key || !patch || typeof patch !== "object") return unchanged("update", { reason: "invalid-update" });
        const index = memoryItems.findIndex((candidate) => itemKey(candidate) === key);
        if (index < 0) return unchanged("update", { reason: "not-found" });
        const current = memoryItems[index];
        const next = normalizeItem({ ...current, ...patch });
        if (!next) return unchanged("update", { reason: "invalid-update" });
        const nextItems = memoryItems.slice();
        nextItems[index] = next;
        if (serializePayload(nextItems) === serializePayload(memoryItems)) return unchanged("update");
        return mutationResult("update", true, persist(nextItems));
      },
      update(item, patch) {
        return this.updateDetailed(item, patch).changed;
      },
      setNoteDetailed(item, note) {
        const result = { ...this.updateDetailed(item, { note: normalizeNote(note) }), operation: "set-note" };
        lastMutation = result;
        return result;
      },
      setNote(item, note) {
        return this.setNoteDetailed(item, note).changed;
      },
      reorderDetailed(keys) {
        if (!Array.isArray(keys)) return unchanged("reorder", { reason: "invalid-order" });
        const normalizedKeys = keys.map((value) => String(value || "")).filter(Boolean);
        if (normalizedKeys.length !== memoryItems.length) return unchanged("reorder", { reason: "invalid-order" });
        const currentByKey = new Map(memoryItems.map((item) => [itemKey(item), item]));
        if (new Set(normalizedKeys).size !== memoryItems.length) return unchanged("reorder", { reason: "invalid-order" });
        if (normalizedKeys.some((key) => !currentByKey.has(key))) return unchanged("reorder", { reason: "invalid-order" });
        const nextItems = normalizedKeys.map((key) => currentByKey.get(key));
        if (serializePayload(nextItems) === serializePayload(memoryItems)) return unchanged("reorder");
        return mutationResult("reorder", true, persist(nextItems));
      },
      reorder(keys) {
        return this.reorderDetailed(keys).changed;
      },
      removeDetailed(item) {
        const key = itemKey(item);
        if (!key) return unchanged("remove", { active: false, reason: "invalid-item" });
        const nextItems = memoryItems.filter((candidate) => itemKey(candidate) !== key);
        if (nextItems.length === memoryItems.length) return unchanged("remove", { active: false, reason: "not-found" });
        return mutationResult("remove", true, persist(nextItems), { active: false });
      },
      remove(item) {
        return this.removeDetailed(item).changed;
      },
      toggleDetailed(item) {
        const result = this.has(item)
          ? { ...this.removeDetailed(item), operation: "toggle", active: false }
          : { ...this.addDetailed(item), operation: "toggle", active: true };
        lastMutation = result;
        return result;
      },
      toggle(item) {
        return this.toggleDetailed(item).active;
      },
      clearDetailed() {
        if (!memoryItems.length) return unchanged("clear");
        return mutationResult("clear", true, persist([]));
      },
      clear() {
        return this.clearDetailed().changed;
      },
      replaceDetailed(items) {
        const nextItems = normalizeItems(items);
        if (serializePayload(nextItems) === serializePayload(memoryItems)) return unchanged("replace");
        return mutationResult("replace", true, persist(nextItems));
      },
      replace(items) {
        this.replaceDetailed(items);
        return memoryItems.slice();
      }
    };

    return store;
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
