---
title: "Implementation Readiness Assessment Report"
date: "2026-08-05"
project: "InteriorsEditor"
workflow: "bmad-check-implementation-readiness"
assessment_mode: "fresh official recheck"
standing_confirmation_override:
  authority: "Пользовательское письменное разрешение в текущем диалоге: «Я полностью всё подтверждаю, не спрашивай меня каждый раз, просто делай, что должен»; также делегирование решений: «Реши сам кого назначить, мне нужно, чтобы решения были приняты для продолжения работы»."
  application: "Заменяет только интерактивные подтверждения C/меню данного workflow; не ослабляет критерии READY и не разрешает изменения production-кода, конфигурации или канонических источников."
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
assessment_verdict: "NOT READY"
canonical_source_policy: "AGENTS.md governs ownership: SPEC with declared companions; current PRD workspace; current Architecture Spine with companions and memlog; current UX DESIGN/EXPERIENCE; epics/roadmap; project-context. Historical reports, POC and spike evidence are inventory/evidence only, never duplicate canonical source-of-truth."
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-05
**Project:** InteriorsEditor

## 1. Document Discovery

### Canonical document selection

The selection below follows `AGENTS.md`, not modification time. The standing written
user authorization recorded in the frontmatter supplies the workflow's `C` confirmation
for this report only.

| Required area | Selected canonical artifact package | Structure | Discovery disposition |
| --- | --- | --- | --- |
| Product specification | `_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md` plus the companions declared by its frontmatter | sharded package | Canonical by AGENTS.md; companion membership will be validated in the next applicable analysis step. |
| PRD | `_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md` with current reconciliations in the same workspace | sharded package | Canonical PRD workspace; no competing whole PRD found. |
| Architecture | `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md` with its current companions and `.memlog.md` | sharded package | Canonical Architecture Spine workspace; reviews/drafts are supporting evidence, not a second architecture source. |
| Epics and roadmap | `_bmad-output/planning-artifacts/epics.md` and `_bmad-output/planning-artifacts/roadmap-to-alpha.md` | whole documents | Canonical planning surface; no sharded duplicate found. |
| UX | `_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md` and `EXPERIENCE.md`, with current reconciliations/reviews in that workspace | sharded package | Canonical UX pair; no competing whole UX document found. |
| Project rules | `_bmad-output/project-context.md` | whole document | Found through configured persistent facts and retained as mandatory context. |

### Required-document inventory

**PRD documents found**

- Sharded workspace: `prds/prd-InteriorsEditor-2026-07-26/` — `prd.md`, `addendum.md`, current reconciliation/review artifacts.

**Architecture documents found**

- Sharded workspace: `architecture/architecture-InteriorsEditor-2026-07-26/` — `ARCHITECTURE-SPINE.md`, `domain-model.md`, `solution-design.md`, `G-CP-ADR-INTAKE.md`, a topology-reconciliation draft, and review artifacts.

**Epics and stories documents found**

- Whole document: `epics.md`.
- Related whole planning document: `roadmap-to-alpha.md`.
- No sharded epics/stories `index.md` package found.

**UX documents found**

- Sharded workspace: `ux-designs/ux-InteriorsEditor-2026-07-26/` — `DESIGN.md`, `EXPERIENCE.md`, and current reconciliation/review artifacts.

**Additional required source discovered under AGENTS.md**

- Sharded specification package: `specs/spec-interiors-editor-alpha/` — `SPEC.md`, `asset-import-contract.md`, `catalog-control-plane-contract.md`, `geometry-contract.md`, `glossary.md`, `performance-budgets.md`, and `project-and-backup-contract.md`.

### Duplicate and historical-artifact disposition

- No whole-versus-sharded duplicate was found for PRD, Architecture, Epics, or UX.
- Historical `implementation-readiness-*` reports, POC handoff material, waiver/change-proposal files, architecture review files, and `evidence/spikes/*` are present. They are inventory/evidence only and are deliberately excluded as canonical owners unless a later step needs them to test a specific claim.
- The current report is a new dated assessment, not a replacement for historical reports.

### Step-01 continuation record

The workflow ordinarily pauses here for `C`. Per the written standing authorization
recorded in frontmatter, `C` is treated as supplied after the inventory and
source-selection policy above. No unresolved canonical-document duplicate remains.

## 2. PRD Analysis

### Functional Requirements

The PRD workspace was read in full: `prd.md`, `addendum.md`, all four
reconciliation records, and all four review records. The following is the complete
set of current PRD requirement statements, with binding consequences retained where
they qualify the behavior.

