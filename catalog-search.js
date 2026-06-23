(function () {
  const FINAL_LETTERS = new Map([
    ["ך", "כ"],
    ["ם", "מ"],
    ["ן", "נ"],
    ["ף", "פ"],
    ["ץ", "צ"]
  ]);

  function catalogs() {
    return Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
  }

  function searchIndex() {
    return Array.isArray(window.BARGIG_CATALOG_SEARCH) ? window.BARGIG_CATALOG_SEARCH : [];
  }

  function pad(num) {
    return String(num).padStart(3, "0");
  }

  function resolveCatalogAssetUrl(path) {
    return String(path || "").trim();
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

  function normalize(value) {
    let text = String(value ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0591-\u05C7]/g, "")
      .replace(/[״׳'\"]/g, "")
      .replace(/[־–—_]/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

    text = Array.from(text).map((char) => FINAL_LETTERS.get(char) || char).join("");
    return text.replace(/\s+/g, " ");
  }

  function normalizeLoose(value) {
    return normalize(value)
      // Common OCR confusion in Hebrew catalog scans: kaf in words like כפולה
      // is sometimes read as bet. Loose matching is only used as a fallback.
      .replace(/[כ]/g, "ב");
  }

  function tokenize(query) {
    return normalize(query).split(" ").filter((token) => token.length >= 1);
  }

  function tokenMatches(normalizedText, looseText, token) {
    if (normalizedText.includes(token)) return true;
    if (token.length < 3) return false;
    const looseToken = normalizeLoose(token);
    return Boolean(looseToken && looseToken !== token && looseText.includes(looseToken));
  }

  function findCatalog(catalogId) {
    return catalogs().find((catalog) => catalog.id === catalogId) || null;
  }

  function indexedPageCount() {
    return searchIndex().reduce((sum, entry) => sum + (Array.isArray(entry.pages) ? entry.pages.length : 0), 0);
  }

  function hasIndex() {
    return indexedPageCount() > 0;
  }

  function scoreResult(normalizedText, tokens, normalizedPhrase, page) {
    let score = 0;
    if (normalizedPhrase && normalizedText.includes(normalizedPhrase)) score += 80;
    tokens.forEach((token) => {
      const firstIndex = normalizedText.indexOf(token);
      if (firstIndex !== -1) {
        score += 14;
        if (/^\d+$/.test(token)) score += 20;
        if (firstIndex < 80) score += 6;
      }
    });
    score += Math.max(0, 8 - Math.min(8, page / 10));
    return score;
  }

  function makeExcerpt(text, query, maxLength = 180) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";

    const queryTokens = String(query || "").trim().split(/\s+/).filter(Boolean);
    const lowerRaw = raw.toLowerCase();
    let hit = -1;

    for (const token of queryTokens) {
      if (token.length < 2) continue;
      const index = lowerRaw.indexOf(token.toLowerCase());
      if (index !== -1) {
        hit = index;
        break;
      }
    }

    const start = hit === -1 ? 0 : Math.max(0, hit - 58);
    const end = Math.min(raw.length, start + maxLength);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < raw.length ? "…" : "";
    return `${prefix}${raw.slice(start, end)}${suffix}`;
  }

  function search(query, options = {}) {
    const tokens = tokenize(query);
    if (!tokens.length) return [];

    const normalizedPhrase = tokens.join(" ");
    const catalogId = options.catalogId || null;
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 60;
    const results = [];

    searchIndex().forEach((entry) => {
      if (!entry || !Array.isArray(entry.pages)) return;
      if (catalogId && entry.catalogId !== catalogId) return;

      const catalog = findCatalog(entry.catalogId);
      if (!catalog) return;

      entry.pages.forEach((pageInfo) => {
        const page = Number(pageInfo?.page || 0);
        const text = String(pageInfo?.text || "");
        if (!page || !text) return;

        const searchableText = [
          catalog.title,
          catalog.description,
          catalog.category,
          text
        ].filter(Boolean).join(" ");
        const normalizedText = normalize(searchableText);
        const looseText = normalizeLoose(searchableText);

        if (!tokens.every((token) => tokenMatches(normalizedText, looseText, token))) return;

        results.push({
          catalog,
          catalogId: catalog.id,
          catalogTitle: catalog.title,
          page,
          text,
          excerpt: makeExcerpt(text, query),
          score: scoreResult(normalizedText, tokens, normalizedPhrase, page),
          image: pageSrc(catalog, page),
          thumb: thumbSrc(catalog, page)
        });
      });
    });

    return results
      .sort((a, b) => b.score - a.score || (a.catalog.sort || 9999) - (b.catalog.sort || 9999) || a.page - b.page)
      .slice(0, Math.max(1, limit));
  }

  window.BargigCatalogSearch = {
    search,
    normalize,
    normalizeLoose,
    tokenize,
    hasIndex,
    indexedPageCount,
    findCatalog,
    pageSrc,
    thumbSrc,
    makeExcerpt
  };
})();
