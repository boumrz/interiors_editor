---
title: "InteriorsEditor — D-022: рабочий ADR-input для геометрической политики Alpha, revision 4"
date: 2026-08-05
revision: 4
status: draft-working-policy
review_disposition: successor-prepared-after-frozen-r3-external-rejections-awaiting-fresh-review
canonical: false
architecture_spine_changed: false
memlog_changed: false
implementation_ready: false
readiness: NOT_READY
scope: "Только R4 policy input для exact kernel, selection, metrics, Plan hole gate, explicit Room survival, host transfer и durable ChangeSet"
supersedes:
  artifact: d-022-geometry-policy-decision-draft-r3-2026-08-05.md
  revision: 3
  sha256: ef16eb1a15b0face1e92077dff9ca904fa094378a64c10b8752fa48960151773
  status: frozen-external-review-evidence-do-not-edit
authority:
  delegated_product_owner_decision: "Реши сам кого назначить, мне нужно, чтобы решения были приняты для продолжения работы"
  limit: "Делегирование выбирает только рабочий policy input; оно не заменяет source-owner reconciliation, executable corpus, independent review, physical evidence или final READY"
sources:
  - ARCHITECTURE-SPINE.md
  - .memlog.md
  - domain-model.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../specs/spec-interiors-editor-alpha/performance-budgets.md
  - ../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../implementation-readiness-report-2026-08-05.md
review_inputs:
  - reviews/review-current-source-d022-r3-2026-08-05.md
  - reviews/review-d022-exact-geometry-adversarial-r3-external-2026-08-05.md
  - reviews/review-d022-r3-topology-data-integrity-2026-08-05.md
frozen_review_input_sha256:
  review-current-source-d022-r3-2026-08-05.md: 2ab774dd26ca37abef1e7429a0afd99a117ed0158e428bac04bd825bf2ac2abc
  review-d022-exact-geometry-adversarial-r3-external-2026-08-05.md: 9771832facf06fbec0e238168be89d363d6aae2017021d7fc1c015df79057918
  review-d022-r3-topology-data-integrity-2026-08-05.md: 890360d022828368412613a2311dd56dc8ef85024034de6f43a582179621712d
proposed_architecture_route:
  - "После fresh independent review и executable corpus: source-owned reconciliation AD-6/AD-7, SPEC, PRD и UX; R4 сам ничего не канонизирует"
---

# D-022 — рабочий пакет решений, revision 4

## 0. Статус, граница полномочий и главное R4-решение

R4 — новый неканонический successor. R3 с SHA-256 из frontmatter, а также все
три external R3 review, являются замороженным evidence: этот документ не
переписывает, не исправляет и не переопределяет их. Он не меняет `AD-*`, SPEC,
PRD, UX, `.memlog.md`, код, тесты, конфигурацию, readiness или Durable Project.

В частности, сохраняются следующие binding facts источников:

- canonical Plan хранит только integer-mm planar graph; Room, Face, usable
  polygon, метрика, pointer/camera и renderer являются либо derived, либо
  session-only;
- `Room.heightMm` — единственный редактируемый источник высоты; Level/default
  не может неявно seed-ить новую Room;
- rejected/preflight/persist-failed candidate не меняет предыдущую Durable
  Revision; ChangeSet и inverse должны быть полными;
- FR-13 не сужается: остаются точные точки/границы предметов, centerline Wall,
  finished Room dimension, area и perimeter с единым formatter;
- ready остаётся **NOT_READY**. R4 не является corpus, физическим NFR-15
  evidence, source adoption или разрешением на implementation.

### R4 decision

R4 сохраняет narrow `ExactPlanarKernelV1`, но **удаляет** из policy
`CenterlineOverlayV1`, rational overlay arrangement/DCEL, `RoomScoreGraphV1`,
`RoomScoreGraphDigestV1` и любое automatic score/area/overlap matching
изменённых Face. Единственное automatic сохранение Room ID — byte-identical
normalized `faceFingerprint`. Любое changed-face сохранение ID — явный,
подтверждённый, partial-injective `RoomSurvivorMapV2`; его допустимость
доказывает только прямой `FaceLineageRelationV1` из
`NormalizedTopologyEffectV1` и root-wall lineage. Нет valid map — нет
preservation: successor получает explicit `NewRoomSeedV2`, а потеря/перенос
всех полей проходит `RoomLossAcknowledgementV2`.

Это намеренно прозрачное предложенное выполнение FR-15: UI показывает
пользователю map, потерю и seed до confirmation; новый Room ID не является
тихим удалением. Оно является source delta относительно current automatic
"геометрически однозначного" matching и требует owner reconciliation.

Вторая proposed source delta: `PlanValidator` Alpha отклоняет topology
candidate, который производит Face с hole, **до** Room derivation. Persisted
или imported Project с hole не мигрирует и не удаляется молча: после safe
parse он открывается только как named read-only compatibility state с export.
Это также требует reconciliation, поскольку current test model упоминает hole
goldens. До adoption R4 не изменяет их статус.

### 0.1 Эфемерные представления и запрет вторых источников истины

`ExactRationalMm`, `Q2`, `CameraSnapshotV1`, `CameraDeltaV1`,
`SelectionSnapshotV1`, `MetricWitnessV2`, lineage relation, map/digest input и
все `BigInt` существуют только внутри detached validation/preflight/renderer
границ. Ни один не входит в canonical Project, Revision, History или Portable
Backup. Persisted command/ChangeSet содержит лишь явно versioned safe-domain
values, IDs, keys, confirmed intent и canonical digest bytes; derived exact
objects заново вычисляются при replay.

## 1. Нормальные формы, пределы и единые outcome

### 1.1 ExactRationalMm и Q2

`ExactRationalMm = { numerator: BigInt, denominator: positive BigInt }` имеет
ровно одну normal form: denominator положителен, `gcd(abs(numerator),
denominator)=1`, а zero — `{0,1}`. Сравнение — cross multiplication; division
запрещена кроме `gcd`, remainder и доказанного exact integer division.
Conversion в `SafeIntegerMm` разрешена только при denominator `1` и после
ProjectLimits/safe-integer check.

`Q2 = (a + b*sqrt(2)) / d`, где `a,b` signed BigInt, `d` positive BigInt.
`Q2NormaliseV1(a,b,d)` тотальна только при `d != 0`:

1. если `d < 0`, одновременно инвертирует sign `a`, `b`, `d`;
2. если `a=b=0`, возвращает единственный zero `(0,0,1)`;
3. делит `a,b,d` на `gcd(abs(a),abs(b),d)`;
4. проверяет phase-specific final-bit cap и возвращает форму с `d>0`.

Все Q2 add/subtract/multiply/determinant/segment-contact/miter операции
создают raw coefficients, проверяют temporary cap до следующей allocation и
немедленно вызывают `Q2NormaliseV1`. Для inverse сначала вычисляется
`delta=a*a-2*b*b`. `delta=0` даёт named usable failure, иначе raw inverse есть
`(a*d + (-b*d)*sqrt(2)) / delta` и проходит тот же sign-transfer путь; нет
скрытого "negative denominator" случая.

`SignQ2(a+b*sqrt(2), d>0)` не использует float. При `b=0` это sign `a`; при
одинаковом sign `a,b` — этот sign; при противоположных знаках сравниваются
`a*a` и `2*b*b`. Равенство для ненулевых integer `a,b` невозможно, поэтому
каждая ветка возвращает `-1|0|+1` детерминированно.

### 1.2 Единая таблица reason/status

Таблица — единственный R4 registry proposal. **Existing stable** означает
текущий source code; **Proposed stable** требует source adoption; **Draft-only**
никогда не создаёт Command/Revision. Подтип всегда serializable text enum,
а не copy UI.

