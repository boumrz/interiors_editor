---
document_title: "Plan: Calm Spatial Studio redesign"
status: implementation-in-progress
created: 2026-08-31
owner: Roman
implementation_owner: Codex
approval:
  product_owner: "User approval in this task, 2026-08-31"
  scope: "P0, P1a shared-editor chrome, P1b wall-hosted Opening, and P1c readable 3D greybox implementation against the supplied visual references"
  continuation_2026_09_05: "Product Owner requested an audit and continued redesign with screenshots; P2.11 Projects/Create consolidation and P2.12 header touch targets are covered by that request."
  measurement_continuation_2026_09_05: "Product Owner requested continued redesign; P2.13 named measurements and the required interaction/safety fixes are covered by that request."
  safety_continuation_2026_09_05: "Product Owner requested continued work; P2.14 save/recovery presentation and its required lifecycle fixes are covered by that request."
  dialog_continuation_2026_09_05: "Product Owner requested continued work; P2.15 accessible Project deletion and session-history discard confirmations are covered by that request."
  inspector_continuation_2026_09_05: "Product Owner requested continued work; P2.16 Room properties, Plan dimensions and their interaction/recovery fixes are covered by that request."
sources:
  - ../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/mockups/
  - ../_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md
---

# Calm Spatial Studio redesign

## Product decision recorded for this work

The first placement of a catalog item remains an explicit, reversible
preparation flow: choose item -> preview it on the scene -> **"Поставить"**.

Moving or rotating an item that is already placed does not ask for a second
confirmation. A valid finished gesture is published and can be undone. An
invalid finished gesture leaves the last valid placement unchanged and explains
why it was rejected.

This is a Product Owner clarification from 2026-08-31. It takes precedence for
the implementation over older preview-confirm wording in UX source documents.
The canonical UX/source-owner update is deliberately out of this code slice.

## Redesign outcome

The phone editor converges on the approved **Calm Spatial Studio** references:
the Plan/3D canvas is primary, the compact header and one context-sensitive
ActionDock are the only persistent command surfaces, and sheets replace each
other rather than piling up.

## Priority order

1. **P0 — truthful editor state and primary manipulation.** Initial item
   placement, direct transformations of placed items, wall opening flow,
   visual state hierarchy, and useful 3D projection.
2. **P1 — entry and catalog.** Projects-first home, catalog readiness/admission,
   and consistent mobile sheets/tokens.
3. **P2 — refinement.** Mobile/a11y/device verification and remaining visual
   consistency work.

## Vertical slice 1 — placed-item direct manipulation

### Acceptance criteria

- [x] Product Owner approved the P0 priority and the explicit interaction
  distinction above.
- [x] Starting a catalog placement still shows a clear preview and requires the
  user to press **"Поставить"** before the item becomes durable.
- [x] Dragging an already placed floor item to a valid position completes with
  no confirm/cancel surface; the new position is atomically published when the
  gesture ends and is available to Undo.
- [x] Rotating an already placed floor item to a valid angle completes with no
  confirm/cancel surface; the new angle is atomically published when the
  gesture ends and is available to Undo.
- [x] An invalid completed drag or rotation does not publish a revision and
  leaves the existing durable placement intact, with concise inline feedback.
- [x] Plan and 3D behavior stay aligned; first placement is not accidentally
  converted into direct placement.
- [x] Targeted tests demonstrate the behavior before production code changes;
  typecheck, lint, the relevant test suite, and scoped mutation verification
  pass before the slice is reported complete.
- [x] A mobile visual check at 393 x 852 shows the target hierarchy: no tiny
  floating confirm/cancel control for an existing item transform, while the
  initial placement keeps one clear **"Поставить"** action.

### Delivery discipline

Use RED -> GREEN -> MUTATE -> KILL -> REFACTOR. One implementation owner edits
the slice. No commit is created without an explicit Product Owner request.

## Verification recorded 2026-08-31

- Mobile E2E: 10 relevant placement, direct move/rotate, undo and 3D scenarios
  passed.
- Unit suite: 1,710 tests passed; focused `AppShell` suite: 35 passed.
- Typecheck and Biome lint passed.
- Scoped mutation run for `itemPlacementPreviewFeedback`: 25/25 mutants killed
  (100% score).
- A 393 x 852 visual browser check confirmed that the valid ghost has no
  duplicate top hint and the only decision surface is the rounded
  `Отмена` / `Поставить` sheet.

## Vertical slice 2 — shared phone editor chrome

**Actor:** a person editing a project on a phone.

**Trigger:** they open a completed Plan or switch between `План` and `3D`.

**Observable outcome:** the persistent header remains visibly and interactively
above either canvas; Plan uses one calm ActionDock, 3D uses one calm camera
deck, and these primary surfaces share the solid visual language in the
reference.

**Production path:** `AppShell` editor shell and top bar → Plan ActionDock or
`RoomScene3d` camera deck → existing view switching and editor actions. No
domain command, gesture, persistence or Opening-authoring semantics change.

### Acceptance criteria

- [x] On a 393 x 852 phone viewport, `Назад`, project name, durable state and
  `План / 3D` remain hit-testable above both canvases.
- [x] `План / 3D` belongs only to `EditorTopBar`, not the ActionDock; changing
  it keeps selection and creates no Durable Revision.
- [x] The resting Plan has one four-action ActionDock with touch targets at
  least 44 px high; neutral, selected and disabled states remain legible.
- [x] The resting 3D view has one camera deck and no duplicate Plan ActionDock.
- [x] Header, Plan ActionDock, 3D deck and overflow sheet use solid white
  surfaces, `#1976B9` primary, `#E7F3FB` selected state, `#D9E1E8` outline,
  no backdrop blur or gradient; the full-width header remains flat while the
  floating and bottom surfaces use 20/28 px radii.
- [x] Existing selected item/wall inspector and wall-thickness control remain
  visually clear of the dock; this slice does not redefine their actions.
- [x] RED browser coverage, targeted E2E, static checks and scoped mutation
  verification pass before the slice is reported complete.
- [x] The final handoff includes a reproducible set of multiple mobile
  screenshots covering the editor journey, per Product Owner request.

### TDD outline

**RED:** update the stale editor-chrome browser contract so it asserts that
view switching lives in `EditorTopBar`, that header controls win hit-testing
over the 3D canvas, and that the reference surface states are visible.

**GREEN:** adjust only editor-shell and 3D-deck presentation styles and stacking
order needed for that behavior.

**MUTATE:** run a scoped mutation/configured behavioral check where applicable;
CSS-only visual declarations are additionally proven by the browser contract
and captured 393 x 852 states.

**Done when:** the criteria and verification gate above pass. No commit is
created without a separate Product Owner request.

## Verification recorded 2026-08-31 — P1a

- The updated browser contract first reproduced the stale chrome assumption,
  then verified header hit testing over the 3D canvas and the canonical
  `План / 3D` switch.
- Targeted mobile browser coverage: 15 editor, first-placement, catalog and
  view-switch scenarios passed, including header overflow reset after returning
  to Projects.
- Quality gate: Biome lint, TypeScript typecheck and the full unit suite passed
  (1,711 tests across 128 files).
- Scoped mutation verification for the isolated chrome-reset helper killed 2/2
  mutants (100%).
- Reproducible 393 x 852 screenshots cover start, Plan, overflow, placement
  preview, selected item, selected wall, wall thickness, 3D and 3D placement.

## Vertical slice 3 — wall-hosted opening draft

**Actor:** a person who has selected a compatible wall on a phone.

**Trigger:** they choose `Добавить проём` from the wall context in the Plan
editor.

**Observable outcome:** one calm `Новый проём` draft sheet lets the person
choose `Дверь` or `Окно`, enter exact millimetre dimensions and explicitly
`Добавить` one valid wall-hosted Opening. `Отмена` and an invalid draft create
no Durable Revision.

**Production path:** selected `WallSegment` → ActionDock wall context →
ephemeral React draft → existing canonical `AddOpening` controller command →
atomic durable publish → shared Plan/3D projections.

### Acceptance criteria

- [x] A selected compatible wall exposes one `Добавить проём` action instead
  of independent immediate `Окно` and `Проём` mutations.
