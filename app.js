const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;

const $ = (id) => document.getElementById(id);
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const MIN_VIEWER_ZOOM = 1;
const MAX_VIEWER_ZOOM = 5;

function resolveCatalogAssetUrl(path) {
  return String(path || "").trim();
}

function catalogImageCrossOriginAttribute() {
  return "";
}

function applyCatalogImageCrossOrigin(img) {
  if (img) img.removeAttribute("crossorigin");
}

function setCatalogImageSource(img, url) {
  if (!img) return;
  applyCatalogImageCrossOrigin(img);
  img.src = url;
}
const DOUBLE_TAP_DELAY = 320;
const DOUBLE_TAP_DISTANCE = 34;
const TAP_MOVE_TOLERANCE = 14;

const state = {
  catalog: null,
  page: 1,
  zoom: 1,
  fitScale: 1,
  panX: 0,
  panY: 0,
  dragStartX: 0,
  dragStartY: 0,
  dragStartPanX: 0,
  dragStartPanY: 0,
  lastTapAt: 0,
  lastTapX: 0,
  lastTapY: 0,
  lastTapSurface: "",
  suppressNextDblClickUntil: 0,
  pinchStartDistance: 0,
  pinchStartZoom: 1,
  pinchLastMidX: 0,
  pinchLastMidY: 0,
  pointers: new Map(),
  lightboxOpen: false,
  viewerMode: "single",
  thumbsHideTimer: 0,
  uiHideTimer: 0,
  pageRailHideTimer: 0,
  lastTouchLikeRailInputAt: 0,
  lightboxScrollRaf: 0,
  lightboxSearchScope: "catalog",
  pageThumbLoadTimer: 0,
  pageThumbObserver: null,
  lightboxScrollImageObserver: null
};

const els = {
  splash: $("splashScreen"),
  catalogGrid: $("catalogGrid"),
  categoryNav: $("categoryNav"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  globalSearchInput: $("globalSearchInput"),
  globalSearchResults: $("globalSearchResults"),
  globalSearchStatus: $("globalSearchStatus"),
  globalSearchClear: $("globalSearchClear"),
  lastViewCard: $("lastViewCard"),
  lastViewText: $("lastViewText"),
  lastViewDetails: $("lastViewDetails"),
  lastViewCatalog: $("lastViewCatalog"),
  lastViewPage: $("lastViewPage"),
  lastViewTime: $("lastViewTime"),
  catalogDetail: $("catalogDetail"),
  catalogTitle: $("catalogDetailTitle"),
  catalogDescription: $("catalogDescription"),
  catalogCategory: $("catalogCategory"),
  catalogPages: $("catalogPages"),
  catalogSelect: $("catalogSelect"),
  catalogCoverPreview: $("catalogCoverPreview"),
  catalogCoverOpenViewer: $("catalogCoverOpenViewer"),
  pageGrid: $("pageGrid"),
  openViewerFromTop: $("openViewerFromTop"),
  scrollToTopBtn: $("scrollToTopBtn"),
  lightbox: $("lightbox"),
  lightboxBackdrop: $("lightboxBackdrop"),
  lightboxBar: $("lightboxBar"),
  topHotspot: $("topHotspot"),
  thumbsHotspot: $("thumbsHotspot"),
  lightboxScreenshot: $("lightboxScreenshot"),
  lightboxCopyLink: $("lightboxCopyLink"),
  lightboxModeLabel: $("lightboxModeLabel"),
  viewerModeToggle: $("viewerModeToggle"),
  lightboxTitle: $("lightboxTitle"),
  lightboxMeta: $("lightboxMeta"),
  lightboxProgress: $("lightboxProgress"),
  lightboxImage: $("lightboxImage"),
  lightboxImageFrame: $("lightboxImageFrame"),
  lightboxThumbs: $("lightboxThumbs"),
  lightboxStage: $("lightboxStage"),
  lightboxScrollView: $("lightboxScrollView"),
  lightboxScrollPages: $("lightboxScrollPages"),
  lightboxSideHotspot: $("lightboxSideHotspot"),
  lightboxPageRail: $("lightboxPageRail"),
  lightboxPageThumbs: $("lightboxPageThumbs"),
  stageCanvas: $("stageCanvas"),
  viewerLoading: $("viewerLoading"),
  prevPageBtn: $("prevPageBtn"),
  nextPageBtn: $("nextPageBtn"),
  closeLightbox: $("closeLightbox"),
  zoomInBtn: $("zoomInBtn"),
  zoomOutBtn: $("zoomOutBtn"),
  fullscreenToggle: $("fullscreenToggle"),
  fitBtn: $("fitBtn"),
  lightboxSearchInput: $("lightboxSearchInput"),
  lightboxSearchResults: $("lightboxSearchResults"),
  lightboxSearchStatus: $("lightboxSearchStatus"),
  lightboxSearchClear: $("lightboxSearchClear"),
  lightboxSearchScopeToggle: $("lightboxSearchScopeToggle"),
  lightboxSearchScopeMenu: $("lightboxSearchScopeMenu"),
  lightboxCatalogMenuToggle: $("lightboxCatalogMenuToggle"),
  lightboxCatalogMenu: $("lightboxCatalogMenu"),
  lightboxFloatingPreview: $("lightboxFloatingPreview"),
  lightboxFloatingPreviewImage: $("lightboxFloatingPreviewImage"),
  lightboxFloatingPreviewPage: $("lightboxFloatingPreviewPage")
};

function pad(num) {
  return String(num).padStart(3, "0");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function catalogCategoryName(catalog) {
  const category = String(catalog?.category || "").trim();
  return category || "קטלוגים";
}

function categorySlug(value) {
  return String(value || "catalog")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "catalog";
}

function categorySectionId(category, index) {
  return `catalog-category-${categorySlug(category)}-${index + 1}`;
}

function getCatalogCategoryGroups() {
  const groups = [];
  const groupByCategory = new Map();

  catalogs.forEach((catalog) => {
    const category = catalogCategoryName(catalog);
    if (!groupByCategory.has(category)) {
      const group = { category, items: [] };
      groupByCategory.set(category, group);
      groups.push(group);
    }
    groupByCategory.get(category).items.push(catalog);
  });

  return groups;
}

function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}

function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}

