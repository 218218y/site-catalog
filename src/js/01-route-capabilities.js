/**
 * Source module: 01-route-capabilities.js
 * Compile-time route capabilities injected by the frontend bundler.
 */

/** @type {FeatureCapabilities} */
const resolvedFeatureCapabilities = typeof __BARGIG_FEATURE_CAPABILITIES__ === "object"
  ? __BARGIG_FEATURE_CAPABILITIES__
  : { viewer: false, favoritesWorkspace: false, catalogGrid: false, search: false };

export const featureCapabilities = Object.freeze(resolvedFeatureCapabilities);
