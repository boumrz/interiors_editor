---
title: "TCC-A1: corpus topology и граница legacy migration"
status: draft
version: TCC-A1
updated: 2026-08-10
sources:
  - geometry-contract.md
  - project-and-backup-contract.md
  - portable-backup-ingress-registry.md
  - ../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
---

# TCC-A1 — versioned topology corpus и legacy boundary

`TCC-A1` — source-owned contract для проверяемых fixture corpus и
классификации pre-canonical topology/Project V1/V2. Он не выбирает новый
runtime: `AD-20` уже закрепил domain-owned constrained `PlanGraph` kernel как
единственный topology authority. External geometry engine остаётся
неизменяемым test-only oracle/fixture adapter и сейчас не выбран.

Этот документ задаёт, что должен содержать будущий corpus. Он не утверждает,
что такой полный corpus, мигратор, inspector, importer или PlanGraph уже
реализованы либо прошли независимую проверку.

## 1. Идентичность и неизменность corpus

Каждый published corpus manifest обязан иметь:

- `contractId = interiors.topology-corpus-contract` и `contractVersion = 1`;
- stable `corpusId`, positive `corpusRevision`, immutable fixture IDs и
  SHA-256 raw input bytes каждого fixture;
- exact policy references: Geometry contract, PPJ registry, Project limits и
  adopted `AD-20`;
- declared executor role: `domain-kernel`, `test-only-oracle` или
  `legacy-classifier`; роль oracle не даёт ему mutation, allocation или
  reason-code authority;
- expected outcome и deterministic canonical state digest.

Published fixture bytes, expected outcome и policy references не
перезаписываются. Исправление или новый policy case создаёт новую
`corpusRevision`, сохраняет прежний fixture как historical input и явно
фиксирует supersession. Corpus runner отклоняет malformed manifest, duplicate
fixture ID, missing hash/policy reference или expectation, не вызывая executor.

`apps/web` pre-adoption corpus spine не является сам по себе TCC-A1 evidence:
его fixture manifest может стать входом только после сверки с этим контрактом
и corpus revision. Ни наличие теста, ни совпадение internal implementation
digest не заменяет declared fixture bytes и policy-bound expected outcome.

## 2. Fixture outcome contract

Fixture передаёт executor только immutable base snapshot/bytes и semantic
intent. Expected outcome не передаётся executor-у.

| Outcome | Обязательное доказательство | Запрещено |
|---|---|---|
| `accepted` | exact canonical post-state digest; ordered allocation-intent labels; deterministic fixture-specified opaque IDs; inverse digest, равный base digest | частичный ChangeSet, скрытая allocation или durable publication внутри corpus runner |
| stable geometry reject | source-owned reason из Geometry contract; post-state digest, равный base; пустой allocation intent | replacement reason, nearest-angle/coordinate correction, History или Revision mutation |
| named transient | один уже определённый state: `SelectionUnavailable`, `ConflictPreview`/`AwaitingUserOutcome`, cancel, stale base или lost writer fence; base digest и allocation intent неизменны | превращать transient в stable geometry reason или materialize candidate |
| legacy classification | exact source-byte hash, classifier result из §4 и prescribed handoff/no-effect | PlanGraph construction, pin, ID allocation, Revision, Project publication или RecoveryChangeSet |

`accepted` fixture проверяет только detached domain result и semantic inverse.
Durable publication, writer fence и storage journal проверяются отдельными
adapter corpus, но stale/lost-fence fixture обязан доказать отсутствие
materialization и allocation уже на topology boundary.

## 3. Обязательные suite families

Первая corpus revision, которая может поддержать соответствующий PlanGraph
slice, включает минимум следующие families. Новая command не может назвать
себя corpus-validated по чужой family.

