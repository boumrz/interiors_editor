---
title: "InteriorsEditor — adversarial Focus/toolchain gate"
review_type: adversarial
reviewed: 2026-08-04
status: complete
reviewed_artifact: ../ARCHITECTURE-SPINE.md
verdict: concerns
---

# Adversarial review: Focus and bootstrap update

## Verdict

**CONCERNS — two UI-state races remain possible while every AD is obeyed
literally.** They are clear, local fixes to AD-15; no domain or product contract
needs changing.

## Findings

### AF-1 — High: explicit exit races with a still-active native session

`AD-15` says explicit exit restores the panel and best-effort ends an owned
native session, but its state diagram has no `NativeActive → Editor` transition.
One implementer can treat `fullscreenchange` after an explicit exit as a new
native entry and reapply Focus; another can leave a native session active while
showing ordinary panels. Both obey the stated fallback clauses yet diverge.

**Clear fix:** make `focusLayout` and `nativeSubstate` orthogonal; explicit
exit is the only transition that restores ordinary panels, while later actual
fullscreen events update only `nativeSubstate` and cannot re-enter Focus.

### AF-2 — High: keyboard priority is still inferred rather than bound

The rule recalculates the usable viewport before canvas, but it does not
explicitly bind the focused numeric field/confirmation to remain above the
keyboard. A canvas-first implementation could shrink the canvas correctly but
still obscure the active field, violating FR-53/NFR-27/UXF-7.

**Clear fix:** state that a focused DOM field and blocking confirmation have
priority over canvas when viewport/keyboard geometry changes.

## Passed adversarial checks

- In-app Focus is established before optional fullscreen and does not mutate
  Project/history/durability/writer/recovery state.
- Rejection, error and user-agent native exit preserve in-app Focus and do not
  restore hidden panels.
- `FocusPlatformPort` prevents domain/renderer ownership of viewport or native
  fullscreen behavior and provides the requested fakeable test seam.
- AD-16 confines the browser target to bundle syntax/CSS and retains
  capability-first APIs and NFR-15 physical-device evidence; it makes no
  unsupported iPhone/Samsung fullscreen claim.
