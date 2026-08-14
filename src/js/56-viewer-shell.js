/**
 * Source module: 56-viewer-shell.js
 * Viewer chrome, top controls, page rail, progress indicators, and fit-mode UI.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { PointLike, RectLike, ViewerPageIndicatorOptions, ViewerRailRenderOptions } from "../../types/frontend-contracts.js" */

import { catalogPageNumbers } from "./06-catalog-page-numbering.js";
import { getFeatureInterface } from "./10-app-state.js";
import { AUTO_VIEWER_ZOOM, VIEWER_FIT_HEIGHT, VIEWER_FIT_SOURCE_AUTO, VIEWER_FIT_SOURCE_MANUAL, VIEWER_FIT_WIDTH, VIEWER_PAGE_INDICATOR_HIDE_MS, VIEWER_ZOOM_INDICATOR_HIDE_MS, viewerChromeState, viewerElements, viewerOnboardingState, viewerViewportState } from "./16-viewer-state.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { catalogImageDimensionAttributes, catalogImageRecoveryAttributes, clampPage, findCatalogById } from "./20-catalog-runtime.js";
import { clampValue, escapeHtml } from "./19-shared-pure.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { pageSrc, thumbSrc } from "./17-catalog-asset-urls.js";
import { hasHoverPointer, isTouchLikePointer, setTooltipText } from "./21-ui-runtime.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";
import { isViewerSessionOpen } from "./51-viewer-session-state.js";
import { getSafeViewerZoom, isAutoViewerZoom, normalizeViewerFitMode, viewerUsesAutomaticFitMode } from "./54-viewer-geometry.js";

function showTopUiTemporarily(delay = 2200) {
  if (!viewerElements.lightbox) return;
  window.clearTimeout(viewerChromeState.uiHideTimer);
  viewerElements.lightbox.classList.add("show-ui");
  if (viewerChromeState.topUiPinned || viewerChromeState.viewerMobileMoreOpen) return;
  if (delay > 0) {
    viewerChromeState.uiHideTimer = window.setTimeout(() => {
      if (!viewerChromeState.topUiPinned && !viewerChromeState.viewerMobileMoreOpen) viewerElements.lightbox.classList.remove("show-ui");
    }, delay);
  }
}


function getLightboxPinnedTopOffset() {
  if (!viewerChromeState.topUiPinned || !viewerElements.lightboxBar) return 0;

  const rect = viewerElements.lightboxBar.getBoundingClientRect?.();
  const measuredHeight = rect ? Math.max(rect.height || 0, rect.bottom > 0 ? rect.bottom : 0) : 0;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const maxReasonableOffset = Math.max(0, viewportHeight * 0.42);
  return Math.round(clampValue(measuredHeight, 0, maxReasonableOffset));
}

function syncLightboxTopSafeArea() {
  if (!viewerElements.lightbox) return 0;

  const offset = getLightboxPinnedTopOffset();
  viewerElements.lightbox.style.setProperty("--lightbox-top-safe-offset", `${offset}px`);
  return offset;
}

function syncTopUiPinnedUi() {
  const pinned = Boolean(viewerChromeState.topUiPinned);
  const label = pinned ? "ביטול נעיצת הסרגל העליון" : "נעיצת הסרגל העליון";

  window.clearTimeout(viewerChromeState.uiHideTimer);
  viewerElements.lightbox?.classList.toggle("top-ui-pinned", pinned);
  if (pinned) viewerElements.lightbox?.classList.add("show-ui");
  syncLightboxTopSafeArea();

  if (!viewerElements.lightboxPinTopBar) return;
  viewerElements.lightboxPinTopBar.dataset.pinned = pinned ? "true" : "false";
  viewerElements.lightboxPinTopBar.setAttribute("aria-pressed", pinned ? "true" : "false");
  viewerElements.lightboxPinTopBar.setAttribute("aria-label", label);
  setTooltipText(viewerElements.lightboxPinTopBar, label, { updateDefault: true });
}

