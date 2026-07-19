/**
 * Source module: 65-viewer-onboarding.js
 * First-run viewer tour: steps, spotlight geometry, cloned controls, focus handling, and cleanup.
 *
 * Event ownership lives beside the feature. The generated browser bundle still exposes
 * no runtime module requests; tools/build_frontend_assets.py concatenates all sources.
 */

function getViewerOnboardingStorage() {
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

function viewerOnboardingWasSeen() {
  try {
    return getViewerOnboardingStorage()?.getItem(VIEWER_ONBOARDING_STORAGE_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function markViewerOnboardingSeen() {
  try {
    getViewerOnboardingStorage()?.setItem(VIEWER_ONBOARDING_STORAGE_KEY, "1");
  } catch (_error) {
    // The in-memory flag still prevents repeat display during this visit.
  }
}

function viewerHasTouchCapability() {
  return Number(navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
}

function viewerNavigationOnboardingCopy() {
  if (viewerHasTouchCapability()) {
    return "במסך מגע החליקו למעלה או למטה בגלילה הרציפה, או ימינה ושמאלה למעבר ישיר. אפשר גם ללחוץ על החצים שבצדי המסך או להשתמש במקשי החצים למעלה, למטה, ימינה ושמאלה במקלדת.";
  }
  return "גללו למעלה או למטה, לחצו על החצים שבצדי המסך, או השתמשו במקשי החצים למעלה, למטה, ימינה ושמאלה במקלדת.";
}

function viewerZoomOnboardingCopy() {
  if (viewerHasTouchCapability()) {
    return "במסך מגע צבטו בשתי אצבעות או הקישו פעמיים. בעכבר אפשר ללחוץ פעמיים או להשתמש בגלגלת; לאחר ההגדלה גררו את התמונה.";
  }
  return "לחצו פעמיים על התמונה או השתמשו בגלגלת העכבר להגדלה; לאחר מכן גררו את התמונה למיקום הרצוי.";
}

function getViewerOnboardingSteps() {
  return [
    {
      id: "page-navigation",
      eyebrow: "צפייה פשוטה",
      title: "מעבר בין עמודים",
      description: viewerNavigationOnboardingCopy(),
      note: "למעבר מהיר לעמוד רחוק, פתחו את סרגל התמונות הממוזערות מהקצה הימני.",
      target: () => els.stageCanvas,
      targetRect: getViewerOnboardingNavigationFocusRect,
      floatingTargets: () => [
        { source: els.nextPageBtn, id: "next-page" },
        { source: els.prevPageBtn, id: "previous-page" }
      ],
      preferredPlacement: "above",
      padding: 0,
      radius: 26,
      gesture: "swipe-both"
    },
    {
      id: "zoom",
      eyebrow: "מבט מקרוב",
      title: "הגדלה וגרירת התמונה",
      description: viewerZoomOnboardingCopy(),
      target: () => isScrollViewerMode()
        ? (getViewerScrollPageFrame(state.page) || els.viewerScrollPages)
        : els.lightboxImageFrame,
      targetRect: getViewerOnboardingImageFocusRect,
      preferredPlacement: "above",
      padding: 0,
      radius: 24,
      gesture: viewerHasTouchCapability() ? "pinch" : "double-tap"
    },
    {
      id: "inquiry",
      eyebrow: "מצאתם דגם מתאים?",
      title: "שמירה, שיתוף ובירור",
      description: "לחצו על „בירור על הדגם” כדי לפנות עם שם הקטלוג, מספר העמוד וקישור מדויק שכבר מוכנים עבורכם.",
      note: "הכוכב שומר את העמוד במועדפים, וכפתור השיתוף בסרגל העליון שולח קישור ישיר.",
      target: () => els.viewerInquiryButton,
      floatingTargets: () => [
        { source: els.viewerInquiryButton, id: "inquiry" },
        { source: els.viewerFavoriteButton, id: "favorite" }
      ],
      preferredPlacement: "left",
      padding: 8,
      radius: 24,
      gesture: "tap"
    }
  ];
}

function getViewerOnboardingTopBarFocusRect() {
  const header = els.lightboxBar?.querySelector?.(".lightbox-reader-header");
  return header?.getBoundingClientRect?.() || els.lightboxBar?.getBoundingClientRect?.() || null;
}

function getViewerOnboardingPinFocusRect() {
  const source = els.lightboxPinTopBar?.getBoundingClientRect?.();
  if (!source) return null;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const desiredPadding = 12;

  // The pin button sits close to the viewport's top edge. A regular padded
  // rectangle gets clipped only at the top and therefore looks shifted down.
  // Use the same available padding on opposite sides so the frame remains
  // visually centred around the real button even near a viewport boundary.
  const horizontalPadding = Math.max(0, Math.min(
    desiredPadding,
    Number(source.left || 0),
    Math.max(0, viewportWidth - Number(source.right || 0))
  ));
  const verticalPadding = Math.max(0, Math.min(
    desiredPadding,
    Number(source.top || 0),
    Math.max(0, viewportHeight - Number(source.bottom || 0))
  ));

  return {
    left: source.left - horizontalPadding,
    top: source.top - verticalPadding,
    right: source.right + horizontalPadding,
    bottom: source.bottom + verticalPadding,
    width: source.width + horizontalPadding * 2,
    height: source.height + verticalPadding * 2
  };
}

function getViewerOnboardingNavigationFocusRect() {
  const source = els.stageCanvas?.getBoundingClientRect?.() || els.lightboxStage?.getBoundingClientRect?.();
  if (!source) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const width = Math.min(Math.max(240, source.width * 0.36), 460, Math.max(200, viewportWidth - 42));
  const height = Math.min(Math.max(150, source.height * 0.24), 230, Math.max(130, viewportHeight - 190));
  const centerX = source.left + source.width / 2;
  const centerY = source.top + source.height / 2;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    right: centerX + width / 2,
    bottom: centerY + height / 2,
    width,
    height
  };
}

function getViewerOnboardingPageRailFocusRect() {
  const source = els.lightboxPageRail?.getBoundingClientRect?.();
  if (!source) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  if (viewportWidth > 700) return source;
  const height = Math.min(300, Math.max(220, source.height * 0.34));
  return {
    left: source.left,
    top: source.top,
    right: source.right,
    bottom: Math.min(source.bottom, source.top + height),
    width: source.width,
    height: Math.min(height, source.height)
  };
}

function getViewerOnboardingImageFocusRect() {
  const activeImageSurface = isScrollViewerMode()
    ? (getViewerScrollPageFrame(state.page) || els.viewerScrollPages)
    : els.lightboxImageFrame;
  const source = activeImageSurface?.getBoundingClientRect?.() || els.stageCanvas?.getBoundingClientRect?.();
  if (!source) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const width = Math.min(Math.max(220, source.width * 0.46), 430, Math.max(180, viewportWidth - 36));
  const height = Math.min(Math.max(170, source.height * 0.38), 300, Math.max(140, viewportHeight - 180));
  return {
    left: source.left + (source.width - width) / 2,
    top: source.top + (source.height - height) / 2,
    right: source.left + (source.width + width) / 2,
    bottom: source.top + (source.height + height) / 2,
    width,
    height
  };
}

function getViewerOnboardingFocusableElements() {
  if (!els.viewerOnboarding) return [];
  const controls = Array.from(els.viewerOnboarding.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
  const targets = [
    ...(state.viewerOnboardingFloatingTargets || []).map((entry) => entry.clone),
    state.viewerOnboardingTarget
  ].filter(Boolean);
  const targetControls = targets.flatMap((target) => [
    ...(target.matches?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ? [target] : []),
    ...Array.from(target.querySelectorAll?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])
  ]);
  return [...new Set([...controls, ...targetControls])];
}

function setViewerOnboardingShadeRect(element, left, top, width, height) {
  if (!element) return;
  element.style.left = `${Math.max(0, left)}px`;
  element.style.top = `${Math.max(0, top)}px`;
  element.style.width = `${Math.max(0, width)}px`;
  element.style.height = `${Math.max(0, height)}px`;
}

function normalizeViewerOnboardingRect(rawRect, padding = 0, viewportMargin = 6) {
  if (!rawRect) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = Math.max(0, Number(viewportMargin || 0));
  const left = Math.max(margin, Number(rawRect.left || 0) - padding);
  const top = Math.max(margin, Number(rawRect.top || 0) - padding);
  const right = Math.min(viewportWidth - margin, Number(rawRect.right || 0) + padding);
  const bottom = Math.min(viewportHeight - margin, Number(rawRect.bottom || 0) + padding);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function viewerOnboardingPlacementCandidates(preferred) {
  const all = ["below", "above", "left", "right"];
  return [preferred, ...all.filter((placement) => placement !== preferred)];
}

function calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, preferredPlacement) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = 12;
  const gap = 18;

  const coordinates = (placement) => {
    if (placement === "above") {
      return { left: targetRect.left + (targetRect.width - calloutRect.width) / 2, top: targetRect.top - calloutRect.height - gap };
    }
    if (placement === "left") {
      return { left: targetRect.left - calloutRect.width - gap, top: targetRect.top + (targetRect.height - calloutRect.height) / 2 };
    }
    if (placement === "right") {
      return { left: targetRect.right + gap, top: targetRect.top + (targetRect.height - calloutRect.height) / 2 };
    }
    return { left: targetRect.left + (targetRect.width - calloutRect.width) / 2, top: targetRect.bottom + gap };
  };

  const overflowScore = ({ left, top }) => {
    const overflowLeft = Math.max(0, margin - left);
    const overflowTop = Math.max(0, margin - top);
    const overflowRight = Math.max(0, left + calloutRect.width + margin - viewportWidth);
    const overflowBottom = Math.max(0, top + calloutRect.height + margin - viewportHeight);
    return overflowLeft + overflowTop + overflowRight + overflowBottom;
  };

  const maxLeft = Math.max(margin, viewportWidth - calloutRect.width - margin);
  const maxTop = Math.max(margin, viewportHeight - calloutRect.height - margin);
  const candidates = viewerOnboardingPlacementCandidates(preferredPlacement).map((placement) => {
    const point = coordinates(placement);
    const left = clampValue(point.left, margin, maxLeft);
    const top = clampValue(point.top, margin, maxTop);
    const overlapWidth = Math.max(0, Math.min(left + calloutRect.width, targetRect.right) - Math.max(left, targetRect.left));
    const overlapHeight = Math.max(0, Math.min(top + calloutRect.height, targetRect.bottom) - Math.max(top, targetRect.top));
    const overlapArea = overlapWidth * overlapHeight;
    const overflow = overflowScore(point);
    return {
      placement,
      left,
      top,
      overflow,
      overlapArea,
      score: (overlapArea > 0 ? 100000 + overlapArea : 0) + overflow
    };
  });
  const chosen = candidates.sort((a, b) => a.score - b.score)[0];
  return {
    placement: chosen.placement,
    left: chosen.left,
    top: chosen.top
  };
}

function removeViewerOnboardingFloatingTargets() {
  (state.viewerOnboardingFloatingTargets || []).forEach((entry) => entry.clone?.remove?.());
  state.viewerOnboardingFloatingTargets = [];
}

function sanitizeViewerOnboardingFloatingTarget(clone) {
  clone.removeAttribute("id");
  clone.removeAttribute("aria-controls");
  clone.removeAttribute("aria-describedby");
  clone.querySelectorAll?.("[id]").forEach((element) => element.removeAttribute("id"));
  clone.querySelectorAll?.("[aria-controls]").forEach((element) => element.removeAttribute("aria-controls"));
  clone.classList.remove("hidden");
  clone.removeAttribute("hidden");
}

function syncViewerOnboardingFloatingTargetState(source, clone) {
  ["aria-label", "aria-pressed", "title", "data-pinned", "data-fullscreen-active", "data-favorite-active"].forEach((attribute) => {
    if (source.hasAttribute(attribute)) clone.setAttribute(attribute, source.getAttribute(attribute));
    else clone.removeAttribute(attribute);
  });
  clone.disabled = Boolean(source.disabled);
}

function getViewerOnboardingFloatingTargetDefinitions(step) {
  const configured = step.floatingTargets?.()
    || (step.floatingTarget ? [{ source: step.floatingTarget(), id: "primary" }] : []);
  return configured.map((entry, index) => {
    const source = entry?.source || entry;
    if (!source) return null;
    return {
      source,
      id: String(entry?.id || `target-${index + 1}`)
    };
  }).filter(Boolean);
}

function viewerOnboardingFloatingTargetsMatch(step, definitions) {
  const current = state.viewerOnboardingFloatingTargets || [];
  return current.length === definitions.length && current.every((entry, index) => (
    entry.source === definitions[index].source
    && entry.id === definitions[index].id
    && entry.stepId === step.id
  ));
}

function updateViewerOnboardingFloatingTargets(step) {
  const definitions = getViewerOnboardingFloatingTargetDefinitions(step);
  if (!definitions.length || !els.viewerOnboarding) {
    removeViewerOnboardingFloatingTargets();
    return;
  }

  if (!viewerOnboardingFloatingTargetsMatch(step, definitions)) {
    removeViewerOnboardingFloatingTargets();
    state.viewerOnboardingFloatingTargets = definitions.map(({ source, id }) => {
      const clone = source.cloneNode(true);
      sanitizeViewerOnboardingFloatingTarget(clone);
      clone.classList.add("viewer-onboarding-floating-target");
      clone.dataset.tourStep = step.id;
      clone.dataset.tourTarget = id;
      clone.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        source.click();
        window.requestAnimationFrame(() => {
          const isCurrentClone = (state.viewerOnboardingFloatingTargets || [])
            .some((entry) => entry.clone === clone);
          if (!state.viewerOnboardingOpen || !isCurrentClone) return;
          syncViewerOnboardingFloatingTargetState(source, clone);
          scheduleViewerOnboardingLayout(30);
        });
      });
      els.viewerOnboarding.appendChild(clone);
      return { source, clone, id, stepId: step.id };
    });
  }

  state.viewerOnboardingFloatingTargets.forEach(({ source, clone }) => {
    syncViewerOnboardingFloatingTargetState(source, clone);
    const rect = source.getBoundingClientRect();
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
  });
}

function layoutViewerOnboarding() {
  if (!state.viewerOnboardingOpen || !els.viewerOnboarding || !els.viewerOnboardingCard || !els.viewerOnboardingSpotlight) return;
  const steps = getViewerOnboardingSteps();
  const step = steps[state.viewerOnboardingStep];
  if (!step) return;

  const target = step.target?.() || null;
  state.viewerOnboardingTarget = target;
  const rawRect = step.targetRect?.() || target?.getBoundingClientRect?.();
  const targetRect = normalizeViewerOnboardingRect(
    rawRect,
    Number(step.padding || 0),
    step.viewportMargin === undefined ? 6 : Number(step.viewportMargin)
  );
  if (!targetRect) return;

  updateViewerOnboardingFloatingTargets(step);

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeTop, 0, 0, viewportWidth, targetRect.top);
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeBottom, 0, targetRect.bottom, viewportWidth, viewportHeight - targetRect.bottom);
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeLeft, 0, targetRect.top, targetRect.left, targetRect.height);
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeRight, targetRect.right, targetRect.top, viewportWidth - targetRect.right, targetRect.height);

  const spotlight = els.viewerOnboardingSpotlight;
  spotlight.style.left = `${targetRect.left}px`;
  spotlight.style.top = `${targetRect.top}px`;
  spotlight.style.width = `${targetRect.width}px`;
  spotlight.style.height = `${targetRect.height}px`;
  spotlight.style.borderRadius = `${Number(step.radius || 18)}px`;
  spotlight.dataset.gesture = step.gesture || "";
  spotlight.dataset.tourStep = step.id || "";

  const calloutRect = els.viewerOnboardingCard.getBoundingClientRect();
  const calloutPosition = calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, step.preferredPlacement || "below");
  els.viewerOnboardingCard.style.left = `${calloutPosition.left}px`;
  els.viewerOnboardingCard.style.top = `${calloutPosition.top}px`;
  els.viewerOnboardingCard.dataset.placement = calloutPosition.placement;
}

