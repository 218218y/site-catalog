"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "catalog-search-worker.js"));
const index = JSON.parse(fs.readFileSync(path.join(root, "catalogs.search-index.json"), "utf8"));
const metadata = engine.initializeIndex(index);

assert.equal(metadata.stats.pages, index.documents.length);
assert.equal(metadata.stats.catalogs, index.catalogs.length);
assert.ok(metadata.stats.pages >= 800, "performance test must use the real production-size page corpus");
assert.ok(metadata.stats.tokens > 1000, "normalized inverted index should contain a real vocabulary");


function resultKey(catalogId, page) {
  return `${catalogId}\u0000${page}`;
}

function expectedResultKeysForToken(token) {
  const normalizedToken = engine.normalize(token);
  const looseToken = normalizedToken.length >= 3 ? engine.normalizeLoose(normalizedToken) : normalizedToken;
  const documentIds = new Set();
  for (const [term, postings] of Object.entries(index.terms)) {
    const directMatch = term.includes(normalizedToken);
    const looseMatch = !directMatch
      && looseToken !== normalizedToken
      && engine.normalizeLoose(term).includes(looseToken);
    if (!directMatch && !looseMatch) continue;
    for (const documentId of postings) documentIds.add(documentId);
  }
  return new Set(Array.from(documentIds, (documentId) => {
    const document = index.documents[documentId];
    const catalog = index.catalogs[document.catalog];
    return resultKey(catalog.id, document.page);
  }));
}

function begin(channel) {
  const requestId = Math.floor(performance.now() * 1000) + Math.floor(Math.random() * 1000);
  engine.setLatestRequest(channel, requestId);
  return requestId;
}

