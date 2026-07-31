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
 * @property {string|string[]} [subCategory]
 * @property {number} pages
 * @property {0|1} [pageNumberStart]
 * @property {string} [dir]
 * @property {string} [format]
 * @property {string} [thumbDir]
 * @property {string} [mediumDir]
 * @property {string} [imageExt]
 * @property {string} [cover]
 * @property {string} [assetVersion]
 * @property {Record<string, CatalogImageVariant>} [imageVariants]
 * @property {Array<[number, number]>} [pageSizes]
 */

/** @typedef {{directory?:string, maxSide?:number, version?:string}} CatalogImageVariant */
/** @typedef {{start?:number, end?:number}} SearchHighlightRange */
/** @typedef {{subcategory:string, items:Array<CatalogRecord>}} CatalogSubcategoryGroup */
/** @typedef {{category:string, items:Array<CatalogRecord>, directItems:Array<CatalogRecord>, subcategories:Array<CatalogSubcategoryGroup>, subcategoryMap?:Map<string, CatalogSubcategoryGroup>, hasSubcategories?:boolean}} CatalogCategoryGroup */
/**
 * @typedef {Object} CatalogSearchResult
 * @property {string} [catalogId]
 * @property {number|string} [page]
 * @property {CatalogRecord|null} [catalog]
 * @property {string} [title]
 * @property {string} [excerpt]
 * @property {string} [kind]
 * @property {string} [resultType]
 * @property {string} [label]
 * @property {string} [category]
 * @property {string} [subcategory]
 * @property {number} [score]
 * @property {number} [sourceOrder]
 * @property {string} [matchField]
 * @property {string} [targetId]
 * @property {string} [catalogTitle]
 * @property {string} [image]
 * @property {string} [thumb]
 * @property {string} [matchReason]
 * @property {Array<SearchHighlightRange>} [highlights]
 * @property {string} [categoryTarget]
 * @property {string} [subcategoryTarget]
 */

/** @typedef {{catalog: CatalogRecord|null, page: number, lightboxSource: string}} NavigationState */
/** @typedef {{catalogLayoutColumns:number, catalogLayoutResizeTimer:number, catalogScrollTopButtonRaf:number, categoryFocusTargetId:string, categoryFocusTimer:number, categoryNavFitRaf:number}} CatalogState */
/** @typedef {{globalSearchCategory:string, globalSearchOpen:boolean, lightboxSearchScope:string, lightboxMobileSearchOpen:boolean, searchIndexLoadState:string, searchIndexLoadPromise:Promise<boolean>|null, searchIndexPreloadTimer:number, searchPreviewSuppressUntil:number, searchPreviewSuppressTimer:number, searchPreviewPointerClientX:number|null, searchPreviewPointerClientY:number|null}} SearchState */
/** @typedef {{favoritesViewerIndex:number, favoritesViewerOpeningHash:string, favoritesViewerPreviousCatalog:CatalogRecord|null, favoritesViewerPreviousPage:number, favoritesOpen:boolean, favoritesReturnFocus:HTMLElement|null, favoritesTransferPending:FavoritesTransfer|null, favoritesTransferReturnFocus:HTMLElement|null, favoritesFilterCatalogId:string, favoritesSelectedKeys:Set<string>, favoritesDragKey:string, favoriteNoteEditingKey:string, favoriteNoteReturnFocus:HTMLElement|null}} FavoritesState */
/**
 * @typedef {Object} ViewerState
 * @property {number} zoom
 * @property {number} fitScale
 * @property {string} imageFitMode
 * @property {string} imageFitModeSource
 * @property {boolean} singleImageFitOriginPending
 * @property {ViewerRelativePosition|null} singleImagePendingRelativePosition
 * @property {ViewerPageTurnOrigin|null} singleImagePendingPageTurnOrigin
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
 * @property {Map<number, ViewerPointerPoint>} pointers
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
 * @property {boolean} viewerPageWheelResetGestureActive
 * @property {number} viewerPageWheelResetLastEventAt
 * @property {number} viewerPageWheelResetLastDelta
 * @property {number} viewerPageWheelResetDirection
 * @property {boolean} viewerOnboardingOpen
 * @property {boolean} viewerOnboardingShownThisSession
 * @property {number} viewerOnboardingStep
 * @property {HTMLElement|null} viewerOnboardingTarget
 * @property {Array<ViewerOnboardingFloatingTarget>} viewerOnboardingFloatingTargets
 * @property {ViewerOnboardingRestoreUi|null} viewerOnboardingRestoreUi
 * @property {number} viewerOnboardingLayoutRaf
 * @property {number} viewerOnboardingLayoutTimer
 */

