---
title: "InteriorsEditor — Sprint Change Proposal: delegated alpha decisions and evidence ownership"
date: 2026-08-05
project: InteriorsEditor
workflow: bmad-correct-course
mode: Batch
decision: Direct Adjustment
status: applied-documentation-only
approval:
  product_owner: Roman
  delegated_written_authorization:
    - "Реши сам кого назначить, мне нужно, чтобы решения были приняты для продолжения работы"
  standing_written_authorization:
    - "Я подтверждаю реализацию по всей документации"
    - "Я полностью всё подтверждаю, не спрашивай меня каждый раз, просто делай, что должен"
does_not_grant:
  - production-readiness
  - legal-asset-rights
  - physical-device-evidence
  - user-research-evidence
---

# Sprint Change Proposal — делегированные решения для Alpha

## 1. Issue summary

Планирование уже содержит полный product/UX/architecture backbone, но
исполнение остановлено на двух предотвращаемых организационных причинах:

1. У разрешённых `W-SPK-2026-08-04` evidence-spikes S-1 и S-6 не было
   назначенных owner/reviewer, а будущие V-slices не имели правила назначения.
2. В decision register оставался пакет явных product-policy вопросов. Без
   решения implementation не вправе выбирать grid, collision, Alpha+ scope,
   telemetry и критичные baseline rules незаметно.

Product Owner явно делегировал назначение и принятие рабочих решений. Это
предложение использует делегирование только в доступной области: назначает
технические роли, фиксирует product-policy baseline и маршрутизирует
canonical changes к владеющим BMAD workflows. Оно не выдаёт новый waiver и не
меняет verdict `NOT_READY` из
`implementation-readiness-report-2026-08-04-final-recheck.md`.

## 2. Checklist impact analysis

| Checklist area | Status | Finding / resolution |
| --- | --- | --- |
| Trigger and evidence | [x] Done | Прямое делегирование Product Owner и current ownership registry/gates дают конкретный trigger. |
| Epic impact | [x] Done | Меняется только реестр ownership для S-1/S-6; порядок V-01…V-20, gates и scope не меняются. |
| PRD/SPEC impact | [!] Routed | Product choices требуют canonical reconciliation через `bmad-prd`/`bmad-spec` только там, где меняют owned contracts. Этот proposal их не переписывает. |
| Architecture impact | [!] Routed | Grid/opening/room-identity/X-intersection и G-CP choices должны попасть в evidence-backed `bmad-architecture` update/ADR. |
| UX impact | [!] Routed | Grid feedback, collision reason and consent copy получают UX acceptance only после canonical policy update; текущая UX спецификация не объявляется автоматически изменённой. |
| Direct adjustment | [x] Viable | Documentation assignments and a bounded decision packet устраняют avoidable waiting без обхода evidence gates. |
| Rollback | [N/A] | Product code не начинается, откатывать нечего. |
| MVP reduction | [N/A] | GLB уже отделён как Alpha+; базовый Alpha scope сохраняется. |
| Approval | [x] Done | В frontmatter зафиксировано прямое делегирование и прежнее standing authorization. |

## 3. Recommended approach

Выбран **Direct Adjustment, batch mode**.

Риск реализации остаётся высоким до S-1/S-2/S-3/S-4/S-6, но риск
организационного простоя снижен: у разрешённых spikes есть конкретные agent
roles, а продуктовые defaults больше не являются скрытыми. Оценка изменения —
низкая для документации, средняя для последующей архитектурной
reconciliation, высокая для реального alpha evidence. Никакая строка ниже не
сокращает `G-READY`, `G-1`, `G-CP-ADR`, NFR-15 или AssetUsageGrant.

## 4. Detailed decisions

### 4.1. Ownership and review model — effective immediately for evidence work