| Condition | Phase | Status / exact outcome |
| --- | --- | --- |
| Zero/duplicate/unsupported direction/self-intersection | topology | Existing stable `ZERO_LENGTH`, `DUPLICATE_SEGMENT`, `UNSUPPORTED_DIRECTION`, `SELF_INTERSECTION`. |
| Non-integer contact or positive collinear Plan overlap | topology | Existing stable `AMBIGUOUS_INTERSECTION` + proposed subtype `NON_INTEGER_CONTACT` or `COLLINEAR_OPEN_OVERLAP`. |
| Valid canonical value outside ProjectLimits | topology/seed | Existing stable `PROJECT_BOUNDS_EXCEEDED`. |
| Hole/nested/touching ring emitted by topology candidate | PlanValidator before Room | Proposed stable `PLAN_HOLE_UNSUPPORTED` + `HAS_INNER_RING|NESTED_RING|TOUCHING_RINGS`; entire candidate rejects. |
| Existing/imported Project contains a classified hole | open/import compatibility | Proposed stable read-only state `IMPORT_PLAN_HOLE_READ_ONLY`; no migration/delete/Command. |
| Degenerate centerline ring or Q2 miter/inverse/simple-polygon failure | usable | Existing stable `USABLE_POLYGON_COLLAPSED` + one named subtype in §5.3. |
| Exact phase count/operand/temporary/result bit cap | exact phase | Proposed stable `GEOMETRY_EXACT_LIMIT` + mandatory subtype in §2. |
| Missing/non-canonical bytes or digest decoding | bytes/digest | Proposed stable `CANONICAL_BYTES_INVALID`. |
| Missing/invalid explicit survivor map or ineligible lineage | Room | Proposed stable `ROOM_SURVIVOR_MAP_INVALID`; absent map is not an error, it selects seed/loss path. |
| Missing/stale/invalid NewRoomSeedV2 | Room | Proposed stable `ROOM_SEED_REQUIRED`. |
| Missing/stale/duplicate field-loss acknowledgement | Room | Proposed stable `ROOM_LOSS_ACK_INVALID`. |
| Unknown V2 wall-host extractor kind | transfer | Proposed stable `UNKNOWN_WALL_HOST_RECORD_KIND`; split/merge both reject. |
| Map/context/basis/span/output mismatch | transfer | Proposed stable `PARTITION_ATTACHMENT_MAP_INVALID`, `MERGE_ATTACHMENT_MAP_INVALID` or `TOPOLOGY_TRANSFER_CONTEXT_MISMATCH`. |
| Automatic reverse/diagonal/unknown basis rebase | transfer | Proposed stable `HOST_REBASE_UNSUPPORTED`. |
| Wall-side evidence absent/ambiguous, or hosted value on two-exterior-side wall | transfer | Proposed stable `WALL_SIDE_RESOLUTION_INVALID` or `TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED`. |
| Ceiling resolution missing/extra/stale/invalid | host | Existing stable `HOST_SURFACE_REMOVED` + proposed subtype `CEILING_RESOLUTION_REQUIRED|CEILING_RESOLUTION_INVALID`. |
| Incomplete/colliding allocation plan | ChangeSet | Proposed stable `ALLOCATION_PLAN_INVALID`. |
| Content/digest/base/policy bundle mismatch | confirmation | Proposed stable `IMPACT_DIGEST_MISMATCH`. |
| Raw camera/pointer snapshot invalid or out of cap | UI only | Draft-only `CANDIDATE_UNDETERMINED/SNAPSHOT_OUT_OF_RANGE`; no Command. |
| Complete RayProbe set exceeds cap | UI only | Draft-only `CANDIDATE_UNDETERMINED/RAY_PROBE_LIMIT`; no Command. |
| Winning RayProbe is non-integral/collinear blocker | UI only | Draft-only `CANDIDATE_UNDETERMINED/NON_INTEGER_RAY_CONTACT` or `COLLINEAR_RAY_BLOCKER`; no C4 fallback. |
| C4 endpoint outside ProjectLimits | UI only | Draft-only `CANDIDATE_UNDETERMINED/C4_OUT_OF_PROJECT_BOUNDS`; no alternative k/ray. |
| Touch cannot resolve a closed measurement source | UI only | Draft-only `CANDIDATE_UNDETERMINED/MEASUREMENT_SELECTION_UNRESOLVED`; no approximate PlanPoint. |
| Metric catalog orientation incompatible or formatter cap invalid | metric | Proposed stable `METRIC_ORIENTATION_INCOMPATIBLE` or `GEOMETRY_EXACT_LIMIT/METRIC_FORMATTER`; never `MEASUREMENT_UNSUPPORTED`. |

There is deliberately no `MEASUREMENT_UNSUPPORTED` outcome in R4. A healthy
Alpha catalog must be metric-ready; a legacy orientation follows the named
compatibility outcome above and a bounded calculation follows its named limit.

### 1.3 ExactLimitsV2 and deterministic precedence

All caps are input to one versioned policy bundle. A phase first performs its
canonical counting/bit preflight, then materialises only if that check passes.
No pair traversal, hash-map insertion or library iteration can choose which
reason wins.

| Phase subtype | Bounded inputs and temporary arithmetic | Cap and outcome |
| --- | --- | --- |
| `RAW_SNAPSHOT` | binary64 numerator/exponent decode; subtraction/rounding operands | finite-only; numerator ≤ 1,075 bits, binary exponent magnitude ≤ 1,074, temporary ≤ 2,160, final CSS-U/pan ≤ 40 bits; UI `SNAPSHOT_OUT_OF_RANGE`. |
| `PRESENTATION` | `scaleNumerator`, CameraDelta numerator/denominator and screen-distance products | scale ≤ 32 bits and >0; delta/result ≤ 256 bits; temporary comparison ≤ 640 bits; UI `SNAPSHOT_OUT_OF_RANGE`. |
| `RAY_PROBE` | sorted `8*n` direction×WallSegment rows | `n≤300`, rows≤2,400; UI `RAY_PROBE_LIMIT`. |
| `RATIONAL_CONTACT` | canonical integer operands, cross products, normalized rational numerator/denominator, gcd | operand≤53, temporary/gcd≤192, normalized result≤160 bits; `GEOMETRY_EXACT_LIMIT/RATIONAL_CONTACT`. |
| `CONTACT_COLLECTION` | affected pairs, coordinate groups, interior points per segment | 45,150 / 1,024 / 300; `GEOMETRY_EXACT_LIMIT/CONTACT_COLLECTION`. |
| `CENTERLINE_FACE` | integer face ring vertices, shoelace sum, classification tests | 1,200 directed edges, 4,096 cycles, temporary shoelace≤192 bits; `GEOMETRY_EXACT_LIMIT/CENTERLINE_FACE`. |
| `Q2_USABLE` | Q2 operands/final coefficients, products/determinants/inverses, area and winding temporary values | final coefficient≤256, temporary operation≤768, accumulated area≤896, vertices≤600, non-adjacent pairs≤179,700; `GEOMETRY_EXACT_LIMIT/Q2_USABLE`. |
| `METRIC` | boundary edges/candidate pairs, Q2/radicand, witness compare, sqrt interval and formatter arithmetic | 64 / 4,096; Q2/radicand≤768, interval/decimal temporary≤896, refinements≤128; `GEOMETRY_EXACT_LIMIT/METRIC`. |
| `TRANSFER_CHANGESET` | map rows, side resolutions, ceiling set, allocation/output IDs and canonical bytes | each sorted set≤1,200 except ceiling≤250; serialized content≤2 MiB; `GEOMETRY_EXACT_LIMIT/CHANGESET`. |

Fixed validation precedence is: (1) lossless/raw ingress; (2) static phase
caps; (3) normal-form/temporary cap before an operation; (4) contact/topology
semantic invariants; (5) Plan hole gate; (6) Face/usable derivation; (7) Room
map/seed/loss; (8) host/transfer; (9) allocation, canonical bytes and impact
confirmation. Within the same semantic operation a needed temporary-cap check
precedes its semantic result; otherwise the earliest numbered phase wins.
Every enumerated input list is sorted by geometric tuple and then stable ID
bytes; its counting pass and materialisation pass consume exactly that list.

