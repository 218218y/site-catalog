const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;

const $ = (id) => document.getElementById(id);
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const MIN_VIEWER_ZOOM = 1;
const MAX_VIEWER_ZOOM = 5;

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
      try {
        if (typeof image.decode === "function") await image.decode();
      } catch (_error) {
        // Some browsers reject decode() for images that are already usable.
      }
      resolve(image);
    }, { once: true });

    image.addEventListener("error", () => {
      state.catalogImageLoadCache.delete(src);
      reject(new Error("image-load-failed"));
    }, { once: true });

    image.src = src;
  });

  state.catalogImageLoadCache.set(src, promise);
  return promise;
}

function runSingleImageSwapAnimation() {
  const frame = els.lightboxImageFrame;
  if (!frame) return;

  window.clearTimeout(state.singleImageAnimationTimer);
  frame.classList.remove("page-swap-enter");
  void frame.offsetWidth;
  frame.classList.add("page-swap-enter");
  state.singleImageAnimationTimer = window.setTimeout(() => {
    frame.classList.remove("page-swap-enter");
  }, 240);
}

function finishSingleImageSwap(token) {
  if (token !== state.singleImageLoadToken) return;
  setViewerLoading(false);
  els.lightbox?.classList.remove("is-page-loading");
  applyZoom();
}

async function showSingleLightboxImage(catalog, page, src) {
  if (!els.lightboxImage || !catalog || !src) return;

  const token = ++state.singleImageLoadToken;
  const image = els.lightboxImage;
  const currentSrc = image.getAttribute("src") || "";
  if (currentSrc === src && image.complete && image.naturalWidth) {
    finishSingleImageSwap(token);
    return;
  }

  setViewerLoading(true);
  els.lightbox?.classList.add("is-page-loading");

  try {
    await prepareCatalogImage(src, { priority: "high" });
    if (token !== state.singleImageLoadToken || !state.lightboxOpen || state.viewerMode !== "single" || state.catalog !== catalog || state.page !== page) return;

    image.alt = `${catalog.title} - עמוד ${page}`;
    image.decoding = "async";
    image.fetchPriority = "high";
    setCatalogImageSource(image, src);

    if (image.complete && image.naturalWidth) {
      finishSingleImageSwap(token);
    }

    runSingleImageSwapAnimation();
  } catch (error) {
    if (token !== state.singleImageLoadToken) return;
    console.warn("Lightbox image preload failed", error);
    image.alt = `${catalog.title} - עמוד ${page}`;
    setCatalogImageSource(image, src);
    finishSingleImageSwap(token);
  }
}
const DOUBLE_TAP_DELAY = 320;
const DOUBLE_TAP_DISTANCE = 34;
const TAP_MOVE_TOLERANCE = 14;

const state = {
  catalog: null,
  page: 1,
  zoom: 1,
  fitScale: 1,
  panX: 0,
  panY: 0,
  dragStartX: 0,
  dragStartY: 0,
  dragStartPanX: 0,
  dragStartPanY: 0,
  lastTapAt: 0,
  lastTapX: 0,
  lastTapY: 0,
  lastTapSurface: "",
  suppressNextDblClickUntil: 0,
  pinchStartDistance: 0,
  pinchStartZoom: 1,
  pinchLastMidX: 0,
  pinchLastMidY: 0,
  pointers: new Map(),
  lightboxOpen: false,
  viewerMode: "single",
  thumbsHideTimer: 0,
  uiHideTimer: 0,
  pageRailHideTimer: 0,
  lastTouchLikeRailInputAt: 0,
  lightboxScrollRaf: 0,
  globalSearchCategory: "",
  lightboxSearchScope: "catalog",
  lightboxScrollImageObserver: null,
  singleImageLoadToken: 0,
  singleImageAnimationTimer: 0,
  catalogImageLoadCache: new Map(),
  catalogLayoutColumns: 0,
  catalogLayoutResizeTimer: 0,
  categoryFocusTimer: 0,
  categoryFocusTargetId: "",
  categoryNavFitRaf: 0,
  catalogScrollTopButtonRaf: 0
};

const els = {
  splash: $("splashScreen"),
  catalogGrid: $("catalogGrid"),
  categoryNav: $("categoryNav"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  globalSearchInput: $("globalSearchInput"),
  globalSearchResults: $("globalSearchResults"),
  globalSearchClear: $("globalSearchClear"),
  globalSearchScopeToggle: $("globalSearchScopeToggle"),
  globalSearchScopeMenu: $("globalSearchScopeMenu"),
  searchFloatingPreview: $("searchFloatingPreview"),
  searchFloatingPreviewImage: $("searchFloatingPreviewImage"),
  searchFloatingPreviewPage: $("searchFloatingPreviewPage"),
  catalogDetail: $("catalogDetail"),
  catalogTitle: $("catalogDetailTitle"),
  catalogDescription: $("catalogDescription"),
  catalogMenuToggle: $("catalogMenuToggle"),
  catalogMenuToggleText: $("catalogMenuToggleText"),
  catalogMenu: $("catalogMenu"),
  catalogCoverPreview: $("catalogCoverPreview"),
  catalogCoverOpenViewer: $("catalogCoverOpenViewer"),
  pageGrid: $("pageGrid"),
  openViewerScrollFromTop: $("openViewerScrollFromTop"),
  openViewerSingleFromTop: $("openViewerSingleFromTop"),
  scrollToTopBtn: $("scrollToTopBtn"),
  lightbox: $("lightbox"),
  lightboxBackdrop: $("lightboxBackdrop"),
  lightboxBar: $("lightboxBar"),
  topHotspot: $("topHotspot"),
  thumbsHotspot: $("thumbsHotspot"),
  lightboxScreenshot: $("lightboxScreenshot"),
  lightboxCopyLink: $("lightboxCopyLink"),
  lightboxModeLabel: $("lightboxModeLabel"),
  viewerModeToggle: $("viewerModeToggle"),
  lightboxTitle: $("lightboxTitle"),
  lightboxMeta: $("lightboxMeta"),
  lightboxProgress: $("lightboxProgress"),
  lightboxImage: $("lightboxImage"),
  lightboxImageFrame: $("lightboxImageFrame"),
  lightboxThumbs: $("lightboxThumbs"),
  lightboxStage: $("lightboxStage"),
  lightboxScrollView: $("lightboxScrollView"),
  lightboxScrollPages: $("lightboxScrollPages"),
  lightboxSideHotspot: $("lightboxSideHotspot"),
  lightboxPageRail: $("lightboxPageRail"),
  lightboxPageThumbs: $("lightboxPageThumbs"),
  stageCanvas: $("stageCanvas"),
  viewerLoading: $("viewerLoading"),
  prevPageBtn: $("prevPageBtn"),
  nextPageBtn: $("nextPageBtn"),
  closeLightbox: $("closeLightbox"),
  fullscreenToggle: $("fullscreenToggle"),
  fitBtn: $("fitBtn"),
  lightboxSearchInput: $("lightboxSearchInput"),
  lightboxSearchResults: $("lightboxSearchResults"),
  lightboxSearchStatus: $("lightboxSearchStatus"),
  lightboxSearchClear: $("lightboxSearchClear"),
  lightboxSearchScopeToggle: $("lightboxSearchScopeToggle"),
  lightboxSearchScopeMenu: $("lightboxSearchScopeMenu"),
  lightboxCatalogMenuToggle: $("lightboxCatalogMenuToggle"),
  lightboxCatalogMenu: $("lightboxCatalogMenu"),
  lightboxFloatingPreview: $("lightboxFloatingPreview"),
  lightboxFloatingPreviewImage: $("lightboxFloatingPreviewImage"),
  lightboxFloatingPreviewPage: $("lightboxFloatingPreviewPage")
};

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

function applyLoadedPageAspect(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;

  const frame = img.closest?.(".lightbox-scroll-page-frame, .reader-page-frame");
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
  button.classList.add("reader-icon-button-done");
  window.setTimeout(() => {
    setTooltipText(button, originalTooltip);
    button.classList.remove("reader-icon-button-done");
  }, 1500);
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

function disconnectLightboxScrollImageLoading() {
  state.lightboxScrollImageObserver?.disconnect?.();
  state.lightboxScrollImageObserver = null;
}

function activateLightboxScrollImageLoading() {
  if (!els.lightboxScrollPages) return;
  const pendingImages = Array.from(els.lightboxScrollPages.querySelectorAll("img.lightbox-scroll-image[data-src]"));
  if (!pendingImages.length) return;

  if (!("IntersectionObserver" in window)) {
    pendingImages.forEach(loadDeferredImage);
    return;
  }

  disconnectLightboxScrollImageLoading();
  state.lightboxScrollImageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadDeferredImage(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    root: els.lightboxScrollView || null,
    rootMargin: "1800px 0px",
    threshold: 0.01
  });

  pendingImages.forEach((img) => state.lightboxScrollImageObserver.observe(img));
}

function ensureLightboxScrollPageLoaded(page, radius = 1) {
  if (!state.catalog || !els.lightboxScrollPages) return;
  const targetPage = clampPage(page, state.catalog);
  for (let nextPage = targetPage - radius; nextPage <= targetPage + radius; nextPage += 1) {
    if (nextPage < 1 || nextPage > state.catalog.pages) continue;
    const img = els.lightboxScrollPages.querySelector(`#lightbox-scroll-page-${nextPage} img.lightbox-scroll-image[data-src]`);
    if (img) {
      loadDeferredImage(img);
      state.lightboxScrollImageObserver?.unobserve?.(img);
    }
  }
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
    flashActionButton(button, "צילום המסך נשמר");
  } catch (_error) {
    window.alert("לא הצלחתי ליצור צילום מסך לעמוד הזה. כדאי לוודא שקבצי התמונות נטענים מאותו אתר ולא מחסימה של הדפדפן.");
  }
}

function buildLightboxPageUrl() {
  if (!state.catalog) return window.location.href;
  const url = new URL(window.location.href);
  url.hash = `catalog/${state.catalog.id}/page/${clampPage(state.page, state.catalog)}${state.viewerMode === "scroll" ? "/scroll" : ""}`;
  return url.href;
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.top = "-1000px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function downloadCurrentLightboxImage() {
  if (!state.catalog) return;
  downloadCatalogPageSnapshot(state.catalog, state.page, els.lightboxScreenshot);
}

async function copyCurrentLightboxLink() {
  const link = buildLightboxPageUrl();
  try {
    await copyTextToClipboard(link);
    flashActionButton(els.lightboxCopyLink, "הקישור הועתק");
  } catch (_error) {
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}


function initRevealObserver() {
  const nodes = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting || entry.intersectionRatio > 0) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: "0px 0px -1px 0px" });

  nodes.forEach((node) => observer.observe(node));
}

function renderEmptyState() {
  const html = `
    <article class="empty-state">
      <strong>עדיין אין קטלוגים להצגה</strong>
      <p>ברגע שיועלו קטלוגים, הם יופיעו כאן לבחירה ולצפייה.</p>
    </article>
  `;

  if (els.catalogGrid) els.catalogGrid.innerHTML = html;
  if (els.pageGrid) els.pageGrid.innerHTML = html;
  if (els.catalogCount) els.catalogCount.textContent = "0";
  if (els.pageCount) els.pageCount.textContent = "0";
  renderCategoryNav([]);
  showCatalogDetail();
  els.catalogTitle.textContent = "עדיין אין קטלוגים להצגה";
  els.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.";
  if (els.catalogMenuToggleText) els.catalogMenuToggleText.textContent = "אין קטלוגים";
  if (els.catalogMenu) els.catalogMenu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
  els.catalogCoverPreview?.removeAttribute("src");
  if (els.openViewerScrollFromTop) els.openViewerScrollFromTop.disabled = true;
  if (els.openViewerSingleFromTop) els.openViewerSingleFromTop.disabled = true;
}


const CATEGORY_NAV_MIN_BUTTON_SCALE = 0.68;
const CATEGORY_NAV_MIN_FONT_SIZE = 11;
const CATEGORY_NAV_MIN_BUTTON_HEIGHT = 30;
const CATEGORY_NAV_MIN_BUTTON_PADDING_X = 5;
const CATEGORY_NAV_MIN_GAP = 3;

