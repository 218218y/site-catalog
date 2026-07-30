// Generated from schemas/control-panel-api.schema.json. Do not edit manually.

interface ControlCatalogStatusDto {
  state: string;
  label: string;
}

interface ControlCatalogDto {
  id: string;
  originalId: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  pdf: string;
  ocr: boolean;
  pageNumberStart: 0 | 1;
  status: ControlCatalogStatusDto;
}

interface ControlTaxonomyItemDto {
  name: string;
  slug: string;
  description: string;
  originalName?: string;
  category?: string;
  originalCategory?: string;
}

type ControlTaxonomyIssueDto = string | {
  label?: string;
};

interface ControlTaxonomyAutoAddedDto {
  categories: Array<string>;
  subcategories: Array<string>;
}

interface ControlTaxonomyStateDto {
  categories: Array<ControlTaxonomyItemDto>;
  subcategories: Array<ControlTaxonomyItemDto>;
  issues: Array<ControlTaxonomyIssueDto>;
  complete: boolean;
  autoAdded: ControlTaxonomyAutoAddedDto;
  usage: ControlTaxonomyUsageDto;
}

interface ControlActionDto {
  key: string;
  label: string;
  description: string;
  disabled: boolean;
  disabledReason: string;
}

interface ControlCountsDto {
  catalogs: number;
  pdfs: number;
  missingPdfs: number;
  configuredMissingPdfs: number;
  converted: number;
  ocrDisabled: number;
  taxonomyMissing: number;
}

interface ControlFilesDto {
  config: string;
  taxonomy: string;
  generated: boolean;
  search: boolean;
  pdfDir: string;
  pagesDir: string;
  footerContent: string;
}

interface ControlPdfFileDto {
  name: string;
  path: string;
  folder?: string;
  label?: string;
  size?: number;
  modifiedAt?: number;
  status?: string;
}

interface ControlMissingPdfDto {
  id: string;
  title: string;
  pdf: string;
}

interface ControlMutationDto {
  active: boolean;
  action: string;
  startedAt: number | null;
}

interface ControlFooterFieldDto {
  key: string;
  label?: string;
  value?: string;
  dir?: string;
  required?: boolean;
  help?: string;
  type?: string;
  rows?: number;
  maxLength?: number;
}

interface ControlFooterGroupDto {
  id: string;
  title: string;
  description: string;
  fields: Array<ControlFooterFieldDto>;
}

interface ControlFooterEditorDto {
  groups: Array<ControlFooterGroupDto>;
}

interface ControlJobDto {
  id: string;
  actionKey: string;
  label: string;
  status: string;
  returncode: number | null;
  startedAt: number;
  finishedAt: number | null;
  cancelRequested: boolean;
  cancelRequestedAt: number | null;
  log?: Array<string>;
}

interface ControlAssetDeleteDto {
  id: string;
  originalId: string;
  pdf: string;
  deletePdf: boolean;
  deletePages: boolean;
}

interface ControlPanelStateDto {
  apiVersion: 1;
  catalogs: Array<ControlCatalogDto>;
  taxonomy: ControlTaxonomyStateDto;
  footer: Record<string, string>;
  footerEditor: ControlFooterEditorDto;
  actions: Array<ControlActionDto>;
  counts: ControlCountsDto;
  files: ControlFilesDto;
  pdfFiles: Array<ControlPdfFileDto>;
  configuredMissingPdfs: Array<ControlMissingPdfDto>;
  mutation: ControlMutationDto;
  jobs: Array<ControlJobDto>;
}

interface ControlTaxonomyDraftDto {
  categories: Array<ControlTaxonomyItemDto>;
  subcategories: Array<ControlTaxonomyItemDto>;
}

interface CatalogSaveRequestDto {
  catalogs: Array<ControlCatalogDto>;
  taxonomy: ControlTaxonomyDraftDto;
  assetDeletes?: Array<ControlAssetDeleteDto>;
}

interface TaxonomySaveRequestDto {
  taxonomy: ControlTaxonomyDraftDto;
}

interface FooterSaveRequestDto {
  footer: Record<string, string>;
}

interface RunActionRequestDto {
  action: string;
  pruneMissingPdfs?: boolean;
  confirmedMissingPdfIds?: Array<string>;
}

interface PdfPickRequestDto {
  currentPdf: string;
}

interface EmptyRequestDto {
}

interface ErrorResponseDto {
  ok: false;
  error: string;
}

interface PdfListResponseDto {
  pdfs: Array<ControlPdfFileDto>;
  pdfDir: string;
}

interface JobListResponseDto {
  jobs: Array<ControlJobDto>;
}

interface PdfPickCanceledResponseDto {
  ok: true;
  canceled: true;
  errors: Array<string>;
}

interface PdfSelectionResponseDto {
  ok: true;
  pdf: ControlPdfFileDto;
  pdfFiles: Array<ControlPdfFileDto>;
  state: ControlPanelStateDto;
}

type PdfPickResponseDto = PdfPickCanceledResponseDto | PdfSelectionResponseDto;

type PdfUploadResponseDto = PdfSelectionResponseDto;

interface CancelJobResponseDto {
  ok: true;
  job: ControlJobDto;
}

interface FooterSaveResponseDto {
  ok: true;
  footer: Record<string, string>;
  state: ControlPanelStateDto;
  updatedPages: Array<string>;
}

interface CatalogSaveResponseDto {
  ok: true;
  state: ControlPanelStateDto;
  warnings: Array<string>;
  autoAddedTaxonomy: ControlTaxonomyAutoAddedDto;
  grouped: true;
  deletedAssets: Array<string>;
  routeLockUpdates: Array<string>;
}

interface TaxonomySaveResponseDto {
  ok: true;
  state: ControlPanelStateDto;
  warnings: Array<string>;
  autoAddedTaxonomy: ControlTaxonomyAutoAddedDto;
  routeLockUpdates: Array<string>;
}

interface RunActionResponseDto {
  ok: true;
  job: ControlJobDto;
}

interface ControlTaxonomyUsageSubcategoryDto {
  category: string;
  name: string;
  count: number;
}

interface ControlTaxonomyUsageDto {
  categories: Record<string, number>;
  subcategories: Array<ControlTaxonomyUsageSubcategoryDto>;
}