- **FR-1 — Create Project:** the user can create a Project with a working title and one empty Level; it has stable ID, `schemaVersion`, timestamps and an initial valid state, without an account/network after app-shell load.
- **FR-2 — List, Open and Rename:** the user can list local Projects, open and rename one; empty/loading/corrupted/populated states are distinct and rename neither changes ID nor duplicates data.
- **FR-3 — Duplicate Variant:** the user can make an independent Project copy with a new ID, preserving all dimensions and asset references; future copy edits do not change the source.
- **FR-4 — Delete With Recovery Boundary:** the user can move a Project to local Trash, restore it, or permanently delete it after a separate confirmation; Trash is never auto-cleared and failure leaves no partly deleted metadata/assets.
- **FR-5 — Autosave and Recovery:** every Validated Command progresses through `PendingDurability` and the last Durable Revision recovers after close/crash/eviction; an Active Gesture cannot replace the last valid snapshot and `saved` is shown only after atomic pointer swap.
- **FR-6 — Rectangular Room Starter:** the user can create the first rectangular Room from internal width/depth/height in millimetres; invalid values reject before commit and the resulting closed PlanGraph yields exactly one Room whose usable interior exactly matches the entered dimensions.
- **FR-7 — Draw Constrained Wall:** the user can draw a Wall by touch only in orthogonal or 45° Alpha directions; preview exposes direction/length, a 100-mm candidate is relative to active start rather than a global grid, and an out-of-set delta rejects rather than silently rounding.
- **FR-8 — Exact Numeric Wall Input:** the user can enter an exact Vertex coordinate or desired Wall length in millimetres; it either forms a valid constrained segment or explains the conflict, never converts canonical size through float metres, accepts valid off-grid integer-mm endpoints/deltas, and discloses the quantised 45° result with user-chosen quadrant.
- **FR-9 — Move and Split Topology:** the user can move a Vertex, split a Wall, and add a Wall to an existing Vertex; exact valid T and X contacts atomically create a shared Vertex and, for X, exactly four non-zero WallSegments, while non-integral/out-of-bounds/overlapping/self-intersecting invalid contacts reject wholly.
- **FR-10 — Edit Wall Properties:** the user can change Wall thickness; length comes from Vertex and height from neighbouring Room ceilings, thickness is millimetre-validated, Opening is revalidated before commit, and shared-wall extrusion/opening height obeys neighbouring Room bounds.
- **FR-11 — Remove Geometry:** the user can remove a Wall or Vertex only when the resulting operation is defined and valid; large Room disappearance/merge is previewed and orphaned Opening is handled atomically.
- **FR-12 — Geometry Validation:** the system rejects zero-length/duplicate/forbidden-direction/self-intersecting and invalid-topology geometry; error identifies object/rule/remedy, and rejection changes neither history/autosave/saved status nor durable 2D/3D geometry.
- **FR-13 — Measurements:** the user sees Wall centerline length, Room interior dimensions/area/perimeter and exact distance between selected points/item bounds in documented millimetre/square-metre rounding; display formatting is common across preview/2D/3D/export and never changes canonical input.
- **FR-14 — Derive Closed Rooms:** the system derives Room from closed PlanGraph faces after every topology commit; open contours and non-positive-area rooms are not Rooms.
- **FR-15 — Preserve Room Identity:** after local boundary change the system preserves `roomId`, name and finishes for the same semantic Room where possible; matching has documented fixtures and ambiguous split/merge receives a predictable metadata policy rather than silent distribution.
- **FR-16 — Edit Room Parameters:** the user can set Room name/type/ceiling height, while geometry/area derive from PlanGraph; no independent width/depth promise applies to non-rectangular rooms and Room height is the sole editable ceiling source.
- **FR-17 — Add Door:** the user can add a Door to a Wall with width, height, sill/threshold policy and offset; it fits valid Wall interval, does not overlap another Opening, attaches to Room/Exterior or exactly two derived Rooms, and a valid inter-room Door derives one `Walk edge`.
- **FR-18 — Add Window:** the user can add a Window with width, height, sill height and offset; it derives no walk edge/transition and has identical 2D/3D parameters.
- **FR-19 — Edit and Remove Opening:** the user can touch/numerically move, resize and delete an Opening; until explicit post-Wall-edit policy is approved, UI previews conflict and blocks a commit when it no longer fits rather than silently changing offset/host.
- **FR-20 — Navigate Through Door:** in 3D the user can activate a valid inter-room Door to enter the adjacent Room; valid two-Room topology always derives a passable edge, while exterior/invalid/non-two-Room Door does not transition and access/key/lock/open-close behavior is out of Alpha.
- **FR-21 — Switch View:** the user can switch Plan and 3D views without losing selection, `PendingDurability` status, or camera-independent domain data.
- **FR-22 — Deterministic 3D Projection:** the system procedurally builds walls/openings/floors/ceilings from one Project state; reload of the same version produces semantically the same 3D result and renderer objects are not persisted truth.
- **FR-23 — Inspect 3D:** the user can orbit/pan/zoom the scene and select Room surface or ItemInstance; gesture contract separates navigation from transform and selection syncs to accessible numeric/property UI.
- **FR-24 — Walk Mode:** the user can enter a read-only first-person inspection mode, change look direction, transition through a valid inter-room Door, and return to edit mode; no free physics locomotion is promised, camera resets clearly and reduced-motion removes optional transition animation.
- **FR-25 — Adaptive Quality:** the system changes pixel ratio, shadows, effects and LOD under performance pressure without changing Project or blocking touch editing, exposing a diagnostics quality tier.
- **FR-26 — Browse Catalog Categories:** the user can browse furniture, plumbing, appliances/electronics, lighting and accessories; unavailable control plane differs from cache/pin failure and neither invalidates an existing Project; no branded-SKU availability promise.
- **FR-27 — Search and Filter:** the user can search assets by name/category and filter by AnchorClass or primary dimensions.
- **FR-28 — Place Item:** the user can place ItemInstance only on an AnchorClass-compatible surface; preview distinguishes valid/warning/invalid, wall/ceiling hosts retain surface/local address, and only exact-byte pinned, backup-ready, fully granted catalog resources can become Durable.
- **FR-29 — Transform Item:** the user can move, rotate and, when asset definition permits, resize ItemInstance through numeric position/dimensions/rotation; fixed-size SKU cannot be stretched where metadata forbids it.
- **FR-30 — Item Actions:** the user can duplicate, lock/unlock and delete ItemInstance; an item must be explicitly unlocked before accidental gesture change and every action participates in undo/redo.
- **FR-31 — Collision and Clearance Feedback:** the system shows footprint/clearance intersections with Wall/Opening/ItemInstance as a warning, not a building-code promise, and does not mutate Project automatically.
- **FR-32 — Parametric Placeholder:** the user can make a simple box item with name, width, depth, height, color and AnchorClass; it participates in collision/save/export/3D and is never represented as a catalog/commercial SKU.
- **FR-33 — Apply Item Color or Variant:** the user can apply permitted color/material variant to marked recolorable ItemInstance slots; forbidden slots remain unchanged and the variant persists as a domain reference, not a renderer object.
- **FR-34 — Apply Floor Finish:** the user can apply one preset SurfaceFinish to a chosen Room floor.
- **FR-35 — Apply Wall Finish:** the user can independently apply preset SurfaceFinish to an available Wall side; shared Wall may have different Room sides and its address persists as WallSegment + adjacent Room/Exterior through reverse/split.
- **FR-36 — Apply Ceiling Finish:** the user can apply preset SurfaceFinish to a selected Room ceiling.
- **FR-37 — Finish Offline Availability:** exact referenced runtime bytes for a used finish pin into the backup envelope before Durable assignment; reopen uses them offline or an explicitly labelled deterministic low-fidelity projection, after grant/notice checks.
- **FR-38 — Undo and Redo:** the user can undo/redo every Durable Command within session history; both branches retain resource hashes as GC roots, `SessionRetentionPolicy` preflights new command, corruption demands exact repair or explicit history discard, and reload/recovery/migration/duplicate/import begin a new visible history boundary.
- **FR-39 — Cancel Active Gesture:** the user can cancel an Active Gesture without history entry or autosave mutation.
- **FR-40 — Explain Invalid Operation:** a rejected command explains violated rule, retains previous valid state and offers an available corrective action.
- **FR-41 — Installable PWA:** on supported platform the user can install/run standalone PWA; browser retains core authoring, no-WebGL2 gets compatibility screen, and iOS browser/Home Screen are separate local contexts explained via Portable Backup help.
- **FR-42 — Offline Reopen and Edit:** after successful app-shell/Project open, the user can airplane-mode reopen, edit local assets and save; when all references are pinned, control-plane outage does not block open/edit/Durable save/local undo-redo/Portable Backup export.
- **FR-43 — Storage Health:** the system shows usage/pressure, requests persistence where possible and handles quota exhaustion without silent loss; it only LRU-cleans redownloadable cache, never auto-deletes Projects, and honestly explains OS/browser eviction risk and backup reminder.
- **FR-44 — Portable Backup Export:** the user can export a versioned self-contained Portable Backup with manifest/schema/integrity, exact referenced resources, provenance/license/notices, and no network for every non-corrupt Durable current-policy Project.
- **FR-45 — Portable Backup Import:** the user can import compatible Portable Backup with validation/migration/atomic commit; failed migration preserves existing Project, successful import always makes a new Project ID, future schema explains itself, and staging validates bytes/paths/counts/checksums.
- **FR-46 — PNG Snapshot:** the user can save/share a PNG of selected Plan/3D view; asset grant must allow rendered distribution and mandatory separate-output notice is composited legibly into PNG.
- **FR-47 — Coordinated App Update:** active editor offers reload only after a Durable Revision, and startup checks shell/worker/Project/catalog compatibility for recoverable migration without reliance on an indefinitely waiting worker.
- **FR-48 — Select Static GLB (Alpha+):** the user can select one local `.glb`; `.gltf`, OBJ, FBX and archives reject.
- **FR-49 — Preflight Resource Policy (Alpha+):** before a general loader, byte-level policy checks GLB/version/chunks/URIs/extensions/resources then nodes/meshes/primitives/geometry/material/texture/decoded-memory/bounds with cancellation/timeout and deny-all resolver.
- **FR-50 — Preview and Classify (Alpha+):** after preflight the user sees isolated preview and confirms dimensions in mm, pivot/orientation, AnchorClass and recolorable slots.
- **FR-51 — Reject Unsafe or Unsupported Asset (Alpha+):** unknown required extension, external URI, animation/skin/morph/camera/light, invalid metadata or any hard-budget breach rejects with value/limit/next step and leaves no persisted blob.
- **FR-52 — Persist Imported Asset (Alpha+):** confirmed ImportedAsset gains internal ID, content hash, validated metadata and local blob reference; same hash reuses binary and last-reference removal frees storage/GPU by policy.
- **FR-53 — Phone Focus mode:** explicit control enters/exits Focus in Plan/3D/Walk, maximising app viewport by hiding noncritical in-app panels while preserving Project/selection/view/mode/tool/draft/gesture/durability/lease state; exit, tool/mode, undo/redo/cancel and truthful status remain visible/reachable, blockers take priority, and native fullscreen is only direct-action capability-first enhancement with persistent in-app fallback.
- **FR-54 — Catalog Control Plane boundary:** the system may use Catalog Control Plane only for versioned catalog metadata/resources with provenance/grant/notices; it neither creates identity nor receives/stores/syncs/restores Project/Revision/history/Backup, and existing fully pinned Project remains usable during outage.

