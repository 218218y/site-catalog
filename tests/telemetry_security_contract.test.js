"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const telemetry = fs.readFileSync(path.join(root, "src/js/15-telemetry.js"), "utf8");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const siteTemplate = fs.readFileSync(path.join(root, "site.template.html"), "utf8");
const legalTemplate = fs.readFileSync(path.join(root, "legal.template.html"), "utf8");
const notFound = fs.readFileSync(path.join(root, "404.html"), "utf8");
const e2eServer = fs.readFileSync(path.join(root, "tools/e2e_server.js"), "utf8");
const wrangler = JSON.parse(fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8"));

assert.match(telemetry, /const TELEMETRY_ENDPOINT = "\/api\/telemetry"/);
assert.match(telemetry, /navigator\.globalPrivacyControl === true/);
assert.match(telemetry, /navigator\.doNotTrack/);
assert.match(telemetry, /credentials: "omit"/);
assert.match(telemetry, /keepalive: true/);
assert.match(telemetry, /navigator\.sendBeacon/);
assert.doesNotMatch(telemetry, /document\.cookie/);
assert.doesNotMatch(telemetry, /navigator\.userAgent/);
assert.doesNotMatch(telemetry, /document\.referrer/);
assert.doesNotMatch(telemetry, /\.stack\b/);

for (const eventName of [
  "catalog_open",
  "search",
  "favorite",
  "contact",
  "js_error",
  "image_error"
]) {
  assert.match(telemetry, new RegExp(`"${eventName}"`));
}
for (const duplicateMetric of ["page_view", "page_load", "first_catalog_image"]) {
  assert.doesNotMatch(telemetry, new RegExp(`"${duplicateMetric}"`));
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
