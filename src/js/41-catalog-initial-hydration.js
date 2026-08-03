/**
 * Source module: 41-catalog-initial-hydration.js
 * Home-route-only validation for reusing the server-rendered catalog layout.
 */

/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */

import { requireFeatureInterface } from "./10-app-state.js";

/**
 * @param {HTMLElement} grid
 * @param {number} columns
 * @param {ReadonlyArray<CatalogRecord>} catalogs
 */
function canHydrateInitialCatalogCards(grid, columns, catalogs) {
  const marker = grid.querySelector("[data-initial-catalog-layout-columns][data-initial-catalog-ids]");
  if (!(marker instanceof HTMLElement)) return false;
  if (Number.parseInt(marker.dataset.initialCatalogLayoutColumns || "", 10) !== columns) return false;

  let initialCatalogIds;
  try {
    initialCatalogIds = JSON.parse(marker.dataset.initialCatalogIds || "[]");
  } catch {
    return false;
  }

  const expectedCatalogIds = catalogs.map((catalog) => String(catalog?.id || ""));
  if (!Array.isArray(initialCatalogIds) || initialCatalogIds.length !== expectedCatalogIds.length) return false;
  if (initialCatalogIds.some((catalogId, index) => String(catalogId) !== expectedCatalogIds[index])) return false;

  const renderedCatalogIds = Array.from(grid.querySelectorAll(".catalog-card[data-catalog-card-id]"))
    .map((card) => card instanceof HTMLElement ? String(card.dataset.catalogCardId || "") : "");
  return renderedCatalogIds.length === expectedCatalogIds.length
    && renderedCatalogIds.every((catalogId, index) => catalogId === expectedCatalogIds[index]);
}

requireFeatureInterface("catalog-grid").setInitialLayoutHydrator(canHydrateInitialCatalogCards);

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["catalog-initial-hydration"] = Object.freeze({
    canHydrateInitialCatalogCards
  });
}
/* TEST-ONLY EXPORTS: END */
