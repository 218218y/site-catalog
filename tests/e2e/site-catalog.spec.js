"use strict";

const path = require("node:path");
const { test, expect } = require("@playwright/test");

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
  await page.addInitScript(({ onboardingKey, favoritesKey }) => {
    localStorage.setItem(onboardingKey, "1");
    if (sessionStorage.getItem("bargig.e2e-storage-prepared") !== "1") {
      localStorage.removeItem(favoritesKey);
      sessionStorage.setItem("bargig.e2e-storage-prepared", "1");
    }
  }, { onboardingKey: ONBOARDING_KEY, favoritesKey: FAVORITES_KEY });

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

  test("supports a direct viewer link and returns to the main page", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 5);

    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("5");
    await expect(page.locator("#lightboxImage")).toHaveAttribute("src", /page-005\.webp/);

    await page.locator("#lightboxHomeLink").click();
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "home");
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
});

test("mobile layout survives portrait and landscape orientation", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  await preparePage(page);
  await page.goto("/index.html");
  await waitForApp(page);

  await expect(page.locator("#mobileCategoryMenuToggle")).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".catalog-card").first()).toBeVisible();
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

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
