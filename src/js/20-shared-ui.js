/**
 * Source module: 20-shared-ui.js
 * Shared media loading, image placeholders, action feedback, asset paths, snapshots, and route helpers.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

/** @type {Readonly<{siteActionToast:HTMLElement}>} */
const uiElements = Object.freeze({
  siteActionToast: requiredElement("siteActionToast")
});

/** @typedef {CatalogImageCandidate & {fallback:boolean}} CatalogImageRecoveryCandidate */
/** @typedef {{primaryTier?:string, forceRefresh?:boolean, forceRefreshRole?:string, fallbackTier?:string, fallbackCandidates?:Array<CatalogImageCandidate>}} CatalogImageRecoveryCandidateOptions */
/** @typedef {{failedAttempts:number, attempts:number}} CatalogImageRecoveryProgress */
/** @typedef {{failedAttempts:number, lastCandidate:CatalogImageRecoveryCandidate|null}} CatalogImageRecoveryExhausted */
/**
 * @typedef {CatalogImageRecoveryCandidateOptions & {
 *   primarySrc?:string,
 *   fallbackSrc?:string,
 *   isCurrent?:()=>boolean,
 *   telemetryDetail?:unknown,
 *   initialFailedAttempts?:number,
 *   onExhausted?:(result:CatalogImageRecoveryExhausted)=>void,
 *   onSuccess?:(candidate:CatalogImageRecoveryCandidate, progress:CatalogImageRecoveryProgress)=>void,
 *   onFailure?:(candidate:CatalogImageRecoveryCandidate, progress:CatalogImageRecoveryProgress)=>void,
 *   onAttempt?:(candidate:CatalogImageRecoveryCandidate, progress:CatalogImageRecoveryProgress)=>void
 * }} CatalogImageRecoveryOptions
 */
/** @typedef {{priority?:RequestPriority, detail?:string}} CatalogImagePreloadOptions */
/** @typedef {{name?:unknown, slug?:unknown}} CatalogTaxonomyItem */
/** @typedef {{categories?:Array<CatalogTaxonomyItem>, subcategories?:Array<CatalogTaxonomyItem>}} CatalogTaxonomy */
/** @typedef {{subcategory:string, items:Array<CatalogRecord>}} CatalogSubcategoryGroup */
/** @typedef {{category:string, items:Array<CatalogRecord>, directItems:Array<CatalogRecord>, subcategories:Array<CatalogSubcategoryGroup>, subcategoryMap?:Map<string, CatalogSubcategoryGroup>, hasSubcategories?:boolean}} CatalogCategoryGroup */
/** @typedef {{duration?:number, tone?:string}} ActionToastOptions */

/** @param {unknown} value @returns {value is HTMLElement} */
function isHtmlElement(value) {
  return value instanceof HTMLElement;
}

/** @param {EventTarget|null} target @returns {Element|null} */
function eventTargetElement(target) {
  return target instanceof Element ? target : null;
}

/** @param {unknown} value @param {FocusOptions} [options] @returns {boolean} */
function focusHtmlElement(value, options) {
  if (!(value instanceof HTMLElement)) return false;
  value.focus(options);
  return true;
}

function catalogAssetBaseUrl() {
  const rawBase = String(window.BARGIG_CATALOG_ASSET_BASE_URL || "").trim();
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

  const baseUrl = catalogAssetBaseUrl();
  if (!baseUrl) return cleanPath;

  try {
    return new URL(cleanPath.replace(/^\/+/, ""), baseUrl).href;
  } catch {
    return `${baseUrl}${cleanPath.replace(/^\/+/, "")}`;
  }
}

/** @param {string} [_url] */
function catalogImageCrossOriginAttribute(_url = "") {
  return "";
}

/** @param {HTMLImageElement|null|undefined} img */
function applyCatalogImageCrossOrigin(img) {
  if (img) img.removeAttribute("crossorigin");
}

/** @param {HTMLImageElement|null|undefined} img @param {string} url */
function setCatalogImageSource(img, url) {
  if (!img) return;
  applyCatalogImageCrossOrigin(img);
  img.src = url;
}

function networkInformation() {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function isSaveDataEnabled() {
  return Boolean(networkInformation()?.saveData);
}

function catalogImageDeliveryMode() {
  const configured = String(window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE || "").trim().toLowerCase();
  return configured === CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY
    ? CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY
    : CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
}

function catalogMediumImagesEnabled() {
  return catalogImageDeliveryMode() === CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
}

function networkEffectiveType() {
  return String(networkInformation()?.effectiveType || "").trim().toLowerCase();
}

function catalogNeighborPreloadRadius() {
  if (isSaveDataEnabled()) return 1;
  const effectiveType = networkEffectiveType();
  if (effectiveType === "slow-2g" || effectiveType === "2g") return 1;
  if (effectiveType === "3g") return 1;
  if (!catalogMediumImagesEnabled()) return 1;
  return 2;
}

/** @param {unknown} url */
function normalizeCatalogImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.href);
    parsed.searchParams.delete(CATALOG_IMAGE_RETRY_PARAM);
    return parsed.href;
  } catch {
    return value.replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1")
      .replace(/[?&]$/, "");
  }
}

