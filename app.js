const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;

const $ = (id) => document.getElementById(id);
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

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
  fitBtn: $("fitBtn"),
  lightboxSearchInput: $("lightboxSearchInput"),
  lightboxSearchResults: $("lightboxSearchResults"),
  lightboxSearchStatus: $("lightboxSearchStatus"),
  lightboxSearchClear: $("lightboxSearchClear"),
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
  return catalog?.dir || `assets/pages/${catalog.id}`;
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

function flashActionButton(button, message) {
  if (!button || !message) return;
  const originalTitle = button.getAttribute("title") || "";
  button.setAttribute("title", message);
  button.classList.add("reader-icon-button-done");
  window.setTimeout(() => {
    if (originalTitle) button.setAttribute("title", originalTitle);
    else button.removeAttribute("title");
    button.classList.remove("reader-icon-button-done");
  }, 1500);
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

function loadDeferredImage(img) {
  const src = img?.dataset?.src;
  if (!src || img.getAttribute("src") === src) return;
  img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  img.src = src;
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
    const img = await loadImageElement(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        window.alert("לא הצלחתי ליצור צילום מסך לעמוד הזה.");
        return;
      }
      saveBlob(blob, `${safeFilePart(catalog.title || catalog.id)}-page-${pad(currentPage)}.png`);
      flashActionButton(button, "צילום המסך נשמר");
    }, "image/png");
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
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${escapeHtml(catalog.title)}" loading="lazy" decoding="async" fetchpriority="low" />
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

function resetLightboxSearch() {
  if (els.lightboxSearchInput) els.lightboxSearchInput.value = "";
  els.lightboxSearchResults?.classList.add("hidden");
  if (els.lightboxSearchResults) els.lightboxSearchResults.innerHTML = "";
  els.lightboxSearchClear?.classList.add("hidden");
  initLightboxSearchStatus();
}

function getLightboxSearchResults(query, limit = 24) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2 || !state.catalog || !catalogSearch?.hasIndex?.()) return [];
  const results = catalogSearch.search(rawQuery, { catalogId: state.catalog.id, limit });
  return Array.isArray(results) ? results : [];
}

function goToLightboxSearchResult(result) {
  if (!result || !state.catalog) return false;
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
  return goToLightboxSearchResult(firstResult);
}

function initLightboxSearchStatus() {
  if (!els.lightboxSearchStatus) return;

  const hasCatalog = Boolean(state.catalog);
  const hasIndex = Boolean(catalogSearch?.hasIndex?.());
  if (els.lightboxSearchInput) els.lightboxSearchInput.disabled = !hasCatalog || !hasIndex;

  if (!hasCatalog) {
    els.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }

  if (!hasIndex) {
    els.lightboxSearchStatus.textContent = "אין אינדקס OCR זמין לחיפוש.";
    return;
  }

  els.lightboxSearchStatus.textContent = "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
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

  const results = getLightboxSearchResults(rawQuery, 24);
  els.lightboxSearchResults.classList.remove("hidden");

  if (!results.length) {
    els.lightboxSearchStatus.textContent = "לא נמצאו תוצאות בקטלוג הפתוח.";
    els.lightboxSearchResults.innerHTML = `
      <article class="reader-search-empty lightbox-search-empty">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(rawQuery)}”</strong>
        <span>נסה חלק קצר יותר של הדגם או מילה אחרת.</span>
      </article>
    `;
    return;
  }

  els.lightboxSearchStatus.textContent = `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
  els.lightboxSearchResults.innerHTML = results.map((result) => {
    const page = clampPage(result.page, state.catalog);
    const thumb = escapeHtml(result.thumb || thumbSrc(state.catalog, page));
    return `
      <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-page="${page}">
        <span class="reader-search-thumb-frame catalog-image-frame">
          <img src="${thumb}" alt="עמוד ${page}" loading="lazy" decoding="async" />
        </span>
        <span>
          <strong>עמוד ${page}</strong>
          <small>${escapeHtml(result.excerpt || "התאמה לפי OCR בעמוד זה")}</small>
        </span>
      </button>
    `;
  }).join("");

  els.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]").forEach((button) => {
    button.addEventListener("click", () => {
      goToLightboxSearchResult({ page: button.dataset.lightboxSearchPage });
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
          <img class="search-result-thumb" src="${escapeHtml(result.thumb)}" alt="${escapeHtml(result.catalogTitle)} - עמוד ${result.page}" loading="lazy" />
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
  img.src = src;
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
            <img class="page-thumb" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}" loading="lazy" decoding="async" />
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
  els.catalogCoverPreview.src = catalog.cover ? withAssetVersion(catalog.cover, catalog) : pageSrc(catalog, 1);
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
      img.decoding = "async";
      img.fetchPriority = "low";
      img.src = pageSrc(state.catalog, page);
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

function clampPan() {
  const image = els.lightboxImage;
  const frame = els.lightboxImageFrame;
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !frame || !stage) return;

  const imageWidth = image.naturalWidth * state.fitScale * state.zoom;
  const imageHeight = image.naturalHeight * state.fitScale * state.zoom;
  const overflowX = Math.max(0, (imageWidth - stage.clientWidth) / 2);
  const overflowY = Math.max(0, (imageHeight - stage.clientHeight) / 2);

  if (overflowX <= 1) state.panX = 0;
  else state.panX = Math.min(overflowX, Math.max(-overflowX, state.panX));

  if (overflowY <= 1) state.panY = 0;
  else state.panY = Math.min(overflowY, Math.max(-overflowY, state.panY));
}

function resetImagePosition() {
  state.panX = 0;
  state.panY = 0;
}

function applyZoom() {
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
  clampPan();
  frame.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
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
  els.lightboxFloatingPreviewImage.src = src;
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
        <img src="${escapeHtml(thumbSrc(catalog, page))}" alt="" loading="lazy" decoding="async" />
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
    const src = escapeHtml(pageSrc(catalog, page));
    const eager = Math.abs(page - state.page) <= 1;
    const imageAttributes = eager
      ? `src="${src}" loading="eager" fetchpriority="${page === state.page ? "high" : "auto"}"`
      : `src="${TRANSPARENT_PIXEL}" data-src="${src}" loading="lazy" fetchpriority="low"`;
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
          <img src="${thumb}" alt="" loading="lazy" decoding="async" />
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
    els.viewerModeToggle.setAttribute("title", isScrollMode ? "תצוגה לצדדים" : "תצוגת גלילה");
  }

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

function updateLightbox() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  state.page = clampPage(state.page, catalog);
  syncViewerModeUi();

  els.lightboxTitle.textContent = catalog.title;
  els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${catalog.pages}`;
  initLightboxSearchStatus();
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= catalog.pages;

  if (state.viewerMode === "scroll") {
    setViewerLoading(false);
    ensureLightboxScrollPageLoaded(state.page, 1);
    updateLightboxThumbs();
    updateHash();
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
      els.lightboxImage.src = src;
    });
  } else {
    applyZoom();
  }

  updateLightboxThumbs();
  preloadNeighbors();
  updateHash();
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

