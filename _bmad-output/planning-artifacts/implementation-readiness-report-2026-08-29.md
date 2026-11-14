---
title: "Implementation Readiness Assessment Report"
date: 2026-08-29
project: "InteriorsEditor"
status: needs-work
stepsCompleted:
  - document-discovery
  - prd-analysis
  - epic-coverage-validation
  - ux-alignment
  - epic-quality-review
  - final-assessment
documentsIncluded:
  prd:
    - "_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md"
  ux:
    - "_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md"
    - "_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md"
  architecture:
    - "_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md"
  epics:
    - "_bmad-output/planning-artifacts/epics.md"
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-29  
**Project:** InteriorsEditor

## Document Discovery

| Document type | Selected source | Discovery result |
| --- | --- | --- |
| PRD | `prds/prd-InteriorsEditor-2026-07-26/prd.md` | One whole document; no sharded duplicate found. |
| UX design | `ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md`, `EXPERIENCE.md` | One current document set; reconciliation, review and memlog files are historical/supporting only. |
| Architecture | `architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md` | One whole document; no sharded duplicate found. |
| Epics and stories | `epics.md` | One whole document; no sharded duplicate found. |

The Product Owner confirmed this selected current-source set in chat on
2026-08-29. Historical readiness reports and review records are excluded from
the current assessment unless a current source explicitly references them as
evidence.

## PRD Analysis

### Functional Requirements

The PRD preserves the stable `FR-1`…`FR-54` namespace: 40 requirements are
active for Alpha, five are Alpha+, and nine identifiers are explicitly retired
to protect identifier stability.

