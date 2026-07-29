/**
 * Source module: 00-navigation.js
 * Application routing, document metadata, and fullscreen-safe in-document navigation.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;
const siteRoutes = window.BargigRoutes || null;
let currentAppPage = siteRoutes?.pageFromLocation?.(window.location, document.body?.dataset?.page) || "home";
const IN_DOCUMENT_ROUTE_STATE_KEY = "__bargigInDocumentRoute";
let hasInDocumentRouteSession = false;

/** @param {string} id @returns {HTMLElement|null} */
const $ = (id) => document.getElementById(id);
/** @param {string} id @returns {HTMLButtonElement|null} */
const $button = (id) => /** @type {HTMLButtonElement|null} */ (document.getElementById(id));
/** @param {string} id @returns {HTMLAnchorElement|null} */
const $anchor = (id) => /** @type {HTMLAnchorElement|null} */ (document.getElementById(id));
/** @param {string} id @returns {HTMLInputElement|null} */
const $input = (id) => /** @type {HTMLInputElement|null} */ (document.getElementById(id));
/** @param {string} id @returns {HTMLSelectElement|null} */
const $select = (id) => /** @type {HTMLSelectElement|null} */ (document.getElementById(id));
/** @param {string} id @returns {HTMLTextAreaElement|null} */
const $textarea = (id) => /** @type {HTMLTextAreaElement|null} */ (document.getElementById(id));
/** @param {string} id @returns {HTMLImageElement|null} */
const $image = (id) => /** @type {HTMLImageElement|null} */ (document.getElementById(id));

/**
 * Resolve a DOM contract that must exist in every document loading its feature.
 * Missing required markup is an integration failure, not a nullable runtime state.
 * @param {string} id
 * @returns {HTMLElement}
 */
function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required application element is missing: #${id}`);
  return element;
}
/** @param {string} id @returns {HTMLButtonElement} */
const $requiredButton = (id) => /** @type {HTMLButtonElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLAnchorElement} */
const $requiredAnchor = (id) => /** @type {HTMLAnchorElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLInputElement} */
const $requiredInput = (id) => /** @type {HTMLInputElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLSelectElement} */
const $requiredSelect = (id) => /** @type {HTMLSelectElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLTextAreaElement} */
const $requiredTextarea = (id) => /** @type {HTMLTextAreaElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLImageElement} */
const $requiredImage = (id) => /** @type {HTMLImageElement} */ (requiredElement(id));

/** @param {string} page */
function isAppPage(page) {
  return currentAppPage === page;
}

/** @param {string} page */
function setCurrentAppPage(page) {
  currentAppPage = siteRoutes?.normalizePage?.(page) || String(page || "home");
  if (document.body) document.body.dataset.page = currentAppPage;
}

/** @param {Record<string, unknown>} [values] */
function historyStateWithRouteData(values = {}) {
  const currentState = history.state && typeof history.state === "object" ? history.state : {};
  return { ...currentState, [IN_DOCUMENT_ROUTE_STATE_KEY]: true, ...values };
}

function saveCurrentRouteScrollPosition() {
  if (!window.history?.replaceState) return;
  history.replaceState(historyStateWithRouteData({
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0
  }), "", window.location.href);
}

/** @param {URL} url */
function isInternalAppDocumentUrl(url) {
  return Boolean(
    url &&
    siteRoutes?.isSameAppDocumentLocation?.(window.location, url, currentAppPage)
  );
}

/** @param {URL} url */
function canNavigateWithinCurrentDocument(url) {
  return Boolean(
    featureCapabilities.viewer &&
    getFeatureInterface("viewer")?.usesInDocumentFullscreenNavigation?.() &&
    isInternalAppDocumentUrl(url)
  );
}

/** @param {URL} url @param {{replace?:boolean}} [options] */
function navigateWithinCurrentDocument(url, options = {}) {
  hasInDocumentRouteSession = true;
  saveCurrentRouteScrollPosition();

  const nextState = historyStateWithRouteData({ scrollX: 0, scrollY: 0 });
  const sameUrl = url.href === window.location.href;
  if (options.replace || sameUrl) history.replaceState(nextState, "", url.href);
  else history.pushState(nextState, "", url.href);

  initDocumentRoute({ scrollPosition: { x: 0, y: 0 } });
}

/** @param {string} relativeUrl @param {{replace?:boolean}} [options] */
function navigateTo(relativeUrl, options = {}) {
  const target = String(relativeUrl || "").trim();
  if (!target) return;

  let targetUrl = null;
  try {
    targetUrl = new URL(target, document.baseURI || window.location.href);
  } catch (_error) {
    targetUrl = null;
  }

  if (targetUrl && canNavigateWithinCurrentDocument(targetUrl)) {
    navigateWithinCurrentDocument(targetUrl, options);
    return;
  }

  if (options.replace) window.location.replace(targetUrl?.href || target);
  else window.location.assign(targetUrl?.href || target);
}

function navigateBack() {
  window.history.back();
}

/** @param {MouseEvent} event */
function handleInternalAppLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!featureCapabilities.viewer || !getFeatureInterface("viewer")?.usesInDocumentFullscreenNavigation?.()) return;

  const link = eventTargetElement(event.target)?.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

  let targetUrl = null;
  try {
    targetUrl = new URL(link.href, window.location.href);
  } catch (_error) {
    return;
  }

  const sameDocumentHashNavigation = targetUrl.pathname === window.location.pathname
    && targetUrl.search === window.location.search
    && targetUrl.hash
    && targetUrl.hash !== window.location.hash;
  if (sameDocumentHashNavigation || !canNavigateWithinCurrentDocument(targetUrl)) return;

  event.preventDefault();
  navigateWithinCurrentDocument(targetUrl);
}

