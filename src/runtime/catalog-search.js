/** Typed external ESM runtime: catalog navigation and worker-backed OCR search client. */

/** @import { CatalogImageTier, CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { CatalogCategoryGroup, CatalogSearchResult } from "../../types/frontend-contracts.js" */

import { catalogAssetBaseUrl as configuredCatalogAssetBaseUrl, catalogImageDeliveryMode as configuredCatalogImageDeliveryMode } from "../../catalog-assets.config.js";
import { catalogs as catalogRecords } from "../../catalogs.generated.module.js";

/** @typedef {"category"|"subcategory"|"catalog"} NavigationResultType */
/** @typedef {CatalogSearchResult & {resultType:NavigationResultType, label:string, category:string, score:number, sourceOrder:number}} NavigationSearchResult */
/** @typedef {{category?:string, limit?:number}} NavigationSearchOptions */
/** @typedef {Record<string, unknown> & {channel?:string, category?:string, limit?:number, catalogId?:string}} CatalogSearchOptions */
/** @typedef {{tokens:string[], value:string}} ExactSearchTerm */
/** @typedef {{looseTokens:string[], exactTerms:ExactSearchTerm[]}} ParsedSearchQuery */
/** @typedef {{pages?:number, categoryPages?:Record<string, number>}} SearchReadyStats */
/** @typedef {{stats?:SearchReadyStats}} SearchReadyMetadata */
/** @typedef {{resolve:(value:CatalogSearchResult[])=>void, reject:(reason:unknown)=>void, channel:string}} PendingSearchRequest */
/** @typedef {{type?:string, metadata?:SearchReadyMetadata, requestId?:unknown, results?:unknown, message?:string, stage?:string}} SearchWorkerMessage */
const SEARCH_WORKER_SCRIPT_SRC = "catalog-search-worker.js";
const SEARCH_INDEX_DATA_SRC = "catalogs.search-index.json";
const FINAL_LETTERS = new Map([
  ["ך", "כ"], ["ם", "מ"], ["ן", "נ"], ["ף", "פ"], ["ץ", "צ"]
]);
const ASSET_URL_SCHEMA_VERSION = 2;
const NAVIGATION_RESULT_TYPE_ORDER = Object.freeze({ category: 0, subcategory: 1, catalog: 2 });

/** @type {Worker|null} */
let worker = null;
/** @type {Promise<boolean>|null} */
let readyPromise = null;
/** @type {((value:boolean)=>void)|null} */
let readyResolve = null;
/** @type {((reason?:unknown)=>void)|null} */
let readyReject = null;
/** @type {SearchReadyMetadata|null} */
let readyMetadata = null;
let requestSequence = 0;
/** @type {Map<number, PendingSearchRequest>} */
const pendingRequests = new Map();
/** @type {Map<string, number>} */
const latestRequestByChannel = new Map();

/** @returns {readonly CatalogRecord[]} */
function catalogs() {
  return catalogRecords;
}

