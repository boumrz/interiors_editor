# Browser regression migration — 2026-10-25

The phone editor contract removed wall thickness editing, the measurement picker, generic wall-panel creation and numeric Opening offsets. Existing durable geometry and history still require regression coverage. No test was skipped and no test-ignore configuration changed.

## Retained behavior

- Schema-validated legacy Projects are reopened through the normal Hub. Fixtures use real domain operations and canonical serialization with SHA-256. They add a revision only inside the test's isolated browser profile; application commands under test start after reopening. Existing exact resources remain attached.
- Legacy panel position, lock, color, reversal, T/X rehosting, vertex normalization and explicit atomic removal stay tested. New authoring/side/overlap/duplication use the real catalog sconce GLB.
- Legacy Opening positions remain exact fixture data. New Door/Window creation is tested through the real automatic-placement form; size/sill edits and cancellation remain real UI operations. Removed controls have absence assertions.
- Test points use actual SVG transforms and integer millimetre targets, rather than percentages of the full viewport. Detached diagonal gestures still produce exactly five walls; room/junction/vertex counts and Durable Revision assertions were retained.
- Collision setups keep two intentionally coincident placements, distinct duplication poses and rejected geometry. Pointer movement is valid or invalid by the actual room geometry, not by an obsolete screen pixel delta.
- The 3D passive footprint is compared with the same selected item's overview area after an actual touch orbit/reset. Its focused area must grow, and its centre must remain inside the canvas between the header and camera deck. The dome retains its independent touch-target checks.
- EDITOR-14 checks all four painted wall bodies and eight dimension labels fit the exposed viewport without intersecting the legend; its exact 44 px wall hit width and real pinch/pan assertions remain.
- The two pre-existing false-positive setups were strengthened: the 5 px microdrag actually starts on the canvas, and the prior-pan case proves that the viewport transform changed.

## Retired measurement case mapping

| Former case | Replacement in `drawing-dimensions-e2e.spec.ts` |
| --- | --- |
| MEASURE-E2E-01 | DRAWING-01: passive clear/axis/outer dimensions, no revision |
| MEASURE-E2E-02 | DRAWING-03: enlarged narrow plan, partition, Undo, reload |
| MEASURE-E2E-03 | DRAWING-04: same-name item identity, 3D/Plan/Undo |
| MEASURE-E2E-04 | DRAWING-05: wall deletion, quota retry, last durable plan |

The domain measurement unit tests were retained. The separate drawing suite is owned and verified by root.

## Evidence

- `red.log`: the old controls really disappeared before migration.
- `broad-1.log`, `broad-2.log`: initial affected cases and the concrete stale assumptions exposed by the first runs.
- `final-reference-8.log`: 4/4 pass — both reference apartments, passive selection/dome and selected-item context.
- `geometry-1.log` plus `floor-1.log`: six initial gesture cases pass, then the remaining exact endpoint/split regression passes.
- `floor-2.log`: 21/27 pass before six concrete remaining setup/menu/locator issues were fixed.
- `floor-3.log`: all 10 selected remaining cases pass, including the selected-wall host regression.
- `mobile-fit.log`: EDITOR-14 passes the new wall/body/label fit contract with its pinch and pan.
- `pan-20.log` and `pan-20-green.log`: the construction/placement two-finger translation uses current SVG points; its placement draft explicitly disables the legacy helper's auto-confirm behavior so the no-publication assertion remains meaningful.
- `typecheck-final.log`, `lint-final.log`: web type checking and scoped lint pass.
- `snapshot-manifest.json`: frozen test hash, profile/runtime and scope.

The first full application run used an earlier snapshot and supplied migration failures. Its totals must not be reported as the final frozen application's result. Root runs the second complete suite independently.
