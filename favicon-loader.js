(() => {
  "use strict";

  const MANAGED_ICON_SELECTOR = 'link[data-site-favicon="1"]';
  const MANAGED_APPLE_SELECTOR = 'link[data-site-apple-touch-icon="1"]';

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

  // These files are validated and copied by build_deploy_bundle.py, so runtime
  // existence probes only add requests and can produce false console errors on
  // static servers that handle metadata probes differently from normal file requests.
  updateManagedLink(MANAGED_ICON_SELECTOR, {
    rel: "icon",
    href: "favicon.ico",
    sizes: "any",
    "data-site-favicon": "1",
  });

  updateManagedLink(MANAGED_APPLE_SELECTOR, {
    rel: "apple-touch-icon",
    href: "apple-touch-icon.png",
    "data-site-apple-touch-icon": "1",
  });
})();
