(() => {
  "use strict";

  const ICON_CANDIDATES = [
    { href: "favicon.ico", sizes: "any" },
    { href: "favicon.svg", type: "image/svg+xml" },
    { href: "favicon.png", type: "image/png" },
  ];
  const APPLE_TOUCH_ICON = "apple-touch-icon.png";
  const MANAGED_ICON_SELECTOR = 'link[data-site-favicon="1"]';
  const MANAGED_APPLE_SELECTOR = 'link[data-site-apple-touch-icon="1"]';

  function resolveAssetUrl(href) {
    return new URL(href, document.baseURI).href;
  }

  async function assetExists(href) {
    if (!window.fetch) {
      return false;
    }
    const url = resolveAssetUrl(href);
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-cache" });
      if (response.ok) {
        return true;
      }
      if (response.status !== 405) {
        return false;
      }
    } catch (error) {
      return false;
    }

    try {
      const response = await fetch(url, { method: "GET", cache: "no-cache" });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  function updateManagedLink(selector, attributes) {
    let link = document.head.querySelector(selector);
    if (!link) {
      link = document.createElement("link");
      document.head.append(link);
    }

    while (link.attributes.length > 0) {
      link.removeAttribute(link.attributes[0].name);
    }

    for (const [name, value] of Object.entries(attributes)) {
      if (value) {
        link.setAttribute(name, value);
      }
    }
  }

  async function applyFavicon() {
    for (const icon of ICON_CANDIDATES) {
      if (!(await assetExists(icon.href))) {
        continue;
      }
      updateManagedLink(MANAGED_ICON_SELECTOR, {
        rel: "icon",
        href: icon.href,
        type: icon.type || "",
        sizes: icon.sizes || "",
        "data-site-favicon": "1",
      });
      break;
    }

    if (await assetExists(APPLE_TOUCH_ICON)) {
      updateManagedLink(MANAGED_APPLE_SELECTOR, {
        rel: "apple-touch-icon",
        href: APPLE_TOUCH_ICON,
        "data-site-apple-touch-icon": "1",
      });
    }
  }

  applyFavicon();
})();