/** @param {unknown} url */
function unversionedCatalogImageUrl(url) {
  const value = normalizeCatalogImageUrl(url);
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.href);
    parsed.searchParams.delete(CATALOG_ASSET_VERSION_PARAM);
    return parsed.href;
  } catch {
    return value.replace(new RegExp(`([?&])${CATALOG_ASSET_VERSION_PARAM}=[^&#]*&?`, "g"), "$1")
      .replace(/[?&]$/, "");
  }
}

/** @param {unknown} url */
function cacheBustedCatalogImageUrl(url) {
  const value = normalizeCatalogImageUrl(url);
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.href);
    parsed.searchParams.set(CATALOG_IMAGE_RETRY_PARAM, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    return parsed.href;
  } catch {
    const separator = value.includes("?") ? "&" : "?";
    return `${value}${separator}${CATALOG_IMAGE_RETRY_PARAM}=${Date.now()}`;
  }
}

/**
 * @param {unknown} primarySrc
 * @param {unknown} [fallbackSrc]
 * @param {CatalogImageRecoveryCandidateOptions} [options]
 * @returns {Array<CatalogImageRecoveryCandidate>}
 */
function catalogImageRecoveryCandidates(primarySrc, fallbackSrc = "", options = {}) {
  const primary = normalizeCatalogImageUrl(primarySrc);
  const fallback = normalizeCatalogImageUrl(fallbackSrc);
  /** @type {Array<CatalogImageRecoveryCandidate>} */
  const candidates = [];
  /** @param {string} src @param {string} role @param {string} [tier] */
  const push = (src, role, tier = "") => {
    if (!src || candidates.some((candidate) => candidate.src === src)) return;
    candidates.push({ src, role, tier, fallback: role.startsWith("fallback") });
  };

  const primaryTier = String(options.primaryTier || "");
  push(
    options.forceRefresh ? cacheBustedCatalogImageUrl(primary) : primary,
    options.forceRefresh ? String(options.forceRefreshRole || "manual") : "primary",
    primaryTier
  );
  const unversionedPrimary = unversionedCatalogImageUrl(primary);
  if (unversionedPrimary && unversionedPrimary !== primary) {
    push(cacheBustedCatalogImageUrl(unversionedPrimary), "direct-retry", primaryTier);
  }
  if (fallback && fallback !== primary) push(fallback, "fallback", String(options.fallbackTier || ""));
  (Array.isArray(options.fallbackCandidates) ? options.fallbackCandidates : []).forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return;
    push(
      normalizeCatalogImageUrl(candidate.src),
      String(candidate.role || `fallback-${index + 1}`),
      String(candidate.tier || "")
    );
  });
  return candidates;
}

/** @param {HTMLImageElement} img @param {CatalogImageRecoveryOptions} [options] @returns {()=>void} */
function loadCatalogImageWithRecovery(img, options = {}) {
  const candidates = catalogImageRecoveryCandidates(options.primarySrc, options.fallbackSrc, options);
  const isCurrent = typeof options.isCurrent === "function" ? options.isCurrent : () => true;
  const telemetryDetail = telemetryCleanText(options.telemetryDetail, 40);
  let index = 0;
  let stopped = false;
  let failedAttempts = Math.max(0, Number(options.initialFailedAttempts) || 0);
  /** @type {CatalogImageRecoveryCandidate|null} */
  let lastCandidate = null;

  img.dataset.telemetryManaged = "true";

  const attempt = () => {
    if (stopped || !isCurrent() || index >= candidates.length) {
      if (!stopped && isCurrent()) {
        if (telemetryDetail && lastCandidate) {
          telemetryTrackImageTerminalFailure(lastCandidate.src, {
            img,
            detail: telemetryDetail,
            action: lastCandidate.role,
            failedAttempts
          });
        }
        options.onExhausted?.({ failedAttempts, lastCandidate });
      }
      return;
    }

    const candidate = candidates[index++];
    lastCandidate = candidate;
    img.dataset.imageLoadPending = "true";
    prepareImagePlaceholder(img);
    let settled = false;
    /** @param {boolean} loaded */
    const settle = (loaded) => {
      if (settled) return;
      settled = true;
      delete img.dataset.imageLoadPending;
      if (stopped || !isCurrent() || img.getAttribute("src") !== candidate.src) return;
      if (loaded && img.naturalWidth > 0) {
        syncImagePlaceholderState(img);
        if (telemetryDetail && failedAttempts > 0) {
          telemetryTrackImageRecovery(candidate.src, {
            img,
            detail: telemetryDetail,
            action: candidate.role,
            failedAttempts
          });
        }
        options.onSuccess?.(candidate, { failedAttempts, attempts: index });
        return;
      }
      failedAttempts += 1;
      if (telemetryDetail) {
        telemetryTrackImageAttemptFailure(candidate.src, {
          img,
          detail: `${telemetryDetail}-${candidate.role}`,
          action: candidate.role,
          attempt: failedAttempts
        });
      }
      options.onFailure?.(candidate, { failedAttempts, attempts: index });
      attempt();
    };

    img.addEventListener("load", () => settle(true), { once: true });
    img.addEventListener("error", () => settle(false), { once: true });
    options.onAttempt?.(candidate, { failedAttempts, attempts: index });
    setCatalogImageSource(img, candidate.src);
    if (img.complete) queueMicrotask(() => settle(Boolean(img.naturalWidth)));
  };

  attempt();
  return () => { stopped = true; };
}

