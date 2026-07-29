/**
 * Source module: 65-viewer-onboarding.js
 * First-run viewer tour: steps, spotlight geometry, cloned controls, focus handling, and cleanup.
 *
 * Event ownership lives beside the feature. The generated browser bundle is produced
 * from explicit ES module imports and does not perform runtime module requests.
 */

import { getFeatureInterface } from "./10-app-state.js";
import { VIEWER_ONBOARDING_STORAGE_KEY, viewerElements, viewerState } from "./16-viewer-state.js";
import { clampValue, focusHtmlElement, isHtmlElement } from "./20-shared-ui.js";
import { isViewerSessionOpen } from "./52-viewer-session.js";

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
    return "במסך מגע החליקו למעלה, למטה, ימינה או שמאלה כדי לעבור עמוד. בהגדלה, גררו בתוך התמונה; מעבר לקצה יעביר לעמוד הבא בלי לבטל את הזום. אפשר גם להשתמש בחצים שבצדי המסך או במקשי החצים ו־Page Up/Down.";
  }
  return "גללו בעכבר או במשטח המגע, לחצו על החצים שבצדי המסך, או השתמשו במקשי החצים ו־Page Up/Down. בהגדלה, הגלילה מזיזה את התמונה ומעבר לקצה מעביר עמוד בלי לבטל את הזום.";
}

function viewerZoomOnboardingCopy() {
  if (viewerHasTouchCapability()) {
    return "במסך מגע צבטו בשתי אצבעות או הקישו פעמיים. בעכבר אפשר ללחוץ פעמיים או להשתמש בגלגלת; לאחר ההגדלה גררו את התמונה.";
  }
  return "לחצו פעמיים על התמונה או השתמשו בגלגלת העכבר להגדלה; לאחר מכן גררו את התמונה למיקום הרצוי.";
}