function withAssetVersion(url, catalog) {
  const version = String(catalog?.assetVersion || "").trim();
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

function pageSrc(catalog, page) {
  return withAssetVersion(`${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`, catalog);
}

function thumbSrc(catalog, page) {
  return withAssetVersion(`${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`, catalog);
}

function catalogCoverSrc(catalog) {
  return catalog?.cover ? withAssetVersion(resolveCatalogAssetUrl(catalog.cover), catalog) : pageSrc(catalog, 1);
}

function coverThumbSrc(catalog) {
  return thumbSrc(catalog, 1);
}

function pageSize(catalog, page) {
  const sizes = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes : [];
  const size = sizes[page - 1];
  if (!Array.isArray(size) || size.length < 2) return null;
  const width = Number(size[0]);
  const height = Number(size[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function pageAspectStyle(catalog, page) {
  const size = pageSize(catalog, page);
  return size ? ` style="aspect-ratio: ${size.width} / ${size.height}"` : "";
}

function clampPage(page, catalog = state.catalog) {
  const parsed = Number.parseInt(page, 10);
  if (!Number.isFinite(parsed)) return 1;
  const maxPage = Math.max(1, Number(catalog?.pages || 1));
  return Math.min(Math.max(parsed, 1), maxPage);
}

function safeFilePart(value) {
  return String(value || "catalog")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "catalog";
}

function getTooltipText(button) {
  return window.BargigTooltips?.getText?.(button) || button?.getAttribute?.("title") || "";
}

function setTooltipText(button, text, options = {}) {
  if (!button) return;
  if (window.BargigTooltips?.setText) {
    window.BargigTooltips.setText(button, text, options);
    return;
  }

  if (text) button.setAttribute("title", text);
  else button.removeAttribute("title");
}

function flashActionButton(button, message) {
  if (!button || !message) return;
  const originalTooltip = getTooltipText(button);
  setTooltipText(button, message);
  button.classList.add("reader-icon-button-done");
  window.setTimeout(() => {
    setTooltipText(button, originalTooltip);
    button.classList.remove("reader-icon-button-done");
  }, 1500);
}

function readLastCatalogView() {
  return window.BargigLastView?.read?.(catalogs) || null;
}

function renderLastCatalogView() {
  if (!els.lastViewCard) return;

  const record = readLastCatalogView();
  const hasRecord = Boolean(record);
  els.lastViewCard.classList.toggle("has-last-view", hasRecord);
  els.lastViewCard.disabled = !hasRecord;
  els.lastViewCard.setAttribute("aria-disabled", hasRecord ? "false" : "true");

  if (!hasRecord) {
    els.lastViewCard.setAttribute("aria-label", "עדיין אין מיקום צפייה שמור");
    if (els.lastViewText) {
      els.lastViewText.textContent = "אחרי צפייה בקטלוג יופיע כאן הקטלוג והעמוד האחרון.";
    }
    if (els.lastViewCatalog) els.lastViewCatalog.textContent = "—";
    if (els.lastViewPage) els.lastViewPage.textContent = "—";
    if (els.lastViewTime) els.lastViewTime.textContent = "—";
    return;
  }

  const catalogTitle = record.catalog?.title || "קטלוג";
  const totalPages = Math.max(1, Number(record.catalog?.pages || 1));
  const pageLabel = `עמוד ${record.page} מתוך ${totalPages}`;
  const locationLabel = window.BargigLastView?.formatLocation?.(record) || `${catalogTitle} · ${pageLabel}`;
  const timeLabel = window.BargigLastView?.formatTime?.(record.updatedAt) || "נשמר לאחרונה";

  els.lastViewCard.setAttribute("aria-label", `המשך צפייה ממקום אחרון: ${locationLabel}. ${timeLabel}`);

  if (els.lastViewText) {
    els.lastViewText.textContent = "לחצו על הכרטיס כדי לחזור בדיוק לנקודה האחרונה.";
  }
  if (els.lastViewCatalog) els.lastViewCatalog.textContent = catalogTitle;
  if (els.lastViewPage) els.lastViewPage.textContent = pageLabel;
  if (els.lastViewTime) els.lastViewTime.textContent = timeLabel;

}

function rememberCurrentCatalogView() {
  if (!state.catalog || !state.lightboxOpen) return null;

  const record = window.BargigLastView?.save?.(catalogs, {
    catalogId: state.catalog.id,
    page: clampPage(state.page, state.catalog),
    viewerMode: state.viewerMode,
    updatedAt: Date.now()
  }) || null;

  if (record) renderLastCatalogView();
  return record;
}

function continueLastCatalogView() {
  const record = readLastCatalogView();
  if (!record) {
    renderLastCatalogView();
    return false;
  }

  openCatalogInViewer(record.catalogId, record.page, record.viewerMode);
  return true;
}

function loadDeferredImage(img) {
  const src = img?.dataset?.src;
  if (!src || img.getAttribute("src") === src) return;
  img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  setCatalogImageSource(img, src);
  img.removeAttribute("data-src");
}

function disconnectLightboxScrollImageLoading() {
  state.lightboxScrollImageObserver?.disconnect?.();
  state.lightboxScrollImageObserver = null;
}

function activateLightboxScrollImageLoading() {
  if (!els.lightboxScrollPages) return;
  const pendingImages = Array.from(els.lightboxScrollPages.querySelectorAll("img.lightbox-scroll-image[data-src]"));
  if (!pendingImages.length) return;

  if (!("IntersectionObserver" in window)) {
    pendingImages.forEach(loadDeferredImage);
    return;
  }

  disconnectLightboxScrollImageLoading();
  state.lightboxScrollImageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadDeferredImage(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    root: els.lightboxScrollView || null,
    rootMargin: "1800px 0px",
    threshold: 0.01
  });

  pendingImages.forEach((img) => state.lightboxScrollImageObserver.observe(img));
}

function ensureLightboxScrollPageLoaded(page, radius = 1) {
  if (!state.catalog || !els.lightboxScrollPages) return;
  const targetPage = clampPage(page, state.catalog);
  for (let nextPage = targetPage - radius; nextPage <= targetPage + radius; nextPage += 1) {
    if (nextPage < 1 || nextPage > state.catalog.pages) continue;
    const img = els.lightboxScrollPages.querySelector(`#lightbox-scroll-page-${nextPage} img.lightbox-scroll-image[data-src]`);
    if (img) {
      loadDeferredImage(img);
      state.lightboxScrollImageObserver?.unobserve?.(img);
    }
  }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 900);
}

async function downloadCatalogPageSnapshot(catalog, page, button) {
  if (!catalog) return;
  const currentPage = clampPage(page, catalog);
  const src = pageSrc(catalog, currentPage);

  try {
    if (!window.CatalogSnapshot?.buildSnapshotBlob) {
      throw new Error("snapshot-exporter-missing");
    }

    const blob = await window.CatalogSnapshot.buildSnapshotBlob(src);
    const extension = window.CatalogSnapshot.extension || "jpg";
    saveBlob(blob, `${safeFilePart(catalog.title || catalog.id)}-page-${pad(currentPage)}.${extension}`);
    flashActionButton(button, "צילום המסך נשמר");
  } catch (_error) {
    window.alert("לא הצלחתי ליצור צילום מסך לעמוד הזה. כדאי לוודא שקבצי התמונות נטענים מאותו אתר ולא מחסימה של הדפדפן.");
  }
}

function buildLightboxPageUrl() {
  if (!state.catalog) return window.location.href;
  const url = new URL(window.location.href);
  url.hash = `catalog/${state.catalog.id}/page/${clampPage(state.page, state.catalog)}${state.viewerMode === "scroll" ? "/scroll" : ""}`;
  return url.href;
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.top = "-1000px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function downloadCurrentLightboxImage() {
  if (!state.catalog) return;
  downloadCatalogPageSnapshot(state.catalog, state.page, els.lightboxScreenshot);
}

async function copyCurrentLightboxLink() {
  const link = buildLightboxPageUrl();
  try {
    await copyTextToClipboard(link);
    flashActionButton(els.lightboxCopyLink, "הקישור הועתק");
  } catch (_error) {
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}


function initRevealObserver() {
  const nodes = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  nodes.forEach((node) => observer.observe(node));
}

function renderEmptyState() {
  const html = `
    <article class="empty-state">
      <strong>עדיין אין קטלוגים להצגה</strong>
      <p>ברגע שיועלו קטלוגים, הם יופיעו כאן לבחירה ולצפייה.</p>
    </article>
  `;

  if (els.catalogGrid) els.catalogGrid.innerHTML = html;
  if (els.pageGrid) els.pageGrid.innerHTML = html;
  if (els.catalogCount) els.catalogCount.textContent = "0";
  if (els.pageCount) els.pageCount.textContent = "0";
  renderCategoryNav([]);
  showCatalogDetail();
  els.catalogTitle.textContent = "עדיין אין קטלוגים להצגה";
  els.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.";
  els.catalogCategory.textContent = "קטלוגים";
  els.catalogPages.textContent = "0 עמודים";
  els.catalogSelect.innerHTML = `<option>אין קטלוגים</option>`;
  els.catalogCoverPreview.removeAttribute("src");
  els.openViewerFromTop.disabled = true;
}


function renderCategoryNav(groups = getCatalogCategoryGroups()) {
  if (!els.categoryNav) return;

  const links = [
    `<a class="top-nav-link" href="#catalogs">כל הקטלוגים</a>`,
    ...groups.map((group, index) => (
      `<a class="top-nav-link category-nav-link" href="#${escapeHtml(categorySectionId(group.category, index))}">${escapeHtml(group.category)}</a>`
    ))
  ];

  els.categoryNav.innerHTML = links.join("");
}

function renderCatalogCard(catalog) {
  const cover = coverThumbSrc(catalog);
  const category = catalogCategoryName(catalog);
  return `
    <article class="catalog-card">
      <button class="catalog-cover-frame catalog-image-frame catalog-cover-card-button" type="button" data-open-catalog-viewer="${escapeHtml(catalog.id)}" aria-label="פתיחת ${escapeHtml(catalog.title)} במסך מלא">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${escapeHtml(catalog.title)}" loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(cover)} />
        <span class="catalog-cover-card-cta">צפייה במסך מלא</span>
      </button>
      <div class="catalog-body">
        <div class="catalog-meta">
          <span class="pill">${escapeHtml(category)}</span>
          <span class="pill">${escapeHtml(catalog.pages)} עמודים</span>
        </div>
        <h3>${escapeHtml(catalog.title)}</h3>
        <p>${escapeHtml(catalog.description || "")}</p>
        <div class="catalog-actions">
          <button class="button soft" type="button" data-open-catalog="${escapeHtml(catalog.id)}">צפייה בקטלוג</button>
          <button class="button primary" type="button" data-enter-catalog="${escapeHtml(catalog.id)}">כניסה לקטלוג</button>
        </div>
      </div>
    </article>
  `;
}

function bindCatalogCardEvents() {
  if (!els.catalogGrid) return;

  els.catalogGrid.querySelectorAll("[data-open-catalog-viewer]").forEach((button) => {
    button.addEventListener("click", () => openCatalogInViewer(button.dataset.openCatalogViewer));
  });

  els.catalogGrid.querySelectorAll("[data-open-catalog]").forEach((button) => {
    button.addEventListener("click", () => openCatalog(button.dataset.openCatalog, { scroll: true }));
  });

  els.catalogGrid.querySelectorAll("[data-enter-catalog]").forEach((button) => {
    button.addEventListener("click", () => openCatalogPage(button.dataset.enterCatalog));
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

  els.catalogGrid.innerHTML = groups.map((group, index) => {
    const sectionId = categorySectionId(group.category, index);
    const catalogCountText = group.items.length === 1 ? "קטלוג אחד" : `${group.items.length} קטלוגים`;
    const pageCount = group.items.reduce((sum, item) => sum + Number(item.pages || 0), 0);
    return `
      <section class="catalog-category-section" id="${escapeHtml(sectionId)}" aria-labelledby="${escapeHtml(sectionId)}-title">
        <div class="catalog-category-head">
          <div>
            <p class="eyebrow">${escapeHtml(group.category)}</p>
            <h3 id="${escapeHtml(sectionId)}-title">קטלוגי ${escapeHtml(group.category)}</h3>
          </div>
          <div class="catalog-category-meta" aria-label="סיכום קטגוריה">
            <span class="pill">${escapeHtml(catalogCountText)}</span>
            <span class="pill">${escapeHtml(pageCount)} עמודים</span>
          </div>
        </div>
        <div class="catalog-grid catalog-category-grid">
          ${group.items.map(renderCatalogCard).join("")}
        </div>
      </section>
    `;
  }).join("");

  bindCatalogCardEvents();
}


function initSearchStatus() {
  if (!els.globalSearchStatus) return;
  if (!catalogSearch?.hasIndex?.()) {
    els.globalSearchStatus.textContent = "החיפוש יופעל אחרי הרצת ההמרה מחדש, שמייצרת גם אינדקס OCR לקובץ catalogs.search.js.";
    return;
  }
  const count = catalogSearch.indexedPageCount?.() || 0;
  els.globalSearchStatus.textContent = `מוכן לחיפוש בתוך ${count} עמודים מאונדקסים. הקלד לפחות 2 תווים.`;
}

function getLightboxSearchScope() {
  return state.lightboxSearchScope === "all" ? "all" : "catalog";
}

function lightboxSearchScopeLabel(scope = getLightboxSearchScope()) {
  return scope === "all" ? "בכל הקטלוגים" : "בקטלוג הזה";
}

function lightboxSearchPlaceholder() {
  if (getLightboxSearchScope() === "all") return "חיפוש דגם בכל הקטלוגים...";
  const title = String(state.catalog?.title || "").trim();
  return title ? `חיפוש דגם בקטלוג הזה: ${title}` : "חיפוש דגם בקטלוג הזה...";
}

function closeLightboxSearchScopeMenu() {
  els.lightboxSearchScopeMenu?.classList.add("hidden");
  els.lightboxSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function closeLightboxCatalogMenu() {
  els.lightboxCatalogMenu?.classList.add("hidden");
  els.lightboxCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function syncLightboxSearchScopeUi() {
  const scope = getLightboxSearchScope();
  if (els.lightboxSearchScopeToggle) {
    els.lightboxSearchScopeToggle.innerHTML = `${escapeHtml(lightboxSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`;
  }
  if (els.lightboxSearchInput) {
    els.lightboxSearchInput.placeholder = lightboxSearchPlaceholder();
    els.lightboxSearchInput.setAttribute("aria-label", lightboxSearchPlaceholder());
  }
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    const selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setLightboxSearchScope(scope, options = {}) {
  const nextScope = scope === "all" ? "all" : "catalog";
  if (state.lightboxSearchScope === nextScope) {
    syncLightboxSearchScopeUi();
    closeLightboxSearchScopeMenu();
    return;
  }

  state.lightboxSearchScope = nextScope;
  syncLightboxSearchScopeUi();
  closeLightboxSearchScopeMenu();
  initLightboxSearchStatus();

  if (options.render !== false && els.lightboxSearchInput) {
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  }
}

function resetLightboxSearch() {
  if (els.lightboxSearchInput) els.lightboxSearchInput.value = "";
  els.lightboxSearchResults?.classList.add("hidden");
  if (els.lightboxSearchResults) els.lightboxSearchResults.innerHTML = "";
  els.lightboxSearchClear?.classList.add("hidden");
  syncLightboxSearchScopeUi();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  initLightboxSearchStatus();
}

function getLightboxSearchResults(query, limit = 24) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.()) return [];

  const options = { limit };
  if (getLightboxSearchScope() !== "all") {
    if (!state.catalog) return [];
    options.catalogId = state.catalog.id;
  }

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function openLightboxSearchResult(result) {
  if (!result) return false;

  const targetCatalogId = result.catalogId || state.catalog?.id;
  if (!targetCatalogId) return false;

  if (!state.catalog || state.catalog.id !== targetCatalogId) {
    openCatalogInViewer(targetCatalogId, Number(result.page), state.viewerMode);
    return true;
  }

  const page = clampPage(result.page, state.catalog);
  setLightboxPage(page, { smooth: true, hit: state.viewerMode === "scroll" });
  showTopUiTemporarily(0);
  els.lightboxSearchResults?.classList.add("hidden");
  return true;
}

function submitLightboxSearch() {
  const rawQuery = String(els.lightboxSearchInput?.value || "").trim();
  renderLightboxSearchResults(rawQuery);
  const firstResult = getLightboxSearchResults(rawQuery, 1)[0];
  return openLightboxSearchResult(firstResult);
}

function initLightboxSearchStatus() {
  if (!els.lightboxSearchStatus) return;

  const hasCatalog = Boolean(state.catalog);
  const hasIndex = Boolean(catalogSearch?.hasIndex?.());
  if (els.lightboxSearchInput) els.lightboxSearchInput.disabled = !hasCatalog || !hasIndex;
  syncLightboxSearchScopeUi();

  if (!hasCatalog) {
    els.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }

  if (!hasIndex) {
    els.lightboxSearchStatus.textContent = "אין אינדקס OCR זמין לחיפוש.";
    return;
  }

  els.lightboxSearchStatus.textContent = getLightboxSearchScope() === "all"
    ? "הקלד לפחות 2 תווים לחיפוש בכל הקטלוגים."
    : "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
}

function renderLightboxSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.lightboxSearchResults || !els.lightboxSearchStatus) return;

  els.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    initLightboxSearchStatus();
    return;
  }

  if (!state.catalog || !catalogSearch?.hasIndex?.()) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    els.lightboxSearchStatus.textContent = "אין אינדקס חיפוש פעיל לקטלוג הזה.";
    return;
  }

  const scope = getLightboxSearchScope();
  const results = getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  els.lightboxSearchResults.classList.remove("hidden");

  if (!results.length) {
    els.lightboxSearchStatus.textContent = scope === "all"
      ? "לא נמצאו תוצאות בכל הקטלוגים."
      : "לא נמצאו תוצאות בקטלוג הפתוח.";
    els.lightboxSearchResults.innerHTML = `
      <article class="reader-search-empty lightbox-search-empty">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(rawQuery)}”</strong>
        <span>נסה חלק קצר יותר של הדגם או מילה אחרת.</span>
      </article>
    `;
    return;
  }

  els.lightboxSearchStatus.textContent = scope === "all"
    ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.`
    : `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
  els.lightboxSearchResults.innerHTML = results.map((result) => {
    const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || state.catalog;
    const page = clampPage(result.page, catalog);
    const rawThumb = result.thumb || thumbSrc(catalog, page);
    const thumb = escapeHtml(rawThumb);
    const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
    return `
      <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}">
        <span class="reader-search-thumb-frame catalog-image-frame">
          <img src="${thumb}" alt="${escapeHtml(catalogTitle)} - עמוד ${page}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawThumb)} />
        </span>
        <span>
          <strong>${scope === "all" ? escapeHtml(catalogTitle) : `עמוד ${page}`}</strong>
          <small>${scope === "all" ? `עמוד ${page} · ` : ""}${escapeHtml(result.excerpt || "התאמה לפי OCR בעמוד זה")}</small>
        </span>
      </button>
    `;
  }).join("");

  els.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]").forEach((button) => {
    button.addEventListener("click", () => {
      openLightboxSearchResult({
        catalogId: button.dataset.lightboxSearchCatalog,
        page: button.dataset.lightboxSearchPage
      });
    });
  });
}

