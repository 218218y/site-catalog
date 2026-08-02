# CSS Cascade Ownership Closeout

## Scope

This follow-up removes the remaining ordinary component-level `!important` declarations.
It changes no JavaScript, HTML, DOM structure, catalog data, or public route behavior.

The main architectural defect was the Viewer onboarding stylesheet being loaded before the
permanent Viewer chrome that its cloned controls intentionally override. That forced the
onboarding feature to rely on 32 ordinary `!important` declarations. The stylesheet is now
named `92-viewer-onboarding.css` and is loaded after `90-visual-polish.css` but before
`95-accessibility-consistency.css`.

This gives the cascade three explicit responsibilities:

1. permanent Viewer and route components establish their normal states;
2. onboarding owns temporary tour presentation through later source order and scoped selectors;
3. accessibility remains the final authority for focus and forced-colors behavior.

## Result

The reviewed source total is reduced from **72** to **22** `!important` declarations in this
slice: **50 removals (69.4%)**.

Across both CSS cleanup slices, the project moved from **105** to **22** declarations:
**83 removals (79.0%)**.

| Source module | Before this slice | After | Removed |
| --- | ---: | ---: | ---: |
| `05-viewer-onboarding.css` / `92-viewer-onboarding.css` | 34 | 2 | 32 |
| `20-viewer.css` | 5 | 2 | 3 |
| `80-responsive-shell.css` | 6 | 0 | 6 |
| `85-favorites-routing.css` | 8 | 0 | 8 |
| `90-visual-polish.css` | 11 | 10 | 1 |
| Other modules | 8 | 8 | 0 |
| **Total** | **72** | **22** | **50** |

Every remaining declaration is now limited to one of these reviewed categories:

- `.hidden` and visually-hidden utility guarantees;
- reduced-motion animation/transition cancellation;
- the global keyboard focus guarantee;
- forced-colors focus restoration.

No ordinary Viewer palette, geometry, hover, active, route, or onboarding declaration uses
`!important`.

## Changes by owner

### Late onboarding ownership

`src/css/05-viewer-onboarding.css` is replaced by:

```text
src/css/92-viewer-onboarding.css
```

`VIEWER_CSS_MODULES` now loads it after visual polish and before accessibility. This removes
forced declarations from:

- floating target geometry, visibility and pointer handling;
- floating target shadows;
- favorite-tour target palette and icon fill/stroke;
- hover/focus transform stabilization;
- disabled previous-step transform;
- temporary top toolbar and page rail visibility;
- temporary hotspot suppression.

The two remaining onboarding declarations are the explicit reduced-motion
`animation: none !important` and `transition: none !important` guarantees.

### Viewer feedback state

The feedback selector is now:

```css
.reader-button.reader-icon-button-done
```

Its compound owner naturally outranks the base `.reader-button` state, so active background
and border no longer require force.

### Favorite side control

`src/css/85-favorites-routing.css` now has zero `!important` declarations. Its module already
loads after the permanent Viewer button base. Normal, hover, active, and selected states win
through scoped selectors and source order.

The later `.viewer-favorite-button.reader-icon-button-done` feedback rule also no longer uses
force; equal component specificity and later source order preserve the feedback border.

### Auto-zoom recovery control

`src/css/80-responsive-shell.css` now has zero `!important` declarations. The dedicated
`.viewer-auto-zoom-button` selectors own normal, visible, hover, focus, and active states after
the base Viewer button declarations.

### Composite search focus

The search text input intentionally delegates its visible focus ring to
`.reader-search-field:focus-within`, so the input and scope button appear as one control.

The global accessibility focus selector now excludes only `.reader-search-input`; the input's
local `box-shadow: none` therefore no longer needs to fight an important global rule. All other
inputs continue to receive the global focus guarantee.

## Intentional visual correction

One latent cascade bug is fixed rather than preserved.

The onboarding source already defined a dedicated warm, high-contrast palette for the cloned
favorite button used in the composite “save, share and inquire” tour step. Because the old
onboarding module loaded early, the later selected-favorite rule also used `!important` and
silently overrode that dedicated palette.

With correct late ownership, the cloned tour target now uses its intended treatment:

- `rgba(151, 106, 36, 0.9)` warm background;
- `rgba(255, 225, 157, 0.62)` border;
- cream icon fill/stroke and stronger glow.

The permanent Viewer favorite control is unchanged.

## Automated verification

The following passed:

- complete JavaScript verification, including TypeScript 7;
- frontend feature and runtime-symbol contracts;
- static accessibility audit;
- source performance budgets;
- all JavaScript contract tests;
- 342 Python tests;
- generated frontend asset currency and deterministic source order;
- CSS per-file `!important` ratchet;
- direct Python manifest test proving `90 < 92 < 95`;
- `git diff --check`.

A reduced-motion Chromium computed-style probe compared the original and updated Viewer CSS
for the following states:

- reader feedback button;
- search input and delegated focus field;
- favorite side control;
- auto-zoom recovery control;
- top toolbar and page rail tour states;
- generic, favorite and stage-navigation tour clones;
- disabled previous-step button.

All probed properties matched except the intentional favorite-tour palette correction described
above.

The regular `npm run test:python` wrapper could not install the pinned development environment
in the execution sandbox because its package mirror did not expose `PyMuPDF==1.28.0`.
The repository test suite was therefore run directly with the available system Python and
completed with 342 passing tests. Ruff and mypy were not available in that sandbox.

## Manual checks

### Viewer onboarding

1. Reset the Viewer onboarding storage and open the Viewer for the first-run tour.
2. On navigation and zoom steps, confirm the cloned controls are visible, clickable, and do not
   jump or translate on hover/focus.
3. On the final save/share/inquiry step, confirm the cloned favorite button has the warm
   dark-gold tour palette rather than the permanent selected-favorite gradient.
4. Confirm the favorite icon is cream, retains its glow, and reflects selected/unselected state.
5. Confirm the top toolbar and page rail become visible only on tour steps that request them,
   while their edge hotspots are temporarily disabled.
6. Confirm Previous is visually disabled on the first step and does not move on hover.
7. With reduced motion enabled, confirm tour transitions and animations are disabled.

### Permanent Viewer controls

8. Check the fixed favorite button in normal, hover, pressed, selected, and temporary feedback
   states. It must stay vertically centered and keep the existing selected gold palette.
9. Trigger the automatic-zoom recovery button, then check normal, hover, keyboard focus and
   pressed states. It must remain horizontally centered without position jumps.
10. Trigger copy/share/screenshot feedback in the top toolbar and confirm the temporary completed
    state keeps its active background and border.
11. Focus the Viewer search input with the keyboard. The complete search field must receive one
    outer focus ring; the text input must not display a second inner ring.
12. Check the same controls at desktop width and at widths below 760px.

### Accessibility

13. Confirm ordinary links, buttons, form fields, selects and textareas still receive the common
    focus ring.
14. In Windows high-contrast/forced-colors mode, confirm focus uses the system Highlight outline.
