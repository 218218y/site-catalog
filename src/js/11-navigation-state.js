/**
 * Source module: 11-navigation-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

import { $, requiredElement } from "./02-dom-contracts.js";

const LIGHTBOX_SOURCE_CATALOG = "catalog";
const LIGHTBOX_SOURCE_FAVORITES = "favorites";
/** @type {NavigationState} */
const navigationState = {
  catalog: null,
  page: 1,
  lightboxSource: LIGHTBOX_SOURCE_CATALOG,
};

/** @type {Readonly<{
 *   splash: HTMLElement|null,
 *   catalogsSection: HTMLElement
 * }>} */
const shellElements = Object.freeze({
  splash: $("splashScreen"),
  catalogsSection: requiredElement("catalogs"),
});

export { LIGHTBOX_SOURCE_CATALOG, LIGHTBOX_SOURCE_FAVORITES, navigationState, shellElements };