function renderLightboxCatalogMenu() {
  if (!els.lightboxCatalogMenu) return;

  if (!catalogs.length) {
    els.lightboxCatalogMenu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
    return;
  }

  const groups = getCatalogCategoryGroups();
  els.lightboxCatalogMenu.innerHTML = groups.map((group) => `
    <section class="reader-catalog-menu-section">
      <div class="reader-catalog-menu-category">${escapeHtml(group.category)}</div>
      <div class="reader-catalog-menu-items">
        ${group.items.map((catalog) => `
          <button class="reader-catalog-menu-item${state.catalog?.id === catalog.id ? " active" : ""}" type="button" role="menuitem" data-lightbox-catalog-id="${escapeHtml(catalog.id)}">
            <strong>${escapeHtml(catalog.title)}</strong>
            <small>${escapeHtml(catalog.pages || 0)} עמודים</small>
          </button>
        `).join("")}
      </div>
    </section>
  `).join("");

  els.lightboxCatalogMenu.querySelectorAll("[data-lightbox-catalog-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.lightboxCatalogId;
      closeLightboxCatalogMenu();
      if (!catalogId || catalogId === state.catalog?.id) return;
      openCatalogInViewer(catalogId, 1, state.viewerMode);
    });
  });
}

function getGlobalSearchResults(query, limit = 72) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.()) return [];
  const results = catalogSearch.search(rawQuery, { limit });
  return Array.isArray(results) ? results : [];
}

function openGlobalSearchResult(result) {
  if (!result) return false;
  openCatalog(result.catalogId, { openPage: Number(result.page) });
  els.globalSearchResults?.classList.add("hidden");
  return true;
}

function submitGlobalSearch() {
  const rawQuery = String(els.globalSearchInput?.value || "").trim();
  renderSearchResults(rawQuery);
  const firstResult = getGlobalSearchResults(rawQuery, 1)[0];
  return openGlobalSearchResult(firstResult);
}

function renderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.globalSearchResults || !els.globalSearchStatus) return;

  els.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    initSearchStatus();
    return;
  }

  if (!catalogSearch?.hasIndex?.()) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    els.globalSearchStatus.textContent = "עדיין אין אינדקס חיפוש. הרץ convert-catalogs מחדש כדי ליצור OCR בעברית וקובץ catalogs.search.js.";
    return;
  }

  const results = getGlobalSearchResults(rawQuery, 72);
  if (!results.length) {
    els.globalSearchResults.classList.remove("hidden");
    els.globalSearchResults.innerHTML = `
      <article class="search-empty">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(rawQuery)}”</strong>
        <p>נסה מספר דגם קצר יותר, חלק מהמילה, או הרץ OCR במצב <code>--ocr always</code> אם ה־PDF הוא סריקה כבדה.</p>
      </article>
    `;
    els.globalSearchStatus.textContent = "אין תוצאות מתאימות.";
    return;
  }

  els.globalSearchStatus.textContent = `נמצאו ${results.length} תוצאות. לחיצה פותחת את העמוד במקום הנכון בתצוגה מוגדלת.`;
  els.globalSearchResults.classList.remove("hidden");
  els.globalSearchResults.innerHTML = results.map((result) => `
    <article class="search-result-card">
      <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${result.page}">
        <span class="search-result-thumb-frame catalog-image-frame">
          <img class="search-result-thumb" src="${escapeHtml(result.thumb)}" alt="${escapeHtml(result.catalogTitle)} - עמוד ${result.page}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(result.thumb)} />
        </span>
        <span class="search-result-body">
          <strong>${escapeHtml(result.catalogTitle)}</strong>
          <span class="search-result-meta">עמוד ${result.page}</span>
          <span class="search-result-excerpt">${escapeHtml(result.excerpt || "התאמה לפי טקסט OCR בעמוד זה")}</span>
        </span>
      </button>
    </article>
  `).join("");

  els.globalSearchResults.querySelectorAll("[data-search-catalog]").forEach((button) => {
    button.addEventListener("click", () => {
      openGlobalSearchResult({ catalogId: button.dataset.searchCatalog, page: button.dataset.searchPage });
    });
  });
}