| ID | Requirement extracted from the PRD | Release contour |
| --- | --- | --- |
| FR-1 | User creates a locally owned Project with a working name and one empty Level; the Project receives stable ID, schema version and timestamps without an account or network after the app shell loads. | Alpha |
| FR-2 | User lists, opens and renames local Projects; the list distinguishes empty/loading/corrupt/populated and rename preserves ID without duplication. | Alpha |
| FR-3 | Independent Project duplication is retired; comparison is through session undo/redo. | Retired |
| FR-4 | User permanently deletes a Project only after explicit confirmation; cancel changes nothing, Project metadata and owned Revisions delete atomically, shared resource release is separate GC, and stale/error cannot partially delete. | Alpha |
| FR-5 | Every Validated Command passes PendingDurability and only atomic pointer publication yields saved; close/crash/eviction restores the last Durable Revision and distinguishes saving/saved/persist-failed/recovery-needed. | Alpha |
| FR-6 | User creates a first rectangular Room from internal integer-mm width, depth and height; invalid/bounds values reject and the usable interior is exact. | Alpha |
| FR-7 | User draws Walls only orthogonally or at 45 degrees; an origin-relative 100-mm touch candidate, presentation-only grid and exact off-grid numeric intent follow one constrained validation contract. | Alpha |
| FR-8 | User authors Walls directly by touch with a confirmable constrained candidate; canonical geometry stays integer-mm and quantized 45-degree preview never creates a second source of truth. | Alpha |
| FR-9 | User moves Vertex, splits Wall and adds Wall at a Vertex; valid exact T/X contacts atomically normalize to shared Vertex/non-zero segments, while invalid topology leaves unrelated state unchanged. | Alpha |
| FR-10 | User edits Wall thickness in mm; dependent Openings revalidate, shared Wall height derives from max adjacent Room height and Opening fit from their minimum. | Alpha |
| FR-11 | User removes a valid Wall/Vertex; Room/host/Opening consequences require fresh-base/fenced, explicit preview outcome and one atomic publication, with no mutation on cancel/stale/fence loss. | Alpha |
| FR-12 | System rejects zero, duplicate, invalid-direction, self-intersecting and invalid topology commands with a rule, target and corrective action; no rejected/transient state becomes history, autosave or mutation. | Alpha |
| FR-13 | User performs revision-bound measurements of Plan points, Wall centerlines, usable Room boundaries and Item footprints in canonical mm/mm² with one documented rounding/locator policy. | Alpha |
| FR-14 | System derives only valid closed Room faces, including valid void rings, after each topology commit and never partially materializes invalid components. | Alpha |
| FR-15 | System preserves Room identity/name/height when lineage is unambiguous; Wall-induced split deterministically gives successors predecessor height, while merge/unresolved host consequences use confirmed revalidation. | Alpha |
| FR-16 | User sets Room name/type/height; geometry/area remain derived and height is the sole editable room-height source. | Alpha |
| FR-17 | User adds a valid Door on a Wall with width/height/sill-or-threshold/offset; Door is not a navigation edge or separate access state. | Alpha |
| FR-18 | User adds a valid Window on a Wall with width/height/sill/offset; 2D and 3D share its parameters. | Alpha |
| FR-19 | User touch- or numerically moves, resizes and removes an Opening; Wall-induced incompatibility requires confirmed resize/relocate/delete conflict handling. | Alpha |
| FR-20 | Door navigation through Rooms is retired. | Retired |
| FR-21 | User switches 2D/3D without losing interactive Wall/Item selection, durability state or camera-independent domain data; derived Rooms receive no selection state. | Alpha |
| FR-22 | System derives Walls, Openings and Floors procedurally from one Project state; renderer objects are not serialized truth and reload is semantically deterministic. | Alpha |
| FR-23 | User can orbit/pan/zoom and select a present ItemInstance; Room surfaces stay display-only and camera navigation is separate from object transform. | Alpha |
| FR-24 | Walk Mode is retired. | Retired |
| FR-25 | System adaptively changes DPR/shadows/effects/LOD without changing Project or blocking touch editing, and may expose quality tier diagnostics. | Alpha |
| FR-26 | User browses representative furniture, plumbing, appliance/electronics, lighting and accessory categories; catalog unavailability is distinct from Project/resource recovery. | Alpha |
| FR-27 | User searches by name/category and filters by AnchorClass or main dimensions. | Alpha |
| FR-28 | User places an ItemInstance only on compatible AnchorClass, with valid/warning/invalid preview, stable wall host, exact-byte pin and backup feasibility before Durable publication; technical resource failure/cancel/crash/fence loss cannot partially publish it. | Alpha |
| FR-29 | User moves, rotates and only where permitted resizes ItemInstance with exact numeric position/dimensions/rotation; fixed-size items cannot stretch. | Alpha |
| FR-30 | User duplicates, locks/unlocks and deletes ItemInstance; locked items resist accidental gestures and all actions participate in undo/redo. | Alpha |
| FR-31 | System presents footprint/clearance collision feedback for Walls, Openings and ItemInstances as a warning, without automatic Project change or code-compliance claim. | Alpha |
| FR-32 | User creates a parametric box placeholder with name, dimensions, color and AnchorClass; it works in collision, save/export/3D and is not a disguised SKU. | Alpha |
| FR-33 | User applies allowed color/material variant only to declared recolorable slots, stored as a domain reference rather than renderer material. | Alpha |
| FR-34 | Floor finish assignment is retired. | Retired |
| FR-35 | Wall finish assignment is retired. | Retired |
| FR-36 | Ceiling finish/surface/placement is retired. | Retired |
| FR-37 | Finish offline availability is retired. | Retired |
| FR-38 | User undo/redoes each Durable Command within session history; resources remain GC roots, prospective commands pass retention first, history-only corruption needs exact repair or explicit confirmed discard, and reopen/recovery/migration/import begin a new boundary. | Alpha |
| FR-39 | User cancels an Active Gesture without history entry or autosave mutation. | Alpha |
| FR-40 | Rejected command explains the violated rule, preserves prior valid state and offers accessible correction. | Alpha |
| FR-41 | User installs PWA where supported; unsupported WebGL2 gets compatibility UI and iOS browser/Home Screen storage separation is explained before a Project, with transfer through Portable Backup. | Alpha |
| FR-42 | After initial shell/project setup, user reopens and edits a locally pinned Project offline; control-plane outage cannot block local open/edit/save/history/export. | Alpha |
| FR-43 | System reports storage usage/pressure, requests persistence where possible and handles quota without silent data loss; only repeatable cache is LRU-cleaned and backup remains honest, not a storage guarantee. | Alpha |
| FR-44 | User exports a versioned self-contained Portable Backup with manifest/schema/integrity metadata and exact referenced resources, within an enforced complete-backup envelope and without network. | Alpha |
| FR-45 | User imports a compatible Portable Backup through validation/migration/atomic commit as a new Project ID; future schema and unsafe container are explained without overwriting an existing Project. | Alpha |
| FR-46 | PNG snapshot/download/share is retired. | Retired |
| FR-47 | Editor offers reload only at a Durable Revision; every startup checks shell/worker/Project/catalog compatibility and follows recoverable migration. | Alpha |
| FR-48 | User selects exactly one local static `.glb`; other formats/archives are rejected. | Alpha+ |
| FR-49 | Before general loader, system preflights GLB bytes/resources/budgets with cancel/timeout and deny-all resolver. | Alpha+ |
| FR-50 | After preflight, user sees isolated preview and confirms dimensions, pivot/orientation, AnchorClass and recolorable slots. | Alpha+ |
| FR-51 | System rejects unsafe/unsupported GLB (extensions, URIs, animation/skin/morph/camera/light/invalid metadata/budget) without partially persisted blob. | Alpha+ |
| FR-52 | Confirmed ImportedAsset has ID/hash/validated metadata/local blob; deduplication and final-reference policy free resources, while pin/backup admission prevents partial persistence. | Alpha+ |
| FR-53 | In-app Focus/native fullscreen is retired. | Retired |
| FR-54 | Catalog Control Plane only publishes/gets versioned catalog metadata/resources/hashes; it never owns account, Project, Revision, History or Backup, and a pinned Project stays usable during control-plane outage. | Alpha |

