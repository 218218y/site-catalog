/**
 * Runtime configuration for catalog image hosting.
 *
 * IMPORTANT:
 * Do NOT use the Cloudflare S3 API endpoint here, for example:
 *   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 * That endpoint is for authenticated uploads/API tools, not for loading images
 * directly in a visitor's browser.
 *
 * Use one of these public read URLs instead:
 *   1) Production: an R2 Custom Domain, for example https://catalogs.example.com
 *   2) Temporary testing: the bucket Public Development URL, for example
 *      https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
 *
 * After uploading dist/r2-assets to the bucket root, set baseUrl to the public
 * read origin only, without a trailing slash and without /assets/pages.
 * The site keeps the same object keys in R2:
 *   assets/pages/<catalog-id>/page-001.webp
 *   assets/pages/<catalog-id>/thumbs/page-001.webp
 */
window.BARGIG_CATALOG_ASSETS = {
  // Current temporary public R2 read URL. For production, prefer replacing this
  // with a Custom Domain later, but this Public Development URL is valid for testing.
  baseUrl: "https://pub-5e6c7421563f4086ba1e097bb88f3348.r2.dev",

  // Required for the screenshot/download button when images are loaded from R2.
  // The R2 bucket must have a CORS policy that allows this site:
  //   https://bargig-catalog.netlify.app
  crossOrigin: "anonymous"
};
