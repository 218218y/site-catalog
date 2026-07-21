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
const FAVORITES_WORKSPACE_CATALOGS = catalogData.slice(0, 2).map((catalog) => ({
  id: catalog.id,
  page: Math.min(2, Math.max(1, Number(catalog.pages) || 1))
}));
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
  const legacyViewerLayout = options.legacyViewerLayout === "side" ? "side" : "";
  const captureClipboard = options.captureClipboard === true;
  const captureShare = options.captureShare === true;
  const telemetryEvents = Array.isArray(options.telemetryEvents) ? options.telemetryEvents : null;
  const forceNoHoverMedia = options.forceNoHoverMedia === true;
  await page.addInitScript(({ onboardingKey, favoritesKey, viewerLayoutKey, onboardingSeen, resetFavorites, resetViewerLayout, legacyViewerLayout, captureClipboard, captureShare, enableTelemetry, forceNoHoverMedia }) => {
    if (forceNoHoverMedia) {
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (!/hover:\s*hover|pointer:\s*fine/i.test(String(query || ""))) return nativeMatchMedia(query);
        return {
          matches: false,
          media: String(query || ""),
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() { return false; }
        };
      };
    }
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
    if (legacyViewerLayout) localStorage.setItem(viewerLayoutKey, legacyViewerLayout);
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
    if (captureShare) {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (payload) => {
          window.__bargigE2eShare = { ...payload };
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
    legacyViewerLayout,
    captureClipboard,
    captureShare,
    enableTelemetry: Boolean(telemetryEvents),
    forceNoHoverMedia
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
  await page.goto(`/catalog/${CATALOG_ID}/page/${pageNumber}/`);
  await waitForApp(page);
  await expect(page.locator("#lightbox")).toBeVisible();
  await expectCurrentViewerImageReady(page);
}

async function currentViewerSurface(page) {
  return page.locator("#lightboxImageFrame");
}

async function expectCurrentViewerImageReady(page) {
  await expect.poll(async () => {
    const surface = await currentViewerSurface(page);
    return surface.getAttribute("class");
  }).toMatch(/image-ready/);
}

async function revealViewerTopToolbar(page) {
  const toolbarControl = page.locator("#lightboxCopyLink");
  const controlInViewport = await toolbarControl.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth;
  });

  if (!controlInViewport) {
    const hotspot = page.locator("#topHotspot");
    if (await hotspot.isVisible()) {
      const hasTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
      if (hasTouch) {
        // Exercise the real mobile input path. The toolbar opens on pointer-down
        // before its animation can move the hotspot behind the toolbar.
        await hotspot.tap();
      } else {
        await hotspot.press("Enter");
      }
    } else {
      await page.mouse.move(18, 4);
    }
  }

  // The shell can remain visible through hover/focus CSS after the transient
  // show-ui class has already cleared, so viewport visibility is the contract.
  await expect(toolbarControl).toBeInViewport();
}

