/* GENERATED COMPATIBILITY LOADER — current pages do not reference this file. */
(() => {
  "use strict";
  if (document.querySelector('script[data-bargig-route-bundle]')) return;
  const routeAssets = Object.freeze({"favorites":"app-favorites.js","viewer":"app-viewer.js","home":"app-catalog.js","catalog":"app-catalog.js"});
  const page = String(document.body?.dataset?.page || "home");
  const asset = routeAssets[page] || routeAssets.home;
  const currentSource = document.currentScript?.src || document.baseURI;
  const script = document.createElement("script");
  script.src = new URL(asset, currentSource).href;
  script.async = false;
  script.dataset.bargigRouteBundle = page;
  document.head.appendChild(script);
})();