### Non-Functional Requirements

The PRD defines 26 NFR entries. `NFR-22` is explicitly N/A for Alpha entry;
all other NFRs remain applicable.

| ID | Requirement extracted from the PRD | Release contour |
| --- | --- | --- |
| NFR-1 | Persisted coordinates, dimensions and offsets use integer mm; save/reopen/backup roundtrip has 0-mm semantic drift. | Alpha |
| NFR-2 | Renderer converts to metres only at adapter boundary and never owns domain state on reverse conversion. | Alpha |
| NFR-3 | Failed command preserves the prior Durable Revision; transient/rejected/stale/fence-lost states cannot become command/history/silent mutation. | Alpha |
| NFR-4 | Same versioned Project/catalog versions yield identical topology/material assignments. | Alpha |
| NFR-5 | Interaction responsiveness is preserved by on-demand rendering and quality degradation; numeric device timing is diagnostic, not an Alpha release gate. | Alpha |
| NFR-6 | Reference scene budget is up to 6 Rooms, 60 ItemInstances, 750k visible triangles, 250 draw calls and 128 MiB estimated GPU; exact limits require spike evidence. | Alpha |
| NFR-7 | Normal local editing must remain usable; numeric cold/warm timings are diagnostic, not an Alpha release gate. | Alpha |
| NFR-8 | Forced context loss restores the same Project without reload; a 15-minute thermal run is diagnostic, not an Alpha release gate. | Alpha |
| NFR-9 | Scene renders on demand outside animation/gesture. | Alpha |
| NFR-10 | With pinned exact resources, core local editing/save/history/export does not depend on Background Sync, control-plane or remote Project storage. | Alpha |
| NFR-11 | Abrupt termination at every persistence boundary restores last Durable Revision with automated and device evidence. | Alpha |
| NFR-12 | Every schema migration has prior-version fixtures, idempotence policy and rollback/backup boundary. | Alpha |
| NFR-13 | Quota never silently deletes Project; resource corruption is read-only until verified repair/atomic recovery, history-only corruption only allows explicit confirmed discard, and healthy backup remains available. | Alpha |
| NFR-14 | WebGL2 is mandatory Alpha baseline; WebGPU is progressive enhancement only. | Alpha |
| NFR-15 | Completed Product Owner functional acceptance on iPhone 15 Pro Max and Samsung S24 Ultra in browser and installed PWA contexts; the former matrix, RS-2, thermal and independent-review criteria are optional diagnostics. | Alpha |
| NFR-16 | Renderer, storage and installability use capability detection, not user agent alone. | Alpha |
| NFR-17 | Interactive DOM targets are ≥44×44 CSS px, safe-area aware and hover-independent. | Alpha |
| NFR-18 | DOM controls/forms/dialogs/navigation meet WCAG 2.2 AA and announce linked validation. | Alpha |
| NFR-19 | Critical 3D/touch action has accessible DOM/list alternative without global-coordinate input. | Alpha |
| NFR-20 | Reduced motion removes optional camera animation. | Alpha |
| NFR-21 | Without consent, Project geometry/screenshots/imported assets do not leave device; Catalog Control Plane has no user identity or Project data. | Alpha |
| NFR-22 | Untrusted GLB has deny-network preflight/allowlist/staged limits; it is explicitly N/A while custom GLB stays Alpha+. | Alpha+ only |
| NFR-23 | Any telemetry is minimized, excludes plan/binary/name/screenshot data and has opt-out before public Alpha. | Alpha |
| NFR-24 | CAP/FR/NFR/AD identifiers never reuse and breaking schema increments version. | Alpha |
| NFR-25 | Feedback carries non-sensitive app/schema/catalog/capability/error diagnostics, never Project content. | Alpha |
| NFR-26 | Domain/topology remain DOM/GPU-independent; ports/adapters and versioned corpus cover the listed selection/geometry/recovery outcomes and E2E proves user results. | Alpha |