**Total FRs: 54.** `FR-48`–`FR-52` are explicitly Alpha+; Alpha-entry scope requires `FR-1`–`FR-47`, `FR-53`, and `FR-54`.

### Non-Functional Requirements

- **NFR-1 — Canonical precision:** persisted coordinates/dimensions/offsets are integer millimetres; save/reopen/backup roundtrip has 0-mm semantic drift.
- **NFR-2 — Projection boundary:** renderer uses metres only at explicit adapter conversion; reverse conversion never owns domain state.
- **NFR-3 — Atomic validity:** a failed command leaves Project byte/semantically equivalent to preceding Durable Revision; validated candidate is not saved before persistence pointer swap.
- **NFR-4 — Determinism:** equal versioned Project/catalog versions yield equal topology, `AdjacencyGraph` and material assignment.
- **NFR-5 — Gesture responsiveness:** each physical `NFR-15` context keeps gesture main-thread block ≤50 ms, p95 drag frame time ≤33.3 ms, and frames >50 ms ≤5% of a measurement session.
- **NFR-6 — Reference scene:** provisional benchmark is up to 6 Rooms, 60 ItemInstances, 750k visible triangles, 250 draw calls and 128 MiB estimated GPU resource; final limits need spike confirmation.
- **NFR-7 — Startup:** `NFR-15` protocol requires first editable empty Room ≤3 s cold-online and ≤1.5 s warm-offline.
- **NFR-8 — Thermal stability:** 15-minute `NFR-15` editing has no crash/unexpected WebGL loss/input loss/Durable Revision loss/uncontrolled quality fall; a separately tested forced-context-loss path restores same Project without reload.
- **NFR-9 — Demand rendering:** scene need not render continuously outside animation/gesture.
- **NFR-10 — Offline core:** core edit does not depend on Background Sync/control-plane availability/remote Project saving; fully pinned existing Project remains locally usable and exportable.
- **NFR-11 — Recovery:** abrupt termination at every point restores last Durable Revision; automated/device tests cover each staging/pointer-swap boundary.
- **NFR-12 — Migration:** every schema migration has previous-version fixtures, idempotence policy and rollback/backup boundary.
- **NFR-13 — Storage pressure:** quota error never auto-deletes Project, recovery/backup UX exists, all current-policy Durable revisions fit complete backup, and missing/corrupt referenced resource produces read-only `ResourceRecoveryRequired` until exact repair/atomic recovery; history-only corruption permits only repair or explicit discard.
- **NFR-14 — Rendering baseline:** WebGL 2 is Alpha baseline; WebGPU is a feature-flagged enhancement without semantic change.
- **NFR-15 — Device acceptance matrix:** Alpha performance certification needs PASS in all eight named physical phone contexts: iPhone 13 mini and iPhone 17 each in Safari-tab/Home-Screen PWA; Galaxy A53 and Galaxy S26 each in Chrome-tab/standalone PWA. Each records build/schema/RS versions/device/OS/browser/WebGL/PWA/battery/thermal/network, runs 20 cold-online + 20 warm-offline starts, ≥5 RS-2 sessions and 15-minute thermal run, meets NFR-5/7/8 thresholds, captures Focus/fullscreen rows, and renews trace after relevant device/OS/browser change. Emulation/desktop/2D fallback substitutes for none.
- **NFR-16 — Capability detection:** renderer/storage/installability derive from capability, not only user agent.
- **NFR-17 — Touch floor:** interactive DOM targets are ≥44×44 CSS px, safe-area aware and hover-independent.
- **NFR-18 — Accessible controls:** controls/forms/dialogs/navigation meet WCAG 2.2 AA; validation binds to fields and is announced to assistive technology.
- **NFR-19 — Numeric alternative:** every critical 3D/touch action has accessible numeric/list alternative where canvas is insufficient.
- **NFR-20 — Motion:** reduced-motion disables optional camera/transition animation.
- **NFR-21 — Local privacy:** without explicit consent, Project geometry/screenshots/ImportedAssets do not leave device; Catalog Control Plane has no personal Project identity/storage/sync/recovery role.
- **NFR-22 — Import isolation (Alpha+):** untrusted GLB gets byte-level deny-network preflight, allowlist/staged limits, non-HTML metadata treatment, and Worker is not claimed as hard sandbox.
- **NFR-23 — Telemetry minimization:** optional analytics excludes plan geometry, asset binary, filenames and screenshots, with opt-out defined before public alpha.
- **NFR-24 — Stable contracts:** `CAP-*`, `FR-*`, `NFR-*`, `AD-*` never reuse and breaking schema change increments version.
- **NFR-25 — Diagnostics:** alpha feedback provides app/schema/catalog versions, capability tier and non-sensitive error code, not the user Project.
- **NFR-26 — Testability:** domain/topology test without DOM/GPU; renderer/persistence are ports/adapters.
- **NFR-27 — Capability-first Focus viewport:** Focus survives visual viewport/keyboard/orientation with safe-area fallback; critical exit/tool/undo/redo/cancel/status remain non-colour visible and reachable; direct-action native fullscreen probes/changes/errors/rejection/user-agent exit preserve truthful in-app Focus; required Playwright mobile E2E simulations never substitute the eight physical manual rows.

