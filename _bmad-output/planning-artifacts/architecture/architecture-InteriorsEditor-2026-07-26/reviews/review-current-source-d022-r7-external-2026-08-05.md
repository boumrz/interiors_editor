# Independent current-source alignment review — D-022 R7

**Artifact reviewed:** `d-022-geometry-policy-decision-draft-r7-2026-08-05.md`  
**Verified SHA-256:** `026b4bc9e524ecc2cb8895eb7345d00c667f63b88a9490a957042c2bdceca3ac`  
**Review type:** frozen, read-only current-canonical-source alignment review  
**Scope:** the draft and only the canonical inputs named in its frontmatter: SPEC and its companion contracts, PRD, Architecture Spine, domain model, solution design, UX DESIGN/EXPERIENCE, and project context. The listed frozen-source hashes were also rechecked and match the frontmatter. No source artifact was edited.

## Summary

The R7 draft preserves several important current baselines: integer-mm and ephemeral exact arithmetic, no durable policy/BigInt bundle, atomic durability, session-history roots, local pinned resources, and persisted writer fencing. In particular, its §8 is consistent with the existing single-writer/lease direction in `solution-design.md:157-190`.

However, five P1s leave the durable boundary, stable-outcome crosswalk, asset-policy boundary, and canonical-owner register materially misaligned. The draft is a useful input, but it is not yet safe to promote as precanonical input.

| Severity | Count |
| --- | ---: |
| P0 | 0 |
| P1 | 5 |
| P2 | 7 |

## Findings

### P1 — D022-R7-CS-01: `complete ChangeSet` is incorrectly declared durable

R7 §0.2 lists a source `Command`, **complete `ChangeSet`**, and inverse among the only durable data (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:94-109`). Current sources make the complete ChangeSet a validated candidate input to `PendingDurability`; successful staging/checksum/pointer swap produces a Durable Revision and then a HistoryEntry. The current HistoryEntry is specifically `{ label, command, inverse, beforeRevisionId, afterRevisionId }`, not an independently durable ChangeSet record (`geometry-contract.md:143-167`; `domain-model.md:213-256`; `ARCHITECTURE-SPINE.md:99-110`).

Remove the independent durable-ChangeSet claim, or have the canonical owner define its retention/serialization and relation to the existing HistoryEntry before it can cross the durable boundary.

### P1 — D022-R7-OUT-01: pointer-transform failure has no valid `INVALID_DIMENSION` crosswalk

The §1 row maps a nonfinite/non-invertible presentation or pointer transform to `INVALID_DIMENSION` and a rejected gesture (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:126-128`). The canonical meaning of `INVALID_DIMENSION` is malformed, fractional, nonfinite, unsafe, or negative **interactive value**; it does not cover a transform failure (`geometry-contract.md:310-327`). Current UX instead reserves a DraftCommand for unresolved candidate selection until policy yields an unambiguous candidate (`EXPERIENCE.md:125-138`).

Route this condition as an explicitly source-owned transient/selection state, or add a stable reason-code union member with a named owner and corpus. Do not overload `INVALID_DIMENSION`.

### P1 — D022-R7-OUT-02: the outcome crosswalk collapses preview-required Room/host conflicts into rejection

R7’s invariant-failure row lists Room and host failures as `Rejected` (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:131-134`). Yet the current contract requires a preview and explicit outcome for split/merge room ambiguity, and a rehost/delete/orphan preview for host conflicts; neither may silently become a partial commit (`geometry-contract.md:219-231,288-292`; `domain-model.md:146-149,280-296`; `prd.md:339-348,479-495`). R7 itself later describes the required explicit preview (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:363-379,462-472`), so §1 also conflicts with the draft’s own later direction.

Split the crosswalk into source-defined `ConflictPreview/AwaitingUserOutcome` versus a rejected completed candidate. Only the latter may use a final stable failure reason.

### P1 — D022-R7-RES-01: resource admission incorrectly applies `AssetUsageGrant` to every reference

R7 requires `AssetUsageGrant` verification for “each new reference” (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:516-524`). Canonical state distinguishes `CatalogVersion` from `CustomAssetId` (`domain-model.md:112-120`). A human-approved `AssetUsageGrant` is the catalog rule, while custom GLB uses the user’s `assetUsageDeclaration` (`project-and-backup-contract.md:140-165`; `asset-import-contract.md:150-157`).

Make admission discriminated: catalog references require the full AssetUsageGrant; custom references require their prescribed custom declaration plus pinning/backup policy. The current wording otherwise changes the Alpha+ custom-resource contract.

### P1 — D022-R7-OWN-01: key reconciliation rows name layers/ports, not canonical source owners

R7 says every register row must result in a canonical update, source version/hash, and corpus (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:595-612`), but SO-R7-06 uses `domain/application + IdPort` and SO-R7-08 uses `ProjectRepositoryPort + UX` as owners (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:606-609`). Those are implementation concepts, not authoritative artifacts. The project context requires product/architecture decisions to be changed by the owner document (PRD/SPEC/Architecture/UX) (`project-context.md:136-149`), and the Spine explicitly assigns D-022 reconciliation to PRD, SPEC, and UX source workflows (`ARCHITECTURE-SPINE.md:639-653`).

For each row, name the exact canonical artifact(s), stable ID/section, accountable workflow, and required corpus. Without that, the declared reconciliation cannot be executed or verified.

### P2 — D022-R7-CITE-01: §1 points the reason-code rows at the wrong Geometry Contract section

The `INVALID_DIMENSION`, `ZERO_LENGTH`, direction, and bounds rows cite “Geometry Contract §8” (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:124-131`). Section 8 is walls/openings/3D; the stable reason-code meanings are in §11 (`geometry-contract.md:233-260,310-327`).