### Additional Requirements

- Alpha entry has one Level, connected Rooms, 0°/45°/90° authoring, a
  representative generic catalog/placeholder, local-first autosave/offline/
  backup and real iOS/Android usability/performance evidence.
- Alpha+ comprises FR-48–FR-52 and makes NFR-22 applicable; it does not block
  first Alpha testers.
- Retired scope includes Project duplication, Walk, finishes/ceiling,
  PNG/share and Focus/native fullscreen; identifiers are not reusable.
- Required preconditions include accepted D22 decisions, technical catalog
  manifest, renderer/topology/offline/touch/catalog evidence, device matrix,
  schema corpus, public-Alpha analytics/privacy decision and initialized Git
  branching workflow.
- Consent-backed independent UJ-1…UJ-6 research, independent review and
  physical evidence remain factual release conditions; owner approval does not
  substitute for those roles.

### PRD Completeness Assessment

The current PRD has explicit IDs, Alpha/Alpha+ contour and retired-scope
markers for every extracted functional and non-functional requirement. Its
remaining readiness risk is evidence execution rather than an unresolved
product choice: physical/device, independent-participant and control-plane
evidence are still named external obligations.

## Epic Coverage Validation

### Active requirement coverage

| Requirement set | Owning roadmap scope | Coverage result |
| --- | --- | --- |
| 40 active Alpha FRs | Epics 1–8 | 40/40 have an owning Epic and at least one non-retired story path. |
| FR-48…FR-52 (Alpha+) | Epic 9 | 5/5 are explicitly deferred and do not block Alpha entry. |
| Retired FR-3, 20, 24, 34–37, 46, 53 | Historical stories retained only for identifier traceability | Correctly excluded from current Alpha feature scope. |

No active Alpha FR lacks an Epic owner. The feature breakdown is coherent with
the PRD: project lifecycle and durability are in Epics 1 and 8; 2D topology
and openings in Epics 2 and 3; projection and 3D interaction in Epic 4;
catalog/item placement in Epic 5; variants in Epic 6; and history/rejection
handling in Epic 7.

### Traceability gap to correct

The `FR Coverage Map` in `epics.md` still reports “51/51 active FRs”. That
statement is stale after the approved scope corrections: it includes retired
IDs such as FR-3 and FR-34…FR-37, omits the current retirement of FR-53, and
does not distinguish the five Alpha+ IDs. It must be replaced with the current
40/40 Alpha and 5/5 Alpha+ accounting before the roadmap can serve as a final
release ledger. This is a documentation and audit defect, not evidence that an
active Alpha capability is unowned.

### Coverage assessment

- Missing active Alpha requirements: none.
- Duplicate functional ownership: deliberate cross-cutting traces only; no
  conflicting primary owner was found.
- Alpha+ boundary: explicit in Epic 9 and consistent with the PRD.
- Remaining requirement-level risk: the stories that are still `review` or
  `in-progress` need current evidence to satisfy their acceptance criteria;
  status cannot be inferred from traceability alone.

## UX Alignment Assessment

### UX Document Status

**Found.** The current UX source set is `DESIGN.md` and `EXPERIENCE.md`.
Together they define the phone-first AppShell, canvas and bottom-sheet layout,
Plan and 3D interaction, recovery/offline states, PWA guidance, accessibility
and platform constraints.

### Alignment findings

