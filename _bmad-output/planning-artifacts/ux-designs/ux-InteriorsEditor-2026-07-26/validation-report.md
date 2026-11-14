# Validation Report — InteriorsEditor

- **DESIGN.md:** DESIGN.md
- **EXPERIENCE.md:** EXPERIENCE.md
- **Run at:** 2026-08-30
- **Review lenses:** UX-rubric, mobile/accessibility, Alpha scope/contracts

## Overall verdict

The initial review below is retained as an audit trail. Its blockers and
follow-ups were closed in the source contracts, Experience Spine and
authoritative visual references; the two final independent reruns passed with
**0 Blocker · 0 High · 0 Medium**. `DESIGN.md` and `EXPERIENCE.md` are now
`final`.

At the Product Owner's direction, proof on a running PWA for 360 px, virtual
keyboard, safe areas, contrast matrix and DOM-alternative remains deferred to
implementation QA. This is a deferred verification activity, not permission to
omit the documented interaction and accessibility behaviour.

## Final category verdicts

- Flow coverage — pass
- Token and component contracts — pass
- State and visual-reference coverage — pass
- Inheritance discipline / Alpha scope — pass
- Mobile/accessibility behaviour — specified; live evidence deferred by Product Owner

## Initial findings by severity (closed)

### Blocker (2)

**Alpha scope** — Retired Focus is still a ToolRail command in the
editor-interaction companion.

The current PRD, SPEC and UX draft retire Focus/native fullscreen, but the
companion still authorizes it. The source owner must remove the command and its
states before a developer can implement one consistent editor.

**Alpha scope** — The same companion requires a one-Room finish override.

Alpha explicitly has neutral derived Room surfaces and no floor/wall finish
assignment. Replace the acceptance item with a neutral display-projection
check; retain variants only for ItemInstance.

### High (9)

**Interaction contract** — ToolRail and ActionDock have no declared
equivalence.

Fix: retain ToolRail as the canonical mobile control contract, with ActionDock
specified as its contextual presentation variant. Give each view, tool,
history, opening and catalogue action a visible, disabled or overflow rule.

**Mocks / Alpha scope** — The 3D reference visually implies different Room
floor finishes.

Fix: replace per-Room wood/tile appearance with one neutral floor/wall
projection. Object detail may remain visible; Room surfaces must not imply
durable material data.

**Mocks / local-first** — Offline is shown as a blocking error with Retry.

Fix: render offline as a compact status banner without CTA. Put Retry/Cancel
only in the specific unpinned catalogue download context, and draw persistence
failure separately.

**Recovery / mobile** — No true ResourceRecoveryRequired reference exists.

Fix: add a 360px read-only recovery screen with placeholders, exact repair
paths, atomic recovery choice, diagnostics and confirmed deletion. Add the
healthy-current history-only branch separately.

**Mobile layout** — Safe-area, 360px and keyboard behaviour is asserted but
not shown.

Fix: add smallest-viewport frames with the numeric keyboard open for Create
Room, Wall draft and Catalogue search. Keep field, inline error, confirm and
cancel above the visual viewport.

**Catalog durability** — Card, preview, pin and Durable placement boundaries
are not visually explicit.

Fix: show metadata-ready/loading, offline-ready/backup-ready and
unpinned-download-unavailable. Before ready, placement stays cancelable; after
confirmation the header transitions through Saving to Saved.

**Accessibility** — Current focus-token pair fails dark-surface contrast and
the DOM-only route is incomplete.

Fix: introduce verified light, dark and on-primary focus tokens, then define a
DOM Inspector route for wall/item select, relative numeric entry, collision
review and confirm/cancel through the same command path.

**Placement / openings** — Rotation and Opening authoring have no complete
preview contract.

Fix: make rotation enter PlacementPreview with front marker, footprint,
collision and Confirm/Cancel; add Wall selected → Opening preview with host,
mm fields, rejection and conflict states.

**Downstream handoff** — Flow and token shapes are not machine-extractable.

Fix: restore structured design tokens and component objects; map UJ to UXF and
give every flow numbered steps, protagonist, climax and applicable failure
path, including the deferred Alpha+ GLB route.

### Medium (7)

**State coverage** — Add a Surface × state × copy × actions × Back/focus
matrix for create/import, catalogue, properties, 3D/compatibility, Room
directory and Project menu.

**Exact geometry** — Complete the wall-draft reference with origin,
candidate class, endpoint or delta, Confirm/Cancel and rejection/retry.

**Measurements** — Give revision-bound measurement a labelled entry point,
DOM alternative and stale-result reselect state.

**Item commands** — Surface duplicate and lock/unlock in the item property
sheet or named item overflow, with a visible locked state.

**Backup language** — Rename the storage-pressure CTA to Create backup or
Export backup; never imply a retired duplicate Project.

**Door visual** — Replace or label plan door arcs as a non-persistent visual
convention; they must not suggest open/close, lock or navigation state.

**Accessibility detail** — Specify sheet roles, focus containment and fallback
return; define transition-only live announcements and 200% reflow rules.

### Low (1)

**One-hand evidence** — Add target-size and thumb-zone overlays for fixed
controls at 360px once the above state references are redrawn.

## Reviewer files

- review-rubric.md
- review-mobile-accessibility.md
- review-alpha-scope.md
- review-rubric-rerun.md — final rerun, PASS
- review-alpha-scope-rerun.md — final rerun, PASS

## Closure record

1. Reconciled Focus/fullscreen, Room finishes, ToolRail/ActionDock and
   `AssetInstance` vocabulary in the source-owned contracts.
2. Added complete interaction/state contracts and authoritative visual references
   for editor, catalogue preparation, recovery and failure states.
3. Completed independent rubric and Alpha-scope reruns; the remaining Low copy
   observations were corrected before finalization.
