const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];

const $ = (id) => document.getElementById(id);
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
  thumbsHideTimer: 0,
  uiHideTimer: 0
};

const els = {
  splash: $("splashScreen"),
  catalogGrid: $("catalogGrid"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  openFirstCatalog: $("openFirstCatalog"),
  catalogDetail: $("catalogDetail"),
  catalogTitle: $("catalogDetailTitle"),
  catalogDescription: $("catalogDescription"),
  catalogCategory: $("catalogCategory"),
  catalogPages: $("catalogPages"),
  catalogSelect: $("catalogSelect"),
  catalogCoverPreview: $("catalogCoverPreview"),
  pageGrid: $("pageGrid"),
  openViewerFromTop: $("openViewerFromTop"),
  scrollToTopBtn: $("scrollToTopBtn"),
  heroShot1: $("heroShot1"),
  heroShot2: $("heroShot2"),
  heroShot3: $("heroShot3"),
  lightbox: $("lightbox"),
  lightboxBackdrop: $("lightboxBackdrop"),
  lightboxBar: $("lightboxBar"),
  topHotspot: $("topHotspot"),
  thumbsHotspot: $("thumbsHotspot"),
  lightboxTitle: $("lightboxTitle"),
  lightboxMeta: $("lightboxMeta"),
  lightboxImage: $("lightboxImage"),
  lightboxThumbs: $("lightboxThumbs"),
  lightboxStage: $("lightboxStage"),
  stageCanvas: $("stageCanvas"),
  viewerLoading: $("viewerLoading"),
  prevPageBtn: $("prevPageBtn"),
  nextPageBtn: $("nextPageBtn"),
  closeLightbox: $("closeLightbox"),
  zoomInBtn: $("zoomInBtn"),
  zoomOutBtn: $("zoomOutBtn"),
  fitBtn: $("fitBtn")
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

function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}

function catalogDir(catalog) {
  return catalog?.dir || `assets/pages/${catalog.id}`;
}

function pageSrc(catalog, page) {
  return `${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`;
}

function thumbSrc(catalog, page) {
  return `${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`;
}

function clampPage(page, catalog = state.catalog) {
  const parsed = Number.parseInt(page, 10);
  if (!Number.isFinite(parsed)) return 1;
  const maxPage = Math.max(1, Number(catalog?.pages || 1));
  return Math.min(Math.max(parsed, 1), maxPage);
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

  els.catalogGrid.innerHTML = html;
  els.pageGrid.innerHTML = html;
  els.catalogCount.textContent = "0";
  els.pageCount.textContent = "0";
  els.catalogDetail.classList.remove("hidden");
  els.catalogTitle.textContent = "עדיין אין קטלוגים להצגה";
  els.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.";
  els.catalogCategory.textContent = "קטלוגים";
  els.catalogPages.textContent = "0 עמודים";
  els.catalogSelect.innerHTML = `<option>אין קטלוגים</option>`;
  els.catalogCoverPreview.removeAttribute("src");
  els.openFirstCatalog.disabled = true;
  els.openViewerFromTop.disabled = true;
}

function renderHeroShots() {
  const shots = [els.heroShot1, els.heroShot2, els.heroShot3];
  if (!catalogs.length) return;

  const covers = catalogs
    .flatMap((catalog) => [catalog.cover || pageSrc(catalog, 1)])
    .slice(0, 3);

  shots.forEach((img, index) => {
    if (!img) return;
    img.src = covers[index] || covers[covers.length - 1] || "";
    img.alt = "";
  });
}

function renderCatalogCards() {
  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  const totalPages = catalogs.reduce((sum, item) => sum + Number(item.pages || 0), 0);
  els.catalogCount.textContent = String(catalogs.length);
  els.pageCount.textContent = String(totalPages);

  els.catalogGrid.innerHTML = catalogs.map((catalog) => {
    const cover = catalog.cover || pageSrc(catalog, 1);
    return `
      <article class="catalog-card">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${escapeHtml(catalog.title)}" loading="lazy" />
        <div class="catalog-body">
          <div class="catalog-meta">
            <span class="pill">${escapeHtml(catalog.category || "קטלוג")}</span>
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
  }).join("");

  els.catalogGrid.querySelectorAll("[data-open-catalog]").forEach((button) => {
    button.addEventListener("click", () => openCatalog(button.dataset.openCatalog, { scroll: true }));
  });

  els.catalogGrid.querySelectorAll("[data-enter-catalog]").forEach((button) => {
    button.addEventListener("click", () => openCatalogPage(button.dataset.enterCatalog));
  });
}

function fillCatalogSelect() {
  if (!catalogs.length) return;
  els.catalogSelect.innerHTML = catalogs.map((catalog) => (
    `<option value="${escapeHtml(catalog.id)}">${escapeHtml(catalog.title)}</option>`
  )).join("");
}

function renderPageGrid() {
  if (!state.catalog) return;

  const catalog = state.catalog;
  const cards = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    cards.push(`
      <article class="page-card">
        <button class="page-button" type="button" data-open-page="${page}">
          <div class="page-thumb-wrap">
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}" loading="lazy" />
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

function renderCatalogDetail() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  els.catalogDetail.classList.remove("hidden");
  els.catalogTitle.textContent = catalog.title;
  els.catalogDescription.textContent = catalog.description || "";
  els.catalogCategory.textContent = catalog.category || "קטלוג";
  els.catalogPages.textContent = `${catalog.pages} עמודים`;
  els.catalogSelect.value = catalog.id;
  els.catalogCoverPreview.src = catalog.cover || pageSrc(catalog, 1);
  els.catalogCoverPreview.alt = `שער ${catalog.title}`;
  els.openViewerFromTop.disabled = catalog.pages < 1;
  renderPageGrid();
}

function preloadNeighbors() {
  if (!state.catalog) return;
  [state.page - 1, state.page + 1]
    .filter((page) => page >= 1 && page <= state.catalog.pages)
    .forEach((page) => {
      const img = new Image();
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
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !stage) return;

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
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !stage) return;

  const availableWidth = Math.max(260, stage.clientWidth - 18);
  const availableHeight = Math.max(260, stage.clientHeight - 18);
  state.fitScale = Math.min(
    availableWidth / image.naturalWidth,
    availableHeight / image.naturalHeight
  );

  const fitWidth = Math.max(220, Math.round(image.naturalWidth * state.fitScale));
  image.style.width = `${fitWidth}px`;
  image.style.height = "auto";

  if (state.zoom <= 1.001) resetImagePosition();
  clampPan();
  image.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
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

function updateLightboxThumbs() {
  els.lightboxThumbs.querySelectorAll(".lightbox-thumb").forEach((button) => {
    const active = Number(button.dataset.page) === state.page;
    button.classList.toggle("active", active);
    if (active) {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });
}

function renderLightboxThumbs() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  const thumbs = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    thumbs.push(`
      <button class="lightbox-thumb ${page === state.page ? "active" : ""}" type="button" data-page="${page}" aria-label="מעבר לעמוד ${page}">
        <img src="${escapeHtml(thumbSrc(catalog, page))}" alt="" loading="lazy" />
      </button>
    `);
  }
  els.lightboxThumbs.innerHTML = thumbs.join("");
  els.lightboxThumbs.querySelectorAll(".lightbox-thumb").forEach((button) => {
    button.addEventListener("click", () => setLightboxPage(Number(button.dataset.page)));
  });
}

function updateLightbox() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  state.page = clampPage(state.page, catalog);

  els.lightboxTitle.textContent = catalog.title;
  els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${catalog.pages}`;
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= catalog.pages;

  const src = pageSrc(catalog, state.page);
  const currentSrc = els.lightboxImage.getAttribute("src");
  if (currentSrc !== src) {
    setViewerLoading(true);
    els.lightboxImage.removeAttribute("src");
    els.lightboxImage.alt = `${catalog.title} - עמוד ${state.page}`;
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

function openLightbox(page = 1) {
  if (!state.catalog) return;
  state.page = clampPage(page, state.catalog);
  state.zoom = 1;
  resetImagePosition();
  state.pointers.clear();
  state.lightboxOpen = true;
  els.lightbox.classList.remove("hidden");
  els.lightbox.classList.remove("show-thumbs");
  document.body.classList.add("no-scroll");
  renderLightboxThumbs();
  showTopUiTemporarily(1700);
  updateLightbox();
}

function closeLightbox() {
  state.lightboxOpen = false;
  els.lightbox.classList.add("hidden");
  els.lightbox.classList.remove("show-thumbs", "show-ui");
  window.clearTimeout(state.thumbsHideTimer);
  window.clearTimeout(state.uiHideTimer);
  document.body.classList.remove("no-scroll");
  updateHash();
}

function setLightboxPage(page) {
  if (!state.catalog) return;
  const nextPage = clampPage(page, state.catalog);
  if (nextPage !== state.page) {
    state.zoom = 1;
    resetImagePosition();
    state.pointers.clear();
  }
  state.page = nextPage;
  updateLightbox();
}

function moveLightbox(delta) {
  if (!state.catalog) return;
  setLightboxPage(state.page + delta);
}

function setZoom(nextZoom, options = {}) {
  const { showUi = true } = options;
  state.zoom = Math.min(5, Math.max(1, nextZoom));
  if (state.zoom <= 1.001) resetImagePosition();
  applyZoom();
  if (showUi) showTopUiTemporarily(1600);
}


function openCatalogPage(id) {
  const catalog = catalogs.find((item) => item.id === id);
  if (!catalog) return;
  const url = new URL("catalog.html", window.location.href);
  url.searchParams.set("id", catalog.id);
  const opened = window.open(url.toString(), "_blank");
  if (opened) opened.opener = null;
  else window.location.href = url.toString();
}

function openCatalog(id, options = {}) {
  const { scroll = false, openPage = null } = options;
  const catalog = catalogs.find((item) => item.id === id) || catalogs[0] || null;
  if (!catalog) return;

  state.catalog = catalog;
  state.page = 1;
  renderCatalogDetail();
  updateHash();

  if (scroll) {
    els.catalogDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (openPage != null) {
    openLightbox(openPage);
  }
}

function parseHash() {
  const pageMatch = location.hash.match(/^#catalog\/([a-z0-9-]+)\/page\/(\d+)$/i);
  if (pageMatch) {
    return { id: pageMatch[1], page: Number(pageMatch[2]), lightbox: true };
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
      if (dx > 0) moveLightbox(-1);
      else moveLightbox(1);
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
  els.openFirstCatalog?.addEventListener("click", () => {
    if (catalogs[0]) openCatalog(catalogs[0].id, { scroll: true });
  });

  els.catalogSelect?.addEventListener("change", () => openCatalog(els.catalogSelect.value));
  els.openViewerFromTop?.addEventListener("click", () => openLightbox(1));
  els.scrollToTopBtn?.addEventListener("click", () => els.catalogDetail.scrollIntoView({ behavior: "smooth", block: "start" }));

  els.closeLightbox?.addEventListener("click", closeLightbox);
  els.lightboxBackdrop?.addEventListener("click", closeLightbox);
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
  els.lightboxThumbs?.addEventListener("mouseleave", scheduleThumbsClose);
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
    if (state.lightboxOpen) applyZoom();
  });

  window.addEventListener("keydown", (event) => {
    if (!state.lightboxOpen) return;
    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowRight") moveLightbox(-1);
    else if (event.key === "ArrowLeft") moveLightbox(1);
    else if (event.key === "ArrowDown") showThumbsTemporarily(3000);
    else if (event.key === "Home") setLightboxPage(1);
    else if (event.key === "End" && state.catalog) setLightboxPage(state.catalog.pages);
  });

  window.addEventListener("hashchange", () => {
    const route = parseHash();
    if (!route) return;
    const target = catalogs.find((item) => item.id === route.id);
    if (!target) return;

    if (!state.catalog || state.catalog.id !== target.id) {
      openCatalog(target.id);
    }

    if (route.lightbox) {
      openLightbox(route.page);
    } else if (state.lightboxOpen) {
      closeLightbox();
    }
  });
}

function init() {
  initRevealObserver();

  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  renderHeroShots();
  renderCatalogCards();
  fillCatalogSelect();
  attachEvents();

  const route = parseHash();
  if (route && catalogs.some((item) => item.id === route.id)) {
    openCatalog(route.id);
    if (route.lightbox) openLightbox(route.page);
  }
}

init();
