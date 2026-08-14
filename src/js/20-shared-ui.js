/**
 * Source module: 20-shared-ui.js
 * Shared media loading, image placeholders, action feedback, asset paths, and route helpers.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { CatalogImageTier, CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { CatalogImageCandidate, CatalogImageReadiness } from "../../types/frontend-contracts.js" */

import { tooltips } from "../runtime/tooltip-manager.js";
import { eventTargetElement, requiredElement } from "./02-dom-contracts.js";
import { catalogs, catalogTaxonomy } from "./03-runtime-context.js";
import { CATALOG_ASSET_URL_SCHEMA_VERSION, CATALOG_ASSET_VERSION_PARAM, CATALOG_EAGER_COVER_COUNT, CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY, CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE, CATALOG_IMAGE_PRELOAD_CACHE_LIMIT, CATALOG_IMAGE_RETRY_PARAM, CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB, DEFAULT_CATALOG_MEDIUM_MAX_SIDE, catalogAssetState, featureInterfacesByEscapePriority, getFeatureInterface, uiRuntime } from "./10-app-state.js";
import { telemetryCatalogImageContext, telemetryCleanText, telemetryCreateImageRequestContext, telemetryTrackImageAttemptFailure, telemetryTrackImageRecovery, telemetryTrackImageTerminalFailure } from "./15-telemetry.js";
import { activeCatalog } from "./18-navigation-feature.js";
import { catalogFirstPage, clampCatalogPage, displayPageToAssetPage, isCatalogPage } from "./06-catalog-page-numbering.js";
import { catalogDir, coverThumbSrc, imageExt, pageSrc, resolveCatalogAssetUrl, thumbSrc, withAssetVersion } from "./17-catalog-asset-urls.js";

/** @type {Readonly<{siteActionToast:HTMLElement}>} */
const uiElements = Object.freeze({
  siteActionToast: requiredElement("siteActionToast")
});

/** @type {WeakMap<CatalogRecord, Map<number, {width:number, height:number}>>} */
const observedCatalogPageSizes = new WeakMap();

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
 *   telemetrySurface?:unknown,
 *   telemetryVisibility?:unknown,
 *   telemetryRequestedTier?:unknown,
 *   telemetryRequestContext?:ReturnType<typeof telemetryCreateImageRequestContext>|null,
 *   initialFailedAttempts?:number,
 *   onExhausted?:(result:CatalogImageRecoveryExhausted)=>void,
 *   onSuccess?:(candidate:CatalogImageRecoveryCandidate, progress:CatalogImageRecoveryProgress)=>void,
 *   onFailure?:(candidate:CatalogImageRecoveryCandidate, progress:CatalogImageRecoveryProgress)=>void,
 *   onAttempt?:(candidate:CatalogImageRecoveryCandidate, progress:CatalogImageRecoveryProgress)=>void
 * }} CatalogImageRecoveryOptions
 */
/**
 * @typedef {{
 *   priority?:RequestPriority,
 *   detail?:string,
 *   surface?:string,
 *   visibility?:string,
 *   requestedTier?:string,
 *   failureAction?:string,
 *   cache?:boolean,
 *   signal?:AbortSignal,
 *   isCurrent?:()=>boolean,
 *   terminalOnFailure?:boolean,
 *   telemetryRequestContext?:ReturnType<typeof telemetryCreateImageRequestContext>|null
 * }} CatalogImagePreloadOptions
 */
/** @typedef {{name?:unknown, slug?:unknown}} CatalogTaxonomyItem */
/** @typedef {{categories?:Array<CatalogTaxonomyItem>, subcategories?:Array<CatalogTaxonomyItem>}} CatalogTaxonomy */
/** @typedef {{subcategory:string, items:Array<CatalogRecord>}} CatalogSubcategoryGroup */
/** @typedef {{category:string, items:Array<CatalogRecord>, directItems:Array<CatalogRecord>, subcategories:Array<CatalogSubcategoryGroup>, subcategoryMap?:Map<string, CatalogSubcategoryGroup>, hasSubcategories?:boolean}} CatalogCategoryGroup */
/** @typedef {{directory:string, maxSide:number, version?:string}} CatalogImageVariantView */
/** @typedef {{duration?:number, tone?:string}} ActionToastOptions */

/** @param {unknown} value @returns {value is HTMLElement} */
function isHtmlElement(value) {
  return value instanceof HTMLElement;
}