/** @typedef {{page:number, xRatio:number, yRatio:number}} ViewerRelativePosition */
/** @typedef {{page:number, direction:number, axis:string}} ViewerPageTurnOrigin */
/** @typedef {{x:number, y:number, startX:number, startY:number, velocityX:number, velocityY:number, lastTime:number}} ViewerPointerPoint */
/** @typedef {{moved:boolean, bounds:unknown, remainingDeltaX:number, remainingDeltaY:number}} ViewerPanInputResult */
/** @typedef {{source:HTMLButtonElement, clone:HTMLButtonElement, id:string, stepId:string}} ViewerOnboardingFloatingTarget */
/** @typedef {"singleImageAnimationTimer"} ViewerAnimationTimerKey */
/** @typedef {{timerKey:ViewerAnimationTimerKey, root?:Element|null}} ViewerPageSwapAnimationOptions */
/** @typedef {{src:string, tier:string, role?:string}} CatalogImageCandidate */
/** @typedef {{primarySrc:string, primaryTier:string, fallbackCandidates:Array<CatalogImageCandidate>}} CatalogImageRequest */
/** @typedef {{commit?:boolean}} ViewerResolutionUpgradeOptions */
/** @typedef {{imageRequest?:CatalogImageRequest, forceFull?:boolean, forceRefresh?:boolean, preserveCurrentImage?:boolean}} ViewerImageSwapOptions */
/** @typedef {{forceFull?:boolean, preferMedium?:boolean, zoom?:number, warmFull?:boolean}} ViewerImageRequestOptions */
/** @typedef {{left:number, top:number, right:number, bottom:number, width:number, height:number}} RectLike */
/** @typedef {{x:number, y:number}} PointLike */
/** @typedef {{left:number, top:number}} PositionedPoint */
/** @typedef {{showUi?:boolean, focalClientX?:number, focalClientY?:number}} ViewerZoomOptions */
/** @typedef {{showUi?:boolean}} ViewerZoomChangeOptions */
/** @typedef {{allowPageTurnBuffer?:boolean}} ViewerPanBoundsOptions */
/** @typedef {{queueSingleFitOrigin?:boolean, keepZoom?:boolean, resetZoom?:boolean, resetPosition?:boolean}} ViewerGeometryResetOptions */
/** @typedef {{updateFitScale?:boolean}} ViewerFrameGeometryOptions */
/** @typedef {{resetAutoSingleOrigin?:boolean}} ViewerUiVisibilityOptions */
/** @typedef {{scrollIntoView?:boolean}} ViewerRailRenderOptions */
/** @typedef {{showUi?:boolean, source?:string, refreshLayout?:boolean}} ViewerFitModeOptions */
/** @typedef {{label?:string, detail?:string, displayCurrent?:number|string, displayTotal?:number|string}} ViewerPageIndicatorOptions */
/** @typedef {"below"|"above"|"left"|"right"} ViewerOnboardingPlacement */
/** @typedef {{source:HTMLButtonElement, id:string}} ViewerOnboardingTargetDefinition */
/**
 * @typedef {Object} ViewerOnboardingStep
 * @property {string} id
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} description
 * @property {string} [note]
 * @property {()=>HTMLElement|null} target
 * @property {()=>RectLike|null} [targetRect]
 * @property {()=>Array<ViewerOnboardingTargetDefinition>} [floatingTargets]
 * @property {ViewerOnboardingPlacement} preferredPlacement
 * @property {number} padding
 * @property {number} radius
 * @property {string} gesture
 * @property {number} [viewportMargin]
 * @property {boolean} [revealTopBar]
 * @property {boolean} [revealPageRail]
 */
