#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = 4173;
const DEFAULT_ROOT = path.join(PROJECT_ROOT, "dist", "site-local");
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

function parseOptions(argv) {
  const portIndex = argv.indexOf("--port");
  const portCandidate = portIndex >= 0 ? Number(argv[portIndex + 1]) : Number(process.env.PORT);
  const rootIndex = argv.indexOf("--root");
  const rootCandidate = rootIndex >= 0 ? String(argv[rootIndex + 1] || "") : String(process.env.SITE_ROOT || "");
  return {
    port: Number.isInteger(portCandidate) && portCandidate > 0 && portCandidate < 65536 ? portCandidate : DEFAULT_PORT,
    root: path.resolve(PROJECT_ROOT, rootCandidate || DEFAULT_ROOT)
  };
}

const options = parseOptions(process.argv.slice(2));
const SERVER_ROOT = options.root;

function readRootSecurityHeaders() {
  const headerFile = path.join(SERVER_ROOT, "_headers");
  const result = {};
  if (!fs.existsSync(headerFile)) return result;
  const lines = fs.readFileSync(headerFile, "utf8").split(/\r?\n/);
  const rootIndex = lines.findIndex((line) => line.trim() === "/*");
  if (rootIndex < 0) return result;
  for (const line of lines.slice(rootIndex + 1)) {
    if (!/^\s+/.test(line) || !line.trim()) break;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

const ROOT_SECURITY_HEADERS = readRootSecurityHeaders();

function safeFilePath(requestUrl) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname || "/");
  if (pathname === "/") pathname = "/index.html";
  const relative = pathname.replace(/^\/+/, "");
  const resolved = path.resolve(SERVER_ROOT, relative);
  if (resolved !== SERVER_ROOT && !resolved.startsWith(`${SERVER_ROOT}${path.sep}`)) return null;
  return resolved;
}

function writeResponse(response, status, headers, body = "") {
  response.writeHead(status, {
    "Cache-Control": "no-store, max-age=0",
    ...ROOT_SECURITY_HEADERS,
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  response.end(body);
}

function resolveFile(filePath, callback) {
  fs.stat(filePath, (statError, stats) => {
    if (!statError && stats.isDirectory()) {
      const indexFile = path.join(filePath, "index.html");
      fs.stat(indexFile, (indexError, indexStats) => {
        callback(!indexError && indexStats.isFile() ? indexFile : null);
      });
      return;
    }
    callback(!statError && stats.isFile() ? filePath : null);
  });
}

function serveFile(request, response) {
  const requestedPath = safeFilePath(request.url || "/");
  if (!requestedPath) {
    writeResponse(response, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Bad request");
    return;
  }

  resolveFile(requestedPath, (filePath) => {
    if (!filePath) {
      const errorPage = path.join(SERVER_ROOT, "404.html");
      if (fs.existsSync(errorPage)) {
        const body = fs.readFileSync(errorPage);
        writeResponse(response, 404, { "Content-Type": "text/html; charset=utf-8" }, request.method === "HEAD" ? "" : body);
      } else {
        writeResponse(response, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
      }
      return;
    }

    const stats = fs.statSync(filePath);
    const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": "no-store, max-age=0",
      ...ROOT_SECURITY_HEADERS,
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

if (!fs.existsSync(path.join(SERVER_ROOT, "index.html"))) {
  process.stderr.write(`E2E site root is not built: ${SERVER_ROOT}\n`);
  process.exit(1);
}

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

server.listen(options.port, "127.0.0.1", () => {
  process.stdout.write(`E2E server listening on http://127.0.0.1:${options.port}\n`);
  process.stdout.write(`Serving generated site: ${SERVER_ROOT}\n`);
});