- [x] That action opens one `Новый проём` bottom sheet with a host identity,
  `Дверь` / `Окно` selector, visible-mm width, height and offset inputs, and
  the kind-specific lower-height input (`Порог / нижняя отметка` or `Высота
  подоконника`).
- [x] Opening the sheet, changing its kind and cancelling it leave the
  selected wall, durable Opening count and Durable Revision count unchanged.
- [x] A valid explicit `Добавить` publishes exactly one canonical Door or
  Window through the existing wall-hosted command path.
- [x] The draft gives an inline reason and disables `Добавить` for a width that
  cannot fit its host interval; exact valid off-grid integer-mm input is not
  silently rounded.
- [x] The Plan shows a neutral opening marker/interval only: there is no
  visible door leaf, swing arc, hinge/open-side control or door lifecycle
  control in the new draft/create route.
- [x] Existing persisted `swingSide` remains read-compatible only in this
  UI-focused slice; removing or migrating historical serialized orientation is
  a separately reviewed compatibility slice.
- [x] RED browser coverage, focused domain regression coverage, static checks,
  scoped mutation verification and 393 x 852 visual states pass before handoff.

### TDD outline

**RED:** replace the immediate Door/Window browser contract with the observable
unsaved Door and Window draft flows, including cancel, host-width reject and
one-publish assertions.

**GREEN:** route the selected-wall action through one transient draft sheet,
then call the existing canonical command only from `Добавить`; render neutral
opening markers instead of door swing controls.

**MUTATE:** scope Stryker at the draft validation/command adapter introduced by
this slice and kill worthwhile surviving conditional, string and side-effect
mutants.

**Done when:** all criteria pass. No commit is created without a separate
Product Owner request.

## Verification recorded 2026-08-31 — P1b

- Targeted mobile browser coverage: 13 wall-opening, wall split, wall conflict,
  existing-opening edit and reconciliation scenarios passed, including explicit
  Door and Window publication flows.
- Quality gate: TypeScript typecheck, Biome lint and the complete unit suite
  passed (1,716 tests across 129 files).
- Focused draft-adapter unit coverage exercises host identity, Door and Window
  inputs, raw integer rejects and project-aware wall-item collision preflight.
- Scoped mutation verification for `opening-creation-draft` killed 19/23
  mutants (82.61%), exceeding its 80% break threshold.
- Reproducible 393 x 852 browser captures cover resting Plan, selected Wall,
  Door draft, invalid width, valid preview, persisted neutral Door, Window
  draft/preview, final Plan and 3D projection. The new route presents no
  swing/leaf/orientation control.

## Vertical slice 4 — readable 3D furniture greyboxes

**Actor:** a person who switches from Plan to 3D while editing a phone project
with an ordinary, non-GLB furniture item.

**Observable outcome:** the same canonical item becomes a small neutral
procedural silhouette (chair, table, bed, storage or sofa) rather than an
indistinguishable box. The parent still uses the projected item pose and every
part remains within its canonical envelope.

**Production path:** disposable `SceneBox.material.furnitureKind` → existing
procedural furniture-part vocabulary → Three.js greybox group → existing
camera/cutaway projection. No Project, command, durability, Opening or catalog
admission semantics change.

### Acceptance criteria

- [x] A classified non-runtime floor item produces the established
  chair/table/bed/storage/sofa part vocabulary in the Three renderer; a
  generic item remains one neutral box.
- [x] The group parent retains the canonical projected centre and yaw, while
  its child parts are local and bounded by the item's canonical envelope.
- [x] Highlight/base/shadow parts retain subtle distinct neutral tones without
  adding material/finish authoring controls.
- [x] Runtime GLB rendering, camera controls, cutaway behavior, Plan/3D view
  switching and Durable Revision semantics stay unchanged.
- [x] RED unit coverage, static checks, scoped mutation verification and a
  393 x 852 browser visual state pass before handoff.

### TDD outline

**RED:** assert a classified chair's part names, tones, local bounds and parent
pose, plus a single-box generic fallback.

**GREEN:** reuse the existing procedural part descriptors in the Three.js
renderer with a parent-owned world transform.

**MUTATE:** scope mutation to the new Three-greybox adapter and kill the
meaningful local-pose, detailed-parts and tone branches.

## Verification recorded 2026-08-31 — P1c

- RED unit test initially failed because the Three adapter exposed no procedural
  greybox builder; it now verifies a chair's six named parts, parent pose,
  local envelope and exact highlight/base/shadow tones, plus generic and
  material-less fallbacks.
- TypeScript typecheck, Biome lint and the complete unit suite passed (1,716
  tests across 129 files); the focused Three-greybox suite passed 3/3.
- Scoped mutation verification killed 21/22 mutants (95.45%), exceeding the
  80% break threshold.
- Browser regression for a runtime preloaded GLB placement and Plan/3D return
  passed. A fresh 393 x 852 visual check shows the locally composed chair as a
  readable seat, back and four legs in 3D, with the same passive `+Z` world
  orientation cue as the Plan.

## Vertical slice 5 — coherent phone 3D inspection

**Actor:** a person who switches a furnished phone project from Plan to 3D.

**Trigger:** they use `Авто cutaway`, inspect a selected floor item, or return
to the resting 3D scene.

**Observable outcome:** auto cutaway exposes one coherent architectural side of
the room rather than disconnected wall ends; the room fits the phone canvas,
the item visibly meets the floor, and selection remains a quiet four-handle
frame. `Только для обзора` makes clear that cutaway has no durable effect.

**Production path:** canonical disposable `SceneRoom` projection → Three.js /
raw WebGL2 room renderer → camera/cutaway and React overlay state. No Project,
Command, Revision, History, placement or direct-transform semantics change.

### Acceptance criteria

- [x] Auto cutaway hides a coherent facade for a simple closed room and does
  not leave isolated wall-end fragments in the phone camera's foreground.
- [x] Default/auto camera framing uses the usable 3D viewport so the room is
  legible without changing a Project or creating a Revision.
- [x] Three.js adds restrained neutral contact-depth cues; its raw WebGL2
  fallback retains an equally legible, non-photorealistic result.
- [x] Resting 3D selection is a quiet blue four-handle frame. The rotation
  affordance appears only while a rotation gesture is active; a valid finished
  gesture remains direct and needs no confirmation.
- [x] The mobile view visibly says `Только для обзора` while auto cutaway is
  active. Changing cutaway, camera or Plan/3D still creates no Durable Revision.
- [x] RED unit/browser coverage, scoped mutation verification, static checks
  and reproducible 393 x 852 screenshots pass before handoff.

### TDD outline

**RED:** add observable renderer and mobile-browser contracts for a coherent
cutaway facade, transient camera/cutaway state, quiet resting selection and
the explanatory cutaway label.

**GREEN:** alter only disposable renderer, camera and overlay presentation
paths demanded by the tests. Preserve the existing direct gesture publication
path and renderer fallback.

**MUTATE:** scope Stryker to the new decision helpers and UI-state branches;
kill meaningful facade, label and interaction-state mutants.

**Done when:** all criteria pass. No commit is created without a separate
Product Owner request.

## Verification recorded 2026-08-31 — P1d

- Coherent façade selection, camera-envelope fitting, quiet rotation overlay and
  the mobile cutaway notice have RED→GREEN unit/browser coverage.
- Targeted mobile browser checks, typecheck, Biome lint, the production build
  and the complete unit suite passed (1,733 tests across 130 files).
- Screenshots at 393 x 852 cover auto cutaway, all walls, idle selection and
  active rotation. The raw fallback remains a neutral deterministic projection.
- The configured mutation scope contains only domain/application TypeScript,
  so it does not cover this renderer/UI-only slice; targeted behavior tests and
  browser screenshots were used as the visual regression evidence.

## Remaining work — reconciled 2026-09-05