/** @typedef {{focus?:boolean, scheduleLayout?:boolean}} ViewerOnboardingStepOptions */
/** @typedef {{showUi:boolean, showPageRail:boolean}} ViewerOnboardingRestoreUi */
/** @typedef {{restoreFocus?:boolean, remember?:boolean}} ViewerOnboardingCloseOptions */

/** @typedef {{viewer:boolean, favoritesWorkspace:boolean, catalogGrid:boolean, search:boolean}} FeatureCapabilities */

/** @typedef {{width:number, height:number}} CatalogImageReadiness */
/** @typedef {{imageLoadCache: Map<string, Promise<CatalogImageReadiness>>}} CatalogAssetState */
/** @typedef {{actionToastTimer:number}} UiRuntimeState */
/**
 * Result returned by persistence-aware favorites mutations. ``persisted=false``
 * means the in-memory list changed but browser storage rejected the write.
 *
 * @typedef {Object} FavoriteMutationResult
 * @property {string} operation
 * @property {boolean} changed
 * @property {boolean} persisted
 * @property {string} reason
 * @property {Array<FavoriteItem>} items
 * @property {boolean} [active]
 */
/**
 * @typedef {Object} FavoritesStore
 * @property {string} storageKey
 * @property {()=>Array<FavoriteItem>} read
 * @property {()=>Array<FavoriteItem>} reload
 * @property {()=>({persisted:boolean, reason:string})} status
 * @property {()=>FavoriteMutationResult|null} lastMutation
 * @property {(item:FavoriteItem)=>boolean} has
 * @property {(item:FavoriteItem)=>boolean} add
 * @property {(item:FavoriteItem)=>FavoriteMutationResult} addDetailed
 * @property {(item:FavoriteItem, patch:Partial<FavoriteItem>)=>boolean} update
 * @property {(item:FavoriteItem, patch:Partial<FavoriteItem>)=>FavoriteMutationResult} updateDetailed
 * @property {(keys:string[])=>boolean} reorder
 * @property {(keys:string[])=>FavoriteMutationResult} reorderDetailed
 * @property {(item:FavoriteItem)=>boolean} toggle
 * @property {(item:FavoriteItem)=>FavoriteMutationResult} toggleDetailed
 * @property {(item:FavoriteItem)=>boolean} remove
 * @property {(item:FavoriteItem)=>FavoriteMutationResult} removeDetailed
 * @property {()=>boolean} clear
 * @property {()=>FavoriteMutationResult} clearDetailed
 * @property {(items:Array<FavoriteItem>)=>Array<FavoriteItem>} replace
 * @property {(items:Array<FavoriteItem>)=>FavoriteMutationResult} replaceDetailed
 * @property {(item:FavoriteItem, note:string)=>boolean} setNote
 * @property {(item:FavoriteItem, note:string)=>FavoriteMutationResult} setNoteDetailed
 */
