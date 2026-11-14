---
title: Implementation Readiness Recheck
date: 2026-08-04
project: InteriorsEditor
assessment_kind: recheck
prior_assessment: implementation-readiness-report-2026-08-04.md
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
assessed_by: bmad-check-implementation-readiness
final_status: NOT_READY
included_documents:
  spec:
    - ../specs/spec-interiors-editor-alpha/SPEC.md
    - ../specs/spec-interiors-editor-alpha/glossary.md
    - ../specs/spec-interiors-editor-alpha/geometry-contract.md
    - ../specs/spec-interiors-editor-alpha/asset-import-contract.md
    - ../specs/spec-interiors-editor-alpha/performance-budgets.md
    - ../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  prd:
    - prds/prd-InteriorsEditor-2026-07-26/prd.md
    - prds/prd-InteriorsEditor-2026-07-26/addendum.md
  architecture:
    - architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
    - architecture/architecture-InteriorsEditor-2026-07-26/domain-model.md
    - architecture/architecture-InteriorsEditor-2026-07-26/solution-design.md
  epics:
    - epics.md
  ux:
    - ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
    - ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  supporting_traceability:
    - roadmap-to-alpha.md
    - traceability-matrix.md
    - quality-strategy.md
---

# Implementation Readiness Assessment Report — Recheck

**Date:** 2026-08-04  
**Project:** InteriorsEditor  
**Assessment:** повторная проверка после подготовки `epics.md`; исходный отчёт `implementation-readiness-report-2026-08-04.md` сохранён без изменений.

## 1. Document Discovery

### PRD Files Found

**Authoritative document package:**

- Folder: `prds/prd-InteriorsEditor-2026-07-26/`
  - `prd.md` (53,515 bytes; modified 2026-07-26 23:31:56 +0300)
  - `addendum.md` (5,564 bytes; modified 2026-07-26 23:34:33 +0300)

### Architecture Files Found

**Authoritative document package:**

- Folder: `architecture/architecture-InteriorsEditor-2026-07-26/`
  - `ARCHITECTURE-SPINE.md` (23,578 bytes; modified 2026-07-26 23:28:56 +0300)
  - `domain-model.md` (11,934 bytes; modified 2026-07-26 23:28:56 +0300)
  - `solution-design.md` (18,324 bytes; modified 2026-07-26 23:28:56 +0300)
  - `reviews/` (supporting review package)

### Epics & Stories Files Found

**Whole document:**

- `epics.md` (136,036 bytes; modified 2026-08-04 11:00:59 +0300)

### UX Design Files Found

**Authoritative document package:**

- Folder: `ux-designs/ux-InteriorsEditor-2026-07-26/`
  - `DESIGN.md` (11,296 bytes; modified 2026-07-26 23:00:50 +0300)
  - `EXPERIENCE.md` (25,608 bytes; modified 2026-07-26 23:31:53 +0300)

### Discovery Result

- Critical planning document types are present.
- No whole-versus-sharded duplicate was found for PRD, Architecture, Epics, or UX.
- Project memlogs were detected but excluded from assessment as append-only operational records.
- Per standing product-owner authorization, the discovered authoritative documents are selected for validation.

## 2. PRD Analysis

### Functional Requirements

