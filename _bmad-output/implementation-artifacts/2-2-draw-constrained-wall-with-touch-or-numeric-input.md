---
baseline_commit: NO_VCS
---

# Story 2.2: Нарисовать constrained Wall прямым touch-жестом

Status: done

## Story

Как пользователь,
я хочу строить и корректировать стену прямо на рабочей поверхности телефона,
чтобы постепенно собрать настоящий план, а не заполнять отдельную форму.

## Acceptance Criteria

1. Phone-first Plan workspace занимает доступный app viewport; верхняя строка
   компактна, а выбранные свойства остаются внутри редактора. Критичные controls
   доступны без hover, не меньше 44×44 CSS px и сохраняют truthful durable/error
   status.
2. Пользователь может панорамировать и масштабировать 2D-проекцию. Zoom/grid
   не меняют integer-mm каноническую геометрию.
3. Для выбранной стартовой стены пользователь может изменить length без кнопки
   «Применить»: валидный Enter или blur публикует команду, невалидный ввод
   объясняет причину и оставляет последнюю valid Revision.
4. Любая новая Wall проходит единый constrained touch candidate path:
   `0°/45°/90°`, integer-mm coordinates, stable reason code, topology validation
   и durable publication. Пока полный corpus/gate не закрыт, недоказанные
   topology transitions не маскируются как готовая возможность.
5. Review P1 из Story 2.1 исправлены до расширения geometry: ProjectBounds,
   строгая rectangular validation, durable snapshot/candidate coherence и
   retry continuity.
6. Rstest покрывает domain/application transitions; Playwright mobile E2E
   доказывает workspace, прямое изменение размера, сохранение/reopen и
   отсутствие отдельной apply-кнопки. Material visual checkpoints получают
   browser-emulation screenshot.

## Tasks / Subtasks

- [x] Repair the review-blocking V-02 correctness base (AC: 3, 5)
  - [x] RED: add boundary, non-rectangle, revision-coherence and retry-continuity tests.
  - [x] GREEN: make the smallest domain/application/persistence fixes while preserving the last durable revision.
  - [x] Run targeted mutation analysis for changed domain/application paths; renderer/UI stay outside the domain/application mutation scope.
- [x] Build the full-viewport EditorShell foundation (AC: 1, 2, 6)
  - [x] RED: add pure viewport reducer tests and mobile E2E assertions for compact shell/no persistent helper card.
  - [x] GREEN: implement safe-area-aware plan workspace, pan/zoom state and accessible in-canvas controls with CSS Modules.
  - [x] Capture and label a mobile-browser screenshot after the visual milestone.
- [x] Replace explicit rectangle apply with direct selected-wall dimensions (AC: 1, 3, 6)
  - [x] RED: test automatic valid commit and invalid-value continuity.
  - [x] GREEN: use the existing canonical configuration path for the starter wall; properties are contextual, not a side form.
  - [x] Add Playwright flow for keyboard/direct interaction and reopening the durable result.
- [x] Establish the constrained-wall command seam (AC: 4)
  - [x] RED: write integer-mm, direction, repeated cross-grid, zero/duplicate/intersection and rejection-continuity domain tests.
  - [x] GREEN: implement the proven orthogonal, full-span 100-mm lattice transition with room reconciliation, then add the first durable 45° free/vertex/body-branch path. Exact integer-mm diagonal contacts normalize to a shared vertex; fractional contacts and non-rectangular faces remain explicitly rejected.
  - [x] Add touch candidate mapping to the same lattice contract; touch preview and final canonical coordinate snap to 100 mm.
  - [x] Add a touch review candidate with exact length/direction and explicit
        DOM confirm/cancel; a touch release alone cannot publish a Revision.
  - [x] Remove direct global-coordinate entry and coordinate editing from the
        Wall UI after the Product Owner excluded them from Alpha; gesture
        candidates remain the sole user-facing route.
  - [x] Materialize a simple concave closed contour as one exact durable Room,
        derive its inward usable polygon, triangulate its disposable 3D floor
        without filling the recess, and fail closed when wall insets collapse
        a narrow concavity.
- [x] Verify this delivered portion (AC: 1–6)
  - [x] Run `lint`, `typecheck`, Rstest, build and Playwright mobile suite.
  - [x] Run the target mutation commands after source mutation safety is confirmed.
  - [x] Update evidence notes, File List and Dev Agent Record with actual results only.
- [x] Replace the retired Room-metadata-successor split panel (Product Owner
      correction 2026-08-24)
  - [x] RED: prove a valid wall-induced split creates all successor Rooms in
        the same confirmed command, preserves each predecessor `heightMm`, and
        exposes no left/right metadata dialog.
  - [x] GREEN: remove the `roomId`/name/type/history retention choice and the
        2600-mm default-successor rule; keep merge and unresolved
        Opening/asset/surface-host safety consequences explicit.
  - [x] Prove the phone route and inverse/reopen behavior through focused
        domain/application/browser evidence.