The former “not started” list was stale: phone 3D projection, Projects-first
entry, catalogue preparation and healthy-offline presentation were delivered
in the subsequent slices recorded below. P2.11 now consolidates Projects/Create
presentation; P2.12 closes the persistent header's touch-target gap. P2.13
delivers named Wall/Room/Item measurement targets and the Wall → Measure route.
P2.14 unifies save-failure and recovery presentation and adds a direct,
accurately named download of the last durable version without clearing retry.
P2.15 gives Project deletion and history discard native modal isolation,
keyboard/focus handling, busy/error feedback and a bounded scrolling surface.
P2.16 consolidates Room properties and Plan dimensions, including keyboard focus,
read-only/busy controls, local validation, safe areas and conflict-save retry.

The remaining review and implementation slices are:

1. Continue visual-token consolidation in older inspectors and remaining
   confirmations. Audit their keyboard/focus handling, touch targets, 200%
   text and short visual viewports; P2.15 covers the two named destructive
   confirmations, not every older dialog. References: NFR-17–20, AD-12.
   Room directory/properties and the Plan inspector are covered by P2.16.
   Prioritize Rename next; Restart and color-variant confirmation still use
   `restartProjectDialog`.
   The 360×480/200% screenshot also shows cramped global header/dock labels;
   resolve their wrapping separately from the P2.16 form-surface checks.
2. Finish the remaining overlay placement checks.
   Audit the 3D placement toast still positioned at `top: 10px`; it can hide
   under the persistent header. Camera controls above 559 px also need their
   header offset reconciled if that non-alpha viewport is supported.
   Browser screenshots remain synthetic evidence; physical-device acceptance
   is a separate product-owner activity. References: NFR-15/17–20, AD-12/16.
3. Complete the separate recovery contracts: export of an unpublished candidate,
   recovery from an exact Portable Backup and a verified read-only projection
   where the current recovery screen has no validated geometry. P2.14 verifies
   that the existing ordinary export contains only the last durable version;
   it must not be relabelled as export of pending recovery data.
   References: CAP-1/10, FR-5/43/44/45, AD-4.
4. Remove/migrate legacy persisted Door orientation (`swingSide`) only in a
   separate compatibility slice with backup review. References: CAP-4, AD-4/6/22.

## Vertical slice 6 — Projects-first cold open

**Actor:** a person opening the installed PWA on a phone.

**Trigger:** local Projects storage is empty, has one Project, or has several
Projects.

**Observable outcome:** the application always opens the calm `Проекты` hub.
An empty hub says `Пока нет проектов` above a neutral plan-grid surface, offers
one primary `Новый проект` and a secondary import route, and never presents
creation as a marketing/onboarding hero. A sole existing Project remains a
visible choice rather than being silently opened.

**Production path:** Project directory hydration → `ProjectController` screen
state → `AppShell` hub/creation route. No Project bytes, Command, Revision,
backup, writer lease or import semantics change.

### Acceptance criteria

- [x] Cold open with zero, one or multiple local Projects reaches the `Проекты`
  hub; it does not auto-open the only Project or show the create form directly.
- [x] The empty hub visibly states `Пока нет проектов`, keeps `Новый проект` as
  the primary action and retains the secondary import route.
- [x] `Новый проект` opens the existing creation form; its Back action returns
  to the hub without creating or mutating a Project.
- [x] Opening an existing Project and all durable creation/import behavior stay
  unchanged.
- [x] RED controller/UI/browser coverage, scoped mutation verification, static
  checks and a reproducible 393 x 852 visual state pass before handoff.

### TDD outline

**RED:** prove the cold-open project-directory state for empty and singleton
storage, then assert the empty hub's copy/action order and the explicit
`Новый проект` transition.

**GREEN:** use the existing Projects screen as the sole entry route, add only
the neutral empty surface and a return path from creation.

**MUTATE:** scope mutation to the directory-state decision/helper introduced
by this slice and kill meaningful empty/singleton branch mutants.

**Done when:** all criteria pass. No commit is created without a separate
Product Owner request.

## Verification recorded 2026-08-31 — P1e

- Controller RED coverage verifies empty, singleton, mixed healthy/recovery and
  corrupt directory states; the singleton must not call `loadProject` on cold
  open.
- The mobile browser contract verifies `Проекты → Новый проект → Назад → Новый
  проект → editor`, then a reload with one Project returns to its explicit
  card, not the editor.
- Scoped Stryker for `project-controller.ts:1318-1332` killed 17/17 mutants
  (100%). Typecheck, Biome lint, production build and 1,737 unit tests passed.
- A reproducible 393 x 852 visual check covers the new neutral empty
  plan-grid state.

## Vertical slice 7 — explicit catalogue readiness handoff

**Actor:** a person selecting a not-yet-prepared catalogue item on a phone.

**Trigger:** they tap a catalogue card whose exact resource still needs local
preparation and backup admission.

**Observable outcome:** preparation says `Готовим для офлайн…` and exposes only
`Отмена`; it neither opens a PlacementPreview nor suggests durability. Once
ready, the card says `Готово для размещения` and offers one explicit `Показать
на плане`. That opens the existing unsaved preview; only `Поставить` can create
the Durable AssetInstance.

**Production path:** Catalogue card selection → existing local preloaded-GLB
download/pin state → selection bar → existing PlacementPreview route. No
catalog bytes, backup policy, Project Command or publish semantics change.

### Acceptance criteria

- [x] During preparation, selected-card copy shows local progress and the only
  action is `Отмена`; no preview or Durable Revision is created.
- [x] Completion exposes `Готово для размещения` and `Показать на плане` rather
  than automatically entering preview.
- [x] `Показать на плане` opens only the existing unsaved PlacementPreview;
  an item becomes durable only after its explicit `Поставить` action.
- [x] Cancellation and existing unavailable/retry routes stay truthful and do
  not mutate a healthy Project.
- [x] RED mobile browser coverage, unit/static checks, visual verification and
  applicable mutation evidence pass before handoff.

### TDD outline

**RED:** replace the automatic catalogue-to-preview browser contract with the
observable preparation, ready and explicit-preview transitions.

**GREEN:** alter only the selected-card state/action mapping; reuse existing
download, pin, cancellation and PlacementPreview paths.

**MUTATE:** inspect the selection-state conditional mutations; renderer/UI-only
branches are additionally proven by mobile browser behavior.

**Done when:** all criteria pass. No commit is created without a separate
Product Owner request.

## Verification recorded 2026-08-31 — P1f

- RED mobile coverage first failed against the former `Подключаемся к модели…`
  and automatic placement contract. `CATALOG-E2E-01B` now proves loading-only
  `Отмена`, no ready state or preview before completion, an explicit
  `Показать на плане`, and a durable revision only after `Поставить`.
- Targeted mobile browser coverage passed for the delayed-resource, bounded
  byte-range and unavailable/retry routes: `CATALOG-E2E-01B`, `01F` and `01C`.
- A manual state-condition mutation (`ready` → `not ready`) was killed by the
  strengthened browser contract; the configured Stryker production scope does
  not include renderer/UI files.
- Typecheck, Biome lint, production build and the complete unit suite passed
  (1,739 tests across 130 files).
- Reproducible 393 x 852 screenshots capture the ready handoff and its
  subsequent unsaved placement preview.

## Vertical slice 8 — local catalogue outage sheet

**Actor:** a person who opens the interior catalogue while its remote
publication cannot be refreshed.

**Observable outcome:** the Plan remains visibly intact behind one local
bottom sheet saying `Каталог временно недоступен`; its exact next choices are
`Повторить` then `Отмена`. This never looks like a Project recovery or a save
failure. Cancelling the sheet returns to the declared local furniture gallery,
so a healthy local Project remains useful.

### Acceptance criteria

- [x] Remote publication `unavailable` and `invalid` states render one mobile
  sheet over the visible Plan rather than an inline catalogue alert.
- [x] The sheet uses the reference copy `Каталог временно недоступен` and
  `Добавленные предметы останутся доступны.` with full-width `Повторить` then
  `Отмена` actions.
- [x] `Повторить` reuses the existing publication fetch; dismissing returns to
  local gallery furniture, and explicit close still returns to the Plan.
- [x] The route creates no Durable Revision, recovery state, read-only fence or
  item instance.

## Vertical slice 9 — focused catalogue preparation card

**Actor:** a person who has selected a published GLB card on a phone.

