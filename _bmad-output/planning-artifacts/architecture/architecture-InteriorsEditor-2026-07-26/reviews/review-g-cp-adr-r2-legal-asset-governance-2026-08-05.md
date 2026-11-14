---
title: "InteriorsEditor — independent legal and asset-governance review of G-CP-ADR R2"
review_type: legal-asset-governance-precanonical-control-plane-r2
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../drafts/G-CP-ADR-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 4e6e4248b76d6cc04350be6ff69dbb34232a00a44853cf480267f3b094854f0c
  r1_legal_review_sha256: 8364ba6a53767c49255f157fe779be613474860c70427289a0c01d696e1acb60
  r2_data_boundary_review_sha256: 41c78cb2a01c5142b156510e91feab3dcd6775fbbb6e024ddb2995f58d56baea
  r2_security_review_sha256: 72a86ba0bafe20e25a275a96a72498ef5ac9f33ace5281100af4466c6597c0d0
  r2_operations_review_sha256: c5b8ad11767d27e6f8ffd8d1f134d6671e49ec2fd26c3fce336c8495f94a37ff
  spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  spec_sha256: ce903b5aa4bf3f59efbd08d030dc7c292491315a1280cf1203f3114e517169ed
  project_backup_contract_sha256: 91ecfb9ac4cb7bc21e2e0205442b960713e70a2aaf3384a40645db2fff8d7157
  catalog_contract_sha256: c3b06f9967630fb1e66754463acb97d5dda9a3209ac1cade418f33e770b8a48c
  prd_sha256: 48bd0a416dad0e78ac65d3f616da7ded36500726ff2e0026650d7f93814d47eb
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
review_basis:
  - ../drafts/G-CP-ADR-draft-2026-08-05.md
  - ../drafts/G-CP-ADR-legal-asset-governance-review-2026-08-05.md
  - review-current-source-g-cp-adr-r2-data-boundary-privacy-2026-08-05.md
  - review-g-cp-adr-r2-security-adversarial-2026-08-05.md
  - review-g-cp-adr-r2-operations-recovery-2026-08-05.md
  - ../ARCHITECTURE-SPINE.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../../project-context.md
status: complete
verdict: PASS_FOR_PRECANONICAL_INPUT_ONLY
canonical_adoption: BLOCKED
readiness: NOT_READY
legal_advice: false
scope: "Independent read-only review of the R2 policy input for asset rights, provenance, AssetUsageGrant, raw-delivery scope, notices, publication and withdrawal. No legal conclusion, owner appointment, canonical/memlog/code/test/configuration/evidence mutation."
source_mutations: none
---

# G-CP-ADR R2 — independent legal and asset-governance review

## Verdict

**`PASS_FOR_PRECANONICAL_INPUT_ONLY`.** R2 may remain a noncanonical
policy packet because it does not assert a licence, an `AssetUsageGrant`, a
named approver, a publishable catalog corpus, a provider or public raw-byte
permission that does not yet exist. It preserves default-deny delivery and
keeps all required rights/provenance records as human-controlled gates.

This is **not legal advice**, a rights clearance, an approval of any asset,
an approval of unauthenticated raw-byte delivery, or authority to publish,
upload, transform, distribute or implement a catalog. `G-CP-ADR` remains
`BLOCKED`; `G-READY` remains `NOT_READY`.

## Basis and independent checks

- R2, the R1 legal review, and the current R2 data-boundary, security and
  operations/recovery reviews were read at the hashes in the front matter.
- The canonical sources consistently require human review of every exact
  catalog model/subresource, full `AssetUsageGrant` scope, local exact-byte
  pinning before durability, self-contained private Portable Backup, required
  notices and a no-Project control plane. They do **not** grant public
  distribution of source 3D bytes by implication.
- All review-basis paths resolve. The current Spine lint is `ok: true` with
  `0` findings; this mechanical result has no rights or adoption effect.

## Coverage retained by R2

