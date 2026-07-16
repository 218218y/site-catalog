"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test: base, expect } = require("@playwright/test");

function monitorRuntimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error?.stack || error?.message || String(error)));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /content security policy|refused to (?:load|execute|connect|apply)/i.test(text)) {
      errors.push(text);
    }
  });
  return errors;
}

const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeErrors = monitorRuntimeErrors(page);
    await use(page);
    expect(runtimeErrors, "Uncaught browser runtime errors").toEqual([]);
  }
});

const catalogData = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../catalogs.generated.json"), "utf8"));
const testCatalog = catalogData.find((catalog) => catalog.id === "opening-tbi-2026")
  || catalogData.find((catalog) => Number(catalog.pages) >= 6)
  || catalogData[0];
if (!testCatalog) throw new Error("E2E requires at least one generated catalog.");
const CATALOG_ID = testCatalog.id;
const CATALOG_PAGES = Math.max(1, Number(testCatalog.pages) || 1);
const CATALOG_COUNT = catalogData.length;
const PREVIEW_PAGE = Math.min(6, CATALOG_PAGES);
const ONBOARDING_KEY = "bargig.viewer-onboarding.v2";
const FAVORITES_KEY = "bargig.catalog-favorites.v1";
const VIEWER_LAYOUT_KEY = "bargig.viewer-layout.v1";
const VISUAL_STYLE = path.join(__dirname, "visual-stability.css");