function setZoom(nextZoom, options = {}) {
  if (state.viewerMode === "scroll") return;
  const { showUi = true } = options;
  state.zoom = Math.min(5, Math.max(1, nextZoom));
  if (state.zoom <= 1.001) resetImagePosition();
  applyZoom();
  if (showUi) showTopUiTemporarily(1600);
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


function startPointerInteraction(event) {
  if (!state.lightboxOpen || !els.stageCanvas) return;
  els.stageCanvas.setPointerCapture?.(event.pointerId);
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

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
  }
}

function movePointerInteraction(event) {
  if (!state.lightboxOpen || !state.pointers.has(event.pointerId)) return;
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
    setZoom(state.pinchStartZoom * (distance / state.pinchStartDistance), { showUi: false });
    return;
  }

  if (pointers.length === 1 && state.zoom > 1.01) {
    event.preventDefault();
    state.panX = state.dragStartPanX + (event.clientX - state.dragStartX);
    state.panY = state.dragStartPanY + (event.clientY - state.dragStartY);
    applyZoom();
  }
}

function endPointerInteraction(event) {
  if (!state.lightboxOpen || !state.pointers.has(event.pointerId)) return;
  const startedX = state.dragStartX;
  const startedY = state.dragStartY;
  state.pointers.delete(event.pointerId);

  if (state.pointers.size === 0 && state.zoom <= 1.01) {
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

function handleStageWheel(event) {
  if (!state.lightboxOpen) return;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom(state.zoom * factor, { showUi: false });
    return;
  }

  if (state.zoom > 1.01) {
    event.preventDefault();
    state.panX -= event.deltaX;
    state.panY -= event.deltaY;
    applyZoom();
  }
}

function attachViewerGestures() {
  const stage = els.stageCanvas;
  if (!stage) return;
  stage.addEventListener("pointerdown", startPointerInteraction);
  stage.addEventListener("pointermove", movePointerInteraction);
  stage.addEventListener("pointerup", endPointerInteraction);
  stage.addEventListener("pointercancel", endPointerInteraction);
  stage.addEventListener("wheel", handleStageWheel, { passive: false });
  stage.addEventListener("dblclick", () => {
    setZoom(state.zoom > 1.01 ? 1 : 2, { showUi: false });
  });
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

  els.catalogSelect?.addEventListener("change", () => openCatalog(els.catalogSelect.value));
  els.openViewerFromTop?.addEventListener("click", () => openLightbox(1));
  els.catalogCoverOpenViewer?.addEventListener("click", () => openLightbox(1));
  els.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  els.closeLightbox?.addEventListener("click", closeLightbox);
  els.lightboxScreenshot?.addEventListener("click", () => downloadCurrentLightboxImage());
  els.lightboxCopyLink?.addEventListener("click", () => copyCurrentLightboxLink());
  els.lightboxBackdrop?.addEventListener("click", closeLightbox);
  els.viewerModeToggle?.addEventListener("click", toggleLightboxMode);
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
      if (state.viewerMode === "scroll") scheduleLightboxScrollPageUpdate();
      else applyZoom();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!state.lightboxOpen) return;
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

  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  renderCatalogCards();
  fillCatalogSelect();
  initSearchStatus();
  attachEvents();

  const route = parseHash();
  if (route && catalogs.some((item) => item.id === route.id)) {
    openCatalog(route.id, route.lightbox ? { openPage: route.page, viewerMode: route.viewerMode } : {});
  }
}

init();
