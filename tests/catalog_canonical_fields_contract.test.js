"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const generatedSchema = JSON.parse(read("schemas/catalogs.generated.schema.json"));
const sourceSchema = JSON.parse(read("schemas/catalogs.config.schema.json"));
const generatedTypes = read("types/catalog-data.generated.d.ts");

const schemaForbiddenFields = [
  "subCategory",
  "sub_category",
  "subcategories",
  "תת קטגוריה",
  "תת_קטגוריה",
  "thumbDir",
  "mediumDir",
  "format",
];
const productionForbiddenTokens = [
  "subCategory",
  "sub_category",
  "thumbDir",
  "mediumDir",
  "LegacyCatalogRecordInput",
  "catalog-legacy-input",
];

function sourceFilesUnder(relativeDirectory, extension) {
  const directory = path.join(root, relativeDirectory);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFilesUnder(path.relative(root, absolute), extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(absolute);
    }
  }
  return files;
}

assert.equal(fs.existsSync(path.join(root, "types/catalog-legacy-input.d.ts")), false);

for (const schema of [sourceSchema.items, generatedSchema.$defs.catalog]) {
  assert.equal(schema.additionalProperties, false);
  assert.ok(Object.hasOwn(schema.properties, "subcategory"));
  for (const field of schemaForbiddenFields) {
    assert.equal(Object.hasOwn(schema.properties, field), false, `${field} must not be a schema field`);
  }
}

for (const field of schemaForbiddenFields) {
  assert.equal(generatedTypes.includes(field), false, `${field} must not be a generated CatalogRecord field`);
}

const productionFiles = [
  ...sourceFilesUnder("src/js", ".js"),
  ...sourceFilesUnder("src/runtime", ".js"),
  ...sourceFilesUnder("tools", ".py"),
];

for (const filename of productionFiles) {
  const source = fs.readFileSync(filename, "utf8");
  for (const token of productionForbiddenTokens) {
    assert.equal(
      source.includes(token),
      false,
      `${path.relative(root, filename)} reintroduced non-canonical catalog token ${token}`,
    );
  }
}

console.log("catalog_canonical_fields_contract.test.js: PASS");
