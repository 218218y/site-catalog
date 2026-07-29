/**
 * Source module: 62-viewer-actions.js
 * Compact Viewer mobile utility menu.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into route-specific browser bundles.
 */

const MOBILE_VIEWER_TOOLBAR_MEDIA = "(max-width: 760px)";

function isMobileViewerToolbarMode() {
  return Boolean(window.matchMedia?.(MOBILE_VIEWER_TOOLBAR_MEDIA).matches);
}

function syncViewerMobileMoreMenuState() {
  const menu = viewerElements.viewerMobileMoreMenu;
  if (!menu) return;
  const fitMode = normalizeViewerFitMode(viewerState.imageFitMode);
  const automatic = viewerUsesAutomaticFitMode();
  const pinItem = menu.querySelector('[data-viewer-mobile-action="pin"]');
  const autoItem = menu.querySelector('[data-viewer-mobile-action="fit-auto"]');
  const heightItem = menu.querySelector('[data-viewer-mobile-action="fit-height"]');
  const widthItem = menu.querySelector('[data-viewer-mobile-action="fit-width"]');
  const pinLabel = menu.querySelector("[data-viewer-mobile-pin-label]");

  pinItem?.setAttribute("aria-checked", viewerState.topUiPinned ? "true" : "false");
  pinItem?.classList.toggle("active", viewerState.topUiPinned);
  if (pinLabel) pinLabel.textContent = viewerState.topUiPinned ? "ביטול נעיצת הסרגל" : "נעיצת הסרגל";
  autoItem?.setAttribute("aria-checked", automatic ? "true" : "false");
  autoItem?.classList.toggle("active", automatic);
  heightItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_HEIGHT ? "true" : "false");
  heightItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_HEIGHT);
  widthItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_WIDTH ? "true" : "false");
  widthItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_WIDTH);
}

/** @param {boolean} open @param {{returnFocus?:boolean}} [options] */
function setViewerMobileMoreOpen(open, options = {}) {
  const shouldOpen = Boolean(open && isViewerSessionOpen() && isMobileViewerToolbarMode());
  viewerState.viewerMobileMoreOpen = shouldOpen;
  syncViewerMobileMoreMenuState();
  viewerElements.viewerMobileMoreMenu?.classList.toggle("hidden", !shouldOpen);
  viewerElements.viewerMobileMoreMenu?.classList.toggle("visible", shouldOpen);
  viewerElements.viewerMobileMoreToggle?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  viewerElements.viewerMobileMoreToggle?.classList.toggle("is-active", shouldOpen);
  viewerElements.lightbox?.classList.toggle("mobile-more-open", shouldOpen);

  if (shouldOpen) {
    showTopUiTemporarily(0);
    window.requestAnimationFrame(() => {
      focusHtmlElement(viewerElements.viewerMobileMoreMenu?.querySelector('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'), { preventScroll: true });
    });
  } else if (options.returnFocus) {
    viewerElements.viewerMobileMoreToggle?.focus?.({ preventScroll: true });
  }
}

function closeViewerMobileMoreMenu(options = {}) {
  setViewerMobileMoreOpen(false, options);
}

/** @returns {HTMLElement[]} */
function getViewerMobileMoreItems() {
  if (!viewerElements.viewerMobileMoreMenu) return [];
  return Array.from(viewerElements.viewerMobileMoreMenu.querySelectorAll(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
  )).filter(isHtmlElement).filter((item) => !item.classList.contains("hidden") && item.getAttribute("aria-hidden") !== "true");
}

/** @param {KeyboardEvent} event */
function handleViewerMobileMoreKeydown(event) {
  if (!viewerState.viewerMobileMoreOpen) return;
  const items = getViewerMobileMoreItems();
  if (!items.length) return;

  const currentIndex = Math.max(0, isHtmlElement(document.activeElement) ? items.indexOf(document.activeElement) : 0);
  let nextIndex = -1;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = items.length - 1;
  else return;

  event.preventDefault();
  focusHtmlElement(items[nextIndex], { preventScroll: true });
}

/** @param {Event} event */
function handleViewerMobileMoreAction(event) {
  const item = eventTargetElement(event.target)?.closest("[data-viewer-mobile-action]");
  if (!isHtmlElement(item) || !viewerElements.viewerMobileMoreMenu?.contains(item)) return;
  event.preventDefault();
  event.stopPropagation();
  const action = item.dataset.viewerMobileAction;

  if (action === "download") downloadCurrentLightboxImage();
  else if (action === "pin") toggleTopUiPinned();
  else if (action === "fit-auto") setViewerAutomaticFitMode({ showUi: false });
  else if (action === "fit-height") setViewerFitMode(VIEWER_FIT_HEIGHT, { showUi: false });
  else if (action === "fit-width") setViewerFitMode(VIEWER_FIT_WIDTH, { showUi: false });

  syncViewerMobileMoreMenuState();
  closeViewerMobileMoreMenu({ returnFocus: true });
}

function attachViewerActionEvents() {
  viewerElements.viewerMobileMoreToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setViewerMobileMoreOpen(!viewerState.viewerMobileMoreOpen, { returnFocus: viewerState.viewerMobileMoreOpen });
  });
  viewerElements.viewerMobileMoreMenu?.addEventListener("click", handleViewerMobileMoreAction);
  viewerElements.viewerMobileMoreMenu?.addEventListener("keydown", handleViewerMobileMoreKeydown);

  document.addEventListener("pointerdown", (event) => {
    if (!viewerState.viewerMobileMoreOpen) return;
    const target = event.target instanceof Node ? event.target : null;
    if (viewerElements.viewerMobileMoreMenu?.contains(target) || viewerElements.viewerMobileMoreToggle?.contains(target)) return;
    closeViewerMobileMoreMenu();
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!isMobileViewerToolbarMode()) closeViewerMobileMoreMenu();
  });
}
