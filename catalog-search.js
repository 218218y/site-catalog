(function () {
  "use strict";

  const SEARCH_WORKER_SCRIPT_SRC = "catalog-search-worker.js";
  const SEARCH_INDEX_DATA_SRC = "catalogs.search-index.json";
  const FINAL_LETTERS = new Map([
    ["ך", "כ"], ["ם", "מ"], ["ן", "נ"], ["ף", "פ"], ["ץ", "צ"]
  ]);
  const ASSET_URL_SCHEMA_VERSION = 2;

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
      .replace(/[\u0591-\u05C7]/g, "")
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

  window.BargigCatalogSearch = {
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
    catalogMatchesCategory
  };
})();