There is deliberately no rational Room overlay or DCEL phase in R4. Face
derivation operates on the integer canonical Plan; changed-face preservation
never requests a rational area/overlap score.

### 1.4 CanonicalBytesV1

All digest inputs use `CanonicalBytesV1`, never implementation JSON. A payload
begins with ASCII bytes `49 45 43 42 31` (`IECB1`), then a registered positive
`typeId` encoded as minimal unsigned LEB128 and exactly one value. No unknown
type, unknown field, duplicate field, non-minimal varint, non-NFC string,
trailing byte or alternate normal form is accepted.

| Value | Wire form after type/value tag | Canonical rule |
| --- | --- | --- |
| `UInt` tag `11` | minimal length LEB128 + big-endian magnitude | zero has length 0; nonzero has no leading 0. |
| `SInt` tag `10` | sign byte `00|01`, minimal length LEB128, then big-endian magnitude | zero is only `10 00 00`; negative zero rejects. |
| UTF-8 text tag `12` | byte length + NFC UTF-8 bytes | source strings normalize to NFC before encoding. |
| UUID tag `13` | exactly 16 RFC-4122 network-order bytes | no textual UUID form enters a digest. |
| Array tag `14` | count + values | semantic arrays retain declared order; unordered sets are sorted by full element bytes before encoding. |
| Record tag `15` | field count + strictly ascending numeric fieldId/value pairs | absent optional field has no pair; present empty value is encoded normally. |
| Union tag `16` | registered unionId + variantId + record | variants and field ids are versioned schema constants. |
| `ExactRationalMm` tag `17` | canonical `SInt(numerator)`, `UInt(denominator)` | rejects non-normal form. |
| `Q2` tag `18` | canonical `SInt(a)`, `SInt(b)`, `UInt(d)` | rejects non-normal form. |

Required nested fixtures (without the `IECB1` outer prefix) are:
`SInt(0)=10 00 00`; `SInt(-1)=10 01 01 01`; `UInt(2)=11 01 02`;
`ExactRational(1/2)=17 10 00 01 01 11 01 02`; and
`Q2(0+sqrt(2)/2)=18 10 00 00 10 00 01 01 11 01 02`.
Schema fixtures additionally pin one sorted `RoomSurvivorMapV2`, one
`TopologyTransferContextDigestV1`, one `ImpactContentV1` and their SHA-256
digests. SHA-256 is computed over the full prefixed content bytes only.

## 2. Total presentation ingress, C1–C4 and closed measurement selection

### 2.1 RawSnapshotIngressV1

Presentation produces only a session Draft; it never changes an already
confirmed endpoint. It has a fully ordered raw boundary before any `BigInt`
arithmetic. `RawSnapshotIngressV1` reads these browser values in this exact
field order:

~~~text
clientX, clientY,
canvasRect.left, canvasRect.top,
rawPanXCss, rawPanYCss,
rawScaleCssPerMm,
computedCanvasTransform, computedTransformOrigin
~~~

For each numeric field in that order:

1. reject missing/non-number, `NaN`, `+Infinity` and `-Infinity`;
2. canonicalize IEEE-754 binary64 `-0` to the same raw value as `+0`;
3. decode the remaining finite binary64 bit pattern into an exact signed
   `Binary64RationalV1`; check `RAW_SNAPSHOT` numerator/exponent cap before
   converting any piece to `BigInt`;
4. only after every numeric field passed, require
   `computedCanvasTransform == none` and default unmodified transform origin.

Any failure, including field-cap failure, is exactly draft-only
`CANDIDATE_UNDETERMINED/SNAPSHOT_OUT_OF_RANGE`. Page zoom, DPR and visual
viewport contribute only to the browser-provided finite raw values; no
device-pixel conversion is introduced. Any CSS transform — axis scale,
reflection, rotation, skew, translation or non-default transform origin — is
prohibited for the Alpha selection canvas.

Let `U=1/256 CSS px`, `Z=2^16` and `H_U=5632`. After raw validation:

~~~text
relativeXU = roundHalfToEven((clientX - rectLeft) / U)
relativeYU = roundHalfToEven((clientY - rectTop) / U)
panXU      = roundHalfToEven(rawPanXCss / U)
panYU      = roundHalfToEven(rawPanYCss / U)
scaleNumerator = roundHalfToEven(rawScaleCssPerMm * Z)
~~~

`roundHalfToEven` is exact rational nearest-integer rounding, including signed
ties; it is never truncation. The resulting relative/pan values must fit the
`PRESENTATION` cap. `scaleNumerator` must then be positive and within its cap;
a finite positive raw scale which quantizes to zero still returns the same
`SNAPSHOT_OUT_OF_RANGE` before inverse projection. This evaluation order is
part of the policy.

~~~text
CameraSnapshotV1 {
  schemaVersion: 1,
  panXU: signed integer,
  panYU: signed integer,
  scaleNumerator: positive integer,
  scaleDenominator: Z,
  cssTransform: IdentityOnly
}
~~~

### 2.2 SelectionSnapshotV1 and CameraDeltaV1

The immutable selection input is:

~~~text
SelectionSnapshotV1 {
  schemaVersion: 1,
  baseRevisionId,
  activeOrigin: existing canonical Vertex or explicit SafeIntegerMm numeric origin,
  relativeXU, relativeYU,
  camera: CameraSnapshotV1,
  cameraDelta: CameraDeltaV1
}
~~~

`activeOrigin` is selected before snapshot creation and is checked against the
same base revision; a stale/missing origin yields no Draft. It is the single
ray origin `P=(originXmm,originZmm)`. It is not an inferred nearest feature.
`cameraDelta` is constructed immediately from the validated ingress and is
immutable for every C1/RayProbe/C4 comparison in this snapshot.

`CameraDeltaV1` intentionally is **not** `ExactRationalMm`; it preserves one
common denominator needed by C4:

~~~text
q = scaleNumerator > 0
dxNumerator = (relativeXU - panXU)*Z - originXmm*scaleNumerator
dzNumerator = (panYU - relativeYU)*Z - originZmm*scaleNumerator

CameraDeltaV1 { dxNumerator, dzNumerator, denominator: q }
~~~

It represents inverse-projected pointer delta from `P`. It may convert either
component to `ExactRationalMm` only by separately normalising a copied
numerator with `q`; C4 never does so. Both representations are cap-checked
before construction.

For any exact world witness `W=(xNum/d, zNum/d)` with `d>0`, the sole screen
distance definition for C1 and RayProbe is:

~~~text
sx = xNum*scaleNumerator - d*(relativeXU-panXU)*Z
sy = d*(panYU-relativeYU)*Z - zNum*scaleNumerator
ScreenDistanceSqV1(W) = (sx*sx + sy*sy) / (d*Z)^2
~~~

The hit square is closed: each exact screen-coordinate difference is at most
`H_U`. Rational comparisons cross multiply positive denominators under the
`PRESENTATION` temporary cap. No library pixel hit-test may replace this
formula.

### 2.3 C1, bounded pre-ranked RayProbe, C3 and C4

Result classes retain the source's four-stage construction:

| Class | Exact construction | Handoff |
| --- | --- | --- |
| C1 `ExactExistingVertex` | canonical Vertex in the closed hit square | if none, evaluate RayProbe. |
| RayProbe pre-class | one exact result for each direction×WallSegment | ranking yields C2 or blocked Draft. |
| C2 `ExactRayContact` | only integral winning probe group | if no probe winner, C3. |
| C3 `ExactConstrainedTarget` | named generator set, deliberately empty in Alpha | always C4. |
| C4 `OriginGrid100` | origin-relative endpoint below | invalid result remains Draft. |

Directions are the fixed clockwise list
`(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1),(-1,0),(-1,1)`.
Let `S` be all current WallSegments sorted by normalized endpoint pair and
stable ID bytes. `RayProbe` materialises exactly one row, including `NoProbe`,
for each `direction×S`; count `8*|S|` first. A breach returns the named
`RAY_PROBE_LIMIT` Draft before partial ranking.