/**
 * @param {CatalogRecord|null|undefined} catalog
 * @param {number|string} page
 * @param {string} [detail]
 * @returns {string}
 */
function catalogImageRecoveryAttributes(catalog, page, detail = "thumbnail") {
  const catalogId = escapeHtml(catalog?.id || "");
  const safePage = Math.max(0, Number.parseInt(String(page), 10) || 0);
  const safeDetail = escapeHtml(detail || "thumbnail");
  return ` data-catalog-image-recovery="lightweight" data-catalog-id="${catalogId}" data-page="${safePage}" data-telemetry-detail="${safeDetail}"`;
}

/** @param {HTMLImageElement|null|undefined} img */
function recoverCatalogImageAfterInitialFailure(img) {
  if (!img || img.dataset.catalogImageRecovery !== "lightweight") return false;
  if (img.dataset.catalogImageRecoveryStarted === "true") return true;

  const failedSrc = String(img.currentSrc || img.getAttribute("src") || "");
  if (!failedSrc) return false;

  const detail = telemetryCleanText(img.dataset.telemetryDetail || telemetryCatalogImageContext(img).detail, 40);
  img.dataset.catalogImageRecoveryStarted = "true";
  telemetryTrackImageAttemptFailure(failedSrc, {
    img,
    detail: `${detail}-primary`,
    action: "primary",
    attempt: 1
  });

  const directRetrySrc = unversionedCatalogImageUrl(failedSrc) || normalizeCatalogImageUrl(failedSrc);
  loadCatalogImageWithRecovery(img, {
    primarySrc: directRetrySrc,
    forceRefresh: true,
    forceRefreshRole: "direct-retry",
    initialFailedAttempts: 1,
    telemetryDetail: detail,
    isCurrent: () => img.isConnected !== false,
    onExhausted: () => syncImagePlaceholderState(img)
  });
  return true;
}

/** @param {unknown} url @param {CatalogImagePreloadOptions} [options] @returns {Promise<CatalogImageReadiness>} */
function prepareCatalogImage(url, options = {}) {
  const src = String(url || "");
  if (!src) return Promise.reject(new Error("missing-image-src"));

  const cached = catalogAssetState.imageLoadCache.get(src);
  if (cached) return cached;

  const image = new Image();
  applyCatalogImageCrossOrigin(image);
  image.decoding = "async";
  image.fetchPriority = options.priority || "auto";

  const promise = new Promise((resolve, reject) => {
    image.addEventListener("load", async () => {
      // Preloads should be decode-ready, not merely network-complete. Otherwise a
      // neighboring page can still pause on its first paint even though its bytes
      // already arrived. Decode failures are non-fatal when the image itself loaded.
      if (typeof image.decode === "function") {
        try {
          await image.decode();
        } catch (_error) {
          // The load event and natural dimensions remain the source of truth.
        }
      }

      // Keep only lightweight readiness metadata in the promise cache. Returning
      // the Image object itself retained its decoded bitmap indefinitely, which
      // made a browsing session accumulate tens or hundreds of megabytes.
      resolve({
        width: Number(image.naturalWidth) || 0,
        height: Number(image.naturalHeight) || 0
      });
    }, { once: true });

    image.addEventListener("error", () => {
      catalogAssetState.imageLoadCache.delete(src);
      telemetryTrackImageAttemptFailure(src, {
        detail: options.detail || "preload",
        action: "preload",
        attempt: 1
      });
      reject(new Error("image-load-failed"));
    }, { once: true });

    image.src = src;
  });

  if (catalogAssetState.imageLoadCache.size >= CATALOG_IMAGE_PRELOAD_CACHE_LIMIT) {
    const oldestSrc = catalogAssetState.imageLoadCache.keys().next().value;
    if (oldestSrc) catalogAssetState.imageLoadCache.delete(oldestSrc);
  }
  catalogAssetState.imageLoadCache.set(src, promise);
  return promise;
}