| UX concern | PRD alignment | Architecture support | Assessment |
| --- | --- | --- | --- |
| Phone-first 2D/3D authoring, selection and camera navigation | FR-21…FR-25, NFR-14…NFR-20 | AD-1, AD-5, AD-10, AD-12, AD-23 | Aligned. The 2D/3D selection and disposable-projection boundaries are explicit. |
| Catalog placement, technical readiness, recovery and offline work | FR-26…FR-33, FR-42…FR-45, FR-54 | AD-4, AD-8, AD-14, AD-17, AD-24 | Aligned. UX correctly separates catalog outage from Project recovery. |
| Durable status, undo/redo, rejection and conflict preview | FR-5, FR-38…FR-40 | AD-3, AD-4, AD-7, AD-12 | Aligned. UX does not call a candidate saved before atomic publication. |
| PWA update and browser/Home Screen storage boundary | FR-41, FR-47 | AD-4, AD-11, AD-16 | Aligned. Explicit reload and recoverable startup semantics are specified. |
| Accessible numeric/list alternative, touch targets and reduced motion | NFR-17…NFR-20 | AD-2, AD-10, AD-12 | Aligned in design, still awaiting device/assistive-technology evidence. |

### Alignment issue requiring correction

Both UX documents still specify a **Focus/native-fullscreen** route (for
example, the Focus principle and editor branch in `EXPERIENCE.md`, and Focus
controls in `DESIGN.md`). Current PRD scope retires `FR-53`, and AD-15 states
that no Focus controller, fullscreen platform port or Focus-specific evidence
belongs to Alpha. This is a source conflict: the UX route must be removed or
marked historical before final readiness. It does not justify restoring the
retired feature.

### Warnings

- UX appropriately calls for real-phone, 200% text-scale, safe-area and
  touch-target validation, but those are evidence obligations, not completed
  observations.
- The documents contain a few editorially duplicated or incomplete sentences
  around AppShell/ModeSwitcher/Focus. They do not change the intended behavior,
  but should be cleaned while removing the retired route so the implementation
  and test team have one unambiguous UX contract.

## Epic Quality Review

### Outcome and sequencing

All nine Epics express a user outcome rather than an internal technical
milestone. Epic 1 begins with trusted local ownership; Epic 2–5 build the
authoring, inspection and placement path; Epic 6–8 extend that path with
variants, safe experimentation and portability; Epic 9 is explicitly
post-Alpha. The normal feature dependency direction is sound: later epics
reuse only foundations supplied by earlier ones.

### Major issues

1. **Competing room-creation UX contracts.** Story 2.2 requires a labelled
   `Прямоугольная комната` action and a rectangular loop candidate, while the
   current UX documents explicitly prohibit that action and prescribe only
   individual explicit Wall drafts. The implemented application and browser
   regression suite already exercise the rectangular route. One current UX
   contract must be selected and the other removed; Alpha cannot be tested
   against mutually exclusive instructions.
2. **Room-properties story has an undeclared forward dependency.** Story 3.2
   conditions FR-16 on a “future approved non-canvas metadata redesign”, even
   though FR-16 is active Alpha scope and the application already exposes a
   dedicated room directory. The story must name that present, accessible path
   directly instead of deferring the capability to an unspecified redesign.
3. **Formal gates conflict with the active implementation waiver.** Several
   completed-story acceptance criteria still state `G-READY` as a prerequisite
   to beginning implementation. The Product Owner’s 2026-08-05 written waiver
   authorizes production implementation and evidence collection before READY;
   it does not waive final Alpha release gates. These story texts need a
   uniform wording change so an implemented slice is not simultaneously
   described as forbidden and complete.

### Minor issues

- Story 7.1 still refers to a “finish command” although finish scope is
  retired; retain geometry, Opening and Item command examples only.
- Story 5.2 uses “catalog or custom resource” in the Alpha placement path.
  Custom GLB registration is Alpha+; the Alpha wording should refer to a
  catalog resource or Parametric Placeholder and leave custom assets to Epic
  9.
- The legacy/retired stories are intentionally retained for identifier
  traceability, but the roadmap needs a single current-status legend so they
  cannot inflate active-story counts.

### Best-practice assessment

| Check | Result |
| --- | --- |
| User value in every Epic | Pass |
| Normal Epic dependency direction | Pass, with named foundation gates |
| Independently testable story acceptance criteria | Blocked by the three documentation conflicts above, not by missing Epic ownership |
| Active FR traceability | Pass after replacing stale coverage arithmetic |
| Story sizing | Generally appropriate vertical slices; no technical-only Epic found |

The documented defects are correctable locally and should be reconciled before
using the roadmap as the final Alpha completion ledger.

## Summary and Recommendations

**Assessor:** Codex, with Product Owner confirmation of the current source set
on 2026-08-29.

### Overall Readiness Status

