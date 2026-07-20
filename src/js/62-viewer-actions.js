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

function viewerInquiryReference() {
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
    source: "viewer-inquiry",
    mode: "single",
    itemCount: 1,
    catalog: state.catalog,
    page,
    title,
    pageLabel,
    subject,
    shareText,
    text,
    url,
    preview: thumbSrc(state.catalog, page) || pageSrc(state.catalog, page),
    previewAlt: `${title}, עמוד ${page}`,
    eyebrow: "פרטי העמוד מצורפים אוטומטית",
    dialogTitle: "בירור על הדגם",
    description: "אפשר לפתוח הודעה מוכנה ב-Gmail, להשתמש בתוכנת דואר, לשתף דרך המכשיר או להעתיק. שם הקטלוג, מספר העמוד והקישור המדויק מוכנים מראש.",
    copySuccessMessage: "פרטי הדגם הועתקו",
    shareFallbackMessage: "אפשרויות שיתוף אינן זמינות — פרטי הדגם הועתקו"
  };
}

function activeViewerInquiryReference() {
  return state.viewerInquiryReference || viewerInquiryReference();
}

function viewerInquiryTelemetryFields(reference) {
  return {
    source: reference?.source || "viewer-inquiry",
    catalogId: reference?.catalog?.id || "",
    pageNumber: reference?.page || 0,
    detail: Number(reference?.itemCount) > 1 ? `${reference.itemCount}-items` : ""
  };
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

function syncViewerInquiryContactLink(link, href, reference, action) {
  if (!link) return;
  const available = Boolean(href);
  link.classList.toggle("hidden", !available);
  link.setAttribute("aria-hidden", available ? "false" : "true");
  if (!available) {
    link.removeAttribute("href");
    return;
  }
  link.href = href;
  link.dataset.contactSource = reference.source || "viewer-inquiry";
  link.dataset.contactAction = action;
  if (reference.catalog?.id) link.dataset.contactCatalogId = reference.catalog.id;
  else delete link.dataset.contactCatalogId;
  if (reference.page) link.dataset.contactPage = String(reference.page);
  else delete link.dataset.contactPage;
}

function syncViewerInquiryUi(reference = activeViewerInquiryReference()) {
  if (!reference) return;

  if (els.viewerInquiryEyebrow) els.viewerInquiryEyebrow.textContent = reference.eyebrow || "פרטי הבירור מצורפים אוטומטית";
  if (els.viewerInquiryTitle) els.viewerInquiryTitle.textContent = reference.dialogTitle || "בירור על הדגם";
  if (els.viewerInquiryDescription) els.viewerInquiryDescription.textContent = reference.description || "פרטי הבירור מוכנים מראש.";
  if (els.viewerInquiryCatalog) els.viewerInquiryCatalog.textContent = reference.title;
  if (els.viewerInquiryPage) els.viewerInquiryPage.textContent = reference.pageLabel;
  if (els.viewerInquiryButton && reference.source === "viewer-inquiry") {
    const label = `בירור על הדגם — ${reference.title}, עמוד ${reference.page}`;
    els.viewerInquiryButton.setAttribute("aria-label", label);
  }

  if (els.viewerInquiryPreview) {
    const preview = reference.preview || thumbSrc(reference.catalog, reference.page) || pageSrc(reference.catalog, reference.page);
    if (els.viewerInquiryPreview.getAttribute("src") !== preview) {
      els.viewerInquiryPreview.src = preview;
    }
    els.viewerInquiryPreview.alt = reference.previewAlt || `${reference.title}, עמוד ${reference.page}`;
  }
  if (els.viewerInquiryPreviewFrame) {
    els.viewerInquiryPreviewFrame.dataset.inquiryMode = reference.mode || "single";
  }
  if (els.viewerInquiryCountBadge) {
    const extraCount = Math.max(0, Number(reference.itemCount || 1) - 1);
    els.viewerInquiryCountBadge.classList.toggle("hidden", extraCount === 0);
    els.viewerInquiryCountBadge.textContent = extraCount ? `+${extraCount}` : "";
  }
  const plural = Number(reference.itemCount || 1) > 1;
  if (els.viewerInquiryShareLabel) {
    els.viewerInquiryShareLabel.textContent = plural ? "שיתוף פרטי הדגמים" : "שיתוף פרטי הדגם";
  }
  if (els.viewerInquiryCopyLabel) {
    els.viewerInquiryCopyLabel.textContent = plural ? "העתקת ההודעה והקישורים" : "העתקת ההודעה והקישור";
  }

  const emailAddress = viewerInquiryEmailAddress();
  const emailAvailable = Boolean(emailAddress);
  const mailtoQuery = new URLSearchParams({ subject: reference.subject, body: reference.text });
  syncViewerInquiryContactLink(
    els.viewerInquiryEmail,
    emailAvailable ? `mailto:${emailAddress}?${mailtoQuery.toString()}` : "",
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

function getViewerInquiryFocusableElements() {
  if (!els.viewerInquiryOverlay) return [];
  return Array.from(els.viewerInquiryOverlay.querySelectorAll(
    'button:not([disabled]), a[href]:not(.hidden), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
}

function openViewerInquiry(reference = null, returnFocus = document.activeElement) {
  const resolvedReference = reference || viewerInquiryReference();
  if (!resolvedReference || !els.viewerInquiryOverlay) return;
  if (resolvedReference.source === "viewer-inquiry" && !isViewerSessionOpen()) return;

  if (isViewerSessionOpen()) {
    if (state.viewerOnboardingOpen) closeViewerOnboarding({ restoreFocus: false });
    closeViewerMobileMoreMenu();
    if (state.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { hideResults: true });
    }
  }
  state.viewerInquiryReference = resolvedReference;
  syncViewerInquiryUi(resolvedReference);
  state.viewerInquiryOpen = true;
  state.viewerInquiryReturnFocus = returnFocus || document.activeElement || els.viewerInquiryButton;
  els.viewerInquiryOverlay.classList.remove("hidden");
  els.viewerInquiryOverlay.setAttribute("aria-hidden", "false");
  els.viewerInquiryButton?.setAttribute("aria-expanded", resolvedReference.source === "viewer-inquiry" ? "true" : "false");
  els.favoritesInquiryButton?.setAttribute("aria-expanded", resolvedReference.source === "favorites-inquiry" ? "true" : "false");
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
  state.viewerInquiryReference = null;
  state.viewerInquiryReturnFocus = null;
  els.viewerInquiryOverlay?.classList.remove("visible");
  els.viewerInquiryOverlay?.setAttribute("aria-hidden", "true");
  els.viewerInquiryButton?.setAttribute("aria-expanded", "false");
  els.favoritesInquiryButton?.setAttribute("aria-expanded", "false");
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
  const reference = activeViewerInquiryReference();
  if (!reference) return;
  try {
    await copyTextToClipboard(reference.text);
    telemetryTrack("contact", {
      action: "copy",
      ...viewerInquiryTelemetryFields(reference)
    }, { immediate: true });
    showActionToast(reference.copySuccessMessage || "פרטי הדגם הועתקו", { tone: "link" });
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק את פרטי הדגם מכאן:", reference.text);
  }
}

async function shareViewerInquiryReference() {
  const reference = activeViewerInquiryReference();
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
      telemetryTrack("contact", {
        action: "share",
        ...viewerInquiryTelemetryFields(reference)
      }, { immediate: true });
      closeViewerInquiry({ restoreFocus: false });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(reference.text);
    telemetryTrack("contact", {
      action: "share",
      ...viewerInquiryTelemetryFields(reference),
      detail: Number(reference.itemCount) > 1
        ? `copy-fallback-${reference.itemCount}-items`
        : "copy-fallback"
    }, { immediate: true });
    showActionToast(reference.shareFallbackMessage || "אפשרויות שיתוף אינן זמינות — פרטי הדגם הועתקו", { tone: "link" });
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק ולשתף את פרטי הדגם מכאן:", reference.text);
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
    openViewerInquiry(viewerInquiryReference(), els.viewerInquiryButton);
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