/** @param {Event|null|undefined} event @returns {PointLike|null} */
function getViewportPointer(event) {
  if (!(event instanceof MouseEvent)) return null;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** @param {PointLike|null} point @param {RectLike|DOMRect|null|undefined} rect @param {number} [padding] */
function pointInRect(point, rect, padding = 0) {
  if (!point || !rect) return false;
  return point.x >= rect.left - padding && point.x <= rect.right + padding && point.y >= rect.top - padding && point.y <= rect.bottom + padding;
}

/** @param {Event|null} [event] */
function shouldKeepTopUiOpenForPointer(event = null) {
  if (viewerChromeState.topUiPinned || viewerChromeState.viewerMobileMoreOpen) return true;
  const point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxBar) return false;

  const barRect = viewerElements.lightboxBar.getBoundingClientRect();
  const hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, barRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the toolbar may still be above the viewport,
  // so the pointer can be in the top trigger strip before it is geometrically
  // inside the toolbar. Keep the toolbar open for that whole top-edge region
  // instead of requiring the user to wait until the transition finishes.
  const topHoldBottom = Math.max(2, hotspotRect?.bottom || 0, barRect.top + 2);
  if (point.y <= topHoldBottom) return true;

  return false;
}

/** @param {Event|null} [event] */
function scheduleTopUiClose(event = null) {
  if (!viewerElements.lightbox || !isViewerSessionOpen() || viewerChromeState.topUiPinned || viewerChromeState.viewerMobileMoreOpen) return;
  if (shouldKeepTopUiOpenForPointer(event)) return;
  window.clearTimeout(viewerChromeState.uiHideTimer);
  viewerChromeState.uiHideTimer = window.setTimeout(() => {
    if (!viewerChromeState.topUiPinned && !viewerChromeState.viewerMobileMoreOpen) viewerElements.lightbox?.classList.remove("show-ui");
  }, 420);
}

/** @param {Event|null} [event] */
function shouldKeepPageRailOpenForPointer(event = null) {
  const point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxPageRail) return false;

  const railRect = viewerElements.lightboxPageRail.getBoundingClientRect();
  const hotspotRect = viewerElements.lightboxSideHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, railRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the rail can still be geometrically outside
  // the viewport, while the pointer is already on the right activation strip or
  // in the tiny edge gap. Keep the rail open for that whole right-edge region
  // instead of requiring the user to wait until the transition finishes.
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40));
  const rightHoldLeft = Math.max(0, Math.min(hotspotRect?.left ?? viewportWidth, viewportWidth - hotspotWidth));
  const rightHoldRight = viewportWidth + 1;
  const isInRightHoldRegion = point.x >= rightHoldLeft - 1 && point.x <= rightHoldRight + 1 && point.y >= 0 && point.y <= viewportHeight;
  if (isInRightHoldRegion) return true;

  // The rail is intentionally offset a few pixels from the right viewport edge.
  // Treat that physical edge as a hover hold zone so a fast move to the right
  // edge does not start the rail animation and immediately close it.
  const reachedRightEdgeFromRail = point.x >= railRect.right - 1 && point.x <= viewportWidth + 1 && point.y >= 0 && point.y <= viewportHeight;
  if (reachedRightEdgeFromRail) return true;

  return false;
}

/** @param {MouseEvent|PointerEvent} event */
function handleLightboxHoverHoldPointerMove(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;

  if (viewerElements.lightbox?.classList.contains("show-ui") && !shouldKeepTopUiOpenForPointer(event)) {
    scheduleTopUiClose(event);
  }

  if (viewerElements.lightbox?.classList.contains("show-page-rail") && !shouldKeepPageRailOpenForPointer(event)) {
    schedulePageRailClose(event);
  }
}

function getViewportSize() {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0
  };
}

/** @param {PointLike|null} point */
function isPointInTopEdgeActivationZone(point) {
  if (!point || viewerChromeState.topUiPinned) return false;
  const { width } = getViewportSize();
  const hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.();
  const hotspotHeight = Math.max(2, Math.round(hotspotRect?.height || 34));
  const activationBottom = Math.max(hotspotRect?.bottom || 0, hotspotHeight);
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= activationBottom;
}

