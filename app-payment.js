/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: app-payment.js
 * ES module entrypoint: src/entries/payment.js
 * Bundled ES module graph:
 *   - src/entries/payment.js
 * Compiler virtual inputs: <define:__BARGIG_FEATURE_CAPABILITIES__>
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.1 (direct pinned devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// src/entries/payment.js
var form = (
  /** @type {HTMLFormElement | null} */
  document.getElementById("paymentForm")
), submitButton = (
  /** @type {HTMLButtonElement | null} */
  document.getElementById("paymentSubmit")
), statusElement = (
  /** @type {HTMLElement | null} */
  document.getElementById("paymentFormStatus")
), customerNameInput = (
  /** @type {HTMLInputElement | null} */
  document.getElementById("paymentCustomerName")
), orderNumberInput = (
  /** @type {HTMLInputElement | null} */
  document.getElementById("paymentOrderNumber")
), termsCheckbox = (
  /** @type {HTMLInputElement | null} */
  document.getElementById("paymentTermsAccepted")
), shareButton = (
  /** @type {HTMLButtonElement | null} */
  document.getElementById("paymentShareLink")
), shareToast = (
  /** @type {HTMLElement | null} */
  document.getElementById("paymentShareToast")
), shareToastTimer = 0;
async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  let textarea = document.createElement("textarea");
  textarea.value = value, textarea.setAttribute("readonly", ""), textarea.style.position = "fixed", textarea.style.insetInlineStart = "-1000px", textarea.style.top = "0", document.body.appendChild(textarea);
  try {
    if (textarea.select(), textarea.setSelectionRange(0, textarea.value.length), !document.execCommand("copy")) throw new Error("Clipboard copy command failed");
  } finally {
    textarea.remove();
  }
}
function isMobileShareEnvironment() {
  if (typeof navigator.share != "function") return !1;
  let mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ""), iPadDesktopMode = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1, userAgentDataMobile = navigator.userAgentData?.mobile === !0;
  return !!(mobileUserAgent || iPadDesktopMode || userAgentDataMobile);
}
function showShareToast(message, tone = "link") {
  !(shareToast instanceof HTMLElement) || !message || (window.clearTimeout(shareToastTimer), shareToast.textContent = message, shareToast.dataset.tone = tone, shareToast.classList.remove("hidden", "visible"), shareToast.offsetWidth, window.requestAnimationFrame(() => shareToast.classList.add("visible")), shareToastTimer = window.setTimeout(() => {
    shareToast.classList.remove("visible"), window.setTimeout(() => {
      shareToast.classList.contains("visible") || shareToast.classList.add("hidden");
    }, 180);
  }, 1400));
}
async function shareOrCopyPaymentLink() {
  let link = window.location.href;
  if (isMobileShareEnvironment())
    try {
      await navigator.share({
        title: document.title,
        text: "תשלום חוב · רהיטי ברגיג",
        url: link
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  try {
    await copyTextToClipboard(link), showShareToast("הקישור הועתק");
  } catch {
    showShareToast("לא ניתן להעתיק אוטומטית", "warning"), window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}
function parseBoolean(value) {
  return String(value).trim().toLowerCase() === "true";
}
function normalizedValue(input) {
  return String(input?.value || "").trim();
}
function paymentConfiguration() {
  if (!(form instanceof HTMLFormElement)) return null;
  let paymentUrl = String(form.dataset.paymentUrl || "").trim(), parsedUrl = null;
  try {
    parsedUrl = paymentUrl ? new URL(paymentUrl) : null;
  } catch {
    parsedUrl = null;
  }
  let enabled = parseBoolean(form.dataset.paymentEnabled), validUrl = parsedUrl?.protocol === "https:" && !parsedUrl.username && !parsedUrl.password;
  return {
    enabled: enabled && validUrl,
    providerName: String(form.dataset.paymentProvider || "ספק הסליקה").trim(),
    paymentUrl: parsedUrl,
    openInNewTab: parseBoolean(form.dataset.paymentOpenNewTab),
    customerNameQueryParameter: String(form.dataset.customerNameQueryParameter || "").trim(),
    orderNumberQueryParameter: String(form.dataset.orderNumberQueryParameter || "").trim()
  };
}
function setStatus(message, state = "neutral") {
  statusElement instanceof HTMLElement && (statusElement.textContent = message, statusElement.dataset.state = state);
}
function markAppReady() {
  document.body.dataset.appReady = "true";
}
function updateSubmitState() {
  if (!(form instanceof HTMLFormElement) || !(submitButton instanceof HTMLButtonElement)) return;
  let config = paymentConfiguration(), fieldsComplete = !!(normalizedValue(customerNameInput) && normalizedValue(orderNumberInput) && termsCheckbox instanceof HTMLInputElement && termsCheckbox.checked);
  submitButton.disabled = !(config?.enabled && fieldsComplete), submitButton.setAttribute("aria-disabled", String(submitButton.disabled)), config?.enabled ? fieldsComplete ? setStatus(`הפרטים הושלמו. המעבר ל${config.providerName} זמין.`, "ready") : setStatus("יש להשלים את שני השדות ולאשר את התקנון לפני המעבר לתשלום.") : setStatus("קישור התשלום עדיין אינו פעיל. אפשר לפנות לעסק כדי להשלים את התשלום.", "unavailable");
}
function appendConfiguredValue(url, parameterName, value) {
  !parameterName || !value || url.searchParams.set(parameterName, value);
}
function submitPayment(event) {
  if (event.preventDefault(), !(form instanceof HTMLFormElement)) return;
  let config = paymentConfiguration();
  if (!config?.enabled || !(config.paymentUrl instanceof URL)) {
    updateSubmitState();
    return;
  }
  if (!form.reportValidity()) {
    setStatus("חסרים פרטים נדרשים או שלא אושר התקנון.", "error"), updateSubmitState();
    return;
  }
  let targetUrl = new URL(config.paymentUrl.href);
  if (appendConfiguredValue(
    targetUrl,
    config.customerNameQueryParameter,
    normalizedValue(customerNameInput)
  ), appendConfiguredValue(
    targetUrl,
    config.orderNumberQueryParameter,
    normalizedValue(orderNumberInput)
  ), setStatus(`מעבירים אתכם לעמוד התשלום המאובטח של ${config.providerName}…`, "ready"), config.openInNewTab) {
    let paymentWindow = window.open(targetUrl.href, "_blank", "noopener,noreferrer");
    if (paymentWindow) {
      paymentWindow.opener = null;
      return;
    }
  }
  window.location.assign(targetUrl.href);
}
form instanceof HTMLFormElement && (form.addEventListener("input", updateSubmitState), form.addEventListener("change", updateSubmitState), form.addEventListener("submit", submitPayment));
shareButton instanceof HTMLButtonElement && shareButton.addEventListener("click", () => {
  shareOrCopyPaymentLink();
});
updateSubmitState();
markAppReady();
