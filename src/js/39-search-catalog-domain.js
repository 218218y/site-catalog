/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { CatalogCategoryGroup, CatalogSearchResult, CatalogSubcategoryGroup, SearchHighlightRange } from "../../types/frontend-contracts.js" */

import { clampCatalogPage } from "./06-catalog-page-numbering.js";

/**
 * Source module: 39-search-catalog-domain.js
 * Pure catalog layout and Search/Catalog/Viewer integration policies.
 */

/** @typedef {{blockKey:string, blockIndex?:number, label?:string, isDirect?:boolean, items:Array<CatalogRecord>}} SearchCatalogSubcategoryBlock */
/**
 * @typedef {Object} SearchCatalogLayoutSegment
 * @property {string} category
 * @property {number} groupIndex
 * @property {number} segmentIndex
 * @property {number} itemOffset
 * @property {number} span
 * @property {Array<CatalogRecord>} items
 * @property {boolean} hasSubcategories
 * @property {"category"|"subcategory"|"categoryHeader"} segmentType
 * @property {string} layoutBlockKey
 * @property {boolean} inlineDivider
 * @property {Array<CatalogRecord>} [directItems]
 * @property {Array<CatalogSubcategoryGroup>} [subcategories]
 * @property {string} [blockKey]
 * @property {number} [blockIndex]
 * @property {number} [blockOrder]
 * @property {string} [label]
 * @property {boolean} [isDirect]
 */
/** @typedef {{segmentType?:"category"|"subcategory", layoutBlockKey?:string, hasSubcategories?:boolean, blockOrder?:number}} SearchCatalogSegmentAppendOptions */
/** @typedef {{activateCategoryTarget:(targetId:string)=>boolean, openCatalog:(catalogId:string)=>void, openViewer:(catalogId:string,page:number)=>void}} GlobalSearchResultPorts */
/** @typedef {{openCatalog:(catalogId:string,page:number)=>void, setPage:(page:number)=>void, showTopUi:()=>void}} LightboxSearchResultPorts */
/** @typedef {{type:"category", targetId:string}|{type:"catalog", catalogId:string}|{type:"viewer", catalogId:string, page:number}} GlobalSearchResultAction */

