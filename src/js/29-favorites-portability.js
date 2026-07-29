/**
 * Source module: 29-favorites-portability.js
 * Pure favorites transfer, merge, and portable-link domain logic.
 */

/**
 * @typedef {Object} FavoritesPortabilityDependencies
 * @property {(values:unknown)=>Array<FavoriteItem>} normalizeItems
 * @property {(id:unknown)=>CatalogRecord|null} findCatalogById
 * @property {()=>Array<CatalogRecord>} catalogs
 * @property {(value:string)=>string} encodeBase64
 * @property {(value:string)=>string} decodeBase64
 * @property {number} shareVersion
 */

/**
 * @param {FavoritesPortabilityDependencies} dependencies
 */
function createFavoritesPortabilityDomain(dependencies) {
  const {
    normalizeItems,
    findCatalogById: findCatalog,
    catalogs: readCatalogs,
    encodeBase64,
    decodeBase64,
    shareVersion
  } = dependencies;

  /** @param {FavoriteKeySource|null|undefined} item */
  function favoriteItemKey(item) {
    const catalogId = String(item?.catalogId || item?.catalog?.id || "").trim();
    const page = Number.parseInt(String(item?.page ?? ""), 10);
    return catalogId && Number.isFinite(page) && page > 0 ? `${catalogId}\u0000${page}` : "";
  }

  /** @param {unknown} values @returns {FavoritesTransfer} */
  function normalizeFavoriteTransferItems(values) {
    const normalized = normalizeItems(values);
    /** @type {FavoriteItem[]} */
    const accepted = [];
    let rejected = Math.max(0, Array.isArray(values) ? values.length - normalized.length : 0);

    normalized.forEach((item) => {
      const catalog = findCatalog(item.catalogId);
      const pageCount = Number.parseInt(String(catalog?.pages || 0), 10);
      if (!catalog || !Number.isFinite(pageCount) || item.page > pageCount) {
        rejected += 1;
        return;
      }
      accepted.push({
        catalogId: item.catalogId,
        page: item.page,
        savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : 0
      });
    });

    return { items: accepted, rejected };
  }

  /** @param {unknown} incoming @param {unknown} existing @returns {FavoriteMergeAnalysis} */
  function analyzeFavoriteItemMerge(incoming, existing) {
    const incomingItems = normalizeFavoriteTransferItems(incoming).items;
    const existingItems = normalizeItems(existing);
    const existingByKey = new Map(existingItems.map((item) => [favoriteItemKey(item), item]));
    const incomingKeys = new Set(incomingItems.map(favoriteItemKey).filter(Boolean));
    const newItems = incomingItems.filter((item) => !existingByKey.has(favoriteItemKey(item)));
    const alreadyExistingItems = incomingItems.filter((item) => existingByKey.has(favoriteItemKey(item)));
    const mergedIncomingItems = incomingItems.map((item) => {
      const existingItem = existingByKey.get(favoriteItemKey(item));
      if (!existingItem) return item;
      return {
        ...item,
        savedAt: Number(existingItem.savedAt) > 0 ? Number(existingItem.savedAt) : Number(item.savedAt) || 0,
        ...(String(existingItem.note || "").trim() ? { note: String(existingItem.note).trim() } : {})
      };
    });
    const preservedExistingItems = existingItems.filter((item) => !incomingKeys.has(favoriteItemKey(item)));

    return {
      incomingItems,
      existingItems,
      newItems,
      alreadyExistingItems,
      mergedItems: [...mergedIncomingItems, ...preservedExistingItems]
    };
  }

  /** @param {unknown} value */
  function encodeBase64UrlUtf8(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return encodeBase64(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  /** @param {unknown} value */
  function decodeBase64UrlUtf8(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = decodeBase64(`${normalized}${padding}`);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /** @param {unknown} items @returns {FavoriteItem[]} */
  function canonicalizeFavoriteShareItems(items) {
    const normalized = normalizeFavoriteTransferItems(items).items.map(({ catalogId, page }) => ({ catalogId, page, savedAt: 0 }));
    const catalogOrder = new Map(readCatalogs().map((catalog, index) => [String(catalog.id || ""), index]));
    return normalized.sort((first, second) => {
      const firstIndex = catalogOrder.get(first.catalogId) ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = catalogOrder.get(second.catalogId) ?? Number.MAX_SAFE_INTEGER;
      if (firstIndex !== secondIndex) return firstIndex - secondIndex;
      const catalogCompare = first.catalogId.localeCompare(second.catalogId, "he");
      return catalogCompare || first.page - second.page;
    });
  }

  /** @param {Array<number>} pages */
  function encodeFavoritePageRanges(pages) {
    const sorted = [...new Set(pages.map((page) => Number.parseInt(String(page), 10)).filter((page) => Number.isFinite(page) && page > 0))]
      .sort((first, second) => first - second);
    /** @type {string[]} */
    const ranges = [];
    for (let index = 0; index < sorted.length;) {
      const start = sorted[index];
      let end = start;
      while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
        index += 1;
        end = sorted[index];
      }
      const encodedStart = start.toString(36);
      ranges.push(end === start ? encodedStart : `${encodedStart}-${end.toString(36)}`);
      index += 1;
    }
    return ranges.join(",");
  }

  /** @param {unknown} value @returns {number[]} */
  function decodeFavoritePageRanges(value) {
    /** @type {number[]} */
    const pages = [];
    String(value || "").split(",").forEach((part) => {
      if (!part) return;
      const [rawStart, rawEnd = rawStart] = part.split("-", 2);
      const start = Number.parseInt(rawStart, 36);
      const end = Number.parseInt(rawEnd, 36);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start || end - start > 1000) return;
      for (let page = start; page <= end; page += 1) pages.push(page);
    });
    return pages;
  }

  /** @param {unknown} items */
  function buildFavoritesShareToken(items) {
    /** @type {Map<string,number[]>} */
    const grouped = new Map();
    canonicalizeFavoriteShareItems(items).forEach(({ catalogId, page }) => {
      const pages = grouped.get(catalogId) || [];
      pages.push(page);
      grouped.set(catalogId, pages);
    });
    const payload = [...grouped.entries()]
      .map(([catalogId, pages]) => `${encodeURIComponent(catalogId)}~${encodeFavoritePageRanges(pages)}`)
      .join("|");
    return `v${shareVersion}.${encodeBase64UrlUtf8(payload)}`;
  }

  /** @param {unknown} token @returns {FavoritesTransfer} */
  function parseFavoritesShareToken(token) {
    const rawToken = String(token || "").trim();
    const prefix = `v${shareVersion}.`;
    if (!rawToken.startsWith(prefix)) return { items: [], rejected: 0, valid: false };

    try {
      const payload = decodeBase64UrlUtf8(rawToken.slice(prefix.length));
      /** @type {FavoriteItem[]} */
      const rawItems = [];
      if (payload) {
        payload.split("|").forEach((group) => {
          const separatorIndex = group.indexOf("~");
          if (separatorIndex < 1) return;
          const catalogId = decodeURIComponent(group.slice(0, separatorIndex));
          decodeFavoritePageRanges(group.slice(separatorIndex + 1)).forEach((page) => {
            rawItems.push({ catalogId, page, savedAt: 0 });
          });
        });
      }
      const normalized = normalizeFavoriteTransferItems(rawItems);
      return { ...normalized, valid: true };
    } catch (_error) {
      return { items: [], rejected: 0, valid: false };
    }
  }

  /**
   * @param {{items:Array<FavoriteItem>, rejected?:number}|null|undefined} pending
   * @param {unknown} existing
   */
  function favoritesTransferSummary(pending, existing) {
    if (!pending) return "";
    const comparison = analyzeFavoriteItemMerge(pending.items, existing);
    const incomingCount = comparison.incomingItems.length;
    const currentCount = comparison.existingItems.length;
    const newCount = comparison.newItems.length;
    const alreadyExistingCount = comparison.alreadyExistingItems.length;
    const rejectedText = pending.rejected ? ` · ${pending.rejected} פריטים לא היו זמינים באתר זה` : "";
    const existingLabel = alreadyExistingCount === 1 ? "קיים" : "קיימים";
    const newLabel = newCount === 1 ? "חדש" : "חדשים";
    const overlapText = alreadyExistingCount > 0
      ? `\nמתוכם ${alreadyExistingCount} ${existingLabel} ו-${newCount} ${newLabel}`
      : "";
    return `${incomingCount} פריטים ברשימה שהתקבלה · ${currentCount} פריטים שמורים כעת${rejectedText}${overlapText}`;
  }

  return Object.freeze({
    favoriteItemKey,
    analyzeFavoriteItemMerge,
    buildFavoritesShareToken,
    parseFavoritesShareToken,
    favoritesTransferSummary
  });
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["favorites-portability"] = Object.freeze({ createFavoritesPortabilityDomain });
}
/* TEST-ONLY EXPORTS: END */

export { createFavoritesPortabilityDomain };