**Observable outcome:** the selected asset becomes a large focused bottom
sheet over the readable Plan. It shows thumbnail, full name, millimetre size,
honest preparation state and exactly the one safe next action. It does not
become a placement preview or a durable Project change by itself.

### Acceptance criteria

- [x] A selected preloaded card uses a phone-only focused sheet with a large
  preview, untruncated title/dimensions, a handle and the Plan visible behind
  it; hidden browse controls are removed from the accessibility tree.
- [x] Known download progress visibly says `Готовим для офлайн… N%` and has a
  full-width determinate progress bar; an unknown total remains honestly
  indeterminate.
- [x] Loading exposes only outline `Отмена`; ready exposes only primary
  `Показать на плане`; preparation failure uses
  `Не удалось подготовить предмет для офлайн` with `Повторить` then `Отмена`.
- [x] Cancelling a preparation/failure returns to the non-durable gallery
  state. Preview and Durable Revision semantics stay unchanged.

## Vertical slice 10 — healthy local offline status

**Actor:** a person reopening a healthy local Project without a network
connection.

**Observable outcome:** a quiet, non-interactive line immediately below the
editor header says `Офлайн — работаем на устройстве`. It stays visible on both
Plan and 3D, while local editing, undo/redo and durable publication remain
available. It disappears when the browser reports `online` and never merges
with a writer fence, recovery or persistence failure.

**Production path:** browser online/offline signals → ephemeral `AppShell`
connectivity state → local status render. No Project, Command, Revision,
backup, catalog or renderer state changes.

### Acceptance criteria

- [x] A healthy writable `saved` or `saving` Project displays the exact status
  after an offline browser signal; it has no CTA, dialog, scrim or read-only
  side effect.
- [x] The status persists across Plan/3D and disappears following `online`.
- [x] Persist-failed, recovery/history-recovery and writer/legacy read-only
  contexts do not display the healthy-offline surface.
- [x] A deterministic unit contract, targeted production-PWA path, manual
  condition mutation and reproducible 393 × 852 Plan/3D screenshots prove the
  state transition.

## Verification recorded 2026-09-01 — P1g final mobile hardening

- The catalogue outage sheet, focused preparation/ready/failure card and the
  quiet healthy-offline line have been verified on the phone Plan and 3D
  surfaces. They preserve the existing Project, placement and recovery
  contracts rather than becoming save or recovery states.
- The final exact-reimport regression found a genuine race: a delayed GLB
  measurement could arrive while a person replaced the first dimension and
  turn `500` into `2000500`. Manual dimensions now claim authority on focus or
  touch, and the input value is captured before a queued state update. The
  browser contract asserts all three edited values remain exactly `500` before
  `Добавить в «Кастомное» и разместить`.
- The PWA waiting-update notice no longer captures unrelated touches; the
  history-resource recovery notice closes the optional overflow sheet; and the
  mobile FBX receipt remains visible rather than being hidden by catalogue
  chrome. These changes preserve direct move/rotation and the first-placement
  `Поставить` contract.
- Final checks passed: Biome lint, TypeScript typecheck, 1,742/1,742 unit
  tests, 185/185 non-live mobile-browser tests (one live-catalogue test
  intentionally skipped), and 9/9 production-PWA tests. The PWA run includes
  a successful production build.
- The configured Stryker mutation scope excludes `src/ui`; visual/UI behavior
  is therefore guarded by the strengthened browser contract and the recorded
  pre-fix trace, rather than a misleading unrelated mutation score.
- Reproducible 393 × 852 visual checks cover the empty Plan, coherent 3D
  cutaway, catalogue outage, healthy offline, focused ready card, unsaved
  placement, placed item, contact depth and quiet four-handle 3D selection.
  The files are in `output/playwright/.playwright-cli/` with timestamps
  `2026-09-01T02-44` through `2026-09-01T02-48`.

## Verification recorded 2026-09-01 — P2.1 furnished reference apartment

- `REFERENCE-APARTMENT-E2E-01` now creates a fresh persistent phone Project
  through the ordinary UI: 6000 × 4800 mm, four derived rooms, 12 walls,
  two Doors, two Windows, and three distinct prepared catalogue items hosted
  in three different rooms. Each item follows `Показать на плане` → valid
  preview → explicit `Подтвердить размещение предмета`; no fixture mutates
  IndexedDB directly.
- The scenario proves that a Plan ↔ 3D switch and a camera orbit create no
  Durable Revision. After a reload and reopening the Project it rechecks the
  same room/opening/item state and current revision before 3D evidence.
- Four 393 × 852 captures are attached to the Playwright result: uncluttered
  furnished Plan, reopened Auto-cutaway, an orbit that exposes all furnished
  rooms, and the quiet four-corner selection frame in 3D. `Только для
  обзора` remains visible in every Auto-cutaway capture.
- The scenario exposed a real visual-copy gap at `3 предметов`. One shared
  Russian count formatter now backs catalogue, Plan and 3D; unit coverage
  includes zero, singular, paucal, teen and plural forms, and the 3D static
  contract checks `3 предмета в плане`.
- The furnished visual review also found that the default +Z camera put the
  6.1 m wide apartment on the narrow axis of a portrait viewport. The default
  now opens from the compact axis (`0.000:1.000`), so Auto cutaway removes one
  whole right-side facade and the room is framed closer. When 3D opens with an
  item already selected, its initial pose instead chooses the nearest complete
  cardinal facade, keeping the quiet four-corner frame over a visible object
  without changing an existing 3D view or an active orbit. Pure viewport tests
  compare the compact-axis fit against the former broad-axis fit and cover all
  four selection directions; the browser scenario locks the initial/reopened
  camera signature before its orbit capture.
- Verification passed: Biome lint, TypeScript typecheck, production Rspack
  build, 1,745/1,745 unit tests, and the targeted mobile browser scenario.
  The configured Stryker scope deliberately excludes the changed UI and
  renderer files; these presentation-only changes are protected by the browser
  journey and static rendering contracts instead of an unrelated mutation run.

## Verification recorded 2026-09-05 — P2.2 non-rectangular 3D matrix

- Auto cutaway now resolves equal camera-facing exterior candidates by their
  outward support, not incidental wall-array order. Focused renderer contracts
  cover a split facade with a recess, an L-shaped shell and parallel 45-degree
  facades; each opens the complete outer side and preserves the recess.
- Initial 3D framing now chooses the compact horizontal room axis: wide rooms
  retain azimuth `0`, while tall rooms open at `π/2`. A selected item still has
  priority for its nearest complete cardinal facade, so selection does not
  sacrifice readability for the generic room default.
- `REFERENCE-DIAGONAL-E2E-02` drives a fresh 393 × 852 phone project entirely
  through the ordinary editor: a 5000 × 7000 mm contour, a 45-degree divider,
  a cardinal split, three derived rooms, nine walls and three distinct prepared
  catalogue items. It captures Plan, Auto, All-walls and quiet-selection 3D
  states, then reloads and rechecks geometry, items, current revision and the
  tall-room camera signature. Each 3D visual capture waits for all three local
  GLB projections to reach `rendered:3`, avoiding a transient loading frame in
  the visual evidence.
- The four reviewed phone captures show a single whole Auto facade opening,
  readable internal walls, visible `Только для обзора`, contact shadows, and a
  selected item with exactly four blue handles and no resting rotation ring.
- The configured Stryker scope excludes renderer and UI files. A manual
  mutation inverted the new outer-support comparison; the unit suite then
  failed all three facade contracts (split/recessed, L-shaped and 45-degree).
  The comparison was restored before final verification.
- Final verification passed: target mobile browser scenario, 1,748/1,748 unit
  tests across 130 files, TypeScript typecheck, Biome lint and production
  Rspack build.

## Verification recorded 2026-09-05 — P2.3 phone 3D framing window

- The 3D renderer now owns a disposable scene viewport between the actual
  lower edge of the phone header and the upper edge of the persistent 3D
  thumb deck. The WebGL canvas, floor hit-testing, selection frame and quiet
  rotation affordance all share that one local coordinate system; no camera
  state or Project geometry is persisted.
