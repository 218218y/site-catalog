/**
 * Source module: 42-search-runtime.js
 * Shared search-index lifecycle and presentation primitives.
 */

/** @typedef {{trigger?:string}} SearchIndexLoadOptions */
/** @typedef {{reader?:boolean}} SearchMarkupOptions */

import { catalogSearch } from "./03-runtime-context.js";
import { SEARCH_INDEX_PRELOAD_DELAY_MS, searchState } from "./13-search-state.js";
import { telemetryCleanText, telemetryTrackSearchIndexFailure } from "../runtime/telemetry.js";
import { isSaveDataEnabled } from "./20-catalog-runtime.js";
import { escapeHtml } from "./19-shared-pure.js";

let refreshSearchIndexStatus = () => {};

/** @param {()=>void} refresh */
function configureSearchIndexStatusRefresh(refresh) {
  refreshSearchIndexStatus = refresh;
}

/** @param {SearchIndexLoadOptions} [options] @returns {Promise<boolean>} */
function ensureSearchIndexLoaded(options = {}) {
  if (catalogSearch.isReady()) {
    searchState.searchIndexLoadState = "ready";
    return Promise.resolve(true);
  }
  if (searchState.searchIndexLoadPromise) return searchState.searchIndexLoadPromise;

  searchState.searchIndexLoadState = "loading";
  refreshSearchIndexStatus();
  const loadTrigger = telemetryCleanText(options.trigger || "interactive", 40);
  searchState.searchIndexLoadPromise = catalogSearch.ensureReady()
    .then(() => {
      searchState.searchIndexLoadState = "ready";
      searchState.searchIndexLoadPromise = null;
      refreshSearchIndexStatus();
      return true;
    })
    .catch((error) => {
      searchState.searchIndexLoadState = "error";
      searchState.searchIndexLoadPromise = null;
      telemetryTrackSearchIndexFailure("network-error", { trigger: loadTrigger });
      refreshSearchIndexStatus();
      throw error;
    });
  return searchState.searchIndexLoadPromise;
}

function scheduleSearchIndexPreload() {
  window.clearTimeout(searchState.searchIndexPreloadTimer);
  if (isSaveDataEnabled()) return;
  searchState.searchIndexPreloadTimer = window.setTimeout(() => {
    if (isSaveDataEnabled()) return;
    const preload = () => ensureSearchIndexLoaded({ trigger: "preload" }).catch(() => {});
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload, { timeout: 2500 });
    } else {
      preload();
    }
  }, SEARCH_INDEX_PRELOAD_DELAY_MS);
}

/** @param {HTMLElement|null|undefined} container */
function normalizeSearchResultsDirection(container) {
  if (!container) return;
  container.setAttribute("dir", "rtl");
}

/** @param {unknown} query @param {string} message @param {SearchMarkupOptions} [options] */
function searchEmptyStateMarkup(query, message, options = {}) {
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark"
    : "search-empty empty-state ui-state";
  const actionAttribute = reader ? "data-lightbox-empty-search-clear" : "data-empty-search-clear";
  return `
    <article class="${wrapperClass}" data-state="empty" role="status">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="10.5" cy="10.5" r="5.8"></circle>
          <path d="m15 15 4.2 4.2M8.2 8.2l4.6 4.6M12.8 8.2l-4.6 4.6"></path>
        </svg>
      </span>
      <div class="empty-state-copy">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(query)}”</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button class="button soft empty-state-action" type="button" ${actionAttribute}>נקה וחפש מחדש</button>
    </article>
  `;
}

/** @param {SearchMarkupOptions} [options] */
function searchIndexErrorMarkup(options = {}) {
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark"
    : "search-empty empty-state ui-state";
  const retryAttribute = reader ? "data-lightbox-search-index-retry" : "data-global-search-index-retry";
  return `
    <article class="${wrapperClass}" data-state="error" role="alert">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9v4.5M12 16.8h.01"/></svg>
      </span>
      <div class="empty-state-copy">
        <strong>החיפוש אינו זמין כרגע</strong>
        <p>אינדקס החיפוש לא הצליח להיטען. אפשר לנסות שוב בלי לרענן את העמוד.</p>
      </div>
      <button class="button soft empty-state-action" type="button" ${retryAttribute}>נסה לטעון שוב</button>
    </article>
  `;
}

/** @param {string} [trigger] */
async function retrySearchIndexLoad(trigger = "retry") {
  searchState.searchIndexLoadPromise = null;
  searchState.searchIndexLoadState = "idle";
  try {
    await ensureSearchIndexLoaded({ trigger });
    return true;
  } catch (_error) {
    return false;
  }
}

export {
  configureSearchIndexStatusRefresh,
  ensureSearchIndexLoaded,
  normalizeSearchResultsDirection,
  retrySearchIndexLoad,
  scheduleSearchIndexPreload,
  searchEmptyStateMarkup,
  searchIndexErrorMarkup
};