function getRightEdgeViewerNavigationRect() {
  const candidates = [viewerElements.prevPageBtn, viewerElements.nextPageBtn]
    .map((button) => button?.getBoundingClientRect?.())
    .filter((rect) => rect && rect.width > 0 && rect.height > 0);
  if (!candidates.length) return null;
  return candidates.reduce((rightmost, rect) => rect.right > rightmost.right ? rect : rightmost);
}

/** @param {PointLike|null} point */
function isPointInPageRailNavigationConflictZone(point) {
  const navigationRect = getRightEdgeViewerNavigationRect();
  return pointInRect(point, navigationRect, 4);
}

/** @param {PointLike|null} point */
function isPointInPageRailEdgeActivationZone(point) {
  if (!point || !viewerElements.lightboxSideHotspot || !viewerElements.lightboxPageRail) return false;
  const { width, height } = getViewportSize();
  const hotspotRect = viewerElements.lightboxSideHotspot.getBoundingClientRect();
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40));
  const activationLeft = Math.max(0, Math.min(hotspotRect?.left ?? width, width - hotspotWidth));
  // Coordinate-based activation reaches the physical viewport edge even when a
  // fast mouse move lands beyond the DOM hotspot. The page-navigation button on
  // the same side keeps its own compact hit area, so merely aiming for that
  // control does not unexpectedly reveal the thumbnail rail.
  const activationRight = width + 1;
  const insideEdgeStrip = point.x >= activationLeft && point.x <= activationRight && point.y >= 0 && point.y <= height;
  if (!insideEdgeStrip) return false;
  if (isPointInPageRailNavigationConflictZone(point) && point.x <= hotspotRect.right) return false;
  return true;
}

/** @param {PointLike|null} point */
function openLightboxEdgeUiForPointer(point) {
  if (isPointInTopEdgeActivationZone(point)) {
    showTopUiTemporarily(0);
  }

  if (isPointInPageRailEdgeActivationZone(point)) {
    showPageRailTemporarily(0);
  }
}

/** @param {MouseEvent} event */
function handleLightboxEdgeHoverMove(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;
  const point = getViewportPointer(event);
  openLightboxEdgeUiForPointer(point);
  handleLightboxHoverHoldPointerMove(event);
}

/** @param {MouseEvent & {toElement?:EventTarget|null}} event */
function handleLightboxEdgeHoverViewportExit(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;
  if (event.relatedTarget || event.toElement) return;

  const point = getViewportPointer(event);
  if (!point) return;

  const { width, height } = getViewportSize();
  if (point.y <= 0 && point.x >= 0 && point.x <= width) {
    showTopUiTemporarily(0);
  }

  if (point.x >= width - 1 && point.y >= 0 && point.y <= height) {
    showPageRailTemporarily(0);
  }
}

function hideLightboxFloatingPreview() {
  viewerElements.lightboxFloatingPreview?.classList.remove("visible");
}

/** @param {HTMLElement|null|undefined} button */
function isLightboxPageRailTrigger(button) {
  return Boolean(button?.closest?.(".lightbox-page-rail"));
}

