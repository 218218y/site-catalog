/**
 * Source module: 10-app-state.js
 * Route-neutral runtime services and feature interface registration.
 *
 * Feature constants and mutable state belong to their feature modules. Keeping
 * this module route-neutral is what allows the catalog and favorites bundles to
 * omit the Viewer implementation completely rather than merely disable it.
 */

/** @import { CatalogAssetState, EscapeFeatureApi, FeatureName, FeatureRegistry, RegisteredFeatureInterface, UiRuntimeState } from "../../types/frontend-contracts.js" */

const CATALOG_IMAGE_TIER_THUMB = "thumb";
const CATALOG_IMAGE_TIER_MEDIUM = "medium";
const CATALOG_IMAGE_TIER_FULL = "full";
const CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE = "responsive";
const CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY = "full-only";
const DEFAULT_CATALOG_MEDIUM_MAX_SIDE = 1600;
const CATALOG_IMAGE_PRELOAD_CACHE_LIMIT = 24;
const CATALOG_EAGER_COVER_COUNT = 2;
const CATALOG_IMAGE_RETRY_PARAM = "bargig_retry";
const CATALOG_ASSET_VERSION_PARAM = "v";
const CATALOG_ASSET_URL_SCHEMA_VERSION = 2;

/** @type {CatalogAssetState} */
const catalogAssetState = {
  imageLoadCache: new Map(),
};

/** @type {UiRuntimeState} */
const uiRuntime = {
  actionToastTimer: 0,
};

/** @type {Map<FeatureName, RegisteredFeatureInterface>} */
const featureInterfaces = new Map();

/**
 * Register one immutable feature boundary. The generic registry makes unknown
 * names and incomplete APIs compile-time failures, while runtime validation
 * still protects generated bundles and hand-authored integration tests.
 *
 * @template {FeatureName} K
 * @param {K} name
 * @param {FeatureRegistry[K]} api
 */
function registerFeatureInterface(name, api) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName || normalizedName !== name) {
    throw new TypeError("Feature interface requires an exact stable name");
  }
  if (!api || typeof api !== "object") {
    throw new TypeError(`Feature interface must be an object: ${normalizedName}`);
  }
  const featureName = /** @type {K} */ (name);
  if (featureInterfaces.has(featureName)) {
    throw new Error(`Feature interface was registered twice: ${normalizedName}`);
  }
  const registered = Object.freeze({ ...api, name: featureName });
  featureInterfaces.set(featureName, /** @type {RegisteredFeatureInterface} */ (registered));
}

/**
 * @template {FeatureName} K
 * @param {K} name
 * @returns {(FeatureRegistry[K] & {readonly name:K})|null}
 */
function getFeatureInterface(name) {
  return /** @type {(FeatureRegistry[K] & {readonly name:K})|null} */ (
    featureInterfaces.get(name) || null
  );
}

/**
 * Resolve a feature that is mandatory for the current interaction. Optional
 * route capabilities continue to use getFeatureInterface(); required seams
 * fail loudly instead of returning a successful no-op.
 *
 * @template {FeatureName} K
 * @param {K} name
 * @returns {FeatureRegistry[K] & {readonly name:K}}
 */
function requireFeatureInterface(name) {
  const api = getFeatureInterface(name);
  if (!api) throw new Error(`Required feature interface is unavailable: ${name}`);
  return api;
}

const ESCAPE_FEATURE_NAMES = /** @type {const} */ ([
  "inquiry",
  "favorites",
  "catalog-navigation",
  "search",
  "catalog-detail",
  "viewer"
]);

/** @returns {Array<EscapeFeatureApi & {readonly name:FeatureName}>} */
function featureInterfacesByEscapePriority() {
  /** @type {Array<EscapeFeatureApi & {readonly name:FeatureName}>} */
  const interfaces = [];
  ESCAPE_FEATURE_NAMES.forEach((name) => {
    const api = getFeatureInterface(name);
    if (api) interfaces.push(api);
  });
  return interfaces.sort((first, second) => second.escapePriority - first.escapePriority);
}

const boundEventFeatures = new Set();

/**
 * @param {string} featureName
 * @param {()=>void} binder
 * @returns {boolean}
 */
function bindFeatureEventsOnce(featureName, binder) {
  const name = String(featureName || "").trim();
  if (!name) throw new TypeError("Feature event binding requires a stable name");
  if (boundEventFeatures.has(name)) return false;
  if (typeof binder !== "function") throw new TypeError(`Feature event binder is not callable: ${name}`);

  // Mark only after a successful bind. A thrown setup error therefore cannot leave
  // the application believing that a half-bound feature is healthy.
  binder();
  boundEventFeatures.add(name);
  return true;
}


export { CATALOG_ASSET_URL_SCHEMA_VERSION, CATALOG_ASSET_VERSION_PARAM, CATALOG_EAGER_COVER_COUNT, CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY, CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE, CATALOG_IMAGE_PRELOAD_CACHE_LIMIT, CATALOG_IMAGE_RETRY_PARAM, CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB, DEFAULT_CATALOG_MEDIUM_MAX_SIDE, bindFeatureEventsOnce, catalogAssetState, featureInterfacesByEscapePriority, getFeatureInterface, registerFeatureInterface, requireFeatureInterface, uiRuntime };