/** @param {number} value @param {number} min @param {number} max */
function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** @param {number|string} num */
function pad(num) {
  return String(num).padStart(3, "0");
}

/** @param {unknown} value */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** @param {CatalogRecord|null|undefined} catalog */
function catalogCategoryName(catalog) {
  const category = String(catalog?.category || "").trim();
  return category || "קטלוגים";
}

/** @param {CatalogRecord|null|undefined} catalog */
function catalogSubcategoryName(catalog) {
  const legacyCatalog = /** @type {(CatalogRecord & Record<string, unknown>)|null|undefined} */ (catalog);
  const value = catalog?.subcategory ?? catalog?.subCategory ?? legacyCatalog?.sub_category ?? legacyCatalog?.subcategories ?? legacyCatalog?.["תת קטגוריה"] ?? legacyCatalog?.["תת_קטגוריה"] ?? "";
  const rawSubcategory = Array.isArray(value) ? value.find((item) => String(item || "").trim()) : value;
  const subcategory = String(rawSubcategory || "").trim();
  return subcategory;
}

/** @param {unknown} value */
function categorySlug(value) {
  return String(value || "catalog")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "catalog";
}

/** @param {unknown} category @param {number} index */
function categorySectionId(category, index) {
  return `catalog-category-${categorySlug(category)}-${index + 1}`;
}

/** @param {unknown} category @param {number} categoryIndex @param {unknown} subcategory @param {number} subcategoryIndex */
function subcategorySectionId(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categorySectionId(category, categoryIndex)}-sub-${categorySlug(subcategory)}-${subcategoryIndex + 1}`;
}

/** @type {CatalogTaxonomy} */
const catalogTaxonomy = window.BARGIG_CATALOG_TAXONOMY || { categories: [], subcategories: [] };
const CATALOG_CATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.categories) ? catalogTaxonomy.categories : [])
    .map((item) => /** @type {[string, string]} */ ([String(item?.name || "").trim(), String(item?.slug || "").trim()]))
    .filter(([name, slug]) => name && slug)
);
const CATALOG_SUBCATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.subcategories) ? catalogTaxonomy.subcategories : [])
    .map((item) => /** @type {[string, string]} */ ([String(item?.name || "").trim(), String(item?.slug || "").trim()]))
    .filter(([name, slug]) => name && slug)
);

/** @param {unknown} value */
function normalizeShareRouteToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** @param {unknown} value */
function normalizeShareRoutePath(value) {
  return String(value || "")
    .split("/")
    .map(normalizeShareRouteToken)
    .filter(Boolean)
    .join("/");
}

/** @param {unknown} category @param {number} index */
function categoryShareSlug(category, index) {
  const mapped = CATALOG_CATEGORY_SHARE_SLUGS.get(String(category || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(category) || `category-${index + 1}`;
}

/** @param {unknown} subcategory @param {number} index */
function subcategoryShareSlug(subcategory, index) {
  const mapped = CATALOG_SUBCATEGORY_SHARE_SLUGS.get(String(subcategory || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(subcategory) || `sub-${index + 1}`;
}

/** @param {unknown} category @param {number} index */
function catalogCategorySharePath(category, index) {
  return categoryShareSlug(category, index);
}

/** @param {unknown} category @param {number} categoryIndex @param {unknown} subcategory @param {number} subcategoryIndex */
function catalogSubcategorySharePath(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categoryShareSlug(category, categoryIndex)}/${subcategoryShareSlug(subcategory, subcategoryIndex)}`;
}

/** @returns {Array<CatalogCategoryGroup>} */
function getCatalogCategoryGroups() {
  /** @type {Array<CatalogCategoryGroup>} */
  const groups = [];
  /** @type {Map<string, CatalogCategoryGroup>} */
  const groupByCategory = new Map();

  catalogs.forEach((catalog) => {
    const category = catalogCategoryName(catalog);
    if (!groupByCategory.has(category)) {
      const group = {
        category,
        items: [],
        directItems: [],
        subcategories: [],
        subcategoryMap: new Map()
      };
      groupByCategory.set(category, group);
      groups.push(group);
    }

    const group = groupByCategory.get(category);
    if (!group) return;
    const subcategory = catalogSubcategoryName(catalog);
    group.items.push(catalog);

    if (!subcategory) {
      group.directItems.push(catalog);
      return;
    }

    if (!group.subcategoryMap?.has(subcategory)) {
      const subcategoryGroup = { subcategory, items: [] };
      group.subcategoryMap?.set(subcategory, subcategoryGroup);
      group.subcategories.push(subcategoryGroup);
    }
    group.subcategoryMap?.get(subcategory)?.items.push(catalog);
  });

  groups.forEach((group) => {
    group.hasSubcategories = group.subcategories.length > 0;
    delete group.subcategoryMap;
  });

  return groups;
}

