# Catalog search architecture

## Goal

Interactive search must remain responsive on weak mobile devices while searching the complete production corpus. The browser therefore never normalizes and scans every page on each keystroke.

## Build-time index

`tools/catalog_search_index.py` compiles `catalogs.search-index.json` from the canonical catalog compiler model. It performs Unicode normalization once and stores:

- normalized catalog title, description and category metadata;
- raw and normalized page text for excerpts and exact phrase verification;
- a deterministic inverted index from token to sorted document IDs;
- corpus statistics and per-category page counts.

The artifact is covered by `schemas/catalogs.search-index.schema.json`, the compiler reconstructability check, deterministic byte tests and deployment fingerprint validation.

## Browser runtime

`src/runtime/catalog-search.js` is the typed source for a small external ESM client facade. The generated `catalog-search.js` stays outside the route bundles, is imported explicitly by them, and receives its own immutable fingerprint. It lazily starts `catalog-search-worker.js`, maps worker results back to catalog image URLs, and owns request lifecycle by channel. Global search and in-viewer search use separate channels.

The Worker performs candidate selection from postings, category/catalog filtering, phrase verification, scoring, excerpt selection and highlight range generation. At initialization it compiles compact bigram and trigram maps over the normalized vocabulary. Two-character and longer partial queries therefore inspect only terms that share all required grams instead of scanning the full vocabulary. One-character internal workloads retain a cooperative full-scan fallback for cancellation testing, although the public UI requires at least two characters.

Candidate documents are scored first. Unicode excerpt mapping and highlight generation run only for the bounded result set after sorting, rather than for every broad-query candidate. Cooperative yields use an immediate/message-channel task where available and fall back to a timer only on runtimes without a lower-overhead task primitive.

## Stale-result protection

Cancellation is enforced at two independent boundaries:

1. the client rejects pending promises and sends a channel cancellation marker;
2. the Worker checks the newest request ID during asynchronous work and suppresses stale replies.

The UI additionally compares a render sequence and the current query/scope before replacing DOM content. A slow earlier query therefore cannot overwrite a newer result set.

## Result explainability

Each result includes:

- catalog title and page number;
- the primary matching field;
- a Hebrew explanation such as “התאמה בטקסט העמוד”;
- a bounded excerpt from the matching field;
- exact ranges rendered with `<mark>` without injecting untrusted HTML.

## Performance verification

`tests/catalog_search_worker.test.js` runs against the checked-in production-size index rather than a miniature fixture. It records median and p95 query latency and exercises a fourfold workload representing a weak device. The contract also compares selective bigram and loose-normalization searches with a brute-force vocabulary oracle, verifies that normal queries never take the full-scan path, and enforces a minimum 80% reduction in vocabulary candidate checks. This prevents a timing threshold from hiding an algorithmic regression or a Windows timer-granularity problem.

`tests/e2e/site-catalog.spec.js` also uses Chromium CPU throttling at 4×. A heartbeat detects Main Thread stalls while rapid successive queries verify that only the latest query is rendered.

Run the focused benchmark with:

```bat
npm run test:search-performance
```

The source and deployed Worker/index sizes are guarded by `performance-budgets.json` and `tools/check_performance_budgets.py`.
