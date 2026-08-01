/**
 * Source module: 32-shared-inquiry.js
 * Inquiry dialog shared by the Viewer and the favorites workspace.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { DialogCloseOptions, InquiryOpenOptions, InquiryReference } from "../../types/frontend-contracts.js" */

import { absoluteDocumentUrl, viewerDocumentUrl } from "./00-navigation.js";
import { $requiredAnchor, $requiredButton, $requiredImage, requiredElement } from "./02-dom-contracts.js";
import { getFeatureInterface, registerFeatureInterface } from "./10-app-state.js";
import { telemetryTrack } from "./15-telemetry.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { catalogLastPage } from "./06-catalog-page-numbering.js";
import { buildViewerInquiryMailtoUrl } from "./19-shared-pure.js";
import { clampPage, focusHtmlElement, isHtmlElement, pageSrc, showActionToast, syncDocumentLock, thumbSrc } from "./20-shared-ui.js";
import { copyTextToClipboard } from "./30-favorites-share.js";

/** @type {{open:boolean, returnFocus:HTMLElement|null, reference:InquiryReference|null}} */
const inquiryState = {
  open: false,
  returnFocus: null,
  reference: null
};

const inquiryElements = Object.freeze({
  viewerInquiryButton: $requiredButton("viewerInquiryButton"),
  viewerInquiryOverlay: requiredElement("viewerInquiryOverlay"),
  viewerInquiryBackdrop: requiredElement("viewerInquiryBackdrop"),
  viewerInquiryClose: $requiredButton("viewerInquiryClose"),
  viewerInquiryEyebrow: requiredElement("viewerInquiryEyebrow"),
  viewerInquiryTitle: requiredElement("viewerInquiryTitle"),
  viewerInquiryDescription: requiredElement("viewerInquiryDescription"),
  viewerInquiryReference: requiredElement("viewerInquiryReference"),
  viewerInquiryCatalog: requiredElement("viewerInquiryCatalog"),
  viewerInquiryPage: requiredElement("viewerInquiryPage"),
  viewerInquiryPreview: $requiredImage("viewerInquiryPreview"),
  viewerInquiryActions: requiredElement("viewerInquiryActions"),
  viewerInquiryGmail: $requiredAnchor("viewerInquiryGmail"),
  viewerInquiryEmail: $requiredAnchor("viewerInquiryEmail"),
  viewerInquiryShare: $requiredButton("viewerInquiryShare"),
  viewerInquiryCopy: $requiredButton("viewerInquiryCopy")
});

/** @returns {HTMLAnchorElement|null} */
function viewerInquiryFooterEmail() {
  const link = Array.from(document.querySelectorAll(".site-footer-contact-list a[href]"))
    .find((candidate) => String(candidate.getAttribute("href") || "").startsWith("mailto:"));
  return link instanceof HTMLAnchorElement ? link : null;
}

function viewerInquiryEmailAddress() {
  const emailHref = String(viewerInquiryFooterEmail()?.getAttribute?.("href") || "").trim();
  return emailHref.replace(/^mailto:/i, "").split("?")[0].trim();
}

function viewerPageInquiryReference() {
  const catalog = activeCatalog();
  if (!catalog) return null;
  const page = clampPage(activePage(), catalog);
  const url = absoluteDocumentUrl(viewerDocumentUrl(catalog.id, page));
  const title = String(catalog.title || "קטלוג").trim() || "קטלוג";
  const pageLabel = `עמוד ${page} מתוך ${catalogLastPage(catalog)}`;
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
    catalog,
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
    previewCatalog: catalog,
    previewPage: page,
    telemetry: {
      source: "viewer-inquiry",
      catalogId: catalog.id,
      pageNumber: page
    }
  };
}

function viewerInquiryReference() {
  return inquiryState.reference || viewerPageInquiryReference();
}

/** @param {string} emailAddress @param {InquiryReference} reference */
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

/** @param {string} emailAddress @param {InquiryReference} reference */
function viewerInquiryMailtoUrl(emailAddress, reference) {
  return buildViewerInquiryMailtoUrl(emailAddress, reference);
}