/** @param {CatalogRecord|null|undefined} catalog */
function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}

/** @param {CatalogRecord} catalog */
function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}

/** @param {CatalogRecord|null|undefined} catalog @param {unknown} tier */
function catalogAssetVersionForTier(catalog, tier) {
  const normalizedTier = String(tier || CATALOG_IMAGE_TIER_FULL);
  const variantVersion = String(catalog?.imageVariants?.[normalizedTier]?.version || "").trim();
  const baseVersion = variantVersion || String(catalog?.assetVersion || "").trim();
  if (!baseVersion) return "";
  return `${baseVersion}-${normalizedTier}-u${CATALOG_ASSET_URL_SCHEMA_VERSION}`;
}

/** @param {string} url @param {CatalogRecord|null|undefined} catalog @param {string} [tier] */
function withAssetVersion(url, catalog, tier = CATALOG_IMAGE_TIER_FULL) {
  const version = catalogAssetVersionForTier(catalog, tier);
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${CATALOG_ASSET_VERSION_PARAM}=${encodeURIComponent(version)}`;
}

/** @param {CatalogRecord} catalog @param {number|string} page */
function pageSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_FULL
  );
}

/** @param {CatalogRecord} catalog @param {number|string} page */
function thumbSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_THUMB
  );
}

/** @param {CatalogRecord|null|undefined} catalog @param {string} tier @returns {CatalogImageVariant|null} */
function catalogImageVariant(catalog, tier) {
  if (tier === CATALOG_IMAGE_TIER_MEDIUM && !catalogMediumImagesEnabled()) return null;
  const variants = catalog?.imageVariants;
  if (variants && typeof variants === "object" && variants[tier] && typeof variants[tier] === "object") {
    return variants[tier];
  }
  if (tier === CATALOG_IMAGE_TIER_THUMB) return { directory: "thumbs", maxSide: 420 };
  if (tier === CATALOG_IMAGE_TIER_FULL) {
    const size = pageSize(catalog, 1);
    return { directory: "", maxSide: size ? Math.max(size.width, size.height) : 2800 };
  }
  return null;
}

/** @param {CatalogRecord|null|undefined} catalog @param {string} tier */
function catalogSupportsImageTier(catalog, tier) {
  return Boolean(catalogImageVariant(catalog, tier));
}

/** @param {CatalogRecord|null|undefined} catalog @param {string} tier */
function catalogImageTierMaxSide(catalog, tier) {
  const value = Number(catalogImageVariant(catalog, tier)?.maxSide);
  if (Number.isFinite(value) && value > 0) return value;
  return tier === CATALOG_IMAGE_TIER_MEDIUM ? DEFAULT_CATALOG_MEDIUM_MAX_SIDE : 0;
}

/** @param {CatalogRecord} catalog @param {number|string} page */
function mediumSrc(catalog, page) {
  const variant = catalogImageVariant(catalog, CATALOG_IMAGE_TIER_MEDIUM);
  if (!variant) return "";
  const directory = String(variant.directory || "medium").trim().replace(/^\/+|\/+$/g, "") || "medium";
  return withAssetVersion(
    `${catalogDir(catalog)}/${directory}/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_MEDIUM
  );
}

/** @param {CatalogRecord} catalog @param {number|string} page @param {string} tier */
function catalogPageImageSrc(catalog, page, tier) {
  if (tier === CATALOG_IMAGE_TIER_THUMB) return thumbSrc(catalog, page);
  if (tier === CATALOG_IMAGE_TIER_MEDIUM) return mediumSrc(catalog, page);
  return pageSrc(catalog, page);
}

/** @param {CatalogRecord} catalog */
function catalogCoverSrc(catalog) {
  return catalog?.cover ? withAssetVersion(resolveCatalogAssetUrl(catalog.cover), catalog) : pageSrc(catalog, 1);
}

/** @param {CatalogRecord} catalog */
function coverThumbSrc(catalog) {
  return thumbSrc(catalog, 1);
}

