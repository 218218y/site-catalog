/**
 * Source module: 15-telemetry.js
 * Privacy-first business telemetry and runtime error reporting.
 *
 * The browser sends only whitelisted, coarse events to the same-origin Pages Function.
 * No cookie, persistent visitor id, IP address, full referrer, user agent, or error stack is sent.
 * Respect for Global Privacy Control and Do Not Track is built in.
 */

const TELEMETRY_ENDPOINT = "/api/telemetry";
const TELEMETRY_SCHEMA_VERSION = 1;
const TELEMETRY_BATCH_LIMIT = 20;
const TELEMETRY_QUEUE_LIMIT = 60;
const TELEMETRY_FLUSH_DELAY_MS = 900;
const TELEMETRY_SEARCH_DEDUP_MS = 1200;
const TELEMETRY_ALLOWED_HOSTS = new Set([
  "bargig-furniture.com",
  "www.bargig-furniture.com"
]);
const TELEMETRY_EVENT_NAMES = new Set([
  "catalog_open",
  "search",
  "favorite",
  "contact",
  "js_error",
  "image_error"
]);

const telemetryRuntime = {
  enabled: null,
  queue: [],
  flushTimer: 0,
  flushing: false,
  catalogKey: "",
  catalogAt: 0,
  searchKeys: new Map(),
  imageFailures: new Set(),
  initialized: false
};

function telemetryCleanText(value, limit = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function telemetryCleanPathname(value = window.location.pathname) {
  const pathname = telemetryCleanText(value, 180) || "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function telemetryViewportBucket() {
  const width = Math.max(0, Number(window.innerWidth) || 0);
  if (width < 480) return "xs";
  if (width < 760) return "sm";
  if (width < 1100) return "md";
  if (width < 1600) return "lg";
  return "xl";
}

function telemetryPrivacySignalEnabled() {
  if (navigator.globalPrivacyControl === true) return true;
  const dnt = String(navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "").toLowerCase();
  return dnt === "1" || dnt === "yes";
}

function telemetryIsEnabled() {
  if (telemetryRuntime.enabled !== null) return telemetryRuntime.enabled;
  if (window.__BARGIG_DISABLE_TELEMETRY__ === true || telemetryPrivacySignalEnabled()) {
    telemetryRuntime.enabled = false;
    return false;
  }

  const forced = window.__BARGIG_ENABLE_TELEMETRY__ === true;
  const productionHost = TELEMETRY_ALLOWED_HOSTS.has(window.location.hostname.toLowerCase());
  telemetryRuntime.enabled = Boolean(forced || productionHost);
  return telemetryRuntime.enabled;
}

function telemetryNumber(value, min = 0, max = 86_400_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(min, number));
}

