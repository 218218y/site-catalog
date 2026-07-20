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
  if (!state.catalog) return null;
  const page = clampPage(state.page, state.catalog);
  const url = absoluteDocumentUrl(viewerDocumentUrl(state.catalog.id, page));
  const title = String(state.catalog.title || "קטלוג").trim() || "קטלוג";
  const pageLabel = `עמוד ${page} מתוך ${Math.max(1, Number(state.catalog.pages) || 1)}`;
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
    catalog: state.catalog,
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
    previewCatalog: state.catalog,
    previewPage: page,
    telemetry: {
      source: "viewer-inquiry",
      catalogId: state.catalog.id,
      pageNumber: page
    }
  };
}

function viewerInquiryReference() {
  return state.viewerInquiryContext?.reference || viewerPageInquiryReference();
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

  if (els.viewerInquiryEyebrow) els.viewerInquiryEyebrow.textContent = reference.eyebrow || "פרטי הבירור מצורפים אוטומטית";
  if (els.viewerInquiryTitle) els.viewerInquiryTitle.textContent = reference.title || "בירור על הדגם";
  if (els.viewerInquiryDescription) els.viewerInquiryDescription.textContent = reference.description || "פרטי הבירור והקישורים מוכנים מראש.";
  if (els.viewerInquiryCatalog) els.viewerInquiryCatalog.textContent = reference.referenceTitle || reference.title;
  if (els.viewerInquiryPage) els.viewerInquiryPage.textContent = reference.pageLabel || "";
  els.viewerInquiryReference?.classList.toggle("is-bulk", reference.kind === "favorites");

  if (els.viewerInquiryButton && reference.kind === "viewer") {
    const label = `בירור על הדגם — ${reference.referenceTitle}, עמוד ${reference.page}`;
    els.viewerInquiryButton.setAttribute("aria-label", label);
  }

  const previewCatalog = reference.previewCatalog || reference.catalog;
  const previewPage = Number(reference.previewPage || reference.page) || 1;
  if (els.viewerInquiryPreview && previewCatalog) {
    const preview = thumbSrc(previewCatalog, previewPage) || pageSrc(previewCatalog, previewPage);
    if (els.viewerInquiryPreview.getAttribute("src") !== preview) {
      els.viewerInquiryPreview.src = preview;
    }
    els.viewerInquiryPreview.alt = reference.kind === "favorites"
      ? `תצוגה מקדימה של ${reference.referenceTitle}`
      : `${reference.referenceTitle}, עמוד ${previewPage}`;
  }

  const emailAddress = viewerInquiryEmailAddress();
  const emailAvailable = Boolean(emailAddress);
  syncViewerInquiryContactLink(
    els.viewerInquiryEmail,
    emailAvailable ? viewerInquiryMailtoUrl(emailAddress, reference) : "",
    reference,
    "email"
  );
  syncViewerInquiryContactLink(
    els.viewerInquiryGmail,
    emailAvailable ? viewerInquiryGmailUrl(emailAddress, reference) : "",
    reference,
    "gmail"
  );
}

function setViewerInquiryTriggerState(open, activeTrigger = null) {
  [els.viewerInquiryButton, els.favoritesInquiryButton].forEach((button) => {
    if (!button) return;
    button.setAttribute("aria-expanded", open && button === activeTrigger ? "true" : "false");
  });
}