| Family | Минимальные vector classes |
|---|---|
| Raw ingress and directions | SafeIntegerMm lexeme/`-0`, bounds, zero, cardinal and all four signed 45° quadrants, unsupported direction, exact length-only quadrant quantization |
| Contacts and plan invariants | endpoint/Vertex, endpoint/interior T, candidate-interior/junction, one and multi-X, fractional contact, duplicate, overlap, zero/short partition and whole-candidate no-mutation reject |
| Faces and usable geometry | exterior, multi-room, void ring, repeated bounded walk, touching/nested ring, odd thickness/half-mm intermediate, miter cap/bevel and usable-polygon collapse |
| Lineage and hosts | one-to-one Room preservation, automatic `heightMm` inheritance for every valid AddWall split successor, merge choice/re-entry, Opening successor/rehome/delete/cancel, surface and placement host reconciliation |
| Measurement and projections | bound pair request, exact tie, stale result, shared formatted text for Preview/2D/3D/export; canvas/numeric paths pass the same semantic intent |
| Commands and lifecycle | every topology command's allocation intent, inverse-to-base, cancel, stale base, lost fence and no partial ChangeSet/Revision/History effect |
| Legacy and ingress boundary | active Alpha: registered PPJ-A1 versus byte-preserving `legacy-unreadable`, Portable Backup reason precedence and no promotion/migration/pin/publication; a readable/unmappable/future-row assessment vector is required only after its later source-owned grammar/registry row exists |

Golden examples, property chains and hostile vectors use the same manifest
identity. A property or oracle divergence is an evidence finding, not a
canonical mutation and not permission to alter expected reason/ID semantics.

For the first general-wall revision, the `Commands and lifecycle`, `Contacts`,
`Faces` and `Lineage and hosts` families additionally include: explicit
detached start/connected endpoint accepts; a no-intent tap/draft with exact
base/no allocation; deletion of an interior, exterior and face-closing segment
when resulting graph is valid; face-opening/deletion host and Opening conflict
preview/cancel/stale rows; and `WALL_ITEM_COLLISION` of a swept wall body with a
rotated retained floor footprint. `Opening` rows cover an inter-room Door and
   an exterior entrance interval. Placement
rows prove the same `RotationStep` forward result, inverse and reload
projection in 2D and 3D. None may use V1/V2 input or executor behaviour as
expected canonical state.

## 4. V1/V2 classification, migration and recovery matrix

AD-30 регистрирует отдельный portable `V1-legacy` с exact closed grammar,
историческим byte equality и PPJ-disjoint witness по
[portable registry](portable-backup-ingress-registry.md). Это не topology V1/V2
fixture и не PPJ mapping: только полный validated explicit-file import может
создать новый V1 Project ID. Без witness или validation source bytes сохраняются,
а данные не продвигаются. Историческая матрица ниже по-прежнему применяется ко
всем прочим pre-canonical fixture families и не переопределяет эту строку.

`V1`/`V2` here mean only the pre-canonical local topology/Project fixture
families. They never mean `MeasurementFormatPolicy V1`, a PPJ-A1 selector or a
supported portable schema. Classification labels below are corpus labels, not
new public stable reason codes.

| Source and proof | Classifier result | Current permitted handoff | Migration/recovery effect | Forbidden effect |
|---|---|---|---|---|
| Exact manifest/root selector `interiors.project/alpha-1` / `1` passes PPJ-A1 | `current-ppj-a1` | normal current ingress only | normal current resource recovery rules may apply after a Project exists | treating bare V1/V2 number as a selector |
| V1 fixture bytes match a recorded V1 grammar and bounded legacy decoder | `legacy-v1-readable` | immutable source bytes/hash and diagnostic inspector/export if one is implemented | quarantine; no current Project | automatic V1→V2 or V1→PlanGraph conversion |
| V2 fixture bytes match a recorded V2 grammar and bounded legacy decoder | `legacy-v2-readable` | immutable source bytes/hash and diagnostic inspector/export if one is implemented | quarantine; no current Project | automatic V2→PlanGraph conversion |
| Readable V1/V2 cannot produce one complete current mapping under TCC-A1 | `legacy-unmappable` | source bytes/hash plus deterministic assessment result | explicit migration remains blocked; user retains original bytes | inferred rehome, Room/Opening/asset repair, rounding, discard or partial candidate |
| Unreadable, ambiguous or unregistered legacy-looking bytes | `legacy-unreadable` | original bytes outside staging remain untouched; ordinary portable ingress keeps its first earlier `BACKUP_*` reason | no recovery/migration route | shape inference, fallback decoder or current Project view |
| Future legacy selector explicitly registered by a later source-owned row | `legacy-assessment-eligible` only after that row's raw grammar and corpus pass | preserved source plus explicit user-started assessment | may proceed only through §5; failure returns to non-current diagnostic/export state | reuse of a V1/V2 codec as implicit compatibility path |