- The high diagonal shell opens along its compact axis with a slightly higher
  overview and a 96% horizontal framing target. This makes the room the main
  visual layer while retaining a small edge gutter and preserving the complete
  All-walls envelope. The fallback panel background matches the shared WebGL
  background, so no dark seams appear around the rounded mobile controls.
- `REFERENCE-DIAGONAL-E2E-02` asserts the live canvas is below the editor
  header and above the 3D deck (with a one-pixel DPR tolerance), locks the
  tall initial camera pose and requires a fitted distance of at most `1.65`.
  The same fresh phone journey still verifies Auto, All walls, quiet selection,
  reload and unchanged Durable Revision.
- A focused manual mutation restored the former 86% horizontal occupancy. The
  browser contract failed with camera distance `1.715 > 1.65`; the intended
  96% value was restored. Stryker's configured scope excludes UI/renderer
  presentation files, so this observable browser mutation is the relevant
  guard.
- Final verification passed: 1,748/1,748 unit tests, TypeScript typecheck,
  Biome lint, production Rspack build, and nine selected mobile-browser
  catalogue/diagonal scenarios including direct 3D placement.

## Verification recorded 2026-09-05 — P2.4 stable GLB hydration

- A room that contains a locally pinned GLB-capable item now starts with its
  Three.js shell immediately. Until a decoded root is ready, only that item is
  a Three greybox; later roots are exchanged in the already-live item group.
  Walls, floor, Auto cutaway, camera pose and the WebGL context are not
  reconstructed for the exchange.
- GLB decoding is now independent per definition rather than one `Promise.all`
  barrier. The semantic loader key contains only definition identity, verified
  resource hash/state and an explicit retry epoch, so a durable x/z/yaw update
  cannot cancel a decode or briefly turn every loaded item back into a
  greybox. Unchanged roots remain live if another definition joins the scene.
- The controller contract verifies two successive runtime maps (chair, then
  chair plus lamp): it constructs one renderer, disposes none, forwards both
  root updates, and immediately repaints the same camera, `Все стены`/Auto
  mode and projected scene. A selector contract also keeps an ordinary room
  on the raw renderer even if an obsolete runtime map exists.
- `REFERENCE-APARTMENT-E2E-01` now waits for `rendered:3` before every 3D
  screenshot. Its fresh 393 × 852 journey builds four rooms, 12 walls, two
  doors, two windows and three GLB items, then verifies reopened Auto,
  orbit and quiet selected states after local reload. The captured frames show
  decoded materials and soft contact shadows rather than a loading fallback.
- The configured Stryker scope excludes renderer/UI presentation files. A
  manual mutation removed the live `updateRuntimeModels` call; the focused
  controller contract failed with no forwarded maps (`[]` instead of chair and
  chair-plus-lamp), after which the call was restored.
- Final verification passed: 1,750/1,750 unit tests across 130 files,
  TypeScript typecheck, Biome lint, production Rspack build and the targeted
  mobile `REFERENCE-APARTMENT-E2E-01` browser journey.

## Verification recorded 2026-09-05 — P2.5 neutral GLB clay projection

- Decoded local GLB roots now remain geometrically faithful, but their
  disposable Three.js projections use one neutral cool-grey clay material
  (`#899296`, roughness `0.88`, metalness `0`). Source material maps and
  photorealistic finishes are bypassed only in the projected clone; cached
  decoded roots, resource bytes and durable Project data remain untouched.
- The projection retains item scale, silhouette, selection and the existing
  soft cast/receive shadow policy. This keeps furniture grounded while making
  it subordinate to the architectural shell, as in the Calm Spatial reference.
- A focused renderer contract starts from a dark, textured and metallic source
  mesh and verifies that its clone is independently geometrized, untextured
  neutral clay, while every source material value and texture remains intact.
  A manual mutation changed the intended clay colour to brown; that contract
  failed on the exact colour assertion before the neutral value was restored.
- The targeted four-room phone journey again reached `rendered:3`; its reopened
  and orbit captures show three decoded furniture silhouettes in matte grey,
  without the former brown/black photorealistic visual weight.
- Final verification passed: 1,751/1,751 unit tests across 130 files,
  TypeScript typecheck, Biome lint, production Rspack build and the targeted
  mobile `REFERENCE-APARTMENT-E2E-01` browser journey.

## Verification recorded 2026-09-05 — P2.6 recoverable 3D overview

- After a genuine orbit, pinch-pan or +/- scale action, a compact 44 px
  `Обзор` recovery control appears above the passive +Z cue. It is not a
  permanent fourth phone-deck action and it stays out of the placement flow.
- Activating `Вернуть обзор 3D` restores the fitted, room-wide Auto overview
  (including a zero pan) for the live scene viewport. It intentionally leaves
  the current item selection, Auto/All-walls mode, decoded GLB roots and all
  Project data alone; the control then disappears again.
- The furnished four-room phone journey now captures reopened, orbit,
  overview-reset and quiet-selected states. It proves that the reset camera
  exactly matches the original fitted overview, keeps `Только для обзора` and
  `rendered:3` visible, and adds no Durable Revision. A static contract also
  keeps the recovery button absent in the untouched calm state.
- The configured Stryker scope excludes this UI presentation file. A focused
  manual mutation made the reset retain the orbit camera; the browser journey
  failed with the expected overview camera signature versus the retained
  `1.965:1.250` orbit, before the fitted reset was restored.
- Final verification passed: 1,751/1,751 unit tests across 130 files,
  TypeScript typecheck, Biome lint, production Rspack build and the targeted
  mobile `REFERENCE-APARTMENT-E2E-01` browser journey.

## Verification recorded 2026-09-05 — P2.7 Plan-first resting canvas

- The non-rectangular resting Plan no longer renders a persistent
  `ПЛАН / комнаты / стены / высота` card above the ActionDock. The drawing and
  grid now retain that lower phone space, matching the reference's one primary
  bottom command surface. Editable room metadata remains in the Room directory;
  the existing test-only live count outputs remain hidden and non-interactive.
- The furnished four-room phone journey now explicitly requires the absence of
  the `Характеристики плана` complementary panel before its Plan screenshot,
  while still proving four derived rooms, 12 walls, two doors, two windows and
  three locally prepared items through ordinary editor state.
- The configured Stryker scope excludes UI presentation. A manual mutation
  restored the former labeled plan panel; the mobile journey failed with one
  `Характеристики плана` element where the calm Plan requires none, before the
  clear-canvas implementation was restored.

## Verification recorded 2026-09-05 — P2.8 selected-item 3D inspection

- Entering 3D from Plan with a selected floor item now uses an initial,
  disposable inspection pose: it keeps the nearest coherent facade, centres
  the item target and applies a bounded closer camera distance. A normal
  unselected entry and the explicit `Вернуть обзор 3D` action remain full-room
  overview compositions with zero pan.
- The target four-room mobile journey verifies the quiet four-handle frame is
  centred in the live scene window and at least 48 CSS px wide, so the selected
  object is genuinely readable rather than a small edge detail. It still waits
  for all three local GLB roots (`rendered:3`) and confirms no Durable Revision
  is created by the presentation state.
- Unit coverage verifies the selected camera preserves its facade while moving
  the target to the item's canonical centre and clamping the closer distance.
  A manual mutation restored the full-room distance; the browser contract then
  measured a 27.33 px selection frame against the required 48 px minimum,
  before the inspection focus was restored.
- Final verification passed: 1,752/1,752 unit tests across 130 files,
  TypeScript typecheck, Biome lint, production Rspack build and the targeted
  mobile `REFERENCE-APARTMENT-E2E-01` browser journey.

## Verification recorded 2026-09-05 — P2.9 quiet Plan selection

- A selected floor item on the phone Plan now keeps exactly its blue frame and
  four corner points in the calm state. The visible dashed rotation ring and
  round handle have opacity `0` until a direct rotation gesture begins; during
  that gesture they return at restrained `0.4` / `0.9` opacity.
- The generous annular target remains mounted as a painted, effectively
  invisible `0.001`-opacity stroke. This preserves reliable WebKit hit testing
  and direct no-confirmation rotation while avoiding a resting visual control
  that is absent from the reference.
