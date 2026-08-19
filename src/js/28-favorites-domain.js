/**
 * Source module: 28-favorites-domain.js
 * Canonical favorites portability instance and share-link construction.
 */

import { normalizeItems as normalizeFavoriteItems } from "../runtime/favorites-store.js";
import { favoritesDocumentUrl } from "./00-navigation.js";
import { catalogs } from "./03-runtime-context.js";
import { FAVORITES_SHARE_PARAM, FAVORITES_SHARE_VERSION } from "./14-favorites-state.js";
import { findCatalogById } from "./20-catalog-runtime.js";
import { createFavoritesPortabilityDomain } from "./29-favorites-portability.js";

const favoritesPortabilityDomain = createFavoritesPortabilityDomain({
  normalizeItems: normalizeFavoriteItems,
  findCatalogById,
  catalogs: () => catalogs,
  encodeBase64: (value) => window.btoa(value),
  decodeBase64: (value) => window.atob(value),
  shareVersion: FAVORITES_SHARE_VERSION
});

/** @param {unknown} items */
function buildFavoritesShareUrl(items) {
  const url = new URL(favoritesDocumentUrl(), window.location.href);
  url.hash = "";
  url.searchParams.set(FAVORITES_SHARE_PARAM, favoritesPortabilityDomain.buildFavoritesShareToken(items));
  return url.toString();
}

export { buildFavoritesShareUrl, favoritesPortabilityDomain };