function markAppReady() {
  document.body?.setAttribute("data-app-ready", "true");
}

function canReturnToSameSite() {
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch (_error) {
    return false;
  }
}

function homeDocumentUrl() {
  return siteRoutes?.homeUrl?.() || "index.html";
}

/** @param {string} catalogId */
function catalogDocumentUrl(catalogId) {
  return siteRoutes?.catalogUrl?.(catalogId) || `/catalog/${encodeURIComponent(String(catalogId || ""))}/`;
}

function favoritesDocumentUrl() {
  return siteRoutes?.favoritesUrl?.() || "favorites.html";
}

/** @param {string} catalogId @param {number} [page] @param {Record<string, unknown>} [options] */
function viewerDocumentUrl(catalogId, page = 1, options = {}) {
  return siteRoutes?.viewerUrl?.(catalogId, page, options) || `/catalog/${encodeURIComponent(String(catalogId || ""))}/page/${Math.max(1, Number.parseInt(String(page), 10) || 1)}/`;
}

/** @param {string} categorySlugValue @param {string} [subcategorySlugValue] */
function categoryDocumentUrl(categorySlugValue, subcategorySlugValue = "") {
  return siteRoutes?.categoryUrl?.(categorySlugValue, subcategorySlugValue) || homeDocumentUrl();
}

/** @param {string} relativeUrl */
function absoluteDocumentUrl(relativeUrl) {
  return new URL(relativeUrl, document.baseURI || window.location.href).href;
}

/** @param {string} selector @param {string|undefined} value @param {string} [attribute] */
function setMetadataContent(selector, value, attribute = "content") {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute(attribute, value);
}

/** @param {CatalogRecord|null} [catalog] */
function currentDocumentMetadata(catalog = navigationState?.catalog || null) {
  const brand = "רהיטי ברגיג";
  if (isAppPage("catalog") && catalog) {
    return {
      title: `${catalog.title} | קטלוג ריהוט | ${brand}`,
      description: `${catalog.description || "קטלוג ריהוט"}. צפייה נוחה ב־${catalog.pages} עמודי הקטלוג.`,
      url: absoluteDocumentUrl(catalogDocumentUrl(catalog.id)),
      image: coverThumbSrc(catalog),
      imageAlt: `שער ${catalog.title}`
    };
  }
  if (isAppPage("viewer") && catalog) {
    return {
      title: `${catalog.title} — עמוד ${navigationState.page} | ${brand}`,
      description: `צפייה בעמוד ${navigationState.page} מתוך ${catalog.pages} בקטלוג ${catalog.title}.`,
      url: absoluteDocumentUrl(viewerDocumentUrl(catalog.id, navigationState.page)),
      image: pageSrc(catalog, navigationState.page),
      imageAlt: `${catalog.title} — עמוד ${navigationState.page}`
    };
  }
  if (isAppPage("favorites")) {
    return {
      title: `המועדפים שלי | ${brand}`,
      description: "עמודי הקטלוג ששמרת במועדפים, עם הערות, סינון ושיתוף מרוכז.",
      url: absoluteDocumentUrl(favoritesDocumentUrl())
    };
  }
  return {
    title: `קטלוגים | ${brand}`,
    description: "גלריית הקטלוגים של רהיטי ברגיג — בחירת קטלוג, חיפוש מהיר ופתיחה נוחה.",
    url: absoluteDocumentUrl(homeDocumentUrl())
  };
}

/** @param {CatalogRecord|null} [catalog] */
function updateDocumentMetadata(catalog = navigationState?.catalog || null) {
  const metadata = currentDocumentMetadata(catalog);
  document.title = metadata.title;
  setMetadataContent('meta[name="description"]', metadata.description);
  setMetadataContent('link[rel="canonical"]', metadata.url, "href");
  setMetadataContent('meta[property="og:title"]', metadata.title);
  setMetadataContent('meta[property="og:description"]', metadata.description);
  setMetadataContent('meta[property="og:url"]', metadata.url);
  setMetadataContent('meta[name="twitter:title"]', metadata.title);
  setMetadataContent('meta[name="twitter:description"]', metadata.description);
  if (metadata.image) {
    setMetadataContent('meta[property="og:image"]', metadata.image);
    setMetadataContent('meta[property="og:image:secure_url"]', metadata.image);
    setMetadataContent('meta[property="og:image:alt"]', metadata.imageAlt || metadata.title);
    setMetadataContent('meta[name="twitter:image"]', metadata.image);
    setMetadataContent('meta[name="twitter:image:alt"]', metadata.imageAlt || metadata.title);
  }
}

function attachNavigationEvents() {
  document.addEventListener("click", handleInternalAppLinkClick);

  window.addEventListener("popstate", (event) => {
    const routeState = event.state && typeof event.state === "object" ? event.state : null;
    if (!hasInDocumentRouteSession && !routeState?.[IN_DOCUMENT_ROUTE_STATE_KEY]) return;

    hasInDocumentRouteSession = true;
    initDocumentRoute({
      scrollPosition: {
        x: routeState?.scrollX || 0,
        y: routeState?.scrollY || 0
      }
    });
  });

  window.addEventListener("hashchange", () => {
    if (!isAppPage("home")) return;
    getFeatureInterface("catalog-grid")?.syncCategoryFocusFromHash?.();
  });
}