const searchCatalogDomain = (() => {
  /** @param {unknown} hash */
  function decodeCatalogHashTargetId(hash) {
    const rawHash = String(hash || "");
    if (!rawHash.startsWith("#")) return "";
    const rawId = rawHash.slice(1);
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }

  /** @param {{mobile?:boolean, tablet?:boolean}|null|undefined} matches */
  function catalogColumnCount(matches) {
    if (matches?.mobile) return 1;
    if (matches?.tablet) return 2;
    return 3;
  }

  /** @param {unknown} value @param {number} columns */
  function clampCatalogSpan(value, columns) {
    return Math.min(columns, Math.max(1, Number(value || 1)));
  }

  /** @param {CatalogCategoryGroup} source @returns {Array<SearchCatalogSubcategoryBlock>} */
  function catalogSubcategorySourceBlocks(source) {
    /** @type {Array<SearchCatalogSubcategoryBlock>} */
    const sourceBlocks = [];
    if (Array.isArray(source?.directItems) && source.directItems.length) {
      sourceBlocks.push({
        blockKey: "__direct__",
        blockIndex: -1,
        label: "קטלוגים כלליים",
        isDirect: true,
        items: source.directItems
      });
    }
    (Array.isArray(source?.subcategories) ? source.subcategories : []).forEach((group, index) => {
      const subcategory = String(group?.subcategory || "").trim();
      const items = Array.isArray(group?.items) ? group.items : [];
      if (!subcategory || !items.length) return;
      sourceBlocks.push({
        blockKey: subcategory,
        blockIndex: index,
        label: subcategory,
        isDirect: false,
        items
      });
    });
    return sourceBlocks;
  }

  /** @param {Array<CatalogCategoryGroup>} groups @param {number} columns @returns {Array<SearchCatalogLayoutSegment>} */
  function catalogCategorySegments(groups, columns) {
    const safeColumns = clampCatalogSpan(columns, 3);
    /** @type {Array<SearchCatalogLayoutSegment>} */
    const segments = [];
    let occupied = 0;

    /** @param {CatalogCategoryGroup} group @param {number} groupIndex @param {SearchCatalogSubcategoryBlock} block @param {SearchCatalogSegmentAppendOptions} [options] */
    const appendCardBlockSegments = (group, groupIndex, block, options = {}) => {
      const items = Array.isArray(block?.items) ? block.items : [];
      if (!items.length) return;
      const segmentType = options.segmentType || "category";
      const layoutBlockKey = options.layoutBlockKey || `${segmentType}:${groupIndex}:${block?.blockKey || "main"}`;
      let itemOffset = 0;
      let segmentIndex = 0;

      while (itemOffset < items.length) {
        if (occupied >= safeColumns) occupied = 0;
        const availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns;
        const span = Math.min(availableInRow, items.length - itemOffset, safeColumns);
        /** @type {SearchCatalogLayoutSegment} */
        const segment = {
          category: group.category,
          groupIndex,
          segmentIndex,
          itemOffset,
          span,
          items: items.slice(itemOffset, itemOffset + span),
          hasSubcategories: Boolean(options.hasSubcategories),
          segmentType,
          layoutBlockKey,
          inlineDivider: false
        };
        if (segmentType === "subcategory") {
          Object.assign(segment, {
            blockKey: block.blockKey,
            blockIndex: block.blockIndex,
            blockOrder: options.blockOrder,
            label: block.label,
            isDirect: Boolean(block.isDirect)
          });
        }
        segments.push(segment);
        itemOffset += span;
        segmentIndex += 1;
        occupied += span;
        if (occupied >= safeColumns) occupied = 0;
      }
    };

    groups.forEach((group, groupIndex) => {
      const items = Array.isArray(group?.items) ? group.items : [];
      if (!items.length) return;
      if (group?.hasSubcategories) {
        if (occupied > 0) occupied = 0;
        segments.push({
          category: group.category,
          groupIndex,
          segmentIndex: 0,
          itemOffset: 0,
          span: safeColumns,
          items: [],
          directItems: Array.isArray(group.directItems) ? group.directItems : [],
          subcategories: Array.isArray(group.subcategories) ? group.subcategories : [],
          hasSubcategories: true,
          segmentType: "categoryHeader",
          layoutBlockKey: `category-header:${groupIndex}`,
          inlineDivider: false
        });
        occupied = 0;
        catalogSubcategorySourceBlocks(group).forEach((block, blockOrder) => {
          appendCardBlockSegments(group, groupIndex, block, {
            segmentType: "subcategory",
            hasSubcategories: true,
            blockOrder,
            layoutBlockKey: `subcategory:${groupIndex}:${block.blockKey}:${blockOrder}`
          });
        });
        return;
      }
      appendCardBlockSegments(group, groupIndex, { blockKey: "__category__", items }, {
        segmentType: "category",
        hasSubcategories: false,
        layoutBlockKey: `category:${groupIndex}`
      });
    });

    occupied = 0;
    segments.forEach((segment, index) => {
      const span = clampCatalogSpan(segment.span, safeColumns);
      if (occupied + span > safeColumns) occupied = 0;
      const rowEnd = occupied + span;
      const nextSegment = segments[index + 1];
      const nextSpan = nextSegment ? clampCatalogSpan(nextSegment.span, safeColumns) : 0;
      const sameLayoutBlock = Boolean(nextSegment && nextSegment.layoutBlockKey === segment.layoutBlockKey);
      segment.inlineDivider = Boolean(
        nextSegment
        && !sameLayoutBlock
        && segment.segmentType !== "categoryHeader"
        && nextSegment.segmentType !== "categoryHeader"
        && rowEnd < safeColumns
        && nextSpan <= safeColumns - rowEnd
      );
      occupied = rowEnd >= safeColumns ? 0 : rowEnd;
    });
    return segments;
  }

  /** @param {unknown} text */
  function escapeSearchMarkup(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /** @param {unknown} text @param {Array<SearchHighlightRange>} [ranges] */
  function highlightedSearchText(text, ranges = []) {
    const raw = String(text || "");
    if (!raw) return "";
    const normalizedRanges = Array.isArray(ranges)
      ? ranges
        .map((range) => ({
          start: Math.max(0, Math.min(raw.length, Number(range?.start) || 0)),
          end: Math.max(0, Math.min(raw.length, Number(range?.end) || 0))
        }))
        .filter((range) => range.end > range.start)
        .sort((first, second) => first.start - second.start || first.end - second.end)
      : [];
    let cursor = 0;
    let markup = "";
    normalizedRanges.forEach((range) => {
      if (range.start < cursor) return;
      markup += escapeSearchMarkup(raw.slice(cursor, range.start));
      markup += `<mark class="search-match-highlight">${escapeSearchMarkup(raw.slice(range.start, range.end))}</mark>`;
      cursor = range.end;
    });
    return markup + escapeSearchMarkup(raw.slice(cursor));
  }

  /** @param {unknown} value */
  function searchResultPage(value) {
    const page = Number.parseInt(String(value), 10);
    return Number.isFinite(page) && page >= 0 ? page : 1;
  }

  /** @param {CatalogSearchResult} result */
  function searchResultDetailsMarkup(result) {
    const page = searchResultPage(result?.page);
    const reason = String(result?.matchReason || "התאמה בטקסט הקטלוג");
    const excerpt = highlightedSearchText(result?.excerpt || "", result?.highlights || []);
    return `
      <span class="search-result-meta">עמוד ${page} · ${escapeSearchMarkup(reason)}</span>
      ${excerpt ? `<span class="search-result-excerpt">${excerpt}</span>` : ""}
    `;
  }

  /** @param {unknown} featureColumns @param {unknown} viewportWidth */
  function lightboxSearchColumnLimit(featureColumns, viewportWidth) {
    const columns = Number(featureColumns);
    if (Number.isFinite(columns)) return Math.max(1, Math.min(columns, 3));
    const width = Math.max(0, Number(viewportWidth) || 0);
    return width >= 1180 ? 3 : width >= 760 ? 2 : 1;
  }

  /** @param {CatalogSearchResult|null|undefined} result @returns {GlobalSearchResultAction|null} */
  function resolveGlobalSearchResultAction(result) {
    if (!result) return null;
    if (result.targetId) return { type: "category", targetId: String(result.targetId) };
    const catalogId = String(result.catalogId || "").trim();
    if (!catalogId) return null;
    if (result.resultType === "catalog") return { type: "catalog", catalogId };
    return { type: "viewer", catalogId, page: searchResultPage(result.page) };
  }

  /** @param {CatalogSearchResult|null|undefined} result @param {GlobalSearchResultPorts} ports */
  function executeGlobalSearchResultAction(result, ports) {
    const action = resolveGlobalSearchResultAction(result);
    if (!action) return false;
    if (action.type === "category") return ports.activateCategoryTarget(action.targetId) === true;
    if (action.type === "catalog") ports.openCatalog(action.catalogId);
    else ports.openViewer(action.catalogId, action.page);
    return true;
  }

  /**
   * @param {CatalogSearchResult|null|undefined} result
   * @param {CatalogRecord|null|undefined} activeCatalog
   * @param {LightboxSearchResultPorts} ports
   */
  function executeLightboxSearchResultAction(result, activeCatalog, ports) {
    if (!result) return false;
    const targetCatalogId = String(result.catalogId || activeCatalog?.id || "").trim();
    if (!targetCatalogId) return false;
    const requestedPage = searchResultPage(result.page);
    const page = clampCatalogPage(requestedPage, activeCatalog);
    if (!activeCatalog || String(activeCatalog.id) !== targetCatalogId) {
      ports.openCatalog(targetCatalogId, requestedPage);
      return true;
    }
    ports.setPage(page);
    ports.showTopUi();
    return true;
  }

  return Object.freeze({
    decodeCatalogHashTargetId,
    catalogColumnCount,
    clampCatalogSpan,
    catalogSubcategorySourceBlocks,
    catalogCategorySegments,
    highlightedSearchText,
    searchResultDetailsMarkup,
    lightboxSearchColumnLimit,
    resolveGlobalSearchResultAction,
    executeGlobalSearchResultAction,
    executeLightboxSearchResultAction
  });

})();

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["search-catalog"] = searchCatalogDomain;
}
/* TEST-ONLY EXPORTS: END */

export { searchCatalogDomain };