function fillCatalogSelect() {
  if (!catalogs.length) return;
  els.catalogSelect.innerHTML = catalogs.map((catalog) => (
    `<option value="${escapeHtml(catalog.id)}">${escapeHtml(catalog.title)}</option>`
  )).join("");
}


function clearDeferredPageThumbLoading() {
  window.clearTimeout(state.pageThumbLoadTimer);
  state.pageThumbLoadTimer = 0;
  state.pageThumbObserver?.disconnect?.();
  state.pageThumbObserver = null;
}

function loadDeferredPageThumb(img) {
  const src = img?.dataset?.src;
  if (!src || img.getAttribute("src") === src) return;
  setCatalogImageSource(img, src);
  img.removeAttribute("data-src");
  img.classList.add("loaded");
}

function activateDeferredPageThumbLoading() {
  if (!els.pageGrid) return;
  const pendingImages = Array.from(els.pageGrid.querySelectorAll("img.page-thumb[data-src]"));
  if (!pendingImages.length) return;

  if (!("IntersectionObserver" in window)) {
    pendingImages.forEach(loadDeferredPageThumb);
    return;
  }

  state.pageThumbObserver?.disconnect?.();
  state.pageThumbObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadDeferredPageThumb(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    root: null,
    rootMargin: "900px 0px",
    threshold: 0.01
  });

  pendingImages.forEach((img) => state.pageThumbObserver.observe(img));
}

function scheduleDeferredPageThumbLoading(delay = 0) {
  clearDeferredPageThumbLoading();
  state.pageThumbLoadTimer = window.setTimeout(() => {
    state.pageThumbLoadTimer = 0;
    activateDeferredPageThumbLoading();
  }, Math.max(0, delay));
}

function renderPageGrid() {
  if (!state.catalog) return;
  clearDeferredPageThumbLoading();

  const catalog = state.catalog;
  const cards = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    cards.push(`
      <article class="page-card">
        <button class="page-button" type="button" data-open-page="${page}">
          <div class="page-thumb-wrap">
            <img class="page-thumb" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
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
  els.pageGrid.innerHTML = cards.join("");

  els.pageGrid.querySelectorAll("[data-open-page]").forEach((button) => {
    button.addEventListener("click", () => openLightbox(Number(button.dataset.openPage)));
  });
}

function showCatalogDetail() {
  if (!els.catalogDetail) return;
  els.catalogDetail.classList.remove("hidden");
  els.catalogDetail.classList.add("in-view");
}

function scrollCatalogDetailIntoView() {
  if (!els.catalogDetail) return;
  requestAnimationFrame(() => {
    els.catalogDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderCatalogDetail() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  showCatalogDetail();
  els.catalogTitle.textContent = catalog.title;
  els.catalogDescription.textContent = catalog.description || "";
  els.catalogCategory.textContent = catalog.category || "קטלוג";
  els.catalogPages.textContent = `${catalog.pages} עמודים`;
  els.catalogSelect.value = catalog.id;
  setCatalogImageSource(els.catalogCoverPreview, catalogCoverSrc(catalog));
  els.catalogCoverPreview.loading = "lazy";
  els.catalogCoverPreview.decoding = "async";
  els.catalogCoverPreview.alt = `שער ${catalog.title}`;
  els.openViewerFromTop.disabled = catalog.pages < 1;
  renderPageGrid();
}

function preloadNeighbors() {
  if (!state.catalog || state.viewerMode !== "single") return;
  [state.page - 1, state.page + 1]
    .filter((page) => page >= 1 && page <= state.catalog.pages)
    .forEach((page) => {
      const img = new Image();
      const src = pageSrc(state.catalog, page);
      applyCatalogImageCrossOrigin(img, src);
      img.decoding = "async";
      img.fetchPriority = "low";
      img.src = src;
    });
}

function updateHash() {
  if (!state.catalog) {
    history.replaceState(null, "", "#catalogs");
    return;
  }

  let hash = `#catalog/${state.catalog.id}`;
  if (state.lightboxOpen) {
    hash += `/page/${state.page}`;
    if (state.viewerMode === "scroll") hash += "/scroll";
  }
  history.replaceState(null, "", hash);
}

function getPointerList() {
  return Array.from(state.pointers.values());
}

function pointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampViewerZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_VIEWER_ZOOM;
  return clampValue(numeric, MIN_VIEWER_ZOOM, MAX_VIEWER_ZOOM);
}

function clampSinglePan() {
  const image = els.lightboxImage;
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !stage) return;

  const imageWidth = image.naturalWidth * state.fitScale * state.zoom;
  const imageHeight = image.naturalHeight * state.fitScale * state.zoom;
  const overflowX = Math.max(0, (imageWidth - stage.clientWidth) / 2);
  const overflowY = Math.max(0, (imageHeight - stage.clientHeight) / 2);

  if (overflowX <= 1) state.panX = 0;
  else state.panX = clampValue(state.panX, -overflowX, overflowX);

  if (overflowY <= 1) state.panY = 0;
  else state.panY = clampValue(state.panY, -overflowY, overflowY);
}

function getScrollZoomMetrics() {
  const container = els.lightboxScrollView;
  const content = els.lightboxScrollPages;
  if (!container || !content) return null;

  return {
    container,
    content,
    viewportWidth: container.clientWidth,
    viewportHeight: container.clientHeight,
    contentWidth: content.offsetWidth || content.scrollWidth || 0,
    contentHeight: content.offsetHeight || content.scrollHeight || 0,
    baseLeft: content.offsetLeft - container.scrollLeft,
    baseTop: content.offsetTop - container.scrollTop
  };
}

function clampScrollPan() {
  const metrics = getScrollZoomMetrics();
  if (!metrics || !metrics.contentWidth || !metrics.contentHeight) return;

  const scaledWidth = metrics.contentWidth * state.zoom;
  const scaledHeight = metrics.contentHeight * state.zoom;

  if (scaledWidth <= metrics.viewportWidth) {
    state.panX = -metrics.baseLeft + (metrics.viewportWidth - scaledWidth) / 2;
  } else {
    state.panX = clampValue(
      state.panX,
      metrics.viewportWidth - metrics.baseLeft - scaledWidth,
      -metrics.baseLeft
    );
  }

  if (scaledHeight <= metrics.viewportHeight) {
    state.panY = -metrics.baseTop + (metrics.viewportHeight - scaledHeight) / 2;
  } else {
    state.panY = clampValue(
      state.panY,
      metrics.viewportHeight - metrics.baseTop - scaledHeight,
      -metrics.baseTop
    );
  }
}

function resetImagePosition() {
  state.panX = 0;
  state.panY = 0;
}

function applySingleZoom() {
  const image = els.lightboxImage;
  const frame = els.lightboxImageFrame;
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !frame || !stage) return;

  const availableWidth = Math.max(260, stage.clientWidth - 18);
  const availableHeight = Math.max(260, stage.clientHeight - 18);
  state.fitScale = Math.min(
    availableWidth / image.naturalWidth,
    availableHeight / image.naturalHeight
  );

  const fitWidth = Math.max(220, Math.round(image.naturalWidth * state.fitScale));
  frame.style.width = `${fitWidth}px`;
  frame.style.height = "auto";
  image.style.width = "100%";
  image.style.height = "auto";

  if (state.zoom <= 1.001) resetImagePosition();
  clampSinglePan();
  frame.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

function applyScrollZoom() {
  const content = els.lightboxScrollPages;
  if (!content) return;

  if (state.zoom <= 1.001) {
    resetImagePosition();
    content.style.transform = "";
    return;
  }

  clampScrollPan();
  content.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

function applyZoom() {
  if (state.viewerMode === "scroll") applyScrollZoom();
  else applySingleZoom();

  els.lightbox?.classList.toggle("is-zoomed", state.zoom > 1.01);
}

function showThumbsTemporarily(delay = 2600) {
  if (!els.lightbox) return;
  window.clearTimeout(state.thumbsHideTimer);
  els.lightbox.classList.add("show-thumbs");
  if (delay > 0) {
    state.thumbsHideTimer = window.setTimeout(() => {
      els.lightbox.classList.remove("show-thumbs");
    }, delay);
  }
}

function keepThumbsOpen() {
  window.clearTimeout(state.thumbsHideTimer);
  els.lightbox?.classList.add("show-thumbs");
}

function scheduleThumbsClose() {
  window.clearTimeout(state.thumbsHideTimer);
  state.thumbsHideTimer = window.setTimeout(() => {
    els.lightbox?.classList.remove("show-thumbs");
  }, 420);
}

function showTopUiTemporarily(delay = 2200) {
  if (!els.lightbox) return;
  window.clearTimeout(state.uiHideTimer);
  els.lightbox.classList.add("show-ui");
  if (delay > 0) {
    state.uiHideTimer = window.setTimeout(() => {
      els.lightbox.classList.remove("show-ui");
    }, delay);
  }
}

function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}

function isBrowserFullscreenActive() {
  return Boolean(getBrowserFullscreenElement());
}

function isBrowserFullscreenSupported() {
  const root = document.documentElement;
  return Boolean(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled ||
    root?.requestFullscreen ||
    root?.webkitRequestFullscreen ||
    root?.mozRequestFullScreen ||
    root?.msRequestFullscreen
  );
}