function scheduleViewerOnboardingLayout(delay = 0) {
  const run = () => {
    window.cancelAnimationFrame(state.viewerOnboardingLayoutRaf);
    state.viewerOnboardingLayoutRaf = window.requestAnimationFrame(layoutViewerOnboarding);
  };

  if (delay > 0) {
    // Keep the immediate layout that was scheduled for this step. The delayed
    // pass only re-measures after toolbar/callout transitions have settled.
    window.clearTimeout(state.viewerOnboardingLayoutTimer);
    state.viewerOnboardingLayoutTimer = window.setTimeout(run, delay);
    return;
  }

  run();
}

function renderViewerOnboardingStep(options = {}) {
  if (!state.viewerOnboardingOpen) return;
  const { focus = true, scheduleLayout = true } = options;
  const steps = getViewerOnboardingSteps();
  state.viewerOnboardingStep = clampValue(state.viewerOnboardingStep, 0, Math.max(0, steps.length - 1));
  const step = steps[state.viewerOnboardingStep];
  if (!step) return;

  const floatingTargetsBelongToStep = (state.viewerOnboardingFloatingTargets || [])
    .every((entry) => entry.stepId === step.id);
  if (!floatingTargetsBelongToStep) {
    removeViewerOnboardingFloatingTargets();
  }

  els.lightbox?.classList.toggle("viewer-tour-show-top-ui", Boolean(step.revealTopBar));
  els.lightbox?.classList.toggle("viewer-tour-show-page-rail", Boolean(step.revealPageRail));
  if (step.revealTopBar) window.clearTimeout(state.uiHideTimer);
  if (step.revealPageRail) window.clearTimeout(state.pageRailHideTimer);

  if (els.viewerOnboardingEyebrow) els.viewerOnboardingEyebrow.textContent = step.eyebrow || "סיור קצר";
  if (els.viewerOnboardingTitle) els.viewerOnboardingTitle.textContent = step.title;
  if (els.viewerOnboardingDescription) els.viewerOnboardingDescription.textContent = step.description;
  if (els.viewerOnboardingCounter) els.viewerOnboardingCounter.textContent = `${state.viewerOnboardingStep + 1} מתוך ${steps.length}`;
  if (els.viewerOnboardingNote) {
    els.viewerOnboardingNote.textContent = step.note || "";
    els.viewerOnboardingNote.classList.toggle("hidden", !step.note);
  }
  if (els.viewerOnboardingPrevious) els.viewerOnboardingPrevious.disabled = state.viewerOnboardingStep === 0;
  if (els.viewerOnboardingNext) {
    els.viewerOnboardingNext.textContent = state.viewerOnboardingStep === steps.length - 1 ? "סיום" : "הבא";
  }
  if (els.viewerOnboardingDots) {
    els.viewerOnboardingDots.innerHTML = steps.map((_, index) => (
      `<span${index === state.viewerOnboardingStep ? ' class="active"' : ""}></span>`
    )).join("");
  }

  if (scheduleLayout) {
    scheduleViewerOnboardingLayout();
    scheduleViewerOnboardingLayout(260);
  }
  if (focus) window.requestAnimationFrame(() => els.viewerOnboardingNext?.focus?.({ preventScroll: true }));
}

