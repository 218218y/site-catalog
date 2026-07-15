"use strict";

const path = require("node:path");
const { test: base, expect } = require("@playwright/test");

function monitorRuntimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error?.stack || error?.message || String(error)));
  return errors;
}

const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeErrors = monitorRuntimeErrors(page);
    await use(page);
    expect(runtimeErrors, "Uncaught browser runtime errors").toEqual([]);
  }
});

const CATALOG_ID = "opening-tbi-2026";
const ONBOARDING_KEY = "bargig.viewer-onboarding.v2";
const FAVORITES_KEY = "bargig.catalog-favorites.v1";
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
  const captureClipboard = options.captureClipboard === true;
  await page.addInitScript(({ onboardingKey, favoritesKey, onboardingSeen, resetFavorites, captureClipboard }) => {
    if (sessionStorage.getItem("bargig.e2e-onboarding-prepared") !== "1") {
      if (onboardingSeen) localStorage.setItem(onboardingKey, "1");
      else localStorage.removeItem(onboardingKey);
      sessionStorage.setItem("bargig.e2e-onboarding-prepared", "1");
    }
    if (resetFavorites && sessionStorage.getItem("bargig.e2e-storage-prepared") !== "1") {
      localStorage.removeItem(favoritesKey);
      sessionStorage.setItem("bargig.e2e-storage-prepared", "1");
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
  }, { onboardingKey: ONBOARDING_KEY, favoritesKey: FAVORITES_KEY, onboardingSeen, resetFavorites, captureClipboard });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
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
  test("opens a catalog and moves forward and backward", async ({ page }) => {
    await preparePage(page);
    await page.goto("/index.html");
    await waitForApp(page);

    await expect(page.locator(".catalog-card")).toHaveCount(16);
    await page.locator(".catalog-open-button").first().click();

    await expect(page).toHaveURL(/viewer\.html\?catalog=opening-tbi-2026&page=1/);
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
    await expect(page.locator("#pageGrid .page-card")).toHaveCount(37);

    await page.locator('[data-open-page="6"]').click();
    await expect(page).toHaveURL(new RegExp(`viewer\\.html\\?catalog=${CATALOG_ID}&page=6`));
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("6");
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
    await expect(page.locator("#pageGrid .page-card")).toHaveCount(37);
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
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("37");
    await page.keyboard.press("Home");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("1");
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
