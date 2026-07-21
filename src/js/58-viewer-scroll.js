/**
 * Source module: 58-viewer-scroll.js
 * Continuous viewer rendering, image fallback, isolated zoom, and page navigation.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function getViewerScrollPageLayout(page) {
  const container = els.viewerScrollPages;
  const size = pageSize(state.catalog, page) || { width: 1400, height: 1000 };
  const viewportWidth = container?.clientWidth
    || els.stageCanvas?.clientWidth
    || window.innerWidth
    || 320;
  const viewportHeight = container?.clientHeight
    || els.stageCanvas?.clientHeight
    || window.innerHeight
    || 480;
  const containerStyle = container ? window.getComputedStyle(container) : null;
  const horizontalInset = containerStyle
    ? Math.max(0, Number.parseFloat(containerStyle.paddingLeft) || 0)
    : 17;
  const verticalInset = containerStyle
    ? Math.max(0, Number.parseFloat(containerStyle.paddingTop) || 0)
    : 17;
  const availableWidth = Math.max(220, viewportWidth - horizontalInset * 2);
  const availableHeight = Math.max(220, viewportHeight - verticalInset * 2);
  const widthScale = availableWidth / size.width;
  const heightScale = availableHeight / size.height;
  const scale = state.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;

  return {
    width: Math.max(180, Math.round(size.width * scale)),
    height: Math.max(140, Math.round(size.height * scale))
  };
}

function getViewerScrollPageFrame(page) {
  return els.viewerScrollPages?.querySelector?.(`[data-scroll-page="${page}"]`) || null;
}

function getViewerScrollFrameFocal(page, clientX = null, clientY = null) {
  const frame = getViewerScrollPageFrame(page);
  const container = els.viewerScrollPages;
  if (!frame || !container) return null;

  const frameRect = frame.getBoundingClientRect?.();
  const containerRect = container.getBoundingClientRect?.();
  if (!frameRect?.width || !frameRect?.height || !containerRect?.width || !containerRect?.height) return null;

  const fallbackX = frameRect.left + frameRect.width / 2;
  const fallbackY = frameRect.top + frameRect.height / 2;
  const pointX = Number.isFinite(clientX)
    ? clampValue(clientX, frameRect.left, frameRect.right)
    : clampValue(containerRect.left + containerRect.width / 2, frameRect.left, frameRect.right);
  const pointY = Number.isFinite(clientY)
    ? clampValue(clientY, frameRect.top, frameRect.bottom)
    : clampValue(containerRect.top + containerRect.height / 2, frameRect.top, frameRect.bottom);

  return {
    clientX: Number.isFinite(pointX) ? pointX : fallbackX,
    clientY: Number.isFinite(pointY) ? pointY : fallbackY,
    ratioX: clampValue((pointX - frameRect.left) / frameRect.width, 0, 1),
    ratioY: clampValue((pointY - frameRect.top) / frameRect.height, 0, 1)
  };
}

function syncViewerScrollIsolatedZoomUi() {
  const isolatedZoom = isViewerScrollIsolatedZoom();
  els.lightbox?.classList.toggle("viewer-scroll-zoom-isolated", isolatedZoom);
  els.lightboxImageFrame?.classList.toggle("hidden", isScrollViewerMode() && !isolatedZoom);
}

function prepareViewerScrollIsolatedImage(page) {
  if (!state.catalog || !els.lightboxImage) return;
  const targetPage = clampPage(page, state.catalog);
  const request = viewerPageImageRequest(state.catalog, targetPage);
  const src = request.primarySrc;

  primeLightboxFrameForCatalogPage(state.catalog, targetPage);
  if (els.lightboxImage.getAttribute("src") !== src) {
    els.lightboxImage.removeAttribute("src");
    prepareImagePlaceholder(els.lightboxImage);
  }
  showSingleLightboxImage(state.catalog, targetPage, src, { imageRequest: request });
}

function enterViewerScrollIsolatedZoom(nextZoom, focalClientX = null, focalClientY = null) {
  if (!isScrollViewerMode() || !state.catalog) return false;
  clearViewerScrollPointerHandoff();

  const page = clampPage(state.page, state.catalog);
  const focal = getViewerScrollFrameFocal(page, focalClientX, focalClientY);
  const naturalSize = pageSize(state.catalog, page);
  const stageRect = els.stageCanvas?.getBoundingClientRect?.();
  if (!naturalSize || !stageRect) return false;

  state.viewerScrollIsolatedZoom = true;
  state.viewerScrollIsolatedPage = page;
  state.singleImageFitOriginPending = false;
  state.panX = 0;
  state.panY = 0;
  syncViewerScrollIsolatedZoomUi();

  const layout = applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);
  const zoom = clampViewerZoom(nextZoom);
  if (layout && focal) {
    const contentX = (focal.ratioX - 0.5) * layout.width;
    const contentY = (focal.ratioY - 0.5) * layout.height;
    const centerX = stageRect.left + stageRect.width / 2;
    const centerY = stageRect.top + stageRect.height / 2;
    state.panX = focal.clientX - centerX - contentX * zoom;
    state.panY = focal.clientY - centerY - contentY * zoom;
  }

  state.zoom = zoom;
  applySingleZoom();
  prepareViewerScrollIsolatedImage(page);
  return true;
}

function exitViewerScrollIsolatedZoom(options = {}) {
  if (!state.viewerScrollIsolatedZoom) return false;
  const { restorePage = true, nextZoom = AUTO_VIEWER_ZOOM } = options;

  clearViewerScrollPointerHandoff();
  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  state.singleImageLoadToken += 1;
  state.zoom = clampViewerZoom(nextZoom);
  resetImagePosition();
  state.pointers.clear();
  syncViewerScrollIsolatedZoomUi();
  els.lightboxImageFrame?.classList.remove("page-swap-enter", "is-preparing-swap");
  setViewerLoading(false);
  els.lightbox?.classList.remove("is-page-loading");
  applyViewerScrollZoom(null, { immediate: true });
  els.lightbox?.classList.toggle("is-zoomed", !isAutoViewerZoom());
  syncViewerAutoZoomButtonUi();

  if (restorePage) {
    requestAnimationFrame(() => scrollViewerToPage(state.page, { behavior: "auto" }));
  }
  return true;
}

function resumeViewerScrollFromIsolatedZoom(deltaX = 0, deltaY = 0) {
  if (!isViewerScrollIsolatedZoom()) return false;
  exitViewerScrollIsolatedZoom({ restorePage: true, nextZoom: AUTO_VIEWER_ZOOM });
  requestAnimationFrame(() => {
    const container = els.viewerScrollPages;
    if (!container) return;
    container.scrollBy({
      left: Number.isFinite(deltaX) ? deltaX : 0,
      top: Number.isFinite(deltaY) ? deltaY : 0,
      behavior: "auto"
    });
  });
  return true;
}

function consumeViewerScrollIsolatedPan(deltaX = 0, deltaY = 0) {
  if (!isViewerScrollIsolatedZoom()) return null;

  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return null;

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const previousPanX = state.panX;
  const previousPanY = state.panY;

  // Wheel, precision-trackpad and touch input all consume movement through this
  // single boundary calculation. clampSinglePan includes the isolated viewer's
  // black-canvas exit buffer, so only movement beyond both the real image edge
  // and that deliberate safety distance may leave zoom.
  state.panX = previousPanX - safeDeltaX;
  state.panY = previousPanY - safeDeltaY;
  clampSinglePan();

  const moved = Math.abs(state.panX - previousPanX) > 0.01 || Math.abs(state.panY - previousPanY) > 0.01;
  if (moved) {
    state.singleImageFitOriginPending = false;
    applySingleZoom();
  }

  const consumedDeltaX = previousPanX - state.panX;
  const consumedDeltaY = previousPanY - state.panY;
  return {
    remainingDeltaX: safeDeltaX - consumedDeltaX,
    remainingDeltaY: safeDeltaY - consumedDeltaY,
    hasVerticalExitIntent: Math.abs(safeDeltaY) > Math.abs(safeDeltaX) * 0.5
  };
}

function panViewerScrollIsolatedZoomByWheel(deltaX = 0, deltaY = 0) {
  const result = consumeViewerScrollIsolatedPan(deltaX, deltaY);
  if (!result) return false;

  if (result.hasVerticalExitIntent && Math.abs(result.remainingDeltaY) > 0.75) {
    resumeViewerScrollFromIsolatedZoom(0, result.remainingDeltaY);
  }

  return true;
}

function runViewerScrollPageSwapAnimation(page) {
  const frame = getViewerScrollPageFrame(page);
  if (!frame) return;

  // The target page has already been positioned with an immediate jump. Reuse
  // the single-page viewer's entrance mechanism so arrows, rail selection and
  // touch swipes all produce one identical non-scrolling transition.
  runViewerPageSwapAnimation(frame, {
    timerKey: "viewerScrollPageAnimationTimer",
    root: els.viewerScrollPages
  });
}

function getViewerScrollZoomAnchor(clientX = null, clientY = null) {
  const container = els.viewerScrollPages;
  if (!container || !isScrollViewerMode()) return null;

  const containerRect = container.getBoundingClientRect?.();
  if (!containerRect?.width || !containerRect?.height) return null;

  const viewportX = Number.isFinite(clientX)
    ? clampValue(clientX - containerRect.left, 0, containerRect.width)
    : containerRect.width / 2;
  const viewportY = Number.isFinite(clientY)
    ? clampValue(clientY - containerRect.top, 0, containerRect.height)
    : containerRect.height / 2;
  const pointX = containerRect.left + viewportX;
  const pointY = containerRect.top + viewportY;

  let frame = document.elementFromPoint?.(pointX, pointY)?.closest?.("[data-scroll-page]") || null;
  if (!frame || !container.contains(frame)) {
    frame = getViewerScrollPageFrame(findViewerScrollCenterPage());
  }
  if (!frame) return null;

  const frameRect = frame.getBoundingClientRect?.();
  if (!frameRect?.width || !frameRect?.height) return null;

  return {
    page: Number.parseInt(frame.dataset.scrollPage, 10) || state.page,
    ratioX: clampValue((pointX - frameRect.left) / frameRect.width, 0, 1),
    ratioY: clampValue((pointY - frameRect.top) / frameRect.height, 0, 1),
    viewportX,
    viewportY
  };
}

function restoreViewerScrollZoomAnchor(anchor) {
  const container = els.viewerScrollPages;
  if (!container || !anchor) return false;
  const frame = getViewerScrollPageFrame(anchor.page);
  if (!frame) return false;

  const targetLeft = frame.offsetLeft + frame.offsetWidth * anchor.ratioX - anchor.viewportX;
  const targetTop = frame.offsetTop + frame.offsetHeight * anchor.ratioY - anchor.viewportY;
  const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);

  container.scrollLeft = clampValue(targetLeft, 0, maxLeft);
  container.scrollTop = clampValue(targetTop, 0, maxTop);
  return true;
}

function flushViewerScrollZoom() {
  const container = els.viewerScrollPages;
  state.viewerScrollZoomRaf = 0;
  if (!container || !isScrollViewerMode() || isViewerScrollIsolatedZoom()) {
    state.viewerScrollZoomAnchor = null;
    return;
  }

  const zoom = Math.min(AUTO_VIEWER_ZOOM, getSafeViewerZoom());
  container.querySelectorAll("[data-scroll-page]").forEach((frame) => {
    const baseWidth = Number(frame.dataset.scrollBaseWidth);
    const baseHeight = Number(frame.dataset.scrollBaseHeight);
    if (!Number.isFinite(baseWidth) || !Number.isFinite(baseHeight)) return;
    frame.style.setProperty("--viewer-scroll-page-width", `${Math.max(1, Math.round(baseWidth * zoom))}px`);
    frame.style.setProperty("--viewer-scroll-page-height", `${Math.max(1, Math.round(baseHeight * zoom))}px`);
  });

  const anchor = state.viewerScrollZoomAnchor;
  state.viewerScrollZoomAnchor = null;
  if (anchor) restoreViewerScrollZoomAnchor(anchor);
}

function applyViewerScrollZoom(anchor = null, options = {}) {
  if (anchor) state.viewerScrollZoomAnchor = anchor;
  if (options.immediate) {
    if (state.viewerScrollZoomRaf) cancelAnimationFrame(state.viewerScrollZoomRaf);
    flushViewerScrollZoom();
    return;
  }

  if (!state.viewerScrollZoomRaf) {
    state.viewerScrollZoomRaf = requestAnimationFrame(flushViewerScrollZoom);
  }
}

function refreshViewerScrollPageGeometry(options = {}) {
  if (!isScrollViewerMode() || !els.viewerScrollPages || !state.catalog) return;
  const { preservePage = false, zoomAnchor = null } = options;
  const currentPage = state.page;
  const preservedAnchor = zoomAnchor || (
    preservePage && viewerScrollUsesFreePositioning()
      ? getViewerScrollZoomAnchor()
      : null
  );

  els.viewerScrollPages.querySelectorAll("[data-scroll-page]").forEach((frame) => {
    const page = Number.parseInt(frame.dataset.scrollPage, 10);
    if (!Number.isFinite(page)) return;
    const layout = getViewerScrollPageLayout(page);
    frame.dataset.scrollBaseWidth = String(layout.width);
    frame.dataset.scrollBaseHeight = String(layout.height);
  });

  applyViewerScrollZoom(preservedAnchor, { immediate: true });

  if (preservePage && !preservedAnchor) {
    // Reading the target offsets after the CSS variables changed forces the
    // new geometry to be resolved now. Recenter in the same task so an
    // over-wide fit-height page can never be painted against an edge first.
    scrollViewerToPage(currentPage, { behavior: "auto" });
  }
}

function renderViewerScrollPages() {
  const container = els.viewerScrollPages;
  const catalog = state.catalog;
  if (!container || !catalog || isFavoritesLightboxMode()) return;

  const alreadyRendered = state.viewerScrollCatalogId === catalog.id
    && container.children.length === catalog.pages;
  if (!alreadyRendered) {
    state.viewerScrollLoadToken += 1;
    state.viewerScrollCatalogId = catalog.id;
    const title = escapeHtml(catalog.title || "קטלוג");
    const zoom = Math.min(AUTO_VIEWER_ZOOM, getSafeViewerZoom());
    container.innerHTML = Array.from({ length: catalog.pages }, (_unused, index) => {
      const page = index + 1;
      const size = pageSize(catalog, page) || { width: 1400, height: 1000 };
      const layout = getViewerScrollPageLayout(page);
      const width = Math.max(1, Math.round(layout.width * zoom));
      const height = Math.max(1, Math.round(layout.height * zoom));
      return `
        <div class="viewer-scroll-page viewer-scroll-page-frame image-placeholder-frame image-loading" data-scroll-page="${page}" data-scroll-base-width="${layout.width}" data-scroll-base-height="${layout.height}" role="listitem" aria-label="${title}, עמוד ${page}" style="--viewer-scroll-page-width:${width}px;--viewer-scroll-page-height:${height}px;aspect-ratio:${size.width} / ${size.height}">
          <img data-viewer-scroll-image="${page}" alt="${title} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} draggable="false" decoding="async" />
          <span class="viewer-scroll-page-number" aria-hidden="true">${page}</span>
        </div>
      `;
    }).join("");
  }

  refreshViewerScrollPageGeometry();
  loadViewerScrollWindow(state.page);
}

function setViewerScrollImageFeedback(frame, page, mode = "") {
  if (!frame) return;
  let feedback = frame.querySelector?.("[data-scroll-image-feedback]");
  if (!mode) {
    feedback?.remove?.();
    frame.classList.remove("image-fallback", "image-terminal-error");
    return;
  }

  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "viewer-scroll-image-feedback ui-state";
    feedback.dataset.scrollImageFeedback = "true";
    feedback.setAttribute("aria-atomic", "true");
    feedback.innerHTML = `
      <span class="viewer-scroll-feedback-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9v4.5M12 16.8h.01"/></svg>
      </span>
      <span data-scroll-image-feedback-text></span>
      <button type="button" data-retry-scroll-page="${page}">נסה שוב</button>
    `;
    frame.appendChild(feedback);
  }
  const text = feedback.querySelector("[data-scroll-image-feedback-text]");
  if (text) {
    text.textContent = mode === "fallback"
      ? "מוצגת תצוגה מוקטנת."
      : "התמונה לא נטענה.";
  }
  const isError = mode === "error";
  feedback.dataset.state = isError ? "error" : "warning";
  feedback.setAttribute("role", isError ? "alert" : "status");
  feedback.setAttribute("aria-live", isError ? "assertive" : "polite");
  frame.classList.toggle("image-fallback", mode === "fallback");
  frame.classList.toggle("image-terminal-error", isError);
}

function loadViewerScrollPage(page, priority = "low") {
  const options = arguments[2] || {};
  if (!isScrollViewerMode() || !state.catalog) return;
  const frame = getViewerScrollPageFrame(page);
  const image = frame?.querySelector?.("[data-viewer-scroll-image]");
  if (!image) return;

  const catalog = state.catalog;
  const request = viewerPageImageRequest(catalog, page);
  const src = normalizeCatalogImageUrl(request.primarySrc);
  if (!options.forceRefresh && image.dataset.loadedSrc === src && image.dataset.loadedQuality !== "fallback") return;
  if (!options.forceRefresh && image.dataset.loadingSrc === src) return;
  image.dataset.loadingSrc = src;
  image.dataset.logicalSrc = src;
  frame.setAttribute("aria-busy", "true");
  image.loading = priority === "high" ? "eager" : "lazy";
  image.fetchPriority = priority;
  setViewerScrollImageFeedback(frame, page);
  prepareImagePlaceholder(image);

  const token = state.viewerScrollLoadToken;
  loadCatalogImageWithRecovery(image, {
    primarySrc: src,
    forceRefresh: Boolean(options.forceRefresh),
    isCurrent: () => (
      token === state.viewerScrollLoadToken
      && isScrollViewerMode()
      && state.catalog === catalog
      && normalizeCatalogImageUrl(viewerPageImageRequest(catalog, page).primarySrc) === src
    ),
    primaryTier: request.primaryTier,
    fallbackCandidates: request.fallbackCandidates,
    telemetryDetail: "viewer-scroll",
    onSuccess: (candidate) => {
      delete image.dataset.loadingSrc;
      image.dataset.loadedSrc = src;
      const loadedTier = candidate.tier || request.primaryTier || CATALOG_IMAGE_TIER_FULL;
      const degraded = catalogImageTierRank(loadedTier) < catalogImageTierRank(request.primaryTier);
      image.dataset.loadedTier = loadedTier;
      image.dataset.loadedQuality = degraded ? "fallback" : loadedTier;
      syncImagePlaceholderState(image);
      frame.setAttribute("aria-busy", "false");
      setViewerScrollImageFeedback(frame, page, degraded ? "fallback" : "");
    },
    onExhausted: () => {
      delete image.dataset.loadingSrc;
      delete image.dataset.loadedSrc;
      delete image.dataset.loadedTier;
      delete image.dataset.loadedQuality;
      syncImagePlaceholderState(image);
      frame.setAttribute("aria-busy", "false");
      setViewerScrollImageFeedback(frame, page, "error");
    }
  });
}

function handleViewerScrollImageRetry(event) {
  const button = event.target?.closest?.("[data-retry-scroll-page]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const page = Number.parseInt(button.dataset.retryScrollPage || "", 10);
  if (Number.isFinite(page)) loadViewerScrollPage(page, "high", { forceRefresh: true });
}

function retryCurrentViewerImage() {
  if (!isViewerSessionOpen() || !state.catalog) return;
  const request = viewerPageImageRequest(state.catalog, state.page);
  showSingleLightboxImage(state.catalog, state.page, request.primarySrc, {
    imageRequest: request,
    forceRefresh: true
  });
}

function loadViewerScrollWindow(centerPage) {
  if (!state.catalog || !isScrollViewerMode()) return;
  const center = clampPage(centerPage, state.catalog);
  const radius = catalogNeighborPreloadRadius();
  for (let page = Math.max(1, center - radius); page <= Math.min(state.catalog.pages, center + radius); page += 1) {
    loadViewerScrollPage(page, page === center ? "high" : "low");
  }
}

function clearViewerScrollTarget() {
  window.clearTimeout(state.viewerScrollSettleTimer);
  state.viewerScrollSettleTimer = 0;
  state.viewerScrollTargetPage = 0;
}

function resetViewerScrollCommandSequence() {
  state.viewerScrollLastCommandAt = 0;
}

function clearViewerScrollWheelGesture() {
  window.clearTimeout(state.viewerScrollWheelSettleTimer);
  state.viewerScrollWheelSettleTimer = 0;
  state.viewerScrollWheelAccumulator = 0;
  state.viewerScrollWheelBasePage = 0;
  state.viewerScrollWheelTargetPage = 0;
}

function getViewerScrollPagePosition(page) {
  const container = els.viewerScrollPages;
  const frame = getViewerScrollPageFrame(page);
  if (!container || !frame) return null;

  return {
    top: Math.max(0, frame.offsetTop - Math.max(0, (container.clientHeight - frame.offsetHeight) / 2)),
    // Center pages on the horizontal viewport even when fit-height makes them
    // wider than the container. Clamping the size difference before subtracting
    // it leaves over-wide pages at scrollLeft 0 and exposes only one side.
    left: Math.max(0, frame.offsetLeft + (frame.offsetWidth - container.clientWidth) / 2)
  };
}

function settleViewerScrollWheelGesture() {
  const targetPage = state.viewerScrollWheelTargetPage || state.page;
  clearViewerScrollWheelGesture();
  if (!isScrollViewerMode() || !state.catalog) return;
  loadViewerScrollWindow(targetPage);
  // Wheel and precision-touchpad gestures are page commands. Settlement must
  // preserve the exact page position rather than introduce a native smooth
  // scroll after the final input event.
  scrollViewerToPage(targetPage);
}

function normalizeViewerScrollWheelDelta(event) {
  const rawDelta = Number(event?.deltaY) || 0;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  // One page-mode unit already represents one deliberate page command. Line
  // and pixel modes are normalized through the shared pixel converter so a
  // three-line mouse detent (~108 px) and a 100 px precision-wheel stream carry
  // the same intent instead of following browser-specific native distances.
  if (event?.deltaMode === pageMode) return rawDelta * VIEWER_SCROLL_WHEEL_PAGE_DELTA_PX;
  return normalizeWheelDeltaToPixels(rawDelta, event?.deltaMode, els.viewerScrollPages?.clientHeight || 0);
}

function getViewerScrollWheelRequestedSteps(accumulator) {
  const signedAccumulator = Number(accumulator) || 0;
  const magnitude = Math.abs(signedAccumulator);
  if (magnitude < VIEWER_SCROLL_WHEEL_FIRST_PAGE_DELTA_PX) return 0;

  // The first committed page deliberately has a lower activation threshold so
  // a precision touchpad does not need to land inside a narrow 100–199 px band.
  // After activation, every additional page keeps the original 100 px cadence:
  // 20–199 => one page, 200–299 => two pages, 300–399 => three pages, and so on.
  const wholePageSteps = Math.trunc(magnitude / VIEWER_SCROLL_WHEEL_PAGE_DELTA_PX);
  return Math.sign(signedAccumulator) * Math.max(1, wholePageSteps);
}

function handleViewerScrollWheel(event) {
  const container = els.viewerScrollPages;
  if (!isViewerSessionOpen() || !isScrollViewerMode() || isViewerScrollIsolatedZoom() || !state.catalog || !container) {
    return false;
  }

  if (viewerScrollUsesFreePositioning()) {
    // Fit-width pages are intentionally taller than the viewport. Let the
    // browser consume the complete wheel/trackpad stream so the reader can move
    // through every part of the current image and continue naturally into the
    // next one. Clearing page-command state also prevents a previous fit-height
    // gesture from settling onto an aligned page after native scrolling begins.
    clearViewerScrollWheelGesture();
    clearViewerScrollTarget();
    resetViewerScrollCommandSequence();
    return false;
  }

  const deltaY = normalizeViewerScrollWheelDelta(event);
  const deltaX = normalizeWheelDeltaToPixels(
    Number(event?.deltaX) || 0,
    event?.deltaMode,
    container.clientWidth
  );
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.01) return false;

  // Preserve deliberate horizontal panning for fit-height pages that overflow
  // sideways. Every vertically dominant wheel stream—mouse or touchpad—uses
  // the exact same page-intent accumulator below.
  if (Math.abs(deltaX) > Math.abs(deltaY)) return false;

  event.preventDefault();

  const gestureStarted = !state.viewerScrollWheelBasePage;
  if (gestureStarted) {
    const intendedPage = state.viewerScrollTargetPage || findViewerScrollCenterPage() || state.page;
    clearViewerScrollTarget();
    state.viewerScrollWheelBasePage = clampPage(intendedPage, state.catalog);
    state.viewerScrollWheelTargetPage = state.viewerScrollWheelBasePage;
    state.viewerScrollWheelAccumulator = 0;
  }

  state.viewerScrollWheelAccumulator += deltaY;
  const requestedSteps = getViewerScrollWheelRequestedSteps(
    state.viewerScrollWheelAccumulator
  );
  const targetPage = clampPage(state.viewerScrollWheelBasePage + requestedSteps, state.catalog);
  const previousTargetPage = state.viewerScrollWheelTargetPage;
  state.viewerScrollWheelTargetPage = targetPage;

  // Pixel-mode touchpads report one gesture as many small wheel events, while a
  // mouse detent often reaches the page threshold in a single event. Those
  // sub-threshold values are input intent only: applying them to scrollTop made
  // touchpads visibly drag the current image before the same page swap that a
  // mouse performs immediately. Keep the viewport locked to an exact page and
  // move it only when the shared accumulator commits one or more whole steps.
  if (gestureStarted || targetPage !== previousTargetPage) {
    loadViewerScrollWindow(targetPage);
    const position = getViewerScrollPagePosition(targetPage);
    if (position) {
      container.scrollTop = position.top;
      container.scrollLeft = position.left;
    }
  }
  syncViewerScrollActivePage(targetPage);
  if (targetPage !== previousTargetPage) runViewerScrollPageSwapAnimation(targetPage);

  window.clearTimeout(state.viewerScrollWheelSettleTimer);
  state.viewerScrollWheelSettleTimer = window.setTimeout(
    settleViewerScrollWheelGesture,
    VIEWER_SCROLL_WHEEL_SETTLE_MS
  );
  return true;
}

function shouldJumpViewerScrollCommand(options = {}) {
  const now = performance.now();
  const elapsed = state.viewerScrollLastCommandAt > 0
    ? now - state.viewerScrollLastCommandAt
    : Number.POSITIVE_INFINITY;
  const isRapidFollowUp = elapsed <= VIEWER_SCROLL_MULTI_COMMAND_WINDOW_MS;
  state.viewerScrollLastCommandAt = now;

  // A single page command keeps the polished smooth movement. Once another
  // command joins the same sequence, native smooth scrolling becomes a queue:
  // each destination is animated from an in-flight position and held keys feel
  // progressively slower. Jumping the accumulated destination cancels that
  // native animation immediately while preserving exact page alignment.
  return Boolean(options.repeated || isRapidFollowUp || state.viewerScrollTargetPage);
}

function scrollViewerToPage(page, options = {}) {
  const container = els.viewerScrollPages;
  if (!container) return false;
  const targetPage = state.catalog ? clampPage(page, state.catalog) : Number(page) || 1;
  const behavior = options.behavior === "smooth" ? "smooth" : "auto";
  const position = getViewerScrollPagePosition(targetPage);
  if (!position) return false;
  const { top, left } = position;

  clearViewerScrollWheelGesture();
  clearViewerScrollTarget();
  if (behavior === "smooth") {
    state.viewerScrollTargetPage = targetPage;
    state.viewerScrollSettleTimer = window.setTimeout(() => {
      state.viewerScrollSettleTimer = 0;
      state.viewerScrollTargetPage = 0;
      syncViewerScrollActivePage(findViewerScrollCenterPage());
    }, 760);
    container.scrollTo({ top, left, behavior: "smooth" });
  } else {
    // Direct assignment deliberately bypasses CSS/native smooth scrolling. A
    // far-away rail selection must not make the browser animate every page in
    // between or decode them while travelling to the destination.
    container.scrollTop = top;
    container.scrollLeft = left;
    syncViewerScrollActivePage(targetPage);
  }

  // The scroll-mode page change may itself run inside requestAnimationFrame.
  // Starting the animation in another frame lets the fully visible target page
  // paint once before it jumps back to the animation's start state. Apply the
  // class synchronously after positioning so the first paint already contains
  // the same fade/blur/scale start state as the single-page viewer.
  if (options.animate) runViewerScrollPageSwapAnimation(targetPage);
  return true;
}

function findViewerScrollCenterPage() {
  const container = els.viewerScrollPages;
  const frames = container?.children;
  if (!container || !frames?.length) return state.page;

  const target = container.scrollTop + container.clientHeight / 2;
  let low = 0;
  let high = frames.length - 1;
  let best = frames[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const frame = frames[mid];
    const center = frame.offsetTop + frame.offsetHeight / 2;
    const distance = Math.abs(center - target);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
    if (center < target) low = mid + 1;
    else high = mid - 1;
  }

  return Number.parseInt(best.dataset.scrollPage, 10) || state.page;
}

function syncViewerScrollActivePage(page) {
  if (!state.catalog || !isScrollViewerMode()) return;
  const nextPage = clampPage(page, state.catalog);
  loadViewerScrollWindow(nextPage);

  if (state.viewerScrollTargetPage) {
    if (nextPage !== state.viewerScrollTargetPage) return;
    clearViewerScrollTarget();
  }

  if (nextPage === state.page) return;

  state.page = nextPage;
  els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${state.catalog.pages}`;
  syncLightboxProgress(state.page, state.catalog.pages, `עמוד ${state.page} מתוך ${state.catalog.pages}`, {
    label: "עמוד"
  });
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= state.catalog.pages;
  syncViewerFavoriteButtonUi();
  syncViewerInquiryUi();
  updateLightboxThumbs({ scrollIntoView: false });
  updateHash();
}

function handleViewerScrollPagesScroll() {
  if (!isScrollViewerMode() || state.viewerScrollRaf) return;
  state.viewerScrollRaf = requestAnimationFrame(() => {
    state.viewerScrollRaf = 0;
    syncViewerScrollActivePage(findViewerScrollCenterPage());
  });
}

function scrollViewerByViewport(direction, options = {}) {
  if (!isScrollViewerMode() || !els.viewerScrollPages || !state.catalog) return false;

  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step) return true;

  // Keyboard page navigation is page-based, not distance-based. Using a
  // percentage of the viewport made repeated presses accumulate from an
  // in-flight scroll position and could stop halfway through a page. While a
  // smooth navigation is running, build the next press from its intended page
  // so every command has one stable, exact destination.
  const basePage = state.viewerScrollTargetPage || state.page;
  const targetPage = clampPage(basePage + step, state.catalog);
  if (targetPage === basePage) return true;
  const jumpImmediately = shouldJumpViewerScrollCommand(options);

  if (isViewerScrollIsolatedZoom()) {
    exitViewerScrollIsolatedZoom({ restorePage: false, nextZoom: AUTO_VIEWER_ZOOM });
  }

  loadViewerScrollWindow(targetPage);
  scrollViewerToPage(targetPage, {
    behavior: jumpImmediately ? "auto" : "smooth",
    animate: jumpImmediately
  });
  return true;
}
