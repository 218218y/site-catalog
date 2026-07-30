interface ControlPanelClientState extends Omit<ControlPanelStateDto, "jobs"> {
  pendingAssetDeletes: ControlAssetDeleteDto[];
  pdfUploadCatalogIndex: number | null;
  deleteDialogIndex: number | null;
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
