/**
 * Source module: 62-viewer-actions.js
 * Viewer inquiry workflow and compact mobile utility menu.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

const MOBILE_VIEWER_TOOLBAR_MEDIA = "(max-width: 760px)";

function isMobileViewerToolbarMode() {
  return Boolean(window.matchMedia?.(MOBILE_VIEWER_TOOLBAR_MEDIA).matches);
}

function viewerInquiryFooterEmail() {
  return Array.from(document.querySelectorAll(".site-footer-contact-list a[href]"))
    .find((link) => String(link.getAttribute("href") || "").startsWith("mailto:")) || null;
}

function viewerInquiryEmailAddress() {
  const emailHref = String(viewerInquiryFooterEmail()?.getAttribute?.("href") || "").trim();
  return emailHref.replace(/^mailto:/i, "").split("?")[0].trim();
}

function viewerPageInquiryReference() {
  if (!navigationState.catalog) return null;
  const page = clampPage(navigationState.page, navigationState.catalog);
  const url = absoluteDocumentUrl(viewerDocumentUrl(navigationState.catalog.id, page));
  const title = String(navigationState.catalog.title || "קטלוג").trim() || "קטלוג";
  const pageLabel = `עמוד ${page} מתוך ${Math.max(1, Number(navigationState.catalog.pages) || 1)}`;
  const subject = `בירור על דגם – ${title}, עמוד ${page}`;
  const shareText = [
    "שלום,",
    "רציתי לברר לגבי הדגם הבא:",
    `קטלוג: ${title}`,
    `עמוד: ${page}`
  ].join("\n");
  const text = `${shareText}\nקישור ישיר: ${url}`;
  return {
    kind: "viewer",
    source: "viewer-inquiry",
    catalog: navigationState.catalog,
    page,
    title: "בירור על הדגם",
    eyebrow: "פרטי העמוד מצורפים אוטומטית",
    description: "אפשר לפתוח הודעה מוכנה ב-Gmail, להשתמש בתוכנת דואר, לשתף דרך המכשיר או להעתיק. שם הקטלוג, מספר העמוד והקישור המדויק מוכנים מראש.",
    referenceTitle: title,
    pageLabel,
    subject,
    shareText,
    text,
    url,
    previewCatalog: navigationState.catalog,
    previewPage: page,
    telemetry: {
      source: "viewer-inquiry",
      catalogId: navigationState.catalog.id,
      pageNumber: page
    }
  };
}

function viewerInquiryReference() {
  return viewerState.viewerInquiryContext?.reference || viewerPageInquiryReference();
}

function viewerInquiryGmailUrl(emailAddress, reference) {
  const query = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: emailAddress,
    su: reference.subject,
    body: reference.text
  });
  return `https://mail.google.com/mail/?${query.toString()}`;
}

function viewerInquiryMailtoUrl(emailAddress, reference) {
  const subject = encodeURIComponent(String(reference?.subject || ""));
  const body = encodeURIComponent(
    String(reference?.text || "").replace(/\r?\n/g, "\r\n")
  );
  return `mailto:${emailAddress}?subject=${subject}&body=${body}`;
}

function viewerInquiryTelemetryFields(reference, action, detail = "") {
  const telemetry = reference?.telemetry || {};
  return {
    action,
    detail,
    source: telemetry.source || reference?.source || "viewer-inquiry",
    catalogId: telemetry.catalogId || reference?.catalog?.id || "",
    pageNumber: telemetry.pageNumber || reference?.page || 0,
    value: telemetry.value || reference?.count || 0
  };
}

function syncViewerInquiryContactLink(link, href, reference, action) {
  if (!link) return;
  const available = Boolean(href);
  link.classList.toggle("hidden", !available);
  link.setAttribute("aria-hidden", available ? "false" : "true");
  if (!available) {
    link.removeAttribute("href");
    delete link.dataset.contactSource;
    delete link.dataset.contactAction;
    delete link.dataset.contactCatalogId;
    delete link.dataset.contactPage;
    return;
  }
  const telemetry = viewerInquiryTelemetryFields(reference, action);
  link.href = href;
  link.dataset.contactSource = telemetry.source;
  link.dataset.contactAction = action;
  if (telemetry.catalogId) link.dataset.contactCatalogId = telemetry.catalogId;
  else delete link.dataset.contactCatalogId;
  if (telemetry.pageNumber) link.dataset.contactPage = String(telemetry.pageNumber);
  else delete link.dataset.contactPage;
}

function syncViewerInquiryUi(reference = viewerInquiryReference()) {
  if (!reference) return;

  if (viewerElements.viewerInquiryEyebrow) viewerElements.viewerInquiryEyebrow.textContent = reference.eyebrow || "פרטי הבירור מצורפים אוטומטית";
  if (viewerElements.viewerInquiryTitle) viewerElements.viewerInquiryTitle.textContent = reference.title || "בירור על הדגם";
  if (viewerElements.viewerInquiryDescription) viewerElements.viewerInquiryDescription.textContent = reference.description || "פרטי הבירור והקישורים מוכנים מראש.";
  if (viewerElements.viewerInquiryCatalog) viewerElements.viewerInquiryCatalog.textContent = reference.referenceTitle || reference.title;
  if (viewerElements.viewerInquiryPage) viewerElements.viewerInquiryPage.textContent = reference.pageLabel || "";
  viewerElements.viewerInquiryReference?.classList.toggle("is-bulk", reference.kind === "favorites");

  if (viewerElements.viewerInquiryButton && reference.kind === "viewer") {
    const label = `בירור על הדגם — ${reference.referenceTitle}, עמוד ${reference.page}`;
    viewerElements.viewerInquiryButton.setAttribute("aria-label", label);
  }

  const previewCatalog = reference.previewCatalog || reference.catalog;
  const previewPage = Number(reference.previewPage || reference.page) || 1;
  if (viewerElements.viewerInquiryPreview && previewCatalog) {
    const preview = thumbSrc(previewCatalog, previewPage) || pageSrc(previewCatalog, previewPage);
    if (viewerElements.viewerInquiryPreview.getAttribute("src") !== preview) {
      viewerElements.viewerInquiryPreview.src = preview;
    }
    viewerElements.viewerInquiryPreview.alt = reference.kind === "favorites"
      ? `תצוגה מקדימה של ${reference.referenceTitle}`
      : `${reference.referenceTitle}, עמוד ${previewPage}`;
  }

  const emailAddress = viewerInquiryEmailAddress();
  const emailAvailable = Boolean(emailAddress);
  syncViewerInquiryContactLink(
    viewerElements.viewerInquiryEmail,
    emailAvailable ? viewerInquiryMailtoUrl(emailAddress, reference) : "",
    reference,
    "email"
  );
  syncViewerInquiryContactLink(
    viewerElements.viewerInquiryGmail,
    emailAvailable ? viewerInquiryGmailUrl(emailAddress, reference) : "",
    reference,
    "gmail"
  );
}

function setViewerInquiryTriggerState(open, activeTrigger = null) {
  [viewerElements.viewerInquiryButton, favoritesElements.favoritesInquiryButton].forEach((button) => {
    if (!button) return;
    button.setAttribute("aria-expanded", open && button === activeTrigger ? "true" : "false");
  });
}

function getViewerInquiryFocusableElements() {
  if (!viewerElements.viewerInquiryOverlay) return [];
  return Array.from(viewerElements.viewerInquiryOverlay.querySelectorAll(
    'button:not([disabled]), a[href]:not(.hidden), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
}

function openViewerInquiry(options = {}) {
  const reference = options.reference || viewerPageInquiryReference();
  if (!reference || !viewerElements.viewerInquiryOverlay) return;
  if (viewerState.viewerOnboardingOpen) closeViewerOnboarding({ restoreFocus: false });
  if (isViewerSessionOpen()) {
    closeViewerMobileMoreMenu();
    if (getFeatureInterface("search")?.isLightboxMobileOpen?.()) {
      getFeatureInterface("search")?.setLightboxMobileOpen?.(false, { hideResults: true });
    }
  }

  const returnFocus = options.returnFocus || document.activeElement || viewerElements.viewerInquiryButton;
  viewerState.viewerInquiryContext = { reference, trigger: returnFocus };
  viewerState.viewerInquiryOpen = true;
  viewerState.viewerInquiryReturnFocus = returnFocus;
  syncViewerInquiryUi(reference);
  viewerElements.viewerInquiryOverlay.classList.remove("hidden");
  viewerElements.viewerInquiryOverlay.setAttribute("aria-hidden", "false");
  setViewerInquiryTriggerState(true, returnFocus);
  syncDocumentLock();
  window.requestAnimationFrame(() => {
    if (!viewerState.viewerInquiryOpen) return;
    viewerElements.viewerInquiryOverlay?.classList.add("visible");
    (viewerElements.viewerInquiryClose || getViewerInquiryFocusableElements()[0])?.focus?.({ preventScroll: true });
  });
}

function closeViewerInquiry(options = {}) {
  if (!viewerState.viewerInquiryOpen && viewerElements.viewerInquiryOverlay?.classList.contains("hidden")) return;
  const { restoreFocus = true } = options;
  const returnFocus = viewerState.viewerInquiryReturnFocus;
  viewerState.viewerInquiryOpen = false;
  viewerState.viewerInquiryReturnFocus = null;
  viewerState.viewerInquiryContext = null;
  viewerElements.viewerInquiryOverlay?.classList.remove("visible");
  viewerElements.viewerInquiryOverlay?.setAttribute("aria-hidden", "true");
  setViewerInquiryTriggerState(false);
  syncDocumentLock();
  window.setTimeout(() => {
    if (!viewerState.viewerInquiryOpen) viewerElements.viewerInquiryOverlay?.classList.add("hidden");
  }, 180);
  if (restoreFocus) (returnFocus || viewerElements.viewerInquiryButton)?.focus?.({ preventScroll: true });
}

function handleViewerInquiryKeydown(event) {
  if (!viewerState.viewerInquiryOpen) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeViewerInquiry();
    return true;
  }
  if (event.key !== "Tab") return true;

  const focusable = getViewerInquiryFocusableElements();
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

async function copyViewerInquiryReference() {
  const reference = viewerInquiryReference();
  if (!reference) return;
  try {
    await copyTextToClipboard(reference.text);
    telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "copy"), { immediate: true });
    showActionToast(reference.kind === "favorites" ? "פרטי הדגמים הועתקו" : "פרטי הדגם הועתקו", { tone: "link" });
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק את פרטי הבירור מכאן:", reference.text);
  }
}

async function shareViewerInquiryReference() {
  const reference = viewerInquiryReference();
  if (!reference) return;

  // Keep URL and text as separate Web Share fields. On Windows/Chrome this
  // preserves the wider set of registered share targets (including Gmail).
  // Targets may choose which fields they consume, so the dedicated Gmail and
  // copy actions remain the reliable paths for the complete prepared message.
  const shareData = {
    title: reference.subject,
    text: reference.shareText,
    url: reference.url
  };
  let canUseNativeShare = typeof navigator.share === "function";
  if (canUseNativeShare && typeof navigator.canShare === "function") {
    try {
      canUseNativeShare = navigator.canShare(shareData);
    } catch (_error) {
      canUseNativeShare = false;
    }
  }

  if (canUseNativeShare) {
    try {
      await navigator.share(shareData);
      telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "share"), { immediate: true });
      closeViewerInquiry({ restoreFocus: false });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(reference.text);
    telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "share", "copy-fallback"), { immediate: true });
    showActionToast(
      reference.kind === "favorites"
        ? "אפשרויות שיתוף אינן זמינות — פרטי הדגמים הועתקו"
        : "אפשרויות שיתוף אינן זמינות — פרטי הדגם הועתקו",
      { tone: "link" }
    );
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק ולשתף את פרטי הבירור מכאן:", reference.text);
  }
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
  if (favoritesElements.viewerMobileFavoritesLink) favoritesElements.viewerMobileFavoritesLink.href = favoritesDocumentUrl();
}

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
      viewerElements.viewerMobileMoreMenu?.querySelector('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')?.focus?.({ preventScroll: true });
    });
  } else if (options.returnFocus) {
    viewerElements.viewerMobileMoreToggle?.focus?.({ preventScroll: true });
  }
}

function closeViewerMobileMoreMenu(options = {}) {
  setViewerMobileMoreOpen(false, options);
}

function getViewerMobileMoreItems() {
  if (!viewerElements.viewerMobileMoreMenu) return [];
  return Array.from(viewerElements.viewerMobileMoreMenu.querySelectorAll(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
  )).filter((item) => !item.classList.contains("hidden") && item.getAttribute("aria-hidden") !== "true");
}

function handleViewerMobileMoreKeydown(event) {
  if (!viewerState.viewerMobileMoreOpen) return;
  const items = getViewerMobileMoreItems();
  if (!items.length) return;

  const currentIndex = Math.max(0, items.indexOf(document.activeElement));
  let nextIndex = -1;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = items.length - 1;
  else return;

  event.preventDefault();
  items[nextIndex]?.focus?.({ preventScroll: true });
}

function handleViewerMobileMoreAction(event) {
  const item = event.target.closest?.("[data-viewer-mobile-action]");
  if (!item || !viewerElements.viewerMobileMoreMenu?.contains(item)) return;
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
  viewerElements.viewerInquiryButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openViewerInquiry({ returnFocus: viewerElements.viewerInquiryButton });
  });
  viewerElements.viewerInquiryBackdrop?.addEventListener("click", () => closeViewerInquiry());
  viewerElements.viewerInquiryClose?.addEventListener("click", () => closeViewerInquiry());
  viewerElements.viewerInquiryShare?.addEventListener("click", () => shareViewerInquiryReference());
  viewerElements.viewerInquiryCopy?.addEventListener("click", () => copyViewerInquiryReference());
  viewerElements.viewerInquiryOverlay?.addEventListener("keydown", handleViewerInquiryKeydown);
  [viewerElements.viewerInquiryGmail, viewerElements.viewerInquiryEmail].forEach((link) => {
    link?.addEventListener("click", () => window.setTimeout(() => closeViewerInquiry({ restoreFocus: false }), 0));
  });

  viewerElements.viewerMobileMoreToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setViewerMobileMoreOpen(!viewerState.viewerMobileMoreOpen, { returnFocus: viewerState.viewerMobileMoreOpen });
  });
  viewerElements.viewerMobileMoreMenu?.addEventListener("click", handleViewerMobileMoreAction);
  viewerElements.viewerMobileMoreMenu?.addEventListener("keydown", handleViewerMobileMoreKeydown);
  favoritesElements.viewerMobileFavoritesLink?.addEventListener("click", () => closeViewerMobileMoreMenu());

  document.addEventListener("pointerdown", (event) => {
    if (!viewerState.viewerMobileMoreOpen) return;
    if (viewerElements.viewerMobileMoreMenu?.contains(event.target) || viewerElements.viewerMobileMoreToggle?.contains(event.target)) return;
    closeViewerMobileMoreMenu();
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!isMobileViewerToolbarMode()) closeViewerMobileMoreMenu();
  });
}