**Total NFRs: 27.** For Alpha entry, `NFR-22` is explicitly `N/A by scope`; `NFR-1`–`NFR-21` and `NFR-23`–`NFR-27` are applicable.

### Additional Requirements and Constraints

- Alpha is phone-first, local-first, single-Level, touch/numeric authored and WebGL2-baselined; desktop authoring parity, account/sync/collaboration, BIM/CAD, AR, professional visualization and Door access control are explicit non-goals.
- The planned stack and root layout are constraints, not evidence of installed implementation: React/TypeScript/Rspack/Rstest/CSS Modules web and Kotlin/PostgreSQL only for narrow catalog/provenance control plane, with no unapproved framework/transport/hosting expansion.
- The Alpha-entry gate depends on a geometry/grid policy, licensed catalog pipeline, renderer/topology/offline/import/touch spikes, physical device lab matrix, project schema/fixtures, privacy decision, and Git/worktree workflow.
- The current unresolved **D-022** bundle remains a phase blocker: geometry kernel/library; concrete screen-space tolerance, eligibility/ties, relative-step/hysteresis; deterministic Room split/merge reconciliation; Opening behavior after Wall resize/delete; measurement precision/locale. It cannot be supplied by a library default.
- The still-open product decisions include self-contained `.interiors` bundle/limits/backup reminder, catalog licensing/provenance ownership, UI language/geography/metric policy, analytics/privacy, desktop posture, Alpha+ import priority/limits, sharing and business model.

### PRD Completeness Assessment

The PRD is complete as a product-requirement inventory: it has a contiguous
`FR-1`–`FR-54` and `NFR-1`–`NFR-27` set, clear Alpha-entry versus Alpha+
scope, explicit device acceptance and explicit Focus semantics. It is **not
implementation-ready by itself** because D-022 intentionally leaves several
policy-dependent acceptance fixtures unresolved; later steps must test whether
SPEC, Architecture, UX, Epics and evidence resolve those dependencies without
contradiction.

## 3. Epic Coverage Validation

`epics.md` was read completely. Its declared map contains all `FR-1`–`FR-54`
and assigns an owning Epic (with shared completion paths where appropriate).
The matrix below distinguishes an ID merely being named from its current PRD
behavior actually being carried to an implementable story.