/** @param {unknown} value */
function normalize(value) {
  let text = String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[״׳'\"“”]/g, "")
    .replace(/[־–—_]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  text = Array.from(text).map((char) => FINAL_LETTERS.get(char) || char).join("");
  return text.replace(/\s+/g, " ");
}

/** @param {unknown} value */
function normalizeLoose(value) {
  return normalize(value).replace(/[כ]/g, "ב");
}

/** @param {unknown} value */
function normalizeNavigation(value) {
  const compactInlineInitialisms = String(value ?? "").replace(
    /(^|[^\p{L}\p{N}])((?:\p{L}[.\u2024\u2027·•])+\p{L}[.\u2024\u2027·•]?)(?=$|[^\p{L}\p{N}])/gu,
    (_match, prefix, initialism) => `${prefix}${initialism.replace(/[.\u2024\u2027·•]/g, "")}`
  );
  return normalize(compactInlineInitialisms.replace(/[־–—_]/g, " "));
}

/** @param {unknown} value */
function navigationCategorySlug(value) {
  return String(value || "catalog")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "catalog";
}

/** @param {unknown} category @param {number} categoryIndex */
function navigationCategoryTargetId(category, categoryIndex) {
  return `catalog-category-${navigationCategorySlug(category)}-${categoryIndex + 1}`;
}

/** @param {unknown} category @param {number} categoryIndex @param {unknown} subcategory @param {number} subcategoryIndex */
function navigationSubcategoryTargetId(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${navigationCategoryTargetId(category, categoryIndex)}-sub-${navigationCategorySlug(subcategory)}-${subcategoryIndex + 1}`;
}

/** @param {unknown} query @param {unknown} candidate */
function navigationMatchScore(query, candidate) {
  const normalizedQuery = normalizeNavigation(query);
  const normalizedCandidate = normalizeNavigation(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);
  if (normalizedCandidate === normalizedQuery) return 1000;
  if (normalizedCandidate.startsWith(`${normalizedQuery} `)) return 930;
  if (candidateTokens.includes(normalizedQuery)) return 900;
  if (candidateTokens.some((token) => token.startsWith(normalizedQuery))) return 860;
  if (normalizedCandidate.includes(normalizedQuery)) return 820;

  const tokenMatches = queryTokens.every((queryToken) =>
    candidateTokens.some((candidateToken) =>
      candidateToken === queryToken
      || candidateToken.startsWith(queryToken)
      || candidateToken.includes(queryToken)
    )
  );
  if (!tokenMatches) return 0;

  const exactTokenCount = queryTokens.filter((queryToken) => candidateTokens.includes(queryToken)).length;
  const prefixTokenCount = queryTokens.filter((queryToken) =>
    candidateTokens.some((candidateToken) => candidateToken.startsWith(queryToken))
  ).length;
  return 650 + (exactTokenCount * 30) + (prefixTokenCount * 15);
}

/** @param {CatalogCategoryGroup[]} groups @param {unknown} query @param {NavigationSearchOptions} [options] @returns {NavigationSearchResult[]} */
function searchNavigation(groups, query, options = {}) {
  const requestedCategory = String(options.category || "").trim();
  const limit = Math.max(1, Math.min(120, Number(options.limit) || 36));
  /** @type {NavigationSearchResult[]} */
  const results = [];
  const seenCategories = new Set();
  const seenSubcategories = new Set();
  const seenCatalogs = new Set();
  let sourceOrder = 0;

  (Array.isArray(groups) ? groups : []).forEach((group, categoryIndex) => {
    const category = String(group?.category || "").trim();
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!category || !items.length || (requestedCategory && category !== requestedCategory)) return;

    const categoryScore = navigationMatchScore(query, category);
    if (categoryScore > 0 && !seenCategories.has(category)) {
      seenCategories.add(category);
      results.push({
        resultType: "category",
        label: category,
        category,
        targetId: navigationCategoryTargetId(category, categoryIndex),
        score: categoryScore,
        sourceOrder: sourceOrder++
      });
    }

    (Array.isArray(group?.subcategories) ? group.subcategories : []).forEach((subcategoryGroup, subcategoryIndex) => {
      const subcategory = String(subcategoryGroup?.subcategory || "").trim();
      const subcategoryItems = Array.isArray(subcategoryGroup?.items) ? subcategoryGroup.items : [];
      const dedupeKey = `${category}\u0000${subcategory}`;
      const subcategoryScore = navigationMatchScore(query, subcategory);
      if (!subcategory || !subcategoryItems.length || subcategoryScore <= 0 || seenSubcategories.has(dedupeKey)) return;

      seenSubcategories.add(dedupeKey);
      results.push({
        resultType: "subcategory",
        label: subcategory,
        category,
        subcategory,
        targetId: navigationSubcategoryTargetId(category, categoryIndex, subcategory, subcategoryIndex),
        score: subcategoryScore,
        sourceOrder: sourceOrder++
      });
    });

    items.forEach((catalog) => {
      const catalogId = String(catalog?.id || "").trim();
      const title = String(catalog?.title || "").trim();
      const catalogScore = navigationMatchScore(query, title);
      if (!catalogId || !title || catalogScore <= 0 || seenCatalogs.has(catalogId)) return;

      seenCatalogs.add(catalogId);
      results.push({
        resultType: "catalog",
        label: title,
        category,
        subcategory: String(catalog?.subcategory || "").trim(),
        catalogId,
        score: catalogScore,
        sourceOrder: sourceOrder++
      });
    });
  });

  return results
    .sort((first, second) =>
      second.score - first.score
      || (NAVIGATION_RESULT_TYPE_ORDER[first.resultType] ?? 99) - (NAVIGATION_RESULT_TYPE_ORDER[second.resultType] ?? 99)
      || first.sourceOrder - second.sourceOrder
      || String(first.label || "").localeCompare(String(second.label || ""), "he")
    )
    .slice(0, limit);
}

/** @param {NavigationSearchResult[]} navigationResults @param {CatalogSearchResult[]} ocrResults @returns {CatalogSearchResult[]} */
function mergeNavigationResults(navigationResults, ocrResults) {
  const navigation = Array.isArray(navigationResults) ? navigationResults : [];
  const matchedCatalogIds = new Set(navigation.filter((result) => result.resultType === "catalog").map((result) => result.catalogId));
  const matchedCategories = new Set(navigation.filter((result) => result.resultType === "category").map((result) => result.category));
  const filteredOcr = (Array.isArray(ocrResults) ? ocrResults : []).filter((result) => {
    if (result?.matchField === "title" && matchedCatalogIds.has(result.catalogId)) return false;
    if (result?.matchField !== "category") return true;
    return !matchedCategories.has(String(findCatalog(result.catalogId)?.category || "").trim());
  });
  return [...navigation, ...filteredOcr.map((result) => ({ ...result, resultType: "ocr" }))];
}

/** @param {unknown} value */
function escapeNavigationMarkup(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** @param {CatalogSearchResult} result */
function navigationResultMarkup(result) {
  const type = String(result?.resultType || "catalog");
  const typeLabel = type === "category" ? "קטגוריה" : (type === "subcategory" ? "תת קטגוריה" : "קטלוג");
  const action = type === "category"
    ? "פתיחת הקטגוריה במסך הראשי"
    : (type === "subcategory" ? "הצגת תת הקטגוריה במסך הראשי" : "פתיחת דף הקטלוג");
  const context = type === "subcategory"
    ? (result?.category ? ` · בתוך ${result.category}` : "")
    : (type === "catalog" ? ` · ${[result?.category, result?.subcategory].filter(Boolean).join(" · ")}` : "");
  const catalog = type === "catalog" ? findCatalog(result?.catalogId) : null;
  if (catalog) {
    const page = catalogFirstPage(catalog);
    const title = String(result?.label || catalog.title || "קטלוג").trim() || "קטלוג";
    const thumb = thumbSrc(catalog, page);
    const preview = mediumSrc(catalog, page) || pageSrc(catalog, page) || thumb;
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
      <button type="button" class="search-result-button search-navigation-result-button" data-search-navigation-type="${escapeNavigationMarkup(type)}" data-search-navigation-target="${escapeNavigationMarkup(result?.targetId || "")}" data-search-navigation-catalog="${escapeNavigationMarkup(result?.catalogId || "")}">
        <span class="search-result-title" title="${escapeNavigationMarkup(result?.label || "")}"><small class="search-navigation-result-kind">${escapeNavigationMarkup(typeLabel)}</small>${escapeNavigationMarkup(result?.label || "")}</span>
        <span class="search-result-copy"><span class="search-result-meta">${escapeNavigationMarkup(action + context)}</span></span>
      </button>
    </article>
  `;
}

/** @param {unknown} query @returns {string[]} */
function tokenize(query) {
  return normalize(query).split(" ").filter(Boolean);
}

/** @param {unknown} query @returns {ParsedSearchQuery} */
function parseQuery(query) {
  const raw = String(query || "");
  /** @type {ExactSearchTerm[]} */
  const exactTerms = [];
  /** @type {string[]} */
  const looseParts = [];
  let lastIndex = 0;
  const quotedTermPattern = /["“”״]([^"“”״]+)["“”״]/g;
  /** @type {RegExpExecArray|null} */
  let match = null;
  while ((match = quotedTermPattern.exec(raw)) !== null) {
    looseParts.push(raw.slice(lastIndex, match.index));
    const exactTokens = tokenize(match[1]);
    if (exactTokens.length) exactTerms.push({ tokens: exactTokens, value: exactTokens.join(" ") });
    lastIndex = quotedTermPattern.lastIndex;
  }
  looseParts.push(raw.slice(lastIndex));
  return { looseTokens: tokenize(looseParts.join(" ")), exactTerms };
}

/** @param {unknown} num */
function pad(num) {
  return String(num).padStart(3, "0");
}

/** @param {CatalogRecord} catalog */
function catalogFirstPage(catalog) {
  return catalog?.pageNumberStart === 0 ? 0 : 1;
}

/** @param {CatalogRecord} catalog @param {unknown} page */
function displayPageToAssetPage(catalog, page) {
  const firstPage = catalogFirstPage(catalog);
  const pageCount = Math.max(1, Number.parseInt(String(catalog?.pages || 1), 10) || 1);
  const parsed = Number.parseInt(String(page), 10);
  const displayPage = Number.isFinite(parsed) ? parsed : firstPage;
  const lastPage = firstPage + pageCount - 1;
  return Math.min(Math.max(displayPage, firstPage), lastPage) - firstPage + 1;
}

function normalizedCatalogAssetBaseUrl() {
  const rawBase = String(configuredCatalogAssetBaseUrl || "").trim();
  if (!rawBase) return "";
  return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
}

/** @param {string} path */
function isAbsoluteAssetUrl(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
}

/** @param {unknown} path */
function resolveCatalogAssetUrl(path) {
  const cleanPath = String(path || "").trim();
  if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;
  const baseUrl = normalizedCatalogAssetBaseUrl();
  if (!baseUrl) return cleanPath;
  try {
    return new URL(cleanPath.replace(/^\/+/, ""), baseUrl).href;
  } catch {
    return `${baseUrl}${cleanPath.replace(/^\/+/, "")}`;
  }
}

/** @param {CatalogRecord} catalog */
function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}

/** @param {CatalogRecord} catalog */
function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}

