---
title: "Implementation Readiness Assessment Report — Focus recheck"
date: 2026-08-04
project: InteriorsEditor
workflow: bmad-check-implementation-readiness
status: not-ready
stepsCompleted:
  - document-discovery
  - prd-analysis
  - epic-coverage-validation
  - ux-alignment
  - epic-quality-review
  - final-assessment
source_selection:
  prd: prds/prd-InteriorsEditor-2026-07-26/prd.md
  architecture: architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  epics: epics.md
  ux:
    - ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
    - ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
selection_basis: "AGENTS.md sources of truth; Product Owner standing authorization treated as continuation for a duplicate-free discovery."
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-04  
**Project:** InteriorsEditor

## 1. Document discovery

| Required document | Selected source | Discovery result |
| --- | --- | --- |
| PRD | `prds/prd-InteriorsEditor-2026-07-26/prd.md` | One current whole PRD; its addendum/review rubric are companions, not competing PRDs. |
| Architecture | `architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md` | One current spine; domain model, solution design and reviews are companions. |
| Epics and stories | `epics.md` | One current whole epic/story document. |
| UX | `ux-designs/ux-InteriorsEditor-2026-07-26/{DESIGN,EXPERIENCE}.md` | One current sharded UX package; no competing whole UX document. |

Historical validation/readiness reports are retained as dated evidence, not as
competing sources of truth. The selection follows `AGENTS.md`; the Product
Owner's standing authorization is recorded as continuation because no duplicate
requires a choice.

## 2. PRD analysis

### Functional requirements

The following inventory preserves the requirement-level contract from the
current PRD. Consequences, examples and test protocol remain normative in the
referenced PRD sections rather than being reinterpreted here.

