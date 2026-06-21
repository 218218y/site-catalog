(function () {
  "use strict";

  const TOOLTIP_ATTR = "data-tooltip";
  const DEFAULT_TOOLTIP_ATTR = "data-tooltip-default";
  const TOOLTIP_SELECTOR = `[${TOOLTIP_ATTR}]`;
  const NATIVE_TITLE_SELECTOR = "[title]";
  const HIDDEN_CLASS = "hidden";
  const VISIBLE_CLASS = "visible";
  const ABOVE_CLASS = "site-tooltip-above";
  const BELOW_CLASS = "site-tooltip-below";
  const SPACING = 12;
  const VIEWPORT_PADDING = 10;

  let tooltip = null;
  let activeTarget = null;
  let hideTimer = 0;
  let observer = null;
  let initialized = false;

  function asElement(value) {
    return value instanceof Element ? value : null;
  }

  function textFromTitle(element) {
    const title = element.getAttribute("title");
    return typeof title === "string" ? title.trim() : "";
  }

  function textFromTooltip(element) {
    const text = element.getAttribute(TOOLTIP_ATTR);
    return typeof text === "string" ? text.trim() : "";
  }

  function getTooltipText(element) {
    const node = asElement(element);
    if (!node) return "";
    return textFromTooltip(node) || textFromTitle(node);
  }

  function shouldUseTooltip(element) {
    if (!element || element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-disabled") === "true") return false;
    return Boolean(getTooltipText(element));
  }

  function syncTitleToTooltip(element, options = {}) {
    const node = asElement(element);
    if (!node) return;

    const title = textFromTitle(node);
    if (!title) return;

    node.setAttribute(TOOLTIP_ATTR, title);
    if (options.updateDefault || !node.hasAttribute(DEFAULT_TOOLTIP_ATTR)) {
      node.setAttribute(DEFAULT_TOOLTIP_ATTR, title);
    }
    node.removeAttribute("title");
  }

  function hydrateElement(element) {
    const node = asElement(element);
    if (!node) return;

    if (node.matches?.(NATIVE_TITLE_SELECTOR)) syncTitleToTooltip(node);
    node.querySelectorAll?.(NATIVE_TITLE_SELECTOR).forEach((child) => syncTitleToTooltip(child));
  }

  function hydrateDocument() {
    hydrateElement(document.body);
  }

  function ensureTooltip() {
    if (tooltip) return tooltip;

    tooltip = document.createElement("div");
    tooltip.className = `site-tooltip ${HIDDEN_CLASS}`;
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function closestTooltipTarget(start) {
    const node = asElement(start);
    return node?.closest?.(TOOLTIP_SELECTOR) || null;
  }

  function placeTooltip(target) {
    if (!target || !tooltip || tooltip.classList.contains(HIDDEN_CLASS)) return;

    const targetRect = target.getBoundingClientRect();
    tooltip.style.maxWidth = `${Math.max(180, Math.min(320, window.innerWidth - VIEWPORT_PADDING * 2))}px`;

    const tooltipRect = tooltip.getBoundingClientRect();
    const targetCenter = targetRect.left + targetRect.width / 2;
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, targetCenter - tooltipRect.width / 2),
      Math.max(VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING)
    );

    const topAbove = targetRect.top - tooltipRect.height - SPACING;
    const canShowAbove = topAbove >= VIEWPORT_PADDING;
    const topBelow = targetRect.bottom + SPACING;
    const top = canShowAbove
      ? topAbove
      : Math.min(topBelow, Math.max(VIEWPORT_PADDING, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING));

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.classList.toggle(ABOVE_CLASS, canShowAbove);
    tooltip.classList.toggle(BELOW_CLASS, !canShowAbove);

    const arrowLeft = Math.min(
      Math.max(18, targetCenter - left),
      Math.max(18, tooltipRect.width - 18)
    );
    tooltip.style.setProperty("--site-tooltip-arrow-x", `${Math.round(arrowLeft)}px`);
  }

  function showTooltip(target) {
    if (!shouldUseTooltip(target)) return;

    window.clearTimeout(hideTimer);
    activeTarget = target;

    const bubble = ensureTooltip();
    bubble.textContent = getTooltipText(target);
    bubble.setAttribute("aria-hidden", "false");
    bubble.classList.remove(HIDDEN_CLASS);
    bubble.classList.remove(VISIBLE_CLASS);

    placeTooltip(target);
    window.requestAnimationFrame(() => {
      if (activeTarget !== target) return;
      placeTooltip(target);
      bubble.classList.add(VISIBLE_CLASS);
    });
  }

  function hideTooltip() {
    if (!tooltip) return;

    activeTarget = null;
    tooltip.classList.remove(VISIBLE_CLASS);
    tooltip.setAttribute("aria-hidden", "true");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!tooltip || activeTarget) return;
      tooltip.classList.add(HIDDEN_CLASS);
    }, 140);
  }

  function refreshActiveTooltip() {
    if (!activeTarget || !tooltip) return;
    const text = getTooltipText(activeTarget);
    if (!text) {
      hideTooltip();
      return;
    }
    tooltip.textContent = text;
    placeTooltip(activeTarget);
  }

  function setTooltipText(element, text, options = {}) {
    const node = asElement(element);
    if (!node) return;

    const cleanText = String(text || "").trim();
    if (!cleanText) {
      node.removeAttribute(TOOLTIP_ATTR);
      if (options.updateDefault) node.removeAttribute(DEFAULT_TOOLTIP_ATTR);
      node.removeAttribute("title");
      refreshActiveTooltip();
      return;
    }

    node.setAttribute(TOOLTIP_ATTR, cleanText);
    if (options.updateDefault || !node.hasAttribute(DEFAULT_TOOLTIP_ATTR)) {
      node.setAttribute(DEFAULT_TOOLTIP_ATTR, cleanText);
    }
    node.removeAttribute("title");
    refreshActiveTooltip();
  }

  function getDefaultTooltipText(element) {
    const node = asElement(element);
    if (!node) return "";
    return (node.getAttribute(DEFAULT_TOOLTIP_ATTR) || getTooltipText(node) || "").trim();
  }

  function restoreDefaultTooltip(element) {
    const defaultText = getDefaultTooltipText(element);
    setTooltipText(element, defaultText, { updateDefault: true });
  }

  function handlePointerOver(event) {
    if (event.pointerType === "touch") return;
    const target = closestTooltipTarget(event.target);
    if (!target || target === activeTarget) return;
    showTooltip(target);
  }

  function handlePointerOut(event) {
    if (!activeTarget) return;
    const related = asElement(event.relatedTarget);
    if (related && activeTarget.contains(related)) return;
    hideTooltip();
  }

  function handleFocusIn(event) {
    const target = closestTooltipTarget(event.target);
    if (target) showTooltip(target);
  }

  function handleFocusOut(event) {
    if (!activeTarget) return;
    const related = asElement(event.relatedTarget);
    if (related && activeTarget.contains(related)) return;
    hideTooltip();
  }

  function handleDocumentPointerDown(event) {
    if (!activeTarget) return;
    const target = asElement(event.target);
    if (!target || target.closest(TOOLTIP_SELECTOR) !== activeTarget) hideTooltip();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") hideTooltip();
  }

  function observeTooltipChanges() {
    if (observer || !document.body || !("MutationObserver" in window)) return;

    observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "attributes" && record.attributeName === "title") {
          syncTitleToTooltip(record.target, { updateDefault: true });
          if (record.target === activeTarget) refreshActiveTooltip();
          return;
        }

        record.addedNodes.forEach((node) => {
          hydrateElement(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title"]
    });
  }

  function initTooltips() {
    if (initialized || !document.body) return;
    initialized = true;

    hydrateDocument();
    observeTooltipChanges();

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", refreshActiveTooltip, true);
    window.addEventListener("resize", refreshActiveTooltip);
  }

  window.BargigTooltips = {
    hydrate: hydrateElement,
    getText: getTooltipText,
    getDefaultText: getDefaultTooltipText,
    setText: setTooltipText,
    restoreDefault: restoreDefaultTooltip
  };

  if (document.body) {
    initTooltips();
  } else {
    document.addEventListener("DOMContentLoaded", initTooltips, { once: true });
  }
}());
