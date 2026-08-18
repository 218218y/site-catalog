"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ENDPOINT = "https://bargig-furniture.com/api/telemetry";

async function loadFunctionModule() {
  const filename = path.resolve(__dirname, "../functions/api/telemetry.js");
  return import(pathToFileURL(filename).href);
}

function telemetryRequest(payload, options = {}) {
  const headers = {
    "Content-Type": options.contentType || "application/json",
    "Origin": options.origin || "https://bargig-furniture.com",
    "Sec-Fetch-Site": options.fetchSite || "same-origin",
    ...(options.headers || {})
  };
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
}

(async () => {
  const module = await loadFunctionModule();
  const writes = [];
  const env = {
    SITE_TELEMETRY: {
      writeDataPoint(point) {
        writes.push(point);
      }
    }
  };

  const request = telemetryRequest({
    version: 4,
    events: [
      {
        name: "search",
        page: "home",
        path: "/index.html?private=must-not-be-stored#fragment",
        query: "  ארון   פתיחה  ",
        value: 0,
        releaseId: "app-61dd783bd3fa",
        viewport: "XS",
        error: "known-field-but-forbidden-on-search",
        requestId: "ir-forbidden1234",
        networkState: "offline",
        stack: "must never be stored",
        userAgent: "must never be stored"
      },
      {
        name: "js_error",
        error: "e12345678",
        detail: "TypeError",
        pageNumber: 44,
        query: "must-not-land-in-js-error"
      },
      {
        name: "web_vital",
        action: "LCP",
        detail: "good",
        value: 1840,
        component: "Viewer Stage"
      },
      {
        name: "resource_error",
        action: "script",
        detail: "script",
        source: "optional.js",
        releaseId: "app-61dd783bd3fa"
      },
      {
        name: "image_terminal_failure",
        detail: "thumbnail",
        source: "page-004.webp",
        releaseId: "app-61dd783bd3fa",
        surface: "Catalog Grid",
        requestId: "ir-abc12345",
        visibility: "VISIBLE",
        requestedTier: "MEDIUM",
        networkState: "OFFLINE"
      },
      {
        name: "catalog_open",
        catalogId: "invalid-dimensions",
        viewport: "desktop-ultra",
        releaseId: "arbitrary-attacker-bucket"
      },
      { name: "unknown_event", detail: "ignored" }
    ]
  });

  const response = await module.onRequestPost({ request, env });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, accepted: 6 });
  assert.equal(response.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(writes.length, 6);
  assert.match(writes[0].indexes[0], /^[0-9a-f-]{36}$/i);
  assert.equal(writes[0].indexes[0], writes[1].indexes[0]);
  assert.equal(writes[0].blobs[11], "bargig-furniture.com");
  assert.equal(writes[0].blobs[9], "xs");
  assert.equal(writes[0].blobs[12], "app-61dd783bd3fa");
  assert.equal(writes[0].blobs[0], "search");
  assert.equal(writes[0].blobs[2], "/index.html");
  assert.equal(writes[0].blobs[4], "ארון פתיחה");
  assert.equal(writes[0].blobs[8], "");
  assert.equal(writes[0].blobs[15], "");
  assert.equal(writes[0].blobs[16], "");
  assert.equal(writes[0].blobs[18], "");
  assert.equal(writes[1].blobs[4], "");
  assert.equal(writes[1].blobs[8], "e12345678");
  assert.equal(writes[2].blobs[0], "web_vital");
  assert.equal(writes[2].blobs[6], "LCP");
  assert.equal(writes[2].doubles[0], 1840);
  assert.equal(writes[2].blobs[13], "viewer-stage");
  assert.equal(writes[3].blobs[0], "resource_error");
  assert.equal(writes[4].blobs[0], "image_terminal_failure");
  assert.equal(writes[4].blobs[14], "catalog-grid");
  assert.equal(writes[4].blobs[15], "ir-abc12345");
  assert.equal(writes[4].blobs[16], "visible");
  assert.equal(writes[4].blobs[17], "medium");
  assert.equal(writes[4].blobs[18], "offline");
  assert.equal(writes[4].blobs.length, 19);
  assert.equal(writes[5].blobs[9], "");
  assert.equal(writes[5].blobs[12], "");
  const serializedWrites = JSON.stringify(writes);
  for (const forbidden of [
    "private=must-not-be-stored",
    "known-field-but-forbidden-on-search",
    "ir-forbidden1234",
    "must never be stored",
    "must-not-land-in-js-error"
  ]) {
    assert.equal(serializedWrites.includes(forbidden), false, `telemetry must discard ${forbidden}`);
  }

  const writesBeforeCardinalityGuard = writes.length;
  const guardedValues = await module.onRequestPost({
    request: telemetryRequest({
      version: 4,
      events: [
        {
          name: "web_vital",
          action: "ATTACKER_METRIC",
          detail: "arbitrary-rating",
          source: "arbitrary-navigation",
          component: "stable-component",
          value: 12
        },
        {
          name: "js_error",
          action: "TypeError",
          detail: "coarse message",
          error: "raw-error-message-must-not-be-stored"
        }
      ]
    }),
    env
  });
  assert.equal(guardedValues.status, 202);
  assert.deepEqual(await guardedValues.json(), { ok: true, accepted: 2 });
  assert.equal(writes.length, writesBeforeCardinalityGuard + 2);
  const guardedVital = writes[writesBeforeCardinalityGuard];
  const guardedError = writes[writesBeforeCardinalityGuard + 1];
  assert.equal(guardedVital.blobs[6], "");
  assert.equal(guardedVital.blobs[7], "");
  assert.equal(guardedVital.blobs[10], "");
  assert.equal(guardedVital.blobs[13], "stable-component");
  assert.equal(guardedError.blobs[8], "");

  const crossOrigin = telemetryRequest(
    { version: 4, events: [{ name: "catalog_open", catalogId: "test-catalog" }] },
    { origin: "https://attacker.example", fetchSite: "cross-site" }
  );
  assert.equal((await module.onRequestPost({ request: crossOrigin, env })).status, 403);

  const disabled = await module.onRequestPost({
    request: telemetryRequest({
      version: 4,
      events: [{ name: "catalog_open", catalogId: "test-catalog" }]
    }),
    env: {}
  });
  assert.equal(disabled.status, 202);
  assert.equal(disabled.headers.get("X-Telemetry-Status"), "disabled");

  const writesBeforeRetiredMetrics = writes.length;
  const retiredMetrics = await module.onRequestPost({
    request: telemetryRequest({
      version: 4,
      events: [
        { name: "page_view" },
        { name: "page_load", durationMs: 300 },
        { name: "first_catalog_image", durationMs: 500 },
        { name: "image_error", detail: "historical-only" }
      ]
    }),
    env
  });
  assert.equal(retiredMetrics.status, 202);
  assert.deepEqual(await retiredMetrics.json(), { ok: true, accepted: 0 });
  assert.equal(writes.length, writesBeforeRetiredMetrics);

  const legacySchema = await module.onRequestPost({
    request: telemetryRequest({
      version: 1,
      events: [{ name: "catalog_open", catalogId: "legacy-client" }]
    }),
    env
  });
  assert.equal(legacySchema.status, 400);
  assert.deepEqual(await legacySchema.json(), { ok: false, error: "invalid-schema" });

  const invalidContentType = await module.onRequestPost({
    request: telemetryRequest(
      { version: 4, events: [{ name: "catalog_open", catalogId: "content-type" }] },
      { contentType: "application/json-evil" }
    ),
    env
  });
  assert.equal(invalidContentType.status, 415);
  assert.deepEqual(await invalidContentType.json(), { ok: false, error: "content-type" });

  const charsetJson = await module.onRequestPost({
    request: telemetryRequest(
      { version: 4, events: [{ name: "catalog_open", catalogId: "charset-json" }] },
      { contentType: "application/json; charset=UTF-8" }
    ),
    env
  });
  assert.equal(charsetJson.status, 202);

  const writesBeforeOversizedBatch = writes.length;
  const oversizedBatch = await module.onRequestPost({
    request: telemetryRequest({
      version: 4,
      events: Array.from({ length: 21 }, (_, index) => ({
        name: "catalog_open",
        catalogId: `catalog-${index}`
      }))
    }),
    env
  });
  assert.equal(oversizedBatch.status, 413);
  assert.deepEqual(await oversizedBatch.json(), { ok: false, error: "too-many-events" });
  assert.equal(writes.length, writesBeforeOversizedBatch);

  const malformed = await module.onRequestPost({
    request: telemetryRequest("{not-json"),
    env
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { ok: false, error: "invalid-json" });

  const health = await module.onRequestGet({ env });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: "site-telemetry", storage: true });
  assert.equal(health.headers.get("Cross-Origin-Resource-Policy"), "same-origin");

  console.log("telemetry_function_logic.test.js: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
