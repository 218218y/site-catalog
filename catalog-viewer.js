const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];

const $ = (id) => document.getElementById(id);
const readerTitle = $("readerTitle");
const readerMeta = $("readerMeta");
const readerPages = $("readerPages");
const readerBack = $("readerBack");

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

function renderReader() {
  const catalog = getSelectedCatalog();

  if (!catalog) {
    document.title = "קטלוגים | רהיטי ברגיג";
    readerTitle.textContent = "אין קטלוגים להצגה";
    readerMeta.textContent = "";
    readerPages.innerHTML = `<div class="reader-empty">עדיין אין קטלוגים זמינים לצפייה.</div>`;
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
}

readerBack?.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else window.location.href = "index.html";
});

renderReader();
