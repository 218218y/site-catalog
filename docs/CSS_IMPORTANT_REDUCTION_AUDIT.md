# CSS `!important` Reduction Audit

> **Follow-up:** the cascade-ownership closeout in `docs/CSS_CASCADE_OWNERSHIP_CLOSEOUT.md`
> reduces the current reviewed total further from 72 to 22 declarations and moves Viewer onboarding
> from the early `05` slot to the late `92` feature-override slot. The counts below remain the historical
> record of the first reduction slice.

## Scope

This change is deliberately limited to CSS cascade cleanup and the contracts that protect it. It does not change HTML, JavaScript behavior, DOM structure, accessibility focus rules, onboarding behavior, forced-colors behavior, or reduced-motion behavior.

## Result

The reviewed source total was reduced from **105** to **72** `!important` declarations: **33 removals (31.4%)**.

| Source module | Before | After | Removed |
| --- | ---: | ---: | ---: |
| `src/css/20-viewer.css` | 27 | 5 | 22 |
| `src/css/25-viewer-actions.css` | 3 | 0 | 3 |
| `src/css/80-responsive-shell.css` | 10 | 6 | 4 |
| `src/css/85-favorites-routing.css` | 10 | 8 | 2 |
| `src/css/90-visual-polish.css` | 13 | 11 | 2 |
| Other CSS modules | 42 | 42 | 0 |

The untouched declarations include the intentionally forceful contracts for `.hidden`, visually hidden content, viewer onboarding clones, reduced motion, keyboard focus, and forced-colors mode.

## Cascade changes

### Shared Viewer controls

`src/css/20-viewer.css` now places component-specific reader-button styling after the base `.reader-button` state. Compound ownership selectors replace forced declarations for:

- `.reader-button.reader-control-icon-button`
- `.reader-button.viewer-fullscreen-float`
- `.reader-button.favorite-open-catalog-button`

The active fit, fullscreen, and top-bar pin states already have greater specificity than the base button, so their active background and border no longer need `!important`.

The ordinary source order is also sufficient for:

- `.reader-icon-button` padding
- `.reader-catalog-menu-toggle` padding
- hiding Viewer search UI in `favorites-viewer-mode`

### Mobile Viewer controls

`src/css/25-viewer-actions.css` no longer forces the mobile-more active palette or the compact-toolbar hidden controls. Their state selectors and IDs already outrank the base rules.

`src/css/80-responsive-shell.css` no longer forces the closed mobile-search results or the base auto-zoom geometry/palette. The more specific visible and hover rules remain unchanged where they are still needed.

### Route ownership and transfer dialog

`src/css/85-favorites-routing.css` uses a compound mobile selector for the centered “open catalog” control, so `padding-inline` wins without force. The standalone Viewer shell is hidden by a route-specific selector whose specificity is already higher than all ordinary shell display rules.

`src/css/90-visual-polish.css` scopes the transfer summary to `.favorites-transfer-copy .favorites-transfer-summary`; this naturally outranks the generic paragraph rule and preserves the 13px top margin and ink color without `!important`.

## Protection against regression

The CSS architecture contract now reviews the `!important` count per source module, not only as one global number. This prevents a new override from being silently added to one module while another module happens to remove one.

A focused contract verifies that the cleaned selectors remain free of `!important` and retain their ownership selectors.

## Browser equivalence proof

A Chromium comparison rendered the affected controls from both the original and updated Viewer bundles at desktop and mobile sizes. The comparison included base and hover states, active fit/fullscreen/pin controls, mobile visibility, the standalone route shell, auto-zoom, and the favorites transfer summary.

- Desktop `1280 × 900`: identical computed-style inventory and identical screenshot SHA-256 `1246e7c9e015a9012b80277a3df2d8dba17d94cb53ced3a24824df9df438dbbe`
- Mobile `390 × 844`: identical computed-style inventory and identical screenshot SHA-256 `40032b7d7b43295f6b45e148d1d82513d0039c5c3a925cffc38da62c3f688456`

## Manual checks

1. In the desktop Viewer top toolbar, verify active fit mode, active fullscreen, and pinned top-bar colors and borders.
2. Verify screenshot/share icon buttons and the catalog-switch icon retain their size and zero inner padding.
3. Hover and press the floating fullscreen control; it must remain vertically centered and retain its warm hover palette.
4. In favorites Viewer mode, verify the centered “open in full catalog” control on desktop and mobile, including hover without position jump.
5. At widths up to 760px, verify screenshot, pin, fit controls, favorites shortcut, and separator are hidden from the compact top bar.
6. Open the mobile “more” menu and verify its active button color and border.
7. Verify mobile Viewer search results stay hidden until the mobile-search-open state is active.
8. On `viewer.html`, verify the normal site header, global search, main content, scroll-to-top control, favorites panel, and footer remain hidden while the floating search preview is still available.
9. Open the favorites transfer dialog and verify the summary uses dark text with a 13px gap above it.

## Structural-contract boundary after Stage 3

The high-value JavaScript Regex-to-AST migration is complete for the frontend test architecture. Entrypoint ownership, Search/Catalog architecture, navigation search, telemetry structure, and the JavaScript portion of paged Viewer contracts now use the shared TypeScript AST inventory instead of matching implementation source text. Behavior tests execute the real named ES-module exports rather than a parallel test-only registry.

Mixed contracts intentionally remain mixed: HTML structure, CSS selectors/declarations, generated file headers, package scripts, documentation, and Python source contracts may still be asserted textually when the text itself is the artifact being governed. This is not considered frontend structural Regex debt. Any future Python-AST work for control-panel/compiler contracts belongs with Python tooling modernization rather than reopening the frontend test boundary.
