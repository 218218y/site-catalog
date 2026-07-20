/**
 * Source module: 15-telemetry.js
 * Privacy-first business telemetry and runtime error reporting.
 *
 * The browser sends only whitelisted, coarse events to the same-origin Pages Function.
 * No cookie, persistent visitor id, IP address, full referrer, user agent, or error stack is sent.
 * Respect for Global Privacy Control and Do Not Track is built in.
 */

const TELEMETRY_ENDPOINT = "/api/telemetry";
const TELEMETRY_SCHEMA_VERSION = 2;
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
  "resource_error",
  "search_index_load_failed",
  "image_attempt_failed",
  "image_recovered",
  "image_terminal_failure",
  "web_vital"
]);

const telemetryRuntime = {
  enabled: null,
  queue: [],
  flushTimer: 0,
  flushing: false,
  catalogKey: "",
  catalogAt: 0,
  searchKeys: new Map(),
  diagnosticEvents: new Set(),
  webVitals: {
    supported: new Set(),
    reported: new Set(),
    lcp: 0,
    inp: 0,
    cls: 0,
    clsSessionValue: 0,
    clsSessionStart: 0,
    clsLastEntry: 0
  },
  initialized: false
};

function telemetryResolveReleaseId() {
  const explicit = String(window.__BARGIG_RELEASE_ID__ || "").trim();
  if (explicit) return telemetryCleanText(explicit, 64);

  const scriptSrc = String(document.currentScript?.src || "");
  const filename = scriptSrc.split("?")[0].split("#")[0].split("/").pop() || "";
  const fingerprint = filename.match(/^app\.([a-f0-9]{8,64})\.js$/i)?.[1];
  if (fingerprint) return `app-${fingerprint.slice(0, 16).toLowerCase()}`;
  return filename === "app.js" ? "app-unversioned" : "unknown-release";
}

const TELEMETRY_RELEASE_ID = telemetryResolveReleaseId();

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
    secondaryValue: telemetryNumber(fields.secondaryValue, -1_000_000, 1_000_000),
    releaseId: telemetryCleanText(fields.releaseId || TELEMETRY_RELEASE_ID, 64)
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
  }, { immediate: options.immediate === true });
}

function telemetryTrackFavorite(action, catalogId = "", pageNumber = 0, count = 0) {
  telemetryTrack("favorite", {
    action,
    catalogId,
    pageNumber,
    value: count
  });
}

const TELEMETRY_WEB_VITAL_THRESHOLDS = Object.freeze({
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25]
});

function telemetryWebVitalRating(name, value) {
  const thresholds = TELEMETRY_WEB_VITAL_THRESHOLDS[name];
  if (!thresholds) return "unknown";
  if (value <= thresholds[0]) return "good";
  if (value <= thresholds[1]) return "needs-improvement";
  return "poor";
}

function telemetryNavigationType() {
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  return telemetryCleanText(navigation?.type || "navigate", 30);
}

function telemetryReportWebVitals() {
  const runtime = telemetryRuntime.webVitals;
  for (const name of ["LCP", "INP", "CLS"]) {
    if (!runtime.supported.has(name) || runtime.reported.has(name)) continue;
    const value = Number(runtime[name.toLowerCase()]);
    if (!Number.isFinite(value) || value < 0) continue;
    if ((name === "LCP" || name === "INP") && value === 0) continue;
    runtime.reported.add(name);
    telemetryTrack("web_vital", {
      action: name,
      detail: telemetryWebVitalRating(name, value),
      source: telemetryNavigationType(),
      value
    }, { immediate: true });
  }
}