| ID | Extracted requirement |
| --- | --- |
| `FR-1` | Create a locally identified Project with a working name and one empty Level, without account/network after app shell load. |
| `FR-2` | List, open and rename local Projects without changing their ID or duplicating data. |
| `FR-3` | Duplicate a Project as an independent new-ID variant with exact dimensions and asset references. |
| `FR-4` | Move a Project to recoverable Trash, restore it, or permanently delete it only after separate confirmation. |
| `FR-5` | Move every Validated Command through PendingDurability and recover the latest Durable Revision after close, crash or eviction. |
| `FR-6` | Create the first rectangular Room from internal width, depth and height in millimetres. |
| `FR-7` | Draw a Wall by touch only along Alpha-allowed orthogonal or 45-degree directions. |
| `FR-8` | Set exact Vertex coordinates or Wall length in millimetres without float-metre ownership of canonical values. |
| `FR-9` | Move a Vertex, split a Wall, and add a Wall to an existing Vertex with atomic intersection/splitting. |
| `FR-10` | Edit Wall thickness; derive length from vertices and height from adjacent Room ceiling heights. |
| `FR-11` | Remove a Wall or Vertex only when the resulting operation is defined and valid. |
| `FR-12` | Reject zero-length/duplicate/forbidden/self-intersecting geometry and invalid topology transitions without history/autosave side effect. |
| `FR-13` | Show Wall/Room/area/perimeter/two-point measurements under documented rounding rules. |
| `FR-14` | Derive Rooms from closed PlanGraph faces after every topology commit. |
| `FR-15` | Preserve `roomId`, name and finishes where semantic Room identity survives a local boundary edit. |
| `FR-16` | Edit Room name/type/ceiling height while deriving geometric values from PlanGraph. |
| `FR-17` | Add a valid Door to a Wall with width, height, sill/threshold policy and offset. |
| `FR-18` | Add a valid Window to a Wall with width, height, sill height and offset. |
| `FR-19` | Move, resize or delete an Opening through numeric or touch input without invalidating it. |
| `FR-20` | Activate a Door in 3D only to navigate to a valid neighbouring Room. |
| `FR-21` | Switch between Plan and 3D without losing selection, PendingDurability state or camera-independent domain data. |
| `FR-22` | Derive walls/openings/floors/ceilings deterministically from the one Project state. |
| `FR-23` | Orbit/pan/zoom 3D and select a Room surface or ItemInstance with an accessible numeric/property counterpart. |
| `FR-24` | Enter/exit read-only Walk, change direction and cross valid Doors with reset and reduced-motion behaviour. |
| `FR-25` | Adapt pixel ratio, shadows, effects and LOD under performance pressure without changing Project. |
| `FR-26` | Browse representative catalog categories. |
| `FR-27` | Search/filter assets by name/category, AnchorClass or main dimensions. |
| `FR-28` | Place an ItemInstance only on an AnchorClass-compatible surface after required resource pin/backup/license gates. |
| `FR-29` | Transform an ItemInstance by move/rotate and permitted resize, including exact numeric input. |
| `FR-30` | Duplicate, lock/unlock and delete an ItemInstance with undo/redo participation. |
| `FR-31` | Show footprint/clearance collision feedback without claiming building-code compliance or mutating Project. |
| `FR-32` | Create a named parametric box placeholder with dimensions, colour and AnchorClass. |
| `FR-33` | Apply allowed ItemInstance colour/material variants only to recolourable slots. |
| `FR-34` | Apply a SurfaceFinish preset to a selected Room floor. |
| `FR-35` | Apply a SurfaceFinish preset independently to an addressable Wall side. |
| `FR-36` | Apply a SurfaceFinish preset to a selected Room ceiling. |
| `FR-37` | Pin finish runtime bytes before Durable assignment and recover them offline or through an explicit deterministic fallback. |
| `FR-38` | Undo/redo each Durable Command inside the current session-history boundary while retaining both branch resource roots. |
| `FR-39` | Cancel an Active Gesture without history entry or autosave mutation. |
| `FR-40` | Explain an invalid operation, preserve the prior valid state and offer an accessible next action. |
| `FR-41` | Install and launch the PWA in standalone mode on a supporting platform without treating iOS browser/Home Screen storage as shared. |
| `FR-42` | Reopen, edit and save a previously opened Project with locally available assets in airplane mode. |
| `FR-43` | Show storage health/persistence state and handle quota exhaustion without silent data loss or automatic Project deletion. |
| `FR-44` | Export a self-contained, versioned Portable Backup sufficient for offline Project recovery. |
| `FR-45` | Import a compatible Portable Backup with validation, migration and atomic new-Project commit. |
| `FR-46` | Save or system-share a PNG snapshot of the chosen Plan/3D view with compliant notice policy. |
| `FR-47` | Offer application reload only after a Durable Revision and perform recoverable startup compatibility/migration checks. |
| `FR-48` | Alpha+: select one local static `.glb`; reject `.gltf`, OBJ, FBX and archives. |
| `FR-49` | Alpha+: preflight GLB bytes/resources and staged hard budgets before a general-purpose loader. |
| `FR-50` | Alpha+: preview a preflight-passed GLB and confirm dimensions, pivot/orientation, AnchorClass and slots. |
| `FR-51` | Alpha+: reject unsafe/unsupported resource forms and every hard-budget breach without partial persistence. |
| `FR-52` | Alpha+: persist a confirmed ImportedAsset by ID, content hash, validated metadata and local blob reference. |
| `FR-53` | In Plan/3D/Walk, explicitly enter/exit a non-domain phone Focus layout that maximises usable app viewport while preserving Project/editor state and critical rails. |

**Total:** 53 contiguous functional requirements. `FR-1`–`FR-47` and `FR-53`
are Alpha-entry requirements; `FR-48`–`FR-52` are explicitly Alpha+.

### Non-functional requirements

