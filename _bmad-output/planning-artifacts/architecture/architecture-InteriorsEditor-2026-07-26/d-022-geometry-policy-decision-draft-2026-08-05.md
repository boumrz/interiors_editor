---
title: "InteriorsEditor — D-022: рабочий ADR-input для геометрической политики Alpha"
date: 2026-08-05
revision: 2
status: draft-working-policy
review_disposition: remediated-awaiting-independent-rereview
canonical: false
architecture_spine_changed: false
memlog_changed: false
implementation_ready: false
readiness: NOT_READY
scope: "Только подготовка решения D-022: exact kernel, gesture selection, topology consequences, Room/Opening reconciliation и usable polygon"
authority:
  delegated_product_owner_decision: "Реши сам кого назначить, мне нужно, чтобы решения были приняты для продолжения работы"
  limit: "Делегирование выбирает рабочий policy input, но не заменяет evidence, source-owner reconciliation или final READY"
proposed_architecture_route:
  - "Точечные изменения AD-1, AD-6 и AD-7 после owner workflow; новый AD не требуется, если independent re-review не найдёт несовместимый lower-level seam"
sources:
  - ARCHITECTURE-SPINE.md
  - .memlog.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../implementation-readiness-report-2026-08-05.md
  - ../../sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md
  - ../../evidence/spikes/S-2/work-package.md
  - ../../evidence/spikes/S-2/policy-boundaries.md
  - ../../evidence/spikes/S-2/independent-review-integrity-2026-08-04.md
review_inputs:
  - reviews/review-current-source-d-022-geometry-policy-2026-08-05.md
  - reviews/review-d022-adversarial-geometry-policy-2026-08-05.md
  - reviews/review-d022-topology-data-integrity-2026-08-05.md
---

# D-022 — рабочий пакет решений, revision 2

## Статус, граница полномочий и решение revision 2

Это **не** ADR, не обновление **ARCHITECTURE-SPINE.md** и не изменение
**.memlog.md**. Revision 2 — один reviewable working policy package. Он
закрывает конкретные неопределённости предыдущего draft: рациональные
контакты, presentation arithmetic, C3/C4, exact usable joins, merge-host
mapping, Room reconciliation и раздельные операции с Opening.

Ничто в этом документе не меняет следующие факты:

- официальный recheck от 2026-08-05 имеет verdict **NOT READY**;
- S-2 имеет статус **needs-further-evidence**, а его TypeScript kernel —
  disposable experiment, не исходный production module;
- D-011–D-013 и valid exact X уже являются принятыми ограничениями AD-7;
  этот input их не отменяет и не расширяет направления за cardinal/45°;
- canonical geometry остаётся integer-mm planar graph; Room, usable polygon,
  mesh и spatial index остаются derived values;
- physical NFR-15, G-1, S-1/S-3/S-4/S-6, AssetUsageGrant, G-CP-ADR и final
  READY не получают новый статус.

### Решение в одном абзаце

Для Alpha предлагается product-owned узкий **ExactPlanarKernel V1**. Canonical
topology допускает только SafeIntegerMm; перед admission intersection живёт
как exact rational, а usable-room derivation — как exact Q(√2). Нет ни
truncating BigInt division, ни numeric epsilon, ни float/camera value в
semantic path. Gesture resolver получает session-only fixed-point snapshot,
имеет пустой C3 в Alpha и единственный свободный C4 — origin-relative
100-mm endpoint. Usable polygon поддерживает только normalised,
miter-only joins; unsupported step, backtrack, cap или exact-limit целиком
reject candidate. Merge остаётся manual; для axis wall с attachments требуется
полная serializable map, для diagonal допускается только bare-wall path. Room
и Opening outcomes входят в полный validated ChangeSet до Room/Opening
validation. Это всё ещё policy input, который требует source-owner
reconciliation, corpus и independent re-review.

## 1. Exact kernel and canonical contact admission

### 1.1 Числовые области

ExactPlanarKernel имеет три непересекающиеся области.