function telemetryObserveWebVitals() {
  if (typeof PerformanceObserver !== "function") return;
  const supported = new Set(PerformanceObserver.supportedEntryTypes || []);
  const runtime = telemetryRuntime.webVitals;

  if (supported.has("largest-contentful-paint")) {
    runtime.supported.add("LCP");
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries[entries.length - 1];
        if (latest) runtime.lcp = Math.max(0, Number(latest.startTime) || 0);
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_error) {}
  }

  if (supported.has("layout-shift")) {
    runtime.supported.add("CLS");
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          const start = Number(entry.startTime) || 0;
          const value = Number(entry.value) || 0;
          const sameSession = runtime.clsLastEntry
            && start - runtime.clsLastEntry < 1000
            && start - runtime.clsSessionStart < 5000;
          if (sameSession) {
            runtime.clsSessionValue += value;
          } else {
            runtime.clsSessionValue = value;
            runtime.clsSessionStart = start;
          }
          runtime.clsLastEntry = start;
          runtime.cls = Math.max(runtime.cls, runtime.clsSessionValue);
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch (_error) {}
  }

  if (supported.has("event")) {
    runtime.supported.add("INP");
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!Number(entry.interactionId)) continue;
          runtime.inp = Math.max(runtime.inp, Number(entry.duration) || 0);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 40 });
    } catch (_error) {}
  }
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

function telemetryStableResourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.href);
    parsed.hash = "";
    parsed.searchParams.delete(CATALOG_IMAGE_RETRY_PARAM);
    return parsed.href;
  } catch {
    return raw
      .replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1")
      .replace(/[?&]$/, "")
      .split("#")[0];
  }
}

function telemetryResourceSourceName(value) {
  const clean = telemetryStableResourceUrl(value);
  if (!clean) return "inline";
  try {
    const parsed = new URL(clean, window.location.href);
    if (["data:", "blob:"].includes(parsed.protocol)) return parsed.protocol.slice(0, -1);
    return telemetryCleanText(parsed.pathname.split("/").pop() || "root", 80);
  } catch {
    return telemetryCleanText(clean.split("/").pop() || "unknown", 80);
  }
}

function telemetryDiagnosticOnce(key) {
  const cleanKey = telemetryCleanText(key, 320);
  if (!cleanKey || telemetryRuntime.diagnosticEvents.has(cleanKey)) return false;
  telemetryRuntime.diagnosticEvents.add(cleanKey);
  if (telemetryRuntime.diagnosticEvents.size > 240) {
    telemetryRuntime.diagnosticEvents.delete(telemetryRuntime.diagnosticEvents.values().next().value);
  }
  return true;
}

function telemetryTrackImageEvent(name, src, options = {}) {
  const context = telemetryCatalogImageContext(options.img, src);
  const detail = telemetryCleanText(options.detail || context.detail, 50);
  const action = telemetryCleanText(options.action || "", 50);
  const stableUrl = telemetryStableResourceUrl(context.value);
  const source = telemetryResourceSourceName(stableUrl);
  const eventKey = [name, stableUrl, context.catalogId, context.pageNumber, detail, action].join("|");
  if (!telemetryDiagnosticOnce(eventKey)) return false;

  return telemetryTrack(name, {
    catalogId: context.catalogId,
    pageNumber: context.pageNumber,
    detail,
    action,
    source,
    value: telemetryNumber(options.failedAttempts ?? options.attempt ?? options.value, 0, 100),
    error: telemetryErrorFingerprint([name, context.catalogId, context.pageNumber, detail, action, source])
  }, { immediate: true });
}

function telemetryTrackImageAttemptFailure(src, options = {}) {
  return telemetryTrackImageEvent("image_attempt_failed", src, options);
}

function telemetryTrackImageRecovery(src, options = {}) {
  return telemetryTrackImageEvent("image_recovered", src, options);
}

