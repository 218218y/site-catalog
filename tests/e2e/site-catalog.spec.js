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
const favoriteCatalogTransitionCatalog = catalogData.find((catalog) => catalog.id === "opening-fredi-2026") || testCatalog;
const FAVORITE_CATALOG_TRANSITION_ID = favoriteCatalogTransitionCatalog.id;
const FAVORITE_CATALOG_TRANSITION_PAGES = Math.max(1, Number(favoriteCatalogTransitionCatalog.pages) || 1);
const FAVORITE_CATALOG_TRANSITION_PAGE = Math.min(4, FAVORITE_CATALOG_TRANSITION_PAGES);
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
  await expectCurrentViewerImageReady(page);
}

async function currentViewerSurface(page) {
  const lightbox = page.locator("#lightbox");
  if (await lightbox.evaluate((element) => element.classList.contains("viewer-layout-scroll"))) {
    const currentPage = Number(await page.locator("#viewerPageIndicatorCurrent").textContent()) || 1;
    return page.locator(`#viewerScrollPages [data-scroll-page="${currentPage}"]`);
  }
  return page.locator("#lightboxImageFrame");
}

async function expectCurrentViewerImageReady(page) {
  await expect.poll(async () => {
    const surface = await currentViewerSurface(page);
    return surface.getAttribute("class");
  }).toMatch(/image-ready/);
}

async function expectViewerFrameCentered(page, tolerance = 1.5) {
  await expect.poll(async () => (await currentViewerSurface(page)).evaluate((frame) => {
    const rect = frame.getBoundingClientRect();
    const horizontal = Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2);
    const vertical = Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2);
    return Math.max(horizontal, vertical);
  })).toBeLessThanOrEqual(tolerance);
}

// The production class exists for only 240 ms. Observe it before the action
// instead of asserting its current state after other Playwright waits finish.
const PAGE_SWAP_OBSERVED_ATTRIBUTE = "data-e2e-page-swap-observed";
const PAGE_SWAP_COUNT_ATTRIBUTE = "data-e2e-page-swap-count";

async function armPageSwapObservation(frame) {
  await frame.evaluate((element, attributes) => {
    element.removeAttribute(attributes.observed);
    element.removeAttribute(attributes.count);

    const recordActiveSwap = () => {
      if (!element.classList.contains("page-swap-enter")) return false;
      const root = element.parentElement || document;
      element.setAttribute(attributes.observed, "true");
      element.setAttribute(attributes.count, String(root.querySelectorAll(".page-swap-enter").length));
      return true;
    };

    if (recordActiveSwap()) return;
    const observer = new MutationObserver(() => {
      if (!recordActiveSwap()) return;
      observer.disconnect();
    });
    observer.observe(element, { attributes: true, attributeFilter: ["class"] });
  }, {
    observed: PAGE_SWAP_OBSERVED_ATTRIBUTE,
    count: PAGE_SWAP_COUNT_ATTRIBUTE
  });
}