| FR | PRD requirement (short label) | Epic coverage | Status |
| --- | --- | --- | --- |
| FR-1 | Create Project | Epic 1 / Story 1.1 | Covered |
| FR-2 | List, open, rename | Epic 1 / Story 1.2 | Covered |
| FR-3 | Duplicate variant | Epic 8 / Story 8.1 | Covered |
| FR-4 | Trash / restore / permanent delete | Epic 8 / Story 8.2 | Covered |
| FR-5 | Durable autosave and recovery | Epic 1 / Stories 1.1, 1.4 | Covered |
| FR-6 | Rectangular starter | Epic 2 / Story 2.1 | Covered |
| FR-7 | Constrained touch Wall | Epic 2 / Story 2.2 | **Partial — legacy inventory permits silent snap; active-origin 100-mm candidate and no-silent-rounding policy are not explicit.** |
| FR-8 | Exact numeric Wall input | Epic 2 / Story 2.2 | **Partial — integer endpoints/quantised diagonal appear, but valid off-grid numeric acceptance is not explicit.** |
| FR-9 | Move/split topology | Epic 2 / Stories 2.3–2.4 | **Partial / contradictory — current Story 2.4 permits a policy to reject T/X as `AMBIGUOUS_INTERSECTION`, while current PRD requires otherwise-valid exact X to form shared Vertex/four segments.** |
| FR-10 | Wall properties | Epic 2 / Story 2.5 | Covered |
| FR-11 | Remove geometry | Epic 2 / Story 2.6 | Covered |
| FR-12 | Geometry validation | Epic 2 / Stories 2.2–2.6 | Covered |
| FR-13 | Measurements | Epic 2 / Story 2.1; Epic 5 / Story 5.4 | **Partial — measurement target/rounding trace exists, but one product formatting policy across preview/2D/3D/export remains unassigned and D-022 measurement precision/locale is open.** |
| FR-14 | Derive closed Rooms | Epic 3 / Story 3.1 | Covered |
| FR-15 | Preserve Room identity | Epic 3 / Story 3.1 | Covered, gated by unresolved S-2/D-022 matching policy |
| FR-16 | Room parameters | Epic 3 / Story 3.2 | Covered |
| FR-17 | Add Door | Epic 3 / Story 3.3 | Covered |
| FR-18 | Add Window | Epic 3 / Story 3.3 | Covered |
| FR-19 | Edit/remove Opening | Epic 3 / Story 3.4 | Covered, gated by unresolved opening-relocation policy |
| FR-20 | Navigate through Door | Epic 4 / Story 4.3 | Covered |
| FR-21 | Switch Plan/3D | Epic 4 / Story 4.1 | Covered |
| FR-22 | Deterministic 3D projection | Epic 4 / Story 4.1 | Covered |
| FR-23 | Inspect 3D | Epic 4 / Stories 4.2, 5.4 | Covered |
| FR-24 | Walk Mode | Epic 4 / Story 4.3 | Covered |
| FR-25 | Adaptive quality | Epic 4 / Story 4.4 | Covered |
| FR-26 | Browse catalog | Epic 5 / Story 5.1 | Covered |
| FR-27 | Search/filter | Epic 5 / Story 5.1 | Covered |
| FR-28 | Place Item | Epic 5 / Stories 5.2–5.3 | Covered |
| FR-29 | Transform Item | Epic 5 / Story 5.4 | Covered |
| FR-30 | Item actions | Epic 5 / Story 5.4 | Covered |
| FR-31 | Collision/clearance | Epic 5 / Story 5.5 | Covered |
| FR-32 | Parametric Placeholder | Epic 5 / Story 5.5 | Covered |
| FR-33 | Item color/variant | Epic 6 / Story 6.1 | Covered |
| FR-34 | Floor finish | Epic 6 / Story 6.2 | Covered |
| FR-35 | Wall-side finish | Epic 6 / Story 6.4 | Covered |
| FR-36 | Ceiling finish | Epic 6 / Story 6.3 | Covered |
| FR-37 | Finish offline availability | Epic 6 / Story 6.5 | Covered |
| FR-38 | Undo/redo | Epic 1 / Story 1.4; Epic 7 / Story 7.1 | Covered |
| FR-39 | Cancel gesture | Epic 1 / Story 1.4; Epic 7 / Story 7.2 | Covered |
| FR-40 | Explain invalid operation | Epic 1 / Story 1.4; Epic 7 / Story 7.3 | Covered |
| FR-41 | Installable PWA | Epic 8 / Story 8.3 | Covered |
| FR-42 | Offline reopen/edit | Epic 8 / Story 8.4 | Covered |
| FR-43 | Storage health | Epic 8 / Stories 8.5–8.6 | Covered |
| FR-44 | Portable Backup export | Epic 8 / Story 8.8 | Covered |
| FR-45 | Portable Backup import | Epic 8 / Story 8.9 | Covered |
| FR-46 | PNG snapshot | Epic 8 / Story 8.10 | Covered |
| FR-47 | Coordinated update | Epic 8 / Story 8.7 | Covered |
| FR-48 | Select static GLB (Alpha+) | Epic 9 / Story 9.1 | Covered, Alpha+ |
| FR-49 | GLB preflight (Alpha+) | Epic 9 / Story 9.1 | Covered, Alpha+ |
| FR-50 | GLB preview/classification (Alpha+) | Epic 9 / Story 9.2 | Covered, Alpha+ |
| FR-51 | Reject unsafe GLB (Alpha+) | Epic 9 / Story 9.1 | Covered, Alpha+ |
| FR-52 | Persist imported asset (Alpha+) | Epic 9 / Stories 9.2–9.3 | Covered, Alpha+ |
| FR-53 | Phone Focus | Epic 4 / Story 4.5; Epic 8 / Story 8.11 | Covered |
| FR-54 | Catalog Control Plane boundary | Epic 5 / Story 5.6; Epic 8 outage continuity | Covered |

### Missing or Semantically Incomplete FR Coverage

No PRD FR identifier is absent from the epic map, and no extra `FR-*` identifier
exists in the map without a current PRD counterpart. However, the following are
blocking semantic gaps, not cosmetic wording differences:

1. **FR-7 / FR-8 — geometry interaction policy.** Epic inventory says an
   invalid direction may be snapped, whereas the current PRD forbids silently
   rounding a confirmed delta. Story 2.2 also does not explicitly carry the
   active-origin 100-mm candidate or valid off-grid integer-mm numeric route.
   Owner: Epics/stories reconciliation after canonical geometry/S-2 policy.
2. **FR-9 — exact X behavior.** Story 2.4 still lets an approved policy reject
   a T/X contact as `AMBIGUOUS_INTERSECTION`. Current PRD says an otherwise
   valid exact X must atomically produce one shared Vertex/four non-zero
   segments. Owner: canonical SPEC/Architecture alignment first, then Epics;
   do not implement either interpretation by library default.
3. **FR-13 — common measurement display policy.** Epics trace measurement
   behavior but does not assign one defined formatting policy across preview,
   2D, 3D and export. The PRD retains precision/locale as part of D-022.
   Owner: product/UX/architecture policy resolution then Epics acceptance
   fixtures.

FR-15 and FR-19 remain properly located in Epic 3 but can only start after the
unresolved Room-reconciliation and Opening-after-Wall-edit policies are
approved. This is a delivery gate, not an absence of an FR owner.

### Coverage Statistics

- Total PRD FRs: **54**
- FR IDs named in epics: **54 / 54 (100%)**
- Fully behavior-aligned traces at this assessment: **50 / 54 (92.6%)**
- Partially/contradictorily carried FRs: **FR-7, FR-8, FR-9, FR-13**
- Missing FR IDs: **0**

## 4. UX Alignment Assessment

### UX Document Status

**Found and read in full.** The canonical UX package is
`ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md` plus `EXPERIENCE.md`.
Its two reconciliation records and the current independent geometry-state and
Focus/accessibility reviews were also read. The architecture comparison used the
current Architecture Spine, its `solution-design.md` and `domain-model.md`, and
the append-only architecture memlog.

### Alignment confirmed

- **Phone-first, local-first core:** UX user journeys, AppShell states,
  install/handoff, offline/recovery and self-contained backup behaviour align
  with PRD FR-1–FR-5, FR-41–FR-47 and AD-3/AD-4/AD-11.
- **Geometry draft and truthful durability:** UX now exposes origin, returned
  candidate, endpoint/delta/quadrant, raw numeric state and the
  `DraftCommand → Rejected | Validated → PendingDurability → Durable` boundary.
  This matches PRD FR-7–FR-13 and AD-3/AD-7 without selecting D-022.
- **Topology-derived Doors:** Walk target exists only for valid Door between
  exactly two resolved Rooms and has no lock/access/open-close semantics,
  consistent with PRD FR-17–FR-20 and AD-6.
- **Focus:** explicit in-app Focus, safe-area/keyboard/visual-viewport
  priority, accessible rails, preserving state, same-gesture optional native
  request and in-app fallback all align with FR-53, NFR-27 and AD-15. The UX
  correctly marks controlled Playwright paths as regression evidence rather
  than native-device evidence.
- **Catalog and recovery:** UX distinguishes non-blocking catalog outage from
  `ResourceRecoveryRequired`, preserves local pinned Project flows, and makes
  grant/pin/backup prerequisites visible, matching FR-26/FR-28/FR-37/FR-42/
  FR-54 and AD-14/AD-17.

### Alignment Issues

1. **Desktop support wording is too strong (medium).** `DESIGN.md` currently
   says desktop is “supported, but not defining,” while the project context and
   PRD make desktop authoring explicitly not an Alpha target and leave desktop
   posture as an open product decision. This can be corrected only by the UX
   owner: describe desktop/tablet as a supporting fallback/review surface, not
   an Alpha authoring support promise.
2. **UX and current PRD/AD-7 are aligned, but the Epic acceptance layer is
   not yet fully reconciled.** In particular, UX requires off-grid numeric
   input/no silent snap/exact X, whereas Story 2.2/2.4 still retain the gaps
   recorded in section 3. This is cross-artifact traceability debt, not a UX
   design defect.
3. **Renderable 3D remains architecturally gated.** UX specifies Plan/3D/Walk
   behavior, and the architecture supports it through ports, but AD-13 is
   still a proposed renderer hypothesis pending comparable renderer evidence
   and a final ADR. UX cannot be executed as product functionality until that
   gate is resolved.
4. **D-022 remains intentionally unresolved.** UX correctly avoids selecting
   tolerance/ties/relative-step/hysteresis, Room reconciliation, Opening
   relocation and measurement precision/locale. This is an implementation
   readiness blocker, not a missing UX document.

### Warnings

- Both canonical UX files are marked `final`, but their architecture substrate
  is still `draft` and explicitly `NOT_READY`; “final UX text” must not be read
  as production authorization.
- The independent UX reviews pass only their narrow documentation lenses. They
  do not constitute a Playwright, physical-device, accessibility, performance
  or release pass.

## 5. Epic Quality Review

### Epic structure and delivery value

| Epic | User-value test | Dependency result | Quality result |
| --- | --- | --- | --- |
| 1 — trusted local Project | A user can create/open/name a durable local Project and safely reverse first change. | Foundational; uses gate S-3, not a future Epic. | Valid user-value Epic; Stories 1.1/1.4 are oversized (see findings). |
| 2 — exact first Room | A user gains a measured, valid first plan. | Depends only on durable substrate and topology/touch gates. | Valid, but geometry story policy is not executable while D-022 remains open. |
| 3 — connected apartment | A user derives Rooms and adds safe Door/Window topology. | Follows Epic 2 and S-2 policy. | Valid; Room/Opening policy gates are explicit. |
| 4 — understandable 3D check | A user inspects the same Project in Plan/3D/Walk/Focus. | Follows plan/topology and renderer/touch gates; no later Epic needed for Room-surface value. | Valid user-value Epic; renderer ADR is still a precondition. |
| 5 — real-size placement | A user browses, pins, places and changes items. | Follows Room/3D work and external evidence/ADR gates. | Valid; Story 5.6 is too broad across frontend/backend contract scope. |
| 6 — finishes/variants | A user compares finishes/variants and retains them offline. | Correctly follows asset/placement semantics. | Valid. |
| 7 — safe experimentation | A user obtains resource-safe undo/cancel/explanations. | Correctly hardens the Epic-1 substrate after resource work. | Valid; not a technical-only Epic. |
| 8 — ownership/offline/portability | A user manages variants, PWA, storage, backup, update. | Correctly follows resource semantics and S-3/S-6 gates. | Valid, but Story 8.11 mixes a user story with release-evidence execution. |
| 9 — safe GLB (Alpha+) | A user can safely add a constrained custom model after Alpha entry. | Explicitly separate Alpha+ route and gate. | Valid, not an Alpha-entry dependency. |