### Review Findings

- [x] [Review][Patch] [High] Make Wall target eligibility stable in CSS pixels across pan/zoom and preserve Vertex-before-body target priority [apps/web/src/ui/wall-draft.ts:175]
- [x] [Review][Patch] [High] Use exact direction-independent projection and intersection for 45-degree Wall start/end/body contacts, including forward-only targets and the raw-pointer near-contact path [apps/web/src/ui/wall-draft.ts:207]
- [x] [Review][Patch] [Medium] Reject invalid snap radius/step configuration before any exact-corner candidate can be produced [apps/web/src/ui/wall-draft.ts:240]
- [x] [Review][Patch] [Medium] Distinguish a real magnetic join from ordinary direction/grid quantisation and do not present a domain-invalid minimum Wall as confirmable [apps/web/src/ui/wall-draft.ts:88]
- [x] [Review][Patch] [Medium] Allocate the disposable candidate Wall ID through the collision-safe temporary-ID path [apps/web/src/domain/add-wall-segment.ts:274]
- [x] [Review][Patch] [High] Reject empty or colliding materialized IDs and never silently omit a planned Wall piece [apps/web/src/domain/add-wall-segment.ts:307]
- [x] [Review][Patch] [High] Reject the complete candidate when contact normalization would leave a partition no longer than its Wall thickness [apps/web/src/domain/add-wall-segment.ts:119]
- [x] [Review][Defer] Adopt the complete revision-bound `PlanProjectionPort` hit/tie/hysteresis corpus beyond this Product Owner-approved minimal gesture slice [apps/web/src/ui/wall-draft.ts:175] — deferred, pre-existing
- [x] [Review][Defer] Reconcile the historical general-topology and collinear-extension behavior with the source-owned TCC-A1 adoption gate [apps/web/src/domain/add-wall-segment.ts:80] — deferred, pre-existing
- [x] [Review][Defer] Migrate the historical geometry reason-code union to the canonical `INVALID_DIMENSION` / `ZERO_LENGTH` / `PROJECT_BOUNDS_EXCEEDED` contract [apps/web/src/domain/add-wall-segment.ts:55] — deferred, pre-existing
- [x] [Review][Defer] Replace incremental `IdPort` consumption with a complete allocation reservation/retirement boundary [apps/web/src/domain/add-wall-segment.ts:307] — deferred, pre-existing
- [x] [Review][Defer] Retire or harden the explicitly fixture-only V2 publication route with base coherence and stale-revision outcomes [apps/web/src/application/add-wall-to-project-v2.ts:38] — deferred, pre-existing

## Dev Notes

### Contract and architecture guardrails

- Map to `CAP-2`, `CAP-3`, `CAP-5`, `CAP-6`; `FR-6`–`FR-12`; `NFR-15`,
  `NFR-17`, `NFR-18`; `AD-2`, `AD-5`, `AD-7`, `AD-10`, `AD-12`, `AD-13`.
- `Project.level.vertices` and `wallSegments` are canonical. SVG/WebGL and
  camera/viewport state are projections only. Coordinates and dimensions are
  integer millimetres; screen/grid snapping cannot overwrite valid numeric
  geometry.
- Preserve `Room.heightMm` as the only editable height source. Do not add an
  ad-hoc geometry store, a renderer-owned mesh model or a new UI framework.
- Use React + TypeScript + Rspack + Rstest + CSS Modules. No new dependency
  without an explicit user approval.
- The current raw WebGL2 adapter stays disposable. This iteration also adds
  transient 3D orbit/pan/pinch and canonical floor-hosted schematic items;
  neither a camera transform nor a WebGL object becomes Project state.
- The user has given an explicit written waiver to begin before BMAD READY.
  This does not close `G-S2`, `G-S4` or `G-S1`; do not claim it does.

### UX direction

Use a restrained, drafting-table aesthetic: pale canvas, thin technical grid,
dark floor-plan lines, a single blue selected state and compact black-on-light
numeric controls. No generic dashboard, hero, card stack or permanent tutorial.
The product reference supports the goal of quick plan drawing, moving walls,
furnishing and a real-time 3D companion; do not reproduce its branding or
information architecture.

### Prior review findings that block geometry extension

1. `rectangular-room.ts` needs ProjectBounds and non-rectangle rejection.
2. Durable repository must bind candidate Project to verified serialized
   Revision/pointer identity, not merely checksum a separate snapshot.
3. Retry must keep prior durable editor state visible.
4. WebGL partial shader cleanup and screenshot provenance are P2 follow-ups.

