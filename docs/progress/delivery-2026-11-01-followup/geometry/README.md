# Follow-up geometry evidence — 2026-11-01

Scope: FUP-01, FUP-04 and FUP-08 from
`contracts/alpha-release-ux-followup-2026-11-01.md`. No commits or deployments.
The shared application source was not mutated by the fault checks.

## Behavior and implementation

- A 4000 × 3000 mm usable rectangle has centerlines `(0,0)`–`(4100,3100)`.
  Add `(0,0)`→`(0,-3100)`→`(2700,-3100)`→`(2700,-1100)`, then draw the
  4200 mm continuation from the free end to `(2700,3100)`. The last command
  crosses the existing boundary at `(2700,0)`, closes the upper room and
  partitions the lower room. It creates **three rooms in one Durable Revision**.
  There are **eleven wall segments**: seven old segments, two contact splits,
  and two new pieces. Keeping the prior upper segment rather than merging it
  silently preserves existing stable host identity.
- `derive-plan-faces.ts` previously required exactly four bounded faces at a
  shared vertex. This rejected the valid three-room junction, and also allowed
  two disconnected pairs of rooms simply because their count was four.
  Non-neighbouring faces sharing a vertex now need a connecting chain of faces
  through **walls incident to that same vertex**. Tests cover connected 2/3/4/8
  sectors, disconnected 2/3/4 sectors, reversed wall directions and input order.
- Integer-millimetre geometry, direction/contact validation, face traversal,
  nested-ring rejection, numeric commands and gesture endpoint normalization
  were not relaxed. Door and Window tests prove unaffected opening identity,
  size, kind, exact world location and successor-host offset after the split.
  Contact through an opening still rejects before allocating topology IDs.
- `PlanProjection.tsx` marks both the physical body and its outline with selected
  state. The UI slice styles this state with blue fill and outline; visible
  computed colors are verified, not just the state attribute.
- Empty pointer taps in selection mode call the common `onClearSelection`
  callback. A displacement greater than six screen pixels permanently cancels
  the tap candidate for that gesture. Panning away and back to the starting
  position therefore retains selection. Pointer cancellation and multi-touch
  retain their existing cancellation paths. Clearing selection is ephemeral:
  the exact durable project and revision count remain unchanged.

## RED → GREEN

| Check | RED evidence | GREEN evidence |
| --- | --- | --- |
| Exact screenshot topology and local room fans | `unit-red.log`: five failing cases | `unit-green.log`: 214/214, four files |
| Real touch construction, styling, mouse/touch empty tap | `browser-red.log`: four failing cases | `browser-green.log`: 6/6 |
| Mouse/touch out-and-back pan | `browser-pan-return-red.log`: selected body count falls from one to zero | Included in final 6/6 |

The topology browser case creates every wall through the actual mobile UI,
confirms each touch draft, verifies one new revision, checks exact Undo/Redo
snapshots, reloads, reopens the project from the hub and compares the saved
geometry. It does not seed the final graph or substitute a crossbar between
already closed boundaries. Reload intentionally opens the project hub; the
test was corrected to reopen the project before inspecting the plan.

`checks.json` records both TypeScript configurations and targeted Biome lint
passing. `source-sha256.json` identifies the six owned source/test/config files.
`selected-physical-wall.png` and `continued-open-contour.png` were visually
inspected at phone dimensions: selection is visible and all three room corners
are closed.

## Mutation scope and limitations

`stryker.followup-geometry.config.mjs` uses isolated copies (`inPlace: false`)
and the four relevant domain suites. The exact changed call and new helper
produce **47 mutants: 41 killed, six survived; 87.23%; no timeouts, no errors**.
This passes the repository's 80% threshold. The initial broader range produced
55/63 (87.30%); its full report is preserved too. The final range excludes the
unchanged interior-probe function and unchanged surrounding conditionals.

Survivor review (IDs from `mutation-final.json.gz`):

| ID | Change | Assessment |
| --- | --- | --- |
| 25 | Empty initial visited set | Equivalent result: the first face may be enqueued once again, then is marked visited; reachability is unchanged. |
| 29 | Remove optional chaining on current incident entry | Unreachable fallback: every queued cycle originates from the same incident array. |
| 34 | Non-empty fallback walls array | Same unreachable fallback invariant as 29. |
| 1 | `every` shared vertex → `some` | Survives the valid planar graph corpus. Retain the stricter all-vertices check; no claim of complete mutation coverage. |
| 14, 16 | Remove incident-edge filtering | Survive the valid planar graph corpus. The local filtering remains intentional; no valid counterexample that bypasses upstream face/contact checks was found. |

The final three survivors are reported as residual test-strength limitations,
not silently ignored or asserted to be mathematically equivalent. No mutator
was disabled and no test was written against private implementation details.

`browser-fault-checks.py` separately runs a fresh app copy with an isolated
server, first proving the six-test baseline and then injecting three focused
UI faults: suppressing the clear callback, suppressing selected wall styling,
and removing the pan movement guard. **All three faults were killed** by the
intended assertions (two empty-tap failures, one styling failure, two return-pan
failures). The separate six-test baseline passes. `browser-fault-summary.json`
proves the original `PlanProjection.tsx` SHA-256 remained identical before and
after; `browser-fault-*.log` contain the results. The isolated server was stopped.

Full application/browser/PWA regression is owned by the parent delivery run;
these results are the geometry slice, not a claim that every application path
was covered by these six browser scenarios.
