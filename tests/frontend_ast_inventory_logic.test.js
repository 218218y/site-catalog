"use strict";

const assert = require("node:assert/strict");
const {
  findCalls,
  hasPropertyPath,
  inventorySource,
} = require("./helpers/frontend_ast.js");

const source = `
// import "./comment-only.js";
const text = 'registerFeatureInterface("string-only", {})';
import value from "./real.js";
export { value as forwarded } from "./forwarded.js";
const owner = Object.freeze({ ready: false, count: 0 });
export const publicValue = 1;
function init() {
  registerFeatureInterface("viewer", { init() {} });
  requireFeatureInterface("app-shell").initialize();
  owner.ready = true;
  window.RealRuntime = value;
}
void import("./lazy.js");
`;

const inventory = inventorySource(source, "fixture.js");
assert.deepEqual(inventory.staticImports, ["./real.js", "./forwarded.js"]);
assert.deepEqual(inventory.dynamicImports, [{ specifier: "./lazy.js", static: true }]);
assert.deepEqual(inventory.functionDeclarations, ["init"]);
assert.deepEqual(inventory.variableDeclarations, [
  { name: "text", exported: false },
  { name: "owner", exported: false },
  { name: "publicValue", exported: true },
]);
assert.deepEqual(inventory.objectDeclarations.owner, ["ready", "count"]);
assert.deepEqual(findCalls(inventory, "registerFeatureInterface").map((call) => call.arguments[0]), ["viewer"]);
assert.equal(findCalls(inventory, 'requireFeatureInterface("app-shell").initialize').length, 1);
assert.equal(hasPropertyPath(inventory, "window.RealRuntime"), true);
assert.equal(hasPropertyPath(inventory, "window.CommentOnlyRuntime"), false);
assert.equal(inventory.identifiers.includes("string-only"), false);

const nonStatic = inventorySource("import(getModuleName());", "dynamic.js");
assert.deepEqual(nonStatic.dynamicImports, [{ specifier: null, static: false }]);

assert.throws(
  () => inventorySource("const broken = ;", "broken.js"),
  /broken\.js:1:/,
);

console.log("frontend_ast_inventory_logic.test.js: PASS");
