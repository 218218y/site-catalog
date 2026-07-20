"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function loadFunctionModule() {
  const filename = path.resolve(__dirname, "../functions/api/telemetry.js");
  const source = fs.readFileSync(filename, "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
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

  const request = new Request("https://bargig-furniture.com/api/telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://bargig-furniture.com",
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify({
      version: 2,
      events: [
        {
          name: "search",
          page: "home",
          path: "/index.html",
          query: "  ארון   פתיחה  ",
          value: 0,
          releaseId: "app-61dd783bd3fa",
          stack: "must never be stored",
          userAgent: "must never be stored"
        },
        {
          name: "js_error",
          error: "e12345678",
          detail: "TypeError",
          pageNumber: 44
        },
        {
          name: "web_vital",
          action: "LCP",
          detail: "good",
          value: 1840
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
          releaseId: "app-61dd783bd3fa"
        },
        { name: "unknown_event", detail: "ignored" }
      ]
    })
  });

  const response = await module.onRequestPost({ request, env });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, accepted: 5 });
  assert.equal(writes.length, 5);
  assert.match(writes[0].indexes[0], /^[0-9a-f-]{36}$/i);
  assert.equal(writes[0].indexes[0], writes[1].indexes[0]);
  assert.equal(writes[0].blobs[11], "bargig-furniture.com");
  assert.equal(writes[0].blobs[12], "app-61dd783bd3fa");
  assert.equal(writes[0].blobs[0], "search");
  assert.equal(writes[0].blobs[4], "ארון פתיחה");
  assert.equal(writes[1].blobs[8], "e12345678");
  assert.equal(writes[2].blobs[0], "web_vital");
  assert.equal(writes[2].blobs[6], "LCP");
  assert.equal(writes[2].doubles[0], 1840);
  assert.equal(writes[3].blobs[0], "resource_error");
  assert.equal(writes[4].blobs[0], "image_terminal_failure");
  assert.equal(JSON.stringify(writes).includes("must never be stored"), false);

  const crossOrigin = new Request("https://bargig-furniture.com/api/telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://attacker.example",
      "Sec-Fetch-Site": "cross-site"
    },
    body: JSON.stringify({ version: 1, events: [{ name: "catalog_open", catalogId: "test-catalog" }] })
  });
  assert.equal((await module.onRequestPost({ request: crossOrigin, env })).status, 403);

  const disabled = await module.onRequestPost({
    request: new Request("https://bargig-furniture.com/api/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://bargig-furniture.com",
        "Sec-Fetch-Site": "same-origin"
      },
      body: JSON.stringify({ version: 1, events: [{ name: "catalog_open", catalogId: "test-catalog" }] })
    }),
    env: {}
  });
  assert.equal(disabled.status, 202);
  assert.equal(disabled.headers.get("X-Telemetry-Status"), "disabled");

  const writesBeforeDuplicateMetrics = writes.length;
  const duplicateMetrics = await module.onRequestPost({
    request: new Request("https://bargig-furniture.com/api/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://bargig-furniture.com",
        "Sec-Fetch-Site": "same-origin"
      },
      body: JSON.stringify({
        version: 1,
        events: [
          { name: "page_view" },
          { name: "page_load", durationMs: 300 },
          { name: "first_catalog_image", durationMs: 500 }
        ]
      })
    }),
    env
  });
  assert.equal(duplicateMetrics.status, 202);
  assert.deepEqual(await duplicateMetrics.json(), { ok: true, accepted: 0 });
  assert.equal(writes.length, writesBeforeDuplicateMetrics);

  const legacySchema = await module.onRequestPost({
    request: new Request("https://bargig-furniture.com/api/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://bargig-furniture.com",
        "Sec-Fetch-Site": "same-origin"
      },
      body: JSON.stringify({ version: 1, events: [{ name: "catalog_open", catalogId: "legacy-client" }] })
    }),
    env
  });
  assert.equal(legacySchema.status, 202);
  assert.deepEqual(await legacySchema.json(), { ok: true, accepted: 1 });

  const health = await module.onRequestGet({ env });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: "site-telemetry", storage: true });

  console.log("telemetry_function_logic.test.js: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
