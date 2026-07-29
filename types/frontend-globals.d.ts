interface CatalogSearchApi {
  search(query: string, options?: Record<string, unknown>): Promise<CatalogSearchResult[]>;
  cancel(channel?: string): void;
  ensureReady(): Promise<boolean>;
  isReady(): boolean;
  isCancelledError(error: unknown): boolean;
  normalize(value: unknown): string;
  normalizeLoose(value: unknown): string;
  tokenize(value: unknown): string[];
  parseQuery(value: unknown): Record<string, unknown>;
  hasIndex(options?: Record<string, unknown>): boolean;
  indexedPageCount(): number;
  findCatalog(id: string): CatalogRecord | null;
  pageSrc(catalog: CatalogRecord, page: number): string;
  thumbSrc(catalog: CatalogRecord, page: number): string;
  makeExcerpt(text: unknown, query: unknown, maxLength?: number): string;
  catalogMatchesCategory(catalog: CatalogRecord, category: string): boolean;
  searchNavigation(groups: unknown[], query: string, options?: Record<string, unknown>): CatalogSearchResult[];
  mergeNavigationResults(navigationResults: CatalogSearchResult[], pageResults: CatalogSearchResult[], options?: Record<string, unknown>): CatalogSearchResult[];
  navigationResultMarkup(result: CatalogSearchResult): string;
}

interface ParsedSiteRoute {
  page: string;
  catalogId: string;
  currentPage: number;
  source: string;
}

interface SiteRoutesApi {
  normalizePage(page: unknown): string;
  pageFromLocation(locationLike: Location, declaredPage?: string): string;
  isSameAppDocumentLocation(current: Location, target: URL, currentPage?: string): boolean;
  homeUrl(): string;
  catalogUrl(catalogId: string): string;
  categoryUrl(categorySlug: string, subcategorySlug?: string): string;
  favoritesUrl(): string;
  viewerUrl(catalogId: string, page?: number, options?: Record<string, unknown>): string;
  parseLocation(locationLike: Location, declaredPage?: string): ParsedSiteRoute;
}

interface FavoritesRuntimeApi {
  normalizeItems(values: unknown): FavoriteItem[];
  createStore(options: { storage: Storage | null }): FavoritesStore;
}

interface BargigTooltipsApi {
  hydrate(element: Element): void;
  getText(element: Element | null): string;
  getDefaultText(element: Element | null): string;
  setText(element: Element | null, text: string, options?: Record<string, unknown>): void;
  restoreDefault(element: Element | null): void;
  hide(): void;
  suppress(duration?: number, options?: Record<string, unknown>): void;
}

interface CatalogSnapshotApi {
  buildSnapshotBlob(src: string): Promise<Blob>;
  extension: string;
}

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
}

interface NavigatorUAData {
  mobile?: boolean;
  platform?: string;
}

interface Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  msDoNotTrack?: string | null;
  userAgentData?: NavigatorUAData;
  globalPrivacyControl?: boolean;
}

interface Window {
  BARGIG_CATALOGS?: CatalogRecord[];
  BARGIG_CATALOG_ASSET_BASE_URL?: string;
  BARGIG_CATALOG_IMAGE_DELIVERY_MODE?: string;
  BARGIG_CATALOG_TAXONOMY?: Record<string, unknown>;
  BargigCatalogSearch?: CatalogSearchApi;
  BargigRoutes?: SiteRoutesApi;
  BargigFavorites?: FavoritesRuntimeApi;
  BargigTooltips?: BargigTooltipsApi;
  CatalogSnapshot?: CatalogSnapshotApi;
  __BARGIG_RELEASE_ID__?: string;
  __BARGIG_DISABLE_TELEMETRY__?: boolean;
  __BARGIG_ENABLE_TELEMETRY__?: boolean;
  __BARGIG_ENABLE_VITALS_DIAGNOSTICS__?: boolean;
  __BARGIG_WEB_VITALS__?: Record<string, unknown>;
  doNotTrack?: string | null;
}

interface Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

interface HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface PerformanceEntry {
  type?: string;
  value?: number;
  hadRecentInput?: boolean;
}

interface PerformanceObserverInit {
  durationThreshold?: number;
}

declare const featureCapabilities: FeatureCapabilities;
declare const SEARCH_INDEX_SCRIPT_SRC: string;

/** Test-only source export registry stripped from production bundles. */
declare var __BARGIG_TEST_EXPORTS__: Record<string, unknown> | undefined;

declare const __BARGIG_FEATURE_CAPABILITIES__: FeatureCapabilities;