/** @returns {Array<ViewerOnboardingStep>} */
function getViewerOnboardingSteps() {
  return [
    {
      id: "page-navigation",
      eyebrow: "צפייה פשוטה",
      title: "מעבר בין עמודים",
      description: viewerNavigationOnboardingCopy(),
      note: "למעבר מהיר לעמוד רחוק, פתחו את סרגל התמונות הממוזערות מהקצה הימני.",
      target: () => viewerElements.stageCanvas,
      targetRect: getViewerOnboardingNavigationFocusRect,
      floatingTargets: () => [
        { source: viewerElements.nextPageBtn, id: "next-page" },
        { source: viewerElements.prevPageBtn, id: "previous-page" }
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
      target: () => viewerElements.lightboxImageFrame,
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
      target: () => getFeatureInterface("inquiry")?.onboardingTarget() || null,
      floatingTargets: () => {
        const inquiryTarget = getFeatureInterface("inquiry")?.onboardingTarget();
        const favoriteTarget = getFeatureInterface("favorites")?.onboardingTarget();
        return [
          inquiryTarget ? { source: inquiryTarget, id: "inquiry" } : null,
          favoriteTarget ? { source: favoriteTarget, id: "favorite" } : null
        ].filter((target) => target !== null);
      },
      preferredPlacement: "left",
      padding: 8,
      radius: 24,
      gesture: "tap"
    }
  ];
}

function getViewerOnboardingTopBarFocusRect() {
  const header = viewerElements.lightboxBar?.querySelector?.(".lightbox-reader-header");
  return header?.getBoundingClientRect?.() || viewerElements.lightboxBar?.getBoundingClientRect?.() || null;
}

function getViewerOnboardingPinFocusRect() {
  const source = viewerElements.lightboxPinTopBar?.getBoundingClientRect?.();
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
  const source = viewerElements.stageCanvas?.getBoundingClientRect?.() || viewerElements.lightboxStage?.getBoundingClientRect?.();
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
  const source = viewerElements.lightboxPageRail?.getBoundingClientRect?.();
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
  const activeImageSurface = viewerElements.lightboxImageFrame;
  const source = activeImageSurface?.getBoundingClientRect?.() || viewerElements.stageCanvas?.getBoundingClientRect?.();
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

/** @returns {HTMLElement[]} */
function getViewerOnboardingFocusableElements() {
  if (!viewerElements.viewerOnboarding) return [];
  const controls = Array.from(viewerElements.viewerOnboarding.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(isHtmlElement).filter((element) => !element.closest(".hidden"));
  const targets = [
    ...(viewerState.viewerOnboardingFloatingTargets || []).map((entry) => entry.clone),
    viewerState.viewerOnboardingTarget
  ].filter(isHtmlElement);
  const targetControls = targets.flatMap((target) => [
    ...(target.matches?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ? [target] : []),
    ...Array.from(target.querySelectorAll?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])
  ]);
  return [...new Set([...controls, ...targetControls].filter(isHtmlElement))];
}

/** @param {HTMLElement|null|undefined} element @param {number} left @param {number} top @param {number} width @param {number} height */
function setViewerOnboardingShadeRect(element, left, top, width, height) {
  if (!element) return;
  element.style.left = `${Math.max(0, left)}px`;
  element.style.top = `${Math.max(0, top)}px`;
  element.style.width = `${Math.max(0, width)}px`;
  element.style.height = `${Math.max(0, height)}px`;
}

/** @param {RectLike|DOMRect|null|undefined} rawRect @param {number} [padding] @param {number} [viewportMargin] @returns {RectLike|null} */
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

/** @param {ViewerOnboardingPlacement} preferred @returns {Array<ViewerOnboardingPlacement>} */
function viewerOnboardingPlacementCandidates(preferred) {
  /** @type {Array<ViewerOnboardingPlacement>} */
  const all = ["below", "above", "left", "right"];
  return [preferred, ...all.filter((placement) => placement !== preferred)];
}

/** @param {RectLike} targetRect @param {DOMRect} calloutRect @param {ViewerOnboardingPlacement} preferredPlacement */
function calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, preferredPlacement) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = 12;
  const gap = 18;

  /** @param {ViewerOnboardingPlacement} placement */
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

  /** @param {PositionedPoint} point */
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
  (viewerState.viewerOnboardingFloatingTargets || []).forEach((entry) => entry.clone?.remove?.());
  viewerState.viewerOnboardingFloatingTargets = [];
}

/** @param {HTMLElement} clone */
function sanitizeViewerOnboardingFloatingTarget(clone) {
  clone.removeAttribute("id");
  clone.removeAttribute("aria-controls");
  clone.removeAttribute("aria-describedby");
  clone.querySelectorAll?.("[id]").forEach((element) => element.removeAttribute("id"));
  clone.querySelectorAll?.("[aria-controls]").forEach((element) => element.removeAttribute("aria-controls"));
  clone.classList.remove("hidden");
  clone.removeAttribute("hidden");
}

/** @param {HTMLButtonElement} source @param {HTMLButtonElement} clone */
function syncViewerOnboardingFloatingTargetState(source, clone) {
  ["aria-label", "aria-pressed", "title", "data-pinned", "data-fullscreen-active", "data-favorite-active"].forEach((attribute) => {
    const value = source.getAttribute(attribute);
    if (value !== null) clone.setAttribute(attribute, value);
    else clone.removeAttribute(attribute);
  });
  clone.disabled = source.disabled;
}

/** @param {ViewerOnboardingStep} step @returns {Array<ViewerOnboardingTargetDefinition>} */
function getViewerOnboardingFloatingTargetDefinitions(step) {
  const configured = step.floatingTargets?.() || [];
  return configured.filter((entry) => entry.source instanceof HTMLButtonElement).map((entry, index) => ({
    source: entry.source,
    id: String(entry.id || `target-${index + 1}`)
  }));
}

/** @param {ViewerOnboardingStep} step @param {Array<ViewerOnboardingTargetDefinition>} definitions */
function viewerOnboardingFloatingTargetsMatch(step, definitions) {
  const current = viewerState.viewerOnboardingFloatingTargets || [];
  return current.length === definitions.length && current.every((entry, index) => (
    entry.source === definitions[index].source
    && entry.id === definitions[index].id
    && entry.stepId === step.id
  ));
}