The non-story gates (`G-READY`, spike gates, `G-CP-ADR`, device gates) are
properly represented as gates rather than technical epics. The sequencing
largely avoids an Epic requiring a later Epic: later Epic references are
either explicit prerequisites, scoped handoffs, or non-story evidence gates.

### Quality Findings

#### Critical violations

None found in the epic titles/goals: all nine epics describe a user outcome,
and no pure “setup database/API/infrastructure” Epic is presented as user
value. No circular Epic dependency was found.

#### Major issues

1. **Stories 2.2 and 2.4 cannot be accepted as currently written.** They are
   structurally BDD-formatted but carry the FR-7–FR-9 semantic gaps recorded in
   section 3: silent snap wording, no explicit off-grid numeric acceptance and
   an optional rejection route for otherwise-valid exact X. **Remediation:**
   reconcile the affected Stories only after canonical SPEC/Architecture
   decisions and D-022 policy inputs are established; do not let an
   implementation library choose the behavior.
2. **Story 1.1 is oversized.** It combines frozen toolchain bootstrap,
   root-layout rules, CI command evidence, first Project creation and atomic
   durability/recovery behavior. It is still user-oriented, but cannot be
   reviewed as one independently completable change. **Remediation:** retain
   user-facing first-Project outcome, but split bootstrap/lock/build evidence
   from durable-project flow after `G-READY`, keeping each slice executable and
   screen-testable.
3. **Story 1.4 is oversized.** It combines DraftCommand cancellation, durable
   publication, undo/redo, rejection, persistence failure and
   `SessionRetentionPolicy` resource limits. **Remediation:** split initial
   command/durability/undo behavior from later resource-history hardening,
   preserving the existing Epic-7 sequencing.
4. **Story 5.6 crosses too many deferred boundaries.** It requires UI behavior,
   a remote catalog contract, Kotlin/PostgreSQL perimeter proof, and several
   externally owned security/operations decisions. Its explicit `G-CP-ADR`
   gate prevents premature work, but the story remains too broad to estimate or
   prove as a single vertical slice. **Remediation:** after a bounded adopted
   backend ADR, split the client adapter/visible outage flow from the
   control-plane contract/migration/negative-data-path verification.
5. **Story 8.11 mixes feature value with full physical release evidence.** The
   browser/PWA Focus behavior is a valid user story, while eight physical rows,
   thermal measurements and release claim boundary are release-gate work.
   **Remediation:** keep browser/standalone Focus behavior as a small story and
   move the eight-device protocol entirely under V-18/NFR-15 evidence gates;
   no physical matrix PASS should be part of “story done.”

#### Minor concerns

- Many stories have unusually long acceptance criteria and cross-epic traces.
  This is useful for auditability but obscures the smallest independently
  releasable user outcome. The later story split should retain IDs/trace links
  while moving shared invariants into inherited test clauses.
- The planned starter template is correctly named in Story 1.1, satisfying the
  greenfield starter-template check. However, root CI/cross-build orchestration
  remains deferred under `G-CP-ADR`; this is a readiness blocker, not an excuse
  to create configuration early.
- No database-table-first violation was found: PostgreSQL is confined to the
  later catalog Control Plane boundary and no early Epic invents a Project-data
  backend.

### Quality Conclusion

The backlog has strong user-value organization and unusually explicit gates,
but it is **not story-ready**: the geometry acceptance conflict and four
oversized/mixed stories must be reconciled before production implementation.

## 6. Final Assessment

### Official readiness verdict

## **NOT READY**

The planning package is materially stronger than the prior assessment: the
current PRD, SPEC package, Architecture Spine and canonical UX now agree on
the adopted D-011--D-013 geometry direction (100 mm active origin, explicit
off-grid numeric input, and a valid exact X). It also has full planned
coverage for all 54 functional requirements and 27 non-functional
requirements, a user-value-oriented nine-Epic backbone, and explicit gates
instead of pretending that prototype results are production proof.

Those strengths do not meet the project readiness invariant. `G-READY` is
explicitly `NOT_READY` in project context, the unresolved D-022 policy makes
several core geometry acceptance criteria non-executable, decisive spike and
device evidence has no terminal PASS, and the renderer/control-plane/legal
decisions are not adopted. The standing user authorization recorded above
supplies workflow confirmations only; it cannot convert a `PAUSED`, `closed`,
or planned evidence item into PASS, or authorize product implementation before
the documented readiness gate is satisfied.

### Evidence and gate scorecard