/** @param {CatalogRecord|null|undefined} catalog @param {number|string} page */
function pageSize(catalog, page) {
  const sizes = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes : [];
  const pageNumber = Number.parseInt(String(page), 10);
  const size = sizes[pageNumber - 1];
  if (!Array.isArray(size) || size.length < 2) return null;
  const width = Number(size[0]);
  const height = Number(size[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/** @param {CatalogRecord|null|undefined} firstCatalog @param {number|string} firstPage @param {CatalogRecord|null|undefined} secondCatalog @param {number|string} secondPage */
function catalogPagesShareAspectRatio(firstCatalog, firstPage, secondCatalog, secondPage) {
  const firstSize = pageSize(firstCatalog, firstPage);
  const secondSize = pageSize(secondCatalog, secondPage);
  if (!firstSize || !secondSize) return false;

  const firstRatio = firstSize.width / firstSize.height;
  const secondRatio = secondSize.width / secondSize.height;
  return Math.abs(firstRatio - secondRatio) <= 0.001;
}

/** @param {CatalogRecord|null|undefined} catalog @param {number|string} page */
function catalogImageDimensionAttributes(catalog, page) {
  const size = pageSize(catalog, page);
  return size ? ` width="${size.width}" height="${size.height}"` : "";
}

/** @param {HTMLImageElement|null|undefined} image @param {CatalogRecord|null|undefined} catalog @param {number|string} page */
function applyCatalogImageDimensions(image, catalog, page) {
  if (!image) return;
  const size = pageSize(catalog, page);
  if (!size) {
    image.removeAttribute("width");
    image.removeAttribute("height");
    return;
  }
  image.width = size.width;
  image.height = size.height;
}

/** @param {CatalogRecord|null|undefined} catalog */
function catalogCoverLoadingAttributes(catalog) {
  const index = catalogs.findIndex((item) => item?.id === catalog?.id);
  const eager = index >= 0 && index < CATALOG_EAGER_COVER_COUNT;
  return eager
    ? ' loading="eager" decoding="async" fetchpriority="high"'
    : ' loading="lazy" decoding="async" fetchpriority="low"';
}

/** @param {CatalogRecord|null|undefined} catalog @param {number|string} page */
function pageAspectStyle(catalog, page) {
  const size = pageSize(catalog, page);
  return size ? ` style="aspect-ratio: ${size.width} / ${size.height}"` : "";
}

/** @param {CatalogRecord|null|undefined} catalog @param {number|string} page @param {string} [variableName] */
function pageAspectVariableStyle(catalog, page, variableName = "--page-aspect-ratio") {
  const size = pageSize(catalog, page);
  return size ? ` style="${variableName}: ${size.width} / ${size.height}"` : "";
}

/** @param {HTMLImageElement|null|undefined} img */
function applyLoadedPageAspect(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;

  const frame = img.closest?.(".reader-page-frame");
  if (!(frame instanceof HTMLElement)) return;

  const width = Number(img.naturalWidth);
  const height = Number(img.naturalHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

  frame.style.aspectRatio = `${width} / ${height}`;

  const page = Number.parseInt(frame.dataset.page || "", 10);
  const catalog = activeCatalog();
  if (!catalog || !Number.isFinite(page) || page < 1) return;

  if (!Array.isArray(catalog.pageSizes)) catalog.pageSizes = [];
  catalog.pageSizes[page - 1] = [width, height];

}

/** @param {HTMLImageElement|null|undefined} img */
function watchLoadedPageAspect(img) {
  if (!img) return;

  if (img.complete && img.naturalWidth && img.naturalHeight) {
    applyLoadedPageAspect(img);
    return;
  }

  img.addEventListener("load", () => applyLoadedPageAspect(img), { once: true });
}

/** @param {unknown} page @param {CatalogRecord|null} [catalog] */
function clampPage(page, catalog = activeCatalog()) {
  const parsed = Number.parseInt(String(page), 10);
  if (!Number.isFinite(parsed)) return 1;
  const maxPage = Math.max(1, Number(catalog?.pages || 1));
  return Math.min(Math.max(parsed, 1), maxPage);
}

/** @param {unknown} value */
function safeFilePart(value) {
  return String(value || "catalog")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "catalog";
}

/** @param {Element|null|undefined} button */
function getTooltipText(button) {
  return window.BargigTooltips?.getText?.(button || null) || button?.getAttribute?.("title") || "";
}

/** @param {Element|null|undefined} button @param {string} text @param {Record<string, unknown>} [options] */
function setTooltipText(button, text, options = {}) {
  if (!button) return;
  if (window.BargigTooltips?.setText) {
    window.BargigTooltips.setText(button, text, options);
    return;
  }

  if (text) button.setAttribute("title", text);
  else button.removeAttribute("title");
}

/** @param {Element|null|undefined} button @param {string} message */
function flashActionButton(button, message) {
  if (!(button instanceof HTMLElement) || !message) return;
  const originalTooltip = getTooltipText(button);
  setTooltipText(button, message);
  button.classList.remove("reader-icon-button-feedback");
  void button.offsetWidth;
  button.classList.add("reader-icon-button-done", "reader-icon-button-feedback");
  window.setTimeout(() => {
    setTooltipText(button, originalTooltip);
    button.classList.remove("reader-icon-button-done", "reader-icon-button-feedback");
  }, 1200);
}

/** @param {string} message */
function actionToastTone(message) {
  if (message === "נשמר" || message === "התמונה נשמרה") return "saved";
  if (message === "הוסר" || message.includes("הוסרו")) return "removed";
  if (message.includes("קישור")) return "link";
  return "info";
}

/** @param {string} message @param {number|ActionToastOptions} [options] */
function showActionToast(message, options = {}) {
  if (!uiElements.siteActionToast || !message) return;
  const normalizedOptions = typeof options === "number" ? { duration: options } : options;
  const duration = Math.max(1000, Number(normalizedOptions.duration) || 1000);

  window.clearTimeout(uiRuntime.actionToastTimer);
  uiElements.siteActionToast.textContent = message;
  uiElements.siteActionToast.dataset.tone = normalizedOptions.tone || actionToastTone(message);
  uiElements.siteActionToast.classList.remove("hidden", "visible");
  void uiElements.siteActionToast.offsetWidth;
  window.requestAnimationFrame(() => uiElements.siteActionToast.classList.add("visible"));
  uiRuntime.actionToastTimer = window.setTimeout(() => {
    uiElements.siteActionToast.classList.remove("visible");
    window.setTimeout(() => {
      if (!uiElements.siteActionToast.classList.contains("visible")) {
        uiElements.siteActionToast.classList.add("hidden");
      }
    }, 180);
  }, duration);
}

const IMAGE_PLACEHOLDER_FRAME_SELECTOR = [
  ".catalog-image-frame",
  ".lightbox-image-frame",
  ".search-result-thumb-frame",
  ".reader-search-thumb-frame",
  ".favorite-image-frame",
  ".lightbox-page-thumb-frame",
  ".reader-page-frame",
  ".reader-page-thumb-frame"
].join(", ");

/** @param {HTMLImageElement|null|undefined} img @returns {HTMLElement|null} */
function imagePlaceholderFrame(img) {
  if (img?.dataset?.placeholderIgnore === "true") return null;
  const frame = img?.closest?.(IMAGE_PLACEHOLDER_FRAME_SELECTOR) || null;
  return frame instanceof HTMLElement ? frame : null;
}

/** @param {HTMLImageElement} img */
function syncImagePlaceholderState(img) {
  const frame = imagePlaceholderFrame(img);
  if (!frame) return;

  frame.classList.add("image-placeholder-frame");
  const pending = img.dataset.imageLoadPending === "true";
  const isReady = !pending && Boolean(img.complete && img.naturalWidth > 0);
  const isError = !pending && Boolean(img.complete && !img.naturalWidth && (img.currentSrc || img.getAttribute("src")));
  frame.classList.toggle("image-ready", isReady);
  frame.classList.toggle("image-error", isError);
  frame.classList.toggle("image-loading", pending || (!isReady && !isError));
}

/** @param {HTMLImageElement} img */
function prepareImagePlaceholder(img) {
  const frame = imagePlaceholderFrame(img);
  if (!frame) return;
  frame.classList.add("image-placeholder-frame");
  if (img.dataset.imageLoadPending === "true") {
    frame.classList.remove("image-ready", "image-error");
    frame.classList.add("image-loading");
    return;
  }
  if (img.complete) {
    syncImagePlaceholderState(img);
    return;
  }
  frame.classList.remove("image-ready", "image-error");
  frame.classList.add("image-loading");
}

function initImagePlaceholderObserver() {
  document.querySelectorAll(`${IMAGE_PLACEHOLDER_FRAME_SELECTOR} img`).forEach((image) => {
    if (image instanceof HTMLImageElement) prepareImagePlaceholder(image);
  });

  document.addEventListener("load", (event) => {
    if (event.target instanceof HTMLImageElement) syncImagePlaceholderState(event.target);
  }, true);
  document.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) syncImagePlaceholderState(event.target);
  }, true);

  if (!("MutationObserver" in window) || !document.body) return;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" && mutation.target instanceof HTMLImageElement) {
        prepareImagePlaceholder(mutation.target);
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node instanceof HTMLImageElement) prepareImagePlaceholder(node);
        node.querySelectorAll?.("img").forEach((image) => {
          if (image instanceof HTMLImageElement) prepareImagePlaceholder(image);
        });
      });
    });
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "data-src"]
  });
}

