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

const $ = (id) => document.getElementById(id);

function isAppPage(page) {
  return currentAppPage === page;
}

function setCurrentAppPage(page) {
  currentAppPage = siteRoutes?.normalizePage?.(page) || String(page || "home");
  if (document.body) document.body.dataset.page = currentAppPage;
}

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

function isInternalAppDocumentUrl(url) {
  return Boolean(
    url &&
    siteRoutes?.isSameAppDocumentLocation?.(window.location, url, currentAppPage)
  );
}

function canNavigateWithinCurrentDocument(url) {
  return Boolean(
    viewerUsesInDocumentFullscreenNavigation() &&
    window.history?.pushState &&
    window.history?.replaceState &&
    isInternalAppDocumentUrl(url)
  );
}

function navigateWithinCurrentDocument(url, options = {}) {
  hasInDocumentRouteSession = true;
  saveCurrentRouteScrollPosition();

  const nextState = historyStateWithRouteData({ scrollX: 0, scrollY: 0 });
  const sameUrl = url.href === window.location.href;
  if (options.replace || sameUrl) history.replaceState(nextState, "", url.href);
  else history.pushState(nextState, "", url.href);

  initDocumentRoute({ scrollPosition: { x: 0, y: 0 } });
}

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

function handleInternalAppLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!viewerUsesInDocumentFullscreenNavigation()) return;

  const link = event.target.closest?.("a[href]");
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

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

function catalogDocumentUrl(catalogId) {
  return siteRoutes?.catalogUrl?.(catalogId) || `/catalog/${encodeURIComponent(String(catalogId || ""))}/`;
}

function favoritesDocumentUrl() {
  return siteRoutes?.favoritesUrl?.() || "favorites.html";
}

function viewerDocumentUrl(catalogId, page = 1, options = {}) {
  return siteRoutes?.viewerUrl?.(catalogId, page, options) || `/catalog/${encodeURIComponent(String(catalogId || ""))}/page/${Math.max(1, Number.parseInt(page, 10) || 1)}/`;
}

function categoryDocumentUrl(categorySlugValue, subcategorySlugValue = "") {
  return siteRoutes?.categoryUrl?.(categorySlugValue, subcategorySlugValue) || homeDocumentUrl();
}

function absoluteDocumentUrl(relativeUrl) {
  return new URL(relativeUrl, document.baseURI || window.location.href).href;
}

function setMetadataContent(selector, value, attribute = "content") {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute(attribute, value);
}

function currentDocumentMetadata(catalog = state?.catalog || null) {
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
      title: `${catalog.title} — עמוד ${state.page} | ${brand}`,
      description: `צפייה בעמוד ${state.page} מתוך ${catalog.pages} בקטלוג ${catalog.title}.`,
      url: absoluteDocumentUrl(viewerDocumentUrl(catalog.id, state.page)),
      image: pageSrc(catalog, state.page),
      imageAlt: `${catalog.title} — עמוד ${state.page}`
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

function updateDocumentMetadata(catalog = state?.catalog || null) {
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
    syncCatalogCategoryFocusFromHash();
  });
}