/** @param {unknown} value @param {FocusOptions} [options] @returns {boolean} */
function focusHtmlElement(value, options) {
  if (!(value instanceof HTMLElement)) return false;
  value.focus(options);
  return true;
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
  const telemetryRequestContext = options.telemetryRequestContext || (telemetryDetail
    ? telemetryCreateImageRequestContext(img, options.primarySrc || options.fallbackSrc || "", {
      detail: telemetryDetail,
      surface: options.telemetrySurface,
      visibility: options.telemetryVisibility,
      requestedTier: options.telemetryRequestedTier || options.primaryTier
    })
    : null);
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
            requestContext: telemetryRequestContext,
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
            requestContext: telemetryRequestContext,
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
          requestContext: telemetryRequestContext,
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
function catalogImageRecoveryAttributes(catalog, page, detail = "thumbnail", surface = detail) {
  const catalogId = escapeHtml(catalog?.id || "");
  const safePage = Math.max(0, Number.parseInt(String(page), 10) || 0);
  const safeDetail = escapeHtml(detail || "thumbnail");
  const safeSurface = escapeHtml(surface || detail || "image");
  return ` data-catalog-image-recovery="lightweight" data-catalog-id="${catalogId}" data-page="${safePage}" data-telemetry-detail="${safeDetail}" data-telemetry-surface="${safeSurface}" data-telemetry-requested-tier="thumb"`;
}

/** @param {HTMLImageElement|null|undefined} img */
function recoverCatalogImageAfterInitialFailure(img) {
  if (!img || img.dataset.catalogImageRecovery !== "lightweight") return false;
  if (img.dataset.catalogImageRecoveryStarted === "true") return true;

  const failedSrc = String(img.currentSrc || img.getAttribute("src") || "");
  if (!failedSrc) return false;

  const detail = telemetryCleanText(img.dataset.telemetryDetail || telemetryCatalogImageContext(img).detail, 40);
  const requestContext = telemetryCreateImageRequestContext(img, failedSrc, {
    detail,
    surface: img.dataset.telemetrySurface || detail,
    requestedTier: img.dataset.telemetryRequestedTier || "thumb"
  });
  img.dataset.catalogImageRecoveryStarted = "true";
  telemetryTrackImageAttemptFailure(failedSrc, {
    img,
    requestContext,
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
    telemetryRequestContext: requestContext,
    isCurrent: () => img.isConnected !== false,
    onExhausted: () => syncImagePlaceholderState(img)
  });
  return true;
}

/** @param {string} reason */
function catalogImagePreparationAbortError(reason = "image-load-aborted") {
  const error = new Error(reason);
  error.name = "AbortError";
  return error;
}

/** @param {unknown} url @param {CatalogImagePreloadOptions} [options] @returns {Promise<CatalogImageReadiness>} */
function prepareCatalogImage(url, options = {}) {
  const src = String(url || "");
  if (!src) return Promise.reject(new Error("missing-image-src"));

  const signal = options.signal || null;
  const isCurrent = typeof options.isCurrent === "function" ? options.isCurrent : () => true;
  const useCache = options.cache !== false && !signal && typeof options.isCurrent !== "function";
  const cached = useCache ? catalogAssetState.imageLoadCache.get(src) : null;
  if (cached) return cached;

  const image = new Image();
  const requestContext = options.telemetryRequestContext || telemetryCreateImageRequestContext(null, src, {
    detail: options.detail || "preload",
    surface: options.surface || options.detail || "image-preload",
    visibility: options.visibility || "preload",
    requestedTier: options.requestedTier
  });
  applyCatalogImageCrossOrigin(image);
  image.decoding = "async";
  image.fetchPriority = options.priority || "auto";

  const promise = new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
    };

    /** @param {unknown} error */
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (useCache) catalogAssetState.imageLoadCache.delete(src);
      reject(error);
    };

    const handleAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (useCache) catalogAssetState.imageLoadCache.delete(src);
      try {
        image.removeAttribute("src");
      } catch (_error) {}
      reject(catalogImagePreparationAbortError());
    };

    const handleLoad = async () => {
      if (settled) return;
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
      if (settled) return;
      if (signal?.aborted || !isCurrent()) {
        rejectOnce(catalogImagePreparationAbortError("image-load-superseded"));
        return;
      }

      settled = true;
      cleanup();
      // Keep only lightweight readiness metadata in the promise cache. Returning
      // the Image object itself retained its decoded bitmap indefinitely, which
      // made a browsing session accumulate tens or hundreds of megabytes.
      resolve({
        width: Number(image.naturalWidth) || 0,
        height: Number(image.naturalHeight) || 0
      });
    };

    const handleError = () => {
      if (settled) return;
      if (signal?.aborted || !isCurrent()) {
        rejectOnce(catalogImagePreparationAbortError("image-load-superseded"));
        return;
      }

      telemetryTrackImageAttemptFailure(src, {
        requestContext,
        detail: options.detail || "preload",
        action: options.failureAction || "preload",
        attempt: 1
      });
      if (options.terminalOnFailure !== false) {
        telemetryTrackImageTerminalFailure(src, {
          requestContext,
          detail: options.detail || "preload",
          action: options.failureAction || "preload",
          failedAttempts: 1
        });
      }
      rejectOnce(new Error("image-load-failed"));
    };

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    image.src = src;
  });

  if (useCache) {
    if (catalogAssetState.imageLoadCache.size >= CATALOG_IMAGE_PRELOAD_CACHE_LIMIT) {
      const oldestSrc = catalogAssetState.imageLoadCache.keys().next().value;
      if (oldestSrc) catalogAssetState.imageLoadCache.delete(oldestSrc);
    }
    catalogAssetState.imageLoadCache.set(src, promise);
  }
  return promise;
}

