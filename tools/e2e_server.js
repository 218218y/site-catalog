#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = 4173;
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

function parsePort(argv) {
  const index = argv.indexOf("--port");
  const candidate = index >= 0 ? Number(argv[index + 1]) : Number(process.env.PORT);
  return Number.isInteger(candidate) && candidate > 0 && candidate < 65536 ? candidate : DEFAULT_PORT;
}

function safeFilePath(requestUrl) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname || "/");
  if (pathname === "/") pathname = "/index.html";
  const relative = pathname.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) return null;
  return resolved;
}

function writeResponse(response, status, headers, body = "") {
  response.writeHead(status, {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  response.end(body);
}

function serveFile(request, response) {
  const filePath = safeFilePath(request.url || "/");
  if (!filePath) {
    writeResponse(response, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Bad request");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      writeResponse(response, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
      return;
    }

    const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!response.headersSent) {
        writeResponse(response, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Server error");
      } else {
        response.destroy();
      }
    });
    stream.pipe(response);
  });
}

const port = parsePort(process.argv.slice(2));
const server = http.createServer((request, response) => {
  if (!request.method || !["GET", "HEAD"].includes(request.method)) {
    writeResponse(response, 405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }, "Method not allowed");
    return;
  }
  serveFile(request, response);
});

function shutdown(signal) {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
  if (signal) process.stderr.write(`\n${signal}: closing E2E server\n`);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`E2E server listening on http://127.0.0.1:${port}\n`);
});
