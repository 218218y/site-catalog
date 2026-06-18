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
  const target = document.getElementById(`page-${page}`);
  if (!target) return;
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

function renderReader() {
  const catalog = getSelectedCatalog();

  if (!catalog) {
    document.title = "קטלוגים | רהיטי ברגיג";
    readerTitle.textContent = "אין קטלוגים להצגה";
    readerMeta.textContent = "";
    readerPages.innerHTML = `<div class="reader-empty">עדיין אין קטלוגים זמינים לצפייה.</div>`;
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
  initReaderSearchStatus(catalog);

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

renderReader();