### Testing requirements

- TDD: write and run a failing behaviour test before each production-code
  change; retain evidence in the Debug Log.
- Use Playwright mobile-browser E2E and capture screenshots after visible
  milestones. Label them as browser emulation, never as physical-device proof.
- Mutation scope is currently domain/application. Do not run concurrent source
  edits while Stryker mutates files.

## Dev Agent Record

### Debug Log

- 2026-08-05: Story created by the approved editor-workspace change proposal.
  Existing V-02/V-03 code is in review, with four P1 base defects recorded
  above. No Story 2.2 implementation task has been marked complete.
- 2026-08-05: RED/GREEN P1 repairs added for project bounds, strict starter
  rectangle recognition, candidate/revision coherence and retry continuity.
- 2026-08-05: Replaced the card shell with a safe-area-aware `100dvh` editor;
  pan/zoom and 3D camera state stay transient. Mobile E2E now covers direct
  dimension publication, a first orthogonal divider, a schematic item in both
  projections, 3D touch orbit, durable reopen and recovery paths.
- 2026-08-05: Browser-emulation checkpoints captured as `SC-V04` through
  `SC-V08`; `SC-V07` shows a two-room, seven-wall plan and `SC-V08` shows
  in-canvas 3D characteristics. This is iPhone-13
  browser emulation, not physical-device evidence.
- 2026-08-05: The schematic item is now constrained to the usable polygon of
  its named room for the supported rectangular/one-divider topology. A
  cross-divider placement is rejected with `OUTSIDE_ROOM_HOST` and a local UI
  explanation; application failure/retry candidate paths are covered.
- 2026-08-05: The WebGL program factory now releases a compiled vertex shader
  if fragment compilation fails; this is covered by a renderer unit test.
- 2026-08-06: Replaced the single-divider limitation with canonical repeated
  orthogonal grid transitions. A second crossing divider yields 9 vertices,
  12 wall segments and 4 derived room cells; all new lines must be on the
  100-mm lattice and leave usable wall-to-wall clearance. The Plan projection
  draws that same lattice rather than an unrelated decorative pattern.
- 2026-08-06: New floor items have direct name/width/depth/height fields
  before placement. The host room is resolved from the complete footprint,
  never `rooms[0]`; a too-large footprint is rejected without publishing.
  Existing items can be dragged in Select mode; the move re-hosts only when
  its full footprint fits a destination cell, otherwise its previous Durable
  Revision is retained. `EDITOR-E2E-08` through `EDITOR-E2E-10` cover the
  grid, oversize rejection, durable move and rejected move cases.
- 2026-08-06: Updated the default disposable 3D camera for a portrait phone:
  it starts above and diagonal to the plan, avoiding a straight-on exterior
  wall. Browser-emulation checkpoints `SC-V11`–`SC-V13` were captured; these
  are not physical-device evidence.
- 2026-08-06: Full verification passed: Biome lint, TypeScript, 102 Rstest
  tests, production Rspack build and 14 Playwright mobile-browser scenarios.
  The full domain/application mutation run killed 781 of 1,392 mutants
  (56.54%, 6 timeouts): this is an explicit quality debt, not a release
  approval. The targeted move-command rerun killed 18 of 20 (90%); the two
  remaining `saved` event-object mutations need broader controller-event
  observability rather than a UI-only assertion.
- 2026-08-06: Correct-course slice completed for the reported editing gaps.
  A selected parametric floor item now resizes durably on blur/Enter, drag
  moves it on the 100-mm grid, and simple placeholder footprints cannot
  overlap (an exact shared edge is valid). Expansion adds a durable outer
  strip on all four grid-aligned sides while preserving existing room IDs.
  Rejected resize, collision and expansion remain non-durable. `EDITOR-E2E-11`
  and `EDITOR-E2E-12` cover these mobile-browser flows.
- 2026-08-06: Targeted Stryker runs killed every mutant in each changed
  domain/application boundary: resize command 20/20, expansion command
  20/20, item collision footprint 44/44 and outer-strip expansion 58/58.
  This is scoped evidence only; it does not replace the older full
  domain/application mutation debt recorded above.
- 2026-08-06: Cutaway projection now retains interior dividers, an open outer
  viewing corner, floor-board material bands and semantic low-fidelity
  furniture shapes. `SC-V16` and `SC-V17` are 390×844 browser emulation,
  never physical-device certification. The reference-level photorealistic
  result remains blocked on licensed catalog assets and an asset pipeline.
- 2026-08-06: The 3D renderer is lazy-loaded. The production entry bundle is
  297 KiB with a separate 15 KiB 3D chunk and the previous Rspack 300 KiB
  entry warning is gone. Full verification: Biome, TypeScript, 126 Rstest
  tests, production build and 16 Playwright mobile-browser scenarios passed.
