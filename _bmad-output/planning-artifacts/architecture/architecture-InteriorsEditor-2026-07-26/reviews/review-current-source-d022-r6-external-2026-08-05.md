---
title: "Independent current-source review — D-022 R6"
date: 2026-08-05
reviewed_artifact: "d-022-geometry-policy-decision-draft-r6-2026-08-05.md"
reviewed_sha256: "276a7c7224c5b33a2554fbc7b34811a85178e6d9b7a6ae6e65230e61fc3bb6fa"
review_scope: "Current-source ownership, unintended narrowing/conflicts, stable reason/state mapping, product limits, and unowned policy only"
verdict: "REJECT_FOR_PRECANONICAL_INPUT"
independence: "Fresh review against current sources only; no prior R5/R6 review or advisory was read or used."
---

# Verdict

`REJECT_FOR_PRECANONICAL_INPUT`.

R6 is correctly labelled noncanonical, but its closed working rules still introduce
source-owner changes and several direct current-source conflicts. The reconciliation
register identifies many owner groups, but it does not reconcile the affected
contracts before R6 requires their new behavior, identifiers, state meanings, and
fixtures. It is not safe to use as precanonical input until those source-owned
deltas are decided and recorded in their canonical owners.

# Findings

- **A source-owned Project-bound violation is renamed as an R6 diagnostic.** R6
  calls the sole out-of-bounds C4 endpoint `D022_R6_C4_OUT_OF_PROJECT_BOUNDS`
  (R6 §1, §4.4; lines 129 and 700–706). The current geometry contract assigns a
  valid integer value outside Project bounds the stable reason
  `PROJECT_BOUNDS_EXCEEDED` (SPEC companion `geometry-contract.md:321–323`).
  This is not an R6-only UI detail: it changes the stable reason emitted for a
  current source condition, contrary to R6's own non-adoption rule.

- **The RayProbe overflow row has the same ownership contradiction.** R6 says a
  wall count over the current limit is a *source-limit reject*, but emits
  `D022_R6_RAY_ROWS_ABOVE_PROJECT_LIMIT` (R6 lines 127, 196–202, and 235–243).
  `ProjectLimitsPolicy` owns the hard `WallSegment = 300` limit and requires a
  stable reason with actual and allowed values (`project-and-backup-contract.md:12–36,
  64–76`). R6 cannot both defer imported/source validation and introduce the
  code for its result; the ProductLimits and stable-reason owners must specify
  the current code, state, and UI route first.

- **`CandidateUndetermined/NoDraftCommand` conflicts with the adopted UX state
  machine.** R6 makes a selection failure a proposed
  `CandidateUndetermined/NoDraftCommand` result (lines 149–157), while the UX
  contract says unresolved D-022 selection preserves `DraftCommand` and tells
  the user that the candidate is not yet determined (`EXPERIENCE.md:127–128`);
  it also defines the current visible states as `DraftCommand`, `Rejected`,
  `Validated`, `PendingDurability`, and `Durable` (`EXPERIENCE.md:140–148`).
  R6 provides no source-owned mapping between these alternatives, even though
  it requires different durability/history effects and fixtures.

- **An empty C3 generator narrows an already adopted construction-class
  contract.** R6 declares that C3 is empty in Alpha (line 613–615). AD-7 names
  `constrained-direction candidate` as the third class between exact contacts
  and the origin-relative 100-mm candidate (`ARCHITECTURE-SPINE.md:212–224`),
  and UX requires the actual class to be surfaced in that order
  (`EXPERIENCE.md:125–131`). Making that class unreachable is a product and UX
  behavior change, not merely a tolerance/tie implementation detail; it needs
  an explicit PRD/SPEC/UX owner decision.