For a row, `P` is `SelectionSnapshotV1.activeOrigin`, and a ray is
`P + lambda*d`. For segment `R→S`:

~~~text
D       = cross(d, S-R)
Nlambda = cross(R-P, S-R)
Nmu     = cross(R-P, d)
lambda  = ExactRationalMm(Nlambda,D).normalise()
mu      = ExactRationalMm(Nmu,D).normalise()
~~~

After denominator sign normalisation, nonparallel finite contact needs
`lambda>0` and `0≤mu≤1`. Integral witness is `IntegralContact`; otherwise it
is `NonIntegerContactBlocker`. For `D=0`, the fixed projection-axis classifier
intersects finite segment lambda interval with `(0,+infinity)`: disjoint or
parallel non-collinear is `NoProbe`; singleton `lambda>0` is a finite endpoint
probe; `lambda=0` delegates solely to C1. A positive collinear interval uses
the exact pointer witness
`clamp((dxNumerator*d.x + dzNumerator*d.z)/(q*norm2(d)), interval)` and,
when it hits the screen square, becomes `CollinearOverlapBlocker`.

Group hit rows by exact witness coordinate/normalized interval. Pre-rank by
(1) minimum `ScreenDistanceSqV1`; (2) blocker precedence
`NonIntegerContactBlocker`, `CollinearOverlapBlocker`, `IntegralContact`; (3)
witness x,z or interval endpoints; (4) fixed direction ordinal; (5) normalized
host endpoint pair. A winning blocker returns its named Draft and suppresses
C2/C3/C4. C1/C2 equal hits then use the complete `SourceTupleV2`:

~~~text
(kindOrdinal, coordinate, sorted normalized endpointPairs,
 sorted contributingPairs, sourceKeyBytes)
~~~

where C1 has empty pairs and a canonical Vertex source key. Thus opaque
iteration/IDs cannot choose a tie.

For C4 use the un-reduced `CameraDeltaV1` common denominator `q`:

~~~text
n_d = dxNumerator*d.x + dzNumerator*d.z
score(d) = n_d^2 / norm2(d), only when n_d > 0
compare a,b: n_a^2*norm2(d_b) ? n_b^2*norm2(d_a)
~~~

Exact equality uses direction ordinal. Let
`m=max(abs(dxNumerator),abs(dzNumerator))/q`; `m<50mm` is Draft. Otherwise
choose positive `k` nearest to `m/100` by exact `abs(mNumerator-100*q*k)`,
with lower positive k on equality, and emit `P+100*k*d`. If that endpoint
violates ProjectLimits it is exactly `C4_OUT_OF_PROJECT_BOUNDS`, with no
smaller-k or other-direction fallback. Hysteresis is zero.

### 2.4 Closed PlanPointSelectionV1

FR-13 selection is ephemeral but closed. A `MeasurementTargetV2` is exactly
one `PlanPointSelectionV1` or one `MetricBoundaryV2`; no bare coordinate,
renderer mesh point or arbitrary touch may enter the metric kernel.

~~~text
PlanPointSelectionV1 =
  ExistingVertex { vertexId }
| UsableVertex { roomId, faceFingerprint, vertexOrdinal }
| AssetFootprintVertex { assetInstanceId, metricFootprintDigest, vertexOrdinal }
| ExactNumericMm { xMm: SafeIntegerMm, zMm: SafeIntegerMm }

MetricBoundaryV2 =
  WallCenterline { wallSegmentId }
| UsableBoundary { roomId, faceFingerprint, edgeOrdinal }
| AssetFootprintBoundary { assetInstanceId, metricFootprintDigest, edgeOrdinal }
~~~

Each variant has a versioned `sourceKey` equal to its `CanonicalBytesV1`
variant bytes. Extraction is exact: vertices use integer-as-Q2; usable
vertices/edges use current derived Q2 values only when the declared
`faceFingerprint` matches; asset values use only the metric-ready transform in
§4. A mobile touch can select only a visible member of this closed set via the
same `ScreenDistanceSqV1`, hit square and `SourceTupleV2`; ties use source-key
bytes. Numeric entry accepts only lossless SafeIntegerMm pair in ProjectLimits.
No visible source/no exact numeric input is
`MEASUREMENT_SELECTION_UNRESOLVED`, not a sampled Q2 point. Pair selection,
cancel and result are session-only and cannot create a geometry Command.

## 3. Integer Face normalisation, Plan hole gate and Q2 usable geometry

### 3.1 FaceRingClassificationV1 before Room derivation

This is the one canonical Plan's bounded-face traversal, not an old/new
overlay and not an arrangement/DCEL. From the already normalized integer Plan,
the validator enumerates bounded centerline boundary cycles in sorted directed
edge order. For each nonzero cycle it computes integer signed twice-area,
reverses when negative to make CCW, and rotates to the lexicographically least
`(vertex coordinate, next coordinate)` cyclic sequence. A zero area or
non-simple cycle is a usable/Plan validation failure before Room assignment.

`FaceRingClassificationV1` then uses exact integer boundary tests and strict
half-open winding to classify each bounded component as exactly:

~~~text
SingleOuter | HasInnerRing | NestedRing | TouchingRings | DisconnectedOuter
| ZeroArea | NonSimple
~~~

`DisconnectedOuter` means independent one-ring bounded faces and is valid.
Any `HasInnerRing`, `NestedRing` or `TouchingRings` makes the whole detached
topology candidate reject as `PLAN_HOLE_UNSUPPORTED` before a Face key, Room,
usable polygon, Opening, host map, allocation or loss acknowledgement exists.
The cap/ordering of this classifier are `CENTERLINE_FACE` in §1.3.

This explicit proposed scope policy is named `NoHolesAlphaV1`. It is not an
adopted interpretation of the current hole fixtures: source owners must either
adopt it with their fixture/migration reconciliation or replace it with a total
multi-ring contract before canonical implementation.

On open/import, the same classifier is run after schema/project-limit parsing.
An otherwise readable persisted Plan with any hole classification becomes
`IMPORT_PLAN_HOLE_READ_ONLY`: canonical bytes remain intact for inspection and
export, but no edit, migration, autosave replacement or Durable Revision is
permitted. It is not silently simplified, deleted or converted to a one-ring
Room. A future owner-approved multi-ring policy must replace this explicit
compatibility state and its corpus.

For every valid Alpha bounded face, `CenterlineFaceKeyV2` is:

~~~text
{ schemaVersion: 2, ringCount: 1, ccwVertices: canonical rotated integer cycle,
  boundaryRootWallLineage: sorted root-wall occurrence tuples }
~~~

`faceFingerprint = SHA-256(CanonicalBytesV1(CenterlineFaceKeyV2))`. Only byte
equality of this key is automatic Room identity evidence.

### 3.2 Q2 usable normalization and total simple-polygon predicate

`FaceBoundaryNormalizationV2` accepts only `CenterlineFaceKeyV2` with one CCW
ring. Interior is left of each oriented centerline edge. It offsets by exact
half-thickness in Q2, intersects adjacent offset lines for miter-only joins,
and rejects rather than bevels when the exact miter cap is exceeded. This
continues to be a proposed delta from the current miter-then-bevel source rule.

Every derived ring removes adjacent duplicate Q2 vertices, rejects zero edges
and backtracks, then uses `Q2SegmentContactV1` for all remaining contacts. The
only usable-base/subtype pairs are:

| Base | Mandatory subtype |
| --- | --- |
| `USABLE_POLYGON_COLLAPSED` | `CENTERLINE_RING_ZERO_AREA`, `Q2_INVERSE_ZERO`, `Q2_ZERO_EDGE`, `Q2_BACKTRACK`, `Q2_MITER_CAP_EXCEEDED`, `Q2_RING_TOO_FEW_VERTICES`, `Q2_NON_POSITIVE_AREA`, `Q2_ADJACENT_EXTRA_CONTACT`, `Q2_NONADJACENT_VERTEX_TOUCH`, `Q2_NONADJACENT_EDGE_CROSS`, `Q2_NONADJACENT_EDGE_OVERLAP`, `Q2_REPEATED_NONADJACENT_VERTEX`. |