/** @param {HTMLButtonElement} button */
function positionLightboxFloatingPreview(button) {
  const preview = viewerElements.lightboxFloatingPreview;
  if (!preview || !button) return;

  const buttonRect = button.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();

  if (isLightboxPageRailTrigger(button)) {
    const previewHeight = previewRect.height || Math.min(620, window.innerHeight * 0.74);
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

  const previewWidth = previewRect.width || Math.min(420, window.innerWidth * 0.34);
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

/** @param {HTMLButtonElement} button */
function showLightboxFloatingPreview(button) {
  if (!button || !viewerElements.lightboxFloatingPreview || !viewerElements.lightboxFloatingPreviewImage) return;

  const previewCatalog = findCatalogById(button.dataset.previewCatalog) || activeCatalog();
  if (!previewCatalog) return;
  const page = clampPage(button.dataset.previewPage || button.dataset.page, previewCatalog);
  const src = button.dataset.previewSrc || pageSrc(previewCatalog, page);
  const previewImage = viewerElements.lightboxFloatingPreviewImage;
  previewImage.removeAttribute("width");
  previewImage.removeAttribute("height");
  previewImage.onload = () => positionLightboxFloatingPreview(button);
  previewImage.src = src;
  previewImage.alt = `${previewCatalog.title} - עמוד ${page}`;
  if (viewerElements.lightboxFloatingPreviewPage) {
    viewerElements.lightboxFloatingPreviewPage.textContent = isFavoritesLightboxMode()
      ? `${previewCatalog.title} · עמוד ${page}`
      : `עמוד ${page}`;
  }
  viewerElements.lightboxFloatingPreview.classList.toggle("from-page-rail", isLightboxPageRailTrigger(button));
  viewerElements.lightboxFloatingPreview.classList.add("visible");
  positionLightboxFloatingPreview(button);
}

/** @param {ViewerRailRenderOptions} [options] */
function updateLightboxThumbs(options = {}) {
  const { scrollIntoView = true } = options;
  const rail = viewerElements.lightboxPageThumbs;
  if (!rail) return;

  const previous = rail.querySelector('.lightbox-page-thumb[aria-current="page"]');
  const favoriteViewerIndex = getFeatureInterface("favorites")?.viewerIndex() ?? 0;
  const selector = isFavoritesLightboxMode()
    ? `.lightbox-page-thumb[data-favorite-index="${favoriteViewerIndex}"]`
    : `.lightbox-page-thumb[data-page="${activePage()}"]`;
  const active = rail.querySelector(selector);

  if (previous && previous !== active) {
    previous.classList.remove("active");
    previous.removeAttribute("aria-current");
  }
  if (!active) return;

  active.classList.add("active");
  active.setAttribute("aria-current", "page");
  if (scrollIntoView && viewerElements.lightbox?.classList.contains("show-page-rail")) {
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function renderLightboxPageRail() {
  const activeCatalogRecord = activeCatalog();
  if (!activeCatalogRecord || !viewerElements.lightboxPageThumbs) return;
  const thumbs = [];

  if (isFavoritesLightboxMode()) {
    const favorites = getFeatureInterface("favorites");
    const entries = favorites?.entries() || [];
    const favoriteViewerIndex = favorites?.viewerIndex() ?? 0;
    if (viewerElements.lightboxPageRailTitle) viewerElements.lightboxPageRailTitle.textContent = "מועדפים";
    viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין המועדפים");

    entries.forEach(({ catalog, page }, index) => {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      const title = escapeHtml(catalog.title || "קטלוג");
      const active = index === favoriteViewerIndex;
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${active ? " active" : ""}" type="button" data-favorite-index="${index}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר למועדף ${index + 1}: ${title}, עמוד ${page}"${active ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-thumbnail-rail")} />
          </span>
          <span class="lightbox-page-thumb-number">${index + 1}</span>
        </button>
      `);
    });
  } else {
    const catalog = activeCatalogRecord;
    if (viewerElements.lightboxPageRailTitle) viewerElements.lightboxPageRailTitle.textContent = "עמודים";
    viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין עמודי הקטלוג");

    for (const page of catalogPageNumbers(catalog)) {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === activePage() ? " active" : ""}" type="button" data-page="${page}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר לעמוד ${page}"${page === activePage() ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-thumbnail-rail")} />
          </span>
          <span class="lightbox-page-thumb-number">${page}</span>
        </button>
      `);
    }
  }

  viewerElements.lightboxPageThumbs.innerHTML = thumbs.join("");
  /** @type {NodeListOf<HTMLButtonElement>} */
  const pageThumbButtons = viewerElements.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb");
  pageThumbButtons.forEach((button) => {
    button.addEventListener("pointerenter", () => showLightboxFloatingPreview(button));
    button.addEventListener("pointerleave", hideLightboxFloatingPreview);
    button.addEventListener("focus", () => showLightboxFloatingPreview(button));
    button.addEventListener("blur", hideLightboxFloatingPreview);
  });
}

function syncViewerMobileMoreMenuState() {
  const menu = viewerElements.viewerMobileMoreMenu;
  if (!menu) return;
  const fitMode = normalizeViewerFitMode(viewerViewportState.imageFitMode);
  const automatic = viewerUsesAutomaticFitMode();
  const pinItem = menu.querySelector('[data-viewer-mobile-action="pin"]');
  const autoItem = menu.querySelector('[data-viewer-mobile-action="fit-auto"]');
  const heightItem = menu.querySelector('[data-viewer-mobile-action="fit-height"]');
  const widthItem = menu.querySelector('[data-viewer-mobile-action="fit-width"]');
  const pinLabel = menu.querySelector("[data-viewer-mobile-pin-label]");

  pinItem?.setAttribute("aria-checked", viewerChromeState.topUiPinned ? "true" : "false");
  pinItem?.classList.toggle("active", viewerChromeState.topUiPinned);
  if (pinLabel) pinLabel.textContent = viewerChromeState.topUiPinned ? "ביטול נעיצת הסרגל" : "נעיצת הסרגל";
  autoItem?.setAttribute("aria-checked", automatic ? "true" : "false");
  autoItem?.classList.toggle("active", automatic);
  heightItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_HEIGHT ? "true" : "false");
  heightItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_HEIGHT);
  widthItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_WIDTH ? "true" : "false");
  widthItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_WIDTH);
}