function moveViewerOnboardingStep(delta) {
  if (!state.viewerOnboardingOpen) return;
  const steps = getViewerOnboardingSteps();
  const nextStep = state.viewerOnboardingStep + delta;
  if (nextStep >= steps.length) {
    closeViewerOnboarding();
    return;
  }
  state.viewerOnboardingStep = clampValue(nextStep, 0, Math.max(0, steps.length - 1));
  renderViewerOnboardingStep();
}

function restoreViewerUiAfterOnboarding() {
  const restore = state.viewerOnboardingRestoreUi || {};
  els.lightbox?.classList.remove("viewer-tour-active", "viewer-tour-show-top-ui", "viewer-tour-show-page-rail");
  if (els.lightbox) {
    if (state.topUiPinned || restore.showUi) els.lightbox.classList.add("show-ui");
    else els.lightbox.classList.remove("show-ui");
    if (restore.showPageRail) els.lightbox.classList.add("show-page-rail");
    else els.lightbox.classList.remove("show-page-rail");
  }
  state.viewerOnboardingRestoreUi = null;
}

function closeViewerOnboarding(options = {}) {
  if (!state.viewerOnboardingOpen) return;
  const { restoreFocus = true, remember = true } = options;
  state.viewerOnboardingOpen = false;
  state.viewerOnboardingTarget = null;
  removeViewerOnboardingFloatingTargets();
  window.cancelAnimationFrame(state.viewerOnboardingLayoutRaf);
  window.clearTimeout(state.viewerOnboardingLayoutTimer);
  if (remember) markViewerOnboardingSeen();
  restoreViewerUiAfterOnboarding();
  els.viewerOnboarding?.classList.remove("visible");
  els.viewerOnboarding?.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (state.viewerOnboardingOpen) return;
    els.viewerOnboarding?.classList.add("hidden");
    els.viewerOnboarding?.classList.remove("layout-ready");
  }, 220);
  if (restoreFocus) els.stageCanvas?.focus?.({ preventScroll: true });
}

