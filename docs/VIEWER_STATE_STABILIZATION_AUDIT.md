# Viewer State Stabilization Audit — Stage 2

## Scope

This stage stabilizes the existing Viewer without changing its DOM, HTML, CSS, labels, controls, or visual layout. The work replaces the former 68-field mutable aggregate with explicit domain ownership, centralizes navigation policy, and introduces checked transition commands for page, resolution, image-swap, and gesture lifecycle boundaries.

## State ownership

`src/js/16-viewer-state.js` now declares seven independent mutable owners. No aggregate `viewerState` or `viewerStateDomains` facade remains.

| Domain owner | Fields | Responsibility |
|---|---:|---|
| `viewerSessionState` | 4 | Viewer and fullscreen lifecycle phases |
| `viewerViewportState` | 9 | Zoom, fit, pan, and pending page positioning |
| `viewerGestureState` | 20 | Pointer, pinch, tap, and touch momentum lifecycle |
| `viewerChromeState` | 8 | Toolbar, indicators, rail, and mobile chrome timers |
| `viewerImageState` | 11 | Page image and resolution-upgrade lifecycle |
| `viewerNavigationState` | 8 | Wheel accumulation and settle/reset gesture state |
| `viewerOnboardingState` | 8 | Onboarding visibility, target, layout, and restore state |
| **Total** | **68** | Every former field has exactly one owner |

`tests/viewer_state_domains_contract.test.js` parses both the runtime declarations and the TypeScript contracts and locks the exact seven-way partition, the field order, the total of 68 unique fields, and the absence of a replacement aggregate facade.

## Explicit transition boundary

`src/js/17-viewer-state-transitions.js` is the single cross-domain state transition owner. DOM effects stay in their existing feature modules.

The boundary owns:

- creation and validation of navigation commands;
- page-transition state commits;
- pending viewport-mode exclusivity;
- Viewer open/closed state initialization and cleanup;
- gesture reset and wheel-gesture reset commands;
- page image-swap tokens;
- resolution request cancellation, begin, loader attachment, ready, commit, retain, and release transitions;
- runtime invariants for viewport, gesture, session, image, and resolution state.

Invalid commands and invalid transition inputs fail before mutating any Viewer state.

## Navigation policy

Navigation behavior is selected only by `ViewerNavigationSource`; callers no longer combine potentially contradictory booleans such as `keepZoom`, `resetZoom`, or `resetPosition`.

| Source | Automatic zoom | Manual zoom |
|---|---|---|
| Button, keyboard, Home/End, page rail, programmatic | Preserve zoom; use fit origin | Preserve zoom and relative viewport position |
| Horizontal swipe | Preserve zoom; page-turn origin | Preserve zoom; page-turn origin |
| Continuous reading | Preserve zoom; page-turn origin | Preserve zoom; page-turn origin |
| Wheel, vertical swipe, boundary pan, momentum | Preserve automatic zoom; page-turn origin | Reset to automatic zoom and fit origin |

A fabricated command cannot override the policy belonging to its source. Page-turn commands require a non-zero normalized direction; relative commands require finite position ratios; targets must be non-negative integers.

## Runtime invariants

The transition boundary rejects these impossible states at the boundary where they are created:

- more than one pending viewport positioning mode;
- non-finite or invalid zoom, fit scale, pan, momentum, target page, or relative ratio values;
- touch momentum overlapping active pointers;
- a closed Viewer retaining pointers, momentum, or an active resolution lifecycle;
- malformed or negative image/resolution tokens;
- resolution source and tier ownership diverging;
- active resolution work without an image layer or target;
- a visible resolution layer that is not ready;
- a retained swap layer overlapping an active resolution request;
- stale image or resolution completion tokens committing after a newer request.

## Removed bypasses

The following legacy implementation paths were removed:

- aggregate `viewerState` access;
- `resetViewOnPageTurn`;
- `pageTurnDirection` and `pageTurnAxis` option flags;
- `keepZoom`, `resetZoom`, and `resetPosition` option combinations;
- geometry-owned `queueSingleImageRelativePosition`;
- geometry-owned `queueSingleImagePageTurnOrigin`.

Geometry remains responsible only for measuring and applying a previously committed pending position. Resolution lifecycle fields can be mutated only by the transition owner.

## Runtime and UI proof

The source comparison against the supplied `site-catalog(49)` baseline shows:

- no HTML file changed;
- no source CSS file changed;
- no generated CSS bundle changed;
- `app-catalog.js`, `app-favorites.js`, `app-payment.js`, and all standalone runtime bundles are byte-identical;
- only `app-viewer.js` changed, and its module inventory differs only by the new `17-viewer-state-transitions.js` owner.

| Artifact | Before | After | Delta |
|---|---:|---:|---:|
| `app-viewer.js` raw | 409,284 B | 428,117 B | +18,833 B |
| `app-viewer.js` gzip | 86,246 B | 89,808 B | +3,562 B |

Hashes:

- Before: `442e0b42104606f3b59c09d4f8bf821542c645b10307afdf1fe979b00961a291`
- After: `31ba907d443c65dbaf0c859e87eb1259a406439dc627a523e5a659f1ab771f11`

The Viewer remains within the existing performance budget at approximately 87.7 KiB gzip.

## Verification

Completed successfully:

- all 23 Viewer JavaScript tests;
- all 76 JavaScript contract/logic tests through `verify_project.py --javascript-only`;
- 329 Python tests through `verify_project.py --python-only`;
- TypeScript 7.0.2;
- frontend feature contracts;
- runtime-symbol checks for all four route bundles;
- generated-page checks;
- static accessibility audit;
- frontend performance budgets;
- deterministic frontend rebuild and `--check` verification.

A real Playwright browser run was not available in this offline workspace because the supplied tree did not contain Playwright or a Chromium installation. DOM/UI preservation was therefore proved by byte-identical HTML/CSS assets plus the complete static, contract, and runtime-logic suites.