| Canonical requirement | R2 policy input | Review result |
| --- | --- | --- |
| Every exact model, texture, subresource and derivative runtime byte has human-approved coverage. | Provenance dossier, derivative-resource manifest and `AssetUsageGrant` snapshot bind exact hashes/media and transformations before publication. | **Pass as policy input.** No actual asset corpus is supplied. |
| Distinct runtime, private backup packaging and rendered-output policies stay explicit. | R2 preserves separate `runtimeUsePolicy`, `backupPackagingPolicy` and `renderedOutputPolicy`, with unknown/forbidden preventing publication. | **Pass as policy input.** No policy values or rights have been approved. |
| Exact bytes may enter a user’s self-contained private Portable Backup only with the relevant grant. | The dossier treats private backup rights separately from delivery; local `BackupFeasibilityPolicy` remains decisive and withdrawal does not rewrite local bytes. | **Pass as policy input.** It does not turn backup permission into public distribution. |
| Public raw delivery is not inferred from metadata, a descriptor, a grant ID, cache, private transfer or Portable Backup. | R2 makes raw delivery default-deny and requires a separate immutable per-version delivery scope. | **Pass with a legal-binding blocker below.** |
| Notices survive catalog card, bundle manifest, export UI and, where required, visible PNG output. | R2 creates a versioned notice-placement matrix and makes it part of the release gate. | **Pass as policy input.** Raw-delivery notice handling remains an explicit human decision. |
| Publication is immutable and provenance-bound. | Byte/transformation/notice/grant/delivery/expiry changes require a new publication state; no in-place descriptor/grant mutation. | **Pass as policy input.** Release attestation and evidence corpus are absent. |
| Withdrawal does not silently alter a local Project or Portable Backup. | R2 separates stopping new publication/delivery from local pinned bytes and requires non-destructive handling in the withdrawal register. | **Pass as policy input.** Actual withdrawal, cache and restore process remain unselected. |

R2 therefore carries forward the R1 legal review rather than treating it as an
approval. The R2 data-boundary review correctly requires a mechanically linked
delivery decision; the security review adds safe metadata/delivery/cache
controls; the operations review adds recovery reconciliation after withdrawal.
None supplies a human grant or clears the legal gates in this review.

## Human approval and evidence gaps that remain mandatory

### GCP-R2-LG-01 — No appointment or authority matrix exists

R2 names roles such as Legal approver, Asset steward, Product/export owner and
designated publisher, but names no people or delegation/renewal/withdrawal
authority. Before any canonical adoption or publication, Product must create a
human-controlled appointment and escalation matrix. It must state who may
approve each exact resource version, who can interpret or withdraw a scope,
who verifies transformations/notices and who may publish only after those
records are complete. This review neither appoints nor substitutes for any of
them.

### GCP-R2-LG-02 — There is no per-resource provenance and rights corpus

No actual source/acquisition chain, licence/contract evidence, reviewer,
review date, validity state, model/texture/subresource hash or derivative
manifest exists in the current materials. Before publication, the Asset
steward and Legal approver must provide a reviewable per-version dossier that
binds every source/model/texture/subresource/derived runtime byte to the exact
immutable descriptor. Licence labels, an unsigned manifest, an application
field or automated detection remain insufficient.

### GCP-R2-LG-03 — Delivery permission must be an explicit legal binding for every exact representation

R2 improves R1 by separating a per-version delivery scope from private
backup/transfer rights. However, “explicit human approval” must not become a
free-standing publisher flag. Before adoption, each possible delivery decision
must be bound to the matching immutable `AssetUsageGrant`/rights evidence,
exact catalog version, every exact response representation and subresource,
exposure/channel, validity, expiry and withdrawal state, and named Legal
approval. If no such record exists, if any covered byte differs, or if a
required limitation cannot be enforced by the chosen delivery plane, delivery
must remain metadata-only. This review makes no finding that public delivery is
permitted for any resource.

### GCP-R2-LG-04 — Notice obligations need a deliberate raw-delivery decision