function syncViewerFitModeUi() {
  const fitMode = normalizeViewerFitMode(viewerViewportState.imageFitMode);
  const automatic = viewerUsesAutomaticFitMode();
  viewerViewportState.imageFitMode = fitMode;

  viewerElements.lightbox?.classList.toggle("fit-height", fitMode === VIEWER_FIT_HEIGHT);
  viewerElements.lightbox?.classList.toggle("fit-width", fitMode === VIEWER_FIT_WIDTH);

  if (viewerElements.fitAutoBtn) {
    viewerElements.fitAutoBtn.setAttribute("aria-pressed", automatic ? "true" : "false");
    viewerElements.fitAutoBtn.setAttribute("aria-label", "התאמת תצוגה אוטומטי");
    setTooltipText(viewerElements.fitAutoBtn, "התאמת תצוגה אוטומטי", { updateDefault: true });
  }

  if (viewerElements.fitHeightBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_HEIGHT;
    viewerElements.fitHeightBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    viewerElements.fitHeightBtn.setAttribute("aria-label", "התאמת התמונה לגובה");
    setTooltipText(viewerElements.fitHeightBtn, "התאמה לגובה", { updateDefault: true });
  }

  if (viewerElements.fitWidthBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_WIDTH;
    viewerElements.fitWidthBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    viewerElements.fitWidthBtn.setAttribute("aria-label", "התאמת התמונה לרוחב");
    setTooltipText(viewerElements.fitWidthBtn, "התאמה לרוחב", { updateDefault: true });
  }

  syncViewerAutoZoomButtonUi();
  syncViewerMobileMoreMenuState();
}


function syncViewerAutoZoomButtonUi() {
  if (!viewerElements.viewerAutoZoomBtn) return;

  const showButton = Boolean(isViewerSessionOpen() && !isAutoViewerZoom());

  viewerElements.viewerAutoZoomBtn.classList.toggle("hidden", !showButton);
  viewerElements.viewerAutoZoomBtn.setAttribute("aria-hidden", showButton ? "false" : "true");
  viewerElements.viewerAutoZoomBtn.setAttribute("tabindex", showButton ? "0" : "-1");
  viewerElements.viewerAutoZoomBtn.setAttribute("aria-label", "חזרה לזום אוטומטי");

  // Keep the button itself icon-only and stationary; the clear explanation lives
  // in the shared floating tooltip so hover/focus never changes the button size.
  setTooltipText(viewerElements.viewerAutoZoomBtn, "חזרה לזום אוטומטי", { updateDefault: true });
}

function formatViewerZoomPercent(value = viewerViewportState.zoom) {
  return `${Math.round(getSafeViewerZoom(value) * 100)}%`;
}

