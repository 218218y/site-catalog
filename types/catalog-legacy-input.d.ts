/**
 * Compatibility-only catalog input accepted at the browser boundary.
 * Canonical compiled catalog data is defined exclusively by
 * catalog-data.generated.d.ts and must not acquire these legacy fields.
 */
export interface LegacyCatalogRecordInput {
  subCategory?: string | string[];
  sub_category?: unknown;
  subcategories?: unknown;
  "תת קטגוריה"?: unknown;
  "תת_קטגוריה"?: unknown;
  format?: string;
  thumbDir?: string;
  mediumDir?: string;
}