| ID | Extracted requirement |
| --- | --- |
| `NFR-1` | Persist all canonical coordinates/dimensions/offsets as integer millimetres with 0 mm save/reopen/backup semantic drift. |
| `NFR-2` | Convert to renderer metres only at an explicit adapter boundary; renderer never owns domain state. |
| `NFR-3` | A failed Command leaves the prior Durable Revision semantically/byte-equivalent; no candidate is called saved before pointer swap. |
| `NFR-4` | A versioned Project/catalog pair deterministically derives the same topology, RoomGraph and material assignments. |
| `NFR-5` | On every physical `NFR-15` context, gesture main-thread block is ≤50 ms, p95 drag frame time ≤33.3 ms and >50 ms frames ≤5%. |
| `NFR-6` | Reference scene provisional benchmark is 6 Rooms, 60 items, 750k triangles, 250 draws and 128 MiB estimated GPU, to be calibrated by spikes. |
| `NFR-7` | First editable empty Room opens ≤3 s cold-online and ≤1.5 s warm-offline under `NFR-15` protocol. |
| `NFR-8` | A 15-minute edit run has no crash/input/Durable loss or unexpected context loss; forced context loss restores the same Project without reload. |
| `NFR-9` | Scene renders on demand outside animation/gesture. |
| `NFR-10` | Core editing does not depend on Background Sync or an active backend. |
| `NFR-11` | Abrupt termination restores the latest Durable Revision, covered at every staging/pointer boundary by automated and device tests. |
| `NFR-12` | Every schema migration has prior-version fixtures, idempotence policy and rollback/backup boundary. |
| `NFR-13` | Quota/eviction never silently deletes Projects; recovery/read-only/history rules preserve a complete backup envelope. |
| `NFR-14` | WebGL 2 is Alpha baseline; WebGPU is progressive and never changes semantics. |
| `NFR-15` | Certification requires PASS on eight named physical iPhone/Samsung browser/standalone contexts, each with cold/warm, RS-2, thermal and Focus manual trace; Playwright never substitutes them. |
| `NFR-16` | Detect rendering, storage and installability by capability, not user agent alone. |
| `NFR-17` | DOM targets are ≥44×44 CSS px, safe-area-aware and hover-independent. |
| `NFR-18` | DOM controls/forms/dialogs/navigation meet WCAG 2.2 AA with field-linked, assistive-tech-visible validation. |
| `NFR-19` | Every critical 3D/touch action has an accessible numeric/list alternative when canvas is insufficient. |
| `NFR-20` | Reduced motion removes optional camera/transition animation. |
| `NFR-21` | Without explicit consent, Project geometry/screenshots/ImportedAssets are not sent externally. |
| `NFR-22` | Alpha+: untrusted GLB uses deny-network preflight, allowlists and staged limits; Worker is not a hard memory sandbox. |
| `NFR-23` | Opt-in analytics excludes geometry, binaries, filenames and screenshots; opt-out is defined before public alpha. |
| `NFR-24` | `CAP-*`/`FR-*`/`NFR-*`/`AD-*` remain stable; a breaking schema change raises version. |
| `NFR-25` | Diagnostics contain safe app/schema/catalog/capability/error data, not Project content. |
| `NFR-26` | Domain/topology are testable without DOM/GPU; renderer/persistence are exposed through ports/adapters. |
| `NFR-27` | Focus uses capability-first usable viewport/safe-area/VisualViewport/keyboard handling, direct-gesture native enhancement and truthful in-app fallback after rejection, error or UA exit. |

**Total:** 27 contiguous NFRs. `NFR-22` is explicitly `N/A by scope` only for
Alpha entry; all others, including `NFR-27`, remain applicable.

### Additional requirements and constraints

- Phone-first installable PWA is Alpha surface; desktop is not an Alpha
  authoring acceptance surface.
- Canonical geometry is a planar graph in integer millimetres; Room faces and
  3D objects are derived, not second sources of truth.
- Local-first durability, one fenced writer, recoverable Trash, self-contained
  Backup, resource pinning and AssetUsageGrant are product invariants.
- Alpha wall directions are orthogonal/45-degree; one Level only. Custom GLB,
  desktop parity, cloud/accounts, LiDAR/AR, CAD/BIM, AI and photoreal output
  are outside Alpha entry.
- `NFR-15` names exactly eight physical contexts and mandates renewed traces
  for a new OS/browser patch or substituted Current-device model.
- `FR-53`/`NFR-27` make the Focus viewport always safe in-app; native
  fullscreen/standalone is a capability observation, never a browser/system
  chrome guarantee.

### PRD completeness assessment

The PRD is complete enough to identify a finite, traceable Alpha requirement
set: 53 FRs and 27 NFRs, clear Alpha+/Alpha separation, explicit physical
device protocol and Focus contract. It remains a planning input, not evidence
of implementation. Open product/technical decisions in §10 and the missing
spike/device/user-research evidence must be evaluated by later readiness steps.

## 3. Epic FR coverage validation

The epic inventory's `FR Coverage Map` was mechanically compared with all 53
PRD headings. Both sets contain exactly 53 unique IDs; there is no PRD-only or
epic-only FR.

