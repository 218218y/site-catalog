/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: catalog-search.js
 * ES module entrypoint: src/runtime/catalog-search.js
 * Bundled ES module graph:
 *   - src/runtime/catalog-search.js
 * External browser modules:
 *   - catalog-assets.config.js
 *   - catalogs.generated.module.js
 * Compiler virtual inputs: none
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.2 (lockfile-selected direct devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// src/runtime/catalog-search.js
import { catalogAssetBaseUrl as configuredCatalogAssetBaseUrl, catalogImageDeliveryMode as configuredCatalogImageDeliveryMode } from "./catalog-assets.config.js";
import { catalogs as catalogRecords } from "./catalogs.generated.module.js";
var SEARCH_WORKER_SCRIPT_SRC = "catalog-search-worker.js", SEARCH_INDEX_DATA_SRC = "catalogs.search-index.json", FINAL_LETTERS = /* @__PURE__ */ new Map([
  ["ך", "כ"],
  ["ם", "מ"],
  ["ן", "נ"],
  ["ף", "פ"],
  ["ץ", "צ"]
]), ASSET_URL_SCHEMA_VERSION = 2, NAVIGATION_RESULT_TYPE_ORDER = Object.freeze({ category: 0, subcategory: 1, catalog: 2 }), worker = null, readyPromise = null, readyResolve = null, readyReject = null, readyMetadata = null, requestSequence = 0, pendingRequests = /* @__PURE__ */ new Map(), latestRequestByChannel = /* @__PURE__ */ new Map();
function catalogs() {
  return catalogRecords;
}
function normalize(value) {
  let text = String(value ?? "").toLowerCase().normalize("NFKD").replace(/\p{M}+/gu, "").replace(/[״׳'\"“”]/g, "").replace(/[־–—_]/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return text = Array.from(text).map((char) => FINAL_LETTERS.get(char) || char).join(""), text.replace(/\s+/g, " ");
}
function normalizeLoose(value) {
  return normalize(value).replace(/[כ]/g, "ב");
}
function normalizeNavigation(value) {
  let compactInlineInitialisms = String(value ?? "").replace(
    /(^|[^\p{L}\p{N}])((?:\p{L}[.\u2024\u2027·•])+\p{L}[.\u2024\u2027·•]?)(?=$|[^\p{L}\p{N}])/gu,
    (_match, prefix, initialism) => `${prefix}${initialism.replace(/[.\u2024\u2027·•]/g, "")}`
  );
  return normalize(compactInlineInitialisms.replace(/[־–—_]/g, " "));
}
function navigationCategorySlug(value) {
  return String(value || "catalog").trim().toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g, "-").replace(/^-+|-+$/g, "") || "catalog";
}
function navigationCategoryTargetId(category, categoryIndex) {
  return `catalog-category-${navigationCategorySlug(category)}-${categoryIndex + 1}`;
}
function navigationSubcategoryTargetId(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${navigationCategoryTargetId(category, categoryIndex)}-sub-${navigationCategorySlug(subcategory)}-${subcategoryIndex + 1}`;
}
function navigationMatchScore(query, candidate) {
  let normalizedQuery = normalizeNavigation(query), normalizedCandidate = normalizeNavigation(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  let queryTokens = normalizedQuery.split(" ").filter(Boolean), candidateTokens = normalizedCandidate.split(" ").filter(Boolean);
  if (normalizedCandidate === normalizedQuery) return 1e3;
  if (normalizedCandidate.startsWith(`${normalizedQuery} `)) return 930;
  if (candidateTokens.includes(normalizedQuery)) return 900;
  if (candidateTokens.some((token) => token.startsWith(normalizedQuery))) return 860;
  if (normalizedCandidate.includes(normalizedQuery)) return 820;
  if (!queryTokens.every(
    (queryToken) => candidateTokens.some(
      (candidateToken) => candidateToken === queryToken || candidateToken.startsWith(queryToken) || candidateToken.includes(queryToken)
    )
  )) return 0;
  let exactTokenCount = queryTokens.filter((queryToken) => candidateTokens.includes(queryToken)).length, prefixTokenCount = queryTokens.filter(
    (queryToken) => candidateTokens.some((candidateToken) => candidateToken.startsWith(queryToken))
  ).length;
  return 650 + exactTokenCount * 30 + prefixTokenCount * 15;
}
function searchNavigation(groups, query, options = {}) {
  let requestedCategory = String(options.category || "").trim(), limit = Math.max(1, Math.min(120, Number(options.limit) || 36)), results = [], seenCategories = /* @__PURE__ */ new Set(), seenSubcategories = /* @__PURE__ */ new Set(), seenCatalogs = /* @__PURE__ */ new Set(), sourceOrder = 0;
  return (Array.isArray(groups) ? groups : []).forEach((group, categoryIndex) => {
    let category = String(group?.category || "").trim(), items = Array.isArray(group?.items) ? group.items : [];
    if (!category || !items.length || requestedCategory && category !== requestedCategory) return;
    let categoryScore = navigationMatchScore(query, category);
    categoryScore > 0 && !seenCategories.has(category) && (seenCategories.add(category), results.push({
      resultType: "category",
      label: category,
      category,
      targetId: navigationCategoryTargetId(category, categoryIndex),
      score: categoryScore,
      sourceOrder: sourceOrder++
    })), (Array.isArray(group?.subcategories) ? group.subcategories : []).forEach((subcategoryGroup, subcategoryIndex) => {
      let subcategory = String(subcategoryGroup?.subcategory || "").trim(), subcategoryItems = Array.isArray(subcategoryGroup?.items) ? subcategoryGroup.items : [], dedupeKey = `${category}\0${subcategory}`, subcategoryScore = navigationMatchScore(query, subcategory);
      !subcategory || !subcategoryItems.length || subcategoryScore <= 0 || seenSubcategories.has(dedupeKey) || (seenSubcategories.add(dedupeKey), results.push({
        resultType: "subcategory",
        label: subcategory,
        category,
        subcategory,
        targetId: navigationSubcategoryTargetId(category, categoryIndex, subcategory, subcategoryIndex),
        score: subcategoryScore,
        sourceOrder: sourceOrder++
      }));
    }), items.forEach((catalog) => {
      let catalogId = String(catalog?.id || "").trim(), title = String(catalog?.title || "").trim(), catalogScore = navigationMatchScore(query, title);
      !catalogId || !title || catalogScore <= 0 || seenCatalogs.has(catalogId) || (seenCatalogs.add(catalogId), results.push({
        resultType: "catalog",
        label: title,
        category,
        subcategory: String(catalog?.subcategory || "").trim(),
        catalogId,
        score: catalogScore,
        sourceOrder: sourceOrder++
      }));
    });
  }), results.sort(
    (first, second) => second.score - first.score || (NAVIGATION_RESULT_TYPE_ORDER[first.resultType] ?? 99) - (NAVIGATION_RESULT_TYPE_ORDER[second.resultType] ?? 99) || first.sourceOrder - second.sourceOrder || String(first.label || "").localeCompare(String(second.label || ""), "he")
  ).slice(0, limit);
}
function mergeNavigationResults(navigationResults, ocrResults) {
  let navigation = Array.isArray(navigationResults) ? navigationResults : [], matchedCatalogIds = new Set(navigation.filter((result) => result.resultType === "catalog").map((result) => result.catalogId)), matchedCategories = new Set(navigation.filter((result) => result.resultType === "category").map((result) => result.category)), filteredOcr = (Array.isArray(ocrResults) ? ocrResults : []).filter((result) => result?.matchField === "title" && matchedCatalogIds.has(result.catalogId) ? !1 : result?.matchField !== "category" ? !0 : !matchedCategories.has(String(findCatalog(result.catalogId)?.category || "").trim()));
  return [...navigation, ...filteredOcr];
}
function escapeNavigationMarkup(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function navigationResultMarkup(result) {
  let type = result.resultType, typeLabel = type === "category" ? "קטגוריה" : type === "subcategory" ? "תת קטגוריה" : "קטלוג", action = type === "category" ? "פתיחת הקטגוריה במסך הראשי" : type === "subcategory" ? "הצגת תת הקטגוריה במסך הראשי" : "פתיחת דף הקטלוג", context = type === "subcategory" ? result?.category ? ` · בתוך ${result.category}` : "" : type === "catalog" ? ` · ${[result?.category, result?.subcategory].filter(Boolean).join(" · ")}` : "", catalog = type === "catalog" ? findCatalog(result.catalogId) : null;
  if (catalog) {
    let page = catalogFirstPage(catalog), title = String(result?.label || catalog.title || "קטלוג").trim() || "קטלוג", thumb = thumbSrc(catalog, page), preview = thumb;
    return `
      <article class="search-result-card search-navigation-result-card search-navigation-catalog-result-card">
        <button type="button" class="search-result-button search-navigation-result-button search-navigation-catalog-result-button" data-search-navigation-type="catalog" data-search-navigation-target="" data-search-navigation-catalog="${escapeNavigationMarkup(catalog.id)}" data-search-catalog="${escapeNavigationMarkup(catalog.id)}" data-search-page="${page}" data-search-preview-src="${escapeNavigationMarkup(preview)}" data-search-preview-title="${escapeNavigationMarkup(title)}">
          <span class="search-result-title" title="${escapeNavigationMarkup(title)}"><small class="search-navigation-result-kind">${typeLabel}</small>${escapeNavigationMarkup(title)}</span>
          <span class="search-result-thumb-frame catalog-image-frame">
            <img class="search-result-thumb" src="${escapeNavigationMarkup(thumb)}" alt="שער ${escapeNavigationMarkup(title)}"${navigationImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async" data-catalog-image-recovery="lightweight" data-catalog-id="${escapeNavigationMarkup(catalog.id)}" data-page="${page}" data-telemetry-detail="search-catalog-cover" data-telemetry-surface="global-search-results" />
          </span>
          <span class="search-result-copy"><span class="search-result-meta">${escapeNavigationMarkup(action + context)}</span></span>
        </button>
      </article>
    `;
  }
  return `
    <article class="search-result-card search-navigation-result-card">
      <button type="button" class="search-result-button search-navigation-result-button" data-search-navigation-type="${escapeNavigationMarkup(type)}" data-search-navigation-target="${escapeNavigationMarkup(type === "catalog" ? "" : result.targetId)}" data-search-navigation-catalog="${escapeNavigationMarkup(type === "catalog" ? result.catalogId : "")}">
        <span class="search-result-title" title="${escapeNavigationMarkup(result?.label || "")}"><small class="search-navigation-result-kind">${escapeNavigationMarkup(typeLabel)}</small>${escapeNavigationMarkup(result?.label || "")}</span>
        <span class="search-result-copy"><span class="search-result-meta">${escapeNavigationMarkup(action + context)}</span></span>
      </button>
    </article>
  `;
}
function tokenize(query) {
  return normalize(query).split(" ").filter(Boolean);
}
function parseQuery(query) {
  let raw = String(query || ""), exactTerms = [], looseParts = [], lastIndex = 0, quotedTermPattern = /["“”״]([^"“”״]+)["“”״]/g, match = null;
  for (; (match = quotedTermPattern.exec(raw)) !== null; ) {
    looseParts.push(raw.slice(lastIndex, match.index));
    let exactTokens = tokenize(match[1]);
    exactTokens.length && exactTerms.push({ tokens: exactTokens, value: exactTokens.join(" ") }), lastIndex = quotedTermPattern.lastIndex;
  }
  return looseParts.push(raw.slice(lastIndex)), { looseTokens: tokenize(looseParts.join(" ")), exactTerms };
}
function pad(num) {
  return String(num).padStart(3, "0");
}
function catalogFirstPage(catalog) {
  return catalog?.pageNumberStart === 0 ? 0 : 1;
}
function displayPageToAssetPage(catalog, page) {
  let firstPage = catalogFirstPage(catalog), pageCount = Math.max(1, Number.parseInt(String(catalog?.pages || 1), 10) || 1), parsed = Number.parseInt(String(page), 10), displayPage = Number.isFinite(parsed) ? parsed : firstPage, lastPage = firstPage + pageCount - 1;
  return Math.min(Math.max(displayPage, firstPage), lastPage) - firstPage + 1;
}
function normalizedCatalogAssetBaseUrl() {
  let rawBase = String(configuredCatalogAssetBaseUrl || "").trim();
  return rawBase ? rawBase.endsWith("/") ? rawBase : `${rawBase}/` : "";
}
function isAbsoluteAssetUrl(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
}
function resolveCatalogAssetUrl(path) {
  let cleanPath = String(path || "").trim();
  if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;
  let baseUrl = normalizedCatalogAssetBaseUrl();
  if (!baseUrl) return cleanPath;
  try {
    return new URL(cleanPath.replace(/^\/+/, ""), baseUrl).href;
  } catch {
    return `${baseUrl}${cleanPath.replace(/^\/+/, "")}`;
  }
}
function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}
function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}
function assetVersionForTier(catalog, tier) {
  let baseVersion = String(catalog?.imageVariants?.[tier]?.version || "").trim() || String(catalog?.assetVersion || "").trim();
  return baseVersion ? `${baseVersion}-${tier}-u${ASSET_URL_SCHEMA_VERSION}` : "";
}
function withAssetVersion(url, catalog, tier) {
  let version = assetVersionForTier(catalog, tier);
  return version ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}` : url;
}
function pageSrc(catalog, page) {
  let assetPage = displayPageToAssetPage(catalog, page);
  return withAssetVersion(`${catalogDir(catalog)}/page-${pad(assetPage)}.${imageExt(catalog)}`, catalog, "full");
}
function thumbSrc(catalog, page) {
  let assetPage = displayPageToAssetPage(catalog, page);
  return withAssetVersion(`${catalogDir(catalog)}/thumbs/page-${pad(assetPage)}.${imageExt(catalog)}`, catalog, "thumb");
}
function navigationImageDimensionAttributes(catalog, page) {
  let assetPage = displayPageToAssetPage(catalog, page), size = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes[assetPage - 1] : null, width = Number(size?.[0]), height = Number(size?.[1]);
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? ` width="${width}" height="${height}"` : "";
}
function findCatalog(catalogId) {
  return catalogs().find((catalog) => catalog.id === catalogId) || null;
}
function catalogMatchesCategory(catalog, category) {
  let requestedCategory = String(category || "").trim();
  return requestedCategory ? normalize(catalog?.category || "") === normalize(requestedCategory) : !0;
}
function makeCancelledError() {
  let error = new Error("Search request superseded");
  return error.name = "SearchCancelledError", error;
}
function isCancelledError(error) {
  return !!(error && typeof error == "object" && "name" in error && error.name === "SearchCancelledError");
}
function rejectPendingRequest(requestId, error) {
  let pending = pendingRequests.get(requestId);
  pending && (pendingRequests.delete(requestId), pending.reject(error));
}
function rejectChannelRequests(channel, exceptRequestId = 0) {
  for (let [requestId, pending] of pendingRequests)
    pending.channel !== channel || requestId === exceptRequestId || (pendingRequests.delete(requestId), pending.reject(makeCancelledError()));
}
function handleWorkerMessage(event) {
  let message = event.data || {};
  if (message.type === "ready") {
    readyMetadata = message.metadata || null, readyResolve?.(!0), readyResolve = null, readyReject = null;
    return;
  }
  if (message.type === "results") {
    let requestId = Number(message.requestId || 0), pending = pendingRequests.get(requestId);
    if (!pending) return;
    if (pendingRequests.delete(requestId), latestRequestByChannel.get(pending.channel) !== requestId) {
      pending.reject(makeCancelledError());
      return;
    }
    let results = (
      /** @type {CatalogOcrSearchResult[]} */
      Array.isArray(message.results) ? message.results : []
    );
    pending.resolve(results.map((result) => {
      let catalog = findCatalog(result.catalogId);
      return {
        ...result,
        catalog,
        image: catalog ? pageSrc(catalog, result.page) : "",
        thumb: catalog ? thumbSrc(catalog, result.page) : ""
      };
    }));
    return;
  }
  if (message.type !== "error") return;
  let error = new Error(message.message || "Catalog search worker failed");
  if (message.stage === "init") {
    readyReject?.(error), readyResolve = null, readyReject = null, readyPromise = null, worker?.terminate?.(), worker = null;
    return;
  }
  rejectPendingRequest(Number(message.requestId || 0), error);
}
function handleWorkerFailure(event) {
  let message = "message" in event ? event.message : "", error = new Error(message || "Catalog search worker stopped unexpectedly");
  readyReject?.(error), readyResolve = null, readyReject = null, readyPromise = null;
  for (let requestId of Array.from(pendingRequests.keys())) rejectPendingRequest(requestId, error);
  worker?.terminate?.(), worker = null;
}
function ensureReady() {
  return readyMetadata ? Promise.resolve(!0) : readyPromise || (typeof Worker != "function" ? Promise.reject(new Error("Web Worker is not supported by this browser")) : (readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve, readyReject = reject, worker = new Worker(SEARCH_WORKER_SCRIPT_SRC, { name: "bargig-catalog-search" }), worker.addEventListener("message", handleWorkerMessage), worker.addEventListener("error", handleWorkerFailure), worker.addEventListener("messageerror", handleWorkerFailure), worker.postMessage({ type: "init", indexUrl: SEARCH_INDEX_DATA_SRC });
  }), readyPromise));
}
function cancel(channel = "default") {
  let key = String(channel || "default"), requestId = ++requestSequence;
  latestRequestByChannel.set(key, requestId), rejectChannelRequests(key), worker?.postMessage?.({ type: "cancel", channel: key, requestId });
}
async function search(query, options = {}) {
  await ensureReady();
  let channel = String(options.channel || "default"), requestId = ++requestSequence;
  latestRequestByChannel.set(channel, requestId), rejectChannelRequests(channel);
  let workerOptions = { ...options };
  delete workerOptions.channel;
  let activeWorker = worker;
  if (!activeWorker) throw new Error("Catalog search worker is unavailable after initialization");
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject, channel }), activeWorker.postMessage({
      type: "search",
      channel,
      requestId,
      query: String(query || ""),
      options: workerOptions
    });
  });
}
function indexedPageCount(options = {}) {
  if (!readyMetadata?.stats) return 0;
  let category = String(options.category || "").trim();
  return Number(category ? readyMetadata.stats.categoryPages?.[category] || 0 : readyMetadata.stats.pages || 0);
}
function hasIndex(options = {}) {
  return indexedPageCount(options) > 0;
}
function isReady() {
  return !!readyMetadata;
}
function makeExcerpt(text, query, maxLength = 180) {
  let raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  let tokens = tokenize(query).filter((token) => token.length >= 2), normalizedRaw = normalize(raw), hit = -1;
  for (let token of tokens) {
    let index = normalizedRaw.indexOf(token);
    if (index !== -1) {
      hit = index;
      break;
    }
  }
  let start = hit === -1 ? 0 : Math.max(0, hit - 58), end = Math.min(raw.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${raw.slice(start, end)}${end < raw.length ? "…" : ""}`;
}
var catalogSearchApi = Object.freeze({
  search,
  cancel,
  ensureReady,
  isReady,
  isCancelledError,
  normalize,
  normalizeLoose,
  tokenize,
  parseQuery,
  hasIndex,
  indexedPageCount,
  findCatalog,
  pageSrc,
  thumbSrc,
  makeExcerpt,
  catalogMatchesCategory,
  searchNavigation,
  mergeNavigationResults,
  navigationResultMarkup
});
var catalog_search_default = catalogSearchApi;
export {
  cancel,
  catalogMatchesCategory,
  catalogSearchApi as catalogSearch,
  catalog_search_default as default,
  ensureReady,
  findCatalog,
  hasIndex,
  indexedPageCount,
  isCancelledError,
  isReady,
  makeExcerpt,
  mergeNavigationResults,
  navigationResultMarkup,
  normalize,
  normalizeLoose,
  pageSrc,
  parseQuery,
  search,
  searchNavigation,
  thumbSrc,
  tokenize
};
