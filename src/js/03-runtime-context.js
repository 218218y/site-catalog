/**
 * Source module: 03-runtime-context.js
 * Read-only bootstrap data supplied before the route bundle executes.
 */

import { catalogSearch } from "../runtime/catalog-search.js";
import { siteRoutes } from "../runtime/site-routes.js";

const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
export { catalogSearch, catalogs, siteRoutes };