| FR | Epic / explicit story path | Status |
| --- | --- | --- |
| `FR-1` | Epic 1 / Story 1.1 | Covered |
| `FR-2` | Epic 1 / Story 1.2 | Covered |
| `FR-3` | Epic 8 / Story 8.1 | Covered |
| `FR-4` | Epic 8 / Story 8.2 | Covered |
| `FR-5` | Epic 1 / Stories 1.1, 1.4 | Covered |
| `FR-6` | Epic 2 / Story 2.1 | Covered |
| `FR-7` | Epic 2 / Story 2.2 | Covered |
| `FR-8` | Epic 2 / Story 2.2 | Covered |
| `FR-9` | Epic 2 / Stories 2.3, 2.4 | Covered |
| `FR-10` | Epic 2 / Story 2.5 | Covered |
| `FR-11` | Epic 2 / Story 2.6 | Covered |
| `FR-12` | Epic 2 / Stories 2.2–2.6 | Covered |
| `FR-13` | Epic 2 / Story 2.1; Epic 5 / Story 5.4 | Covered |
| `FR-14` | Epic 3 / Story 3.1 | Covered |
| `FR-15` | Epic 3 / Story 3.1 | Covered |
| `FR-16` | Epic 3 / Story 3.2 | Covered |
| `FR-17` | Epic 3 / Story 3.3 | Covered |
| `FR-18` | Epic 3 / Story 3.3 | Covered |
| `FR-19` | Epic 3 / Story 3.4 | Covered |
| `FR-20` | Epic 4 / Story 4.3 | Covered |
| `FR-21` | Epic 4 / Story 4.1 | Covered |
| `FR-22` | Epic 4 / Story 4.1 | Covered |
| `FR-23` | Epic 4 / Story 4.2; Epic 5 / Story 5.4 | Covered |
| `FR-24` | Epic 4 / Story 4.3 | Covered |
| `FR-25` | Epic 4 / Story 4.4 and Gate V-18 | Covered |
| `FR-26` | Epic 5 / Story 5.1 | Covered |
| `FR-27` | Epic 5 / Story 5.1 | Covered |
| `FR-28` | Epic 5 / Stories 5.2, 5.3 | Covered |
| `FR-29` | Epic 5 / Story 5.4 | Covered |
| `FR-30` | Epic 5 / Story 5.4 | Covered |
| `FR-31` | Epic 5 / Story 5.5 | Covered |
| `FR-32` | Epic 5 / Story 5.5 | Covered |
| `FR-33` | Epic 6 / Story 6.1 | Covered |
| `FR-34` | Epic 6 / Story 6.2 | Covered |
| `FR-35` | Epic 6 / Story 6.4 | Covered |
| `FR-36` | Epic 6 / Story 6.3 | Covered |
| `FR-37` | Epic 6 / Story 6.5 | Covered |
| `FR-38` | Epic 1 / Story 1.4; Epic 7 / Story 7.1 | Covered |
| `FR-39` | Epic 1 / Story 1.4; Epic 7 / Story 7.2 | Covered |
| `FR-40` | Epic 1 / Story 1.4; Epic 7 / Story 7.3 | Covered |
| `FR-41` | Epic 8 / Story 8.3 | Covered |
| `FR-42` | Epic 8 / Story 8.4 | Covered |
| `FR-43` | Epic 8 / Stories 8.5, 8.6 | Covered |
| `FR-44` | Epic 8 / Story 8.8 | Covered |
| `FR-45` | Epic 8 / Story 8.9 | Covered |
| `FR-46` | Epic 8 / Story 8.10 | Covered |
| `FR-47` | Epic 8 / Story 8.7 | Covered |
| `FR-48` | Epic 9 / Story 9.1 (Alpha+) | Covered |
| `FR-49` | Epic 9 / Story 9.1 (Alpha+) | Covered |
| `FR-50` | Epic 9 / Story 9.2 (Alpha+) | Covered |
| `FR-51` | Epic 9 / Story 9.1 (Alpha+) | Covered |
| `FR-52` | Epic 9 / Stories 9.2, 9.3 (Alpha+) | Covered |
| `FR-53` | Epic 4 / Story 4.5; Epic 8 / Story 8.11 | Covered |

### Missing FR coverage

None. The current mapping has no orphan FR. `FR-53` is covered by distinct
in-app and PWA/physical-evidence stories rather than being collapsed into an
unverifiable fullscreen claim.

### Coverage statistics

- Total PRD FRs: 53
- FRs covered in epics: 53
- Coverage: 100%
- Extra epic-only FRs: 0

Coverage confirms planning traceability only. Every future user-facing BDD
inherits named Playwright evidence, while real-device, research, asset and
spike gates remain independent from the story map.

## 4. UX alignment assessment

