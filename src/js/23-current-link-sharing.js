/**
 * Source module: 23-current-link-sharing.js
 * Route-aware current-document sharing. Browser capability details stay in
 * 22-browser-sharing.js; this module owns the shared user-facing fallback flow.
 */

import { isAppPage } from "./00-navigation.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { flashActionButton, showActionToast } from "./21-ui-runtime.js";
import { copyTextToClipboard, tryNativeShare } from "./22-browser-sharing.js";

function currentShareLabel() {
  const catalog = activeCatalog();
  if (catalog && isAppPage("viewer")) return `${catalog.title} · עמוד ${activePage()}`;
  if (catalog && isAppPage("catalog")) return catalog.title;
  if (isAppPage("favorites")) return "המועדפים שלי · רהיטי ברגיג";
  return "קטלוגי רהיטי ברגיג";
}

/** @param {Element|null|undefined} button */
async function shareOrCopyCurrentLink(button) {
  const link = window.location.href;
  const shareResult = await tryNativeShare({
    title: document.title,
    text: currentShareLabel(),
    url: link
  }, { mobileOnly: true });
  if (shareResult === "shared" || shareResult === "cancelled") return;

  try {
    await copyTextToClipboard(link);
    flashActionButton(button, "הקישור הועתק");
    showActionToast("הקישור הועתק", { tone: "link" });
  } catch (_error) {
    showActionToast("לא ניתן להעתיק אוטומטית — אפשר להעתיק מהחלון שנפתח");
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}

export { shareOrCopyCurrentLink };
