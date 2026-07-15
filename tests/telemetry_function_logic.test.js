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
      version: 1,
      events: [
        {
          name: "search",
          page: "home",
          path: "/index.html",
          query: "  ארון   פתיחה  ",
          value: 0,
          stack: "must never be stored",
          userAgent: "must never be stored"
        },
        {
          name: "js_error",
          error: "e12345678",
          detail: "TypeError",
          pageNumber: 44
        },
        { name: "unknown_event", detail: "ignored" }
      ]
    })
  });

  const response = await module.onRequestPost({ request, env });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, accepted: 2 });
  assert.equal(writes.length, 2);
  assert.match(writes[0].indexes[0], /^[0-9a-f-]{36}$/i);
  assert.equal(writes[0].indexes[0], writes[1].indexes[0]);
  assert.equal(writes[0].blobs[11], "bargig-furniture.com");
  assert.equal(writes[0].blobs[0], "search");
  assert.equal(writes[0].blobs[4], "ארון פתיחה");
  assert.equal(writes[1].blobs[8], "e12345678");
  assert.equal(JSON.stringify(writes).includes("must never be stored"), false);

  const crossOrigin = new Request("https://bargig-furniture.com/api/telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://attacker.example",
      "Sec-Fetch-Site": "cross-site"
    },
    body: JSON.stringify({ version: 1, events: [{ name: "page_view" }] })
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
      body: JSON.stringify({ version: 1, events: [{ name: "page_view" }] })
    }),
    env: {}
  });
  assert.equal(disabled.status, 202);
  assert.equal(disabled.headers.get("X-Telemetry-Status"), "disabled");

  const health = await module.onRequestGet({ env });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: "site-telemetry", storage: true });

  console.log("telemetry_function_logic.test.js: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