function catalogImageSvg(pageNumber, thumbnail) {
  const page = Number.isFinite(pageNumber) ? pageNumber : 1;
  const hue = (page * 31) % 360;
  const accent = (hue + 34) % 360;
  const inset = thumbnail ? 70 : 95;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="0 0 1400 1000">
      <rect width="1400" height="1000" fill="hsl(${hue} 25% 92%)"/>
      <rect x="${inset}" y="${inset}" width="${1400 - inset * 2}" height="${1000 - inset * 2}" rx="42" fill="hsl(${hue} 30% 84%)"/>
      <rect x="190" y="190" width="1020" height="120" rx="28" fill="hsl(${accent} 34% 67%)"/>
      <rect x="190" y="370" width="660" height="430" rx="34" fill="hsl(${hue} 22% 73%)"/>
      <circle cx="1050" cy="580" r="165" fill="hsl(${accent} 30% 58%)"/>
    </svg>`;
}

async function preparePage(page, options = {}) {
  const failPages = new Set((options.failPages || []).map(Number));
  const onboardingSeen = options.onboardingSeen !== false;
  const resetFavorites = options.resetFavorites !== false;
  const resetViewerLayout = options.resetViewerLayout !== false;
  const captureClipboard = options.captureClipboard === true;
  const telemetryEvents = Array.isArray(options.telemetryEvents) ? options.telemetryEvents : null;
  await page.addInitScript(({ onboardingKey, favoritesKey, viewerLayoutKey, onboardingSeen, resetFavorites, resetViewerLayout, captureClipboard, enableTelemetry }) => {
    if (enableTelemetry) window.__BARGIG_ENABLE_TELEMETRY__ = true;
    if (sessionStorage.getItem("bargig.e2e-onboarding-prepared") !== "1") {
      if (onboardingSeen) localStorage.setItem(onboardingKey, "1");
      else localStorage.removeItem(onboardingKey);
      sessionStorage.setItem("bargig.e2e-onboarding-prepared", "1");
    }
    if (resetFavorites && sessionStorage.getItem("bargig.e2e-storage-prepared") !== "1") {
      localStorage.removeItem(favoritesKey);
      sessionStorage.setItem("bargig.e2e-storage-prepared", "1");
    }
    if (resetViewerLayout && sessionStorage.getItem("bargig.e2e-viewer-layout-prepared") !== "1") {
      localStorage.removeItem(viewerLayoutKey);
      sessionStorage.setItem("bargig.e2e-viewer-layout-prepared", "1");
    }
    if (captureClipboard) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__bargigE2eClipboard = String(value || "");
          }
        }
      });
    }
  }, {
    onboardingKey: ONBOARDING_KEY,
    favoritesKey: FAVORITES_KEY,
    viewerLayoutKey: VIEWER_LAYOUT_KEY,
    onboardingSeen,
    resetFavorites,
    resetViewerLayout,
    captureClipboard,
    enableTelemetry: Boolean(telemetryEvents)
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/telemetry" && request.method() === "POST" && telemetryEvents) {
      const payload = request.postDataJSON();
      telemetryEvents.push(...(Array.isArray(payload?.events) ? payload.events : []));
      await route.fulfill({
        status: 202,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true, accepted: payload?.events?.length || 0 })
      });
      return;
    }
    if (!url.pathname.includes("/assets/pages/")) {
      await route.continue();
      return;
    }

    const pageMatch = url.pathname.match(/page-(\d+)\.[a-z0-9]+$/i);
    const pageNumber = pageMatch ? Number(pageMatch[1]) : 1;
    const isThumbnail = url.pathname.includes("/thumbs/");
    if (!isThumbnail && failPages.has(pageNumber)) {
      await route.fulfill({
        status: 404,
        contentType: "text/plain; charset=utf-8",
        body: "Synthetic missing catalog page"
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
      body: catalogImageSvg(pageNumber, isThumbnail)
    });
  });
}

async function waitForApp(page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function openDirectViewer(page, pageNumber = 1) {
  await page.goto(`/viewer.html?catalog=${CATALOG_ID}&page=${pageNumber}`);
  await waitForApp(page);
  await expect(page.locator("#lightbox")).toBeVisible();
  await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);
}

async function expectViewerFrameCentered(page, tolerance = 1.5) {
  await expect.poll(async () => page.locator("#lightboxImageFrame").evaluate((frame) => {
    const rect = frame.getBoundingClientRect();
    const horizontal = Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2);
    const vertical = Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2);
    return Math.max(horizontal, vertical);
  })).toBeLessThanOrEqual(tolerance);
}

test.describe("critical catalog journeys", () => {
  test("serves the restrictive security policy without breaking the app", async ({ page }) => {
    await preparePage(page);
    const response = await page.goto("/index.html");
    expect(response).not.toBeNull();
    const csp = await response.headerValue("content-security-policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://static.cloudflareinsights.com");
    expect(csp).toContain("script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://netfree.link");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("frame-src 'self' https://netfree.link");
    expect(csp).not.toContain("frame-src 'none'");
    expect(csp).not.toContain("child-src");
    expect(csp).not.toContain("script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(await response.headerValue("x-content-type-options")).toBe("nosniff");
    expect(await response.headerValue("x-frame-options")).toBe("DENY");
    expect(await response.headerValue("referrer-policy")).toBe("no-referrer");
    await waitForApp(page);
    await expect(page.locator(".catalog-card").first()).toBeVisible();
  });

  test("opens a catalog and moves forward and backward", async ({ page }) => {
    await preparePage(page);
    await page.goto("/index.html");
    await waitForApp(page);

    await expect(page.locator(".catalog-card")).toHaveCount(CATALOG_COUNT);
    await page.locator(".catalog-open-button").first().click();

    await expect(page).toHaveURL(new RegExp(`viewer\\.html\\?catalog=${CATALOG_ID}&page=1`));
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("1");

    await page.locator("#nextPageBtn").click();
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("2");
    await page.locator("#prevPageBtn").click();
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("1");
  });

  test("opens the catalog preview and launches the selected page", async ({ page }) => {
    await preparePage(page);
    await page.goto("/index.html");
    await waitForApp(page);

    await page.locator("[data-open-catalog-preview]").first().click();
    await expect(page).toHaveURL(new RegExp(`catalog\\.html\\?catalog=${CATALOG_ID}`));
    await waitForApp(page);
    await expect(page.locator("#pageGrid .page-card")).toHaveCount(CATALOG_PAGES);

    await page.locator(`[data-open-page="${PREVIEW_PAGE}"]`).click();
    await expect(page).toHaveURL(new RegExp(`viewer\\.html\\?catalog=${CATALOG_ID}&page=${PREVIEW_PAGE}`));
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(PREVIEW_PAGE));
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);
  });

  test("searches the OCR index and opens a result", async ({ page }) => {
    await preparePage(page);
    await page.goto("/index.html");
    await waitForApp(page);

    await page.locator("#globalSearchOpen").click();
    await page.locator("#globalSearchInput").fill("פתיחת");
    const results = page.locator("#globalSearchResults [data-search-catalog]");
    await expect(results.first()).toBeVisible();
    await results.first().click();

    await expect(page).toHaveURL(/viewer\.html\?catalog=[^&]+&page=\d+/);
    await expect(page.locator("#lightbox")).toBeVisible();
  });

  test("persists a favorite through reload and shows it on the favorites page", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 3);

    await page.locator("#viewerFavoriteButton").click();
    await expect(page.locator("#viewerFavoriteButton")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#siteActionToast")).toContainText("נשמר");

    await page.reload();
    await waitForApp(page);
    await expect(page.locator("#viewerFavoriteButton")).toHaveAttribute("aria-pressed", "true");

    await page.goto("/favorites.html");
    await waitForApp(page);
    await expect(page.locator("#favoritesGrid .favorite-card")).toHaveCount(1);
  });

  test("supports a direct viewer link, shares the exact page, and returns home", async ({ page }) => {
    await preparePage(page, { captureClipboard: true });
    await openDirectViewer(page, 5);

    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("5");
    await expect(page.locator("#lightboxImage")).toHaveAttribute("src", /page-005\.webp/);

    await page.locator("#lightboxCopyLink").click();
    await expect.poll(() => page.evaluate(() => window.__bargigE2eClipboard || "")).toContain(`viewer.html?catalog=${CATALOG_ID}&page=5`);
    await expect(page.locator("#siteActionToast")).toContainText("הקישור הועתק");

    await page.locator("#lightboxHomeLink").click();
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "home");
    await expect(page.locator("#fullscreenToggle")).toBeHidden();
  });

  test("keeps shell routes clean during fullscreen-safe in-document navigation", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => document.documentElement
      });
    });
    await preparePage(page);
    await openDirectViewer(page, 1);
    await page.locator("#viewerFavoriteButton").click();

    await page.locator("#lightboxHomeLink").evaluate((link) => link.click());
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "home");
    await expect(page.locator("#lightbox")).toBeHidden();
    await expect(page.locator("#fullscreenToggle")).toBeHidden();

    await page.locator("[data-open-catalog-preview]").first().click();
    await expect(page).toHaveURL(new RegExp(`catalog\\.html\\?catalog=${CATALOG_ID}`));
    await expect(page.locator("body")).toHaveAttribute("data-page", "catalog");
    await expect(page.locator("#pageGrid .page-card")).toHaveCount(CATALOG_PAGES);
    await expect(page.locator("#fullscreenToggle")).toBeHidden();

    await page.locator("#headerFavoritesButton").click();
    await expect(page).toHaveURL(/favorites\.html$/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "favorites");
    await expect(page.locator("#favoritesGrid .favorite-card")).toHaveCount(1);
    await expect(page.locator("#fullscreenToggle")).toBeHidden();
  });

  test("supports keyboard navigation in the RTL viewer", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 1);

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("2");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("1");
    await page.keyboard.press("End");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(CATALOG_PAGES));
    await page.keyboard.press("Home");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("1");
  });

  test("switches between side and progressively loaded vertical scroll layouts", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(4, CATALOG_PAGES);
    await openDirectViewer(page, startPage);

    const toggle = page.locator("#viewerLayoutToggle");
    const scrollPages = page.locator("#viewerScrollPages");
    await expect(toggle).toHaveAttribute("data-viewer-layout", "side");

    await toggle.click();
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-scroll/);
    await expect(toggle).toHaveAttribute("data-viewer-layout", "scroll");
    await expect(toggle).toHaveAttribute("aria-label", "מעבר לתצוגת צדדים");
    await expect(scrollPages.locator("[data-scroll-page]")).toHaveCount(CATALOG_PAGES);
    await expect.poll(() => scrollPages.locator("img[src]").count()).toBeLessThanOrEqual(5);
    await expect.poll(() => scrollPages.locator("img[src]").count()).toBeGreaterThan(0);

    const beforeTop = await scrollPages.evaluate((element) => element.scrollTop);
    if (startPage < CATALOG_PAGES) {
      await page.locator("#nextPageBtn").click();
      await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage + 1));
      await expect.poll(() => scrollPages.evaluate((element) => element.scrollTop)).toBeGreaterThan(beforeTop);
    }

    await page.mouse.move(720, 1);
    await expect(page.locator("#lightboxBar")).toBeVisible();
    await page.locator("#fitWidthBtn").click();
    await expect(page.locator("#fitWidthBtn")).toHaveAttribute("aria-pressed", "true");

    await page.mouse.move(720, 1);
    await expect(page.locator("#lightboxBar")).toBeVisible();
    await toggle.click();
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-side/);
    await expect(scrollPages).toBeHidden();
    await expect(page.locator("#lightboxImage")).toHaveAttribute("src", new RegExp(`page-${String(startPage < CATALOG_PAGES ? startPage + 1 : startPage).padStart(3, "0")}\.webp`));
  });

  test("remembers scroll layout, isolates zoom-in, and jumps directly to selected pages", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(3, CATALOG_PAGES);
    await openDirectViewer(page, startPage);

    const toggle = page.locator("#viewerLayoutToggle");
    const scrollPages = page.locator("#viewerScrollPages");
    const autoZoomButton = page.locator("#viewerAutoZoomBtn");

    await toggle.click();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VIEWER_LAYOUT_KEY)).toBe("scroll");
    await page.reload();
    await waitForApp(page);
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-scroll/);
    await expect(toggle).toHaveAttribute("data-viewer-layout", "scroll");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await expect.poll(() => scrollPages.locator(`[data-scroll-page="${startPage}"] img[src]`).count()).toBe(1);

    const currentFrame = scrollPages.locator(`[data-scroll-page="${startPage}"]`);
    const neighborPage = Math.min(CATALOG_PAGES, startPage + 1);
    const neighborFrame = scrollPages.locator(`[data-scroll-page="${neighborPage}"]`);
    const automaticWidth = await currentFrame.evaluate((element) => element.getBoundingClientRect().width);
    const neighborWidth = await neighborFrame.evaluate((element) => element.getBoundingClientRect().width);

    await page.mouse.move(720, 450);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -36);
    await page.keyboard.up("Control");
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-scroll-zoom-isolated/);
    await expect(scrollPages).toBeHidden();
    await expect(page.locator("#lightboxImageFrame")).toBeVisible();
    await expect(autoZoomButton).toBeVisible();
    await expect.poll(() => neighborFrame.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(Math.round(neighborWidth));

    const isolatedFrame = page.locator("#lightboxImageFrame");
    const initialPan = await isolatedFrame.evaluate((element) => ({
      x: Number.parseFloat(element.style.getPropertyValue("--single-pan-x")) || 0,
      y: Number.parseFloat(element.style.getPropertyValue("--single-pan-y")) || 0
    }));

    await page.mouse.wheel(0, 80);
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-scroll-zoom-isolated/);
    await expect.poll(() => isolatedFrame.evaluate((element) => Number.parseFloat(element.style.getPropertyValue("--single-pan-y")) || 0)).not.toBe(initialPan.y);

    await page.mouse.wheel(80, 0);
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-scroll-zoom-isolated/);
    await expect.poll(() => isolatedFrame.evaluate((element) => Number.parseFloat(element.style.getPropertyValue("--single-pan-x")) || 0)).not.toBe(initialPan.x);

    await page.mouse.wheel(0, 2400);
    await expect(page.locator("#lightbox")).not.toHaveClass(/viewer-scroll-zoom-isolated/);
    await expect(scrollPages).toBeVisible();
    await expect(autoZoomButton).toBeHidden();
    await expect.poll(() => currentFrame.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(Math.round(automaticWidth));

    const targetPage = Math.max(1, CATALOG_PAGES - 1);
    await page.mouse.move(1438, 450);
    await expect(page.locator("#lightboxPageRail")).toBeVisible();
    const beforeTop = await scrollPages.evaluate((element) => element.scrollTop);
    await page.locator(`#lightboxPageThumbs [data-page="${targetPage}"]`).click();
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(targetPage));
    await expect(scrollPages.locator(`[data-scroll-page="${targetPage}"]`)).toHaveClass(/page-swap-enter/);
    const afterTop = await scrollPages.evaluate((element) => element.scrollTop);
    expect(Math.abs(afterTop - beforeTop)).toBeGreaterThan(100);

    await page.mouse.move(720, 1);
    await expect(page.locator("#lightboxBar")).toBeVisible();
    await toggle.click();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VIEWER_LAYOUT_KEY)).toBe("side");
    await page.reload();
    await waitForApp(page);
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-side/);
    await expect(toggle).toHaveAttribute("data-viewer-layout", "side");
  });


  test("keeps scroll-viewer boundary navigation stationary", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 1);
    await page.locator("#viewerLayoutToggle").click();

    const scrollPages = page.locator("#viewerScrollPages");
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-scroll/);
    const firstTop = await scrollPages.evaluate((element) => element.scrollTop);

    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("1");
    await expect.poll(() => scrollPages.evaluate((element) => element.scrollTop)).toBe(firstTop);
    await expect(scrollPages.locator(".page-swap-enter")).toHaveCount(0);

    await page.keyboard.press("End");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(CATALOG_PAGES));
    await page.waitForTimeout(320);
    await expect(scrollPages.locator(".page-swap-enter")).toHaveCount(0);
    const lastTop = await scrollPages.evaluate((element) => element.scrollTop);

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(CATALOG_PAGES));
    await expect.poll(() => scrollPages.evaluate((element) => element.scrollTop)).toBe(lastTop);
    await expect(scrollPages.locator(".page-swap-enter")).toHaveCount(0);
  });

  test("shows a stable error state when a catalog image fails", async ({ page }) => {
    await preparePage(page, { failPages: [2] });
    await page.goto(`/viewer.html?catalog=${CATALOG_ID}&page=2`);
    await waitForApp(page);

    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-error/);
    await expect(page.locator("#viewerLoading")).toBeHidden();
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("2");
  });

  test("shows the first-run viewer tour once and remembers dismissal", async ({ page }) => {
    await preparePage(page, { onboardingSeen: false });
    await openDirectViewer(page, 1);

    const tour = page.locator("#viewerOnboarding");
    await expect(tour).toHaveAttribute("aria-hidden", "false");
    await expect(tour).toHaveClass(/layout-ready/);
    await expect(page.locator("#viewerOnboardingCounter")).toHaveText("1 מתוך 6");
    await expect(page.locator("#viewerOnboardingCard")).toBeInViewport();

    await page.locator("#viewerOnboardingSkip").click();
    await expect(tour).toBeHidden();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), ONBOARDING_KEY)).toBe("1");

    await page.reload();
    await waitForApp(page);
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);
    await expect(tour).toBeHidden();
    await expect(tour).toHaveAttribute("aria-hidden", "true");
  });

  test("emits privacy-safe operational telemetry for a real journey", async ({ page }) => {
    const events = [];
    await preparePage(page, { telemetryEvents: events });
    await page.goto("/index.html");
    await waitForApp(page);

    await page.locator("#globalSearchOpen").click();
    await page.locator("#globalSearchInput").fill("פתיחת");
    await expect(page.locator("#globalSearchResults [data-search-catalog]").first()).toBeVisible();
    await expect.poll(() => events.map((event) => event.name), { timeout: 3500 }).toContain("search");
    await page.locator("#globalSearchClose").click();

    await page.locator(".catalog-open-button").first().click();
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);
    await page.locator("#viewerFavoriteButton").click();
    await page.waitForTimeout(1200);

    const names = events.map((event) => event.name);
    expect(names).toContain("search");
    expect(names).toContain("catalog_open");
    expect(names).toContain("favorite");
    expect(names).not.toContain("page_view");
    expect(names).not.toContain("page_load");
    expect(names).not.toContain("first_catalog_image");
    for (const event of events) {
      expect(event).not.toHaveProperty("visitorId");
      expect(event).not.toHaveProperty("userAgent");
      expect(event).not.toHaveProperty("referrer");
      expect(event).not.toHaveProperty("stack");
    }
  });
});