1. **FR-1 — Create Project:** Пользователь может создать Project с рабочим названием и одним пустым Level.
2. **FR-2 — List, Open and Rename:** Пользователь может увидеть локальные Projects, открыть и переименовать выбранный Project.
3. **FR-3 — Duplicate Variant:** Пользователь может создать независимую копию Project как новый вариант.
4. **FR-4 — Delete With Recovery Boundary:** Пользователь может переместить Project в локальную Trash, восстановить его или удалить permanently после отдельного подтверждения.
5. **FR-5 — Autosave and Recovery:** Система переводит каждый Validated Command через PendingDurability и восстанавливает последнюю Durable Revision после закрытия, crash или process eviction.
6. **FR-6 — Rectangular Room Starter:** Пользователь может создать первую прямоугольную Room, указав внутреннюю ширину, глубину и высоту в миллиметрах.
7. **FR-7 — Draw Constrained Wall:** Пользователь может рисовать Wall пальцем в направлениях, разрешённых Alpha grid policy: ортогонально или под 45°.
8. **FR-8 — Exact Numeric Wall Input:** Пользователь может задать точную координату Vertex или желаемую длину Wall в миллиметрах.
9. **FR-9 — Move and Split Topology:** Пользователь может перемещать Vertex, разделять Wall и добавлять Wall к существующей Vertex.
10. **FR-10 — Edit Wall Properties:** Пользователь может изменить толщину Wall; длина определяется Vertex, а высота выводится из ceiling height соседних Room.
11. **FR-11 — Remove Geometry:** Пользователь может удалить Wall или Vertex, если результирующая операция определена и валидна.
12. **FR-12 — Geometry Validation:** Система отклоняет zero-length walls, duplicate segments, запрещённые направления, self-intersections и недопустимые topology transitions.
13. **FR-13 — Measurements:** Пользователь видит centerline length Wall, внутренние размеры Room, площадь, периметр и точное расстояние между двумя выбранными точками/границами предметов в миллиметрах/квадратных метрах по документированным правилам округления.
14. **FR-14 — Derive Closed Rooms:** Система определяет Room из замкнутых граней PlanGraph и обновляет их после каждого topology commit.
15. **FR-15 — Preserve Room Identity:** При локальном изменении границы система по возможности сохраняет `roomId`, название и finishes той же семантической Room.
16. **FR-16 — Edit Room Parameters:** Пользователь может задать Room name/type и ceiling height; геометрические размеры и площадь выводятся из PlanGraph.
17. **FR-17 — Add Door:** Пользователь может добавить Door на Wall, задав width, height, sill/threshold policy и offset.
18. **FR-18 — Add Window:** Пользователь может добавить Window на Wall, задав width, height, sill height и offset.
19. **FR-19 — Edit and Remove Opening:** Пользователь может численно или touch-жестом переместить, изменить и удалить Opening.
20. **FR-20 — Navigate Through Door:** В 3D пользователь может активировать Door, которая ведёт в соседнюю Room, и перейти в неё.
21. **FR-21 — Switch View:** Пользователь может переключаться между Plan View и 3D View без потери selection, PendingDurability status или camera-independent domain data.
22. **FR-22 — Deterministic 3D Projection:** Система процедурно строит стены, проёмы, полы и потолки из одного Project state.
23. **FR-23 — Inspect 3D:** Пользователь может orbit/pan/zoom сцену и выбрать Room surface или ItemInstance.
24. **FR-24 — Walk Mode:** Пользователь может войти в read-only first-person inspect mode, менять направление взгляда, переходить в соседнюю Room через валидную Door и выйти обратно в edit mode.
25. **FR-25 — Adaptive Quality:** Система изменяет pixel ratio, shadows, effects и LOD при снижении runtime performance, не меняя Project.
26. **FR-26 — Browse Catalog Categories:** Пользователь может открыть категории furniture, plumbing, appliances/electronics, lighting и accessories.
27. **FR-27 — Search and Filter:** Пользователь может найти asset по названию/категории и отфильтровать по AnchorClass или основным габаритам.
28. **FR-28 — Place Item:** Пользователь может разместить ItemInstance только на совместимой поверхности согласно AnchorClass.
29. **FR-29 — Transform Item:** Пользователь может переместить, вращать и, если AssetDefinition разрешает, менять габариты ItemInstance.
30. **FR-30 — Item Actions:** Пользователь может duplicate, lock/unlock and delete ItemInstance.
31. **FR-31 — Collision and Clearance Feedback:** Система показывает пересечение footprint и заданных clearance zones с Wall, Opening или другими ItemInstance.
32. **FR-32 — Parametric Placeholder:** Пользователь может создать простой box item с name, width, depth, height, color and AnchorClass.
33. **FR-33 — Apply Item Color or Variant:** Пользователь может применить разрешённый color/material variant к отмеченным recolorable slots ItemInstance.
34. **FR-34 — Apply Floor Finish:** Пользователь может применить один preset SurfaceFinish к floor surface выбранной Room.
35. **FR-35 — Apply Wall Finish:** Пользователь может применить preset SurfaceFinish независимо к доступной стороне Wall.
36. **FR-36 — Apply Ceiling Finish:** Пользователь может применить preset SurfaceFinish к ceiling surface выбранной Room.
37. **FR-37 — Finish Offline Availability:** Exact referenced runtime bytes используемых finishes pin-ятся и входят в backup envelope до Durable assignment. При повторном открытии renderer использует их offline либо строит явно обозначенный deterministic low-fidelity projection, не теряя referenced resource. Catalog gate подтверждает полный AssetUsageGrant и обязательное размещение notice.
38. **FR-38 — Undo and Redo:** Пользователь может undo/redo каждый Durable Command в текущей session history boundary.
39. **FR-39 — Cancel Active Gesture:** Пользователь может отменить Active Gesture без создания history entry или autosave mutation.
40. **FR-40 — Explain Invalid Operation:** При отклонении команды система объясняет, какое правило нарушено, сохраняет предыдущее valid state и предлагает доступное действие.
41. **FR-41 — Installable PWA:** На поддерживаемой платформе пользователь может установить PWA и запустить её в standalone mode.
42. **FR-42 — Offline Reopen and Edit:** После первого успешного открытия app shell и Project пользователь может в airplane mode открыть Project, изменить PlanGraph с локально доступными assets и сохранить его.
43. **FR-43 — Storage Health:** Система показывает storage usage/pressure, запрашивает persistence где доступно и обрабатывает quota exhaustion без silent data loss.
44. **FR-44 — Portable Backup Export:** Пользователь может экспортировать versioned Portable Backup, достаточный для восстановления Project.
45. **FR-45 — Portable Backup Import:** Пользователь может импортировать совместимый Portable Backup с validation, migration и atomic commit.
46. **FR-46 — PNG Snapshot:** Пользователь может сохранить или вызвать системный share для PNG-снимка выбранного Plan/3D view.
47. **FR-47 — Coordinated App Update:** Активный editor предлагает reload только после Durable Revision. Корректность не зависит от удержания waiting worker: каждый startup проверяет совместимость shell/worker/Project/catalog schema и выполняет recoverable migration.
48. **FR-48 — Select Static GLB (Alpha+):** Пользователь может выбрать один локальный `.glb` файл; `.gltf`, OBJ, FBX и архивы отклоняются в Alpha+.
49. **FR-49 — Preflight Resource Policy (Alpha+):** До любого general-purpose loader система byte-level проверяет format/version, JSON chunk, external/data URI, required extensions и declared resources; затем по стадиям проверяет nodes, meshes, primitives, triangles, vertices, materials, textures, decoded memory estimate and bounding box.
50. **FR-50 — Preview and Classify (Alpha+):** После успешного preflight пользователь видит изолированный preview, подтверждает реальные dimensions in mm, pivot/orientation, AnchorClass and recolorable slots.
51. **FR-51 — Reject Unsafe or Unsupported Asset (Alpha+):** Система отклоняет unknown required extension, external/network URI, animation, skin, morph target, camera, light, invalid metadata и превышение любого hard budget.
52. **FR-52 — Persist Imported Asset (Alpha+):** Подтверждённый ImportedAsset получает internal ID, content hash, validated metadata and local blob reference.

