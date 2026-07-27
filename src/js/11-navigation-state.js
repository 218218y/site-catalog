/**
 * Source module: 11-navigation-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

const LIGHTBOX_SOURCE_CATALOG = "catalog";
const LIGHTBOX_SOURCE_FAVORITES = "favorites";
/** @type {NavigationState} */
const navigationState = {
  catalog: null,
  page: 1,
  lightboxSource: LIGHTBOX_SOURCE_CATALOG,
};

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const shellElements = Object.freeze({
  splash: $("splashScreen"),
  catalogsSection: $("catalogs"),
  categoryNav: $("categoryNav"),
  mobileCategoryMenuToggle: $("mobileCategoryMenuToggle"),
  mobileCategoryMenu: $("mobileCategoryMenu"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  headerFavoritesButton: $("headerFavoritesButton"),
  headerFavoritesCount: $("headerFavoritesCount"),
  headerCopyLink: $("headerCopyLink"),
  siteActionToast: $("siteActionToast"),
});