| Responsibility | Appointment | Boundary |
| --- | --- | --- |
| Product decisions and external-evidence coordination | Roman, Product Owner | Coordinates device access, participant research and provenance decisions; this appointment is not evidence that any device, participant or right is available. |
| Technical delivery and integration | `Codex /root` | Coordinates dependency order and reviews only packages it did not implement. It is not a human legal or physical-device authority. |
| S-1 renderer evidence owner | `Codex /root/ownership_readiness_review` | Reassigned as the S-1 implementation/evidence owner; may work only in the S-1 prototype/evidence roots after the named reviewer is live. |
| S-1 independent reviewer | `Codex /root/spike_s2_topology` | Does not modify or author the S-1 prototype under review. |
| S-2 topology | Existing `Codex /root/spike_s2_topology` owner and `Codex /root` reviewer remain unchanged | Current terminal recommendation remains `PAUSED` until independent evidence is sufficient. |
| S-3 storage/PWA | Existing `Codex /root/spike_s3_storage` owner and `Codex /root` reviewer remain unchanged | Existing status remains `needs-further-evidence`; no implied PASS. |
| S-4 touch | Existing `Codex /root/spike_s4_touch` owner and `Codex /root` reviewer remain unchanged | Existing status remains `PAUSED`. |
| S-6 catalog evidence owner | `Codex /root` | Synthetic fixtures only until an explicitly authorised sample is available. |
| S-6 independent reviewer | `Codex /root/gcp_decision_research` | Independently checks provenance/negative cases; cannot issue a legal grant. |
| AssetUsageGrant decision coordination | Roman | Roman may approve only rights he actually controls or presents an authorised human steward for; the grant is still `PENDING` until its written evidence exists. |

For every future V-slice, `Codex /root` appoints one implementation owner and
a different independent reviewer only when every listed entry gate is PASS.
No V-slice becomes entered merely by appearing in this proposal.

### 4.2. Product-policy packet — approved by delegated Product Owner authority

These decisions are effective working policy for spike design and future
canonical reconciliation. Their stable D-IDs remain `proposed` in the current
decision register until the owning workflow applies them there; this prevents a
change proposal from impersonating a PRD, SPEC or ADR amendment.

| Decision | Approved working policy | Scope / consequence |
| --- | --- | --- |
| D-011 | “Гридфинити” is an infinite editor grid, not Gridfinity storage. Gesture base snap is 100 mm; visual grid adapts between 100/500/1000 mm by zoom without mutating geometry. | Exact numeric input accepts any integer mm. |
| D-012 | Directions are the eight 45° multiples; diagonal endpoints remain integer-mm. Desired length `L` uses `n = round(L / √2)` and preview discloses the quantised actual length. | No float coordinate becomes canonical state. |
| D-013 | Numeric off-grid input is allowed when every geometry invariant and direction constraint remains valid. | Gestures follow snap priority; numeric input is the precise alternative. |
| D-014 | Outside-room/structural-wall collision blocks Durable placement; item–item and door/technical-clearance collisions warn with an explainable diagnostic; decorative intersection is allowed. | Warning never silently rescales an asset. |
| D-015 | Static custom GLB remains Alpha+ and does not block baseline Alpha. | No GLB feature enters the first Alpha delivery path without separate S-5 evidence and owner decision. |
| D-016 | The first curated catalog is a representative generic, non-branded, mobile-optimised set selected by scenario coverage; 100–150 is a planning range, not an acceptance count. | No item becomes a production catalog resource before its full human-approved grant and notices exist. |
| D-017 | Alpha comparison uses duplicate/Portable Backup plus undo/redo; named option sets are deferred. | Avoids a second variant model before durable/resource semantics are proven. |
| D-018 / D-052 | Walk is read-only and derives one transition only from a valid Door between exactly two derived Rooms; no Door lock/passable/open-close model is introduced. | Renderer/touch proof remains required. |
| D-019 | Registration is not required for first or returning local use. | The control plane never becomes an end-user account or Project service. |
| D-020 | Alpha has no product telemetry. | Local, non-exported diagnostics remain possible; any analytics later requires a new privacy/retention decision. |
| D-021 | Keep Three.js + React Three Fiber only as the provisional `AD-13` hypothesis behind `RendererPort`; do not switch to Babylon.js and do not create/adopt ADR-R1 yet. | S-1 remains synthetic RS-1 Chromium/SwiftShader evidence. Final renderer choice needs closed S1-R1/R2/R3, like-for-like RS-1/RS-2 scenarios, Rspack-compatible bundle evidence and all eight physical NFR-15 contexts. |
| D-041…D-049 | Centerline/Room-height/host-address/Durable/Trash/self-contained-backup/fenced-writer/versioned-limits/history-recovery are ratified as the policy baseline, not as already-proven mechanisms. | Only evidence-backed canonical updates may change provisional thresholds or detailed mechanisms. |
| D-050 | No full human-approved AssetUsageGrant means no Alpha catalog asset. | Concrete rights, notices and grants remain pending human Legal/Asset-steward evidence. |