**Total FRs: 52** — FR-1–FR-47 относятся к Alpha entry; FR-48–FR-52 относятся к Alpha+.

### Non-Functional Requirements

1. **NFR-1 — Canonical precision:** все persisted coordinates, dimensions and offsets — целые миллиметры; save/reopen и backup roundtrip дают 0 мм semantic drift.
2. **NFR-2 — Projection boundary:** renderer использует metres только после явного conversion at adapter boundary; обратное преобразование не владеет domain state.
3. **NFR-3 — Atomic validity:** failed command оставляет Project byte/semantically equivalent предыдущей Durable Revision; validated candidate не называется saved до persistence pointer swap.
4. **NFR-4 — Determinism:** одинаковый versioned Project и catalog versions создают одинаковую topology, RoomGraph и material assignments.
5. **NFR-5 — Gesture responsiveness:** на reference mid-tier device main-thread block во время gesture не превышает 50 ms; target p95 frame time во время drag — не хуже 33 ms.
6. **NFR-6 — Reference scene:** provisional alpha benchmark — до 6 Room, 60 ItemInstance, 750k visible triangles, 250 draw calls и 128 MiB estimated GPU resources; точные limits подтверждаются spikes.
7. **NFR-7 — Startup:** provisional target — first editable empty room ≤3 s cold на reference network/device и ≤1.5 s warm offline.
8. **NFR-8 — Thermal stability:** 15-minute editing run не приводит к crash, потере input или неконтролируемому падению качества; adaptive tier может снижаться.
9. **NFR-9 — Demand rendering:** вне animation/gesture scene не обязана непрерывно рендериться.
10. **NFR-10 — Offline core:** core editing не зависит от Background Sync или активного backend.
11. **NFR-11 — Recovery:** abrupt termination в любой момент восстанавливает последнюю Durable Revision; recovery evidence покрывается automated и device tests на каждой границе staging/pointer swap.
12. **NFR-12 — Migration:** каждая schema migration имеет fixtures previous versions, idempotence policy и rollback/backup boundary.
13. **NFR-13 — Storage pressure:** приложение само не удаляет Project при quota error и даёт recoverable UX/backup path; browser/OS origin eviction считается внешним риском и проверяется restore из Portable Backup. Missing/corrupt referenced hash переводит Project в read-only `ResourceRecoveryRequired`; auto-discard session history запрещён.
14. **NFR-14 — Rendering baseline:** WebGL 2 обязателен для alpha; WebGPU является feature flag/progressive enhancement и не меняет semantics.
15. **NFR-15 — Device matrix:** поддерживаемые iOS/Android/browser/RAM combinations фиксируются до implementation kickoff; desktop browser используется для development, но не является alpha UX acceptance surface.
16. **NFR-16 — Capability detection:** renderer, storage and installability определяются по capabilities, а не только user-agent.
17. **NFR-17 — Touch floor:** интерактивные DOM-targets не меньше 44×44 CSS px, учитывают safe areas и не зависят от hover.
18. **NFR-18 — Accessible controls:** DOM controls, forms, dialogs and navigation соответствуют WCAG 2.2 AA; validation связана с полем и озвучивается assistive tech.
19. **NFR-19 — Numeric alternative:** критическое действие 3D/touch имеет доступную numeric/list alternative там, где canvas сам по себе недоступен.
20. **NFR-20 — Motion:** reduced-motion preference убирает необязательную camera/transition animation.
21. **NFR-21 — Local privacy:** без явного consent Project geometry, screenshots and ImportedAssets не отправляются во внешнюю систему.
22. **NFR-22 — Import isolation (Alpha+):** untrusted GLB проходит byte-level deny-network preflight, allowlist и staged resource limits; metadata не интерпретируется как HTML; Worker не считается hard memory sandbox.
23. **NFR-23 — Telemetry minimization:** analytics, если включены, не содержат plan geometry, asset binary, file names or screenshots; opt-out определён до public alpha.
24. **NFR-24 — Stable contracts:** `CAP-*`, `FR-*`, `NFR-*`, `AD-*` не переиспользуются; breaking schema change повышает version.
25. **NFR-25 — Diagnostics:** alpha feedback содержит app/schema/catalog versions, capability tier and non-sensitive error code, но не пользовательский проект.
26. **NFR-26 — Testability:** domain/topology тестируются без DOM/GPU; renderer и persistence доступны через ports/adapters.