function readPixelValue(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value || ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function categoryNavLinkLabel(link) {
  return String(link?.dataset?.categoryLabel || link?.textContent || "").trim();
}

function setCategoryNavLinkTooltip(link, text) {
  if (!link) return;
  setTooltipText(link, text || "", { updateDefault: true });
  link.removeAttribute("title");
}

function syncCategoryNavOverflowTooltips(links, enabled = true) {
  links.forEach((link) => {
    if (!enabled) {
      setCategoryNavLinkTooltip(link, "");
      return;
    }

    const isTextClipped = link.scrollWidth > link.clientWidth + 1;
    setCategoryNavLinkTooltip(link, isTextClipped ? categoryNavLinkLabel(link) : "");
  });
}

function clearCategoryNavFit(header, links = []) {
  if (!header) return;
  header.classList.remove("is-top-nav-compressed", "is-top-nav-tight", "is-top-nav-ellipsized");
  header.style.removeProperty("--top-nav-gap");
  header.style.removeProperty("--top-nav-button-min-height");
  header.style.removeProperty("--top-nav-button-padding-x");
  header.style.removeProperty("--top-nav-button-font-size");
  syncCategoryNavOverflowTooltips(links, false);
}

function readCategoryNavBaseMetrics(nav, firstLink) {
  const navStyle = window.getComputedStyle(nav);
  const linkStyle = window.getComputedStyle(firstLink);
  const paddingStart = readPixelValue(linkStyle.paddingInlineStart, 16);
  const paddingEnd = readPixelValue(linkStyle.paddingInlineEnd, paddingStart);

  return {
    gap: readPixelValue(navStyle.columnGap, 8),
    minHeight: readPixelValue(linkStyle.minHeight, 42),
    paddingX: Math.max(paddingStart, paddingEnd),
    fontSize: readPixelValue(linkStyle.fontSize, 16)
  };
}

function categoryNavRequiredWidth(nav, links) {
  if (!links.length) return 0;
  const gap = readPixelValue(window.getComputedStyle(nav).columnGap, 0);
  const linkWidth = links.reduce((sum, link) => sum + Math.ceil(link.scrollWidth), 0);
  return linkWidth + (gap * Math.max(0, links.length - 1));
}

function applyCategoryNavScale(header, metrics, scale) {
  const safeScale = Math.max(CATEGORY_NAV_MIN_BUTTON_SCALE, Math.min(1, scale));
  header.classList.add("is-top-nav-compressed");
  header.style.setProperty("--top-nav-gap", `${Math.max(CATEGORY_NAV_MIN_GAP, metrics.gap * safeScale).toFixed(2)}px`);
  header.style.setProperty("--top-nav-button-min-height", `${Math.max(CATEGORY_NAV_MIN_BUTTON_HEIGHT, metrics.minHeight * safeScale).toFixed(2)}px`);
  header.style.setProperty("--top-nav-button-padding-x", `${Math.max(CATEGORY_NAV_MIN_BUTTON_PADDING_X, metrics.paddingX * safeScale).toFixed(2)}px`);
  header.style.setProperty("--top-nav-button-font-size", `${Math.max(CATEGORY_NAV_MIN_FONT_SIZE, metrics.fontSize * safeScale).toFixed(2)}px`);
  return safeScale;
}

function fitCategoryNavToSingleRow() {
  state.categoryNavFitRaf = 0;
  const nav = els.categoryNav;
  const header = nav?.closest?.(".site-header");
  if (!nav || !header) return;

  const links = Array.from(nav.querySelectorAll(".category-nav-link"));
  clearCategoryNavFit(header, links);
  if (!links.length) return;

  const firstLink = links[0];
  const metrics = readCategoryNavBaseMetrics(nav, firstLink);
  const requiredWidth = categoryNavRequiredWidth(nav, links);
  const availableWidth = nav.clientWidth;

  if (!availableWidth || requiredWidth <= availableWidth + 1) return;

  const normalScale = applyCategoryNavScale(header, metrics, availableWidth / requiredWidth);
  const stillOverflows = requiredWidth * normalScale > nav.clientWidth + 1 || nav.scrollWidth > nav.clientWidth + 1;
  if (!stillOverflows) {
    syncCategoryNavOverflowTooltips(links);
    return;
  }

  header.classList.add("is-top-nav-tight");
  const tightAvailableWidth = nav.clientWidth;
  applyCategoryNavScale(header, metrics, tightAvailableWidth / requiredWidth);

  if (requiredWidth * CATEGORY_NAV_MIN_BUTTON_SCALE > tightAvailableWidth + 1 || nav.scrollWidth > nav.clientWidth + 1) {
    header.classList.add("is-top-nav-ellipsized");
  }

  syncCategoryNavOverflowTooltips(links);
}

function scheduleCategoryNavFit() {
  if (!els.categoryNav) return;
  window.cancelAnimationFrame(state.categoryNavFitRaf);
  state.categoryNavFitRaf = window.requestAnimationFrame(fitCategoryNavToSingleRow);
}

function initCategoryNavFit() {
  if (!els.categoryNav) return;
  document.querySelectorAll('img[data-brand-logo="1"], img[data-wp-logo="1"]').forEach((image) => {
    image.addEventListener("load", scheduleCategoryNavFit);
  });
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleCategoryNavFit).catch(() => {});
  }
  scheduleCategoryNavFit();
}


function renderCategoryNav(groups = getCatalogCategoryGroups()) {
  if (!els.categoryNav) return;

  const links = groups.map((group, index) => {
    const targetId = categorySectionId(group.category, index);
    return `<a class="top-nav-link category-nav-link" href="#${escapeHtml(targetId)}" data-category-target="${escapeHtml(targetId)}" data-category-label="${escapeHtml(group.category)}">${escapeHtml(group.category)}</a>`;
  });

  els.categoryNav.innerHTML = links.join("");
  syncActiveCategoryNavLink();
  scheduleCategoryNavFit();
}

function decodeHashTargetId(hash = location.hash) {
  const rawHash = String(hash || "");
  if (!rawHash.startsWith("#")) return "";

  const rawId = rawHash.slice(1);
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

function isCatalogFocusSection(section) {
  return Boolean(section?.classList?.contains("catalog-category-section") || section?.classList?.contains("catalog-subcategory-section"));
}

function getCatalogCategorySectionById(id) {
  const section = id ? document.getElementById(id) : null;
  return isCatalogFocusSection(section) ? section : null;
}

function getCatalogCategorySectionFromHash(hash = location.hash) {
  return getCatalogCategorySectionById(decodeHashTargetId(hash));
}

function getCatalogCategoryFocusTargetId(section) {
  return section?.dataset?.categoryFocusTarget || section?.id || "";
}

function getCatalogFocusSections() {
  if (!els.catalogGrid) return [];
  return Array.from(els.catalogGrid.querySelectorAll(".catalog-category-section, .catalog-subcategory-section"));
}

function getCatalogCategorySectionsByTargetId(targetId) {
  const normalizedTargetId = String(targetId || "");
  if (!normalizedTargetId) return [];

  return getCatalogFocusSections()
    .filter((section) => {
      const focusTargetId = getCatalogCategoryFocusTargetId(section);
      const parentCategoryTargetId = section?.dataset?.parentCategoryTarget || "";
      return focusTargetId === normalizedTargetId
        || parentCategoryTargetId === normalizedTargetId
        || section.id === normalizedTargetId;
    });
}

function hasCatalogCategoryFocus(targetId) {
  return getCatalogCategorySectionsByTargetId(targetId)
    .some((section) => section.classList.contains("is-category-focus"));
}

function syncActiveCategoryNavLink(activeId = state.categoryFocusTargetId) {
  const normalizedActiveId = String(activeId || "");

  els.categoryNav?.querySelectorAll(".category-nav-link").forEach((link) => {
    const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });

  els.catalogGrid?.querySelectorAll(".catalog-subcategory-nav-link").forEach((link) => {
    const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function clearCatalogCategoryFocus(options = {}) {
  const { clearHash = false } = options;

  window.clearTimeout(state.categoryFocusTimer);
  state.categoryFocusTimer = 0;
  state.categoryFocusTargetId = "";
  getCatalogFocusSections().forEach((section) => {
    section.classList.remove("is-category-focus");
  });
  syncActiveCategoryNavLink("");

  const hashTargetId = decodeHashTargetId();
  if (clearHash && hashTargetId && getCatalogCategorySectionsByTargetId(hashTargetId).length && window.history?.replaceState) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  return true;
}

function markCatalogCategoryFocus(section, options = {}) {
  if (!section) return false;

  const { animate = true, targetId: requestedTargetId = "" } = options;
  const targetId = String(requestedTargetId || getCatalogCategoryFocusTargetId(section) || "");
  const targetSections = getCatalogCategorySectionsByTargetId(targetId);
  if (!targetId || !targetSections.length) return false;

  window.clearTimeout(state.categoryFocusTimer);
  state.categoryFocusTimer = 0;

  getCatalogFocusSections().forEach((activeSection) => {
    if (!targetSections.includes(activeSection)) activeSection.classList.remove("is-category-focus");
  });

  targetSections.forEach((targetSection) => targetSection.classList.remove("is-category-focus"));
  if (animate) {
    // Restart the pulse cleanly across every visible segment of the selected category or subcategory.
    void targetSections[0].offsetWidth;
  }
  targetSections.forEach((targetSection) => targetSection.classList.add("is-category-focus"));

  state.categoryFocusTargetId = targetId;
  syncActiveCategoryNavLink(targetId);
  return true;
}

function markCatalogCategoryFocusById(id, options = {}) {
  return markCatalogCategoryFocus(getCatalogCategorySectionById(id), { ...options, targetId: id });
}

function handleCatalogFocusLinkClick(link, event) {
  const targetId = link?.dataset?.categoryTarget || decodeHashTargetId(link?.hash);
  if (!targetId) return;

  if (state.categoryFocusTargetId === targetId && hasCatalogCategoryFocus(targetId)) {
    event.preventDefault();
    clearCatalogCategoryFocus({ clearHash: true });
    return;
  }

  window.setTimeout(() => markCatalogCategoryFocusById(targetId), 80);
}

function syncCatalogCategoryFocusFromHash(options = {}) {
  const targetId = decodeHashTargetId();
  const section = getCatalogCategorySectionById(targetId);
  if (!section) {
    clearCatalogCategoryFocus();
    return false;
  }

  const { scroll = false } = options;
  if (scroll) section.scrollIntoView({ behavior: "smooth", block: "start" });
  return markCatalogCategoryFocus(section, { ...options, targetId });
}


function catalogLayoutColumnCount() {
  if (typeof window === "undefined" || !window.matchMedia) return 3;
  if (window.matchMedia("(max-width: 760px)").matches) return 1;
  if (window.matchMedia("(max-width: 1180px)").matches) return 2;
  return 3;
}

function clampCategorySpan(value, columns) {
  return Math.min(columns, Math.max(1, Number(value || 1)));
}

function catalogSubcategorySourceBlocks(source) {
  const sourceBlocks = [];

  if (Array.isArray(source?.directItems) && source.directItems.length) {
    sourceBlocks.push({
      blockKey: "__direct__",
      blockIndex: -1,
      label: "קטלוגים כלליים",
      isDirect: true,
      items: source.directItems
    });
  }

  (Array.isArray(source?.subcategories) ? source.subcategories : []).forEach((group, index) => {
    const subcategory = String(group?.subcategory || "").trim();
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!subcategory || !items.length) return;

    sourceBlocks.push({
      blockKey: subcategory,
      blockIndex: index,
      label: subcategory,
      isDirect: false,
      items
    });
  });

  return sourceBlocks;
}

function catalogCategorySegments(groups, columns = catalogLayoutColumnCount()) {
  const safeColumns = clampCategorySpan(columns, 3);
  const segments = [];
  let occupied = 0;

  const appendCardBlockSegments = (group, groupIndex, block, options = {}) => {
    const items = Array.isArray(block?.items) ? block.items : [];
    if (!items.length) return;

    const segmentType = options.segmentType || "category";
    const layoutBlockKey = options.layoutBlockKey || `${segmentType}:${groupIndex}:${block?.blockKey || "main"}`;
    let itemOffset = 0;
    let segmentIndex = 0;

    while (itemOffset < items.length) {
      if (occupied >= safeColumns) occupied = 0;
      const availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns;
      const span = Math.min(availableInRow, items.length - itemOffset, safeColumns);

      const segment = {
        category: group.category,
        groupIndex,
        segmentIndex,
        itemOffset,
        span,
        items: items.slice(itemOffset, itemOffset + span),
        hasSubcategories: Boolean(options.hasSubcategories),
        segmentType,
        layoutBlockKey,
        inlineDivider: false
      };

      if (segmentType === "subcategory") {
        Object.assign(segment, {
          blockKey: block.blockKey,
          blockIndex: block.blockIndex,
          blockOrder: options.blockOrder,
          label: block.label,
          isDirect: Boolean(block.isDirect)
        });
      }

      segments.push(segment);
      itemOffset += span;
      segmentIndex += 1;
      occupied += span;
      if (occupied >= safeColumns) occupied = 0;
    }
  };

  groups.forEach((group, groupIndex) => {
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!items.length) return;

    if (group?.hasSubcategories) {
      if (occupied > 0) occupied = 0;

      segments.push({
        category: group.category,
        groupIndex,
        segmentIndex: 0,
        itemOffset: 0,
        span: safeColumns,
        items: [],
        directItems: Array.isArray(group.directItems) ? group.directItems : [],
        subcategories: Array.isArray(group.subcategories) ? group.subcategories : [],
        hasSubcategories: true,
        segmentType: "categoryHeader",
        layoutBlockKey: `category-header:${groupIndex}`,
        inlineDivider: false
      });
      occupied = 0;

      catalogSubcategorySourceBlocks(group).forEach((block, blockOrder) => {
        appendCardBlockSegments(group, groupIndex, block, {
          segmentType: "subcategory",
          hasSubcategories: true,
          blockOrder,
          layoutBlockKey: `subcategory:${groupIndex}:${block.blockKey}:${blockOrder}`
        });
      });
      return;
    }

    appendCardBlockSegments(group, groupIndex, { blockKey: "__category__", items }, {
      segmentType: "category",
      hasSubcategories: false,
      layoutBlockKey: `category:${groupIndex}`
    });
  });

  occupied = 0;
  segments.forEach((segment, index) => {
    const span = clampCategorySpan(segment.span, safeColumns);
    if (occupied + span > safeColumns) occupied = 0;

    const rowEnd = occupied + span;
    const nextSegment = segments[index + 1];
    const nextSpan = nextSegment ? clampCategorySpan(nextSegment.span, safeColumns) : 0;
    const sameLayoutBlock = Boolean(nextSegment && nextSegment.layoutBlockKey === segment.layoutBlockKey);
    segment.inlineDivider = Boolean(
      nextSegment
      && !sameLayoutBlock
      && segment.segmentType !== "categoryHeader"
      && nextSegment.segmentType !== "categoryHeader"
      && rowEnd < safeColumns
      && nextSpan <= safeColumns - rowEnd
    );

    occupied = rowEnd >= safeColumns ? 0 : rowEnd;
  });

  return segments;
}

function scheduleCatalogLayoutRefresh() {
  if (!catalogs.length) return;
  window.clearTimeout(state.catalogLayoutResizeTimer);
  state.catalogLayoutResizeTimer = window.setTimeout(() => {
    const nextColumns = catalogLayoutColumnCount();
    if (nextColumns !== state.catalogLayoutColumns) renderCatalogCards();
  }, 120);
}

function renderCatalogCard(catalog) {
  const cover = coverThumbSrc(catalog);
  const safeCatalogId = escapeHtml(catalog.id);
  const safeTitle = escapeHtml(catalog.title);
  return `
    <article class="catalog-card">
      <div class="catalog-cover-frame catalog-image-frame catalog-cover-card-picker" role="group" tabindex="0" data-open-catalog-cover="${safeCatalogId}" aria-label="פתיחת ${safeTitle} בתצוגה לצדדים">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${safeTitle}" loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(cover)} />
        <div class="catalog-cover-card-mode-actions" role="group" aria-label="בחירת אופן צפייה">
          <button class="catalog-cover-card-mode-button" type="button" data-open-catalog-viewer-mode="scroll" data-open-catalog-viewer="${safeCatalogId}" aria-label="פתיחת ${safeTitle} בתצוגת גלילה">תצוגת גלילה</button>
          <button class="catalog-cover-card-mode-button" type="button" data-open-catalog-viewer-mode="single" data-open-catalog-viewer="${safeCatalogId}" aria-label="פתיחת ${safeTitle} בתצוגה לצדדים">תצוגה לצדדים</button>
        </div>
      </div>
      <div class="catalog-body">
        <h3>${escapeHtml(catalog.title)}</h3>
        <p>${escapeHtml(catalog.description || "")}</p>
        <div class="catalog-actions">
          <button class="button soft" type="button" data-open-catalog="${escapeHtml(catalog.id)}">צפייה בקטלוג</button>
          <button class="button primary" type="button" data-enter-catalog="${escapeHtml(catalog.id)}">כניסה לקטלוג</button>
        </div>
      </div>
    </article>
  `;
}

function renderCatalogSubcategoryNav(segment) {
  if (!segment?.hasSubcategories || !Array.isArray(segment.subcategories) || !segment.subcategories.length) return "";

  const buttons = segment.subcategories.map((group, index) => {
    const targetId = subcategorySectionId(segment.category, segment.groupIndex, group.subcategory, index);
    return `<a class="catalog-subcategory-nav-link" href="#${escapeHtml(targetId)}" data-category-target="${escapeHtml(targetId)}">${escapeHtml(group.subcategory)}</a>`;
  }).join("");

  return `
    <nav class="catalog-subcategory-nav" aria-label="ניווט תתי קטגוריות עבור ${escapeHtml(segment.category)}">
      ${buttons}
    </nav>
  `;
}

function catalogSubcategoryLayoutSegments(segment, columns = catalogLayoutColumnCount()) {
  const safeColumns = clampCategorySpan(columns, 3);
  const sourceBlocks = [];

  if (Array.isArray(segment.directItems) && segment.directItems.length) {
    sourceBlocks.push({
      blockKey: "__direct__",
      blockIndex: -1,
      label: "קטלוגים כלליים",
      isDirect: true,
      items: segment.directItems
    });
  }

  (Array.isArray(segment.subcategories) ? segment.subcategories : []).forEach((group, index) => {
    const subcategory = String(group?.subcategory || "").trim();
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!subcategory || !items.length) return;

    sourceBlocks.push({
      blockKey: subcategory,
      blockIndex: index,
      label: subcategory,
      isDirect: false,
      items
    });
  });

  const layoutSegments = [];
  let occupied = 0;

  sourceBlocks.forEach((block, blockOrder) => {
    let itemOffset = 0;
    let segmentIndex = 0;

    while (itemOffset < block.items.length) {
      if (occupied >= safeColumns) occupied = 0;
      const availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns;
      const span = Math.min(availableInRow, block.items.length - itemOffset, safeColumns);

      layoutSegments.push({
        ...block,
        blockOrder,
        segmentIndex,
        itemOffset,
        span,
        items: block.items.slice(itemOffset, itemOffset + span),
        inlineDivider: false
      });

      itemOffset += span;
      segmentIndex += 1;
      occupied += span;
      if (occupied >= safeColumns) occupied = 0;
    }
  });

  occupied = 0;
  layoutSegments.forEach((block, index) => {
    const span = clampCategorySpan(block.span, safeColumns);
    if (occupied + span > safeColumns) occupied = 0;

    const rowEnd = occupied + span;
    const nextBlock = layoutSegments[index + 1];
    const nextSpan = nextBlock ? clampCategorySpan(nextBlock.span, safeColumns) : 0;
    block.inlineDivider = Boolean(
      nextBlock
      && nextBlock.blockOrder !== block.blockOrder
      && rowEnd < safeColumns
      && nextSpan <= safeColumns - rowEnd
    );

    occupied = rowEnd >= safeColumns ? 0 : rowEnd;
  });

  return layoutSegments;
}

function catalogSubcategoryBlockBaseId(segment, block, baseSectionId) {
  if (block?.isDirect) return `${baseSectionId}-general`;
  return subcategorySectionId(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0);
}

function renderCatalogSubcategoryBlock(segment, block, options = {}) {
  const { baseSectionId = "" } = options;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) return "";

  const blockBaseId = catalogSubcategoryBlockBaseId(segment, block, baseSectionId);
  const sectionId = block.segmentIndex === 0 ? blockBaseId : `${blockBaseId}-part-${block.segmentIndex + 1}`;
  const titleId = `${sectionId}-title`;
  const title = String(block?.label || "").trim() || "קטלוגים";
  const sectionStyle = `--subcategory-span: ${clampCategorySpan(block.span, 3)};`;

  return `
    <section class="catalog-subcategory-section" id="${escapeHtml(sectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(blockBaseId)}" data-parent-category-target="${escapeHtml(baseSectionId)}" data-subcategory-span="${escapeHtml(String(block.span))}" data-inline-divider="${block.inlineDivider ? "1" : "0"}" data-subcategory-continuation="${block.itemOffset > 0 ? "1" : "0"}">
      <div class="catalog-category-head catalog-subcategory-head">
        <h4 id="${escapeHtml(titleId)}">${escapeHtml(title)}</h4>
      </div>
      <div class="catalog-grid catalog-category-grid catalog-subcategory-grid">
        ${items.map(renderCatalogCard).join("")}
      </div>
    </section>
  `;
}

