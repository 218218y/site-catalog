const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;

const $ = (id) => document.getElementById(id);
const readerTitle = $("readerTitle");
const readerMeta = $("readerMeta");
const readerPages = $("readerPages");
const readerScreenshot = $("readerScreenshot");
const readerCopyLink = $("readerCopyLink");
const readerSearchInput = $("readerSearchInput");
const readerSearchResults = $("readerSearchResults");
const readerSearchStatus = $("readerSearchStatus");
const readerSearchClear = $("readerSearchClear");
const readerSearchScopeToggle = $("readerSearchScopeToggle");
const readerSearchScopeMenu = $("readerSearchScopeMenu");
const readerCatalogMenuToggle = $("readerCatalogMenuToggle");
const readerCatalogMenu = $("readerCatalogMenu");
const readerTopHotspot = $("readerTopHotspot");
const readerTopShell = $("readerTopShell");
const readerSideHotspot = $("readerSideHotspot");
const readerPageRail = $("readerPageRail");
const readerPageThumbs = $("readerPageThumbs");
const readerFloatingPreview = $("readerFloatingPreview");
const readerFloatingPreviewImage = $("readerFloatingPreviewImage");
const readerFloatingPreviewPage = $("readerFloatingPreviewPage");

const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const readerUiState = {
  currentPage: 1,
  searchScope: "catalog",
  scrollRaf: 0,
  topCloseTimer: 0,
  sideCloseTimer: 0,
  pageImageObserver: null
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

function clampPage(page, catalog) {
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

function flashReaderAction(button, message) {
  if (!button || !message) return;
  const originalTooltip = getTooltipText(button);
  setTooltipText(button, message);
  button.classList.add("reader-icon-button-done");
  window.setTimeout(() => {
    setTooltipText(button, originalTooltip);
    button.classList.remove("reader-icon-button-done");
  }, 1500);
}

function loadDeferredReaderImage(img) {
  const src = img?.dataset?.src;
  if (!src || img.getAttribute("src") === src) return;
  img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  img.src = src;
  img.removeAttribute("data-src");
}

function ensureReaderPageLoaded(page, radius = 1) {
  if (!readerPages) return;
  const catalog = getSelectedCatalog();
  if (!catalog) return;
  const targetPage = clampPage(page, catalog);
  for (let nextPage = targetPage - radius; nextPage <= targetPage + radius; nextPage += 1) {
    if (nextPage < 1 || nextPage > catalog.pages) continue;
    const img = readerPages.querySelector(`#page-${nextPage} img.reader-image[data-src]`);
    if (img) {
      loadDeferredReaderImage(img);
      readerUiState.pageImageObserver?.unobserve?.(img);
    }
  }
}

function activateReaderPageImageLoading() {
  if (!readerPages) return;
  const pendingImages = Array.from(readerPages.querySelectorAll("img.reader-image[data-src]"));
  if (!pendingImages.length) return;

  if (!("IntersectionObserver" in window)) {
    pendingImages.forEach(loadDeferredReaderImage);
    return;
  }

  readerUiState.pageImageObserver?.disconnect?.();
  readerUiState.pageImageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadDeferredReaderImage(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    root: null,
    rootMargin: "1800px 0px",
    threshold: 0.01
  });

  pendingImages.forEach((img) => readerUiState.pageImageObserver.observe(img));
}

function disconnectReaderPageImageLoading() {
  readerUiState.pageImageObserver?.disconnect?.();
  readerUiState.pageImageObserver = null;
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

async function downloadCurrentReaderImage() {
  const catalog = getSelectedCatalog();
  if (!catalog) return;
  const currentPage = clampPage(readerUiState.currentPage || getRequestedPage() || 1, catalog);
  const src = pageSrc(catalog, currentPage);

  try {
    if (!window.CatalogSnapshot?.buildSnapshotBlob) {
      throw new Error("snapshot-exporter-missing");
    }

    const blob = await window.CatalogSnapshot.buildSnapshotBlob(src);
    const extension = window.CatalogSnapshot.extension || "jpg";
    saveBlob(blob, `${safeFilePart(catalog.title || catalog.id)}-page-${pad(currentPage)}.${extension}`);
    flashReaderAction(readerScreenshot, "צילום המסך נשמר");
  } catch (_error) {
    window.alert("לא הצלחתי ליצור צילום מסך לעמוד הזה. כדאי לוודא שקבצי התמונות נטענים מאותו אתר ולא מחסימה של הדפדפן.");
  }
}

function buildReaderPageUrl() {
  const catalog = getSelectedCatalog();
  if (!catalog) return window.location.href;
  const currentPage = clampPage(readerUiState.currentPage || getRequestedPage() || 1, catalog);
  const url = new URL(window.location.href);
  url.searchParams.set("id", catalog.id);
  url.searchParams.delete("catalog");
  url.searchParams.set("page", String(currentPage));
  url.hash = `page-${currentPage}`;
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

async function copyCurrentReaderLink() {
  const link = buildReaderPageUrl();
  try {
    await copyTextToClipboard(link);
    flashReaderAction(readerCopyLink, "הקישור הועתק");
  } catch (_error) {
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}

function getSelectedCatalog() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || params.get("catalog");
  return catalogs.find((item) => item.id === id) || catalogs[0] || null;
}

function getRequestedPage() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = Number.parseInt(params.get("page") || "", 10);
  const fromHash = Number.parseInt(String(window.location.hash || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(fromQuery) ? fromQuery : (Number.isFinite(fromHash) ? fromHash : 0);
}

function openTopControls(delay = 0) {
  window.clearTimeout(readerUiState.topCloseTimer);
  document.body.classList.add("reader-top-open");
  if (delay > 0) {
    readerUiState.topCloseTimer = window.setTimeout(() => {
      document.body.classList.remove("reader-top-open");
    }, delay);
  }
}

function closeTopControlsSoon() {
  window.clearTimeout(readerUiState.topCloseTimer);
  readerUiState.topCloseTimer = window.setTimeout(() => {
    if (readerTopShell?.matches(":hover, :focus-within") || readerTopHotspot?.matches(":hover")) return;
    document.body.classList.remove("reader-top-open");
  }, 180);
}

function openPageRail(delay = 0) {
  window.clearTimeout(readerUiState.sideCloseTimer);
  document.body.classList.add("reader-side-open");
  if (delay > 0) {
    readerUiState.sideCloseTimer = window.setTimeout(() => {
      document.body.classList.remove("reader-side-open");
    }, delay);
  }
}

function closePageRailSoon() {
  window.clearTimeout(readerUiState.sideCloseTimer);
  readerUiState.sideCloseTimer = window.setTimeout(() => {
    if (readerPageRail?.matches(":hover, :focus-within") || readerSideHotspot?.matches(":hover")) return;
    document.body.classList.remove("reader-side-open");
  }, 180);
}

function updateReaderThumbs(page, options = {}) {
  readerUiState.currentPage = page;
  if (!readerPageThumbs) return;

  let activeButton = null;
  readerPageThumbs.querySelectorAll(".reader-page-thumb").forEach((button) => {
    const isActive = Number(button.dataset.readerPage) === page;
    button.classList.toggle("active", isActive);
    if (isActive) {
      activeButton = button;
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (options.scrollIntoView && activeButton) {
    activeButton.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function findCurrentReaderPage() {
  if (!readerPages) return;
  const frames = Array.from(readerPages.querySelectorAll(".reader-page-frame"));
  if (!frames.length) return;

  const anchorY = Math.max(90, window.innerHeight * 0.32);
  let closestPage = readerUiState.currentPage || 1;
  let closestDistance = Number.POSITIVE_INFINITY;

  frames.forEach((frame) => {
    const rect = frame.getBoundingClientRect();
    const page = Number(String(frame.id || "").replace(/[^0-9]/g, ""));
    if (!Number.isFinite(page)) return;

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

  if (closestPage !== readerUiState.currentPage) {
    updateReaderThumbs(closestPage, { scrollIntoView: true });
  }
}

function scheduleCurrentPageUpdate() {
  if (readerUiState.scrollRaf) return;
  readerUiState.scrollRaf = window.requestAnimationFrame(() => {
    readerUiState.scrollRaf = 0;
    findCurrentReaderPage();
  });
}

function getReaderSearchScope() {
  return readerUiState.searchScope === "all" ? "all" : "catalog";
}

function readerSearchScopeLabel(scope = getReaderSearchScope()) {
  return scope === "all" ? "בכל הקטלוגים" : "בקטלוג הזה";
}

function readerSearchPlaceholder(catalog) {
  if (getReaderSearchScope() === "all") return "חפש בכל הקטלוגים...";
  const catalogTitle = String(catalog?.title || "").trim();
  return catalogTitle ? `חפש בקטלוג הזה: ${catalogTitle}` : "חפש בקטלוג הזה...";
}

function closeReaderSearchScopeMenu() {
  readerSearchScopeMenu?.classList.add("hidden");
  readerSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function closeReaderCatalogMenu() {
  readerCatalogMenu?.classList.add("hidden");
  readerCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function syncReaderSearchScopeUi(catalog = getSelectedCatalog()) {
  const scope = getReaderSearchScope();
  if (readerSearchScopeToggle) {
    readerSearchScopeToggle.innerHTML = `${escapeHtml(readerSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`;
  }
  if (readerSearchInput) {
    const label = readerSearchPlaceholder(catalog);
    readerSearchInput.placeholder = label;
    readerSearchInput.setAttribute("aria-label", label);
  }
  readerSearchScopeMenu?.querySelectorAll("[data-reader-search-scope]").forEach((button) => {
    const selected = button.dataset.readerSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setReaderSearchScope(scope, options = {}) {
  const nextScope = scope === "all" ? "all" : "catalog";
  if (readerUiState.searchScope === nextScope) {
    syncReaderSearchScopeUi();
    closeReaderSearchScopeMenu();
    return;
  }

  readerUiState.searchScope = nextScope;
  syncReaderSearchScopeUi();
  closeReaderSearchScopeMenu();
  initReaderSearchStatus(getSelectedCatalog());

  if (options.render !== false && readerSearchInput) {
    renderReaderSearch(readerSearchInput.value);
  }
}

function initReaderSearchStatus(catalog) {
  syncReaderSearchScopeUi(catalog);
  if (readerSearchInput) readerSearchInput.disabled = !catalog;
  if (!readerSearchStatus) return;
  if (!catalogSearch?.hasIndex?.()) {
    readerSearchStatus.textContent = "החיפוש יופעל אחרי הרצת ההמרה מחדש עם OCR, שמייצרת catalogs.search.js.";
    return;
  }
  readerSearchStatus.textContent = getReaderSearchScope() === "all"
    ? "הקלד לפחות 2 תווים כדי למצוא עמודים בכל הקטלוגים."
    : "הקלד לפחות 2 תווים כדי למצוא עמודים בקטלוג הזה.";
}

function openReaderCatalog(catalogId, page = 1) {
  const catalog = catalogs.find((item) => item.id === catalogId) || null;
  if (!catalog) return false;

  const targetPage = clampPage(page, catalog);
  const url = new URL(window.location.href);
  url.searchParams.set("id", catalog.id);
  url.searchParams.delete("catalog");
  url.searchParams.set("page", String(targetPage));
  url.hash = `page-${targetPage}`;
  window.history.pushState({}, "", url.href);

  closeReaderCatalogMenu();
  closeReaderSearchScopeMenu();
  readerSearchResults?.classList.add("hidden");
  renderReader();
  openTopControls(1700);
  return true;
}

function renderReaderCatalogMenu() {
  if (!readerCatalogMenu) return;

  const currentCatalog = getSelectedCatalog();
  if (!catalogs.length) {
    readerCatalogMenu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
    return;
  }

  const groups = getCatalogCategoryGroups();
  readerCatalogMenu.innerHTML = groups.map((group) => `
    <section class="reader-catalog-menu-section">
      <div class="reader-catalog-menu-category">${escapeHtml(group.category)}</div>
      <div class="reader-catalog-menu-items">
        ${group.items.map((catalog) => `
          <button class="reader-catalog-menu-item${currentCatalog?.id === catalog.id ? " active" : ""}" type="button" role="menuitem" data-reader-catalog-id="${escapeHtml(catalog.id)}">
            <strong>${escapeHtml(catalog.title)}</strong>
            <small>${escapeHtml(catalog.pages || 0)} עמודים</small>
          </button>
        `).join("")}
      </div>
    </section>
  `).join("");

  readerCatalogMenu.querySelectorAll("[data-reader-catalog-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.readerCatalogId;
      if (!catalogId || catalogId === currentCatalog?.id) {
        closeReaderCatalogMenu();
        return;
      }
      openReaderCatalog(catalogId, 1);
    });
  });
}

function scrollToReaderPage(page) {
  const catalog = getSelectedCatalog();
  const targetPage = clampPage(page, catalog);
  const target = document.getElementById(`page-${targetPage}`);
  if (!target) return;
  ensureReaderPageLoaded(targetPage, 2);
  updateReaderThumbs(targetPage, { scrollIntoView: true });
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.add("reader-page-frame-hit");
  window.setTimeout(() => target.classList.remove("reader-page-frame-hit"), 1800);
}

function isReaderTypingTarget(target) {
  if (!target) return false;
  const tagName = String(target.tagName || "").toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable;
}

function moveReaderPage(delta) {
  const catalog = getSelectedCatalog();
  if (!catalog) return;
  const targetPage = clampPage((readerUiState.currentPage || 1) + delta, catalog);
  if (targetPage === readerUiState.currentPage) return;
  scrollToReaderPage(targetPage);
}

function handleReaderKeydown(event) {
  if (event.key === "Escape" && ((readerCatalogMenu && !readerCatalogMenu.classList.contains("hidden")) || (readerSearchScopeMenu && !readerSearchScopeMenu.classList.contains("hidden")))) {
    event.preventDefault();
    closeReaderCatalogMenu();
    closeReaderSearchScopeMenu();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  if (isReaderTypingTarget(event.target)) {
    if (event.key === "Escape") {
      event.target.blur?.();
      readerSearchResults?.classList.add("hidden");
    }
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveReaderPage(-1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveReaderPage(1);
  } else if (event.key === "Home") {
    event.preventDefault();
    scrollToReaderPage(1);
  } else if (event.key === "End") {
    const catalog = getSelectedCatalog();
    if (!catalog) return;
    event.preventDefault();
    scrollToReaderPage(catalog.pages);
  }
}

function showReaderFloatingPreview(button) {
  if (!readerFloatingPreview || !readerFloatingPreviewImage || !button) return;

  const page = Number(button.dataset.readerPage || 0);
  const src = button.dataset.previewSrc || button.dataset.thumbSrc || "";
  if (!page || !src) return;

  readerFloatingPreviewImage.src = src;
  if (readerFloatingPreviewPage) readerFloatingPreviewPage.textContent = `עמוד ${page}`;
  readerFloatingPreview.classList.add("visible");
}

function hideReaderFloatingPreview() {
  readerFloatingPreview?.classList.remove("visible");
}

function getReaderSearchResults(query, limit = 36) {
  const catalog = getSelectedCatalog();
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.()) return [];

  const options = { limit };
  if (getReaderSearchScope() !== "all") {
    if (!catalog) return [];
    options.catalogId = catalog.id;
  }

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function goToReaderSearchResult(result) {
  const catalog = getSelectedCatalog();
  if (!result || !catalog) return false;

  const targetCatalogId = result.catalogId || catalog.id;
  if (targetCatalogId !== catalog.id) {
    return openReaderCatalog(targetCatalogId, Number(result.page));
  }

  scrollToReaderPage(clampPage(result.page, catalog));
  readerSearchResults?.classList.add("hidden");
  return true;
}

function submitReaderSearch() {
  const rawQuery = String(readerSearchInput?.value || "").trim();
  renderReaderSearch(rawQuery);
  const firstResult = getReaderSearchResults(rawQuery, 1)[0];
  return goToReaderSearchResult(firstResult);
}

function renderReaderSearch(query) {
  const catalog = getSelectedCatalog();
  const rawQuery = String(query || "").trim();
  if (!readerSearchResults || !readerSearchStatus) return;

  readerSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    readerSearchResults.classList.add("hidden");
    readerSearchResults.innerHTML = "";
    initReaderSearchStatus(catalog);
    return;
  }

  if (!catalog || !catalogSearch?.hasIndex?.()) {
    readerSearchResults.classList.add("hidden");
    readerSearchResults.innerHTML = "";
    readerSearchStatus.textContent = "עדיין אין אינדקס חיפוש. הרץ את ההמרה מחדש כדי ליצור OCR בעברית.";
    return;
  }

  const scope = getReaderSearchScope();
  const results = getReaderSearchResults(rawQuery, scope === "all" ? 48 : 36);
  if (!results.length) {
    readerSearchResults.classList.remove("hidden");
    readerSearchResults.innerHTML = `
      <article class="reader-search-empty">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(rawQuery)}”</strong>
        <span>נסה חלק קצר יותר של הדגם או מילה אחרת.</span>
      </article>
    `;
    readerSearchStatus.textContent = scope === "all" ? "אין תוצאות מתאימות בכל הקטלוגים." : "אין תוצאות מתאימות בקטלוג הזה.";
    return;
  }

  readerSearchStatus.textContent = scope === "all"
    ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.`
    : `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
  readerSearchResults.classList.remove("hidden");
  readerSearchResults.innerHTML = results.map((result) => {
    const resultCatalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || catalog;
    const page = clampPage(result.page, resultCatalog);
    const catalogTitle = result.catalogTitle || resultCatalog?.title || "קטלוג";
    return `
      <button class="reader-search-result" type="button" data-reader-catalog="${escapeHtml(result.catalogId || resultCatalog?.id || "")}" data-reader-page="${page}">
        <span class="reader-search-thumb-frame catalog-image-frame">
          <img src="${escapeHtml(result.thumb || thumbSrc(resultCatalog, page))}" alt="${escapeHtml(catalogTitle)} - עמוד ${page}" loading="lazy" decoding="async" fetchpriority="low" />
        </span>
        <span>
          <strong>${scope === "all" ? escapeHtml(catalogTitle) : `עמוד ${page}`}</strong>
          <small>${scope === "all" ? `עמוד ${page} · ` : ""}${escapeHtml(result.excerpt || "התאמה לפי OCR בעמוד זה")}</small>
        </span>
      </button>
    `;
  }).join("");

  readerSearchResults.querySelectorAll("[data-reader-page]").forEach((button) => {
    button.addEventListener("click", () => goToReaderSearchResult({
      catalogId: button.dataset.readerCatalog,
      page: button.dataset.readerPage
    }));
  });
}

function renderReaderPageRail(catalog) {
  if (!readerPageThumbs) return;

  if (!catalog || !catalog.pages) {
    readerPageThumbs.innerHTML = "";
    readerPageRail?.classList.add("hidden");
    return;
  }

  readerPageRail?.classList.remove("hidden");
  const thumbs = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    const thumb = escapeHtml(thumbSrc(catalog, page));
    const pageImage = thumb;
    thumbs.push(`
      <button class="reader-page-thumb reader-page-thumb-frame catalog-image-frame${page === 1 ? " active" : ""}" type="button" data-reader-page="${page}" data-thumb-src="${thumb}" data-preview-src="${pageImage}" aria-label="מעבר לעמוד ${page}"${page === 1 ? ' aria-current="page"' : ""}>
        <span class="reader-thumb-image-wrap">
          <img src="${thumb}" alt="" loading="lazy" decoding="async" fetchpriority="low" />
        </span>
        <span class="reader-thumb-number">${page}</span>
      </button>
    `);
  }

  readerPageThumbs.innerHTML = thumbs.join("");
  readerPageThumbs.querySelectorAll(".reader-page-thumb").forEach((button) => {
    button.addEventListener("pointerenter", () => showReaderFloatingPreview(button));
    button.addEventListener("pointerleave", hideReaderFloatingPreview);
    button.addEventListener("focus", () => showReaderFloatingPreview(button));
    button.addEventListener("blur", hideReaderFloatingPreview);
    button.addEventListener("click", () => {
      hideReaderFloatingPreview();
      openPageRail(1800);
      scrollToReaderPage(Number(button.dataset.readerPage));
    });
  });
}

function renderReader() {
  const catalog = getSelectedCatalog();
  disconnectReaderPageImageLoading();

  if (!catalog) {
    document.title = "קטלוגים | רהיטי ברגיג";
    readerTitle.textContent = "אין קטלוגים להצגה";
    readerMeta.textContent = "";
    readerPages.innerHTML = `<div class="reader-empty">עדיין אין קטלוגים זמינים לצפייה.</div>`;
    renderReaderPageRail(null);
    initReaderSearchStatus(null);
    return;
  }

  document.title = `${catalog.title} | רהיטי ברגיג`;
  readerTitle.textContent = catalog.title;
  readerMeta.textContent = `${catalog.pages} עמודים`;

  const requestedPage = getRequestedPage();
  const initialPage = requestedPage > 0 ? clampPage(requestedPage, catalog) : 1;
  const pages = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    const src = escapeHtml(pageSrc(catalog, page));
    const eager = Math.abs(page - initialPage) <= 1;
    const imageAttributes = eager
      ? `src="${src}" loading="eager" fetchpriority="${page === initialPage ? "high" : "auto"}"`
      : `src="${TRANSPARENT_PIXEL}" data-src="${src}" loading="lazy" fetchpriority="low"`;
    pages.push(`
      <figure class="reader-page-frame" id="page-${page}"${pageAspectStyle(catalog, page)}>
        <img class="reader-image${eager ? " loaded" : ""}" ${imageAttributes} alt="${escapeHtml(catalog.title)} - עמוד ${page}" decoding="async" />
      </figure>
    `);
  }
  readerPages.innerHTML = pages.join("");
  activateReaderPageImageLoading();
  renderReaderPageRail(catalog);
  renderReaderCatalogMenu();
  initReaderSearchStatus(catalog);
  updateReaderThumbs(1, { scrollIntoView: false });
  window.requestAnimationFrame(findCurrentReaderPage);

  if (requestedPage > 0) {
    window.setTimeout(() => scrollToReaderPage(requestedPage), 250);
  }
}

readerScreenshot?.addEventListener("click", downloadCurrentReaderImage);
readerCopyLink?.addEventListener("click", copyCurrentReaderLink);

readerSearchInput?.addEventListener("input", () => renderReaderSearch(readerSearchInput.value));
readerSearchInput?.addEventListener("focus", () => {
  openTopControls();
  renderReaderSearch(readerSearchInput.value);
});
readerSearchInput?.addEventListener("click", () => {
  openTopControls();
  renderReaderSearch(readerSearchInput.value);
});
readerSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  submitReaderSearch();
});
readerSearchClear?.addEventListener("click", () => {
  readerSearchInput.value = "";
  readerSearchInput.focus();
  renderReaderSearch("");
});

readerSearchScopeToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  closeReaderCatalogMenu();
  const isOpen = !readerSearchScopeMenu?.classList.contains("hidden");
  readerSearchScopeMenu?.classList.toggle("hidden", isOpen);
  readerSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  openTopControls();
});
readerSearchScopeMenu?.querySelectorAll("[data-reader-search-scope]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setReaderSearchScope(button.dataset.readerSearchScope);
    openTopControls();
    readerSearchInput?.focus();
  });
});
readerCatalogMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  closeReaderSearchScopeMenu();
  renderReaderCatalogMenu();
  const isOpen = !readerCatalogMenu?.classList.contains("hidden");
  readerCatalogMenu?.classList.toggle("hidden", isOpen);
  readerCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  openTopControls();
});
readerCatalogMenu?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", (event) => {
  if (readerSearchScopeMenu?.contains(event.target) || readerSearchScopeToggle?.contains(event.target)) return;
  if (readerCatalogMenu?.contains(event.target) || readerCatalogMenuToggle?.contains(event.target)) return;
  closeReaderSearchScopeMenu();
  closeReaderCatalogMenu();
});


readerTopHotspot?.addEventListener("mouseenter", () => openTopControls());
readerTopHotspot?.addEventListener("mouseleave", closeTopControlsSoon);
readerTopHotspot?.addEventListener("click", () => openTopControls(2600));
readerTopShell?.addEventListener("mouseenter", () => openTopControls());
readerTopShell?.addEventListener("mouseleave", closeTopControlsSoon);
readerTopShell?.addEventListener("focusin", () => openTopControls());
readerTopShell?.addEventListener("focusout", closeTopControlsSoon);

readerSideHotspot?.addEventListener("mouseenter", () => openPageRail());
readerSideHotspot?.addEventListener("mouseleave", closePageRailSoon);
readerSideHotspot?.addEventListener("click", () => openPageRail(2600));
readerPageRail?.addEventListener("mouseenter", () => openPageRail());
readerPageRail?.addEventListener("mouseleave", () => {
  hideReaderFloatingPreview();
  closePageRailSoon();
});
readerPageRail?.addEventListener("focusin", () => openPageRail());
readerPageRail?.addEventListener("focusout", closePageRailSoon);

window.addEventListener("scroll", scheduleCurrentPageUpdate, { passive: true });
window.addEventListener("resize", scheduleCurrentPageUpdate);
window.addEventListener("popstate", renderReader);
window.addEventListener("keydown", handleReaderKeydown);

renderReader();
