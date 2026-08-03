/**
 * Source module: 03-runtime-context.js
 * Read-only bootstrap data supplied before the route bundle executes.
 */

import { catalogSearch } from "../runtime/catalog-search.js";
import { siteRoutes } from "../runtime/site-routes.js";
import { catalogs } from "../../catalogs.generated.module.js";
import { catalogTaxonomy } from "../../catalog-taxonomy.generated.module.js";

export { catalogSearch, catalogs, catalogTaxonomy, siteRoutes };