/** @param {CatalogRecord} catalog @param {CatalogImageTier} tier */
function assetVersionForTier(catalog, tier) {
  const variantVersion = String(catalog?.imageVariants?.[tier]?.version || "").trim();
  const baseVersion = variantVersion || String(catalog?.assetVersion || "").trim();
  if (!baseVersion) return "";
  return `${baseVersion}-${tier}-u${ASSET_URL_SCHEMA_VERSION}`;
}

/** @param {string} url @param {CatalogRecord} catalog @param {CatalogImageTier} tier */
function withAssetVersion(url, catalog, tier) {
  const version = assetVersionForTier(catalog, tier);
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

/** @param {CatalogRecord} catalog @param {unknown} page */
function pageSrc(catalog, page) {
  const assetPage = displayPageToAssetPage(catalog, page);
  return withAssetVersion(`${catalogDir(catalog)}/page-${pad(assetPage)}.${imageExt(catalog)}`, catalog, "full");
}

/** @param {CatalogRecord} catalog @param {unknown} page */
function thumbSrc(catalog, page) {
  const assetPage = displayPageToAssetPage(catalog, page);
  return withAssetVersion(`${catalogDir(catalog)}/thumbs/page-${pad(assetPage)}.${imageExt(catalog)}`, catalog, "thumb");
}

/** @param {CatalogRecord} catalog @param {unknown} page */
function mediumSrc(catalog, page) {
  if (String(configuredCatalogImageDeliveryMode || "").trim().toLowerCase() === "full-only") return "";
  const variant = catalog?.imageVariants?.medium;
  if (!variant || typeof variant !== "object") return "";
  const directory = String(variant.directory || "medium").trim().replace(/^\/+|\/+$/g, "") || "medium";
  const assetPage = displayPageToAssetPage(catalog, page);
  return withAssetVersion(`${catalogDir(catalog)}/${directory}/page-${pad(assetPage)}.${imageExt(catalog)}`, catalog, "medium");
}

/** @param {CatalogRecord} catalog @param {unknown} page */
function navigationImageDimensionAttributes(catalog, page) {
  const assetPage = displayPageToAssetPage(catalog, page);
  const size = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes[assetPage - 1] : null;
  const width = Number(size?.[0]);
  const height = Number(size?.[1]);
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? ` width="${width}" height="${height}"`
    : "";
}

/** @param {unknown} catalogId @returns {CatalogRecord|null} */
function findCatalog(catalogId) {
  return catalogs().find((catalog) => catalog.id === catalogId) || null;
}

/** @param {CatalogRecord} catalog @param {unknown} category */
function catalogMatchesCategory(catalog, category) {
  const requestedCategory = String(category || "").trim();
  if (!requestedCategory) return true;
  return normalize(catalog?.category || "") === normalize(requestedCategory);
}

function makeCancelledError() {
  const error = new Error("Search request superseded");
  error.name = "SearchCancelledError";
  return error;
}

/** @param {unknown} error */
function isCancelledError(error) {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "SearchCancelledError");
}