(async () => {
  const sourceDocumentId = index.documents.findIndex((document) =>
    document.normalized.split(" ").some((token) => token.length >= 5 && (index.terms[token] || []).length <= 12)
  );
  assert.notEqual(sourceDocumentId, -1, "fixture must contain a selective page token");
  const sourceDocument = index.documents[sourceDocumentId];
  const selectiveToken = sourceDocument.normalized.split(" ").find((token) =>
    token.length >= 5 && (index.terms[token] || []).length <= 12
  );

  const requestId = begin("correctness");
  const results = await engine.searchIndex(
    selectiveToken,
    { limit: 30 },
    { channel: "correctness", requestId }
  );
  const sourceCatalog = index.catalogs[sourceDocument.catalog];
  const matchingResult = results.find((result) =>
    result.catalogId === sourceCatalog.id && result.page === sourceDocument.page
  );
  assert.ok(matchingResult, "selective page token should return its source page");
  assert.equal(matchingResult.matchField, "page");
  assert.match(matchingResult.matchReason, /טקסט העמוד/);
  assert.ok(matchingResult.excerpt.length > 0);
  assert.ok(matchingResult.highlights.length > 0, "result excerpt should identify highlighted ranges");

  const phraseTokens = sourceDocument.normalized.split(" ").filter((token) => token.length >= 3).slice(0, 2);
  if (phraseTokens.length === 2) {
    const phraseRequest = begin("phrase");
    const phraseResults = await engine.searchIndex(
      `"${phraseTokens.join(" ")}"`,
      { limit: 30 },
      { channel: "phrase", requestId: phraseRequest }
    );
    assert.ok(
      phraseResults.some((result) => result.catalogId === sourceCatalog.id && result.page === sourceDocument.page),
      "quoted phrase search should preserve contiguous matching"
    );
  }

  const metadataOnlyCatalogIndex = index.catalogs.findIndex((catalog, catalogIndex) => {
    const documents = index.documents.filter((document) => document.catalog === catalogIndex);
    return documents.length > 0 && documents.every((document) => !document.normalized);
  });
  assert.notEqual(metadataOnlyCatalogIndex, -1, "real corpus should cover a metadata-only/image catalog");
  const metadataOnlyCatalog = index.catalogs[metadataOnlyCatalogIndex];
  const metadataToken = metadataOnlyCatalog.normalized.title.split(" ").find((token) => token.length >= 4);
  const metadataRequest = begin("metadata-only");
  const metadataResults = await engine.searchIndex(
    metadataToken,
    { catalogId: metadataOnlyCatalog.id, limit: 120 },
    { channel: "metadata-only", requestId: metadataRequest }
  );
  const metadataDocumentCount = index.documents.filter((document) => document.catalog === metadataOnlyCatalogIndex).length;
  assert.equal(metadataResults.length, metadataDocumentCount, "metadata search should retain every image-only page");
  assert.ok(metadataResults.every((result) => result.matchField === "title"));
  assert.ok(metadataResults.every((result) => result.excerpt.length > 0));

  let partialCase = null;
  const checkedPartialFragments = new Set();
  for (const term of Object.keys(index.terms)) {
    const chars = Array.from(term);
    if (chars.length < 4) continue;
    const fragment = chars.slice(1, 3).join("");
    if (checkedPartialFragments.has(fragment)) continue;
    checkedPartialFragments.add(fragment);
    const expected = expectedResultKeysForToken(fragment);
    if (expected.size >= 2 && expected.size <= 120) {
      partialCase = { term, fragment, expected };
      break;
    }
  }
  assert.ok(partialCase, "real corpus should contain a selective two-character substring case");
  const partialRequest = begin("partial-bigram");
  const partialResults = await engine.searchIndex(
    partialCase.fragment,
    { limit: 120 },
    { channel: "partial-bigram", requestId: partialRequest }
  );
  assert.deepEqual(
    new Set(partialResults.map((result) => resultKey(result.catalogId, result.page))),
    partialCase.expected,
    "two-character substring lookup must preserve the complete brute-force result set"
  );

  let looseCase = null;
  for (const term of Object.keys(index.terms)) {
    if (term.length < 3 || engine.normalizeLoose(term) === term) continue;
    const expected = expectedResultKeysForToken(term);
    if (expected.size >= 2 && expected.size <= 120) {
      looseCase = { term, expected };
      break;
    }
  }
  assert.ok(looseCase, "real corpus should contain a selective loose-normalization case");
  const looseRequest = begin("loose-gram");
  const looseResults = await engine.searchIndex(
    looseCase.term,
    { limit: 120 },
    { channel: "loose-gram", requestId: looseRequest }
  );
  assert.deepEqual(
    new Set(looseResults.map((result) => resultKey(result.catalogId, result.page))),
    looseCase.expected,
    "loose-normalized gram lookup must preserve the complete brute-force result set"
  );

  const categoryRequest = begin("category");
  const categoryResults = await engine.searchIndex(
    selectiveToken,
    { category: sourceCatalog.category, limit: 30 },
    { channel: "category", requestId: categoryRequest }
  );
  assert.ok(categoryResults.every((result) => {
    const catalog = index.catalogs.find((item) => item.id === result.catalogId);
    return catalog?.category === sourceCatalog.category;
  }));

  const broadToken = Object.entries(index.terms)
    .filter(([token]) => token.length >= 1)
    .sort((left, right) => right[1].length - left[1].length)[0][0].slice(0, 1);
  const staleRequest = begin("cancellation");
  const stalePromise = engine.searchIndex(
    broadToken,
    { limit: 72 },
    { channel: "cancellation", requestId: staleRequest }
  );
  assert.ok(
    engine.testing.diagnostics().cooperativeYields > 0,
    "broad stale query should yield before cancellation"
  );
  const currentRequest = staleRequest + 1;
  engine.setLatestRequest("cancellation", currentRequest);
  const currentPromise = engine.searchIndex(
    selectiveToken,
    { limit: 20 },
    { channel: "cancellation", requestId: currentRequest }
  );
  await assert.rejects(stalePromise, (error) => error?.name === "SearchCancelledError");
  assert.ok((await currentPromise).length > 0);

  const representativeTokens = Object.entries(index.terms)
    .filter(([token, postings]) => token.length >= 2 && postings.length >= 2)
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 10)
    .map(([token]) => token);
  engine.testing.reset({ clearCache: true });
  const timings = [];
  for (const token of representativeTokens) {
    const perfRequest = begin("performance");
    const started = performance.now();
    await engine.searchIndex(token, { limit: 72 }, { channel: "performance", requestId: perfRequest });
    timings.push(performance.now() - started);
  }
  timings.sort((a, b) => a - b);
  const median = timings[Math.floor(timings.length / 2)] || 0;
  const p95 = timings[Math.min(timings.length - 1, Math.ceil(timings.length * 0.95) - 1)] || 0;
  const performanceDiagnostics = engine.testing.diagnostics();
  assert.equal(
    performanceDiagnostics.fullVocabularyScans,
    0,
    "normal two-character-or-longer searches must use the gram index instead of scanning the vocabulary"
  );
  assert.equal(
    performanceDiagnostics.cooperativeYields,
    0,
    "indexed representative searches should not need timer-based cooperative yields"
  );
  assert.ok(
    performanceDiagnostics.candidateTermsChecked < index.stats.tokens * representativeTokens.length * 0.2,
    "gram lookup should eliminate at least 80% of vocabulary candidate checks"
  );
  assert.ok(
    performanceDiagnostics.excerptsBuilt <= representativeTokens.length * 72,
    "excerpt normalization must run only after ranking has applied the result limit"
  );
  assert.ok(median < 140, `real-index median search latency ${median.toFixed(1)}ms exceeds 140ms`);
  assert.ok(p95 < 320, `real-index p95 search latency ${p95.toFixed(1)}ms exceeds 320ms`);

  const weakDeviceStarted = performance.now();
  for (let pass = 0; pass < 4; pass += 1) {
    const weakRequest = begin("weak-device-workload");
    await engine.searchIndex(
      representativeTokens[pass % representativeTokens.length],
      { limit: 72 },
      { channel: "weak-device-workload", requestId: weakRequest }
    );
  }
  const weakDeviceWorkload = performance.now() - weakDeviceStarted;
  assert.ok(
    weakDeviceWorkload < 1200,
    `fourfold weak-device workload ${weakDeviceWorkload.toFixed(1)}ms exceeds 1200ms`
  );

  console.log(
    `catalog_search_worker.test.js: PASS (${index.documents.length} pages, median ${median.toFixed(1)}ms, p95 ${p95.toFixed(1)}ms)`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