- The focused phone contracts capture both quiet selection and an active
  rotation. They prove four handles remain visible, the active ring is shown
  only during the gesture, the angle still snaps and publishes directly, and
  undo/redo/reload preserve the resulting Durable Revision.
- A manual mutation restored the old resting `0.18` ring opacity; the visual
  contract failed with expected `0` / received `0.18` before the quiet state
  was restored.

## Verification recorded 2026-09-05 — P2.10 legible Plan windows

- Plan projection now renders a Window as two slim, parallel neutral pane
  lines inside its wall opening. A Door remains the existing single calm
  threshold marker: no leaf, swing arc, hinge or additional door state was
  introduced.
- The four-room reference journey creates two Doors, two Windows and three
  prepared items through the ordinary UI, then requires four pane lines. It
  also verifies each window pair is parallel and separated, while Doors
  contain no window-pane projection.
- A manual mutation reduced each Window to one line; the furnished phone
  journey failed with expected four panes / received two before the two-pane
  marker was restored.
- Final verification passed: 1,752/1,752 unit tests across 130 files,
  TypeScript typecheck, Biome lint, production Rspack build, and the focused
  quiet-selection, direct-rotation and furnished-apartment phone journeys.

## Продолжение 2026-09-05 — P2.11 Projects/Create и P2.12 touch targets

**Основание:** запрос Product Owner проверить состояние и продолжить редизайн,
приложив скриншоты пользовательских сценариев. Канонический readiness report
от 2026-08-30 содержит итоговый `readinessVerdict: READY`; этот UI-срез не
переоценивает readiness и не меняет владельцев PRD/SPEC/Architecture.

**Связи:** CAP-1/5/10; FR-1/2/5/21/43; NFR-17/18; AD-3/4/12/16.

### Что завершено

- Projects и создание проекта используют спокойные поверхности, синий
  `#1976B9`, обводки `#D9E1E8`, фон `#F4F6F8` и системный шрифт. Убраны
  градиенты, blur, тяжёлая тень контейнера и декоративный знак в форме создания.
- Название, дата и нейтральное превью проекта находятся внутри одной кнопки
  открытия. Превью — значок документа, не вымышленный thumbnail планировки.
  Переименование/экспорт остаются в отдельном меню.
- Длинное название переносится; на 360 px при 200% тексте раскрытое меню
  остаётся читаемым в одну колонку. Его действия не открывают проект случайно.
- Все кнопки постоянной шапки, включая «Назад», название, меню и «План / 3D»,
  имеют фактические области нажатия не меньше 44×44 CSS px на 360 и 393 px.
- Более высокая шапка учтена в расположении healthy-offline и предупреждения
  о хранилище. 3D по-прежнему измеряет реальную границу header через свой
  существующий ResizeObserver.
- Шкала Plan учитывает верхний safe area; при `top: 44px` она остаётся ниже
  шапки и выше счётчика предметов. Координаты геометрии и маркер `+Z` не меняются.
- Ошибки renderer/подготовки GLB с действиями находятся в общей прокручиваемой
  группе ниже шапки. После исчерпания восстановления доступна кнопка перехода
  к точному Plan без создания Revision; обычная успешная 3D-сцена не содержит
  этой группы.

### Проверки и обнаруженные ограничения

- RED: браузер подтвердил прежние `blur(20px)`/градиенты и Back высотой 40 px.
  Дополнительные RED-проверки воспроизвели переполнение раскрытого меню при
  200% тексте и перекрытие storage warning новой шапкой (100 px против 116 px).
- RED для реального `env(safe-area-inset-top)` через Chromium CDP показал
  масштаб на 129 px под шапкой до 152 px. Renderer fallback оказался на
  54 px под шапкой до 117 px. Оба сценария прошли после адресного исправления.
- После исправлений целевые сценарии Projects, header, storage warning и
  четырёхкомнатной квартиры прошли. Каталог, геометрия, публикация Revision,
  переносимые резервные копии и история сохраняют прежние command paths.
- Rspack локализует custom-property declarations внутри CSS Modules.
  Повторное объявление глобальных `--blue`, `--line`, `--canvas` в Projects
  меняло имена ссылок во всём модуле и скрывало selected Wall stroke.
  Регрессия обнаружена существующим `EDITOR-E2E-13K`; конечный код использует
  отдельные `--projects-*`, сохраняя глобальные ссылки остальных поверхностей.
- Production Stryker scope исключает UI/CSS. Вместо нерелевантного общего
  score выполнена одна целевая ручная мутация: удалён вызов `openProject` у
  карточки; `PROJECT-E2E-01I` упал на переходе в editor. Вызов восстановлен.
- Ещё две изолированные ручные мутации убиты: нулевой сдвиг safe-area scale
  снова дал 129 px под шапкой до 152 px; удаление renderer-условия из группы
  recovery скрыло нужную кнопку. Каждое изменение восстановлено сразу после
  проверки. Итого 3/3 ручных мутаций убиты, выживших нет; это локальная выборка.
  После восстановления финальные safe-area/recovery сценарии снова прошли 2/2.
- Скриншоты создаются через обычный интерфейс в изолированных профилях:
  Projects/Create, меблированный Plan, Window draft, PlacementPreview,
  выбранный предмет, повторное открытие/поворот/сброс обзора и выделение в 3D.
  Каталожный fake возвращает локальные ресурсы репозитория. Это browser
  emulation evidence, не физическая NFR-15 приёмка.

**Итоговая проверка:** 1 752/1 752 unit-теста (130 файлов), Biome lint,
TypeScript typecheck, production Rspack build и 9/9 PWA-сценариев прошли.
Полный мобильный прогон: 182 passed, 6 failed, 1 предусмотренный live-catalog
skip. Пять падений были устаревшими ожиданиями «2 предметов» после ранее
введённого правильного «2 предмета»; шестое выявило перекрытие renderer fallback.
После исправления этих причин отдельный прогон завершился 12/12 passed:
все шесть упавших сценариев, новые Projects/header/safe-area/storage контракты,
каталог и четырёхкомнатная квартира. Это полный прогон с последующей проверкой
исправлений, а не один непрерывный зелёный запуск.

Галерея: `docs/progress/screenshots/redesign-2026-09-05/README.md` (14 снимков).
Коммит не создаётся.

## Продолжение 2026-09-05 — P2.13 понятные измерения

**Связи:** CAP-3; FR-13; NFR-17/18; AD-3/4/12; DESIGN SelectionCard и
Measurement; EXPERIENCE named targets / stale reselect.

### Завершённый пользовательский путь

- «Измерить» доступно из свойств выбранной стены; измерение от предмета
  работает в Plan и 3D. Панель показывает «Откуда», «Куда» и кратчайшее
  расстояние на плане. Выбор второй цели доступен через именованный DOM-список.
- Цели разделены на «Стены», «Комнаты», «Предметы». Стены имеют номер,
  длину по оси и направление; комнаты — номер, сохранённое имя и внутреннюю
  площадь; предметы — различающий номер, имя и размеры footprint. Источник
  исключается по canonical ID и типу, поэтому одинаковые имена не теряют цели.
- Названия и границы захватываются вместе с Revision/checksum. Изменение
  Revision, включая Undo, скрывает число; «Выбрать заново» начинает с первой
  цели независимо от текущего selection. Нулевое расстояние допустимо.
- UI явно различает ось стены, внутреннюю границу комнаты и габариты предмета.
  Для starter 4000×3000 мм расстояние между противоположными осями — 3100 мм;
  это не ширина прохода. Domain `measureDistance` и canonical geometry не менялись.
- Удаление предмета убрано из результата. Свойства, переименование, другие
  инструменты и выход заменяют измерение. Overflow временно скрывает его,
  сохраняя stale-путь после Undo; Escape/закрытие возвращают фокус видимому
  trigger либо текущему переключателю 3D/инструменту выбора.
- Критические persistence/recovery/writer notices закрывают измерение.
  Проверка отказа IndexedDB дополнительно выявила старое перекрытие retry
  подтверждённым Wall-deletion preview: после `persist-failed` этот preview
  закрывается, а подтверждённая команда остаётся в существующем controller retry.