| Область | Допустимые значения | Граница |
| --- | --- | --- |
| Canonical Plan | SafeIntegerMm, UUID и lossless JSON | Только здесь создаётся Durable Project state. |
| Exact topology work | BigInt и ExactRationalMm | Ephemeral; не попадает в Command payload, Revision, History или Backup. |
| Derived usable geometry | Q2, ExactAreaQ2, ExactLengthQ2 | Ephemeral; может передаваться в projection/formatting port, но не сериализуется как Plan state. |

**ExactRationalMm** имеет вид:

~~~text
{ numerator: BigInt, denominator: BigInt }
denominator > 0
gcd(abs(numerator), denominator) = 1
zero = 0/1 exactly
~~~

Равенство — структурное после normalisation. Порядок и sorting используют
cross multiplication; никогда не Number и не BigInt division. Преобразовать
ExactRationalMm в SafeIntegerMm разрешено только при denominator = 1, после
проверки safe-integer range и ProjectLimits. Деление BigInt в geometry path
запрещено, кроме доказанно целого деления, gcd и remainder.

### 1.2 Total exact-contact procedure

Для canonical integer endpoints P→Q и R→S:

~~~text
r  = Q - P
s  = S - R
D  = cross(r, s)
Nt = cross(R - P, s)
Nu = cross(R - P, r)
~~~

Если D < 0, kernel инвертирует знаки D, Nt и Nu. При D > 0 contact лежит на
обоих closed segments только когда 0 ≤ Nt ≤ D и 0 ≤ Nu ≤ D. Его координаты
конструируются, а не вычисляются truncating division:

~~~text
x = ExactRationalMm(Px * D + rx * Nt, D).normalise()
z = ExactRationalMm(Pz * D + rz * Nt, D).normalise()
~~~

Знак дроби normalise-ится до любого comparison. Несколько contacts
сортируются по exact parameter Nt/D через cross multiplication, затем
group-ятся по exact coordinate. BigInt safe-range и ProjectLimits comparisons
происходят как BigInt до любого возможного Number conversion.

| Ситуация | Единственный Alpha outcome |
| --- | --- |
| D = 0, линии неколлинеарны | Нет contact. |
| D = 0, есть positive overlap открытых интервалов | Whole candidate reject: existing **AMBIGUOUS_INTERSECTION** с diagnostic subtype **COLLINEAR_OVERLAP**. |
| Единственный shared endpoint | Используется только существующая Vertex; новый дубликат не создаётся. |
| Любая координата нового contact не имеет denominator = 1 | Whole candidate reject: **AMBIGUOUS_INTERSECTION** с subtype **NON_INTEGER_CONTACT**. |
| Целая координата вне safe range или ProjectLimits | **PROJECT_BOUNDS_EXCEEDED**. |
| Любая последующая partition/Room/host проверка не проходит | Whole detached ChangeSet rejects; partial mutation отсутствует. |

Например, X двух диагоналей длиной 999 mm имеет contact (999/2, 999/2) и
должен reject целиком, а не стать (499, 499), (500, 500) или grid fallback.

### 1.3 Exact resource boundary

**ExactGeometryLimitsV1** — versioned product policy, а не library default.
Рабочие Alpha limits для corpus: maxOperandBits = 256,
maxCandidateContacts = 1,024 и maxDerivedBoundaryVertices = 2,048. Kernel
проверяет limit до allocation и прекращает enumeration при первом превышении;
эти limits не могут быть неявно расширены library/container capacity.
Arithmetic budget overflow возвращает stable
**GEOMETRY_EXACT_LIMIT** (proposed source-owned reason); он не допускает
float fallback, partial partition или silent simplification.

## 2. PresentationSelectionV1 — fixed-point UI, zero domain tolerance

### 2.1 Session-only numeric snapshot

Никакое browser/WebGL Number не является semantic authority. До candidate
comparison adapter строит **PresentationSelectionV1**, только для текущей
сессии:

~~~text
screen quantum U = 1 / 256 CSS px
camera scale denominator Z = 2^16
H_U = 22 CSS px / U = 5632  # half-side of the 44 CSS-px square, in screen units

CameraSnapshotV1 {
  policyVersion: 1,
  panXU: integer,
  panYU: integer,
  scaleNumerator: positive integer,
  scaleDenominator: Z,
  axisAligned: true
}

screenXU = panXU + xMm * scaleNumerator / Z
screenYU = panYU - zMm * scaleNumerator / Z
~~~