- 2026-08-22: Numeric Wall entry now captures four signed safe integer-mm
  centreline coordinates and creates the same transient `WallDraft` review
  candidate as touch. It does not round input or call the wall mutation
  directly: invalid decimals, a zero length and non-cardinal lines remain
  visibly rejected and no Durable Revision exists until the shared explicit
  confirm action. `EDITOR-E2E-02R` covers the decimal rejection, non-durable
  candidate and a confirmed `2050,0 → 2050,3100` divider (7 walls / 2 rooms).
- 2026-08-22: Independent review found the numeric form could be clipped by a
  short viewport or software keyboard. `EDITOR-E2E-02S` first reproduced it;
  the form now has a viewport-bounded internal scroll area, 44 px inputs and
  16 px input text. The reviewer rechecked the correction clean.
- 2026-08-22: The product boundary remains explicit: there is no room picker,
  selected-room inspector, or separate room construction tool in Plan or 3D.
  Rooms are derived from walls only; `PLAN-E2E-03`, `PLAN-E2E-07`,
  `EDITOR-E2E-03C` and `EDITOR-E2E-03D` cover the user-visible boundary.
- 2026-08-22: Numeric wall validation now marks all four endpoint inputs
  invalid and associates them with one announced error. `EDITOR-E2E-02R`
  first failed on the missing relationship and now proves the four field
  references, the non-durable invalid result and the one explicit publication.
- 2026-08-23: Product Owner excluded all direct global-coordinate placement
  and editing from Alpha. The numeric Wall-entry panel, numeric Wall move,
  numeric split and endpoint-Vertex fields are deleted from the phone UI;
  `EDITOR-E2E-02R` and `PLAN-E2E-04E` now protect their absence. The internal
  integer-mm geometry and gesture candidate validation remain the canonical
  safety contract, not a user-facing coordinate surface.
- 2026-08-23: The next touch-first topology increment begins in Story 2.3:
  an eligible endpoint of a detached cardinal Wall can be dragged only along
  its safe axis, previewed and explicitly confirmed or cancelled. This is not
  a numeric replacement and does not claim junction/multi-segment or 45°
  topology support.
- 2026-08-23: The first safe 45° wall slice is now on the user path. One
  touch gesture picks one of `E, NE, N, NW, W, SW, S, SE` with the
  origin-relative 100-mm quantisation contract, previews actual length and
  direction, and still requires explicit confirm. A durable 45° wall may be
  free or branch from an existing corner; it remains visible in Plan and as a
  rotated disposable wall in 3D. A diagonal closed/non-rectangular Room is
  rejected rather than silently damaging room metadata. V2 remains
  cardinal-only as an isolated compatibility route.
  Evidence: 1201 Rstest, TypeScript (both configs), Biome (234 files),
  production Rspack build, 117/117 mobile Playwright; targeted mutation scores
  are 89.41% for gesture snapping and 100% for durable diagonal decisions.
- 2026-08-23: A diagonal branch may now end in an existing wall body when the
  contact is an exact integer-mm point. The command normalizes it to one shared
  Vertex and splits the touched segment before durable publication, preserving
  the existing rectangular Room and its metadata. Exact diagonal X contacts
  receive the same treatment; a half-millimetre crossing and positive
  collinear overlap reject before any ID allocation, while a zero-length
  endpoint touch can extend the existing diagonal. The focused policy mutation
  run killed 32/33 mutants (96.97%); the one survivor is the equivalent
  `collinear && overlap` short-circuit for a non-collinear intersection.
- 2026-08-23: RED coverage for the diagonal reversal confirms that deleting
  the divider needs an explicit Room-metadata merge choice before publication;
  `EDITOR-E2E-02X` then proves cancel/reopen/confirm on a phone browser. A
  second RED test exposed that 45° Wall hosts were absent because their
  physical length is irrational. The host now floors that length to an
  integer-safe interval; `EDITOR-E2E-02Y` proves a selected diagonal divider
  creates and reopens a Door without coordinate placement. Manual mutation
  `Math.floor → Math.ceil` makes the 2,828-mm boundary assertion fail.
- 2026-08-05: `lint`, typecheck, 91 Rstest tests, production build and 11
  mobile-browser Playwright scenarios are green. The completed domain/app
  mutation run killed 595 of 773 mutants (76.97%). The configured break
  threshold is unset, but the 80% high threshold is not met and remains
  explicit quality debt.