function renderCatalogCategoryHeaderSegment(segment, columns) {
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const titleId = `${baseSectionId}-title`;
  const safeColumns = clampCategorySpan(columns, 3);
  const sectionStyle = `--category-span: ${safeColumns}; --subcategory-layout-columns: ${safeColumns};`;

  return `
    <section class="catalog-category-section catalog-category-section-with-subcategories catalog-category-section-header-only" id="${escapeHtml(baseSectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(baseSectionId)}" data-category-span="${escapeHtml(String(safeColumns))}" data-inline-divider="0" data-category-continuation="0">
      <div class="catalog-category-head catalog-category-head-with-subcategories">
        <h3 id="${escapeHtml(titleId)}">${escapeHtml(segment.category)}</h3>
        ${renderCatalogSubcategoryNav(segment)}
      </div>
    </section>
  `;
}

function renderCatalogCategorySegment(segment, columns) {
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const safeColumns = clampCategorySpan(columns, 3);

  if (segment.segmentType === "categoryHeader") {
    return renderCatalogCategoryHeaderSegment(segment, safeColumns);
  }

  if (segment.segmentType === "subcategory") {
    return renderCatalogSubcategoryBlock(segment, segment, { baseSectionId });
  }

  const sectionId = segment.itemOffset === 0 ? baseSectionId : `${baseSectionId}-part-${segment.segmentIndex + 1}`;
  const titleId = `${sectionId}-title`;
  const sectionStyle = `--category-span: ${segment.span}; --subcategory-layout-columns: ${safeColumns};`;

  return `
    <section class="catalog-category-section" id="${escapeHtml(sectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(baseSectionId)}" data-category-span="${escapeHtml(String(segment.span))}" data-inline-divider="${segment.inlineDivider ? "1" : "0"}" data-category-continuation="${segment.itemOffset > 0 ? "1" : "0"}">
      <div class="catalog-category-head">
        <h3 id="${escapeHtml(titleId)}">${escapeHtml(segment.category)}</h3>
      </div>
      <div class="catalog-grid catalog-category-grid">
        ${segment.items.map(renderCatalogCard).join("")}
      </div>
    </section>
  `;
}

function openCatalogCardViewer(catalogId, mode = "single") {
  if (!catalogId) return;
  openCatalogInViewer(catalogId, 1, mode === "scroll" ? "scroll" : "single");
}

function bindCatalogCardEvents() {
  if (!els.catalogGrid) return;

  els.catalogGrid.querySelectorAll("[data-open-catalog-cover]").forEach((cover) => {
    cover.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-open-catalog-viewer]")) return;
      openCatalogCardViewer(cover.dataset.openCatalogCover, "single");
    });

    cover.addEventListener("keydown", (event) => {
      if (event.target.closest?.("[data-open-catalog-viewer]")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCatalogCardViewer(cover.dataset.openCatalogCover, "single");
    });
  });

  els.catalogGrid.querySelectorAll("[data-open-catalog-viewer]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const mode = button.dataset.openCatalogViewerMode === "scroll" ? "scroll" : "single";
      openCatalogCardViewer(button.dataset.openCatalogViewer, mode);
    });
  });

  els.catalogGrid.querySelectorAll("[data-open-catalog]").forEach((button) => {
    button.addEventListener("click", () => openCatalog(button.dataset.openCatalog, { scroll: true }));
  });

  els.catalogGrid.querySelectorAll("[data-enter-catalog]").forEach((button) => {
    button.addEventListener("click", () => openCatalogPage(button.dataset.enterCatalog));
  });
}

function renderCatalogCards() {
  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  const groups = getCatalogCategoryGroups();
  const totalPages = catalogs.reduce((sum, item) => sum + Number(item.pages || 0), 0);
  if (els.catalogCount) els.catalogCount.textContent = String(catalogs.length);
  if (els.pageCount) els.pageCount.textContent = String(totalPages);
  renderCategoryNav(groups);

  const columns = catalogLayoutColumnCount();
  state.catalogLayoutColumns = columns;
  const categorySegments = catalogCategorySegments(groups, columns);

  els.catalogGrid.style.setProperty("--catalog-layout-columns", String(columns));
  els.catalogGrid.innerHTML = categorySegments.map((segment) => renderCatalogCategorySegment(segment, columns)).join("");

  bindCatalogCardEvents();
  syncCatalogCategoryFocusFromHash({ animate: false });
}


function getGlobalSearchCategories() {
  return getCatalogCategoryGroups()
    .filter((group) => String(group.category || "").trim() && Array.isArray(group.items) && group.items.length)
    .map((group) => ({
      category: group.category,
      catalogs: group.items.length,
      indexedPages: catalogSearch?.indexedPageCount?.({ category: group.category }) || 0
    }));
}

function hasGlobalSearchCategory(category) {
  const requestedCategory = String(category || "").trim();
  if (!requestedCategory) return false;
  return getCatalogCategoryGroups().some((group) => group.category === requestedCategory);
}

function getGlobalSearchCategory() {
  const selectedCategory = String(state.globalSearchCategory || "").trim();
  if (!selectedCategory) return "";
  return hasGlobalSearchCategory(selectedCategory) ? selectedCategory : "";
}

function globalSearchScopeLabel(category = getGlobalSearchCategory()) {
  return category ? category : "בכל הקטלוגים";
}

function globalSearchPlaceholder() {
  const category = getGlobalSearchCategory();
  return category
    ? `חיפוש דגם בקטגוריית ${category}...`
    : "הקלד דגם, מספר, שם מוצר או מילה מהקטלוג...";
}