async function expectPageSwapObserved(frame) {
  await expect(frame).toHaveAttribute(PAGE_SWAP_OBSERVED_ATTRIBUTE, "true");
  await expect(frame).toHaveAttribute(PAGE_SWAP_COUNT_ATTRIBUTE, "1");
  await frame.evaluate((element, attributes) => {
    element.removeAttribute(attributes.observed);
    element.removeAttribute(attributes.count);
  }, {
    observed: PAGE_SWAP_OBSERVED_ATTRIBUTE,
    count: PAGE_SWAP_COUNT_ATTRIBUTE
  });
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
    await expectCurrentViewerImageReady(page);
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

  test("re-enters the full scroll catalog at the saved favorite instead of showing a blank frame", async ({ page }) => {
    await preparePage(page);
    await page.goto(`/viewer.html?catalog=${FAVORITE_CATALOG_TRANSITION_ID}&page=${FAVORITE_CATALOG_TRANSITION_PAGE}`);
    await waitForApp(page);
    await expect(page.locator("#lightbox")).toBeVisible();
    await expectCurrentViewerImageReady(page);

    await page.locator("#viewerFavoriteButton").click();
    await expect(page.locator("#viewerFavoriteButton")).toHaveAttribute("aria-pressed", "true");

    await page.goto("/favorites.html");
    await waitForApp(page);
    const favoriteCard = page.locator(
      `[data-favorite-catalog="${FAVORITE_CATALOG_TRANSITION_ID}"][data-favorite-page="${FAVORITE_CATALOG_TRANSITION_PAGE}"]`
    );
    await expect(favoriteCard).toBeVisible();
    await favoriteCard.locator("[data-open-favorite]").click();

    await expect(page).toHaveURL(new RegExp(
      `viewer[.]html[?]catalog=${FAVORITE_CATALOG_TRANSITION_ID}&page=${FAVORITE_CATALOG_TRANSITION_PAGE}&source=favorites`
    ));
    await expect(page.locator("#lightbox")).toHaveClass(/favorites-viewer-mode/);
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);

    await page.locator("#favoriteOpenCatalogButton").click();

    await expect(page).toHaveURL(new RegExp(
      `viewer[.]html[?]catalog=${FAVORITE_CATALOG_TRANSITION_ID}&page=${FAVORITE_CATALOG_TRANSITION_PAGE}$`
    ));
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-scroll/);
    await expect(page.locator("#lightbox")).not.toHaveClass(/favorites-viewer-mode/);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(FAVORITE_CATALOG_TRANSITION_PAGE));

    const scrollPages = page.locator("#viewerScrollPages");
    const targetFrame = scrollPages.locator(`[data-scroll-page="${FAVORITE_CATALOG_TRANSITION_PAGE}"]`);
    await expect(targetFrame).toHaveClass(/image-ready/);
    await expect(targetFrame.locator("img")).toHaveAttribute(
      "src",
      new RegExp(`page-${String(FAVORITE_CATALOG_TRANSITION_PAGE).padStart(3, "0")}[.]webp`)
    );
    await expect.poll(() => targetFrame.evaluate((frame) => {
      const rect = frame.getBoundingClientRect();
      return Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2);
    })).toBeLessThanOrEqual(2);
    if (FAVORITE_CATALOG_TRANSITION_PAGE > 1) {
      await expect.poll(() => scrollPages.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
    }

    if (FAVORITE_CATALOG_TRANSITION_PAGE < FAVORITE_CATALOG_TRANSITION_PAGES) {
      const nextPage = FAVORITE_CATALOG_TRANSITION_PAGE + 1;
      await page.locator("#nextPageBtn").click();
      await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(nextPage));
      const nextFrame = scrollPages.locator(`[data-scroll-page="${nextPage}"]`);
      await expect(nextFrame).toHaveClass(/image-ready/);
      await expect.poll(() => nextFrame.evaluate((frame) => {
        const rect = frame.getBoundingClientRect();
        return Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2);
      })).toBeLessThanOrEqual(2);
    }
  });

  test("supports a direct viewer link, shares the exact page, and returns home", async ({ page }) => {
    await preparePage(page, { captureClipboard: true });
    await openDirectViewer(page, 5);

    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("5");
    await expect(page.locator('#viewerScrollPages [data-scroll-page="5"] img')).toHaveAttribute("src", /page-005\.webp/);

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

  test("starts in progressively loaded scroll layout and can switch to side layout", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(4, CATALOG_PAGES);
    await openDirectViewer(page, startPage);

    const toggle = page.locator("#viewerLayoutToggle");
    const scrollPages = page.locator("#viewerScrollPages");
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

  test("defaults to scroll, remembers only side override, isolates zoom, and jumps to selected pages", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(3, CATALOG_PAGES);
    await openDirectViewer(page, startPage);

    const toggle = page.locator("#viewerLayoutToggle");
    const scrollPages = page.locator("#viewerScrollPages");
    const autoZoomButton = page.locator("#viewerAutoZoomBtn");

    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VIEWER_LAYOUT_KEY)).toBeNull();
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
    const targetFrame = scrollPages.locator(`[data-scroll-page="${targetPage}"]`);
    await armPageSwapObservation(targetFrame);
    await page.locator(`#lightboxPageThumbs [data-page="${targetPage}"]`).click();
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(targetPage));
    await expectPageSwapObserved(targetFrame);
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

    await toggle.click();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VIEWER_LAYOUT_KEY)).toBeNull();
    await page.reload();
    await waitForApp(page);
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-scroll/);
    await expect(toggle).toHaveAttribute("data-viewer-layout", "scroll");
  });


  test("toggles isolated zoom with one double-click per gesture in scroll layout", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(4, CATALOG_PAGES);
    await openDirectViewer(page, startPage);

    const lightbox = page.locator("#lightbox");
    const scrollPages = page.locator("#viewerScrollPages");
    const currentFrame = scrollPages.locator(`[data-scroll-page="${startPage}"]`);
    await expect(currentFrame).toBeVisible();

    await currentFrame.dblclick({ position: { x: 220, y: 180 } });
    await expect(lightbox).toHaveClass(/viewer-scroll-zoom-isolated/);
    await expect(scrollPages).toBeHidden();
    await expect(page.locator("#viewerAutoZoomBtn")).toBeVisible();

    await page.mouse.dblclick(720, 450, { delay: 70 });
    await expect(lightbox).not.toHaveClass(/viewer-scroll-zoom-isolated/);
    await expect(scrollPages).toBeVisible();
    await expect(page.locator("#viewerAutoZoomBtn")).toBeHidden();
  });

  test("cancels smooth motion for repeated vertical commands and lands exactly", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(2, Math.max(1, CATALOG_PAGES - 4));
    await openDirectViewer(page, startPage);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    const scrollPages = page.locator("#viewerScrollPages");
    await scrollPages.evaluate((container) => {
      const nativeScrollTo = container.scrollTo.bind(container);
      window.__viewerE2eSmoothScrollCalls = [];
      container.scrollTo = (...args) => {
        const options = args[0];
        if (options && typeof options === "object") {
          window.__viewerE2eSmoothScrollCalls.push(options.behavior || "auto");
        }
        return nativeScrollTo(...args);
      };
    });

    const forwardSteps = Math.min(3, CATALOG_PAGES - startPage);
    const forwardPage = startPage + forwardSteps;
    const forwardFrame = scrollPages.locator(`[data-scroll-page="${forwardPage}"]`);
    if (forwardSteps > 1) await armPageSwapObservation(forwardFrame);
    if (forwardSteps > 0) await page.keyboard.press("ArrowDown");
    for (let index = 1; index < forwardSteps; index += 1) {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", {
          key: "ArrowDown",
          repeat: true,
          bubbles: true,
          cancelable: true
        }));
      });
    }
    if (forwardSteps > 1) await expectPageSwapObserved(forwardFrame);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(forwardPage));
    await expect.poll(() => scrollPages.evaluate((container, targetPage) => {
      const frame = container.querySelector(`[data-scroll-page="${targetPage}"]`);
      if (!frame) return Number.POSITIVE_INFINITY;
      const expected = Math.max(0, frame.offsetTop - Math.max(0, (container.clientHeight - frame.offsetHeight) / 2));
      return Math.abs(container.scrollTop - expected);
    }, forwardPage)).toBeLessThanOrEqual(2);
    await expect.poll(() => page.evaluate(() => window.__viewerE2eSmoothScrollCalls)).toEqual(["smooth"]);

    await page.waitForTimeout(320);
    const backwardSteps = Math.min(2, forwardPage - 1);
    const backwardPage = forwardPage - backwardSteps;
    const backwardFrame = scrollPages.locator(`[data-scroll-page="${backwardPage}"]`);
    if (backwardSteps > 1) await armPageSwapObservation(backwardFrame);
    if (backwardSteps > 0) await page.keyboard.press("ArrowUp");
    for (let index = 1; index < backwardSteps; index += 1) {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", {
          key: "ArrowUp",
          repeat: true,
          bubbles: true,
          cancelable: true
        }));
      });
    }
    if (backwardSteps > 1) await expectPageSwapObserved(backwardFrame);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(backwardPage));
    await expect.poll(() => scrollPages.evaluate((container, targetPage) => {
      const frame = container.querySelector(`[data-scroll-page="${targetPage}"]`);
      if (!frame) return Number.POSITIVE_INFINITY;
      const expected = Math.max(0, frame.offsetTop - Math.max(0, (container.clientHeight - frame.offsetHeight) / 2));
      return Math.abs(container.scrollTop - expected);
    }, backwardPage)).toBeLessThanOrEqual(2);
    await expect.poll(() => page.evaluate(() => window.__viewerE2eSmoothScrollCalls)).toEqual(["smooth", "smooth"]);
  });

  test("normalizes mouse-wheel and precision-touchpad streams through one page path", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(3, Math.max(1, CATALOG_PAGES - 6));
    await openDirectViewer(page, startPage);

    const scrollPages = page.locator("#viewerScrollPages");
    const alignedDistance = (targetPage) => scrollPages.evaluate((container, pageNumber) => {
      const frame = container.querySelector(`[data-scroll-page="${pageNumber}"]`);
      if (!frame) return Number.POSITIVE_INFINITY;
      const expected = Math.max(0, frame.offsetTop - Math.max(0, (container.clientHeight - frame.offsetHeight) / 2));
      return Math.abs(container.scrollTop - expected);
    }, targetPage);
    const dispatchWheelStream = (deltas, deltaMode = 0) => scrollPages.evaluate((container, payload) => {
      let everyEventCanceled = true;
      const scrollTops = [];
      payload.deltas.forEach((deltaY) => {
        const event = new WheelEvent("wheel", {
          deltaX: 0,
          deltaY,
          deltaMode: payload.deltaMode,
          bubbles: true,
          cancelable: true
        });
        everyEventCanceled = !container.dispatchEvent(event) && everyEventCanceled;
        scrollTops.push(container.scrollTop);
      });
      return {
        everyEventCanceled,
        scrollTop: container.scrollTop,
        scrollTops
      };
    }, { deltas, deltaMode });
    const settleWheelGesture = () => page.waitForTimeout(180);

    const startTop = await scrollPages.evaluate((container) => container.scrollTop);
    const accidentalGesture = await dispatchWheelStream([19]);
    expect(accidentalGesture.everyEventCanceled).toBe(true);
    expect(Math.abs(accidentalGesture.scrollTop - startTop)).toBeLessThanOrEqual(2);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await expect.poll(() => alignedDistance(startPage)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    const firstPageTarget = Math.min(CATALOG_PAGES, startPage + 1);
    const granularGesture = await dispatchWheelStream(Array(2).fill(10));
    expect(granularGesture.everyEventCanceled).toBe(true);
    for (const intermediateTop of granularGesture.scrollTops.slice(0, -1)) {
      expect(Math.abs(intermediateTop - startTop)).toBeLessThanOrEqual(2);
    }
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(firstPageTarget));
    await expect.poll(() => alignedDistance(firstPageTarget)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    await dispatchWheelStream([-20]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await expect.poll(() => alignedDistance(startPage)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    const wideSinglePageGesture = await dispatchWheelStream([199]);
    expect(wideSinglePageGesture.everyEventCanceled).toBe(true);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(firstPageTarget));
    await expect.poll(() => alignedDistance(firstPageTarget)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    await dispatchWheelStream([-199]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await expect.poll(() => alignedDistance(startPage)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    const twoPageTarget = Math.min(CATALOG_PAGES, startPage + 2);
    await dispatchWheelStream([200]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(twoPageTarget));
    await expect.poll(() => alignedDistance(twoPageTarget)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    await dispatchWheelStream([-200]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await expect.poll(() => alignedDistance(startPage)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    const lineModeTarget = Math.min(CATALOG_PAGES, startPage + 1);
    await dispatchWheelStream([3], 1);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(lineModeTarget));
    await expect.poll(() => alignedDistance(lineModeTarget)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    const largeTarget = Math.min(CATALOG_PAGES, lineModeTarget + 2);
    await dispatchWheelStream([240]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(largeTarget));
    await expect.poll(() => alignedDistance(largeTarget)).toBeLessThanOrEqual(2);
    await settleWheelGesture();

    const repeatedTarget = Math.min(CATALOG_PAGES, largeTarget + 3);
    await dispatchWheelStream([100, 100, 100]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(repeatedTarget));
    await expect.poll(() => alignedDistance(repeatedTarget)).toBeLessThanOrEqual(2);
  });

  test("keeps scroll-viewer boundary navigation stationary", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 1);

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

  test("supports PageUp, PageDown, and horizontal touch swipes in scroll layout", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(2, Math.max(1, CATALOG_PAGES - 2));
    await openDirectViewer(page, startPage);

    await page.keyboard.press("PageDown");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(Math.min(CATALOG_PAGES, startPage + 1)));
    await page.keyboard.press("PageUp");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));

    const scrollPages = page.locator("#viewerScrollPages");
    await scrollPages.evaluate((container) => {
      const nativeScrollTo = container.scrollTo.bind(container);
      window.__viewerSwipeSmoothScrollCalls = [];
      container.scrollTo = (...args) => {
        const options = args[0];
        if (options && typeof options === "object") {
          window.__viewerSwipeSmoothScrollCalls.push(options.behavior || "auto");
        }
        return nativeScrollTo(...args);
      };
    });

    const nextPage = Math.min(CATALOG_PAGES, startPage + 1);
    const nextFrame = scrollPages.locator(`[data-scroll-page="${nextPage}"]`);
    await armPageSwapObservation(nextFrame);
    await scrollPages.dispatchEvent("pointerdown", {
      pointerId: 71,
      pointerType: "touch",
      isPrimary: true,
      clientX: 280,
      clientY: 430,
      bubbles: true,
      cancelable: true
    });
    await scrollPages.dispatchEvent("pointerup", {
      pointerId: 71,
      pointerType: "touch",
      isPrimary: true,
      clientX: 390,
      clientY: 438,
      bubbles: true,
      cancelable: true
    });
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(nextPage));
    await expectPageSwapObserved(nextFrame);
    await expect.poll(() => page.evaluate(() => window.__viewerSwipeSmoothScrollCalls)).toEqual([]);

    const startFrame = scrollPages.locator(`[data-scroll-page="${startPage}"]`);
    await armPageSwapObservation(startFrame);
    await scrollPages.dispatchEvent("pointerdown", {
      pointerId: 72,
      pointerType: "touch",
      isPrimary: true,
      clientX: 390,
      clientY: 430,
      bubbles: true,
      cancelable: true
    });
    await scrollPages.dispatchEvent("pointerup", {
      pointerId: 72,
      pointerType: "touch",
      isPrimary: true,
      clientX: 280,
      clientY: 438,
      bubbles: true,
      cancelable: true
    });
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await expectPageSwapObserved(startFrame);
    await expect.poll(() => page.evaluate(() => window.__viewerSwipeSmoothScrollCalls)).toEqual([]);
  });

  test("falls back to the thumbnail when a full catalog image fails", async ({ page }) => {
    await preparePage(page, { failPages: [2] });
    await page.goto(`/viewer.html?catalog=${CATALOG_ID}&page=2`);
    await waitForApp(page);

    const frame = page.locator('#viewerScrollPages [data-scroll-page="2"]');
    await expect(frame).toHaveClass(/image-ready/);
    await expect(frame).toHaveClass(/image-fallback/);
    await expect(frame.locator("[data-scroll-image-feedback]")).toContainText("מוצגת תצוגה מוקטנת");
    await expect(frame.locator("[data-retry-scroll-page="2"]")).toBeVisible();
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
    await expectCurrentViewerImageReady(page);
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
    await expectCurrentViewerImageReady(page);
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
  await expectCurrentViewerImageReady(page);
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