function showViewerOnboardingIfNeeded() {
  if (!state.lightboxOpen || !els.viewerOnboarding || state.viewerOnboardingOpen) return;
  if (state.viewerOnboardingShownThisSession || viewerOnboardingWasSeen()) return;

  state.viewerOnboardingShownThisSession = true;
  state.viewerOnboardingOpen = true;
  state.viewerOnboardingStep = 0;
  state.viewerOnboardingRestoreUi = {
    showUi: Boolean(els.lightbox?.classList.contains("show-ui")),
    showPageRail: Boolean(els.lightbox?.classList.contains("show-page-rail"))
  };
  els.lightbox?.classList.add("viewer-tour-active");
  els.viewerOnboarding.classList.remove("hidden", "visible", "layout-ready");
  els.viewerOnboarding.setAttribute("aria-hidden", "false");

  // Build and measure the first step while the tour is still transparent.
  // Waiting one frame after revealing the real toolbar lets its layout settle,
  // so the callout is already in its final position before the fade-in begins.
  window.requestAnimationFrame(() => {
    if (!state.viewerOnboardingOpen) return;
    renderViewerOnboardingStep({ focus: false, scheduleLayout: false });
    window.requestAnimationFrame(() => {
      if (!state.viewerOnboardingOpen) return;
      layoutViewerOnboarding();
      els.viewerOnboarding.classList.add("layout-ready");
      window.requestAnimationFrame(() => {
        if (!state.viewerOnboardingOpen) return;
        els.viewerOnboarding.classList.add("visible");
        els.viewerOnboardingNext?.focus?.({ preventScroll: true });
        scheduleViewerOnboardingLayout(260);
      });
    });
  });
}

function handleViewerOnboardingKeydown(event) {
  if (!state.viewerOnboardingOpen) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    closeViewerOnboarding();
    return true;
  }
  if (event.key !== "Tab") return true;

  const focusable = getViewerOnboardingFocusableElements();
  if (!focusable.length) {
    event.preventDefault();
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

function attachViewerOnboardingEvents() {
  els.viewerOnboardingPrevious?.addEventListener("click", () => moveViewerOnboardingStep(-1));
  els.viewerOnboardingNext?.addEventListener("click", () => moveViewerOnboardingStep(1));
  els.viewerOnboardingSkip?.addEventListener("click", () => closeViewerOnboarding());
}