function closeGlobalSearchScopeMenu() {
  els.globalSearchScopeMenu?.classList.add("hidden");
  els.globalSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function renderGlobalSearchScopeMenu() {
  if (!els.globalSearchScopeMenu) return;

  const categories = getGlobalSearchCategories();
  els.globalSearchScopeMenu.innerHTML = `
    <button type="button" role="menuitemradio" aria-checked="true" data-global-search-category="">
      <strong>בכל הקטלוגים</strong>
      <small>${escapeHtml(catalogs.length)} קטלוגים</small>
    </button>
    ${categories.map((group) => `
      <button type="button" role="menuitemradio" aria-checked="false" data-global-search-category="${escapeHtml(group.category)}">
        <strong>${escapeHtml(group.category)}</strong>
        <small>${escapeHtml(group.catalogs)} קטלוגים${group.indexedPages ? ` · ${escapeHtml(group.indexedPages)} עמודים` : ""}</small>
      </button>
    `).join("")}
  `;
  syncGlobalSearchScopeUi();
}

function syncGlobalSearchScopeUi() {
  const category = getGlobalSearchCategory();
  if (els.globalSearchScopeToggle) {
    els.globalSearchScopeToggle.innerHTML = `${escapeHtml(globalSearchScopeLabel(category))} <span aria-hidden="true">⌄</span>`;
    els.globalSearchScopeToggle.title = category ? `חיפוש רק בקטגוריית ${category}` : "חיפוש בכל הקטלוגים";
  }
  if (els.globalSearchInput) {
    els.globalSearchInput.placeholder = globalSearchPlaceholder();
    els.globalSearchInput.setAttribute("aria-label", globalSearchPlaceholder());
  }
  els.globalSearchScopeMenu?.querySelectorAll("[data-global-search-category]").forEach((button) => {
    const selected = String(button.dataset.globalSearchCategory || "") === category;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setGlobalSearchCategory(category, options = {}) {
  const requestedCategory = String(category || "").trim();
  const nextCategory = requestedCategory && hasGlobalSearchCategory(requestedCategory)
    ? requestedCategory
    : "";

  if (state.globalSearchCategory === nextCategory) {
    syncGlobalSearchScopeUi();
    closeGlobalSearchScopeMenu();
    return;
  }

  state.globalSearchCategory = nextCategory;
  syncGlobalSearchScopeUi();
  closeGlobalSearchScopeMenu();
  initSearchStatus();

  if (options.render !== false && els.globalSearchInput) {
    renderSearchResults(els.globalSearchInput.value);
  }
}

function initSearchStatus() {
  syncGlobalSearchScopeUi();
}

function getLightboxSearchScope() {
  return state.lightboxSearchScope === "all" ? "all" : "catalog";
}

function lightboxSearchScopeLabel(scope = getLightboxSearchScope()) {
  return scope === "all" ? "בכל הקטלוגים" : "בקטלוג הזה";
}

function lightboxSearchPlaceholder() {
  if (getLightboxSearchScope() === "all") return "חיפוש דגם בכל הקטלוגים...";
  const title = String(state.catalog?.title || "").trim();
  return title ? `חיפוש דגם בקטלוג הזה: ${title}` : "חיפוש דגם בקטלוג הזה...";
}

function closeLightboxSearchScopeMenu() {
  els.lightboxSearchScopeMenu?.classList.add("hidden");
  els.lightboxSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function closeLightboxCatalogMenu() {
  els.lightboxCatalogMenu?.classList.add("hidden");
  els.lightboxCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function closeDetailCatalogMenu() {
  els.catalogMenu?.classList.add("hidden");
  els.catalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function syncLightboxSearchScopeUi() {
  const scope = getLightboxSearchScope();
  if (els.lightboxSearchScopeToggle) {
    els.lightboxSearchScopeToggle.innerHTML = `${escapeHtml(lightboxSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`;
  }
  if (els.lightboxSearchInput) {
    els.lightboxSearchInput.placeholder = lightboxSearchPlaceholder();
    els.lightboxSearchInput.setAttribute("aria-label", lightboxSearchPlaceholder());
  }
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    const selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setLightboxSearchScope(scope, options = {}) {
  const nextScope = scope === "all" ? "all" : "catalog";
  if (state.lightboxSearchScope === nextScope) {
    syncLightboxSearchScopeUi();
    closeLightboxSearchScopeMenu();
    return;
  }

  state.lightboxSearchScope = nextScope;
  syncLightboxSearchScopeUi();
  closeLightboxSearchScopeMenu();
  initLightboxSearchStatus();

  if (options.render !== false && els.lightboxSearchInput) {
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  }
}

function hideLightboxSearchResults(options = {}) {
  const { blurTopUiFocus = false, hideTopUi = false } = options;

  hideSearchFloatingPreview();
  els.lightboxSearchResults?.classList.add("hidden");
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();

  if (blurTopUiFocus) {
    const activeElement = document.activeElement;
    if (activeElement && els.lightboxBar?.contains(activeElement) && typeof activeElement.blur === "function") {
      activeElement.blur();
    }
  }

  if (hideTopUi) {
    window.clearTimeout(state.uiHideTimer);
    els.lightbox?.classList.remove("show-ui");
  }
}

function resetLightboxSearch() {
  if (els.lightboxSearchInput) els.lightboxSearchInput.value = "";
  hideLightboxSearchResults({ blurTopUiFocus: true });
  if (els.lightboxSearchResults) els.lightboxSearchResults.innerHTML = "";
  els.lightboxSearchClear?.classList.add("hidden");
  syncLightboxSearchScopeUi();
  initLightboxSearchStatus();
}

function getLightboxSearchResults(query, limit = 24) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.()) return [];

  const options = { limit, includeExcerpt: false };
  if (getLightboxSearchScope() !== "all") {
    if (!state.catalog) return [];
    options.catalogId = state.catalog.id;
  }

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function openLightboxSearchResult(result) {
  if (!result) return false;

  const targetCatalogId = result.catalogId || state.catalog?.id;
  if (!targetCatalogId) return false;

  if (!state.catalog || state.catalog.id !== targetCatalogId) {
    openCatalogInViewer(targetCatalogId, Number(result.page), state.viewerMode);
    return true;
  }

  const page = clampPage(result.page, state.catalog);
  setLightboxPage(page, { smooth: true, hit: state.viewerMode === "scroll" });
  showTopUiTemporarily(0);
  hideLightboxSearchResults();
  return true;
}

function submitLightboxSearch() {
  const rawQuery = String(els.lightboxSearchInput?.value || "").trim();
  renderLightboxSearchResults(rawQuery);
  const firstResult = getLightboxSearchResults(rawQuery, 1)[0];
  return openLightboxSearchResult(firstResult);
}

function initLightboxSearchStatus() {
  if (!els.lightboxSearchStatus) return;

  const hasCatalog = Boolean(state.catalog);
  const hasIndex = Boolean(catalogSearch?.hasIndex?.());
  if (els.lightboxSearchInput) els.lightboxSearchInput.disabled = !hasCatalog || !hasIndex;
  syncLightboxSearchScopeUi();

  if (!hasCatalog) {
    els.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }

  if (!hasIndex) {
    els.lightboxSearchStatus.textContent = "אין אינדקס OCR זמין לחיפוש.";
    return;
  }

  els.lightboxSearchStatus.textContent = getLightboxSearchScope() === "all"
    ? "הקלד לפחות 2 תווים לחיפוש בכל הקטלוגים."
    : "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
}

function hideSearchFloatingPreview() {
  els.searchFloatingPreview?.classList.remove("visible");
}

function searchPreviewPageLabel(target) {
  return String(target?.dataset?.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
}

function positionSearchFloatingPreview(target) {
  const preview = els.searchFloatingPreview;
  if (!preview || !target) return;

  const targetRect = target.getBoundingClientRect();
  const gap = 16;
  const safeMargin = 12;
  const fallbackWidth = Math.min(430, Math.max(260, window.innerWidth * 0.34));
  const previewWidth = Math.max(240, preview.offsetWidth || fallbackWidth);
  const fallbackHeight = Math.min(620, Math.max(280, window.innerHeight * 0.64));
  const previewHeight = Math.max(240, preview.offsetHeight || fallbackHeight);

  let left;
  if (targetRect.left - gap - previewWidth >= safeMargin) {
    left = targetRect.left - gap - previewWidth;
  } else if (targetRect.right + gap + previewWidth <= window.innerWidth - safeMargin) {
    left = targetRect.right + gap;
  } else {
    left = targetRect.left + (targetRect.width / 2) - (previewWidth / 2);
  }

  const top = targetRect.top + (targetRect.height / 2) - (previewHeight / 2);
  preview.style.left = `${clampValue(left, safeMargin, Math.max(safeMargin, window.innerWidth - previewWidth - safeMargin))}px`;
  preview.style.top = `${clampValue(top, safeMargin, Math.max(safeMargin, window.innerHeight - previewHeight - safeMargin))}px`;
}

function showSearchFloatingPreview(target) {
  if (!target || !els.searchFloatingPreview || !els.searchFloatingPreviewImage) return;

  const src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;

  const label = searchPreviewPageLabel(target);
  els.searchFloatingPreviewImage.onload = () => positionSearchFloatingPreview(target);
  setCatalogImageSource(els.searchFloatingPreviewImage, src);
  els.searchFloatingPreviewImage.alt = label;
  if (els.searchFloatingPreviewPage) els.searchFloatingPreviewPage.textContent = label;

  els.searchFloatingPreview.classList.add("visible");
  positionSearchFloatingPreview(target);
}

function bindSearchFloatingPreviewEvents(container) {
  if (!container) return;

  container.querySelectorAll("[data-search-preview-src]").forEach((target) => {
    target.addEventListener("pointerenter", (event) => {
      if (!hasHoverPointer() || isTouchLikePointer(event)) return;
      showSearchFloatingPreview(target);
    });
    target.addEventListener("pointermove", (event) => {
      if (!hasHoverPointer() || isTouchLikePointer(event)) return;
      positionSearchFloatingPreview(target);
    });
    target.addEventListener("pointerleave", hideSearchFloatingPreview);
    target.addEventListener("focus", () => showSearchFloatingPreview(target));
    target.addEventListener("blur", hideSearchFloatingPreview);
  });
}

function updateLightboxSearchResultsLayout(count = 0) {
  if (!els.lightboxSearchResults) return;

  const resultCount = Math.max(0, Number(count) || 0);
  const columns = Math.max(1, Math.min(resultCount || 1, 3));
  els.lightboxSearchResults.style.setProperty("--reader-search-result-columns", String(columns));
  els.lightboxSearchResults.dataset.resultCount = String(resultCount);
}

function renderLightboxSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.lightboxSearchResults || !els.lightboxSearchStatus) return;

  hideSearchFloatingPreview();
  updateLightboxSearchResultsLayout(0);
  els.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    initLightboxSearchStatus();
    return;
  }

  if (!state.catalog || !catalogSearch?.hasIndex?.()) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    els.lightboxSearchStatus.textContent = "אין אינדקס חיפוש פעיל לקטלוג הזה.";
    return;
  }

  const scope = getLightboxSearchScope();
  const results = getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  updateLightboxSearchResultsLayout(results.length);
  els.lightboxSearchResults.classList.remove("hidden");

  if (!results.length) {
    els.lightboxSearchStatus.textContent = scope === "all"
      ? "לא נמצאו תוצאות בכל הקטלוגים."
      : "לא נמצאו תוצאות בקטלוג הפתוח.";
    els.lightboxSearchResults.innerHTML = `
      <article class="reader-search-empty lightbox-search-empty">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(rawQuery)}”</strong>
        <span>נסה חלק קצר יותר של הדגם או מילה אחרת.</span>
      </article>
    `;
    return;
  }

  els.lightboxSearchStatus.textContent = scope === "all"
    ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.`
    : `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
  els.lightboxSearchResults.innerHTML = results.map((result) => {
    const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || state.catalog;
    const page = clampPage(result.page, catalog);
    const rawPreview = result.image || pageSrc(catalog, page);
    const rawThumb = result.thumb || thumbSrc(catalog, page);
    const rawImage = rawPreview || rawThumb;
    const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
    return `
      <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
        <span class="reader-search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
        <span class="reader-search-thumb-frame catalog-image-frame">
          <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
        </span>
      </button>
    `;
  }).join("");

  bindSearchFloatingPreviewEvents(els.lightboxSearchResults);

  els.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]").forEach((button) => {
    button.addEventListener("click", () => {
      hideSearchFloatingPreview();
      openLightboxSearchResult({
        catalogId: button.dataset.lightboxSearchCatalog,
        page: button.dataset.lightboxSearchPage
      });
    });
  });
}

function renderCatalogCategoryMenu(menu, { activeCatalogId = state.catalog?.id } = {}) {
  if (!menu) return;

  if (!catalogs.length) {
    menu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
    return;
  }

  const groups = getCatalogCategoryGroups();
  menu.innerHTML = groups.map((group) => `
    <section class="reader-catalog-menu-section">
      <div class="reader-catalog-menu-category">${escapeHtml(group.category)}</div>
      <div class="reader-catalog-menu-items">
        ${group.items.map((catalog) => `
          <button class="reader-catalog-menu-item${activeCatalogId === catalog.id ? " active" : ""}" type="button" role="menuitem" data-catalog-menu-id="${escapeHtml(catalog.id)}"${activeCatalogId === catalog.id ? ' aria-current="true"' : ""}>
            <strong>${escapeHtml(catalog.title)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderLightboxCatalogMenu() {
  if (!els.lightboxCatalogMenu) return;

  renderCatalogCategoryMenu(els.lightboxCatalogMenu);

  els.lightboxCatalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeLightboxCatalogMenu();
      if (!catalogId || catalogId === state.catalog?.id) return;
      openCatalogInViewer(catalogId, 1, state.viewerMode);
    });
  });
}

function updateDetailCatalogMenuLabel(catalog = state.catalog) {
  if (!els.catalogMenuToggleText) return;
  els.catalogMenuToggleText.textContent = catalog?.title || "בחר קטלוג";
}

function renderDetailCatalogMenu() {
  if (!els.catalogMenu) return;

  renderCatalogCategoryMenu(els.catalogMenu);

  els.catalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeDetailCatalogMenu();
      if (!catalogId || catalogId === state.catalog?.id) return;
      openCatalog(catalogId);
    });
  });
}

function getGlobalSearchResults(query, limit = 72) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.({ category })) return [];

  const options = { limit, includeExcerpt: false };
  if (category) options.category = category;

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function openGlobalSearchResult(result) {
  if (!result) return false;
  hideSearchFloatingPreview();
  openCatalog(result.catalogId, { openPage: Number(result.page) });
  els.globalSearchResults?.classList.add("hidden");
  return true;
}

function submitGlobalSearch() {
  const rawQuery = String(els.globalSearchInput?.value || "").trim();
  renderSearchResults(rawQuery);
  const firstResult = getGlobalSearchResults(rawQuery, 1)[0];
  return openGlobalSearchResult(firstResult);
}

function renderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.globalSearchResults) return;

  hideSearchFloatingPreview();
  els.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    initSearchStatus();
    return;
  }

  const category = getGlobalSearchCategory();

  if (!catalogSearch?.hasIndex?.({ category })) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    return;
  }

  const results = getGlobalSearchResults(rawQuery, 72);
  if (!results.length) {
    els.globalSearchResults.classList.remove("hidden");
    els.globalSearchResults.innerHTML = `
      <article class="search-empty">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(rawQuery)}”</strong>
        <p>${category ? "נסה מספר דגם קצר יותר, חלק מהמילה, או חפש שוב בכל הקטלוגים." : "נסה מספר דגם קצר יותר, או חלק מהמילה"}</p>
      </article>
    `;
    return;
  }

  els.globalSearchResults.classList.remove("hidden");
  els.globalSearchResults.innerHTML = results.map((result) => {
    const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId);
    const page = clampPage(result.page, catalog);
    const rawThumb = result.thumb || (catalog ? thumbSrc(catalog, page) : "");
    const rawPreview = result.image || (catalog ? pageSrc(catalog, page) : rawThumb);
    const rawImage = rawPreview || rawThumb;
    const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
    return `
      <article class="search-result-card">
        <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
          <span class="search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
          <span class="search-result-thumb-frame catalog-image-frame">
            <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
          </span>
        </button>
      </article>
    `;
  }).join("");

  bindSearchFloatingPreviewEvents(els.globalSearchResults);

  els.globalSearchResults.querySelectorAll("[data-search-catalog]").forEach((button) => {
    button.addEventListener("click", () => {
      openGlobalSearchResult({ catalogId: button.dataset.searchCatalog, page: button.dataset.searchPage });
    });
  });
}

function fillCatalogSelect() {
  updateDetailCatalogMenuLabel();
}


function renderPageGrid() {
  if (!state.catalog) return;
  // Keep generated page cards visually stable during scroll.
  // Older versions attached scroll-time observers here for reveal animation
  // and thumb activation; that caused work exactly when a card entered view.

  const catalog = state.catalog;
  const cards = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    cards.push(`
      <article class="page-card">
        <button class="page-button" type="button" data-open-page="${page}">
          <div class="page-thumb-wrap">
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}" loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
            <span class="page-number-badge">${page}</span>
          </div>
          <div class="page-card-body">
            <span class="page-card-title">עמוד ${page}</span>
            <span class="page-card-hint">לחץ להגדלה</span>
          </div>
        </button>
      </article>
    `);
  }
  els.pageGrid.innerHTML = cards.join("");

  els.pageGrid.querySelectorAll("[data-open-page]").forEach((button) => {
    button.addEventListener("click", () => openLightbox(Number(button.dataset.openPage)));
  });
}

function showCatalogDetail() {
  if (!els.catalogDetail) return;
  els.catalogDetail.classList.remove("hidden");
  els.catalogDetail.classList.add("in-view");
}

function scrollCatalogDetailIntoView() {
  if (!els.catalogDetail) return;
  requestAnimationFrame(() => {
    els.catalogDetail.scrollIntoView({ behavior: "smooth", block: "start" });
    scheduleCatalogScrollTopButtonUpdate();
  });
}

function positionCatalogScrollTopButton() {
  if (!els.scrollToTopBtn || !els.pageGrid) return;

  const gridRect = els.pageGrid.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const buttonWidth = Math.max(els.scrollToTopBtn.offsetWidth || 46, 46);
  const safeInset = 12;
  const gapFromGrid = 12;
  const maxLeft = Math.max(safeInset, viewportWidth - buttonWidth - safeInset);
  const preferredLeft = gridRect.left - buttonWidth - gapFromGrid;
  const left = clampValue(preferredLeft, safeInset, maxLeft);

  els.scrollToTopBtn.style.setProperty("--catalog-scroll-top-left", `${Math.round(left)}px`);
}

function setCatalogScrollTopButtonVisible(visible) {
  if (!els.scrollToTopBtn) return;
  els.scrollToTopBtn.classList.toggle("is-visible", Boolean(visible));
  els.scrollToTopBtn.setAttribute("aria-hidden", visible ? "false" : "true");
  els.scrollToTopBtn.tabIndex = visible ? 0 : -1;
}

function updateCatalogScrollTopButton() {
  state.catalogScrollTopButtonRaf = 0;
  if (!els.scrollToTopBtn || !els.catalogDetail || !els.pageGrid || els.catalogDetail.classList.contains("hidden") || !state.catalog || state.lightboxOpen) {
    setCatalogScrollTopButtonVisible(false);
    return;
  }

  positionCatalogScrollTopButton();

  const detailRect = els.catalogDetail.getBoundingClientRect();
  const gridRect = els.pageGrid.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 90;
  const startedScrollingInsideGrid = gridRect.top < Math.min(headerHeight + 28, viewportHeight * 0.28);
  const stillNearGrid = gridRect.bottom > Math.min(180, viewportHeight * 0.35);
  const detailVisible = detailRect.bottom > 80 && detailRect.top < viewportHeight;
  setCatalogScrollTopButtonVisible(startedScrollingInsideGrid && stillNearGrid && detailVisible);
}

function scheduleCatalogScrollTopButtonUpdate() {
  if (state.catalogScrollTopButtonRaf) return;
  state.catalogScrollTopButtonRaf = requestAnimationFrame(updateCatalogScrollTopButton);
}

function renderCatalogDetail() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  showCatalogDetail();
  els.catalogTitle.textContent = catalog.title;
  els.catalogDescription.textContent = catalog.description || "";
  updateDetailCatalogMenuLabel(catalog);
  if (els.catalogCoverPreview) {
    setCatalogImageSource(els.catalogCoverPreview, catalogCoverSrc(catalog));
    els.catalogCoverPreview.loading = "lazy";
    els.catalogCoverPreview.decoding = "async";
    els.catalogCoverPreview.alt = `שער ${catalog.title}`;
  }
  if (els.openViewerScrollFromTop) els.openViewerScrollFromTop.disabled = catalog.pages < 1;
  if (els.openViewerSingleFromTop) els.openViewerSingleFromTop.disabled = catalog.pages < 1;
  if (els.catalogMenu && !els.catalogMenu.classList.contains("hidden")) renderDetailCatalogMenu();
  renderPageGrid();
  scheduleCatalogScrollTopButtonUpdate();
}

function preloadNeighbors() {
  if (!state.catalog || state.viewerMode !== "single") return;
  [state.page - 2, state.page - 1, state.page + 1, state.page + 2]
    .filter((page) => page >= 1 && page <= state.catalog.pages)
    .forEach((page) => {
      prepareCatalogImage(pageSrc(state.catalog, page), { priority: "low" }).catch(() => {});
    });
}

function updateHash() {
  if (!state.catalog) {
    history.replaceState(null, "", "#catalogs");
    return;
  }

  let hash = `#catalog/${state.catalog.id}`;
  if (state.lightboxOpen) {
    hash += `/page/${state.page}`;
    if (state.viewerMode === "scroll") hash += "/scroll";
  }
  history.replaceState(null, "", hash);
}

function getPointerList() {
  return Array.from(state.pointers.values());
}

function pointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampViewerZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_VIEWER_ZOOM;
  return clampValue(numeric, MIN_VIEWER_ZOOM, MAX_VIEWER_ZOOM);
}

function clampSinglePan() {
  const image = els.lightboxImage;
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !stage) return;

  const imageWidth = image.naturalWidth * state.fitScale * state.zoom;
  const imageHeight = image.naturalHeight * state.fitScale * state.zoom;
  const overflowX = Math.max(0, (imageWidth - stage.clientWidth) / 2);
  const overflowY = Math.max(0, (imageHeight - stage.clientHeight) / 2);

  if (overflowX <= 1) state.panX = 0;
  else state.panX = clampValue(state.panX, -overflowX, overflowX);

  if (overflowY <= 1) state.panY = 0;
  else state.panY = clampValue(state.panY, -overflowY, overflowY);
}

function getScrollZoomMetrics() {
  const container = els.lightboxScrollView;
  const content = els.lightboxScrollPages;
  if (!container || !content) return null;

  return {
    container,
    content,
    viewportWidth: container.clientWidth,
    viewportHeight: container.clientHeight,
    contentWidth: content.offsetWidth || content.scrollWidth || 0,
    contentHeight: content.offsetHeight || content.scrollHeight || 0,
    baseLeft: content.offsetLeft - container.scrollLeft,
    baseTop: content.offsetTop - container.scrollTop
  };
}

function clampScrollPan() {
  const metrics = getScrollZoomMetrics();
  if (!metrics || !metrics.contentWidth || !metrics.contentHeight) return;

  const scaledWidth = metrics.contentWidth * state.zoom;
  const scaledHeight = metrics.contentHeight * state.zoom;

  if (scaledWidth <= metrics.viewportWidth) {
    state.panX = -metrics.baseLeft + (metrics.viewportWidth - scaledWidth) / 2;
  } else {
    state.panX = clampValue(
      state.panX,
      metrics.viewportWidth - metrics.baseLeft - scaledWidth,
      -metrics.baseLeft
    );
  }

  if (scaledHeight <= metrics.viewportHeight) {
    state.panY = -metrics.baseTop + (metrics.viewportHeight - scaledHeight) / 2;
  } else {
    state.panY = clampValue(
      state.panY,
      metrics.viewportHeight - metrics.baseTop - scaledHeight,
      -metrics.baseTop
    );
  }
}

function resetImagePosition() {
  state.panX = 0;
  state.panY = 0;
}

function applySingleZoom() {
  const image = els.lightboxImage;
  const frame = els.lightboxImageFrame;
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !frame || !stage) return;

  const availableWidth = Math.max(260, stage.clientWidth - 18);
  const availableHeight = Math.max(260, stage.clientHeight - 18);
  state.fitScale = Math.min(
    availableWidth / image.naturalWidth,
    availableHeight / image.naturalHeight
  );

  const fitWidth = Math.max(220, Math.round(image.naturalWidth * state.fitScale));
  frame.style.width = `${fitWidth}px`;
  frame.style.height = "auto";
  image.style.width = "100%";
  image.style.height = "auto";

  if (state.zoom <= 1.001) resetImagePosition();
  clampSinglePan();
  frame.style.setProperty("--single-pan-x", `${state.panX}px`);
  frame.style.setProperty("--single-pan-y", `${state.panY}px`);
  frame.style.setProperty("--single-zoom", String(state.zoom));
  frame.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

function applyScrollZoom() {
  const content = els.lightboxScrollPages;
  if (!content) return;

  if (state.zoom <= 1.001) {
    resetImagePosition();
    content.style.transform = "";
    return;
  }

  clampScrollPan();
  content.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

function applyZoom() {
  if (state.viewerMode === "scroll") applyScrollZoom();
  else applySingleZoom();

  els.lightbox?.classList.toggle("is-zoomed", state.zoom > 1.01);
}

function showThumbsTemporarily(delay = 2600) {
  if (!els.lightbox) return;
  window.clearTimeout(state.thumbsHideTimer);
  els.lightbox.classList.add("show-thumbs");
  if (delay > 0) {
    state.thumbsHideTimer = window.setTimeout(() => {
      els.lightbox.classList.remove("show-thumbs");
    }, delay);
  }
}

function keepThumbsOpen() {
  window.clearTimeout(state.thumbsHideTimer);
  els.lightbox?.classList.add("show-thumbs");
}

function scheduleThumbsClose() {
  window.clearTimeout(state.thumbsHideTimer);
  state.thumbsHideTimer = window.setTimeout(() => {
    els.lightbox?.classList.remove("show-thumbs");
  }, 420);
}

function showTopUiTemporarily(delay = 2200) {
  if (!els.lightbox) return;
  window.clearTimeout(state.uiHideTimer);
  els.lightbox.classList.add("show-ui");
  if (delay > 0) {
    state.uiHideTimer = window.setTimeout(() => {
      els.lightbox.classList.remove("show-ui");
    }, delay);
  }
}

function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}

function isBrowserFullscreenActive() {
  return Boolean(getBrowserFullscreenElement());
}

function isBrowserFullscreenSupported() {
  const root = document.documentElement;
  return Boolean(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled ||
    root?.requestFullscreen ||
    root?.webkitRequestFullscreen ||
    root?.mozRequestFullScreen ||
    root?.msRequestFullscreen
  );
}

function requestBrowserFullscreen() {
  const root = document.documentElement;
  const request = root?.requestFullscreen || root?.webkitRequestFullscreen || root?.mozRequestFullScreen || root?.msRequestFullscreen;
  if (!request) return Promise.reject(new Error("fullscreen-unsupported"));
  const result = request.call(root);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function exitBrowserFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return Promise.reject(new Error("fullscreen-exit-unsupported"));
  const result = exit.call(document);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function syncFullscreenButtonUi() {
  const button = els.fullscreenToggle;
  if (!button) return;

  const isActive = isBrowserFullscreenActive();
  const isSupported = isBrowserFullscreenSupported();
  const label = isActive ? "יציאה ממסך מלא" : "כניסה למסך מלא";

  button.dataset.fullscreenActive = isActive ? "true" : "false";
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
  button.setAttribute("aria-label", label);
  setTooltipText(button, label, { updateDefault: true });
  button.disabled = !isSupported && !isActive;
  button.classList.toggle("hidden", !isSupported && !isActive);
}

async function toggleBrowserFullscreen() {
  const button = els.fullscreenToggle;
  const wasActive = isBrowserFullscreenActive();

  try {
    if (wasActive) {
      await exitBrowserFullscreen();
    } else {
      if (!isBrowserFullscreenSupported()) throw new Error("fullscreen-unsupported");
      await requestBrowserFullscreen();
    }
  } catch (error) {
    const message = wasActive ? "לא הצלחתי לצאת ממסך מלא" : "הדפדפן חסם מסך מלא";
    console.warn("Fullscreen toggle failed", error);
    flashActionButton(button, message);
  } finally {
    syncFullscreenButtonUi();
    showTopUiTemporarily(1400);
  }
}


function setViewerLoading(isLoading) {
  els.viewerLoading.classList.toggle("hidden", !isLoading);
}


function hideLightboxFloatingPreview() {
  els.lightboxFloatingPreview?.classList.remove("visible");
}

function isLightboxPageRailTrigger(button) {
  return Boolean(button?.closest?.(".lightbox-page-rail"));
}

function normalizeWheelDeltaToPixels(delta, deltaMode, pageSize = 0) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  if (deltaMode === lineMode) return delta * 36;
  if (deltaMode === pageMode) return delta * Math.max(1, pageSize);
  return delta;
}

