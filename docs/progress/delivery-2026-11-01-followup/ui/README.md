# Phone UI follow-up evidence — 2026-11-01

This is evidence for the follow-up UI slice, not a claim that every browser, device, screen, or accessibility configuration has been exhaustively audited. The parent delivery report owns the full application regression and production PWA results.

## Implemented behavior

- Notifications and related errors/status surfaces have no decorative left accent border. Existing complete outlines retain their normal role.
- Initial contour fields and wall confirmation actions use the existing rounded controls and spacing. Their scrollable surfaces leave the header, canvas history, zoom, and dynamically measured bottom dock reachable.
- The editor action menu is a native modal surface, with backdrop, large separated actions, internal overflow, and no header/dock reflow. The parent owns its DOM and focus lifecycle.
- Explicit wall properties use the same controls. The parent owns the Properties-only mounting rule; the geometry slice owns physical wall selection data attributes. Selected physical wall fill/outline is visibly blue.
- Room/catalog close glyphs fit their touch targets. Catalog category labels wrap; room select content has reserved arrow space; catalog composer inputs/actions remain readable and reachable at 200% text.
- Opening move confirmation is centered, contains no size fields, and clearly separates neutral Cancel and primary Confirm. On narrow screens actions become separate full-width rows; the single word «Подтвердить» no longer breaks into a final isolated letter.
- History and zoom glyphs retain 24px icon size inside 44px touch targets when text grows to 200%; surrounding text continues to grow.
- When a starter contour and a storage warning coexist, one scrollable stack places the warning before the form between the measured header and history/dock. Both cleanup and contour submission can be reached and clicked on a short phone screen. Warning state/handlers and cache semantics were preserved. The parent integrated the small TSX extraction in `storage-stack-AppShell.patch` while retaining its independent lifecycle fixes.

## Automated and visual scope

`apps/web/tests/browser/release-followup-layout-e2e.spec.ts` now has 22 cases. Phone geometry is tested with Chromium/Chrome mobile emulation. Text enlargement means setting the root font size to 200%, not a claim of hardware or OS-level accessibility certification.

| Surfaces | Width × height / text size |
| --- | --- |
| Project directory/create form, starter contour, wall draft confirmation, editor menu | 320×568 / 100%; 390×844 / 100%; 430×932 / 200%; 360×480 / 200% |
| Room type selector, room height, dimension tabs, catalog categories/composer | 320×844 and 430×844 / 200% |
| Explicit wall properties and opening move confirmation | 320×568 / 100%; 360×480 / 200% |
| Error notice outline and manual dismissal | 360×640 / 100% |
| History and zoom glyph bounds | 360×480 / 200% |
| Storage cleanup plus starter contour | 320×568 / 100%; 360×480 / 200% |

Checks include 44px minimum touch targets, rounded controls, 9-point `elementFromPoint` hit testing after real scrolling, text range containment inside buttons, absence of horizontal overflow, separation from fixed controls, actual clicks, menu focus return, contour creation, and cache action feedback. No force-clicks are used. The PWA suite separately verifies real browse-cache cleanup semantics.

Representative current screenshots are in `screenshots/`: new project, initial contour, wall confirmation, explicit wall properties, menu, room properties, dimension filters, catalog composer, opening confirmation, history/zoom, and storage actions. The final copies were refreshed from the complete 22-case isolated sweep after late fixes. `red-history-zoom-glyphs-360x480-200.png` is deliberately retained as pre-fix evidence. Short screens intentionally scroll the form/menu body rather than shrink text or overlay the fixed canvas tools.

## RED → GREEN

- `red-layout.log`: initial 13 layout cases failed on requested design defects.
- `red-forms.log`, `red-room-close.log`, `red-category-wrap.log`: physical target/glyph and category wrap regressions.
- `red-wall-properties.log`, `red-dock-inset.log`: selected properties styling and history collision with a growing action dock.
- `green-18-with-hmr-interruption.log`: 18 passed, one setup interrupted by a concurrent source reload; `green-430-rerun.log` passed that case independently. The later complete isolated sweeps provide uninterrupted evidence.
- `red-glyph-audit.log`: direct measured evidence that 48px glyphs in 44px targets produced 66px text bounds at 200%.
- `late-visual-storage-red.log`: four genuine failed assertions (320px confirmation word split, glyph overflow, and both storage/form collisions); the existing 360px confirmation case already passed.
- `late-visual-storage-green.log`: all 5 affected cases passed (13.8s).
- `green-22-isolated.log`: all 22 final cases passed (42.7s). Owned final source/test hashes are recorded in `final-owned-source-sha256.json`.
- Biome check of the final browser test passed. Full type/lint/build/production checks belong to the parent run.

## Executable CSS fault checks

CSS is outside the TypeScript Stryker instrumentation used elsewhere in this project. Seven deliberately seeded CSS faults were therefore executed against an isolated source snapshot, never the live workspace. These are focused checks, not an aggregate mutation score or coverage of every possible UI fault.

| Seeded fault | Detecting behavior |
| --- | --- |
| Restore a 4px left notification accent | Uniform outline assertion fails |
| Lower contour into history | Geometry/hit test fails |
| Make wall action buttons square | Rounded control assertion fails |
| Reduce menu close target to 32px | Minimum touch target assertion fails |
| Attach primary opening confirmation to the bottom | Centering assertion fails |
| Disable catalog category wrapping | Text containment assertion fails |
| Restore a fixed 96px history offset | History/dock separation fails at 200% |

All seven failed for the intended behavior assertions. Baseline 19/19 passed (40.67s), then restored 19/19 passed (42.98s). `mutation/results.json`, per-fault logs/patches, runner, and `restored-source-sha256.json` preserve the evidence. The initial `setup-missing-catalog-*` logs are an explicitly excluded harness setup failure; required catalog files were added before the accepted baseline. The late glyph/confirmation/storage fixes have their own direct RED/GREEN evidence and were not represented as part of that earlier seven-fault run.

No commits, deployment, real-device PWA installation, or changes to production build artifacts were made by this UI slice.