function requestBrowserFullscreen() {
  const root = document.documentElement;
  const request = root?.requestFullscreen || root?.webkitRequestFullscreen || root?.mozRequestFullScreen || root?.msRequestFullscreen;
  if (!request) return Promise.reject(new Error("fullscreen-unsupported"));
  const result = request.call(root);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function exitBrowserFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return Promise.reject(new Error("fullscreen-exit-unsupported"));
  const result = exit.call(document);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function syncFullscreenButtonUi() {
  const button = els.fullscreenToggle;
  if (!button) return;

  const isActive = isBrowserFullscreenActive();
  const isSupported = isBrowserFullscreenSupported();
  const label = isActive ? "יציאה ממסך מלא" : "כניסה למסך מלא";

  button.dataset.fullscreenActive = isActive ? "true" : "false";
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
  button.setAttribute("aria-label", label);
  setTooltipText(button, label, { updateDefault: true });
  button.disabled = !isSupported && !isActive;
  button.classList.toggle("hidden", !isSupported && !isActive);
}

async function toggleBrowserFullscreen() {
  const button = els.fullscreenToggle;
  const wasActive = isBrowserFullscreenActive();

  try {
    if (wasActive) {
      await exitBrowserFullscreen();
    } else {
      if (!isBrowserFullscreenSupported()) throw new Error("fullscreen-unsupported");
      await requestBrowserFullscreen();
    }
  } catch (error) {
    const message = wasActive ? "לא הצלחתי לצאת ממסך מלא" : "הדפדפן חסם מסך מלא";
    console.warn("Fullscreen toggle failed", error);
    flashActionButton(button, message);
  } finally {
    syncFullscreenButtonUi();
    showTopUiTemporarily(1400);
  }
}


function setViewerLoading(isLoading) {
  els.viewerLoading.classList.toggle("hidden", !isLoading);
}


function hideLightboxFloatingPreview() {
  els.lightboxFloatingPreview?.classList.remove("visible");
}

function normalizeWheelDeltaToPixels(delta, deltaMode, pageSize = 0) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  if (deltaMode === lineMode) return delta * 36;
  if (deltaMode === pageMode) return delta * Math.max(1, pageSize);
  return delta;
}

function handleLightboxThumbsWheel(event) {
  if (state.viewerMode !== "single" || !els.lightboxThumbs) return;

  const scroller = els.lightboxThumbs;
  const hasHorizontalOverflow = scroller.scrollWidth > scroller.clientWidth + 1;
  const isVerticalWheel = Math.abs(event.deltaY || 0) >= Math.abs(event.deltaX || 0);
  if (!hasHorizontalOverflow || !isVerticalWheel || !event.deltaY) return;

  event.preventDefault();
  keepThumbsOpen();

  const delta = normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, scroller.clientWidth);
  scroller.scrollLeft -= delta;
}

function positionLightboxFloatingPreview(button) {
  const preview = els.lightboxFloatingPreview;
  if (!preview || !button) return;

  const buttonRect = button.getBoundingClientRect();

  if (state.viewerMode === "scroll") {
    const previewHeight = Math.max(240, preview.offsetHeight || Math.min(620, window.innerHeight * 0.74));
    const railRect = button.closest?.(".lightbox-page-rail")?.getBoundingClientRect?.();
    const centerY = Math.min(
      window.innerHeight - (previewHeight / 2) - 14,
      Math.max((previewHeight / 2) + 14, buttonRect.top + (buttonRect.height / 2))
    );
    const right = Math.max(12, window.innerWidth - (railRect?.left ?? buttonRect.left) + 12);

    preview.style.left = "auto";
    preview.style.bottom = "auto";
    preview.style.right = `${right}px`;
    preview.style.top = `${centerY}px`;
    return;
  }

  const previewWidth = Math.max(240, preview.offsetWidth || Math.min(420, window.innerWidth * 0.34));
  const centerX = Math.min(
    window.innerWidth - (previewWidth / 2) - 14,
    Math.max((previewWidth / 2) + 14, buttonRect.left + (buttonRect.width / 2))
  );
  const bottom = Math.max(122, window.innerHeight - buttonRect.top + 12);

  preview.style.right = "auto";
  preview.style.top = "auto";
  preview.style.left = `${centerX}px`;
  preview.style.bottom = `${bottom}px`;
}

function showLightboxFloatingPreview(button) {
  if (!state.catalog || !button || !els.lightboxFloatingPreview || !els.lightboxFloatingPreviewImage) return;

  const page = clampPage(button.dataset.page, state.catalog);
  const src = button.dataset.previewSrc || pageSrc(state.catalog, page);
  setCatalogImageSource(els.lightboxFloatingPreviewImage, src);
  els.lightboxFloatingPreviewImage.alt = `${state.catalog.title} - עמוד ${page}`;
  if (els.lightboxFloatingPreviewPage) els.lightboxFloatingPreviewPage.textContent = `עמוד ${page}`;
  els.lightboxFloatingPreview.classList.add("visible");
  positionLightboxFloatingPreview(button);
}

function updateLightboxThumbs(options = {}) {
  const { scrollIntoView = true } = options;

  els.lightboxThumbs?.querySelectorAll(".lightbox-thumb").forEach((button) => {
    const active = Number(button.dataset.page) === state.page;
    button.classList.toggle("active", active);
    if (active && scrollIntoView && state.viewerMode === "single") {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });

  els.lightboxPageThumbs?.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    const active = Number(button.dataset.page) === state.page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");

    if (active && scrollIntoView && state.viewerMode === "scroll") {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });
}

function renderLightboxThumbs() {
  if (!state.catalog || !els.lightboxThumbs) return;
  const catalog = state.catalog;
  const thumbs = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    thumbs.push(`
      <button class="lightbox-thumb catalog-image-frame ${page === state.page ? "active" : ""}" type="button" data-page="${page}" data-preview-src="${escapeHtml(thumbSrc(catalog, page))}" aria-label="מעבר לעמוד ${page}">
        <img src="${escapeHtml(thumbSrc(catalog, page))}" alt="" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
      </button>
    `);
  }
  els.lightboxThumbs.innerHTML = thumbs.join("");
  els.lightboxThumbs.querySelectorAll(".lightbox-thumb").forEach((button) => {
    button.addEventListener("pointerenter", () => showLightboxFloatingPreview(button));
    button.addEventListener("pointerleave", hideLightboxFloatingPreview);
    button.addEventListener("focus", () => showLightboxFloatingPreview(button));
    button.addEventListener("blur", hideLightboxFloatingPreview);
    button.addEventListener("click", () => {
      hideLightboxFloatingPreview();
      setLightboxPage(Number(button.dataset.page));
    });
  });
}

function renderLightboxScrollPages() {
  if (!state.catalog || !els.lightboxScrollPages) return;
  disconnectLightboxScrollImageLoading();
  const catalog = state.catalog;
  const pages = [];

  for (let page = 1; page <= catalog.pages; page += 1) {
    const rawSrc = pageSrc(catalog, page);
    const src = escapeHtml(rawSrc);
    const crossOriginAttribute = catalogImageCrossOriginAttribute(rawSrc);
    const eager = Math.abs(page - state.page) <= 1;
    const imageAttributes = eager
      ? `src="${src}" loading="eager" fetchpriority="${page === state.page ? "high" : "auto"}"${crossOriginAttribute}`
      : `src="${TRANSPARENT_PIXEL}" data-src="${src}" loading="lazy" fetchpriority="low"${crossOriginAttribute}`;
    pages.push(`
      <figure class="lightbox-scroll-page-frame catalog-image-frame" id="lightbox-scroll-page-${page}" data-page="${page}"${pageAspectStyle(catalog, page)}>
        <img class="lightbox-scroll-image${eager ? " loaded" : ""}" ${imageAttributes} alt="${escapeHtml(catalog.title)} - עמוד ${page}" decoding="async" />
      </figure>
    `);
  }

  els.lightboxScrollPages.innerHTML = pages.join("");
  activateLightboxScrollImageLoading();
}

function renderLightboxPageRail() {
  if (!state.catalog || !els.lightboxPageThumbs) return;
  const catalog = state.catalog;
  const thumbs = [];

  for (let page = 1; page <= catalog.pages; page += 1) {
    const thumb = escapeHtml(thumbSrc(catalog, page));
    const fullPage = thumb;
    thumbs.push(`
      <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === state.page ? " active" : ""}" type="button" data-page="${page}" data-preview-src="${fullPage}" aria-label="מעבר לעמוד ${page}"${page === state.page ? ' aria-current="page"' : ""}>
        <span class="lightbox-page-thumb-image-wrap">
          <img src="${thumb}" alt="" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
        </span>
        <span class="lightbox-page-thumb-number">${page}</span>
      </button>
    `);
  }

  els.lightboxPageThumbs.innerHTML = thumbs.join("");
  els.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    button.addEventListener("pointerenter", () => showLightboxFloatingPreview(button));
    button.addEventListener("pointerleave", hideLightboxFloatingPreview);
    button.addEventListener("focus", () => showLightboxFloatingPreview(button));
    button.addEventListener("blur", hideLightboxFloatingPreview);
    button.addEventListener("click", () => {
      hideLightboxFloatingPreview();
      showPageRailTemporarily(1800);
      setLightboxPage(Number(button.dataset.page), { smooth: true, hit: true });
    });
  });
}

function syncViewerModeUi() {
  const isScrollMode = state.viewerMode === "scroll";
  els.lightbox?.classList.toggle("mode-scroll", isScrollMode);
  els.lightbox?.classList.toggle("mode-single", !isScrollMode);

  if (els.viewerModeToggle) {
    const label = isScrollMode ? "מעבר לתצוגת תמונה אחת עם חיצים בצדדים" : "מעבר לתצוגת כל העמודים בגלילה מלמעלה למטה";
    els.viewerModeToggle.dataset.viewerMode = isScrollMode ? "scroll" : "single";
    els.viewerModeToggle.setAttribute("aria-label", label);
    setTooltipText(els.viewerModeToggle, isScrollMode ? "תצוגה לצדדים" : "תצוגת גלילה", { updateDefault: true });
  }

  syncFullscreenButtonUi();

  if (els.lightboxModeLabel) {
    els.lightboxModeLabel.textContent = isScrollMode ? "כניסה לקטלוג" : "תצוגת מסך מלא";
  }
}