### UX package completeness

The selected sharded UX package is present and internally coherent. `DESIGN.md`
defines `AppShell`, `FocusModeControl`, `StatusBanner`, the retained action
rails, touch target/elevation rules and the explicit non-goals. `EXPERIENCE.md`
defines the user journey (`UXF-7`), six observable Focus states, error and
recovery behaviour, accessibility order, responsive/physical-device evidence
boundary, and six future browser E2E flows. It is sufficiently concrete to
derive acceptance tests without inventing product behaviour.

### PRD ↔ UX alignment

| Contract | UX evidence | Assessment |
| --- | --- | --- |
| `FR-53`: Plan/3D/Walk phone Focus must preserve editor state and critical rails | `EXPERIENCE.md` §5.5 and `UXF-7`; `DESIGN.md` `AppShell` / `FocusModeControl` | Aligned: Focus is a temporary AppShell layout, not a fourth editor mode or a Project mutation. Project, selection, draft, active gesture, mode/tool, history position, durability/writer/recovery state and panel draft/scroll are explicitly preserved. |
| `NFR-27`: capability-first viewport, safe area, keyboard and truthful native fallback | `EXPERIENCE.md` §12 and §15; `DESIGN.md` §§Responsive, Focus, FocusModeControl | Aligned: usable in-app Focus is immediate; native fullscreen is attempted only from the same direct action after a capability probe. Rejection, `fullscreenerror` and external `fullscreenchange` retain in-app Focus without a destructive dialog or implied control over browser/system UI. |
| `NFR-15`, `NFR-17`–`NFR-20`: device evidence, touch size and accessible alternatives | `EXPERIENCE.md` §§11–12, §15; `DESIGN.md` §§Focus, AppShell, StatusBanner | Aligned: rails remain safe-area-aware and at least 44×44 CSS px; status is textual/non-colour-only; canvas actions retain DOM/list/numeric alternatives; browser simulation is explicitly distinguished from eight physical traces. |
| Durability/recovery contracts (`FR-5`, `FR-39`, `FR-40`, `NFR-3`, `NFR-13`) | `EXPERIENCE.md` §§5.5, 9, 15; `DESIGN.md` §§AppShell, StatusBanner, Dialog | Aligned: `saving`, `saved/durable`, `persist-failed`, offline, read-only and recovery remain discoverable; entering/exiting Focus creates no Command, Revision, history entry or persisted mutation; blocking recovery/confirmation/error stays above Focus. |

### Architecture ↔ UX alignment

The UX conforms to the existing architectural direction: the AppShell is a UI
adapter under `AD-2`; it must not mutate the domain, which agrees with `AD-3`;
its truthful durable/recovery rails agree with `AD-3`/`AD-4`; and controlled
browser plus physical tests have an intended seam under `AD-12`. The spine also
already places platform work behind `adapters/platform` and requires capability
detection rather than user-agent branching.

There is, however, a traceability gap introduced after the spine was dated
2026-07-26: it has no explicit `FR-53`/`NFR-27` binding, no named Focus
AppShell/platform boundary, and no stated ownership of the Fullscreen API,
`VisualViewport`, safe-area values or native-event reconciliation. This is not
a contradiction and must not be repaired by inventing a new `AD-*` in UX or
epics. A `bmad-architecture` update must either bind the existing `AD-2`/
`AD-12` plus platform adapter to this contract, or introduce a justified stable
decision, before a final `READY` verdict.

### UX findings

1. **MAJOR — architecture handoff outstanding.** The UX and stories define
   the behaviour, but the authoritative architecture spine predates it. The
   implementation seam for capability probing, native request/event handling,
   `VisualViewport`/safe-inset updates and the non-domain Focus state needs an
   architecture-owned trace before implementation can be authorized.
2. **GATE — evidence remains future work, not a UX defect.** The UX correctly
   requires six controlled Playwright flows and eight `NFR-15` physical traces.
   Existing emulation or a prototype cannot turn that requirement into device
   compatibility evidence. This gate remains open for the final readiness
   assessment.

**UX alignment result:** aligned with the PRD and non-contradictory with the
existing spine, but not sufficient for `READY` until the architecture
traceability handoff and all independent gates are resolved.

## 5. Epic quality review

### Review method and positive findings