- **Miter-only rejection directly conflicts with the current usable-polygon
  rule.** R6 rejects a miter beyond its cap and explicitly disallows bevel
  (lines 825–870 and 892–920). The geometry contract currently requires a
  miter capped at the same threshold **followed by a deterministic bevel**
  (`geometry-contract.md:203–217`). R6 acknowledges the delta but still makes
  “no bevel” mandatory fixture evidence (line 1503). This removes a current
  acceptance route and must not be treated as a closed geometry policy before
  the Geometry/PRD/UX owners choose the new outcome and stable diagnostics.

- **Changed-room identity is narrowed from unique automatic preservation to
  manual confirmation or replacement.** R6 permits automatic retention only
  for byte-identical faces; every changed face needs a confirmed
  `RoomSurvivorMapV4` or a wholly new seeded Room (lines 1085–1111). Current
  sources require a geometrically changed but unambiguously corresponding face
  to retain its ID (`geometry-contract.md:219–231`) and say the system preserves
  identity/name/finishes when the same semantic Room can be unambiguously
  matched (`PRD FR-15, lines 339–348`). The proposal changes a user-visible
  preservation promise and split/merge preview policy without a source-owner
  decision.

- **Cross-root host handling removes the current rehost/orphan-preview route.**
  R6 always rejects a different target root and allows only explicit deletion
  (lines 1201–1209). Current AD-8 requires a topology command atomically to
  preserve, rehost, or place an asset in explicit orphan preview
  (`ARCHITECTURE-SPINE.md:252–257`), while the domain model requires a preview
  with a rehost/delete choice for ambiguous rehost, deleted host, or merge
  conflict (`domain-model.md:146–149`). A reject-only draft cannot replace that
  route or its UX state before the named Geometry/Domain/PRD/UX owners adopt a
  policy.

- **`TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED` is an unowned new placement/finish
  restriction.** R6 rejects any WallPlacement or WallFinish on a wall whose two
  physical sides are Exterior (lines 1230–1236). The current discriminated
  address explicitly permits `WallSide(WallSegmentId, AdjacentRoomId|ExteriorSide)`
  (`domain-model.md:163–165`), and FR-35 allows a finish independently on an
  available wall side and delegates reverse/split semantics to the geometry
  contract (`prd.md:550–558`). No current source establishes the R6
  two-exterior prohibition, its product value, or its replacement UX.

- **The closed Door-adjacency union cannot represent an invalid Door's required
  no-edge result.** R6's only `DoorAdjacencyKind` members are `RoomPair`,
  `NoWalkEdgeWindow`, and `NoWalkEdgeExterior` (line 468), but its own Opening
  rule says the no-edge branch also covers an invalid opening (lines 1171–1176).
  Current sources require both exterior **and invalid** Doors to have no Walk
  edge or transition (`ARCHITECTURE-SPINE.md:163–170`; `PRD FR-20, lines
  400–407`). Because `OpeningPayloadV2` is a closed record with this field
  (line 419), no unambiguous typed value currently represents an invalid Door;
  the proposed stable state mapping is incomplete.

- **The R6 opaque-ID wire assumption conflicts with the current ID convention.**
  R6 says an ID is not presumed textual and serializes arbitrary raw token bytes
  in `OpaqueIdV1` (lines 272–278 and 374). The Architecture Spine's adopted
  convention is “opaque branded **string**,” generated through `IdPort`
  (`ARCHITECTURE-SPINE.md:494–500`), reinforced by project context
  (`project-context.md:136–143`). A binary/non-text ID transport, source
  serializer identity, sort order, and migration path are a schema and
  architecture decision, not an R6-local preflight encoding.

- **R6 adds a closed `ChangeWallThickness` command semantics without an owning
  source definition.** It inserts `ChangeWallThickness` into the topology-intent
  enum and declares it a `ThicknessOnly` face transition (lines 454 and 1068–1079).
  FR-10 does require editable wall thickness, but the current geometry command
  vocabulary (`geometry-contract.md:127–141`) and domain command vocabulary
  (`domain-model.md:182–186`) do not define that command, its identity behavior,
  or its Room/host/history effects. R6 therefore creates a stable command/schema
  member before the Domain/Architecture owners have allocated it.

