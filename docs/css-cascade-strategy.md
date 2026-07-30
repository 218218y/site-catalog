# CSS cascade strategy

## Current contract

The source stylesheets under `src/css/` are already separated by responsibility and are concatenated in the reviewed order declared by `tools/build_frontend_assets.py`. The builder wraps each route bundle in one outer layer:

```css
@layer bargig.application;
@layer bargig.application { ... }
```

Source files must not declare their own `@layer`. This preserves the pre-existing specificity and source-order behavior while giving the application a stable outer boundary against host-page CSS.

## Why the project does not yet use multiple semantic layers

Cascade layers outrank selector specificity. Splitting the current modules into `foundation`, `layout`, `components`, `utilities`, and `overrides` would therefore be a behavior change, not a formatting cleanup: a low-specificity selector in a later layer can override a highly specific selector in an earlier layer. The Viewer, onboarding flow, responsive rules and accessibility modes still contain reviewed state overrides, so a multi-layer migration must be accompanied by stable visual-regression coverage for all routes and viewport modes.

Until that prerequisite exists, retaining one outer application layer is the safer and more explicit architecture. Module order remains visible in the generated bundle banner and is checked by the build tests.

## `!important` policy

Wave 4 removed the unneeded inquiry and footer declarations and established a hard source budget of **105** occurrences. Both `tools/check_frontend_contracts.py` and `tests/css_architecture_contract.test.js` reject an increase.

New feature styling should first use:

1. selectors scoped to the component owner;
2. state classes owned by that component;
3. source order inside the owning module;
4. an existing semantic z-index token when stacking is involved.

`!important` remains acceptable only for reviewed utility, accessibility/reduced-motion, browser/fullscreen, onboarding-clone, or forced Viewer-state behavior where the override is itself the contract. Every safe removal should lower the budget rather than leaving unused headroom.

## Preconditions for a future multi-layer migration

A separate migration may introduce semantic layers only after:

- visual-regression coverage is stable for Catalog, Favorites and Viewer;
- mobile menu, fullscreen, dialogs, onboarding and reduced-motion states are covered;
- each proposed layer has an explicit precedence table;
- the change is performed route by route with before/after screenshots and no simultaneous visual redesign.
