/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: telemetry.js
 * ES module entrypoint: src/runtime/telemetry.js
 * Bundled ES module graph:
 *   - src/runtime/telemetry.js
 * Compiler virtual inputs: none
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.2 (lockfile-selected direct devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// src/runtime/telemetry.js
var TELEMETRY_DEFAULT_CATALOG_SOURCE = "catalog", TELEMETRY_DEFAULT_RETRY_PARAM = "bargig_retry", telemetryContext = {
  getCatalogId: () => "",
  getPageNumber: () => 0,
  retryParam: TELEMETRY_DEFAULT_RETRY_PARAM
};
function telemetryConfigureContext(options = {}) {
  typeof options.getCatalogId == "function" && (telemetryContext.getCatalogId = options.getCatalogId), typeof options.getPageNumber == "function" && (telemetryContext.getPageNumber = options.getPageNumber);
  let retryParam = String(options.retryParam || "").trim();
  telemetryContext.retryParam = /^[A-Za-z0-9_-]{1,40}$/.test(retryParam) ? retryParam : TELEMETRY_DEFAULT_RETRY_PARAM;
}
function telemetryCurrentCatalogId() {
  try {
    return telemetryCleanText(telemetryContext.getCatalogId(), 100);
  } catch {
    return "";
  }
}
function telemetryCurrentPageNumber() {
  try {
    return telemetryNumber(telemetryContext.getPageNumber(), 0, 1e5);
  } catch {
    return 0;
  }
}
function telemetryEventTargetElement(target) {
  return typeof Element == "function" && target instanceof Element ? target : typeof Node == "function" && target instanceof Node && target.parentElement instanceof Element ? target.parentElement : null;
}
var TELEMETRY_ENDPOINT = "/api/telemetry", TELEMETRY_SCHEMA_VERSION = 4, TELEMETRY_BATCH_LIMIT = 20, TELEMETRY_QUEUE_LIMIT = 60, TELEMETRY_FLUSH_DELAY_MS = 900, TELEMETRY_SEARCH_DEDUP_MS = 1200, TELEMETRY_ALLOWED_HOSTS = /* @__PURE__ */ new Set([
  "bargig-furniture.com",
  "www.bargig-furniture.com"
]), TELEMETRY_EVENT_NAMES = /* @__PURE__ */ new Set([
  "app_session",
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
]), telemetryRuntime = {
  enabled: (
    /** @type {boolean|null} */
    null
  ),
  queue: (
    /** @type {Array<Record<string, string|number>>} */
    []
  ),
  flushTimer: 0,
  flushing: !1,
  catalogKey: "",
  catalogAt: 0,
  searchKeys: /* @__PURE__ */ new Map(),
  diagnosticEvents: /* @__PURE__ */ new Set(),
  webVitals: {
    supported: /* @__PURE__ */ new Set(),
    reported: /* @__PURE__ */ new Set(),
    lcp: 0,
    lcpComponent: "unknown",
    inp: 0,
    cls: 0,
    clsComponent: "unknown",
    clsSessionValue: 0,
    clsSessionStart: 0,
    clsLastEntry: 0,
    clsSessionComponents: /* @__PURE__ */ new Map(),
    interactions: /* @__PURE__ */ new Map()
  },
  initialized: !1
};
function telemetryRouteModuleUrl() {
  let routeModule = document.querySelector?.("script[type=module][data-bargig-route-module]") || null;
  return routeModule ? "src" in routeModule ? String(routeModule.src || "") : String(routeModule.getAttribute?.("src") || "") : "";
}
function telemetryResolveReleaseId(scriptSrc = telemetryRouteModuleUrl()) {
  let explicit = String(window.__BARGIG_RELEASE_ID__ || "").trim();
  if (explicit) return telemetryCleanText(explicit, 64);
  let filename = String(scriptSrc || "").split("?")[0].split("#")[0].split("/").pop() || "", fingerprint = filename.match(/^app(?:-(?:catalog|favorites|viewer))?\.([a-f0-9]{8,64})\.js$/i)?.[1];
  return fingerprint ? `app-${fingerprint.slice(0, 16).toLowerCase()}` : /^app(?:-(?:catalog|favorites|viewer))?\.js$/i.test(filename) ? "app-unversioned" : "unknown-release";
}
var TELEMETRY_RELEASE_ID = telemetryResolveReleaseId();
function telemetryCleanText(value, limit = 120) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}
function telemetryCleanPathname(value = window.location.pathname) {
  let pathname = telemetryCleanText(value, 180) || "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
function telemetryCleanToken(value, limit = 50) {
  return telemetryCleanText(value, limit).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, limit);
}
var TELEMETRY_IMAGE_VISIBILITY = /* @__PURE__ */ new Set(["visible", "hidden", "preload", "background", "unknown"]), TELEMETRY_IMAGE_TIERS = /* @__PURE__ */ new Set(["thumb", "medium", "full", "unknown"]);
function telemetryCleanVisibility(value) {
  let visibility = telemetryCleanToken(value, 20);
  return TELEMETRY_IMAGE_VISIBILITY.has(visibility) ? visibility : "unknown";
}
function telemetryCleanImageTier(value) {
  let tier = telemetryCleanToken(value, 16);
  return TELEMETRY_IMAGE_TIERS.has(tier) ? tier : "unknown";
}
function telemetryNetworkState() {
  return navigator.onLine === !1 ? "offline" : navigator.onLine === !0 ? "online" : "unknown";
}
function telemetryCleanNetworkState(value) {
  let state = telemetryCleanToken(value, 16);
  return ["online", "offline", "unknown"].includes(state) ? state : "unknown";
}
function telemetryCleanRequestId(value) {
  let requestId = telemetryCleanToken(value, 48);
  return /^ir-[a-z0-9-]{8,45}$/.test(requestId) ? requestId : "";
}
function telemetryViewportBucket() {
  let width = Math.max(0, Number(window.innerWidth) || 0);
  return width < 480 ? "xs" : width < 760 ? "sm" : width < 1100 ? "md" : width < 1600 ? "lg" : "xl";
}
function telemetryViewportValue(value) {
  let viewport = telemetryCleanToken(value, 12);
  return ["xs", "sm", "md", "lg", "xl"].includes(viewport) ? viewport : telemetryViewportBucket();
}
function telemetryPrivacySignalEnabled() {
  if (navigator.globalPrivacyControl === !0) return !0;
  let dnt = String(navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "").toLowerCase();
  return dnt === "1" || dnt === "yes";
}
function telemetryIsEnabled() {
  if (telemetryRuntime.enabled !== null) return telemetryRuntime.enabled;
  if (window.__BARGIG_DISABLE_TELEMETRY__ === !0 || telemetryPrivacySignalEnabled())
    return telemetryRuntime.enabled = !1, !1;
  let forced = window.__BARGIG_ENABLE_TELEMETRY__ === !0, productionHost = TELEMETRY_ALLOWED_HOSTS.has(window.location.hostname.toLowerCase());
  return telemetryRuntime.enabled = !!(forced || productionHost), telemetryRuntime.enabled;
}
function telemetryNumber(value, min = 0, max = 864e5) {
  let number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 0;
}
function telemetryErrorFingerprint(parts) {
  let source = parts.map((part) => telemetryCleanText(part, 160)).join("|"), hash = 2166136261;
  for (let index = 0; index < source.length; index += 1)
    hash ^= source.charCodeAt(index), hash = Math.imul(hash, 16777619);
  return `e${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function telemetryNormalizeEvent(name, fields = {}) {
  let eventName = telemetryCleanText(name, 40);
  return TELEMETRY_EVENT_NAMES.has(eventName) ? {
    name: eventName,
    page: telemetryCleanText(fields.page || document.body?.dataset?.page || "", 30),
    path: telemetryCleanPathname(fields.path),
    catalogId: telemetryCleanText(fields.catalogId, 100),
    query: telemetryCleanText(fields.query, 80),
    scope: telemetryCleanText(fields.scope, 50),
    action: telemetryCleanText(fields.action, 50),
    detail: telemetryCleanText(fields.detail, 120),
    error: telemetryCleanText(fields.error, 80),
    viewport: telemetryViewportValue(fields.viewport),
    source: telemetryCleanText(fields.source, 50),
    value: telemetryNumber(fields.value, -1e6, 1e6),
    pageNumber: telemetryNumber(fields.pageNumber, 0, 1e5),
    secondaryValue: telemetryNumber(fields.secondaryValue, -1e6, 1e6),
    releaseId: telemetryCleanText(fields.releaseId || TELEMETRY_RELEASE_ID, 64),
    component: telemetryCleanToken(fields.component || "", 50),
    surface: telemetryCleanToken(fields.surface || "", 50),
    requestId: telemetryCleanRequestId(fields.requestId),
    visibility: telemetryCleanVisibility(fields.visibility),
    requestedTier: telemetryCleanImageTier(fields.requestedTier),
    networkState: telemetryCleanNetworkState(fields.networkState)
  } : null;
}
function telemetryScheduleFlush(delay = TELEMETRY_FLUSH_DELAY_MS) {
  window.clearTimeout(telemetryRuntime.flushTimer), telemetryRuntime.flushTimer = window.setTimeout(() => {
    telemetryRuntime.flushTimer = 0, telemetryFlush().catch(() => {
    });
  }, Math.max(0, delay));
}
function telemetryTrack(name, fields = {}, options = {}) {
  if (!telemetryIsEnabled()) return !1;
  let event = telemetryNormalizeEvent(name, fields);
  return event ? (telemetryRuntime.queue.length >= TELEMETRY_QUEUE_LIMIT && telemetryRuntime.queue.splice(0, telemetryRuntime.queue.length - TELEMETRY_QUEUE_LIMIT + 1), telemetryRuntime.queue.push(event), telemetryScheduleFlush(options.immediate ? 0 : TELEMETRY_FLUSH_DELAY_MS), !0) : !1;
}
async function telemetryFlush(options = {}) {
  if (!telemetryIsEnabled() || telemetryRuntime.flushing || !telemetryRuntime.queue.length) return !1;
  window.clearTimeout(telemetryRuntime.flushTimer), telemetryRuntime.flushTimer = 0;
  let events = telemetryRuntime.queue.splice(0, TELEMETRY_BATCH_LIMIT), body = JSON.stringify({ version: TELEMETRY_SCHEMA_VERSION, events });
  telemetryRuntime.flushing = !0;
  try {
    if (options.beacon && typeof navigator.sendBeacon == "function") {
      let queued = navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: "application/json" }));
      return queued || telemetryRuntime.queue.unshift(...events), queued;
    }
    let response = await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      keepalive: !0,
      redirect: "error"
    });
    if (!response.ok && response.status !== 202 && response.status !== 204)
      throw new Error(`telemetry-http-${response.status}`);
    return !0;
  } catch {
    return !1;
  } finally {
    telemetryRuntime.flushing = !1, telemetryRuntime.queue.length && telemetryScheduleFlush(250);
  }
}
function telemetryTrackCatalogOpen(catalog, page, source = TELEMETRY_DEFAULT_CATALOG_SOURCE) {
  if (!catalog) return;
  let now = Date.now(), key = `${catalog.id}|${source}`;
  key === telemetryRuntime.catalogKey && now - telemetryRuntime.catalogAt < 1200 || (telemetryRuntime.catalogKey = key, telemetryRuntime.catalogAt = now, telemetryTrack("catalog_open", {
    page: "viewer",
    catalogId: catalog.id,
    pageNumber: page,
    source
  }));
}
function telemetryTrackSearch(query, resultCount, options = {}) {
  if (!telemetryIsEnabled()) return !1;
  let cleanQuery = telemetryCleanText(query, 80);
  if (cleanQuery.length < 2) return !1;
  let surface = telemetryCleanText(options.surface || "global", 30), scope = telemetryCleanText(options.scope || "all", 50), catalogId = telemetryCleanText(options.catalogId, 100), completion = telemetryCleanText(options.completion || "submit", 30), count = Math.max(0, Number(resultCount) || 0), key = `${surface}|${cleanQuery}|${count}|${scope}|${catalogId}|${completion}`, now = Date.now(), previous = telemetryRuntime.searchKeys.get(key) || 0;
  if (now - previous < TELEMETRY_SEARCH_DEDUP_MS) return !1;
  if (telemetryRuntime.searchKeys.set(key, now), telemetryRuntime.searchKeys.size > 80)
    for (let [storedKey, timestamp] of telemetryRuntime.searchKeys)
      now - timestamp > 6e4 && telemetryRuntime.searchKeys.delete(storedKey);
  return telemetryTrack("search", {
    query: cleanQuery,
    scope,
    catalogId,
    source: surface,
    action: completion,
    value: count
  }, { immediate: options.immediate === !0 });
}
function telemetryTrackFavorite(action, catalogId = "", pageNumber = 0, count = 0) {
  telemetryTrack("favorite", {
    action,
    catalogId,
    pageNumber,
    value: count
  });
}
function telemetryTrackAppSession() {
  return telemetryTrack("app_session", {
    action: telemetryNavigationType(),
    visibility: document.visibilityState === "hidden" ? "hidden" : "visible"
  }, { immediate: !0 });
}
var TELEMETRY_COMPONENT_SELECTORS = Object.freeze([
  ["[data-telemetry-component]", ""],
  ["#lightboxImageFrame, #lightboxStage, #lightbox", "viewer-stage"],
  ["#lightboxBar, .lightbox-top-shell", "viewer-toolbar"],
  ["#lightboxPageRail, .lightbox-page-rail", "viewer-thumbnail-rail"],
  ["#catalogSearch, .global-search-popover", "global-search"],
  ["#globalSearchResults, .search-results", "global-search-results"],
  ["#catalogGrid, .catalog-category-list", "catalog-grid"],
  ["#pageGrid, .page-grid", "catalog-page-grid"],
  ["#catalogDetail, .catalog-detail", "catalog-detail"],
  ["#favoritesPanel, .favorites-panel", "favorites-panel"],
  [".site-header", "site-header"],
  [".site-footer", "site-footer"],
  ["main, #main-content", "main-content"],
  ["img", "image"],
  ["video", "video"],
  ["iframe", "frame"]
]);
function telemetryComponentToken(node) {
  let element = typeof Element == "function" && node instanceof Element ? node : typeof Element == "function" && node?.parentElement instanceof Element ? node.parentElement : null;
  if (!element) return "unknown";
  for (let [selector, fixedToken] of TELEMETRY_COMPONENT_SELECTORS) {
    let matched = element.closest?.(selector);
    if (matched) {
      if (!fixedToken) {
        let explicit = telemetryCleanToken(matched.getAttribute?.("data-telemetry-component"), 50);
        if (explicit) return explicit;
        continue;
      }
      return fixedToken;
    }
  }
  return telemetryCleanToken(element.tagName || "element", 30) || "unknown";
}
function telemetryRectSignal(rect) {
  if (!rect) return 0;
  let width = Math.max(0, Number(rect.width) || 0), height = Math.max(0, Number(rect.height) || 0), x = Number(rect.x ?? rect.left) || 0, y = Number(rect.y ?? rect.top) || 0;
  return width * height + Math.abs(x) + Math.abs(y);
}
function telemetryDominantLayoutShiftComponent(entry) {
  let sources = Array.isArray(entry?.sources) ? entry.sources : [], token = "unknown", bestScore = -1;
  for (let source of sources) {
    let current = telemetryRectSignal(source.currentRect), previous = telemetryRectSignal(source.previousRect), score = Math.max(current, previous) + Math.abs(current - previous);
    score <= bestScore || (bestScore = score, token = telemetryComponentToken(source.node));
  }
  return token;
}
function telemetryDominantSessionComponent(components) {
  let token = "unknown", value = -1;
  for (let [candidate, contribution] of components)
    contribution <= value || (token = candidate, value = contribution);
  return token;
}
var TELEMETRY_WEB_VITAL_THRESHOLDS = Object.freeze({
  LCP: [2500, 4e3],
  INP: [200, 500],
  CLS: [0.1, 0.25]
});
function telemetryWebVitalRating(name, value) {
  let thresholds = TELEMETRY_WEB_VITAL_THRESHOLDS[name];
  return thresholds ? value <= thresholds[0] ? "good" : value <= thresholds[1] ? "needs-improvement" : "poor" : "unknown";
}
function telemetryNavigationType() {
  let navigation = performance.getEntriesByType?.("navigation")?.[0];
  return telemetryCleanText(navigation?.type || "navigate", 30);
}
function telemetryWebVitalsSnapshot() {
  let runtime = telemetryRuntime.webVitals;
  return {
    LCP: Math.max(0, Number(runtime.lcp) || 0),
    INP: Math.max(0, Number(runtime.inp) || 0),
    CLS: Math.max(0, Number(runtime.cls) || 0)
  };
}
function telemetryPublishWebVitalsDiagnostics() {
  window.__BARGIG_ENABLE_VITALS_DIAGNOSTICS__ === !0 && (window.__BARGIG_WEB_VITALS__ = telemetryWebVitalsSnapshot());
}
function telemetryRecordInteractionTiming(entry) {
  let interactionId = Number(entry?.interactionId) || 0;
  if (!interactionId) return;
  let runtime = telemetryRuntime.webVitals, duration = Math.max(0, Number(entry?.duration) || 0);
  if (runtime.interactions.set(interactionId, Math.max(duration, runtime.interactions.get(interactionId) || 0)), runtime.interactions.size > 300) {
    let oldest = runtime.interactions.keys().next().value;
    oldest !== void 0 && runtime.interactions.delete(oldest);
  }
  let candidates = Array.from(runtime.interactions.values()).sort((left, right) => right - left), candidateIndex = Math.min(candidates.length - 1, Math.floor(candidates.length / 50));
  runtime.inp = candidates[candidateIndex] || 0, telemetryPublishWebVitalsDiagnostics();
}
function telemetryReportWebVitals() {
  let runtime = telemetryRuntime.webVitals;
  for (
    let name of
    /** @type {TelemetryWebVitalName[]} */
    ["LCP", "INP", "CLS"]
  ) {
    if (!runtime.supported.has(name) || runtime.reported.has(name)) continue;
    let snapshot = telemetryWebVitalsSnapshot(), value = Number(snapshot[name]);
    !Number.isFinite(value) || value < 0 || (name === "LCP" || name === "INP") && value === 0 || (runtime.reported.add(name), telemetryTrack("web_vital", {
      action: name,
      detail: telemetryWebVitalRating(name, value),
      source: telemetryNavigationType(),
      component: name === "CLS" ? runtime.clsComponent : name === "LCP" ? runtime.lcpComponent : "",
      value
    }, { immediate: !0 }));
  }
}
function telemetryObserveWebVitals() {
  if (typeof PerformanceObserver != "function") return;
  let supported = new Set(PerformanceObserver.supportedEntryTypes || []), runtime = telemetryRuntime.webVitals;
  if (supported.has("largest-contentful-paint")) {
    runtime.supported.add("LCP");
    try {
      new PerformanceObserver((list) => {
        let entries = list.getEntries(), latest = (
          /** @type {TelemetryLcpEntry|undefined} */
          entries[entries.length - 1]
        );
        latest && (runtime.lcp = Math.max(0, Number(latest.startTime) || 0), runtime.lcpComponent = telemetryComponentToken(latest.element)), telemetryPublishWebVitalsDiagnostics();
      }).observe({ type: "largest-contentful-paint", buffered: !0 });
    } catch {
    }
  }
  if (supported.has("layout-shift")) {
    runtime.supported.add("CLS");
    try {
      new PerformanceObserver((list) => {
        for (let rawEntry of list.getEntries()) {
          let entry = (
            /** @type {TelemetryLayoutShiftEntry} */
            rawEntry
          );
          if (entry.hadRecentInput) continue;
          let start = Number(entry.startTime) || 0, value = Number(entry.value) || 0;
          runtime.clsLastEntry && start - runtime.clsLastEntry < 1e3 && start - runtime.clsSessionStart < 5e3 ? runtime.clsSessionValue += value : (runtime.clsSessionValue = value, runtime.clsSessionStart = start, runtime.clsSessionComponents.clear());
          let component = telemetryDominantLayoutShiftComponent(entry);
          runtime.clsSessionComponents.set(
            component,
            (runtime.clsSessionComponents.get(component) || 0) + value
          ), runtime.clsLastEntry = start, runtime.clsSessionValue >= runtime.cls && (runtime.cls = runtime.clsSessionValue, runtime.clsComponent = telemetryDominantSessionComponent(runtime.clsSessionComponents)), telemetryPublishWebVitalsDiagnostics();
        }
      }).observe({ type: "layout-shift", buffered: !0 });
    } catch {
    }
  }
  if (supported.has("event")) {
    runtime.supported.add("INP");
    try {
      new PerformanceObserver((list) => {
        for (let entry of list.getEntries()) telemetryRecordInteractionTiming(entry);
      }).observe({ type: "event", buffered: !0, durationThreshold: 16 });
    } catch {
    }
  }
}
function telemetryCatalogImageContext(img, src = "") {
  let value = String(src || img?.currentSrc || img?.getAttribute?.("src") || ""), match = value.match(/\/assets\/pages\/([^/]+)\/(?:thumbs\/)?page-(\d+)/i), catalogId = telemetryCleanText(match?.[1] || img?.dataset?.catalogId || telemetryCurrentCatalogId() || "", 100), pageNumber = Number.parseInt(String(match?.[2] || img?.dataset?.page || telemetryCurrentPageNumber() || 0), 10) || 0, detail = "image";
  return /\/thumbs\//i.test(value) ? detail = "thumbnail" : img?.id === "lightboxImage" ? detail = "viewer" : img?.classList?.contains("catalog-cover") && (detail = "cover"), { catalogId, pageNumber, detail, value };
}
function telemetryCreateRequestId() {
  let bytes = new Uint8Array(8);
  return globalThis.crypto?.getRandomValues ? (globalThis.crypto.getRandomValues(bytes), `ir-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`) : `ir-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function telemetryImageVisibility(img, surface) {
  let cleanSurface = telemetryCleanToken(surface, 50);
  if (!img || /(?:^|-)preload(?:-|$)|background|buffer/.test(cleanSurface)) return "preload";
  if (img.dataset?.telemetryVisibility) return telemetryCleanVisibility(img.dataset.telemetryVisibility);
  if (img.isConnected === !1) return "background";
  if (typeof img.getBoundingClientRect != "function") return "unknown";
  let rect = img.getBoundingClientRect(), width = Math.max(0, Number(rect?.width) || 0), height = Math.max(0, Number(rect?.height) || 0);
  if (!width || !height) return "hidden";
  let viewportWidth = Math.max(0, Number(window.innerWidth) || 0), viewportHeight = Math.max(0, Number(window.innerHeight) || 0);
  return Number(rect.bottom) > 0 && Number(rect.right) > 0 && Number(rect.top) < viewportHeight && Number(rect.left) < viewportWidth ? "visible" : "hidden";
}
function telemetryCreateImageRequestContext(img, src = "", options = {}) {
  let image = telemetryCatalogImageContext(img, src), surface = telemetryCleanToken(options.surface || img?.dataset?.telemetrySurface || image.detail, 50) || "image";
  return Object.freeze({
    requestId: telemetryCleanRequestId(options.requestId) || telemetryCreateRequestId(),
    catalogId: image.catalogId,
    pageNumber: image.pageNumber,
    detail: telemetryCleanText(options.detail || img?.dataset?.telemetryDetail || image.detail, 50),
    surface,
    visibility: telemetryCleanVisibility(options.visibility || telemetryImageVisibility(img, surface)),
    requestedTier: telemetryCleanImageTier(options.requestedTier || img?.dataset?.telemetryRequestedTier),
    networkState: telemetryNetworkState(),
    page: telemetryCleanText(document.body?.dataset?.page || "", 30),
    path: telemetryCleanPathname(),
    viewport: telemetryViewportBucket(),
    releaseId: TELEMETRY_RELEASE_ID
  });
}
function telemetryStableResourceUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";
  try {
    let parsed = new URL(raw, window.location.href);
    return parsed.hash = "", parsed.searchParams.delete(telemetryContext.retryParam), parsed.href;
  } catch {
    return raw.replace(new RegExp(`([?&])${telemetryContext.retryParam}=[^&#]*&?`, "g"), "$1").replace(/[?&]$/, "").split("#")[0];
  }
}
function telemetryResourceSourceName(value) {
  let clean = telemetryStableResourceUrl(value);
  if (!clean) return "inline";
  try {
    let parsed = new URL(clean, window.location.href);
    return ["data:", "blob:"].includes(parsed.protocol) ? parsed.protocol.slice(0, -1) : parsed.hostname.toLowerCase() === "static.cloudflareinsights.com" && /\/beacon\.min\.js(?:\/|$)/i.test(parsed.pathname) ? "beacon.min.js" : telemetryCleanText(parsed.pathname.split("/").pop() || "root", 80);
  } catch {
    return telemetryCleanText(clean.split("/").pop() || "unknown", 80);
  }
}
function telemetryResourceScope(value) {
  let clean = telemetryStableResourceUrl(value);
  if (!clean) return "inline";
  if (/^(?:chrome|moz|safari)-extension:/i.test(clean)) return "extension";
  try {
    let parsed = new URL(clean, window.location.href), hostname = parsed.hostname.toLowerCase();
    return parsed.origin === window.location.origin ? "site" : hostname === "cdn.bargig-furniture.com" ? "catalog-cdn" : hostname === "static.cloudflareinsights.com" || hostname === "cloudflareinsights.com" ? "cloudflare-observability" : hostname === "netfree.link" || hostname.endsWith(".netfree.link") ? "netfree-filter" : "external";
  } catch {
    return "unknown";
  }
}
function telemetryDiagnosticOnce(key) {
  let cleanKey = telemetryCleanText(key, 320);
  if (!cleanKey || telemetryRuntime.diagnosticEvents.has(cleanKey)) return !1;
  if (telemetryRuntime.diagnosticEvents.add(cleanKey), telemetryRuntime.diagnosticEvents.size > 240) {
    let oldest = telemetryRuntime.diagnosticEvents.values().next().value;
    oldest !== void 0 && telemetryRuntime.diagnosticEvents.delete(oldest);
  }
  return !0;
}
function telemetryTrackImageEvent(name, src, options = {}) {
  let context = options.requestContext || telemetryCreateImageRequestContext(options.img, src, options), detail = telemetryCleanText(options.detail || context.detail, 50), action = telemetryCleanText(options.action || "", 50), stableUrl = telemetryStableResourceUrl(src || options.img?.currentSrc || options.img?.src || ""), source = telemetryResourceSourceName(stableUrl), eventKey = [name, context.requestId, detail, action, source].join("|");
  return telemetryDiagnosticOnce(eventKey) ? telemetryTrack(name, {
    page: context.page,
    path: context.path,
    catalogId: context.catalogId,
    pageNumber: context.pageNumber,
    detail,
    action,
    source,
    viewport: context.viewport,
    releaseId: context.releaseId,
    surface: context.surface,
    requestId: context.requestId,
    visibility: context.visibility,
    requestedTier: context.requestedTier,
    networkState: context.networkState,
    value: telemetryNumber(options.failedAttempts ?? options.attempt ?? options.value, 0, 100),
    error: telemetryErrorFingerprint([name, context.catalogId, context.pageNumber, context.surface, detail, action, source])
  }, { immediate: !0 }) : !1;
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
  let value = String(filename || "").toLowerCase();
  if (!value) return "inline";
  if (/^(?:chrome|moz|safari)-extension:/.test(value)) return "extension";
  try {
    return new URL(value, window.location.href).origin === window.location.origin ? "site" : "external";
  } catch {
    return "unknown";
  }
}
function telemetryIsRuntimeErrorEvent(event) {
  return event ? typeof ErrorEvent == "function" && event instanceof ErrorEvent ? !0 : Object.prototype.toString.call(event) === "[object ErrorEvent]" : !1;
}
function telemetryClassifyWindowError(event) {
  return typeof HTMLImageElement == "function" && event?.target instanceof HTMLImageElement ? "image" : telemetryIsRuntimeErrorEvent(event) ? "runtime" : typeof Element == "function" && event?.target instanceof Element ? "resource" : "ignored";
}
function telemetryTrackRuntimeError(event) {
  if (!telemetryIsRuntimeErrorEvent(event)) return !1;
  let filename = String(event.filename || ""), sourceName = telemetryResourceSourceName(filename), errorName = telemetryCleanText(event.error?.name || "Error", 40), message = telemetryCleanText(event.message || event.error?.message || "JavaScript error", 120);
  return telemetryTrack("js_error", {
    catalogId: telemetryCurrentCatalogId(),
    action: errorName,
    detail: message,
    scope: telemetryErrorSourceScope(filename),
    source: sourceName,
    pageNumber: Number(event.lineno) || 0,
    secondaryValue: Number(event.colno) || 0,
    error: telemetryErrorFingerprint([errorName, message, sourceName, event.lineno, event.colno])
  }, { immediate: !0 });
}
function telemetryResourceElementUrl(target) {
  if (!target) return "";
  let resource = (
    /** @type {TelemetryResourceElement} */
    target
  );
  return String(resource.currentSrc || resource.src || resource.href || resource.data || "");
}
function telemetryResourceRole(target) {
  if (!target) return "resource";
  let explicit = target instanceof HTMLElement ? telemetryCleanText(target.dataset.telemetryResourceRole, 50) : "";
  if (explicit) return explicit;
  if (target instanceof HTMLElement && target.dataset.searchIndexSrc) return "search-index";
  let tag = String(target.tagName || "").toLowerCase();
  if (target instanceof HTMLLinkElement) {
    let rel = telemetryCleanText(target.rel || target.getAttribute("rel") || "link", 24), asType = telemetryCleanText(target.as || target.getAttribute("as") || "", 24);
    return asType ? `${rel}:${asType}` : rel;
  }
  return tag || "resource";
}
function telemetryTrackSearchIndexFailure(reason, options = {}) {
  let src = String(options.src || telemetryResourceElementUrl(options.target) || SEARCH_INDEX_SCRIPT_SRC || ""), source = telemetryResourceSourceName(src), action = telemetryCleanText(reason || "load-error", 50), targetTrigger = options.target instanceof HTMLElement ? options.target.dataset.telemetrySearchTrigger : "", detail = telemetryCleanText(options.trigger || targetTrigger || "unknown", 50), scope = telemetryErrorSourceScope(src), key = ["search_index_load_failed", source, action, scope, detail].join("|");
  return telemetryDiagnosticOnce(key) ? telemetryTrack("search_index_load_failed", {
    action,
    detail,
    scope,
    source,
    error: telemetryErrorFingerprint(["search-index", action, source, scope])
  }, { immediate: !0 }) : !1;
}
function telemetryTrackResourceError(target) {
  let src = telemetryResourceElementUrl(target), role = telemetryResourceRole(target);
  if (role === "search-index")
    return telemetryTrackSearchIndexFailure("network-error", { target, src });
  let tag = telemetryCleanText(String(target?.tagName || "resource").toLowerCase(), 30), source = telemetryResourceSourceName(src), scope = telemetryResourceScope(src), key = ["resource_error", tag, role, source, scope].join("|");
  return telemetryDiagnosticOnce(key) ? telemetryTrack("resource_error", {
    action: tag,
    detail: role,
    scope,
    source,
    error: telemetryErrorFingerprint(["resource", tag, role, source, scope])
  }, { immediate: !0 }) : !1;
}
function telemetryTrackUnhandledRejection(event) {
  let reason = event?.reason, errorName = telemetryCleanText(reason?.name || "UnhandledRejection", 40), message = telemetryCleanText(reason?.message || reason || "Unhandled promise rejection", 120);
  telemetryTrack("js_error", {
    catalogId: telemetryCurrentCatalogId(),
    action: errorName,
    detail: message,
    scope: "promise",
    error: telemetryErrorFingerprint([errorName, message, "promise"]),
    source: "promise"
  }, { immediate: !0 });
}
function telemetryHandleDocumentClick(event) {
  let link = telemetryEventTargetElement(event.target)?.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  let href = String(link.getAttribute("href") || "").trim(), action = telemetryCleanText(link.dataset.contactAction, 50);
  !action && href.startsWith("tel:") ? action = "phone" : !action && href.startsWith("mailto:") ? action = "email" : !action && (link.classList.contains("site-footer-gmail-link") || /mail\.google\.com/i.test(href)) && (action = "gmail"), action && telemetryTrack("contact", {
    action,
    source: link.dataset.contactSource || "footer",
    catalogId: link.dataset.contactCatalogId || "",
    pageNumber: link.dataset.contactPage || 0
  }, { immediate: !0 });
}
function telemetryInit(options = {}) {
  telemetryConfigureContext(options), !telemetryRuntime.initialized && (telemetryRuntime.initialized = !0, telemetryIsEnabled() && (telemetryTrackAppSession(), window.addEventListener("error", (event) => {
    let classification = telemetryClassifyWindowError(event);
    if (classification === "image") {
      let image = event.target instanceof HTMLImageElement ? event.target : null;
      if (!image) return;
      if (image.dataset.telemetryManaged !== "true") {
        if (options.recoverCatalogImageAfterInitialFailure?.(image)) return;
        let requestContext = telemetryCreateImageRequestContext(image, image.currentSrc || image.src, {
          detail: telemetryCatalogImageContext(image).detail,
          surface: image.dataset.telemetrySurface || "unmanaged-image"
        });
        telemetryTrackImageTerminalFailure(image.currentSrc || image.src, {
          img: image,
          requestContext,
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
    classification === "resource" && telemetryTrackResourceError(telemetryEventTargetElement(event.target));
  }, !0), window.addEventListener("unhandledrejection", telemetryTrackUnhandledRejection), document.addEventListener("click", telemetryHandleDocumentClick, !0), telemetryObserveWebVitals(), document.addEventListener("visibilitychange", () => {
    document.visibilityState === "hidden" && (telemetryReportWebVitals(), telemetryFlush({ beacon: !0 }).catch(() => {
    }));
  }), window.addEventListener("pagehide", () => {
    telemetryReportWebVitals(), telemetryFlush({ beacon: !0 }).catch(() => {
    });
  })));
}
export {
  telemetryCatalogImageContext,
  telemetryClassifyWindowError,
  telemetryCleanImageTier,
  telemetryCleanText,
  telemetryCleanToken,
  telemetryComponentToken,
  telemetryCreateImageRequestContext,
  telemetryDominantLayoutShiftComponent,
  telemetryErrorSourceScope,
  telemetryFlush,
  telemetryImageVisibility,
  telemetryInit,
  telemetryIsRuntimeErrorEvent,
  telemetryNetworkState,
  telemetryResolveReleaseId,
  telemetryResourceScope,
  telemetryResourceSourceName,
  telemetryStableResourceUrl,
  telemetryTrack,
  telemetryTrackCatalogOpen,
  telemetryTrackFavorite,
  telemetryTrackImageAttemptFailure,
  telemetryTrackImageRecovery,
  telemetryTrackImageTerminalFailure,
  telemetryTrackSearch,
  telemetryTrackSearchIndexFailure
};
