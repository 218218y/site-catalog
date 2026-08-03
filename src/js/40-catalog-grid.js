/**
 * Source module: 40-catalog-grid.js
 * Catalog navigation, category layout, catalog cards, preview grids, and catalog detail rendering.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { CatalogCategoryGroup, CatalogMenuRenderOptions, CatalogOpenOptions, CatalogSubcategoryGroup, CatalogTargetOptions } from "../../types/frontend-contracts.js" */

import { catalogDocumentUrl, categoryDocumentUrl, homeDocumentUrl, isAppPage, navigateTo, viewerDocumentUrl } from "./00-navigation.js";
import { catalogs } from "./03-runtime-context.js";
import { getFeatureInterface, registerFeatureInterface } from "./10-app-state.js";
import { catalogElements, catalogState } from "./12-catalog-state.js";
import { activeCatalog, activeViewerSource, setActiveLocation } from "./18-navigation-feature.js";
import { applyCatalogImageDimensions, buildCategoryShareRouteHash, catalogCategorySharePath, catalogCoverLoadingAttributes, catalogImageCrossOriginAttribute, catalogImageDimensionAttributes, catalogImageRecoveryAttributes, catalogSubcategorySharePath, categorySectionId, categoryShareSlug, clampValue, coverThumbSrc, decodeHashRouteSegment, encodeHashRouteSegment, escapeHtml, focusHtmlElement, getCatalogCategoryGroups, isHtmlElement, normalizeShareRoutePath, pageAspectVariableStyle, setCatalogImageSource, setTooltipText, subcategorySectionId, subcategoryShareSlug, thumbSrc } from "./20-shared-ui.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { catalogFirstPage, catalogPageNumbers } from "./06-catalog-page-numbering.js";
import { searchCatalogDomain } from "./39-search-catalog-domain.js";
import { closeLightboxCatalogMenu, closeLightboxSearchScopeMenu } from "./50-search-ui.js";

/** @typedef {{gap:number, minHeight:number, paddingX:number, fontSize:number}} CategoryNavMetrics */
/** @typedef {{focusFirst?:boolean, focusButton?:boolean}} MobileCategoryMenuOptions */
/** @typedef {{scroll?:boolean, animate?:boolean, targetId?:string, clearHash?:boolean}} CatalogCategoryFocusOptions */
/** @typedef {{blockKey:string, blockIndex?:number, label?:string, isDirect?:boolean, items:Array<CatalogRecord>}} CatalogSubcategoryBlock */
/** @typedef {(grid:HTMLElement, columns:number, catalogs:ReadonlyArray<CatalogRecord>)=>boolean} CatalogInitialLayoutHydrator */
/** @typedef {CatalogSubcategoryBlock & {blockOrder:number, segmentIndex:number, itemOffset:number, span:number, inlineDivider:boolean}} CatalogSubcategoryLayoutSegment */
/** @typedef {{segmentType?:"category"|"subcategory", layoutBlockKey?:string, hasSubcategories?:boolean, blockOrder?:number}} CatalogSegmentAppendOptions */
/**
 * @typedef {Object} CatalogLayoutSegment
 * @property {string} category
 * @property {number} groupIndex
 * @property {number} segmentIndex
 * @property {number} itemOffset
 * @property {number} span
 * @property {Array<CatalogRecord>} items
 * @property {boolean} hasSubcategories
 * @property {"category"|"subcategory"|"categoryHeader"} segmentType
 * @property {string} layoutBlockKey
 * @property {boolean} inlineDivider
 * @property {Array<CatalogRecord>} [directItems]
 * @property {Array<CatalogSubcategoryGroup>} [subcategories]
 * @property {string} [blockKey]
 * @property {number} [blockIndex]
 * @property {number} [blockOrder]
 * @property {string} [label]
 * @property {boolean} [isDirect]
 */