function handleLightboxThumbsWheel(event) {
  if (state.viewerMode !== "single" || !els.lightboxThumbs) return;

  const scroller = els.lightboxThumbs;
  const hasHorizontalOverflow = scroller.scrollWidth > scroller.clientWidth + 1;
  const isVerticalWheel = Math.abs(event.deltaY || 0) >= Math.abs(event.deltaX || 0);
  if (!hasHorizontalOverflow || !isVerticalWheel || !event.deltaY) return;

  event.preventDefault();
  keepThumbsOpen();

  const delta = normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, scroller.clientWidth);
  scroller.scrollLeft -= delta;
}

function positionLightboxFloatingPreview(button) {
  const preview = els.lightboxFloatingPreview;
  if (!preview || !button) return;

  const buttonRect = button.getBoundingClientRect();

  if (isLightboxPageRailTrigger(button)) {
    const previewHeight = Math.max(240, preview.offsetHeight || Math.min(620, window.innerHeight * 0.74));
    const railRect = button.closest?.(".lightbox-page-rail")?.getBoundingClientRect?.();
    const centerY = Math.min(
      window.innerHeight - (previewHeight / 2) - 14,
      Math.max((previewHeight / 2) + 14, buttonRect.top + (buttonRect.height / 2))
    );
    const right = Math.max(12, window.innerWidth - (railRect?.left ?? buttonRect.left) + 12);

    preview.style.left = "auto";
    preview.style.bottom = "auto";
    preview.style.right = `${right}px`;
    preview.style.top = `${centerY}px`;
    return;
  }

  const previewWidth = Math.max(240, preview.offsetWidth || Math.min(420, window.innerWidth * 0.34));
  const centerX = Math.min(
    window.innerWidth - (previewWidth / 2) - 14,
    Math.max((previewWidth / 2) + 14, buttonRect.left + (buttonRect.width / 2))
  );
  const bottom = Math.max(122, window.innerHeight - buttonRect.top + 12);

  preview.style.right = "auto";
  preview.style.top = "auto";
  preview.style.left = `${centerX}px`;
  preview.style.bottom = `${bottom}px`;
}

function showLightboxFloatingPreview(button) {
  if (!state.catalog || !button || !els.lightboxFloatingPreview || !els.lightboxFloatingPreviewImage) return;

  const page = clampPage(button.dataset.page, state.catalog);
  const src = button.dataset.previewSrc || pageSrc(state.catalog, page);
  setCatalogImageSource(els.lightboxFloatingPreviewImage, src);
  els.lightboxFloatingPreviewImage.alt = `${state.catalog.title} - עמוד ${page}`;
  if (els.lightboxFloatingPreviewPage) els.lightboxFloatingPreviewPage.textContent = `עמוד ${page}`;
  els.lightboxFloatingPreview.classList.toggle("from-page-rail", isLightboxPageRailTrigger(button));
  els.lightboxFloatingPreview.classList.add("visible");
  positionLightboxFloatingPreview(button);
}

function updateLightboxThumbs(options = {}) {
  const { scrollIntoView = true } = options;
  const pageRailIsVisible = Boolean(els.lightbox?.classList.contains("show-page-rail"));

  els.lightboxThumbs?.querySelectorAll(".lightbox-thumb").forEach((button) => {
    const active = Number(button.dataset.page) === state.page;
    button.classList.toggle("active", active);
    if (active && scrollIntoView && state.viewerMode === "single") {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });

  els.lightboxPageThumbs?.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    const active = Number(button.dataset.page) === state.page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");

    if (active && scrollIntoView && pageRailIsVisible) {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });
}

function clearLightboxBottomThumbs() {
  if (els.lightboxThumbs) els.lightboxThumbs.textContent = "";
}

function renderLightboxScrollPages() {
  if (!state.catalog || !els.lightboxScrollPages) return;
  disconnectLightboxScrollImageLoading();
  const catalog = state.catalog;
  const pages = [];

  for (let page = 1; page <= catalog.pages; page += 1) {
    const rawSrc = pageSrc(catalog, page);
    const src = escapeHtml(rawSrc);
    const crossOriginAttribute = catalogImageCrossOriginAttribute(rawSrc);
    const eager = Math.abs(page - state.page) <= 1;
    const imageAttributes = eager
      ? `src="${src}" loading="eager" fetchpriority="${page === state.page ? "high" : "auto"}"${crossOriginAttribute}`
      : `src="${TRANSPARENT_PIXEL}" data-src="${src}" loading="lazy" fetchpriority="low"${crossOriginAttribute}`;
    pages.push(`
      <figure class="lightbox-scroll-page-frame catalog-image-frame" id="lightbox-scroll-page-${page}" data-page="${page}"${pageAspectStyle(catalog, page)}>
        <img class="lightbox-scroll-image${eager ? " loaded" : ""}" ${imageAttributes} alt="${escapeHtml(catalog.title)} - עמוד ${page}" decoding="async" />
      </figure>
    `);
  }

  els.lightboxScrollPages.innerHTML = pages.join("");
  els.lightboxScrollPages.querySelectorAll("img.lightbox-scroll-image").forEach(watchLoadedPageAspect);
  activateLightboxScrollImageLoading();
}

function renderLightboxPageRail() {
  if (!state.catalog || !els.lightboxPageThumbs) return;
  const catalog = state.catalog;
  const thumbs = [];

  for (let page = 1; page <= catalog.pages; page += 1) {
    const thumb = escapeHtml(thumbSrc(catalog, page));
    const fullPage = thumb;
    thumbs.push(`
      <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === state.page ? " active" : ""}" type="button" data-page="${page}" data-preview-src="${fullPage}" aria-label="מעבר לעמוד ${page}"${page === state.page ? ' aria-current="page"' : ""}>
        <span class="lightbox-page-thumb-image-wrap">
          <img src="${thumb}" alt="" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
        </span>
        <span class="lightbox-page-thumb-number">${page}</span>
      </button>
    `);
  }

  els.lightboxPageThumbs.innerHTML = thumbs.join("");
  els.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    button.addEventListener("pointerenter", () => showLightboxFloatingPreview(button));
    button.addEventListener("pointerleave", hideLightboxFloatingPreview);
    button.addEventListener("focus", () => showLightboxFloatingPreview(button));
    button.addEventListener("blur", hideLightboxFloatingPreview);
    button.addEventListener("click", () => {
      hideLightboxFloatingPreview();
      showPageRailTemporarily(1800);
      setLightboxPage(Number(button.dataset.page), { smooth: true, hit: true });
    });
  });
}

function syncViewerModeUi() {
  const isScrollMode = state.viewerMode === "scroll";
  els.lightbox?.classList.toggle("mode-scroll", isScrollMode);
  els.lightbox?.classList.toggle("mode-single", !isScrollMode);

  if (els.viewerModeToggle) {
    const label = isScrollMode ? "מעבר לתצוגת תמונה אחת עם חיצים בצדדים" : "מעבר לתצוגת כל העמודים בגלילה מלמעלה למטה";
    els.viewerModeToggle.dataset.viewerMode = isScrollMode ? "scroll" : "single";
    els.viewerModeToggle.setAttribute("aria-label", label);
    setTooltipText(els.viewerModeToggle, isScrollMode ? "תצוגה לצדדים" : "תצוגת גלילה", { updateDefault: true });
  }

  syncFullscreenButtonUi();

  if (els.lightboxModeLabel) {
    els.lightboxModeLabel.textContent = isScrollMode ? "כניסה לקטלוג" : "תצוגת מסך מלא";
  }
}

function setLightboxMode(mode, options = {}) {
  if (!state.catalog) return;
  const nextMode = mode === "scroll" ? "scroll" : "single";
  const wasScrollMode = state.viewerMode === "scroll";
  const pageToKeep = state.page;

  if (nextMode === state.viewerMode) {
    syncViewerModeUi();
    if (nextMode === "scroll" && options.scrollToPage !== false) {
      scrollToLightboxScrollPage(pageToKeep, { smooth: false, hit: false });
    }
    return;
  }

  hideLightboxFloatingPreview();
  state.viewerMode = nextMode;
  state.zoom = 1;
  resetImagePosition();
  state.pointers.clear();
  els.lightbox?.classList.remove("show-thumbs", "show-page-rail");
  syncViewerModeUi();
  updateLightbox();

  if (nextMode === "scroll") {
    requestAnimationFrame(() => scrollToLightboxScrollPage(pageToKeep, { smooth: false, hit: false }));
  } else if (wasScrollMode) {
    showPageRailTemporarily(1300);
  }
}

function toggleLightboxMode() {
  setLightboxMode(state.viewerMode === "scroll" ? "single" : "scroll");
}

function hasHoverPointer() {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function isTouchLikePointer(event) {
  return event?.pointerType === "touch" || event?.pointerType === "pen";
}

function markTouchLikeRailInput(event) {
  if (isTouchLikePointer(event)) {
    state.lastTouchLikeRailInputAt = Date.now();
  }
}

function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - state.lastTouchLikeRailInputAt < timeout;
}

function shouldUsePageRailHover(event = null) {
  if (!hasHoverPointer()) return false;
  if (isTouchLikePointer(event) || hasRecentTouchLikeRailInput()) return false;
  return true;
}

function showPageRailTemporarily(delay = 2600) {
  if (!els.lightbox || !state.lightboxOpen) return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView: true });
  if (delay > 0) {
    state.pageRailHideTimer = window.setTimeout(() => {
      els.lightbox?.classList.remove("show-page-rail");
    }, delay);
  }
}

function keepPageRailOpen() {
  if (!state.lightboxOpen) return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox?.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView: true });
}

function schedulePageRailClose(event = null) {
  if (!shouldUsePageRailHover(event)) return;
  window.clearTimeout(state.pageRailHideTimer);
  state.pageRailHideTimer = window.setTimeout(() => {
    els.lightbox?.classList.remove("show-page-rail");
  }, 420);
}

function openPageRailFromTouch(event) {
  if (!isTouchLikePointer(event)) return;
  markTouchLikeRailInput(event);
  event.preventDefault?.();
  keepPageRailOpen();
}

function openPageRailFromHotspot(event = null) {
  if (hasRecentTouchLikeRailInput()) {
    keepPageRailOpen();
    return;
  }
  showPageRailTemporarily(shouldUsePageRailHover(event) ? 2600 : 0);
}

function showPageRailFromHover(event = null) {
  if (shouldUsePageRailHover(event)) showPageRailTemporarily(0);
}

function keepPageRailOpenFromHover(event = null) {
  if (shouldUsePageRailHover(event)) keepPageRailOpen();
}

function handlePageRailPointerOutside(event) {
  if (!els.lightbox || !state.lightboxOpen) return;
  if (!els.lightbox.classList.contains("show-page-rail")) return;

  const target = event.target;
  if (els.lightboxPageRail?.contains(target) || els.lightboxSideHotspot?.contains(target)) return;
  if (!isTouchLikePointer(event) && shouldUsePageRailHover(event)) return;

  window.clearTimeout(state.pageRailHideTimer);
  hideLightboxFloatingPreview();
  els.lightbox.classList.remove("show-page-rail");
}

function scrollToLightboxScrollPage(page, options = {}) {
  if (!state.catalog || !els.lightboxScrollView) return;
  const { smooth = true, hit = false } = options;
  const targetPage = clampPage(page, state.catalog);
  const target = document.getElementById(`lightbox-scroll-page-${targetPage}`);
  if (!target) return;
  ensureLightboxScrollPageLoaded(targetPage, 2);

  const containerTop = els.lightboxScrollView.getBoundingClientRect().top;
  const targetTop = target.getBoundingClientRect().top - containerTop + els.lightboxScrollView.scrollTop;
  els.lightboxScrollView.scrollTo({ top: Math.max(0, targetTop - 10), behavior: smooth ? "smooth" : "auto" });
  updateLightboxThumbs({ scrollIntoView: true });

  if (hit) {
    target.classList.add("lightbox-scroll-page-hit");
    window.setTimeout(() => target.classList.remove("lightbox-scroll-page-hit"), 1500);
  }
}

function findCurrentLightboxScrollPage() {
  if (!state.catalog || !els.lightboxScrollView || state.viewerMode !== "scroll") return;
  const frames = Array.from(els.lightboxScrollPages?.querySelectorAll(".lightbox-scroll-page-frame") || []);
  if (!frames.length) return;

  const containerRect = els.lightboxScrollView.getBoundingClientRect();
  const anchorY = containerRect.top + Math.max(110, els.lightboxScrollView.clientHeight * 0.32);
  let closestPage = state.page || 1;
  let closestDistance = Number.POSITIVE_INFINITY;

  frames.forEach((frame) => {
    const rect = frame.getBoundingClientRect();
    const page = Number(frame.dataset.page || 0);
    if (!Number.isFinite(page) || page < 1) return;

    if (rect.top <= anchorY && rect.bottom >= anchorY) {
      closestPage = page;
      closestDistance = -1;
      return;
    }

    if (closestDistance >= 0) {
      const distance = Math.min(Math.abs(rect.top - anchorY), Math.abs(rect.bottom - anchorY));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = page;
      }
    }
  });

  if (closestPage !== state.page) {
    setLightboxPage(closestPage, { syncScroll: false, keepZoom: true });
  }
}