function setLightboxMode(mode, options = {}) {
  if (!state.catalog) return;
  const nextMode = mode === "scroll" ? "scroll" : "single";
  const wasScrollMode = state.viewerMode === "scroll";
  const pageToKeep = state.page;

  if (nextMode === state.viewerMode) {
    syncViewerModeUi();
    if (nextMode === "scroll" && options.scrollToPage !== false) {
      scrollToLightboxScrollPage(pageToKeep, { smooth: false, hit: false });
    }
    return;
  }

  hideLightboxFloatingPreview();
  state.viewerMode = nextMode;
  state.zoom = 1;
  resetImagePosition();
  state.pointers.clear();
  els.lightbox?.classList.remove("show-thumbs", "show-page-rail");
  syncViewerModeUi();
  updateLightbox();

  if (nextMode === "scroll") {
    requestAnimationFrame(() => scrollToLightboxScrollPage(pageToKeep, { smooth: false, hit: false }));
  } else if (wasScrollMode) {
    showThumbsTemporarily(1300);
  }
}

function toggleLightboxMode() {
  setLightboxMode(state.viewerMode === "scroll" ? "single" : "scroll");
}

function hasHoverPointer() {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function isTouchLikePointer(event) {
  return event?.pointerType === "touch" || event?.pointerType === "pen";
}

function markTouchLikeRailInput(event) {
  if (isTouchLikePointer(event)) {
    state.lastTouchLikeRailInputAt = Date.now();
  }
}

function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - state.lastTouchLikeRailInputAt < timeout;
}

function shouldUsePageRailHover(event = null) {
  if (!hasHoverPointer()) return false;
  if (isTouchLikePointer(event) || hasRecentTouchLikeRailInput()) return false;
  return true;
}

function showPageRailTemporarily(delay = 2600) {
  if (!els.lightbox || state.viewerMode !== "scroll") return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox.classList.add("show-page-rail");
  if (delay > 0) {
    state.pageRailHideTimer = window.setTimeout(() => {
      els.lightbox?.classList.remove("show-page-rail");
    }, delay);
  }
}

function keepPageRailOpen() {
  if (state.viewerMode !== "scroll") return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox?.classList.add("show-page-rail");
}

function schedulePageRailClose(event = null) {
  if (!shouldUsePageRailHover(event)) return;
  window.clearTimeout(state.pageRailHideTimer);
  state.pageRailHideTimer = window.setTimeout(() => {
    els.lightbox?.classList.remove("show-page-rail");
  }, 420);
}

function openPageRailFromTouch(event) {
  if (!isTouchLikePointer(event)) return;
  markTouchLikeRailInput(event);
  event.preventDefault?.();
  keepPageRailOpen();
}

function openPageRailFromHotspot(event = null) {
  if (hasRecentTouchLikeRailInput()) {
    keepPageRailOpen();
    return;
  }
  showPageRailTemporarily(shouldUsePageRailHover(event) ? 2600 : 0);
}

function showPageRailFromHover(event = null) {
  if (shouldUsePageRailHover(event)) showPageRailTemporarily(0);
}

function keepPageRailOpenFromHover(event = null) {
  if (shouldUsePageRailHover(event)) keepPageRailOpen();
}

function handlePageRailPointerOutside(event) {
  if (!els.lightbox || state.viewerMode !== "scroll") return;
  if (!els.lightbox.classList.contains("show-page-rail")) return;

  const target = event.target;
  if (els.lightboxPageRail?.contains(target) || els.lightboxSideHotspot?.contains(target)) return;
  if (!isTouchLikePointer(event) && shouldUsePageRailHover(event)) return;

  window.clearTimeout(state.pageRailHideTimer);
  hideLightboxFloatingPreview();
  els.lightbox.classList.remove("show-page-rail");
}

function scrollToLightboxScrollPage(page, options = {}) {
  if (!state.catalog || !els.lightboxScrollView) return;
  const { smooth = true, hit = false } = options;
  const targetPage = clampPage(page, state.catalog);
  const target = document.getElementById(`lightbox-scroll-page-${targetPage}`);
  if (!target) return;
  ensureLightboxScrollPageLoaded(targetPage, 2);

  const containerTop = els.lightboxScrollView.getBoundingClientRect().top;
  const targetTop = target.getBoundingClientRect().top - containerTop + els.lightboxScrollView.scrollTop;
  els.lightboxScrollView.scrollTo({ top: Math.max(0, targetTop - 10), behavior: smooth ? "smooth" : "auto" });
  updateLightboxThumbs({ scrollIntoView: true });

  if (hit) {
    target.classList.add("lightbox-scroll-page-hit");
    window.setTimeout(() => target.classList.remove("lightbox-scroll-page-hit"), 1500);
  }
}

function findCurrentLightboxScrollPage() {
  if (!state.catalog || !els.lightboxScrollView || state.viewerMode !== "scroll") return;
  const frames = Array.from(els.lightboxScrollPages?.querySelectorAll(".lightbox-scroll-page-frame") || []);
  if (!frames.length) return;

  const containerRect = els.lightboxScrollView.getBoundingClientRect();
  const anchorY = containerRect.top + Math.max(110, els.lightboxScrollView.clientHeight * 0.32);
  let closestPage = state.page || 1;
  let closestDistance = Number.POSITIVE_INFINITY;

  frames.forEach((frame) => {
    const rect = frame.getBoundingClientRect();
    const page = Number(frame.dataset.page || 0);
    if (!Number.isFinite(page) || page < 1) return;

    if (rect.top <= anchorY && rect.bottom >= anchorY) {
      closestPage = page;
      closestDistance = -1;
      return;
    }

    if (closestDistance >= 0) {
      const distance = Math.min(Math.abs(rect.top - anchorY), Math.abs(rect.bottom - anchorY));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = page;
      }
    }
  });

  if (closestPage !== state.page) {
    setLightboxPage(closestPage, { syncScroll: false, keepZoom: true });
  }
}

function scheduleLightboxScrollPageUpdate() {
  if (state.lightboxScrollRaf || state.viewerMode !== "scroll") return;
  state.lightboxScrollRaf = window.requestAnimationFrame(() => {
    state.lightboxScrollRaf = 0;
    findCurrentLightboxScrollPage();
  });
}

function syncLightboxProgress(page = state.page, catalog = state.catalog) {
  if (!els.lightboxProgress || !catalog) return;
  const totalPages = Math.max(1, Number(catalog.pages || 1));
  const currentPage = clampPage(page, catalog);
  const ratio = totalPages <= 1 ? 1 : currentPage / totalPages;
  const clampedRatio = Math.min(1, Math.max(0, ratio));

  els.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio));
  els.lightboxProgress.setAttribute("aria-valuemin", "1");
  els.lightboxProgress.setAttribute("aria-valuemax", String(totalPages));
  els.lightboxProgress.setAttribute("aria-valuenow", String(currentPage));
  els.lightboxProgress.setAttribute("title", `עמוד ${currentPage} מתוך ${totalPages}`);
}

