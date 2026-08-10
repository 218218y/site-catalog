/** Route entry: hosted payment handoff page. */

export {};

const form = /** @type {HTMLFormElement | null} */ (document.getElementById("paymentForm"));
const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("paymentSubmit"));
const statusElement = /** @type {HTMLElement | null} */ (document.getElementById("paymentFormStatus"));
const customerNameInput = /** @type {HTMLInputElement | null} */ (document.getElementById("paymentCustomerName"));
const orderNumberInput = /** @type {HTMLInputElement | null} */ (document.getElementById("paymentOrderNumber"));
const termsCheckbox = /** @type {HTMLInputElement | null} */ (document.getElementById("paymentTermsAccepted"));
const shareButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("paymentShareLink"));
const shareToast = /** @type {HTMLElement | null} */ (document.getElementById("paymentShareToast"));
const bankCopyButtons = Array.from(document.querySelectorAll("[data-bank-copy-value]"));
let shareToastTimer = 0;

/** @param {string} value @returns {Promise<void>} */
async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
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

/** @returns {boolean} */
function isMobileShareEnvironment() {
  if (typeof navigator.share !== "function") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const iPadDesktopMode = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  const userAgentDataMobile = navigator.userAgentData?.mobile === true;
  return Boolean(mobileUserAgent || iPadDesktopMode || userAgentDataMobile);
}

/** @param {string} message @param {string} [tone] */
function showShareToast(message, tone = "link") {
  if (!(shareToast instanceof HTMLElement) || !message) return;
  window.clearTimeout(shareToastTimer);
  shareToast.textContent = message;
  shareToast.dataset.tone = tone;
  shareToast.classList.remove("hidden", "visible");
  void shareToast.offsetWidth;
  window.requestAnimationFrame(() => shareToast.classList.add("visible"));
  shareToastTimer = window.setTimeout(() => {
    shareToast.classList.remove("visible");
    window.setTimeout(() => {
      if (!shareToast.classList.contains("visible")) shareToast.classList.add("hidden");
    }, 180);
  }, 1400);
}

async function shareOrCopyPaymentLink() {
  const link = window.location.href;

  if (isMobileShareEnvironment()) {
    try {
      await navigator.share({
        title: document.title,
        text: "תשלום חוב · רהיטי ברגיג",
        url: link,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(link);
    showShareToast("הקישור הועתק");
  } catch (_error) {
    showShareToast("לא ניתן להעתיק אוטומטית", "warning");
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}

/** @param {HTMLButtonElement} button */
async function copyBankDetail(button) {
  const value = String(button.dataset.bankCopyValue || "").trim();
  const label = String(button.dataset.bankCopyLabel || "המספר").trim();
  if (!value) return;

  try {
    await copyTextToClipboard(value);
    showShareToast(`${label} הועתק`);
  } catch (_error) {
    showShareToast("לא ניתן להעתיק אוטומטית", "warning");
    window.prompt(`אפשר להעתיק את ${label} מכאן:`, value);
  }
}

/** @param {unknown} value @returns {boolean} */
function parseBoolean(value) {
  return String(value).trim().toLowerCase() === "true";
}

/** @param {HTMLInputElement | null} input @returns {string} */
function normalizedValue(input) {
  return String(input?.value || "").trim();
}

function paymentConfiguration() {
  if (!(form instanceof HTMLFormElement)) return null;
  const paymentUrl = String(form.dataset.paymentUrl || "").trim();
  let parsedUrl = null;
  try {
    parsedUrl = paymentUrl ? new URL(paymentUrl) : null;
  } catch {
    parsedUrl = null;
  }

  const enabled = parseBoolean(form.dataset.paymentEnabled);
  const validUrl = parsedUrl?.protocol === "https:" && !parsedUrl.username && !parsedUrl.password;
  return {
    enabled: enabled && validUrl,
    providerName: String(form.dataset.paymentProvider || "ספק הסליקה").trim(),
    paymentUrl: parsedUrl,
    openInNewTab: parseBoolean(form.dataset.paymentOpenNewTab),
    customerNameQueryParameter: String(form.dataset.customerNameQueryParameter || "").trim(),
    orderNumberQueryParameter: String(form.dataset.orderNumberQueryParameter || "").trim(),
  };
}

/** @param {string} message @param {string} [state] */
function setStatus(message, state = "neutral") {
  if (!(statusElement instanceof HTMLElement)) return;
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function markAppReady() {
  document.body.dataset.appReady = "true";
}

function updateSubmitState() {
  if (!(form instanceof HTMLFormElement) || !(submitButton instanceof HTMLButtonElement)) return;
  const config = paymentConfiguration();
  const fieldsComplete = Boolean(
    normalizedValue(customerNameInput)
    && normalizedValue(orderNumberInput)
    && termsCheckbox instanceof HTMLInputElement
    && termsCheckbox.checked
  );

  submitButton.disabled = !(config?.enabled && fieldsComplete);
  submitButton.setAttribute("aria-disabled", String(submitButton.disabled));

  if (!config?.enabled) {
    setStatus("קישור התשלום עדיין אינו פעיל. אפשר לפנות לעסק כדי להשלים את התשלום.", "unavailable");
  } else if (!fieldsComplete) {
    setStatus("יש להשלים את שני השדות ולאשר את התקנון לפני המעבר לתשלום.");
  } else {
    setStatus(`הפרטים הושלמו. המעבר ל${config.providerName} זמין.`, "ready");
  }
}

/** @param {URL} url @param {string} parameterName @param {string} value */
function appendConfiguredValue(url, parameterName, value) {
  if (!parameterName || !value) return;
  url.searchParams.set(parameterName, value);
}

/** @param {SubmitEvent} event */
function submitPayment(event) {
  event.preventDefault();
  if (!(form instanceof HTMLFormElement)) return;

  const config = paymentConfiguration();
  if (!config?.enabled || !(config.paymentUrl instanceof URL)) {
    updateSubmitState();
    return;
  }

  if (!form.reportValidity()) {
    setStatus("חסרים פרטים נדרשים או שלא אושר התקנון.", "error");
    updateSubmitState();
    return;
  }

  const targetUrl = new URL(config.paymentUrl.href);
  appendConfiguredValue(
    targetUrl,
    config.customerNameQueryParameter,
    normalizedValue(customerNameInput),
  );
  appendConfiguredValue(
    targetUrl,
    config.orderNumberQueryParameter,
    normalizedValue(orderNumberInput),
  );

  setStatus(`מעבירים אתכם לעמוד התשלום המאובטח של ${config.providerName}…`, "ready");
  if (config.openInNewTab) {
    const paymentWindow = window.open(targetUrl.href, "_blank", "noopener,noreferrer");
    if (paymentWindow) {
      paymentWindow.opener = null;
      return;
    }
  }
  window.location.assign(targetUrl.href);
}

if (form instanceof HTMLFormElement) {
  form.addEventListener("input", updateSubmitState);
  form.addEventListener("change", updateSubmitState);
  form.addEventListener("submit", submitPayment);
}

if (shareButton instanceof HTMLButtonElement) {
  shareButton.addEventListener("click", () => {
    void shareOrCopyPaymentLink();
  });
}

for (const button of bankCopyButtons) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("click", () => {
    void copyBankDetail(button);
  });
}

updateSubmitState();
markAppReady();