/** @param {ViewerOnboardingStep} step */
function updateViewerOnboardingFloatingTargets(step) {
  const definitions = getViewerOnboardingFloatingTargetDefinitions(step);
  if (!definitions.length || !viewerElements.viewerOnboarding) {
    removeViewerOnboardingFloatingTargets();
    return;
  }

  if (!viewerOnboardingFloatingTargetsMatch(step, definitions)) {
    removeViewerOnboardingFloatingTargets();
    viewerState.viewerOnboardingFloatingTargets = definitions.map(({ source, id }) => {
      const clone = /** @type {HTMLButtonElement} */ (source.cloneNode(true));
      sanitizeViewerOnboardingFloatingTarget(clone);
      clone.classList.add("viewer-onboarding-floating-target");
      clone.dataset.tourStep = step.id;
      clone.dataset.tourTarget = id;
      clone.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        source.click();
        window.requestAnimationFrame(() => {
          const isCurrentClone = (viewerState.viewerOnboardingFloatingTargets || [])
            .some((entry) => entry.clone === clone);
          if (!viewerState.viewerOnboardingOpen || !isCurrentClone) return;
          syncViewerOnboardingFloatingTargetState(source, clone);
          scheduleViewerOnboardingLayout(30);
        });
      });
      viewerElements.viewerOnboarding.appendChild(clone);
      return { source, clone, id, stepId: step.id };
    });
  }

  viewerState.viewerOnboardingFloatingTargets.forEach(({ source, clone }) => {
    syncViewerOnboardingFloatingTargetState(source, clone);
    const rect = source.getBoundingClientRect();
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
  });
}

function layoutViewerOnboarding() {
  if (!viewerState.viewerOnboardingOpen || !viewerElements.viewerOnboarding || !viewerElements.viewerOnboardingCard || !viewerElements.viewerOnboardingSpotlight) return;
  const steps = getViewerOnboardingSteps();
  const step = steps[viewerState.viewerOnboardingStep];
  if (!step) return;

  const target = step.target?.() || null;
  viewerState.viewerOnboardingTarget = target;
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
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeTop, 0, 0, viewportWidth, targetRect.top);
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeBottom, 0, targetRect.bottom, viewportWidth, viewportHeight - targetRect.bottom);
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeLeft, 0, targetRect.top, targetRect.left, targetRect.height);
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeRight, targetRect.right, targetRect.top, viewportWidth - targetRect.right, targetRect.height);

  const spotlight = viewerElements.viewerOnboardingSpotlight;
  spotlight.style.left = `${targetRect.left}px`;
  spotlight.style.top = `${targetRect.top}px`;
  spotlight.style.width = `${targetRect.width}px`;
  spotlight.style.height = `${targetRect.height}px`;
  spotlight.style.borderRadius = `${Number(step.radius || 18)}px`;
  spotlight.dataset.gesture = step.gesture || "";
  spotlight.dataset.tourStep = step.id || "";

  const calloutRect = viewerElements.viewerOnboardingCard.getBoundingClientRect();
  const calloutPosition = calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, step.preferredPlacement || "below");
  viewerElements.viewerOnboardingCard.style.left = `${calloutPosition.left}px`;
  viewerElements.viewerOnboardingCard.style.top = `${calloutPosition.top}px`;
  viewerElements.viewerOnboardingCard.dataset.placement = calloutPosition.placement;
}

function scheduleViewerOnboardingLayout(delay = 0) {
  const run = () => {
    window.cancelAnimationFrame(viewerState.viewerOnboardingLayoutRaf);
    viewerState.viewerOnboardingLayoutRaf = window.requestAnimationFrame(layoutViewerOnboarding);
  };

  if (delay > 0) {
    // Keep the immediate layout that was scheduled for this step. The delayed
    // pass only re-measures after toolbar/callout transitions have settled.
    window.clearTimeout(viewerState.viewerOnboardingLayoutTimer);
    viewerState.viewerOnboardingLayoutTimer = window.setTimeout(run, delay);
    return;
  }

  run();
}