/** @typedef {{catalogId:string, page:number, savedAt?:number, note?:string}} FavoriteItem */
/** @typedef {{items:FavoriteItem[], rejected:number, valid?:boolean, source?:string}} FavoritesTransfer */
/** @typedef {{catalogId?:unknown, catalog?:CatalogRecord, page?:unknown}} FavoriteKeySource */
/** @typedef {{incomingItems:FavoriteItem[], existingItems:FavoriteItem[], newItems:FavoriteItem[], alreadyExistingItems:FavoriteItem[], mergedItems:FavoriteItem[]}} FavoriteMergeAnalysis */
/** @typedef {{returnFocus?:HTMLElement|null}} FavoritesTransferPrepareOptions */
/** @typedef {{preferredIndex?:number}} FavoriteViewerSyncOptions */
/** @typedef {{renderPanel?:boolean}} FavoritesSyncOptions */
/** @typedef {{allowEmpty?:boolean, captureReturnFocus?:boolean}} FavoritesPanelOpenOptions */
/** @typedef {{restoreFocus?:boolean, preserveReturnFocus?:boolean}} FavoritesPanelCloseOptions */
/** @typedef {FavoriteItem & {catalog:CatalogRecord}} FavoriteEntry */
/** @typedef {{x?:number, y?:number}} ScrollPosition */
/** @typedef {{replace?:boolean}} AppNavigationOptions */
/** @typedef {{scroll?:boolean, openPage?:number|null, scrollBehavior?:ScrollBehavior}} CatalogOpenOptions */
/** @typedef {{animate?:boolean, scroll?:boolean, clearHash?:boolean, targetId?:string}} CatalogFocusOptions */
/** @typedef {{toggle?:boolean}} CatalogTargetOptions */
/** @typedef {{focusButton?:boolean, returnFocus?:boolean, hideResults?:boolean, blurTopUiFocus?:boolean, hideTopUi?:boolean}} SearchCloseOptions */
/** @typedef {{restoreFocus?:boolean, cleanUrl?:boolean}} DialogCloseOptions */
/** @typedef {{focusButton?:boolean}} MobileMenuCloseOptions */
/** @typedef {{restoreFavorites?:boolean, restoreFocus?:boolean}} ViewerCloseOptions */
/** @typedef {{source?:string, favoriteIndex?:number}} ViewerOpenOptions */
/** @typedef {{thumbScrollIntoView?:boolean, preserveCurrentImage?:boolean}} ViewerRefreshOptions */
/** @typedef {{thumbScrollIntoView?:boolean, keepZoom?:boolean, resetZoom?:boolean, resetPosition?:boolean, positionMode?:string, pageTurnDirection?:number, pageTurnAxis?:string, preservePointerInteraction?:boolean}} ViewerSetPageOptions */
/** @typedef {{source?:string, catalogId?:string, pageNumber?:number, value?:number}} InquiryTelemetry */
/**
 * @typedef {Object} InquiryReference
 * @property {string} kind
 * @property {string} source
 * @property {CatalogRecord|null} [catalog]
 * @property {number} [page]
 * @property {Array<FavoriteEntry>} [entries]
 * @property {number} [count]
 * @property {boolean} [selected]
 * @property {string} title
 * @property {string} eyebrow
 * @property {string} description
 * @property {string} referenceTitle
 * @property {string} pageLabel
 * @property {string} subject
 * @property {string} shareText
 * @property {string} text
 * @property {string} url
 * @property {CatalogRecord} [previewCatalog]
 * @property {number} [previewPage]
 * @property {InquiryTelemetry} [telemetry]
 */
/** @typedef {{restoreFocus?:boolean, returnFocus?:HTMLElement|null, reference?:InquiryReference}} InquiryOpenOptions */
/** @typedef {{restoreFocus?:boolean}} NoteEditorCloseOptions */
/** @typedef {{selected?:boolean}} FavoriteWorkspaceInquiryOptions */
/** @typedef {{purpose?:"share"|"inquiry"}} FavoriteWorkspaceMessageOptions */
/** @typedef {{animate?:boolean, scroll?:boolean}} CategoryHashSyncOptions */

/**
 * Escape-capable features participate in one ordered close hierarchy. The event
 * is optional because most layers do not need the original keyboard target.
 * @typedef {Object} EscapeFeatureApi
 * @property {number} escapePriority
 * @property {(event?:KeyboardEvent)=>boolean} closeTopLayer
 */

/**
 * @typedef {Object} NavigationFeatureApi
 * @property {()=>CatalogRecord|null} catalog
 * @property {()=>number} page
 * @property {()=>string} source
 * @property {(catalog:CatalogRecord|null, page?:number, source?:string)=>void} setLocation
 * @property {(page:number)=>void} setPage
 * @property {(source:string)=>void} setSource
 * @property {()=>void} clearLocation
 * @property {(nextPage:string)=>void} setAppPage
 * @property {()=>string} appPage
 * @property {(nextPage:string)=>void} syncRouteShell
 * @property {(position?:ScrollPosition|null)=>void} restoreScroll
 * @property {()=>void} attachEvents
 */