The canonical placement set covers catalog card, bundle manifest, export UI
and, where needed, a visible PNG layer. R2 carries this set into the dossier,
but unauthenticated raw-byte delivery could give a recipient only a model or
texture rather than those product surfaces. Before any such delivery is
enabled, the named Legal approver and Asset steward must decide and record
whether the approved placement set satisfies that exposure; if not, they must
approve a concrete, testable notice mechanism or deny raw delivery for that
version. The public “safe summary” cannot expose unapproved legal evidence or
silently replace a required placement.

### GCP-R2-LG-05 — Transformations and optimization need version-bound rights coverage

R2 correctly requires source → tool/profile → output hash provenance. Before
publication the human record must establish that each declared optimization,
transcode, thumbnail/preview, runtime derivative and any byte offered to the
client is covered by the relevant grant. A source asset’s name, a model-level
approval or a tool configuration alone must not be treated as coverage for
textures or derived outputs. Any new source, tool/profile, output byte or
notice changes the reviewed publication state.

### GCP-R2-LG-06 — Controlled evidence and public metadata have different audiences

R2 properly distinguishes the public safe summary/grant identifier from the
underlying licence, contract and approval evidence, but no controlled evidence
location, access rule, retention/redaction policy or accountable owner has
been selected. Product, Legal, Security and Operations must choose those
controls before adoption. The public metadata schema must expose only fields
the human approvers explicitly approve; it must not disclose an underlying
contract, evidence reference, restricted source path, commercial term or
capability-bearing delivery URL.

### GCP-R2-LG-07 — Expiry, withdrawal and correction have no approved human procedure yet

R2 describes an immutable expiry/withdrawal/correction register and correctly
protects existing local pinned bytes, Durable Projects and Portable Backups.
It does not supply the actual trigger authority, review cadence, decision
record, effective time, treatment of delivery/cache/restore copies or a
resource-specific answer for already delivered private copies. The named Legal
approver, Asset steward, Product and Operations owners must define and evidence
that procedure. It must remain non-destructive to user local data and prevent
restored/cached delivery from re-exposing a withdrawn scope until current human
records have been reconciled.

### GCP-R2-LG-08 — No resource-specific scope supports Alpha placement, backup or rendered export today

The Alpha product gate is stronger than “catalog metadata exists”: before a
CatalogAsset can be `offline-ready/backup-ready` and become Durable, its grant
must cover in-app render/thumbnails, all subresources, optimization,
`.interiors` private packaging/transfer, rendered PNG download/share and each
required notice. R2 leaves these correctly unfilled. The future evidence set
must test both allowed and forbidden/unknown/expired/withdrawn values and
prove that a missing scope prevents publication and local durable placement,
not merely a later public download.

## Required reviewable evidence before a future adoption

The next source-owned ADR package needs, at minimum:

1. a human appointment/approval matrix and a resource-by-resource provenance
   ledger;
2. immutable `AssetUsageGrant` snapshots with all three policy surfaces,
   complete byte/subresource coverage, reviewer/evidence/validity/withdrawal
   records and test fixtures for each state;
3. a legally linked, per-exact-byte delivery decision and enforced
   denial/default for every other byte, cache, redirect, range and error path;
4. a transformation/derivative manifest plus notice-placement matrix tied to
   the same grant snapshot, including a human decision for any raw delivery;
5. a publication/release record that binds the source, descriptor, grant,
   delivery, notice, approval and subsequent correction/withdrawal history;
6. controlled evidence access/redaction/retention decisions and safe public
   metadata fixtures; and
7. the security/data/operations evidence needed to prove those legal decisions
   are actually enforced by ingress, delivery, cache, storage and restore
   paths.

## Conclusion

R2 adequately remains a *policy input* because its omissions are explicit and
fail closed: it does not claim that a delivery right, human approval or catalog
corpus exists. It is not adequate for canonical adoption, catalog publication
or implementation until every human/evidence gap above is resolved and fresh
independent legal, security, data-boundary, operations and architecture reviews
are recorded against the concrete evidence.
