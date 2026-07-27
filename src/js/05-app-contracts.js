/**
 * Source module: 05-app-contracts.js
 * JSDoc contracts shared by every route bundle.
 */

/**
 * @typedef {Object} CatalogRecord
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} [category]
 * @property {string} [subcategory]
 * @property {number} pages
 * @property {string} [dir]
 * @property {string} [format]
 * @property {string} [thumbDir]
 * @property {string} [mediumDir]
 * @property {Array<[number, number]>} [pageSizes]
 */

/** @typedef {{catalog: CatalogRecord|null, page: number, lightboxSource: string}} NavigationState */
/** @typedef {{catalogLayoutColumns:number, catalogLayoutResizeTimer:number, catalogScrollTopButtonRaf:number, categoryFocusTargetId:string, categoryFocusTimer:number, categoryNavFitRaf:number}} CatalogState */
/** @typedef {{globalSearchCategory:string, globalSearchOpen:boolean, lightboxSearchScope:string, lightboxMobileSearchOpen:boolean, searchIndexLoadState:string, searchIndexLoadPromise:Promise<boolean>|null, searchIndexPreloadTimer:number, searchPreviewSuppressUntil:number, searchPreviewSuppressTimer:number, searchPreviewPointerClientX:number|null, searchPreviewPointerClientY:number|null}} SearchState */
/** @typedef {{favoritesViewerIndex:number, favoritesViewerOpeningHash:string, favoritesViewerPreviousCatalog:CatalogRecord|null, favoritesViewerPreviousPage:number, favoritesOpen:boolean, favoritesReturnFocus:Element|null, favoritesTransferPending:Record<string, unknown>|null, favoritesTransferReturnFocus:Element|null, favoritesFilterCatalogId:string, favoritesSelectedKeys:Set<string>, favoritesDragKey:string, favoriteNoteEditingKey:string, favoriteNoteReturnFocus:Element|null}} FavoritesState */
/**
 * @typedef {Object} ViewerState
 * @property {number} zoom
 * @property {number} fitScale
 * @property {string} imageFitMode
 * @property {string} imageFitModeSource
 * @property {boolean} singleImageFitOriginPending
 * @property {Record<string, number>|null} singleImagePendingRelativePosition
 * @property {Record<string, unknown>|null} singleImagePendingPageTurnOrigin
 * @property {number} panX
 * @property {number} panY
 * @property {number} dragStartX
 * @property {number} dragStartY
 * @property {number} dragStartPanX
 * @property {number} dragStartPanY
 * @property {number} lastTapAt
 * @property {number} lastTapX
 * @property {number} lastTapY
 * @property {string} lastTapSurface
 * @property {number} suppressNextDblClickUntil
 * @property {number} pinchStartDistance
 * @property {number} pinchStartZoom
 * @property {number} pinchLastMidX
 * @property {number} pinchLastMidY
 * @property {boolean} pointerGestureHadMultiplePointers
 * @property {boolean} pointerGestureConsumedPan
 * @property {Map<number, Record<string, unknown>>} pointers
 * @property {number} viewerTouchMomentumRaf
 * @property {number} viewerTouchMomentumVelocityX
 * @property {number} viewerTouchMomentumVelocityY
 * @property {number} viewerTouchMomentumLastTime
 * @property {string} viewerPhase
 * @property {string} viewerPhaseReason
 * @property {string} viewerFullscreenPhase
 * @property {string} viewerFullscreenReason
 * @property {boolean} topUiPinned
 * @property {number} uiHideTimer
 * @property {number} pageRailHideTimer
 * @property {number} lastTouchLikeViewportInputAt
 * @property {number} lastTouchLikeRailInputAt
 * @property {number} zoomIndicatorHideTimer
 * @property {number} pageIndicatorHideTimer
 * @property {boolean} viewerMobileMoreOpen
 * @property {boolean} viewerInquiryOpen
 * @property {Element|null} viewerInquiryReturnFocus
 * @property {Record<string, unknown>|null} viewerInquiryContext
 * @property {number} singleImageLoadToken
 * @property {number} singleImageAnimationTimer
 * @property {number} singleImageResolutionLoadToken
 * @property {(()=>void)|null} singleImageResolutionStop
 * @property {HTMLImageElement|null} singleImageResolutionImage
 * @property {string} singleImageResolutionTargetSrc
 * @property {string} singleImageResolutionTargetTier
 * @property {boolean} singleImageResolutionReady
 * @property {boolean} singleImageResolutionVisible
 * @property {boolean} singleImageResolutionCommitPending
 * @property {boolean} singleImageResolutionRetainedForSwap
 * @property {number} viewerPageWheelAccumulator
 * @property {number} viewerPageWheelBasePage
 * @property {number} viewerPageWheelTargetPage
 * @property {number} viewerPageWheelSettleTimer
 * @property {boolean} viewerOnboardingOpen
 * @property {boolean} viewerOnboardingShownThisSession
 * @property {number} viewerOnboardingStep
 * @property {Element|null} viewerOnboardingTarget
 * @property {Array<Element>} viewerOnboardingFloatingTargets
 * @property {Record<string, unknown>|null} viewerOnboardingRestoreUi
 * @property {number} viewerOnboardingLayoutRaf
 * @property {number} viewerOnboardingLayoutTimer
 */