**NEEDS WORK.** The active Alpha scope is coherent and has complete Epic
ownership, but the evidence register still lacks the independent and
control-plane gates required by its separate formal readiness process. The
Product Owner has accepted NFR-15 device-functional evidence on two physical
phones; the 2026-08-05 waiver does not convert the remaining formal gates into
PASS or authorize an Alpha release claim.

### Critical issues requiring immediate action

1. Assign owners and collect the still-unstarted G-1, G-S1, G-S2, G-V01-S3,
   G-S4, G-S6 and G-CP-ADR evidence. NFR-15 is already accepted by the
   Product Owner on the two stated physical devices.

### Local reconciliation completed during this assessment

- Replaced the obsolete `51/51 active` roadmap claim with 40 active Alpha,
  five Alpha+ and nine retired FR identifiers.
- Selected the implemented rectangular-room route and aligned the two current
  UX sources to it; its candidate remains a wall-loop, not a second geometry
  truth.
- Removed the retired Focus/native-fullscreen UX route while retaining FR-53
  and AD-15 as retired identifiers.
- Bound Story 3.2 to the existing accessible Room directory, removed retired
  finish/custom-GLB examples from Alpha story paths, and made the historical
  written waiver explicit without weakening final `G-READY` release semantics.
- Reconciled the roadmap ledger: all 35 active Alpha stories are now `done`.
  The Product Owner superseded the eight-context device matrix with completed
  functional browser/PWA acceptance on iPhone 15 Pro Max and Samsung S24
  Ultra, which closes Story 4.4.

### Recommended next steps

1. Re-run lint, type checks, the full regression suite and PWA regression after
   the completed implementation fixes; keep their artifacts as engineering
   evidence only.
2. Preserve the two-device Product Owner acceptance and run the existing local
   automated regression whenever a later change touches browser/mobile/PWA
   behavior; expanded device diagnostics remain optional.
3. After the remaining non-story external evidence is collected, conduct a fresh readiness assessment;
   only a favourable result may change the final Alpha-gate status.

### Final note

This assessment found eight actionable issues across four categories:
traceability accounting, UX/source consistency, story/governance consistency,
and uncollected release evidence. Seven documentation/ledger issues were
corrected locally in this workstream; the remaining category requires real
assigned people and physical-device records.

## Current Engineering Validation and Remaining Story Evidence

### Local validation completed 2026-08-29

- Biome lint: 273 files, clean.
- TypeScript: both application and DOM-free domain configurations pass.
- Rstest: 1,672/1,672 tests pass.
- Production build: Rspack compiles successfully.
- Mobile browser regression: 166 passed; one live-catalog scenario intentionally
  skipped because no live control-plane service is part of this local run.
- Production-PWA regression: 9/9 pass, including safe update/reload, offline
  reopen, recovery export and storage-pressure paths.
- A full browser run exposed a test-helper race: its placement auto-confirm
  observer was armed after the preview could already mount. Arming it before
  the action makes the test idempotent; the focused rotation scenario passed
  five consecutive times and the complete browser suite passed afterwards.

### Story ledger after local closure

There are 35 active Alpha stories: **35 done, 0 review**. Epics 1–8 are done.
Story 5.2 has automated pin/admission/cancel/fence/restart coverage and prior
Product Owner phone acceptance. The Product Owner’s 2026-08-29 NFR-15 decision
also accepts the recorded functional browser/PWA verification on iPhone 15 Pro
Max and Samsung S24 Ultra as the Alpha device requirement.

The Product Owner then physically completed the exact Story 8.2 and 8.3
protocols on 2026-08-29. For 8.2, cancel/reopen preserved both disposable
`DEL-…` and `KEEP-…` Projects, while confirm/delete/reopen removed only
`DEL-…`. For 8.3, the user verified the Safari-to-Home-Screen-PWA storage
boundary on iPhone and restored the Safari Project into the PWA using a
Portable Backup.

The Product Owner also completed Story 8.7 on the installed PWA with a
coordinated real V1 → V2 service-worker update on the same origin. The waiting
notice appeared without an automatic reload; restart became unavailable during
a Wall draft, became available after cancelling it, and the explicit restart
reopened `UPDATE-1` at its same Durable Revision. Story 8.7 is therefore done.

Story 4.4 is also done: the Product Owner verified 3D navigation, item
placement, movement and accepted 45° rotation on iPhone 15 Pro Max and Samsung
S24 Ultra, in browser and installed PWA. Detailed RS-2 timing, thermal and
expanded device-matrix work is explicitly deferred as optional diagnostics.
