/**
 * Source module: 40-catalog-grid.js
 * Catalog navigation, category layout, catalog cards, preview grids, and catalog detail rendering.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

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

  if (els.catalogGrid) {
    els.catalogGrid.innerHTML = html;
    els.catalogGrid.setAttribute("aria-busy", "false");
    if (els.catalogLoadStatus) els.catalogLoadStatus.textContent = "אין קטלוגים זמינים כעת.";
  }
  if (els.pageGrid) {
    els.pageGrid.innerHTML = html;
    els.pageGrid.setAttribute("aria-busy", "false");
  }
  if (els.catalogCount) els.catalogCount.textContent = "0";
  if (els.pageCount) els.pageCount.textContent = "0";
  renderCategoryNav([]);
  showCatalogDetail();
  els.catalogTitle.textContent = "עדיין אין קטלוגים להצגה";
  els.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.";
  if (els.catalogMenuToggleText) els.catalogMenuToggleText.textContent = "אין קטלוגים";
  if (els.catalogMenu) els.catalogMenu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
  els.catalogCoverPreview?.removeAttribute("src");
  if (els.openCatalogEntryFromDetail) els.openCatalogEntryFromDetail.disabled = true;
}


const CATEGORY_NAV_MIN_BUTTON_SCALE = 0.68;
const CATEGORY_NAV_MIN_FONT_SIZE = 11;
const CATEGORY_NAV_MIN_BUTTON_HEIGHT = 30;
const CATEGORY_NAV_MIN_BUTTON_PADDING_X = 5;
const CATEGORY_NAV_MIN_GAP = 3;

function readPixelValue(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value || ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function categoryNavLinkLabel(link) {
  return String(link?.dataset?.categoryLabel || link?.textContent || "").trim();
}

function setCategoryNavLinkTooltip(link, text) {
  if (!link) return;
  setTooltipText(link, text || "", { updateDefault: true });
  link.removeAttribute("title");
}

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

function clearCategoryNavFit(header, links = []) {
  if (!header) return;
  header.classList.remove("is-top-nav-compressed", "is-top-nav-tight", "is-top-nav-ellipsized");
  header.style.removeProperty("--top-nav-gap");
  header.style.removeProperty("--top-nav-button-min-height");
  header.style.removeProperty("--top-nav-button-padding-x");
  header.style.removeProperty("--top-nav-button-font-size");
  syncCategoryNavOverflowTooltips(links, false);
}

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

function categoryNavRequiredWidth(nav, links) {
  if (!links.length) return 0;
  const gap = readPixelValue(window.getComputedStyle(nav).columnGap, 0);
  const linkWidth = links.reduce((sum, link) => sum + Math.ceil(link.scrollWidth), 0);
  return linkWidth + (gap * Math.max(0, links.length - 1));
}

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
  state.categoryNavFitRaf = 0;
  const nav = els.categoryNav;
  const header = nav?.closest?.(".site-header");
  if (!nav || !header) return;

  const links = Array.from(nav.querySelectorAll(".category-nav-link"));
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
  if (!els.categoryNav) return;
  window.cancelAnimationFrame(state.categoryNavFitRaf);
  state.categoryNavFitRaf = window.requestAnimationFrame(fitCategoryNavToSingleRow);
}

function initCategoryNavFit() {
  if (!els.categoryNav) return;
  document.querySelectorAll('img[data-brand-logo="1"]').forEach((image) => {
    image.addEventListener("load", scheduleCategoryNavFit);
  });
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleCategoryNavFit).catch(() => {});
  }
  scheduleCategoryNavFit();
}


function renderCategoryNav(groups = getCatalogCategoryGroups()) {
  const links = groups.map((group, index) => {
    const targetId = categorySectionId(group.category, index);
    const sharePath = catalogCategorySharePath(group.category, index);
    return {
      href: buildCategoryShareRouteHash(sharePath),
      targetId,
      sharePath,
      label: group.category
    };
  });

  if (els.categoryNav) {
    els.categoryNav.innerHTML = links.map((link) => `
      <a class="top-nav-link category-nav-link" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>
    `).join("");
  }

  if (els.mobileCategoryMenu) {
    els.mobileCategoryMenu.innerHTML = links.length
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
  return Boolean(els.mobileCategoryMenu && !els.mobileCategoryMenu.classList.contains("hidden"));
}

function setMobileCategoryMenuOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  if (!els.mobileCategoryMenu || !els.mobileCategoryMenuToggle) return;

  els.mobileCategoryMenu.classList.toggle("hidden", !shouldOpen);
  els.mobileCategoryMenu.classList.toggle("is-open", shouldOpen);
  els.mobileCategoryMenuToggle.classList.toggle("is-active", shouldOpen);
  els.mobileCategoryMenuToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  els.mobileCategoryMenuToggle.setAttribute("aria-label", shouldOpen ? "סגירת תפריט קטגוריות" : "פתיחת תפריט קטגוריות");

  if (shouldOpen && options.focusFirst) {
    window.requestAnimationFrame(() => els.mobileCategoryMenu?.querySelector(".mobile-category-menu-link")?.focus());
  } else if (!shouldOpen && options.focusButton) {
    window.requestAnimationFrame(() => els.mobileCategoryMenuToggle?.focus({ preventScroll: true }));
  }
}

function closeMobileCategoryMenu(options = {}) {
  setMobileCategoryMenuOpen(false, options);
}

function decodeHashTargetId(hash = location.hash) {
  const rawHash = String(hash || "");
  if (!rawHash.startsWith("#")) return "";

  const rawId = rawHash.slice(1);
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

function isCatalogFocusSection(section) {
  return Boolean(section?.classList?.contains("catalog-category-section") || section?.classList?.contains("catalog-subcategory-section"));
}

function getCatalogCategorySectionById(id) {
  const section = id ? document.getElementById(id) : null;
  return isCatalogFocusSection(section) ? section : null;
}

function getCatalogCategorySectionFromHash(hash = location.hash) {
  return getCatalogCategorySectionById(decodeHashTargetId(hash));
}

function getCatalogCategoryFocusTargetId(section) {
  return section?.dataset?.categoryFocusTarget || section?.id || "";
}

function getCatalogFocusSections() {
  if (!els.catalogGrid) return [];
  return Array.from(els.catalogGrid.querySelectorAll(".catalog-category-section, .catalog-subcategory-section"));
}

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

function buildCatalogFocusRouteHash(targetId) {
  const section = getCatalogCategorySectionsByTargetId(targetId)[0] || getCatalogCategorySectionById(targetId);
  const sharePath = normalizeShareRoutePath(section?.dataset?.categorySharePath);
  return buildCategoryShareRouteHash(sharePath) || (targetId ? `#${encodeHashRouteSegment(targetId)}` : "");
}

function hasCatalogCategoryFocus(targetId) {
  return getCatalogCategorySectionsByTargetId(targetId)
    .some((section) => section.classList.contains("is-category-focus"));
}

function syncActiveCategoryNavLink(activeId = state.categoryFocusTargetId) {
  const normalizedActiveId = String(activeId || "");

  [els.categoryNav, els.mobileCategoryMenu].forEach((container) => {
    container?.querySelectorAll(".category-nav-link").forEach((link) => {
      const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  });

  els.catalogGrid?.querySelectorAll(".catalog-subcategory-nav-link").forEach((link) => {
    const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function clearCatalogCategoryFocus(options = {}) {
  const { clearHash = false } = options;

  window.clearTimeout(state.categoryFocusTimer);
  state.categoryFocusTimer = 0;
  state.categoryFocusTargetId = "";
  getCatalogFocusSections().forEach((section) => {
    section.classList.remove("is-category-focus");
  });
  syncActiveCategoryNavLink("");

  const hashTargetId = resolveCatalogCategoryTargetIdFromHash();
  if (clearHash && hashTargetId && getCatalogCategorySectionsByTargetId(hashTargetId).length && window.history?.replaceState) {
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  }

  return true;
}

function markCatalogCategoryFocus(section, options = {}) {
  if (!section) return false;

  const { animate = true, targetId: requestedTargetId = "" } = options;
  const targetId = String(requestedTargetId || getCatalogCategoryFocusTargetId(section) || "");
  const targetSections = getCatalogCategorySectionsByTargetId(targetId);
  if (!targetId || !targetSections.length) return false;

  window.clearTimeout(state.categoryFocusTimer);
  state.categoryFocusTimer = 0;

  getCatalogFocusSections().forEach((activeSection) => {
    if (!targetSections.includes(activeSection)) activeSection.classList.remove("is-category-focus");
  });

  targetSections.forEach((targetSection) => targetSection.classList.remove("is-category-focus"));
  if (animate) {
    // Restart the pulse cleanly across every visible segment of the selected category or subcategory.
    void targetSections[0].offsetWidth;
  }
  targetSections.forEach((targetSection) => targetSection.classList.add("is-category-focus"));

  state.categoryFocusTargetId = targetId;
  syncActiveCategoryNavLink(targetId);
  return true;
}

function markCatalogCategoryFocusById(id, options = {}) {
  return markCatalogCategoryFocus(getCatalogCategorySectionById(id), { ...options, targetId: id });
}

function handleCatalogFocusLinkClick(link, event) {
  const targetId = link?.dataset?.categoryTarget || resolveCatalogCategoryTargetIdFromHash(link?.hash);
  if (!targetId) return;

  event.preventDefault();

  if (!isAppPage("home")) {
    navigateTo(`${homeDocumentUrl()}${buildCatalogFocusRouteHash(targetId)}`);
    return;
  }

  if (state.categoryFocusTargetId === targetId && hasCatalogCategoryFocus(targetId)) {
    clearCatalogCategoryFocus({ clearHash: true });
    return;
  }

  const section = getCatalogCategorySectionById(targetId) || getCatalogCategorySectionsByTargetId(targetId)[0];
  markCatalogCategoryFocus(section, { targetId });
  section?.scrollIntoView?.({ behavior: "smooth", block: "start" });

  const hash = buildCatalogFocusRouteHash(targetId);
  if (hash) {
    location.hash = hash;
  }
}

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


function catalogLayoutColumnCount() {
  if (typeof window === "undefined" || !window.matchMedia) return 3;
  if (window.matchMedia("(max-width: 760px)").matches) return 1;
  if (window.matchMedia("(max-width: 1180px)").matches) return 2;
  return 3;
}

function clampCategorySpan(value, columns) {
  return Math.min(columns, Math.max(1, Number(value || 1)));
}

function catalogSubcategorySourceBlocks(source) {
  const sourceBlocks = [];

  if (Array.isArray(source?.directItems) && source.directItems.length) {
    sourceBlocks.push({
      blockKey: "__direct__",
      blockIndex: -1,
      label: "קטלוגים כלליים",
      isDirect: true,
      items: source.directItems
    });
  }

  (Array.isArray(source?.subcategories) ? source.subcategories : []).forEach((group, index) => {
    const subcategory = String(group?.subcategory || "").trim();
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!subcategory || !items.length) return;

    sourceBlocks.push({
      blockKey: subcategory,
      blockIndex: index,
      label: subcategory,
      isDirect: false,
      items
    });
  });

  return sourceBlocks;
}

function catalogCategorySegments(groups, columns = catalogLayoutColumnCount()) {
  const safeColumns = clampCategorySpan(columns, 3);
  const segments = [];
  let occupied = 0;

  const appendCardBlockSegments = (group, groupIndex, block, options = {}) => {
    const items = Array.isArray(block?.items) ? block.items : [];
    if (!items.length) return;

    const segmentType = options.segmentType || "category";
    const layoutBlockKey = options.layoutBlockKey || `${segmentType}:${groupIndex}:${block?.blockKey || "main"}`;
    let itemOffset = 0;
    let segmentIndex = 0;

    while (itemOffset < items.length) {
      if (occupied >= safeColumns) occupied = 0;
      const availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns;
      const span = Math.min(availableInRow, items.length - itemOffset, safeColumns);

      const segment = {
        category: group.category,
        groupIndex,
        segmentIndex,
        itemOffset,
        span,
        items: items.slice(itemOffset, itemOffset + span),
        hasSubcategories: Boolean(options.hasSubcategories),
        segmentType,
        layoutBlockKey,
        inlineDivider: false
      };

      if (segmentType === "subcategory") {
        Object.assign(segment, {
          blockKey: block.blockKey,
          blockIndex: block.blockIndex,
          blockOrder: options.blockOrder,
          label: block.label,
          isDirect: Boolean(block.isDirect)
        });
      }

      segments.push(segment);
      itemOffset += span;
      segmentIndex += 1;
      occupied += span;
      if (occupied >= safeColumns) occupied = 0;
    }
  };

  groups.forEach((group, groupIndex) => {
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!items.length) return;

    if (group?.hasSubcategories) {
      if (occupied > 0) occupied = 0;

      segments.push({
        category: group.category,
        groupIndex,
        segmentIndex: 0,
        itemOffset: 0,
        span: safeColumns,
        items: [],
        directItems: Array.isArray(group.directItems) ? group.directItems : [],
        subcategories: Array.isArray(group.subcategories) ? group.subcategories : [],
        hasSubcategories: true,
        segmentType: "categoryHeader",
        layoutBlockKey: `category-header:${groupIndex}`,
        inlineDivider: false
      });
      occupied = 0;

      catalogSubcategorySourceBlocks(group).forEach((block, blockOrder) => {
        appendCardBlockSegments(group, groupIndex, block, {
          segmentType: "subcategory",
          hasSubcategories: true,
          blockOrder,
          layoutBlockKey: `subcategory:${groupIndex}:${block.blockKey}:${blockOrder}`
        });
      });
      return;
    }

    appendCardBlockSegments(group, groupIndex, { blockKey: "__category__", items }, {
      segmentType: "category",
      hasSubcategories: false,
      layoutBlockKey: `category:${groupIndex}`
    });
  });

  occupied = 0;
  segments.forEach((segment, index) => {
    const span = clampCategorySpan(segment.span, safeColumns);
    if (occupied + span > safeColumns) occupied = 0;

    const rowEnd = occupied + span;
    const nextSegment = segments[index + 1];
    const nextSpan = nextSegment ? clampCategorySpan(nextSegment.span, safeColumns) : 0;
    const sameLayoutBlock = Boolean(nextSegment && nextSegment.layoutBlockKey === segment.layoutBlockKey);
    segment.inlineDivider = Boolean(
      nextSegment
      && !sameLayoutBlock
      && segment.segmentType !== "categoryHeader"
      && nextSegment.segmentType !== "categoryHeader"
      && rowEnd < safeColumns
      && nextSpan <= safeColumns - rowEnd
    );

    occupied = rowEnd >= safeColumns ? 0 : rowEnd;
  });

  return segments;
}

function scheduleCatalogLayoutRefresh() {
  if (!catalogs.length) return;
  window.clearTimeout(state.catalogLayoutResizeTimer);
  state.catalogLayoutResizeTimer = window.setTimeout(() => {
    const nextColumns = catalogLayoutColumnCount();
    if (nextColumns !== state.catalogLayoutColumns) renderCatalogCards();
  }, 120);
}

function renderCatalogCard(catalog, headingLevel = 3) {
  const cover = coverThumbSrc(catalog);
  const safeCatalogId = escapeHtml(catalog.id);
  const safeTitle = escapeHtml(catalog.title);
  const safeHeadingLevel = headingLevel === 4 ? 4 : 3;
  return `
    <article class="catalog-card">
      <button class="catalog-cover-frame catalog-image-frame catalog-cover-button" type="button" data-open-catalog-entry="${safeCatalogId}" aria-label="פתיחת הקטלוג ${safeTitle}">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${safeTitle}" loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(cover)} />
        <span class="catalog-cover-card-entry-hint" aria-hidden="true">פתיחת הקטלוג</span>
      </button>
      <div class="catalog-body">
        <h${safeHeadingLevel}>${safeTitle}</h${safeHeadingLevel}>
        <p>${escapeHtml(catalog.description || "")}</p>
        <div class="catalog-actions" role="group" aria-label="פעולות עבור ${safeTitle}">
          <button class="button primary catalog-open-button" type="button" data-open-catalog-entry="${safeCatalogId}">פתיחת הקטלוג</button>
          <button class="button soft catalog-preview-button" type="button" data-open-catalog-preview="${safeCatalogId}">תצוגה מקדימה</button>
        </div>
      </div>
    </article>
  `;
}

function renderCatalogSubcategoryNav(segment) {
  if (!segment?.hasSubcategories || !Array.isArray(segment.subcategories) || !segment.subcategories.length) return "";

  const buttons = segment.subcategories.map((group, index) => {
    const targetId = subcategorySectionId(segment.category, segment.groupIndex, group.subcategory, index);
    const sharePath = catalogSubcategorySharePath(segment.category, segment.groupIndex, group.subcategory, index);
    return `<a class="catalog-subcategory-nav-link" href="${escapeHtml(buildCategoryShareRouteHash(sharePath))}" data-category-target="${escapeHtml(targetId)}" data-category-share-path="${escapeHtml(sharePath)}">${escapeHtml(group.subcategory)}</a>`;
  }).join("");

  return `
    <nav class="catalog-subcategory-nav" aria-label="ניווט תתי קטגוריות עבור ${escapeHtml(segment.category)}">
      ${buttons}
    </nav>
  `;
}

function catalogSubcategoryLayoutSegments(segment, columns = catalogLayoutColumnCount()) {
  const safeColumns = clampCategorySpan(columns, 3);
  const sourceBlocks = [];

  if (Array.isArray(segment.directItems) && segment.directItems.length) {
    sourceBlocks.push({
      blockKey: "__direct__",
      blockIndex: -1,
      label: "קטלוגים כלליים",
      isDirect: true,
      items: segment.directItems
    });
  }

  (Array.isArray(segment.subcategories) ? segment.subcategories : []).forEach((group, index) => {
    const subcategory = String(group?.subcategory || "").trim();
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!subcategory || !items.length) return;

    sourceBlocks.push({
      blockKey: subcategory,
      blockIndex: index,
      label: subcategory,
      isDirect: false,
      items
    });
  });

  const layoutSegments = [];
  let occupied = 0;

  sourceBlocks.forEach((block, blockOrder) => {
    let itemOffset = 0;
    let segmentIndex = 0;

    while (itemOffset < block.items.length) {
      if (occupied >= safeColumns) occupied = 0;
      const availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns;
      const span = Math.min(availableInRow, block.items.length - itemOffset, safeColumns);

      layoutSegments.push({
        ...block,
        blockOrder,
        segmentIndex,
        itemOffset,
        span,
        items: block.items.slice(itemOffset, itemOffset + span),
        inlineDivider: false
      });

      itemOffset += span;
      segmentIndex += 1;
      occupied += span;
      if (occupied >= safeColumns) occupied = 0;
    }
  });

  occupied = 0;
  layoutSegments.forEach((block, index) => {
    const span = clampCategorySpan(block.span, safeColumns);
    if (occupied + span > safeColumns) occupied = 0;

    const rowEnd = occupied + span;
    const nextBlock = layoutSegments[index + 1];
    const nextSpan = nextBlock ? clampCategorySpan(nextBlock.span, safeColumns) : 0;
    block.inlineDivider = Boolean(
      nextBlock
      && nextBlock.blockOrder !== block.blockOrder
      && rowEnd < safeColumns
      && nextSpan <= safeColumns - rowEnd
    );

    occupied = rowEnd >= safeColumns ? 0 : rowEnd;
  });

  return layoutSegments;
}

function catalogSubcategoryBlockBaseId(segment, block, baseSectionId) {
  if (block?.isDirect) return `${baseSectionId}-general`;
  return subcategorySectionId(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0);
}

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
  const sectionStyle = `--subcategory-span: ${clampCategorySpan(block.span, 3)};`;

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

function renderCatalogCategoryHeaderSegment(segment, columns) {
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const titleId = `${baseSectionId}-title`;
  const safeColumns = clampCategorySpan(columns, 3);
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

function renderCatalogCategorySegment(segment, columns) {
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const safeColumns = clampCategorySpan(columns, 3);

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

function openCatalogEntry(catalogId, page = 1) {
  if (!catalogId) return;
  openCatalogInViewer(catalogId, page);
}

function bindCatalogCardEvents() {
  if (!els.catalogGrid) return;

  els.catalogGrid.querySelectorAll("[data-open-catalog-entry]").forEach((button) => {
    button.addEventListener("click", () => openCatalogEntry(button.dataset.openCatalogEntry));
  });

  els.catalogGrid.querySelectorAll("[data-open-catalog-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      openCatalog(button.dataset.openCatalogPreview, { scroll: true });
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
  if (els.catalogCount) els.catalogCount.textContent = String(catalogs.length);
  if (els.pageCount) els.pageCount.textContent = String(totalPages);
  renderCategoryNav(groups);

  const columns = catalogLayoutColumnCount();
  state.catalogLayoutColumns = columns;
  const categorySegments = catalogCategorySegments(groups, columns);

  els.catalogGrid.style.setProperty("--catalog-layout-columns", String(columns));
  els.catalogGrid.innerHTML = categorySegments.map((segment) => renderCatalogCategorySegment(segment, columns)).join("");
  els.catalogGrid.setAttribute("aria-busy", "false");
  if (els.catalogLoadStatus) {
    const count = catalogs.length;
    els.catalogLoadStatus.textContent = count === 1 ? "קטלוג אחד נטען." : `${count} קטלוגים נטענו.`;
  }

  bindCatalogCardEvents();
  syncCatalogCategoryFocusFromHash({ animate: false });
}


function fillCatalogSelect() {
  updateDetailCatalogMenuLabel();
}


function renderPageGrid() {
  if (!state.catalog) return;
  // Keep generated page cards visually stable during scroll.
  // Older versions attached scroll-time observers here for reveal animation
  // and thumb activation; that caused work exactly when a card entered view.

  const catalog = state.catalog;
  const cards = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    cards.push(`
      <article class="page-card">
        <button class="page-button" type="button" data-open-page="${page}">
          <div class="page-thumb-wrap"${pageAspectVariableStyle(catalog, page, "--page-thumb-aspect-ratio")}>
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}" loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
            <span class="page-number-badge">${page}</span>
          </div>
          <div class="page-card-body">
            <span class="page-card-title">עמוד ${page}</span>
            <span class="page-card-hint">לחץ להגדלה</span>
          </div>
        </button>
      </article>
    `);
  }
  els.pageGrid.setAttribute("aria-busy", "true");
  els.pageGrid.innerHTML = cards.join("");
  els.pageGrid.setAttribute("aria-busy", "false");

  els.pageGrid.querySelectorAll("[data-open-page]").forEach((button) => {
    button.addEventListener("click", () => openLightbox(Number(button.dataset.openPage)));
  });
}

function showCatalogDetail() {
  if (!els.catalogDetail) return;
  els.catalogDetail.classList.remove("hidden");
  els.catalogDetail.classList.add("in-view");
}

function scrollCatalogDetailIntoView(options = {}) {
  if (!els.catalogDetail) return;
  const { behavior = "smooth" } = options;
  requestAnimationFrame(() => {
    els.catalogDetail.scrollIntoView({ behavior, block: "start" });
    scheduleCatalogScrollTopButtonUpdate();
  });
}

function positionCatalogScrollTopButton() {
  if (!els.scrollToTopBtn || !els.pageGrid) return;

  const gridRect = els.pageGrid.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const buttonWidth = Math.max(els.scrollToTopBtn.offsetWidth || 46, 46);
  const safeInset = 12;
  const gapFromGrid = 12;
  const maxLeft = Math.max(safeInset, viewportWidth - buttonWidth - safeInset);
  const preferredLeft = gridRect.left - buttonWidth - gapFromGrid;
  const left = clampValue(preferredLeft, safeInset, maxLeft);

  els.scrollToTopBtn.style.setProperty("--catalog-scroll-top-left", `${Math.round(left)}px`);
}

function setCatalogScrollTopButtonVisible(visible) {
  if (!els.scrollToTopBtn) return;
  els.scrollToTopBtn.classList.toggle("is-visible", Boolean(visible));
  els.scrollToTopBtn.setAttribute("aria-hidden", visible ? "false" : "true");
  els.scrollToTopBtn.tabIndex = visible ? 0 : -1;
}

function updateCatalogScrollTopButton() {
  state.catalogScrollTopButtonRaf = 0;
  if (!els.scrollToTopBtn || !els.catalogDetail || !els.pageGrid || els.catalogDetail.classList.contains("hidden") || !state.catalog || state.lightboxOpen) {
    setCatalogScrollTopButtonVisible(false);
    return;
  }

  positionCatalogScrollTopButton();

  const detailRect = els.catalogDetail.getBoundingClientRect();
  const gridRect = els.pageGrid.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 90;
  const startedScrollingInsideGrid = gridRect.top < Math.min(headerHeight + 28, viewportHeight * 0.28);
  const stillNearGrid = gridRect.bottom > Math.min(180, viewportHeight * 0.35);
  const detailVisible = detailRect.bottom > 80 && detailRect.top < viewportHeight;
  setCatalogScrollTopButtonVisible(startedScrollingInsideGrid && stillNearGrid && detailVisible);
}

function scheduleCatalogScrollTopButtonUpdate() {
  if (state.catalogScrollTopButtonRaf) return;
  state.catalogScrollTopButtonRaf = requestAnimationFrame(updateCatalogScrollTopButton);
}

function renderCatalogDetail() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  showCatalogDetail();
  els.catalogTitle.textContent = catalog.title;
  els.catalogDescription.textContent = catalog.description || "";
  updateDetailCatalogMenuLabel(catalog);
  if (els.catalogCoverPreview) {
    setCatalogImageSource(els.catalogCoverPreview, catalogCoverSrc(catalog));
    els.catalogCoverPreview.loading = "lazy";
    els.catalogCoverPreview.decoding = "async";
    els.catalogCoverPreview.alt = `שער ${catalog.title}`;
  }
  if (els.openCatalogEntryFromDetail) els.openCatalogEntryFromDetail.disabled = catalog.pages < 1;
  if (els.catalogMenu && !els.catalogMenu.classList.contains("hidden")) renderDetailCatalogMenu();
  renderPageGrid();
  scheduleCatalogScrollTopButtonUpdate();
}

function preloadNeighbors() {
  if (!state.catalog) return;

  if (isFavoritesLightboxMode()) {
    const entries = getFavoriteEntries();
    [state.favoritesViewerIndex - 2, state.favoritesViewerIndex - 1, state.favoritesViewerIndex + 1, state.favoritesViewerIndex + 2]
      .filter((index) => index >= 0 && index < entries.length)
      .forEach((index) => {
        const entry = entries[index];
        prepareCatalogImage(pageSrc(entry.catalog, entry.page), { priority: "low" }).catch(() => {});
      });
    return;
  }

  [state.page - 2, state.page - 1, state.page + 1, state.page + 2]
    .filter((page) => page >= 1 && page <= state.catalog.pages)
    .forEach((page) => {
      prepareCatalogImage(pageSrc(state.catalog, page), { priority: "low" }).catch(() => {});
    });
}

function attachCatalogGridEvents() {
  els.mobileCategoryMenuToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: false });
    setMobileCategoryMenuOpen(!isMobileCategoryMenuOpen());
  });

  els.mobileCategoryMenu?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !els.mobileCategoryMenu.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  els.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderDetailCatalogMenu();
    const isOpen = !els.catalogMenu?.classList.contains("hidden");
    els.catalogMenu?.classList.toggle("hidden", isOpen);
    els.catalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  els.catalogMenu?.addEventListener("click", (event) => event.stopPropagation());

  els.openCatalogEntryFromDetail?.addEventListener("click", () => openLightbox(1));
  els.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  els.categoryNav?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !els.categoryNav.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  els.catalogGrid?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".catalog-subcategory-nav-link");
    if (!link || !els.catalogGrid.contains(link)) return;
    handleCatalogFocusLinkClick(link, event);
  });
}
