/**
 * Source module: 19-shared-pure.js
 * Pure shared policies consumed by browser owners and imported directly by unit tests.
 */

/**
 * @param {string} emailAddress
 * @param {{subject?:unknown, text?:unknown}|null|undefined} reference
 */
function buildViewerInquiryMailtoUrl(emailAddress, reference) {
  const subject = encodeURIComponent(String(reference?.subject || ""));
  const body = encodeURIComponent(String(reference?.text || "").replace(/\r?\n/g, "\r\n"));
  return `mailto:${String(emailAddress || "")}?subject=${subject}&body=${body}`;
}


export { buildViewerInquiryMailtoUrl };
