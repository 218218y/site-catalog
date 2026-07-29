/**
 * Source module: 31-viewer-share.js
 * Viewer-only adapters for snapshot and link-sharing controls.
 *
 * The reusable sharing implementation remains in the favorites/share feature;
 * this bridge owns only Viewer DOM bindings and is absent from catalog routes.
 */

function downloadCurrentLightboxImage() {
  if (!activeCatalog()) return;
  downloadCatalogPageSnapshot(
    activeCatalog(),
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