function scheduleLightboxScrollPageUpdate() {
  if (state.lightboxScrollRaf || state.viewerMode !== "scroll") return;
  state.lightboxScrollRaf = window.requestAnimationFrame(() => {
    state.lightboxScrollRaf = 0;
    findCurrentLightboxScrollPage();
  });
}

function syncLightboxProgress(page = state.page, catalog = state.catalog) {
  if (!els.lightboxProgress || !catalog) return;
  const totalPages = Math.max(1, Number(catalog.pages || 1));
  const currentPage = clampPage(page, catalog);
  const ratio = totalPages <= 1 ? 1 : currentPage / totalPages;
  const clampedRatio = Math.min(1, Math.max(0, ratio));

  els.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio));
  els.lightboxProgress.setAttribute("aria-valuemin", "1");
  els.lightboxProgress.setAttribute("aria-valuemax", String(totalPages));
  els.lightboxProgress.setAttribute("aria-valuenow", String(currentPage));
  els.lightboxProgress.setAttribute("title", `עמוד ${currentPage} מתוך ${totalPages}`);
}

function updateLightbox() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  state.page = clampPage(state.page, catalog);
  syncViewerModeUi();

  els.lightboxTitle.textContent = catalog.title;
  els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${catalog.pages}`;
  syncLightboxProgress(state.page, catalog);
  initLightboxSearchStatus();
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= catalog.pages;

  if (state.viewerMode === "scroll") {
    setViewerLoading(false);
    ensureLightboxScrollPageLoaded(state.page, 1);
    applyZoom();
    updateLightboxThumbs();
    updateHash();
    return;
  }

  const src = pageSrc(catalog, state.page);
  const currentSrc = els.lightboxImage.getAttribute("src");
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, state.page, src);
  } else {
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  }

  updateLightboxThumbs();
  preloadNeighbors();
  updateHash();
}

function openLightbox(page = 1, options = {}) {
  if (!state.catalog) return;
  const mode = typeof options === "string" ? options : options.mode;
  state.viewerMode = mode === "scroll" ? "scroll" : "single";
  state.page = clampPage(page, state.catalog);
  state.zoom = 1;
  resetImagePosition();
  state.pointers.clear();
  state.lightboxOpen = true;
  const initialSrc = pageSrc(state.catalog, state.page);
  if (els.lightboxImage?.getAttribute("src") !== initialSrc) {
    els.lightboxImage?.removeAttribute("src");
    els.lightboxImageFrame?.classList.remove("page-swap-enter");
  }
  els.lightbox.classList.remove("hidden");
  els.lightbox.classList.remove("show-thumbs", "show-ui", "show-page-rail");
  document.body.classList.add("no-scroll");
  clearLightboxBottomThumbs();
  renderLightboxScrollPages();
  renderLightboxPageRail();
  renderLightboxCatalogMenu();
  resetLightboxSearch();
  syncViewerModeUi();
  showTopUiTemporarily(1700);
  updateLightbox();
  scheduleCatalogScrollTopButtonUpdate();

  if (state.viewerMode === "scroll") {
    requestAnimationFrame(() => scrollToLightboxScrollPage(state.page, { smooth: false, hit: false }));
  }
}

function closeLightbox() {
  state.lightboxOpen = false;
  state.singleImageLoadToken += 1;
  window.clearTimeout(state.singleImageAnimationTimer);
  els.lightbox.classList.add("hidden");
  els.lightbox.classList.remove("show-thumbs", "show-ui", "show-page-rail", "mode-scroll", "mode-single", "is-page-loading");
  els.lightboxImageFrame?.classList.remove("page-swap-enter");
  setViewerLoading(false);
  hideLightboxFloatingPreview();
  window.clearTimeout(state.thumbsHideTimer);
  window.clearTimeout(state.uiHideTimer);
  window.clearTimeout(state.pageRailHideTimer);
  if (state.lightboxScrollRaf) window.cancelAnimationFrame(state.lightboxScrollRaf);
  state.lightboxScrollRaf = 0;
  disconnectLightboxScrollImageLoading();
  document.body.classList.remove("no-scroll");
  scheduleCatalogScrollTopButtonUpdate();
  updateHash();
}

function setLightboxPage(page, options = {}) {
  if (!state.catalog) return;
  const { syncScroll = state.viewerMode === "scroll", smooth = true, hit = false, keepZoom = false } = options;
  const nextPage = clampPage(page, state.catalog);
  if (nextPage !== state.page) {
    hideLightboxFloatingPreview();
    if (!keepZoom) {
      state.zoom = 1;
      resetImagePosition();
      state.pointers.clear();
    }
  }
  state.page = nextPage;
  updateLightbox();

  if (syncScroll && state.viewerMode === "scroll") {
    scrollToLightboxScrollPage(nextPage, { smooth, hit });
  }
}

function moveLightbox(delta) {
  if (!state.catalog) return;
  setLightboxPage(state.page + delta, { smooth: true, hit: state.viewerMode === "scroll" });
}

function getDefaultZoomFocalPoint() {
  const surface = state.viewerMode === "scroll" ? els.lightboxScrollView : els.stageCanvas;
  const rect = surface?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function adjustSinglePanForZoom(nextZoom, focal) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !focal) return;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const contentX = (focal.x - centerX - state.panX) / currentZoom;
  const contentY = (focal.y - centerY - state.panY) / currentZoom;

  state.panX = focal.x - centerX - contentX * nextZoom;
  state.panY = focal.y - centerY - contentY * nextZoom;
}

function adjustScrollPanForZoom(nextZoom, focal) {
  const metrics = getScrollZoomMetrics();
  const rect = metrics?.container.getBoundingClientRect?.();
  if (!metrics || !rect || !focal) return;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const focalX = focal.x - rect.left;
  const focalY = focal.y - rect.top;
  const contentX = (focalX - metrics.baseLeft - state.panX) / currentZoom;
  const contentY = (focalY - metrics.baseTop - state.panY) / currentZoom;

  state.panX = focalX - metrics.baseLeft - contentX * nextZoom;
  state.panY = focalY - metrics.baseTop - contentY * nextZoom;
}

function adjustPanForZoom(nextZoom, focal) {
  if (state.viewerMode === "scroll") adjustScrollPanForZoom(nextZoom, focal);
  else adjustSinglePanForZoom(nextZoom, focal);
}

function getSingleContentPointFromClientPoint(clientX, clientY) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (clientX - centerX - state.panX) / currentZoom,
    y: (clientY - centerY - state.panY) / currentZoom
  };
}

function getScrollContentPointFromClientPoint(clientX, clientY) {
  const metrics = getScrollZoomMetrics();
  const rect = metrics?.container.getBoundingClientRect?.();
  if (!metrics || !rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const focalX = clientX - rect.left;
  const focalY = clientY - rect.top;

  return {
    x: (focalX - metrics.baseLeft - state.panX) / currentZoom,
    y: (focalY - metrics.baseTop - state.panY) / currentZoom
  };
}

function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return false;
  const zoom = clampViewerZoom(nextZoom);
  if (zoom <= 1.001) {
    setZoom(1, { showUi: false });
    return true;
  }

  state.zoom = zoom;
  state.panX = -point.x * zoom;
  state.panY = -point.y * zoom;
  applyZoom();
  return true;
}

function zoomScrollContentPointToViewportCenter(point, nextZoom) {
  const metrics = getScrollZoomMetrics();
  if (!metrics || !point) return false;
  const zoom = clampViewerZoom(nextZoom);
  if (zoom <= 1.001) {
    setZoom(1, { showUi: false });
    return true;
  }

  state.zoom = zoom;
  state.panX = metrics.viewportWidth / 2 - metrics.baseLeft - point.x * zoom;
  state.panY = metrics.viewportHeight / 2 - metrics.baseTop - point.y * zoom;
  applyZoom();
  scheduleLightboxScrollPageUpdate();
  return true;
}

function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  if (state.viewerMode === "scroll") {
    return zoomScrollContentPointToViewportCenter(
      getScrollContentPointFromClientPoint(clientX, clientY),
      nextZoom
    );
  }

  return zoomSingleContentPointToViewportCenter(
    getSingleContentPointFromClientPoint(clientX, clientY),
    nextZoom
  );
}

function setZoom(nextZoom, options = {}) {
  const { showUi = true, focalClientX = null, focalClientY = null } = options;
  const previousZoom = state.zoom;
  const zoom = clampViewerZoom(nextZoom);
  const hasFocal = Number.isFinite(focalClientX) && Number.isFinite(focalClientY);
  const focal = hasFocal
    ? { x: focalClientX, y: focalClientY }
    : getDefaultZoomFocalPoint();

  if (zoom <= 1.001) {
    state.zoom = MIN_VIEWER_ZOOM;
    resetImagePosition();
  } else {
    if (focal && Math.abs(zoom - previousZoom) > 0.001) {
      adjustPanForZoom(zoom, focal);
    }
    state.zoom = zoom;
  }

  applyZoom();
  if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
  if (showUi) showTopUiTemporarily(1600);
}

function toggleZoomAtPoint(clientX, clientY) {
  if (state.zoom > 1.01) {
    setZoom(1, { showUi: false });
    return;
  }

  if (!zoomClientPointToViewportCenter(2, clientX, clientY)) {
    setZoom(2, { showUi: false, focalClientX: clientX, focalClientY: clientY });
  }
}


function openCatalogPage(id, page = 1) {
  openCatalogInViewer(id, page, "scroll");
}

function openCatalog(id, options = {}) {
  const { scroll = false, openPage = null, viewerMode = "single" } = options;
  const catalog = catalogs.find((item) => item.id === id) || catalogs[0] || null;
  if (!catalog) return;

  state.catalog = catalog;
  state.page = 1;
  renderCatalogDetail();
  updateHash();

  if (scroll) {
    scrollCatalogDetailIntoView();
  }

  if (openPage != null) {
    openLightbox(openPage, { mode: viewerMode });
  }
}

function openCatalogInViewer(id, page = 1, mode = "single") {
  const catalog = catalogs.find((item) => item.id === id) || catalogs[0] || null;
  if (!catalog) return;

  state.catalog = catalog;
  state.page = clampPage(page, catalog);
  renderCatalogDetail();
  openLightbox(state.page, { mode });
}

function parseHash() {
  const pageMatch = location.hash.match(/^#catalog\/([a-z0-9-]+)\/page\/(\d+)(?:\/(scroll|single))?$/i);
  if (pageMatch) {
    return {
      id: pageMatch[1],
      page: Number(pageMatch[2]),
      lightbox: true,
      viewerMode: pageMatch[3] === "scroll" ? "scroll" : "single"
    };
  }

  const catalogMatch = location.hash.match(/^#catalog\/([a-z0-9-]+)$/i);
  if (catalogMatch) {
    return { id: catalogMatch[1], page: 1, lightbox: false };
  }

  return null;
}


function getZoomSurfaceName(surface) {
  if (surface === els.lightboxScrollView) return "scroll";
  if (surface === els.stageCanvas) return "single";
  return "";
}

function isActiveZoomSurface(surface) {
  return state.viewerMode === getZoomSurfaceName(surface);
}

function startPointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;

  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.zoom > 1.01 || state.pointers.size >= 2 || state.viewerMode === "single") {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
  } else if (pointers.length === 2) {
    const [first, second] = pointers;
    const mid = pointerMidpoint(first, second);
    state.pinchStartDistance = Math.max(1, pointerDistance(first, second));
    state.pinchStartZoom = state.zoom;
    state.pinchLastMidX = mid.x;
    state.pinchLastMidY = mid.y;
    event.preventDefault();
  }
}

function movePointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget) || !state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const pointers = getPointerList();

  if (pointers.length >= 2) {
    event.preventDefault();
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const mid = pointerMidpoint(first, second);
    state.panX += mid.x - state.pinchLastMidX;
    state.panY += mid.y - state.pinchLastMidY;
    state.pinchLastMidX = mid.x;
    state.pinchLastMidY = mid.y;
    setZoom(state.pinchStartZoom * (distance / state.pinchStartDistance), {
      showUi: false,
      focalClientX: mid.x,
      focalClientY: mid.y
    });
    return;
  }

  if (pointers.length === 1 && state.zoom > 1.01) {
    event.preventDefault();
    state.panX = state.dragStartPanX + (event.clientX - state.dragStartX);
    state.panY = state.dragStartPanY + (event.clientY - state.dragStartY);
    applyZoom();
    if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
  }
}

function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return false;
  if (state.pointers.size > 0) return false;

  const moved = Math.hypot(event.clientX - startedX, event.clientY - startedY);
  if (moved > TAP_MOVE_TOLERANCE) {
    state.lastTapAt = 0;
    return false;
  }

  const now = Date.now();
  const surface = getZoomSurfaceName(event.currentTarget);
  const closeToLastTap = Math.hypot(event.clientX - state.lastTapX, event.clientY - state.lastTapY) <= DOUBLE_TAP_DISTANCE;
  const isDoubleTap =
    surface === state.lastTapSurface &&
    now - state.lastTapAt <= DOUBLE_TAP_DELAY &&
    closeToLastTap;

  state.lastTapAt = now;
  state.lastTapX = event.clientX;
  state.lastTapY = event.clientY;
  state.lastTapSurface = surface;

  if (!isDoubleTap) return false;

  event.preventDefault();
  state.lastTapAt = 0;
  state.suppressNextDblClickUntil = now + 550;
  toggleZoomAtPoint(event.clientX, event.clientY);
  return true;
}

function endPointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget) || !state.pointers.has(event.pointerId)) return;
  const startedX = state.dragStartX;
  const startedY = state.dragStartY;
  state.pointers.delete(event.pointerId);

  const handledDoubleTap = handlePotentialDoubleTap(event, startedX, startedY);

  if (!handledDoubleTap && state.viewerMode === "single" && state.pointers.size === 0 && state.zoom <= 1.01) {
    const dx = event.clientX - startedX;
    const dy = event.clientY - startedY;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      // In the RTL catalog viewer, a left-to-right swipe should advance to the next page.
      if (dx > 0) moveLightbox(1);
      else moveLightbox(-1);
    }
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    const only = pointers[0];
    state.dragStartX = only.x;
    state.dragStartY = only.y;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
  }
}

function cancelPointerInteraction(event) {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.delete(event.pointerId);
}

function getWheelZoomFactor(event) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  const delta = normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, event.currentTarget?.clientHeight || 0);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return 1;

  // Trackpad pinch is delivered by Chromium/Edge as a high-frequency ctrl+wheel
  // stream with pixel deltas. Use a gesture-like curve so it reacts closer to
  // a real two-finger touch pinch, while capping one event so a mouse wheel
  // cannot jump wildly across the whole zoom range.
  const speed = event.deltaMode === lineMode ? 0.0065 : event.deltaMode === pageMode ? 0.0035 : 0.011;
  const maxStep = Math.log(2.35);
  return Math.exp(clampValue(-delta * speed, -maxStep, maxStep));
}

function handleZoomSurfaceWheel(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const factor = getWheelZoomFactor(event);
    if (factor === 1) return;
    setZoom(state.zoom * factor, {
      showUi: false,
      focalClientX: event.clientX,
      focalClientY: event.clientY
    });
    return;
  }

  if (state.zoom > 1.01) {
    event.preventDefault();
    state.panX -= normalizeWheelDeltaToPixels(event.deltaX, event.deltaMode, event.currentTarget.clientWidth);
    state.panY -= normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, event.currentTarget.clientHeight);
    applyZoom();
    if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
  }
}

function handleZoomSurfaceDoubleClick(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;
  if (Date.now() < state.suppressNextDblClickUntil) return;

  event.preventDefault();
  toggleZoomAtPoint(event.clientX, event.clientY);
}

function attachZoomSurfaceGestures(surface) {
  if (!surface) return;
  surface.addEventListener("pointerdown", startPointerInteraction);
  surface.addEventListener("pointermove", movePointerInteraction);
  surface.addEventListener("pointerup", endPointerInteraction);
  surface.addEventListener("pointercancel", cancelPointerInteraction);
  surface.addEventListener("wheel", handleZoomSurfaceWheel, { passive: false });
  surface.addEventListener("dblclick", handleZoomSurfaceDoubleClick);
}



function attachViewerGestures() {
  attachZoomSurfaceGestures(els.stageCanvas);
  attachZoomSurfaceGestures(els.lightboxScrollView);
}

function handleViewerSurfacePointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
}

function handleLightboxSearchResultsBackgroundClick(event) {
  const resultButton = event.target.closest?.("[data-lightbox-search-page]");
  if (resultButton && els.lightboxSearchResults?.contains(resultButton)) return;

  event.preventDefault();
  event.stopPropagation();
  hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
}

function attachEvents() {
  els.globalSearchInput?.addEventListener("input", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("focus", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("click", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitGlobalSearch();
  });
  els.globalSearchClear?.addEventListener("click", () => {
    els.globalSearchInput.value = "";
    els.globalSearchInput.focus();
    renderSearchResults("");
  });

  els.globalSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderGlobalSearchScopeMenu();
    const isOpen = !els.globalSearchScopeMenu?.classList.contains("hidden");
    els.globalSearchScopeMenu?.classList.toggle("hidden", isOpen);
    els.globalSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  els.globalSearchScopeMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest?.("[data-global-search-category]");
    if (!button || !els.globalSearchScopeMenu.contains(button)) return;
    setGlobalSearchCategory(button.dataset.globalSearchCategory);
    els.globalSearchInput?.focus();
  });

  els.lightboxSearchInput?.addEventListener("input", () => renderLightboxSearchResults(els.lightboxSearchInput.value));
  els.lightboxSearchInput?.addEventListener("focus", () => {
    showTopUiTemporarily(0);
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  });
  els.lightboxSearchInput?.addEventListener("click", () => {
    showTopUiTemporarily(0);
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  });
  els.lightboxSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitLightboxSearch();
  });
  els.lightboxSearchClear?.addEventListener("click", () => {
    els.lightboxSearchInput.value = "";
    els.lightboxSearchInput.focus();
    renderLightboxSearchResults("");
    showTopUiTemporarily(0);
  });

  els.lightboxSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    const isOpen = !els.lightboxSearchScopeMenu?.classList.contains("hidden");
    els.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen);
    els.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightboxSearchScope(button.dataset.lightboxSearchScope);
      showTopUiTemporarily(0);
      els.lightboxSearchInput?.focus();
    });
  });
  els.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderLightboxCatalogMenu();
    const isOpen = !els.lightboxCatalogMenu?.classList.contains("hidden");
    els.lightboxCatalogMenu?.classList.toggle("hidden", isOpen);
    els.lightboxCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxCatalogMenu?.addEventListener("click", (event) => event.stopPropagation());
  els.lightboxSearchResults?.addEventListener("click", handleLightboxSearchResultsBackgroundClick);

  els.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderDetailCatalogMenu();
    const isOpen = !els.catalogMenu?.classList.contains("hidden");
    els.catalogMenu?.classList.toggle("hidden", isOpen);
    els.catalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  els.catalogMenu?.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", (event) => {
    if (els.globalSearchScopeMenu?.contains(event.target) || els.globalSearchScopeToggle?.contains(event.target)) return;
    if (els.lightboxSearchScopeMenu?.contains(event.target) || els.lightboxSearchScopeToggle?.contains(event.target)) return;
    if (els.lightboxCatalogMenu?.contains(event.target) || els.lightboxCatalogMenuToggle?.contains(event.target)) return;
    if (els.catalogMenu?.contains(event.target) || els.catalogMenuToggle?.contains(event.target)) return;
    closeGlobalSearchScopeMenu();
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    closeDetailCatalogMenu();
  });

  els.openViewerScrollFromTop?.addEventListener("click", () => openLightbox(1, { mode: "scroll" }));
  els.openViewerSingleFromTop?.addEventListener("click", () => openLightbox(1, { mode: "single" }));
  els.catalogCoverOpenViewer?.addEventListener("click", () => openLightbox(1));
  els.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  els.categoryNav?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !els.categoryNav.contains(link)) return;
    handleCatalogFocusLinkClick(link, event);
  });

  els.catalogGrid?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".catalog-subcategory-nav-link");
    if (!link || !els.catalogGrid.contains(link)) return;
    handleCatalogFocusLinkClick(link, event);
  });

  els.closeLightbox?.addEventListener("click", closeLightbox);
  els.lightboxScreenshot?.addEventListener("click", () => downloadCurrentLightboxImage());
  els.lightboxCopyLink?.addEventListener("click", () => copyCurrentLightboxLink());
  els.lightboxBackdrop?.addEventListener("click", closeLightbox);
  els.viewerModeToggle?.addEventListener("click", toggleLightboxMode);
  els.fullscreenToggle?.addEventListener("click", toggleBrowserFullscreen);
  els.prevPageBtn?.addEventListener("click", () => moveLightbox(-1));
  els.nextPageBtn?.addEventListener("click", () => moveLightbox(1));
  els.fitBtn?.addEventListener("click", () => setZoom(1));
  els.stageCanvas?.addEventListener("pointerdown", handleViewerSurfacePointerDown);
  els.lightboxScrollView?.addEventListener("pointerdown", handleViewerSurfacePointerDown);

  attachViewerGestures();

  [els.prevPageBtn, els.nextPageBtn].forEach((el) => {
    el?.addEventListener("mouseenter", () => showPageRailTemporarily(0));
    el?.addEventListener("mouseleave", schedulePageRailClose);
    el?.addEventListener("focus", () => showPageRailTemporarily(0));
    el?.addEventListener("blur", schedulePageRailClose);
  });

  els.thumbsHotspot?.addEventListener("mouseenter", () => showThumbsTemporarily(0));
  els.thumbsHotspot?.addEventListener("mouseleave", scheduleThumbsClose);
  els.thumbsHotspot?.addEventListener("focus", () => showThumbsTemporarily(0));
  els.thumbsHotspot?.addEventListener("blur", scheduleThumbsClose);

  els.lightboxThumbs?.addEventListener("mouseenter", keepThumbsOpen);
  els.lightboxThumbs?.addEventListener("wheel", handleLightboxThumbsWheel, { passive: false });
  els.lightboxThumbs?.addEventListener("mouseleave", () => {
    hideLightboxFloatingPreview();
    scheduleThumbsClose();
  });

  els.lightboxSideHotspot?.addEventListener("pointerdown", openPageRailFromTouch, { passive: false });
  els.lightboxSideHotspot?.addEventListener("mouseenter", showPageRailFromHover);
  els.lightboxSideHotspot?.addEventListener("mouseleave", schedulePageRailClose);
  els.lightboxSideHotspot?.addEventListener("click", openPageRailFromHotspot);
  els.lightboxPageRail?.addEventListener("pointerdown", markTouchLikeRailInput);
  els.lightboxPageRail?.addEventListener("mouseenter", keepPageRailOpenFromHover);
  els.lightboxPageRail?.addEventListener("mouseleave", (event) => {
    hideLightboxFloatingPreview();
    schedulePageRailClose(event);
  });
  els.lightbox?.addEventListener("pointerdown", handlePageRailPointerOutside);
  els.lightboxPageRail?.addEventListener("focusin", keepPageRailOpen);
  els.lightboxPageRail?.addEventListener("focusout", schedulePageRailClose);
  els.lightboxScrollView?.addEventListener("scroll", scheduleLightboxScrollPageUpdate, { passive: true });

  els.topHotspot?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseleave", () => {
    window.clearTimeout(state.uiHideTimer);
    state.uiHideTimer = window.setTimeout(() => els.lightbox?.classList.remove("show-ui"), 420);
  });

  els.lightboxImage?.addEventListener("load", () => {
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  });


  window.addEventListener("resize", () => {
    scheduleCatalogLayoutRefresh();
    scheduleCategoryNavFit();
    hideSearchFloatingPreview();
    scheduleCatalogScrollTopButtonUpdate();
    if (state.lightboxOpen) {
      hideLightboxFloatingPreview();
      applyZoom();
      if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
    }
  });
  window.addEventListener("scroll", () => {
    hideSearchFloatingPreview();
    scheduleCatalogScrollTopButtonUpdate();
  }, { passive: true });

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, syncFullscreenButtonUi);
  });

  syncFullscreenButtonUi();

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.globalSearchScopeMenu && !els.globalSearchScopeMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeGlobalSearchScopeMenu();
      return;
    }
    if (event.key === "Escape" && els.catalogMenu && !els.catalogMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeDetailCatalogMenu();
      return;
    }
    if (!state.lightboxOpen) return;
    if (event.key === "Escape" && ((els.lightboxCatalogMenu && !els.lightboxCatalogMenu.classList.contains("hidden")) || (els.lightboxSearchScopeMenu && !els.lightboxSearchScopeMenu.classList.contains("hidden")))) {
      event.preventDefault();
      closeLightboxCatalogMenu();
      closeLightboxSearchScopeMenu();
      return;
    }
    if (event.key === "Escape" && isBrowserFullscreenActive()) {
      event.preventDefault();
      exitBrowserFullscreen().catch(() => {});
      return;
    }
    const target = event.target;
    const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isTyping) {
      if (event.key === "Escape") {
        hideLightboxSearchResults({ blurTopUiFocus: true });
      }
      return;
    }
    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowRight") moveLightbox(-1);
    else if (event.key === "ArrowLeft") moveLightbox(1);
    else if (event.key === "ArrowDown") showPageRailTemporarily(3000);
    else if (event.key === "Home") setLightboxPage(1, { smooth: true, hit: state.viewerMode === "scroll" });
    else if (event.key === "End" && state.catalog) setLightboxPage(state.catalog.pages, { smooth: true, hit: state.viewerMode === "scroll" });
  });

  window.addEventListener("hashchange", () => {
    const route = parseHash();
    if (!route) {
      syncCatalogCategoryFocusFromHash();
      return;
    }
    const target = catalogs.find((item) => item.id === route.id);
    if (!target) return;

    if (!state.catalog || state.catalog.id !== target.id) {
      openCatalog(target.id, route.lightbox ? { openPage: route.page, viewerMode: route.viewerMode } : {});
      return;
    }

    if (route.lightbox) {
      openLightbox(route.page, { mode: route.viewerMode });
    } else if (state.lightboxOpen) {
      closeLightbox();
    }
  });
}

function init() {
  initRevealObserver();
  initCategoryNavFit();
  attachEvents();

  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  renderCatalogCards();
  renderGlobalSearchScopeMenu();
  syncCatalogCategoryFocusFromHash({ animate: false, scroll: true });
  fillCatalogSelect();
  initSearchStatus();
  const route = parseHash();
  if (route && catalogs.some((item) => item.id === route.id)) {
    openCatalog(route.id, route.lightbox ? { openPage: route.page, viewerMode: route.viewerMode } : {});
  }
}

init();