- **The eight-field Room reconciliation schema is invented rather than sourced.**
  R6 requires `CoreType`, `CoreMetadata`, `FloorAssignment`,
  `CeilingAssignment`, `WallSideAssignmentSet`, typed unsets, and all eight
  fields for every seed and reconciliation record (lines 460, 1101–1121, and
  1287–1300). The current Room entity has `id`, `faceFingerprint`, `name`,
  `heightMm`, and `surfaceAssignments` (`domain-model.md:72–81`); `type` is a
  product input in FR-16, but its canonical schema and the other five R6 field
  classes are not defined. This is a Project schema/migration and durable
  history decision, not a lossless representation of an existing source model.

- **The new inline transition bundle improperly reuses the current
  history-resource recovery model.** R6 makes `TransitionBundleV2`, its policy,
  typed content, and material table the single inline HistoryEntry object, then
  says missing/corrupt bundle policy/content is a history-only
  `ResourceRecoveryRequired` issue (lines 1320–1361 and 1401–1418). Current
  HistoryEntry is only `{ label, command, inverse, beforeRevisionId,
  afterRevisionId }` (`domain-model.md:239–259`), and the backup contract limits
  `ResourceIssue` to missing/hash/media/decode/portability problems for resource
  manifests with expected hash/media (`project-and-backup-contract.md:244–250`).
  No source owner has expanded recovery to arbitrary retained policy or command
  bytes, nor assigned a storage envelope for the inline bundle; R6 cannot call
  this existing recovery behavior.

- **The candidate-only no-holes gate adds an unowned alpha acceptance limit.**
  R6 accepts only a single positive outer ring and rejects nested/inner-ring
  candidates (lines 780–823), despite saying existing/imported Projects remain
  readable. The current Room requirement derives bounded Plan faces and rejects
  only open or non-positive-area rooms (`PRD FR-14, lines 330–337`); it does not
  establish a no-holes product rule, and the domain test model explicitly
  includes holes in the golden-plan corpus (`domain-model.md:340–357`). This
  changes which otherwise source-valid user topology can be committed and needs
  an explicit product/geometry decision and migration/editing story.

- **The formatter profile is a product/locale decision currently left open.**
  R6 fixes mm/perimeter to two fraction digits, square metres to three, and an
  ASCII token that localisation may not reformat (lines 990–1024). Current
  sources require one `MeasurementFormatPolicy`, but deliberately leave its
  precision and locale to D-022 (`geometry-contract.md:38–40`; `SPEC.md:391–392`;
  `PRD.md:1039–1046`; `EXPERIENCE.md:619–626`). The draft must not require this
  display profile or its fixture outputs until the Product/SPEC/UX owners adopt
  it.

- **The “no private caps” proof does not close the performance ownership gap.**
  R6 requires complete 2,400-row RayProbe evaluation and up to 90,000 exact
  metric edge pairs (lines 190–194 and 235–243) but supplies no source-owner
  performance decision or evidence that this exact work fits the 50-ms gesture
  and 33.3-ms drag requirements (`PRD NFR-5, lines 813–819`;
  `performance-budgets.md:58–72`). Streaming avoids an arbitrary product cap,
  but it is not proof that the source-valid maximum preserves the required
  phone interaction contract. A Performance/Geometry owner must reconcile the
  algorithmic guarantee, cancellation/progress boundary, and measurement UX
  before this becomes a required policy.

# Required precanonical resolution

Move each accepted behavior into its source owner: stable reasons and canonical
schema into SPEC/Project-and-Backup; FR/NFR and alpha acceptance changes into the
PRD; command, identity, history, and port changes into Architecture/Domain; and
candidate/error/preview/locale behavior into UX. Reissue a frozen draft only
after those decisions have a coherent state and reason-code crosswalk; then a
fresh SHA-bound independent review can assess it.