Acceptance requires at least three vertices, strictly positive Q2 signed area,
only shared endpoint contact for adjacent edges, and no repeated non-adjacent
vertex, non-adjacent touch/cross/overlap. `Q2SegmentContactV1` first groups
equal endpoint coordinates, then uses exact orientation signs and on-segment
intervals; no float epsilon or projection determines a result.

`StrictInteriorQ2(point, ring)` is total only after the boundary contact check
and simple/nonzero footprint preconditions. For each oriented edge `A→B`:

1. if `point` lies on the closed edge, return false;
2. if `A.z ≤ point.z < B.z` and `orientationQ2(A,B,point)>0`, increment winding;
3. if `B.z ≤ point.z < A.z` and `orientationQ2(A,B,point)<0`, decrement winding;
4. otherwise make no change.

Return true iff final winding is nonzero. Equality in branches 2/3 would have
been a boundary hit, so no implementation-specific vertex rule remains. A
ceiling/floor footprint is strictly contained only when its own Q2 ring is
simple/nonzero/CCW, every vertex is `StrictInteriorQ2`, and every footprint
edge has no contact with every usable boundary edge. This catches a footprint
that encloses or crosses a forbidden region without relying on a generic PIP
library.

## 4. ExactMetricV2 — complete FR-13 target, witness and formatter contract

### 4.1 Exact target extraction and C8 orientation group

`PlanPointSelectionV1` and `MetricBoundaryV2` from §2.4 are the complete
FR-13 input language. Their extractors produce only:

- `MetricPointQ2V2 { sourceKey, x:Q2, z:Q2 }`; and
- `MetricSegmentQ2V2 { sourceKey, start:Q2Point, end:Q2Point }`.

`WallCenterline` has integer endpoints embedded as Q2. `UsableBoundary` must
match the current derived usable polygon and face fingerprint. A metric-ready
Asset footprint has finite ordered local Q2 vertices, nonzero simple boundary
and a digest over its approved definition/footprint/yaw. A stale source key,
missing feature ordinal or non-metric-ready asset has no target extraction;
visible selection then returns the UI-only no-result in §1.2, never a sampled
or float point.

The unambiguous metric orientation group is exactly:

~~~text
YawStepC8V1 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7   // modulo 8
~~~

It is the eight rotations by `k*45°`, **not** the dihedral group: reflections,
negative scale and arbitrary yaw are excluded. Its generator is the exact Q2
transform

~~~text
R(x,z) = ( (x-z)*sqrt(2)/2, (x+z)*sqrt(2)/2 )
R_k = R applied k times
~~~

followed by integer-mm translation. No rounding occurs. `MetricCatalogAdmissionV1`
accepts a new Alpha metric-ready footprint only with `YawStepC8V1` and this
transform. This is a proposed catalog/placement source delta, not a silent
restriction on current arbitrary `RotationStep`: source owners must define
their migration/compatibility route before adoption. Until then, a legacy
non-C8 item cannot masquerade as a healthy metric-ready Alpha boundary; the
named proposed compatibility result is `METRIC_ORIENTATION_INCOMPATIBLE`, not
`MEASUREMENT_UNSUPPORTED`.

### 4.2 Bounded exact minimum and complete witness ties

`ExactMetricV2` first canonicalizes the two selected targets by their complete
`sourceKey` bytes; operand reversal therefore does not change construction.
For point/point, point/boundary and boundary/boundary it enumerates the finite
candidate set of Q2 witnesses:

1. exact segment intersection or positive overlap (`ZeroContact`);
2. each endpoint that lies on the opposite segment (`EndpointOnBoundary`);
3. each strict interior orthogonal projection of an endpoint on the opposite
   finite segment (`InteriorProjection`);
4. every endpoint-to-endpoint pair (`EndpointPair`).

Projection parameter and finite-range predicate use Q2 dot/cross arithmetic;
division by zero is impossible only after the nonzero-segment precondition.
An intersection/overlap yields squared distance zero but still receives a
stable witness. Every candidate carries:

~~~text
MetricWitnessV2 {
  kind: ZeroContact | EndpointOnBoundary | InteriorProjection | EndpointPair,
  orderedFeatureRefs: sorted MetricFeatureRefV1[],
  orderedWitnessPoints: lexicographically sorted Q2 points,
  leftTargetKey, rightTargetKey
}
~~~

`MetricFeatureRefV1` is closed:
`Point(0) | BoundaryStart(1) | BoundaryEnd(2) | BoundaryInterior(3) |
OverlapInterval(4)`, followed by its source key and normalized endpoint
coordinates. Candidate tie key is exactly `(squaredDistanceQ2,
kindOrdinal[ZeroContact=0, EndpointOnBoundary=1, InteriorProjection=2,
EndpointPair=3], orderedFeatureRefs, orderedWitnessPoints,
leftTargetKey,rightTargetKey)`. It is fully normalized before comparison;
zero-distance, reversal and symmetric endpoint cases cannot expose an opaque
left/right or feature-rank choice.

The selected minimum is an algebraic nonnegative `squaredDistanceQ2`. The
result carries its witness only ephemerally; the formatted distance, room area,
perimeter and dimensions all pass §4.3's one formatter. `Metric` limits in
§1.3 are checked before each candidate pair, Q2 division, comparison and
witness collection.

### 4.3 Total interval formatter

`MeasurementFormatPolicyV2` accepts a nonnegative normalized
`q=(a+b*sqrt(2))/d` and never invokes `Number`, `Math.sqrt`, `Intl` or locale
default rounding. The exact first enclosure is constructed as follows:

1. use `1 ≤ sqrt(2) ≤ 2`; when `b≥0`, set
   `qLo=(a+b)/d`, `qHi=(a+2b)/d`, otherwise swap those two expressions;
2. replace `qLo` by `max(0,qLo)` and prove `0≤q≤qHi` by `SignQ2`; `q=0`
   returns exact zero immediately;
3. choose the smallest integer `e` satisfying `qHi ≤ 2^(2e)` through bounded
   bit-length estimation plus one exact rational comparison; initialize
   `lo=0`, `hi=2^e`, so `lo²≤q≤hi²`;
4. bisect with exact rational midpoint, retaining the side whose square bounds
   q. Equality returns an exact root interval. Every exponent, square,
   comparison and decimal-scale product consumes the declared `METRIC` bit
   limit before construction.

The rounding target is known only when `[lo,hi]`, after unit conversion and
decimal scaling, lies wholly in one nearest-half-even rounding cell. A point
exactly at half selects the even final digit. At most 128 refinements are
allowed; if no unique cell is proven, return
`GEOMETRY_EXACT_LIMIT/METRIC_FORMATTER`, not an implementation-chosen decimal.

The proposed shared structured output is:

~~~text
FormattedMetricV2 {
  quantityKind: Length | Area | Perimeter,
  unit: mm | m2,
  fixedFractionDigits: 2 for Length/Perimeter mm, 3 for Area m2,
  roundedAsciiDecimal,
  rounding: NearestHalfEven,
  exactAtPrintedPrecision: boolean,
  sourceValueDigest
}
~~~

Length/perimeter conversion uses exact millimetres; area conversion divides
exact mm² by `1_000_000`. The ASCII decimal token is the product datum shared
by Preview, 2D, 3D and export; localization may surround it with translated
unit text but may not recompute number/precision. Corpus must pin generic Q2
initial bounds, exact/half-even ties, cap boundary, point–point,
point–bed-boundary, point–wall/usable-boundary, room area/perimeter and all
four output consumers.

## 5. Room identity without old/new geometric overlay

### 5.1 Exhaustive topology effect and direct lineage eligibility

Each detached topology mutation emits one sorted `NormalizedTopologyEffectV1`:

~~~text
kind = AddWallSegment | MoveVertex | MoveWallSegment | DeleteWallSegment
     | SplitWallSegment | MergeCollinearSegments | ChangeWallThickness