/** @param {number} value @param {number} min @param {number} max */
function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** @param {number|string} value */
function pad(value) {
  return String(value).padStart(3, "0");
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
  return String(catalog?.subcategory || "").trim();
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

/** @param {CatalogRecord|null|undefined} catalog @param {CatalogImageTier} tier @returns {CatalogImageVariantView|null} */
function catalogImageVariant(catalog, tier) {
  if (tier === CATALOG_IMAGE_TIER_MEDIUM && !catalogMediumImagesEnabled()) return null;
  const variants = catalog?.imageVariants;
  if (variants && typeof variants === "object" && variants[tier] && typeof variants[tier] === "object") {
    return variants[tier];
  }
  if (tier === CATALOG_IMAGE_TIER_THUMB) return { directory: "thumbs", maxSide: 420 };
  if (tier === CATALOG_IMAGE_TIER_FULL) {
    const size = pageSize(catalog, catalogFirstPage(catalog));
    return { directory: "", maxSide: size ? Math.max(size.width, size.height) : 2800 };
  }
  return null;
}

/** @param {CatalogRecord|null|undefined} catalog @param {CatalogImageTier} tier */
function catalogSupportsImageTier(catalog, tier) {
  return Boolean(catalogImageVariant(catalog, tier));
}

/** @param {CatalogRecord|null|undefined} catalog @param {CatalogImageTier} tier */
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
    `${catalogDir(catalog)}/${directory}/page-${pad(displayPageToAssetPage(catalog, page))}.${imageExt(catalog)}`,
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
  return catalog?.cover ? withAssetVersion(resolveCatalogAssetUrl(catalog.cover), catalog) : pageSrc(catalog, catalogFirstPage(catalog));
}

/** @param {CatalogRecord|null|undefined} catalog @param {number|string} page */
function pageSize(catalog, page) {
  const assetPage = displayPageToAssetPage(catalog, page);
  const observed = catalog ? observedCatalogPageSizes.get(catalog)?.get(assetPage) : null;
  if (observed) return observed;

  const sizes = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes : [];
  const size = sizes[assetPage - 1];
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
  if (!catalog || !isCatalogPage(catalog, page)) return;

  let observedSizes = observedCatalogPageSizes.get(catalog);
  if (!observedSizes) {
    observedSizes = new Map();
    observedCatalogPageSizes.set(catalog, observedSizes);
  }
  observedSizes.set(displayPageToAssetPage(catalog, page), { width, height });
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
  return clampCatalogPage(page, catalog);
}

/** @param {Element|null|undefined} button */
function getTooltipText(button) {
  return tooltips.getText(button || null) || button?.getAttribute?.("title") || "";
}

/** @param {Element|null|undefined} button @param {string} text @param {Record<string, unknown>} [options] */
function setTooltipText(button, text, options = {}) {
  if (!button) return;
  tooltips.setText(button, text, options);
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


export {
  applyCatalogImageDimensions,
  buildCategoryShareRouteHash,
  cacheBustedCatalogImageUrl,
  catalogCategorySharePath,
  catalogCoverLoadingAttributes,
  catalogImageCrossOriginAttribute,
  catalogImageDeliveryMode,
  catalogImageDimensionAttributes,
  catalogImageRecoveryAttributes,
  catalogImageRecoveryCandidates,
  catalogImageTierMaxSide,
  catalogImageVariant,
  catalogMediumImagesEnabled,
  catalogNeighborPreloadRadius,
  catalogPageImageSrc,
  catalogPagesShareAspectRatio,
  catalogSubcategorySharePath,
  catalogSupportsImageTier,
  categorySectionId,
  categoryShareSlug,
  clampPage,
  clampValue,
  coverThumbSrc,
  decodeHashRouteSegment,
  encodeHashRouteSegment,
  escapeHtml,
  findCatalogById,
  flashActionButton,
  focusHtmlElement,
  getCatalogCategoryGroups,
  handleTopLayerEscape,
  hasHoverPointer,
  initImagePlaceholderObserver,
  isHtmlElement,
  isSaveDataEnabled,
  isTouchLikePointer,
  loadCatalogImageWithRecovery,
  mediumSrc,
  networkEffectiveType,
  normalizeCatalogImageUrl,
  normalizeShareRoutePath,
  pageAspectStyle,
  pageAspectVariableStyle,
  pageSize,
  pageSrc,
  prepareCatalogImage,
  prepareImagePlaceholder,
  recoverCatalogImageAfterInitialFailure,
  setCatalogImageSource,
  setTooltipText,
  showActionToast,
  subcategorySectionId,
  subcategoryShareSlug,
  syncDocumentLock,
  syncImagePlaceholderState,
  thumbSrc,
  unversionedCatalogImageUrl
};
