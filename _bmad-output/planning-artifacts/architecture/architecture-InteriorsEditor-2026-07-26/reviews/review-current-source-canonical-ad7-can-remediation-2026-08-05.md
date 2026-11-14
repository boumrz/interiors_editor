---
title: "InteriorsEditor — fresh AD-7 CAN-remediation lens-1 review"
review_type: current-source-canonical-ad7-remediation
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewed_decision: AD-7
reviewed_memlog: ../.memlog.md
reviewed_snapshot:
  spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  memlog_sha256: 55a83cf0d999797f5e4c6d0802655c6f4e6483db4c7c3a581b3098fdb929622d
review_basis:
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../../project-context.md
  - review-topology-data-integrity-canonical-ad7-2026-08-05.md
  - review-topology-policy-adversarial-canonical-gate-2026-08-05.md
status: complete
verdict: ACCEPT
readiness: NOT_READY
scope: "Fresh independent lens-1 re-review of the current distilled AD-7 and append-only memlog after CAN remediation; accepts or rejects only this Architecture update"
source_mutations: none
---

# Fresh AD-7 CAN-remediation review

## Verdict

**`ACCEPT` — only the current AD-7 Architecture Spine update.** The prior
CAN provenance and enforceability gaps are closed in the reviewed snapshot.
`NOT_READY` remains unchanged.

This is deliberately not an acceptance of the unreconciled PRD/SPEC/UX
wording, a topology-kernel selection, S-2, device readiness, or production
implementation. It does not constitute `G-READY`, authorize a product
bootstrap, or alter a source of truth.

## Read-only evidence

- `uv run .agents/skills/bmad-architecture/scripts/lint_spine.py --workspace
  _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26`
  returned `ok: true`, `total_findings: 0`.
- The hashes in the front matter identify the exact Spine and memlog evaluated.
- A raw-ingress counterexample was checked without changing an artifact:

  ```text
  JSON.parse("9007199254740991.1") -> 9007199254740991
  String(result)                    -> "9007199254740991"
  ```

  This demonstrates why the new ordering is material: validation after normal
  host `Number` coercion cannot recover the rejected raw decimal token.

## Resolution of the prior canonical findings

| Earlier concern | Current, reviewed evidence | Result |
| --- | --- | --- |
| `CAN-ADV-01`: raw lexical ingress could be checked only after coercion | AD-7 lines 181–192 now require a schema-aware decoder to retain every raw JSON numeric token for canonical geometry and validate it **before** IEEE `Number` coercion. `.memlog.md:60` records the seam as a `constraint`, and `:63` fixes both ordering and the bundle locator. | **Resolved.** It is an enforceable architecture boundary, while exact grammar and reason mapping remain with their intended owners. |
| Canonical Project member could be ambiguous | AD-7 lines 185–190 require the mandatory `project/project.json` member inside the `.interiors` bundle. This matches the logical Portable Backup entry at `project-and-backup-contract.md:80–90`, rather than inventing a root `.interiors/` directory. `.memlog.md:63` records the exact locator. | **Resolved.** |
| `CAN-ADV-02`: gesture scalar `k` did not have an integer domain | AD-7 lines 212–224 state `origin + (100 × k) × direction`, where `k` is a **positive integer** and the direction is one of eight cardinal/45-degree unit directions. Valid integer-mm numeric input may remain off-grid, but still follows the same topology and invariant path. `.memlog.md:61` is a `decision` with the same distinction. | **Resolved.** A half-step can no longer masquerade as a 100-mm gesture increment. |
| `CAN-ADV-03`: diagonal views/export could round independently | AD-7 lines 240–245 route Preview, 2D, 3D and export text through one product-owned `MeasurementFormatPolicy` over the same exact squared length; formatted text cannot become Command or Revision input. `.memlog.md:62` records this as a `constraint`. This supplies the seam required by PRD FR-13, while precision and locale remain deferred. | **Resolved.** |
| `CAN-TOPO-01` / `CAN-ADV-04`: contact and lossless-ingress rules existed only as an `event`, so clean re-distillation could lose them | The current append-only tail contains durable `constraint` records: `:58` for lossless integer/ephemeral-wide arithmetic, `:59` for all four contact classes and all-contact partitioning, `:60`/`:63` for raw-token-before-`Number` ingress and backup member, and `:62` for diagonal formatting. The delegated positive-integer decision is `:61`. These now complement, rather than rely on, historical event `:57`. | **Resolved.** The reviewed AD-7 is traceable to decision/constraint records. |
| Exact T/X and junction handling could leave a partial graph | AD-7 lines 226–238 groups endpoint/Vertex, endpoint/interior, candidate-interior/Vertex including junctions, and interior/interior contacts by coordinate; it reuses or creates one shared Vertex and atomically partitions every affected segment at all distinct ordered interior contacts. Invalid candidates reject before Command or Revision mutation. `.memlog.md:59` contains the same complete rule as a `constraint`. | **Resolved as the Architecture seam.** It preserves planar-graph atomicity and does not depend on a geometry library default. |

## Source reality and ownership boundary

The accepted AD-7 wording is intentionally narrower than a source
reconciliation:

- Geometry Contract §1 already makes canonical coordinates integer millimetres,
  requires integer diagonal endpoints and exact squared measurement state; §3
  requires a shared Vertex or deterministic split/rejection for intersections.
- PRD FR-7–FR-9, FR-12 and FR-13 require constrained directions, atomic shared
  topology, rejection without history/autosave, and uniform diagonal display.
- The current Geometry Contract §6 still describes automatic exact-X routing as
  open. The Spine may bind the architecture seam after delegated policy, but it
  cannot silently overwrite that companion.

AD-7 correctly leaves exact lexical grammar, path allowlist and stable
serialization/import reasons to the SPEC Geometry and Project/Backup contracts
(lines 187–190). Its Deferred section (lines 639–654) expressly routes
FR-7–FR-9/FR-19 reconciliation to `bmad-prd`, geometry and Project/Backup
re-derivation to `bmad-spec`, visible candidate/formatting/error behaviour to
`bmad-ux`, and a future raw-byte/topology corpus to the responsible source
owners. That is an explicit deferred route, not a claim that this review has
completed those source changes.

## Retained non-readiness boundary

The following remain outside this verdict: D-022 tolerance/tie/hysteresis and
other topology policy, the source-owned corpus, S-2, `G-1`, `G-CP-ADR`,
AssetUsageGrant/legal work, physical `NFR-15` traces, and the official
implementation-readiness assessment. The Spine itself states these boundaries
at lines 639–683; the final readiness report remains `NOT_READY` and says only
a final official `READY` can open production bootstrap.

Accordingly, this review accepts the canonical AD-7 update only. It grants no
implementation authority and preserves the project-wide `NOT_READY` status.
