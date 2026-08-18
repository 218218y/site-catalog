/**
 * Cloudflare Pages Function: privacy-first catalog telemetry ingestion.
 *
 * Stores only a strict, coarse schema in Workers Analytics Engine. The request
 * IP, User-Agent, cookies, full referrer and error stacks are deliberately not
 * read or stored.
 */

const TELEMETRY_SCHEMA_VERSION = 4;
const IMAGE_EVENT_FIELDS = Object.freeze([
  "catalogId",
  "pageNumber",
  "detail",
  "action",
  "source",
  "value",
  "error",
  "surface",
  "requestId",
  "visibility",
  "requestedTier",
  "networkState"
]);
const EVENT_FIELDS = Object.freeze({
  app_session: Object.freeze(["action", "visibility"]),
  catalog_open: Object.freeze(["catalogId", "pageNumber", "source"]),
  search: Object.freeze(["catalogId", "query", "scope", "action", "source", "value"]),
  favorite: Object.freeze(["catalogId", "action", "pageNumber", "value"]),
  contact: Object.freeze(["catalogId", "action", "detail", "source", "pageNumber", "value"]),
  js_error: Object.freeze([
    "catalogId", "action", "detail", "scope", "source", "pageNumber", "secondaryValue", "error"
  ]),
  resource_error: Object.freeze(["action", "detail", "scope", "source", "error"]),
  search_index_load_failed: Object.freeze(["action", "detail", "scope", "source", "error"]),
  image_attempt_failed: IMAGE_EVENT_FIELDS,
  image_recovered: IMAGE_EVENT_FIELDS,
  image_terminal_failure: IMAGE_EVENT_FIELDS,
  web_vital: Object.freeze(["action", "detail", "source", "component", "value"])
});
const ALLOWED_EVENTS = new Set(Object.keys(EVENT_FIELDS));
const ALLOWED_HOSTS = new Set(["bargig-furniture.com", "www.bargig-furniture.com"]);
const ALLOWED_VIEWPORTS = new Set(["xs", "sm", "md", "lg", "xl"]);
const ALLOWED_VISIBILITY = new Set(["visible", "hidden", "preload", "background", "unknown"]);
const ALLOWED_IMAGE_TIERS = new Set(["thumb", "medium", "full", "unknown"]);
const ALLOWED_NETWORK_STATES = new Set(["online", "offline", "unknown"]);
const NAVIGATION_ACTIONS = new Set(["navigate", "reload", "back_forward", "prerender"]);
const EVENT_ACTIONS = Object.freeze({
  app_session: NAVIGATION_ACTIONS,
  search: new Set(["submit", "result-open"]),
  favorite: new Set(["add", "remove", "clear"]),
  contact: new Set(["phone", "email", "gmail", "copy", "share"]),
  web_vital: new Set(["LCP", "INP", "CLS"])
});
const WEB_VITAL_RATINGS = new Set(["good", "needs-improvement", "poor"]);
const RELEASE_ID_RE = /^(?:deploy-[a-f0-9]{16}|app-[a-f0-9]{8,16}|app-unversioned|unknown-release)$/i;
const REQUEST_ID_RE = /^ir-[a-z0-9-]{8,45}$/i;
const ERROR_FINGERPRINT_RE = /^e[a-f0-9]{8}$/i;
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

function cleanPath(value) {
  const rawPath = cleanText(value, 180) || "/";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return path.split(/[?#]/, 1)[0] || "/";
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

function cleanEnumText(value, allowed, limit = 50) {
  const text = cleanText(value, limit);
  return allowed.has(text) ? text : "";
}

function cleanEventAction(eventName, value) {
  const allowed = EVENT_ACTIONS[eventName];
  return allowed ? cleanEnumText(value, allowed, 50) : cleanText(value, 50);
}

function cleanErrorFingerprint(value) {
  const fingerprint = cleanText(value, 16).toLowerCase();
  return ERROR_FINGERPRINT_RE.test(fingerprint) ? fingerprint : "";
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
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
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

  const allowedFields = EVENT_FIELDS[name];
  const field = (key) => allowedFields.includes(key) ? raw[key] : undefined;
  return {
    name,
    page: cleanText(raw.page, 30),
    path: cleanPath(raw.path),
    catalogId: cleanText(field("catalogId"), 100),
    query: cleanText(field("query"), 80),
    scope: cleanText(field("scope"), 50),
    action: cleanEventAction(name, field("action")),
    detail: name === "web_vital"
      ? cleanEnumText(field("detail"), WEB_VITAL_RATINGS, 24)
      : cleanText(field("detail"), 120),
    error: cleanErrorFingerprint(field("error")),
    viewport: cleanViewport(raw.viewport),
    source: name === "web_vital"
      ? cleanEnumText(field("source"), NAVIGATION_ACTIONS, 24)
      : cleanText(field("source"), 80),
    value: cleanNumber(field("value"), -1_000_000, 1_000_000),
    durationMs: cleanNumber(field("durationMs")),
    pageNumber: cleanNumber(field("pageNumber"), 0, 100_000),
    secondaryValue: cleanNumber(field("secondaryValue"), -1_000_000, 1_000_000),
    releaseId: cleanReleaseId(raw.releaseId),
    component: cleanToken(field("component"), 50),
    surface: cleanToken(field("surface"), 50),
    requestId: cleanRequestId(field("requestId")),
    visibility: allowedFields.includes("visibility") ? cleanVisibility(raw.visibility) : "",
    requestedTier: allowedFields.includes("requestedTier")
      ? cleanEnumToken(raw.requestedTier, ALLOWED_IMAGE_TIERS, 16)
      : "",
    networkState: allowedFields.includes("networkState")
      ? cleanEnumToken(raw.networkState, ALLOWED_NETWORK_STATES, 16)
      : ""
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
  const mediaType = contentType.split(";", 1)[0].trim();
  if (mediaType !== "application/json") {
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

  if (
    !payload
    || typeof payload !== "object"
    || Array.isArray(payload)
    || payload.version !== TELEMETRY_SCHEMA_VERSION
    || !Array.isArray(payload.events)
  ) {
    return jsonResponse({ ok: false, error: "invalid-schema" }, 400);
  }
  if (payload.events.length > MAX_EVENTS) {
    return jsonResponse({ ok: false, error: "too-many-events" }, 413);
  }

  const events = payload.events.map(normalizeEvent).filter(Boolean);
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
