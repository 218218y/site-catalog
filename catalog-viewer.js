const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;

const $ = (id) => document.getElementById(id);
const readerTitle = $("readerTitle");
const readerMeta = $("readerMeta");
const readerPages = $("readerPages");
const readerBack = $("readerBack");
const readerSearchInput = $("readerSearchInput");
const readerSearchResults = $("readerSearchResults");
const readerSearchStatus = $("readerSearchStatus");
const readerSearchClear = $("readerSearchClear");
const readerTopHotspot = $("readerTopHotspot");
const readerTopShell = $("readerTopShell");
const readerSideHotspot = $("readerSideHotspot");
const readerPageRail = $("readerPageRail");
const readerPageThumbs = $("readerPageThumbs");

const readerUiState = {
  currentPage: 1,
  scrollRaf: 0,
  topCloseTimer: 0,
  sideCloseTimer: 0
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

function clampPage(page, catalog) {
  const parsed = Number.parseInt(page, 10);
  if (!Number.isFinite(parsed)) return 1;
  const maxPage = Math.max(1, Number(catalog?.pages || 1));
  return Math.min(Math.max(parsed, 1), maxPage);
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

function initReaderSearchStatus(catalog) {
  if (!readerSearchStatus) return;
  if (!catalogSearch?.hasIndex?.()) {
    readerSearchStatus.textContent = "החיפוש יופעל אחרי הרצת ההמרה מחדש עם OCR, שמייצרת catalogs.search.js.";
    return;
  }
  readerSearchStatus.textContent = "הקלד לפחות 2 תווים כדי למצוא עמודים בקטלוג הזה.";
  readerSearchInput.disabled = !catalog;
}

function scrollToReaderPage(page) {
  const catalog = getSelectedCatalog();
  const targetPage = clampPage(page, catalog);
  const target = document.getElementById(`page-${targetPage}`);
  if (!target) return;
  updateReaderThumbs(targetPage, { scrollIntoView: true });
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.add("reader-page-frame-hit");
  window.setTimeout(() => target.classList.remove("reader-page-frame-hit"), 1800);
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

  const results = catalogSearch.search(rawQuery, { catalogId: catalog.id, limit: 36 });
  if (!results.length) {
    readerSearchResults.classList.remove("hidden");
    readerSearchResults.innerHTML = `
      <article class="reader-search-empty">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(rawQuery)}”</strong>
        <span>נסה חלק קצר יותר של הדגם או מילה אחרת.</span>
      </article>
    `;
    readerSearchStatus.textContent = "אין תוצאות מתאימות בקטלוג הזה.";
    return;
  }

  readerSearchStatus.textContent = `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
  readerSearchResults.classList.remove("hidden");
  readerSearchResults.innerHTML = results.map((result) => `
    <button class="reader-search-result" type="button" data-reader-page="${result.page}">
      <span class="reader-search-thumb-frame catalog-image-frame">
        <img src="${escapeHtml(result.thumb)}" alt="עמוד ${result.page}" loading="lazy" />
      </span>
      <span>
        <strong>עמוד ${result.page}</strong>
        <small>${escapeHtml(result.excerpt || "התאמה לפי OCR בעמוד זה")}</small>
      </span>
    </button>
  `).join("");

  readerSearchResults.querySelectorAll("[data-reader-page]").forEach((button) => {
    button.addEventListener("click", () => scrollToReaderPage(Number(button.dataset.readerPage)));
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
    thumbs.push(`
      <button class="reader-page-thumb reader-page-thumb-frame catalog-image-frame${page === 1 ? " active" : ""}" type="button" data-reader-page="${page}" aria-label="מעבר לעמוד ${page}"${page === 1 ? ' aria-current="page"' : ""}>
        <img src="${escapeHtml(thumbSrc(catalog, page))}" alt="" loading="lazy" />
        <span class="reader-thumb-number">${page}</span>
      </button>
    `);
  }

  readerPageThumbs.innerHTML = thumbs.join("");
  readerPageThumbs.querySelectorAll(".reader-page-thumb").forEach((button) => {
    button.addEventListener("click", () => {
      openPageRail(1800);
      scrollToReaderPage(Number(button.dataset.readerPage));
    });
  });
}

function renderReader() {
  const catalog = getSelectedCatalog();

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

  const pages = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    pages.push(`
      <figure class="reader-page-frame" id="page-${page}">
        <img class="reader-image" src="${escapeHtml(pageSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}" loading="${page <= 2 ? "eager" : "lazy"}" />
      </figure>
    `);
  }
  readerPages.innerHTML = pages.join("");
  renderReaderPageRail(catalog);
  initReaderSearchStatus(catalog);
  updateReaderThumbs(1, { scrollIntoView: false });
  window.requestAnimationFrame(findCurrentReaderPage);

  const requestedPage = getRequestedPage();
  if (requestedPage > 0) {
    window.setTimeout(() => scrollToReaderPage(requestedPage), 250);
  }
}

readerSearchInput?.addEventListener("input", () => renderReaderSearch(readerSearchInput.value));
readerSearchClear?.addEventListener("click", () => {
  readerSearchInput.value = "";
  readerSearchInput.focus();
  renderReaderSearch("");
});

readerBack?.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else window.location.href = "index.html";
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
readerPageRail?.addEventListener("mouseleave", closePageRailSoon);
readerPageRail?.addEventListener("focusin", () => openPageRail());
readerPageRail?.addEventListener("focusout", closePageRailSoon);

window.addEventListener("scroll", scheduleCurrentPageUpdate, { passive: true });
window.addEventListener("resize", scheduleCurrentPageUpdate);

renderReader();
