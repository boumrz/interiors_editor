# Final adversarial verdict — AD-21 initial materializer

**Review date:** 2026-08-10  
**Scope:** current `AD-21`, `domain-model.md`, and `solution-design.md` only.
This is an architecture-document review. It is not implementation, corpus,
implementation-readiness, release, or BMAD `READY` evidence.

## Verdict: PASS for the bounded AD-21 architecture gate

No P0, P1, or P2 findings remain in the reviewed materializer contract.

The final contract now provides an unambiguous, non-self-referential IWM-D1
boundary: candidate structural hashes are rederived from fixed UTF-8/SHA-256
preimages; `baseRevisionChecksum` explicitly remains under AD-3; and
`start.xMm|start.zMm|end.xMm|end.zMm` is literal. It also fixes one-shot,
fence-bound permit consumption; injected all-or-nothing reservation; immutable
limits snapshot/hash matching; deterministic allocation tuple and terminal
no-reuse; exact digest-guarded inverse; private non-empty/policy outcomes; and
the prohibited serial/public-state boundary.

This pass permits the separately required TCC-A1 corpus and TDD implementation
work for the *bounded initial empty-plan route* only. It does not authorize a
general `AddWallSegment`, contacts/T/X, faces/Room/Opening/host reconciliation,
UI/persistence/publication integration, V1/V2 promotion, or a favorable overall
readiness verdict.
