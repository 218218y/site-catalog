interface ControlCatalogStatusDto {
  state: string;
  label: string;
}

interface ControlCatalogDto {
  [key: string]: unknown;
  id: string;
  originalId?: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  pdf: string;
  ocr: boolean;
  status?: ControlCatalogStatusDto;
}

interface ControlTaxonomyItemDto {
  [key: string]: string | undefined;
  name: string;
  slug: string;
  description: string;
  originalName?: string;
  category?: string;
  originalCategory?: string;
}

interface ControlTaxonomyAutoAddedDto {
  categories: string[];
  subcategories: string[];
}

interface ControlTaxonomyStateDto {
  categories: ControlTaxonomyItemDto[];
  subcategories: ControlTaxonomyItemDto[];
  issues: Array<string | { label?: string }>;
  complete: boolean;
  autoAdded: ControlTaxonomyAutoAddedDto;
}

interface ControlActionDto {
  key: string;
  label: string;
  description: string;
  disabled: boolean;
  disabledReason: string;
}

interface ControlCountsDto {
  catalogs?: number;
  pdfs?: number;
  missingPdfs?: number;
  configuredMissingPdfs?: number;
  converted?: number;
  ocrDisabled?: number;
  taxonomyMissing?: number;
}

interface ControlPdfFileDto {
  name: string;
  path: string;
  folder?: string;
  size?: number;
  status?: string;
}

interface ControlMissingPdfDto {
  id: string;
  title: string;
  pdf: string;
}

interface ControlMutationDto {
  active?: boolean;
  action?: string;
  startedAt?: number | null;
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
  id?: string;
  title?: string;
  description?: string;
  fields?: ControlFooterFieldDto[];
}

interface ControlFooterEditorDto {
  groups: ControlFooterGroupDto[];
}

interface ControlJobDto {
  id: string;
  actionKey: string;
  label: string;
  status: string;
  returncode?: number | null;
  startedAt: number;
  finishedAt?: number | null;
  cancelRequested?: boolean;
  cancelRequestedAt?: number | null;
  log?: string[];
}

interface ControlAssetDeleteDto {
  id: string;
  originalId?: string;
  pdf?: string;
  deletePdf?: boolean;
  deletePages?: boolean;
}

interface ControlPanelStateDto {
  apiVersion: 1;
  catalogs: ControlCatalogDto[];
  taxonomy: ControlTaxonomyStateDto;
  footer: Record<string, string>;
  footerEditor: ControlFooterEditorDto;
  actions: ControlActionDto[];
  counts: ControlCountsDto;
  pdfFiles: ControlPdfFileDto[];
  configuredMissingPdfs: ControlMissingPdfDto[];
  mutation: ControlMutationDto;
  jobs: ControlJobDto[];
}

interface ControlPanelState extends Omit<ControlPanelStateDto, "jobs"> {
  pendingAssetDeletes: ControlAssetDeleteDto[];
  pdfUploadCatalogIndex: number | null;
  deleteDialogIndex: number | null;
  activeJobId: string | null;
  polling: ReturnType<typeof setTimeout> | null;
}

interface ControlApiResponse extends Partial<ControlPanelStateDto> {
  ok?: boolean;
  error?: string;
  state?: ControlPanelStateDto;
  job?: ControlJobDto;
  jobs?: ControlJobDto[];
  warnings?: string[];
  routeLockUpdates?: string[];
  deletedAssets?: string[];
  updatedPages?: string[];
  footer?: Record<string, string>;
  pdf?: ControlPdfFileDto;
  pdfFiles?: ControlPdfFileDto[];
  canceled?: boolean;
  errors?: string[];
}

interface ControlElements {
  stats: HTMLElement;
  rows: HTMLTableSectionElement;
  actions: HTMLElement;
  filter: HTMLInputElement;
  save: HTMLButtonElement;
  saveStatus: HTMLElement;
  footerSave: HTMLButtonElement;
  footerSaveStatus: HTMLElement;
  footerEditorGroups: HTMLElement;
  taxonomySummary: HTMLElement;
  taxonomyAlert: HTMLElement;
  taxonomyCategories: HTMLElement;
  taxonomySubcategories: HTMLElement;
  taxonomySave: HTMLButtonElement;
  taxonomySaveStatus: HTMLElement;
  taxonomyAddCategory: HTMLButtonElement;
  taxonomyAddSubcategory: HTMLButtonElement;
  jobStatus: HTMLElement;
  cancelJob: HTMLButtonElement;
  jobLog: HTMLElement;
  jobHistory: HTMLElement;
  refresh: HTMLButtonElement;
  serverAlert: HTMLElement;
  pdfFileInput: HTMLInputElement;
  deleteCatalogBackdrop: HTMLElement;
  deleteCatalogTitle: HTMLElement;
  deleteCatalogSummary: HTMLElement;
  deleteCatalogCancel: HTMLButtonElement;
  deleteCatalogListOnly: HTMLButtonElement;
  deleteCatalogWithAssets: HTMLButtonElement;
}

interface CatalogBlock {
  key: string;
  label: string;
  start: number;
  end: number;
  count: number;
}

interface SubcategoryBlock extends CatalogBlock {
  categoryStart: number;
  categoryEnd: number;
}
