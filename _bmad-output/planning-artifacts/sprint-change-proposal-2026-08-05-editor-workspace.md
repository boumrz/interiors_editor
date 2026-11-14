# Sprint Change Proposal — рабочая поверхность редактора

**Date:** 2026-08-05  
**Status:** approved by the Product Owner's standing implementation waiver  
**Decision mode:** Batch; the Product Owner has explicitly requested execution without further confirmation.

## 1. Issue summary

The V-02/V-03 slices prove durable persistence and a WebGL2 projection, but
their card-style shell is not a usable mobile editor. The Product Owner reports
that the page is visually overloaded, the editor does not own the viewport,
wall dimensions need an unnecessary explicit apply action, and the result is
not yet suitable for drawing partitions, placing schematic interior items, or
manipulating the same plan in 3D by touch.

This is both stakeholder feedback and a correction of delivery sequencing. It
does not change the product's intended Alpha outcome: the PRD already requires
touch/numeric plan authoring, one canonical 2D state projected into 3D,
parametric placeholders, and a distraction-free Focus mode.

Supporting evidence:

- The current product review identifies peripheral cards, instructions and a
  large header as interference with authoring.
- The independent V-02/V-03 review found four P1 correctness defects in the
  existing rectangle/durability slice. These must be repaired before its
  geometry becomes the base of interactive authoring.
- The external reference was used only as interaction evidence: Floorplanner
  positions fast plan drawing, moving walls and furnishing next to a real-time
  3D view; this product will not copy its UI or catalogue breadth.

## 2. Impact analysis

### Epic and story impact

| Area | Change |
| --- | --- |
| Epic 1 / Story 1.1 | Remains `review`. Its ProjectBounds, rectangular-topology, revision-integrity and retry-continuity P1 findings become prerequisites for the new editor foundation. |
| Epic 2 / Story 2.2 | Moves to `in-progress` and becomes the first interactive authoring slice: full-viewport Plan workspace, pan/zoom, direct dimension editing, and constrained-wall drawing over the canonical graph. |
| Epic 4 / Story 4.2 | Moves immediately after the 2D foundation: touch orbit/pan/pinch in 3D and selection/properties inside the same editor workspace. |
| Epic 5 / Stories 5.2 and 5.5 | Brought forward after durable asset/resource admission work: a parametric, floor-hosted schematic placeholder must appear in both projections. The current UI must reserve no permanent side panel for it. |
| Epic 4 / Story 4.5 | Its in-app Focus/fullscreen capability remains a separately testable enhancement. The normal editor will nevertheless use the available app viewport from the outset. |

No epic is removed and no completed work is rolled back. The rectangle and
WebGL2 adapter are retained only where their corrected contracts remain useful.

### Artifact and technical impact

The change is compatible with `CAP-2`, `CAP-3`, `CAP-5`, `CAP-6`, `FR-6`–
`FR-12`, `FR-22`–`FR-25`, `FR-32`–`FR-34`, `FR-41`, `NFR-15`, `NFR-17`,
`NFR-18`, `NFR-27`, and `AD-2`, `AD-5`, `AD-7`, `AD-10`, `AD-12`, `AD-13` and
`AD-15`. Therefore the canonical PRD, SPEC and Architecture Spine are not
rewritten by this delivery-order proposal.

The implementation must preserve these boundaries:

- PlanGraph coordinates and dimensions remain integer millimetres; zoom and
  grid are transient presentation state only.
- A wall edit uses the same validation and durable publication path as a
  numeric entry; rejected input leaves the current durable revision intact.
- `Room.heightMm` remains the only editable height source.
- 3D camera/gesture state is disposable UI/renderer state, never Project data.
- A placed item is a host-addressed, backup-feasible Project resource before it
  can be called durable; a non-durable visual mock is not an Alpha item.
- Every critical canvas action retains an accessible numeric/list alternative.

The visible UX changes are intentionally direct: remove explanatory cards and
the explicit “apply dimensions” control; show a compact top status row, a
full-height canvas, and contextual selection properties inside that canvas.