baseRevisionId
sorted sourceWall records (id, oriented endpoints, thickness, rootWallLineage)
sorted outputWall records (id, oriented endpoints, thickness, rootWallLineage)
sorted contact groups and per-segment partition parameters
frozen output-ID allocation purposes
normalized intent digest
~~~

Every output Wall carries immutable sorted root-wall occurrence lineage. The
effect uses `CanonicalBytesV1`; no command kind falls through to a bespoke
lineage rule. `FaceLineageRelationV1` is a direct, deterministic eligibility
proof, not a score or candidate selector:

~~~text
FaceLineageRelationV1 {
  oldRoomId,
  oldFaceFingerprint,
  successorFaceKey,
  sorted directRootOccurrences [
    rootWallId, oldBoundaryOrdinal, newBoundaryOrdinal,
    effectTransitionKind, sourceWallId?, outputWallId?
  ],
  topologyTransferContextDigest
}
~~~

It exists iff every tuple is reconstructible from the one normalized effect,
both Face keys contain the recorded root occurrence, and the sorted tuple list
is nonempty. It does **not** inspect area, overlap, usable polygon, nearest
Face, ID sort order or a geometric score. A shared root alone is insufficient
until this complete tuple reconstructs. The relation proves only that the user
may choose a map entry; it never preserves an ID by itself.

### 5.2 Auto unchanged only; explicit RoomSurvivorMapV2 for every change

After the Plan hole gate and `CenterlineFaceKeyV2` derivation:

| Candidate face condition | Exact ID route |
| --- | --- |
| byte-identical `faceFingerprint` to exactly one predecessor | automatic same Room ID, complete record subject to explicit bundled mutations. |
| changed fingerprint with supplied valid map entry and recomputed direct relation | same mapped predecessor Room ID. |
| changed fingerprint with no map entry or no eligible relation | one new allocated ID plus exactly one `NewRoomSeedV2`. |
| supplied map is stale, non-injective, extra, points to unchanged face, lacks/mismatches relation or conflicts with auto route | reject `ROOM_SURVIVOR_MAP_INVALID`; never silently downgrade a confirmed choice. |

`RoomSurvivorMapV2` is sorted by successor Face key and is partial-injective in
both dimensions: no predecessor Room ID maps to more than one changed face and
no changed face maps to more than one predecessor. It is forbidden for an
unchanged fingerprint and contains exactly:

~~~text
{ predecessorRoomId, predecessorFaceFingerprint, successorFaceKey,
  faceLineageRelationDigest, topologyTransferContextDigest }
~~~

Map absence is an intentional transparent outcome, not an error: preflight
lists all changed faces, eligible direct relations, required seeds and field
losses; confirmation either supplies selected V2 entries or confirms the
seed/loss alternative. R4 has no `CenterlineOverlayV1`, DCEL, overlay area,
score graph, tie reduction, auto-max survivor or score digest anywhere in
preflight, allocation, ChangeSet, inverse, replay or corpus.

### 5.3 Seeds, closed field classes and loss acknowledgement

Every candidate face without automatic or V2-mapped Room identity receives one
sorted seed before Opening, adjacency, wall projection or host validation:

~~~text
NewRoomSeedV2 {
  successorFaceKey,
  allocatedRoomId,
  initialCore: {
    name: explicit text or explicit empty,
    type: explicit enum or explicit unset,
    metadata: explicit canonical record,
    heightMm: explicit lossless SafeIntegerMm
  },
  initialFloorAssignment: ExplicitValue | ExplicitUnset,
  initialCeilingAssignment: ExplicitValue | ExplicitUnset
}
~~~

`heightMm` validates current Room ProjectLimits before all height-dependent
Opening/adjacency/host checks. A suggestion copied from a predecessor is only
UI text until it appears byte-for-byte in the confirmed seed. A Level/default,
projection value or implementation default cannot fill any seed field.

The closed `RoomRecordFieldClassV1` is:

~~~text
IdentityAndFace | CoreName | CoreType | CoreMetadata | RoomHeight
| FloorAssignment | CeilingAssignment | WallSideAssignmentSet
~~~

`IdentityAndFace` is system-derived; all others are user values or explicit
absence. `WallSideAssignmentSet` is a sorted full set keyed by exact
`SurfaceAddress`, not an untyped part of `RoomCore`. For each source class the
validator emits one `FieldDispositionV1`:

| Class | same ID (unchanged or valid V2 map) | new seeded ID | changed/lost source |
| --- | --- | --- | --- |
| `IdentityAndFace` | retain Room ID, replace only derived Face key | allocate seed Room ID/new Face key | explicit loss acknowledgement. |
| `CoreName/CoreType/CoreMetadata/RoomHeight` | retain exactly unless an explicit bundled field mutation says otherwise | exactly `initialCore`, no inherited default | explicit target mutation or acknowledged removal. |
| `FloorAssignment` | retain exact `Floor(RoomId)` value unless explicit mutation | seed's explicit value/unset only | explicit target mutation or acknowledged removal. |
| `CeilingAssignment` | retain exact `Ceiling(RoomId)` value unless explicit mutation | seed's explicit value/unset only | explicit target mutation or acknowledged removal. |
| `WallSideAssignmentSet` | resolve every key through §6, even if Room ID survives | starts empty; only explicit/map-created values may exist | each source key resolves by map, explicit target or acknowledgement. |

`FieldDispositionV1` is only `RetainSameKey | SetExplicitTarget |
RemoveAcknowledged`, and includes forward/inverse canonical value bytes. An
equal-looking default still requires its named disposition; omission cannot be
treated as "no loss".

`RoomLossAcknowledgementV2` is sorted by `(sourceRoomId, fieldClassOrdinal)`
and carries `sourceProjectionBytesDigest`, exact `FieldDispositionV1[]`,
`afterProjectionBytesDigest` and the relevant `successorFaceKey/RoomId` or
`RemovedNoSuccessor`. For a Room ID loss, validator generates exactly one
acknowledgement for each of the eight field classes; `WallSideAssignmentSet`
contains its complete sorted pre/post address set, including empty. For a
destructive explicit mutation of a retained Room, the affected class has one
acknowledgement too. Missing, duplicate, extra, stale or projection-mismatched
acknowledgement is `ROOM_LOSS_ACK_INVALID`. This closes coverage without a
subjective `carryClassOrFieldSet`.

### 5.4 AffectedCeilingPlacementSetV1 and exterior projection separation

Ceiling material assignment is not a ceiling Asset placement. After identity,
seed and field-disposition resolution, the validator derives the conservative,
bounded complete set:

~~~text
AffectedCeilingPlacementSetV1 = sorted union of every CeilingPlacement
referenced by the base Project and by the detached candidate Project,
annotated with pre/post RoomId, usablePolygonDigest, heightMm and placement bytes
~~~

The whole union is deliberately affected (Alpha cap 250); it cannot omit a
same-ID Room whose usable polygon or height changed. Its exact canonical bytes
and digest enter impact content. Every member appears exactly once in:

~~~text
CeilingHostResolutionV1 {
  assetInstanceId,
  affectedSetDigest,
  action:
    Keep
  | MoveAsset { complete explicit target CeilingPlacement }
  | DeleteAsset { explicit user acknowledgement key }
}
~~~

`Keep` is valid only when the same post Room host exists and the complete
footprint passes §3.2 strict containment at the post height. `MoveAsset` is a
fully explicit new host/position/orientation payload and passes the same
validation; `DeleteAsset` is an explicit confirmed removal. Missing, extra,
stale or invalid action rejects before ChangeSet. Every action has an exact
inverse and no nearest-room fallback.

For a wall with no adjacent resolved Room, the current source's exterior or
unclosed-wall height remains a **projection-only**
`ExteriorWallProjectionHeightV1` input. R4 does not assign its numeric source
or adopt a new default: it may determine renderer wall extrusion where no Room
exists, but it cannot populate `NewRoomSeedV2.heightMm`, create a Room, enter
Room field loss, validate a Room host or become persisted Room state. Any
owner decision about its existing default is separate from this seed policy.

