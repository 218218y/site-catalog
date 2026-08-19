"use strict";

import { state } from "../core/state.js";
import { errorMessage, escapeHtml, eventElement } from "../core/format.js";

/**
 * @param {{
 *   elements: ReturnType<typeof import("../core/dom.js").createControlPanelDom>["jobs"],
 *   controlApi: typeof import("../core/api.js").controlApi,
 *   getTaxonomyIssues: () => string[],
 *   onTaxonomyBlocked: (message: string) => void,
 *   reloadState: () => Promise<void>
 * }} dependencies
 */
export function createJobsFeature({ elements, controlApi, getTaxonomyIssues, onTaxonomyBlocked, reloadState }) {
  const els = { actions: elements.actions, jobStatus: elements.status, cancelJob: elements.cancel, jobLog: elements.log, jobHistory: elements.history };
  /** @type {string | null} */
  let activeJobId = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let polling = null;

  function renderActions() {
    const incompleteTaxonomy = getTaxonomyIssues().length > 0;
    els.actions.innerHTML = state.actions.map(action => {
      const taxonomyBlocked = incompleteTaxonomy && ['bundle_r2', 'cloudflare_pages_deploy'].includes(action.key);
      const disabled = Boolean(action.disabled || taxonomyBlocked);
      const reason = taxonomyBlocked ? 'יש להשלים את שדות הטקסונומיה לפני בנייה או העלאה.' : (action.disabledReason || '');
      return `<div class="action">
        <strong>${escapeHtml(action.label)}</strong>
        <p>${escapeHtml(action.description)}</p>
        ${reason ? `<p class="taxonomy-usage">${escapeHtml(reason)}</p>` : ''}
        <button type="button" data-action="${escapeHtml(action.key)}" ${disabled ? 'disabled' : ''}>הפעל</button>
      </div>`;
    }).join('');
  }

  /** @param {ControlJobDto | null | undefined} job */
  function syncJobCancelButton(job) {
    const active = Boolean(job && ['running', 'canceling'].includes(job.status));
    els.cancelJob.hidden = !active;
    els.cancelJob.disabled = !active || job?.status === 'canceling';
    els.cancelJob.textContent = job?.status === 'canceling' ? 'עוצר ומחזיר מצב קודם…' : 'עצירת הפעולה';
  }

  async function cancelActiveJob() {
    if (!activeJobId || !confirm('לעצור את הפעולה הפעילה? אם התחילה עסקה, המערכת תחזיר את המצב הקודם לפני שתאפשר פעולה חדשה.')) return;
    els.cancelJob.disabled = true;
    els.cancelJob.textContent = 'עוצר ומחזיר מצב קודם…';
    try {
      const payload = await controlApi.cancelJob(activeJobId);
      syncJobCancelButton(payload.job);
      pollJob();
    } catch (error) {
      els.jobStatus.textContent = errorMessage(error);
      els.jobStatus.className = 'toast err';
      els.cancelJob.disabled = false;
      els.cancelJob.textContent = 'עצירת הפעולה';
    }
  }

  /** @param {string} actionKey */
  async function runAction(actionKey) {
    const action = state.actions.find(item => item.key === actionKey);
    if (!action) return;
    if (action.disabled || (['bundle_r2', 'cloudflare_pages_deploy'].includes(action.key) && getTaxonomyIssues().length)) {
      onTaxonomyBlocked(action.disabledReason || 'יש להשלים את שדות הטקסונומיה לפני בנייה או העלאה.');
      return;
    }
    let pruneMissingPdfs = false;
    const conversionActions = ['convert', 'convert_force', 'refresh_ocr'];
    if (conversionActions.includes(action.key) && state.configuredMissingPdfs.length) {
      const missingList = state.configuredMissingPdfs
        .map(item => `• ${item.title || item.id} — ${item.pdf}`)
        .join('\n');
      pruneMissingPdfs = confirm(
        `נמצאו ${state.configuredMissingPdfs.length} קטלוגים שמקור ה־PDF שלהם חסר:\n\n${missingList}\n\n` +
        'אישור יסיר במפורש את הקטלוגים החסרים מהרשימה, מהתמונות ומאינדקס החיפוש. ביטול יעצור בלי לשנות דבר.'
      );
      if (!pruneMissingPdfs) return;
    } else if (!confirm(`להפעיל: ${action.label}?`)) {
      return;
    }
    els.jobLog.textContent = 'מתחיל הרצה...';
    els.jobStatus.textContent = 'רץ...';
    els.jobStatus.className = 'toast status-running';
    try {
      const payload = await controlApi.runAction({
        action: actionKey,
        pruneMissingPdfs,
        confirmedMissingPdfIds: pruneMissingPdfs ? state.configuredMissingPdfs.map(item => item.id) : []
      });
      if (!payload.job) throw new Error('השרת לא החזיר פרטי עבודה תקינים.');
      activeJobId = payload.job.id;
      syncJobCancelButton(payload.job);
      pollJob();
    } catch (error) {
      els.jobLog.textContent = errorMessage(error);
      els.jobStatus.textContent = 'נכשל בהתחלה';
      els.jobStatus.className = 'toast err';
    }
  }

  async function pollJob() {
    if (!activeJobId) return;
    if (polling !== null) clearTimeout(polling);
    try {
      const job = await controlApi.getJob(activeJobId);
      els.jobLog.textContent = (job.log || []).join('\n') || 'אין עדיין פלט.';
      els.jobLog.scrollTop = els.jobLog.scrollHeight;
      els.jobStatus.textContent = `${job.label} · ${statusText(job.status)}`;
      els.jobStatus.className = `toast status-${job.status}`;
      syncJobCancelButton(job);
      if (['running', 'canceling'].includes(job.status)) {
        polling = setTimeout(pollJob, 500);
      } else {
        activeJobId = null;
        syncJobCancelButton(null);
        await reloadState();
      }
    } catch (error) {
      els.jobStatus.textContent = errorMessage(error);
      els.jobStatus.className = 'toast err';
    }
  }

  /** @param {ControlJobDto["status"]} status @returns {string} */
  function statusText(status) {
    if (status === 'running') return 'רץ';
    if (status === 'canceling') return 'נעצר ומחזיר מצב קודם';
    if (status === 'canceled') return 'נעצר והמצב הקודם שוחזר';
    if (status === 'success') return 'הסתיים בהצלחה';
    if (status === 'failed') return 'נכשל';
    return status;
  }

  /** @param {ControlJobDto[]} jobs */
  function renderJobHistory(jobs) {
    els.jobHistory.innerHTML = (jobs || []).slice(0, 5).map(job => `<div class="job-line">
      <strong>${escapeHtml(job.label)}</strong>
      <span class="status-${escapeHtml(job.status)}">${escapeHtml(statusText(job.status))}</span>
    </div>`).join('');
  }


  /** @param {ControlJobDto[]} jobs */
  function syncFromServer(jobs) {
    renderJobHistory(jobs);
    const activeJob = jobs.find(job => ["running", "canceling"].includes(job.status));
    if (activeJob && activeJobId !== activeJob.id) {
      activeJobId = activeJob.id;
      pollJob();
    } else if (!activeJob && !activeJobId) {
      syncJobCancelButton(null);
    }
  }

  function bind() {
    els.cancelJob.addEventListener("click", cancelActiveJob);
    els.actions.addEventListener("click", event => {
      const button = eventElement(event)?.closest("[data-action]");
      if (button instanceof HTMLElement && button.dataset.action) runAction(button.dataset.action);
    });
  }

  /** @param {string} message */
  function showLoadError(message) {
    els.actions.innerHTML = '<div class="notice">הפעל <span dir="ltr">.04-catalog-control-panel.bat</span> מתוך תיקיית הפרויקט, ואז הדף ייטען עם כל הקטלוגים והכפתורים.</div>';
    els.jobLog.textContent = message;
    els.jobStatus.textContent = "שגיאה בטעינת מצב";
    els.jobStatus.className = "toast err";
  }

  return Object.freeze({ bind, renderActions, syncFromServer, showLoadError });
}