function telemetryTrackImageTerminalFailure(src, options = {}) {
  return telemetryTrackImageEvent("image_terminal_failure", src, options);
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

function telemetryIsRuntimeErrorEvent(event) {
  if (!event) return false;
  if (typeof ErrorEvent === "function" && event instanceof ErrorEvent) return true;
  return Object.prototype.toString.call(event) === "[object ErrorEvent]";
}

function telemetryClassifyWindowError(event) {
  if (typeof HTMLImageElement === "function" && event?.target instanceof HTMLImageElement) return "image";
  if (telemetryIsRuntimeErrorEvent(event)) return "runtime";
  if (typeof Element === "function" && event?.target instanceof Element) return "resource";
  return "ignored";
}

function telemetryTrackRuntimeError(event) {
  if (!telemetryIsRuntimeErrorEvent(event)) return false;
  const filename = String(event.filename || "");
  const sourceName = telemetryResourceSourceName(filename);
  const errorName = telemetryCleanText(event.error?.name || "Error", 40);
  const message = telemetryCleanText(event.message || event.error?.message || "JavaScript error", 120);
  return telemetryTrack("js_error", {
    catalogId: state.catalog?.id || "",
    action: errorName,
    detail: message,
    scope: telemetryErrorSourceScope(filename),
    source: sourceName,
    pageNumber: Number(event.lineno) || 0,
    secondaryValue: Number(event.colno) || 0,
    error: telemetryErrorFingerprint([errorName, message, sourceName, event.lineno, event.colno])
  }, { immediate: true });
}

function telemetryResourceElementUrl(target) {
  return String(target?.currentSrc || target?.src || target?.href || target?.data || "");
}

function telemetryResourceRole(target) {
  const explicit = telemetryCleanText(target?.dataset?.telemetryResourceRole, 50);
  if (explicit) return explicit;
  if (target?.dataset?.searchIndexSrc) return "search-index";

  const tag = String(target?.tagName || "").toLowerCase();
  if (tag === "link") {
    const rel = telemetryCleanText(target.rel || target.getAttribute?.("rel") || "link", 24);
    const asType = telemetryCleanText(target.as || target.getAttribute?.("as") || "", 24);
    return asType ? `${rel}:${asType}` : rel;
  }
  return tag || "resource";
}

function telemetryTrackSearchIndexFailure(reason, options = {}) {
  const src = String(options.src || telemetryResourceElementUrl(options.target) || SEARCH_INDEX_SCRIPT_SRC || "");
  const source = telemetryResourceSourceName(src);
  const action = telemetryCleanText(reason || "load-error", 50);
  const detail = telemetryCleanText(options.trigger || options.target?.dataset?.telemetrySearchTrigger || "unknown", 50);
  const scope = telemetryErrorSourceScope(src);
  const key = ["search_index_load_failed", source, action, scope, detail].join("|");
  if (!telemetryDiagnosticOnce(key)) return false;
  return telemetryTrack("search_index_load_failed", {
    action,
    detail,
    scope,
    source,
    error: telemetryErrorFingerprint(["search-index", action, source, scope])
  }, { immediate: true });
}

function telemetryTrackResourceError(target) {
  const src = telemetryResourceElementUrl(target);
  const role = telemetryResourceRole(target);
  if (role === "search-index") {
    return telemetryTrackSearchIndexFailure("network-error", { target, src });
  }

  const tag = telemetryCleanText(String(target?.tagName || "resource").toLowerCase(), 30);
  const source = telemetryResourceSourceName(src);
  const scope = telemetryErrorSourceScope(src);
  const key = ["resource_error", tag, role, source, scope].join("|");
  if (!telemetryDiagnosticOnce(key)) return false;
  return telemetryTrack("resource_error", {
    action: tag,
    detail: role,
    scope,
    source,
    error: telemetryErrorFingerprint(["resource", tag, role, source, scope])
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
    const classification = telemetryClassifyWindowError(event);
    if (classification === "image") {
      if (event.target.dataset.telemetryManaged !== "true") {
        telemetryTrackImageTerminalFailure(event.target.currentSrc || event.target.src, {
          img: event.target,
          detail: telemetryCatalogImageContext(event.target).detail,
          action: "unmanaged",
          failedAttempts: 1
        });
      }
      return;
    }
    if (classification === "runtime") {
      telemetryTrackRuntimeError(event);
      return;
    }
    if (classification === "resource") telemetryTrackResourceError(event.target);
  }, true);
  window.addEventListener("unhandledrejection", telemetryTrackUnhandledRejection);
  document.addEventListener("click", telemetryHandleDocumentClick, true);
  telemetryObserveWebVitals();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    telemetryReportWebVitals();
    telemetryFlush({ beacon: true }).catch(() => {});
  });
  window.addEventListener("pagehide", () => {
    telemetryReportWebVitals();
    telemetryFlush({ beacon: true }).catch(() => {});
  });
}