## 6. Host transfer, wall-side identity and context fencing

### 6.1 Closed extractor and TopologyTransferContextDigestV1

The only V2 wall-host record kinds are:

~~~text
WallHostedRecordKindV2 = Opening | WallPlacement | WallSideAssignment
~~~

`Opening` and `WallPlacement` carry a nonzero physical interval in a local
wall basis; a point anchor is never silently widened. `WallSideAssignment`
carries a full physical side, assignment value and exact source
`SurfaceAddress`. Extractor rejects every unknown/unversioned kind as
`UNKNOWN_WALL_HOST_RECORD_KIND` before it chooses split versus merge map
outcome. All local bases contain normalized canonical wall endpoints,
unit-free parameter orientation, physical side `Left|Right`, normal sign and
orientation parity; reverse/diagonal automatic rebase remains forbidden.

Before a map, lineage relation or side resolution is accepted, validator builds
one `TopologyTransferContextDigestV1` from `CanonicalBytesV1` of:

~~~text
schemaVersion, policyBundleId, baseRevisionId,
NormalizedTopologyEffectV1 bytes,
sorted source wall IDs/endpoints/orientations/thicknesses/root lineages,
sorted contact groups/partition parameters,
frozen allocation purposes and output IDs,
sorted extractor outputs (record kind, physical interval, basis, source address),
sorted pre-resolution Room/Face keys and physical-side observations
~~~

It is recomputed from the detached base/candidate before accepting any output
map. `PartitionAttachmentMapV2`, `MergeAttachmentMapV2`,
`FaceLineageRelationV1` and `WallSideResolutionV1` carry this one digest.
Equal-looking geometry with a different source wall, basis, root lineage,
allocation or Room-side input therefore cannot replay a stale map.

### 6.2 PartitionAttachmentMapV2 and MergeAttachmentMapV2

`PartitionAttachmentMapV2` is a sorted total mapping over every extracted
source host record and has `{ contextDigest, sourceRecordKey, sourceInterval,
sourceBasis, outputEntries[], inverseEntries[] }`. Its output is selected only
by exact physical interval intersection and identical resolved basis/side:

- an Opening/WallPlacement wholly inside one child maps one-to-one;
- a crossing interval is rejected unless an explicitly supported deterministic
  split rule produces all child records and inverse ranges;
- a full-side `WallSideAssignment` maps one-to-many only by explicit clone
  records, each with output address and inverse;
- no output, extra output, reversed side, diagonal rebase or context mismatch
  is a named map failure.

`MergeAttachmentMapV2` applies only to an axis-aligned, same-basis, contiguous
chain with stable orientation parity. Every diagonal, reverse, unknown-basis or
bare diagonal merge rejects `MERGE_ATTACHMENT_MAP_INVALID` rather than taking
a special empty-map path. On each physical side its complete assignment matrix
is:

| Source full-side values | Output | Result |
| ---: | --- | --- |
| 0 | 0 | no target assignment |
| 2 equal canonical values | 1 | `CoalesceEqualFullSide` with two-source inverse |
| 1, 2 unequal, or any other count | — | reject merge map |

`Opening` and `WallPlacement` use their explicit spans and `PreserveOne` /
`RestoreOne` inverse only when one physical interval survives exactly. No rule
can stretch a singleton wall-side material over a merged second half.

### 6.3 WallSideResolutionV1 and exterior/exterior prohibition

Maps alone do not resolve a wall that keeps `WallSegmentId` while its adjacent
Room changes. For every surviving/changing wall-side address, after Room
identity resolution and before impact digest, validator requires one sorted:

~~~text
WallSideResolutionV1 {
  sourceAddress,
  sourcePhysicalSide: Left | Right,
  sourceBasis,
  candidateFaceKey,
  targetWallSegmentId,
  targetPhysicalSide: Left | Right,
  targetRoomId | ExteriorSide,
  targetAddress,
  provenance: UnchangedExactAddress | PartitionMap | MergeMap
            | ExplicitRoomSurvivorMapV2 | NewRoomSeedV2,
  physicalSideProof: root lineage + orientation parity + face-side occurrence,
  topologyTransferContextDigest,
  inverseResolution
}
~~~

The proof must reconstruct the target physical side and its Room from the
normalized effect and final identity route. It cannot use proximity, current
polygon order, lexical Room ID or a renderer. Missing/ambiguous proof rejects
`WALL_SIDE_RESOLUTION_INVALID`.

Current persistent `SurfaceAddress` has only one `ExteriorSide` token. To
avoid collapsing the two physical sides of an isolated/bridge wall, Alpha
permits such a wall with no hosted side value, but rejects any
`WallSideAssignment` or `WallPlacement` when both physical sides resolve to
`ExteriorSide` as `TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED`. Standalone/bridge,
exterior/interior, reverse, split, merge and undo all use this explicit rule;
R4 does not silently version the canonical address.

## 7. Allocation, non-recursive impact and reversible ChangeSet

### 7.1 FrozenAllocationPlanV2 and preflight fence

Preflight is read-only and fenced to `baseRevisionId`. It constructs exactly
one `FrozenAllocationPlanV2` before semantic validation succeeds:

~~~text
{ schemaVersion, baseRevisionId,
  sorted allocationPurposes [purposeBytes, reserved UUID],
  sorted expected output IDs and SurfaceAddress keys }
~~~

Purpose bytes name only stable semantic outputs: new Vertex/Wall/Room,
Opening/Asset target, map clone/coalesce, explicitly selected survivor route
and explicit field mutation. The plan rejects duplicate purpose, duplicate ID,
missing/extra output or collision with base IDs as `ALLOCATION_PLAN_INVALID`.
No Room score/overlay purpose exists in V2.

At confirmation and immediately before `PendingDurability`, validator
recomputes the whole detached candidate from the same current base revision.
Stale base, changed ProjectLimits/policy bundle, changed source resource or
mismatched frozen output rejects before a Durable mutation. Persistence failure
after a validated candidate keeps the previous Durable Revision and follows
the existing pending/retry/recovery boundary; it never turns a preflight into a
saved result.

### 7.2 PreflightImpactContentV1 envelope

There is no self-hashing field. The complete serializable content is:

~~~text
PreflightImpactContentV1 {
  schemaVersion, canonicalBytesVersion, policyBundleId,
  baseRevisionId,
  NormalizedTopologyEffectV1,
  TopologyTransferContextDigestV1[],
  FrozenAllocationPlanV2,
  sorted CenterlineFaceKeyV2 and automatic unchanged-retention records,
  RoomSurvivorMapV2[], FaceLineageRelationV1[], NewRoomSeedV2[],
  FieldDispositionV1[], RoomLossAcknowledgementV2[],
  PartitionAttachmentMapV2[], MergeAttachmentMapV2[], WallSideResolutionV1[],
  AffectedCeilingPlacementSetV1, CeilingHostResolutionV1[],
  explicit Opening/adjacency/property mutations,
  resource pin and BackupFeasibility commitments,
  exact output IDs and SurfaceAddress keys
}

PreflightImpactV2 = {
  content: PreflightImpactContentV1,
  impactDigest: SHA-256(CanonicalBytesV1(PreflightImpactContentV1))
}
~~~

The envelope digest is excluded from `content` by construction. A confirmed
command carries the entire content plus the digest shown to the user; a
confirmed digest mismatch is `IMPACT_DIGEST_MISMATCH`. Every nested map,
relation, acknowledgement, allocation key and resource reference uses §1.4
bytes, so digest equality is meaningful across devices and replay.

### 7.3 Validated ChangeSet, inverse, replay and undo

A successful `ValidatedChangeSetV2` contains the same
`PreflightImpactContentV1`, its digest, all forward canonical record changes,
all exact resource pin/backup results, explicit affected entity IDs and a
complete `InverseChangeSetV2`. It may reach `PendingDurability` only after:

1. exact topology/contact validation and Plan hole gate;
2. auto unchanged / explicit V2 Room identity resolution;
3. all seeds, field dispositions, loss acknowledgements, maps, side proofs and
   ceiling actions validate;
