/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: tooltip-manager.js
 * ES module entrypoint: src/runtime/tooltip-manager.js
 * Bundled ES module graph:
 *   - src/runtime/tooltip-manager.js
 * Compiler virtual inputs: none
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.2 (lockfile-selected direct devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// src/runtime/tooltip-manager.js
var TOOLTIP_ATTR = "data-tooltip", DEFAULT_TOOLTIP_ATTR = "data-tooltip-default", TOOLTIP_SELECTOR = `[${TOOLTIP_ATTR}]`, NATIVE_TITLE_SELECTOR = "[title]", HIDDEN_CLASS = "hidden", VISIBLE_CLASS = "visible", ABOVE_CLASS = "site-tooltip-above", BELOW_CLASS = "site-tooltip-below", SPACING = 12, VIEWPORT_PADDING = 10, tooltip = null, activeTarget = null, hideTimer = 0, suppressTimer = 0, suppressUntil = 0, lastPointerClientX = null, lastPointerClientY = null, observer = null, initialized = !1;
function asElement(value) {
  return value instanceof Element ? value : null;
}
function textFromTitle(element) {
  let title = element.getAttribute("title");
  return typeof title == "string" ? title.trim() : "";
}
function textFromTooltip(element) {
  let text = element.getAttribute(TOOLTIP_ATTR);
  return typeof text == "string" ? text.trim() : "";
}
function getTooltipText(element) {
  let node = asElement(element);
  return node ? textFromTooltip(node) || textFromTitle(node) : "";
}
function shouldUseTooltip(element) {
  return !element || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true" ? !1 : !!getTooltipText(element);
}
function syncTitleToTooltip(element, options = {}) {
  let node = asElement(element);
  if (!node) return;
  let title = textFromTitle(node);
  title && (node.setAttribute(TOOLTIP_ATTR, title), (options.updateDefault || !node.hasAttribute(DEFAULT_TOOLTIP_ATTR)) && node.setAttribute(DEFAULT_TOOLTIP_ATTR, title), node.removeAttribute("title"));
}
function hydrateElement(element) {
  let node = asElement(element);
  node && (node.matches?.(NATIVE_TITLE_SELECTOR) && syncTitleToTooltip(node), node.querySelectorAll?.(NATIVE_TITLE_SELECTOR).forEach((child) => syncTitleToTooltip(child)));
}
function hydrateDocument() {
  hydrateElement(document.body);
}
function ensureTooltip() {
  return tooltip || (tooltip = document.createElement("div"), tooltip.className = `site-tooltip ${HIDDEN_CLASS}`, tooltip.setAttribute("role", "tooltip"), tooltip.setAttribute("aria-hidden", "true"), document.body.appendChild(tooltip), tooltip);
}
function closestTooltipTarget(start) {
  return asElement(start)?.closest?.(TOOLTIP_SELECTOR) || null;
}
function placeTooltip(target) {
  if (!target || !tooltip || tooltip.classList.contains(HIDDEN_CLASS)) return;
  let targetRect = target.getBoundingClientRect();
  tooltip.style.maxWidth = `${Math.max(180, Math.min(320, window.innerWidth - VIEWPORT_PADDING * 2))}px`;
  let tooltipRect = tooltip.getBoundingClientRect(), targetCenter = targetRect.left + targetRect.width / 2, left = Math.min(
    Math.max(VIEWPORT_PADDING, targetCenter - tooltipRect.width / 2),
    Math.max(VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING)
  ), topAbove = targetRect.top - tooltipRect.height - SPACING, canShowAbove = topAbove >= VIEWPORT_PADDING, topBelow = targetRect.bottom + SPACING, top = canShowAbove ? topAbove : Math.min(topBelow, Math.max(VIEWPORT_PADDING, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING));
  tooltip.style.left = `${Math.round(left)}px`, tooltip.style.top = `${Math.round(top)}px`, tooltip.classList.toggle(ABOVE_CLASS, canShowAbove), tooltip.classList.toggle(BELOW_CLASS, !canShowAbove);
  let arrowLeft = Math.min(
    Math.max(18, targetCenter - left),
    Math.max(18, tooltipRect.width - 18)
  );
  tooltip.style.setProperty("--site-tooltip-arrow-x", `${Math.round(arrowLeft)}px`);
}
function isTooltipSuppressed() {
  return Date.now() < suppressUntil;
}
function showTooltip(target) {
  if (isTooltipSuppressed() || !shouldUseTooltip(target)) return;
  window.clearTimeout(hideTimer), activeTarget = target;
  let bubble = ensureTooltip();
  bubble.textContent = getTooltipText(target), bubble.setAttribute("aria-hidden", "false"), bubble.classList.remove(HIDDEN_CLASS), bubble.classList.remove(VISIBLE_CLASS), placeTooltip(target), window.requestAnimationFrame(() => {
    activeTarget === target && (placeTooltip(target), bubble.classList.add(VISIBLE_CLASS));
  });
}
function hideTooltip() {
  tooltip && (activeTarget = null, tooltip.classList.remove(VISIBLE_CLASS), tooltip.setAttribute("aria-hidden", "true"), window.clearTimeout(hideTimer), hideTimer = window.setTimeout(() => {
    !tooltip || activeTarget || tooltip.classList.add(HIDDEN_CLASS);
  }, 140));
}
function refreshActiveTooltip() {
  if (isTooltipSuppressed()) {
    hideTooltip();
    return;
  }
  if (!activeTarget || !tooltip) return;
  let text = getTooltipText(activeTarget);
  if (!text) {
    hideTooltip();
    return;
  }
  tooltip.textContent = text, placeTooltip(activeTarget);
}
function setTooltipText(element, text, options = {}) {
  let node = asElement(element);
  if (!node) return;
  let cleanText = String(text || "").trim();
  if (!cleanText) {
    node.removeAttribute(TOOLTIP_ATTR), options.updateDefault && node.removeAttribute(DEFAULT_TOOLTIP_ATTR), node.removeAttribute("title"), refreshActiveTooltip();
    return;
  }
  node.setAttribute(TOOLTIP_ATTR, cleanText), (options.updateDefault || !node.hasAttribute(DEFAULT_TOOLTIP_ATTR)) && node.setAttribute(DEFAULT_TOOLTIP_ATTR, cleanText), node.removeAttribute("title"), refreshActiveTooltip();
}
function getDefaultTooltipText(element) {
  let node = asElement(element);
  return node ? (node.getAttribute(DEFAULT_TOOLTIP_ATTR) || getTooltipText(node) || "").trim() : "";
}
function restoreDefaultTooltip(element) {
  let defaultText = getDefaultTooltipText(element);
  setTooltipText(element, defaultText, { updateDefault: !0 });
}
function rememberPointerPosition(event) {
  let clientX = Number(event?.clientX), clientY = Number(event?.clientY);
  !Number.isFinite(clientX) || !Number.isFinite(clientY) || (lastPointerClientX = clientX, lastPointerClientY = clientY);
}
function tooltipTargetAtLastPointer() {
  let clientX = Number(lastPointerClientX), clientY = Number(lastPointerClientY);
  return !Number.isFinite(clientX) || !Number.isFinite(clientY) || clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight ? null : closestTooltipTarget(document.elementFromPoint(clientX, clientY));
}
function restoreTooltipAfterSuppression() {
  if (isTooltipSuppressed()) return;
  let target = tooltipTargetAtLastPointer();
  target && showTooltip(target);
}
function suppressTooltips(duration = 250, options = {}) {
  let { restoreAfter = !0 } = options, delay = Math.max(0, Number(duration) || 0);
  suppressUntil = Math.max(suppressUntil || 0, Date.now() + delay), hideTooltip(), window.clearTimeout(suppressTimer), suppressTimer = window.setTimeout(() => {
    suppressTimer = 0, restoreAfter && restoreTooltipAfterSuppression();
  }, delay + 20);
}
function handlePointerOver(event) {
  if (rememberPointerPosition(event), event.pointerType === "touch" || isTooltipSuppressed()) return;
  let target = closestTooltipTarget(event.target);
  !target || target === activeTarget || showTooltip(target);
}
function handlePointerMove(event) {
  rememberPointerPosition(event);
}
function handlePointerOut(event) {
  if (rememberPointerPosition(event), !activeTarget) return;
  let related = asElement(event.relatedTarget);
  related && activeTarget.contains(related) || hideTooltip();
}
function handleFocusIn(event) {
  let target = closestTooltipTarget(event.target);
  target && showTooltip(target);
}
function handleFocusOut(event) {
  if (!activeTarget) return;
  let related = asElement(event.relatedTarget);
  related && activeTarget.contains(related) || hideTooltip();
}
function handleDocumentPointerDown(event) {
  if (!activeTarget) return;
  let target = asElement(event.target);
  (!target || target.closest(TOOLTIP_SELECTOR) !== activeTarget) && hideTooltip();
}
function handleKeyDown(event) {
  event.key === "Escape" && hideTooltip();
}
function observeTooltipChanges() {
  observer || !document.body || !("MutationObserver" in window) || (observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "attributes" && record.attributeName === "title") {
        syncTitleToTooltip(record.target, { updateDefault: !0 }), record.target === activeTarget && refreshActiveTooltip();
        return;
      }
      record.addedNodes.forEach((node) => {
        hydrateElement(node);
      });
    });
  }), observer.observe(document.body, {
    childList: !0,
    subtree: !0,
    attributes: !0,
    attributeFilter: ["title"]
  }));
}
function initTooltips() {
  initialized || !document.body || (initialized = !0, hydrateDocument(), observeTooltipChanges(), document.addEventListener("pointerover", handlePointerOver, !0), document.addEventListener("pointermove", handlePointerMove, !0), document.addEventListener("pointerout", handlePointerOut, !0), document.addEventListener("focusin", handleFocusIn, !0), document.addEventListener("focusout", handleFocusOut, !0), document.addEventListener("pointerdown", handleDocumentPointerDown, !0), document.addEventListener("keydown", handleKeyDown, !0), window.addEventListener("scroll", refreshActiveTooltip, !0), window.addEventListener("resize", refreshActiveTooltip));
}
var tooltips = Object.freeze({
  hydrate: hydrateElement,
  getText: getTooltipText,
  getDefaultText: getDefaultTooltipText,
  setText: setTooltipText,
  restoreDefault: restoreDefaultTooltip,
  hide: hideTooltip,
  suppress: suppressTooltips
});
document.body ? initTooltips() : document.addEventListener("DOMContentLoaded", initTooltips, { once: !0 });
var tooltip_manager_default = tooltips;
export {
  tooltip_manager_default as default,
  getDefaultTooltipText,
  getTooltipText,
  hideTooltip,
  hydrateElement,
  restoreDefaultTooltip,
  setTooltipText,
  suppressTooltips,
  tooltips
};
