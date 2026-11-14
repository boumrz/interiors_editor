# Placement contact delivery, 2026-10-25

Owned repository changes: PlacementRotationControl.tsx and new placement-multitouch-cancel-e2e.spec.ts only. Root owns the PlanProjection contact boundary. No commits. Native CDP touch in Chromium phone emulation; this is not a physical-phone run.

The contact ID outlives angle cancellation. The parent is notified synchronously before capture and once on actual release/cancel/capture loss/unmount. Secondary pointerdown reaches the parent camera arbiter before the control can prevent propagation. Both release orders preserve original angle and centre; once both contacts end, placement and rotation work again. Ordinary floor-then-ring two-finger translation still pans. No Durable Revision precedes confirmation.

RED: contact-red.log (2 cases, wrong centre) and contact-pinch-red.log (ordinary pinch leaves transform unchanged). Final GREEN: contact-final-green.log, 3 passed in9.6s on separate49384 source copy with root Plan reset guard. contact-green-confirmed.log:2/2 against specific loopback production49382, before the subsequent primary-guard fix. Types/lint: contact-final-types.log/contact-final-lint.log. Hashes in contact-final-summary.json.

Mutation evidence is manual, isolated inverse testing, not a Stryker percentage. Three contact-lifetime changes killed: remove registration, release contact prematurely on second pointer, skip angle cancellation. Historical contact source8749fe8ac455d431e1f48282f9c5d139deccc2030ad328248893877f45409c87; baseline/restored2/2 passed. Full details in contact-inverses-summary.json and individual logs. The new ordinary-pinch RED against the exact pre-fix control also detects inversion of the final primary-pointer guard ordering. No claim of exhaustive mutation coverage.

Independent review: pending creation tracker false success after rejected resize, and cancellable item UI after controller retained a quota-failed candidate, were reproduced here and handed to root/roadmap owner. Evidence pending-creation.* and failed-item-draft.*. Rotation centre jump was fixed by this slice.

GOST boundary review: no new material defect proved in group atomicity, foreign-stroke exclusion, or reference-distinct deduplication. Priority currently depends on kind, with IDs only as ties; no selected-room/edit-context input exists, so no selected-target priority is claimed. This is a documented scope limit, not a new code change or a formal GOST conformity claim.