/** @param {InquiryReference} reference @param {string} action @param {string} [detail] */
function viewerInquiryTelemetryFields(reference, action, detail = "") {
  const telemetry = reference?.telemetry || {};
  return {
    action,
    detail,
    source: telemetry.source || reference?.source || "viewer-inquiry",
    catalogId: telemetry.catalogId || reference?.catalog?.id || "",
    pageNumber: telemetry.pageNumber ?? reference?.page ?? 0,
    value: telemetry.value || reference?.count || 0
  };
}

/** @param {HTMLAnchorElement} link @param {string} href @param {InquiryReference} reference @param {string} action */
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
  if (Number.isFinite(Number(telemetry.pageNumber))) link.dataset.contactPage = String(telemetry.pageNumber);
  else delete link.dataset.contactPage;
}

/** @param {InquiryReference|null} [reference] */
function syncViewerInquiryUi(reference = viewerInquiryReference()) {
  if (!reference) return;

  if (inquiryElements.viewerInquiryEyebrow) inquiryElements.viewerInquiryEyebrow.textContent = reference.eyebrow || "פרטי הבירור מצורפים אוטומטית";
  if (inquiryElements.viewerInquiryTitle) inquiryElements.viewerInquiryTitle.textContent = reference.title || "בירור על הדגם";
  if (inquiryElements.viewerInquiryDescription) inquiryElements.viewerInquiryDescription.textContent = reference.description || "פרטי הבירור והקישורים מוכנים מראש.";
  if (inquiryElements.viewerInquiryCatalog) inquiryElements.viewerInquiryCatalog.textContent = reference.referenceTitle || reference.title;
  if (inquiryElements.viewerInquiryPage) inquiryElements.viewerInquiryPage.textContent = reference.pageLabel || "";
  inquiryElements.viewerInquiryReference?.classList.toggle("is-bulk", reference.kind === "favorites");

  if (inquiryElements.viewerInquiryButton && reference.kind === "viewer") {
    const label = `בירור על הדגם — ${reference.referenceTitle}, עמוד ${reference.page}`;
    inquiryElements.viewerInquiryButton.setAttribute("aria-label", label);
  }

  const previewCatalog = reference.previewCatalog || reference.catalog;
  const rawPreviewPage = reference.previewPage ?? reference.page;
  const previewPage = Number.isFinite(Number(rawPreviewPage)) ? Number(rawPreviewPage) : 1;
  if (inquiryElements.viewerInquiryPreview && previewCatalog) {
    const preview = thumbSrc(previewCatalog, previewPage) || pageSrc(previewCatalog, previewPage);
    if (inquiryElements.viewerInquiryPreview.getAttribute("src") !== preview) {
      inquiryElements.viewerInquiryPreview.src = preview;
    }
    inquiryElements.viewerInquiryPreview.alt = reference.kind === "favorites"
      ? `תצוגה מקדימה של ${reference.referenceTitle}`
      : `${reference.referenceTitle}, עמוד ${previewPage}`;
  }

  const emailAddress = viewerInquiryEmailAddress();
  const emailAvailable = Boolean(emailAddress);
  syncViewerInquiryContactLink(
    inquiryElements.viewerInquiryEmail,
    emailAvailable ? viewerInquiryMailtoUrl(emailAddress, reference) : "",
    reference,
    "email"
  );
  syncViewerInquiryContactLink(
    inquiryElements.viewerInquiryGmail,
    emailAvailable ? viewerInquiryGmailUrl(emailAddress, reference) : "",
    reference,
    "gmail"
  );
}

/** @param {boolean} open @param {HTMLElement|null} [activeTrigger] */
function setViewerInquiryTriggerState(open, activeTrigger = null) {
  inquiryElements.viewerInquiryButton.setAttribute(
    "aria-expanded",
    open && inquiryElements.viewerInquiryButton === activeTrigger ? "true" : "false"
  );
  getFeatureInterface("favorites")?.syncInquiryTrigger(open, activeTrigger);
}

/** @returns {HTMLElement[]} */
function getViewerInquiryFocusableElements() {
  return Array.from(inquiryElements.viewerInquiryOverlay.querySelectorAll(
    'button:not([disabled]), a[href]:not(.hidden), [tabindex]:not([tabindex="-1"])'
  )).filter(isHtmlElement).filter((element) => !element.closest(".hidden"));
}

