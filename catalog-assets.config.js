// Runtime catalog image storage configuration.
// The public deploy bundle is R2/CDN-based and rewrites this file with the CDN URL.
// An empty value here keeps local development compatible when assets/pages exists next to the site files.
window.BARGIG_CATALOG_ASSET_BASE_URL = "";

// Runtime image delivery policy.
// - "responsive": use medium images for normal viewer display and full images for large screens / zoom.
// - "full-only": never request medium images; thumbnails are still used for cards and as an emergency fallback.
// Keep this as the single switch when comparing the two delivery strategies.
window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE = "full-only";