function hideViewerZoomIndicator() {
  window.clearTimeout(viewerChromeState.zoomIndicatorHideTimer);
  viewerChromeState.zoomIndicatorHideTimer = 0;
  viewerElements.viewerZoomIndicator?.classList.remove("visible");
}

function showViewerZoomIndicator(value = viewerViewportState.zoom) {
  const indicator = viewerElements.viewerZoomIndicator;
  if (!indicator || !isViewerSessionOpen()) return;

  indicator.textContent = formatViewerZoomPercent(value);
  indicator.classList.add("visible");

  window.clearTimeout(viewerChromeState.zoomIndicatorHideTimer);
  viewerChromeState.zoomIndicatorHideTimer = window.setTimeout(() => {
    indicator.classList.remove("visible");
    viewerChromeState.zoomIndicatorHideTimer = 0;
  }, VIEWER_ZOOM_INDICATOR_HIDE_MS);
}

function syncLightboxModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  viewerElements.lightbox?.classList.add("catalog-entry-mode");
  viewerElements.lightbox?.classList.toggle("favorites-viewer-mode", favoritesMode);
  getFeatureInterface("favorites")?.syncViewerMode(favoritesMode);
  viewerElements.prevPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הקודם" : "העמוד הקודם");
  viewerElements.nextPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הבא" : "העמוד הבא");
  syncViewerLayoutModeUi();
  syncViewerFitModeUi();

  if (viewerElements.lightboxModeLabel) {
    viewerElements.lightboxModeLabel.textContent = favoritesMode ? "תצוגת מועדפים" : "כניסה לקטלוג";
  }
}



/** @param {Event|null} [event] */
function isObservedMouseHoverEvent(event = null) {
  if (event && "pointerType" in event && event.pointerType === "mouse") return true;
  return String(event?.type || "").startsWith("mouse");
}

/** @param {Event|null|undefined} event */
function markTouchLikeViewportInput(event) {
  if (isTouchLikePointer(event) || event?.type === "touchstart") {
    viewerChromeState.lastTouchLikeViewportInputAt = Date.now();
  }
}

function hasRecentTouchLikeViewportInput(timeout = 900) {
  return Date.now() - viewerChromeState.lastTouchLikeViewportInputAt < timeout;
}

/** @param {Event|null} [event] */
function openTopUiFromHotspot(event = null) {
  if (!isViewerSessionOpen() || viewerOnboardingState.viewerOnboardingOpen) return;
  markTouchLikeViewportInput(event);
  showTopUiTemporarily(0);
}

/** @param {Event|null|undefined} event */
function markTouchLikeRailInput(event) {
  if (isTouchLikePointer(event)) {
    viewerChromeState.lastTouchLikeRailInputAt = Date.now();
  }
  markTouchLikeViewportInput(event);
}

function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - viewerChromeState.lastTouchLikeRailInputAt < timeout;
}

/** @param {Event|null} [event] */
function shouldUseLightboxHoverPointer(event = null) {
  if (!isViewerSessionOpen()) return false;
  if (isTouchLikePointer(event) || hasRecentTouchLikeViewportInput()) return false;

  // Hybrid Windows devices can keep reporting a coarse/no-hover primary input
  // even while a real mouse is actively producing mouse events. Trust observed
  // mouse input first; the recent-touch guard above still filters the synthetic
  // mouse events browsers may emit after a tap.
  if (isObservedMouseHoverEvent(event)) return true;
  return hasHoverPointer();
}

/** @param {Event|null} [event] */
function shouldUsePageRailHover(event = null) {
  if (!shouldUseLightboxHoverPointer(event)) return false;
  if (hasRecentTouchLikeRailInput()) return false;
  return true;
}

/** @param {number} [delay] @param {ViewerRailRenderOptions} [options] */
function showPageRailTemporarily(delay = 2600, options = {}) {
  const { scrollIntoView = true } = options;
  if (!viewerElements.lightbox || !isViewerSessionOpen()) return;
  window.clearTimeout(viewerChromeState.pageRailHideTimer);
  viewerElements.lightbox.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
  if (delay > 0) {
    viewerChromeState.pageRailHideTimer = window.setTimeout(() => {
      viewerElements.lightbox?.classList.remove("show-page-rail");
    }, delay);
  }
}