/** @typedef {{baseSectionId?:string}} CatalogSubcategoryRenderOptions */
/** @typedef {{behavior?:ScrollBehavior}} CatalogDetailScrollOptions */

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
    <article class="empty-state ui-state" data-state="empty" role="status">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M5 4.5h11.2A2.8 2.8 0 0 1 19 7.3v12.2H7.8A2.8 2.8 0 0 1 5 16.7V4.5Z"/><path d="M7.8 19.5A2.8 2.8 0 0 1 5 16.7c0-1.55 1.25-2.8 2.8-2.8H19"/></svg>
      </span>
      <div class="empty-state-copy">
        <strong>עדיין אין קטלוגים להצגה</strong>
        <p>ברגע שיועלו קטלוגים, הם יופיעו כאן לבחירה ולצפייה.</p>
      </div>
    </article>
  `;

  if (catalogElements.catalogGrid) {
    catalogElements.catalogGrid.innerHTML = html;
    catalogElements.catalogGrid.setAttribute("aria-busy", "false");
    if (catalogElements.catalogLoadStatus) catalogElements.catalogLoadStatus.textContent = "אין קטלוגים זמינים כעת.";
  }
  if (catalogElements.pageGrid) {
    catalogElements.pageGrid.innerHTML = html;
    catalogElements.pageGrid.setAttribute("aria-busy", "false");
  }
  if (catalogElements.catalogCount) catalogElements.catalogCount.textContent = "0";
  if (catalogElements.pageCount) catalogElements.pageCount.textContent = "0";
  renderCategoryNav([]);
  showCatalogDetail();
  catalogElements.catalogTitle.textContent = "עדיין אין קטלוגים להצגה";
  catalogElements.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.";
  if (catalogElements.catalogMenuToggleText) catalogElements.catalogMenuToggleText.textContent = "אין קטלוגים";
  if (catalogElements.catalogMenu) catalogElements.catalogMenu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
  catalogElements.catalogCoverPreview?.removeAttribute("src");
  if (catalogElements.openCatalogEntryFromDetail) catalogElements.openCatalogEntryFromDetail.disabled = true;
}


const CATEGORY_NAV_MIN_BUTTON_SCALE = 0.68;
const CATEGORY_NAV_MIN_FONT_SIZE = 11;
const CATEGORY_NAV_MIN_BUTTON_HEIGHT = 30;
const CATEGORY_NAV_MIN_BUTTON_PADDING_X = 5;
const CATEGORY_NAV_MIN_GAP = 3;

/** @param {unknown} value @param {number} [fallback] */
function readPixelValue(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value || ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** @param {HTMLElement|null|undefined} link */
function categoryNavLinkLabel(link) {
  return String(link?.dataset?.categoryLabel || link?.textContent || "").trim();
}

/** @param {HTMLElement|null|undefined} link @param {string} text */
function setCategoryNavLinkTooltip(link, text) {
  if (!link) return;
  setTooltipText(link, text || "", { updateDefault: true });
  link.removeAttribute("title");
}

/** @param {Array<HTMLElement>} links @param {boolean} [enabled] */
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

/** @param {HTMLElement|null|undefined} header @param {Array<HTMLElement>} [links] */
function clearCategoryNavFit(header, links = []) {
  if (!header) return;
  header.classList.remove("is-top-nav-compressed", "is-top-nav-tight", "is-top-nav-ellipsized");
  header.style.removeProperty("--top-nav-gap");
  header.style.removeProperty("--top-nav-button-min-height");
  header.style.removeProperty("--top-nav-button-padding-x");
  header.style.removeProperty("--top-nav-button-font-size");
  syncCategoryNavOverflowTooltips(links, false);
}

/** @param {HTMLElement} nav @param {HTMLElement} firstLink @returns {CategoryNavMetrics} */
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

/** @param {HTMLElement} nav @param {Array<HTMLElement>} links */
function categoryNavRequiredWidth(nav, links) {
  if (!links.length) return 0;
  const gap = readPixelValue(window.getComputedStyle(nav).columnGap, 0);
  const linkWidth = links.reduce((sum, link) => sum + Math.ceil(link.scrollWidth), 0);
  return linkWidth + (gap * Math.max(0, links.length - 1));
}

/** @param {HTMLElement} header @param {CategoryNavMetrics} metrics @param {number} scale */
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
  catalogState.categoryNavFitRaf = 0;
  const nav = catalogElements.categoryNav;
  const header = nav?.closest?.(".site-header");
  if (!nav || !(header instanceof HTMLElement)) return;

  const links = Array.from(nav.querySelectorAll(".category-nav-link")).filter(isHtmlElement);
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
  if (!catalogElements.categoryNav) return;
  window.cancelAnimationFrame(catalogState.categoryNavFitRaf);
  catalogState.categoryNavFitRaf = window.requestAnimationFrame(fitCategoryNavToSingleRow);
}

function initCategoryNavFit() {
  if (!catalogElements.categoryNav) return;
  document.querySelectorAll('img[data-brand-logo="1"]').forEach((image) => {
    image.addEventListener("load", scheduleCategoryNavFit);
  });
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleCategoryNavFit).catch(() => {});
  }
  scheduleCategoryNavFit();
}


/** @param {Array<CatalogCategoryGroup>} [groups] */
function renderCategoryNav(groups = getCatalogCategoryGroups()) {
  const links = groups.map((group, index) => {
    const targetId = categorySectionId(group.category, index);
    const sharePath = catalogCategorySharePath(group.category, index);
    return {
      href: categoryDocumentUrl(sharePath),
      targetId,
      sharePath,
      label: group.category
    };
  });

  if (catalogElements.categoryNav) {
    catalogElements.categoryNav.innerHTML = links.map((link) => `
      <a class="top-nav-link category-nav-link" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>
    `).join("");
  }

  if (catalogElements.mobileCategoryMenu) {
    catalogElements.mobileCategoryMenu.innerHTML = links.length
      ? links.map((link) => `
          <a class="mobile-category-menu-link category-nav-link" role="menuitem" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">
            <span>${escapeHtml(link.label)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" /></svg>
          </a>
        `).join("")
      : '<div class="mobile-category-menu-empty">אין קטגוריות להצגה</div>';
  }

  syncActiveCategoryNavLink();
  scheduleCategoryNavFit();
}

function isMobileCategoryMenuOpen() {
  return Boolean(catalogElements.mobileCategoryMenu && !catalogElements.mobileCategoryMenu.classList.contains("hidden"));
}

/** @param {boolean} open @param {MobileCategoryMenuOptions} [options] */
function setMobileCategoryMenuOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  if (!catalogElements.mobileCategoryMenu || !catalogElements.mobileCategoryMenuToggle) return;

  catalogElements.mobileCategoryMenu.classList.toggle("hidden", !shouldOpen);
  catalogElements.mobileCategoryMenu.classList.toggle("is-open", shouldOpen);
  catalogElements.mobileCategoryMenuToggle.classList.toggle("is-active", shouldOpen);
  catalogElements.mobileCategoryMenuToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  catalogElements.mobileCategoryMenuToggle.setAttribute("aria-label", shouldOpen ? "סגירת תפריט קטגוריות" : "פתיחת תפריט קטגוריות");

  if (shouldOpen && options.focusFirst) {
    window.requestAnimationFrame(() => focusHtmlElement(catalogElements.mobileCategoryMenu?.querySelector(".mobile-category-menu-link")));
  } else if (!shouldOpen && options.focusButton) {
    window.requestAnimationFrame(() => catalogElements.mobileCategoryMenuToggle?.focus({ preventScroll: true }));
  }
}

/** @param {MobileCategoryMenuOptions} [options] */
function closeMobileCategoryMenu(options = {}) {
  setMobileCategoryMenuOpen(false, options);
}

function decodeHashTargetId(hash = location.hash) {
  return searchCatalogDomain.decodeCatalogHashTargetId(hash);
}

/** @param {Element|null} section @returns {section is HTMLElement} */
function isCatalogFocusSection(section) {
  return Boolean(section instanceof HTMLElement && (section.classList.contains("catalog-category-section") || section.classList.contains("catalog-subcategory-section")));
}

/** @param {unknown} id @returns {HTMLElement|null} */
function getCatalogCategorySectionById(id) {
  const sectionId = String(id || "");
  const section = sectionId ? document.getElementById(sectionId) : null;
  return isCatalogFocusSection(section) ? section : null;
}

function getCatalogCategorySectionFromHash(hash = location.hash) {
  return getCatalogCategorySectionById(decodeHashTargetId(hash));
}

/** @param {HTMLElement|null|undefined} section */
function getCatalogCategoryFocusTargetId(section) {
  return section?.dataset?.categoryFocusTarget || section?.id || "";
}

/** @returns {HTMLElement[]} */
function getCatalogFocusSections() {
  return Array.from(catalogElements.catalogGrid.querySelectorAll(".catalog-category-section, .catalog-subcategory-section"))
    .filter(isHtmlElement);
}

/** @param {unknown} targetId @returns {Array<HTMLElement>} */
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

function catalogCategorySharePathFromHash(hash = location.hash) {
  const rawHash = String(hash || "");
  if (!rawHash.startsWith("#")) return "";

  const rawRoute = rawHash.slice(1).replace(/^\/+/, "");
  const parts = rawRoute.split("/");
  if (parts[0] !== "cat" || !parts[1]) return "";

  return normalizeShareRoutePath(parts.slice(1).map(decodeHashRouteSegment).join("/"));
}

/** @param {unknown} path @returns {HTMLElement|null} */
function getCatalogCategorySectionBySharePath(path) {
  const normalizedPath = normalizeShareRoutePath(path);
  if (!normalizedPath) return null;

  return getCatalogFocusSections().find((section) => normalizeShareRoutePath(section?.dataset?.categorySharePath) === normalizedPath) || null;
}

function resolveCatalogCategoryTargetIdFromHash(hash = location.hash) {
  const sharePath = catalogCategorySharePathFromHash(hash);
  if (sharePath) {
    const section = getCatalogCategorySectionBySharePath(sharePath);
    return getCatalogCategoryFocusTargetId(section);
  }

  return decodeHashTargetId(hash);
}

/** @param {unknown} targetId */
function buildCatalogFocusRouteHash(targetId) {
  const section = getCatalogCategorySectionsByTargetId(targetId)[0] || getCatalogCategorySectionById(targetId);
  const sharePath = normalizeShareRoutePath(section?.dataset?.categorySharePath);
  return buildCategoryShareRouteHash(sharePath) || (targetId ? `#${encodeHashRouteSegment(targetId)}` : "");
}

