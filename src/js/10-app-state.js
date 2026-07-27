/**
 * Source module: 10-app-state.js
 * Route-neutral runtime services and feature interface registration.
 *
 * Feature constants and mutable state belong to their feature modules. Keeping
 * this module route-neutral is what allows the catalog and favorites bundles to
 * omit the Viewer implementation completely rather than merely disable it.
 */

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

/** @type {Map<string, FeatureInterface>} */
const featureInterfaces = new Map();

/**
 * Register one immutable feature boundary. Duplicate names are rejected so a
 * route cannot silently replace another feature implementation.
 * @param {string} name
 * @param {FeatureInterface} api
 */
function registerFeatureInterface(name, api) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) throw new TypeError("Feature interface requires a stable name");
  if (!api || typeof api !== "object") {
    throw new TypeError(`Feature interface must be an object: ${normalizedName}`);
  }
  if (featureInterfaces.has(normalizedName)) {
    throw new Error(`Feature interface was registered twice: ${normalizedName}`);
  }
  featureInterfaces.set(normalizedName, Object.freeze({ ...api, name: normalizedName }));
}

/** @param {string} name @returns {FeatureInterface|null} */
function getFeatureInterface(name) {
  return featureInterfaces.get(String(name || "")) || null;
}

function featureInterfacesByEscapePriority() {
  return [...featureInterfaces.values()]
    .filter((api) => typeof api.closeTopLayer === "function")
    .sort((first, second) => Number(second.escapePriority || 0) - Number(first.escapePriority || 0));
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