- 2026-08-24: Triangle-hosted floor Items now use the already-derived exact
  inward usable triangle rather than its rectangular bounds. Every footprint
  corner must lie in that convex polygon; a crossing, including after a 45°
  rotation, rejects as `OUTSIDE_ROOM_HOST` without allocating an ID. RED/GREEN
  domain coverage and `EDITOR-E2E-02VA` prove accepted durable placement,
  reload and 3D reopening. Focused Stryker killed 12/13 mutants (92.31%); the
  lone survivor is equivalent because an accepted derived triangle can only
  contain three usable-polygon points. Final evidence: Biome 240 files, both
  TypeScript configurations, 1,239 Rstest, production Rspack, the 3-scenario
  production PWA suite and all 119 ordinary mobile scenarios.
- 2026-08-24: An existing Door on a stable 45° host is now evidenced through
  its complete safe edit route. `EDITOR-E2E-02Y` first proves that a
  10,000-mm width remains a non-durable rejected draft, then publishes the
  valid 1,300-mm width and changed swing side as exactly one revision on the
  same Wall, across reload and WebGL reopening. Domain coverage fixes the
  exact conservative 2,828-mm diagonal-width boundary (2,829 mm rejects) and
  ensures an oversized Window keeps its distinct rejection code. The focused
  Stryker width-validation run kills 15/15 mutants.
- 2026-08-26: A six-Wall L-shaped contour now materializes one durable Room
  with its exact canonical fingerprint and inward-offset usable polygon. The
  WebGL floor uses concave triangulation rather than a first-vertex fan, and a
  narrow U-shaped recess whose 100-mm wall insets collapse is rejected instead
  of producing misleading geometry. `EDITOR-E2E-02VC` proves touch creation,
  exact polygonal Plan projection, 3D opening and durable reload on iPhone-13
  browser emulation. Evidence: 1,309/1,309 Rstest, both TypeScript configs,
  Biome (247 files), production Rspack, focused Playwright 1/1 and scoped
  Stryker 24/29 killed (82.76%). This is not physical-device acceptance.
- 2026-08-27: Review closure implemented all seven accepted patches. Magnetic
  corner targets now retain a 24-CSS-px touch square across zoom, choose a
  Vertex before a wall body and keep exact forward-only integer-mm contacts on
  cardinal and 45-degree rays. Grid-only quantisation no longer draws a false
  magnetic guide, and a centreline no longer than its Wall thickness cannot be
  confirmed or materialized. Temporary/materialized identities and every
  planned graph piece now fail closed on missing or colliding IDs. Focused
  mutation evidence is 83.36% across 535 mutants (UI 83.70%, domain 82.63%).
  Full evidence: warning-free Biome over 259 files, both TypeScript configs,
  production Rspack, 1,473/1,473 Rstest, 147 ordinary mobile scenarios with
  the one backend-dependent scenario green on isolated fixture rerun, and 5/5
  production PWA. The live PostgreSQL smoke remains an environment/release
  gate rather than a Story 2.2 blocker.

### Completion Notes

- **Review closed — 2026-08-27.** Every accepted High/Medium finding is
  patched and verified. The five broader pre-existing contracts remain in the
  explicit deferred ledger; none is silently represented as Story 2.2 scope.
  Story 2.2 is `done` for the Product Owner-approved Minimal Alpha boundary.
- **Minimal Alpha closure — 2026-08-26.** Story 2.2 is handed to `review` at
  the Product Owner-approved minimum: a phone user can draw one direct Wall in
  free space or onto supported geometry; the candidate is constrained to
  0/45/90 degrees with origin-relative 100-mm integer endpoints, exposes its
  actual length/direction, and requires explicit confirm/cancel before one
  Durable Revision. Pan/pinch, tap, micro-drag and cancellation remain
  non-durable; confirmed geometry reopens through the canonical PlanGraph and
  projects consistently in Plan/3D. Direct global-coordinate entry and the
  separate Room tool remain excluded from Alpha. Focused closure evidence is
  29/29 Rstest and 16/16 iPhone-13 browser-emulation scenarios through the
  external tunnel. The complete S-2/device corpus and independent review stay
  visible as release/review gates; general post-closure editing and hosted
  reconciliation continue in Stories 2.3, 2.4, 3.4 and 5.3 rather than holding
  this minimal direct-Wall story in development.
- **Scope correction — 2026-08-24.** The Product Owner removed the
  metadata-successor choice from a Room split. The next implementation slice
  replaces the historical dialog with immediate valid `AddWall` publication;
  every successor gets its predecessor's exact `heightMm`. `roomId`, name,
  type and history are not selected by the user, and the historical 2600-mm
  default-successor rule is retired. This does not remove the separate merge
  choice or any unresolved Opening/asset/surface-host safety flow.
