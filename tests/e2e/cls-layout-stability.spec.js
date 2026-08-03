"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const catalogs = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../catalogs.generated.json"), "utf8"));
const catalog = catalogs.find((item) => item.id === "opening-tbi-2026")
  || catalogs.find((item) => Number(item.pages) >= 4)
  || catalogs[0];
if (!catalog) throw new Error("CLS E2E requires at least one catalog.");
const firstPage = catalog.pageNumberStart === 0 ? 0 : 1;
const assetPage = (displayPage) => displayPage - firstPage + 1;

function imageSvg(width, height, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#eee5db"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="120">${label}</text>
  </svg>`;
}

async function installClsObserver(page) {
  await page.addInitScript(() => {
    localStorage.setItem("bargig.viewer-onboarding.v2", "1");
    window.__bargigClsEntries = [];
    window.__bargigClsTotal = 0;
    window.__bargigResetCls = () => {
      window.__bargigClsEntries = [];
      window.__bargigClsTotal = 0;
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__bargigClsTotal += entry.value;
        window.__bargigClsEntries.push({
          value: entry.value,
          startTime: entry.startTime,
          sources: (entry.sources || []).map((source) => ({
            id: source.node?.id || "",
            className: String(source.node?.className || "")
          }))
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function resetCls(page) {
  await page.evaluate(() => window.__bargigResetCls());
}

async function expectStableCls(page, label, maximum = 0.01) {
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => ({
    total: window.__bargigClsTotal,
    entries: window.__bargigClsEntries
  }));
  expect(result.total, `${label}: ${JSON.stringify(result.entries)}`).toBeLessThanOrEqual(maximum);
}

async function waitForApp(page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function waitForViewerImage(page) {
  await expect.poll(() => page.evaluate(() => {
    const frame = document.querySelector("#lightboxImageFrame");
    const image = document.querySelector("#lightboxImage");
    return Boolean(
      frame?.classList.contains("image-ready")
      && frame.getAttribute("aria-busy") !== "true"
      && image?.complete
      && image.naturalWidth > 0
    );
  })).toBe(true);
}

async function mockCatalogImages(page, state = {}) {
  await page.route("**/assets/pages/**", async (route) => {
    const url = new URL(route.request().url());
    const catalogMatch = url.pathname.match(/\/assets\/pages\/([^/]+)\//);
    const pageMatch = url.pathname.match(/page-(\d+)\.[a-z0-9]+$/i);
    const catalogId = catalogMatch?.[1] || catalog.id;
    const candidateCatalog = catalogs.find((item) => item.id === catalogId) || catalog;
    const requestedAssetPage = Math.max(1, Number(pageMatch?.[1]) || 1);
    const size = candidateCatalog.pageSizes?.[requestedAssetPage - 1] || [1414, 1000];
    const isThumbnail = url.pathname.includes("/thumbs/");
    const isVisibleTier = !isThumbnail;
    const targetAssetPage = assetPage(state.targetDisplayPage ?? firstPage);

    const shouldDelay = Boolean(
      state.delayMs
      && (
        (isVisibleTier && requestedAssetPage === targetAssetPage)
        || (isThumbnail && state.delayThumbnails)
      )
    );
    if (shouldDelay) {
      await new Promise((resolve) => setTimeout(resolve, state.delayMs));
    }
    if (isVisibleTier && requestedAssetPage === targetAssetPage && state.failVisibleTiers) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "Synthetic visible-tier failure" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
      body: imageSvg(Number(size[0]), Number(size[1]), requestedAssetPage)
    });
  });
}

test.describe("CLS layout stability", () => {
  test.beforeEach(async ({ page }) => {
    await installClsObserver(page);
  });

  test("catalog xs keeps card geometry during cold and cache-hit image timings", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const state = {
      targetDisplayPage: firstPage,
      delayMs: 700,
      delayThumbnails: true
    };
    await mockCatalogImages(page, state);
    await page.goto(`/catalog/${catalog.id}/`);
    await waitForApp(page);
    await expectStableCls(page, "cold xs catalog");

    state.delayMs = 0;
    await resetCls(page);
    await page.reload();
    await waitForApp(page);
    await expectStableCls(page, "cache-hit-timing xs catalog");
  });

  test("opening the viewer from a catalog keeps the primed frame box", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockCatalogImages(page, { targetDisplayPage: firstPage, delayMs: 750 });
    await page.goto(`/catalog/${catalog.id}/`);
    await waitForApp(page);

    await resetCls(page);
    await page.locator(`[data-open-page="${firstPage}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/catalog/${catalog.id}/page/${firstPage}/$`));
    const frame = page.locator("#lightboxImageFrame");
    await expect(frame).toBeVisible();
    const beforeLoad = await frame.boundingBox();
    expect(beforeLoad).not.toBeNull();

    await waitForViewerImage(page);
    const afterLoad = await frame.boundingBox();
    expect(afterLoad).not.toBeNull();
    expect(Math.abs(afterLoad.width - beforeLoad.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterLoad.height - beforeLoad.height)).toBeLessThanOrEqual(1);
    await expectStableCls(page, "catalog-to-viewer opening");
  });

  test("direct viewer reserves final xs geometry before a slow primary image", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockCatalogImages(page, { targetDisplayPage: firstPage, delayMs: 750 });
    await page.goto(`/catalog/${catalog.id}/page/${firstPage}/`);
    await waitForApp(page);
    await expect(page.locator("html")).toHaveClass(/\bviewer-open\b/);
    await waitForViewerImage(page);
    await expectStableCls(page, "slow direct viewer xs");
  });

  test("viewer page replacement stays stable after a delayed arrow navigation", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const state = { targetDisplayPage: firstPage, delayMs: 0 };
    await mockCatalogImages(page, state);
    await page.goto(`/catalog/${catalog.id}/page/${firstPage}/`);
    await waitForApp(page);
    await waitForViewerImage(page);

    state.targetDisplayPage = firstPage + 1;
    state.delayMs = 750;
    await resetCls(page);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(firstPage + 1));
    await waitForViewerImage(page);
    await expectStableCls(page, "delayed viewer page replacement");
  });

  test("viewer fallback retains the declared page box", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockCatalogImages(page, {
      targetDisplayPage: firstPage,
      delayMs: 550,
      failVisibleTiers: true
    });
    await page.goto(`/catalog/${catalog.id}/page/${firstPage}/`);
    await waitForApp(page);
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/\bimage-fallback\b/);
    await waitForViewerImage(page);
    await expectStableCls(page, "viewer thumbnail fallback");
  });

  test("direct viewer is stable in xs landscape", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await mockCatalogImages(page, { targetDisplayPage: firstPage, delayMs: 700 });
    await page.goto(`/catalog/${catalog.id}/page/${firstPage}/`);
    await waitForApp(page);
    await waitForViewerImage(page);
    await expectStableCls(page, "slow direct viewer landscape");
  });

  test("progressive global search renders inside its reserved overlay", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.route("**/catalogs.search-index*.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await route.continue();
    });
    await page.goto("/");
    await waitForApp(page);
    await page.locator("#globalSearchOpen").click();
    await expect(page.locator("#catalogSearch")).toBeVisible();
    await page.waitForTimeout(550);
    await resetCls(page);
    const query = String(catalog.title || catalog.id).trim().split(/\s+/)[0];
    await page.locator("#globalSearchInput").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, query);
    await expect(page.locator("#globalSearchResults")).not.toHaveClass(/\bhidden\b/);
    await expectStableCls(page, "progressive global search");
  });
});