/**
 * @typedef {Object} FavoritesFeatureApi
 * @property {number} escapePriority
 * @property {()=>boolean} requiresDocumentLock
 * @property {(event?:KeyboardEvent)=>boolean} closeTopLayer
 * @property {()=>void} attachEvents
 * @property {()=>Array<FavoriteEntry>} entries
 * @property {()=>number} viewerIndex
 * @property {(index:number)=>void} setViewerIndex
 * @property {(entries:Array<FavoriteEntry>, catalogId:string|undefined, page:number)=>number} findViewerEntryIndex
 * @property {(entries:Array<FavoriteEntry>, index:number)=>boolean} selectViewerEntry
 * @property {()=>void} resetViewerSession
 * @property {()=>void} syncViewerButton
 * @property {(favoritesMode:boolean)=>void} syncViewerMode
 * @property {(open:boolean, activeTrigger?:HTMLElement|null)=>void} syncInquiryTrigger
 * @property {()=>HTMLButtonElement} onboardingTarget
 * @property {(nextPage:string)=>void} prepareRoute
 * @property {()=>void} syncUi
 * @property {()=>void} openRoute
 * @property {()=>boolean} isPanelOpen
 */

/**
 * @typedef {Object} InquiryFeatureApi
 * @property {number} escapePriority
 * @property {()=>boolean} requiresDocumentLock
 * @property {()=>boolean} isOpen
 * @property {()=>void} attachEvents
 * @property {(options?:InquiryOpenOptions)=>void} openInquiry
 * @property {(options?:DialogCloseOptions)=>void} close
 * @property {(event?:KeyboardEvent)=>boolean} closeTopLayer
 * @property {()=>HTMLButtonElement} onboardingTarget
 */

/**
 * @typedef {Object} FavoritesWorkspaceFeatureApi
 * @property {()=>void} attachEvents
 * @property {(entries?:Array<FavoriteEntry>)=>Array<FavoriteEntry>} shareLinkEntries
 * @property {(entries:Array<FavoriteEntry>, button?:Element|null)=>Promise<unknown>|unknown} copyShareLink
 * @property {(entries?:Array<FavoriteEntry>)=>void} render
 * @property {(entries?:Array<FavoriteEntry>)=>void} prune
 * @property {(event:Event)=>void} handleGridClick
 * @property {(options?:NoteEditorCloseOptions)=>void} closeNoteEditor
 */


/**
 * @typedef {Object} CatalogMenuRenderOptions
 * @property {string} [activeCatalogId]
 * @property {(catalogId:string)=>void} [onSelect]
 */

/**
 * @typedef {Object} CatalogGridFeatureApi
 * @property {()=>void} attachEvents
 * @property {()=>void} initialize
 * @property {()=>void} renderInitialContent
 * @property {()=>void} renderEmptyState
 * @property {(catalogId:string, options?:CatalogOpenOptions)=>void} openCatalog
 * @property {(options?:MobileMenuCloseOptions)=>void} closeMobileMenu
 * @property {()=>void} scheduleLayoutRefresh
 * @property {()=>void} scheduleCategoryNavFit
 * @property {()=>void} scheduleScrollTopButtonUpdate
 * @property {(visible:boolean)=>void} setScrollTopButtonVisible
 * @property {(options?:CategoryHashSyncOptions)=>boolean} syncCategoryFocusFromHash
 * @property {(hash?:string)=>string} resolveCategoryTargetIdFromHash
 * @property {(targetId:string)=>boolean} hasCategoryTarget
 * @property {()=>string} activeCategoryTargetId
 * @property {(targetId:string, options?:CatalogTargetOptions)=>boolean} activateCategoryTarget
 * @property {()=>number} layoutColumnCount
 * @property {()=>void} hideDetail
 * @property {(nextPage:string)=>void} prepareRoute
 * @property {(target:EventTarget|null)=>boolean} containsMenuTarget
 * @property {()=>void} handleResize
 * @property {()=>void} handleScroll
 * @property {(menu:HTMLElement, options?:CatalogMenuRenderOptions)=>void} renderCatalogMenu
 * @property {(catalog?:CatalogRecord|null)=>void} syncDetailMenuLabel
 * @property {()=>void} renderDetailMenu
 */