### Historical Alpha fixture closure — 2026-08-30

At this historical checkpoint no fixture V1/V2 raw grammar, byte-preserving
decoder, diagnostic inspector or future legacy row was registered. Consequently the active
corpus must not manufacture `legacy-v1-readable`, `legacy-v2-readable`,
`legacy-unmappable` or `legacy-assessment-eligible` from a shape guess or the
historical V1/V2 codec. Its active exact-byte matrix instead proves:

- a registered `interiors.project/alpha-1` / `1` input follows only current
  PPJ-A1 ingress; and
- a V1-like, V2-like or unregistered-future candidate is
  `legacy-unreadable`, preserves the original bytes/hash without a Project,
  pin, allocation, Revision, publication or RecoveryChangeSet.

The existing Portable Backup adapter separately proves that a valid current
envelope reaches `BACKUP_SCHEMA_UNREADABLE` at the schema boundary, whereas an
earlier path/container/manifest/checksum/AST failure wins. It does not call the
legacy classifier to replace that earlier reason. A future source-owner row
that supplies an exact selector, closed raw grammar and bounded decoder
supersedes this Alpha closure and activates the corresponding readable,
unmappable and assessment vectors.

For Portable Backup, the PPJ registry retains its existing precedence: unregistered
V1/V2 fixture data outside the AD-30 portable legacy route in an otherwise valid, checksum-valid, AST-R1-admitted current envelope is
`BACKUP_SCHEMA_UNREADABLE`; an earlier path/container/manifest/checksum/limit
failure wins. This classifier does not reclassify an ordinary import failure.

`ResourceRecoveryRequired` and `RecoveryChangeSet` repair exact resources of
an already current, valid Project. They never make a V1/V2 fixture current,
reinterpret its topology, supply missing migration data or discard it. A
readable legacy source therefore remains diagnostic/exportable rather than a
recovered Project until a future migration succeeds.

## 5. Future migration admission

No unregistered topology V1/V2 fixture migration is supported. The distinct
registered portable V1-legacy route is governed by the portable registry.
A future fixture row may become eligible only
when a fresh source-owner update records all of the following:

1. exact legacy selector, closed raw grammar and byte-preserving decoder;
2. exhaustive classification matrix and legacy-to-current stable-reason map;
3. fixture corpus covering lossless, hostile, unmappable and reason-precedence
   cases, reviewed against the selected current PlanGraph policy;
4. explicit user action after an explainable assessment; no startup or reopen
   auto-migration;
5. allocation-free assessment that derives current state only from declared
   legacy authority and never treats legacy face/mesh/index or renderer state
   as canonical;
6. copy-on-write materialization to a **new Project ID**, full current
   PlanGraph/resource/BackupFeasibility validation and one project-scoped
   fenced atomic publication; and
7. preserved source bytes and an exportable/read-only failure path when any
   stage rejects, cancels, loses its fence or cannot publish.

The former local V1→V2 implementation may be used only as a historical
characterization input to these fixtures. It is not a selected migration
algorithm, current schema registry row, reason authority or production handoff.

## 6. Oracle boundary and evidence

No oracle is currently selected. If one is later adopted, its exact version,
input normalization prohibition and fixture subset must be added in a new
corpus revision. It receives immutable fixture data and can report only
equivalence/divergence; it cannot allocate IDs, normalize input, choose an
outcome, mutate canonical state or publish a Project.

Before a topology slice reports corpus evidence, it records the corpus
manifest/hash, executor version, executed fixture IDs, all divergence/timeout/
unavailable outcomes and the independent review result. Green local tests or
browser emulation remain supporting evidence only; they do not make this draft
specification `READY` or prove a portable migration path.
