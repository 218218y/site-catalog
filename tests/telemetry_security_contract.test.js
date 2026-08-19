"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, hasPropertyPath, inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.resolve(__dirname, "..");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const siteTemplate = fs.readFileSync(path.join(root, "site.template.html"), "utf8");
const legalTemplate = fs.readFileSync(path.join(root, "legal.template.html"), "utf8");
const notFound = fs.readFileSync(path.join(root, "404.html"), "utf8");
const e2eServer = fs.readFileSync(path.join(root, "tools/e2e_server.js"), "utf8");
const wrangler = JSON.parse(fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8"));
const ast = inventoryProjectFiles(root, [
  "src/runtime/telemetry.js",
  "src/js/80-app-shell.js",
  "functions/api/telemetry.js"
]);
const telemetry = ast["src/runtime/telemetry.js"];
const appShell = ast["src/js/80-app-shell.js"];
const telemetryIngest = ast["functions/api/telemetry.js"];
const telemetryFunctions = new Set(telemetry.functionDeclarations);
const telemetryIdentifiers = new Set(telemetry.identifiers);
const propertyLiteral = (property, value, owner = null) => telemetry.objectPropertyLiterals.some((entry) => (
  entry.property === property
  && entry.value === value
  && (owner === null || entry.enclosingFunction === owner)
));

assert.equal(telemetry.literalDeclarations.TELEMETRY_ENDPOINT, "/api/telemetry");
assert.equal(telemetry.literalDeclarations.TELEMETRY_SCHEMA_VERSION, 4);
assert.equal(telemetryIngest.literalDeclarations.TELEMETRY_SCHEMA_VERSION, 4);
assert.equal(hasPropertyPath(telemetry, "navigator.globalPrivacyControl"), true);
assert.equal(hasPropertyPath(telemetry, "navigator.doNotTrack"), true);
assert.equal(propertyLiteral("credentials", "omit", "telemetryFlush"), true);
assert.equal(propertyLiteral("keepalive", true, "telemetryFlush"), true);
assert.equal(hasPropertyPath(telemetry, "navigator.sendBeacon"), true);
for (const name of [
  "telemetryClassifyWindowError",
  "telemetryResourceScope",
  "telemetryComponentToken",
  "telemetryCreateImageRequestContext",
]) {
  assert.equal(telemetryFunctions.has(name), true, `telemetry must own ${name}`);
}
assert.equal(telemetry.stringLiterals.includes("runtime"), true);
assert.equal(telemetry.stringLiterals.includes("resource"), true);
assert.equal(findCalls(telemetry, "telemetryTrackResourceError").length > 0, true);
assert.equal(telemetry.stringLiterals.includes("cloudflare-observability"), true);
assert.equal(telemetry.stringLiterals.includes("netfree-filter"), true);
assert.equal(findCalls(telemetry, "options.recoverCatalogImageAfterInitialFailure").length > 0, true);
assert.equal(findCalls(appShell, "telemetryInit").some((call) => call.enclosingFunction === "initializeApplicationShell"), true);
assert.equal(findCalls(telemetry, "telemetryTrackSearchIndexFailure").some((call) => call.arguments[0] === "network-error"), true);
assert.equal(findCalls(telemetry, "Object.freeze").length > 0, true);
for (const property of ["context.requestId", "context.requestedTier", "context.networkState"]) {
  assert.equal(hasPropertyPath(telemetry, property), true, `telemetry image context must retain ${property}`);
}
for (const forbiddenPath of ["document.cookie", "navigator.userAgent", "document.referrer"]) {
  assert.equal(hasPropertyPath(telemetry, forbiddenPath), false, `telemetry must not read ${forbiddenPath}`);
}
assert.equal(telemetry.propertyAccesses.some((entry) => entry.property === "stack"), false, "telemetry must not collect error stacks");
for (const forbiddenIdentifier of ["telemetryTrackImageFailure", "outerHTML", "durationMs"]) {
  assert.equal(telemetryIdentifiers.has(forbiddenIdentifier), false, `telemetry must not retain ${forbiddenIdentifier}`);
}

const activeTelemetryEvents = telemetry.literalArrayDeclarations.TELEMETRY_EVENT_NAMES;
assert.ok(Array.isArray(activeTelemetryEvents) && activeTelemetryEvents.length > 0,
  "browser telemetry event contract must be a literal Set/array for AST verification");
assert.deepEqual(
  [...telemetryIngest.objectDeclarations.EVENT_FIELDS].sort(),
  [...activeTelemetryEvents].sort(),
  "ingestion event schema must exactly match the active browser telemetry contract"
);
assert.equal(activeTelemetryEvents.includes("image_error"), false,
  "historical image_error must not remain in the active browser telemetry contract");
assert.equal(telemetryIngest.stringLiterals.includes("image_error"), false,
  "historical image_error rows may remain reportable but must not be accepted by ingestion");

for (const duplicateMetric of ["page_view", "page_load", "first_catalog_image"]) {
  assert.equal(telemetry.stringLiterals.includes(duplicateMetric), false, `duplicate metric must stay retired: ${duplicateMetric}`);
}

assert.equal(wrangler.name, "bargig-catlog");
assert.equal(wrangler.pages_build_output_dir, "./dist/site-upload-r2");
assert.deepEqual(wrangler.analytics_engine_datasets, [
  { binding: "SITE_TELEMETRY", dataset: "bargig_catalog_telemetry" }
]);

for (const expected of [
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
  "Referrer-Policy: no-referrer",
  "Permissions-Policy:",
  "X-Permitted-Cross-Domain-Policies: none",
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://netfree.link",
  "script-src-attr 'none'",
  "connect-src 'self' https://cdn.bargig-furniture.com https://cloudflareinsights.com https://netfree.link",
  "media-src 'none'",
  "frame-src 'self' https://netfree.link",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "https://cdn.bargig-furniture.com"
]) {
  assert.ok(headers.includes(expected), `Missing security header/directive: ${expected}`);
}

const cspLine = headers
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("Content-Security-Policy:"));
assert.ok(cspLine, "Missing Content-Security-Policy header");
const cspDirectives = cspLine
  .slice(cspLine.indexOf(":") + 1)
  .split(";")
  .map((directive) => directive.trim())
  .filter(Boolean);