/** @param {HTMLImageElement} img */
function loadDeferredImage(img) {
  const src = img?.dataset?.src;
  if (!src) return;

  const markLoaded = () => {
    applyLoadedPageAspect(img);
    img.classList.add("loaded");
    img.removeAttribute("data-src");
  };

  if (img.getAttribute("src") === src) {
    if (img.complete && img.naturalWidth) markLoaded();
    return;
  }

  img.addEventListener("load", markLoaded, { once: true });
  setCatalogImageSource(img, src);
}




/** @param {Blob} blob @param {string} filename */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 900);
}

/** @param {CatalogRecord|null} catalog @param {unknown} page @param {HTMLElement|null|undefined} button */
async function downloadCatalogPageSnapshot(catalog, page, button) {
  if (!catalog) return;
  const currentPage = clampPage(page, catalog);
  const src = pageSrc(catalog, currentPage);

  try {
    if (!window.CatalogSnapshot?.buildSnapshotBlob) {
      throw new Error("snapshot-exporter-missing");
    }

    const blob = await window.CatalogSnapshot.buildSnapshotBlob(src);
    const extension = window.CatalogSnapshot.extension || "jpg";
    saveBlob(blob, `${safeFilePart(catalog.title || catalog.id)}-page-${pad(currentPage)}.${extension}`);
    flashActionButton(button, "נשמר");
    showActionToast("התמונה נשמרה", { tone: "saved" });
  } catch (error) {
    console.error("[CatalogSnapshot] Failed to export catalog page", {
      catalogId: catalog.id,
      page: currentPage,
      src,
      error
    });
    window.alert("לא הצלחתי ליצור את תמונת העמוד. יש לוודא שמדיניות CORS של מאגר התמונות מאפשרת קריאה מהאתר.");
  }
}