/** @typedef {EscapeFeatureApi} CatalogNavigationFeatureApi */
/**
 * @typedef {EscapeFeatureApi & {
 *   close:()=>void,
 *   containsTarget:(target:EventTarget|null)=>boolean
 * }} CatalogDetailFeatureApi
 */

/**
 * @typedef {Object} SearchFeatureApi
 * @property {number} escapePriority
 * @property {(event?:KeyboardEvent)=>boolean} closeTopLayer
 * @property {(event?:KeyboardEvent)=>boolean} closeViewerTopLayer
 * @property {()=>boolean} isLightboxMobileOpen
 * @property {(open:boolean, options?:SearchCloseOptions)=>void} setLightboxMobileOpen
 * @property {(target:Element|null)=>boolean} containsLightboxResult
 * @property {(options?:SearchCloseOptions)=>void} hideViewerResults
 * @property {(options?:SearchCloseOptions)=>void} closeGlobalPanel
 * @property {()=>void} attachEvents
 * @property {()=>void} initialize
 * @property {(nextPage:string)=>void} prepareRoute
 * @property {(target:EventTarget|null)=>boolean} handleDocumentPointer
 * @property {()=>void} handleResize
 * @property {()=>void} handleScroll
 */

/**
 * @typedef {Object} ViewerFeatureApi
 * @property {number} escapePriority
 * @property {()=>boolean} requiresDocumentLock
 * @property {()=>boolean} isViewerOpen
 * @property {()=>boolean} usesInDocumentFullscreenNavigation
 * @property {()=>void} attachEvents
 * @property {()=>void} handleResize
 * @property {(event:KeyboardEvent)=>boolean} handleGlobalKeydown
 * @property {(nextPage:string)=>void} prepareRoute
 * @property {(catalogId:string, page?:number, options?:ViewerOpenOptions)=>void} openCatalog
 * @property {(options?:ViewerCloseOptions)=>void} close
 * @property {(options?:ViewerRefreshOptions)=>void} refresh
 * @property {()=>void} renderPageRail
 * @property {()=>void} prepareInquiry
 * @property {(page:number, options?:ViewerSetPageOptions)=>void} setPage
 * @property {(isOpen:boolean)=>void} syncMobileSearchUi
 * @property {()=>void} showTopUi
 * @property {(element:Element|null)=>boolean} containsTopBarElement
 * @property {()=>void} hideTopUiForSearch
 * @property {()=>void} closeMobileMoreMenu
 * @property {(event?:KeyboardEvent)=>boolean} closeTopLayer
 */

/**
 * @typedef {Object} AppShellFeatureApi
 * @property {()=>boolean} initialize
 * @property {(options?:{scrollPosition?:ScrollPosition|null})=>boolean} renderRoute
 */

/**
 * Exact compile-time map for every optional route feature. A feature may be
 * absent from a route bundle, but a registered implementation must satisfy its
 * complete API and callers can only request a known stable name.
 *
 * @typedef {{
 *   navigation: NavigationFeatureApi,
 *   favorites: FavoritesFeatureApi,
 *   inquiry: InquiryFeatureApi,
 *   "favorites-workspace": FavoritesWorkspaceFeatureApi,
 *   "catalog-grid": CatalogGridFeatureApi,
 *   "catalog-navigation": CatalogNavigationFeatureApi,
 *   "catalog-detail": CatalogDetailFeatureApi,
 *   search: SearchFeatureApi,
 *   viewer: ViewerFeatureApi,
 *   "app-shell": AppShellFeatureApi
 * }} FeatureRegistry
 */
/** @typedef {keyof FeatureRegistry} FeatureName */
/** @typedef {FeatureRegistry[FeatureName] & {readonly name:FeatureName}} RegisteredFeatureInterface */
