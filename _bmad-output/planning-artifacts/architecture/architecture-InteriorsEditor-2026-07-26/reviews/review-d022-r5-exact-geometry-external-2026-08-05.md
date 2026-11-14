---
title: "Independent exact-geometry review — D-022 R5 frozen input"
date: 2026-08-05
review_scope: "Exact math, CanonicalBytesV2, selection, faces/rings, Q2, lineage, metrics, host arithmetic, and required fixtures"
reviewed_artifact: "../d-022-geometry-policy-decision-draft-r5-2026-08-05.md"
reviewed_sha256: "c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c"
review_kind: "independent external exact-geometry review"
verdict: "REJECT_FOR_PRECANONICAL_INPUT"
canonical_adoption: false
implementation_readiness: "not assessed"
---

# Independent exact-geometry review of frozen D-022 R5

## Scope and freeze verification

I calculated SHA-256 over the reviewed file before analysing it. It is exactly
`c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c`.

This is a fresh review of that byte-identical R5 only. I did not consult prior
D-022 reviews, advisories, or an R5 test-plan artifact. I used the current
Geometry Contract and Architecture Spine only to check the stated noncanonical
boundary: the sources still reserve the D-022 choices for source-owner
reconciliation. That boundary is not itself a finding here.

The four displayed §2.4 byte vectors were independently re-hashed; all four
published SHA-256 values match their shown bytes. The primitive tag framing is
therefore not the reason for this verdict.

## Verdict

**REJECT_FOR_PRECANONICAL_INPUT.** R5 has exactness blockers that prevent a
unique byte/digest, diagnostic, or witness for reachable inputs. It must be
corrected and independently re-reviewed before it can be offered for
source-owner reconciliation.

This report neither adopts a canonical source nor grants readiness or
implementation authority.

## Exact blockers