**Total NFRs: 26.** NFR-1–NFR-21 и NFR-23–NFR-26 применимы к Alpha entry; NFR-22 является `N/A by scope` до переноса custom GLB в Alpha entry.

### Additional Requirements and Constraints

- Alpha entry исключает custom GLB import; `FR-48`–`FR-52` и `NFR-22` входят в Alpha+ и не блокируют первый usable release.
- До начала implementation должны быть подтверждены geometry/grid policy, алгоритм сохранения `roomId` при split/merge, self-contained `.interiors` policy/limits, asset licensing/provenance ownership и minimum real-device matrix.
- Числовые defaults, device floor и import budgets из PRD Addendum — рекомендации для spike, а не утверждённый implementation contract.
- Required alpha validation включает реальные iOS/Android usability/performance tests; browser emulation не заменяет этот gate.
- Git repository и безопасный branching/worktree workflow указаны как precondition.

### PRD Completeness Assessment

PRD содержит полный нумерованный набор из 52 FR и 26 NFR, явно отделяет Alpha entry от Alpha+ и задаёт measurable quality targets. Требования достаточно структурированы для проверки покрытия эпиками. Однако несколько отмеченных в PRD phase blockers остаются неразрешёнными; они будут проверены на трассировку в эпиках, UX и архитектуре и могут препятствовать итоговому `READY`.

## 3. Epic Coverage Validation

### Coverage Matrix