- **Implemented — 2026-08-24.** The successor chooser, its stale-preview
  route and its 2600-mm replacement policy are removed from the domain,
  application/controller and phone UI. A confirmed valid Wall now persists
  its split in one revision; all successor Rooms inherit their predecessor's
  exact height. A merge still requires its explicit retained-Room choice.
  Evidence: 1,239 Rstest; both TypeScript configurations; Biome (240 files);
  production Rspack; six affected mobile-browser scenarios; all three PWA
  scenarios; and scoped Stryker 1/1 killed (100%).
- The delivered slice is usable for creating a starter rectangle, direct
  width/depth editing, panning/zooming, multiple constrained vertical and
  horizontal full-span dividers on a 100-mm grid, outward grid expansion on
  all sides, parametric room-hosted schematic floor items, durable select /
  move / resize with strict temporary placeholder overlap prevention and 3D
  cutaway inspection. The supported room host uses inward wall offsets, so an
  item cannot silently cross into an adjacent room or leave a grid cell.
  It is **not** the full constrained-wall story: it has the first clean closed
  45° triangle, a square Room split into two triangles, and a simple concave
  Room with an exact usable polygon. The historical
  metadata-successor panel for that split is superseded; the current target is
  automatic predecessor-height inheritance. The exact diagonal divider can be
  deleted only through the existing explicit metadata-merge choice, returning
  to the square without silently selecting a Room. A Door may use a selected 45° host wall through a
  conservative integer interval and safely change its editable properties
  while that host is unchanged. Triangle-hosted floor Items now use the exact
  inset polygon, including complete-footprint and rotated rejection. General
  post-closure polygon edits, later join/vertex editing across diagonal
  topology, and opening edits after diagonal topology changes remain open.
- Direct global-coordinate entry is deliberately excluded from Alpha. At
  present the reviewed touch candidate supports horizontal, vertical and 45°
  free/vertex/body-branch canonical walls. Supported closed 45° Rooms are a
  clean three-wall triangle and the two triangles from one square split with
  automatic predecessor-height inheritance. The general 45° room topology corpus
  remains unavailable.

### File List

