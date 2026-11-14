---
title: "InteriorsEditor — current-source/reality re-review: D-011…D-013, revision 7"
review_type: current-source-reality
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
artifact_revision: 7
previous_reviews:
  - review-current-source-topology-policy-revision-5-2026-08-05.md
  - review-current-source-topology-policy-revision-6-2026-08-05.md
  - review-topology-policy-adversarial-r6-2026-08-05.md
  - review-topology-policy-adversarial-r5-2026-08-05.md
  - review-topology-data-integrity-r5-2026-08-05.md
status: complete
verdict: ACCEPTABLE_AS_PRECANONICAL_INPUT
readiness: NOT_READY
scope: "read-only revision-7 current-source/reality review focused on the Portable Backup entry path and preservation of prior resolved boundaries; no canonical, application, test, configuration, Spine, memlog, or prototype mutation"
source_mutations: none
---

# Current-source/reality re-review — revision 7

## Verdict

**`ACCEPTABLE_AS_PRECANONICAL_INPUT`; implementation readiness remains
`NOT_READY`.**

Revision 7 cleanly closes adversarial R6 finding `P1-R6-1`.  The current
Project-and-Backup Contract defines `.interiors` as the container extension
and `project/project.json` as the mandatory logical entry.  The draft now
uses exactly that entry as its canonical JSON location and confines the old
`.interiors/project/project.json` spelling to explicit negative-path checks.

This acceptance is only for the non-canonical draft as an input to the owner
workflows.  It does not adopt AD-7, change the Portable Backup contract,
authorize implementation, resolve FR-9's cross-source wording, or advance any
readiness gate.

## Binding source check

The Project-and-Backup Contract §2 makes the logical container structure
mandatory and lists, at archive root, `manifest.json`, `project/project.json`,
resource entries, and `checksums.json`.  It does **not** define a top-level
`.interiors/` directory.  Section 4 applies manifest/path allowlist validation
before Project deserialization, and §7 requires a corrupt path to reject before
publish.  The Architecture Spine separately requires JSON metadata plus
addressed blobs and AD-4 requires staged self-contained Backup import.

Revision 7 is consistent with all of those sources:

| Draft occurrence | Meaning | Assessment |
| --- | --- | --- |
| 82 | Remediation status identifies `project/project.json` as the canonical entry **inside** a `.interiors` bundle. | Correct container-versus-entry distinction. |
| 107 | Proposed AD-7 rule requires canonical Project JSON at `project/project.json` inside the bundle. | Correct. |
| 271 | Proposed Geometry Contract companion repeats the same JSON-boundary rule. | Correct. |
| 326 | Required raw-byte verification fixture uses the mandatory entry inside the bundle. | Correct. |
| 406 | Required source-owner gate preserves the same mandatory entry. | Correct. |

The only two occurrences of `.interiors/project/project.json` are at lines 328
and 407.  Both are exclusively explicit negative-path requirements: the first
requires the verification fixture to prove rejection by the Backup
path/schema boundary, and the second requires the owner gate to retain that
rejection.  Neither names the nested value as a canonical entry, a decoder
target, an exporter path, or an allowed alias.

Read-only count check therefore found **five** canonical
`project/project.json` references (82, 107, 271, 326, 406) and **two** nested
references (328, 407), with no other spelling in the draft.

## Sanity check of inherited R6 closures

The path correction did not regress any resolved R6 boundary:

| Inherited boundary | Revision-7 text checked | Assessment |
| --- | --- | --- |
| Lossless JSON ingress | Raw JSON numeric lexemes are validated before IEEE-number materialization; ordinary `JSON.parse`/reviver coercion is not an acceptance boundary; `SafeIntegerMm` and final `Number.isSafeInteger` remain explicit. | Preserved inside the canonical JSON member. |
| No alternate canonical encoding | A non-JSON internal repository encoding cannot become an alternate canonical format through the delta and needs a separate AD-4/Project-and-Backup owner decision. | Preserved. |
| Relative gesture construction | The 100-mm candidate remains `origin + (100 × k) × d`, while visual grid remains presentation-only and numeric input may remain valid off-grid. | Preserved. |
| Construction-only `SnapPolicy` | No configuration, identity, snapshot, registry, version payload, persistence, migration or later re-normalization is introduced. | Preserved. |
| AD-3 / AD-12 branching | Rejection, `PendingDurability`, post-validation persistence failure and stale-worker discard remain distinct. | Preserved. |
| Complete planar contact handling | The draft still groups every exact candidate/Plan contact, explicitly includes candidate-interior/existing-Vertex including a junction, and partitions every segment whose interior contains a grouped coordinate. | Preserved. |
| Signed diagonal preview | `start + n × d` yields the selected signed `deltaXmm × deltaZmm` (for example `+707 × -707 mm`); shared measurement formatting receives the same exact squared length. | Preserved. |
| Valid-X routing and open scope | The valid exact-X default remains delegated working policy; kernel, tolerance and source-owner FR-9 reconciliation remain open. | Preserved as pre-canonical routing only. |

Read-only probes also reconfirmed that the signed-integer grammar rejects the
raw decimal which ordinary `JSON.parse` would round, the exact nearest-diagonal
predicate holds for every `L = 1…100000`, and the relative off-grid example
`(125,0) + 3 × 100 × NE` ends at `(425,300)`.  The unchanged Spine lint still
returns zero findings; it is not evidence of draft adoption.

## Scope and claim check

No scope regression or unsupported claim was found.  Revision 7 remains
`canonical: false`, `implementation_ready: false`, and `NOT_READY`; it keeps
S-2 `needs-further-evidence`, preserves the open D-022/kernel/tolerance and
Room/Opening/measurement boundaries, makes no device or physical NFR-15
claim, and introduces no portable-format alias, product reason code, root
scaffold, product test/configuration or production authorization.

## Required next gate

All existing gates remain.  The source-owning `bmad-architecture` update must
first record approved decisions through `_bmad/scripts/memlog.py`, re-distill
the Spine, route the JSON lexical/reason mapping through `bmad-spec` and the
Project/Backup owner, reconcile FR-9 through its owners, add the specified
raw-byte and topology corpus evidence, and rerun all three independent review
lenses against the distilled canonical result.  `G-READY` remains `NOT_READY`
until that work and all broader evidence/legal/device gates independently
pass.