| FR | PRD requirement | Epic/story coverage | Status |
| --- | --- | --- | --- |
| FR-1 | Create Project | Epic 1 / Story 1.1 | ✓ Covered |
| FR-2 | List, Open and Rename | Epic 1 / Story 1.2 | ✓ Covered |
| FR-3 | Duplicate Variant | Epic 1 / Story 1.4 | ✓ Covered |
| FR-4 | Delete With Recovery Boundary | Epic 1 / Story 1.5 | ✓ Covered |
| FR-5 | Autosave and Recovery | Epic 1 / Story 1.1 (plus 1.3 fencing) | ✓ Covered |
| FR-6 | Rectangular Room Starter | Epic 2 / Story 2.1 | ✓ Covered |
| FR-7 | Draw Constrained Wall | Epic 2 / Story 2.2 | ✓ Covered |
| FR-8 | Exact Numeric Wall Input | Epic 2 / Story 2.2 | ✓ Covered |
| FR-9 | Move and Split Topology | Epic 2 / Stories 2.3–2.4 | ✓ Covered |
| FR-10 | Edit Wall Properties | Epic 2 / Story 2.5 | ✓ Covered |
| FR-11 | Remove Geometry | Epic 2 / Story 2.6 | ✓ Covered |
| FR-12 | Geometry Validation | Epic 2 / Stories 2.2–2.6 | ✓ Covered |
| FR-13 | Measurements | Epic 2 / Story 2.1 | ✓ Covered |
| FR-14 | Derive Closed Rooms | Epic 3 / Story 3.1 | ✓ Covered |
| FR-15 | Preserve Room Identity | Epic 3 / Story 3.1 | ✓ Covered |
| FR-16 | Edit Room Parameters | Epic 3 / Story 3.2 | ✓ Covered |
| FR-17 | Add Door | Epic 3 / Story 3.3 | ✓ Covered |
| FR-18 | Add Window | Epic 3 / Story 3.3 | ✓ Covered |
| FR-19 | Edit and Remove Opening | Epic 3 / Story 3.4 | ✓ Covered |
| FR-20 | Navigate Through Door | Epic 4 / Story 4.3 | ✓ Covered |
| FR-21 | Switch View | Epic 4 / Story 4.1 | ✓ Covered |
| FR-22 | Deterministic 3D Projection | Epic 4 / Story 4.1 | ✓ Covered |
| FR-23 | Inspect 3D | Epic 4 / Story 4.2 | ✓ Covered |
| FR-24 | Walk Mode | Epic 4 / Story 4.3 | ✓ Covered |
| FR-25 | Adaptive Quality | Epic 4 / Story 4.4 and Epic 8 / Story 8.9 | ✓ Covered |
| FR-26 | Browse Catalog Categories | Epic 5 / Story 5.1 | ✓ Covered |
| FR-27 | Search and Filter | Epic 5 / Story 5.1 | ✓ Covered |
| FR-28 | Place Item | Epic 5 / Stories 5.2–5.3 | ✓ Covered |
| FR-29 | Transform Item | Epic 5 / Story 5.4 | ✓ Covered |
| FR-30 | Item Actions | Epic 5 / Story 5.4 | ✓ Covered |
| FR-31 | Collision and Clearance Feedback | Epic 5 / Story 5.5 | ✓ Covered |
| FR-32 | Parametric Placeholder | Epic 5 / Story 5.5 | ✓ Covered |
| FR-33 | Apply Item Color or Variant | Epic 6 / Story 6.1 | ✓ Covered |
| FR-34 | Apply Floor Finish | Epic 6 / Story 6.2 | ✓ Covered |
| FR-35 | Apply Wall Finish | Epic 6 / Story 6.4 | ✓ Covered |
| FR-36 | Apply Ceiling Finish | Epic 6 / Story 6.3 | ✓ Covered |
| FR-37 | Finish Offline Availability | Epic 6 / Story 6.5 | ✓ Covered |
| FR-38 | Undo and Redo | Epic 7 / Story 7.1 | ✓ Covered |
| FR-39 | Cancel Active Gesture | Epic 7 / Story 7.2 | ✓ Covered |
| FR-40 | Explain Invalid Operation | Epic 7 / Story 7.3 | ✓ Covered |
| FR-41 | Installable PWA | Epic 8 / Stories 8.1–8.2 | ✓ Covered |
| FR-42 | Offline Reopen and Edit | Epic 8 / Story 8.2 | ✓ Covered |
| FR-43 | Storage Health | Epic 8 / Stories 8.3–8.4 | ✓ Covered |
| FR-44 | Portable Backup Export | Epic 8 / Story 8.6 | ✓ Covered |
| FR-45 | Portable Backup Import | Epic 8 / Story 8.7 | ✓ Covered |
| FR-46 | PNG Snapshot | Epic 8 / Story 8.8 | ✓ Covered |
| FR-47 | Coordinated App Update | Epic 8 / Story 8.5 | ✓ Covered |
| FR-48 | Select Static GLB (Alpha+) | Epic 9 / Story 9.1 | ✓ Covered |
| FR-49 | Preflight Resource Policy (Alpha+) | Epic 9 / Story 9.1 | ✓ Covered |
| FR-50 | Preview and Classify (Alpha+) | Epic 9 / Story 9.2 | ✓ Covered |
| FR-51 | Reject Unsafe or Unsupported Asset (Alpha+) | Epic 9 / Story 9.1 | ✓ Covered |
| FR-52 | Persist Imported Asset (Alpha+) | Epic 9 / Stories 9.2–9.3 | ✓ Covered |

