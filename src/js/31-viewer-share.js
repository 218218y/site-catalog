/**
 * Source module: 31-viewer-share.js
 * Viewer-only adapters for snapshot and link-sharing controls.
 *
 * The reusable sharing implementation remains in the favorites/share feature;
 * this bridge owns only Viewer DOM bindings and is absent from catalog routes.
 */

/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */

import { viewerElements } from "./16-viewer-state.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { clampPage } from "./20-catalog-runtime.js";
import { flashActionButton, showActionToast } from "./21-ui-runtime.js";
import { pageSrc } from "./17-catalog-asset-urls.js";
import catalogSnapshotApi from "../../catalog-snapshot.js";
import { shareOrCopyCurrentLink } from "./30-favorites-share.js";

/** @param {unknown} value */
function safeFilePart(value) {
  return String(value || "catalog")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "catalog";
}

/** @param {Blob} blob @param {string} filename */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 900);
}

/** @param {CatalogRecord} catalog @param {unknown} page @param {HTMLElement|null|undefined} button */
async function downloadCatalogPageSnapshot(catalog, page, button) {
  const currentPage = clampPage(page, catalog);
  const src = pageSrc(catalog, currentPage);

  try {
    const blob = await catalogSnapshotApi.buildSnapshotBlob(src);
    const extension = catalogSnapshotApi.extension || "jpg";
    const pageNumber = String(currentPage).padStart(3, "0");
    saveBlob(blob, `${safeFilePart(catalog.title || catalog.id)}-page-${pageNumber}.${extension}`);
    flashActionButton(button, "נשמר");
    showActionToast("התמונה נשמרה", { tone: "saved" });
  } catch (error) {
    console.error("[CatalogSnapshot] Failed to export catalog page", {
      catalogId: catalog.id,
      page: currentPage,
      src,
      error
    });
    window.alert("לא הצלחתי ליצור את תמונת העמוד. יש לוודא שמדיניות CORS של מאגר התמונות מאפשרת קריאה מהאתר.");
  }
}

function downloadCurrentLightboxImage() {
  const catalog = activeCatalog();
  if (!catalog) return;
  downloadCatalogPageSnapshot(
    catalog,
    activePage(),
    viewerElements.lightboxScreenshot
  );
}

async function shareCurrentLightboxLink() {
  await shareOrCopyCurrentLink(viewerElements.lightboxCopyLink);
}

function attachViewerShareEvents() {
  viewerElements.lightboxScreenshot?.addEventListener("click", downloadCurrentLightboxImage);
  viewerElements.lightboxCopyLink?.addEventListener("click", shareCurrentLightboxLink);
}

export { attachViewerShareEvents, downloadCurrentLightboxImage };
