/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: favorites-store.js
 * ES module entrypoint: src/runtime/favorites-store.js
 * Bundled ES module graph:
 *   - src/runtime/favorites-store.js
 * Compiler virtual inputs: none
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.1 (direct pinned devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// src/runtime/favorites-store.js
var STORAGE_KEY = "bargig.catalog-favorites.v1", STORAGE_VERSION = 2, MAX_ITEMS = 500, MAX_NOTE_LENGTH = 280;
function normalizeNote(value) {
  return String(value || "").replace(/\r\n?/g, `
`).trim().slice(0, 280);
}
function normalizeItem(value) {
  if (!value || typeof value != "object") return null;
  let input = (
    /** @type {FavoriteItemInput} */
    value
  ), catalogId = String(input.catalogId || "").trim(), page = Number.parseInt(String(input.page ?? ""), 10), savedAt = Number(input.savedAt);
  if (!catalogId || !Number.isFinite(page) || page < 0) return null;
  let item = {
    catalogId,
    page,
    savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0
  }, note = normalizeNote(input.note);
  return note && (item.note = note), item;
}
function itemKey(item) {
  let normalized = normalizeItem(item);
  return normalized ? `${normalized.catalogId}\0${normalized.page}` : "";
}
function normalizeItems(values) {
  if (!Array.isArray(values)) return [];
  let seen = /* @__PURE__ */ new Set(), normalized = [];
  for (let value of values) {
    let item = normalizeItem(value);
    if (!item) continue;
    let key = itemKey(item);
    if (!seen.has(key) && (seen.add(key), normalized.push(item), normalized.length >= 500))
      break;
  }
  return normalized;
}
function parsePayload(rawValue) {
  if (!rawValue) return [];
  try {
    let payload = (
      /** @type {{version?:unknown, items?:unknown}} */
      JSON.parse(String(rawValue))
    );
    return !payload || typeof payload != "object" ? [] : payload.version !== 2 ? [] : normalizeItems(payload.items);
  } catch {
    return [];
  }
}
function serializePayload(items) {
  return JSON.stringify({
    version: 2,
    items: normalizeItems(items)
  });
}
function persistenceFailureReason(error, fallback = "write-failed") {
  let candidate = (
    /** @type {{name?:unknown, message?:unknown}|null} */
    error && typeof error == "object" ? error : null
  ), name = String(candidate?.name || "").toLowerCase(), message = String(candidate?.message || "").toLowerCase();
  return name.includes("quota") || message.includes("quota") ? "quota-exceeded" : name.includes("security") || message.includes("denied") || message.includes("blocked") ? "blocked" : fallback;
}
function createStore(options = {}) {
  let storageKey = String(options.storageKey || STORAGE_KEY), storage = options.storage || null, memoryItems = [], persistence = {
    persisted: !!(storage && typeof storage.setItem == "function"),
    reason: storage ? "" : "unavailable"
  }, lastMutation = null;
  function persistenceSnapshot() {
    return { ...persistence };
  }
  function mutationResult(operation, changed, writeResult, extra = {}) {
    let result = {
      operation,
      changed: !!changed,
      persisted: !!writeResult.persisted,
      reason: String(extra.reason || writeResult.reason || ""),
      items: memoryItems.slice(),
      ...typeof extra.active == "boolean" ? { active: extra.active } : {}
    };
    return lastMutation = result, result;
  }
  function readFromStorage() {
    if (!storage || typeof storage.getItem != "function")
      return persistence = { persisted: !1, reason: "unavailable" }, memoryItems.slice();
    try {
      let items = parsePayload(storage.getItem(storageKey));
      return persistence = { persisted: !0, reason: "" }, items;
    } catch (error) {
      return persistence = { persisted: !1, reason: persistenceFailureReason(error, "read-failed") }, memoryItems.slice();
    }
  }
  function persist(items) {
    if (memoryItems = normalizeItems(items), !storage || typeof storage.setItem != "function")
      return persistence = { persisted: !1, reason: "unavailable" }, persistenceSnapshot();
    let serialized = serializePayload(memoryItems);
    try {
      if (storage.setItem(storageKey, serialized), typeof storage.getItem == "function" && storage.getItem(storageKey) !== serialized)
        return persistence = { persisted: !1, reason: "verification-failed" }, persistenceSnapshot();
      persistence = { persisted: !0, reason: "" };
    } catch (error) {
      persistence = { persisted: !1, reason: persistenceFailureReason(error) };
    }
    return persistenceSnapshot();
  }
  function unchanged(operation, extra = {}) {
    return mutationResult(operation, !1, persistenceSnapshot(), extra);
  }
  return memoryItems = readFromStorage(), {
    storageKey,
    read() {
      return memoryItems.slice();
    },
    reload() {
      return memoryItems = readFromStorage(), memoryItems.slice();
    },
    status() {
      return persistenceSnapshot();
    },
    lastMutation() {
      return lastMutation ? { ...lastMutation, items: lastMutation.items.slice() } : null;
    },
    has(item) {
      let key = itemKey(item);
      return !!(key && memoryItems.some((candidate) => itemKey(candidate) === key));
    },
    addDetailed(item) {
      let normalized = normalizeItem(item);
      if (!normalized) return unchanged("add", { active: !1, reason: "invalid-item" });
      let key = itemKey(normalized), existing = memoryItems.find((candidate) => itemKey(candidate) === key), nextItems = [existing ? { ...existing, ...normalized } : normalized, ...memoryItems.filter((candidate) => itemKey(candidate) !== key)];
      return mutationResult("add", !0, persist(nextItems), { active: !0 });
    },
    add(item) {
      return this.addDetailed(item).changed;
    },
    updateDetailed(item, patch) {
      let key = itemKey(item);
      if (!key || !patch || typeof patch != "object") return unchanged("update", { reason: "invalid-update" });
      let index = memoryItems.findIndex((candidate) => itemKey(candidate) === key);
      if (index < 0) return unchanged("update", { reason: "not-found" });
      let current = memoryItems[index], next = normalizeItem({ ...current, ...patch });
      if (!next) return unchanged("update", { reason: "invalid-update" });
      let nextItems = memoryItems.slice();
      return nextItems[index] = next, serializePayload(nextItems) === serializePayload(memoryItems) ? unchanged("update") : mutationResult("update", !0, persist(nextItems));
    },
    update(item, patch) {
      return this.updateDetailed(item, patch).changed;
    },
    setNoteDetailed(item, note) {
      let result = { ...this.updateDetailed(item, { note: normalizeNote(note) }), operation: "set-note" };
      return lastMutation = result, result;
    },
    setNote(item, note) {
      return this.setNoteDetailed(item, note).changed;
    },
    reorderDetailed(keys) {
      if (!Array.isArray(keys)) return unchanged("reorder", { reason: "invalid-order" });
      let normalizedKeys = keys.map((value) => String(value || "")).filter(Boolean);
      if (normalizedKeys.length !== memoryItems.length) return unchanged("reorder", { reason: "invalid-order" });
      let currentByKey = new Map(memoryItems.map((item) => [itemKey(item), item]));
      if (new Set(normalizedKeys).size !== memoryItems.length) return unchanged("reorder", { reason: "invalid-order" });
      if (normalizedKeys.some((key) => !currentByKey.has(key))) return unchanged("reorder", { reason: "invalid-order" });
      let nextItems = normalizedKeys.map((key) => currentByKey.get(key)).filter((item) => !!item);
      return serializePayload(nextItems) === serializePayload(memoryItems) ? unchanged("reorder") : mutationResult("reorder", !0, persist(nextItems));
    },
    reorder(keys) {
      return this.reorderDetailed(keys).changed;
    },
    removeDetailed(item) {
      let key = itemKey(item);
      if (!key) return unchanged("remove", { active: !1, reason: "invalid-item" });
      let nextItems = memoryItems.filter((candidate) => itemKey(candidate) !== key);
      return nextItems.length === memoryItems.length ? unchanged("remove", { active: !1, reason: "not-found" }) : mutationResult("remove", !0, persist(nextItems), { active: !1 });
    },
    remove(item) {
      return this.removeDetailed(item).changed;
    },
    toggleDetailed(item) {
      let result = this.has(item) ? { ...this.removeDetailed(item), operation: "toggle", active: !1 } : { ...this.addDetailed(item), operation: "toggle", active: !0 };
      return lastMutation = result, result;
    },
    toggle(item) {
      return !!this.toggleDetailed(item).active;
    },
    clearDetailed() {
      return memoryItems.length ? mutationResult("clear", !0, persist([])) : unchanged("clear");
    },
    clear() {
      return this.clearDetailed().changed;
    },
    replaceDetailed(items) {
      let nextItems = normalizeItems(items);
      return serializePayload(nextItems) === serializePayload(memoryItems) ? unchanged("replace") : mutationResult("replace", !0, persist(nextItems));
    },
    replace(items) {
      return this.replaceDetailed(items), memoryItems.slice();
    }
  };
}
var favoritesRuntime = Object.freeze({
  STORAGE_KEY,
  STORAGE_VERSION: 2,
  MAX_ITEMS: 500,
  MAX_NOTE_LENGTH: 280,
  normalizeNote,
  normalizeItem,
  normalizeItems,
  itemKey,
  parsePayload,
  serializePayload,
  createStore
});
var favorites_store_default = favoritesRuntime;
export {
  MAX_ITEMS,
  MAX_NOTE_LENGTH,
  STORAGE_KEY,
  STORAGE_VERSION,
  createStore,
  favorites_store_default as default,
  favoritesRuntime,
  itemKey,
  normalizeItem,
  normalizeItems,
  normalizeNote,
  parsePayload,
  serializePayload
};