function getViewerInquiryFocusableElements() {
  if (!els.viewerInquiryOverlay) return [];
  return Array.from(els.viewerInquiryOverlay.querySelectorAll(
    'button:not([disabled]), a[href]:not(.hidden), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
}

function openViewerInquiry(options = {}) {
  const reference = options.reference || viewerPageInquiryReference();
  if (!reference || !els.viewerInquiryOverlay) return;
  if (state.viewerOnboardingOpen) closeViewerOnboarding({ restoreFocus: false });
  if (isViewerSessionOpen()) {
    closeViewerMobileMoreMenu();
    if (state.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { hideResults: true });
    }
  }

  const returnFocus = options.returnFocus || document.activeElement || els.viewerInquiryButton;
  state.viewerInquiryContext = { reference, trigger: returnFocus };
  state.viewerInquiryOpen = true;
  state.viewerInquiryReturnFocus = returnFocus;
  syncViewerInquiryUi(reference);
  els.viewerInquiryOverlay.classList.remove("hidden");
  els.viewerInquiryOverlay.setAttribute("aria-hidden", "false");
  setViewerInquiryTriggerState(true, returnFocus);
  syncDocumentLock();
  window.requestAnimationFrame(() => {
    if (!state.viewerInquiryOpen) return;
    els.viewerInquiryOverlay?.classList.add("visible");
    (els.viewerInquiryClose || getViewerInquiryFocusableElements()[0])?.focus?.({ preventScroll: true });
  });
}

function closeViewerInquiry(options = {}) {
  if (!state.viewerInquiryOpen && els.viewerInquiryOverlay?.classList.contains("hidden")) return;
  const { restoreFocus = true } = options;
  const returnFocus = state.viewerInquiryReturnFocus;
  state.viewerInquiryOpen = false;
  state.viewerInquiryReturnFocus = null;
  state.viewerInquiryContext = null;
  els.viewerInquiryOverlay?.classList.remove("visible");
  els.viewerInquiryOverlay?.setAttribute("aria-hidden", "true");
  setViewerInquiryTriggerState(false);
  syncDocumentLock();
  window.setTimeout(() => {
    if (!state.viewerInquiryOpen) els.viewerInquiryOverlay?.classList.add("hidden");
  }, 180);
  if (restoreFocus) (returnFocus || els.viewerInquiryButton)?.focus?.({ preventScroll: true });
}

function handleViewerInquiryKeydown(event) {
  if (!state.viewerInquiryOpen) return false;
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
  const menu = els.viewerMobileMoreMenu;
  if (!menu) return;
  const fitMode = normalizeViewerFitMode(state.imageFitMode);
  const pinItem = menu.querySelector('[data-viewer-mobile-action="pin"]');
  const heightItem = menu.querySelector('[data-viewer-mobile-action="fit-height"]');
  const widthItem = menu.querySelector('[data-viewer-mobile-action="fit-width"]');
  const pinLabel = menu.querySelector("[data-viewer-mobile-pin-label]");

  pinItem?.setAttribute("aria-checked", state.topUiPinned ? "true" : "false");
  pinItem?.classList.toggle("active", state.topUiPinned);
  if (pinLabel) pinLabel.textContent = state.topUiPinned ? "ביטול נעיצת הסרגל" : "נעיצת הסרגל";
  heightItem?.setAttribute("aria-checked", fitMode === VIEWER_FIT_HEIGHT ? "true" : "false");
  heightItem?.classList.toggle("active", fitMode === VIEWER_FIT_HEIGHT);
  widthItem?.setAttribute("aria-checked", fitMode === VIEWER_FIT_WIDTH ? "true" : "false");
  widthItem?.classList.toggle("active", fitMode === VIEWER_FIT_WIDTH);
  if (els.viewerMobileFavoritesLink) els.viewerMobileFavoritesLink.href = favoritesDocumentUrl();
}

function setViewerMobileMoreOpen(open, options = {}) {
  const shouldOpen = Boolean(open && isViewerSessionOpen() && isMobileViewerToolbarMode());
  state.viewerMobileMoreOpen = shouldOpen;
  syncViewerMobileMoreMenuState();
  els.viewerMobileMoreMenu?.classList.toggle("hidden", !shouldOpen);
  els.viewerMobileMoreMenu?.classList.toggle("visible", shouldOpen);
  els.viewerMobileMoreToggle?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  els.viewerMobileMoreToggle?.classList.toggle("is-active", shouldOpen);
  els.lightbox?.classList.toggle("mobile-more-open", shouldOpen);

  if (shouldOpen) {
    showTopUiTemporarily(0);
    window.requestAnimationFrame(() => {
      els.viewerMobileMoreMenu?.querySelector('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')?.focus?.({ preventScroll: true });
    });
  } else if (options.returnFocus) {
    els.viewerMobileMoreToggle?.focus?.({ preventScroll: true });
  }
}

function closeViewerMobileMoreMenu(options = {}) {
  setViewerMobileMoreOpen(false, options);
}

function getViewerMobileMoreItems() {
  if (!els.viewerMobileMoreMenu) return [];
  return Array.from(els.viewerMobileMoreMenu.querySelectorAll(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
  )).filter((item) => !item.classList.contains("hidden") && item.getAttribute("aria-hidden") !== "true");
}

function handleViewerMobileMoreKeydown(event) {
  if (!state.viewerMobileMoreOpen) return;
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
  if (!item || !els.viewerMobileMoreMenu?.contains(item)) return;
  event.preventDefault();
  event.stopPropagation();
  const action = item.dataset.viewerMobileAction;

  if (action === "download") downloadCurrentLightboxImage();
  else if (action === "pin") toggleTopUiPinned();
  else if (action === "fit-height") setViewerFitMode(VIEWER_FIT_HEIGHT, { showUi: false });
  else if (action === "fit-width") setViewerFitMode(VIEWER_FIT_WIDTH, { showUi: false });

  syncViewerMobileMoreMenuState();
  closeViewerMobileMoreMenu({ returnFocus: true });
}

function attachViewerActionEvents() {
  els.viewerInquiryButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openViewerInquiry({ returnFocus: els.viewerInquiryButton });
  });
  els.viewerInquiryBackdrop?.addEventListener("click", () => closeViewerInquiry());
  els.viewerInquiryClose?.addEventListener("click", () => closeViewerInquiry());
  els.viewerInquiryShare?.addEventListener("click", () => shareViewerInquiryReference());
  els.viewerInquiryCopy?.addEventListener("click", () => copyViewerInquiryReference());
  els.viewerInquiryOverlay?.addEventListener("keydown", handleViewerInquiryKeydown);
  [els.viewerInquiryGmail, els.viewerInquiryEmail].forEach((link) => {
    link?.addEventListener("click", () => window.setTimeout(() => closeViewerInquiry({ restoreFocus: false }), 0));
  });

  els.viewerMobileMoreToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setViewerMobileMoreOpen(!state.viewerMobileMoreOpen, { returnFocus: state.viewerMobileMoreOpen });
  });
  els.viewerMobileMoreMenu?.addEventListener("click", handleViewerMobileMoreAction);
  els.viewerMobileMoreMenu?.addEventListener("keydown", handleViewerMobileMoreKeydown);
  els.viewerMobileFavoritesLink?.addEventListener("click", () => closeViewerMobileMoreMenu());

  document.addEventListener("pointerdown", (event) => {
    if (!state.viewerMobileMoreOpen) return;
    if (els.viewerMobileMoreMenu?.contains(event.target) || els.viewerMobileMoreToggle?.contains(event.target)) return;
    closeViewerMobileMoreMenu();
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!isMobileViewerToolbarMode()) closeViewerMobileMoreMenu();
  });
}