function updateLightbox() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  state.page = clampPage(state.page, catalog);
  syncViewerModeUi();

  els.lightboxTitle.textContent = catalog.title;
  els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${catalog.pages}`;
  syncLightboxProgress(state.page, catalog);
  initLightboxSearchStatus();
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= catalog.pages;

  if (state.viewerMode === "scroll") {
    setViewerLoading(false);
    ensureLightboxScrollPageLoaded(state.page, 1);
    applyZoom();
    updateLightboxThumbs();
    updateHash();
    rememberCurrentCatalogView();
    return;
  }

  const src = pageSrc(catalog, state.page);
  const currentSrc = els.lightboxImage.getAttribute("src");
  if (currentSrc !== src) {
    setViewerLoading(true);
    els.lightboxImage.removeAttribute("src");
    els.lightboxImage.alt = `${catalog.title} - עמוד ${state.page}`;
    els.lightboxImage.decoding = "async";
    els.lightboxImage.fetchPriority = "high";
    requestAnimationFrame(() => {
      setCatalogImageSource(els.lightboxImage, src);
    });
  } else {
    applyZoom();
  }

  updateLightboxThumbs();
  preloadNeighbors();
  updateHash();
  rememberCurrentCatalogView();
}

function openLightbox(page = 1, options = {}) {
  if (!state.catalog) return;
  const mode = typeof options === "string" ? options : options.mode;
  state.viewerMode = mode === "scroll" ? "scroll" : "single";
  state.page = clampPage(page, state.catalog);
  state.zoom = 1;
  resetImagePosition();
  state.pointers.clear();
  state.lightboxOpen = true;
  els.lightbox.classList.remove("hidden");
  els.lightbox.classList.remove("show-thumbs", "show-ui", "show-page-rail");
  document.body.classList.add("no-scroll");
  renderLightboxThumbs();
  renderLightboxScrollPages();
  renderLightboxPageRail();
  renderLightboxCatalogMenu();
  resetLightboxSearch();
  syncViewerModeUi();
  showTopUiTemporarily(1700);
  updateLightbox();

  if (state.viewerMode === "scroll") {
    requestAnimationFrame(() => scrollToLightboxScrollPage(state.page, { smooth: false, hit: false }));
  }
}

function closeLightbox() {
  state.lightboxOpen = false;
  els.lightbox.classList.add("hidden");
  els.lightbox.classList.remove("show-thumbs", "show-ui", "show-page-rail", "mode-scroll", "mode-single");
  hideLightboxFloatingPreview();
  window.clearTimeout(state.thumbsHideTimer);
  window.clearTimeout(state.uiHideTimer);
  window.clearTimeout(state.pageRailHideTimer);
  if (state.lightboxScrollRaf) window.cancelAnimationFrame(state.lightboxScrollRaf);
  state.lightboxScrollRaf = 0;
  disconnectLightboxScrollImageLoading();
  document.body.classList.remove("no-scroll");
  scheduleDeferredPageThumbLoading(0);
  updateHash();
}

function setLightboxPage(page, options = {}) {
  if (!state.catalog) return;
  const { syncScroll = state.viewerMode === "scroll", smooth = true, hit = false, keepZoom = false } = options;
  const nextPage = clampPage(page, state.catalog);
  if (nextPage !== state.page) {
    hideLightboxFloatingPreview();
    if (!keepZoom) {
      state.zoom = 1;
      resetImagePosition();
      state.pointers.clear();
    }
  }
  state.page = nextPage;
  updateLightbox();

  if (syncScroll && state.viewerMode === "scroll") {
    scrollToLightboxScrollPage(nextPage, { smooth, hit });
  }
}

function moveLightbox(delta) {
  if (!state.catalog) return;
  setLightboxPage(state.page + delta, { smooth: true, hit: state.viewerMode === "scroll" });
}

function getDefaultZoomFocalPoint() {
  const surface = state.viewerMode === "scroll" ? els.lightboxScrollView : els.stageCanvas;
  const rect = surface?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function adjustSinglePanForZoom(nextZoom, focal) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !focal) return;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const contentX = (focal.x - centerX - state.panX) / currentZoom;
  const contentY = (focal.y - centerY - state.panY) / currentZoom;

  state.panX = focal.x - centerX - contentX * nextZoom;
  state.panY = focal.y - centerY - contentY * nextZoom;
}

function adjustScrollPanForZoom(nextZoom, focal) {
  const metrics = getScrollZoomMetrics();
  const rect = metrics?.container.getBoundingClientRect?.();
  if (!metrics || !rect || !focal) return;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const focalX = focal.x - rect.left;
  const focalY = focal.y - rect.top;
  const contentX = (focalX - metrics.baseLeft - state.panX) / currentZoom;
  const contentY = (focalY - metrics.baseTop - state.panY) / currentZoom;

  state.panX = focalX - metrics.baseLeft - contentX * nextZoom;
  state.panY = focalY - metrics.baseTop - contentY * nextZoom;
}

function adjustPanForZoom(nextZoom, focal) {
  if (state.viewerMode === "scroll") adjustScrollPanForZoom(nextZoom, focal);
  else adjustSinglePanForZoom(nextZoom, focal);
}

function getSingleContentPointFromClientPoint(clientX, clientY) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (clientX - centerX - state.panX) / currentZoom,
    y: (clientY - centerY - state.panY) / currentZoom
  };
}

function getScrollContentPointFromClientPoint(clientX, clientY) {
  const metrics = getScrollZoomMetrics();
  const rect = metrics?.container.getBoundingClientRect?.();
  if (!metrics || !rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = Math.max(MIN_VIEWER_ZOOM, state.zoom || MIN_VIEWER_ZOOM);
  const focalX = clientX - rect.left;
  const focalY = clientY - rect.top;

  return {
    x: (focalX - metrics.baseLeft - state.panX) / currentZoom,
    y: (focalY - metrics.baseTop - state.panY) / currentZoom
  };
}

function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return false;
  const zoom = clampViewerZoom(nextZoom);
  if (zoom <= 1.001) {
    setZoom(1, { showUi: false });
    return true;
  }

  state.zoom = zoom;
  state.panX = -point.x * zoom;
  state.panY = -point.y * zoom;
  applyZoom();
  return true;
}

function zoomScrollContentPointToViewportCenter(point, nextZoom) {
  const metrics = getScrollZoomMetrics();
  if (!metrics || !point) return false;
  const zoom = clampViewerZoom(nextZoom);
  if (zoom <= 1.001) {
    setZoom(1, { showUi: false });
    return true;
  }

  state.zoom = zoom;
  state.panX = metrics.viewportWidth / 2 - metrics.baseLeft - point.x * zoom;
  state.panY = metrics.viewportHeight / 2 - metrics.baseTop - point.y * zoom;
  applyZoom();
  scheduleLightboxScrollPageUpdate();
  return true;
}

function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  if (state.viewerMode === "scroll") {
    return zoomScrollContentPointToViewportCenter(
      getScrollContentPointFromClientPoint(clientX, clientY),
      nextZoom
    );
  }

  return zoomSingleContentPointToViewportCenter(
    getSingleContentPointFromClientPoint(clientX, clientY),
    nextZoom
  );
}

function setZoom(nextZoom, options = {}) {
  const { showUi = true, focalClientX = null, focalClientY = null } = options;
  const previousZoom = state.zoom;
  const zoom = clampViewerZoom(nextZoom);
  const hasFocal = Number.isFinite(focalClientX) && Number.isFinite(focalClientY);
  const focal = hasFocal
    ? { x: focalClientX, y: focalClientY }
    : getDefaultZoomFocalPoint();

  if (zoom <= 1.001) {
    state.zoom = MIN_VIEWER_ZOOM;
    resetImagePosition();
  } else {
    if (focal && Math.abs(zoom - previousZoom) > 0.001) {
      adjustPanForZoom(zoom, focal);
    }
    state.zoom = zoom;
  }

  applyZoom();
  if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
  if (showUi) showTopUiTemporarily(1600);
}

function toggleZoomAtPoint(clientX, clientY) {
  if (state.zoom > 1.01) {
    setZoom(1, { showUi: false });
    return;
  }

  if (!zoomClientPointToViewportCenter(2, clientX, clientY)) {
    setZoom(2, { showUi: false, focalClientX: clientX, focalClientY: clientY });
  }
}


function openCatalogPage(id, page = 1) {
  openCatalogInViewer(id, page, "scroll");
}

function openCatalog(id, options = {}) {
  const { scroll = false, openPage = null, viewerMode = "single" } = options;
  const catalog = catalogs.find((item) => item.id === id) || catalogs[0] || null;
  if (!catalog) return;

  state.catalog = catalog;
  state.page = 1;
  renderCatalogDetail();
  updateHash();

  if (scroll) {
    scrollCatalogDetailIntoView();
  }

  if (openPage != null) {
    openLightbox(openPage, { mode: viewerMode });
  } else {
    scheduleDeferredPageThumbLoading(scroll ? 520 : 0);
  }
}

function openCatalogInViewer(id, page = 1, mode = "single") {
  const catalog = catalogs.find((item) => item.id === id) || catalogs[0] || null;
  if (!catalog) return;

  state.catalog = catalog;
  state.page = clampPage(page, catalog);
  renderCatalogDetail();
  openLightbox(state.page, { mode });
}

function parseHash() {
  const pageMatch = location.hash.match(/^#catalog\/([a-z0-9-]+)\/page\/(\d+)(?:\/(scroll|single))?$/i);
  if (pageMatch) {
    return {
      id: pageMatch[1],
      page: Number(pageMatch[2]),
      lightbox: true,
      viewerMode: pageMatch[3] === "scroll" ? "scroll" : "single"
    };
  }

  const catalogMatch = location.hash.match(/^#catalog\/([a-z0-9-]+)$/i);
  if (catalogMatch) {
    return { id: catalogMatch[1], page: 1, lightbox: false };
  }

  return null;
}


function getZoomSurfaceName(surface) {
  if (surface === els.lightboxScrollView) return "scroll";
  if (surface === els.stageCanvas) return "single";
  return "";
}

function isActiveZoomSurface(surface) {
  return state.viewerMode === getZoomSurfaceName(surface);
}

function startPointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;

  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.zoom > 1.01 || state.pointers.size >= 2 || state.viewerMode === "single") {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
  } else if (pointers.length === 2) {
    const [first, second] = pointers;
    const mid = pointerMidpoint(first, second);
    state.pinchStartDistance = Math.max(1, pointerDistance(first, second));
    state.pinchStartZoom = state.zoom;
    state.pinchLastMidX = mid.x;
    state.pinchLastMidY = mid.y;
    event.preventDefault();
  }
}

function movePointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget) || !state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const pointers = getPointerList();

  if (pointers.length >= 2) {
    event.preventDefault();
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const mid = pointerMidpoint(first, second);
    state.panX += mid.x - state.pinchLastMidX;
    state.panY += mid.y - state.pinchLastMidY;
    state.pinchLastMidX = mid.x;
    state.pinchLastMidY = mid.y;
    setZoom(state.pinchStartZoom * (distance / state.pinchStartDistance), {
      showUi: false,
      focalClientX: mid.x,
      focalClientY: mid.y
    });
    return;
  }

  if (pointers.length === 1 && state.zoom > 1.01) {
    event.preventDefault();
    state.panX = state.dragStartPanX + (event.clientX - state.dragStartX);
    state.panY = state.dragStartPanY + (event.clientY - state.dragStartY);
    applyZoom();
    if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
  }
}

function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return false;
  if (state.pointers.size > 0) return false;

  const moved = Math.hypot(event.clientX - startedX, event.clientY - startedY);
  if (moved > TAP_MOVE_TOLERANCE) {
    state.lastTapAt = 0;
    return false;
  }

  const now = Date.now();
  const surface = getZoomSurfaceName(event.currentTarget);
  const closeToLastTap = Math.hypot(event.clientX - state.lastTapX, event.clientY - state.lastTapY) <= DOUBLE_TAP_DISTANCE;
  const isDoubleTap =
    surface === state.lastTapSurface &&
    now - state.lastTapAt <= DOUBLE_TAP_DELAY &&
    closeToLastTap;

  state.lastTapAt = now;
  state.lastTapX = event.clientX;
  state.lastTapY = event.clientY;
  state.lastTapSurface = surface;

  if (!isDoubleTap) return false;

  event.preventDefault();
  state.lastTapAt = 0;
  state.suppressNextDblClickUntil = now + 550;
  toggleZoomAtPoint(event.clientX, event.clientY);
  return true;
}

function endPointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget) || !state.pointers.has(event.pointerId)) return;
  const startedX = state.dragStartX;
  const startedY = state.dragStartY;
  state.pointers.delete(event.pointerId);

  const handledDoubleTap = handlePotentialDoubleTap(event, startedX, startedY);

  if (!handledDoubleTap && state.viewerMode === "single" && state.pointers.size === 0 && state.zoom <= 1.01) {
    const dx = event.clientX - startedX;
    const dy = event.clientY - startedY;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      // In the RTL catalog viewer, a left-to-right swipe should advance to the next page.
      if (dx > 0) moveLightbox(1);
      else moveLightbox(-1);
    }
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    const only = pointers[0];
    state.dragStartX = only.x;
    state.dragStartY = only.y;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
  }
}

function cancelPointerInteraction(event) {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.delete(event.pointerId);
}

function getWheelZoomFactor(event) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  const delta = normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, event.currentTarget?.clientHeight || 0);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return 1;

  // Trackpad pinch is delivered by Chromium/Edge as a high-frequency ctrl+wheel
  // stream with pixel deltas. Use a gesture-like curve so it reacts closer to
  // a real two-finger touch pinch, while capping one event so a mouse wheel
  // cannot jump wildly across the whole zoom range.
  const speed = event.deltaMode === lineMode ? 0.0065 : event.deltaMode === pageMode ? 0.0035 : 0.011;
  const maxStep = Math.log(2.35);
  return Math.exp(clampValue(-delta * speed, -maxStep, maxStep));
}

function handleZoomSurfaceWheel(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const factor = getWheelZoomFactor(event);
    if (factor === 1) return;
    setZoom(state.zoom * factor, {
      showUi: false,
      focalClientX: event.clientX,
      focalClientY: event.clientY
    });
    return;
  }

  if (state.zoom > 1.01) {
    event.preventDefault();
    state.panX -= normalizeWheelDeltaToPixels(event.deltaX, event.deltaMode, event.currentTarget.clientWidth);
    state.panY -= normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, event.currentTarget.clientHeight);
    applyZoom();
    if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
  }
}

function handleZoomSurfaceDoubleClick(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;
  if (Date.now() < state.suppressNextDblClickUntil) return;

  event.preventDefault();
  toggleZoomAtPoint(event.clientX, event.clientY);
}

function attachZoomSurfaceGestures(surface) {
  if (!surface) return;
  surface.addEventListener("pointerdown", startPointerInteraction);
  surface.addEventListener("pointermove", movePointerInteraction);
  surface.addEventListener("pointerup", endPointerInteraction);
  surface.addEventListener("pointercancel", cancelPointerInteraction);
  surface.addEventListener("wheel", handleZoomSurfaceWheel, { passive: false });
  surface.addEventListener("dblclick", handleZoomSurfaceDoubleClick);
}



function attachViewerGestures() {
  attachZoomSurfaceGestures(els.stageCanvas);
  attachZoomSurfaceGestures(els.lightboxScrollView);
}

function attachEvents() {
  els.globalSearchInput?.addEventListener("input", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("focus", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("click", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitGlobalSearch();
  });
  els.globalSearchClear?.addEventListener("click", () => {
    els.globalSearchInput.value = "";
    els.globalSearchInput.focus();
    renderSearchResults("");
  });

  els.lastViewCard?.addEventListener("click", continueLastCatalogView);

  els.lightboxSearchInput?.addEventListener("input", () => renderLightboxSearchResults(els.lightboxSearchInput.value));
  els.lightboxSearchInput?.addEventListener("focus", () => {
    showTopUiTemporarily(0);
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  });
  els.lightboxSearchInput?.addEventListener("click", () => {
    showTopUiTemporarily(0);
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  });
  els.lightboxSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitLightboxSearch();
  });
  els.lightboxSearchClear?.addEventListener("click", () => {
    els.lightboxSearchInput.value = "";
    els.lightboxSearchInput.focus();
    renderLightboxSearchResults("");
    showTopUiTemporarily(0);
  });

  els.lightboxSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxCatalogMenu();
    const isOpen = !els.lightboxSearchScopeMenu?.classList.contains("hidden");
    els.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen);
    els.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightboxSearchScope(button.dataset.lightboxSearchScope);
      showTopUiTemporarily(0);
      els.lightboxSearchInput?.focus();
    });
  });
  els.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxSearchScopeMenu();
    renderLightboxCatalogMenu();
    const isOpen = !els.lightboxCatalogMenu?.classList.contains("hidden");
    els.lightboxCatalogMenu?.classList.toggle("hidden", isOpen);
    els.lightboxCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxCatalogMenu?.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", (event) => {
    if (els.lightboxSearchScopeMenu?.contains(event.target) || els.lightboxSearchScopeToggle?.contains(event.target)) return;
    if (els.lightboxCatalogMenu?.contains(event.target) || els.lightboxCatalogMenuToggle?.contains(event.target)) return;
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
  });

  els.catalogSelect?.addEventListener("change", () => openCatalog(els.catalogSelect.value));
  els.openViewerFromTop?.addEventListener("click", () => openLightbox(1));
  els.catalogCoverOpenViewer?.addEventListener("click", () => openLightbox(1));
  els.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  els.closeLightbox?.addEventListener("click", closeLightbox);
  els.lightboxScreenshot?.addEventListener("click", () => downloadCurrentLightboxImage());
  els.lightboxCopyLink?.addEventListener("click", () => copyCurrentLightboxLink());
  els.lightboxBackdrop?.addEventListener("click", closeLightbox);
  els.viewerModeToggle?.addEventListener("click", toggleLightboxMode);
  els.fullscreenToggle?.addEventListener("click", toggleBrowserFullscreen);
  els.prevPageBtn?.addEventListener("click", () => moveLightbox(-1));
  els.nextPageBtn?.addEventListener("click", () => moveLightbox(1));
  els.zoomInBtn?.addEventListener("click", () => setZoom(state.zoom + 0.2));
  els.zoomOutBtn?.addEventListener("click", () => setZoom(state.zoom - 0.2));
  els.fitBtn?.addEventListener("click", () => setZoom(1));

  attachViewerGestures();

  [els.prevPageBtn, els.nextPageBtn, els.thumbsHotspot].forEach((el) => {
    el?.addEventListener("mouseenter", () => showThumbsTemporarily(0));
    el?.addEventListener("mouseleave", scheduleThumbsClose);
    el?.addEventListener("focus", () => showThumbsTemporarily(0));
    el?.addEventListener("blur", scheduleThumbsClose);
  });

  els.lightboxThumbs?.addEventListener("mouseenter", keepThumbsOpen);
  els.lightboxThumbs?.addEventListener("wheel", handleLightboxThumbsWheel, { passive: false });
  els.lightboxThumbs?.addEventListener("mouseleave", () => {
    hideLightboxFloatingPreview();
    scheduleThumbsClose();
  });

  els.lightboxSideHotspot?.addEventListener("pointerdown", openPageRailFromTouch, { passive: false });
  els.lightboxSideHotspot?.addEventListener("mouseenter", showPageRailFromHover);
  els.lightboxSideHotspot?.addEventListener("mouseleave", schedulePageRailClose);
  els.lightboxSideHotspot?.addEventListener("click", openPageRailFromHotspot);
  els.lightboxPageRail?.addEventListener("pointerdown", markTouchLikeRailInput);
  els.lightboxPageRail?.addEventListener("mouseenter", keepPageRailOpenFromHover);
  els.lightboxPageRail?.addEventListener("mouseleave", (event) => {
    hideLightboxFloatingPreview();
    schedulePageRailClose(event);
  });
  els.lightbox?.addEventListener("pointerdown", handlePageRailPointerOutside);
  els.lightboxPageRail?.addEventListener("focusin", keepPageRailOpen);
  els.lightboxPageRail?.addEventListener("focusout", schedulePageRailClose);
  els.lightboxScrollView?.addEventListener("scroll", scheduleLightboxScrollPageUpdate, { passive: true });

  els.topHotspot?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseleave", () => {
    window.clearTimeout(state.uiHideTimer);
    state.uiHideTimer = window.setTimeout(() => els.lightbox?.classList.remove("show-ui"), 420);
  });

  els.lightboxImage?.addEventListener("load", () => {
    setViewerLoading(false);
    applyZoom();
  });


  window.addEventListener("resize", () => {
    if (state.lightboxOpen) {
      hideLightboxFloatingPreview();
      applyZoom();
      if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
    }
  });

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, syncFullscreenButtonUi);
  });

  syncFullscreenButtonUi();

  window.addEventListener("keydown", (event) => {
    if (!state.lightboxOpen) return;
    if (event.key === "Escape" && ((els.lightboxCatalogMenu && !els.lightboxCatalogMenu.classList.contains("hidden")) || (els.lightboxSearchScopeMenu && !els.lightboxSearchScopeMenu.classList.contains("hidden")))) {
      event.preventDefault();
      closeLightboxCatalogMenu();
      closeLightboxSearchScopeMenu();
      return;
    }
    if (event.key === "Escape" && isBrowserFullscreenActive()) {
      event.preventDefault();
      exitBrowserFullscreen().catch(() => {});
      return;
    }
    const target = event.target;
    const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isTyping) {
      if (event.key === "Escape") {
        target.blur();
        els.lightboxSearchResults?.classList.add("hidden");
      }
      return;
    }
    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowRight") moveLightbox(-1);
    else if (event.key === "ArrowLeft") moveLightbox(1);
    else if (event.key === "ArrowDown" && state.viewerMode === "single") showThumbsTemporarily(3000);
    else if (event.key === "ArrowDown" && state.viewerMode === "scroll") showPageRailTemporarily(3000);
    else if (event.key === "Home") setLightboxPage(1, { smooth: true, hit: state.viewerMode === "scroll" });
    else if (event.key === "End" && state.catalog) setLightboxPage(state.catalog.pages, { smooth: true, hit: state.viewerMode === "scroll" });
  });

  window.addEventListener("hashchange", () => {
    const route = parseHash();
    if (!route) return;
    const target = catalogs.find((item) => item.id === route.id);
    if (!target) return;

    if (!state.catalog || state.catalog.id !== target.id) {
      openCatalog(target.id, route.lightbox ? { openPage: route.page, viewerMode: route.viewerMode } : {});
      return;
    }

    if (route.lightbox) {
      openLightbox(route.page, { mode: route.viewerMode });
    } else if (state.lightboxOpen) {
      closeLightbox();
    } else {
      scheduleDeferredPageThumbLoading(0);
    }
  });
}

function init() {
  initRevealObserver();
  attachEvents();

  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  renderCatalogCards();
  fillCatalogSelect();
  initSearchStatus();
  renderLastCatalogView();

  const route = parseHash();
  if (route && catalogs.some((item) => item.id === route.id)) {
    openCatalog(route.id, route.lightbox ? { openPage: route.page, viewerMode: route.viewerMode } : {});
  }
}

init();
