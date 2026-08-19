/**
 * Source module: 18-navigation-feature.js
 * Typed navigation owner facade and route-shell lifecycle.
 *
 * Other features must use this facade (or the registered navigation API) rather
 * than reaching into navigationState or shellElements directly.
 */

/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { LightboxSource, NavigationFeatureApi, ScrollPosition } from "../../types/frontend-contracts.js" */

import { attachNavigationEvents, currentAppPage, setCurrentAppPage } from "./00-navigation.js";
import { clampCatalogPage } from "./06-catalog-page-numbering.js";
import { getFeatureInterface, registerFeatureInterface } from "./10-app-state.js";
import { LIGHTBOX_SOURCE_FAVORITES, navigationState, shellElements } from "./11-navigation-state.js";

/** @param {string} nextPage */
function syncDocumentRouteShell(nextPage) {
  const showCatalogs = nextPage === "home";
  shellElements.catalogsSection.classList.toggle("hidden", !showCatalogs);
  if (showCatalogs) {
    shellElements.catalogsSection.removeAttribute("aria-hidden");
    shellElements.catalogsSection.classList.add("in-view");
  } else {
    shellElements.catalogsSection.setAttribute("aria-hidden", "true");
  }
}

/** @param {ScrollPosition|null} [position] */
function restoreDocumentRouteScroll(position = null) {
  if (!position) return;
  const x = Number.isFinite(Number(position.x)) ? Number(position.x) : 0;
  const y = Number.isFinite(Number(position.y)) ? Number(position.y) : 0;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.scrollTo(x, y));
  });
}

registerFeatureInterface("navigation", {
  catalog: () => navigationState.catalog,
  page: () => navigationState.page,
  source: () => navigationState.lightboxSource,
  setLocation: (catalog, page = undefined, source = navigationState.lightboxSource) => {
    navigationState.catalog = catalog;
    navigationState.page = clampCatalogPage(page, catalog);
    navigationState.lightboxSource = source;
  },
  setPage: (page) => {
    navigationState.page = clampCatalogPage(page, navigationState.catalog);
  },
  setSource: (source) => {
    navigationState.lightboxSource = source;
  },
  clearLocation: () => {
    navigationState.catalog = null;
    navigationState.page = 1;
    navigationState.lightboxSource = "catalog";
  },
  setAppPage: setCurrentAppPage,
  appPage: () => currentAppPage,
  syncRouteShell: syncDocumentRouteShell,
  restoreScroll: restoreDocumentRouteScroll,
  attachEvents: attachNavigationEvents
});

/** @returns {NavigationFeatureApi} */
function navigationFeature() {
  const feature = getFeatureInterface("navigation");
  if (!feature) throw new Error("Navigation feature is not registered");
  return feature;
}

/** @returns {CatalogRecord|null} */
function activeCatalog() {
  return navigationFeature().catalog();
}

/** @returns {number} */
function activePage() {
  return navigationFeature().page();
}

/** @returns {LightboxSource} */
function activeViewerSource() {
  return navigationFeature().source();
}

function isFavoritesLightboxMode() {
  return activeViewerSource() === LIGHTBOX_SOURCE_FAVORITES;
}

/** @param {CatalogRecord|null} catalog @param {number} [page] @param {LightboxSource} [source] */
function setActiveLocation(catalog, page = undefined, source = activeViewerSource()) {
  navigationFeature().setLocation(catalog, page, source);
}

/** @param {number} page */
function setActivePage(page) {
  navigationFeature().setPage(page);
}

/** @param {LightboxSource} source */
function setActiveViewerSource(source) {
  navigationFeature().setSource(source);
}

function clearActiveLocation() {
  navigationFeature().clearLocation();
}

export { activeCatalog, activePage, activeViewerSource, clearActiveLocation, isFavoritesLightboxMode, navigationFeature, setActiveLocation, setActivePage, setActiveViewerSource };