Correct the source locators: cite §11 for the codes and §4–§6 for selection/normalization behaviour.

### P2 — D022-R7-OWN-02: SO-R7-02 omits the PRD and UX owners of split/merge preview semantics

SO-R7-02 assigns the Room lineage predicate, split/merge preview, and metadata disposition to Geometry Contract + domain model only (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:602-604`). FR-15 makes the preview and no-silent-distribution behaviour a product requirement (`prd.md:339-348`), and UX explicitly lists Room reconciliation preview as an open source-owned decision (`EXPERIENCE.md:617-631`).

Add PRD and UX ownership, including the explicit choice/confirmation state and the user-visible result for each ambiguity class.

### P2 — D022-R7-OWN-03: SO-R7-03 omits the PRD owner of Opening-after-Wall-edit policy

SO-R7-03 names Geometry Contract + domain model + UX (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:603-605`), but FR-19 owns the product constraint: until a policy is selected, the UI previews the conflict and blocks commit rather than silently changing offset/host (`prd.md:383-391`). The Spine also calls out PRD reconciliation of FR-19 (`ARCHITECTURE-SPINE.md:645-650`).

Add PRD/FR-19 to this row and require a single cross-source adopted outcome/corpus.

### P2 — D022-R7-MET-01: metric target identity and stale-result UX are new, unowned policy

R7 introduces `MeasurementTargetSnapshotV1`, derived geometry/placement/footprint digests, edge ordinals, and mandatory reselection after a revision/checksum mismatch (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:253-292`). Current sources require stale worker results to be discarded (`ARCHITECTURE-SPINE.md:296-305`) and require one formatting policy (`prd.md:310-324`), but do not adopt target-address/digest equality or a reselection UX. SO-R7-04 covers only rounding/precision/locale (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:603-606`).

Mark the whole target/staleness contract as a proposal and add a register row with Geometry/PRD/UX ownership and stale-selection evidence.

### P2 — D022-R7-TOPO-01: lineage survivor and exterior-articulation rules lack an explicit source-owner route

R7 normatively selects the retained child ID on an existing split, the created-root allocation, and acceptance of repeated exterior articulation vertices/darts (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:321-361`). Canonical geometry defines atomic partitioning and discarding the unbounded face but does not define those survivor/orbit rules (`geometry-contract.md:169-231`). SO-R7-06’s generic comparator wording does not identify this separate policy nor a canonical artifact owner (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:606-608`).

Make these explicit source-owner proposals, add the exact source destinations, and require split/articulation corpus cases before adoption.

### P2 — D022-R7-HOST-01: HostOrigin and same-root transfer policy have no reconciliation row

R7 introduces the transient `HostOrigin` inventory, a disjoint-coverage rule, and automatic-transfer-only-for-same-root rule (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:449-472`). Current sources require stable host addresses and preview for ambiguous rehost/delete, but do not adopt those provenance classes or same-root criterion (`geometry-contract.md:262-292`; `domain-model.md:131-149`). The register has no host/rehost row; SO-R7-03 is specifically Opening policy.

Add a source-owner row covering asset and surface-assignment host reconciliation, its preview choices, and forward/inverse evidence.

### P2 — D022-R7-REC-01: recovery outcome crosswalk is too coarse for the current `ResourceIssue` contract

R7 maps only missing/corrupt current resources at §1 and otherwise refers to a “current recovery reason and History scope” (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:133-139,530-542`). Current canonical recovery requires a discriminated `ResourceIssue` (`Missing`, `HashMismatch`, `MediaInvalid`, `DecodeInvalid`, `PortabilityMetadataMissing`), a scope (`CurrentProject | SessionHistory | Both`), and stable recovery reasons/exit criteria (`project-and-backup-contract.md:228-321`).

Reference that union and its scope/reason crosswalk directly, including the distinct healthy-current/history-only backup route. This prevents a source implementation from treating all corruption as one generic rejection.

### P2 — D022-R7-PATCH-01: CanonicalPatchApplier policy is proposed but its exact source destination remains indeterminate

R7 correctly refuses to create PatchV3/CB3, but then specifies target-key ordering, equality, and Add/Replace/Remove semantics for a future CanonicalPatchApplier (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:399-445`). Current domain only describes a semantic ChangeSet and its inverse (`domain-model.md:225-237`); it does not adopt a replay grammar. SO-R7-05 names “SPEC Project/Backup + domain/application,” not the exact canonical source/section where the grammar, serializer, and address keys will be owned (`d-022-geometry-policy-decision-draft-r7-2026-08-05.md:604-607`).

Assign this to named SPEC/Architecture artifacts and defer all “must” language until their versioned grammar and corpus are adopted.

## Verdict

**REJECT_FOR_PRECANONICAL_INPUT**

No P0 was found, and the draft is a materially better direction on ephemeral exact arithmetic, writer fencing, pinned-resource roots, and atomic durability. It must nevertheless resolve the five P1s above before being accepted as precanonical input: the current text still creates an unsupported durable ChangeSet boundary, misassigns a stable reason code, replaces required preview states with rejection, conflates catalog and custom resource policy, and lacks executable canonical ownership for key proposals.