/** @param {InquiryOpenOptions} [options] */
function openViewerInquiry(options = {}) {
  const reference = options.reference || viewerPageInquiryReference();
  if (!reference || !inquiryElements.viewerInquiryOverlay) return;
  getFeatureInterface("viewer")?.prepareInquiry?.();

  const returnFocus = isHtmlElement(options.returnFocus)
    ? options.returnFocus
    : (isHtmlElement(document.activeElement) ? document.activeElement : inquiryElements.viewerInquiryButton);
  inquiryState.reference = reference;
  inquiryState.open = true;
  inquiryState.returnFocus = returnFocus;
  syncViewerInquiryUi(reference);
  inquiryElements.viewerInquiryOverlay.classList.remove("hidden");
  inquiryElements.viewerInquiryOverlay.setAttribute("aria-hidden", "false");
  setViewerInquiryTriggerState(true, returnFocus);
  syncDocumentLock();
  window.requestAnimationFrame(() => {
    if (!inquiryState.open) return;
    inquiryElements.viewerInquiryOverlay?.classList.add("visible");
    focusHtmlElement(inquiryElements.viewerInquiryClose || getViewerInquiryFocusableElements()[0], { preventScroll: true });
  });
}

/** @param {DialogCloseOptions} [options] */
function closeViewerInquiry(options = {}) {
  if (!inquiryState.open && inquiryElements.viewerInquiryOverlay?.classList.contains("hidden")) return;
  const { restoreFocus = true } = options;
  const returnFocus = inquiryState.returnFocus;
  inquiryState.open = false;
  inquiryState.returnFocus = null;
  inquiryState.reference = null;
  inquiryElements.viewerInquiryOverlay?.classList.remove("visible");
  inquiryElements.viewerInquiryOverlay?.setAttribute("aria-hidden", "true");
  setViewerInquiryTriggerState(false);
  syncDocumentLock();
  window.setTimeout(() => {
    if (!inquiryState.open) inquiryElements.viewerInquiryOverlay?.classList.add("hidden");
  }, 180);
  if (restoreFocus) focusHtmlElement(returnFocus || inquiryElements.viewerInquiryButton, { preventScroll: true });
}

/** @param {KeyboardEvent} event */
function handleViewerInquiryKeydown(event) {
  if (!inquiryState.open) return false;
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
    focusHtmlElement(last);
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    focusHtmlElement(first);
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
      if (error instanceof DOMException && error.name === "AbortError") return;
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

function attachSharedInquiryEvents() {
  inquiryElements.viewerInquiryButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openViewerInquiry({ returnFocus: inquiryElements.viewerInquiryButton });
  });
  inquiryElements.viewerInquiryBackdrop?.addEventListener("click", () => closeViewerInquiry());
  inquiryElements.viewerInquiryClose?.addEventListener("click", () => closeViewerInquiry());
  inquiryElements.viewerInquiryShare?.addEventListener("click", () => shareViewerInquiryReference());
  inquiryElements.viewerInquiryCopy?.addEventListener("click", () => copyViewerInquiryReference());
  inquiryElements.viewerInquiryOverlay?.addEventListener("keydown", handleViewerInquiryKeydown);
  [inquiryElements.viewerInquiryGmail, inquiryElements.viewerInquiryEmail].forEach((link) => {
    link?.addEventListener("click", () => window.setTimeout(() => closeViewerInquiry({ restoreFocus: false }), 0));
  });
}

registerFeatureInterface("inquiry", {
  escapePriority: 600,
  requiresDocumentLock: () => inquiryState.open,
  isOpen: () => inquiryState.open,
  attachEvents: attachSharedInquiryEvents,
  openInquiry: (options = {}) => openViewerInquiry(options),
  close: (options = {}) => closeViewerInquiry(options),
  onboardingTarget: () => inquiryElements.viewerInquiryButton,
  closeTopLayer: () => {
    if (!inquiryState.open) return false;
    closeViewerInquiry();
    return true;
  }
});

export { closeViewerInquiry, syncViewerInquiryUi };
