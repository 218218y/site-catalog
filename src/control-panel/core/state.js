"use strict";

const EMPTY_TAXONOMY = () => ({
  categories: [],
  subcategories: [],
  issues: [],
  usage: { categories: {}, subcategories: [] },
  complete: true,
  autoAdded: { categories: [], subcategories: [] }
});

/** @type {ControlPanelClientState} */
export const state = {
  apiVersion: 1,
  catalogs: [],
  taxonomy: EMPTY_TAXONOMY(),
  footer: {},
  footerEditor: { groups: [] },
  actions: [],
  counts: { catalogs: 0, pdfs: 0, missingPdfs: 0, configuredMissingPdfs: 0, converted: 0, ocrDisabled: 0, taxonomyMissing: 0 },
  files: { config: "", taxonomy: "", generated: false, search: false, pdfDir: "", pagesDir: "", footerContent: "" },
  pdfFiles: [],
  configuredMissingPdfs: [],
  mutation: { active: false, action: "", startedAt: null },
  pendingAssetDeletes: [],
  pdfUploadCatalogIndex: null,
  deleteDialogIndex: null
};

/** @param {ControlPanelStateDto | undefined} data @param {{clearPendingAssetDeletes?: boolean}} [options] */
export function applyServerState(data, { clearPendingAssetDeletes = false } = {}) {
  if (!data || data.apiVersion !== 1) {
    throw new Error("גרסת API לא תואמת. רענן את לוח השליטה והפעל מחדש את השרת.");
  }
  state.apiVersion = data.apiVersion;
  state.catalogs = data.catalogs.map(catalog => ({ ...catalog, originalId: catalog.originalId || catalog.id }));
  state.actions = [...data.actions];
  state.taxonomy = {
    ...data.taxonomy,
    categories: data.taxonomy.categories.map(item => ({ ...item })),
    subcategories: data.taxonomy.subcategories.map(item => ({ ...item })),
    issues: [...data.taxonomy.issues],
    usage: { categories: { ...data.taxonomy.usage.categories }, subcategories: data.taxonomy.usage.subcategories.map(item => ({ ...item })) },
    autoAdded: {
      categories: [...data.taxonomy.autoAdded.categories],
      subcategories: [...data.taxonomy.autoAdded.subcategories]
    }
  };
  state.footer = { ...data.footer };
  state.footerEditor = { groups: data.footerEditor.groups.map(group => ({ ...group, fields: group.fields.map(field => ({ ...field })) })) };
  state.counts = { ...data.counts };
  state.files = { ...data.files };
  state.pdfFiles = data.pdfFiles.map(item => ({ ...item }));
  state.configuredMissingPdfs = data.configuredMissingPdfs.map(item => ({ ...item }));
  state.mutation = { ...data.mutation };
  if (clearPendingAssetDeletes) state.pendingAssetDeletes = [];
}