The current backlog contains 46 `Story` headings. A mechanical structure check
found a persona statement and an `Acceptance Criteria` section for every one.
The nine epics are framed as user outcomes rather than as database, API or
infrastructure milestones: the intentionally technical work is separated into
named evidence/release gates. The delivery table makes most dependencies
explicit, and the Focus decomposition is especially strong: Story 4.5 holds
the in-app behaviour and six controlled browser flows, while physical evidence
is explicitly not inferred from simulation.

| Epic | User-value / sequencing assessment | Result |
| --- | --- | --- |
| 1 — local trusted Project | Clear first-user value and durable/recovery semantics; however its first AC assumes an already available shell. | Needs bootstrap remediation below. |
| 2 — exact first room | Coherent vertical progression from rectangle to constrained-wall edits; S-2/S-4 evidence is an explicit prerequisite, not a hidden future story. | Sound after gates. |
| 3 — rooms/openings | Builds only on approved topology and carries deterministic identity/opening rules into testable BDD. | Sound after gates. |
| 4 — 3D and Focus | User-centred 3D value; Story 4.5 is ordered after Plan/3D/Walk and has concrete E2E names. | Sound after architecture handoff and gates. |
| 5 — placement | Catalog-to-placement progression and host-address semantics are coherent. | Sound after gates. |
| 6 — finishes | User value and resource safety are clear, but the offline boundary needs a small sequencing clarification. | Minor issue below. |
| 7 — history hardening | The resource-history outcome is valuable, but two stories repeat already-delivered generic behaviour without a resource-specific delta. | Major issue below. |
| 8 — ownership/PWA/portability | Valuable late-alpha outcome and mostly explicit ordering; two stories need scope/evidence corrections. | Major issues below. |
| 9 — custom GLB (Alpha+) | Correctly isolated from Alpha entry with security/evidence preconditions. | Sound as Alpha+. |

### Findings

1. **CRITICAL — no implementable greenfield bootstrap path.** The architecture
   and epic inventory say that the starter, supported Node LTS patch, package
   manager/lockfile and browser build target must be fixed before scaffold, but
   there is no bootstrap Story/slice with acceptance evidence. `G-READY`
   merely permits bootstrap, while Story 1.1 begins with “an available app
   shell.” This creates an unscheduled prerequisite to the very first story
   and omits early typecheck/lint/Playwright harness/CI policy validation.
   **Remediation:** after the architecture chooses the toolchain envelope,
   `bmad-create-epics-and-stories` must add a small, user-facing first-launch
   bootstrap slice (or explicitly make it implementation work and acceptance
   criteria inside Story 1.1) with reproducible local checks. It must not be
   a standalone technical epic.

2. **MAJOR — the promised Playwright coverage is not yet traceable per normal
   story.** The inheritance clause correctly requires a green Playwright E2E
   and a test ID for every user-facing BDD, but only Focus has named IDs
   (`FOCUS-E2E-01`–`07`). The other 44 stories have no named test-ID-to-AC
   mapping in the backlog. This does not invalidate the policy; it prevents a
   reviewer from proving the Product Owner's “all scenarios” requirement has
   been planned without reinterpreting the prose during implementation.
   **Remediation:** add a compact test matrix or named E2E identifiers to each
   story/AC before its implementation entry; retain domain/property/fault tests
   alongside E2E rather than falsely treating Playwright as a replacement for
   them.

3. **MAJOR — Story 7.2 and Story 7.3 duplicate the already foundational
   contract.** Story 1.4 already delivers cancel, durable/rejected boundaries
   and accessible error/retry; Epic 7 says it starts only after resource-heavy
   V-09–V-12, yet Stories 7.2/7.3 still specify generic gesture cancel and
   generic rejection explanation with no unique resource/history boundary.
   Their completion scope is therefore ambiguous and not independently new
   user value. **Remediation:** fold them into the relevant early stories, or
   re-scope them to a named post-resource case (for example pinned-byte
   cancellation, history-root retention, recovery-state reason paths) with
   distinct acceptance evidence.

4. **MAJOR — Story 8.11 is a release/device evidence gate disguised as a
   story.** It depends on V-15 and V-08-Focus and then requires eight manual
   device rows, 20 cold + 20 warm starts, RS-2, context recovery and a
   15-minute thermal run. Those are release-scale obligations already repeated
   by V-18, so the story cannot be independently completed as a normal
   user-value slice and duplicates gate ownership. **Remediation:** retain a
   bounded browser/standalone Focus capability story, and move the physical
   matrix/performance/claim-boundary criteria under the non-story
   `V-15-Focus`/V-18 evidence gates with one accountable owner/reviewer path.

