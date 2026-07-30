/**
 * Source module: 80-app-shell.js
 * Application orchestration through typed feature contracts only.
 *
 * Business behavior remains inside its owning feature. This module coordinates
 * route transitions, global browser events, and startup order.
 */

import { favoritesDocumentUrl, homeDocumentUrl, navigateTo, updateDocumentMetadata } from "./00-navigation.js";
import { catalogs, siteRoutes } from "./03-runtime-context.js";
import { bindFeatureEventsOnce, getFeatureInterface, registerFeatureInterface, requireFeatureInterface } from "./10-app-state.js";
import { LIGHTBOX_SOURCE_CATALOG, LIGHTBOX_SOURCE_FAVORITES } from "./11-navigation-state.js";
import { telemetryInit } from "./15-telemetry.js";
import { clearActiveLocation, navigationFeature } from "./18-navigation-feature.js";
import { findCatalogById, handleTopLayerEscape, initImagePlaceholderObserver, recoverCatalogImageAfterInitialFailure, syncDocumentLock } from "./20-shared-ui.js";

function attachShellEvents() {
  const catalogGrid = requireFeatureInterface("catalog-grid");
  const search = requireFeatureInterface("search");

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!catalogGrid.containsMenuTarget(target)) catalogGrid.closeMobileMenu();

    if (search.handleDocumentPointer(target)) return;

    const catalogDetail = getFeatureInterface("catalog-detail");
    if (catalogDetail?.containsTarget(target)) return;
    catalogDetail?.close();
  });

  window.addEventListener("resize", () => {
    catalogGrid.handleResize();
    search.handleResize();
    getFeatureInterface("viewer")?.handleResize();
  });

  window.addEventListener("scroll", () => {
    search.handleScroll();
    catalogGrid.handleScroll();
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (handleTopLayerEscape(event)) return;
    getFeatureInterface("viewer")?.handleGlobalKeydown(event);
  });
}

function attachFeatureEvents() {
  const catalogGrid = requireFeatureInterface("catalog-grid");
  const search = requireFeatureInterface("search");
  const favorites = requireFeatureInterface("favorites");

  bindFeatureEventsOnce("catalog-grid", catalogGrid.attachEvents);
  bindFeatureEventsOnce("search-ui", search.attachEvents);
  bindFeatureEventsOnce("shell", attachShellEvents);
  bindFeatureEventsOnce("favorites-share", favorites.attachEvents);

  const inquiry = getFeatureInterface("inquiry");
  if (inquiry) bindFeatureEventsOnce("inquiry", inquiry.attachEvents);

  const viewer = getFeatureInterface("viewer");
  if (viewer) bindFeatureEventsOnce("viewer", viewer.attachEvents);

  bindFeatureEventsOnce("navigation", navigationFeature().attachEvents);
}

/** @param {string} nextPage */
function prepareDocumentRoute(nextPage) {
  const favorites = requireFeatureInterface("favorites");
  const catalogGrid = requireFeatureInterface("catalog-grid");
  const search = requireFeatureInterface("search");

  getFeatureInterface("viewer")?.prepareRoute(nextPage);
  favorites.prepareRoute(nextPage);
  catalogGrid.prepareRoute(nextPage);
  search.prepareRoute(nextPage);
  navigationFeature().setAppPage(nextPage);
  navigationFeature().syncRouteShell(nextPage);
  syncDocumentLock();
}

/** @param {{scrollPosition?:ScrollPosition|null}} [options] */
function initDocumentRoute(options = {}) {
  const route = siteRoutes.parseLocation(window.location, navigationFeature().appPage());
  const favorites = requireFeatureInterface("favorites");
  const catalogGrid = requireFeatureInterface("catalog-grid");

  prepareDocumentRoute(route.page);
  if (route.page === "home") {
    clearActiveLocation();
    catalogGrid.syncCategoryFocusFromHash({
      animate: false,
      scroll: Boolean(window.location.hash)
    });
    updateDocumentMetadata();
    if (!window.location.hash) navigationFeature().restoreScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "favorites") {
    clearActiveLocation();
    favorites.openRoute();
    navigationFeature().restoreScroll(options.scrollPosition);
    return true;
  }

  const catalog = findCatalogById(route.catalogId);
  if (!catalog) {
    navigateTo(homeDocumentUrl(), { replace: true });
    return false;
  }

  if (route.page === "catalog") {
    catalogGrid.openCatalog(catalog.id, { scrollBehavior: "auto" });
    navigationFeature().restoreScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "viewer") {
    if (route.source === LIGHTBOX_SOURCE_FAVORITES) {
      const entries = favorites.entries();
      const favoriteIndex = entries.findIndex((entry) => entry.catalog.id === catalog.id && entry.page === route.currentPage);
      if (favoriteIndex < 0) {
        navigateTo(favoritesDocumentUrl(), { replace: true });
        return false;
      }
      getFeatureInterface("viewer")?.openCatalog(catalog.id, route.currentPage, {
        source: LIGHTBOX_SOURCE_FAVORITES,
        favoriteIndex
      });
      return true;
    }

    getFeatureInterface("viewer")?.openCatalog(catalog.id, route.currentPage);
    return true;
  }

  navigateTo(homeDocumentUrl(), { replace: true });
  return false;
}

function initializeApplicationShell() {
  const catalogGrid = requireFeatureInterface("catalog-grid");
  const search = requireFeatureInterface("search");
  const favorites = requireFeatureInterface("favorites");

  telemetryInit({ recoverCatalogImageAfterInitialFailure });
  catalogGrid.initialize();
  initImagePlaceholderObserver();
  attachFeatureEvents();
  search.initialize();
  favorites.syncUi();

  if (!catalogs.length) {
    catalogGrid.renderEmptyState();
    return true;
  }

  catalogGrid.renderInitialContent();
  return initDocumentRoute();
}

registerFeatureInterface("app-shell", {
  initialize: initializeApplicationShell,
  renderRoute: initDocumentRoute
});

export { initDocumentRoute };