test("shares favorites to a clean browser context without relying on local storage", async ({ browser }) => {
  const producerContext = await browser.newContext({
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce"
  });
  const producer = await producerContext.newPage();
  const producerErrors = monitorRuntimeErrors(producer);
  await preparePage(producer, { captureClipboard: true });
  await openDirectViewer(producer, 2);
  await producer.locator("#viewerFavoriteButton").click();
  await producer.locator("#nextPageBtn").click();
  await producer.locator("#nextPageBtn").click();
  await expect(producer.locator("#viewerPageIndicatorCurrent")).toHaveText("4");
  await producer.locator("#viewerFavoriteButton").click();

  await producer.goto("/favorites.html");
  await waitForApp(producer);
  await expect(producer.locator("#favoritesGrid .favorite-card")).toHaveCount(2);
  await producer.locator("#favoritesShareButton").click();
  await expect.poll(() => producer.evaluate(() => window.__bargigE2eClipboard || "")).not.toBe("");
  const sharedLink = await producer.evaluate(() => window.__bargigE2eClipboard);
  expect(sharedLink).toContain("favorites.html?selection=");

  const consumerContext = await browser.newContext({
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce"
  });
  const consumer = await consumerContext.newPage();
  const consumerErrors = monitorRuntimeErrors(consumer);
  await preparePage(consumer);
  await consumer.goto(sharedLink);
  await waitForApp(consumer);

  await expect(consumer.locator("#favoritesGrid .favorite-card")).toHaveCount(2);
  await expect(consumer.locator("#favoritesCount")).toHaveText("2");
  await expect(consumer).not.toHaveURL(/selection=/);
  const importedPages = await consumer.locator("#favoritesGrid .favorite-card").evaluateAll((cards) => (
    cards.map((card) => Number(card.dataset.favoritePage)).sort((a, b) => a - b)
  ));
  expect(importedPages).toEqual([2, 4]);
  expect(producerErrors, "Producer context runtime errors").toEqual([]);
  expect(consumerErrors, "Consumer context runtime errors").toEqual([]);

  await consumerContext.close();
  await producerContext.close();
});

