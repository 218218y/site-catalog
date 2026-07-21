"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const COMPARE_CANONICAL_SCREENSHOTS = process.platform === "linux" && process.env.PLAYWRIGHT_VISUAL_BASELINE === "1";

const ROOT = path.join(__dirname, "..", "..");
const STYLES = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const PLACEHOLDER_IMAGE = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820" viewBox="0 0 1200 820">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f2e9df"/>
      <stop offset="1" stop-color="#d9c5b2"/>
    </linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#987359"/>
      <stop offset="1" stop-color="#6f513d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="820" fill="url(#bg)"/>
  <rect x="118" y="106" width="964" height="590" rx="34" fill="#fbf8f4" opacity=".92"/>
  <rect x="252" y="226" width="696" height="330" rx="24" fill="url(#wood)"/>
  <rect x="292" y="266" width="196" height="250" rx="15" fill="#d8c1aa"/>
  <rect x="502" y="266" width="196" height="250" rx="15" fill="#cbb097"/>
  <rect x="712" y="266" width="196" height="250" rx="15" fill="#d8c1aa"/>
  <circle cx="472" cy="391" r="8" fill="#5d4434"/>
  <circle cx="682" cy="391" r="8" fill="#5d4434"/>
  <path d="M190 644h820" stroke="#9b7b62" stroke-width="9" stroke-linecap="round" opacity=".42"/>
</svg>`).toString("base64")}`;

const ICONS = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.4 12 12.7l8.5-6.3M4.8 5.2h14.4a1.7 1.7 0 0 1 1.7 1.7v10.2a1.7 1.7 0 0 1-1.7 1.7H4.8a1.7 1.7 0 0 1-1.7-1.7V6.9a1.7 1.7 0 0 1 1.7-1.7Z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8.2a3.1 3.1 0 1 0-2.94-4.08L8.87 7.56a3.1 3.1 0 1 0 0 4.88l6.19 3.44A3.1 3.1 0 1 0 16 14.2l-6.2-3.45a3.2 3.2 0 0 0 0-1.5L16 5.8A3.1 3.1 0 0 0 18 8.2Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.2V5.8A2.3 2.3 0 0 1 10.3 3.5h7.9a2.3 2.3 0 0 1 2.3 2.3v7.9a2.3 2.3 0 0 1-2.3 2.3h-1.4M5.8 8h7.9a2.3 2.3 0 0 1 2.3 2.3v7.9a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3v-7.9A2.3 2.3 0 0 1 5.8 8Z"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h14v12H9l-4 3v-15Z"/><path d="M8 8h8M8 11.5h5"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9v4.5M12 16.8h.01"/></svg>'
};