/** @param {ViewerRailRenderOptions} [options] */
function keepPageRailOpen(options = {}) {
  const { scrollIntoView = true } = options;
  if (!isViewerSessionOpen()) return;
  window.clearTimeout(viewerChromeState.pageRailHideTimer);
  viewerElements.lightbox?.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
}

/** @param {Event|null} [event] */
function schedulePageRailClose(event = null) {
  if (!shouldUsePageRailHover(event)) return;
  if (shouldKeepPageRailOpenForPointer(event)) return;
  window.clearTimeout(viewerChromeState.pageRailHideTimer);
  viewerChromeState.pageRailHideTimer = window.setTimeout(() => {
    viewerElements.lightbox?.classList.remove("show-page-rail");
  }, 420);
}

/** @param {PointerEvent} event */
function openPageRailFromTouch(event) {
  if (!isTouchLikePointer(event)) return;
  markTouchLikeRailInput(event);
  event.preventDefault?.();
  keepPageRailOpen();
}

/** @param {PointerEvent} event */
function handleLightboxPageRailEdgePointerDown(event) {
  if (!isTouchLikePointer(event) || !isViewerSessionOpen() || viewerOnboardingState.viewerOnboardingOpen) return;
  if (viewerElements.lightboxPageRail?.contains(eventTargetElement(event.target))) return;

  const point = getViewportPointer(event);
  if (!isPointInPageRailEdgeActivationZone(point)) return;

  markTouchLikeRailInput(event);
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  event.stopPropagation?.();
  keepPageRailOpen();
}

/** @param {Event|null} [event] */
function openPageRailFromHotspot(event = null) {
  if (hasRecentTouchLikeRailInput()) {
    keepPageRailOpen();
    return;
  }
  showPageRailTemporarily(shouldUsePageRailHover(event) ? 2600 : 0);
}

/** @param {Event|null} [event] */
function showPageRailFromHover(event = null) {
  if (shouldUsePageRailHover(event)) showPageRailTemporarily(0);
}

/** @param {Event|null} [event] */
function keepPageRailOpenFromHover(event = null) {
  if (shouldUsePageRailHover(event)) keepPageRailOpen();
}

/** @param {PointerEvent} event */
function handlePageRailPointerOutside(event) {
  if (!viewerElements.lightbox || !isViewerSessionOpen()) return;
  if (!viewerElements.lightbox.classList.contains("show-page-rail")) return;

  const target = eventTargetElement(event.target);
  if (viewerElements.lightboxPageRail?.contains(target) || viewerElements.lightboxSideHotspot?.contains(target)) return;
  if (!isTouchLikePointer(event) && shouldUsePageRailHover(event)) return;

  window.clearTimeout(viewerChromeState.pageRailHideTimer);
  hideLightboxFloatingPreview();
  viewerElements.lightbox.classList.remove("show-page-rail");
}
















function hideViewerPageIndicator() {
  window.clearTimeout(viewerChromeState.pageIndicatorHideTimer);
  viewerChromeState.pageIndicatorHideTimer = 0;
  viewerElements.viewerPageIndicator?.classList.remove("visible");
}

function showViewerPageIndicatorTemporarily(delay = VIEWER_PAGE_INDICATOR_HIDE_MS) {
  if (!isViewerSessionOpen() || !viewerElements.viewerPageIndicator) return;

  window.clearTimeout(viewerChromeState.pageIndicatorHideTimer);
  viewerElements.viewerPageIndicator.classList.add("visible");
  if (delay <= 0) return;

  viewerChromeState.pageIndicatorHideTimer = window.setTimeout(() => {
    viewerElements.viewerPageIndicator?.classList.remove("visible");
    viewerChromeState.pageIndicatorHideTimer = 0;
  }, delay);
}

