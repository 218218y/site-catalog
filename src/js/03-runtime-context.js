/**
 * Source module: 03-runtime-context.js
 * Read-only bootstrap data supplied before the route bundle executes.
 */

const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;
const siteRoutes = window.BargigRoutes || null;

export { catalogSearch, catalogs, siteRoutes };