### Missing Requirements

No PRD FR is missing from the explicit `FR Coverage Map`. The map contains each of `FR-1` through `FR-52` exactly once, and no out-of-range FR was found. Story-level trace entries also provide a concrete delivery path for each mapped FR.

### Coverage Statistics

- Total PRD FRs: 52
- FRs covered in epics: 52
- Coverage percentage: 100%
- Alpha-entry coverage: 47/47 (100%)
- Alpha+ coverage: 5/5 (100%)

## 4. UX Alignment Assessment

### UX Document Status

**Found.** The assessment used the authoritative UX package:

- `ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md`
- `ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md`

The package defines a phone-first interaction model, component vocabulary, screen/state inventory, mobile gesture contract, recovery/error UX, accessible alternatives, PWA/iOS handoff, and real-device validation priorities.

### UX ↔ PRD Alignment

- PRD journeys UJ-1–UJ-6 and UJ-A1 are represented by UXF-1–UXF-6.
- The UX correctly reinforces PRD durability semantics: `saved` is prohibited before a successful Durable Revision, rejected previews do not enter history, and recovery/backup paths are explicit.
- UX preserves the PRD domain boundary: 2D is canonical, 3D is explanatory, and all critical canvas actions have numeric/list or DOM-control alternatives.
- PWA/offline, writer fencing, iOS browser-versus-Home-Screen handoff, storage pressure, resource recovery, update safety, `AssetUsageGrant` notice placement and Alpha+ GLB preflight all have declared UX states.
- UX requirements have a traceable story path in the new epic backlog, notably Stories 1.1–1.5, 2.1–2.6, 3.1–3.4, 4.1–4.4, 5.1–5.5 and 8.1–8.11.

### UX ↔ Architecture Alignment

- AD-2/AD-12 support UX controls and accessible numeric alternatives through a UI-independent `EditorQueryModel`, typed ports and test seams.
- AD-3/AD-4 support visible durable/persistence/recovery/writer-lock states required by AppShell, StatusBanner and recovery screens.
- AD-1/AD-6/AD-7 support exact-mm Plan mode, derived rooms, openings and 2D/3D consistency.
- AD-5/AD-10/AD-11 support WebGL2 fallback/context recovery, adaptive quality and the PWA update interaction described by UX.
- AD-8/AD-14 support ObjectCard, asset pinning, grants/notices, offline-ready state and portable finish/item semantics.

### Alignment Issues

1. **Device acceptance matrix remains unspecified (blocking).** UX and PRD require a minimum supported device floor and real-device evidence; the backlog reflects the owner instruction for iPhone/Samsung devices released in 2021 or later, but no controlled document fixes the actual models/SKUs, OS/browser versions, RAM/GPU characteristics, network/battery condition or 10–15-minute thermal protocol. The broad cohort is not a testable NFR-15 acceptance matrix.
2. **Desktop support wording conflicts with alpha scope (high).** `DESIGN.md` says desktop is supported, while the PRD and project context define desktop only as a development/supporting fallback rather than an alpha authoring target. The documents need one explicit behavior for desktop (for example, compatibility/read-only/best-effort) so the UI is not designed or tested as desktop-authoring parity.
3. **Several UX-critical policies are intentionally unresolved (blocking until chosen):** visual/snap grid and off-grid numeric rule, 45° endpoint quantization policy, room identity/split-merge metadata policy, `.interiors` limits/backup reminder behavior, asset-license owner and public-alpha analytics/privacy decision. UX correctly flags these as decisions that implementation must not silently make.

### Warnings

- The visual system and UX documents remain `draft`; they are suitable for traceability and vertical-slice checkpoints but not a final brand or fixed interaction sign-off.
- The screenshot protocol is represented in the epics, but a screenshot is only review evidence; it cannot substitute for the required functional, offline, accessibility, licensing or real-device performance evidence.

## 5. Epic Quality Review

### What Meets the Standard

