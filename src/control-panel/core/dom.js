"use strict";

/** @template {HTMLElement} T @param {string} id @param {{new(): T}} elementType @returns {T} */
function requiredElement(id, elementType) {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) {
    throw new Error(`Control panel markup #${id} must be a ${elementType.name}`);
  }
  return element;
}

export function createControlPanelDom() {
  return {
    system: {
      stats: requiredElement("stats", HTMLElement),
      refresh: requiredElement("refreshState", HTMLButtonElement),
      serverAlert: requiredElement("serverAlert", HTMLElement)
    },
    catalogs: {
      rows: requiredElement("catalogRows", HTMLTableSectionElement),
      filter: requiredElement("catalogFilter", HTMLInputElement),
      save: requiredElement("saveCatalogs", HTMLButtonElement),
      saveStatus: requiredElement("saveStatus", HTMLElement),
      deleteCatalogBackdrop: requiredElement("deleteCatalogBackdrop", HTMLElement),
      deleteCatalogTitle: requiredElement("deleteCatalogTitle", HTMLElement),
      deleteCatalogSummary: requiredElement("deleteCatalogSummary", HTMLElement),
      deleteCatalogCancel: requiredElement("deleteCatalogCancel", HTMLButtonElement),
      deleteCatalogListOnly: requiredElement("deleteCatalogListOnly", HTMLButtonElement),
      deleteCatalogWithAssets: requiredElement("deleteCatalogWithAssets", HTMLButtonElement)
    },
    taxonomy: {
      summary: requiredElement("taxonomySummary", HTMLElement),
      alert: requiredElement("taxonomyAlert", HTMLElement),
      categories: requiredElement("taxonomyCategories", HTMLElement),
      subcategories: requiredElement("taxonomySubcategories", HTMLElement),
      save: requiredElement("saveTaxonomy", HTMLButtonElement),
      saveStatus: requiredElement("taxonomySaveStatus", HTMLElement),
      addCategory: requiredElement("addTaxonomyCategory", HTMLButtonElement),
      addSubcategory: requiredElement("addTaxonomySubcategory", HTMLButtonElement),
      title: requiredElement("taxonomyCategoriesTitle", HTMLElement)
    },
    footer: {
      save: requiredElement("saveFooter", HTMLButtonElement),
      saveStatus: requiredElement("footerSaveStatus", HTMLElement),
      editorGroups: requiredElement("footerEditorGroups", HTMLElement)
    },
    jobs: {
      actions: requiredElement("actions", HTMLElement),
      status: requiredElement("jobStatus", HTMLElement),
      cancel: requiredElement("cancelJob", HTMLButtonElement),
      log: requiredElement("jobLog", HTMLElement),
      history: requiredElement("jobHistory", HTMLElement)
    },
    pdf: {
      fileInput: requiredElement("pdfFileInput", HTMLInputElement)
    }
  };
}