/** @param {number|string} current @param {number|string} total @param {string} title @param {ViewerPageIndicatorOptions} [options] */
function syncLightboxProgress(current, total, title, options = {}) {
  if (!viewerElements.lightboxProgress) return;
  const totalItems = Math.max(1, Number.parseInt(String(total), 10) || 1);
  const currentItem = clampValue(Number.parseInt(String(current), 10) || 1, 1, totalItems);
  const ratio = totalItems <= 1 ? 1 : currentItem / totalItems;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const parsedDisplayCurrent = Number.parseInt(String(options.displayCurrent ?? currentItem), 10);
  const parsedDisplayTotal = Number.parseInt(String(options.displayTotal ?? totalItems), 10);
  const displayCurrent = Number.isFinite(parsedDisplayCurrent) ? parsedDisplayCurrent : currentItem;
  const displayTotal = Number.isFinite(parsedDisplayTotal) ? parsedDisplayTotal : totalItems;
  const label = String(options.label || "עמוד");
  const detail = String(options.detail || "").trim();
  const accessibleTitle = title || `${label} ${displayCurrent} מתוך ${displayTotal}`;

  viewerElements.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio));
  viewerElements.lightboxProgress.style.setProperty("--catalog-progress-percent", `${clampedRatio * 100}%`);
  viewerElements.lightboxProgress.setAttribute("aria-valuemin", "1");
  viewerElements.lightboxProgress.setAttribute("aria-valuemax", String(totalItems));
  viewerElements.lightboxProgress.setAttribute("aria-valuenow", String(currentItem));
  viewerElements.lightboxProgress.setAttribute("aria-valuetext", accessibleTitle);
  viewerElements.lightboxProgress.setAttribute("title", accessibleTitle);

  if (viewerElements.viewerPageIndicator) {
    viewerElements.viewerPageIndicatorLabel.textContent = label;
    viewerElements.viewerPageIndicatorCurrent.textContent = String(displayCurrent);
    viewerElements.viewerPageIndicatorTotal.textContent = String(displayTotal);
    if (viewerElements.viewerPageIndicatorDetail) {
      viewerElements.viewerPageIndicatorDetail.textContent = detail;
      viewerElements.viewerPageIndicatorDetail.classList.toggle("hidden", !detail);
    }
    viewerElements.viewerPageIndicator.setAttribute("title", accessibleTitle);
    showViewerPageIndicatorTemporarily();
  }
}


function syncViewerLayoutModeUi() {
  // The catalog and favorites routes now share one paged, single-image renderer.
  // Keeping one rendering contract avoids decoded multi-page DOM state while all
  // input methods still resolve to the same previous/next-page operation.
  viewerElements.lightbox?.classList.add("viewer-layout-paged");
  viewerElements.lightbox?.classList.remove("viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated");
  viewerElements.lightboxImageFrame?.classList.remove("hidden");
}


export {
  getRightEdgeViewerNavigationRect,
  getViewportPointer,
  handleLightboxEdgeHoverMove,
  handleLightboxEdgeHoverViewportExit,
  handleLightboxPageRailEdgePointerDown,
  handlePageRailPointerOutside,
  hideLightboxFloatingPreview,
  hideViewerPageIndicator,
  hideViewerZoomIndicator,
  isPointInPageRailEdgeActivationZone,
  isPointInPageRailNavigationConflictZone,
  keepPageRailOpen,
  keepPageRailOpenFromHover,
  markTouchLikeRailInput,
  markTouchLikeViewportInput,
  openPageRailFromHotspot,
  openPageRailFromTouch,
  openTopUiFromHotspot,
  renderLightboxPageRail,
  schedulePageRailClose,
  scheduleTopUiClose,
  shouldUseLightboxHoverPointer,
  shouldUsePageRailHover,
  showPageRailFromHover,
  showPageRailTemporarily,
  showTopUiTemporarily,
  showViewerZoomIndicator,
  syncLightboxModeUi,
  syncLightboxProgress,
  syncLightboxTopSafeArea,
  syncTopUiPinnedUi,
  syncViewerAutoZoomButtonUi,
  syncViewerFitModeUi,
  syncViewerMobileMoreMenuState,
  updateLightboxThumbs
};
