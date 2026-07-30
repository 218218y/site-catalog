/**
 * Source module: 17-catalog-asset-urls.js
 * Pure catalog asset URL construction shared by metadata and media owners.
 */

import { displayPageToAssetPage, catalogFirstPage } from "./06-catalog-page-numbering.js";
import { CATALOG_ASSET_URL_SCHEMA_VERSION, CATALOG_ASSET_VERSION_PARAM, CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_THUMB } from "./10-app-state.js";

function catalogAssetBaseUrl() {
  const rawBase = String(window.BARGIG_CATALOG_ASSET_BASE_URL || "").trim();
  if (!rawBase) return "";
  return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
}

/** @param {string} path */
function isAbsoluteAssetUrl(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
}

/** @param {unknown} path */
function resolveCatalogAssetUrl(path) {
  const cleanPath = String(path || "").trim();
  if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;

  const baseUrl = catalogAssetBaseUrl();
  if (!baseUrl) return cleanPath;

  try {
    return new URL(cleanPath.replace(/^\/+/, ""), baseUrl).href;
  } catch {
    return `${baseUrl}${cleanPath.replace(/^\/+/, "")}`;
  }
}

/** @param {number|string} value */
function padCatalogPage(value) {
  return String(value).padStart(3, "0");
}

/** @param {CatalogRecord|null|undefined} catalog */
function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}

/** @param {CatalogRecord} catalog */
function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}

/** @param {CatalogRecord|null|undefined} catalog @param {unknown} tier */
function catalogAssetVersionForTier(catalog, tier) {
  const normalizedTier = String(tier || CATALOG_IMAGE_TIER_FULL);
  const variantVersion = String(catalog?.imageVariants?.[normalizedTier]?.version || "").trim();
  const baseVersion = variantVersion || String(catalog?.assetVersion || "").trim();
  if (!baseVersion) return "";
  return `${baseVersion}-${normalizedTier}-u${CATALOG_ASSET_URL_SCHEMA_VERSION}`;
}

/** @param {string} url @param {CatalogRecord|null|undefined} catalog @param {string} [tier] */
function withAssetVersion(url, catalog, tier = CATALOG_IMAGE_TIER_FULL) {
  const version = catalogAssetVersionForTier(catalog, tier);
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${CATALOG_ASSET_VERSION_PARAM}=${encodeURIComponent(version)}`;
}

/** @param {CatalogRecord} catalog @param {number|string} page */
function pageSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/page-${padCatalogPage(displayPageToAssetPage(catalog, page))}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_FULL
  );
}

/** @param {CatalogRecord} catalog @param {number|string} page */
function thumbSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/thumbs/page-${padCatalogPage(displayPageToAssetPage(catalog, page))}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_THUMB
  );
}

/** @param {CatalogRecord} catalog */
function coverThumbSrc(catalog) {
  return thumbSrc(catalog, catalogFirstPage(catalog));
}

export { catalogDir, coverThumbSrc, imageExt, pageSrc, resolveCatalogAssetUrl, thumbSrc, withAssetVersion };
