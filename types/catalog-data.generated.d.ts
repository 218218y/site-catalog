// Generated from schemas/catalogs.generated.schema.json. Do not edit manually.
// Regenerate with: python tools/generate_catalog_data_types.py

export type CatalogPageSize = [number, number];

export interface CatalogImageVariant {
  directory: string;
  maxSide: number;
  version: string;
}

export interface CatalogRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  pages: number;
  pageNumberStart: 0 | 1;
  dir: string;
  cover: string;
  imageExt: "webp" | "jpg" | "png";
  assetVersion: string;
  imageVariants: {
    thumb: CatalogImageVariant & {
      directory?: "thumbs";
    };
    medium: CatalogImageVariant & {
      directory?: "medium";
    };
    full: CatalogImageVariant & {
      directory?: "";
    };
  };
  pageSizes?: Array<CatalogPageSize>;
  sort?: number;
  badge?: string;
}

export type CatalogImageTier = keyof CatalogRecord["imageVariants"];
export type CatalogData = Array<CatalogRecord>;
