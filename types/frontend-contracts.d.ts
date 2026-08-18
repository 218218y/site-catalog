/**
 * Module-scoped frontend contracts.
 *
 * These declarations are imported explicitly by each JavaScript module; they
 * intentionally do not contribute names to the global TypeScript namespace.
 */
import type { CatalogImageVariant, CatalogRecord } from "./catalog-data.generated.js";

export type { CatalogImageVariant, CatalogRecord } from "./catalog-data.generated.js";

export type SearchHighlightRange = {
    start?: number;
    end?: number;
};
export type CatalogSubcategoryGroup = {
    subcategory: string;
    items: Array<CatalogRecord>;
};
export type CatalogCategoryGroup = {
    category: string;
    items: Array<CatalogRecord>;
    directItems: Array<CatalogRecord>;
    subcategories: Array<CatalogSubcategoryGroup>;
    subcategoryMap?: Map<string, CatalogSubcategoryGroup>;
    hasSubcategories?: boolean;
};
export type CatalogSearchResult = {
    catalogId?: string;
    page?: number | string;
    catalog?: CatalogRecord | null;
    title?: string;
    excerpt?: string;
    kind?: string;
    resultType?: string;
    label?: string;
    category?: string;
    subcategory?: string;
    score?: number;
    sourceOrder?: number;
    matchField?: string;
    targetId?: string;
    catalogTitle?: string;
    image?: string;
    thumb?: string;
    matchReason?: string;
    highlights?: Array<SearchHighlightRange>;
    categoryTarget?: string;
    subcategoryTarget?: string;
};
export type NavigationState = {
    catalog: CatalogRecord | null;
    page: number;
    lightboxSource: string;
};
export type CatalogState = {
    catalogLayoutColumns: number;
    catalogLayoutResizeTimer: number;
    catalogScrollTopButtonRaf: number;
    categoryFocusTargetId: string;
    categoryFocusTimer: number;
    categoryNavFitRaf: number;
};
export type SearchState = {
    globalSearchCategory: string;
    globalSearchOpen: boolean;
    lightboxSearchScope: string;
    lightboxMobileSearchOpen: boolean;
    searchIndexLoadState: string;
    searchIndexLoadPromise: Promise<boolean> | null;
    searchIndexPreloadTimer: number;
    searchPreviewSuppressUntil: number;
    searchPreviewSuppressTimer: number;
    searchPreviewPointerClientX: number | null;
    searchPreviewPointerClientY: number | null;
};
export type FavoritesState = {
    favoritesViewerIndex: number;
    favoritesViewerOpeningHash: string;
    favoritesViewerPreviousCatalog: CatalogRecord | null;
    favoritesViewerPreviousPage: number;
    favoritesOpen: boolean;
    favoritesReturnFocus: HTMLElement | null;
    favoritesTransferPending: FavoritesTransfer | null;
    favoritesTransferReturnFocus: HTMLElement | null;
    favoritesFilterCatalogId: string;
    favoritesSelectedKeys: Set<string>;
    favoritesDragKey: string;
    favoriteNoteEditingKey: string;
    favoriteNoteReturnFocus: HTMLElement | null;
};
export type ViewerSessionState = {
    viewerPhase: string;
    viewerPhaseReason: string;
    viewerFullscreenPhase: string;
    viewerFullscreenReason: string;
};
export type ViewerViewportState = {
    zoom: number;
    fitScale: number;
    imageFitMode: string;
    imageFitModeSource: string;
    singleImageFitOriginPending: boolean;
    singleImagePendingRelativePosition: ViewerRelativePosition | null;
    singleImagePendingPageTurnOrigin: ViewerPageTurnOrigin | null;
    panX: number;
    panY: number;
};
export type ViewerGestureState = {
    dragStartX: number;
    dragStartY: number;
    dragStartPanX: number;
    dragStartPanY: number;
    lastTapAt: number;
    lastTapX: number;
    lastTapY: number;
    lastTapSurface: string;
    suppressNextDblClickUntil: number;
    pinchStartDistance: number;
    pinchStartZoom: number;
    pinchLastMidX: number;
    pinchLastMidY: number;
    pointerGestureHadMultiplePointers: boolean;
    pointerGestureConsumedPan: boolean;
    pointers: Map<number, ViewerPointerPoint>;
    viewerTouchMomentumRaf: number;
    viewerTouchMomentumVelocityX: number;
    viewerTouchMomentumVelocityY: number;
    viewerTouchMomentumLastTime: number;
};
export type ViewerChromeState = {
    topUiPinned: boolean;
    uiHideTimer: number;
    pageRailHideTimer: number;
    lastTouchLikeViewportInputAt: number;
    lastTouchLikeRailInputAt: number;
    zoomIndicatorHideTimer: number;
    pageIndicatorHideTimer: number;
    viewerMobileMoreOpen: boolean;
};
export type ViewerImageState = {
    singleImageLoadToken: number;
    singleImageAnimationTimer: number;
    singleImageStageAbortController: AbortController | null;
    neighborPreloadTimer: number;
    singleImageResolutionLoadToken: number;
    singleImageResolutionStop: (() => void) | null;
    singleImageResolutionImage: HTMLImageElement | null;
    singleImageResolutionTargetSrc: string;
    singleImageResolutionTargetTier: string;
    singleImageResolutionReady: boolean;
    singleImageResolutionVisible: boolean;
    singleImageResolutionCommitPending: boolean;
    singleImageResolutionRetainedForSwap: boolean;
};
export type ViewerNavigationState = {
    viewerPageWheelAccumulator: number;
    viewerPageWheelBasePage: number;
    viewerPageWheelTargetPage: number;
    viewerPageWheelSettleTimer: number;
    viewerPageWheelResetGestureActive: boolean;
    viewerPageWheelResetLastEventAt: number;
    viewerPageWheelResetLastDelta: number;
    viewerPageWheelResetDirection: number;
};
export type ViewerOnboardingState = {
    viewerOnboardingOpen: boolean;
    viewerOnboardingShownThisSession: boolean;
    viewerOnboardingStep: number;
    viewerOnboardingTarget: HTMLElement | null;
    viewerOnboardingFloatingTargets: Array<ViewerOnboardingFloatingTarget>;
    viewerOnboardingRestoreUi: ViewerOnboardingRestoreUi | null;
    viewerOnboardingLayoutRaf: number;
    viewerOnboardingLayoutTimer: number;
};
export type ViewerRelativePosition = {
    page: number;
    xRatio: number;
    yRatio: number;
};
export type ViewerPageTurnOrigin = {
    page: number;
    direction: -1 | 1;
    axis: "x" | "y";
};
export type ViewerPointerPoint = {
    x: number;
    y: number;
    startX: number;
    startY: number;
    velocityX: number;
    velocityY: number;
    lastTime: number;
};
export type ViewerPanInputResult = {
    moved: boolean;
    bounds: unknown;
    remainingDeltaX: number;
    remainingDeltaY: number;
};
export type ViewerOnboardingFloatingTarget = {
    source: HTMLButtonElement;
    clone: HTMLButtonElement;
    id: string;
    stepId: string;
};
export type ViewerAnimationTimerKey = "singleImageAnimationTimer";
export type ViewerPageSwapAnimationOptions = {
    timerKey: ViewerAnimationTimerKey;
    root?: Element | null;
};
export type CatalogImageCandidate = {
    src: string;
    tier: string;
    role?: string;
};
export type CatalogImageRequest = {
    primarySrc: string;
    primaryTier: string;
    fallbackCandidates: Array<CatalogImageCandidate>;
};
export type ViewerResolutionUpgradeOptions = {
    commit?: boolean;
};
export type ViewerImageSwapOptions = {
    imageRequest?: CatalogImageRequest;
    forceFull?: boolean;
    forceRefresh?: boolean;
    preserveCurrentImage?: boolean;
};
export type ViewerImageRequestOptions = {
    forceFull?: boolean;
    preferMedium?: boolean;
    zoom?: number;
    warmFull?: boolean;
};
export type RectLike = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};
export type PointLike = {
    x: number;
    y: number;
};
export type PositionedPoint = {
    left: number;
    top: number;
};
export type ViewerZoomOptions = {
    showUi?: boolean;
    focalClientX?: number;
    focalClientY?: number;
};
export type ViewerZoomChangeOptions = {
    showUi?: boolean;
};
export type ViewerPanBoundsOptions = {
    allowPageTurnBuffer?: boolean;
};
export type ViewerGeometryResetOptions = {
    queueSingleFitOrigin?: boolean;
};
export type ViewerFrameGeometryOptions = {
    updateFitScale?: boolean;
};
export type ViewerUiVisibilityOptions = {
    resetAutoSingleOrigin?: boolean;
};
export type ViewerRailRenderOptions = {
    scrollIntoView?: boolean;
};
export type ViewerFitModeOptions = {
    showUi?: boolean;
    source?: string;
    refreshLayout?: boolean;
};
export type ViewerPageIndicatorOptions = {
    label?: string;
    detail?: string;
    displayCurrent?: number | string;
    displayTotal?: number | string;
};
export type ViewerOnboardingPlacement = "below" | "above" | "left" | "right";
export type ViewerOnboardingTargetDefinition = {
    source: HTMLButtonElement;
    id: string;
};
export type ViewerOnboardingStep = {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    note?: string;
    target: () => HTMLElement | null;
    targetRect?: () => RectLike | null;
    floatingTargets?: () => Array<ViewerOnboardingTargetDefinition>;
    preferredPlacement: ViewerOnboardingPlacement;
    padding: number;
    radius: number;
    gesture: string;
    viewportMargin?: number;
    revealTopBar?: boolean;
    revealPageRail?: boolean;
};
export type ViewerOnboardingStepOptions = {
    focus?: boolean;
    scheduleLayout?: boolean;
};
export type ViewerOnboardingRestoreUi = {
    showUi: boolean;
    showPageRail: boolean;
};
export type ViewerOnboardingCloseOptions = {
    restoreFocus?: boolean;
    remember?: boolean;
};
export type FeatureCapabilities = {
    viewer: boolean;
    favoritesWorkspace: boolean;
    catalogGrid: boolean;
    search: boolean;
};
export type CatalogImageReadiness = {
    width: number;
    height: number;
};
export type CatalogAssetState = {
    imageLoadCache: Map<string, Promise<CatalogImageReadiness>>;
};
export type UiRuntimeState = {
    actionToastTimer: number;
};
export type FavoriteMutationResult = {
    operation: string;
    changed: boolean;
    persisted: boolean;
    reason: string;
    items: Array<FavoriteItem>;
    active?: boolean;
};
export type FavoritesStore = {
    storageKey: string;
    read: () => Array<FavoriteItem>;
    reload: () => Array<FavoriteItem>;
    status: () => ({
        persisted: boolean;
        reason: string;
    });
    lastMutation: () => FavoriteMutationResult | null;
    has: (item: FavoriteItem) => boolean;
    add: (item: FavoriteItem) => boolean;
    addDetailed: (item: FavoriteItem) => FavoriteMutationResult;
    update: (item: FavoriteItem, patch: Partial<FavoriteItem>) => boolean;
    updateDetailed: (item: FavoriteItem, patch: Partial<FavoriteItem>) => FavoriteMutationResult;
    reorder: (keys: string[]) => boolean;
    reorderDetailed: (keys: string[]) => FavoriteMutationResult;
    toggle: (item: FavoriteItem) => boolean;
    toggleDetailed: (item: FavoriteItem) => FavoriteMutationResult;
    remove: (item: FavoriteItem) => boolean;
    removeDetailed: (item: FavoriteItem) => FavoriteMutationResult;
    clear: () => boolean;
    clearDetailed: () => FavoriteMutationResult;
    replace: (items: Array<FavoriteItem>) => Array<FavoriteItem>;
    replaceDetailed: (items: Array<FavoriteItem>) => FavoriteMutationResult;
    setNote: (item: FavoriteItem, note: string) => boolean;
    setNoteDetailed: (item: FavoriteItem, note: string) => FavoriteMutationResult;
};
export type FavoriteItem = {
    catalogId: string;
    page: number;
    savedAt?: number;
    note?: string;
};
export type FavoritesTransfer = {
    items: FavoriteItem[];
    rejected: number;
    valid?: boolean;
    source?: string;
};
export type FavoriteKeySource = {
    catalogId?: unknown;
    catalog?: CatalogRecord;
    page?: unknown;
};
export type FavoriteMergeAnalysis = {
    incomingItems: FavoriteItem[];
    existingItems: FavoriteItem[];
    newItems: FavoriteItem[];
    alreadyExistingItems: FavoriteItem[];
    mergedItems: FavoriteItem[];
};
export type FavoritesTransferPrepareOptions = {
    returnFocus?: HTMLElement | null;
};
export type FavoriteViewerSyncOptions = {
    preferredIndex?: number;
};
export type FavoritesSyncOptions = {
    renderPanel?: boolean;
};
export type FavoritesPanelOpenOptions = {
    allowEmpty?: boolean;
    captureReturnFocus?: boolean;
};
export type FavoritesPanelCloseOptions = {
    restoreFocus?: boolean;
    preserveReturnFocus?: boolean;
};
export type FavoriteEntry = FavoriteItem & {
    catalog: CatalogRecord;
};
export type ScrollPosition = {
    x?: number;
    y?: number;
};
export type AppNavigationOptions = {
    replace?: boolean;
};
export type CatalogOpenOptions = {
    scroll?: boolean;
    openPage?: number | null;
    scrollBehavior?: ScrollBehavior;
};
export type CatalogFocusOptions = {
    animate?: boolean;
    scroll?: boolean;
    clearHash?: boolean;
    targetId?: string;
};
export type CatalogTargetOptions = {
    toggle?: boolean;
};
export type SearchCloseOptions = {
    focusButton?: boolean;
    returnFocus?: boolean;
    hideResults?: boolean;
    blurTopUiFocus?: boolean;
    hideTopUi?: boolean;
};
export type SearchViewerPrepareOptions = {
    renderCatalogMenu?: boolean;
};
export type DialogCloseOptions = {
    restoreFocus?: boolean;
    cleanUrl?: boolean;
};
export type MobileMenuCloseOptions = {
    focusButton?: boolean;
};
export type ViewerCloseOptions = {
    restoreFavorites?: boolean;
    restoreFocus?: boolean;
};
export type ViewerOpenOptions = {
    source?: string;
    favoriteIndex?: number;
};
export type ViewerRefreshOptions = {
    thumbScrollIntoView?: boolean;
    preserveCurrentImage?: boolean;
};
export type ViewerNavigationSource = "button" | "continuous-reading" | "keyboard" | "home-end" | "page-rail" | "programmatic" | "horizontal-swipe" | "vertical-swipe" | "wheel" | "boundary-pan" | "momentum";
export type ViewerNavigationCommand = Readonly<{
    source: ViewerNavigationSource;
    direction: -1 | 0 | 1;
    axis: "x" | "y";
    zoomMode: "preserve" | "reset";
    positionMode: "relative" | "page-turn" | "fit-origin";
    preservePointerInteraction: boolean;
}>;
export type ViewerSetPageOptions = {
    thumbScrollIntoView?: boolean;
    navigationCommand?: ViewerNavigationCommand;
    navigationSource?: ViewerNavigationSource;
};
export type ViewerStateInvariantSnapshot = {
    phase: string;
    pointerCount: number;
    momentumActive: boolean;
    pendingViewportModes: number;
    resolution: {
        hasImage: boolean;
        hasTarget: boolean;
        hasTier: boolean;
        ready: boolean;
        visible: boolean;
        commitPending: boolean;
        retainedForSwap: boolean;
        loading: boolean;
    };
};
export type InquiryTelemetry = {
    source?: string;
    catalogId?: string;
    pageNumber?: number;
    value?: number;
};
export type InquiryReference = {
    kind: string;
    source: string;
    catalog?: CatalogRecord | null;
    page?: number;
    entries?: Array<FavoriteEntry>;
    count?: number;
    selected?: boolean;
    title: string;
    eyebrow: string;
    description: string;
    referenceTitle: string;
    pageLabel: string;
    subject: string;
    shareText: string;
    text: string;
    url: string;
    previewCatalog?: CatalogRecord;
    previewPage?: number;
    telemetry?: InquiryTelemetry;
};
export type InquiryOpenOptions = {
    restoreFocus?: boolean;
    returnFocus?: HTMLElement | null;
    reference?: InquiryReference;
};
export type NoteEditorCloseOptions = {
    restoreFocus?: boolean;
};
export type FavoriteWorkspaceInquiryOptions = {
    selected?: boolean;
};
export type FavoriteWorkspaceMessageOptions = {
    purpose?: "share" | "inquiry";
};
export type CategoryHashSyncOptions = {
    animate?: boolean;
    scroll?: boolean;
};
export type EscapeFeatureApi = {
    escapePriority: number;
    closeTopLayer: (event?: KeyboardEvent) => boolean;
};
export type NavigationFeatureApi = {
    catalog: () => CatalogRecord | null;
    page: () => number;
    source: () => string;
    setLocation: (catalog: CatalogRecord | null, page?: number, source?: string) => void;
    setPage: (page: number) => void;
    setSource: (source: string) => void;
    clearLocation: () => void;
    setAppPage: (nextPage: string) => void;
    appPage: () => string;
    syncRouteShell: (nextPage: string) => void;
    restoreScroll: (position?: ScrollPosition | null) => void;
    attachEvents: () => void;
};
export type FavoritesFeatureApi = {
    escapePriority: number;
    requiresDocumentLock: () => boolean;
    closeTopLayer: (event?: KeyboardEvent) => boolean;
    attachEvents: () => void;
    entries: () => Array<FavoriteEntry>;
    viewerIndex: () => number;
    setViewerIndex: (index: number) => void;
    findViewerEntryIndex: (entries: Array<FavoriteEntry>, catalogId: string | undefined, page: number) => number;
    selectViewerEntry: (entries: Array<FavoriteEntry>, index: number) => boolean;
    resetViewerSession: () => void;
    syncViewerButton: () => void;
    syncViewerMode: (favoritesMode: boolean) => void;
    syncInquiryTrigger: (open: boolean, activeTrigger?: HTMLElement | null) => void;
    onboardingTarget: () => HTMLButtonElement;
    prepareRoute: (nextPage: string) => void;
    syncUi: () => void;
    openRoute: () => void;
    isPanelOpen: () => boolean;
};
export type InquiryFeatureApi = {
    escapePriority: number;
    requiresDocumentLock: () => boolean;
    isOpen: () => boolean;
    attachEvents: () => void;
    openInquiry: (options?: InquiryOpenOptions) => void;
    close: (options?: DialogCloseOptions) => void;
    closeTopLayer: (event?: KeyboardEvent) => boolean;
    onboardingTarget: () => HTMLButtonElement;
};
export type FavoritesWorkspaceFeatureApi = {
    attachEvents: () => void;
    shareLinkEntries: (entries?: Array<FavoriteEntry>) => Array<FavoriteEntry>;
    copyShareLink: (entries: Array<FavoriteEntry>, button?: Element | null) => Promise<unknown> | unknown;
    render: (entries?: Array<FavoriteEntry>) => void;
    prune: (entries?: Array<FavoriteEntry>) => void;
    handleGridClick: (event: Event) => void;
    closeNoteEditor: (options?: NoteEditorCloseOptions) => void;
};
export type CatalogMenuRenderOptions = {
    activeCatalogId?: string;
    onSelect?: (catalogId: string) => void;
};
export type CatalogGridFeatureApi = {
    attachEvents: () => void;
    initialize: () => void;
    renderInitialContent: () => void;
    setInitialLayoutHydrator: (hydrator: ((grid: HTMLElement, columns: number, catalogs: ReadonlyArray<CatalogRecord>) => boolean)) => void;
    renderEmptyState: () => void;
    openCatalog: (catalogId: string, options?: CatalogOpenOptions) => void;
    closeMobileMenu: (options?: MobileMenuCloseOptions) => void;
    scheduleLayoutRefresh: () => void;
    scheduleCategoryNavFit: () => void;
    scheduleScrollTopButtonUpdate: () => void;
    setScrollTopButtonVisible: (visible: boolean) => void;
    syncCategoryFocusFromHash: (options?: CategoryHashSyncOptions) => boolean;
    resolveCategoryTargetIdFromHash: (hash?: string) => string;
    hasCategoryTarget: (targetId: string) => boolean;
    activeCategoryTargetId: () => string;
    activateCategoryTarget: (targetId: string, options?: CatalogTargetOptions) => boolean;
    layoutColumnCount: () => number;
    hideDetail: () => void;
    prepareRoute: (nextPage: string) => void;
    containsMenuTarget: (target: EventTarget | null) => boolean;
    handleResize: () => void;
    handleScroll: () => void;
    renderCatalogMenu: (menu: HTMLElement, options?: CatalogMenuRenderOptions) => void;
    syncDetailMenuLabel: (catalog?: CatalogRecord | null) => void;
    renderDetailMenu: () => void;
};
export type CatalogNavigationFeatureApi = EscapeFeatureApi;
export type CatalogDetailFeatureApi = EscapeFeatureApi & {
    close: () => void;
    containsTarget: (target: EventTarget | null) => boolean;
};
export type SearchFeatureApi = {
    escapePriority: number;
    closeTopLayer: (event?: KeyboardEvent) => boolean;
    closeViewerTopLayer: (event?: KeyboardEvent) => boolean;
    isLightboxMobileOpen: () => boolean;
    setLightboxMobileOpen: (open: boolean, options?: SearchCloseOptions) => void;
    containsLightboxResult: (target: Element | null) => boolean;
    prepareViewer: (options?: SearchViewerPrepareOptions) => void;
    syncViewerStatus: () => void;
    closeViewerMenus: () => void;
    hideViewerResults: (options?: SearchCloseOptions) => void;
    closeGlobalPanel: (options?: SearchCloseOptions) => void;
    attachEvents: () => void;
    initialize: () => void;
    prepareRoute: (nextPage: string) => void;
    handleDocumentPointer: (target: EventTarget | null) => boolean;
    handleResize: () => void;
    handleScroll: () => void;
};
export type ViewerFeatureApi = {
    escapePriority: number;
    requiresDocumentLock: () => boolean;
    isViewerOpen: () => boolean;
    usesInDocumentFullscreenNavigation: () => boolean;
    attachEvents: () => void;
    handleResize: () => void;
    handleGlobalKeydown: (event: KeyboardEvent) => boolean;
    prepareRoute: (nextPage: string) => void;
    openCatalog: (catalogId: string, page?: number, options?: ViewerOpenOptions) => void;
    close: (options?: ViewerCloseOptions) => void;
    refresh: (options?: ViewerRefreshOptions) => void;
    renderPageRail: () => void;
    prepareInquiry: () => void;
    setPage: (page: number, options?: ViewerSetPageOptions) => void;
    syncMobileSearchUi: (isOpen: boolean) => void;
    showTopUi: () => void;
    containsTopBarElement: (element: Element | null) => boolean;
    hideTopUiForSearch: () => void;
    closeMobileMoreMenu: () => void;
    closeTopLayer: (event?: KeyboardEvent) => boolean;
};
export type AppShellFeatureApi = {
    initialize: () => boolean;
    renderRoute: (options?: {
        scrollPosition?: ScrollPosition | null;
    }) => boolean;
};
export type FeatureRegistry = {
    navigation: NavigationFeatureApi;
    favorites: FavoritesFeatureApi;
    inquiry: InquiryFeatureApi;
    "favorites-workspace": FavoritesWorkspaceFeatureApi;
    "catalog-grid": CatalogGridFeatureApi;
    "catalog-navigation": CatalogNavigationFeatureApi;
    "catalog-detail": CatalogDetailFeatureApi;
    search: SearchFeatureApi;
    viewer: ViewerFeatureApi;
    "app-shell": AppShellFeatureApi;
};
export type FeatureName = keyof FeatureRegistry;
export type RegisteredFeatureInterface = FeatureRegistry[FeatureName] & {
    readonly name: FeatureName;
};