- All nine epics are phrased as user outcomes, not technical milestones; no epic is merely “set up database”, “renderer”, or “infrastructure”.
- Every FR has an explicit trace and the stories generally use testable Given/When/Then acceptance criteria with failure paths.
- The plan deliberately retains Alpha+ GLB as a separately gated Epic 9, so it does not create a forward dependency for Alpha entry.
- Most domain ordering is sound: topology precedes multi-room semantics; rooms/openings precede Walk; catalog precedes transforms/collision/finishes; portability follows local project capability.
- The stories explicitly contain real-run screenshot checkpoints. These are appropriate review checkpoints but not substitutes for their linked evidence IDs.

### 🔴 Critical Violations

1. **History is required before it is planned (EQ-1).** Epic 7 defines `FR-38`–`FR-40` only after Epics 2–6, but the roadmap requires safe history already in V-02. Stories 2.1–2.6, 3.4, 5.2–5.5 and 6.1–6.5 already trace `FR-38`–`FR-40` and/or require undo, redo, cancellation or rejected-command behavior in their ACs. This is a direct forward dependency: the first geometry slice cannot truthfully be independently completed if the command/history rules are deferred to Epic 7.

   **Remediation:** introduce the complete reusable Command/Revision/history boundary immediately after V-01 (or fold it explicitly into Story 1.1 before any mutable feature); move Epic 7 to that point or redefine it as later regression coverage only. Every early mutation story must use that already-existing boundary, not reimplement a partial one.

2. **V-13/V-14 are placed before their declared roadmap prerequisites (EQ-2).** Story 1.4 is traced as `V-13 (full-project regression)` and Story 1.5 as `V-14`, but the approved roadmap declares `V-13 → V-12` and `V-14 → V-13`; G-7 starts only after G-4–G-6 pass. In the current epic order, both stories occur in Epic 1 before geometry, catalog, finishes and their resource lifecycle exist. A minimal empty-project duplicate/Trash operation could be an early slice, but it cannot be represented as the full V-13/V-14 evidence.

   **Remediation:** either move the full FR-3/FR-4 evidence stories to the post-V-12 / G-7 phase, or split each into an early minimal local-project operation and a later full-project regression/evidence story with the correct V-13/V-14 trace. Do not claim the latter completion early.

### 🟠 Major Issues

3. **Story 4.2 requires future ItemInstance capability (EQ-3).** FR-23 and Story 4.2 promise selection of a `Room surface` *or* `ItemInstance`, but catalog/item creation first appears in Epic 5. The story can validate surface selection in Epic 4, but it cannot independently deliver or test the ItemInstance portion of FR-23 before Epic 5.

   **Remediation:** split “select Room surface in 3D” into Epic 4 and add “select ItemInstance in 3D with the same inspector semantics” after Story 5.2/5.3, or explicitly supply a prior non-catalog fixture through a documented dependency. Keep the full FR trace only when both cases are complete.

4. **FR-10 and FR-11 completion is cross-epic but the coverage map presents it as complete in Epic 2 (EQ-4).** Stories 2.5 and 2.6 explicitly defer Opening-aware validation/orphan handling until Opening objects exist in Epic 3; Story 3.4 later carries them only as cross-cutting traces. This is reasonable vertical staging, but the map’s single-Epic-2 claim overstates the completion point of their PRD consequences.

   **Remediation:** mark `FR-10`/`FR-11` as phased coverage (base geometry in Story 2.5/2.6; opening-aware completion in Story 3.4) and give the latter explicit primary trace/AC ownership. This makes the dependency and final acceptance location auditable.

5. **Stories 8.10 and 8.11 are release-validation programs, not independently sized implementation stories (EQ-5).** Each spans virtually all Alpha capabilities, all prior flows and device/evidence gates. They are valuable, but cannot be completed by one vertical-slice owner as ordinary stories and do not introduce a new end-user behavior.

   **Remediation:** retain them as G-8/V-19/V-20 release-gate checklists or test plans with named evidence owners; remove them from the implementation-story count or decompose only the product changes they reveal into normal stories.

6. **The greenfield bootstrap is absent and its toolchain decision is still deferred (EQ-6).** The repository has no Git repository, package manifest, source tree, test configuration or CI configuration; Architecture explicitly leaves Node LTS/patch, package manager/lockfile, browser target and starter choice unresolved. No first story establishes the approved scaffold. The project’s phase rule also prohibits creating those artifacts before `READY` or a written waiver.

   **Remediation:** after readiness blockers are resolved, create a narrowly scoped, owner-approved bootstrap story that fixes the toolchain/lockfile/build target and test/quality gates without bypassing the architecture spike decisions. It must not be started while the phase gate remains closed.

