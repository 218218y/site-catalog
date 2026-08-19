/** Typed external ESM runtime: favorites persistence and normalization. */

/** @import { FavoriteItem, FavoriteMutationResult, FavoritesStore } from "../../types/frontend-contracts.js" */

/** @typedef {{getItem?:(key:string)=>string|null, setItem?:(key:string, value:string)=>void}} FavoritesStorage */
/** @typedef {{storageKey?:string, storage?:FavoritesStorage|null}} FavoritesStoreOptions */
/** @typedef {{persisted:boolean, reason:string}} PersistenceState */
/** @typedef {{active?:boolean, reason?:string}} MutationExtra */
/** @typedef {{catalogId?:unknown, page?:unknown, savedAt?:unknown, note?:unknown}} FavoriteItemInput */

const STORAGE_KEY = "bargig.catalog-favorites.v1";
const STORAGE_VERSION = 2;
const MAX_ITEMS = 500;
const MAX_NOTE_LENGTH = 280;

/** @param {unknown} value */
function normalizeNote(value) {
  const normalized = String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
  return normalized.slice(0, MAX_NOTE_LENGTH);
}

/** @param {unknown} value @returns {FavoriteItem|null} */
function normalizeItem(value) {
  if (!value || typeof value !== "object") return null;
  const input = /** @type {FavoriteItemInput} */ (value);
  const catalogId = String(input.catalogId || "").trim();
  const page = Number.parseInt(String(input.page ?? ""), 10);
  const savedAt = Number(input.savedAt);
  if (!catalogId || !Number.isFinite(page) || page < 0) return null;
  /** @type {FavoriteItem} */
  const item = {
    catalogId,
    page,
    savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0
  };
  const note = normalizeNote(input.note);
  if (note) item.note = note;
  return item;
}

/** @param {unknown} item */
function itemKey(item) {
  const normalized = normalizeItem(item);
  return normalized ? `${normalized.catalogId}\u0000${normalized.page}` : "";
}

/** @param {unknown} values @returns {FavoriteItem[]} */
function normalizeItems(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  /** @type {FavoriteItem[]} */
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

/** @param {unknown} rawValue @returns {FavoriteItem[]} */
function parsePayload(rawValue) {
  if (!rawValue) return [];
  try {
    const payload = /** @type {{version?:unknown, items?:unknown}} */ (JSON.parse(String(rawValue)));
    if (!payload || typeof payload !== "object") return [];
    if (payload.version !== STORAGE_VERSION) return [];
    return normalizeItems(payload.items);
  } catch (_error) {
    return [];
  }
}

/** @param {unknown} items */
function serializePayload(items) {
  return JSON.stringify({
    version: STORAGE_VERSION,
    items: normalizeItems(items)
  });
}

/** @param {unknown} error @param {string} [fallback] */
function persistenceFailureReason(error, fallback = "write-failed") {
  const candidate = /** @type {{name?:unknown, message?:unknown}|null} */ (
    error && typeof error === "object" ? error : null
  );
  const name = String(candidate?.name || "").toLowerCase();
  const message = String(candidate?.message || "").toLowerCase();
  if (name.includes("quota") || message.includes("quota")) return "quota-exceeded";
  if (name.includes("security") || message.includes("denied") || message.includes("blocked")) return "blocked";
  return fallback;
}

/** @param {FavoritesStoreOptions} [options] @returns {FavoritesStore} */
function createStore(options = {}) {
  const storageKey = String(options.storageKey || STORAGE_KEY);
  const storage = options.storage || null;
  /** @type {FavoriteItem[]} */
  let memoryItems = [];
  /** @type {PersistenceState} */
  let persistence = {
    persisted: Boolean(storage && typeof storage.setItem === "function"),
    reason: storage ? "" : "unavailable"
  };
  /** @type {FavoriteMutationResult|null} */
  let lastMutation = null;

  /** @returns {PersistenceState} */
  function persistenceSnapshot() {
    return { ...persistence };
  }

  /**
   * @param {string} operation
   * @param {boolean} changed
   * @param {PersistenceState} writeResult
   * @param {MutationExtra} [extra]
   * @returns {FavoriteMutationResult}
   */
  function mutationResult(operation, changed, writeResult, extra = {}) {
    const result = {
      operation,
      changed: Boolean(changed),
      persisted: Boolean(writeResult.persisted),
      reason: String(extra.reason || writeResult.reason || ""),
      items: memoryItems.slice(),
      ...(typeof extra.active === "boolean" ? { active: extra.active } : {})
    };
    lastMutation = result;
    return result;
  }

  /** @returns {FavoriteItem[]} */
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

  /** @param {unknown} items @returns {PersistenceState} */
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

  /** @param {string} operation @param {MutationExtra} [extra] */
  function unchanged(operation, extra = {}) {
    return mutationResult(operation, false, persistenceSnapshot(), extra);
  }

  memoryItems = readFromStorage();

  /** @type {FavoritesStore} */
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
    setNoteDetailed(item, note) {
      const result = { ...this.updateDetailed(item, { note: normalizeNote(note) }), operation: "set-note" };
      lastMutation = result;
      return result;
    },
    reorderDetailed(keys) {
      if (!Array.isArray(keys)) return unchanged("reorder", { reason: "invalid-order" });
      const normalizedKeys = keys.map((value) => String(value || "")).filter(Boolean);
      if (normalizedKeys.length !== memoryItems.length) return unchanged("reorder", { reason: "invalid-order" });
      const currentByKey = new Map(memoryItems.map((item) => [itemKey(item), item]));
      if (new Set(normalizedKeys).size !== memoryItems.length) return unchanged("reorder", { reason: "invalid-order" });
      if (normalizedKeys.some((key) => !currentByKey.has(key))) return unchanged("reorder", { reason: "invalid-order" });
      const nextItems = normalizedKeys.map((key) => currentByKey.get(key)).filter((item) => Boolean(item));
      if (serializePayload(nextItems) === serializePayload(memoryItems)) return unchanged("reorder");
      return mutationResult("reorder", true, persist(nextItems));
    },
    removeDetailed(item) {
      const key = itemKey(item);
      if (!key) return unchanged("remove", { active: false, reason: "invalid-item" });
      const nextItems = memoryItems.filter((candidate) => itemKey(candidate) !== key);
      if (nextItems.length === memoryItems.length) return unchanged("remove", { active: false, reason: "not-found" });
      return mutationResult("remove", true, persist(nextItems), { active: false });
    },
    toggleDetailed(item) {
      const result = this.has(item)
        ? { ...this.removeDetailed(item), operation: "toggle", active: false }
        : { ...this.addDetailed(item), operation: "toggle", active: true };
      lastMutation = result;
      return result;
    },
    clearDetailed() {
      if (!memoryItems.length) return unchanged("clear");
      return mutationResult("clear", true, persist([]));
    },
    replaceDetailed(items) {
      const nextItems = normalizeItems(items);
      if (serializePayload(nextItems) === serializePayload(memoryItems)) return unchanged("replace");
      return mutationResult("replace", true, persist(nextItems));
    }
  };

  return store;
}

const favoritesRuntime = Object.freeze({
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
});

export {
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
  createStore,
  favoritesRuntime
};
export default favoritesRuntime;