PointerEvent clientX/clientY и canvasRect.left/top сначала отдельно
декодируются как IEEE-754 binary64 rationals; relative coordinate получается
вычитанием в rational space и только затем quantise-ится в U с
**round-half-to-even**. Raw scale сначала выражается в screen-units-per-mm,
умножается на Z и по тому же правилу даёт scaleNumerator. Non-axis CSS
transform canvas в Alpha отсутствует/отклоняется до resolver. После boundary
все hit, direction, k и tie comparisons используют integer/rational
arithmetic. Non-finite input, scale ≤ 0,
outside-canvas sample или отсутствующий active origin дают
DraftCommand/**CANDIDATE_UNDETERMINED** (proposed source-owned reason), а не
rounded endpoint.

Camera Alpha — axis-aligned pan + positive uniform zoom. Renderer может
использовать float matrix, но selection использует только сохранённый
rational snapshot выше. Focus, resize, DPR/page zoom, visual-viewport change
и orientation никогда не пересчитывают уже выбранный Draft; новый resolver
run возможен только по новому pointer sample.

### 2.2 44 CSS-px policy

Квадрат 44 × 44 CSS px — **предлагаемая canvas-selection policy**, согласованная
с touch-floor NFR-17, но не следствие NFR-17 для DOM targets. Для C1/C2
candidate projection должна лежать в closed square:

~~~text
abs(pointerXU - candidateScreenXU) <= H_U
abs(pointerYU - candidateScreenYU) <= H_U
~~~

Это affordance выбора, не geometry tolerance. Presentation не проецирует
свободный pointer на Segment и не округляет near-contact в Vertex. G-1 и
physical-phone evidence обязаны отдельно подтвердить, что 44 px и zero
hysteresis пригодны на заявленных устройствах.

## 3. Total candidate resolver: C1/C2/C3/C4

### 3.1 Общий priority и ties

Candidate classes сохраняют source-owned priority AD-7, но revision 2 делает
каждый class total:

| Class | Alpha generator | Handoff |
| --- | --- | --- |
| C1 — ExactExistingVertex | Все canonical Vertex в 44-px square. | Если empty, перейти к C2. |
| C2 — ExactRayContact | Positive contact разрешённого ray из active origin с existing endpoint/interior Segment только при exact integer-mm result и попадании в тот же hit square. | Если empty, перейти к C3. |
| C3 — ExactConstrainedTarget | Именованный extension point. **Generator set в Alpha пуст.** | Всегда перейти к C4; pointer не создаёт скрытый 1-mm grid. |
| C4 — OriginGrid100 | Единственный free-space candidate, описанный в §3.3. | Если недопустим, DraftCommand/Undetermined. |

C1/C2 сначала group-ятся по exact coordinate. Внутри class winner выбирается
строго по: (1) minimum exact squared screen distance, (2) lexicographic
canonical coordinate xMm,zMm, (3) total source tuple. Source tuple не содержит
opaque iteration order:

~~~text
contact kind order:
  ExistingVertex = 0
  SegmentEndpoint = 1
  InteriorRayContact = 2

then ordered canonical endpoint-coordinate pairs of contributing segments
~~~

C1 выигрывает C2 при совпадении coordinate только из-за class priority.
Candidate, который в presentation выглядит близким, но не проходит exact
construction, не может попасть в lower class как rounded substitute.

### 3.2 C2: exact positive ray contacts

Для каждого из восьми admissible directions d из active origin P resolver
может построить ray/Segment contact с R→S:

~~~text
segment vector s = S - R
D  = cross(d, s)
Nλ = cross(R - P, s)
Nμ = cross(R - P, d)
λ = ExactRationalMm(Nλ, D).normalise()
μ = ExactRationalMm(Nμ, D).normalise()
~~~

При D < 0 signs normalise-ятся как в §1.2. C2 требует D ≠ 0, λ > 0 и
0 ≤ μ ≤ 1; ray не имеет искусственного finite endpoint. Его x/z
конструируются как ExactRationalMm from P + λd, затем проходят hit square и
ProjectLimits. Endpoint и interior contact имеют разные total source kinds,
но одинаковая coordinate group остаётся одной candidate. Ranking C2 сначала
сравнивает все exact hit coordinate groups; если победившая группа
non-integer, resolver возвращает blocked DraftCommand with
**CANDIDATE_UNDETERMINED / NON_INTEGER_RAY_CONTACT** и не переходит к C4.

Таким образом, слово «constrained» в текущем AD-7 не означает округление
pointer в новую точку: C2 строит только уже доказуемый contact с существующей
topology, а C3 намеренно оставлен пустым до отдельного source-owned policy.

### 3.3 C4: exact direction, k и handoff

World pointer delta получается обратным rational transform из
CameraSnapshotV1. Для non-zero delta v выбирается one of eight directions d
из fixed clockwise order:

~~~text
(+1,0), (+1,+1), (0,+1), (-1,+1),
(-1,0), (-1,-1), (0,-1), (+1,-1)
~~~

Среди rays с positive dot(v,d) resolver maximises normalised directional
score dot(v,d) / sqrt(dot(d,d)). Сравнение делается exact: positive scores
сравниваются как normalised ExactRational values
dot(v,d)^2 / norm2(d) через cross multiplication; только norm2(d) равно 1
или 2. На равенстве выигрывает указанный order. Ни atan, ни Number не
допускаются.

После выбора d:

~~~text
m = max(abs(v.x), abs(v.z))
m < 50 mm  => DraftCommand / CANDIDATE_UNDETERMINED
m >= 50 mm => k = argmin over positive integer k of abs(m - 100*k)
endpoint = origin + 100*k*d
~~~

На exact half-step выбирается меньший positive k; соответственно 50 mm даёт
k = 1, 150 mm даёт k = 1. Если endpoint не проходит ProjectLimits, C4 не
подменяется меньшим k или соседним ray: result остаётся DraftCommand с явным
boundary diagnostic. Numeric endpoint/delta остаётся отдельным exact path и
не зависит от этого resolver.

Working Alpha policy имеет zero candidate hysteresis. Никакой sticky target,
pointer-history bias или library nearest fallback не существует.

## 4. T/X partition and selection continuity

Exact T и valid exact X наследуют AD-7: все exact contacts group-ятся до
partition; каждый affected interior Segment partition-ится по всем ordered
contacts в одном detached ChangeSet. Valid X создаёт/reuse-ит одну shared
Vertex и четыре canonical non-zero pieces; T partition-ит crossed segment.
Non-integer X, overlap, budget violation или любая последующая invariant
failure отменяет весь candidate.

Preview и PendingDurability показывают одну shared Vertex и полный
affected-piece set, но не объявляют child Segment произвольным successor
выбранной Wall. После successful Durable publish selection anchor становится
shared Vertex, если команда её создала/использовала; otherwise сохраняется
existing unambiguous selection. Rejected/persist-failed candidate не меняет
prior selection, Project или History. Selection остаётся AppShell/UI state и
не входит в Command, Revision, History или Backup.

## 5. Manual MergeCollinearSegments and MergeAttachmentMapV1

### 5.1 Admission boundary

Merge никогда не является normalizer cleanup. Это explicit user Command с
preview и full validation. Она начинается только для ordered axis chain:

~~~text
A.end = J = B.start
degree(J) = 2
no branch, no overlap
A and B are collinear, same direction, equal thickness
~~~

Reverse orientation не допускается. Diagonal merge разрешён только по
**bare-wall** path: map пуст, на обоих source walls нет Opening, WallPlacement,
wall-side finish/material/surface assignment или другого hosted record. Любой
diagonal rebase или attachment map получает **HOST_REBASE_UNSUPPORTED**.

Для axis chain merge с hosted records Command обязан содержать complete
**MergeAttachmentMapV1**. «Semantic-equivalent» и visual equality запрещены.

### 5.2 Serializable complete map

Map versioned и sorted by record kind, source wall, canonical side, interval,
record ID:

~~~text
MergeAttachmentMapV1 {
  schemaVersion: 1,
  entries: [{
    recordKind,
    recordId,
    source: OpeningHost | WallPlacementHost | WallSideHost,
    target: OpeningHost | WallPlacementHost | WallSideHost,
    orientation: Same,
    transform: AxisTranslateMm(addMm)
  }]
}

OpeningHost {
  wallSegmentId,
  localIntervalMm: [integer start, integer end]
}
WallPlacementHost / WallSideHost {
  wallSegmentId,
  side: AdjacentRoomId | ExteriorSide,
  localIntervalMm: [integer start, integer end]
}
~~~

Opening interval — [leadingOffset, leadingOffset + width]. Point host
использует [offset, offset], если его canonical schema не определяет
non-zero exact host span; full-side finish/material uses [0, wallLength].
Каждый source hosted record и его local interval должен присутствовать ровно
один раз. Нет implicit default, nearest-wall lookup, missing-side inference
или unlisted coalescing. Единственное разрешённое coalescing — две
full-side assignments в один target side при строгом canonical equality,
причём обе source entries остаются явно перечислены в map.
Source и target обязаны иметь один и тот же discriminant, соответствующий
recordKind; каждый target.wallSegmentId обязан быть mergedWallId.

Для ordered A→B mapping является единственной допустимой formula:

~~~text
record on A:
  targetInterval = sourceInterval
  AxisTranslateMm(addMm = 0)
record on B:
  targetInterval = translate(sourceInterval, length(A))
  AxisTranslateMm(addMm = length(A))
orientation = Same only; every other transform rejects
~~~

Все offsets/intervals должны остаться integer-mm. Full-side materials/finishes
могут пережить merge только когда normalised canonical payloads строго равны:
одинаковые schema/value/resource IDs/keys после canonical normalisation либо
оба отсутствуют. Для такого coalesced full-side output key — только resolved
(mergedWallId, AdjacentRoomId|ExteriorSide), а обе map entries обязаны
указывать этот один key. Equal-looking preset, равный render output или
похожее имя не являются equality predicate.

Room-side address разрешается только после RoomSurvivorMap: target side обязан
стать однозначным actual AdjacentRoomId либо ExteriorSide в post-change
candidate. Missing, duplicate, reversed, unequal, out-of-range или ambiguous
entry atomically rejects as proposed **MERGE_ATTACHMENT_MAP_INVALID**; geometry
precondition failure — proposed **MERGE_PRECONDITION_FAILED**. До source-owner
adoption эти новые reason names не считаются изменением current Geometry
Contract.

## 6. Room identity, properties and RoomSurvivorMapV1

### 6.1 Eligible pairs and map

Каждый post-change face имеет deterministic normalised face fingerprint.
Old Room → successor face eligible только если одновременно есть:

1. строго positive exact usable-area overlap; и
2. topology lineage внутри того же detached ChangeSet.

Overlap score — exact, не float/rounded area. Unchanged fingerprint сохраняет
record без reconciliation. Для changed faces kernel auto-retains только
mutual unique maximum: predecessor передаёт ID максимум одному successor, а
successor принимает максимум один predecessor.

**RoomSurvivorMapV1** — serializable, sorted, partial-injective relation:

~~~text
{ predecessorRoomId, successorFaceFingerprint }
~~~

Каждая entry обязана быть eligible. Ни predecessor, ни successor не могут
встретиться дважды. Map может выбрать только remaining **tied** eligible pair;
она не переопределяет уже существующий auto-map и не делает non-eligible
pair valid. Absent/invalid/competing mapping даёт
**ROOM_IDENTITY_AMBIGUOUS**, а не lexicographic fallback.

### 6.2 Total Room property and height matrix

Перед Opening, adjacency, ceiling-host и final ChangeSet validation candidate
содержит complete resolved post-change Room record для каждого successor.
Никакой поздний UI choice не меняет heightMm. Matrix:

| Outcome | ID | Полный record до validation |
| --- | --- | --- |
| Unchanged fingerprint | Сохраняется | Полный existing named record без изменений. |
| Changed one-to-one, mutual unique max | Сохраняется | Полный record predecessor, включая heightMm. |
| Split survivor (auto/map winner) | Сохраняется | Полный record predecessor, включая heightMm. |
| Pure split child | Новый ID | Только source heightMm, если у него ровно один eligible predecessor P и P уже survives в другом successor; name/type/metadata unset, surface assignments empty. |
| Unmapped/mixed successor | Новый ID | Level default heightMm и все остальные product defaults, если у face zero или несколько eligible predecessors, либо единственный predecessor не survives elsewhere. |
| Merge winner (auto/map winner) | Сохраняется | Полный record winner; именно его heightMm выбирается до Opening/adjacency validation. |
| Losing merged Room | ID/record не переносятся | Поля не смешиваются и не подбираются по максимуму/порядку. |

Любой predecessor без auto/map survivor теряет ID и properties по matrix.
Каждый losing record требует serializable explicit acknowledgement, если его
normalised canonical record (исключая generated ID) не равен final successor
record либо Level-default record, against which он теряется. Это и есть
детерминированное значение «materially different non-default», а не judgement
человека. Если пользователь хочет комбинировать properties или выбрать другой
height, это отдельная explicit property mutation, полностью resolved до
topology validation; такого не делает implicit merge. Каждый будущий Room
field должен иметь source-owned carry class до использования в Alpha.

CeilingPlacement остаётся только если его room ID survives. Иначе candidate
rejects; nearest-room rehost запрещён.

## 7. Opening and host-safe operation semantics

Opening.offsetMm — integer **leading-edge offset** от stored canonical start
к stored canonical end своего WallSegment. Это не percent и не world
coordinate. Normalizer не переворачивает host orientation ради coordinate
sorting.

| Операция | Единственная Alpha семантика |
| --- | --- |
| Host-wall geometry edit: MoveVertex или MoveWallSegment | Existing offset сохраняется только если тот же WallSegmentId и тот же stored start→end order. Затем full opening interval revalidates; no clamp/recenter. |
| MoveOpening | Command всегда содержит explicit target host (он может совпасть с прежним) и new leading-edge offset. Это не automatic rebase и проходит normal validation, включая direct move на diagonal host при валидном integer offset. |
| ResizeOpening | Leading edge сохраняется, если Command явно не передал replacement offset; новая width/height/sill полностью revalidates. |
| Axis split | Automatic rebase только если whole old interval лежит ровно в одном child, child имеет same orientation, а offset вычисляется exact integer translation от child start: при child start s относительно old start newOffset = oldOffset - s и [oldOffset, oldOffset + width] содержится в [s, s + childLength]. |
| Axis merge | Только MergeAttachmentMapV1 §5, same orientation и interval formula; иначе reject. |
| Reverse/diagonal automatic rebase | Всегда **HOST_REBASE_UNSUPPORTED**; нет float formula, mirror guess или orphan. |
| Delete host with any hosted record | Atomic reject. Пользователь сначала выполняет explicit valid MoveOpening/remove/rehost operation. |

Те же host-safety rules применяются к WallPlacement и wall-side assignment.
Для каждого WallSideHost при same-WallSegment edit либо split old
AdjacentRoomId должен через auto/map иметь ровно один resolved Room на той же
physical side post-change Wall; иначе candidate rejects as existing
**ANCHOR_REHOST_AMBIGUOUS**. ExteriorSide может сохраниться только как
ExteriorSide той же physical side. При split full-side WallSideHost с
interval [0, oldLength] может transfer-иться только как identical
full-side assignment каждого lineage child после этой side proof; partial-side
assignment, non-uniform payload или WallPlacement interval, не лежащий
целиком в одном same-orientation child, atomically rejects. Нет
nearest/lexical side substitution; это side reconciliation происходит до
final Opening/asset validation. Rebase никогда не становится
post-validation UI repair.

## 8. Q2 usable polygon: normalisation, miter-only and metric boundary

### 8.1 Q2 total arithmetic

Derived coordinate/area/length field:

~~~text
Q2(a,b,d) = (a + b*sqrt(2)) / d
d > 0
zero = (0,0,1)
otherwise gcd(abs(a), abs(b), d) = 1
~~~

Normal form всегда переносит sign в numerator и normalise-ит zero. Addition
и multiplication normalise-ятся после operation:

~~~text
add: (a1*d2 + a2*d1, b1*d2 + b2*d1, d1*d2)
mul: (a1*a2 + 2*b1*b2, a1*b2 + a2*b1, d1*d2)
inv(non-zero): d*(a - b*sqrt(2)) / (a*a - 2*b*b)
~~~

Inverse запрещён для zero. Ненулевой integer pair не имеет
a*a - 2*b*b = 0; nevertheless zero denominator/determinant is always checked
before operation. Equality — structural normal form. Sign Q2(a,b,d)
определяется exactly: при b=0 это sign(a), при a=0 — sign(b), при a>0,b<0
это sign(a*a - 2*b*b), при a<0,b>0 — sign(2*b*b - a*a); при two non-zero
same-sign terms знак очевиден. Comparison x,y = sign(x-y). Здесь нет Number,
epsilon или approximate sqrt.

### 8.2 FaceBoundaryNormalization

Перед каждым miter cyclic CCW face boundary (interior слева) проходит
**FaceBoundaryNormalization**:

1. maximal consecutive same-direction, equal-thickness, same-offset run
   collapse-ится только в **derived** boundary; canonical WallSegments и
   source lineage сохраняются в DerivedEdge source list;
2. same-direction thickness step целиком rejects до miter;
3. reverse/backtracking/180-degree pair целиком rejects до miter;
4. ни одна zero-determinant pair не передаётся в miter function.

Для пунктов 2–3 используется existing
**USABLE_POLYGON_COLLAPSED** с stable diagnostic subtype
**THICKNESS_STEP** либо **BACKTRACKING** до отдельного source-owned
reason-code decision. Нельзя «исправить» такую face bridge/bevel/float
approximation.

### 8.3 Offset, miter и cap

Для normalised cardinal direction u inward offset равен
t/2 * (-uz, ux); для diagonal — t*sqrt(2)/4 * (-uz, ux). Все coordinates
остаются Q2. Только после FaceBoundaryNormalization для adjacent offset lines
с non-zero determinant:

~~~text
p = Aprev + uprev *
    cross(Anext - Aprev, unext) / cross(uprev, unext)
~~~

Miter admissible только когда обе exact squared comparisons проходят:

~~~text
distanceSquared(p, Aprev) <= (2 * max(tprev, tnext))^2
distanceSquared(p, Anext) <= (2 * max(tprev, tnext))^2
~~~

Square root не строится. Equality использует miter. Если cap exceeded,
self-intersection, non-positive exact area, repeated normalised edge или
ExactGeometryLimitsV1 fails, candidate atomically rejects as existing
**USABLE_POLYGON_COLLAPSED** with diagnostic subtype. **Bevel отсутствует в
Alpha.** Это намеренное narrowing: chord bevel в 45-degree corner может иметь
length sqrt(2 - sqrt(2)), которая не принадлежит Q2.

После miter-only coordinates имеют denominator, делящий 8; ExactAreaQ2 —
denominator, делящий 128; ExactLengthQ2 — denominator, делящий 8. Area
получается shoelace over Q2 / 2; perimeter — sum cardinal |Δ| либо diagonal
sqrt(2)*|Δx|. Generic arbitrary boundary distance и bevel measurement —
**MEASUREMENT_UNSUPPORTED** до отдельной algebraic-metric policy; они не
передаются в formatter как float.

MeasurementFormatPolicy получает ExactAreaQ2/ExactLengthQ2. Decimal output
строится через rational bounds для sqrt(2), refined до единственного
source-owned rounding result; renderer не выбирает locale или precision
самостоятельно и не возвращает approximation в topology.

### 8.4 Lattice invariance boundary

Integer lattice Z² сохраняется integer translation, reflection, endpoint
reversal и 90-degree rotation. 45-degree rotation не сохраняет Z²:
(x,z) превращается в ((x-z)/sqrt(2), (x+z)/sqrt(2)). Поэтому corpus не
требует 45-degree rotation invariance. Alpha camera остаётся north-up без
semantic rotation; нужны отдельные fixtures для всех четырёх diagonal
quadrants.

## 9. Preflight, confirmation and durable lifecycle

Preflight может показать ephemeral impact/confirmation preview, но не создаёт
Command, ChangeSet, Pending, History, autosave или canonical projection.
Actual confirmed command включает baseRevisionId, complete
RoomSurvivorMapV1, required MergeAttachmentMapV1, data-loss acknowledgement
и проверяемый commitment resolved room records. Map и matrix §6 остаются
authoritative: Domain заново строит exact candidate и принимает supplied
records только когда они byte-normalise-ятся к recomputed matrix outcome.
Исключение — отдельно declared explicit property mutation в том же atomic
Command, применённая до полной validation; mismatch rejects. Затем domain
выполняет все topology, usable, Room, Opening, host и persistence-precondition
checks.

Cancel/invalid candidate остаётся Draft/Rejected с byte-identical Durable
Revision. Только successful atomic publish создаёт Durable Revision;
persistence failure остаётся отдельным outcome и не masquerades as validation
reject.

## 10. Required executable corpus before canonical adoption

Owner workflow обязан отказаться от adoption до versioned, source-owned corpus
с expected outputs, no-mutation hashes и independent review.

| Area | Minimum executable evidence |
| --- | --- |
| ExactRationalMm/contact | Normal form, denominator sign, integer/half/negative contacts, 999-mm diagonal X, collinear overlap, multi-contact exact ordering, bounds and no BigInt truncation. |
| PresentationSelectionV1 | Binary64 ingress → U quantisation, rational relative-to-rect subtraction, camera pan/zoom, DPR/page zoom/visualViewport, non-axis-transform rejection, non-finite/outside canvas, closed 44-px boundary, dense overlaps, source tuple tie, C3-empty assertion, k at 0/49.999/50/149.999/150 and zero hysteresis. Для valid rational pointer inputs corpus доказывает отсутствующие irrational cardinal/diagonal bisectors; отдельный comparator-level synthetic Q2 score fixture проверяет каждый fixed-order equal-score tie без притворства, что он достижим raw pointer sample. |
| T/X | Endpoint/Vertex, endpoint/interior T, interior/junction, one/multi-X, group-before-partition, one shared vertex, selection preview/commit/failure and byte-identical failure state. |
| Merge/map | Automatic merge negatives; bare diagonal merge; axis A/B map formula; every hosted record coverage; full-side strict equality; visually equal but canonically unequal payload; missing/duplicate/reverse/ambiguous map; Room-side resolution; no orphan/fallback. |
| Room/map/properties | Unchanged, one-to-one, asymmetric/equal split, asymmetric/equal merge, competing predecessor, invalid/non-eligible map, cancellation/replay, all matrix rows, data-loss ack, height-sensitive Opening/adjacency and ceiling-host rejection. |
| Opening | Host-wall edit preservation, explicit MoveOpening, ResizeOpening with/without replacement offset, axis split containment, axis merge, reverse/diagonal automatic-rebase rejection, host delete, fit/overlap/height and numeric/touch parity. |
| Q2 and usable boundary | Q2 normal form/sign/order/inverse, operand-bit cap, odd/even thickness × cardinal/diagonal, convex/reflex miter below/equal/above cap, cyclic equal-thickness zero-turn collapse, thickness-step/backtracking rejection, exact area/perimeter goldens and no projection feedback. |
| Invariance/performance | Integer translation, D4 reflection/90-degree rotation, endpoint reversal, four diagonal quadrants; explicitly no 45-degree rotation invariant; ProjectLimits 300-wall stress plus NFR-5 measurements. |
| Independent and human evidence | Separately implemented high-precision oracle checks hand-reviewed goldens but never becomes semantic authority. G-1 and physical-phone runs assess the proposed 44-px/zero-hysteresis usability; Playwright emulation and S-2 do not substitute. |

## 11. Canonical adoption route

1. Independent architecture and topology reviewers re-review this revision and
   the completed corpus. Any policy correction changes this input first, not a
   library/config default.
2. Fresh bmad-architecture **update** appends accepted decisions through
   _bmad/scripts/memlog.py, re-distils only affected stable ADs, runs lint and
   the full reviewer gate.
3. bmad-spec re-derives SPEC.md and geometry-contract.md; bmad-prd owns the
   FR/NFR implications; bmad-ux owns visible candidate/reconciliation/
   confirmation copy and controls.
4. Epics, traceability and readiness reconcile only after owner artifacts
   agree. Then the bounded topology gate may be assessed again.

Until all four steps complete, this document is a decision input only. It does
not authorize source promotion from S-2, root implementation, a package
manifest, tests, CI, a commit or a claim of READY.