### 🟡 Minor Concerns

7. **Several ACs use external “approved policy” inputs without a pinned decision ID (EQ-7).** Examples include room reconciliation in Story 3.1, opening relocation in Story 3.4, catalog grant/budgets in Stories 5.1–6.5 and the device matrix in Stories 8.2/8.9. Gates are called out, but the concrete decision/ADR evidence is not yet present.

   **Remediation:** link each execution gate to its accepted ADR/decision record and immutable fixture/corpus before assigning an implementation owner.

8. **Implementation ownership is not assigned (EQ-8).** The project invariant requires one implementation owner per vertical slice, while the epic document provides no owner or handoff field. This is not a product-design defect, but it blocks the requested multi-agent execution model from safely editing in parallel.

   **Remediation:** assign one owner and one independent reviewer per approved vertical slice only after re-sequencing and gates are satisfied.

### Best-Practice Checklist

| Check | Result |
| --- | --- |
| Epics deliver user value | Pass |
| FR traceability | Pass (52/52) |
| Story AC format and error coverage | Mostly pass |
| Epic independence / no forward dependencies | Fail — EQ-1, EQ-2, EQ-3 |
| Story sizing | Concerns — EQ-5 |
| Greenfield bootstrap and toolchain readiness | Fail — EQ-6 |
| Execution-gate linkage | Concerns — EQ-7 |

**Quality-review result:** the new backlog is materially stronger and traceable, but it is not yet implementation-ready because its sequencing would force early stories to rely on future work or to overclaim later roadmap evidence.

## 6. Summary and Recommendations

### Overall Readiness Status

## NOT READY

The recheck confirms complete FR traceability (`52/52`) and materially improved story-level acceptance criteria, but the planning package does not pass the implementation gate. Two critical ordering defects, unresolved product/technical gates and the missing greenfield bootstrap prevent a safe first implementation slice. The owner’s standing authorization to continue workflow menus and proceed with the project does not constitute a written waiver of the project’s `READY` gate or of the unresolved safety/compatibility decisions.

### Critical Issues Requiring Immediate Action

1. **Repair the execution order:** establish the reusable Command/Revision/undo/redo/cancel/rejection boundary before V-02; do not defer it to Epic 7 after mutable feature epics.
2. **Repair V-13/V-14 sequencing:** do not claim full-project variant/Trash/recovery evidence in Epic 1 when the roadmap requires V-12 first. Split early local-lifecycle behavior from later full-project regression, or move those stories to G-7.
3. **Resolve the explicit pre-implementation decisions and evidence gates:** S-1 renderer, S-2 topology/room/opening policy, S-3 storage/PWA, S-4 touch, S-6 catalog/legal pipeline; the provisional documents currently provide hypotheses, not accepted outputs.
4. **Publish a testable device matrix:** the current “iPhone/Samsung released in 2021 or later” direction must become named floor/typical models/SKUs with OS, browser, RAM/GPU, battery/network state and thermal protocol. It is required before implementation kickoff by NFR-15 and the performance companion.
5. **Close the greenfield foundation:** initialize the approved Git/toolchain/lockfile/build-target/test-quality setup only after the above gate is `READY` (or the owner supplies a specific written waiver).

### Recommended Next Steps

1. In a fresh documentation workflow, revise only the epic/story plan to resolve EQ-1 through EQ-5, preserve all `CAP-*`, `FR-*`, `NFR-*` and `AD-*` identifiers, and assign one implementation owner plus one independent reviewer per reordered vertical slice.
2. Record product decisions and accepted spike outputs as immutable, linkable evidence: grid/snap/off-grid/45° policy; X/T intersections; Room split/merge identity; Opening relocation; collision tiers; `.interiors` envelope; catalog AssetUsageGrant owner; analytics/privacy; desktop behavior; and the exact device matrix.
3. Re-run implementation readiness after those documentation changes and evidence records exist. Only a `READY` result or a narrow written waiver should unlock the bootstrap story and the first V-01/V-02 implementation work.

### Final Note

This assessment found **8 backlog-quality findings** (2 critical, 4 major, 2 minor) and **3 cross-document alignment blockers**. No application code, package manifest, build configuration, test suite, generated asset or deployment configuration was created by this workflow. The previous readiness report remains intact; this file is a separate dated recheck.
