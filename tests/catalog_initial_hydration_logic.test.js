"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

class FakeHTMLElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
  }
}

let registeredHydrator = null;
const api = importFrontendModule("src/js/41-catalog-initial-hydration.js",
  {
    HTMLElement: FakeHTMLElement,
    requireFeatureInterface: (name) => {
      assert.equal(name, "catalog-grid");
      return {
        setInitialLayoutHydrator(hydrator) {
          registeredHydrator = hydrator;
        }
      };
    }
  }
);

assert.equal(registeredHydrator, api.canHydrateInitialCatalogCards);

function gridFixture({ columns = 3, markerIds, cardIds }) {
  const marker = new FakeHTMLElement({
    initialCatalogLayoutColumns: String(columns),
    initialCatalogIds: JSON.stringify(markerIds)
  });
  const cards = cardIds.map((catalogCardId) => new FakeHTMLElement({ catalogCardId }));
  return {
    querySelector: () => marker,
    querySelectorAll: () => cards
  };
}

const catalogs = [{ id: "opening-tbi" }, { id: "opening-fredi" }, { id: "sliding-tbi" }];
assert.equal(
  api.canHydrateInitialCatalogCards(
    gridFixture({ columns: 3, markerIds: catalogs.map((item) => item.id), cardIds: catalogs.map((item) => item.id) }),
    3,
    catalogs
  ),
  true
);
assert.equal(
  api.canHydrateInitialCatalogCards(
    gridFixture({ columns: 3, markerIds: catalogs.map((item) => item.id), cardIds: catalogs.map((item) => item.id) }),
    2,
    catalogs
  ),
  false,
  "a different responsive column count must force a fresh render"
);
assert.equal(
  api.canHydrateInitialCatalogCards(
    gridFixture({ columns: 3, markerIds: ["opening-tbi", "stale", "sliding-tbi"], cardIds: catalogs.map((item) => item.id) }),
    3,
    catalogs
  ),
  false,
  "stale server data must never be hydrated"
);
assert.equal(
  api.canHydrateInitialCatalogCards(
    gridFixture({ columns: 3, markerIds: catalogs.map((item) => item.id), cardIds: ["opening-tbi", "sliding-tbi", "opening-fredi"] }),
    3,
    catalogs
  ),
  false,
  "DOM card order must match the runtime catalog order"
);

console.log("catalog_initial_hydration_logic.test.js: PASS");