- Панель проверяется на 360 px с 200% текстом; это браузерная эмуляция.

### Проверка

- RED: отсутствовал Wall trigger, список не называл источник/комнаты;
  дополнительные RED подтвердили сломанный переход к свойствам, невидимый
  focus fallback в 3D и перекрытый путь повторного сохранения.
- Новые сценарии: `MEASURE-E2E-01–04`; обычное удаление предмета остаётся в
  `ITEM-E2E-03` и проверяет сохранение/Undo/resources отдельно от измерения.
- Итоговые Biome lint, TypeScript typecheck и 1 752/1 752 unit-теста
  (130 файлов) прошли. Production build и 9/9 PWA-сценариев прошли.
- UI/CSS исключены из текущего production Stryker scope. Выполнены четыре
  изолированные ручные мутации: возвращён источник в список целей, обе
  границы запроса подменены источником, сохранён старый источник после stale
  reset и оставлен Wall-deletion preview при `persist-failed`. Все четыре
  обнаружены браузерными тестами и восстановлены; выживших нет. Это локальная
  выборка, не общий mutation score.
- Полный мобильный браузерный прогон завершился одним зелёным запуском:
  192 passed, 1 предусмотренный live-catalog skip (193 сценария, 9,6 минуты).
  Все `MEASURE-E2E-01–04`, обычное удаление предмета, сохранение/recovery,
  каталог и меблированная четырёхкомнатная квартира прошли.
- Независимый обзор не выявил существенных дефектов после исправлений
  переходов между панелями, возврата фокуса и перекрытого save retry.
- Галерея: `docs/progress/screenshots/measurement-2026-09-05/README.md`.
  Четыре снимка взяты из итогового полного прогона: стены, выбор комнаты,
  предметы в 3D и повторный выбор после изменения плана.

Это завершение данного UI-среза, не переоценка всей реализации FR-13:
произвольные PlanPoint/VertexPoint и полная одноцелевая Room metric surface
не добавлялись. Коммит не создаётся.

## Продолжение 2026-09-05 — P2.14 сохранение и восстановление

**Связи:** CAP-1/10; FR-5/43/44/45; NFR-17/18; AD-4/12;
DESIGN Local / failure states и Recovery / local safety.

### Завершённый пользовательский путь

- Ошибка сохранения показывает причину, текущую сохранённую версию и действия
  в одной белой карточке. «Повторить сохранение» получает фокус; кнопка
  «Скачать сохранённую версию» вызывает существующий Portable Backup и не
  уводит на Projects, где очистилась бы ожидающая публикации правка.
- Подпись явно сообщает, что последняя несохранённая правка в файл не войдёт.
  Ошибка подготовки/скачивания файла остаётся внутри этой карточки. При
  первом неудачном создании Project доступен отдельный retry без обещания
  существующей сохранённой версии и без недоступного download.
- Карточка ошибки располагается выше панели свойств комнаты. Room и Opening
  временно снимают modal/Tab trap, чтобы внешние действия оставались доступны
  клавиатуре и screen reader. Rename сохраняет свой локальный retry.
  Cleanup фокуса не мешает StrictMode или уже выбранному пользователем control.
- При отказе записи Room properties сохраняют введённые поля для повторного
  сохранения. Валидированная высота не заменяется прежней цифрой в форме,
  пока controller сохраняет соответствующий pending candidate.
- Recovery Project больше не показывает отключённую форму создания и её
  инструкции. Наличие точного resource-recovery context определяет GLB repair
  и атомарное удаление; generic failure указателя/чтения предлагает проверку
  и возврат к проектам. Данные не объявляются потерянными.
- Во время чтения/проверки GLB или удаления недоступных моделей связанные
  действия и новый Back недоступны. Обычный выход сбрасывает локальные ошибки
  и подтверждение удаления, не меняя Project.
- History-only recovery использует те же шрифт, белую поверхность, обводку,
  синий primary и прокрутку. Его refresh остаётся проверкой уже доступных
  bytes; явное удаление истории сохраняет существующее подтверждение.
- Найден и исправлен lifecycle-дефект: первый writer heartbeat мог заменить
  `saving`/`persist-failed` на `saved` при переходе `not-ready → writable`.
  Теперь он уведомляет UI об изменении доступа, сохраняя состояние публикации.
  Ветка потери права записи и её fencing semantics не менялись.

### Проверка

- Browser RED подтвердил отсутствие единой failure card, старый history style,
  форму создания в recovery, сброс высоты Room и активные modal/Back во время
  соответствующих safety states. Два controller RED воспроизводят ложный
  `saved` при первом heartbeat отдельно для `saving` и `persist-failed`.
- `SAFETY-E2E-01` скачивает/импортирует прежнюю версию с четырьмя стенами,
  затем retry публикует ожидающее удаление и оставляет три стены. Проверяются
  ошибка скачивания, неизменность current pointer до retry, 360 px/200% текст
  и единственный доступный retry. `SAFETY-E2E-02` проверяет Room fields,
  приоритет карточки, keyboard route и возврат modal после сохранения.
- Расширены существующие browser journeys первого создания, history repair /
  discard, полного exact GLB repair, generic pointer failure и atomic removal.
  Целевой прогон после исправлений: 9/9 passed.
- Stryker с диапазоном новой строки controller: 1/1 mutant killed,
  0 survived; это проверка изменённой строки, не всего контроллера.
- Biome lint, TypeScript typecheck и 1 754/1 754 unit-теста (130 файлов)
  прошли. Production build и 9/9 PWA-сценариев прошли.
- Три ручные UI-мутации отключали скачивание, опускали карточку под Room
  dialog и разрешали Back во время GLB repair. Все три обнаружены browser
  assertions и восстановлены до итоговых проверок; выживших нет. Вместе
  с Stryker это локальная проверка изменённых веток, не общий mutation score.
- Независимый обзор не выявил существенных дефектов после исправления
  heartbeat, сохранения Room fields и временного отключения modal/Back.
- Полный мобильный browser-прогон: 192 passed, 1 предусмотренный live-catalog
  skip и 2 отказа устаревших UI assertions (9,6 минуты). В PLAN-E2E-02 ожидание
  старого перехода к Projects заменено новым скачиванием сохранённой версии;
  FBX exact-repair journey теперь ожидает новую diagnostic copy и отсутствие
  формы создания в recovery. Оба сценария после обновления проверок целиком
  прошли отдельным запуском: 2/2 passed. Код приложения после общего прогона
  не менялся; все 194 исполняемых сценария имеют успешную итоговую проверку.
  Typecheck и lint после изменений тестов повторно прошли.
- Галерея: `docs/progress/screenshots/safety-2026-09-05/README.md`.
  Шесть проверенных снимков из полного прогона: обычный план квартиры,
  повторное открытие в 3D, ошибка записи, history-only recovery, exact-resource
  recovery и generic failure сохранённой версии. Это эмуляция телефона.

Коммит не создаётся.

Полноценный экспорт pending candidate как recovery data не добавлен:
существующий `.interiors` экспортирует last durable current. Exact repair из
Portable Backup, history file-repair UI и read-only geometry для непроверенного
current также не объявляются реализованными этим визуальным срезом.

## Продолжение 2026-09-05 — P2.15 подтверждения удаления и очистки истории

**Связи:** CAP-1/8/10; FR-4/38/43; NFR-17/18; AD-4/12;
DESIGN confirm-sheet и EXPERIENCE focus / explicit destructive choice.

### Завершённое поведение

- Два подтверждения используют общий `ProjectConfirmationDialog` с native
  `showModal()`: редактор под ним недоступен указателю и фокусу, диалог
  располагается выше существующих панелей без ручного z-index соревнования.
- Белая карточка, системный шрифт, синий безопасный выбор «Оставить…», красная
  обводка необратимого действия и спокойное затемнение фона. Название Project
  переносится даже без пробелов. На коротком экране текст и действия
  прокручиваются внутри ограниченной по высоте карточки.
- При открытии фокус получает «Оставить…». Tab и Shift+Tab остаются внутри;
  Escape/native cancel закрывают верхний диалог, пока операция не начата.
  Клик по фону не подтверждает и не отменяет действие.
