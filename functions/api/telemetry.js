/**
 * Cloudflare Pages Function: privacy-first catalog telemetry ingestion.
 *
 * Stores only a strict, coarse schema in Workers Analytics Engine. The request
 * IP, User-Agent, cookies, full referrer and error stacks are deliberately not
 * read or stored.
 */

const ALLOWED_EVENTS = new Set([
  "app_session",
  "catalog_open",
  "search",
  "favorite",
  "contact",
  "js_error",
  "resource_error",
  "search_index_load_failed",
  "image_error",
  "image_attempt_failed",
  "image_recovered",
  "image_terminal_failure",
  "web_vital"
]);
const ALLOWED_HOSTS = new Set(["bargig-furniture.com", "www.bargig-furniture.com"]);
const ALLOWED_VIEWPORTS = new Set(["xs", "sm", "md", "lg", "xl"]);
const ALLOWED_VISIBILITY = new Set(["visible", "hidden", "preload", "background", "unknown"]);
const ALLOWED_IMAGE_TIERS = new Set(["thumb", "medium", "full", "unknown"]);
const ALLOWED_NETWORK_STATES = new Set(["online", "offline", "unknown"]);
const RELEASE_ID_RE = /^(?:deploy-[a-f0-9]{16}|app-[a-f0-9]{8,16}|app-unversioned|unknown-release)$/i;
const REQUEST_ID_RE = /^ir-[a-z0-9-]{8,45}$/i;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS = 20;

function cleanText(value, limit = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanNumber(value, min = 0, max = 86_400_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(min, number));
}

function cleanViewport(value) {
  const viewport = cleanText(value, 12).toLowerCase();
  return ALLOWED_VIEWPORTS.has(viewport) ? viewport : "";
}

function cleanToken(value, limit = 50) {
  return cleanText(value, limit)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, limit);
}

function cleanVisibility(value) {
  const visibility = cleanToken(value, 20);
  return ALLOWED_VISIBILITY.has(visibility) ? visibility : "unknown";
}

function cleanEnumToken(value, allowed, limit = 20) {
  const token = cleanToken(value, limit);
  return allowed.has(token) ? token : "unknown";
}

function cleanRequestId(value) {
  const requestId = cleanToken(value, 48);
  return REQUEST_ID_RE.test(requestId) ? requestId : "";
}

function cleanReleaseId(value) {
  const releaseId = cleanText(value, 64).toLowerCase();
  return RELEASE_ID_RE.test(releaseId) ? releaseId : "";
}

function responseHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...extra
  };
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(extraHeaders)
  });
}

function requestIsSameOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return false;
  if (!origin && !fetchSite) return false;
  if (origin && origin !== url.origin) return false;
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;
  return true;
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const name = cleanText(raw.name, 40);
  if (!ALLOWED_EVENTS.has(name)) return null;

  const path = cleanText(raw.path, 180) || "/";
  return {
    name,
    page: cleanText(raw.page, 30),
    path: path.startsWith("/") ? path : `/${path}`,
    catalogId: cleanText(raw.catalogId, 100),
    query: cleanText(raw.query, 80),
    scope: cleanText(raw.scope, 50),
    action: cleanText(raw.action, 50),
    detail: cleanText(raw.detail, 120),
    error: cleanText(raw.error, 80),
    viewport: cleanViewport(raw.viewport),
    source: cleanText(raw.source, 80),
    value: cleanNumber(raw.value, -1_000_000, 1_000_000),
    durationMs: cleanNumber(raw.durationMs),
    pageNumber: cleanNumber(raw.pageNumber, 0, 100_000),
    secondaryValue: cleanNumber(raw.secondaryValue, -1_000_000, 1_000_000),
    releaseId: cleanReleaseId(raw.releaseId),
    component: cleanToken(raw.component, 50),
    surface: cleanToken(raw.surface, 50),
    requestId: cleanRequestId(raw.requestId),
    visibility: cleanVisibility(raw.visibility),
    requestedTier: cleanEnumToken(raw.requestedTier, ALLOWED_IMAGE_TIERS, 16),
    networkState: cleanEnumToken(raw.networkState, ALLOWED_NETWORK_STATES, 16)
  };
}

function writeEvent(dataset, event, hostname, batchIndex) {
  dataset.writeDataPoint({
    indexes: [batchIndex],
    blobs: [
      event.name,
      event.page,
      event.path,
      event.catalogId,
      event.query,
      event.scope,
      event.action,
      event.detail,
      event.error,
      event.viewport,
      event.source,
      hostname,
      event.releaseId,
      event.component,
      event.surface,
      event.requestId,
      event.visibility,
      event.requestedTier,
      event.networkState
    ],
    doubles: [
      event.value,
      event.durationMs,
      event.pageNumber,
      event.secondaryValue
    ]
  });
}

export async function onRequestGet(context) {
  return jsonResponse({
    ok: true,
    service: "site-telemetry",
    storage: Boolean(context.env?.SITE_TELEMETRY?.writeDataPoint)
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!requestIsSameOrigin(request)) {
    return jsonResponse({ ok: false, error: "cross-origin" }, 403);
  }

  const contentType = String(request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return jsonResponse({ ok: false, error: "content-type" }, 415);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "payload-too-large" }, 413);
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "unreadable-body" }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "payload-too-large" }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid-json" }, 400);
  }

  if (![1, 2, 3, 4].includes(payload?.version) || !Array.isArray(payload.events)) {
    return jsonResponse({ ok: false, error: "invalid-schema" }, 400);
  }

  const events = payload.events.slice(0, MAX_EVENTS).map(normalizeEvent).filter(Boolean);
  if (!events.length) return jsonResponse({ ok: true, accepted: 0 }, 202);

  const dataset = env?.SITE_TELEMETRY;
  if (!dataset || typeof dataset.writeDataPoint !== "function") {
    return jsonResponse(
      { ok: true, accepted: 0, storage: "disabled" },
      202,
      { "X-Telemetry-Status": "disabled" }
    );
  }

  const hostname = cleanText(new URL(request.url).hostname.toLowerCase(), 96);
  const batchIndex = crypto.randomUUID();
  for (const event of events) writeEvent(dataset, event, hostname, batchIndex);
  return jsonResponse({ ok: true, accepted: events.length }, 202);
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Allow": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function onRequest() {
  return jsonResponse({ ok: false, error: "method-not-allowed" }, 405, {
    "Allow": "GET, POST, OPTIONS"
  });
}