/** @param {unknown} targetId */
function hasCatalogCategoryFocus(targetId) {
  return getCatalogCategorySectionsByTargetId(targetId)
    .some((section) => section.classList.contains("is-category-focus"));
}

function syncActiveCategoryNavLink(activeId = catalogState.categoryFocusTargetId) {
  const normalizedActiveId = String(activeId || "");

  [catalogElements.categoryNav, catalogElements.mobileCategoryMenu].forEach((container) => {
    Array.from(container?.querySelectorAll(".category-nav-link") || []).filter(isHtmlElement).forEach((link) => {
      const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  });

  Array.from(catalogElements.catalogGrid?.querySelectorAll(".catalog-subcategory-nav-link") || []).filter(isHtmlElement).forEach((link) => {
    const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

/** @param {CatalogCategoryFocusOptions} [options] */
function clearCatalogCategoryFocus(options = {}) {
  const { clearHash = false } = options;

  window.clearTimeout(catalogState.categoryFocusTimer);
  catalogState.categoryFocusTimer = 0;
  catalogState.categoryFocusTargetId = "";
  getCatalogFocusSections().forEach((section) => {
    section.classList.remove("is-category-focus");
  });
  syncActiveCategoryNavLink("");

  const hashTargetId = resolveCatalogCategoryTargetIdFromHash();
  if (clearHash && hashTargetId && getCatalogCategorySectionsByTargetId(hashTargetId).length) {
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  }

  return true;
}

/** @param {HTMLElement|null} section @param {CatalogCategoryFocusOptions} [options] */
function markCatalogCategoryFocus(section, options = {}) {
  if (!section) return false;

  const { animate = true, targetId: requestedTargetId = "" } = options;
  const targetId = String(requestedTargetId || getCatalogCategoryFocusTargetId(section) || "");
  const targetSections = getCatalogCategorySectionsByTargetId(targetId);
  if (!targetId || !targetSections.length) return false;

  window.clearTimeout(catalogState.categoryFocusTimer);
  catalogState.categoryFocusTimer = 0;

  getCatalogFocusSections().forEach((activeSection) => {
    if (!targetSections.includes(activeSection)) activeSection.classList.remove("is-category-focus");
  });

  targetSections.forEach((targetSection) => targetSection.classList.remove("is-category-focus"));
  if (animate) {
    // Restart the pulse cleanly across every visible segment of the selected category or subcategory.
    void targetSections[0].offsetWidth;
  }
  targetSections.forEach((targetSection) => targetSection.classList.add("is-category-focus"));

  catalogState.categoryFocusTargetId = targetId;
  syncActiveCategoryNavLink(targetId);
  return true;
}

/** @param {string} id @param {CatalogCategoryFocusOptions} [options] */
function markCatalogCategoryFocusById(id, options = {}) {
  return markCatalogCategoryFocus(getCatalogCategorySectionById(id), { ...options, targetId: id });
}

/** @param {unknown} targetId @param {CatalogTargetOptions} [options] */
function activateCatalogCategoryTarget(targetId, { toggle = false } = {}) {
  const id = String(targetId || "").trim();
  if (!id) return false;
  if (!isAppPage("home")) {
    navigateTo(`${homeDocumentUrl()}${buildCatalogFocusRouteHash(id)}`);
    return true;
  }
  if (toggle && catalogState.categoryFocusTargetId === id && hasCatalogCategoryFocus(id)) {
    clearCatalogCategoryFocus({ clearHash: true });
    return true;
  }

  const section = getCatalogCategorySectionById(id) || getCatalogCategorySectionsByTargetId(id)[0];
  if (!section) return false;
  markCatalogCategoryFocus(section, { targetId: id });
  section.scrollIntoView?.({ behavior: "smooth", block: "start" });
  if (location.hash !== buildCatalogFocusRouteHash(id)) location.hash = buildCatalogFocusRouteHash(id);
  return true;
}

/** @param {HTMLAnchorElement} link @param {Event} event */
function handleCatalogFocusLinkClick(link, event) {
  const targetId = link?.dataset?.categoryTarget || resolveCatalogCategoryTargetIdFromHash(link?.hash);
  if (!targetId) return;

  event.preventDefault();
  activateCatalogCategoryTarget(targetId, { toggle: true });
}

/** @param {CatalogCategoryFocusOptions} [options] */
function syncCatalogCategoryFocusFromHash(options = {}) {
  const targetId = resolveCatalogCategoryTargetIdFromHash();
  const section = getCatalogCategorySectionById(targetId);
  if (!section) {
    clearCatalogCategoryFocus();
    return false;
  }

  const { scroll = false } = options;
  if (scroll) section.scrollIntoView({ behavior: "smooth", block: "start" });
  return markCatalogCategoryFocus(section, { ...options, targetId });
}


/** @type {CatalogInitialLayoutHydrator|undefined} */
let initialLayoutHydrator;

/** @param {CatalogInitialLayoutHydrator} hydrator */
function setInitialLayoutHydrator(hydrator) {
  initialLayoutHydrator = hydrator;
}

function catalogLayoutColumnCount() {
  return searchCatalogDomain.catalogColumnCount({
    mobile: Boolean(window.matchMedia?.("(max-width: 760px)").matches),
    tablet: Boolean(window.matchMedia?.("(max-width: 1180px)").matches)
  });
}

function scheduleCatalogLayoutRefresh() {
  if (!catalogs.length) return;
  window.clearTimeout(catalogState.catalogLayoutResizeTimer);
  catalogState.catalogLayoutResizeTimer = window.setTimeout(() => {
    const nextColumns = catalogLayoutColumnCount();
    if (nextColumns !== catalogState.catalogLayoutColumns) renderCatalogCards();
  }, 120);
}

/** @param {CatalogRecord} catalog @param {number} [headingLevel] */
function renderCatalogCard(catalog, headingLevel = 3) {
  const cover = coverThumbSrc(catalog);
  const safeCatalogId = escapeHtml(catalog.id);
  const safeTitle = escapeHtml(catalog.title);
  const safeHeadingLevel = headingLevel === 4 ? 4 : 3;
  const catalogHref = escapeHtml(catalogDocumentUrl(catalog.id));
  return `
    <article class="catalog-card">
      <a class="catalog-cover-frame catalog-image-frame catalog-cover-button" href="${catalogHref}" data-open-catalog-entry="${safeCatalogId}" aria-label="פתיחת הקטלוג ${safeTitle}">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${safeTitle}"${catalogImageDimensionAttributes(catalog, 1)}${catalogCoverLoadingAttributes(catalog)}${catalogImageRecoveryAttributes(catalog, 1, "cover", "catalog-grid")}${catalogImageCrossOriginAttribute(cover)} />
        <span class="catalog-cover-card-entry-hint" aria-hidden="true">פתיחת הקטלוג</span>
      </a>
      <div class="catalog-body">
        <h${safeHeadingLevel}><a href="${catalogHref}" data-open-catalog-preview="${safeCatalogId}">${safeTitle}</a></h${safeHeadingLevel}>
        <p>${escapeHtml(catalog.description || "")}</p>
        <div class="catalog-actions" role="group" aria-label="פעולות עבור ${safeTitle}">
          <a class="button primary catalog-open-button" href="${catalogHref}" data-open-catalog-entry="${safeCatalogId}">פתיחת הקטלוג</a>
          <button class="button soft catalog-preview-button" type="button" data-open-catalog-preview="${safeCatalogId}">תצוגה מקדימה</button>
        </div>
      </div>
    </article>
  `;
}

/** @param {CatalogLayoutSegment} segment */
function renderCatalogSubcategoryNav(segment) {
  if (!segment?.hasSubcategories || !Array.isArray(segment.subcategories) || !segment.subcategories.length) return "";

  const buttons = segment.subcategories.map((group, index) => {
    const targetId = subcategorySectionId(segment.category, segment.groupIndex, group.subcategory, index);
    const sharePath = catalogSubcategorySharePath(segment.category, segment.groupIndex, group.subcategory, index);
    return `<a class="catalog-subcategory-nav-link" href="${escapeHtml(categoryDocumentUrl(categoryShareSlug(segment.category, segment.groupIndex), subcategoryShareSlug(group.subcategory, index)))}" data-category-target="${escapeHtml(targetId)}" data-category-share-path="${escapeHtml(sharePath)}">${escapeHtml(group.subcategory)}</a>`;
  }).join("");

  return `
    <nav class="catalog-subcategory-nav" aria-label="ניווט תתי קטגוריות עבור ${escapeHtml(segment.category)}">
      ${buttons}
    </nav>
  `;
}

/** @param {CatalogLayoutSegment} segment @param {CatalogLayoutSegment|CatalogSubcategoryLayoutSegment} block @param {string} baseSectionId */
function catalogSubcategoryBlockBaseId(segment, block, baseSectionId) {
  if (block?.isDirect) return `${baseSectionId}-general`;
  return subcategorySectionId(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0);
}

/** @param {CatalogLayoutSegment} segment @param {CatalogLayoutSegment|CatalogSubcategoryLayoutSegment} block @param {CatalogSubcategoryRenderOptions} [options] */
function renderCatalogSubcategoryBlock(segment, block, options = {}) {
  const { baseSectionId = "" } = options;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) return "";

  const blockBaseId = catalogSubcategoryBlockBaseId(segment, block, baseSectionId);
  const sharePath = block?.isDirect
    ? catalogCategorySharePath(segment.category, segment.groupIndex)
    : catalogSubcategorySharePath(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0);
  const sectionId = block.segmentIndex === 0 ? blockBaseId : `${blockBaseId}-part-${block.segmentIndex + 1}`;
  const titleId = `${sectionId}-title`;
  const title = String(block?.label || "").trim() || "קטלוגים";
  const sectionStyle = `--subcategory-span: ${searchCatalogDomain.clampCatalogSpan(block.span, 3)};`;

  return `
    <section class="catalog-subcategory-section" id="${escapeHtml(sectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(blockBaseId)}" data-parent-category-target="${escapeHtml(baseSectionId)}" data-category-share-path="${escapeHtml(sharePath)}" data-subcategory-span="${escapeHtml(String(block.span))}" data-inline-divider="${block.inlineDivider ? "1" : "0"}" data-subcategory-continuation="${block.itemOffset > 0 ? "1" : "0"}">
      <div class="catalog-category-head catalog-subcategory-head">
        <h3 id="${escapeHtml(titleId)}">${escapeHtml(title)}</h3>
      </div>
      <div class="catalog-grid catalog-category-grid catalog-subcategory-grid">
        ${items.map((catalog) => renderCatalogCard(catalog, 4)).join("")}
      </div>
    </section>
  `;
}

/** @param {CatalogLayoutSegment} segment @param {number} columns */
function renderCatalogCategoryHeaderSegment(segment, columns) {
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const titleId = `${baseSectionId}-title`;
  const safeColumns = searchCatalogDomain.clampCatalogSpan(columns, 3);
  const sectionStyle = `--category-span: ${safeColumns}; --subcategory-layout-columns: ${safeColumns};`;
  const sharePath = catalogCategorySharePath(segment.category, segment.groupIndex);

  return `
    <section class="catalog-category-section catalog-category-section-with-subcategories catalog-category-section-header-only" id="${escapeHtml(baseSectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(baseSectionId)}" data-category-share-path="${escapeHtml(sharePath)}" data-category-span="${escapeHtml(String(safeColumns))}" data-inline-divider="0" data-category-continuation="0">
      <div class="catalog-category-head catalog-category-head-with-subcategories">
        <h2 id="${escapeHtml(titleId)}">${escapeHtml(segment.category)}</h2>
        ${renderCatalogSubcategoryNav(segment)}
      </div>
    </section>
  `;
}

/** @param {CatalogLayoutSegment} segment @param {number} columns */
function renderCatalogCategorySegment(segment, columns) {
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const safeColumns = searchCatalogDomain.clampCatalogSpan(columns, 3);

  if (segment.segmentType === "categoryHeader") {
    return renderCatalogCategoryHeaderSegment(segment, safeColumns);
  }

  if (segment.segmentType === "subcategory") {
    return renderCatalogSubcategoryBlock(segment, segment, { baseSectionId });
  }

  const sectionId = segment.itemOffset === 0 ? baseSectionId : `${baseSectionId}-part-${segment.segmentIndex + 1}`;
  const titleId = `${sectionId}-title`;
  const sectionStyle = `--category-span: ${segment.span}; --subcategory-layout-columns: ${safeColumns};`;
  const sharePath = catalogCategorySharePath(segment.category, segment.groupIndex);

  return `
    <section class="catalog-category-section" id="${escapeHtml(sectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(baseSectionId)}" data-category-share-path="${escapeHtml(sharePath)}" data-category-span="${escapeHtml(String(segment.span))}" data-inline-divider="${segment.inlineDivider ? "1" : "0"}" data-category-continuation="${segment.itemOffset > 0 ? "1" : "0"}">
      <div class="catalog-category-head">
        <h2 id="${escapeHtml(titleId)}">${escapeHtml(segment.category)}</h2>
      </div>
      <div class="catalog-grid catalog-category-grid">
        ${segment.items.map((catalog) => renderCatalogCard(catalog, 3)).join("")}
      </div>
    </section>
  `;
}

/** @param {string|null|undefined} catalogId @param {number} [page] */
function openCatalogEntry(catalogId, page = undefined) {
  if (!catalogId) return;
  const catalog = catalogs.find((item) => item.id === catalogId) || null;
  if (!catalog) return;
  const targetPage = page === undefined ? catalogFirstPage(catalog) : page;
  const viewer = getFeatureInterface("viewer");
  if (viewer?.openCatalog) {
    viewer.openCatalog(catalogId, targetPage);
    return;
  }
  navigateTo(viewerDocumentUrl(catalogId, targetPage));
}

function bindCatalogCardEvents() {
  if (!catalogElements.catalogGrid) return;

  Array.from(catalogElements.catalogGrid.querySelectorAll("[data-open-catalog-entry]"))
    .filter(isHtmlElement)
    .forEach((control) => {
      control.addEventListener("click", (event) => {
        if (!(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openCatalogEntry(control.dataset.openCatalogEntry);
      });
    });

  Array.from(catalogElements.catalogGrid.querySelectorAll("[data-open-catalog-preview]"))
    .filter(isHtmlElement)
    .forEach((control) => {
      control.addEventListener("click", (event) => {
        if (!(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const catalogId = String(control.dataset.openCatalogPreview || "");
        if (catalogId) openCatalog(catalogId, { scroll: true });
      });
    });
}

function renderCatalogCards() {
  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  const groups = getCatalogCategoryGroups();
  const totalPages = catalogs.reduce((sum, item) => sum + Number(item.pages || 0), 0);
  if (catalogElements.catalogCount) catalogElements.catalogCount.textContent = String(catalogs.length);
  if (catalogElements.pageCount) catalogElements.pageCount.textContent = String(totalPages);
  renderCategoryNav(groups);

  const columns = catalogLayoutColumnCount();
  catalogState.catalogLayoutColumns = columns;
  catalogElements.catalogGrid.style.setProperty("--catalog-layout-columns", String(columns));

  if (!initialLayoutHydrator?.(catalogElements.catalogGrid, columns, catalogs)) {
    const categorySegments = /** @type {Array<CatalogLayoutSegment>} */ (searchCatalogDomain.catalogCategorySegments(groups, columns));
    catalogElements.catalogGrid.innerHTML = categorySegments.map((segment) => renderCatalogCategorySegment(segment, columns)).join("");
  }

  catalogElements.catalogGrid.setAttribute("aria-busy", "false");
  if (catalogElements.catalogLoadStatus) {
    const count = catalogs.length;
    catalogElements.catalogLoadStatus.textContent = count === 1 ? "קטלוג אחד נטען." : `${count} קטלוגים נטענו.`;
  }
  bindCatalogCardEvents();
  syncCatalogCategoryFocusFromHash({ animate: false });
}


function fillCatalogSelect() {
  updateDetailCatalogMenuLabel();
}


function renderPageGrid() {
  const catalog = activeCatalog();
  if (!catalog) return;
  // Keep generated page cards visually stable during scroll.
  // Older versions attached scroll-time observers here for reveal animation
  // and thumb activation; that caused work exactly when a card entered view.

  const cards = [];
  for (const page of catalogPageNumbers(catalog)) {
    cards.push(`
      <article class="page-card">
        <a class="page-button" href="${escapeHtml(viewerDocumentUrl(catalog.id, page))}" data-open-page="${page}">
          <div class="page-thumb-wrap"${pageAspectVariableStyle(catalog, page, "--page-thumb-aspect-ratio")}>
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async" fetchpriority="low"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "catalog-page-grid")}${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
            <span class="page-number-badge">${page}</span>
          </div>
          <div class="page-card-body">
            <span class="page-card-title">עמוד ${page}</span>
            <span class="page-card-hint">לחץ להגדלה</span>
          </div>
        </a>
      </article>
    `);
  }
  catalogElements.pageGrid.setAttribute("aria-busy", "true");
  catalogElements.pageGrid.innerHTML = cards.join("");
  catalogElements.pageGrid.setAttribute("aria-busy", "false");

  Array.from(catalogElements.pageGrid.querySelectorAll("[data-open-page]"))
    .filter(isHtmlElement)
    .forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const page = Number(link.dataset.openPage);
      const viewer = getFeatureInterface("viewer");
      if (viewer) viewer.openCatalog(catalog.id, page);
      else navigateTo(viewerDocumentUrl(catalog.id, page));
    });
  });
}

function showCatalogDetail() {
  if (!catalogElements.catalogDetail) return;
  catalogElements.catalogDetail.classList.remove("hidden");
  catalogElements.catalogDetail.classList.add("in-view");
}

/** @param {CatalogDetailScrollOptions} [options] */
function scrollCatalogDetailIntoView(options = {}) {
  if (!catalogElements.catalogDetail) return;
  const { behavior = "smooth" } = options;
  requestAnimationFrame(() => {
    catalogElements.catalogDetail.scrollIntoView({ behavior, block: "start" });
    scheduleCatalogScrollTopButtonUpdate();
  });
}

function positionCatalogScrollTopButton() {
  if (!catalogElements.scrollToTopBtn || !catalogElements.pageGrid) return;

  const gridRect = catalogElements.pageGrid.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const buttonWidth = Math.max(catalogElements.scrollToTopBtn.offsetWidth || 46, 46);
  const safeInset = 12;
  const gapFromGrid = 12;
  const maxLeft = Math.max(safeInset, viewportWidth - buttonWidth - safeInset);
  const preferredLeft = gridRect.left - buttonWidth - gapFromGrid;
  const left = clampValue(preferredLeft, safeInset, maxLeft);

  catalogElements.scrollToTopBtn.style.setProperty("--catalog-scroll-top-left", `${Math.round(left)}px`);
}

/** @param {boolean} visible */
function setCatalogScrollTopButtonVisible(visible) {
  if (!catalogElements.scrollToTopBtn) return;
  catalogElements.scrollToTopBtn.classList.toggle("is-visible", Boolean(visible));
  catalogElements.scrollToTopBtn.setAttribute("aria-hidden", visible ? "false" : "true");
  catalogElements.scrollToTopBtn.tabIndex = visible ? 0 : -1;
}

function updateCatalogScrollTopButton() {
  catalogState.catalogScrollTopButtonRaf = 0;
  if (!catalogElements.scrollToTopBtn || !catalogElements.catalogDetail || !catalogElements.pageGrid || catalogElements.catalogDetail.classList.contains("hidden") || !activeCatalog() || getFeatureInterface("viewer")?.isViewerOpen?.()) {
    setCatalogScrollTopButtonVisible(false);
    return;
  }

  positionCatalogScrollTopButton();

  const detailRect = catalogElements.catalogDetail.getBoundingClientRect();
  const gridRect = catalogElements.pageGrid.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 90;
  const startedScrollingInsideGrid = gridRect.top < Math.min(headerHeight + 28, viewportHeight * 0.28);
  const stillNearGrid = gridRect.bottom > Math.min(180, viewportHeight * 0.35);
  const detailVisible = detailRect.bottom > 80 && detailRect.top < viewportHeight;
  setCatalogScrollTopButtonVisible(startedScrollingInsideGrid && stillNearGrid && detailVisible);
}

function scheduleCatalogScrollTopButtonUpdate() {
  if (catalogState.catalogScrollTopButtonRaf) return;
  catalogState.catalogScrollTopButtonRaf = requestAnimationFrame(updateCatalogScrollTopButton);
}

/**
 * Render the canonical catalog chooser markup into a caller-owned container.
 * The Catalog feature owns taxonomy grouping and selection semantics; callers
 * own only the container and the action performed after selection.
 *
 * @param {HTMLElement} menu
 * @param {CatalogMenuRenderOptions} [options]
 */
function renderCatalogCategoryMenu(menu, options = {}) {
  const { activeCatalogId = activeCatalog()?.id, onSelect } = options;
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

  if (!onSelect) return;
  Array.from(menu.querySelectorAll("[data-catalog-menu-id]"))
    .filter(isHtmlElement)
    .forEach((button) => {
      button.addEventListener("click", () => {
        const catalogId = String(button.dataset.catalogMenuId || "");
        if (catalogId) onSelect(catalogId);
      });
    });
}

function updateDetailCatalogMenuLabel(catalog = activeCatalog()) {
  catalogElements.catalogMenuToggleText.textContent = catalog?.title || "בחר קטלוג";
}

function renderDetailCatalogMenu() {
  renderCatalogCategoryMenu(catalogElements.catalogMenu, {
    onSelect: (catalogId) => {
      closeDetailCatalogMenu();
      if (catalogId === activeCatalog()?.id) return;
      navigateTo(catalogDocumentUrl(catalogId));
    }
  });
}

function renderCatalogDetail() {
  const catalog = activeCatalog();
  if (!catalog) return;
  showCatalogDetail();
  catalogElements.catalogTitle.textContent = catalog.title;
  catalogElements.catalogDescription.textContent = catalog.description || "";
  updateDetailCatalogMenuLabel(catalog);
  if (catalogElements.catalogCoverPreview) {
    applyCatalogImageDimensions(catalogElements.catalogCoverPreview, catalog, catalogFirstPage(catalog));
    setCatalogImageSource(catalogElements.catalogCoverPreview, coverThumbSrc(catalog));
    catalogElements.catalogCoverPreview.loading = "lazy";
    catalogElements.catalogCoverPreview.decoding = "async";
    catalogElements.catalogCoverPreview.alt = `שער ${catalog.title}`;
  }
  if (catalogElements.openCatalogEntryFromDetail) catalogElements.openCatalogEntryFromDetail.disabled = catalog.pages < 1;
  if (catalogElements.catalogMenu && !catalogElements.catalogMenu.classList.contains("hidden")) renderDetailCatalogMenu();
  renderPageGrid();
  scheduleCatalogScrollTopButtonUpdate();
}

/** @param {string} id @param {CatalogOpenOptions} [options] */
function openCatalog(id, options = {}) {
  const { scroll = false, openPage = null, scrollBehavior = "smooth" } = options;
  const catalog = catalogs.find((item) => item.id === id) || null;
  if (!catalog) return;

  if (!isAppPage("catalog")) {
    navigateTo(openPage != null
      ? viewerDocumentUrl(catalog.id, openPage)
      : catalogDocumentUrl(catalog.id));
    return;
  }

  setActiveLocation(catalog, catalogFirstPage(catalog), activeViewerSource());
  renderCatalogDetail();
  history.replaceState(history.state, "", catalogDocumentUrl(catalog.id));

  if (scroll) scrollCatalogDetailIntoView({ behavior: scrollBehavior });
  if (openPage != null) navigateTo(viewerDocumentUrl(catalog.id, openPage));
}

function closeDetailCatalogMenu() {
  catalogElements.catalogMenu.classList.add("hidden");
  catalogElements.catalogMenuToggle.setAttribute("aria-expanded", "false");
}

/** @param {EventTarget|null} target */
function catalogGridContainsMenuTarget(target) {
  if (!(target instanceof Node)) return false;
  return [
    catalogElements.catalogMenu,
    catalogElements.catalogMenuToggle,
    catalogElements.mobileCategoryMenu,
    catalogElements.mobileCategoryMenuToggle
  ].some((element) => element.contains(target));
}

/** @param {string} nextPage */
function prepareCatalogGridRoute(nextPage) {
  closeMobileCategoryMenu();
  closeDetailCatalogMenu();
  if (nextPage !== "catalog") {
    catalogElements.catalogDetail.classList.add("hidden");
    catalogElements.catalogDetail.classList.remove("in-view");
    setCatalogScrollTopButtonVisible(false);
  }
}

function handleCatalogGridResize() {
  if (window.innerWidth > 760) closeMobileCategoryMenu();
  scheduleCatalogLayoutRefresh();
  scheduleCategoryNavFit();
  scheduleCatalogScrollTopButtonUpdate();
}

function handleCatalogGridScroll() {
  scheduleCatalogScrollTopButtonUpdate();
}

function attachCatalogGridEvents() {
  catalogElements.mobileCategoryMenuToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    getFeatureInterface("search")?.closeGlobalPanel({ focusButton: false });
    setMobileCategoryMenuOpen(!isMobileCategoryMenuOpen());
  });

  catalogElements.mobileCategoryMenu?.addEventListener("click", (event) => {
    const link = eventTargetElement(event.target)?.closest(".category-nav-link");
    if (!(link instanceof HTMLAnchorElement) || !catalogElements.mobileCategoryMenu.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  catalogElements.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderDetailCatalogMenu();
    const isOpen = !catalogElements.catalogMenu?.classList.contains("hidden");
    catalogElements.catalogMenu?.classList.toggle("hidden", isOpen);
    catalogElements.catalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  catalogElements.catalogMenu?.addEventListener("click", (event) => event.stopPropagation());

  catalogElements.openCatalogEntryFromDetail?.addEventListener("click", () => {
    const catalog = activeCatalog();
    if (!catalog) return;
    navigateTo(viewerDocumentUrl(catalog.id, catalogFirstPage(catalog)));
  });
  catalogElements.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  catalogElements.categoryNav?.addEventListener("click", (event) => {
    const link = eventTargetElement(event.target)?.closest(".category-nav-link");
    if (!(link instanceof HTMLAnchorElement) || !catalogElements.categoryNav.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  catalogElements.catalogGrid?.addEventListener("click", (event) => {
    const link = eventTargetElement(event.target)?.closest(".catalog-subcategory-nav-link");
    if (!(link instanceof HTMLAnchorElement) || !catalogElements.catalogGrid.contains(link)) return;
    handleCatalogFocusLinkClick(link, event);
  });
}

registerFeatureInterface("catalog-grid", {
  attachEvents: attachCatalogGridEvents,
  initialize: () => {
    initRevealObserver();
    initCategoryNavFit();
  },
  renderInitialContent: () => {
    renderCatalogCards();
    fillCatalogSelect();
  },
  setInitialLayoutHydrator,
  renderEmptyState,
  openCatalog,
  closeMobileMenu: (options = {}) => closeMobileCategoryMenu(options),
  scheduleLayoutRefresh: scheduleCatalogLayoutRefresh,
  scheduleCategoryNavFit,
  scheduleScrollTopButtonUpdate: scheduleCatalogScrollTopButtonUpdate,
  setScrollTopButtonVisible: setCatalogScrollTopButtonVisible,
  syncCategoryFocusFromHash: (options = {}) => syncCatalogCategoryFocusFromHash(options),
  resolveCategoryTargetIdFromHash: (hash = location.hash) => resolveCatalogCategoryTargetIdFromHash(hash),
  hasCategoryTarget: (targetId) => getCatalogCategorySectionsByTargetId(targetId).length > 0,
  activeCategoryTargetId: () => String(catalogState.categoryFocusTargetId || ""),
  activateCategoryTarget: activateCatalogCategoryTarget,
  layoutColumnCount: catalogLayoutColumnCount,
  hideDetail: () => {
    catalogElements.catalogDetail.classList.add("hidden");
    catalogElements.catalogDetail.classList.remove("in-view");
    setCatalogScrollTopButtonVisible(false);
  },
  prepareRoute: prepareCatalogGridRoute,
  containsMenuTarget: catalogGridContainsMenuTarget,
  handleResize: handleCatalogGridResize,
  handleScroll: handleCatalogGridScroll,
  renderCatalogMenu: renderCatalogCategoryMenu,
  syncDetailMenuLabel: updateDetailCatalogMenuLabel,
  renderDetailMenu: renderDetailCatalogMenu
});

registerFeatureInterface("catalog-navigation", {
  escapePriority: 400,
  closeTopLayer: () => {
    if (!isMobileCategoryMenuOpen()) return false;
    closeMobileCategoryMenu({ focusButton: true });
    return true;
  }
});

registerFeatureInterface("catalog-detail", {
  escapePriority: 200,
  close: closeDetailCatalogMenu,
  containsTarget: (target) => target instanceof Node && (catalogElements.catalogMenu.contains(target) || catalogElements.catalogMenuToggle.contains(target)),
  closeTopLayer: () => {
    if (catalogElements.catalogMenu.classList.contains("hidden")) return false;
    closeDetailCatalogMenu();
    return true;
  }
});