function fixtureDocument(body, options = {}) {
  const bodyAttributes = options.bodyAttributes || 'data-page="home"';
  const extraCss = options.extraCss || "";
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${STYLES}</style>
  <style>
    html, body { min-height: 100%; }
    body { margin: 0; }
    *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
    .visual-fixture { width: min(1120px, calc(100vw - 48px)); margin: 24px auto; }
    .visual-fixture img { object-fit: cover; }
    ${extraCss}
  </style>
</head>
<body ${bodyAttributes}>${body}</body>
</html>`;
}

async function renderFixture(page, body, options = {}) {
  await page.setViewportSize(options.viewport || { width: 1280, height: 900 });
  await page.setContent(fixtureDocument(body, options), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts?.ready);
}

async function expectVisualComponent(locator, snapshotName, size) {
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  expect(box, `${snapshotName}: component has no layout box`).not.toBeNull();
  expect(Math.abs(Math.round(box.width) - size.width), `${snapshotName}: unexpected width`).toBeLessThanOrEqual(size.widthTolerance ?? 2);
  expect(Math.round(box.height), `${snapshotName}: component is too short`).toBeGreaterThanOrEqual(size.minHeight);
  expect(Math.round(box.height), `${snapshotName}: component is too tall`).toBeLessThanOrEqual(size.maxHeight);

  const overflow = await locator.evaluate((element) => ({
    horizontal: element.scrollWidth - element.clientWidth,
    vertical: element.scrollHeight - element.clientHeight
  }));
  expect(overflow.horizontal, `${snapshotName}: content is clipped horizontally`).toBeLessThanOrEqual(1);
  expect(overflow.vertical, `${snapshotName}: content is clipped vertically`).toBeLessThanOrEqual(1);

  // Pixel baselines are intentionally canonicalized to the Linux Chromium
  // environment used by GitHub Actions. Font metrics and anti-aliasing differ
  // on Windows even when the DOM and CSS are identical, so local runs retain
  // structural/layout coverage without comparing Linux-generated pixels.
  if (COMPARE_CANONICAL_SCREENSHOTS) {
    await expect(locator).toHaveScreenshot(snapshotName);
  }
}

function catalogCard(title, description, pages, priority = false) {
  return `<article class="catalog-card seo-catalog-card">
    <a class="catalog-cover-frame" href="#" aria-label="פתיחת ${title}">
      <img src="${PLACEHOLDER_IMAGE}" alt="שער ${title}" width="1200" height="820" loading="${priority ? "eager" : "lazy"}" decoding="async" fetchpriority="${priority ? "high" : "low"}" />
      <span class="catalog-page-count">${pages} עמודים</span>
    </a>
    <div class="catalog-card-body">
      <h3><a href="#">${title}</a></h3>
      <p>${description}</p>
      <a class="button soft seo-catalog-open" href="#">לצפייה בקטלוג</a>
    </div>
  </article>`;
}

function favoriteCard(title, page, note, selected = false) {
  return `<article class="favorite-card${selected ? " is-selected" : ""}" data-favorite-catalog="fixture" data-favorite-page="${page}">
    <label class="favorite-select-control">
      <input type="checkbox" ${selected ? "checked" : ""} aria-label="סימון ${title}, עמוד ${page}" />
      <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6.5 12.4 3.3 3.3 7.7-8"/></svg></span>
    </label>
    <button class="favorite-remove-button" type="button" aria-label="הסרה">${ICONS.close}</button>
    <button class="favorite-preview-button" type="button">
      <span class="favorite-image-frame catalog-image-frame" style="--page-aspect:1200 / 820">
        <img src="${PLACEHOLDER_IMAGE}" alt="${title}" width="1200" height="820" />
      </span>
      <span class="favorite-card-meta"><strong>${title}</strong><span>עמוד ${page}</span></span>
    </button>
    ${note ? `<div class="favorite-note-summary"><span class="favorite-note-label">הערה</span><span class="favorite-note-text">${note}</span></div>` : ""}
    <div class="favorite-card-actions">
      <button class="favorite-card-action favorite-note-button" type="button">${ICONS.note}<span>${note ? "עריכת ההערה" : "הוספת הערה"}</span></button>
      <div class="favorite-order-controls" aria-label="שינוי סדר הפריט">
        <button class="favorite-order-button" type="button" aria-label="העברה למעלה"><svg viewBox="0 0 24 24"><path d="m7 14 5-5 5 5"/></svg></button>
        <button class="favorite-drag-handle" type="button" aria-label="גרירה"><svg viewBox="0 0 24 24"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg></button>
        <button class="favorite-order-button" type="button" aria-label="העברה למטה"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button>
      </div>
    </div>
  </article>`;
}

test.describe("visual component regression", () => {
  test("home catalog row preserves hierarchy and spacing", async ({ page }) => {
    await renderFixture(page, `<main class="visual-fixture">
      <section class="catalogs-section panel reveal in-view" id="catalogs" aria-label="קטלוגים">
        <div class="catalog-category-list">
          <section class="catalog-category-section">
            <div class="catalog-category-heading">
              <h2><a href="#">ארונות פתיחה</a></h2>
              <a class="catalog-category-all-link" href="#">לכל הקטלוגים בקטגוריה</a>
            </div>
            <div class="catalog-grid">
              ${catalogCard("ארונות פתיחה פרדי 2026", "ארונות פתיחה בעיצוב נקי ועדכני", 82, true)}
              ${catalogCard("ארונות פתיחה ר.א. 2026", "מבחר פתרונות אחסון במידות מגוונות", 64, true)}
              ${catalogCard("ארונות פתיחה קלאסיק", "דגמים קלאסיים בהתאמה לחדר", 48)}
            </div>
          </section>
        </div>
      </section>
    </main>`, { viewport: { width: 1280, height: 860 } });

    await expectVisualComponent(page.locator("#catalogs"), "home-catalog-row.png", { width: 1044, minHeight: 490, maxHeight: 515 });
  });

  test("inquiry dialog retains the light visual system", async ({ page }) => {
    await renderFixture(page, `<div class="viewer-inquiry-overlay visible" aria-hidden="false">
      <div class="viewer-inquiry-backdrop"></div>
      <section class="viewer-inquiry-dialog" role="dialog" aria-modal="true">
        <button class="viewer-inquiry-close" type="button" aria-label="סגירה">×</button>
        <div class="viewer-inquiry-heading">
          <span>פרטי העמוד מצורפים אוטומטית</span>
          <h2>בירור על הדגם</h2>
          <p>שם הקטלוג, מספר העמוד והקישור המדויק מוכנים מראש.</p>
        </div>
        <div class="viewer-inquiry-reference">
          <span class="viewer-inquiry-preview-frame catalog-image-frame"><img src="${PLACEHOLDER_IMAGE}" alt="" width="1200" height="820" /></span>
          <div class="viewer-inquiry-reference-copy"><strong>ארונות פתיחה פרדי 2026</strong><span>עמוד 43</span></div>
        </div>
        <div class="viewer-inquiry-actions">
          <a class="viewer-inquiry-action primary" href="#">${ICONS.mail}<strong>שליחה דרך Gmail</strong></a>
          <a class="viewer-inquiry-action" href="#">${ICONS.mail}<strong>פתיחה בתוכנת דואר</strong></a>
          <button class="viewer-inquiry-action" type="button">${ICONS.share}<strong>שיתוף פרטי הדגם</strong></button>
          <button class="viewer-inquiry-action" type="button">${ICONS.copy}<strong>העתקת ההודעה והקישור</strong></button>
        </div>
      </section>
    </div>`, {
      bodyAttributes: 'data-page="viewer"',
      viewport: { width: 1100, height: 820 },
      extraCss: ".viewer-inquiry-overlay { position: fixed; }"
    });

    await expectVisualComponent(page.locator(".viewer-inquiry-dialog"), "inquiry-dialog.png", { width: 560, minHeight: 405, maxHeight: 430 });
  });

  test("favorites cards retain selection notes and ordering controls", async ({ page }) => {
    await renderFixture(page, `<div class="favorites-panel favorites-standalone-page visual-fixture">
      <section class="favorites-dialog visual-favorites-dialog">
        <header class="favorites-header">
          <div class="favorites-heading">
            <div class="favorites-title-row">
              <h2>המועדפים שלי</h2>
              <div class="favorites-header-workspace">
                <div class="favorites-filter-group"><select aria-label="סינון"><option>כל הקטלוגים</option></select><span class="favorites-visible-count">2 פריטים</span></div>
                <button class="favorites-share-inline favorites-header-action" type="button">${ICONS.share}<span>שיתוף הרשימה</span></button>
                <a class="favorites-share-inline favorites-header-action favorites-gmail-inline" href="#">${ICONS.mail}<span>בירור מרוכז ב-Gmail</span></a>
              </div>
            </div>
          </div>
        </header>
        <div class="favorites-selection-bar"><span><strong>1</strong> מסומן — פעולות השיתוף והבירור יחולו רק עליו</span><button class="favorites-selection-clear" type="button">ביטול סימון</button></div>
        <div class="favorites-grid">
          ${favoriteCard("ארונות פתיחה פרדי 2026", 43, "לבדוק ברוחב 180", true)}
          ${favoriteCard("חדרי ילדים ת.ב.י.", 12, "")}
        </div>
      </section>
    </div>`, {
      bodyAttributes: 'data-page="favorites"',
      viewport: { width: 1280, height: 900 },
      extraCss: ".visual-favorites-dialog { position: static; width: 100%; max-width: none; max-height: none; transform: none; }"
    });

    await expectVisualComponent(page.locator(".visual-favorites-dialog"), "favorites-workspace.png", { width: 1242, minHeight: 600, maxHeight: 645 });
  });

  test("viewer image error remains clear and actionable", async ({ page }) => {
    await renderFixture(page, `<div class="visual-fixture visual-error-shell">
      <div class="lightbox-stage">
        <div class="stage-canvas">
          <div class="lightbox-image-frame image-terminal-error" aria-busy="false"><img src="${PLACEHOLDER_IMAGE}" alt="" width="1200" height="820" /></div>
          <div class="viewer-image-feedback ui-state" data-mode="error" data-state="error" role="alert">
            <span class="viewer-image-feedback-icon ui-state-icon" aria-hidden="true">${ICONS.warning}</span>
            <span>התמונה לא הצליחה להיטען.</span>
            <button class="viewer-image-retry" type="button">נסה שוב</button>
          </div>
        </div>
      </div>
    </div>`, {
      bodyAttributes: 'data-page="home"',
      viewport: { width: 1000, height: 760 },
      extraCss: `
        body { background: #171412; }
        .visual-error-shell { width: 820px; height: 600px; }
        .visual-error-shell .lightbox-stage { position: relative; width: 100%; height: 100%; min-height: 0; }
        .visual-error-shell .stage-canvas { position: relative; width: 100%; height: 100%; }
        .visual-error-shell .lightbox-image-frame { width: 72%; height: 82%; margin: 5% auto 0; background: #2a2521; border-radius: 18px; }
      `
    });

    await expectVisualComponent(page.locator(".visual-error-shell"), "viewer-image-error.png", { width: 820, minHeight: 600, maxHeight: 600 });
  });
});
