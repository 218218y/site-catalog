(function (scope) {
  "use strict";

  const FINAL_LETTERS = new Map([
    ["ך", "כ"], ["ם", "מ"], ["ן", "נ"], ["ף", "פ"], ["ץ", "צ"]
  ]);
  const FIELD_LABELS = {
    page: "טקסט העמוד",
    title: "שם הקטלוג",
    description: "תיאור הקטלוג",
    category: "קטגוריית הקטלוג"
  };
  const YIELD_EVERY_TERM_CANDIDATES = 768;
  const MAX_TERM_CACHE = 240;

  let indexData = null;
  let vocabulary = [];
  let looseVocabulary = [];
  let directGramIndex = new Map();
  let looseGramIndex = new Map();
  let termMatchCache = new Map();
  let runtimeDiagnostics = createRuntimeDiagnostics();
  const latestRequestByChannel = new Map();

  function normalize(value) {
    let text = String(value ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[״׳'\"“”]/g, "")
      .replace(/[־–—_]/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    text = Array.from(text).map((char) => FINAL_LETTERS.get(char) || char).join("");
    return text.replace(/\s+/g, " ");
  }

  function normalizeLoose(value) {
    return normalize(value).replace(/[כ]/g, "ב");
  }

  function tokenize(value) {
    return normalize(value).split(" ").filter(Boolean);
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
      const tokens = tokenize(match[1]);
      if (tokens.length) exactTerms.push({ tokens, value: tokens.join(" ") });
      lastIndex = quotedTermPattern.lastIndex;
    }
    looseParts.push(raw.slice(lastIndex));
    return { looseTokens: tokenize(looseParts.join(" ")), exactTerms };
  }

  function requestIsCurrent(channel, requestId) {
    return latestRequestByChannel.get(channel) === requestId;
  }

  function cancellationError() {
    const error = new Error("Search request superseded");
    error.name = "SearchCancelledError";
    return error;
  }

  function createRuntimeDiagnostics() {
    return {
      indexedLookups: 0,
      fullVocabularyScans: 0,
      candidateTermsChecked: 0,
      cooperativeYields: 0,
      excerptsBuilt: 0
    };
  }

  function createWorkerQueueYield() {
    if (typeof setImmediate === "function") {
      return () => new Promise((resolve) => setImmediate(resolve));
    }
    if (typeof MessageChannel === "function") {
      const channel = new MessageChannel();
      const callbacks = [];
      channel.port1.onmessage = () => callbacks.shift()?.();
      return () => new Promise((resolve) => {
        callbacks.push(resolve);
        channel.port2.postMessage(0);
      });
    }
    return () => new Promise((resolve) => setTimeout(resolve, 0));
  }

  const cooperativeYield = createWorkerQueueYield();

  async function yieldToWorkerQueue() {
    runtimeDiagnostics.cooperativeYields += 1;
    await cooperativeYield();
  }

  function termGrams(value, size) {
    const chars = Array.from(String(value || ""));
    if (chars.length < size) return [];
    const grams = new Set();
    for (let index = 0; index <= chars.length - size; index += 1) {
      grams.add(chars.slice(index, index + size).join(""));
    }
    return Array.from(grams);
  }

  function buildGramIndex(terms) {
    const gramIndex = new Map();
    terms.forEach((term, termIndex) => {
      for (const size of [2, 3]) {
        for (const gram of termGrams(term, size)) {
          const key = `${size}:${gram}`;
          const postings = gramIndex.get(key);
          if (postings) postings.push(termIndex);
          else gramIndex.set(key, [termIndex]);
        }
      }
    });
    return gramIndex;
  }

  function candidateTermIndexes(token, gramIndex) {
    const tokenLength = Array.from(String(token || "")).length;
    if (tokenLength < 2) return null;
    const size = tokenLength >= 3 ? 3 : 2;
    const grams = termGrams(token, size);
    let candidates = null;
    for (const gram of grams) {
      const postings = gramIndex.get(`${size}:${gram}`);
      if (!postings) return [];
      candidates = candidates === null ? postings : intersectSorted(candidates, postings);
      if (!candidates.length) return [];
    }
    return candidates || [];
  }

  function cacheTermMatches(key, value) {
    if (termMatchCache.size >= MAX_TERM_CACHE) {
      const oldest = termMatchCache.keys().next().value;
      if (oldest !== undefined) termMatchCache.delete(oldest);
    }
    termMatchCache.set(key, value);
  }

  async function resolveTokenDocuments(token, channel, requestId) {
    const looseToken = token.length >= 3 ? normalizeLoose(token) : token;
    const cacheKey = `${token}\u0000${looseToken}`;
    const cached = termMatchCache.get(cacheKey);
    if (cached) return cached;

    const directCandidates = candidateTermIndexes(token, directGramIndex);
    const looseCandidates = looseToken !== token
      ? candidateTermIndexes(looseToken, looseGramIndex)
      : [];
    const candidateIndexes = new Set();

    if (directCandidates === null) {
      runtimeDiagnostics.fullVocabularyScans += 1;
      for (let index = 0; index < vocabulary.length; index += 1) candidateIndexes.add(index);
    } else {
      runtimeDiagnostics.indexedLookups += 1;
      for (const index of directCandidates) candidateIndexes.add(index);
      for (const index of looseCandidates || []) candidateIndexes.add(index);
    }

    const documentIds = new Set();
    let checked = 0;
    for (const index of candidateIndexes) {
      const directMatch = vocabulary[index].includes(token);
      const looseMatch = !directMatch
        && looseToken !== token
        && looseVocabulary[index].includes(looseToken);
      if (directMatch || looseMatch) {
        const postings = indexData.terms[vocabulary[index]] || [];
        for (const documentId of postings) documentIds.add(documentId);
      }
      checked += 1;
      if (checked % YIELD_EVERY_TERM_CANDIDATES === 0) {
        await yieldToWorkerQueue();
        if (!requestIsCurrent(channel, requestId)) throw cancellationError();
      }
    }
    runtimeDiagnostics.candidateTermsChecked += checked;
    const result = Array.from(documentIds).sort((a, b) => a - b);
    cacheTermMatches(cacheKey, result);
    return result;
  }

  function intersectSorted(left, right) {
    const output = [];
    let a = 0;
    let b = 0;
    while (a < left.length && b < right.length) {
      if (left[a] === right[b]) {
        output.push(left[a]);
        a += 1;
        b += 1;
      } else if (left[a] < right[b]) {
        a += 1;
      } else {
        b += 1;
      }
    }
    return output;
  }

  function textMatchesToken(normalizedText, token) {
    if (normalizedText.includes(token)) return true;
    if (token.length < 3) return false;
    const looseToken = normalizeLoose(token);
    return looseToken !== token && normalizeLoose(normalizedText).includes(looseToken);
  }

  function exactTermsMatchFields(normalizedFields, exactTerms) {
    return exactTerms.every((term) =>
      normalizedFields.some((field) => field && field.includes(term.value))
    );
  }

  function matchingFields(document, catalog, parsedQuery, allTokens) {
    const fields = [
      ["page", document.normalized],
      ["title", catalog.normalized.title],
      ["description", catalog.normalized.description],
      ["category", catalog.normalized.category]
    ];
    const matches = [];
    for (const [name, normalizedText] of fields) {
      if (!normalizedText) continue;
      const tokenMatch = allTokens.some((token) => textMatchesToken(normalizedText, token));
      const phraseMatch = parsedQuery.exactTerms.some((term) => normalizedText.includes(term.value));
      if (tokenMatch || phraseMatch) matches.push(name);
    }
    return matches;
  }

  function scoreDocument(document, catalog, parsedQuery, matchedFields, allTokens) {
    let score = 0;
    const weights = { title: 90, page: 55, description: 28, category: 22 };
    for (const field of matchedFields) score += weights[field] || 0;
    for (const term of parsedQuery.exactTerms) {
      if (document.normalized.includes(term.value)) score += 95;
      if (catalog.normalized.title.includes(term.value)) score += 120;
    }
    for (const token of allTokens) {
      const pageIndex = document.normalized.indexOf(token);
      if (pageIndex !== -1) {
        score += 18;
        if (pageIndex < 90) score += 8;
      }
      if (catalog.normalized.title.includes(token)) score += 44;
      if (/^\d+$/.test(token)) score += 22;
    }
    score += Math.max(0, 8 - Math.min(8, document.page / 10));
    return score;
  }

  function normalizeWithMap(rawValue) {
    const raw = String(rawValue || "");
    const chars = [];
    const positions = [];
    let pendingSpacePosition = -1;
    let rawOffset = 0;

    for (const sourceChar of raw) {
      const sourcePosition = rawOffset;
      rawOffset += sourceChar.length;
      const decomposed = sourceChar.toLowerCase().normalize("NFKD");
      for (const char of decomposed) {
        if (/\p{M}/u.test(char)) continue;
        if (/[״׳'\"“”]/.test(char)) continue;
        const normalizedChar = FINAL_LETTERS.get(char) || char;
        if (/^[\p{L}\p{N}]$/u.test(normalizedChar)) {
          if (pendingSpacePosition >= 0 && chars.length) {
            chars.push(" ");
            positions.push(pendingSpacePosition);
          }
          pendingSpacePosition = -1;
          chars.push(normalizedChar);
          positions.push(sourcePosition);
        } else if (chars.length) {
          pendingSpacePosition = sourcePosition;
        }
      }
    }
    return { normalized: chars.join(""), positions };
  }

  function mergeRanges(ranges) {
    const sorted = ranges
      .filter((range) => range.end > range.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const range of sorted) {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else merged.push({ start: range.start, end: range.end });
    }
    return merged.slice(0, 10);
  }

  function excerptForField(rawText, parsedQuery, maxLength = 190) {
    const raw = String(rawText || "").replace(/\s+/g, " ").trim();
    if (!raw) return { text: "", highlights: [] };
    const mapped = normalizeWithMap(raw);
    const needles = [
      ...parsedQuery.exactTerms.map((term) => term.value),
      ...parsedQuery.looseTokens,
      ...parsedQuery.exactTerms.flatMap((term) => term.tokens)
    ].filter(Boolean);

    let firstNormalizedIndex = -1;
    for (const needle of needles) {
      const direct = mapped.normalized.indexOf(needle);
      if (direct !== -1 && (firstNormalizedIndex === -1 || direct < firstNormalizedIndex)) {
        firstNormalizedIndex = direct;
      }
    }
    const rawHit = firstNormalizedIndex >= 0
      ? (mapped.positions[firstNormalizedIndex] ?? 0)
      : 0;
    let start = Math.max(0, rawHit - 62);
    let end = Math.min(raw.length, start + maxLength);
    if (end === raw.length) start = Math.max(0, end - maxLength);

    const rangeCandidates = [];
    for (const needle of needles) {
      let offset = 0;
      while (offset < mapped.normalized.length) {
        const found = mapped.normalized.indexOf(needle, offset);
        if (found === -1) break;
        const rawStart = mapped.positions[found] ?? 0;
        const mappedEnd = found + Math.max(1, needle.length) - 1;
        const rawEnd = (mapped.positions[mappedEnd] ?? rawStart) + 1;
        if (rawEnd > start && rawStart < end) {
          rangeCandidates.push({
            start: Math.max(rawStart, start) - start,
            end: Math.min(rawEnd, end) - start
          });
        }
        offset = found + Math.max(1, needle.length);
      }
    }

    return {
      text: `${start > 0 ? "…" : ""}${raw.slice(start, end)}${end < raw.length ? "…" : ""}`,
      highlights: mergeRanges(rangeCandidates).map((range) => ({
        start: range.start + (start > 0 ? 1 : 0),
        end: range.end + (start > 0 ? 1 : 0)
      }))
    };
  }

  function resultExcerpt(document, catalog, matchedFields, parsedQuery) {
    runtimeDiagnostics.excerptsBuilt += 1;
    const primaryField = matchedFields.includes("page")
      ? "page"
      : matchedFields.includes("title")
        ? "title"
        : matchedFields.includes("description")
          ? "description"
          : "category";
    const rawByField = {
      page: document.text,
      title: catalog.title,
      description: catalog.description,
      category: catalog.category
    };
    const excerpt = excerptForField(rawByField[primaryField], parsedQuery);
    return {
      ...excerpt,
      field: primaryField,
      reason: `התאמה ב${FIELD_LABELS[primaryField]}`
    };
  }

  async function searchIndex(query, options = {}, control = {}) {
    if (!indexData) throw new Error("Search index is not initialized");
    const parsedQuery = parseQuery(query);
    const allTokens = Array.from(new Set([
      ...parsedQuery.looseTokens,
      ...parsedQuery.exactTerms.flatMap((term) => term.tokens)
    ]));
    if (!allTokens.length) return [];

    const channel = String(control.channel || "default");
    const requestId = Number(control.requestId || 0);
    let candidates = null;
    for (const token of allTokens) {
      const matches = await resolveTokenDocuments(token, channel, requestId);
      if (!requestIsCurrent(channel, requestId)) throw cancellationError();
      candidates = candidates === null ? matches : intersectSorted(candidates, matches);
      if (!candidates.length) return [];
    }

    const catalogId = String(options.catalogId || "");
    const category = normalize(options.category || "");
    const limit = Math.max(1, Math.min(120, Number(options.limit) || 60));
    const results = [];
    for (const documentId of candidates || []) {
      if (!requestIsCurrent(channel, requestId)) throw cancellationError();
      const document = indexData.documents[documentId];
      const catalog = indexData.catalogs[document.catalog];
      if (!catalog) continue;
      if (catalogId && catalog.id !== catalogId) continue;
      if (category && catalog.normalized.category !== category) continue;
      const normalizedFields = [
        catalog.normalized.title,
        catalog.normalized.description,
        catalog.normalized.category,
        document.normalized
      ];
      if (!exactTermsMatchFields(normalizedFields, parsedQuery.exactTerms)) continue;
      const matchedFields = matchingFields(document, catalog, parsedQuery, allTokens);
      results.push({
        catalogId: catalog.id,
        catalogTitle: catalog.title,
        page: document.page,
        score: scoreDocument(document, catalog, parsedQuery, matchedFields, allTokens),
        matchedFields,
        document,
        catalog
      });
    }

    return results
      .sort((a, b) => b.score - a.score || a.catalogTitle.localeCompare(b.catalogTitle, "he") || a.page - b.page)
      .slice(0, limit)
      .map((result) => {
        const excerpt = resultExcerpt(result.document, result.catalog, result.matchedFields, parsedQuery);
        return {
          resultType: "ocr",
          catalogId: result.catalogId,
          catalogTitle: result.catalogTitle,
          page: result.page,
          score: result.score,
          excerpt: excerpt.text,
          highlights: excerpt.highlights,
          matchField: excerpt.field,
          matchReason: excerpt.reason,
          matchedFields: result.matchedFields
        };
      });
  }

  function initializeIndex(payload) {
    if (!payload || payload.version !== 1 || !Array.isArray(payload.documents) || !payload.terms) {
      throw new Error("Unsupported or invalid catalog search index");
    }
    indexData = payload;
    vocabulary = Object.keys(payload.terms);
    looseVocabulary = vocabulary.map((term) => normalizeLoose(term));
    directGramIndex = buildGramIndex(vocabulary);
    looseGramIndex = buildGramIndex(looseVocabulary);
    termMatchCache = new Map();
    runtimeDiagnostics = createRuntimeDiagnostics();
    return {
      stats: payload.stats || { catalogs: 0, pages: 0, tokens: 0, categoryPages: {} },
      catalogs: payload.catalogs.map((catalog) => ({
        id: catalog.id,
        category: catalog.category
      }))
    };
  }

  async function loadIndex(indexUrl) {
    const response = await fetch(indexUrl, { credentials: "same-origin", cache: "force-cache" });
    if (!response.ok) throw new Error(`Search index request failed (${response.status})`);
    return initializeIndex(await response.json());
  }

  const api = {
    normalize,
    normalizeLoose,
    tokenize,
    parseQuery,
    initializeIndex,
    searchIndex,
    excerptForField,
    testing: Object.freeze({
      normalizeWithMap,
      diagnostics() {
        return { ...runtimeDiagnostics };
      },
      reset(options = {}) {
        runtimeDiagnostics = createRuntimeDiagnostics();
        if (options.clearCache) termMatchCache = new Map();
      }
    }),
    setLatestRequest(channel, requestId) {
      latestRequestByChannel.set(String(channel), Number(requestId));
    }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (scope && typeof scope.addEventListener === "function" && typeof scope.postMessage === "function") {
    scope.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type === "cancel") {
        latestRequestByChannel.set(String(message.channel || "default"), Number(message.requestId || 0));
        return;
      }
      if (message.type === "init") {
        loadIndex(message.indexUrl)
          .then((metadata) => scope.postMessage({ type: "ready", metadata }))
          .catch((error) => scope.postMessage({ type: "error", stage: "init", message: error.message }));
        return;
      }
      if (message.type !== "search") return;
      const channel = String(message.channel || "default");
      const requestId = Number(message.requestId || 0);
      latestRequestByChannel.set(channel, requestId);
      searchIndex(message.query, message.options || {}, { channel, requestId })
        .then((results) => {
          if (!requestIsCurrent(channel, requestId)) return;
          scope.postMessage({ type: "results", channel, requestId, results });
        })
        .catch((error) => {
          if (error?.name === "SearchCancelledError") return;
          scope.postMessage({ type: "error", stage: "search", channel, requestId, message: error?.message || String(error) });
        });
    });
  }
})(typeof self !== "undefined" ? self : null);