- Во время операции обе кнопки disabled, фокус остаётся на самом dialog,
  Escape не скрывает прогресс. Ошибка показана через `role=alert`, повтор
  доступен, безопасная кнопка снова получает фокус.
- После отмены удаления фокус возвращается в видимую кнопку меню; после
  отмены очистки — в её recovery trigger. После успешной очистки используется
  кнопка меню, после удаления — заголовок Projects. Cleanup не перебивает
  фокус нового экрана или повторный mount в StrictMode.
- Confirmation закрывается при потере writer или изменении подходящего
  состояния. После повторного takeover старое согласие не появляется снова.
  Пока открыто подтверждение истории, прежняя recovery card скрыта.
- Atomic deletion, проверка текущего плана перед discard и durable/history
  contracts остаются в существующих controller/repository boundaries.

### Проверка

- Browser RED: оба безопасных действия не получали фокус; confirmation
  удаления переживал takeover; history notice оставался вторым видимым слоем.
- `DIALOG-E2E-01` проверяет Tab/Shift+Tab, блокировку фона, Escape/return focus,
  длинное имя, 360×480 при 200% текста, отказ IndexedDB, retry и busy.
  `DIALOG-E2E-02` проверяет смену writer в двух окнах и новое явное открытие.
- Расширены существующие `HISTORY-E2E-01` (keyboard, error, busy, focus,
  неизменность current revision и ресурсов истории) и `PROJECT-E2E-01A`
  (полное удаление проекта с контуром). Новые ошибки воспроизводятся на
  границе IndexedDB в изолированном browser profile, без новых production seams.
- Целевой прогон: 6/6 passed, включая оба прежних `SAFETY-E2E`.
  Biome lint, TypeScript и 1 754/1 754 unit-теста прошли.
- Независимый read-only review не выявил существенных нерешённых дефектов.
- Production Stryker scope исключает UI/CSS. Шесть изолированных ручных
  мутаций заменяли modal на non-modal, разрешали busy cancel, убирали возврат
  фокуса, переводили initial focus на разрушительное действие, снимали
  ограничение высоты и возвращали вторую history card. Все 6/6 обнаружены
  поведенческими assertions и восстановлены. Это локальная выборка,
  не общий mutation score приложения.
- После восстановления исходного кода повторно прошли lint, TypeScript,
  1 754 unit-теста, production build и 9/9 PWA-сценариев.
- Полный мобильный browser-прогон завершился одним зелёным запуском:
  196 passed, 1 предусмотренный live-catalog skip (197 сценариев, 9,5 минуты).
  Включены оба DIALOG, расширенный HISTORY, существующий save/recovery,
  каталог и повторно открытая меблированная четырёхкомнатная квартира.
- Галерея: `docs/progress/screenshots/dialogs-2026-09-05/README.md`.
  Шесть снимков из полного прогона: оба обычных подтверждения, ошибки
  удаления/очистки и оба сценария на 360×480 при 200% текста. Снимки
  просмотрены; это браузерная эмуляция, не physical-device acceptance.

Коммит не создаётся.


## Продолжение 2026-09-05 — P2.16 помещения и размеры плана

**Связи:** CAP-1/3/4; FR-5/13/16/18; NFR-17/18; AD-4/6/12;
DESIGN sheet/form и EXPERIENCE Room properties / explicit apply.

### Завершённое поведение

- Room directory/properties и размеры прямоугольного Plan используют общий
  `InspectorPanels.module.css`: белые карточки, системный шрифт, спокойные
  границы, обычный регистр подписей и синий primary action. Кнопки не меньше
  44 CSS px, поля с шрифтом 16 px при обычном масштабе текста.
- Список помещений переносится в адаптивную сетку. Имя, тип и высота остаются
  явными полями; площадь и периметр вычисляются. В Room форме появилась
  видимая единица «мм», пояснение написано языком пользователя.
- Панели ограничены высотой viewport с учётом верхнего/нижнего safe area.
  На 360×480 и 200% текста содержимое прокручивается целиком; все действия
  доступны указателю без горизонтального переполнения. План проверен также
  с эмуляцией выреза top=59/bottom=34 CSS px, ниже постоянной шапки.
- При открытии Room фокус получает контейнер, включая первый Shift+Tab в
  корректном цикле. Escape закрывает idle-панель и возвращает фокус в видимый
  dock trigger; fallback не возвращает его в старую прозрачную кнопку.
- Во время публикации Room блокируются переключение комнаты и закрытие,
  фокус остаётся в панели, Escape не скрывает операцию. При потере writer или
  history recovery Room закрывается и освобождает путь к восстановлению.
- Размеры плана открываются из меню с фокусом внутри панели, закрываются
  кнопкой/Escape с возвратом в меню. При сохранении фокус не теряется на body;
  в read-only режиме поля и Apply disabled. Валидация показана внутри формы
  с единственным alert и связью aria-describedby.
- Временное отсутствие проекции во время takeover сохраняет состояние Plan;
  переход в Projects или другой Project очищает панели и прежнюю ошибку.
- После отказа сохранения подтверждённого изменения Room/Opening введённая
  высота остаётся в форме. Внешний retry публикует ту же правку; до этого
  current Revision pointer и прежнее окно не меняются. Количество staged
  записей не используется как доказательство Durable публикации.
- Room остаётся ниже SaveFailureNotice и снимает aria-modal/focus trap, пока
  требуется внешний retry. Геометрия и atomic publish остаются в существующих
  domain/controller boundaries; новых production test seams не добавлено.

### Проверка

- Четыре новых `PANEL-E2E` покрывают клавиатуру, busy, writer takeover в двух
  окнах, локальную ошибку/Apply, смену Project, 200% текста и safe area.
- `RECONCILIATION-E2E-01R` дополнен крупным текстом и quota failure → retry
  после подтверждённого удаления окна при уменьшении высоты комнаты.
- RED воспроизвёл уход начального Shift+Tab, отсутствие Plan focus, активные
  read-only поля, пересечение шапки, перенос панели в другой Project и
  сброс pending Room height. Целевой GREEN — 9/9, включая прежние ROOM,
  точный Plan Apply и `SAFETY-E2E-02`.
- Независимый read-only review выявил три lifecycle/safe-area случая;
  исправления проверены повторно, существенных нерешённых замечаний нет.
- Stryker production scope исключает UI/CSS. Шесть ручных изолированных
  мутаций удаляли начальный Room trap, busy-блокировку списка, Plan focus,
  read-only disable, safe-area поправку и сохранение pending conflict fields.
  Все 6/6 обнаружены assertions, исходники восстановлены. Это локальная
  проверка силы тестов, не общий mutation score приложения.
- После восстановления: Biome lint, TypeScript, 1 754/1 754 unit-теста,
  production build и 9/9 PWA-сценариев прошли.
- Полный browser-прогон: 199 passed, 1 предусмотренный live-catalog skip,
  1 timeout в старом `PLAN-E2E-02` (201 сценарий, 10,5 минуты). Trace показал
  попытку кликнуть прозрачный legacy shortcut «Помещения» под новой Plan
  карточкой. Тест переведён на видимый dock «Комната»; при save failure
  пользователь сначала повторяет сохранение в верхней notice, затем закрывает
  Room. Production source при этом не менялся.
- Итоговый follow-up: 7/7 passed — исправленный `PLAN-E2E-02`, четыре PANEL,
  RECONCILIATION01R и SAFETY02. Таким образом, все 200 исполняемых browser
  сценариев получили passing result на итоговом production source, но это
  полный прогон плюс отдельная перепроверка, не один полностью зелёный запуск.
  После правки теста повторно прошли lint и TypeScript.
- Галерея итоговых сценариев: `docs/progress/screenshots/inspectors-2026-09-05/README.md`.
  Десять реальных снимков из полного browser-прогона скопированы и просмотрены:
  Room/Plan, ошибка размеров, конфликт проёма, ошибка записи, три сценария
  крупного текста и эталонная квартира в 2D/3D. Это phone emulation evidence;
  тесные подписи глобальной шапки/dock при 200% внесены в remaining work.