test("mobile home and viewer survive portrait and landscape orientation", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  const runtimeErrors = monitorRuntimeErrors(page);
  await preparePage(page);
  await page.goto("/index.html");
  await waitForApp(page);

  await expect(page.locator("#mobileCategoryMenuToggle")).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.locator(".catalog-open-button").first().click();
  await expect(page).toHaveURL(new RegExp(`viewer\\.html\\?catalog=${CATALOG_ID}&page=1`));
  await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);
  await expectViewerFrameCentered(page);
  await page.locator("#nextPageBtn").click();
  await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("2");

  await page.setViewportSize({ width: 844, height: 390 });
  await expectViewerFrameCentered(page);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(runtimeErrors, "Mobile context runtime errors").toEqual([]);

  await context.close();
});

test.describe("visual regression", () => {
  test("catalog card geometry remains stable", async ({ page }) => {
    await preparePage(page);
    await page.goto("/index.html");
    await waitForApp(page);
    const card = page.locator(".catalog-card").first();
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot("catalog-card.png", { stylePath: VISUAL_STYLE });
  });

  test("viewer stage remains centered and unclipped", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 1);
    await expect(page.locator("#lightboxStage")).toHaveScreenshot("viewer-stage.png", { stylePath: VISUAL_STYLE });
  });
});