/** @param {ViewerOnboardingStepOptions} [options] */
function renderViewerOnboardingStep(options = {}) {
  if (!viewerState.viewerOnboardingOpen) return;
  const { focus = true, scheduleLayout = true } = options;
  const steps = getViewerOnboardingSteps();
  viewerState.viewerOnboardingStep = clampValue(viewerState.viewerOnboardingStep, 0, Math.max(0, steps.length - 1));
  const step = steps[viewerState.viewerOnboardingStep];
  if (!step) return;

  const floatingTargetsBelongToStep = (viewerState.viewerOnboardingFloatingTargets || [])
    .every((entry) => entry.stepId === step.id);
  if (!floatingTargetsBelongToStep) {
    removeViewerOnboardingFloatingTargets();
  }

  viewerElements.lightbox?.classList.toggle("viewer-tour-show-top-ui", Boolean(step.revealTopBar));
  viewerElements.lightbox?.classList.toggle("viewer-tour-show-page-rail", Boolean(step.revealPageRail));
  if (step.revealTopBar) window.clearTimeout(viewerState.uiHideTimer);
  if (step.revealPageRail) window.clearTimeout(viewerState.pageRailHideTimer);

  if (viewerElements.viewerOnboardingEyebrow) viewerElements.viewerOnboardingEyebrow.textContent = step.eyebrow || "סיור קצר";
  if (viewerElements.viewerOnboardingTitle) viewerElements.viewerOnboardingTitle.textContent = step.title;
  if (viewerElements.viewerOnboardingDescription) viewerElements.viewerOnboardingDescription.textContent = step.description;
  if (viewerElements.viewerOnboardingCounter) viewerElements.viewerOnboardingCounter.textContent = `${viewerState.viewerOnboardingStep + 1} מתוך ${steps.length}`;
  if (viewerElements.viewerOnboardingNote) {
    viewerElements.viewerOnboardingNote.textContent = step.note || "";
    viewerElements.viewerOnboardingNote.classList.toggle("hidden", !step.note);
  }
  if (viewerElements.viewerOnboardingPrevious) viewerElements.viewerOnboardingPrevious.disabled = viewerState.viewerOnboardingStep === 0;
  if (viewerElements.viewerOnboardingNext) {
    viewerElements.viewerOnboardingNext.textContent = viewerState.viewerOnboardingStep === steps.length - 1 ? "סיום" : "הבא";
  }
  if (viewerElements.viewerOnboardingDots) {
    viewerElements.viewerOnboardingDots.innerHTML = steps.map((_, index) => (
      `<span${index === viewerState.viewerOnboardingStep ? ' class="active"' : ""}></span>`
    )).join("");
  }

  if (scheduleLayout) {
    scheduleViewerOnboardingLayout();
    scheduleViewerOnboardingLayout(260);
  }
  if (focus) window.requestAnimationFrame(() => viewerElements.viewerOnboardingNext?.focus?.({ preventScroll: true }));
}

/** @param {number} delta */
function moveViewerOnboardingStep(delta) {
  if (!viewerState.viewerOnboardingOpen) return;
  const steps = getViewerOnboardingSteps();
  const nextStep = viewerState.viewerOnboardingStep + delta;
  if (nextStep >= steps.length) {
    closeViewerOnboarding();
    return;
  }
  viewerState.viewerOnboardingStep = clampValue(nextStep, 0, Math.max(0, steps.length - 1));
  renderViewerOnboardingStep();
}

function restoreViewerUiAfterOnboarding() {
  const restore = viewerState.viewerOnboardingRestoreUi || { showUi: false, showPageRail: false };
  viewerElements.lightbox?.classList.remove("viewer-tour-active", "viewer-tour-show-top-ui", "viewer-tour-show-page-rail");
  if (viewerElements.lightbox) {
    if (viewerState.topUiPinned || restore.showUi) viewerElements.lightbox.classList.add("show-ui");
    else viewerElements.lightbox.classList.remove("show-ui");
    if (restore.showPageRail) viewerElements.lightbox.classList.add("show-page-rail");
    else viewerElements.lightbox.classList.remove("show-page-rail");
  }
  viewerState.viewerOnboardingRestoreUi = null;
}