for (const directive of cspDirectives) {
  const tokens = directive.split(/\s+/);
  if (tokens.includes("'none'")) {
    assert.equal(
      tokens.length,
      2,
      `CSP 'none' must be the only source expression: ${directive}`
    );
  }
}
assert.ok(!cspDirectives.some((directive) => directive === "frame-src 'none'"),
  "Do not combine a filtered-network frame exception with frame-src 'none'");
assert.ok(!cspDirectives.some((directive) => directive.startsWith("child-src ")),
  "frame-src and worker-src are explicit; avoid a conflicting child-src fallback");
assert.ok(!cspDirectives.some((directive) => directive.startsWith("script-src ") && directive.includes("'unsafe-inline'")),
  "Keep the main script-src strict; the NetFree exception belongs only in script-src-elem");
const scriptElementDirective = cspDirectives.find((directive) => directive.startsWith("script-src-elem "));
assert.ok(scriptElementDirective?.includes("'unsafe-inline'"),
  "NetFree's injected bootstrap script requires the narrow script-src-elem inline exception");
assert.ok(scriptElementDirective?.includes("https://netfree.link"),
  "NetFree script elements must be restricted to explicit NetFree hosts");
assert.ok(cspDirectives.some((directive) => directive.startsWith("script-src-attr ") && directive.endsWith("'none'")),
  "Inline event-handler attributes must remain blocked");
const frameDirective = cspDirectives.find((directive) => directive.startsWith("frame-src "));
assert.ok(frameDirective?.includes("https://netfree.link"),
  "The NetFree review card frame must be allowed explicitly");
assert.ok(!cspLine.includes("'unsafe-eval'"), "CSP must never enable unsafe-eval");

assert.doesNotMatch(siteTemplate, /<script>\s*/i);
assert.doesNotMatch(legalTemplate, /<script>\s*/i);
assert.match(siteTemplate, /<script src="https-redirect\.js"><\/script>/);
assert.match(legalTemplate, /<script src="https-redirect\.js"><\/script>/);
assert.doesNotMatch(notFound, /<style[>\s]/i);
assert.match(notFound, /<link rel="stylesheet" href="404\.css">/);
assert.ok(fs.existsSync(path.join(root, "https-redirect.js")));
assert.ok(fs.existsSync(path.join(root, "404.css")));
assert.ok(fs.existsSync(path.join(root, "functions/api/telemetry.js")));
assert.match(e2eServer, /readRootSecurityHeaders/);
assert.match(e2eServer, /ROOT_SECURITY_HEADERS/);

console.log("telemetry_security_contract.test.js: PASS");