5. **MAJOR — Story 8.4’s explicit physical row omits Android Chrome tab.**
   Its first AC promises browser *and* standalone offline open, but its device
   AC names iOS Safari/Home Screen and Android Chrome standalone only. The
   formal `NFR-15` matrix also requires Galaxy A53 and Galaxy S26 Chrome
   browser-tab rows. **Remediation:** reference all applicable formal matrix
   rows (or explicitly delegate them to a named gate) and preserve separate
   browser-tab versus installed-PWA evidence.

6. **MINOR — Story 6.5 needs an offline-boundary clarification.** It promises
   offline reopen before the full PWA/offline delivery slice V-15. It may be
   valid through the earlier S-3 shell/cache substrate, but the story does not
   state that prerequisite. **Remediation:** name the available shell/cache
   contract or move the full offline-reopen assertion to the V-15 evidence
   path, while keeping finish-resource fallback in Story 6.5.

7. **MAJOR — a Focus E2E fixture asks for an impossible state combination.**
   `FOCUS-E2E-01` requires every named status, including `read-only`, together
   with a writer lease. Story 1.3 defines the read-only second context as one
   that cannot publish and does not own that lease. The scenario cannot be
   truthfully parameterised. **Remediation:** make writer state conditional:
   assert a retained lease for editable states and a visible read-only/no-writer
   state for read-only/recovery contexts, while preserving all non-domain Focus
   state in both branches.

8. **MAJOR — Story 7.1 has a forward dependency on V-16.** Epic 7 declares
   entry after V-09–V-12, but Story 7.1 traces V-16 and requires history-only
   corruption handling. Story 8.6/V-16 later delegates that same flow back to
   Story 7.1. **Remediation:** either add V-16 as an explicit entry gate for
   the history-only corruption portion, or split that portion into a V-16
   follow-up so Epic 7 can be independently completed at its stated point.

9. **MAJOR — V-17 has contradictory prerequisite declarations.** The delivery
   table requires V-14 plus `G-V01-S3` for V-15–V-17, while the accountable
   ownership table lists V-17 with only `G-READY + G-S6-catalog`. A reviewer
   could start backup/PNG before Trash/recovery and storage prerequisites.
   **Remediation:** reconcile the registry with the delivery relation and use
   one normative prerequisite source.

10. **MAJOR — `G-1` is a dangling release condition in the backlog.** V-20's
    ownership row requires `G-1` and participant evidence, but `G-1` is absent
    from the epic gate registry and ownership register. Experimental work
    packages mention it as pending, which does not make it a formal Alpha
    delivery gate. **Remediation:** define it in the backlog with
    criteria/owner/reviewer, or replace it with the intended named gate
    consistently across the backlog.

11. **MINOR — V-08's dependency on V-07 is implicit.** Walk Mode consumes a
    valid Door and RoomGraph, yet its delivery-row shorthand does not name
    V-07. **Remediation:** state the V-07 prerequisite directly rather than
    relying on an ambiguous “V-02/V-04 sequence.”

12. **MAJOR — 3D acceptance is ordered inconsistently with the epic plan.**
    Stories 3.2/3.3 require visible synchronised 2D/3D projection, while the
    ModeSwitcher/projection capability belongs to Story 4.1/V-03. Epic order
    puts those room/opening stories first, whereas the delivery table places
    V-03 before V-06/V-07 without making the cross-epic prerequisite explicit.
    **Remediation:** either name V-03 as the prerequisite for the affected 3D
    assertions, or keep Stories 3.2/3.3 2D/domain-only and move their first
    user-visible 3D assertions to the later 3D integration slice.

13. **MAJOR — Door `passable/locked` semantics have no owning source or
    lifecycle.** Story 4.3 relies on an explicit passable/locked Door state,
    but the preceding opening stories establish only geometry and RoomGraph.
    This is a product behaviour that cannot safely be invented in an Epic.
    **Remediation:** have the product/UX/SPEC owners decide whether Alpha doors
    are always passable when valid or define the state, user control and
    persistence rules; then refresh architecture and epics from that source.

14. **MINOR — several stories are likely too broad for one vertical slice.**
    Stories 1.4, 5.4 and 7.1 each combine multiple durable behaviours and
    cross-cutting resource/history rules. There is no estimate proving they
    fit one owner. **Remediation:** split them during the epic repair wherever
    an independently demonstrable user outcome can be kept intact.

