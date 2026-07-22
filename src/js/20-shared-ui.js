/**
 * Source module: 20-shared-ui.js
 * Shared media loading, image placeholders, action feedback, asset paths, snapshots, and route helpers.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

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

function catalogImageCrossOriginAttribute() {
  return "";
}

function applyCatalogImageCrossOrigin(img) {
  if (img) img.removeAttribute("crossorigin");
}

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

function catalogImageRecoveryCandidates(primarySrc, fallbackSrc = "", options = {}) {
  const primary = normalizeCatalogImageUrl(primarySrc);
  const fallback = normalizeCatalogImageUrl(fallbackSrc);
  const candidates = [];
  const push = (src, role, tier = "") => {
    if (!src || candidates.some((candidate) => candidate.src === src)) return;
    candidates.push({ src, role, tier, fallback: role.startsWith("fallback") });
  };

  const primaryTier = String(options.primaryTier || "");
  push(
    options.forceRefresh ? cacheBustedCatalogImageUrl(primary) : primary,
    options.forceRefresh ? "manual" : "primary",
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

function loadCatalogImageWithRecovery(img, options = {}) {
  const candidates = catalogImageRecoveryCandidates(options.primarySrc, options.fallbackSrc, options);
  const isCurrent = typeof options.isCurrent === "function" ? options.isCurrent : () => true;
  const telemetryDetail = telemetryCleanText(options.telemetryDetail, 40);
  let index = 0;
  let stopped = false;
  let failedAttempts = 0;
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

function prepareCatalogImage(url, options = {}) {
  const src = String(url || "");
  if (!src) return Promise.reject(new Error("missing-image-src"));

  const cached = state.catalogImageLoadCache.get(src);
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
      state.catalogImageLoadCache.delete(src);
      telemetryTrackImageAttemptFailure(src, {
        detail: options.detail || "preload",
        action: "preload",
        attempt: 1
      });
      reject(new Error("image-load-failed"));
    }, { once: true });

    image.src = src;
  });

  if (state.catalogImageLoadCache.size >= CATALOG_IMAGE_PRELOAD_CACHE_LIMIT) {
    const oldestSrc = state.catalogImageLoadCache.keys().next().value;
    if (oldestSrc) state.catalogImageLoadCache.delete(oldestSrc);
  }
  state.catalogImageLoadCache.set(src, promise);
  return promise;
}

function runViewerPageSwapAnimation(element, options = {}) {
  const { timerKey, root = element?.parentElement } = options;
  if (!element || !timerKey || !(timerKey in state)) return;

  window.clearTimeout(state[timerKey]);
  root?.querySelectorAll?.(".page-swap-enter")
    .forEach((animatedElement) => animatedElement.classList.remove("page-swap-enter"));

  // Restart the entrance animation only after the target page geometry and
  // positioning are ready, so the incoming single frame never animates from a
  // stale size or location.
  void element.offsetWidth;
  element.classList.add("page-swap-enter");
  state[timerKey] = window.setTimeout(() => {
    element.classList.remove("page-swap-enter");
    state[timerKey] = 0;
  }, VIEWER_PAGE_SWAP_CLEANUP_MS);
}

function runSingleImageSwapAnimation() {
  runViewerPageSwapAnimation(els.lightboxImageFrame, {
    timerKey: "singleImageAnimationTimer",
    root: els.stageCanvas
  });
}


function finishSingleImageSwap(token) {
  if (token !== state.singleImageLoadToken) return;
  setViewerLoading(false);
  els.lightbox?.classList.remove("is-page-loading");
  els.lightboxImageFrame?.classList.remove("is-preparing-swap");
  syncImagePlaceholderState(els.lightboxImage);
  applyZoom();
}

function ensureSingleViewerResolutionImage() {
  if (state.singleImageResolutionImage?.isConnected) return state.singleImageResolutionImage;
  if (!els.lightboxImageFrame) return null;

  const image = new Image();
  image.className = "lightbox-image lightbox-image-resolution";
  image.alt = "";
  image.draggable = false;
  image.decoding = "async";
  image.fetchPriority = "high";
  image.setAttribute("aria-hidden", "true");
  image.dataset.placeholderIgnore = "true";
  els.lightboxImageFrame.append(image);
  state.singleImageResolutionImage = image;
  return image;
}

function clearSingleViewerResolutionUpgrade() {
  state.singleImageResolutionLoadToken += 1;
  state.singleImageResolutionStop?.();
  state.singleImageResolutionStop = null;
  state.singleImageResolutionTargetSrc = "";
  state.singleImageResolutionTargetTier = "";
  state.singleImageResolutionReady = false;
  state.singleImageResolutionVisible = false;
  state.singleImageResolutionCommitPending = false;
  els.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");

  const image = state.singleImageResolutionImage;
  if (!image) return;
  image.removeAttribute("src");
  delete image.dataset.logicalSrc;
  delete image.dataset.loadedTier;
  delete image.dataset.loadedQuality;
  delete image.dataset.imageLoadPending;
}

function activeSingleViewerImageLogicalSrc() {
  if (state.singleImageResolutionVisible && state.singleImageResolutionTargetSrc) {
    return state.singleImageResolutionTargetSrc;
  }
  return normalizeCatalogImageUrl(els.lightboxImage?.dataset.logicalSrc || els.lightboxImage?.getAttribute("src") || "");
}

function activeSingleViewerImageTier() {
  if (state.singleImageResolutionVisible && state.singleImageResolutionTargetTier) {
    return state.singleImageResolutionTargetTier;
  }
  return String(els.lightboxImage?.dataset.loadedTier || "");
}

function shouldWarmSingleViewerFullResolution(previousZoom = state.zoom) {
  if (isSaveDataEnabled()) return false;
  const effectiveType = networkEffectiveType();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") return false;

  const zoom = Number(state.zoom) || AUTO_VIEWER_ZOOM;
  const previous = Number(previousZoom) || AUTO_VIEWER_ZOOM;
  return zoom > AUTO_VIEWER_ZOOM + VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON
    && zoom > previous + 0.001;
}

function commitSingleViewerResolutionUpgrade(token = state.singleImageResolutionLoadToken) {
  if (token !== state.singleImageResolutionLoadToken || !state.singleImageResolutionReady) {
    state.singleImageResolutionCommitPending = true;
    return false;
  }

  state.singleImageResolutionCommitPending = false;
  state.singleImageResolutionVisible = true;
  requestAnimationFrame(() => {
    if (token !== state.singleImageResolutionLoadToken || !state.singleImageResolutionVisible) return;
    els.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready");
  });
  return true;
}

function prepareSingleViewerResolutionUpgrade(catalog, page, request, options = {}) {
  if (!catalog || !request?.primarySrc || request.primaryTier !== CATALOG_IMAGE_TIER_FULL) return false;
  const targetSrc = normalizeCatalogImageUrl(request.primarySrc);
  if (!targetSrc) return false;

  const sameTarget = state.singleImageResolutionTargetSrc === targetSrc
    && state.singleImageResolutionTargetTier === request.primaryTier;
  if (sameTarget) {
    if (options.commit) {
      state.singleImageResolutionCommitPending = true;
      if (state.singleImageResolutionReady) commitSingleViewerResolutionUpgrade();
    }
    return true;
  }

  clearSingleViewerResolutionUpgrade();
  const image = ensureSingleViewerResolutionImage();
  if (!image) return false;

  const token = ++state.singleImageResolutionLoadToken;
  state.singleImageResolutionTargetSrc = targetSrc;
  state.singleImageResolutionTargetTier = request.primaryTier;
  state.singleImageResolutionCommitPending = Boolean(options.commit);
  els.lightboxImageFrame?.classList.add("is-resolution-loading");

  state.singleImageResolutionStop = loadCatalogImageWithRecovery(image, {
    primarySrc: targetSrc,
    primaryTier: request.primaryTier,
    isCurrent: () => (
      token === state.singleImageResolutionLoadToken
      && isViewerSessionOpen()
      && state.catalog === catalog
      && state.page === page
      && state.singleImageResolutionTargetSrc === targetSrc
    ),
    telemetryDetail: "viewer-resolution-upgrade",
    onSuccess: (candidate) => {
      const finishReady = () => {
        if (token !== state.singleImageResolutionLoadToken || !image.naturalWidth) return;
        state.singleImageResolutionStop = null;
        state.singleImageResolutionReady = true;
        image.dataset.logicalSrc = targetSrc;
        image.dataset.loadedTier = candidate.tier || request.primaryTier;
        image.dataset.loadedQuality = image.dataset.loadedTier;
        els.lightboxImageFrame?.classList.remove("is-resolution-loading");

        const preferredTier = preferredViewerImageTier(catalog, page);
        if (state.singleImageResolutionCommitPending || preferredTier === CATALOG_IMAGE_TIER_FULL) {
          commitSingleViewerResolutionUpgrade(token);
        }
      };

      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).then(finishReady);
      } else {
        finishReady();
      }
    },
    onExhausted: () => {
      if (token !== state.singleImageResolutionLoadToken) return;
      state.singleImageResolutionStop = null;
      state.singleImageResolutionTargetSrc = "";
      state.singleImageResolutionTargetTier = "";
      state.singleImageResolutionReady = false;
      state.singleImageResolutionVisible = false;
      state.singleImageResolutionCommitPending = false;
      els.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");
      image.removeAttribute("src");
    }
  });
  return true;
}

function setSingleViewerImageFeedback(mode = "", message = "") {
  const visible = Boolean(mode && message);
  const isError = mode === "error";
  els.viewerImageFeedback?.classList.toggle("hidden", !visible);
  if (els.viewerImageFeedback) {
    els.viewerImageFeedback.dataset.mode = visible ? mode : "";
    els.viewerImageFeedback.dataset.state = visible ? (isError ? "error" : "warning") : "";
    els.viewerImageFeedback.setAttribute("role", isError ? "alert" : "status");
    els.viewerImageFeedback.setAttribute("aria-live", isError ? "assertive" : "polite");
  }
  if (els.viewerImageFeedbackText) els.viewerImageFeedbackText.textContent = message;
  els.viewerImageRetry?.classList.toggle("hidden", !visible);
  els.lightboxImageFrame?.classList.toggle("image-fallback", mode === "fallback");
  if (mode !== "error") els.lightboxImageFrame?.classList.remove("image-terminal-error");
}

function showSingleLightboxImage(catalog, page, src, options = {}) {
  if (!els.lightboxImage || !catalog) return;

  const token = ++state.singleImageLoadToken;
  const image = els.lightboxImage;
  const request = options.imageRequest || viewerPageImageRequest(catalog, page, {
    forceFull: Boolean(options.forceFull)
  });
  const primarySrc = normalizeCatalogImageUrl(src || request.primarySrc);
  if (!primarySrc) return;
  const currentLogicalSrc = image.dataset.logicalSrc || normalizeCatalogImageUrl(image.getAttribute("src") || "");
  if (!options.forceRefresh && currentLogicalSrc === primarySrc && image.complete && image.naturalWidth && image.dataset.loadedQuality !== "fallback") {
    applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
    setSingleViewerImageFeedback();
    finishSingleImageSwap(token);
    return;
  }

  const preserveCurrentImage = Boolean(
    options.preserveCurrentImage
    && image.complete
    && image.naturalWidth > 0
    && !els.lightboxImageFrame?.classList.contains("image-terminal-error")
  );
  clearSingleViewerResolutionUpgrade();
  setViewerLoading(true);
  els.lightboxImageFrame?.setAttribute("aria-busy", "true");
  setSingleViewerImageFeedback();
  els.lightbox?.classList.add("is-page-loading");
  els.lightboxImageFrame?.classList.toggle("is-preparing-swap", !preserveCurrentImage);
  els.lightboxImageFrame?.classList.remove("image-terminal-error");
  if (preserveCurrentImage) {
    // Keep the decoded current page painted while the browser's pending image
    // request is replaced. The frame receives only a slight loading dim instead
    // of exposing the viewer background between pages.
    image.dataset.placeholderIgnore = "true";
  } else {
    prepareImagePlaceholder(image);
  }
  image.alt = `${catalog.title} - עמוד ${page}`;
  applyCatalogImageDimensions(image, catalog, page);
  image.decoding = "async";
  image.fetchPriority = "high";
  image.dataset.logicalSrc = primarySrc;

  const requestIsCurrent = () => (
    token === state.singleImageLoadToken
    && isViewerSessionOpen()
    && state.catalog === catalog
    && state.page === page
  );
  const commitImageRequest = () => {
    if (!requestIsCurrent()) return;
    loadCatalogImageWithRecovery(image, {
      primarySrc,
      primaryTier: request.primaryTier,
      fallbackCandidates: request.fallbackCandidates,
      forceRefresh: Boolean(options.forceRefresh),
      isCurrent: requestIsCurrent,
      telemetryDetail: "viewer-single",
      onSuccess: (candidate) => {
        delete image.dataset.placeholderIgnore;
        const loadedTier = candidate.tier || request.primaryTier || CATALOG_IMAGE_TIER_FULL;
        const degraded = catalogImageTierRank(loadedTier) < catalogImageTierRank(request.primaryTier);
        image.dataset.loadedTier = loadedTier;
        image.dataset.loadedQuality = degraded ? "fallback" : loadedTier;
        if (image.naturalWidth && image.naturalHeight) {
          applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
        }
        finishSingleImageSwap(token);
        els.lightboxImageFrame?.setAttribute("aria-busy", "false");
        runSingleImageSwapAnimation();
        if (degraded) {
          setSingleViewerImageFeedback("fallback", "שכבת התמונה המועדפת לא נטענה. מוצגת חלופה מוקטנת; אפשר לנסות שוב.");
        } else {
          setSingleViewerImageFeedback();
        }
      },
      onExhausted: () => {
        delete image.dataset.placeholderIgnore;
        delete image.dataset.loadedTier;
        delete image.dataset.loadedQuality;
        finishSingleImageSwap(token);
        els.lightboxImageFrame?.setAttribute("aria-busy", "false");
        els.lightboxImageFrame?.classList.add("image-terminal-error");
        setSingleViewerImageFeedback("error", "התמונה לא הצליחה להיטען. אפשר לנסות שוב.");
      }
    });
  };

  if (preserveCurrentImage) {
    // Decode the target in a detached image first. Only then replace the visible
    // image source, so even browsers that clear an <img> during a src change can
    // reuse a decoded resource instead of exposing the viewer background.
    prepareCatalogImage(primarySrc, { priority: "high", detail: "viewer-page-stage" })
      .catch(() => null)
      .then(commitImageRequest);
  } else {
    commitImageRequest();
  }
}
function pad(num) {
  return String(num).padStart(3, "0");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function catalogCategoryName(catalog) {
  const category = String(catalog?.category || "").trim();
  return category || "קטלוגים";
}

function catalogSubcategoryName(catalog) {
  const value = catalog?.subcategory ?? catalog?.subCategory ?? catalog?.sub_category ?? catalog?.subcategories ?? catalog?.["תת קטגוריה"] ?? catalog?.["תת_קטגוריה"] ?? "";
  const rawSubcategory = Array.isArray(value) ? value.find((item) => String(item || "").trim()) : value;
  const subcategory = String(rawSubcategory || "").trim();
  return subcategory;
}

function categorySlug(value) {
  return String(value || "catalog")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "catalog";
}

function categorySectionId(category, index) {
  return `catalog-category-${categorySlug(category)}-${index + 1}`;
}

function subcategorySectionId(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categorySectionId(category, categoryIndex)}-sub-${categorySlug(subcategory)}-${subcategoryIndex + 1}`;
}

const catalogTaxonomy = window.BARGIG_CATALOG_TAXONOMY || { categories: [], subcategories: [] };
const CATALOG_CATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.categories) ? catalogTaxonomy.categories : [])
    .map((item) => [String(item?.name || "").trim(), String(item?.slug || "").trim()])
    .filter(([name, slug]) => name && slug)
);
const CATALOG_SUBCATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.subcategories) ? catalogTaxonomy.subcategories : [])
    .map((item) => [String(item?.name || "").trim(), String(item?.slug || "").trim()])
    .filter(([name, slug]) => name && slug)
);

function normalizeShareRouteToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeShareRoutePath(value) {
  return String(value || "")
    .split("/")
    .map(normalizeShareRouteToken)
    .filter(Boolean)
    .join("/");
}

function categoryShareSlug(category, index) {
  const mapped = CATALOG_CATEGORY_SHARE_SLUGS.get(String(category || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(category) || `category-${index + 1}`;
}

function subcategoryShareSlug(subcategory, index) {
  const mapped = CATALOG_SUBCATEGORY_SHARE_SLUGS.get(String(subcategory || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(subcategory) || `sub-${index + 1}`;
}

function catalogCategorySharePath(category, index) {
  return categoryShareSlug(category, index);
}

function catalogSubcategorySharePath(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categoryShareSlug(category, categoryIndex)}/${subcategoryShareSlug(subcategory, subcategoryIndex)}`;
}

function getCatalogCategoryGroups() {
  const groups = [];
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
    const subcategory = catalogSubcategoryName(catalog);
    group.items.push(catalog);

    if (!subcategory) {
      group.directItems.push(catalog);
      return;
    }

    if (!group.subcategoryMap.has(subcategory)) {
      const subcategoryGroup = { subcategory, items: [] };
      group.subcategoryMap.set(subcategory, subcategoryGroup);
      group.subcategories.push(subcategoryGroup);
    }
    group.subcategoryMap.get(subcategory).items.push(catalog);
  });

  groups.forEach((group) => {
    group.hasSubcategories = group.subcategories.length > 0;
    delete group.subcategoryMap;
  });

  return groups;
}

function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}

function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}

function catalogAssetVersionForTier(catalog, tier) {
  const normalizedTier = String(tier || CATALOG_IMAGE_TIER_FULL);
  const variantVersion = String(catalog?.imageVariants?.[normalizedTier]?.version || "").trim();
  const baseVersion = variantVersion || String(catalog?.assetVersion || "").trim();
  if (!baseVersion) return "";
  return `${baseVersion}-${normalizedTier}-u${CATALOG_ASSET_URL_SCHEMA_VERSION}`;
}

function withAssetVersion(url, catalog, tier = CATALOG_IMAGE_TIER_FULL) {
  const version = catalogAssetVersionForTier(catalog, tier);
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${CATALOG_ASSET_VERSION_PARAM}=${encodeURIComponent(version)}`;
}

function pageSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_FULL
  );
}

function thumbSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_THUMB
  );
}

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

function catalogSupportsImageTier(catalog, tier) {
  return Boolean(catalogImageVariant(catalog, tier));
}

function catalogImageTierMaxSide(catalog, tier) {
  const value = Number(catalogImageVariant(catalog, tier)?.maxSide);
  if (Number.isFinite(value) && value > 0) return value;
  return tier === CATALOG_IMAGE_TIER_MEDIUM ? DEFAULT_CATALOG_MEDIUM_MAX_SIDE : 0;
}

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

function catalogPageImageSrc(catalog, page, tier) {
  if (tier === CATALOG_IMAGE_TIER_THUMB) return thumbSrc(catalog, page);
  if (tier === CATALOG_IMAGE_TIER_MEDIUM) return mediumSrc(catalog, page);
  return pageSrc(catalog, page);
}

function renderedViewerPagePhysicalLongSide(catalog, page, zoom = state.zoom) {
  const frame = els.lightboxImageFrame || null;
  const rect = frame?.getBoundingClientRect?.();
  const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
  if (rect?.width && rect?.height) return Math.max(rect.width, rect.height) * dpr;

  const size = pageSize(catalog, page);
  const stageWidth = Math.max(1, els.stageCanvas?.clientWidth || window.innerWidth || 1);
  const stageHeight = Math.max(1, els.stageCanvas?.clientHeight || window.innerHeight || 1);
  if (!size) return Math.max(stageWidth, stageHeight) * dpr;

  const fitMode = String(state.imageFitMode || VIEWER_FIT_HEIGHT);
  const scale = fitMode === VIEWER_FIT_WIDTH
    ? stageWidth / size.width
    : fitMode === VIEWER_FIT_HEIGHT
      ? stageHeight / size.height
      : Math.min(stageWidth / size.width, stageHeight / size.height);
  return Math.max(size.width, size.height) * Math.max(0.01, scale) * dpr * Math.max(1, Number(zoom) || 1);
}

function preferredViewerImageTier(catalog, page, options = {}) {
  if (options.forceFull || !catalogSupportsImageTier(catalog, CATALOG_IMAGE_TIER_MEDIUM)) {
    return CATALOG_IMAGE_TIER_FULL;
  }
  if (options.preferMedium) return CATALOG_IMAGE_TIER_MEDIUM;

  const zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : Number(state.zoom || 1);
  if (zoom >= VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD) return CATALOG_IMAGE_TIER_FULL;

  if (!isSaveDataEnabled()) {
    const mediumMaxSide = catalogImageTierMaxSide(catalog, CATALOG_IMAGE_TIER_MEDIUM);
    const requiredPixels = renderedViewerPagePhysicalLongSide(catalog, page, zoom);
    if (requiredPixels > mediumMaxSide * VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO) {
      return CATALOG_IMAGE_TIER_FULL;
    }
  }
  return CATALOG_IMAGE_TIER_MEDIUM;
}

function viewerPageImageRequest(catalog, page, options = {}) {
  const primaryTier = preferredViewerImageTier(catalog, page, options);
  const tierOrder = primaryTier === CATALOG_IMAGE_TIER_FULL
    ? [CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB]
    : [CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_THUMB];
  const candidates = tierOrder
    .filter((tier) => catalogSupportsImageTier(catalog, tier))
    .map((tier) => ({ tier, src: catalogPageImageSrc(catalog, page, tier) }))
    .filter((candidate) => candidate.src);
  const primary = candidates[0] || { tier: CATALOG_IMAGE_TIER_FULL, src: pageSrc(catalog, page) };
  return {
    primarySrc: primary.src,
    primaryTier: primary.tier,
    fallbackCandidates: candidates.slice(1).map((candidate, index) => ({
      ...candidate,
      role: `fallback-${index + 1}`
    }))
  };
}

function viewerPageSrc(catalog, page, options = {}) {
  return viewerPageImageRequest(catalog, page, options).primarySrc;
}

function catalogImageTierRank(tier) {
  if (tier === CATALOG_IMAGE_TIER_FULL) return 3;
  if (tier === CATALOG_IMAGE_TIER_MEDIUM) return 2;
  if (tier === CATALOG_IMAGE_TIER_THUMB) return 1;
  return 0;
}

function refreshSingleViewerImageResolution(options = {}) {
  if (!isViewerSessionOpen() || !state.catalog || !els.lightboxImage) return false;
  const request = viewerPageImageRequest(state.catalog, state.page, options);

  if (options.warmFull && request.primaryTier !== CATALOG_IMAGE_TIER_FULL) {
    const fullRequest = viewerPageImageRequest(state.catalog, state.page, { forceFull: true });
    prepareSingleViewerResolutionUpgrade(state.catalog, state.page, fullRequest, { commit: false });
  }

  const currentSrc = activeSingleViewerImageLogicalSrc();
  const nextSrc = normalizeCatalogImageUrl(request.primarySrc);
  const loadedTier = activeSingleViewerImageTier();
  if (currentSrc === nextSrc) return Boolean(options.warmFull);
  if (catalogImageTierRank(loadedTier) > catalogImageTierRank(request.primaryTier)) return false;

  if (request.primaryTier === CATALOG_IMAGE_TIER_FULL) {
    return prepareSingleViewerResolutionUpgrade(state.catalog, state.page, request, { commit: true });
  }

  if (!state.singleImageResolutionVisible && !state.singleImageResolutionReady) {
    clearSingleViewerResolutionUpgrade();
  }
  return false;
}

function catalogCoverSrc(catalog) {
  return catalog?.cover ? withAssetVersion(resolveCatalogAssetUrl(catalog.cover), catalog) : pageSrc(catalog, 1);
}

function coverThumbSrc(catalog) {
  return thumbSrc(catalog, 1);
}

function pageSize(catalog, page) {
  const sizes = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes : [];
  const size = sizes[page - 1];
  if (!Array.isArray(size) || size.length < 2) return null;
  const width = Number(size[0]);
  const height = Number(size[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function catalogPagesShareAspectRatio(firstCatalog, firstPage, secondCatalog, secondPage) {
  const firstSize = pageSize(firstCatalog, firstPage);
  const secondSize = pageSize(secondCatalog, secondPage);
  if (!firstSize || !secondSize) return false;

  const firstRatio = firstSize.width / firstSize.height;
  const secondRatio = secondSize.width / secondSize.height;
  return Math.abs(firstRatio - secondRatio) <= 0.001;
}

function catalogImageDimensionAttributes(catalog, page) {
  const size = pageSize(catalog, page);
  return size ? ` width="${size.width}" height="${size.height}"` : "";
}

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

function catalogCoverLoadingAttributes(catalog) {
  const index = catalogs.findIndex((item) => item?.id === catalog?.id);
  const eager = index >= 0 && index < CATALOG_EAGER_COVER_COUNT;
  return eager
    ? ' loading="eager" decoding="async" fetchpriority="high"'
    : ' loading="lazy" decoding="async" fetchpriority="low"';
}

function pageAspectStyle(catalog, page) {
  const size = pageSize(catalog, page);
  return size ? ` style="aspect-ratio: ${size.width} / ${size.height}"` : "";
}

function pageAspectVariableStyle(catalog, page, variableName = "--page-aspect-ratio") {
  const size = pageSize(catalog, page);
  return size ? ` style="${variableName}: ${size.width} / ${size.height}"` : "";
}

function applyLoadedPageAspect(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;

  const frame = img.closest?.(".reader-page-frame");
  if (!frame) return;

  const width = Number(img.naturalWidth);
  const height = Number(img.naturalHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

  frame.style.aspectRatio = `${width} / ${height}`;

  const page = Number.parseInt(frame.dataset.page || "", 10);
  if (!state.catalog || !Number.isFinite(page) || page < 1) return;

  if (!Array.isArray(state.catalog.pageSizes)) state.catalog.pageSizes = [];
  state.catalog.pageSizes[page - 1] = [width, height];

}

function watchLoadedPageAspect(img) {
  if (!img) return;

  if (img.complete && img.naturalWidth && img.naturalHeight) {
    applyLoadedPageAspect(img);
    return;
  }

  img.addEventListener("load", () => applyLoadedPageAspect(img), { once: true });
}

function clampPage(page, catalog = state.catalog) {
  const parsed = Number.parseInt(page, 10);
  if (!Number.isFinite(parsed)) return 1;
  const maxPage = Math.max(1, Number(catalog?.pages || 1));
  return Math.min(Math.max(parsed, 1), maxPage);
}

function safeFilePart(value) {
  return String(value || "catalog")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "catalog";
}

function getTooltipText(button) {
  return window.BargigTooltips?.getText?.(button) || button?.getAttribute?.("title") || "";
}

function setTooltipText(button, text, options = {}) {
  if (!button) return;
  if (window.BargigTooltips?.setText) {
    window.BargigTooltips.setText(button, text, options);
    return;
  }

  if (text) button.setAttribute("title", text);
  else button.removeAttribute("title");
}

function flashActionButton(button, message) {
  if (!button || !message) return;
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

function actionToastTone(message) {
  if (message === "נשמר" || message === "התמונה נשמרה") return "saved";
  if (message === "הוסר" || message.includes("הוסרו")) return "removed";
  if (message.includes("קישור")) return "link";
  return "info";
}

function showActionToast(message, options = {}) {
  if (!els.siteActionToast || !message) return;
  const normalizedOptions = typeof options === "number" ? { duration: options } : options;
  const duration = Math.max(1000, Number(normalizedOptions.duration) || 1000);

  window.clearTimeout(state.actionToastTimer);
  els.siteActionToast.textContent = message;
  els.siteActionToast.dataset.tone = normalizedOptions.tone || actionToastTone(message);
  els.siteActionToast.classList.remove("hidden", "visible");
  void els.siteActionToast.offsetWidth;
  window.requestAnimationFrame(() => els.siteActionToast.classList.add("visible"));
  state.actionToastTimer = window.setTimeout(() => {
    els.siteActionToast.classList.remove("visible");
    window.setTimeout(() => {
      if (!els.siteActionToast.classList.contains("visible")) {
        els.siteActionToast.classList.add("hidden");
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

function imagePlaceholderFrame(img) {
  if (img?.dataset?.placeholderIgnore === "true") return null;
  return img?.closest?.(IMAGE_PLACEHOLDER_FRAME_SELECTOR) || null;
}

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
  document.querySelectorAll(`${IMAGE_PLACEHOLDER_FRAME_SELECTOR} img`).forEach(prepareImagePlaceholder);

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
        if (node.matches?.("img")) prepareImagePlaceholder(node);
        node.querySelectorAll?.("img").forEach(prepareImagePlaceholder);
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

function getCurrentCatalogFocusUrlTargetId() {
  const hashTargetId = resolveCatalogCategoryTargetIdFromHash();
  if (hashTargetId && getCatalogCategorySectionsByTargetId(hashTargetId).length) {
    return hashTargetId;
  }

  const activeTargetId = String(state.categoryFocusTargetId || "");
  if (activeTargetId && getCatalogCategorySectionsByTargetId(activeTargetId).length) {
    return activeTargetId;
  }

  return "";
}

function encodeHashRouteSegment(value) {
  return encodeURIComponent(String(value ?? ""));
}

function decodeHashRouteSegment(value) {
  const segment = String(value || "");
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodeShareRoutePath(path) {
  const normalizedPath = normalizeShareRoutePath(path);
  if (!normalizedPath) return "";
  return normalizedPath.split("/").map(encodeHashRouteSegment).join("/");
}

function buildCategoryShareRouteHash(path) {
  const encodedPath = encodeShareRoutePath(path);
  return encodedPath ? `#cat/${encodedPath}` : "";
}

function findCatalogById(id) {
  const catalogId = String(id || "");
  return catalogs.find((item) => String(item.id || "") === catalogId) || null;
}

function handleTopLayerEscape(event) {
  if (event.key !== "Escape" || event.defaultPrevented) return false;

  const closeLayer = (callback) => {
    event.preventDefault();
    callback();
    return true;
  };

  // Escape always dismisses the innermost active layer first. This order is
  // intentionally shared by every route so one key press cannot close a child
  // dialog and then continue into its parent screen during event bubbling.
  if (state.favoriteNoteEditingKey) {
    return closeLayer(() => closeFavoriteNoteEditor());
  }
  if (state.favoritesTransferPending) {
    return closeLayer(() => closeFavoritesTransferDialog({
      cleanUrl: state.favoritesTransferPending?.source === "link"
    }));
  }
  if (state.favoritesOpen) {
    return closeLayer(() => closeFavoritesPanel());
  }
  if (isMobileCategoryMenuOpen()) {
    return closeLayer(() => closeMobileCategoryMenu({ focusButton: true }));
  }
  if (isGlobalSearchPanelOpen()) {
    if (els.globalSearchScopeMenu && !els.globalSearchScopeMenu.classList.contains("hidden")) {
      return closeLayer(() => closeGlobalSearchScopeMenu());
    }
    return closeLayer(() => closeGlobalSearchPanel({ focusButton: true }));
  }
  if (els.catalogMenu && !els.catalogMenu.classList.contains("hidden")) {
    return closeLayer(() => closeDetailCatalogMenu());
  }
  if (!isViewerSessionOpen()) return false;

  if (state.viewerInquiryOpen) {
    return closeLayer(() => closeViewerInquiry());
  }
  if (state.viewerMobileMoreOpen) {
    return closeLayer(() => closeViewerMobileMoreMenu({ returnFocus: true }));
  }
  if (state.viewerOnboardingOpen) {
    return closeLayer(() => closeViewerOnboarding());
  }
  if (state.lightboxMobileSearchOpen) {
    return closeLayer(() => setLightboxMobileSearchOpen(false, {
      returnFocus: true,
      hideResults: true
    }));
  }
  if (
    (els.lightboxCatalogMenu && !els.lightboxCatalogMenu.classList.contains("hidden")) ||
    (els.lightboxSearchScopeMenu && !els.lightboxSearchScopeMenu.classList.contains("hidden"))
  ) {
    return closeLayer(() => {
      closeLightboxCatalogMenu();
      closeLightboxSearchScopeMenu();
    });
  }
  if (isBrowserFullscreenActive()) {
    return closeLayer(() => {
      exitBrowserFullscreen().catch(() => {});
    });
  }

  const target = event.target;
  const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  if (isTyping) {
    return closeLayer(() => hideLightboxSearchResults({ blurTopUiFocus: true }));
  }

  return closeLayer(() => closeLightbox());
}
