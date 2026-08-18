"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const clients = [
  ["client", require("./frontend_test_module").importFrontendModule("src/runtime/catalog-search.js", {
    catalogs: [],
    catalogAssetBaseUrl: "",
    catalogImageDeliveryMode: "responsive",
  })],
  ["worker", require(path.join(root, "catalog-search-worker.js"))],
];
const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "search_normalization_vectors.json"), "utf8"),
);

for (const [runtimeName, engine] of clients) {
  for (const vector of vectors) {
    assert.equal(engine.normalize(vector.input), vector.normalized, `${runtimeName}/${vector.name}: normalized`);
    assert.equal(engine.normalizeLoose(vector.input), vector.loose, `${runtimeName}/${vector.name}: loose`);
    if (typeof engine.tokenize === "function") {
      assert.deepEqual(engine.tokenize(vector.input), vector.tokens, `${runtimeName}/${vector.name}: tokens`);
    }
    if (typeof engine.testing?.normalizeWithMap === "function") {
      const mapped = engine.testing.normalizeWithMap(vector.input);
      assert.equal(mapped.normalized, vector.normalized, `${runtimeName}/${vector.name}: mapped normalized`);
      assert.equal(mapped.positions.length, mapped.normalized.length, `${runtimeName}/${vector.name}: mapped length`);
      for (let index = 0; index < mapped.positions.length; index += 1) {
        assert.ok(mapped.positions[index] >= 0 && mapped.positions[index] <= vector.input.length);
        if (index > 0) assert.ok(mapped.positions[index] >= mapped.positions[index - 1]);
      }
    }
  }
}

console.log("search_normalization_vectors.test.js: PASS");
