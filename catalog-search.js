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

  function catalogAssetBaseUrl() {
    const rawBase = String(window.BARGIG_CATALOG_ASSET_BASE_URL || "").trim();
    if (!rawBase) return "";
    return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  }

  function isAbsoluteAssetUrl(path) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
  }

  function resolveCatalogAssetUrl(path) {
    const cleanPath = String(path || "").trim();
    if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;

    const baseUrl = catalogAssetBaseUrl();
    if (!baseUrl) return cleanPath;

    try {
      return new URL(cleanPath.replace(/^\/+/, ""), baseUrl).href;
    } catch {
      return `${baseUrl}${cleanPath.replace(/^\/+/, "")}`;
    }
  }

  function imageExt(catalog) {
    return catalog?.imageExt || "jpg";
  }

  function catalogDir(catalog) {
    return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
  }

  const ASSET_URL_SCHEMA_VERSION = 2;

  function assetVersionForTier(catalog, tier) {
    const variantVersion = String(catalog?.imageVariants?.[tier]?.version || "").trim();
    const baseVersion = variantVersion || String(catalog?.assetVersion || "").trim();
    if (!baseVersion) return "";
    return `${baseVersion}-${tier}-u${ASSET_URL_SCHEMA_VERSION}`;
  }

  function withAssetVersion(url, catalog, tier) {
    const version = assetVersionForTier(catalog, tier);
    if (!version) return url;
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
  }

  function pageSrc(catalog, page) {
    return withAssetVersion(`${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`, catalog, "full");
  }

  function thumbSrc(catalog, page) {
    return withAssetVersion(`${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`, catalog, "thumb");
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

  function parseQuery(query) {
    const raw = String(query || "");
    const exactTerms = [];
    const looseParts = [];
    let lastIndex = 0;
    const quotedTermPattern = /["“”״]([^"“”״]+)["“”״]/g;
    let match;

    while ((match = quotedTermPattern.exec(raw)) !== null) {
      looseParts.push(raw.slice(lastIndex, match.index));
      const exactTokens = tokenize(match[1]);
      if (exactTokens.length) {
        exactTerms.push({
          tokens: exactTokens,
          value: exactTokens.join(" ")
        });
      }
      lastIndex = quotedTermPattern.lastIndex;
    }

    looseParts.push(raw.slice(lastIndex));

    return {
      looseTokens: tokenize(looseParts.join(" ")),
      exactTerms
    };
  }

  function splitWords(normalizedText) {
    return String(normalizedText || "").split(" ").filter(Boolean);
  }

  function exactTermMatches(normalizedWords, term) {
    const termTokens = Array.isArray(term?.tokens) ? term.tokens : [];
    if (!termTokens.length) return false;

    if (termTokens.length === 1) {
      return normalizedWords.includes(termTokens[0]);
    }

    const lastStart = normalizedWords.length - termTokens.length;
    for (let start = 0; start <= lastStart; start += 1) {
      let matched = true;
      for (let offset = 0; offset < termTokens.length; offset += 1) {
        if (normalizedWords[start + offset] !== termTokens[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) return true;
    }
    return false;
  }

  function tokenMatches(normalizedText, looseText, token) {
    if (normalizedText.includes(token)) return true;
    if (token.length < 3) return false;
    const looseToken = normalizeLoose(token);
    return Boolean(looseToken && looseToken !== token && looseText.includes(looseToken));
  }

  function parsedQueryMatches(normalizedText, looseText, parsedQuery) {
    const looseTokens = Array.isArray(parsedQuery?.looseTokens) ? parsedQuery.looseTokens : [];
    const exactTerms = Array.isArray(parsedQuery?.exactTerms) ? parsedQuery.exactTerms : [];

    if (!looseTokens.length && !exactTerms.length) return false;
    if (!looseTokens.every((token) => tokenMatches(normalizedText, looseText, token))) return false;

    if (!exactTerms.length) return true;
    const normalizedWords = splitWords(normalizedText);
    return exactTerms.every((term) => exactTermMatches(normalizedWords, term));
  }

  function findCatalog(catalogId) {
    return catalogs().find((catalog) => catalog.id === catalogId) || null;
  }

  function catalogMatchesCategory(catalog, category) {
    const requestedCategory = String(category || "").trim();
    if (!requestedCategory) return true;
    return normalize(catalog?.category || "") === normalize(requestedCategory);
  }

  function indexedPageCount(options = {}) {
    const category = String(options.category || "").trim();
    return searchIndex().reduce((sum, entry) => {
      if (!entry || !Array.isArray(entry.pages)) return sum;
      if (!category) return sum + entry.pages.length;

      const catalog = findCatalog(entry.catalogId);
      return catalogMatchesCategory(catalog, category) ? sum + entry.pages.length : sum;
    }, 0);
  }

  function hasIndex(options = {}) {
    return indexedPageCount(options) > 0;
  }

  function scoreResult(normalizedText, parsedQuery, normalizedPhrase, page) {
    const looseTokens = Array.isArray(parsedQuery?.looseTokens) ? parsedQuery.looseTokens : [];
    const exactTerms = Array.isArray(parsedQuery?.exactTerms) ? parsedQuery.exactTerms : [];
    const scoringTokens = [
      ...looseTokens,
      ...exactTerms.flatMap((term) => Array.isArray(term.tokens) ? term.tokens : [])
    ];

    let score = 0;
    if (normalizedPhrase && normalizedText.includes(normalizedPhrase)) score += 80;
    exactTerms.forEach((term) => {
      if (term?.value && normalizedText.includes(term.value)) score += 35;
    });
    scoringTokens.forEach((token) => {
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

    const queryTokens = String(query || "").replace(/["“”״]/g, " ").trim().split(/\s+/).filter(Boolean);
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
    const parsedQuery = parseQuery(query);
    const allTokens = [
      ...parsedQuery.looseTokens,
      ...parsedQuery.exactTerms.flatMap((term) => term.tokens)
    ];
    if (!allTokens.length) return [];

    const normalizedPhrase = allTokens.join(" ");
    const catalogId = options.catalogId || null;
    const category = String(options.category || "").trim();
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 60;
    const includeExcerpt = options.includeExcerpt !== false;
    const results = [];

    searchIndex().forEach((entry) => {
      if (!entry || !Array.isArray(entry.pages)) return;
      if (catalogId && entry.catalogId !== catalogId) return;

      const catalog = findCatalog(entry.catalogId);
      if (!catalog || !catalogMatchesCategory(catalog, category)) return;

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

        if (!parsedQueryMatches(normalizedText, looseText, parsedQuery)) return;

        results.push({
          catalog,
          catalogId: catalog.id,
          catalogTitle: catalog.title,
          page,
          text,
          excerpt: includeExcerpt ? makeExcerpt(text, query) : "",
          score: scoreResult(normalizedText, parsedQuery, normalizedPhrase, page),
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
    parseQuery,
    hasIndex,
    indexedPageCount,
    findCatalog,
    pageSrc,
    thumbSrc,
    makeExcerpt,
    catalogMatchesCategory
  };
})();