/** @param {ViewerOnboardingCloseOptions} [options] */
function closeViewerOnboarding(options = {}) {
  if (!viewerState.viewerOnboardingOpen) return;
  const { restoreFocus = true, remember = true } = options;
  viewerState.viewerOnboardingOpen = false;
  viewerState.viewerOnboardingTarget = null;
  removeViewerOnboardingFloatingTargets();
  window.cancelAnimationFrame(viewerState.viewerOnboardingLayoutRaf);
  window.clearTimeout(viewerState.viewerOnboardingLayoutTimer);
  if (remember) markViewerOnboardingSeen();
  restoreViewerUiAfterOnboarding();
  viewerElements.viewerOnboarding?.classList.remove("visible");
  viewerElements.viewerOnboarding?.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (viewerState.viewerOnboardingOpen) return;
    viewerElements.viewerOnboarding?.classList.add("hidden");
    viewerElements.viewerOnboarding?.classList.remove("layout-ready");
  }, 220);
  if (restoreFocus) viewerElements.stageCanvas?.focus?.({ preventScroll: true });
}

function showViewerOnboardingIfNeeded() {
  if (!isViewerSessionOpen() || !viewerElements.viewerOnboarding || viewerState.viewerOnboardingOpen) return;
  if (viewerState.viewerOnboardingShownThisSession || viewerOnboardingWasSeen()) return;

  viewerState.viewerOnboardingShownThisSession = true;
  viewerState.viewerOnboardingOpen = true;
  viewerState.viewerOnboardingStep = 0;
  viewerState.viewerOnboardingRestoreUi = {
    showUi: Boolean(viewerElements.lightbox?.classList.contains("show-ui")),
    showPageRail: Boolean(viewerElements.lightbox?.classList.contains("show-page-rail"))
  };
  viewerElements.lightbox?.classList.add("viewer-tour-active");
  viewerElements.viewerOnboarding.classList.remove("hidden", "visible", "layout-ready");
  viewerElements.viewerOnboarding.setAttribute("aria-hidden", "false");

  // Build and measure the first step while the tour is still transparent.
  // Waiting one frame after revealing the real toolbar lets its layout settle,
  // so the callout is already in its final position before the fade-in begins.
  window.requestAnimationFrame(() => {
    if (!viewerState.viewerOnboardingOpen) return;
    renderViewerOnboardingStep({ focus: false, scheduleLayout: false });
    window.requestAnimationFrame(() => {
      if (!viewerState.viewerOnboardingOpen) return;
      layoutViewerOnboarding();
      viewerElements.viewerOnboarding.classList.add("layout-ready");
      window.requestAnimationFrame(() => {
        if (!viewerState.viewerOnboardingOpen) return;
        viewerElements.viewerOnboarding.classList.add("visible");
        viewerElements.viewerOnboardingNext?.focus?.({ preventScroll: true });
        scheduleViewerOnboardingLayout(260);
      });
    });
  });
}

/** @param {KeyboardEvent} event */
function handleViewerOnboardingKeydown(event) {
  if (!viewerState.viewerOnboardingOpen) return false;
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
    focusHtmlElement(last);
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    focusHtmlElement(first);
  }
  return true;
}

function attachViewerOnboardingEvents() {
  viewerElements.viewerOnboardingPrevious?.addEventListener("click", () => moveViewerOnboardingStep(-1));
  viewerElements.viewerOnboardingNext?.addEventListener("click", () => moveViewerOnboardingStep(1));
  viewerElements.viewerOnboardingSkip?.addEventListener("click", () => closeViewerOnboarding());
}

export { attachViewerOnboardingEvents, closeViewerOnboarding, handleViewerOnboardingKeydown, scheduleViewerOnboardingLayout, showViewerOnboardingIfNeeded };
