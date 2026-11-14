# Independent reality review — V1-specific BackupFeasibility

Date: 2026-11-04. Scope: `Format-specific BackupFeasibility перед publication` in the architecture-owned portable V1 disposition and AD-30. Read-only review; no canonical artifacts or application files changed.

## Verdict: PASS WITH IMPLEMENTATION AND EVIDENCE PENDING

The proposed trusted composition seam matches the inspected repository: session retention currently calls the PPJ-AST-based `assessBackupFeasibility` for normal publication and history transitions, and `CreateCustomGlbFloorItemUseCase` makes a second direct call. The text covers both, retains the browser default and explicitly forbids the existing optional-resource shortcut in Telegram. It binds feasibility and writer to the repository-created resources rather than a separately supplied store.

The 100-definition whole-Project policy, raw-key count and exact resource verification are explicitly retained; actual V1 envelope bytes or the 4096-byte V1 upper bound avoid misapplying the browser's 2048-byte estimate. Immutable V1 snapshot, independent checksum semantics, session roots and final fenced rechecks are required, so a preliminary asynchronous assessment is not mistaken for atomic publication.

One implementation point to verify in the future: every admissible active undo/redo entry must retain its history route when the scoped policy is selected; validate it across command → undo → redo and failure/race scenarios, rather than accepting a new command which silently invalidates an existing history entry. Corrupt/missing bytes remain governed by explicit recovery rules. The architecture already preserves session-retention roots; this is an evidence obligation, not a finding requiring a new decision.

The port, wiring, worst-case envelope, concurrency checks, application tests and physical evidence were not implemented or run by this review. This is no new readiness verdict.