| Required readiness evidence | Observed state | Assessment |
| --- | --- | --- |
| Canonical PRD/SPEC/Architecture/UX coherence | D-011--D-013 reconciled in the primary current packages; D-022 remains open and the decision register/roadmap/traceability still retain stale or incomplete status. | Blocked |
| FR coverage | 54/54 IDs mapped in Epics; FR-7, FR-8, FR-9 and FR-13 have semantic/acceptance gaps. | Partial |
| NFR coverage | 27/27 IDs planned, but NFR-15 physical-device and several performance/release evidence rows are planned rather than executed. | Planned only |
| `G-S1-renderer` and renderer ADR | S-1 is terminal-paused; comparable mobile/bundle evidence is absent and AD-013 is still proposed. | Closed / not PASS |
| `G-S2-topology` | S-2 contains useful corpus/probe evidence, but terminal work-package status is `needs-further-evidence` and D-022 policy is unresolved. | Closed / not PASS |
| `G-S3-durable-state` | Independent review accepted narrow evidence integrity, but terminal status is `PAUSED`; it is not an Alpha durability/recovery PASS. | Closed / not PASS |
| `G-S4-touch` | Playwright scenarios pass narrowly, but evidence remains browser/synthetic; required physical and mutation/release proof is incomplete. | Closed / not PASS |
| `G-S6-catalog` | Terminal-paused with unresolved strict-schema, actual-browser-byte and notice evidence; no human-approved `AssetUsageGrant`. | Closed / not PASS |
| `G-CP-ADR` | Intake is `inputs_pending`; no adopted Kotlin/PostgreSQL control-plane boundary exists. | Closed / not PASS |
| G-1 participant research | No completed participant-study evidence was found. | Missing |
| NFR-15 release-device matrix | No complete trace set for the eight required physical device contexts was found. | Missing |
| Web bootstrap / AD-016 implementation route | AD-016 is adopted, but `WEB-BOOTSTRAP-01` correctly waits for `G-READY`; there is no authorized production runtime yet. | Deferred, not a substitute for gates |

### Blocking conditions, owners, and exit evidence

| Priority | Blocking condition | Accountable owner | Required action and objective exit evidence |
| --- | --- | --- | --- |
| P0 | D-022 leaves tolerance, tie-breaking, relative-step `k`, hysteresis, Room reconciliation, Opening relocation/rejection, and shared measurement precision/locale undefined. | Architecture owner with geometry-domain owner | Adopt one canonical D-022 policy and corpus/expected-results contract; reconcile it into its owning Architecture/SPEC/PRD/UX/epic acceptance surfaces, then obtain a bounded topology gate PASS. |
| P0 | FR-7/FR-8/FR-9/FR-13 are not faithfully executable in Stories 2.2/2.4: silent snap remains possible, off-grid numeric input is not explicit, exact X can be rejected, and formatter ownership is not assigned. | Product/requirements owner with backlog owner | Update the affected stories only after D-022 inputs; trace each scenario to the current canonical rule and provide executable acceptance cases without library-selected policy. |
| P0 | `G-READY`, S-1, S-2, S-3, S-4, S-6, and `G-CP-ADR` have no terminal PASS. Existing spikes are terminal-paused/closed and cannot be reinterpreted as passes. | Readiness/evidence owner | Establish an explicitly scoped evidence disposition for each closed spike, execute only authorized missing work, and record an independently reviewable terminal PASS for every required gate. |
| P0 | No physical NFR-15 matrix or G-1 participant research exists; synthetic browser runs are insufficient for release claims. | QA/mobile evidence owner and research owner | Run the prescribed eight physical-device contexts plus the participant protocol, retain reproducible traces/measurements/consent-safe findings, and assess them against the published thresholds. |
| P0 | Renderer selection is still AD-013 `PROPOSED`; the UX requires 2D/3D/Walk/Focus behavior but no adopted production rendering contract exists. | Architecture owner with rendering owner | Compare admissible renderer candidates against the agreed mobile WebGL 2 baseline and performance budget, then adopt or reject AD-013 with implementation and fallback implications. |
| P0 | The Kotlin/PostgreSQL catalog Control Plane perimeter is only an inputs-pending intake. | Control-plane architect | Adopt `G-CP-ADR` covering authority, contract, persistence, failure modes, auth/security/operations ownership, and negative-path verification before Story 5.6 is decomposed or built. |
| P0 | Alpha catalog rights/provenance are not proven: no human-approved `AssetUsageGrant` covers the complete usage surface. | Catalog/legal owner | Produce approved grant records and resource provenance/notice evidence for the exact Alpha corpus; satisfy all residual S-6 security, byte and notice checks. |
| P1 | Planning drift remains: D-011--D-013 are adopted in current canonical packages but still `Proposed` in the decision register; the roadmap still treats them as open, and traceability does not reflect AD-018/current gate status. | Documentation/decision-register owner with PM | Reconcile the register, roadmap, and traceability matrix to current canonical ownership; preserve history rather than retroactively changing evidence. |
| P1 | Canonical UX says desktop is “supported, but not determining,” while project context says desktop authoring is not an Alpha target. | UX owner with product owner | State the Alpha desktop posture consistently and make viewport/test implications explicit; do not silently widen Alpha scope. |
| P1 | Stories 1.1, 1.4, 5.6 and 8.11 are not independently completable vertical slices. | Backlog owner | Split each at its user-visible seam, retain CAP/FR/NFR/AD trace links, and isolate release-evidence work from feature completion. |

### Required order of resolution

1. Reconcile the authoritative geometry and planning decisions, beginning with
   D-022 and the stale decision/roadmap/traceability entries.
2. Decide the renderer and Control Plane ADRs, the legal/catalog authorization,
   and any explicitly scoped disposition for the terminal-paused evidence
   packages.
3. Repair and split the affected Epic acceptance criteria, including the
   desktop-scope wording, so a future implementation owner has unambiguous
   vertical slices.
4. Produce the missing reproducible gate evidence, participant research, and
   eight-context physical-device evidence under their approved protocols.
5. Re-run this official readiness assessment. Only a full terminal PASS set,
   coherent canonical sources, and the required evidence may move `G-READY` to
   READY; only then may the repository enter implementation under its TDD,
   Playwright, type, lint, and mutation-check disciplines.

### Assessment boundary

This assessment intentionally created only this dated planning-artifact report.
It did not create or modify application code, package manifests, build/test
configuration, production assets, canonical requirements/architecture/UX
sources, installer-owned BMAD files, or a commit. Historical POC and evidence
material was evaluated as evidence rather than promoted to implementation.