- `_bmad-output/implementation-artifacts/2-2-draw-constrained-wall-with-touch-or-numeric-input.md`
- `apps/web/src/domain/{project,rectangular-room,constrained-partition,parametric-item}.ts`
- `apps/web/src/domain/parametric-item.test.ts`
- `apps/web/src/domain/{add-wall-segment,derive-plan-faces,add-wall-to-project-v2,general-wall-project,derived-orthogonal-plan-faces}.ts`
- `apps/web/src/domain/door-opening-project.ts`
- `apps/web/src/domain/door-opening-project.test.ts`
- `apps/web/src/application/{configure-rectangular-room,add-constrained-partition,create-parametric-floor-item,move-parametric-floor-item,resize-parametric-floor-item,expand-orthogonal-grid}.ts`
- `apps/web/src/app/{project-controller,production-app}.ts`
- `apps/web/src/adapters/{persistence/durable-project-repository,renderer/rectangular-room-projection,renderer/webgl2-room-renderer}.ts`
- `apps/web/src/ui/{AppShell,RoomScene3d,editor-viewport,three-dimensional-viewport}.tsx`
- `apps/web/src/ui/wall-draft.ts`
- `apps/web/src/ui/wall-draft.test.tsx`
- `apps/web/stryker.story-2-2-review.config.mjs`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/src/**/**/*.test.ts`, `apps/web/tests/browser/{editor-workspace-e2e,plan-e2e,project-e2e}.spec.ts`
- `apps/web/stryker.{wall-draft,diagonal-wall,diagonal-editing,triangular-room,diagonal-room-split,concave-room}.config.mjs`
- `docs/progress/screenshots/SC-V04-touch-wall-candidate-browser-2026-08-22.md`
- `docs/progress/screenshots/SC-V04-full-viewport-editor-mobile-browser-2026-08-05.png`
- `docs/progress/screenshots/SC-V05-partition-items-2d-mobile-browser-2026-08-05.png`
- `docs/progress/screenshots/SC-V06-item-3d-mobile-browser-2026-08-05.png`
- `docs/progress/screenshots/SC-V07-partition-2d-mobile-browser-2026-08-05.png`
- `docs/progress/screenshots/SC-V08-3d-metrics-mobile-browser-2026-08-05.png`
- `docs/progress/screenshots/SC-V11-grid-plan-and-parametric-item-mobile-browser-2026-08-06.png`
- `docs/progress/screenshots/SC-V12-grid-plan-3d-mobile-browser-2026-08-06.png`
- `docs/progress/screenshots/SC-V13-moved-item-grid-mobile-browser-2026-08-06.png`
- `docs/progress/screenshots/SC-V14-cutaway-grid-furniture-mobile-browser-2026-08-06.png`
- `docs/progress/screenshots/SC-V15-corrected-cutaway-grid-furniture-mobile-browser-2026-08-06.png`
- `docs/progress/screenshots/SC-V16-final-cutaway-grid-furniture-mobile-browser-2026-08-06.png`
- `docs/progress/screenshots/SC-V17-expanded-plan-selected-item-mobile-browser-2026-08-06.png`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06-interactive-layout-cutaway.md`

### Change Log

- 2026-08-27: Patched all seven accepted code-review findings, passed the
  focused 83.36% mutation gate and full source/mobile/PWA regression, then
  moved Story 2.2 from `review` to `done`. No commit was created.
- 2026-08-26: Closed the Product Owner-approved minimal Alpha implementation
  boundary and moved Story 2.2 from `in-progress` to `review`. No production
  code changed in this closure checkpoint; 29/29 focused unit checks and 16/16
  focused mobile-browser scenarios passed through the active external tunnel.
- 2026-08-05: Created and started under approved editor-workspace reprioritisation.
- 2026-08-05: Completed the workspace/direct-dimension foundation and a
  deliberately constrained first partition/item/3D gesture slice; retained
  `in-progress` because the full topology contract is not implemented.
- 2026-08-05: Strengthened room-host placement, durable-failure and WebGL
  resource-cleanup tests; recorded the completed 76.97% mutation result and
  retained the story as `in-progress` below the 80% quality target.
- 2026-08-06: Added repeated 100-mm grid partitions, parametric placement,
  constrained durable item moves and revised mobile 3D framing; story remains
  `in-progress` because freeform topology and physical evidence gates remain.
- 2026-08-06: Added durable parametric item resize/collision handling,
  four-sided outer-grid expansion, low-fidelity 3D cutaway composition and
  on-demand 3D loading. Story remains `in-progress`: arbitrary walls,
  openings, catalog assets, recovery/backup coverage and physical-device
  performance gates are still not delivered.
- 2026-08-22: Touch Wall release now leaves a transient reviewed candidate
  rather than publishing immediately. The candidate names its exact snapped
  length/direction and offers 44 px DOM confirm/cancel actions; cancel leaves
  the current Revision/history unchanged. Mouse remains the existing fast
  authoring path for desktop automation. `EDITOR-E2E-02Q` was RED before the
  UI change and green afterwards; `SC-V04` records the visible browser-
  emulation state without making a physical-device claim.
- 2026-08-22: Added the strict numeric endpoint route into the existing
  candidate/confirm flow. Full Rstest (1102 tests), both real TypeScript
  configurations, the changed-file Biome lint, production Rspack build,
  11 targeted mobile-browser scenarios and all 3 PWA scenarios are green.
  The broad repository Biome command still reports pre-existing formatting
  failures outside this slice and is not represented as a green result.
- 2026-08-22: Reaffirmed the no-room-tool product boundary and strengthened
  numeric validation accessibility. Full Rstest (1102), both TypeScript
  configurations, changed-file Biome lint, production Rspack build, the full
  93-scenario mobile-browser suite and all 3 PWA scenarios are green. Story
  remains `in-progress`: the canonical product route still supports only
  proven cardinal wall topology, not 45-degree or arbitrary freeform walls.
- 2026-08-23: Added the first end-to-end 45° route: one touch gesture
  previews the eight constrained directions, publishes only after confirm,
  persists integer-mm diagonal endpoints, and projects the branch in both Plan
  and 3D. The route intentionally stops before diagonal intersections or
  non-rectangular rooms; those remain explicit Story 2.2 topology work rather
  than a hidden renderer approximation. Full checks are green: 1201 Rstest,
  both TypeScript configs, Biome 234 files, production build and 117/117
  mobile Playwright. Targeted mutation evidence: 89.41% wall gesture and
  100% critical diagonal durable decisions.
- 2026-08-23: Extended the durable 45° topology seam with exact integer-mm
  wall-body and diagonal-X contacts, retaining a valid rectangular Room where
  the diagonal is a graph bridge. Added source-integrity, fractional-contact,
  both denominator signs, endpoint-continuation and overlap tests, plus a
  project-level metadata-preservation test. The precise policy mutation run is
  96.97% (32/33 killed); the only survivor is equivalent under the constrained
  contact algebra. General diagonal Room faces and their usable-polygon/
  metadata projections remain deliberately outside this slice.
- 2026-08-23: Final regression for this increment passed: both TypeScript
  configurations, Biome (234 files), 1,208 Rstest, production Rspack build,
  the 117-scenario ordinary mobile-browser suite and the focused 96.97%
  mutation command. No PWA/service-worker source changed in this increment.
- 2026-08-23: The first constrained 45° editing routes now work without any
  coordinate form: a detached endpoint may follow its diagonal, a detached
  segment may move only normal to itself, and a selected 45° segment may split
  at a projected in-line touch point. Preview/cancel/confirm remains the sole
  publication path. The shared split command also keeps cardinal touch splits
  valid. Four affected mobile-browser flows and the exact domain guards pass;
  the scoped mutation score is 81.25% (13/16 killed), above its 80% threshold.
  Story remains `in-progress`: a closed diagonal face is derivable from the
  canonical graph but still cannot materialize a `Room`, usable polygon or 3D
  floor, so Alpha cannot yet present diagonal rooms as complete.
- 2026-08-26: Extended first-Room closure from convex-only polygons to simple
  concave contours. Exact Plan/usable-floor geometry, concave WebGL
  triangulation, collapsed-inset rejection and touch create/reopen/3D behavior
  are covered. Story remains `in-progress` because general post-closure
  topology edits, diagonal Opening rehosting and the complete S-2 corpus are
  still open.
- 2026-08-23: The narrow first closed 45° Room path is now end-to-end. A clean
  three-Wall 0°/45°/90° graph materializes one durable triangular `Room` only
  after the explicit touch confirmation; the raw Plan face, inset usable floor
  and disposable 3D floor stay triangular instead of being replaced by a
  rectangular bounding box. It is deliberately not a claim of generic
  diagonal topology: post-closure edits, multiple faces, diagonal Opening
  hosts and Item placement remain rejected or unsupported. Evidence: 1,219
  Rstest, four targeted mobile Playwright scenarios (including triangle
  creation and 3D view), and a focused 19/19 killed-mutant run.
- 2026-08-23: Historical implementation: a square Room could be split by a
  touch-drawn 45° diagonal only after a successor panel chose the triangle
  that kept Room metadata, while the other received a default Room. This
  behavior is superseded by the 2026-08-24 Product Owner decision; the raw derived fingerprints
  also permit deterministic Room reconciliation after reopen, while a later
  detached Wall preserves both Room identities. A floor Item makes the split
  fail closed as `ITEM_HOST_UNRESOLVABLE` rather than being auto-rehosted.
  Plan and WebGL render both exact triangular floors. Evidence: 1,220 Rstest,
  both TypeScript configurations, changed-file Biome, production Rspack build,
  five focused mobile Playwright flows, and 96.15% focused mutation evidence
  (25/26 killed; the one survivor is equivalent because a zero-area guard has
  already excluded the only distinguishable boundary).
- 2026-08-23: The same square split can now be safely reversed: selecting its
  diagonal shows the existing merge-consequence panel, cancellation leaves the
  two triangles durable, and an explicit source-Room choice publishes the
  restored square. A selected 45° Wall now provides a conservative integer-mm
  host for Door/Window validation; the Door action uses the same length rather
  than a Manhattan approximation, so it remains inside the physical segment.
  Evidence: 1,223 Rstest, both TypeScript configurations, changed-file Biome,
  production Rspack and four focused mobile-browser flows are green. The
  targeted manual `floor → ceil` mutation fails the domain test (2829 mm vs
  the required safe 2828 mm); Stryker has no arithmetic mutator for that
  built-in call, and its broader defensive-source run is not claimed as a
  passing score.
- 2026-08-23: The composed 45° consequence path is covered as well: a Door
  on the diagonal is listed together with the two merging Rooms. The delete
  action remains disabled until the surviving Room is chosen, then removes the
  Door and diagonal in one durable revision. `EDITOR-E2E-02Y` proves that
  phone route end-to-end; the domain corpus checks the exact IDs and resulting
  square separately.
- 2026-08-24: Floor-item placement in a supported triangular Room now checks
  every footprint corner against its derived inset usable polygon, instead of
  treating the triangle as a rectangle. `EDITOR-E2E-02VA` proves the accepted
  durable/reload/3D path. The ordinary browser regression ran 118/119 with the
  sole stale test copy corrected and rerun green; all 3 production PWA tests,
  1,239 Rstest, both TypeScript checks, Biome (240 files), production Rspack
  and 12/13 focused mutants (one equivalent) are recorded above.
- 2026-08-24: `EDITOR-E2E-02Y` now also covers editing the durable Door on the
  45° divider: an invalid 10,000-mm width leaves the draft and revision count
  unchanged; a valid 1,300-mm width plus opposite swing side publishes once,
  retains the exact Wall host, and survives reload/3D before the existing
  explicit composed deletion. The domain boundary accepts 2,828 mm and
  rejects 2,829 mm on the conservative host, while an oversized Window keeps
  `WINDOW_WIDTH_EXCEEDS_WALL_LENGTH`. Focused Stryker width validation kills
  all 15 mutants. Final quality gate: 1,239 Rstest, Biome (240 files), both
  TypeScript configurations, production Rspack, all 119 mobile-browser E2E
  scenarios and all 3 production-PWA scenarios are green.