/** @param {number} requestId @param {unknown} error */
function rejectPendingRequest(requestId, error) {
  const pending = pendingRequests.get(requestId);
  if (!pending) return;
  pendingRequests.delete(requestId);
  pending.reject(error);
}

/** @param {string} channel @param {number} [exceptRequestId] */
function rejectChannelRequests(channel, exceptRequestId = 0) {
  for (const [requestId, pending] of pendingRequests) {
    if (pending.channel !== channel || requestId === exceptRequestId) continue;
    pendingRequests.delete(requestId);
    pending.reject(makeCancelledError());
  }
}

/** @param {MessageEvent<SearchWorkerMessage>} event */
function handleWorkerMessage(event) {
  const message = event.data || {};
  if (message.type === "ready") {
    readyMetadata = message.metadata || null;
    readyResolve?.(true);
    readyResolve = null;
    readyReject = null;
    return;
  }
  if (message.type === "results") {
    const requestId = Number(message.requestId || 0);
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);
    if (latestRequestByChannel.get(pending.channel) !== requestId) {
      pending.reject(makeCancelledError());
      return;
    }
    const results = /** @type {CatalogSearchResult[]} */ (Array.isArray(message.results) ? message.results : []);
    pending.resolve(results.map((result) => {
      const catalog = findCatalog(result.catalogId);
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
  const error = new Error(message.message || "Catalog search worker failed");
  if (message.stage === "init") {
    readyReject?.(error);
    readyResolve = null;
    readyReject = null;
    readyPromise = null;
    worker?.terminate?.();
    worker = null;
    return;
  }
  rejectPendingRequest(Number(message.requestId || 0), error);
}

/** @param {ErrorEvent|MessageEvent} event */
function handleWorkerFailure(event) {
  const message = "message" in event ? event.message : "";
  const error = new Error(message || "Catalog search worker stopped unexpectedly");
  readyReject?.(error);
  readyResolve = null;
  readyReject = null;
  readyPromise = null;
  for (const requestId of Array.from(pendingRequests.keys())) rejectPendingRequest(requestId, error);
  worker?.terminate?.();
  worker = null;
}

/** @returns {Promise<boolean>} */
function ensureReady() {
  if (readyMetadata) return Promise.resolve(true);
  if (readyPromise) return readyPromise;
  if (typeof Worker !== "function") return Promise.reject(new Error("Web Worker is not supported by this browser"));

  readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
    worker = new Worker(SEARCH_WORKER_SCRIPT_SRC, { name: "bargig-catalog-search" });
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", handleWorkerFailure);
    worker.addEventListener("messageerror", handleWorkerFailure);
    worker.postMessage({ type: "init", indexUrl: SEARCH_INDEX_DATA_SRC });
  });
  return readyPromise;
}

/** @param {string} [channel] */
function cancel(channel = "default") {
  const key = String(channel || "default");
  const requestId = ++requestSequence;
  latestRequestByChannel.set(key, requestId);
  rejectChannelRequests(key);
  worker?.postMessage?.({ type: "cancel", channel: key, requestId });
}

/** @param {unknown} query @param {CatalogSearchOptions} [options] @returns {Promise<CatalogSearchResult[]>} */
async function search(query, options = {}) {
  await ensureReady();
  const channel = String(options.channel || "default");
  const requestId = ++requestSequence;
  latestRequestByChannel.set(channel, requestId);
  rejectChannelRequests(channel);
  const workerOptions = { ...options };
  delete workerOptions.channel;

  const activeWorker = worker;
  if (!activeWorker) throw new Error("Catalog search worker is unavailable after initialization");
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject, channel });
    activeWorker.postMessage({
      type: "search",
      channel,
      requestId,
      query: String(query || ""),
      options: workerOptions
    });
  });
}

/** @param {{category?:string}} [options] */
function indexedPageCount(options = {}) {
  if (!readyMetadata?.stats) return 0;
  const category = String(options.category || "").trim();
  if (!category) return Number(readyMetadata.stats.pages || 0);
  return Number(readyMetadata.stats.categoryPages?.[category] || 0);
}

/** @param {{category?:string}} [options] */
function hasIndex(options = {}) {
  return indexedPageCount(options) > 0;
}

function isReady() {
  return Boolean(readyMetadata);
}

/** @param {unknown} text @param {unknown} query @param {number} [maxLength] */
function makeExcerpt(text, query, maxLength = 180) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const tokens = tokenize(query).filter((token) => token.length >= 2);
  const normalizedRaw = normalize(raw);
  let hit = -1;
  for (const token of tokens) {
    const index = normalizedRaw.indexOf(token);
    if (index !== -1) { hit = index; break; }
  }
  const start = hit === -1 ? 0 : Math.max(0, hit - 58);
  const end = Math.min(raw.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${raw.slice(start, end)}${end < raw.length ? "…" : ""}`;
}

const catalogSearchApi = Object.freeze({
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
export {
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
  navigationResultMarkup,
  catalogSearchApi as catalogSearch
};
export default catalogSearchApi;