async function expectViewerFrameCentered(page, options = {}) {
  const {
    tolerance = 1.5,
    horizontal = true,
    vertical = true
  } = options;
  await expect.poll(async () => (await currentViewerSurface(page)).evaluate((frame, axes) => {
    const rect = frame.getBoundingClientRect();
    const horizontalOffset = axes.horizontal
      ? Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2)
      : 0;
    const verticalOffset = axes.vertical
      ? Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2)
      : 0;
    return Math.max(horizontalOffset, verticalOffset);
  }, { horizontal, vertical })).toBeLessThanOrEqual(tolerance);
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

    await expect(page).toHaveURL(new RegExp(`/catalog/${CATALOG_ID}/page/1/$`));
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
    await expect(page).toHaveURL(new RegExp(`/catalog/${CATALOG_ID}/$`));
    await waitForApp(page);
    await expect(page.locator("#pageGrid .page-card")).toHaveCount(CATALOG_PAGES);

    await page.locator(`[data-open-page="${PREVIEW_PAGE}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/catalog/${CATALOG_ID}/page/${PREVIEW_PAGE}/$`));
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

    await expect(page).toHaveURL(/\/catalog\/[^/]+\/page\/\d+\/$/);
    await expect(page.locator("#lightbox")).toBeVisible();
  });

  test("offers direct Gmail, system sharing, email, and copying for an exact catalog page", async ({ page }) => {
    await preparePage(page, { captureClipboard: true, captureShare: true });
    const inquiryPage = Math.min(5, CATALOG_PAGES);
    await openDirectViewer(page, inquiryPage);

    await page.locator("#viewerInquiryButton").click();
    const dialog = page.locator("#viewerInquiryOverlay");
    await expect(dialog).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#viewerInquiryCatalog")).toHaveText(testCatalog.title);
    await expect(page.locator("#viewerInquiryPage")).toContainText(`עמוד ${inquiryPage}`);
    await expect(page.locator("#viewerInquiryMobile")).toHaveCount(0);
    await expect(page.locator("#viewerInquiryPhone")).toHaveCount(0);
    await expect(page.locator("#viewerInquiryActions .viewer-inquiry-action")).toHaveCount(4);

    const emailDetails = await page.locator("#viewerInquiryEmail").evaluate((link) => {
      const url = new URL(link.href);
      return {
        protocol: url.protocol,
        subject: url.searchParams.get("subject"),
        body: url.searchParams.get("body"),
        title: link.getAttribute("title"),
        tooltip: link.getAttribute("data-tooltip")
      };
    });
    expect(emailDetails.protocol).toBe("mailto:");
    expect(emailDetails.subject).toContain(testCatalog.title);
    expect(emailDetails.subject).toContain(`עמוד ${inquiryPage}`);
    expect(emailDetails.body).toContain(`קטלוג: ${testCatalog.title}`);
    expect(emailDetails.body).toContain(`עמוד: ${inquiryPage}`);
    expect(emailDetails.body).toContain(`/catalog/${CATALOG_ID}/page/${inquiryPage}/`);
    expect(emailDetails.title).toBeNull();
    expect(emailDetails.tooltip).toBeNull();
    const rawEmailHref = await page.locator("#viewerInquiryEmail").getAttribute("href");
    expect(rawEmailHref).toContain("%20");
    expect(rawEmailHref).not.toMatch(/[?&](?:subject|body)=[^&]*\+/);

    const gmailDetails = await page.locator("#viewerInquiryGmail").evaluate((link) => {
      const url = new URL(link.href);
      return {
        host: url.host,
        view: url.searchParams.get("view"),
        to: url.searchParams.get("to"),
        subject: url.searchParams.get("su"),
        body: url.searchParams.get("body"),
        title: link.getAttribute("title"),
        tooltip: link.getAttribute("data-tooltip")
      };
    });
    expect(gmailDetails.host).toBe("mail.google.com");
    expect(gmailDetails.view).toBe("cm");
    expect(gmailDetails.to).toContain("@");
    expect(gmailDetails.subject).toContain(testCatalog.title);
    expect(gmailDetails.body).toContain(`קטלוג: ${testCatalog.title}`);
    expect(gmailDetails.body).toContain(`עמוד: ${inquiryPage}`);
    expect(gmailDetails.body).toContain(`/catalog/${CATALOG_ID}/page/${inquiryPage}/`);
    expect(gmailDetails.title).toBeNull();
    expect(gmailDetails.tooltip).toBeNull();

    await page.locator("#viewerInquiryShare").click();
    await expect(dialog).toBeHidden();
    const shared = await page.evaluate(() => window.__bargigE2eShare || null);
    expect(shared?.title).toContain(testCatalog.title);
    expect(shared?.text).toContain(`קטלוג: ${testCatalog.title}`);
    expect(shared?.text).toContain(`עמוד: ${inquiryPage}`);
    expect(shared?.url).toContain(`/catalog/${CATALOG_ID}/page/${inquiryPage}/`);

    await page.locator("#viewerInquiryButton").click();
    await page.locator("#viewerInquiryCopy").click();
    await expect(dialog).toBeHidden();
    const copied = await page.evaluate(() => window.__bargigE2eClipboard || "");
    expect(copied).toContain(`קטלוג: ${testCatalog.title}`);
    expect(copied).toContain(`עמוד: ${inquiryPage}`);
    expect(copied).toContain(`/catalog/${CATALOG_ID}/page/${inquiryPage}/`);
  });

  test("persists a favorite through reload and shows it on the favorites page", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 3);

    await expect(page.locator("#lightboxFavoritesButton")).toBeHidden();
    await expect(page.locator("#lightboxFavoritesSeparator")).toBeHidden();
    await page.locator("#viewerFavoriteButton").click();
    await expect(page.locator("#viewerFavoriteButton")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#lightboxFavoritesButton")).toBeVisible();
    await expect(page.locator("#lightboxFavoritesSeparator")).toBeVisible();
    await expect(page.locator("#siteActionToast")).toContainText("נשמר");

    await page.reload();
    await waitForApp(page);
    await expect(page.locator("#viewerFavoriteButton")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#lightboxFavoritesButton")).toBeVisible();
    await expect(page.locator("#lightboxFavoritesSeparator")).toBeVisible();

    await page.goto("/favorites.html");
    await waitForApp(page);
    await expect(page.locator("#favoritesGrid .favorite-card")).toHaveCount(1);
  });

  test("re-enters the full paged catalog at the saved favorite instead of showing a blank frame", async ({ page }) => {
    await preparePage(page);
    await page.goto(`/catalog/${FAVORITE_CATALOG_TRANSITION_ID}/page/${FAVORITE_CATALOG_TRANSITION_PAGE}/`);
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
      `/catalog/${FAVORITE_CATALOG_TRANSITION_ID}/page/${FAVORITE_CATALOG_TRANSITION_PAGE}/[?]source=favorites$`
    ));
    await expect(page.locator("#lightbox")).toHaveClass(/favorites-viewer-mode/);
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);

    await page.locator("#favoriteOpenCatalogButton").click();

    await expect(page).toHaveURL(new RegExp(
      `/catalog/${FAVORITE_CATALOG_TRANSITION_ID}/page/${FAVORITE_CATALOG_TRANSITION_PAGE}/$`
    ));
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-paged/);
    await expect(page.locator("#lightbox")).not.toHaveClass(/favorites-viewer-mode/);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(FAVORITE_CATALOG_TRANSITION_PAGE));
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);
    await expect(page.locator("#lightboxImage")).toHaveAttribute(
      "src",
      new RegExp(`page-${String(FAVORITE_CATALOG_TRANSITION_PAGE).padStart(3, "0")}[.]webp`)
    );

    if (FAVORITE_CATALOG_TRANSITION_PAGE < FAVORITE_CATALOG_TRANSITION_PAGES) {
      const nextPage = FAVORITE_CATALOG_TRANSITION_PAGE + 1;
      await armPageSwapObservation(page.locator("#lightboxImageFrame"));
      await page.locator("#nextPageBtn").click();
      await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(nextPage));
      await expectCurrentViewerImageReady(page);
      await expectPageSwapObserved(page.locator("#lightboxImageFrame"));
      await expect(page.locator("#lightboxImage")).toHaveAttribute(
        "src",
        new RegExp(`page-${String(nextPage).padStart(3, "0")}[.]webp`)
      );
    }
  });

  test("supports a direct viewer link, shares the exact page, and returns home", async ({ page }) => {
    await preparePage(page, { captureClipboard: true });
    await openDirectViewer(page, 5);

    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("5");
    await expect(page.locator("#lightboxImage")).toHaveAttribute("src", /page-005\.webp/);

    await revealViewerTopToolbar(page);
    await page.locator("#lightboxCopyLink").click();
    await expect.poll(() => page.evaluate(() => window.__bargigE2eClipboard || "")).toContain(`/catalog/${CATALOG_ID}/page/5/`);
    await expect(page.locator("#siteActionToast")).toContainText("הקישור הועתק");

    await page.locator("#lightboxHomeLink").click();
    await expect(page).toHaveURL(/\/$/);
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
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "home");
    await expect(page.locator("#lightbox")).toBeHidden();
    await expect(page.locator("#fullscreenToggle")).toBeHidden();
    await expect(page.locator("#catalogs")).toBeVisible();
    await expect(page.locator("#catalogGrid .catalog-card")).toHaveCount(CATALOG_COUNT);

    await page.locator("[data-open-catalog-preview]").first().click();
    await expect(page).toHaveURL(new RegExp(`/catalog/${CATALOG_ID}/$`));
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

  test("starts in the single-image paged layout without a layout switch control", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(4, CATALOG_PAGES);
    await openDirectViewer(page, startPage);

    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-paged/);
    await expect(page.locator("#viewerLayoutToggle")).toHaveCount(0);
    await expect(page.locator("#viewerScrollPages")).toHaveCount(0);
    await expect(page.locator("#lightboxImageFrame")).toHaveClass(/image-ready/);
    await expect(page.locator("#stageCanvas #lightboxImage")).toHaveCount(1);

    if (startPage < CATALOG_PAGES) {
      await armPageSwapObservation(page.locator("#lightboxImageFrame"));
      await page.locator("#nextPageBtn").click();
      await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage + 1));
      await expectPageSwapObserved(page.locator("#lightboxImageFrame"));
    }

    await page.mouse.move(720, 1);
    await expect(page.locator("#lightboxBar")).toBeVisible();
    await page.locator("#fitWidthBtn").click();
    await expect(page.locator("#fitWidthBtn")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#lightbox")).toHaveClass(/viewer-layout-paged/);
    await expect(page.locator("#lightboxImageFrame")).toBeVisible();
  });

  test("preserves relative pan for explicit navigation and uses a fresh reading origin after edge scrolling", async ({ page }) => {
    await preparePage(page, { legacyViewerLayout: "side" });
    const startPage = Math.min(3, Math.max(1, CATALOG_PAGES - 2));
    await openDirectViewer(page, startPage);

    const lightbox = page.locator("#lightbox");
    const stage = page.locator("#stageCanvas");
    const frame = page.locator("#lightboxImageFrame");
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VIEWER_LAYOUT_KEY)).toBe("side");
    await expect(lightbox).toHaveClass(/viewer-layout-paged/);
    await expect(lightbox).not.toHaveClass(/viewer-scroll-zoom-isolated/);

    await frame.dblclick({ position: { x: 720, y: 450 } });
    await expect(page.locator("#viewerAutoZoomBtn")).toBeVisible();
    const initialZoom = await frame.evaluate((element) => Number.parseFloat(element.style.getPropertyValue("--single-zoom")) || 1);
    expect(initialZoom).toBeGreaterThan(1.5);

    await stage.evaluate((element) => {
      element.dispatchEvent(new WheelEvent("wheel", {
        deltaX: 70,
        deltaY: 90,
        deltaMode: 0,
        bubbles: true,
        cancelable: true
      }));
    });
    const explicitStart = await frame.evaluate((element) => ({
      x: Number.parseFloat(element.style.getPropertyValue("--single-pan-x")) || 0,
      y: Number.parseFloat(element.style.getPropertyValue("--single-pan-y")) || 0,
      zoom: Number.parseFloat(element.style.getPropertyValue("--single-zoom")) || 1
    }));
    expect(Math.abs(explicitStart.x) + Math.abs(explicitStart.y)).toBeGreaterThan(20);

    await page.locator("#nextPageBtn").click();
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage + 1));
    await expectCurrentViewerImageReady(page);
    await expect.poll(() => frame.evaluate((element, expected) => {
      const x = Number.parseFloat(element.style.getPropertyValue("--single-pan-x")) || 0;
      const y = Number.parseFloat(element.style.getPropertyValue("--single-pan-y")) || 0;
      const zoom = Number.parseFloat(element.style.getPropertyValue("--single-zoom")) || 1;
      return Math.max(Math.abs(x - expected.x), Math.abs(y - expected.y), Math.abs(zoom - expected.zoom));
    }, explicitStart)).toBeLessThanOrEqual(2);

    const edgeTarget = startPage + 2;
    const edgeDelta = await page.evaluate(() => {
      const stageElement = document.querySelector("#stageCanvas");
      const frameElement = document.querySelector("#lightboxImageFrame");
      if (!stageElement || !frameElement) throw new Error("Missing paged viewer geometry");
      const stageRect = stageElement.getBoundingClientRect();
      const frameRect = frameElement.getBoundingClientRect();
      const panY = Number.parseFloat(frameElement.style.getPropertyValue("--single-pan-y")) || 0;
      const overflowY = Math.max(0, (frameRect.height - stageRect.height) / 2);
      const buffer = Math.min(330, Math.max(144, stageRect.height * 0.36));
      return panY + overflowY + buffer + 48;
    });
    await stage.evaluate((element, deltaY) => {
      element.dispatchEvent(new WheelEvent("wheel", {
        deltaX: 0,
        deltaY,
        deltaMode: 0,
        bubbles: true,
        cancelable: true
      }));
    }, edgeDelta);

    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(edgeTarget));
    await expectCurrentViewerImageReady(page);
    await expect(lightbox).not.toHaveClass(/viewer-scroll-zoom-isolated/);
    await expect.poll(() => frame.evaluate((element, expectedZoom) => {
      const zoom = Number.parseFloat(element.style.getPropertyValue("--single-zoom")) || 1;
      return Math.abs(zoom - expectedZoom);
    }, initialZoom)).toBeLessThanOrEqual(0.01);
    await expect.poll(() => page.evaluate(() => {
      const stageRect = document.querySelector("#stageCanvas")?.getBoundingClientRect();
      const frameRect = document.querySelector("#lightboxImageFrame")?.getBoundingClientRect();
      if (!stageRect || !frameRect) return Number.POSITIVE_INFINITY;
      return Math.abs(frameRect.top - stageRect.top);
    })).toBeLessThanOrEqual(3);

    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage + 1));
    await expectCurrentViewerImageReady(page);
    await expect.poll(() => page.evaluate(() => {
      const stageRect = document.querySelector("#stageCanvas")?.getBoundingClientRect();
      const frameRect = document.querySelector("#lightboxImageFrame")?.getBoundingClientRect();
      if (!stageRect || !frameRect) return Number.POSITIVE_INFINITY;
      return Math.abs(frameRect.top - stageRect.top);
    })).toBeLessThanOrEqual(3);
  });

  test("toggles manual zoom with one double-click per gesture in paged layout", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, Math.min(4, CATALOG_PAGES));

    const lightbox = page.locator("#lightbox");
    const frame = page.locator("#lightboxImageFrame");
    await frame.dblclick({ position: { x: 220, y: 180 } });
    await expect(page.locator("#viewerAutoZoomBtn")).toBeVisible();
    await expect(lightbox).toHaveClass(/is-zoomed/);
    await expect(lightbox).not.toHaveClass(/viewer-scroll-zoom-isolated/);

    await frame.dblclick({ position: { x: 720, y: 450 } });
    await expect(page.locator("#viewerAutoZoomBtn")).toBeHidden();
  });

  test("lands on the final requested page for repeated vertical keyboard commands", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(2, Math.max(1, CATALOG_PAGES - 4));
    await openDirectViewer(page, startPage);

    const forwardSteps = Math.min(3, CATALOG_PAGES - startPage);
    for (let index = 0; index < forwardSteps; index += 1) {
      await page.evaluate((repeat) => {
        window.dispatchEvent(new KeyboardEvent("keydown", {
          key: "ArrowDown",
          repeat,
          bubbles: true,
          cancelable: true
        }));
      }, index > 0);
    }
    const forwardPage = startPage + forwardSteps;
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(forwardPage));
    await expectCurrentViewerImageReady(page);
    await expect(page.locator("#lightboxImage")).toHaveAttribute(
      "src",
      new RegExp(`page-${String(forwardPage).padStart(3, "0")}[.]webp`)
    );

    const backwardSteps = Math.min(2, forwardPage - 1);
    for (let index = 0; index < backwardSteps; index += 1) {
      await page.evaluate((repeat) => {
        window.dispatchEvent(new KeyboardEvent("keydown", {
          key: "ArrowUp",
          repeat,
          bubbles: true,
          cancelable: true
        }));
      }, index > 0);
    }
    const backwardPage = forwardPage - backwardSteps;
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(backwardPage));
    await expectCurrentViewerImageReady(page);
  });

  test("opens the page rail from real mouse input on hybrid devices", async ({ page }) => {
    await preparePage(page, { forceNoHoverMedia: true });
    await openDirectViewer(page, Math.min(2, CATALOG_PAGES));

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    await page.mouse.move(viewport.width - 32, 120);

    await expect(page.locator("#lightbox")).toHaveClass(/show-page-rail/);
    await expect(page.locator("#lightboxPageRail")).toBeInViewport();

    await page.locator("html").dispatchEvent("mouseout", {
      clientX: viewport.width,
      clientY: 120,
      relatedTarget: null,
      bubbles: true
    });
    await expect(page.locator("#lightbox")).toHaveClass(/show-page-rail/);
  });

  test("reserves a touch-safe right edge beside the navigation arrow", async ({ page }) => {
    await preparePage(page);
    const startingPage = Math.min(2, CATALOG_PAGES);
    await openDirectViewer(page, startingPage);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const edgeLayout = await page.evaluate(() => {
      const hotspotRect = document.querySelector("#lightboxSideHotspot")?.getBoundingClientRect();
      const rightNavigationRect = document.querySelector("#prevPageBtn")?.getBoundingClientRect();
      if (!hotspotRect || !rightNavigationRect) throw new Error("Viewer edge controls are unavailable");
      return {
        hotspotWidth: hotspotRect.width,
        gapToNavigation: hotspotRect.left - rightNavigationRect.right
      };
    });
    expect(edgeLayout.hotspotWidth).toBeCloseTo(40, 1);
    expect(edgeLayout.gapToNavigation).toBeGreaterThanOrEqual(3.5);

    const activationPoint = { x: viewport.width - 26, y: Math.round(viewport.height / 2) };

    const hitTarget = await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return target?.closest?.("#lightboxSideHotspot, #prevPageBtn, #nextPageBtn")?.id || target?.id || target?.className || "";
    }, activationPoint);
    expect(hitTarget).toBe("lightboxSideHotspot");

    await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      if (!target) throw new Error("No touch target at the viewer edge");
      target.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId: 91,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      }));
      target.dispatchEvent(new PointerEvent("pointerup", {
        pointerId: 91,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      }));
    }, activationPoint);

    await expect(page.locator("#lightbox")).toHaveClass(/show-page-rail/);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startingPage));
  });

  test("normalizes mouse-wheel and precision-touchpad streams through one paged path", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(3, Math.max(1, CATALOG_PAGES - 6));
    await openDirectViewer(page, startPage);

    const stage = page.locator("#stageCanvas");
    const dispatchWheelStream = (deltas, deltaMode = 0) => stage.evaluate((element, payload) => {
      let everyEventCanceled = true;
      payload.deltas.forEach((deltaY) => {
        const event = new WheelEvent("wheel", {
          deltaX: 0,
          deltaY,
          deltaMode: payload.deltaMode,
          bubbles: true,
          cancelable: true
        });
        everyEventCanceled = !element.dispatchEvent(event) && everyEventCanceled;
      });
      return everyEventCanceled;
    }, { deltas, deltaMode });
    const settleWheelGesture = () => page.waitForTimeout(180);

    expect(await dispatchWheelStream([19])).toBe(true);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await settleWheelGesture();

    const firstPageTarget = Math.min(CATALOG_PAGES, startPage + 1);
    expect(await dispatchWheelStream([10, 10])).toBe(true);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(firstPageTarget));
    await settleWheelGesture();

    await dispatchWheelStream([-20]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await settleWheelGesture();

    const twoPageTarget = Math.min(CATALOG_PAGES, startPage + 2);
    await dispatchWheelStream([200]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(twoPageTarget));
    await settleWheelGesture();

    await dispatchWheelStream([-200]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await settleWheelGesture();

    const lineModeTarget = Math.min(CATALOG_PAGES, startPage + 1);
    await dispatchWheelStream([3], 1);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(lineModeTarget));
    await settleWheelGesture();

    const repeatedTarget = Math.min(CATALOG_PAGES, lineModeTarget + 3);
    await dispatchWheelStream([100, 100, 100]);
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(repeatedTarget));
    await expectCurrentViewerImageReady(page);
  });

  test("keeps paged-viewer boundary navigation stationary", async ({ page }) => {
    await preparePage(page);
    await openDirectViewer(page, 1);

    const frame = page.locator("#lightboxImageFrame");
    const firstTransform = await frame.evaluate((element) => element.style.transform);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("1");
    await expect.poll(() => frame.evaluate((element) => element.style.transform)).toBe(firstTransform);

    await page.keyboard.press("End");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(CATALOG_PAGES));
    await expectCurrentViewerImageReady(page);
    const lastSrc = await page.locator("#lightboxImage").getAttribute("src");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(CATALOG_PAGES));
    await expect(page.locator("#lightboxImage")).toHaveAttribute("src", lastSrc || "");
  });

  test("supports PageUp, PageDown, and horizontal and vertical touch swipes", async ({ page }) => {
    await preparePage(page);
    const startPage = Math.min(2, Math.max(1, CATALOG_PAGES - 2));
    await openDirectViewer(page, startPage);

    await page.keyboard.press("PageDown");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage + 1));
    await page.keyboard.press("PageUp");
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));

    const stage = page.locator("#stageCanvas");
    const frame = page.locator("#lightboxImageFrame");
    await armPageSwapObservation(frame);
    await stage.dispatchEvent("pointerdown", {
      pointerId: 71,
      pointerType: "touch",
      isPrimary: true,
      clientX: 280,
      clientY: 430,
      bubbles: true,
      cancelable: true
    });
    await stage.dispatchEvent("pointerup", {
      pointerId: 71,
      pointerType: "touch",
      isPrimary: true,
      clientX: 390,
      clientY: 438,
      bubbles: true,
      cancelable: true
    });
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage + 1));
    await expectPageSwapObserved(frame);

    await armPageSwapObservation(frame);
    await stage.dispatchEvent("pointerdown", {
      pointerId: 72,
      pointerType: "touch",
      isPrimary: true,
      clientX: 360,
      clientY: 300,
      bubbles: true,
      cancelable: true
    });
    await stage.dispatchEvent("pointerup", {
      pointerId: 72,
      pointerType: "touch",
      isPrimary: true,
      clientX: 355,
      clientY: 420,
      bubbles: true,
      cancelable: true
    });
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText(String(startPage));
    await expectPageSwapObserved(frame);
  });

  test("falls back to the thumbnail when a full catalog image fails", async ({ page }) => {
    await preparePage(page, { failPages: [2] });
    await page.goto(`/catalog/${CATALOG_ID}/page/2/`);
    await waitForApp(page);

    const frame = page.locator("#lightboxImageFrame");
    await expect(frame).toHaveClass(/image-ready/);
    await expect(frame).toHaveClass(/image-fallback/);
    await expect(page.locator("#viewerImageFeedback")).toContainText("מוצגת חלופה מוקטנת");
    await expect(page.locator("#viewerImageRetry")).toBeVisible();
    await expect(page.locator("#viewerLoading")).toBeHidden();
    await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("2");
  });

  test("shows the first-run viewer tour once and remembers dismissal", async ({ page }) => {
    await preparePage(page, { onboardingSeen: false });
    await openDirectViewer(page, 1);

    const tour = page.locator("#viewerOnboarding");
    await expect(tour).toHaveAttribute("aria-hidden", "false");
    await expect(tour).toHaveClass(/layout-ready/);
    await expect(page.locator("#viewerOnboardingCounter")).toHaveText("1 מתוך 3");
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
    await preparePage(page, { telemetryEvents: events, captureClipboard: true });
    await page.goto("/index.html");
    await waitForApp(page);

    await page.locator("#globalSearchOpen").click();
    await page.locator("#globalSearchInput").fill("פתיחת");
    const firstSearchResult = page.locator("#globalSearchResults [data-search-catalog]").first();
    await expect(firstSearchResult).toBeVisible();
    const openedCatalogId = await firstSearchResult.getAttribute("data-search-catalog");
    expect(openedCatalogId).toBeTruthy();
    await page.waitForTimeout(1100);
    expect(events.filter((event) => event.name === "search")).toHaveLength(0);
    await firstSearchResult.click();
    await expectCurrentViewerImageReady(page);
    await expect.poll(() => events.filter((event) => event.name === "search").length, { timeout: 3500 }).toBe(1);
    const completedSearch = events.find((event) => event.name === "search");
    expect(completedSearch.action).toBe("result-open");
    expect(completedSearch.query).toBe("פתיחת");

    await page.locator("#viewerFavoriteButton").click();
    await page.locator("#viewerInquiryButton").click();
    await page.locator("#viewerInquiryCopy").click();
    await expect(page.locator("#viewerInquiryOverlay")).toBeHidden();
    await expect.poll(
      () => events.some((event) => event.name === "contact" && event.action === "copy"),
      { timeout: 3500 }
    ).toBe(true);

    const names = events.map((event) => event.name);
    expect(names).toContain("search");
    expect(names).toContain("catalog_open");
    expect(names).toContain("favorite");
    expect(names).toContain("contact");
    const inquiryContact = events.find((event) => event.name === "contact" && event.action === "copy");
    expect(inquiryContact?.source).toBe("viewer-inquiry");
    expect(inquiryContact?.catalogId).toBe(openedCatalogId);
    expect(inquiryContact?.pageNumber).toBeGreaterThanOrEqual(1);
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
  await expect(consumer.locator("#favoritesVisibleCount")).toHaveText("2 פריטים");
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



test("favorites workspace supports notes, ordering, filtering, focused sharing, and the shared inquiry dialog", async ({ page, browser }) => {
  test.skip(FAVORITES_WORKSPACE_CATALOGS.length < 2, "E2E requires at least two catalogs for filtering.");
  const items = [
    { catalogId: FAVORITES_WORKSPACE_CATALOGS[0].id, page: 1, savedAt: 30 },
    { catalogId: FAVORITES_WORKSPACE_CATALOGS[1].id, page: FAVORITES_WORKSPACE_CATALOGS[1].page, savedAt: 20 },
    { catalogId: FAVORITES_WORKSPACE_CATALOGS[0].id, page: FAVORITES_WORKSPACE_CATALOGS[0].page, savedAt: 10 }
  ];
  await preparePage(page, { resetFavorites: false, captureClipboard: true, captureShare: true });
  await page.addInitScript(({ key, favorites }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, items: favorites }));
  }, { key: FAVORITES_KEY, favorites: items });
  await page.goto("/favorites.html");
  await waitForApp(page);

  await expect(page.locator("#favoritesGrid .favorite-card")).toHaveCount(3);
  await expect(page.locator("#favoritesCatalogFilter option").first()).toHaveText("כל הקטלוגים");
  await expect(page.locator("#favoritesVisibleCount")).toHaveText("3 פריטים");
  const favoritesInquiryButton = page.locator("#favoritesInquiryButton");
  await expect(favoritesInquiryButton).toBeVisible();
  await expect(page.locator("#favoritesInquiryLabel")).toHaveText("בירור על הדגמים");
  const floatingInquiryStyle = await favoritesInquiryButton.evaluate((button) => {
    const style = getComputedStyle(button);
    return { position: style.position, left: style.left, bottom: style.bottom };
  });
  expect(floatingInquiryStyle.position).toBe("fixed");
  expect(parseFloat(floatingInquiryStyle.left)).toBeGreaterThanOrEqual(0);
  expect(parseFloat(floatingInquiryStyle.bottom)).toBeGreaterThanOrEqual(0);
  const favoritesGridBottomPadding = await page.locator("#favoritesGrid").evaluate((grid) => parseFloat(getComputedStyle(grid).paddingBottom));
  expect(favoritesGridBottomPadding).toBeLessThan(60);
  const firstCard = page.locator("#favoritesGrid .favorite-card").first();
  await expect(firstCard.locator(".favorite-note-summary")).toHaveCount(0);
  await firstCard.locator("[data-edit-favorite-note]").click();
  await page.locator("#favoriteNoteInput").fill("לבדוק ברוחב 180");
  await page.locator("#favoriteNoteSave").click();
  await expect(firstCard.locator(".favorite-note-text")).toContainText("לבדוק ברוחב 180");

  await page.locator("#favoritesInquiryButton").click();
  await expect(page.locator("#viewerInquiryOverlay")).toBeVisible();
  await expect(page.locator("#viewerInquiryTitle")).toHaveText("בירור על הדגמים");
  await expect(page.locator("#viewerInquiryActions .viewer-inquiry-action")).toHaveCount(4);
  const allItemsGmailHref = await page.locator("#viewerInquiryGmail").getAttribute("href");
  const allItemsBody = new URL(allItemsGmailHref).searchParams.get("body") || "";
  expect(allItemsBody).toContain("לבדוק ברוחב 180");
  expect(allItemsBody).toContain("קישור לרשימת הדגמים:");
  expect((allItemsBody.match(/https?:\/\//g) || []).length).toBe(4);
  const allItemsMailtoHref = await page.locator("#viewerInquiryEmail").getAttribute("href");
  expect(allItemsMailtoHref).toContain("%20");
  expect(allItemsMailtoHref).not.toMatch(/[?&](?:subject|body)=[^&]*\+/);
  await page.locator("#viewerInquiryClose").click();
  await expect(page.locator("#viewerInquiryOverlay")).toBeHidden();

  await page.locator("#favoritesGrid [data-select-favorite]").nth(0).check();
  await page.locator("#favoritesGrid [data-select-favorite]").nth(1).check();
  await expect(page.locator("#favoritesSelectionCount")).toHaveText("2");
  await expect(page.locator("#favoritesShareLabel")).toHaveText("שיתוף הבחירה");
  await expect(page.locator("#favoritesInquiryLabel")).toHaveText("בירור על הדגמים שנבחרו");

  await page.locator("#favoritesInquiryButton").click();
  await expect(page.locator("#viewerInquiryTitle")).toHaveText("בירור על הדגמים שנבחרו");
  const selectedGmailHref = await page.locator("#viewerInquiryGmail").getAttribute("href");
  const selectedBody = new URL(selectedGmailHref).searchParams.get("body") || "";
  expect(selectedBody).toContain("לבדוק ברוחב 180");
  expect((selectedBody.match(/https?:\/\//g) || []).length).toBe(3);
  await page.evaluate(() => { window.__bargigE2eClipboard = ""; });
  await page.locator("#viewerInquiryCopy").click();
  await expect.poll(() => page.evaluate(() => window.__bargigE2eClipboard || "")).toContain("לבדוק ברוחב 180");
  const copiedInquiry = await page.evaluate(() => window.__bargigE2eClipboard || "");
  expect((copiedInquiry.match(/https?:\/\//g) || []).length).toBe(3);
  await expect(page.locator("#viewerInquiryOverlay")).toBeHidden();

  await page.evaluate(() => { window.__bargigE2eClipboard = ""; });
  await page.locator("#favoritesShareButton").click();
  await expect.poll(() => page.evaluate(() => window.__bargigE2eClipboard || "")).not.toBe("");
  const copiedSelectionUrl = await page.evaluate(() => window.__bargigE2eClipboard || "");
  expect(copiedSelectionUrl).toContain("favorites.html?selection=");
  expect(copiedSelectionUrl).not.toContain("לבדוק ברוחב 180");
  expect(await page.evaluate(() => window.__bargigE2eShare || null)).toBeNull();

  const firstIdentityBefore = await page.locator("#favoritesGrid .favorite-card").first().evaluate((card) => `${card.dataset.favoriteCatalog}:${card.dataset.favoritePage}`);
  await page.locator("#favoritesGrid .favorite-card").first().locator('[data-move-favorite="1"]').click();
  const secondIdentityAfter = await page.locator("#favoritesGrid .favorite-card").nth(1).evaluate((card) => `${card.dataset.favoriteCatalog}:${card.dataset.favoritePage}`);
  expect(secondIdentityAfter).toBe(firstIdentityBefore);

  await page.locator("#favoritesClearSelection").click();
  await page.locator("#favoritesCatalogFilter").selectOption(FAVORITES_WORKSPACE_CATALOGS[1].id);
  await expect(page.locator("#favoritesGrid .favorite-card")).toHaveCount(1);
  await expect(page.locator("#favoritesVisibleCount")).toContainText("1 מתוך 3");
  await expect(page.locator("#favoritesInquiryLabel")).toHaveText("בירור על הדגמים");
  await page.locator("#favoritesInquiryButton").click();
  const filteredDefaultGmailHref = await page.locator("#viewerInquiryGmail").getAttribute("href");
  const filteredDefaultBody = new URL(filteredDefaultGmailHref).searchParams.get("body") || "";
  expect((filteredDefaultBody.match(/https?:\/\//g) || []).length).toBe(4);
  await page.locator("#viewerInquiryClose").click();

  await page.evaluate(() => { window.__bargigE2eClipboard = ""; });
  await page.locator("#favoritesShareButton").click();
  await expect.poll(() => page.evaluate(() => window.__bargigE2eClipboard || "")).not.toBe("");
  const copiedFullListUrl = await page.evaluate(() => window.__bargigE2eClipboard || "");
  expect(copiedFullListUrl).toContain("favorites.html?selection=");

  const sharedListContext = await browser.newContext({
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem"
  });
  try {
    const sharedListPage = await sharedListContext.newPage();
    const sharedListErrors = monitorRuntimeErrors(sharedListPage);
    await preparePage(sharedListPage, { resetFavorites: true });
    await sharedListPage.goto(copiedFullListUrl);
    await waitForApp(sharedListPage);
    await expect(sharedListPage.locator("#favoritesGrid .favorite-card")).toHaveCount(3);
    const importedIdentities = await sharedListPage.locator("#favoritesGrid .favorite-card").evaluateAll((cards) => (
      cards.map((card) => `${card.dataset.favoriteCatalog}:${card.dataset.favoritePage}`).sort()
    ));
    const expectedIdentities = items.map((item) => `${item.catalogId}:${item.page}`).sort();
    expect(importedIdentities).toEqual(expectedIdentities);
    expect(sharedListErrors, "Shared favorites context runtime errors").toEqual([]);
  } finally {
    await sharedListContext.close();
  }
});

test("viewer toolbar keeps desktop controls separated until the mobile breakpoint", async ({ page }) => {
  await preparePage(page);
  await page.setViewportSize({ width: 1050, height: 720 });
  await openDirectViewer(page);

  for (const width of [1050, 960, 844, 800, 761]) {
    await page.setViewportSize({ width, height: 720 });
    await page.evaluate(() => document.querySelector("#lightbox")?.classList.add("show-ui"));
    await expect(page.locator("#lightboxBar")).toBeInViewport();

    await expect(page.locator("#lightboxPinTopBar")).toBeVisible();
    await expect(page.locator("#lightboxCatalogMenuToggle")).toBeVisible();
    await expect(page.locator("#viewerMobileMoreToggle")).toBeHidden();

    await expect.poll(() => page.evaluate(() => {
      const pin = document.querySelector("#lightboxPinTopBar")?.getBoundingClientRect();
      const catalogToggle = document.querySelector("#lightboxCatalogMenuToggle")?.getBoundingClientRect();
      if (!pin || !catalogToggle) return -Infinity;
      return Math.max(pin.left - catalogToggle.right, catalogToggle.left - pin.right);
    })).toBeGreaterThanOrEqual(8);

    await expect.poll(() => page.evaluate(() => {
      const brandActions = document.querySelector(".lightbox-brand-actions");
      if (!brandActions) return Infinity;
      return brandActions.scrollWidth - brandActions.clientWidth;
    })).toBeLessThanOrEqual(1);

    await expect.poll(() => page.evaluate(() => {
      const search = document.querySelector(".lightbox-search")?.getBoundingClientRect();
      if (!search) return Infinity;
      return Math.abs((search.left + search.width / 2) - window.innerWidth / 2);
    })).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 760, height: 720 });
  await expect(page.locator("#lightboxPinTopBar")).toBeHidden();
  await expect(page.locator("#lightboxCatalogMenuToggle")).toBeHidden();
  await expect(page.locator("#viewerMobileMoreToggle")).toBeVisible();

  // The top-edge opener is a real control, so keyboard-only users have the
  // same reliable path as touch and hover users after the toolbar retracts.
  await page.mouse.move(380, 360);
  await expect(page.locator("#lightbox")).not.toHaveClass(/show-ui/);
  await page.locator("#topHotspot").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#lightbox")).toHaveClass(/show-ui/);
  await expect(page.locator("#lightboxBar")).toBeInViewport();
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
  await expect(page).toHaveURL(new RegExp(`/catalog/${CATALOG_ID}/page/1/$`));
  await expectCurrentViewerImageReady(page);
  // Fit-width deliberately starts a portrait page at its top edge so the reader
  // can scroll through it naturally. Only the fitted horizontal axis should be
  // centered; requiring vertical centering would hide the beginning of the page.
  await expectViewerFrameCentered(page, { vertical: false });
  await expect(page.locator("#lightbox")).toHaveClass(/fit-width/);
  await expect(page.locator('[data-viewer-mobile-action="fit-auto"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-viewer-mobile-action="fit-width"]')).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#viewerMobileMoreToggle")).toBeVisible();
  await expect(page.locator("#lightboxScreenshot")).toBeHidden();
  await expect(page.locator("#lightboxPinTopBar")).toBeHidden();
  await expect(page.locator("#fitHeightBtn")).toBeHidden();
  await page.locator("#viewerMobileMoreToggle").click();
  await expect(page.locator("#viewerMobileMoreMenu")).toBeVisible();
  await expect(page.locator('[data-viewer-mobile-action="download"]')).toBeVisible();
  await expect(page.locator('[data-viewer-mobile-action="fit-auto"]')).toBeVisible();
  await expect(page.locator('[data-viewer-mobile-action="fit-width"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#viewerMobileMoreMenu")).toBeHidden();
  await page.locator("#nextPageBtn").click();
  await expect(page.locator("#viewerPageIndicatorCurrent")).toHaveText("2");

  await page.setViewportSize({ width: 844, height: 390 });
  await expectViewerFrameCentered(page);
  await expect(page.locator("#lightbox")).toHaveClass(/fit-height/);
  await expect(page.locator("#fitAutoBtn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#fitHeightBtn")).toHaveAttribute("aria-pressed", "false");

  await revealViewerTopToolbar(page);
  await expect(page.locator("#fitWidthBtn")).toBeInViewport();
  await page.locator("#fitWidthBtn").click();
  await expect(page.locator("#lightbox")).toHaveClass(/fit-width/);

  // An explicit user choice owns the fit mode for the rest of this viewer
  // session, even when a hybrid/touch device changes orientation repeatedly.
  await expect(page.locator("#fitAutoBtn")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#fitWidthBtn")).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#lightbox")).toHaveClass(/fit-width/);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#lightbox")).toHaveClass(/fit-width/);

  // The new automatic control explicitly returns ownership to the viewport
  // policy and resumes orientation-driven changes immediately.
  await revealViewerTopToolbar(page);
  await expect(page.locator("#fitAutoBtn")).toBeInViewport();
  await page.locator("#fitAutoBtn").click();
  await expect(page.locator("#fitAutoBtn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#fitWidthBtn")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#lightbox")).toHaveClass(/fit-height/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#lightbox")).toHaveClass(/fit-width/);
  await expect(page.locator("#fitAutoBtn")).toHaveAttribute("aria-pressed", "true");

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