| ID | Exact clauses | Reachable failure | Minimal correction |
| --- | --- | --- | --- |
| `CB2-RAT-001` | §0.2 defines only `ExactRationalMm`; §2.2 type 8 defines `RationalV1 { numerator: SInt, denominator: UInt }`; §§6.2 and 7.3 use it as an exact interval. | `RationalV1` has no positive-denominator, gcd, or zero-form rule. Thus `1/0` is grammar-valid, while `0/2`, `1/2`, and `2/4` can encode the same interval differently. Sorting/partitioning root intervals and the resulting lineage and host digests are not total. | State that `RationalV1` has `denominator > 0`, `gcd(abs(numerator), denominator) = 1`, and zero exactly `0/1`; reject every other form as `CANONICAL_BYTES_INVALID`. Add valid, zero, non-reduced, and zero-denominator vectors before any interval comparison. |
| `CB2-ROOT-002` | §2.2 types 3, 4, 25, and 48 (`policyDigest`, `intentDigest`, `recordKey`, `exteriorOrbitDigest`); §4.3; §5.2 (`footprintDigest`); §7.1–7.2; §2.2’s statement that local forms are not digest roots. | Several values that select, sort, or bind semantic data lack an exact byte source. In particular, no `HostRecordKey` byte projection defines `recordKey`; no exterior-orbit record defines `exteriorOrbitDigest`; and no registered/external versioned form defines the normalized `footprintDigest` or topology `intentDigest`. A 32-byte field can consequently be arbitrary, so an exterior side table, host inventory, metric target, or context cannot be reproduced. | For each digest, either register an acyclic canonical input record and define `Digest(record)`, or name an existing versioned external byte/hash contract and its precise hash rule. Define `recordKey` from a projection that excludes itself, define a canonical exterior-orbit key, and define the normalized footprint/intent byte forms. Require sorting for both `targets` and `inverseSources` arrays and add full vectors for interior/exterior hosts and a footprint. |
| `CB2-PROJECTION-003` | §2.2 type 20 field 5 and type 39 field 4; §2.2 `NewSeed` field rule; §6.4, especially “three projection digests are non-recursive.” | `NewSeed` must carry `TargetSlotV2.postProjectionDigest`, while the only named `RoomFieldProjectionV1` includes the complete set of `TargetSlotV2` values. R5 never says which projection the digest names or excludes the digest-bearing slot from that projection. The asserted non-recursion therefore has no evaluable construction and can become a self-cycle. | Define a separate, closed projection payload that excludes all back-reference digest fields, state exactly which target projection each slot names, and prescribe an acyclic calculation order. Add a seed/field/loss vector that proves the digest graph and rejects a cyclic or wrong target reference. |
| `SEL-RAY-004` | §0.2 limits; §1 row “Full `8 × WallSegment` RayProbe set exceeds cap”; §3.3. | `RAY_PROBE_LIMIT` has no numerical cap. The only nearby caps are for presentation fields and face traversal, neither declared as the RayProbe limit. The same valid Plan can therefore yield a normal probe in one implementation and a `Draft` limit result in another. | Define one exact `maxRayProbeRows` (or an explicit derivation from a named Plan cap), count it before row allocation, and state its equality/over-limit behavior. Add fixtures at the exact limit and one row above it. |
| `FACE-RING-005` | §4.2 steps 2–4 and `NoHolesAlphaV1`. | With three strictly nested closed loops, the innermost negative orbit selects the least-area positive parent. That positive ring is itself nested, but step 3 assigns depth only to parentless positives and contained opposites. `parent depth + 1` is then undefined before the later no-holes gate. There is no stated early terminal branch. | Either reject immediately upon detecting any positive-in-positive containment, before parent/depth work, or build a complete containment forest with depth for every ring class before applying the gate. Add a three-level nesting fixture with deterministic `NESTED_RING`. |
| `Q2-OUTCOME-006` | §1’s claim of one complete precedence registry and Q2 subtype list; §5.1 lines governing Q2 contacts. | `Q2SegmentContactV1` yields only `Disjoint`, `SinglePoint`, or overlap, but no rule maps contacts to the listed subtypes or orders simultaneous failures. A repeated non-adjacent vertex is also a single-point contact, so `Q2_REPEATED_NONADJACENT_VERTEX` and `Q2_NONADJACENT_VERTEX_TOUCH` can both apply. `Q2_INVERSE_ZERO` has no producing operation in §5.1. The named rejection is consequently not unique. | Specify the complete validation order, canonical pair scan order, and subtype precedence; define the exact predicate for each subtype. Define the inverse operation and its zero branch or remove that subtype. Add combined-failure fixtures, not only one fixture per isolated subtype. |
| `LIN-ORD-007` | §2.2 type 12 `boundaryOrdinal`; types 40–42; §2.2 lines 260–267; §4.3; §6.2. | The document bans zero correspondence ordinals but never binds a boundary ordinal to the ordered `FaceKeyV3.boundaryOccurrences` array. Equivalent face boundaries can be labeled `1..n` or arbitrary positive values, changing face/lineage bytes and making “complete expected sorted set” unverifiable. | Require `boundaryOrdinal` to be exactly the one-based contiguous array index after the specified CCW rotation, and require correspondence ordinals to reference that index. Add a renumbered-but-geometrically-identical negative vector and a multi-atom positive vector. |
| `MET-WITNESS-008` | §5.3 enumeration and least candidate key. | For overlapping collinear finite boundaries, the zero-distance witness is an interval, but the key requires `orderedWitnessPoints`. Example: `[0,2]` and `[1,3]` on the same line have every point in `[1,2]` as a zero witness. No endpoint/parameter rule picks one, so the claimed stable witness and resulting evidence bytes are undefined. | Define one canonical overlap witness, including target orientation and tie handling—for example, the lexicographically least common endpoint/parameter pair under a specified Q2 order. Add reversed-source and whole-boundary overlap fixtures. |
| `MET-FORMAT-009` | §0.2 deterministic limits; §1 formatter-cap outcome; §5.4 final two paragraphs. | The formatter permits “bounded interval refinement” and may emit `GEOMETRY_EXACT_LIMIT/METRIC_FORMATTER`, but defines neither a formatter bound nor the required candidate-`n` procedure. Different exact implementations can succeed or cap on the same `q`; this breaks the promised named outcome even though the half-cell comparison itself is sound. | Specify the input magnitude/bit cap, a mandatory initial bracket and refinement algorithm (or a required exact-integer alternative), and the exact exhaustion condition. Add limit-minus-one, limit, and limit-plus-one formatter fixtures. |
| `FIX-EXACT-010` | §11 fixture matrix, especially CB2, faces/rings, Q2, metric, lineage, and wall-host rows. | The listed corpus cannot demonstrate the missing total rules above. It has no rational canonicality/zero-denominator case, unregistered digest-root vector, seed projection-cycle case, three-level ring case, combined Q2 subtype case, overlap-witness case, formatter-cap boundary, or ordinal-renumbering case. “Each subtype” also cannot exercise the currently undefined `Q2_INVERSE_ZERO` predicate. | After the semantic corrections, add the named fixtures from the corresponding rows above, each pinning input bytes, exact result, witness/digest, inverse result where applicable, and unchanged durable state on rejection. |

## Cross-checks that did not independently block R5

| Area tested | Result of this review |
| --- | --- |
| CanonicalBytes primitive vectors | All four provided vectors and SHA-256 digests match. Minimal LEB128, scalar tag, union, and empty-set framing are internally coherent at that primitive level. |
| C1/C4 units and ties | The CSS-U calculation gives the claimed 100 mm at 1 CSS px/mm; C1’s integer-vertex key is complete; C4 tests the 50 mm threshold before direction and uses the stated lower tie for `k`. |
| Ray intersection arithmetic | The stated cross-product numerators and positive finite-contact predicates are algebraically consistent. The missing cap above still prevents the full RayProbe outcome from being total. |
| Integer dart traversal | The clockwise predecessor-of-twin rule preserves the left face for a simple square; bridge reduction is explicitly separated from the physical-side orbit. The nested-depth path above remains unresolved. |
| Q2 offsets and miter cap | The cardinal/diagonal offset expressions remain in Q2, and equality at the stated miter cap is defined. The rejection subtype/output mapping is not. |
| C8 yaw and half-cell comparison | The stated 45° rotation preserves Q2 form, and direct comparisons at decimal half-cells avoid binary floating rounding. The overlap witness and formatter-limit paths remain unresolved. |
| Host span arithmetic | The opening span `offset/sqrt(L2)` and child-local interval formula are exact under normalized Rational/Q2 values. The required rational normalization and host-key/digest definitions are missing, so the total host route is still blocked. |

## Required disposition after correction

Correct every blocker above in a new frozen draft, regenerate the expanded
fixture matrix and byte vectors, then obtain another independent review of that
new exact SHA. No conclusion in this report changes the current source owners,
canonical documents, readiness gate, or implementation authorization.