### 4.2.1. Delegated clarification — 100 mm gesture construction

`D-011`'s 100 mm base snap is a **candidate-construction increment from the
active gesture origin**, not a persisted global-coordinate lattice. This keeps
a valid 45° gesture possible when its selected start Vertex is deliberately
off-grid: the constrained candidate uses an integer `k × direction` delta,
with the relevant axis/diagonal increment quantised in 100 mm steps from that
origin. The origin, selected direction and preview exist only in the
`DraftCommand`; no local lattice, visual grid cell or snap state is persisted
in a Plan, Revision, History or Backup.

The working gesture selection order remains: eligible exact existing Vertex;
eligible exact intersection/end; constrained-direction candidate; then the
100 mm candidate relative to the active origin. A free gesture never silently
changes a supplied off-grid numeric endpoint. Exact numeric input bypasses
this gesture selection entirely. The source-owning architecture/UX workflows
must still define tolerance, equal-candidate tie breaking and visual-grid
hysteresis; this clarification deliberately does not select those values.

### 4.3. Controlled S-2 hypotheses for unresolved topology details

The following are allowed **only as explicit candidates in the isolated S-2
experiment**. They remove accidental library defaults without pretending that a
spike result is already a production ADR. Final selection requires S-2 corpus
evidence and a `bmad-architecture` update before production code:

| Topic | Working decision | Required evidence before canonical adoption |
| --- | --- | --- |
| X intersection | Candidate A: a valid X crossing deterministically creates one shared Vertex and four canonical WallSegments; invalid complete candidates are atomically rejected. | S-2 golden/property corpus and chosen kernel/tolerance ADR. |
| Room identity | Candidate A: a split or merge retains at most one predecessor Room ID: the unique highest exact usable-area overlap with command lineage wins; an exact tie or non-unique lineage returns `ROOM_IDENTITY_AMBIGUOUS`, with no silent property distribution. | S-2 fixed-point corpus, reconciliation tests and UX preview wording. |
| Opening on resized wall | Candidate A: preserve the absolute offset from the stable canonical WallSegment start; preview the outcome and atomically reject a command when the opening no longer fits. | S-2 opening-fit corpus and touch/numeric parity tests. |

### 4.3.1. Delegated resolution — valid X intersection

Under the Product Owner's written delegation, the Alpha **working default** for
an otherwise valid exact X intersection is selected as Candidate A: the
accepted command atomically creates one shared `Vertex` and the four canonical
`WallSegment` pieces. The direction is deliberately narrow:

- it does not select a geometry kernel or close the broader `D-022` decision;
- a non-integer crossing, an out-of-limit coordinate, a self-intersection, a
  collinear overlap, or any candidate failing the full Plan invariants is
  rejected before any `Command` or `Revision` mutation;
- T-intersections retain their already-required shared-Vertex/split behaviour;
- the source-owning `bmad-architecture`, `bmad-prd`, and `bmad-spec` workflows
  must reconcile the precise canonical wording and corpus before production
  code; this adjustment does not itself amend the PRD, SPEC or Architecture
  Spine.

This removes the accidental choice between a silent library rejection and the
current PRD `FR-9` consequence. It remains a working-policy input until the
required independent reviews and canonical owner workflows have completed.

### 4.4. Kotlin/PostgreSQL control-plane decision boundary