## 3. Options and recommendation

1. **Direct adjustment — selected.** Correct V-02 P1 defects, then evolve the
   existing canonical Project and WebGL2 seams in vertical stories. Effort:
   high; risk: medium-high, controlled with test-first geometry and mobile E2E.
2. **Rollback V-02/V-03 — rejected.** It would remove useful durable and
   renderer seams but not eliminate the underlying topology work. Effort:
   medium; risk: high because it delays the first usable editor.
3. **Reduce the MVP — rejected.** Removing touch 2D/3D authoring contradicts
   the stated product value and the Product Owner's priority.

The recommendation is a moderate course correction: retain the plan and its
contracts, re-order the backlog around the editor workspace, and deliver the
capabilities as independently testable vertical slices.

## 4. Detailed approved changes

### Story 2.2 — old to new delivery emphasis

**Old first visible state:** a form and descriptive card surrounding a static
SVG rectangle, with a separate “Применить размеры” button.

**New first visible state:** an editor workspace occupying the available phone
viewport. A minimal top row contains the project identity, truthful durable
status and essential mode controls. Plan/3D canvas fills the remainder;
tool/mode controls meet the 44×44 target area; the selected wall or item exposes
its direct properties as an anchored, dismissible in-canvas control. A wall
length edit commits by valid Enter/blur without a separate apply step.

**New implementation order:**

1. Add regression tests and repair P1 base-slice defects.
2. Add deterministic 2D viewport state and a full-viewport editor shell.
3. Add direct selected-wall numeric editing and a constrained numeric/touch
   candidate path; no canvas gesture may silently alter a Project.
4. Add an initial canonical partition command only after its topology and room
   reconciliation invariants have tests; then add the real touch drawing path.
5. Add the 3D gesture/properties slice and host-addressed parametric item slice
   in their owning stories.

### UI copy and layout

- Remove persistent onboarding copy, peripheral metrics cards and duplicated
  form labels from the authoring screen.
- Keep only local, action-required errors and concise saving/recovery status;
  these must not rely on colour alone.
- Display measurements and selected-object characteristics within the editor.
- Treat app-level full viewport and native fullscreen as distinct: the former
  is immediate layout work; the latter retains the capability-first Story 4.5
  behaviour and test requirements.

## 5. Handoff and success criteria

**Scope classification:** Moderate — backlog reorganisation with no canonical
contract replacement.

**Implementation owner:** `/root`; no concurrent edits to editor/domain files.
Read-only UX research and independent review may run in parallel.

**Success criteria for this correction:**

1. On an iPhone-13 browser emulation, the editable canvas visibly owns the
   application viewport with safe-area-aware essential controls.
2. A user can pan/zoom the 2D plan, select a wall, change its displayed
   dimension directly, and retain the last valid durable Revision on rejection
   or a simulated save failure.
3. A constrained partition and a schematic floor item are canonical state,
   not SVG/WebGL-only shapes; both become reproducible 2D/3D projections.
4. In 3D, a user can orbit, pan and pinch/zoom the projected plan without
   persisting a camera transform.
5. Rstest, TypeScript, lint, build and Playwright mobile E2E cover each
   delivered user flow; screenshots are captured after each material visual
   milestone and explicitly labelled as browser emulation.

## 6. Checklist and approval record

- [x] Trigger and evidence recorded (1.1–1.3).
- [x] Epic, dependency and priority impact assessed (2.1–2.5).
- [x] PRD/SPEC, Architecture, UX and test impacts assessed (3.1–3.4).
- [x] Direct adjustment selected after options review (4.1–4.4).
- [x] Issue, impacts, proposals, handoff and criteria recorded (5.1–5.5).
- [x] Standing Product Owner approval applies: the user expressly instructed
  the team not to request repeated confirmations and to continue to production.
- [x] Sprint tracker updated for Story 2.2 (6.1–6.5).

Missing evidence gates `G-S2-topology`, `G-S4-touch` and `G-S1-renderer`
remain open. The approval allows implementation in parallel with their closure;
it does not claim Alpha readiness or physical-device certification.