function telemetryErrorFingerprint(parts) {
  const source = parts.map((part) => telemetryCleanText(part, 160)).join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `e${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function telemetryNormalizeEvent(name, fields = {}) {
  const eventName = telemetryCleanText(name, 40);
  if (!TELEMETRY_EVENT_NAMES.has(eventName)) return null;

  return {
    name: eventName,
    page: telemetryCleanText(fields.page || currentAppPage || document.body?.dataset?.page || "", 30),
    path: telemetryCleanPathname(fields.path),
    catalogId: telemetryCleanText(fields.catalogId, 100),
    query: telemetryCleanText(fields.query, 80),
    scope: telemetryCleanText(fields.scope, 50),
    action: telemetryCleanText(fields.action, 50),
    detail: telemetryCleanText(fields.detail, 120),
    error: telemetryCleanText(fields.error, 80),
    viewport: telemetryViewportBucket(),
    source: telemetryCleanText(fields.source, 50),
    value: telemetryNumber(fields.value, -1_000_000, 1_000_000),
    durationMs: telemetryNumber(fields.durationMs),
    pageNumber: telemetryNumber(fields.pageNumber, 0, 100_000),
    secondaryValue: telemetryNumber(fields.secondaryValue, -1_000_000, 1_000_000)
  };
}

function telemetryScheduleFlush(delay = TELEMETRY_FLUSH_DELAY_MS) {
  window.clearTimeout(telemetryRuntime.flushTimer);
  telemetryRuntime.flushTimer = window.setTimeout(() => {
    telemetryRuntime.flushTimer = 0;
    telemetryFlush().catch(() => {});
  }, Math.max(0, delay));
}

function telemetryTrack(name, fields = {}, options = {}) {
  if (!telemetryIsEnabled()) return false;
  const event = telemetryNormalizeEvent(name, fields);
  if (!event) return false;

  if (telemetryRuntime.queue.length >= TELEMETRY_QUEUE_LIMIT) {
    telemetryRuntime.queue.splice(0, telemetryRuntime.queue.length - TELEMETRY_QUEUE_LIMIT + 1);
  }
  telemetryRuntime.queue.push(event);
  telemetryScheduleFlush(options.immediate ? 0 : TELEMETRY_FLUSH_DELAY_MS);
  return true;
}

async function telemetryFlush(options = {}) {
  if (!telemetryIsEnabled() || telemetryRuntime.flushing || !telemetryRuntime.queue.length) return false;

  window.clearTimeout(telemetryRuntime.flushTimer);
  telemetryRuntime.flushTimer = 0;
  const events = telemetryRuntime.queue.splice(0, TELEMETRY_BATCH_LIMIT);
  const body = JSON.stringify({ version: TELEMETRY_SCHEMA_VERSION, events });
  telemetryRuntime.flushing = true;

  try {
    if (options.beacon && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: "application/json" }));
      if (!queued) telemetryRuntime.queue.unshift(...events);
      return queued;
    }

    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
      redirect: "error"
    });
    if (!response.ok && response.status !== 202 && response.status !== 204) {
      throw new Error(`telemetry-http-${response.status}`);
    }
    return true;
  } catch (_error) {
    // Telemetry must never interfere with the catalog. Events are deliberately
    // not persisted or retried across page loads, which also protects privacy.
    return false;
  } finally {
    telemetryRuntime.flushing = false;
    if (telemetryRuntime.queue.length) telemetryScheduleFlush(250);
  }
}

function telemetryTrackCatalogOpen(catalog, page, source = LIGHTBOX_SOURCE_CATALOG) {
  if (!catalog) return;
  const now = Date.now();
  const key = `${catalog.id}|${source}`;
  if (key === telemetryRuntime.catalogKey && now - telemetryRuntime.catalogAt < 1200) return;
  telemetryRuntime.catalogKey = key;
  telemetryRuntime.catalogAt = now;
  telemetryTrack("catalog_open", {
    page: "viewer",
    catalogId: catalog.id,
    pageNumber: page,
    source
  });
}

function telemetryTrackSearch(query, resultCount, options = {}) {
  if (!telemetryIsEnabled()) return false;
  const cleanQuery = telemetryCleanText(query, 80);
  if (cleanQuery.length < 2) return false;

  const surface = telemetryCleanText(options.surface || "global", 30);
  const scope = telemetryCleanText(options.scope || "all", 50);
  const catalogId = telemetryCleanText(options.catalogId, 100);
  const completion = telemetryCleanText(options.completion || "submit", 30);
  const count = Math.max(0, Number(resultCount) || 0);
  const key = `${surface}|${cleanQuery}|${count}|${scope}|${catalogId}|${completion}`;
  const now = Date.now();
  const previous = telemetryRuntime.searchKeys.get(key) || 0;
  if (now - previous < TELEMETRY_SEARCH_DEDUP_MS) return false;
  telemetryRuntime.searchKeys.set(key, now);

  if (telemetryRuntime.searchKeys.size > 80) {
    for (const [storedKey, timestamp] of telemetryRuntime.searchKeys) {
      if (now - timestamp > 60_000) telemetryRuntime.searchKeys.delete(storedKey);
    }
  }

  return telemetryTrack("search", {
    query: cleanQuery,
    scope,
    catalogId,
    source: surface,
    action: completion,
    value: count
  });
}

function telemetryTrackFavorite(action, catalogId = "", pageNumber = 0, count = 0) {
  telemetryTrack("favorite", {
    action,
    catalogId,
    pageNumber,
    value: count
  });
}

function telemetryCatalogImageContext(img, src = "") {
  const value = String(src || img?.currentSrc || img?.getAttribute?.("src") || "");
  const match = value.match(/\/assets\/pages\/([^/]+)\/(?:thumbs\/)?page-(\d+)/i);
  const catalogId = telemetryCleanText(match?.[1] || img?.dataset?.catalogId || state.catalog?.id || "", 100);
  const pageNumber = Number.parseInt(match?.[2] || img?.dataset?.page || state.page || 0, 10) || 0;
  let detail = "image";
  if (/\/thumbs\//i.test(value)) detail = "thumbnail";
  else if (img === els.lightboxImage || img?.id === "lightboxImage") detail = "viewer";
  else if (img?.classList?.contains("catalog-cover")) detail = "cover";
  return { catalogId, pageNumber, detail, value };
}

function telemetryStableImageFailureKey(value, detail) {
  const clean = String(value || "")
    .replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1")
    .replace(/[?&]$/, "")
    .split("#")[0];
  return `${telemetryCleanText(clean, 220)}|${telemetryCleanText(detail, 50)}`;
}

function telemetryTrackImageFailure(src, options = {}) {
  const context = telemetryCatalogImageContext(options.img, src);
  const detail = telemetryCleanText(options.detail || context.detail, 50);
  const failureKey = telemetryStableImageFailureKey(context.value, detail)
    || `${context.catalogId}|${context.pageNumber}|${detail}`;
  if (telemetryRuntime.imageFailures.has(failureKey)) return;
  telemetryRuntime.imageFailures.add(failureKey);
  const source = telemetryCleanText(context.value.split("?")[0].split("#")[0].split("/").pop(), 80);
  telemetryTrack("image_error", {
    catalogId: context.catalogId,
    pageNumber: context.pageNumber,
    detail,
    source,
    error: telemetryErrorFingerprint(["image", context.catalogId, context.pageNumber, detail, source])
  }, { immediate: true });
}

function telemetryErrorSourceScope(filename) {
  const value = String(filename || "").toLowerCase();
  if (!value) return "inline";
  if (/^(?:chrome|moz|safari)-extension:/.test(value)) return "extension";
  try {
    const parsed = new URL(value, window.location.href);
    return parsed.origin === window.location.origin ? "site" : "external";
  } catch {
    return "unknown";
  }
}

function telemetryTrackRuntimeError(event) {
  const filename = String(event?.filename || "");
  const sourceName = telemetryCleanText(filename.split("?")[0].split("/").pop(), 80);
  const errorName = telemetryCleanText(event?.error?.name || "Error", 40);
  const message = telemetryCleanText(event?.message || event?.error?.message || "JavaScript error", 120);
  telemetryTrack("js_error", {
    catalogId: state.catalog?.id || "",
    action: errorName,
    detail: message,
    scope: telemetryErrorSourceScope(filename),
    source: sourceName,
    pageNumber: Number(event?.lineno) || 0,
    secondaryValue: Number(event?.colno) || 0,
    error: telemetryErrorFingerprint([errorName, message, sourceName, event?.lineno, event?.colno])
  }, { immediate: true });
}

function telemetryTrackUnhandledRejection(event) {
  const reason = event?.reason;
  const errorName = telemetryCleanText(reason?.name || "UnhandledRejection", 40);
  const message = telemetryCleanText(reason?.message || reason || "Unhandled promise rejection", 120);
  telemetryTrack("js_error", {
    catalogId: state.catalog?.id || "",
    action: errorName,
    detail: message,
    scope: "promise",
    error: telemetryErrorFingerprint([errorName, message, "promise"]),
    source: "promise"
  }, { immediate: true });
}

function telemetryHandleDocumentClick(event) {
  const link = event.target?.closest?.("a[href]");
  if (!link) return;
  const href = String(link.getAttribute("href") || "").trim();
  let action = telemetryCleanText(link.dataset.contactAction, 50);
  if (!action && href.startsWith("tel:")) action = "phone";
  else if (!action && href.startsWith("mailto:")) action = "email";
  else if (!action && (link.classList.contains("site-footer-gmail-link") || /mail\.google\.com/i.test(href))) action = "gmail";
  if (action) {
    telemetryTrack("contact", {
      action,
      source: link.dataset.contactSource || "footer",
      catalogId: link.dataset.contactCatalogId || "",
      pageNumber: link.dataset.contactPage || 0
    }, { immediate: true });
  }
}

function telemetryInit() {
  if (telemetryRuntime.initialized) return;
  telemetryRuntime.initialized = true;
  if (!telemetryIsEnabled()) return;

  window.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) {
      if (event.target.dataset.telemetryManaged !== "true") {
        telemetryTrackImageFailure(event.target.currentSrc || event.target.src, { img: event.target });
      }
      return;
    }
    telemetryTrackRuntimeError(event);
  }, true);
  window.addEventListener("unhandledrejection", telemetryTrackUnhandledRejection);
  document.addEventListener("click", telemetryHandleDocumentClick, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") telemetryFlush({ beacon: true }).catch(() => {});
  });
  window.addEventListener("pagehide", () => telemetryFlush({ beacon: true }).catch(() => {}));
}
