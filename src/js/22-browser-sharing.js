/**
 * Source module: 22-browser-sharing.js
 * Canonical browser clipboard/native-share primitives. UI stays with callers.
 */

/** @typedef {{mobileOnly?: boolean}} NativeShareOptions */
/** @typedef {"shared"|"cancelled"|"fallback"} NativeShareResult */

/**
 * @param {ShareData} data
 * @param {NativeShareOptions} [options]
 * @returns {Promise<NativeShareResult>}
 */
async function tryNativeShare(data, options = {}) {
  if (typeof navigator.share !== "function") return "fallback";
  if (options.mobileOnly) {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
      || (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1)
      || navigator.userAgentData?.mobile === true;
    if (!mobile) return "fallback";
  }
  if (typeof navigator.canShare === "function") {
    try {
      if (!navigator.canShare(data)) return "fallback";
    } catch (_error) {
      return "fallback";
    }
  }
  try {
    await navigator.share(data);
    return "shared";
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "fallback";
  }
}

/** @param {string} value @returns {Promise<void>} */
async function copyTextToClipboard(value) {
  const text = String(value);
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.insetInlineStart = "-1000px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    if (!document.execCommand("copy")) throw new Error("Clipboard copy command failed");
  } finally {
    textarea.remove();
  }
}

export { copyTextToClipboard, tryNativeShare };