### Dependency and sizing result

No circular epic dependency or purely technical epic was found. The explicit
S-1/S-2/S-3/S-4/S-6 gates are correctly outside user stories. The missing
bootstrap path, invalid Focus fixture, duplicated post-resource stories,
forward V-16 dependency, 3D-order ambiguity, unowned Door semantics,
contradictory/dangling gates and release-sized Story 8.11 are nevertheless
material violations of the required independent, sized vertical-slice
structure.

**Epic-quality result:** `NEEDS WORK`. The source epics must be revised by
their `bmad-create-epics-and-stories` owner before the final readiness verdict
can be `READY`.

## 6. Summary and recommendations

**Assessor:** Codex, `bmad-check-implementation-readiness` workflow  
**Completed:** 2026-08-04

### Overall readiness status

**NOT READY**

Production bootstrap and every `V-*` implementation slice remain closed. This
is not a scope or Product Owner approval problem: the active waiver explicitly
permits only isolated S-1/S-2/S-3/S-4/S-6 evidence experiments and cannot
satisfy `G-READY`.

The PRD/UX/FR mapping is strong (53/53 FR coverage) and the Focus contract is
now precise, capability-first and test-oriented. The package nevertheless has
one critical bootstrap gap, eleven major traceability/dependency/test-spec
issues and three minor sequencing/sizing clarifications. Its architecture spine also predates
the accepted Focus requirement, and no required spike/device/research gate has
an accepted `PASS` terminal status.

### Critical issues requiring immediate action

1. **Create an implementable first-launch/bootstrap path.** Resolve the
   architecture-owned toolchain envelope and add a bounded bootstrap slice with
   repeatable typecheck/lint/test/Playwright/CI acceptance; Story 1.1 currently
   assumes the shell it needs.
2. **Update architecture for Focus.** The authoritative spine must own the
   non-domain AppShell/platform seam for capability probing, direct native
   request, native-event reconciliation, `VisualViewport` and safe areas.
3. **Repair epic/story integrity before scheduling delivery.** Resolve the
   invalid read-only/writer-lease Focus fixture; story-level Playwright test-ID
   mapping; duplicated Story 7.2/7.3 scope; V-16 and 3D-order dependencies;
   unowned Door passable/locked semantics; V-17 and V-08 prerequisite
   conflicts; dangling `G-1`; and the release-sized Story 8.11/device-matrix
   defects.
4. **Do not convert experimental evidence into product evidence.** S-2 is
   awaiting independent resolution with a `PAUSED` recommendation; S-3 is
   `needs-further-evidence`/recommended `PAUSED`; S-4 is still `IN_EVIDENCE`;
   no accepted terminal evidence report was found for S-1 or S-6. The physical
   eight-context NFR-15 matrix and independent G-1/user research remain open.

### Recommended next steps

1. Run a fresh `bmad-architecture` workflow to add the Focus/platform boundary
   and settle the toolchain/scaffold envelope without inventing an `AD-*` in a
   downstream document.
2. Run a fresh `bmad-create-epics-and-stories` workflow to apply every finding
   in §5: add the bounded bootstrap path, normalize prerequisites/gates, split
   release evidence from Stories, and establish a durable per-story E2E-ID/AC
   matrix. Preserve the distinction between Playwright and domain/property/
   physical-device evidence.
3. Complete the running S-4 full mutation baseline, record the result and have
   its independent reviewer evaluate it. Do not promote it while its explicit
   participant/device/G-1 conditions remain open.
4. Resolve the bounded S-2 and S-3 reviewer findings; then plan the still
   missing S-1/S-6 evidence under the active waiver. Human AssetUsageGrant,
   real devices and participant research require the named human/physical
   evidence—they cannot be simulated or silently assigned to an AI.
5. After the source artifacts and terminal evidence are updated, run a new
   official implementation-readiness assessment. Only a final `READY` opens
   production code, root manifests, tests, build configuration or PWA work.

### Final note

This assessment found **15 actionable issues across architecture, bootstrap,
epic quality, dependency integrity and test traceability**, plus independent
evidence gates that remain open. The desired phone Focus experience is fully
specified as an honest in-app layout; it is not yet an implemented feature and
must not be represented as native fullscreen support for any device/browser.
