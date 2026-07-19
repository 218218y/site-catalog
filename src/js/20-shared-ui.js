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
  const push = (src, role) => {
    if (!src || candidates.some((candidate) => candidate.src === src)) return;
    candidates.push({ src, role, fallback: role === "fallback" });
  };

  push(options.forceRefresh ? cacheBustedCatalogImageUrl(primary) : primary, options.forceRefresh ? "manual" : "primary");
  push(cacheBustedCatalogImageUrl(primary), "retry");
  if (fallback && fallback !== primary) push(fallback, "fallback");
  return candidates;
}

function loadCatalogImageWithRecovery(img, options = {}) {
  const candidates = catalogImageRecoveryCandidates(options.primarySrc, options.fallbackSrc, options);
  const isCurrent = typeof options.isCurrent === "function" ? options.isCurrent : () => true;
  let index = 0;
  let stopped = false;

  img.dataset.telemetryManaged = "true";

  const attempt = () => {
    if (stopped || !isCurrent() || index >= candidates.length) {
      if (!stopped && isCurrent()) options.onExhausted?.();
      return;
    }

    const candidate = candidates[index++];
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
        options.onSuccess?.(candidate);
        return;
      }
      options.onFailure?.(candidate);
      attempt();
    };

    img.addEventListener("load", () => settle(true), { once: true });
    img.addEventListener("error", () => settle(false), { once: true });
    options.onAttempt?.(candidate);
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
    image.addEventListener("load", () => {
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
      telemetryTrackImageFailure(src, { detail: options.detail || "preload" });
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

  // Restart the exact same entrance animation for both the single-page frame
  // and the active frame in continuous-scroll mode. Page positioning is
  // already complete before this reflow, so only the incoming page animates.
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

function showSingleLightboxImage(catalog, page, src) {
  const options = arguments[3] || {};
  if (!els.lightboxImage || !catalog || !src) return;

  const token = ++state.singleImageLoadToken;
  const image = els.lightboxImage;
  const primarySrc = normalizeCatalogImageUrl(src);
  const currentLogicalSrc = image.dataset.logicalSrc || normalizeCatalogImageUrl(image.getAttribute("src") || "");
  if (!options.forceRefresh && currentLogicalSrc === primarySrc && image.complete && image.naturalWidth && image.dataset.loadedQuality !== "fallback") {
    applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
    setSingleViewerImageFeedback();
    finishSingleImageSwap(token);
    return;
  }

  setViewerLoading(true);
  els.lightboxImageFrame?.setAttribute("aria-busy", "true");
  setSingleViewerImageFeedback();
  els.lightbox?.classList.add("is-page-loading");
  els.lightboxImageFrame?.classList.add("is-preparing-swap");
  els.lightboxImageFrame?.classList.remove("image-terminal-error");
  prepareImagePlaceholder(image);
  image.alt = `${catalog.title} - עמוד ${page}`;
  image.decoding = "async";
  image.fetchPriority = "high";
  image.dataset.logicalSrc = primarySrc;

  loadCatalogImageWithRecovery(image, {
    primarySrc,
    fallbackSrc: thumbSrc(catalog, page),
    forceRefresh: Boolean(options.forceRefresh),
    isCurrent: () => (
      token === state.singleImageLoadToken
      && state.lightboxOpen
      && state.catalog === catalog
      && state.page === page
    ),
    onFailure: (candidate) => {
      telemetryTrackImageFailure(candidate.src, {
        img: image,
        detail: `viewer-single-${candidate.role}`
      });
    },
    onSuccess: (candidate) => {
      image.dataset.loadedQuality = candidate.fallback ? "fallback" : "full";
      if (image.naturalWidth && image.naturalHeight) {
        applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
      }
      finishSingleImageSwap(token);
      els.lightboxImageFrame?.setAttribute("aria-busy", "false");
      runSingleImageSwapAnimation();
      if (candidate.fallback) {
        setSingleViewerImageFeedback("fallback", "התמונה המלאה לא נטענה. מוצגת תצוגה מוקטנת; אפשר לנסות שוב.");
      } else {
        setSingleViewerImageFeedback();
      }
    },
    onExhausted: () => {
      delete image.dataset.loadedQuality;
      finishSingleImageSwap(token);
      els.lightboxImageFrame?.setAttribute("aria-busy", "false");
      els.lightboxImageFrame?.classList.add("image-terminal-error");
      setSingleViewerImageFeedback("error", "התמונה לא הצליחה להיטען. אפשר לנסות שוב.");
    }
  });
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

function withAssetVersion(url, catalog) {
  const version = String(catalog?.assetVersion || "").trim();
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

function pageSrc(catalog, page) {
  return withAssetVersion(`${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`, catalog);
}

function thumbSrc(catalog, page) {
  return withAssetVersion(`${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`, catalog);
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
  ".viewer-scroll-page-frame",
  ".search-result-thumb-frame",
  ".reader-search-thumb-frame",
  ".favorite-image-frame",
  ".lightbox-page-thumb-frame",
  ".reader-page-frame",
  ".reader-page-thumb-frame"
].join(", ");

function imagePlaceholderFrame(img) {
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