The user-selected Kotlin + PostgreSQL stack remains adopted. The following
decision packet is selected for a future **bounded proposed ADR**, based on
official framework compatibility research; it does not yet close `G-CP-ADR`:

| Axis | Selected ADR input |
| --- | --- |
| Build/test | Gradle Wrapper 8.10.2, Kotlin DSL, JDK 21 toolchain, Kotlin 2.4.10; Kotlin tests run only under Gradle. |
| Service/API | Ktor 3.5.1 on JVM/Netty; versioned HTTPS REST/JSON with OpenAPI 3.1 and a public read-only catalog plus separate operator routes. |
| Resources | PostgreSQL stores descriptor/provenance/grant/notices; immutable exact bytes use private S3-compatible object storage at `sha256/<digest>`. The client still validates and pins locally through `CatalogGatewayPort`. |
| Database | PostgreSQL 18.4; Flyway OSS 13.0.0 forward versioned SQL migrations, `flywayValidate` required, production `repair`/`clean` prohibited. |
| Operator security | No end-user account/cookie/session. Operator routes use external OIDC JWT/JWKS with `catalog:publish` and `catalog:withdraw` scopes; no user table. |
| Operations | Stateless single-region container service, managed PostgreSQL, TLS reverse proxy, versioned object storage, daily database backup plus WAL/PITR and a restore drill before release. |
| Privacy/retention | No product analytics; logs exclude bodies, cookies, Project data, IP/referrer and live for 14 days; publication audit records live 365 days. |

`G-CP-ADR-INTAKE.md` remains `inputs_pending` until a dedicated
`bmad-architecture` workflow turns this packet into one ADR and proves that no
request or persistence path accepts Project, Revision, History or Backup data.
The selected packet also still needs real human selection of OIDC issuer,
provider/region, secrets and a grant steward. This proposal deliberately does
not create a backend root, API, schema or deployment configuration.

## 5. Artifact changes and handoff

| Artifact | Old → new | Owner / next workflow |
| --- | --- | --- |
| `epics.md` | S-1 and S-6 change from unassigned placeholders to explicit technical owner/reviewer roles; no gate/status changes. | Applied by this direct adjustment. |
| `decision-register.md` | Remains untouched in this workflow; the decision packet above is its reviewable source input. | `bmad-prd` for product requirement implications; `bmad-architecture` for ADR/register integration. |
| `geometry-contract.md` | Remains draft; the three ambiguity resolutions above are proposed canonical text. | `bmad-architecture` after S-2 evidence. |
| `G-CP-ADR-INTAKE.md` / Architecture | Remain `inputs_pending`; no Kotlin/PostgreSQL implementation is authorised. | Fresh `bmad-architecture` update after architecture research. |
| UX documents | No silent copy changes. | `bmad-ux` reconciliation after adopted policy details. |

## 6. Implementation handoff

Classification: **major planning handoff, minor documentation adjustment**.

1. Start S-1 and S-6 only under the active waiver's exact isolated paths and
   only after their named owner/reviewer agent roles are live.
2. Keep all output synthetic, reproducible and non-production. Each report
   records input provenance, replay commands, negative results, owner and
   reviewer; it ends `PASS`, `PAUSED` or `KILLED/PIVOTED`.
3. Run a fresh `bmad-architecture` workflow to turn evidence plus the
   control-plane decision input into supported ADRs; run the owning product/UX
   workflows for canonical source-of-truth reconciliation.
4. Re-run official implementation readiness only after the stated evidence,
   human inputs and reconciliations exist. Production bootstrap/V-slices remain
   prohibited until a final official `READY`.

## 7. Non-waived blockers

- A full written human-approved `AssetUsageGrant` for every catalog asset and
  subresource, including backup/PNG/notice coverage.
- Real NFR-15 traces on all eight named physical browser/PWA contexts.
- Real G-1 participant research and its independent evidence.
- Evidence-backed terminal statuses for S-1/S-2/S-3/S-4/S-6.
- An adopted `G-CP-ADR` and final independent BMAD readiness `READY`.

No production application code, root package/build/test configuration,
production catalog, deployment or commit is created by this proposal.
