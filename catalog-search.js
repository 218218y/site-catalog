(function () {
  "use strict";

  const SEARCH_WORKER_SCRIPT_SRC = "catalog-search-worker.js";
  const SEARCH_INDEX_DATA_SRC = "catalogs.search-index.json";
  const FINAL_LETTERS = new Map([
    ["ך", "כ"], ["ם", "מ"], ["ן", "נ"], ["ף", "פ"], ["ץ", "צ"]
  ]);
  const ASSET_URL_SCHEMA_VERSION = 2;
  const NAVIGATION_RESULT_TYPE_ORDER = Object.freeze({ category: 0, subcategory: 1, catalog: 2 });

  let worker = null;
  let readyPromise = null;
  let readyResolve = null;
  let readyReject = null;
  let readyMetadata = null;
  let requestSequence = 0;
  const pendingRequests = new Map();
  const latestRequestByChannel = new Map();

  function catalogs() {
    return Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
  }

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

  function normalizeLoose(value) {
    return normalize(value).replace(/[כ]/g, "ב");
  }

  function normalizeNavigation(value) {
    const compactInlineInitialisms = String(value ?? "").replace(
      /(^|[^\p{L}\p{N}])((?:\p{L}[.\u2024\u2027·•])+\p{L}[.\u2024\u2027·•]?)(?=$|[^\p{L}\p{N}])/gu,
      (_match, prefix, initialism) => `${prefix}${initialism.replace(/[.\u2024\u2027·•]/g, "")}`
    );
    return normalize(compactInlineInitialisms.replace(/[־–—_]/g, " "));
  }

  function navigationCategorySlug(value) {
    return String(value || "catalog")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "catalog";
  }

  function navigationCategoryTargetId(category, categoryIndex) {
    return `catalog-category-${navigationCategorySlug(category)}-${categoryIndex + 1}`;
  }

  function navigationSubcategoryTargetId(category, categoryIndex, subcategory, subcategoryIndex) {
    return `${navigationCategoryTargetId(category, categoryIndex)}-sub-${navigationCategorySlug(subcategory)}-${subcategoryIndex + 1}`;
  }

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

  function searchNavigation(groups, query, options = {}) {
    const requestedCategory = String(options.category || "").trim();
    const limit = Math.max(1, Math.min(120, Number(options.limit) || 36));
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

  function escapeNavigationMarkup(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

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
      const page = 1;
      const title = String(result?.label || catalog.title || "קטלוג").trim() || "קטלוג";
      const thumb = thumbSrc(catalog, page);
      const preview = mediumSrc(catalog, page) || pageSrc(catalog, page) || thumb;
      return `
        <article class="search-result-card search-navigation-result-card search-navigation-catalog-result-card">
          <button type="button" class="search-result-button search-navigation-result-button search-navigation-catalog-result-button" data-search-navigation-type="catalog" data-search-navigation-target="" data-search-navigation-catalog="${escapeNavigationMarkup(catalog.id)}" data-search-catalog="${escapeNavigationMarkup(catalog.id)}" data-search-page="${page}" data-search-preview-src="${escapeNavigationMarkup(preview)}" data-search-preview-title="${escapeNavigationMarkup(title)}">
            <span class="search-result-title" title="${escapeNavigationMarkup(title)}"><small class="search-navigation-result-kind">${typeLabel}</small>${escapeNavigationMarkup(title)}</span>
            <span class="search-result-thumb-frame catalog-image-frame">
              <img class="search-result-thumb" src="${escapeNavigationMarkup(thumb)}" alt="שער ${escapeNavigationMarkup(title)}"${navigationImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async" data-catalog-image-recovery="lightweight" data-catalog-id="${escapeNavigationMarkup(catalog.id)}" data-page="${page}" data-telemetry-detail="search-catalog-cover" />
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

  function tokenize(query) {
    return normalize(query).split(" ").filter(Boolean);
  }

  function parseQuery(query) {
    const raw = String(query || "");
    const exactTerms = [];
    const looseParts = [];
    let lastIndex = 0;
    const quotedTermPattern = /["“”״]([^"“”״]+)["“”״]/g;
    let match;
    while ((match = quotedTermPattern.exec(raw)) !== null) {
      looseParts.push(raw.slice(lastIndex, match.index));
      const exactTokens = tokenize(match[1]);
      if (exactTokens.length) exactTerms.push({ tokens: exactTokens, value: exactTokens.join(" ") });
      lastIndex = quotedTermPattern.lastIndex;
    }
    looseParts.push(raw.slice(lastIndex));
    return { looseTokens: tokenize(looseParts.join(" ")), exactTerms };
  }

  function pad(num) {
    return String(num).padStart(3, "0");
  }

  function catalogAssetBaseUrl() {
    const rawBase = String(window.BARGIG_CATALOG_ASSET_BASE_URL || "").trim();
    if (!rawBase) return "";
    return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  }

  function isAbsoluteAssetUrl(path) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
  }

  function resolveCatalogAssetUrl(path) {
    const cleanPath = String(path || "").trim();
    if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;
    const baseUrl = catalogAssetBaseUrl();
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
    const variantVersion = String(catalog?.imageVariants?.[tier]?.version || "").trim();
    const baseVersion = variantVersion || String(catalog?.assetVersion || "").trim();
    if (!baseVersion) return "";
    return `${baseVersion}-${tier}-u${ASSET_URL_SCHEMA_VERSION}`;
  }

  function withAssetVersion(url, catalog, tier) {
    const version = assetVersionForTier(catalog, tier);
    if (!version) return url;
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
  }

  function pageSrc(catalog, page) {
    return withAssetVersion(`${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`, catalog, "full");
  }

  function thumbSrc(catalog, page) {
    return withAssetVersion(`${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`, catalog, "thumb");
  }

  function mediumSrc(catalog, page) {
    if (String(window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE || "").trim().toLowerCase() === "full-only") return "";
    const variant = catalog?.imageVariants?.medium;
    if (!variant || typeof variant !== "object") return "";
    const directory = String(variant.directory || "medium").trim().replace(/^\/+|\/+$/g, "") || "medium";
    return withAssetVersion(`${catalogDir(catalog)}/${directory}/page-${pad(page)}.${imageExt(catalog)}`, catalog, "medium");
  }

  function navigationImageDimensionAttributes(catalog, page) {
    const size = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes[page - 1] : null;
    const width = Number(size?.[0]);
    const height = Number(size?.[1]);
    return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? ` width="${width}" height="${height}"`
      : "";
  }

  function findCatalog(catalogId) {
    return catalogs().find((catalog) => catalog.id === catalogId) || null;
  }

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

  function isCancelledError(error) {
    return error?.name === "SearchCancelledError";
  }

  function rejectPendingRequest(requestId, error) {
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);
    pending.reject(error);
  }

  function rejectChannelRequests(channel, exceptRequestId = 0) {
    for (const [requestId, pending] of pendingRequests) {
      if (pending.channel !== channel || requestId === exceptRequestId) continue;
      pendingRequests.delete(requestId);
      pending.reject(makeCancelledError());
    }
  }

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
      const results = Array.isArray(message.results) ? message.results : [];
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

  function handleWorkerFailure(event) {
    const error = new Error(event?.message || "Catalog search worker stopped unexpectedly");
    readyReject?.(error);
    readyResolve = null;
    readyReject = null;
    readyPromise = null;
    for (const requestId of Array.from(pendingRequests.keys())) rejectPendingRequest(requestId, error);
    worker?.terminate?.();
    worker = null;
  }

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

  function cancel(channel = "default") {
    const key = String(channel || "default");
    const requestId = ++requestSequence;
    latestRequestByChannel.set(key, requestId);
    rejectChannelRequests(key);
    worker?.postMessage?.({ type: "cancel", channel: key, requestId });
  }

  async function search(query, options = {}) {
    await ensureReady();
    const channel = String(options.channel || "default");
    const requestId = ++requestSequence;
    latestRequestByChannel.set(channel, requestId);
    rejectChannelRequests(channel);
    const workerOptions = { ...options };
    delete workerOptions.channel;

    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject, channel });
      worker.postMessage({
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
    const category = String(options.category || "").trim();
    if (!category) return Number(readyMetadata.stats.pages || 0);
    return Number(readyMetadata.stats.categoryPages?.[category] || 0);
  }

  function hasIndex(options = {}) {
    return indexedPageCount(options) > 0;
  }

  function isReady() {
    return Boolean(readyMetadata);
  }

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
  if (typeof window !== "undefined") window.BargigCatalogSearch = catalogSearchApi;
  if (typeof module !== "undefined" && module.exports) module.exports = catalogSearchApi;
})();
