"use strict";

import { controlApi } from "./core/api.js";
import { createControlPanelDom } from "./core/dom.js";
import { errorMessage } from "./core/format.js";
import { applyServerState, state } from "./core/state.js";
import { createCatalogsFeature } from "./features/catalogs.js";
import { createFooterFeature } from "./features/footer.js";
import { createJobsFeature } from "./features/jobs.js";
import { createPdfFeature } from "./features/pdf.js";
import { createSystemFeature } from "./features/system.js";
import { createTaxonomyFeature } from "./features/taxonomy.js";

const dom = createControlPanelDom();
const system = createSystemFeature(dom.system);

/** @type {ReturnType<typeof createCatalogsFeature>} */
let catalogs;
/** @type {ReturnType<typeof createJobsFeature>} */
let jobs;
/** @type {ReturnType<typeof createPdfFeature>} */
let pdf;

const taxonomy = createTaxonomyFeature({
  elements: dom.taxonomy,
  controlApi,
  applyCanonicalState,
  onCatalogsChanged: () => catalogs.render(),
  onCountsChanged: () => system.renderStats(state.counts),
  onTaxonomyChanged: () => jobs.renderActions()
});

catalogs = createCatalogsFeature({
  elements: dom.catalogs,
  controlApi,
  applyCanonicalState,
  taxonomy,
  onCountsChanged: () => system.renderStats(state.counts),
  onPdfRequested: index => pdf.open(index)
});

const footer = createFooterFeature({ elements: dom.footer, controlApi, applyCanonicalState });

jobs = createJobsFeature({
  elements: dom.jobs,
  controlApi,
  getTaxonomyIssues: taxonomy.issues,
  onTaxonomyBlocked: message => taxonomy.showBlockingError(message),
  reloadState: loadState
});

pdf = createPdfFeature({ elements: dom.pdf, controlApi, catalogs });

function renderCanonicalState() {
  system.renderStats(state.counts);
  catalogs.render();
  taxonomy.render();
  footer.render();
  jobs.renderActions();
}

/** @param {ControlPanelStateDto} data @param {{clearPendingAssetDeletes?: boolean}} [options] */
function applyCanonicalState(data, options) {
  applyServerState(data, options);
  renderCanonicalState();
}

async function loadState() {
  const data = await controlApi.getState();
  system.setServerAlert("");
  applyCanonicalState(data, { clearPendingAssetDeletes: true });
  jobs.syncFromServer(data.jobs);
}

/** @param {unknown} error */
function showLoadError(error) {
  const message = errorMessage(error) || "שגיאה בטעינת מצב";
  system.setServerAlert(message);
  system.clearStats();
  catalogs.showLoadError();
  taxonomy.showLoadError();
  footer.showLoadError();
  jobs.showLoadError(message);
}

catalogs.bind();
taxonomy.bind();
footer.bind();
jobs.bind();
pdf.bind();
system.bind(() => { loadState().catch(showLoadError); });

loadState().catch(showLoadError);