4. frozen allocation/output keys and byte/digest fence match;
5. current Project resource and backup policies validate.

Replay, undo and redo re-run canonical-byte decode, policy version/base fence,
allocation purpose check, map/context/relation checks and inverse changes.
They never recompute a changed-face survivor by geometric score or a nearest
host. Session retention may reject a new command but never silently destroys an
existing history entry. No failure path creates a partial Project mutation or
new Durable Revision.

## 8. Required executable corpus before any adoption

This is a future evidence plan, not a claim that tests exist. Every fixture
must assert exact forward result, stable reason, canonical bytes, inverse and
unchanged prior Durable Revision on rejection.

| Area | Minimum non-happy-path corpus |
| --- | --- |
| Raw/camera | nonfinite each raw field, `-0`, subnormal/large finite binary64, rect/pan half-even, zero-quantized scale, transform/origin rejection, CameraDelta common denominator, C1/C2/C4 rational ties and all C4 bounds. |
| RayProbe | exact `P`, inverse pointer delta and screen-distance witness; all 8 directions; finite/noninteger/collinear `D=0`, singleton/interval/gap, blocker precedence, `8*n` cap and no partial ranking. |
| Rational/limits | duplicate-before-overlap, finite T/X/multi-X, reversal/negative contact; every phase operand/temp/final bit boundary and deterministic limit-versus-semantic precedence. |
| Plan Face/hole | CCW/reversal/canonical rotation, zero/non-simple ring, disconnected valid outers, inner/nested/touching candidate rejection before Room work, imported hole read-only/export/no-migration/no-delete. |
| Q2 usable | sign/normalization/inverse both delta signs, miter/backtrack/zero/area caps, each named simple-polygon subtype, all `StrictInteriorQ2` winding branches, footprint enclosure/contact cases. |
| FR-13 | each closed PlanPoint/Boundary source, unresolvable touch, point–point, point–bed, point–wall/usable, C8 k=0..7/no reflection, legacy orientation compatibility branch, every witness tie/reversal/zero case, generic sqrt(Q2) initial enclosure and formatter ties/caps/parity. |
| Room identity | unchanged fingerprint auto-only; every `NormalizedTopologyEffectV1` kind; valid/invalid direct lineage; absent map→seed/loss; partial-injection rejection; stale map/context; no overlay/DCEL/score artifacts in payload/replay. |
| Fields/loss/ceiling | all eight Room field classes, value-equal/default/absent cases, seeded and mapped IDs, explicit mutation, exact acknowledgement cardinality; complete 250-cap ceiling set, same-ID geometry loss, Keep/Move/Delete and inverse. |
| Host transfer | closed extractor/unknown kind; span/basis/side proof; split clone/inverse; merge 0→0/2-equal→1/singleton/unequal; reverse/diagonal reject; surviving Wall with changed adjacent Room; exterior/exterior reject and undo. |
| Bytes/ChangeSet | every CanonicalBytesV1 fixture/type/ordering/NFC/UUID/optional case; context digest stale base; non-recursive impact envelope; serialize/replay/retry/undo/redo/policy mismatch and persistence failure with prior Durable Revision intact. |

Browser/Playwright screenshots, S-2 or emulator evidence cannot substitute for
this domain corpus, fresh independent policy review, owner adoption or the
physical NFR-15 evidence matrix.

## 9. R3 external finding disposition

The table maps all numbered frozen R3 review findings to R4 text. It is a
traceability aid only; none of these entries changes their `REJECT` verdict or
marks R4 accepted.

| Frozen finding | R4 disposition |
| --- | --- |
| `D022-R3-CSR-01` PlanPoint selection incomplete | §§2.4 and 4 close the target union, source keys, ingress/no-result and corpus. |
| `D022-R3-CSR-02` reason table incomplete | §§1.2 and 3.2 name every usable subtype and unknown host outcome. |
| `D022-R3-EXT-01` rational/common denominator conflict | §2.2 separates `CameraDeltaV1` from normal `ExactRationalMm`. |
| `D022-R3-EXT-02` RayProbe coordinate origin/witness absent | §§2.2–2.3 define immutable origin, pointer delta and one screen-distance expression. |
| `D022-R3-EXT-03` finite ingress incomplete | §2.1 fixes finite/`-0`/quantization/scale/order and one Draft outcome. |
| `D022-R3-EXT-04` arithmetic limits/precedence incomplete | §1.3 caps rational/Q2/temp arithmetic and fixes phase precedence. |
| `D022-R3-EXT-05` overlay rejects unchanged edge | §§0 and 5 remove the old/new overlay entirely. |
| `D022-R3-EXT-06` overlay cell/area undefined | §§0 and 5 remove DCEL/overlay/score construction rather than retain it. |
| `D022-R3-EXT-07` winding branches undefined | §3.2 gives boundary and upward/downward half-open branches. |
| `D022-R3-EXT-08` metric witness tie undefined | §4.2 gives closed feature refs, candidate set and full tie key. |
| `D022-R3-EXT-09` sqrt initial enclosure absent | §4.3 gives a generic bounded enclosure/equality/refinement path. |
| `D022-R3-EXT-10` D8 ambiguity | §4.1 uses named rotation-only `YawStepC8V1` with Q2 generator. |
| `D022-R3-EXT-11` canonical byte grammar absent | §1.4 defines versioned wire grammar and fixtures. |
| `D022-R3-EXT-12` face orientation derivation absent | §3.1 defines CCW/area/rotation before usable offset. |
| `D022-R3-TDI-01` unchanged overlay overlap | §§0 and 5 remove overlay route. |
| `D022-R3-TDI-02` overlay half-edge ownership undefined | §§0 and 5 remove overlay/DCEL route. |
| `D022-R3-TDI-03` hole lifecycle partial | §3.1 gives pre-Room candidate reject and imported read-only compatibility. |
| `D022-R3-TDI-04` rational topology/overlay bits unbounded | §1.3 adds phase-specific rational/Q2 bounds and removes overlay phase. |
| `D022-R3-TDI-05` Q2 inverse denominator unspecified | §1.1 gives sign-transfer, zero and post-op normal form. |
| `D022-R3-TDI-06` floor/ceiling/wall-side lifecycle open | §5.3 gives closed field class matrix and exact dispositions. |
| `D022-R3-TDI-07` loss acknowledgement subjective | §5.3 gives generated exact class cardinality/projections. |
| `D022-R3-TDI-08` ceiling affected set not enumerable | §5.4 uses complete sorted base∪candidate set and exact actions. |
| `D022-R3-TDI-09` surviving wall/changing Room side unresolved | §6.3 defines proof-carrying `WallSideResolutionV1`. |
| `D022-R3-TDI-10` two exterior physical sides collapse | §6.3 rejects hosted values on exterior/exterior walls. |
| `D022-R3-TDI-11` source topology digest undefined | §6.1 defines `TopologyTransferContextDigestV1`. |
| `D022-R3-TDI-12` impact digest self-referential | §7.2 splits `ImpactContentV1` and digest envelope. |

## 10. Required source-owner route and retained blockers

R4 deliberately proposes material changes that only owners may adopt:

- no-holes Alpha candidate/import compatibility policy despite current hole
  goldens;
- automatic unchanged-only Room retention and explicit changed-face survivor
  confirmation instead of current open automatic matching direction;
- miter-only usable join rather than source miter-then-bevel;
- C1–C4/RayProbe policy, exact metric C8 catalog admission and formatter;
- new stable reason codes, canonical byte grammar, maps, fields, ceilings and
  impact schema.

Required order is: (1) fresh independent R4 review of this SHA; (2) owner
reconciliation in Architecture/SPEC/PRD/UX and a decision on hole/C8
compatibility; (3) executable corpus above, including byte fixtures and
replay/inverse; (4) existing S-2 and all readiness/evidence gates; (5) only
then a separate implementation authorization. Until then R4 is
noncanonical, `NOT_READY`, and cannot authorize code, test bootstrap, CI,
commit or a production claim.