/** @typedef {{viewer:boolean, favoritesWorkspace:boolean, catalogGrid:boolean, search:boolean}} FeatureCapabilities */

/** @typedef {{imageLoadCache: Map<string, Promise<unknown>>}} CatalogAssetState */
/** @typedef {{actionToastTimer:number}} UiRuntimeState */
/**
 * @typedef {Object} FavoritesStore
 * @property {string} storageKey
 * @property {()=>Array<Record<string, unknown>>} read
 * @property {()=>Array<Record<string, unknown>>} reload
 * @property {(item:Record<string, unknown>)=>boolean} toggle
 * @property {(item:Record<string, unknown>)=>boolean} remove
 * @property {()=>void} clear
 * @property {(items:Array<Record<string, unknown>>)=>unknown} replace
 * @property {(item:Record<string, unknown>, note:string)=>unknown} setNote
 */
/**
 * Stable public surface registered by an optional frontend feature. All members
 * are optional because each route loads a different capability set. Callers
 * must resolve the feature by name and use only this interface; direct access to
 * another feature's state or DOM owner is rejected by the build contracts.
 *
 * @typedef {Object} FeatureInterface
 * @property {string} [name]
 * @property {number} [escapePriority]
 * @property {()=>boolean} [closeTopLayer]
 * @property {(event?:KeyboardEvent)=>boolean} [closeViewerTopLayer]
 * @property {()=>boolean} [requiresDocumentLock]
 * @property {()=>boolean} [isViewerOpen]
 * @property {()=>boolean} [usesInDocumentFullscreenNavigation]
 * @property {()=>void} [attachEvents]
 * @property {()=>void} [initialize]
 * @property {()=>void} [renderInitialContent]
 * @property {()=>void} [renderEmptyState]
 * @property {(nextPage:string)=>void} [prepareRoute]
 * @property {()=>void} [handleResize]
 * @property {(event:KeyboardEvent)=>boolean} [handleGlobalKeydown]
 * @property {(catalogId:string, page?:number, options?:Record<string, unknown>)=>void} [openCatalog]
 * @property {(options?:Record<string, unknown>)=>void} [close]
 * @property {(options?:Record<string, unknown>)=>void} [refresh]
 * @property {()=>void} [renderPageRail]
 * @property {(options?:Record<string, unknown>)=>void} [openInquiry]
 * @property {(page:number, options?:Record<string, unknown>)=>void} [setPage]
 * @property {(isOpen:boolean)=>void} [syncMobileSearchUi]
 * @property {()=>void} [showTopUi]
 * @property {(element:Element|null)=>boolean} [containsTopBarElement]
 * @property {()=>void} [hideTopUiForSearch]
 * @property {(options?:Record<string, unknown>)=>void} [closeMobileMenu]
 * @property {()=>void} [scheduleLayoutRefresh]
 * @property {()=>void} [scheduleCategoryNavFit]
 * @property {()=>void} [scheduleScrollTopButtonUpdate]
 * @property {(visible:boolean)=>void} [setScrollTopButtonVisible]
 * @property {(options?:Record<string, unknown>)=>void} [syncCategoryFocusFromHash]
 * @property {(hash?:string)=>string} [resolveCategoryTargetIdFromHash]
 * @property {(targetId:string)=>boolean} [hasCategoryTarget]
 * @property {()=>string} [activeCategoryTargetId]
 * @property {()=>number} [layoutColumnCount]
 * @property {()=>void} [hideDetail]
 * @property {(entries?:Array<Record<string, unknown>>)=>Array<Record<string, unknown>>} [shareLinkEntries]
 * @property {(entries:Array<Record<string, unknown>>, button?:Element|null)=>Promise<unknown>|unknown} [copyShareLink]
 * @property {(entries?:Array<Record<string, unknown>>)=>void} [render]
 * @property {(entries?:Array<Record<string, unknown>>)=>void} [prune]
 * @property {(event:Event)=>void} [handleGridClick]
 * @property {(options?:Record<string, unknown>)=>void} [closeNoteEditor]
 * @property {()=>boolean} [isLightboxMobileOpen]
 * @property {(open:boolean, options?:Record<string, unknown>)=>void} [setLightboxMobileOpen]
 * @property {(target:Element|null)=>boolean} [containsLightboxResult]
 * @property {(options?:Record<string, unknown>)=>void} [hideViewerResults]
 */