function hasHoverPointer() {
  if (typeof window.matchMedia !== "function") return true;
  const primaryFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const anyFineHover = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  return primaryFineHover || anyFineHover;
}

/** @param {Event|null|undefined} event */
function isTouchLikePointer(event) {
  return Boolean(
    event
    && "pointerType" in event
    && (event.pointerType === "touch" || event.pointerType === "pen")
  );
}

function getCurrentCatalogFocusUrlTargetId() {
  const catalogGrid = getFeatureInterface("catalog-grid");
  const hashTargetId = catalogGrid?.resolveCategoryTargetIdFromHash?.() || "";
  if (hashTargetId && catalogGrid?.hasCategoryTarget?.(hashTargetId)) {
    return hashTargetId;
  }

  const activeTargetId = catalogGrid?.activeCategoryTargetId?.() || "";
  if (activeTargetId && catalogGrid?.hasCategoryTarget?.(activeTargetId)) {
    return activeTargetId;
  }

  return "";
}

/** @param {unknown} value */
function encodeHashRouteSegment(value) {
  return encodeURIComponent(String(value ?? ""));
}

/** @param {unknown} value */
function decodeHashRouteSegment(value) {
  const segment = String(value || "");
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** @param {unknown} path */
function encodeShareRoutePath(path) {
  const normalizedPath = normalizeShareRoutePath(path);
  if (!normalizedPath) return "";
  return normalizedPath.split("/").map(encodeHashRouteSegment).join("/");
}

/** @param {unknown} path */
function buildCategoryShareRouteHash(path) {
  const encodedPath = encodeShareRoutePath(path);
  return encodedPath ? `#cat/${encodedPath}` : "";
}

/** @param {unknown} id @returns {CatalogRecord|null} */
function findCatalogById(id) {
  const catalogId = String(id || "");
  return catalogs.find((item) => String(item.id || "") === catalogId) || null;
}

function syncDocumentLock() {
  const documentLocked = Boolean(
    getFeatureInterface("favorites")?.requiresDocumentLock() ||
    getFeatureInterface("inquiry")?.requiresDocumentLock() ||
    getFeatureInterface("viewer")?.requiresDocumentLock()
  );
  const viewerOpen = Boolean(getFeatureInterface("viewer")?.isViewerOpen());
  document.body.classList.toggle("no-scroll", documentLocked);
  document.documentElement.classList.toggle("viewer-open", viewerOpen);
}

/** @param {KeyboardEvent} event */
function handleTopLayerEscape(event) {
  if (event.key !== "Escape" || event.defaultPrevented) return false;

  for (const api of featureInterfacesByEscapePriority()) {
    if (api.closeTopLayer(event) !== true) continue;
    event.preventDefault();
    return true;
  }
  return false;
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["shared-ui"] = Object.freeze({
    catalogImageDeliveryMode,
    catalogMediumImagesEnabled,
    catalogNeighborPreloadRadius,
    normalizeCatalogImageUrl,
    unversionedCatalogImageUrl,
    cacheBustedCatalogImageUrl,
    catalogImageRecoveryCandidates,
    loadCatalogImageWithRecovery,
    recoverCatalogImageAfterInitialFailure,
    catalogImageVariant,
    catalogSupportsImageTier,
    catalogImageTierMaxSide,
    catalogPageImageSrc,
    pageSize,
    hasHoverPointer,
    isTouchLikePointer,
    handleTopLayerEscape
  });
}
/* TEST-ONLY EXPORTS: END */
