---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - _bmad-output/specs/spec-interiors-editor-alpha/SPEC.md
  - _bmad-output/specs/spec-interiors-editor-alpha/glossary.md
  - _bmad-output/specs/spec-interiors-editor-alpha/geometry-contract.md
  - _bmad-output/specs/spec-interiors-editor-alpha/asset-import-contract.md
  - _bmad-output/specs/spec-interiors-editor-alpha/performance-budgets.md
  - _bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - _bmad-output/specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - _bmad-output/project-context.md
  - _bmad-output/specs/spec-interiors-editor-alpha/topology-corpus-contract.md
  - _bmad-output/specs/spec-interiors-editor-alpha/editor-interaction-and-grid-contract.md
  - _bmad-output/specs/spec-interiors-editor-alpha/portable-backup-ingress-registry.md
  - _bmad-output/specs/spec-interiors-editor-alpha/implementation-evidence-2026-08-18.md
  - _bmad-output/specs/spec-interiors-editor-alpha/telegram-platform-and-compatibility-contract.md
  - _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md
  - _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-portable-v1-disposition-2026-11-04.md
  - _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/browser-registered-storage-disposition-2026-11-05.md
  - _bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/addendum.md
  - contracts/alpha-release-ux-2026-11-01.md
  - contracts/alpha-release-ux-followup-2026-11-01.md
  - plans/telegram-mini-app-extension-spec-2026-11-04.md
  - plans/telegram-mini-app-s0-preflight-2026-11-04.md
  - plans/telegram-mini-app-s0-prd-result-2026-11-04.md
  - plans/telegram-mini-app-s0-ux-result-2026-11-04.md
  - plans/telegram-mini-app-s0-architecture-result-2026-11-04.md
  - plans/telegram-mini-app-s0-spec-result-2026-11-04.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-21.md
telegramStepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
telegramWorkflowStatus: complete
telegramCorrectionStatus: complete
telegramS2SourceRemediationStatus: complete
telegramAd26Ad30SyncStatus: complete
browserAd31StoryReconciliation: complete
telegramPilotStepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
telegramPilotStoriesStatus: prepared-for-readiness
updated: 2026-11-22
lastSourceReconciliation: 2026-08-30 canonical UX and readiness reconciliation
---

# InteriorsEditor - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for InteriorsEditor, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

На шаге извлечения зафиксированы все найденные обязательные документы. Ниже
находится утверждённый пакетный backlog; его реализация по-прежнему запрещена
до финального официального `READY` BMAD. Отдельный формальный waiver может
разрешить только изолированный disposable evidence-spike и никогда не заменяет
`READY` для production bootstrap или пользовательской Story. Все release-gates
и evidence-gates явно отделены от пользовательских stories.

## Approved scope correction — 2026-08-25

Для всех Alpha stories licensing удалён. Прежние требования к
`AssetUsageGrant`, `assetUsageDeclaration`, legal/provenance admission,
attribution, notice, license ledger и rendered-output rights не имеют
acceptance criteria, execution gate или evidence. Product Owner отбирает
бесплатные или созданные им модели вне приложения. Все соответствующие stories
сохраняют only технические format/size/hash, exact pin,
`BackupFeasibilityPolicy`, recovery и self-contained backup requirements.
Более ранняя legal-формулировка ниже отменена этим разделом, пока не будет
явного нового product decision.

## Canonical reconciliation — 2026-08-30

Этот документ планирует delivery, но не является владельцем поведения.
При расхождении источники применяются в следующем порядке: PRD владеет
`FR-*`/`NFR-*`; SPEC и его companions — `CAP-*`, glossary и domain contracts;
Architecture Spine — `AD-*`; финальные `DESIGN.md` и `EXPERIENCE.md` —
пользовательские поверхности, interaction и state patterns. Этот backlog не
разрешает production implementation до `G-READY`.

Канонические решения для active Alpha scope:

- Расставляемый объект называется `AssetInstance`, а не `ItemInstance`.
- У редактора один контекстный `ActionDock`; `ViewSwitch` в верхней панели
  устойчиво переключает «План / 3D». Бывшие названия `ToolRail`,
  `ModeSwitcher` и `UndoRedoBar` не являются компонентами к реализации.
- 2D и 3D отображают одну Durable Revision. У напольного `AssetInstance`
  доступны перемещение и поворот; у настенного сохраняется host address и
  редактирование идёт через свойства/точные host-local значения, без свободного
  drag, который мог бы потерять привязку.
- `Opening` создаётся с width, height, offset и `sillMm`: для двери поле
  показывается как «Порог / нижняя отметка», для окна — «Высота подоконника».
- Покрытия Room/Wall, `SurfaceAssignment` и `UX-DR18` retired и не входят в
  delivery scope. `CAP-7` здесь означает только resource-backed item variant.

Устаревшие ссылки `UX-DR*` в Trace сохранены только как исторические
локаторы. Их delivery-эквиваленты: `UX-DR1/5/7` — EditorTopBar, ViewSwitch и
ActionDock; `UX-DR2/3/4` — token/typography/layout foundation; `UX-DR6/21/
24–28/35/38` — state patterns и Surface×State; `UX-DR8/10/14/22/36/37` —
GeometryPreview, DimensionInput и interaction rules; `UX-DR9/17` — Catalogue
и placement; `UX-DR11/13/23` — 3D/ViewSwitch; `UX-DR15/16` — UXF-1/UXF-2;
`UX-DR19` — UXF-4; `UX-DR20` — UXF-A1. `UX-DR18` не имеет active mapping.
Mobile/accessibility behaviours остаются обязательными; их формальная
360 px/keyboard/safe-area/contrast/DOM proof по решению владельца переносится
в implementation QA, а не считается уже выполненным evidence.

## Requirements Inventory

### Functional Requirements

FR-1: Пользователь может создать локальный Project с рабочим названием и одним пустым Level; проект получает стабильный ID, schemaVersion, timestamps и valid initial state без аккаунта или сети после загрузки app shell.

FR-2: Пользователь может видеть список локальных Projects, открыть и переименовать выбранный Project; список различает empty, loading, corrupted и populated states, а переименование не меняет ID и не дублирует данные.

FR-3: Пользователь может создать независимый вариант Project с новым ID, сохранив размеры и asset references так, чтобы последующие изменения копии не меняли оригинал.

FR-4: Пользователь может окончательно удалить Project только после отдельного явного подтверждения; промежуточный delete-state и undo-route в Alpha отсутствуют, а ошибка не оставляет частично удалённые metadata/Revisions.

FR-5: Система проводит каждый Validated Command через PendingDurability и восстанавливает последнюю Durable Revision после закрытия, crash или eviction; UI различает saving, saved, persist-failed и recovery-needed, а saved появляется только после atomic pointer swap.

FR-6: Пользователь может создать первую прямоугольную Room по внутренним width, depth и height в мм; невалидные/выходящие за bounds значения отклоняются, PlanGraph замыкается в одну Room, а usable interior polygon точно соответствует введённым размерам.

FR-7: Пользователь может рисовать Wall пальцем только в разрешённых alpha directions: ортогонально или под 45°; preview показывает длину и направление, а недопустимое направление детерминированно snap-ится либо отклоняется.

FR-8: Пользователь строит и редактирует constrained Wall прямым touch-жестом; глобальные координаты Vertex/Wall не являются пользовательским вводом в Alpha. Жестовый candidate создаёт валидный segment либо объясняет конфликт, а canonical integer-mm geometry и 45° quantized preview сохраняются до подтверждения.

FR-9: Пользователь может перемещать Vertex, split-ить Wall и добавить Wall к существующей Vertex; пересечение атомарно создаёт общую Vertex и нужные Wall segments, не изменяя несвязанные части плана.

FR-10: Пользователь может изменить thickness Wall в мм; длина определяется Vertex, высота выводится из соседних Room, связанные Opening валидируются до commit, а shared Wall и Opening соблюдают правила максимум/минимум высот.

FR-11: Пользователь может удалить Wall или Vertex только если результирующая операция определена и валидна; значимые исчезновение/merge Room preview-ятся, а orphaned Opening обрабатывается одной атомарной командой.

FR-12: Система отклоняет zero-length walls, duplicate segments, запрещённые направления, self-intersections и недопустимые topology transitions, возвращая затронутый объект, правило и способ исправления без history entry или autosave для rejected command.

FR-13: Пользователь видит centerline length Wall, внутренние dimensions Room, area, perimeter и точное расстояние между выбранными точками/границами в документированных единицах и правилах rounding; display rounding не меняет canonical values.

FR-14: Система выводит Room из замкнутых Face PlanGraph после каждого topology commit; open contour и Room с неположительной площадью не создают Room.

FR-15: При локальной смене topology система по возможности сохраняет roomId, name и height семантически той же Room; matching алгоритм и split/merge policy документированы и проверяются fixtures.

FR-16: Пользователь может задать Room name, Room.type и height; геометрия и площадь выводятся из PlanGraph, а Room.heightMm остаётся единственным пользовательским источником высоты помещения и производной высоты стен.

FR-17: Пользователь может добавить Door на Wall с width, height, sill/threshold policy и offset; Door полностью лежит в допустимом интервале, не пересекает другой Opening и связывает две Room либо Room и Exterior.

FR-18: Пользователь может добавить Window на Wall с width, height, sill height и offset; 2D и 3D используют те же параметры Opening.

FR-19: Пользователь может touch-жестом или численно переместить, изменить и удалить Opening; изменение Wall либо сохраняет Opening валидным по утверждённой policy, либо блокирует commit с preview конфликта.

FR-21: Пользователь может переключаться между Plan View и 3D View без потери selection интерактивного Wall или AssetInstance, PendingDurability status или camera-independent domain data; derived Room не получает selection state.

FR-22: Система детерминированно строит стены, openings и floors из единого Project state; reload одной версии создаёт семантически тот же 3D result, а renderer objects не являются сериализуемым источником истины.

FR-23: Пользователь может orbit/pan/zoom 3D-сцену и выбрать AssetInstance, когда он существует; Room surface display-only и не имеет picker/property selection route. Gesture contract разделяет camera navigation и transform объекта, а AssetInstance selection имеет доступную numeric/property surface.

FR-25: Система адаптирует pixel ratio, shadows, effects и LOD при снижении runtime performance без изменения Project и без блокировки touch editing; diagnostics могут показать compatibility/quality tier.

FR-26: Пользователь может открыть catalog categories furniture, plumbing, appliances/electronics, lighting и accessories. Каталог различает `control-plane-unavailable`/`unpinned-download-unavailable` от cached/pinned-resource error; ни одно из этих состояний не является ошибкой existing Project и не обещает branded SKU или коммерческую доступность.

FR-27: Пользователь может искать asset по имени/категории и фильтровать по AnchorClass или основным dimensions.

FR-28: Пользователь может разместить AssetInstance только на surface, совместимой с AnchorClass; preview различает valid/warning/invalid placement, wall placement хранит stable host и local coordinates, а topology change атомарно rehost-ит объект либо показывает orphan preview. Durable placement требует validated format/size/hash, pinned exact bytes и BackupFeasibilityPolicy.

FR-29: Пользователь может переместить, повернуть и, только когда AssetDefinition это разрешает, изменить dimensions AssetInstance; numeric sheet даёт точный input, а fixed-size SKU не растягивается.

FR-30: Пользователь может duplicate, lock, unlock и delete AssetInstance; locked item защищён от случайного gesture, explicit unlock остаётся доступным, а все действия входят в undo/redo.

FR-31: Система показывает footprint collision и заданные clearance zones с Wall, Opening или другими AssetInstance; Alpha выводит warning, а не заявление о строительном compliance, и не меняет Project автоматически.

FR-32: Пользователь может создать Parametric Placeholder в форме box с name, width, depth, height, color и AnchorClass; он участвует в collision, save, export и 3D, не маскируясь под catalog item или коммерческий SKU.

FR-33: Пользователь может применить разрешённый color/material variant к отмеченным recolorable slots AssetInstance; неразрешённые slots не меняются, а variant сохраняется как domain reference.

FR-34: retired 2026-08-25; назначение покрытия пола исключено из Alpha, идентификатор не переиспользуется.

FR-35: retired 2026-08-25; назначение покрытия стены исключено из Alpha, идентификатор не переиспользуется.

FR-36: retired 2026-08-24; потолочная поверхность, предметы и покрытия исключены из Alpha, идентификатор не переиспользуется.

FR-37: retired 2026-08-25; offline/backup policy остаётся только для ресурсов размещённых предметов, идентификатор не переиспользуется.

FR-38: Пользователь может undo/redo каждый Durable Command текущей session history; состояние, derived Room и adjacency восстанавливаются, resource hashes обеих веток остаются GC roots, SessionRetentionPolicy не ломает существующую history молча, а history-only corruption требует exact repair либо подтверждённый DiscardSessionHistory.

FR-39: Пользователь может отменить Active Gesture без history entry или autosave mutation.

FR-40: При rejected command система объясняет нарушенное правило, сохраняет прежнее valid state и предлагает доступное действие.

FR-41: На поддерживаемой платформе пользователь может установить PWA и запускать её standalone; browser version сохраняет core authoring, unsupported WebGL2 показывает compatibility screen, а iOS browser/Home Screen contexts объясняются как отдельные stores с переносом через Portable Backup.

FR-42: После первого успешного открытия app shell и Project пользователь может в airplane mode открыть Project, изменить PlanGraph с локально доступными assets и сохранить результат. Когда все exact referenced resources уже pinned locally, недоступность Catalog Control Plane не блокирует open, edit, Durable save, local undo/redo или Portable Backup export.

FR-43: Система показывает storage usage/pressure, запрашивает persistence где доступно и обрабатывает quota exhaustion без silent data loss; LRU касается только repeat-download cache, Projects не удаляются автоматически, а backup reminder не выдаётся за гарантию.

FR-44: Пользователь может экспортировать versioned self-contained Portable Backup с manifest/schema/integrity metadata и exact referenced catalog/custom resources; every non-corrupt Durable Project в текущем policy export-ится offline.

FR-45: Пользователь может импортировать compatible Portable Backup с validation, migration и atomic commit; failure не перезаписывает existing Project, success создаёт новый Project ID, future schema объясняется, а container, paths, entries, entities и checksums проходят staged validation.

FR-46: retired 2026-08-25; PNG download/share исключён из Alpha, идентификатор не переиспользуется.

FR-47: Active editor предлагает reload только после Durable Revision; каждый startup проверяет shell/worker/Project/catalog schema compatibility и выполняет recoverable migration независимо от удержания waiting worker.

FR-48: В Alpha+ пользователь может выбрать ровно один локальный static GLB; glTF с внешними файлами, OBJ, FBX и archives отклоняются.

FR-49: В Alpha+ до loader система делает byte-level preflight GLB format/version, JSON chunk, URI, extensions и declared resources, затем проверяет decoded geometry/textures/memory/bounding box с cancel/timeout и deny-all resolver.

FR-50: В Alpha+ после успешного preflight пользователь видит isolated preview и подтверждает actual dimensions в мм, pivot/orientation, AnchorClass и recolorable slots.

FR-51: В Alpha+ система отклоняет unknown required extension, external/network URI, animation, skin, morph target, camera, light, invalid metadata и любой hard budget breach с фактическим значением, лимитом и безопасным следующим шагом, не оставляя partial blob.

FR-52: В Alpha+ подтверждённый ImportedAsset получает internal ID, content hash, validated metadata и local blob reference; reuse hash не дублирует binary, а удаление последней ссылки освобождает storage/GPU resources по policy.

FR-54: Catalog Control Plane публикует и отдаёт только versioned catalog metadata/resources и hashes; он не создаёт account identity и не является сервисом User Project, Revision, session History или Portable Backup. Outage может блокировать только browse/search либо получение ещё не pinned resource, не переводя healthy Project в ResourceRecoveryRequired.

### NonFunctional Requirements

NFR-1: Все persisted coordinates, dimensions и offsets являются integer millimetres; save/reopen и backup round-trip дают 0 мм semantic drift.

NFR-2: Renderer использует metres только после явного conversion на adapter boundary; canonical domain state не может происходить из обратного conversion.

NFR-3: Failed command оставляет Project byte/semantically equivalent предыдущей Durable Revision; Validated candidate не называется saved до atomic persistence pointer swap.

NFR-4: Один и тот же versioned Project и catalog versions дают одинаковые
topology и resource-backed `AssetVariant` selections.

NFR-5: На reference mid-tier device 3D-навигация, выбор и редактирование не
теряют пользовательский ввод; renderer использует функциональный fallback,
когда требуемое качество или контекст временно недоступны. Численные timing
budget являются диагностическими evidence, а не Alpha entry gate.

NFR-6: Provisional alpha reference scene содержит до 6 Room, 60 AssetInstance, 750k visible triangles, 250 draw calls и 128 MiB estimated GPU resources; limits подтверждаются spikes.

NFR-7: После accepted local app start пользователь может открыть или создать
editable Project offline; startup timing фиксируется как диагностическое
evidence, а не как Alpha entry gate.

NFR-8: Forced WebGL context loss/recovery не приводит к потере Durable Project
или input; приложение показывает recovery/fallback state, а 2D и data-access
остаются доступны. Длительный thermal run — диагностическое evidence.

NFR-9: Вне animation/gesture scene рендерится on demand и не обязана непрерывно работать.

NFR-10: Core editing не зависит от Background Sync, доступности Catalog Control Plane или удалённого сохранения User Project. После pin всех exact referenced resources existing local Project можно открыть, изменить, Durable save, провести через local undo/redo и экспортировать без сервиса.

NFR-11: Abrupt termination на любой persistence boundary восстанавливает последнюю Durable Revision; recovery evidence покрывает automated и device tests.

NFR-12: Каждая schema migration имеет previous-version fixtures, idempotence policy и rollback/backup boundary.

NFR-13: При quota error app не удаляет Project автоматически и даёт recoverable UX/backup path; every non-corrupt Durable Revision остаётся в complete-backup envelope, а missing/corrupt resource блокирует edits/undo/redo до exact repair, atomic RecoveryChangeSet либо разрешённого DiscardSessionHistory.

NFR-14: WebGL 2 — обязательный rendering baseline Alpha; WebGPU является feature flag/progressive enhancement и не меняет semantics.

NFR-15: Alpha device-functional acceptance пройдена Product Owner 2026-08-29
на iPhone 15 Pro Max и Samsung S24 Ultra в browser и installed PWA contexts:
Project CRUD/reopen/save, 2D/3D navigation, placement/move/45° rotate и PWA
update. Точные модели, device matrix, RS-2 timing, cold/warm quotas,
15-minute thermal protocol и независимый reviewer не являются Alpha gate.
Playwright и forced-context recovery остаются автоматизированной инженерной
регрессией; они дополняют, но не заменяют записанную функциональную приёмку.

NFR-16: Renderer, storage и installability выбираются capability detection, а не только user-agent.

NFR-17: Interactive DOM targets не меньше 44×44 CSS px, учитывают safe areas и не зависят от hover.

NFR-18: DOM controls, forms, dialogs и navigation соответствуют WCAG 2.2 AA; validation связана с полем и озвучивается assistive technology.

NFR-19: Каждое critical 3D/touch action имеет accessible numeric/list alternative, когда canvas сам недоступен.

NFR-20: Reduced-motion preference убирает optional camera animation.

NFR-21: Без explicit consent Project geometry, screenshots и ImportedAssets не отправляются во внешнюю систему. Catalog Control Plane не создаёт account identity и не принимает, не хранит, не синхронизирует и не восстанавливает Project, Revision, session History или Portable Backup.

NFR-22: В Alpha+ untrusted GLB проходит byte-level deny-network preflight, allowlist и staged resource limits; metadata не интерпретируется как HTML, а Worker не считается hard memory sandbox.

NFR-23: Если analytics включены, они не содержат plan geometry, asset binary, file names или screenshots; opt-out определён до public alpha.

NFR-24: CAP, FR, NFR и AD IDs стабильны и не переиспользуются; breaking schema change повышает version.

NFR-25: Alpha feedback содержит app/schema/catalog versions, capability tier и non-sensitive error code, но не пользовательский Project.

NFR-26: Domain/topology тестируются без DOM/GPU, а renderer и persistence доступны через ports/adapters.

### Additional Requirements

- Architecture baseline: сохранить hexagonal dependency direction adapters → application → domain; domain/application не импортируют React, Three.js, IndexedDB, service worker или DOM APIs, а интеграции проходят через typed ports и serializable values.

- Canonical geometry: Plan — planar graph Vertex/WallSegment в integer mm; wall является centerline, Face/usable polygon/mesh/index — derived projections. Topology, split/merge, room reconciliation, hosted surfaces и reason codes должны быть deterministic для touch и numeric input.

- Mutation/persistence boundary: любая mutating operation строит полный ChangeSet, проходит validation и становится Durable только после staging write, checksum и atomic current-pointer swap. Draft gesture не входит в history; persistence failure сохраняет current Durable Revision и блокирует следующую mutating command до retry/recovery.

- Local-first storage: ProjectRepositoryPort и AssetBlobStorePort поддерживают versioned metadata/blobs, copy-on-write migrations, writer lease/fencing, read-only second context и explicit takeover. Browser и iOS Home Screen — разные local contexts; transfer идёт через Portable Backup.

- Data safety: exact referenced resources pin-ятся до Durable placement/variant; BackupFeasibilityPolicy и SessionRetentionPolicy проверяются до publication. Missing/corrupt resource переводит Project в read-only ResourceRecoveryRequired; repair требует exact bytes либо единого atomic RecoveryChangeSet, а history-only issue допускает только explicit DiscardSessionHistory при healthy current Project.

- Project limits and backup: задать и валидировать ProjectLimitsPolicy, versioned .interiors format, staged import pipeline, safe path/container policy, integrity checks, deletion/recovery/GC roots и stable reason codes. Portable Backup всегда self-contained и создаёт новый Project ID при import.

- Rendering: WebGL2 acceptance path обязателен, WebGPU не блокирует Alpha. Renderer — disposable projection за port boundary, render-on-demand обязателен, context loss восстанавливает сцену из canonical model, а degradation ladder может менять DPR/shadows/textures/LOD, но не domain accuracy.

- Renderer spike: Three.js + React Three Fiber и Babylon.js должны быть сравнены на одинаковых RS-1/RS-2; до ADR renderer сохраняется за port. Текущий Stack является candidate seed, а не установленным решением.

- Geometry spike: до feature implementation необходимо закрепить library/kernel, tolerance/rounding, X/T intersection behavior, Room reconciliation, opening-policy при изменении Wall и golden/property corpus.

- D22 canonical reconciliation: один `PlanProjectionPort` выдаёт одинаковый
  воспроизводимый candidate для canvas и numeric/DOM alternative либо transient
  `SelectionUnavailable`; exact T и otherwise valid exact X materialize общую
  Vertex/все non-zero pieces, а не `AMBIGUOUS_INTERSECTION`. `MeasurementRequest`
  остаётся revision-bound one/two-target operation с одной formatting policy.
  Valid Room допускает строго вложенные non-touching void rings; Room/Opening/
  item-host conflict проходит только preview → explicit choice
  → fresh base/fence revalidation. Pin bytes защищаются `PinStagingLease` до
  publication либо explicit no-publication cleanup; forced-GC/crash/cancel/
  fence-loss paths входят в corpus.

- Planned unified root and toolchain: только после `G-READY` единый planned repository root содержит `apps/web` (React + TypeScript + Rspack + CSS Modules) и `apps/catalog-control-plane` (Kotlin + PostgreSQL only for catalog). `apps/web` starts from the AD-16 exact `create-rspack@2.1.8 react-ts` seed on Node `24.19.0` LTS with `pnpm@11.20.0`, one `pnpm-lock.yaml`, React `19.2.8`, TypeScript `7.0.2`, `@rspack/core`/`@rspack/cli` `2.1.8`, `@rstest/core`/`@rstest/adapter-rspack` `0.11.5` and Playwright `1.62.1`. CSS component/page styling lives in `*.module.css`; global CSS is reset/tokens/AppShell constraints only. Kotlin web framework, build system, API/transport, hosting, PostgreSQL operations and resource delivery remain a bounded ADR, not story-local invention.

- Catalog Control Plane boundary: Kotlin `2.4.10` + PostgreSQL `18.4` publish only curated versioned metadata/resource descriptors-or-bytes and content hashes through `CatalogGatewayPort`. PostgreSQL never owns Project/Revision/History/Portable Backup/user-pinned blobs. `control-plane-unavailable` and `unpinned-download-unavailable` are non-blocking catalog states with retry/cancel; proposed placement stays non-Durable until local exact-byte pin + `BackupFeasibilityPolicy` pass. Only actual missing/corrupt referenced exact bytes may enter `ResourceRecoveryRequired`.

- Assets: AssetDefinition отделён от AssetInstance; placement является discriminated Floor/Wall с stable host address. Catalog и custom resource проходят format/size/hash, exact pin и backup readiness; licensing/provenance/grant/declaration/notice не имеют Alpha route.

- Performance and device diagnostics: RS-1/RS-2/RS-3, startup, interaction,
  frame-time distribution, memory proxy, thermal, context recovery, storage
  envelope и recovery corpus помогают находить регрессии. `NFR-15` уже закрыт
  Product Owner functional-проверкой на iPhone 15 Pro Max и Samsung S24 Ultra;
  отсутствие дополнительного physical trace не блокирует Alpha.

- Testing seams: commands, geometry, migration, asset validation и backup проверяются без UI; clock, ids, storage, catalog, renderer, worker scheduler и diagnostics доступны как fakes/ports. Browser/device tests дополняют, а не заменяют domain/property/golden tests.

- PWA lifecycle: versioned ReleaseManifest/startup handshake согласует appBuildId, worker protocol, project/catalog schema и capabilities; active session предлагает reload только после safe durable boundary.

- Alpha+ GLB: CAP-12 остаётся Alpha+ и не блокирует Alpha entry без нового решения владельца. При включении требуются hostile corpus, byte-level preflight, local deny-all resolver, hard decoded limits, cancel/dispose, no-network evidence, quota/backup round-trip и real-device thermal checks.

- Corrected backlog coverage: отдельные проверяемые AC теперь закреплены за
  Story 8.2 (FR-4), 3.2 (FR-16), 3.4 (FR-19),
  5.4 (FR-30), 5.5 (FR-32), 7.2 (cancel), 2.1/5.4 (exact measurement),
  и 5.3 (wall rehost-or-orphan). Retired Story 6.4 больше не задаёт
  Alpha-критерий.
  Эти scopes не могут снова раствориться в общих историях при change-control.

- Visual checkpoint protocol: единый обязательный protocol для каждого material
  user-visible milestone V-01–V-20 находится перед detailed stories. Он
  требует screenshot только реально запущенного приложения, отправляемый
  владельцу без остановки работы; screenshot не заменяет functional, browser,
  offline, device или performance evidence.

- Documentation integrity: `roadmap-to-alpha.md` использует относительную
  ссылку `../../plans/alpha-implementation-plan.md`; она проверена и разрешается
  в существующий root `plans/alpha-implementation-plan.md`. Следовательно,
  current roadmap link является resolved, не missing. Историческая ошибочная
  caveat сохранена без переписывания в
  `sprint-change-proposal-2026-08-04.md`; её reconciliation зафиксирован в
  `sprint-change-proposal-2026-08-04-spike-authorization.md`.

### Historical UX-design trace locators — superseded

Записи `UX-DR*` ниже сохранены ради стабильных ссылок в старых Trace. Они не
являются независимыми требованиями к delivery и не могут переопределить
финальные `DESIGN.md`/`EXPERIENCE.md`; актуальное сопоставление дано в разделе
«Canonical reconciliation — 2026-08-30».

UX-DR1: Реализовать phone-first AppShell с верхней строкой (back, project name, durable-save status, menu), центральным 2D/3D canvas, нижней строкой mode/tool/undo-redo и safe-area/visual-viewport/keyboard handling.

UX-DR2: Применить рабочие visual tokens: Canvas #F4F1EA, Surface #FFFFFF, Text #172033, Muted #667085, Primary #2563EB, semantic Success/Warning/Danger; colour не является единственным носителем состояния, contrast соответствует WCAG 2.2 AA.

UX-DR3: Применить system UI typography, 16 px base text, tabular monospace values, visible мм у редактируемого dimension, 20/28 screen headings, 16/24 panel headings, минимум 13/18 label и 15/20 button text.

UX-DR4: Поддержать базовую portrait width от 360 px, минимум 44×44 CSS px touch targets (цель 48×48), input без precision-hover и layouts, устойчивые к system text scale 200%.

UX-DR5: Реализовать BottomSheet с peek/half/full states и gesture separation от canvas, full-screen catalog sheet с search/categories/large preview и tablet-адаптацию свойств в pinned side panel без desktop-first предположения.

UX-DR6: Ввести AppShell состояния saving, saved/durable, persist-failed, offline, `catalog-control-plane-unavailable`, read-only/lock-lost, conflict и storage-risk, причём saved запрещён до durable pointer swap, а catalog outage не маскируется под recovery/read-only Project state.

UX-DR7: Historical locator для прежней командной панели. Active replacement —
EditorTopBar + persistent ViewSwitch + ActionDock и contextual confirmation с
accessible names, disabled semantics и подтверждением только необратимых
последствий.

UX-DR8: Реализовать DimensionInput и PropertyField с visible мм, step controls, pre-confirm validation, applied/draft values, local explanation and preserved prior valid value.

UX-DR9: Реализовать ObjectCard с preview, canonical name, category, physical dimensions, variants и technical resource state до placement.

UX-DR10: В Plan Mode реализовать orthographic floor-plane authoring с
Wall/Item selection/drag, constrained wall preview/confirm, exact wall input,
openings, display-only Room metrics, footprint item placement, pan/zoom и
недопустимым segment, который не попадает в model. Room metadata/finish UI не
создаёт canvas-based selection и требует отдельного approved redesign flow.

UX-DR11: В 3D Edit Mode разрешить selection, floor move, rotate, variant/material editing; topology walls остаётся 2D-only, чтобы не смешивать camera navigation и geometry editing.

UX-DR13: Переключение Plan/3D сохраняет Project, selection, undo/redo position и approximate visual focus, не создавая domain command; visible history boundary объясняет reset history после reopen/recovery/migration/duplicate/import.

UX-DR14: Применить gesture contract для one/two-finger/long-press в Plan, 3D и BottomSheet; active control и movement threshold предотвращают accidental tap-to-drag, а critical operation имеет button/field alternative.

UX-DR15: Поддержать UXF-1 first measured room: project creation без account, rectangle/constrained-walls choice, mm input, 2D dimensions, 3D availability, exact passage measurement и durable reopen offline.

UX-DR16: Поддержать UXF-2 multi-room plan: extend from Vertex, orthogonal/diagonal snap, preview future Room, atomic derivation и Door на shared Wall с согласованной Plan/3D проекцией.

UX-DR17: Поддержать UXF-3 catalog flow: category/filter, dimensions before adding, nearby preview, pin/progress before Durable placement, retry/cancel if not backup-ready, transform/collision view and single-command undo/redo. Outage Catalog Control Plane блокирует только browse/download unpinned resource, даёт labelled retry/cancel и не делает healthy Project read-only.

UX-DR18: Retired historical locator: finishes и Room/surface selection не
имеют active Alpha replacement.

UX-DR19: Поддержать UXF-5 offline/recovery: offline status with continuation, quota warning and backup action, recoverable durable revision after abrupt close и accurate language about saved versus candidate.

UX-DR20: Для Alpha+ поддержать UXF-6 GLB: visible supported format/limits, staged local progress/cancel, dimensions/anchor classification, decoded-weight/footprint preview и reason/action on rejection without Project mutation.

UX-DR21: Реализовать declared screen states для Project list, create, 2D/3D canvas, catalog (`metadata-ready`, loading/pinning, offline/backup-ready, `control-plane-unavailable`, `unpinned-download-unavailable`, missing/stale/failed/repair), properties, history, resource recovery, export, PWA update, GLB import, writer lock, direct Project deletion confirmation и iOS handoff.

UX-DR22: При invalid geometry показать conflict point, stable rule and safe corrective action; rejected operation остаётся preview, не становится history entry и не сохраняется.

UX-DR23: При WebGL context loss сохранять 2D/project, rebuild 3D from canonical model и после repeat failure предлагать reduced quality without claiming data loss.

UX-DR24: При persistence/storage failure различать Durable Revision, PendingDurability candidate и unfinished transaction; expose retry/recovery export, block next mutating commit and preserve original on migration failure.

UX-DR25: ResourceRecoveryRequired предоставляет read-only 2D, diagnostic placeholders, explicit exact repair/complete backup/exact catalog version/one atomic replacement-or-removal flow, correct backup availability by corruption scope и explicit confirm/cancel DiscardSessionHistory for history-only corruption.

UX-DR26: Показывать PWA update/reload только at durable safe boundary; startup compatibility failure ведёт к recoverable migration/read-only export screen.

UX-DR27: Enforce one-writer UX: second tab/standalone context is read-only, explicit takeover explains consequence, and lock loss keeps draft only as preview/recovery copy.

UX-DR28: Before first project, iOS install help explains that Safari and Home Screen may have separate stores; existing Project moves through self-contained Portable Backup rather than promised sync.

UX-DR29: Onboarding must be contextual rather than carousel: explain units/local storage on first screen, give dismissible/reopenable tips for build, dimension and 3D, and never replace own-project creation with a demo.

UX-DR30: Accessibility includes semantic toolbar names, focus/error announcements near fixable fields, visible numeric/list alternatives to canvas, no hover/right-click/keyboard-shortcut dependency, and reduced motion without inertial/decorative transitions.

UX-DR31: Responsive/device validation prioritises current iPhone/iOS Safari in browser and Home Screen contexts, mid-tier Android/Chrome standalone, constrained-memory Android, tablets and desktop only as supporting fallback.

UX-DR32: Gather alpha UX metrics only with consent/research-session authority: time to first correct 3D Room, UJ-1 completion, accidental gestures/undo rate, forced-close recovery, quality-tier rate, backup export/reimport success and confidence in dimensions.

UX-DR35: Для `control-plane-unavailable` и `unpinned-download-unavailable`
StatusBanner и catalog textually сообщают, что Project и уже pinned предметы
работают локально, и дают labelled `Повторить загрузку каталога`/cancel. Эти
states не объявляются как `ResourceRecoveryRequired`; blocking recovery остаётся
только для integrity-detected missing/corrupt exact referenced resource.

UX-DR36: Plan input обязан показывать тот же результат `PlanProjectionPort` на
canvas и numeric/DOM alternative: selected candidate или transient
`SelectionUnavailable` с retry/pan/zoom и сохранённым DraftCommand, без
`INVALID_DIMENSION`, autosave либо History. Один или два revision-bound target
`MeasurementRequest` имеют stale-reselect путь и один formatted text в preview,
Plan, 3D и export.

UX-DR37: Valid `AddWall` Room split сразу показывает derived successors с
точным predecessor `heightMm`, без выбора left/right metadata. Room merge,
Opening после Wall edit и item-host placement показывают
`ConflictPreview/AwaitingUserOutcome` с affected records и явным допустимым
outcome. Confirm всегда повторяет discovery/validation на current base Revision
и writer fence; cancel, stale и lock loss не materialize Command, ChangeSet,
Revision или History.

UX-DR38: Resource admission видимо показывает format/size/hash и техническую
готовность resource; до Durable placement/finish/definition pin проходит через
`PinStagingLease`. UX и corpus покрывают success, reject,
cancel, fence-loss, crash recovery и forced GC без orphaned durable reference.

### FR Coverage Map

FR-1: Epic 1 — локальный Project с initial valid state.
FR-2: Epic 1 — список, открытие и переименование локального Project.
FR-3: retired; independent Project variant is outside Alpha scope.
FR-4: Epic 8 — explicit confirmed permanent Project deletion после V-12.
FR-5: Epic 1 — Durable autosave и recovery последней Revision.
FR-6: Epic 2 — прямоугольная Room по внутренним размерам в мм.
FR-7: Epic 2 — constrained drawing Wall.
FR-8: Epic 2 — gesture-first constrained Wall authoring without global coordinate input.
FR-9: Epic 2 — move/split topology.
FR-10: Epic 2 — Wall thickness и derived height.
FR-11: Epic 2 — валидное удаление geometry.
FR-12: Epic 2 — geometry validation и explainable rejection.
FR-13: Epic 2 — exact measurements canonical plan targets; Epic 5/V-10 — тот
же measurement contract для границ AssetInstance footprint.
FR-14: Epic 3 — derive closed Room.
FR-15: Epic 3 — preserve Room identity.
FR-16: Epic 3 — Room name/type/height parameters.
FR-17: Epic 3 — add Door.
FR-18: Epic 3 — add Window.
FR-19: Epic 3 — edit/remove Opening после Wall change.
FR-20: retired; Door navigation is outside Alpha scope.
FR-21: Epic 4 — switch Plan and 3D views.
FR-22: Epic 4 — deterministic 3D projection.
FR-23: Epic 4/V-03 — inspect/camera без выбора Room surface; Epic 5/V-10 —
выбор размещённого AssetInstance через accessible selection contract.
FR-24: retired; Walk Mode is outside Alpha scope.
FR-25: Epic 4 — adaptive rendering quality.
FR-26: Epic 5 — browse catalog categories and states.
FR-27: Epic 5 — search and filter catalog.
FR-28: Epic 5 — anchored, backup-ready Item placement.
FR-29: Epic 5 — transform Item with numeric precision.
FR-30: Epic 5 — duplicate, lock, unlock and delete Item.
FR-31: Epic 5 — collision and clearance feedback.
FR-32: Epic 5 — Parametric Placeholder.
FR-33: Epic 6 — allowed Item color/material variant.
FR-34: retired; Room floor finish is outside Alpha scope.
FR-35: retired; shared-Wall finish is outside Alpha scope.
FR-36: retired; ceiling finish is outside Alpha scope.
FR-37: retired; finish offline availability is outside Alpha scope.
FR-38: Epic 1/V-01 — обязательный durable-command/history substrate; Epic 7
— resource-sensitive retention/recovery hardening.
FR-39: Epic 1/V-01 — базовая отмена DraftCommand; Epic 7 — cross-journey
cancel regression coverage.
FR-40: Epic 1/V-01 — stable reject/reason substrate; Epic 7 — cross-journey
explainability regression coverage.
FR-41: Epic 8 — installable PWA and iOS local-context handoff.
FR-42: Epic 8 — offline reopen and edit.
FR-43: Epic 8 — storage health and quota safety.
FR-44: Epic 8 — Portable Backup export.
FR-45: Epic 8 — staged Portable Backup import.
FR-46: retired 2026-08-25; нет Epic owner.
FR-47: Epic 8 — coordinated app update.
FR-48: Epic 9 — select static GLB (Alpha+).
FR-49: Epic 9 — GLB preflight resource policy (Alpha+).
FR-50: Epic 9 — GLB preview and classification (Alpha+).
FR-51: Epic 9 — reject unsafe/unsupported GLB (Alpha+).
FR-52: Epic 9 — persist imported asset by hash (Alpha+).
FR-53: retired; Focus/native fullscreen is outside Alpha scope.
FR-54: Epic 5 — versioned catalog metadata/resources/hash perimeter и доступный browse/
retry/cancel flow без remote Project ownership; Epic 8 подтверждает, что
fully pinned local Project продолжает offline работу при недоступном сервисе.

**Coverage audit (updated 2026-08-29):** `40/40` active Alpha `FR-*` имеют
owner в Epic List/детальных Stories. `FR-48`–`FR-52` (`5/5`) принадлежат
Epic 9 Alpha+ и не блокируют Alpha entry. `FR-3`, `FR-20`, `FR-24`,
`FR-34`–`FR-37`, `FR-46` и `FR-53` (`9`) retired и не учитываются как active.
FR-38–FR-40 и FR-54 дополнительно имеют explicit cross-epic completion
evidence. NFR/UX/architecture traces не подменяют отдельный FR owner.

### Catalog Control Plane Requirement-to-Story/Test Coverage

| Requirement / contract | Implementation story | Mandatory automated and non-automated evidence |
| --- | --- | --- |
| FR-26, UX-DR17, UX-DR35 | Story 5.1 / `V-09` | `CATALOG-E2E-01`: mobile browser browse or unpinned-download outage gives labelled retry/cancel and never makes a healthy Project read-only. |
| FR-54, AD-16, AD-17 | Story 5.6 / `V-09-CP` | `CATALOG-E2E-02` verifies visible version/resource metadata and outage; separately, the ADR-selected Kotlin/PostgreSQL contract tests prove the no-Project-data perimeter. The JS Rstest runner is not assigned to Kotlin tests before `G-CP-ADR`. |
| FR-42, NFR-10, NFR-21 | Story 8.4 / `V-15` | `CATALOG-E2E-03`: fully pinned Project opens, edits, saves and undo/redoes locally while the control plane is unavailable. |
| NFR-13, catalog-control-plane contract | Story 8.6 / `V-16` | `CATALOG-E2E-04`: actual missing/corrupt exact resource is `ResourceRecoveryRequired` whether the service is reachable or not. |
| FR-44, FR-54 | Story 8.8 / `V-17` | `CATALOG-E2E-05`: fully pinned Portable Backup builds without a remote fetch during service outage. |

`CATALOG-E2E-01`–`05` — controlled browser/PWA regression only. Они не
заменяют domain/hash/backup contract tests, backend contract tests или восемь
physical NFR-15 performance rows; каждый из последних остаётся отдельным
manual device evidence.

### D22 Source-Derived Contract-to-Epic Coverage

| Canonical concern | User-value epic ownership | Evidence boundary |
| --- | --- | --- |
| `PlanProjectionPort`, `SelectionUnavailable`, exact T/X and paired `MeasurementRequest` | Epic 2 | Domain/golden corpus plus mobile Playwright result parity; no geometry-library default or browser screen coordinate is canonical. |
| Multi-component Room Face, Room identity and Opening re-entry | Epic 3 | Outer/void, lineage and conflict re-entry corpus; preview/cancel/stale/fence-loss remain non-materializing. |
| `FloorPlacement(roomId)`, wall host and AssetPlacement reconciliation | Epic 5 | Placement/host lineage corpus and Playwright conflict/retry flow, with exact bytes pinned before publication. |
| AssetInstance variant resource binding | Epic 6 | Declared-option/pin/reopen corpus; floor/wall visualisation remains neutral and display-only. |
| History roots, pin staging and explicit discard | Epic 7 | Forced-GC/cancel/crash/fence-loss root inventory plus healthy-current `DiscardSessionHistory` evidence. |
| Recovery, backup and storage lifecycle | Epic 8 | Pin/recovery/backup corpus; browser PWA regression complements, but does not replace, physical NFR-15 traces. |

This table is a source-derived coverage map, not a new technical epic or a
substitute for the named owner corpus/gates.

### D22 Story / Browser BDD / Domain Corpus Map

| Story | Named Playwright BDD | Required non-browser corpus |
| --- | --- | --- |
| 2.1–2.4 | `PLAN-E2E-01`, `PLAN-E2E-02` | Projection/measurement vectors; all-contact T/X; total allocation/lineage for every topology command including `MergeCollinearSegments`; forward/inverse replay. |
| 3.1 | `ROOM-E2E-01` | Outer/void face vectors: simple hole, offset/collapse, repeated bounded/exterior and touching/nested; Room lineage. |
| 3.4, 5.3 | `RECONCILIATION-E2E-01`–`02` | Opening and placement-host preview→choice→fresh-base/fence vectors. |
| 5.2 | `RESOURCE-E2E-01` | PinStagingLease root inventory across success/reject/cancel/fence-loss/crash/forced-GC. |
| 7.1 | `HISTORY-E2E-01` | Semantic replay separate from admission/publication; history roots and explicit discard vectors. |
| 8.6 | `RECOVERY-E2E-01` | Exact repair, one complete fenced RecoveryChangeSet and restart/GC recovery accounting. |
| 9.2 (Alpha+ only) | `CUSTOM-ASSET-E2E-01` | Custom declaration, pin/forced-GC/crash lifecycle; CAP-12 remains out of Alpha entry. |

Browser BDD checks the observable user path. It never replaces the listed
deterministic domain/repository corpus or the physical NFR-15 evidence.

## Epic List

### Epic 1: Локальный проект, которому можно доверять

Пользователь может без аккаунта создать, открыть и переименовать локальный
Project, понимать durable status и уже в первом безопасном flow отменять,
повторять или получать объяснение своей mutation.

**FRs covered:** FR-1, FR-2, FR-5; foundational cross-cutting FR-38, FR-39,
FR-40.

**Implementation notes:** Ценность эпика требует честной границы
PendingDurability/Durable Revision, atomic persistence, writer fencing и
recoverable storage states с первого пользовательского сценария. Это
пользовательский durable-command/history/cancel substrate V-01, а не
технический эпик; V-02 не вправе впервые реализовывать его. Независимый вариант
и confirmed Project deletion намеренно поставлены после V-12 resource semantics в Epic 8.

### Epic 2: Точный первый план комнаты

Пользователь может создать и измерить одну геометрически валидную Room в
миллиметрах: прямоугольником либо constrained walls, с точным input, preview,
safe topology edits и понятным результатом invalid operation.

**FRs covered:** FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13.

**Implementation notes:** Каноническими остаются integer-mm planar graph и
Wall centerline; touch/numeric semantics, 45-degree quantization, topology
invariants, reason codes, golden/property tests и visual checkpoints остаются
acceptance constraints, а не отдельным техническим эпиком. Единый
`PlanProjectionPort` обязан отдавать тот же exact candidate canvas и
numeric/DOM path, а временная неинвертируемость остаётся
`SelectionUnavailable` с retry, без rounding/default и mutation. Измерение —
revision-bound one/two-target `MeasurementRequest` с единым formatted text;
otherwise valid exact X имеет ту же атомарную all-contact нормализацию, что T.

### Epic 3: Связная квартира: комнаты, стены и проёмы

Пользователь может развить первый план до нескольких связанных Room, сохраняя
семантические Room properties, добавляя Door/Window и безопасно меняя topology.

**FRs covered:** FR-14, FR-15, FR-16, FR-17, FR-18, FR-19.

**Implementation notes:** Room создаётся из Face, height остаётся единственным
редактируемым источником высоты, а shared-wall/opening policy остаётся
deterministic. Face допускает одну simple outer ring и валидные строго
вложенные неприкасающиеся void rings; usable polygon остаётся projection.
Room/Opening re-entry всегда проходит preview → explicit choice → fresh
base/fence revalidation. Story 3.2 покрывает Room.type (FR-16), а Story 3.4 —
валидность/rehost-or-preview Opening после изменения Wall (FR-19).

### Epic 4: Понятная 3D-проверка планировки

Пользователь может переключиться в согласованный 3D-вид, осмотреть свой план
и получить управляемое качество WebGL2 без изменения точности проекта.

**FRs covered:** FR-21, FR-22, FR-23, FR-25.

**Implementation notes:** 3D остаётся disposable projection canonical Revision;
WebGL2 является baseline, context recovery и render-on-demand обязательны.
До V-09 Room surfaces остаются display-only: AssetInstance ещё не существует и
получает свой 3D/DOM selection contract в Epic 5/V-10. Door не получает
отдельного `locked`/access/key/open-close Alpha state и не создаёт navigation
semantics. Numeric alternative, reduced motion (NFR-20), thermal/device
evidence и screenshots назначаются явными story-level AC.

### Epic 5: Расстановка предметов реальных размеров

Пользователь может найти предмет либо создать Parametric Placeholder, увидеть
его реальные dimensions, безопасно pin-ить и разместить на совместимой
поверхности, затем точно трансформировать, lock/unlock/duplicate/delete и
увидеть collision/clearance feedback.

**FRs covered:** FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-54.

**Implementation notes:** AssetDefinition отделён от AssetInstance, а
`FloorPlacement` хранит `roomId`, а Wall placement — свой stable host
address; нейтральная проекция пола/стен не является persistent assignment.
Публикация placement
требует exact resource pin через `PinStagingLease`, BackupFeasibilityPolicy и
технические format/size/hash проверки.
`CatalogGatewayPort` отделяет этот browse/catalog perimeter от local Project:
Kotlin/PostgreSQL Control Plane не получает Project data, а outage даёт только
non-blocking catalog retry/cancel, не `ResourceRecoveryRequired`. Story 5.4
покрывает FR-30, Story 5.5 — FR-32, а Story 5.3 — wall rehost-or-orphan
при topology change через preview/choice/fresh revalidation; добавляемая gated
story 5.6 закрепляет FR-54 без выбора deferred backend API/transport.

### Epic 6: Варианты предметов

Пользователь может применить к предметам только разрешённые варианты и
надёжно увидеть их после offline reopen или в portable backup. Назначаемых
покрытий пола и стен в Alpha нет.

**FRs covered:** FR-33.

**Implementation notes:** Item variant — одна Durable command и не меняет
габариты, footprint или host. Если вариант использует отдельный ресурс, exact
bytes проходят `PinStagingLease`, format/size/hash и
BackupFeasibilityPolicy до публикации.

### Epic 7: Безопасное экспериментирование с ресурсной историей

Пользователь может пробовать resource-heavy варианты без страха: уже доступный
с V-01 undo/redo/cancel contract сохраняет полное согласованное состояние,
удерживает обе history-ветки и объясняет invalid/recovery scenario безопасным
следующим шагом.

**FRs covered:** FR-38, FR-39, FR-40.

**Implementation notes:** Этот эпик не является первым местом появления
history/cancel. Он усиливает V-01 substrate после ресурсов V-09–V-12:
History хранит только Durable commands, обе ветки удерживают resource GC roots,
а SessionRetentionPolicy, ResourceRecoveryRequired, exact repair и explicit
DiscardSessionHistory не могут silently уничтожать обещанную history. Corpus
также доказывает, что staging/pin/recovery roots переживают forced GC и crash
до publication либо безопасно освобождаются на reject/cancel/fence loss.

### Epic 8: Владение, автономность и переносимость Project

После V-12 resource semantics пользователь может безопасно удалить/восстановить
Project, установить PWA, продолжить работу offline, честно управлять storage
risk, создать/восстановить self-contained Portable Backup и безопасно пережить
app update.

**FRs covered:** FR-4, FR-41, FR-42, FR-43, FR-44, FR-45,
FR-47; shared completion evidence for FR-54 outage/local-continuity semantics.

**Implementation notes:** Browser и iOS Home Screen считаются отдельными
contexts; import всегда staged и publishes a new Project ID. NFR-15 уже
формализовал iPhone/Samsung model/SKU/OS/browser/PWA contexts и thermal
protocol. Этот backlog не выбирает их повторно: desktop/emulation не заменяют
mobile acceptance, а ни одна Story не может объявить matrix passed без всех
required physical traces. Portable Backup и
recovery обязаны учитывать PinStagingLease, current/recovery/history
roots и forced-GC/crash/cancel/fence-loss corpus; history-only repair допускает
только explicit healthy-current `DiscardSessionHistory` без Project Revision.

### Epic 9: Безопасное добавление собственного GLB (Alpha+)

После Alpha entry пользователь может локально выбрать и проверить static GLB,
увидеть безопасный preview, подтвердить его dimensions/anchor и сохранить
только asset, прошедший policy, limits и portable-storage checks.

**FRs covered:** FR-48, FR-49, FR-50, FR-51, FR-52.

**Implementation notes:** Этот эпик не блокирует Alpha entry. Он требует
byte-level preflight, deny-all resolver, hostile corpus, decoded limits,
cancel/dispose, no-network evidence, quota/backup round-trip и
thermal/performance proof на floor devices.

## Обязательные non-story gates и delivery sequence

Ни один gate ниже не является Story, техническим backlog-эпиком или заменой
пользовательской ценности. Он задаёт входное evidence для stories и остаётся
`NOT ENTERED`/`PAUSED`, пока нет требуемого артефакта. Screenshot, красивый
prototype или desktop/emulation run не могут закрыть gate самостоятельно.

| Gate | Обязательное evidence до начала зависимой работы | Разблокирует / ограничивает |
| --- | --- | --- |
| `G-READY` | только финальный официальный BMAD implementation-readiness verdict = `READY`; `NEEDS WORK`, `NOT READY` и любой waiver не удовлетворяют этот gate | только production bootstrap и `V-01+`, всегда вместе с их собственными gates; **не** authorizes spike code сам по себе |
| `G-WEB-AD16` | adopted AD-16 фиксирует один planned `apps/web` root, frozen `pnpm-lock.yaml`, React/TypeScript/Rspack/CSS Modules, Rstest+Rspack adapter и Playwright. Runtime `WEB-BOOTSTRAP-01` может быть выполнен только после `G-READY`; Vite/Vitest, второй JS lockfile и Kotlin tests в JS runner запрещены | только V-01 web bootstrap вместе с `G-READY` и `G-V01-S3`; не выбирает Kotlin/backend details, не заменяет `G-CP-ADR` и не authorizes code сам по себе |
| `G-SPIKE-W-001` | активный `W-SPK-2026-08-04`, точное совпадение допустимых prototype/evidence paths, неистёкший срок и назначенные accountable owner + independent reviewer для конкретного package | только experimental evidence `S-1/S-2/S-3/S-4/S-6` в `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-{1,2,3,4,6}/`; **не разблокирует** bootstrap, `V-*`, feature, production catalog, publishing или commit |
| `G-V01-S3` | `S-3 Storage/PWA` = `PASS`: durable staging/checksum/pointer-swap, restart/kill/recovery corpus, writer fencing, versioned schema, local-context handoff и history-root policy задокументированы/проверены | **V-01 / Stories 1.1–1.4**; одного упоминания `S-3` в trace недостаточно |
| `G-S2-topology` | `S-2 Topology` = `PASS`: integer-mm kernel, tolerance/rounding, T/X policy, Room reconciliation, Opening-fit corpus и stable reason codes | V-02, V-04–V-07; неявный default библиотеки запрещён |
| `G-S4-touch` | `S-4 Touch` = `PASS`: validated gesture contract, one/two-finger separation, numeric alternatives, 44×44 target evidence и error taxonomy | V-02, V-04, V-07, V-09, V-10 и V-19 |
| `G-S1-renderer` | `S-1 Renderer` = `PASS`: chosen projection port/ADR, WebGL2 baseline, context recovery, dispose и mobile RS traces без engine types в domain | V-03, V-09–V-10, V-12 и V-18 |
| `G-S6-catalog` | `S-6 Asset catalog pipeline` = `PASS`: representative task matrix, versioned technical manifest, format/size/hash, pin/backup/device evidence | V-09, V-12, V-15, V-17 и V-18 |
| `G-CP-ADR` | отдельный принятый bounded ADR фиксирует воспроизводимый Kotlin build/test boundary, API/transport и resource-delivery decision, PostgreSQL schema/operations boundary и publisher/operator authentication так, чтобы AD-17 не расширялся до account/Project/sync/backup сервиса | только `V-09-CP`; сам по себе не authorizes production bootstrap/code и всегда требует `G-READY` |
| `G-V12-resource-semantics` | V-12 доказал pinned exact resources, BackupFeasibilityPolicy и deterministic offline fallback для placements/item variants | V-14; deletion/GC работают с настоящими resource roots |
| `G-A+-S5` | отдельное owner decision и `S-5 GLB` = `PASS`: hostile corpus, confirmed limits/allowlist, local no-network decoder path, cleanup, quota/backup и floor-device thermal evidence | только P-01–P-03 / Epic 9; **не блокирует Alpha entry** |

| Mandatory delivery relation | Must already be true |
| --- | --- |
| S-1/S-2/S-3/S-4/S-6 experimental evidence before `READY` | `G-SPIKE-W-001`; этот путь даёт только evidence и не меняет V-entry gates |
| V-01 | `G-READY`, `G-V01-S3`, `G-WEB-AD16` |
| V-02 | V-01 durable-command/history/cancel substrate, `G-S2-topology`, `G-S4-touch` |
| V-03 | V-02, `G-S1-renderer` |
| V-04 | V-02, `G-S2-topology` и `G-S4-touch` |
| V-05 | V-04 и `G-S2-topology` |
| V-06 | V-05 и `G-S2-topology` |
| V-07 | V-06, `G-S2-topology`, `G-S4-touch` и applicable `G-S1-renderer` projection evidence |
| V-09 | V-07, `G-S1-renderer`, `G-S4-touch` и `G-S6-catalog` |
| V-10 | V-09, `G-S1-renderer` и `G-S4-touch` |
| V-11 и V-12 | V-10; V-11 использует placement/selection semantics, V-12 также требует `G-S1-renderer` и `G-S6-catalog` |
| V-09-CP | V-09, `G-READY`, `G-S6-catalog` и `G-CP-ADR`; publishes/consumes only the AD-17 catalog metadata/resources/hash perimeter and keeps all user Project data local |
| V-13 | retired 2026-08-25: independent Project duplicate is outside Alpha |
| V-14 | V-12 and `G-V12-resource-semantics` |
| V-15–V-17 | V-14 plus `G-V01-S3`; catalog-dependent paths also require `G-S6-catalog` |
| V-18 | V-10/V-12 renderer and resource paths plus `G-S1-renderer`; diagnostics are non-critical hardening |
| V-19 | active core flows plus `G-S4-touch`; formal mobile/accessibility proof is implementation QA deferred by owner |
| V-20 | explicit consent-safe research/release evidence; не prerequisite для active Alpha slices |

### Реестр accountable ownership и независимого review

Roman является Product Owner и отвечает за назначение/фиксацию реальных
исполнителей. Он — единственная подтверждённая именованная личность; названия
ниже являются требуемыми work roles, а не выдуманными назначениями людей.
Его делегирование от 2026-08-05 закреплено в
`sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md` и назначает
технические agent roles только для разрешённых evidence-spikes. `Unassigned`
означает `NOT ENTERED`. Один и тот же человек не может быть accountable owner
и independent reviewer одного work package; ни назначение, ни waiver не
обходят gates из таблицы выше.

Для уже entered waiver-spikes таблица дословно отражает назначенные agent roles
из их work package. Это не является назначением human production owner и не
меняет `G-READY`, terminal status или обязательные независимые evidence.

| Work package | Accountable implementation/evidence owner | Independent reviewer | Status / required condition |
| --- | --- | --- | --- |
| S-1 | `Codex /root/ownership_readiness_review` | `Codex /root/spike_s2_topology` | Historical disposable spike remains **terminal `PAUSED`**. The separate current-product decision `evidence/current-product-gates-2026-08-30.md` records **`G-S1-renderer = PASS`**: AD-13 selects direct Three.js/WebGL2 behind the renderer port; current lifecycle regressions and Product Owner NFR-15 acceptance satisfy the active gate. |
| S-2 | `Codex /root/spike_s2_topology` | Roman Zheltov (terminal human reviewer) | **`G-S2-topology = PASS`**: 47 SHA-bound current Alpha TCC-A1 rows, parser-backed legacy-unreadable boundary and full technical checks. Roman recorded terminal `PASS` in the consolidated review record; historical disposable spike remains preserved. |
| S-3 | `Codex /root/spike_s3_storage` | `Codex /root` | Historical disposable spike remains `PAUSED`. The separate current-product decision `evidence/current-product-gates-2026-08-30.md` records **`G-V01-S3 = PASS`**: current durable/fencing/schema/history evidence plus Product Owner-confirmed mobile restart/hand-off acceptance satisfy the active gate. |
| S-4 | `Codex /root/spike_s4_touch` | `Codex /root` | Historical disposable spike remains `PAUSED`. The separate current-product decision `evidence/current-product-gates-2026-08-30.md` records **`G-S4-touch = PASS`**: current gesture/numeric/44×44/error-taxonomy regressions plus Product Owner NFR-15 acceptance satisfy the active gate. |
| S-6 | `Codex /root`; content owner — Roman | Roman Zheltov (terminal human reviewer) | **`G-S6-catalog = PASS`**: 12-assets/20-resources matrix, rights grant, floor/wall anchors and verified versioned catalog → pin → durable → backup → restore chain. Roman recorded terminal `PASS` in the consolidated review record; historical disposable spike remains preserved. |
| V-01 | Local-first/persistence implementation owner — **unassigned** | Independent persistence/recovery reviewer — **unassigned** | `G-READY` + `G-V01-S3` + `G-WEB-AD16`; `WEB-BOOTSTRAP-01` is runtime evidence, not early scaffold authority |
| V-02 | Geometry/interaction implementation owner — **unassigned** | Independent geometry/UX reviewer — **unassigned** | `G-READY` + topology/touch gates |
| V-03 | Renderer/projection implementation owner — **unassigned** | Independent renderer/architecture reviewer — **unassigned** | `G-READY` + `G-S1-renderer` |
| V-04 | Constrained-wall implementation owner — **unassigned** | Independent geometry/interaction reviewer — **unassigned** | `G-READY` + topology/touch gates |
| V-05 | Topology-change implementation owner — **unassigned** | Independent topology/corpus reviewer — **unassigned** | `G-READY` + dependent topology gates |
| V-06 | Room-model implementation owner — **unassigned** | Independent geometry/domain reviewer — **unassigned** | `G-READY` + dependent topology gates |
| V-07 | Opening implementation owner — **unassigned** | Independent topology/domain reviewer — **unassigned** | `G-READY` + dependent topology/touch gates |
| V-09 | Catalog/placement implementation owner — **unassigned** | Independent catalog reviewer — **unassigned** | `G-READY` + V-07 + `G-S1-renderer`, `G-S4-touch`, `G-S6-catalog` |
| V-09-CP | Catalog Control Plane implementation owner — **unassigned** | Independent backend/catalog-boundary reviewer — **unassigned** | `G-READY` + V-09 + `G-S6-catalog` + `G-CP-ADR`; Kotlin/PostgreSQL remains catalog-only |
| V-10 | Placement/history implementation owner — **unassigned** | Independent domain/resource-history reviewer — **unassigned** | `G-READY` + V-09 |
| V-11 | Collision/placeholder implementation owner — **unassigned** | Independent geometry/UX reviewer — **unassigned** | `G-READY` + V-10 |
| V-12 | Item-variant/resource-semantics implementation owner — **unassigned** | Independent catalog/persistence reviewer — **unassigned** | `G-READY` + V-10 + `G-S1-renderer` + `G-S6-catalog` |
| V-13 | retired 2026-08-25: independent Project duplicate is outside Alpha | — | — |
| V-14 | Confirmed-deletion/recovery-boundary implementation owner — **unassigned** | Independent persistence/recovery reviewer — **unassigned** | `G-READY` + V-12 + `G-V12-resource-semantics` |
| V-15 | PWA/offline implementation owner — **unassigned** | Independent platform/device reviewer — **unassigned** | `G-READY` + S-3/S-6 dependent gates |
| V-16 | Storage/update/recovery implementation owner — **unassigned** | Independent persistence/security reviewer — **unassigned** | `G-READY` + V-15 |
| V-17 | Backup/import implementation owner — **unassigned** | Independent portability reviewer — **unassigned** | `G-READY` + `G-S6-catalog` |
| V-18 | Performance/reliability diagnostics owner — **unassigned** | — | Optional post-Alpha diagnostics; NFR-15 two-device functional acceptance is complete |
| V-19 | Accessibility/privacy evidence owner — **unassigned** | Independent accessibility/privacy reviewer — **unassigned** | `G-READY`; independent from prior implementation owner |
| V-20 | User-research/release-evidence owner — **unassigned** | Independent research/evidence reviewer — **unassigned** | `G-READY`; G-1 and real participant evidence remain mandatory |

### Inherited Playwright E2E and evidence declaration — every user-facing Story

Каждая `### Story` ниже **объявляет через этот обязательный inheritance clause**:
для каждого user-facing BDD `Given/When/Then` должен существовать связанный
Playwright E2E scenario, использующий видимые UI/DOM controls и релевантный
browser/mobile-touch context. Story не считается готовой без test ID, связи с
acceptance flow и green regression run; эта политика распространяется на
Stories, добавленные при последующих change-control.

- touch, canvas и numeric-alternative flows проверяются Playwright в mobile
  viewport/touch configuration; normal browser flow не заменяет соответствующий
  touch path;
- PWA, offline, update, recovery, backup, import, writer-lock и
  capability-fallback flows имеют Playwright end-to-end coverage с
  контролируемыми fixtures/faults и service-worker/browser contexts, где они
  автоматизируемы;
- browser-tab и installed-PWA flows различаются в test evidence; реальный iOS
  Home Screen, OS eviction, quota pressure и thermal остаются отдельными
  physical-device checks и не могут быть объявлены пройденными только
  Playwright;
- Catalog Stories 5.1, 5.6, 8.4, 8.6 и 8.8 дополнительно обязаны оставлять
  green named `CATALOG-E2E-01`–`05`: browse/unpinned outage, versioned
  publication, fully pinned local edit/undo/redo, actual resource corruption и
  portable backup without remote fetch. Browser stubs проверяют только
  `CatalogGatewayPort` outcomes; Kotlin/PostgreSQL perimeter получает отдельные
  contract tests after `G-CP-ADR`, а physical NFR-15 evidence остаётся
  самостоятельным;
- Playwright не заменяет pure domain/unit/property/golden evidence для
  geometry, exact mm, durability, migrations, resource roots, fault injection
  и stable reason codes. У каждой Story сохраняется соответствующий слой
  domain/contract/device evidence из её Trace.

Эта декларация задаёт будущую test obligation; в этом planning change не
создаётся ни Playwright test, ни application code.

### Протокол screenshot checkpoint — без остановки работы

После каждого material user-visible milestone команда присылает владельцу
небольшой screenshot **реально запущенного** приложения. Сообщение содержит
checkpoint ID, build/revision, device или viewport, сценарий и видимое
состояние. Работа продолжает следующий безопасный slice; замечание владельца
фиксируется через change-control и не подменяет evidence. Screenshot не
доказывает correctness, PWA/offline, real-device performance, accessibility,
privacy или release-gate PASS.

| Checkpoint | Реальный пользовательский результат, который показывается |
| --- | --- |
| `SC-V01` | создание/открытие Project, durable status, первая отменяемая/повторяемая правка имени |
| `SC-V02` | точная Room, mm measurement, two-point measurement, undo/redo/cancel |
| `SC-V03` | один Project в Plan и 3D без domain mutation |
| `SC-V04` | constrained Wall touch/numeric preview и confirm/reject |
| `SC-V05` | move/split/delete topology с preview последствий |
| `SC-V06` | derived multi-Room boundaries и параметры |
| `SC-V07` | Door/Window, shared-wall/opening constraints и согласованная Plan/3D проекция |
| `SC-V09` | catalog card, pin/progress и первый Durable placement |
| `SC-V09-CP` | versioned catalog card либо graceful `control-plane-unavailable`/`unpinned-download-unavailable` state с retry/cancel; screenshot не доказывает server boundary, availability или physical device support |
| `SC-V10` | AssetInstance selection, transform/actions и visible undo/redo history |
| `SC-V11` | collision/clearance и Parametric Placeholder |
| `SC-V12` | item variants с visible offline-ready/backup-ready state |
| `SC-V13` | retired 2026-08-25: independent Project duplicate removed from Alpha |
| `SC-V14` | Confirmed permanent deletion/recovery boundary |
| `SC-V15` | browser/standalone PWA offline reopen and edit |
| `SC-V16` | storage-risk, resource recovery или safe update state |
| `SC-V17` | complete backup/import state |
| `SC-V18` | device-visible quality/context-recovery state next to its trace metadata |
| `SC-V19` | accessible core-flow control and privacy-safe diagnostics state |
| `SC-V20` | consent-safe independent rehearsal milestone, only if participant consent permits capture |
| `SC-P01`–`SC-P03` | Alpha+ only: GLB reject, classified preview and portable reuse lifecycle |

### H-DEV-01 — device-functional acceptance [DONE] (не Story и не скрытое решение)

Product Owner superseded the former matrix by the formal 2026-08-29
`bmad-prd` update. The Alpha NFR-15 result is the completed functional
browser/PWA check on iPhone 15 Pro Max and Samsung S24 Ultra. The former
eight-context matrix, exact OS/browser trace fields, RS-2 timing, thermal
protocol and independent reviewer are historical diagnostics, not Alpha gates.

## Epic 1: Локальный проект, которому можно доверять

Пользователь может без аккаунта создать, открыть и переименовать локальный
Project, понимать durable status и безопасно отменить либо вернуть первую
правку до перехода к геометрии.

**Execution gates:** Для V-01 обязательны `G-READY`, `G-V01-S3` и
`G-WEB-AD16` из общего gate table. Bounded `G-WAIVER-*` может разрешить только
изолированный disposable evidence-spike вне production paths и не разрешает
эту Story. S-3 — явный prerequisite, а не ссылка в trace: до его `PASS`
никакая Story Epic 1 не начинает implementation. V-02 дополнительно требует
завершённый пользовательский durable-command/history/cancel substrate Story
1.4; решения/spikes не могут быть неявно заменены кодом.

### Story 1.1: Инициализировать единый web-root и создать Durable Project

Как пользователь,
я хочу создать локальный Project с именем и сразу понять, что его первая
ревизия действительно сохранена,
чтобы начать планировку без аккаунта и не потерять работу при закрытии
приложения.

**Trace:** CAP-1; FR-1, FR-5; NFR-3, NFR-10, NFR-11, NFR-24, NFR-26; AD-2,
AD-3, AD-4, AD-12, AD-16; UX-DR1, UX-DR6, UX-DR15, UX-DR19, UX-DR24;
UX-DR2, UX-DR29; V-01; EV-06, EV-07, EV-17.

**Screenshot checkpoint:** `SC-V01` по центральному protocol.

**Acceptance Criteria:**

**Given** `G-READY`, `G-V01-S3` и `G-WEB-AD16` passed, а production
implementation owner получил этот первый vertical slice
**When** он создаёт planned unified-root web substrate
**Then** `apps/web` создаётся ровно из `create-rspack@2.1.8 react-ts` на
Node `24.19.0` LTS с `pnpm@11.20.0`, одним committed `pnpm-lock.yaml`, React
`19.2.8`, TypeScript `7.0.2`, `@rspack/core`/`@rspack/cli` `2.1.8`, CSS
Modules `*.module.css`, `@rstest/core`/`@rstest/adapter-rspack` `0.11.5` и
`@playwright/test` `1.62.1`
**And** repository root reserves `apps/catalog-control-plane` only as the
AD-17 boundary until `G-CP-ADR`; it neither selects Kotlin framework/build/
transport nor creates remote Project storage, Vite/Vitest, a second JS lockfile
or an unpinned host-Node dependency.

**Given** the authorized web seed is installed from its frozen lockfile
**When** build/test commands run in CI
**Then** Rspack build, Rstest domain/application/DOM-independent seam tests
and Playwright browser baseline run against the same `apps/web` application
configuration
**And** Kotlin tests remain outside the JS runner until the bounded backend ADR
selects their own reproducible harness.

**And** named `WEB-BOOTSTRAP-01` records the frozen-lock install, Rspack build,
Rstest run and Playwright smoke against that one `apps/web` configuration;
this runtime evidence is not claimed before the authorized scaffold exists.

**Given** первый запуск с доступным app shell и без аккаунта
**When** пользователь вводит допустимое рабочее имя и подтверждает создание
**Then** создаётся один Local Project с stable internal ID, schemaVersion,
timestamps, одним пустым Level и valid initial state
**And** создание не требует сети после первого успешного открытия shell.

**Given** пользователь впервые видит локальный app shell
**When** он начинает создание своего Project
**Then** рабочие Canvas/Surface/Text/Muted/Primary и semantic status tokens
сохраняют WCAG-совместимый non-colour state, а onboarding объясняет мм и local
storage с dismissible/reopenable tips для build/dimension/3D
**And** demo не подменяет создание собственного Project и не требует account.

**Given** candidate initial Revision прошла domain validation
**When** staging write, checksum и atomic current-pointer swap завершаются
успешно
**Then** UI показывает saved только для опубликованной Durable Revision
**And** повторное открытие читает именно эту Revision, а не renderer/UI state.

**Given** запись, checksum или publication прерваны либо процесс закрыт на
границе persistence
**When** Project открывается снова
**Then** читаема последняя Durable Revision без partial state
**And** пользователь видит persist-failed/recovery-needed и следующая
mutating command не начинает новый commit до явного retry/recovery.

**Playwright E2E — `PROJECT-E2E-01` (create first local Project).**

**Given** installed web build starts in a clean browser profile without account
or network after the required app-shell availability setup
**When** пользователь вводит valid name и confirms creation
**Then** visible UI shows one local Project and saved only after the Durable
publication boundary
**And** browser regression is not evidence of physical NFR-15 performance or
PWA context certification.

### Story 1.2: Найти, открыть и переименовать свой Project

Как пользователь,
я хочу видеть свои локальные проекты, открыть нужный и изменить его название,
чтобы быстро вернуться к правильному варианту планировки.

**Trace:** CAP-1; FR-2; NFR-3, NFR-18, NFR-21, NFR-24, NFR-26; AD-2, AD-3,
AD-4, AD-12; UX-DR1, UX-DR4, UX-DR6, UX-DR7, UX-DR21; V-01; EV-06, EV-07,
EV-13, EV-14, EV-17.

**Acceptance Criteria:**

**Given** local store содержит ноль, один или несколько Projects
**When** пользователь открывает список Projects
**Then** UI различает first-run/empty, loading, populated и corrupted states
**And** каждая доступная карточка даёт понятное действие открыть или
переименовать без hover-only interaction.

**Given** пользователь выбирает Project из списка
**When** он открывает его
**Then** editor получает current Durable Revision выбранного Project
**And** corrupt record не маскируется пустым Project, а ведёт к recoverable
status с non-sensitive reason code.

**Given** пользователь вводит допустимое новое имя Project
**When** rename становится Durable
**Then** видимое имя обновляется без смены internal ID и без clone данных
**And** failure оставляет прежнее durable имя и объясняет безопасный следующий
шаг рядом с доступным control.

### Story 1.3: Защитить Project от одновременной записи из второго context

Как пользователь,
я хочу, чтобы второй tab или standalone context открывал мой Project безопасно,
чтобы параллельная работа не могла молча перезаписать уже сохранённые данные.

**Trace:** CAP-1; cross-cutting FR-5; NFR-3, NFR-11, NFR-13, NFR-16, NFR-24,
NFR-25, NFR-26; AD-3, AD-4, AD-12; UX-DR6, UX-DR21, UX-DR24, UX-DR27,
UX-DR30; S-3; EV-06, EV-07, EV-13, EV-17.

**Acceptance Criteria:**

**Given** один local context владеет writer lease/fencing token Project
**When** второй tab или standalone context открывает тот же Project
**Then** второй context получает read-only state и не может publish Command
**And** оба UI честно показывают ownership/status, не выдавая draft за saved.

**Given** пользователь в read-only context выбирает explicit takeover
**When** fencing token успешно передаётся по approved policy
**Then** только новый context может публиковать последующую Revision
**And** старый context сохраняет свой незавершённый draft лишь как
preview/recovery copy, а не как competing commit.

**Given** lease потерян, takeover отменён или publication сталкивается с
fencing conflict
**When** contexts продолжают работу
**Then** current Durable Revision остаётся неизменной
**And** user получает доступное recovery/takeover explanation без silent
last-writer-wins behavior.

### Story 1.4: Подтвердить, отменить или вернуть первую правку Project

Как пользователь,
я хочу безопасно подтвердить, отменить или вернуть первую правку моего Project,
чтобы дальнейшее рисование комнаты не стало первым местом, где приложение
учится обращаться с моими данными.

**Trace:** CAP-1, CAP-8; FR-5; foundational cross-cutting FR-38, FR-39,
FR-40; NFR-3, NFR-4, NFR-11, NFR-13, NFR-17, NFR-18, NFR-19, NFR-24,
NFR-26; AD-2, AD-3, AD-4, AD-12; UX-DR6, UX-DR7, UX-DR13, UX-DR21,
UX-DR22, UX-DR24, UX-DR30; V-01; EV-06, EV-07, EV-13, EV-17.

**Screenshot checkpoint:** `SC-V01` по центральному protocol.

**Acceptance Criteria:**

**Given** пользователь начинает первую изменяющую правку доступного Project
(например, rename) через видимый control
**When** он ещё не подтвердил DraftCommand либо выбирает Cancel
**Then** draft остаётся preview, а current Durable Revision, autosave и
session History не меняются
**And** тот же cancel outcome доступен через touch и DOM/numeric control без
canvas-only зависимости.

**Given** valid Command подтверждена пользователем
**When** она проходит `PendingDurability → staging write → checksum → atomic
pointer swap`
**Then** UI различает saving и saved, создаёт ровно одну `Durable Revision` и
один HistoryEntry только после publication
**And** следующая mutating Command не начинает publication до durable/rejected
outcome предыдущей.

**Given** одна первая правка стала Durable
**When** пользователь выбирает undo, затем redo
**Then** canonical Project возвращается к prior Durable Revision и снова к
последующей Revision без renderer/UI state как источника истины
**And** ActionDock сообщает доступное следующее действие и не обещает history
за пределами текущей session boundary.

**Given** session уже содержит доступные undo/redo entries, а prospective valid
Command превысила resource-entry либо bytes envelope `SessionRetentionPolicy`
**When** policy проверяется до candidate mutation и publication
**Then** Command отклоняется с stable reason `PROJECT_HISTORY_RESOURCE_LIMIT`,
а current Durable Revision, undo/redo lists, Revision records, resource
manifests и GC roots остаются неизменными
**And** redo не удаляется после reject/cancel/persistence failure и может быть
заменён только после successful atomic publication новой history branch.

**Given** validation или persistence отклоняет правку
**When** UI получает stable reason code
**Then** prior Durable Revision и существующая History остаются доступными
**And** пользователь получает объяснение и безопасный retry/cancel path без
partial history entry или silent data loss.

## Epic 2: Точный первый план комнаты

Пользователь может создать и измерить одну геометрически валидную Room в
миллиметрах: прямоугольником либо constrained walls, с точным input, preview,
safe topology edits и понятным результатом invalid operation.

**Execution gates:** V-01 Story 1.4 durable-command/history/cancel substrate,
`G-S2-topology` и `G-S4-touch` должны быть `PASS` до начала соответствующей
реализации. Эти spikes являются evidence-gates, а не «техническими stories», и
не могут быть подменены будущей feature-работой.

### Story 2.1: Создать и измерить точную прямоугольную Room

Как пользователь,
я хочу ввести внутренние ширину, глубину и высоту комнаты в миллиметрах и сразу
увидеть точный план с измерениями,
чтобы начать проверку планировки без CAD-навыков.

**Trace:** CAP-2, CAP-3, CAP-8; FR-6, FR-13; cross-cutting FR-38, FR-39,
FR-40; NFR-1, NFR-3, NFR-4, NFR-17, NFR-18, NFR-19, NFR-26; AD-1, AD-2,
AD-3, AD-6, AD-7, AD-12, AD-19; UX-DR3, UX-DR4, UX-DR8, UX-DR10,
UX-DR15, UX-DR22, UX-DR30, UX-DR36; V-02; EV-02, EV-03, EV-06, EV-13,
EV-17.

**Screenshot checkpoint:** `SC-V02` по центральному protocol.

**Acceptance Criteria:**

**Given** пользователь находится в новом или пустом Project
**When** он вводит допустимые внутренние width, depth и height в мм и
подтверждает создание
**Then** одна замкнутая Room строится через canonical integer-mm PlanGraph
**And** Wall centerlines смещены так, что derived usable interior polygon
равен введённым внутренним dimensions.

**Given** пользователь открывает свойства или measurement overlay созданной
Room
**When** он читает dimensions, perimeter и area
**Then** единицы, rounding rule и canonical mm values видимы и одинаковы в
доступной numeric surface
**And** display rounding не записывается обратно в доменную модель.

**Given** пользователь создаёт revision-bound `MeasurementRequest` с одним
предписанным target либо с двумя target для `Distance`: Vertex/Plan point,
Wall centerline, Room inner boundary или Item footprint boundary
**When** система вычисляет named operation на `projectId/baseRevisionId/
baseRevisionChecksum`
**Then** она применяет один source-owned exact locator/nearest-point/tie route
для canonical integer-mm geometry и `MeasurementFormatPolicy V1` (`ru-RU`,
half-up: мм либо `0,01 м²`)
**And** Preview, Plan 2D, 3D и export получают одинаковый formatted text, а
screen pixels, renderer mesh, форматированное значение и выбор target не
создают Command, HistoryEntry или изменение canonical mm state.

**Given** result measurement получает stale checksum либо target удалён
**When** пользователь снова видит Project
**Then** result discard-ится и UI предлагает явный reselection/retry
**And** он не переносится на новую Revision и не получает autosave/history
effect.

**Given** V-01 durable-command/history/cancel substrate доступен, command
создаёт Room либо пользователь отменяет active gesture
**When** он выполняет undo, redo, cancel или вводит zero/negative/out-of-bounds
value
**Then** successful intent обратимо как одна Durable command, cancel не создаёт
history/autosave entry, а rejected input оставляет прежнюю Revision
**And** поле сообщает stable reason и сохраняет предыдущее valid value.

### Story 2.2: Нарисовать одну constrained Wall прямым touch-жестом

Как пользователь,
я хочу добавить Wall пальцем с предсказуемой длиной и направлением,
чтобы расширять план без случайной геометрии.

**Trace:** CAP-2, CAP-8; FR-7, FR-8, FR-12; cross-cutting FR-38, FR-39,
FR-40; NFR-1, NFR-3, NFR-4, NFR-5, NFR-17, NFR-18, NFR-19, NFR-26; AD-1,
AD-2, AD-3, AD-7, AD-12, AD-19; UX-DR8, UX-DR10, UX-DR14, UX-DR16,
UX-DR22, UX-DR30, UX-DR36; V-04; EV-02, EV-03, EV-06, EV-13, EV-17.

**Acceptance Criteria:**

**Given** пользователь находится в Plan Mode с валидной immutable
`PlanProjectionPort` snapshot/base checksum
**When** он pan/zoom-ит рабочую область за пределы текущего PlanGraph
**Then** adaptive presentation grid покрывает видимую canvas viewport, а
camera/grid extent/marquee остаются transient и не записываются в Project,
Revision, History или Portable Backup
**And** пользователь может начать обычную constrained Wall в свободной области
без отдельного действия «Расширить».

**Given** пользователь выбирает labelled ActionDock command `Прямоугольная
комната`
**When** он задаёт origin и второй point touch/drag
**Then** UI показывает один dotted axis-aligned rectangular wall-loop candidate
с фактическими мм dimensions до confirm
**And** candidate может быть detached либо иметь only exact endpoint/full-edge
contact с current PlanGraph; visual grid и rectangle не создают второй
editable geometry source.

**Given** rectangular candidate имеет partial collinear overlap,
self-intersection, unsupported connection, invalid/ambiguous Face или stale
base/writer fence
**When** пользователь confirm-ит, отменяет либо retry-ит preview
**Then** source-owned topology preflight/normalization возвращает понятный
rejected/conflict/draft outcome, а cancel/stale/reject не создаёт Command,
ChangeSet, Revision, History или autosave mutation
**And** only fresh valid full candidate проходит ordinary durable/undo-redo
route; произвольное partial-overlap expansion не обещается до `G-S2-topology`
corpus PASS.

**Given** пользователь включает инструмент Wall в Plan Mode и immutable
snapshot/base checksum доступен `PlanProjectionPort`
**When** первый tap задаёт origin, а pointer даёт C1/C2 hit в closed `12 CSS px`
square, C3 inverse либо C4 origin-relative candidate
**Then** preview принимает единственный exact result: class order C1/C2 → C3
→ C4, min squared screen distance и stable `candidateSortKey` для tie,
`18 CSS px` hysteresis, direction tie `E, NE, N, NW, W, SW, S, SE` и C4
`k = max(1, floor((projectedDirectedMm + 50) / 100))`
**And** preview показывает фактические длину/direction до commit, а два пальца
могут pan/pinch canvas без тихой отмены DraftCommand.

**Given** projection неfinite, non-invertible, stale либо отменена
**When** UI не может получить candidate
**Then** DraftCommand остаётся transient `SelectionUnavailable` с retry и
pan/zoom
**And** это не `INVALID_DIMENSION`, rejected command, autosave, History или
сохранённая mutation.

**Given** пользователь создаёт Wall touch-жестом
**When** candidate попадает в orthogonal/45-degree policy
**Then** сохранённые endpoints остаются integer mm без silent rounding или
library default
**And** для недостижимой integer diagonal UI показывает фактическую
квантизованную длину и требует подтверждение; UI не предлагает прямой ввод
глобальных координат.

**Playwright E2E — `PLAN-E2E-01` (projection and paired measurement parity).**

**Given** mobile browser harness подставляет deterministic `PlanProjectionPort`
и revision-bound measurement fixture
**When** он проходит hit/tie/hysteresis, non-invertible retry, доступный DOM
fallback и stale two-target measurement
**Then** наблюдаемый candidate/formatting совпадает с contract fixture, а
`SelectionUnavailable` и stale result не создают History/Durable mutation
**And** browser result дополняет, но не заменяет domain/golden corpus.

**Playwright E2E — `PLAN-E2E-03` (infinite canvas and rectangular draft).**

**Given** mobile browser harness opens a valid PlanGraph and deterministic
projection/topology fixtures
**When** пользователь pan/zoom-ит grid вне текущего контура, создаёт dotted
rectangular candidate through touch, а затем
confirm-ит, cancel-ит или receives reject/stale outcome
**Then** grid/marquee остаются presentation-only, valid path показывает один
fresh candidate result, а cancel/reject/stale не создают Durable mutation,
history или autosave effect
**And** browser result дополняет required topology/lineage corpus и не
substitutes a `G-S2-topology` PASS.

**Given** candidate создаёт duplicate, zero-length, unsupported direction,
self-intersection или выходит за project bounds
**When** пользователь пытается подтвердить его
**Then** command отклоняется без изменения Revision/history/autosave
**And** UI локализует stable reason code и даёт доступный способ исправления.

### Story 2.3: Переместить Vertex без нарушения PlanGraph

Как пользователь,
я хочу изменить положение вершины или связанной Wall,
чтобы исправить замер без пересборки всего плана.

**Trace:** CAP-2, CAP-3, CAP-8; FR-9, FR-12; cross-cutting FR-38, FR-39,
FR-40; NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-26; AD-1, AD-2, AD-3, AD-7,
AD-12, AD-19; UX-DR8, UX-DR10, UX-DR14, UX-DR22, UX-DR36; V-05; EV-03,
EV-04, EV-06, EV-17.

**Acceptance Criteria:**

**Given** valid PlanGraph с существующим Vertex
**When** пользователь перемещает его touch или numeric path
**Then** одна command строит valid constrained graph и не меняет unrelated
subgraph
**And** touch uses the exact projection result while numeric bypasses only
screen selection; both share all-contact normalization and save/reopen не даёт
drift integer-mm endpoints или topology.

**Given** candidate создаёт invalid direction, zero/overlap/self-intersection
или collapsed usable polygon
**When** пользователь пытается подтвердить перемещение
**Then** UI показывает conflict point, stable reason и safe fix
**And** current Revision, history и autosave остаются прежними.

### Story 2.4: Присоединить или split-нуть Wall в общей Vertex

Как пользователь,
я хочу присоединить новую Wall к существующей Vertex или разделить Wall в
правильной точке,
чтобы связные комнаты возникали предсказуемо.

**Trace:** CAP-2, CAP-3, CAP-4, CAP-8; FR-9, FR-12; cross-cutting FR-38,
FR-39, FR-40; NFR-1, NFR-3, NFR-4, NFR-26; AD-1, AD-2, AD-3, AD-6, AD-7,
AD-12, AD-19; UX-DR10, UX-DR14, UX-DR16, UX-DR22, UX-DR36; V-05; EV-03,
EV-04, EV-06, EV-17.

**Acceptance Criteria:**

**Given** existing Wall/Vertex
**When** пользователь присоединяет Wall или запрашивает split
**Then** result использует shared Vertex и все затронутые segments появляются
в одном atomic ChangeSet
**And** повторный touch/numeric input следует тем же stable IDs/reason codes.

**Given** exact T либо otherwise valid exact X contact
**When** all-contact normalization группирует coordinate до materialization
**Then** один shared Vertex и все distinct ordered non-zero partitions входят
в одну candidate topology operation — для X ровно четыре canonical WallSegment
**And** полный Vertex/Wall/Room forward/inverse lineage публикуется только
после validation и Durable publication, без library default.

**Given** contact неinteger/out-of-limit, overlap, self-intersection,
duplicate/coincident Vertex, zero/too-short partition либо иной invariant
не выполнен
**When** detached preflight завершается
**Then** весь candidate отклоняется до Command/Revision mutation с применимым
stable reason, включая `AMBIGUOUS_INTERSECTION` только для действительно
неоднозначной/invalid topology
**And** otherwise valid exact X никогда не отклоняется как
`AMBIGUOUS_INTERSECTION`.

**Given** любой topology command — `AddWallSegment`, `MoveVertex`,
`MoveWallSegment`, `DeleteWallSegment`, `SplitWallSegment` или
`MergeCollinearSegments` — проходит valid detached preflight
**When** candidate materialize-ится либо same intent retry/stale-ится
**Then** opaque IDs/allocation и complete Vertex/Wall/Room forward lineage
детерминированы, total и fence/base-bound, а inverse replay восстанавливает
canonical pre-state
**And** stale/retry/cancel intent не оставляет reserved ID, partial lineage,
independently durable ChangeSet или Revision.

**Playwright E2E — `PLAN-E2E-02` (exact T/X outcome).**

**Given** mobile fixture выводит valid exact T и valid exact X, а также
невалидный contact
**When** пользователь preview-ит, confirm-ит либо исправляет numeric/touch input
**Then** valid result показывает одну shared Vertex и affected pieces, а reject
не меняет Project/History/autosave/`PendingDurability`
**And** browser flow остаётся дополнением к exact topology/lineage corpus.

**And** S-2 corpus дополнительно покрывает all topology commands, включая
`MergeCollinearSegments`, repeated/retry/stale intent, total allocation и
forward/inverse replay before any implementation gate may pass.

### Story 2.5: Изменить толщину Wall без подмены Room height

Как пользователь,
я хочу задать толщину Wall в миллиметрах,
чтобы план отражал реальные строительные dimensions.

**Trace:** CAP-2, CAP-3; FR-10; NFR-1, NFR-3, NFR-4, NFR-26; AD-1, AD-2,
AD-3, AD-6, AD-7, AD-12; UX-DR8, UX-DR10, UX-DR22, UX-DR30; V-05;
EV-03, EV-04, EV-06, EV-17.

**Acceptance Criteria:**

**Given** пользователь изменяет thickness существующей Wall
**When** он подтверждает value в product limits
**Then** centerline/endpoints остаются canonical, usable polygons и
measurements пересчитываются
**And** Room.heightMm остаётся единственным editable height source, а
shared-wall projection использует derived rule.

**Given** thickness нарушает limits либо схлопывает usable polygon
**When** пользователь подтверждает изменение
**Then** candidate отклоняется атомарно с reason/fix
**And** opening-aware revalidation выполняется в Story 3.4 после появления
Opening domain objects и не создаёт неявного состояния в этом срезе.

### Story 2.6: Удалить Wall или Vertex с preview последствий

Как пользователь,
я хочу увидеть последствия удаления до commit,
чтобы не сломать план случайным действием.

**Trace:** CAP-2, CAP-3, CAP-8; FR-11, FR-12; cross-cutting FR-38, FR-39,
FR-40; NFR-1, NFR-3, NFR-4, NFR-26; AD-1, AD-2, AD-3, AD-6, AD-7, AD-12,
AD-19; UX-DR7, UX-DR10, UX-DR22, UX-DR30, UX-DR37; V-05; EV-03, EV-04,
EV-06, EV-17.

**Acceptance Criteria:**

**Given** Wall или Vertex выбраны canvas touch path либо доступным selected-
object list/numeric alternative
**When** пользователь вызывает labelled action `Удалить стену` или `Удалить
вершину`
**Then** action не является irreversible dialog и preview перед confirm
перечисляет affected Room и topology change с допустимыми confirm/cancel
outcomes
**And** обычная valid deletion остаётся одним reversible Durable command,
который получает понятный ActionDock label.

**Given** пользователь выбрал Wall или Vertex
**When** deletion может удалить/merge-нуть Room либо изменить topology
**Then** UI preview-ит affected result до explicit confirm
**And** confirm повторно проверяет current base Revision и writer fence,
заново запускает discovery/validation и только затем materialize один atomic
candidate.

**Given** preview отменён, stale либо writer fence потерян
**When** пользователь возвращается к Plan
**Then** UI сохраняет безопасный draft/последнюю Durable Revision
**And** Command, ChangeSet, Revision, History и partial orphan effect не
materialize.

**Given** deletion undefined или invalid
**When** пользователь подтверждает его
**Then** нет dangling reference или partial state
**And** UI объясняет safe corrective action; orphaned-Opening остаётся
отдельной topology-aware проверкой Story 3.4 после появления Opening domain
objects, а wall-hosted AssetInstance rehost/orphan — Story 5.3 после Durable
placement.

**Playwright E2E — `PLAN-E2E-04` (selected Wall deletion consequence).**

**Given** controlled mobile fixture имеет selected Wall/Vertex и affected
Room или topology-change outcome
**When** пользователь выбирает delete через canvas/list, inspect-ит preview,
confirm-ит, cancel-ит либо получает stale/fence-loss route
**Then** visible surface даёт object/action/outcome и только fresh valid confirm
materialize-ит один reversible deletion
**And** cancel/stale/fence-loss/reject сохраняют current Durable Revision,
History и PlanGraph/Room state; browser result дополняет topology corpus.

## Epic 3: Связная квартира: комнаты, стены и проёмы

Пользователь может развить первый план до нескольких связанных Room, сохраняя
семантические Room properties, добавляя Door/Window и безопасно меняя topology.

**Execution gate:** До Stories 3.1–3.4 должны быть утверждены S-2 rules для
automatic AddWall split-height inheritance, Room merge identity и Opening
relocation. Неоднозначные safety semantics не разрешаются реализацией «по
умолчанию».

### Story 3.1: Вывести устойчивые Rooms из замкнутой topology

Как пользователь,
я хочу, чтобы замкнутые части моего плана становились узнаваемыми Room и не
теряли свою идентичность при локальной правке,
чтобы продолжать работать с теми же помещениями, а не с случайными полигонами.

**Trace:** CAP-3; FR-14, FR-15; NFR-1, NFR-3, NFR-4, NFR-24, NFR-26; AD-1,
AD-2, AD-3, AD-6, AD-7, AD-12, AD-19; UX-DR10, UX-DR16, UX-DR21, UX-DR22,
UX-DR37; V-06; EV-03, EV-04, EV-06, EV-17.

**Screenshot checkpoint:** `SC-V06` по центральному protocol.

**Acceptance Criteria:**

**Given** canonical PlanGraph содержит замкнутую bounded Face
**When** topology command становится Durable
**Then** system выводит Room из Face, исключая внешнюю/незамкнутую область и
Face с неположительной площадью
**And** usable polygon, area и perimeter остаются derived projections, а не
вторым editable source of truth.

**Given** bounded Face имеет одну simple outer ring и ноль или больше simple,
strictly contained, pairwise non-touching void rings
**When** она проходит derivation
**Then** создаётся одна Room с preserved holes, а usable polygon offset-ится от
outer и void boundaries как derived geometry
**And** repeated bounded walk, non-simple, touching или nested/ambiguous ring
не создаёт partial Room/Revision и получает source-owned stable reason.

**And** S-2 face corpus фиксирует simple hole, hole offset/collapse, repeated
bounded walk, touching/nested rings и разрешённый repeated unbounded exterior
с exact Room/usable post-state либо stable no-mutation outcome.

**Given** local topology edit имеет однозначное соответствие старой и новой
Face
**When** reconciliation завершается
**Then** семантически та же Room сохраняет roomId и уже совместимые metadata
**And** result одинаков для одинаковой versioned input и не зависит от
начальной точки обхода boundary.

**Given** valid `AddWall` делит одну derived Room на successors
**When** пользователь подтверждает обычный Wall candidate
**Then** та же атомарная команда сразу materializes every successor с точным
predecessor `heightMm`
**And** UI не спрашивает, какая left/right Room сохраняет `roomId`, name, type
или history.

**Given** approved S-2 matching policy обнаруживает merge либо неоднозначное
Room-lineage consequence
**When** пользователь выбирает допустимый Room merge/retained-identity outcome
в `ConflictPreview/AwaitingUserOutcome` и confirm-ит preview
**Then** current base Revision и writer fence повторно проверяются, а
derivation/lineage/validation полностью выполняются заново до одного
materialized candidate
**And** cancel, stale base или lock loss не создают Command, ChangeSet,
Revision или History.

**Playwright E2E — `ROOM-E2E-01` (holes and identity re-entry).**

**Given** mobile fixture derives a valid holed Room, then splits it with a
valid Wall and separately produces merge stale/cancel/fence-loss outcomes
**When** пользователь confirms the Wall or inspects a safety conflict
**Then** valid hole remains visible/derived, split successors inherit exact
predecessor height without a dialog, and only a merge conflict lists affected
Room data for a fresh confirmation
**And** browser result complements the required outer/void/lineage corpus,
including repeated exterior and no-mutation invalid-face vectors.

Opening conflict/re-entry belongs to Story 3.4/V-07; AssetInstance host
rehome/orphan belongs to Story 5.3/V-09.

### Story 3.2: Назвать, типизировать и задать высоту Room

Как пользователь,
я хочу задать помещению имя, тип и высоту,
чтобы план отражал реальное назначение комнат и их физические свойства.

**Trace:** CAP-3; FR-16; NFR-1, NFR-3, NFR-4, NFR-17, NFR-18, NFR-19,
NFR-26; AD-1, AD-3, AD-6, AD-12; UX-DR3, UX-DR8, UX-DR10, UX-DR16,
UX-DR30; V-06; EV-04, EV-06, EV-13, EV-17.

**Acceptance Criteria:**

**Given** пользователь открывает labelled separate Room directory, а этот
non-canvas flow адресует derived Room
**When** пользователь вводит допустимые name,
Room.type и height через PropertyField
**Then** одна Durable command сохраняет эти user properties к stable roomId
**And** canonical geometry, calculated area и perimeter не становятся
независимо editable width/depth fields.

**Given** Plan или 3D показывает derived Room до такого redesign
**When** пользователь касается её поверхности
**Then** UI не создаёт Room selection, picker или property panel
**And** metadata command не запускается случайно и не создаёт history entry.

**Given** пользователь применил новую heightMm Room
**When** 2D/3D projections обновляются
**Then** Room.heightMm остаётся единственным editable source высоты помещения
**And** wall height вычисляется из Room rules, не создавая отдельного
wall-height editor.

**Given** golden fixture `shared-wall-height-opening-min` содержит две adjacent
Room высотой `2400 mm` и `2700 mm` с одним shared WallSegment
**When** projection строится из этой одной canonical Revision
**Then** derived shared-wall height равна `max(2400, 2700) = 2700 mm`
**And** это projection rule, а не persisted editable Wall height; fixture
проверяется domain/golden и через user-visible 2D/3D flow.

**Given** value отсутствует, invalid либо command rejected
**When** пользователь пытается сохранить свойство
**Then** field сохраняет prior valid value, объявляет reason assistive
technology и даёт исправимый numeric path
**And** rejected candidate не изменяет Room metadata, history или autosave.

### Story 3.3: Добавить валидную Door или Window на Wall

Как пользователь,
я хочу добавить дверь или окно с реальными размерами на правильную Wall,
чтобы план показывал проёмы и смежность комнат.

**Trace:** CAP-4; FR-17, FR-18; NFR-1, NFR-3, NFR-4, NFR-18, NFR-19,
NFR-20, NFR-26; AD-1, AD-2, AD-3, AD-6, AD-7, AD-12; UX-DR8, UX-DR10,
UX-DR16, UX-DR21, UX-DR22; V-07; EV-04, EV-06, EV-13, EV-17.

**Screenshot checkpoint:** `SC-V07` по центральному protocol.

**Acceptance Criteria:**

**Given** selected Wall has a valid usable interval
**When** пользователь добавляет Door с width, height, sill/threshold policy и
offset либо Window с width, height, sill height и offset
**Then** Opening принадлежит ровно одному WallSegment и целиком помещается в
допустимом интервале
**And** overlapping Opening, out-of-bounds value и unsupported dimension
отклоняются до commit с понятной причиной.

**Given** golden fixture `shared-wall-height-opening-min` с adjacent Room
`2400 mm` и `2700 mm` на shared Wall
**When** пользователь добавляет Door/Window либо меняет его размеры/height
**Then** opening проходит только при `sillMm + opening.heightMm ≤ min(2400,
2700) = 2400 mm`; граничное равенство разрешено
**And** candidate с суммой `2401 mm` отклоняется атомарно как
`OPENING_OUT_OF_BOUNDS`, даже если max-height projection стены равна `2700 mm`.

**Given** валидная Door или Window лежит на Wall
**When** command публикуется
**Then** Opening получает согласованную wall-hosted Plan/3D projection без
navigation edge или transition.

**Given** пользователь открывает Plan и 3D View одной Revision
**When** оба projection строятся
**Then** Door/Window имеют одинаковые canonical dimensions и offset
**And** source of truth не является отдельной 3D-моделью проёма.

### Story 3.4: Сохранить либо безопасно изменить Opening при правке Wall

Как пользователь,
я хочу переместить, изменить или удалить Opening и видеть последствия изменения
его Wall до сохранения,
чтобы не оставить в проекте повреждённую ссылку или невозможный проём.

**Trace:** CAP-4, CAP-8; FR-19; cross-cutting FR-10, FR-11, FR-38, FR-39,
FR-40; NFR-1, NFR-3, NFR-4, NFR-26; AD-1, AD-3, AD-6, AD-7,
AD-12, AD-19; UX-DR8, UX-DR10, UX-DR16, UX-DR22, UX-DR30, UX-DR37; V-07;
EV-04, EV-06, EV-13, EV-17.

**Acceptance Criteria:**

**Given** existing Opening на Wall и approved opening-relocation policy
**When** пользователь move/resize/delete-ит Opening numeric input или
touch gesture
**Then** allocation-free preflight оценивает одну topology-aware candidate без
Command, complete ChangeSet, inverse или resource allocation
**And** only unambiguous valid change может после full validation стать одной
Durable обратимой command; Active Gesture можно отменить без history/autosave
mutation.

**Given** пользователь изменяет длину, толщину, orientation или существование
host Wall
**When** Opening после этого не помещается либо host больше не существует
**Then** единственный lineage-compatible host сохраняет Opening только при
valid interval/height, иначе UI показывает `ConflictPreview` с affected Opening
и allowed resize/rehome/delete/cancel outcomes
**And** orphaned Opening не остаётся повреждённой ссылкой, свободным renderer
object или silently rehosted state.

**Given** пользователь выбирает allowed outcome в `ConflictPreview`
**When** он нажимает confirm
**Then** application повторно проверяет current base Revision и writer fence,
rerun-ит discovery/validation и только после этого materialize один complete
candidate
**And** cancel, stale base либо lock loss не создают Command, ChangeSet,
Revision, History или partial Opening effect.

**Playwright E2E — `RECONCILIATION-E2E-01` (Opening conflict re-entry).**

**Given** controlled mobile fixture создаёт Opening conflict и затем меняет
base Revision, fence либо выбирает cancel
**When** пользователь выбирает outcome и пытается confirm
**Then** UI показывает affected Opening/allowed choices и revalidates fresh
state before only a valid one-candidate result
**And** stale/cancel/lock-loss path не оставляет durable or orphaned Opening;
browser regression дополняет domain lineage corpus.

**Given** valid shared Opening существует в fixture
`shared-wall-height-opening-min`
**When** пользователь уменьшает меньшую adjacent Room.heightMm так, что
`sillMm + opening.heightMm` больше новой `min-height`
**Then** one candidate revalidates height rule вместе с topology/Opening state
и показывает conflict preview либо atomically rejects full Command
**And** previous Durable Revision, the valid Opening и обе history branches не
получают partial rehost/delete effect.

**Given** Door state после изменения проверяется в Plan и 3D
**When** команда публикуется
**Then** Door сохраняет валидную wall-hosted projection без navigation edge
или transition
**And** door `locked`/access/key/open-close state не вводится в Alpha.

## Epic 4: Понятная 3D-проверка планировки

Пользователь может переключиться в согласованный 3D-вид, осмотреть свой план
и получить управляемое качество WebGL2 без изменения точности проекта.

**Execution gate:** `G-S1-renderer` должен зафиксировать renderer choice/port
boundary, WebGL2 baseline и context-recovery evidence. Окончательное
device/thermal evidence для full reference scene выполняется позже как
cross-epic Gate V-18, а не создаёт скрытую зависимость историй этого эпика от
future Stories.

### Story 4.1: Переключить одну Durable Revision между Plan и 3D

Как пользователь,
я хочу видеть тот же сохранённый план в 2D и 3D,
чтобы пространственно проверить комнату, не создавая вторую версию проекта.

**Trace:** CAP-5, CAP-11; FR-21, FR-22; NFR-1, NFR-2, NFR-4, NFR-9,
NFR-14, NFR-16, NFR-26; AD-1, AD-2, AD-5, AD-10, AD-12, AD-13; UX-DR1,
UX-DR6, UX-DR7, UX-DR11, UX-DR13, UX-DR15, UX-DR21; V-03; EV-05, EV-12,
EV-17.

**Screenshot checkpoint:** `SC-V03` по центральному protocol.

**Acceptance Criteria:**

**Given** current Project имеет Durable Revision с канонической Plan geometry
**When** пользователь переключает persistent ViewSwitch между Plan и 3D
**Then** mode change не создаёт domain command и не меняет Project geometry
**And** selection, PendingDurability status и camera-independent data
сохраняются, когда объект видим в новом режиме.

**Given** одна и та же versioned Revision открыта повторно
**When** 2D и 3D projections строятся из canonical model
**Then** walls, floors, ceilings, dimensions и доступные Openings имеют
семантически одинаковый результат
**And** renderer objects, mesh и camera state не сериализуются как source of
truth.

**Given** WebGL2 недоступен либо 3D initialization временно не удалась
**When** пользователь открывает Project
**Then** доступный compatibility/recovery state объясняет ограничение
**And** 2D, export-oriented access и canonical Project остаются доступны без
подмены данных пустой 3D-сценой.

### Story 4.2: Осмотреть 3D-план без выбора Room surface

Как пользователь,
я хочу управлять камерой и осматривать пространство в 3D,
чтобы проверить план без неясных жестов и без выбора помещения.

**Trace:** CAP-5; FR-23 (V-03 scope: camera inspection only; AssetInstance
selection belongs to Story 5.4/V-10); NFR-5, NFR-17, NFR-18, NFR-19, NFR-26;
AD-2, AD-5, AD-10, AD-12; UX-DR4, UX-DR5, UX-DR7, UX-DR11, UX-DR14, UX-DR21,
UX-DR30; V-03; EV-02, EV-05, EV-12, EV-13, EV-17.

**Acceptance Criteria:**

**Given** пользователь находится в готовом 3D Edit Mode
**When** он выполняет supported orbit, pan или zoom gesture
**Then** camera navigation имеет явную роль и не меняет domain geometry
**And** control respects safe areas, touch target rules и не зависит от
precision hover.

**Given** 3D Edit строит cutaway из current canonical Revision и transient
camera pose
**When** camera orbit меняет направление camera-to-plan-centre
**Then** renderer детерминированно скрывает только near exterior Wall sides по
adopted camera-relative classifier с enter/exit hysteresis, сохраняя far
exterior и все interior Walls
**And** fixed `max-X/max-Z` omission запрещена; classifier/view state не
создаёт Command, Revision, History или persisted renderer data.

**Given** cutaway Auto доступен пользователю
**When** он выбирает labelled DOM control `Показать все стены` или возвращает
`Авто cutaway`
**Then** view становится inspectable без precision-canvas gesture и сохраняет
та же canonical geometry/selection semantics
**And** context loss/recovery пересоздаёт current projection from Revision and
transient camera/view state rather than stale mesh visibility.

**Given** пользователь касается видимой Room surface или на неё попадает
3D-picking result
**When** он продолжает orbit/pan/zoom либо возвращается в Plan
**Then** surface остаётся display-only: нет Room selection, picker, списка или
PropertyField/numeric inspector
**And** этот жест не создаёт доменную mutation, Revision или history entry.

**Given** projection временно disposed либо camera gesture ambiguous
**When** пользователь продолжает interaction
**Then** UI не применяет domain mutation случайно и объясняет текущий state
**And** camera error не создаёт history entry или corrupt renderer-owned state.

**Playwright E2E — `EDITOR-E2E-03C`/`EDITOR-E2E-03D` (Room display-only).**

**Given** valid Room видна соответственно в 3D и Plan
**When** пользователь касается её поверхности
**Then** не появляются Room picker или selected-Room property panel
**And** camera/Plan gesture не создаёт Durable Revision или history entry.

**Playwright E2E — `CUTAWAY-E2E-01` (camera-relative exterior cutaway).**

**Given** controlled mobile renderer fixture contains exterior and interior
Walls and a sequence of camera sectors around the Plan
**When** пользователь orbit-ит через each sector, crosses the hysteresis
boundary, chooses Show-All/Auto, then triggers context recovery
**Then** near exterior sides change with camera, far/interior Walls remain
visible according to the fixture, no flicker occurs at the threshold and no
domain mutation/history entry is created
**And** browser scenario complements pure renderer/golden camera-sector and
context-loss evidence required by `G-S1-renderer`.

### Story 4.4: Сохранить 3D-проверку отзывчивой и восстанавливаемой

Как пользователь,
я хочу, чтобы 3D-комната оставалась управляемой при ограниченных ресурсах и
возвращалась после потери WebGL-контекста,
чтобы визуальная часть не ставила под угрозу мой Project.

**Trace:** CAP-5, CAP-11; FR-25; NFR-5, NFR-6, NFR-8, NFR-9, NFR-14,
NFR-16, NFR-25, NFR-26; AD-2, AD-5, AD-10, AD-12, AD-13; UX-DR6,
UX-DR21, UX-DR23, UX-DR31; V-03 (initial scene), V-18 (cross-epic final
regression); EV-05, EV-12, EV-17.

**Acceptance Criteria:**

**Given** supported WebGL2 device renders the initial room scene
**When** scene is static outside an active gesture/animation
**Then** renderer works on demand and releases unnecessary continuous work
**And** any quality ladder changes only DPR, shadows, textures, effects or LOD,
never canonical mm geometry, properties, history or persistence.

**Given** runtime detects compatible performance pressure
**When** it reduces quality
**Then** touch editing stays responsive and diagnostics expose current
quality/compatibility tier
**And** user-visible state does not claim that data, dimensions or placement
were simplified.

**Given** WebGL context is lost during or after inspection
**When** context becomes available again
**Then** 3D scene rebuilds from canonical current Revision without reload
**And** repeated failure offers reduced-quality/2D-safe path; the current
NFR-15 two-device functional acceptance is complete, while detailed RS-2,
frame-time and thermal traces remain optional diagnostics rather than blockers.


## Epic 5: Расстановка предметов реальных размеров

Пользователь может найти предмет либо создать Parametric Placeholder, увидеть
его реальные dimensions, безопасно pin-ить и разместить на совместимой
поверхности, затем точно трансформировать, lock/unlock/duplicate/delete и
увидеть collision/clearance feedback.

**Execution gates:** `G-S1-renderer`, `G-S4-touch` и `G-S6-catalog` должны
быть `PASS` в границах соответствующего slice; до Story 5.2 S-6 подтверждает
representative catalog matrix, format/size/hash, exact pin/backup, cache tier
и budgets. Неподготовленный resource не может быть обойдён preview или будущим
backup.
Story 5.6 дополнительно требует `G-CP-ADR`: он закрепляет Kotlin/PostgreSQL
perimeter, не выбирая в пользовательской Story deferred API/transport или
remote Project ownership.

### Story 5.1: Найти подходящий предмет в понятном каталоге

Как пользователь,
я хочу просматривать категории и искать предмет по габаритам или способу
крепления,
чтобы выбрать реальный объект для проверки своей планировки.

**Trace:** CAP-6, CAP-9; FR-26, FR-27; cross-cutting FR-54; NFR-6, NFR-10,
NFR-17, NFR-18, NFR-21, NFR-24, NFR-26; AD-2, AD-8, AD-12, AD-14, AD-16,
AD-17; UX-DR4, UX-DR5, UX-DR6, UX-DR9, UX-DR17, UX-DR21, UX-DR30,
UX-DR35; V-09; EV-10, EV-11, EV-13, EV-14, EV-17.

**Acceptance Criteria:**

**Given** catalog manifest содержит approved generic assets
**When** пользователь открывает furniture, plumbing, appliances/electronics,
lighting или accessories category
**Then** UI показывает declared empty, loading/pinning, offline-ready/
backup-ready, `control-plane-unavailable`, `unpinned-download-unavailable` и
missing/stale/failed/repair states
**And** не выдаёт asset за branded SKU или коммерчески доступный товар без
соответствующего источника.

**Given** пользователь вводит search/filter query
**When** он фильтрует по name, category, AnchorClass или основным dimensions
**Then** результат использует доступный local index и показывает лишь
соответствующие metadata
**And** search state имеет keyboard/screen-reader friendly alternative к
canvas-only flow.

**Given** пользователь открывает ObjectCard
**When** asset доступен для preview
**Then** card показывает canonical name, category, physical dimensions,
allowed variants и resource state
**And** asset без успешных format/size/hash, exact pin и backup readiness
может быть явно marked unavailable и не предлагается как Alpha Durable placement.

**Playwright E2E — `CATALOG-E2E-01` (non-blocking browse outage).**

**Given** mobile-browser fixture открывает healthy local Project, а
`CatalogGatewayPort` controlled stub возвращает `control-plane-unavailable`
либо `unpinned-download-unavailable`
**When** пользователь открывает каталог или пытается получить ещё не pinned
resource
**Then** StatusBanner и catalog textually сообщают, что Project и pinned
предметы продолжают работать локально, и дают labelled retry/cancel
**And** browser regression не ставит Project в read-only/
`ResourceRecoveryRequired`, не создаёт Durable AssetInstance и не заменяет
domain/physical NFR-15 evidence.

### Story 5.2: Разместить backup-ready предмет на полу Room

Как пользователь,
я хочу предварительно увидеть и затем безопасно разместить предмет реального
размера на полу Room,
чтобы проверить его место, не создавая проект, который нельзя восстановить
offline.

**Trace:** CAP-6, CAP-11; FR-28; cross-cutting FR-38, FR-39, FR-40; NFR-3,
NFR-5, NFR-6, NFR-13, NFR-17, NFR-18, NFR-19, NFR-24, NFR-26; AD-2, AD-3,
AD-8, AD-12, AD-14, AD-19; UX-DR9, UX-DR11, UX-DR14, UX-DR17, UX-DR21,
UX-DR25, UX-DR30, UX-DR37, UX-DR38; V-09; EV-06, EV-10, EV-11, EV-12,
EV-13, EV-17.

**Screenshot checkpoint:** `SC-V09` по центральному protocol.

**Acceptance Criteria:**

**Given** пользователь выбрал floor-compatible AssetDefinition и target Room
**When** он начинает placement
**Then** preview появляется рядом с выбранной Room и различает valid, warning
и invalid state
**And** `FloorPlacement` хранит stable `roomId`, integer-mm `xMm/zMm`,
`elevationMm` и declared `yawStep`, но не `levelId`, renderer world position
или вторую mutable surface truth.

**Given** catalog resource прошёл технические format/size/hash
проверки
**When** пользователь подтверждает valid placement
**Then** exact referenced bytes pin-ятся в user-owned store atomically с
repository `PinStagingLease`, затем проходят `BackupFeasibilityPolicy` до
Durable publication
**And** UI показывает progress/retry/cancel, пока resource не
offline-ready/backup-ready.

**Given** pin/admission отменён, отклонён, fence lost либо приложение падает
до atomic publication
**When** startup/GC обрабатывает staging root
**Then** `PinStagingLease` удерживает exact bytes до deterministic
no-publication cleanup либо переводит их в Durable manifest
**And** forced-GC/crash path не создаёт orphaned AssetInstance, Project Revision
или Portable Backup reference.

**Playwright E2E — `RESOURCE-E2E-01` (placement admission lifecycle).**

**Given** controlled repository fixture останавливает, cancel-ит, теряет fence
либо restart-ит pin/admission до publication
**When** пользователь наблюдает placement flow
**Then** UI остаётся truthful preview/retry/cancel без saved AssetInstance и
после restart показывает только current Durable Revision
**And** browser test проверяет observable outcome, а forced-GC root inventory
остаётся обязательным domain/repository corpus.

**Given** resource не pin-ится, exceeds backup envelope либо grant неполный
**When** placement не может стать Durable
**Then** Project и current Durable Revision не меняются
**And** preview остаётся явным non-durable state с безопасным retry/cancel, а
не скрытым AssetInstance.

**Given** Catalog Control Plane становится unavailable до local pin exact
resource bytes
**When** пользователь пытается подтвердить placement
**Then** proposed placement остаётся cancelable preview с labelled retry/cancel
**And** outage не создаёт `ResourceRecoveryRequired`, read-only Project или
Durable AssetInstance.

### Story 5.3: Разместить wall item без потери host address

Как пользователь,
я хочу закрепить совместимый предмет на конкретной Wall,
чтобы изменение плана не оставило его висящим в воздухе или привязанным к
случайной 3D-координате.

**Trace:** CAP-6, CAP-8; FR-28; cross-cutting FR-9, FR-11, FR-15, FR-38,
FR-39, FR-40; NFR-1, NFR-3, NFR-4, NFR-13, NFR-17, NFR-18, NFR-19,
NFR-24, NFR-26; AD-1, AD-3, AD-8, AD-12, AD-14, AD-19; UX-DR8, UX-DR10,
UX-DR17, UX-DR22, UX-DR25, UX-DR30, UX-DR37, UX-DR38; V-09; EV-04, EV-06,
EV-10, EV-11, EV-13, EV-17.

**Acceptance Criteria:**

**Given** wall-compatible AssetDefinition и существующая compatible
surface
**When** пользователь подтверждает placement
**Then** AssetInstance хранит WallPlacement со
stable host address и integer-mm local coordinates
**And** free renderer transform не становится persisted placement state.

**Given** catalog resource прошёл технические format/size/hash
проверки
**When** wall placement проходит admission
**Then** exact bytes pin-ятся atomically с `PinStagingLease`, complete
`BackupFeasibilityPolicy` проходит до Durable placement
**And** reject/cancel/fence-loss/crash остаётся visible preview/retry/cancel и
не создаёт AssetInstance, Revision, History или Portable Backup reference.

**Given** topology command reverse/split/merge/delete меняет host surface
**When** существует один lineage-compatible host
**Then** instance атомарно rehost-ится с сохранением semantic side и offset
**And** same topology input даёт deterministic host result after reopen.

**Given** host удалён или correspondence неоднозначна
**When** пользователь preview-ит candidate
**Then** UI показывает `ConflictPreview/AwaitingUserOutcome` с affected
AssetInstance/host и explicit compatible rehome/delete/orphan/cancel choices
со stable reason code
**And** hidden world-space asset, Command, complete ChangeSet/inverse и partial
Durable Revision не создаются.

**Given** пользователь выбирает допустимый host outcome
**When** он подтверждает preview
**Then** current base Revision и writer fence повторно проверяются, discovery/
host validation rerun-ятся и только затем materialize один complete candidate
**And** cancel, stale base или lock loss не создают placement/rehost mutation.

**Playwright E2E — `RECONCILIATION-E2E-02` (placement-host conflict).**

**Given** fixture удаляет или неоднозначно меняет host Wall после
placement preview
**When** пользователь пытается rehome, orphan или cancel
**Then** visible choices перечисляют affected host and instance, а confirm
публикует только fresh valid result
**And** stale/fence-loss/cancel route не оставляет world-space fallback или
Durable placement.

### Story 5.4: Точно изменить и защитить размещённый предмет

Как пользователь,
я хочу перемещать, поворачивать, дублировать, блокировать, разблокировать и
удалять предмет обратимыми действиями,
чтобы быстро сравнивать расстановку без случайных сдвигов.

**Trace:** CAP-6, CAP-8; FR-29, FR-30; cross-cutting FR-13 (AssetInstance
footprint-boundary measurement), FR-23 (AssetInstance selection), FR-38,
FR-39, FR-40; NFR-1, NFR-3, NFR-5, NFR-17, NFR-18, NFR-19, NFR-26; AD-2,
AD-3, AD-8, AD-12, AD-19; UX-DR7, UX-DR8, UX-DR11, UX-DR14, UX-DR17,
UX-DR30, UX-DR36; V-10; EV-03, EV-06, EV-11, EV-12, EV-13, EV-17.

**Screenshot checkpoint:** `SC-V10` по центральному protocol.

**Acceptance Criteria:**

**Given** Durable AssetInstance уже размещён в Project
**When** пользователь выбирает его в Plan/3D либо через доступный list/numeric
alternative
**Then** picking возвращает stable AssetInstanceId, а selection синхронизируется
с PropertyField без renderer object как источника истины
**And** только после такого выбора доступна transform/action surface этой
Story; pre-item Epic 4 не обещает этот interaction.

**Given** пользователь выбрал unlocked floor-hosted AssetInstance
**When** он вводит position, rotation или разрешённые dimensions в
PropertyField/numeric sheet либо выполняет явный transform gesture в Plan или
3D
**Then** command сохраняет canonical integer-mm FloorPlacement и declared
rotation semantics
**And** fixed-size AssetDefinition не растягивается, а invalid transform
объясняется до commit.

**Given** пользователь выбрал unlocked wall-hosted AssetInstance
**When** он открывает свойства и меняет допустимые host-local offset/elevation/
normal offset/orientation
**Then** command сохраняет stable host address и canonical integer-mm
WallPlacement
**And** свободный drag/rotate, который мог бы снять объект со стены или создать
world-space fallback, недоступен в Plan и 3D.

**Given** пользователь выбирает два canonical `MeasurementTarget`, хотя бы
один из которых является границей footprint Durable AssetInstance
**When** он измеряет проход до Wall/Room или другой AssetInstance footprint
**Then** расстояние выводится из canonical placement и declared footprint по
тому же revision-bound `MeasurementRequest`/closest-point/formatting contract,
что в Story 2.1
**And** stale target требует reselection, renderer mesh/visual bounding box/
screen pixels не являются measurement source, а selection/measurement не
создают Command или HistoryEntry.

**Given** пользователь выполняет duplicate, lock, unlock или delete
**When** действие становится Durable
**Then** duplicate получает independent instance ID, locked item игнорирует
случайный transform, explicit unlock доступен, а delete действует через undo
вместо irreversible dialog
**And** каждое действие отображается понятным next-command label в
ActionDock.

**Given** AssetInstance выбран в Plan, 3D или доступном object list
**When** пользователь нажимает labelled `Удалить предмет`
**Then** unlocked instance удаляется только одной reversible Durable command,
а locked instance сначала объясняет required explicit unlock
**And** current/undo/redo resource manifests and GC roots меняются только
through complete publish/retention policy, не оставляя renderer-only or
prematurely collected resource state.

**Given** пользователь выполняет undo/redo после transform/action
**When** active history branch восстанавливается
**Then** placement, lock state и resource manifests возвращаются согласованно
**And** обе active session-history ветки остаются GC roots до безопасной
Durable replacement policy.

**Playwright E2E — `ITEM-E2E-03` (selected Item deletion and undo).**

**Given** mobile fixture has selected unlocked and locked AssetInstances plus
their current/undo/redo resource references
**When** пользователь удаляет unlocked Item через Plan/3D/list, undo/redo-ит
его либо пытается удалить locked Item
**Then** visible controls/actions match selection/lock state, ordinary delete
is reversible without irreversible dialog and current/history resource state
is consistent
**And** browser result complements repository/GC-root corpus and does not
substitute `G-S6-catalog` or durable-history evidence.

### Story 5.5: Увидеть конфликт и создать точный Parametric Placeholder

Как пользователь,
я хочу видеть пересечения и создать простой предмет с собственными габаритами,
чтобы проверить проход или вместимость даже без нужной модели в каталоге.

**Trace:** CAP-6, CAP-8; FR-31, FR-32; cross-cutting FR-38, FR-39, FR-40;
NFR-1, NFR-3, NFR-5, NFR-17, NFR-18, NFR-19, NFR-26; AD-2, AD-3, AD-8,
AD-12; UX-DR8, UX-DR10, UX-DR11, UX-DR17, UX-DR21, UX-DR22, UX-DR30;
V-11; EV-06, EV-10, EV-11, EV-13, EV-17.

**Acceptance Criteria:**

**Given** AssetInstance preview или Durable placement пересекает Wall, Opening,
другой footprint либо declared clearance zone
**When** collision policy оценивает candidate
**Then** UI показывает tiered, semantic warning/invalid feedback и affected
objects
**And** Alpha не заявляет compliance со строительной нормой и не меняет
Project автоматически.

**Given** пользователь выбирает «Создать placeholder»
**When** он вводит name, width, depth, height, color и AnchorClass в
допустимых limits
**Then** создаётся явно отличимый Parametric Placeholder с physical footprint
**And** он участвует в 2D, 3D, collision, save, export и undo/redo, не
маскируясь под catalog item или commercial SKU.

**Given** Placeholder dimension/AnchorClass invalid либо placement incompatible
**When** пользователь подтверждает candidate
**Then** command отклоняется без durable mutation
**And** UI сохраняет prior valid state, сообщает reason и предоставляет
исправимый numeric alternative.

### Story 5.6: Получить versioned catalog, не отдавая Project сервису

Как пользователь,
я хочу видеть curated catalog без передачи своего Project на
сервер,
чтобы пользоваться актуальными предметами и при этом сохранить local-first
владение планом.

**Execution gate:** `G-READY`, `G-S6-catalog` и `G-CP-ADR` обязательны.
`G-WAIVER-*` может разрешить лишь изолированный disposable evidence-spike вне
этой Story. Этот story не выбирает Kotlin web framework, build system,
API/transport, hosting, resource-byte delivery, PostgreSQL operations/SLA/
retention или account model; они должны быть уже ограниченно решены ADR без
расширения AD-17.

**Trace:** CAP-6, CAP-7, CAP-9; FR-54; cross-cutting FR-26, FR-28, FR-42;
NFR-10, NFR-13, NFR-21, NFR-24, NFR-26; AD-2, AD-4, AD-12, AD-14, AD-16,
AD-17; UX-DR6, UX-DR9, UX-DR17, UX-DR21, UX-DR35; `V-09-CP`; EV-10,
EV-11, EV-13, EV-14, EV-17.

**Screenshot checkpoint:** `SC-V09-CP` по центральному protocol; он показывает
только реально запущенный catalog/outage UI, а не доказывает availability,
physical device compatibility или отсутствие server-side Project storage.

**Acceptance Criteria:**

**Given** Catalog Control Plane публикует approved versioned catalog envelope
с metadata/resource descriptors-or-bytes и content hash
**When** пользователь открывает карточку через web catalog adapter
**Then** приложение получает catalogue data только через `CatalogGatewayPort`
и показывает version/resource metadata, необходимые до preview/placement
**And** boundary/contract evidence подтверждает, что perimeter не принимает,
не хранит и не синхронизирует Project, Revision, session History, Portable
Backup, account identity или user-owned pinned blobs.

**Playwright E2E — `CATALOG-E2E-02` (published catalog and outage boundary).**

**Given** mobile browser controlled fixtures для versioned publication и
service outage
**When** пользователь открывает approved asset, затем повторяет flow при
unavailable service
**Then** approved card показывает declared metadata/resource state, а outage
даёт accessible retry/cancel и оставляет local Project state неизменным
**And** harness records the fake gateway contract separately from Kotlin/
PostgreSQL contract tests; neither browser run is physical NFR-15 evidence.

**Given** integrity scan не находил missing/corrupt referenced hash
**When** remote service unavailable
**Then** UI не показывает `ResourceRecoveryRequired` и не делает Project
read-only
**And** только отдельно detected missing/corrupt exact bytes могут начать
blocking recovery flow из Story 8.6.

## Epic 6: Варианты предметов

Пользователь может применить к предмету разрешённый вариант или цвет и
надёжно увидеть его после reopen. Назначение покрытий пола и стен не входит в
Alpha.

**Execution gate:** S-6 утверждает технический format/size/hash, exact
pin/backup path и offline budget для каталоговых ресурсов до Durable item
mutation. Визуальный preview не доказывает export/backup readiness.

### Story 6.1: Изменить разрешённый вариант или цвет предмета

Как пользователь,
я хочу применить к предмету разрешённый color или material variant,
чтобы сравнить его в моём интерьере, не повреждая исходную модель.

**Trace:** CAP-7, CAP-8; FR-33; cross-cutting FR-38, FR-39, FR-40; NFR-3,
NFR-4, NFR-10, NFR-17, NFR-18, NFR-21, NFR-24, NFR-26; AD-2, AD-3, AD-8,
AD-12, AD-14; UX-DR8, UX-DR9, UX-DR11, UX-DR18, UX-DR30; V-12;
EV-06, EV-10, EV-11, EV-13, EV-14, EV-17.

**Acceptance Criteria:**

**Given** выбранный AssetInstance имеет declared recolorable slots и approved
variants
**When** пользователь выбирает разрешённый variant/color и подтверждает его
**Then** одна Durable command сохраняет domain reference варианта
**And** renderer material object не становится сериализуемым item state.

**Given** slot не существует, не recolorable либо variant не прошёл catalog
policy
**When** пользователь пытается применить его
**Then** candidate отклоняется с доступным reason/action
**And** current item appearance/reference и history остаются валидными.

**Given** пользователь сравнивает вариант
**When** он применяет undo/redo или reopening текущей Revision
**Then** разрешённый reference детерминированно восстанавливается
**And** UI не обещает photo-realism или изменение физического размера
AssetInstance.

### Story 6.2: retired — покрытие точно адресованного пола Room

Retired владельцем продукта 2026-08-25. Floor coverage, `Floor(RoomId)`,
material picker и `SurfaceAssignment` исключены из Alpha. Номер зарезервирован
только как неизменяемый исторический указатель на retired `FR-34`; delivery,
acceptance criteria и automation для него отсутствуют.

### Story 6.3: retired

Потолочная отделка исключена владельцем продукта 2026-08-24 вместе с
потолочной поверхностью и предметами. Story не имеет реализации и не входит
в Alpha; номер сохранён только для непереиспользуемой трассировки `FR-36`.

### Story 6.4: retired — покрытие конкретной стороны shared Wall

Retired владельцем продукта 2026-08-25. Wall coverage, `WallSide(...)`,
finish picker и `SurfaceAssignment` исключены из Alpha. Номер зарезервирован
только как неизменяемый исторический указатель на retired `FR-35`; delivery,
acceptance criteria и automation для него отсутствуют.

### Story 6.5: retired — покрытие offline-ready и portable

Retired владельцем продукта 2026-08-25 вместе с покрытиями пола и стен.
Технические pin/backup правила для моделей остаются в active item stories.
Номер зарезервирован только как неизменяемый исторический указатель на
retired `FR-37`; delivery, acceptance criteria и automation для него
отсутствуют.

## Epic 7: Безопасное экспериментирование с ресурсной историей

Пользователь может пробовать resource-heavy варианты без страха: V-01 уже дал
undo/redo/cancel/reject substrate, а этот эпик подтверждает его на геометрии,
ресурсах, восстановлении и обеих History-ветках.

**Sequencing gate:** Stories Epic 7 не являются первым delivery history/cancel;
они начинают resource-sensitive hardening только после V-09–V-12. Earlier
stories inherit and exercise the V-01 substrate.

### Story 7.1: Вернуть или повторить любую Durable правку текущей сессии

Как пользователь,
я хочу отменять и повторять сохранённые правки,
чтобы безопасно сравнивать варианты плана и предметов.

**Trace:** CAP-8; FR-38; NFR-3, NFR-4, NFR-11, NFR-13, NFR-24, NFR-26;
AD-2, AD-3, AD-4, AD-12, AD-19; UX-DR7, UX-DR13, UX-DR21, UX-DR24,
UX-DR25, UX-DR38; V-02, V-04, V-05, V-10, V-11, V-16; EV-03, EV-04,
EV-06, EV-07, EV-11, EV-17.

**Acceptance Criteria:**

**Given** current session содержит Durable geometry, Opening или item command
**When** пользователь выбирает undo или redo
**Then** canonical state, derived Rooms, adjacency, placements и resource
references восстанавливаются как согласованная Revision
**And** renderer projection пересоздаётся из restored domain state, а не
используется как источник undo.

**Given** validated semantic ChangeSet/inverse содержит nested или duplicate
addresses, topology/Room/surface effects и declared canonical records
**When** pure forward/inverse replay validates it before RevisionCoordinator
admission
**Then** replay доказывает target uniqueness, address validity и deterministic
forward/inverse result без resource bytes, pin root или pointer-publication
authority
**And** fault around atomic pointer swap оставляет current Durable Revision
current; ChangeSet/inverse никогда не являются independently durable records.

**Given** пользователь находится в середине history и создаёт новую допустимую
command
**When** новая command проходит SessionRetentionPolicy и становится Durable
**Then** redo branch остаётся полностью доступной до atomic Durable
publication replacement
**And** only после successful publication старая redo ветка перестаёт быть
History/GC root.

**Given** пользователь находится в середине History с доступной redo branch и
prospective valid Command превысила бы resource entry/bytes envelope
`SessionRetentionPolicy`
**When** policy проверяется до candidate mutation или publication
**Then** команда отклоняется со stable reason
`PROJECT_HISTORY_RESOURCE_LIMIT`, а current Durable Revision, undo/redo lists,
Revision records, resource manifests и GC roots остаются неизменными
**And** redo остаётся доступным после reject, cancel или persistence failure;
UI предлагает явно close/reopen Project для новой history boundary, а не
молча обрезает существующую ветку.

**Given** current Project healthy, но missing/corrupt resource достижим только
из session History
**When** пользователь выбирает DiscardSessionHistory
**Then** confirm явно перечисляет потерю undo/redo, cancel не меняет branches
**And** approved discard заново доказывает healthy current manifest и writer
fence, atomically создаёт видимую новую history boundary без новой Project
Revision; complete backup healthy current остаётся доступен.

**Playwright E2E — `HISTORY-E2E-01` (explicit history discard).**

**Given** controlled browser fixture имеет healthy current Project и
history-only ResourceIssue
**When** пользователь cancel-ит либо confirm-ит `DiscardSessionHistory`, а
harness проверяет healthy-current recheck/fence
**Then** cancel сохраняет обе branches, а approved fenced discard удаляет обе
branches и показывает новую boundary без Project Revision
**And** Playwright observable flow дополняет mandatory history-root/repair
corpus и не маскирует CurrentProject corruption.

**Given** pin/admission либо recovery действие создаёт `PinStagingLease` рядом
с current/undo/redo resource roots
**When** forced GC, cancel, fence loss или crash происходит до publication
**Then** root inventory сохраняет bytes reachable до durable manifest или
детерминированного no-publication cleanup
**And** corpus доказывает, что existing History entry никогда не ломается
молча и не получает самостоятельную Durable ChangeSet запись.

### Story 7.2: Отменить Active Gesture без следа в истории

Как пользователь,
я хочу отменить незавершённый drag или preview,
чтобы случайное движение не стало сохранённой правкой.

**Trace:** CAP-8; FR-39; NFR-3, NFR-17, NFR-18, NFR-19, NFR-26; AD-3,
AD-12; UX-DR7, UX-DR8, UX-DR14, UX-DR22, UX-DR30; V-02, V-04, V-05,
V-10, V-11; EV-03, EV-06, EV-11, EV-13, EV-17.

**Acceptance Criteria:**

**Given** active touch/numeric interaction produces DraftCommand
**When** пользователь выбирает Cancel через доступный control
**Then** prior valid state, current Revision, autosave и history остаются
неизменными
**And** draft preview исчезает без hidden durable mutation.

**Given** gesture конкурирует с camera navigation или BottomSheet control
**When** active control и movement threshold разрешают его как cancel
**Then** system не делает случайный commit
**And** touch и numeric/button alternative имеют ту же cancel semantics.

**Given** пользователь отменяет interaction после temporary invalid preview
**When** он возвращается к Project
**Then** UI показывает последнюю valid applied value
**And** invalid draft не получает saved status или history label.

### Story 7.3: Понять, почему действие не применилось

Как пользователь,
я хочу получить понятное локальное объяснение отклонённой операции,
чтобы исправить ошибку, не опасаясь потерять valid Project.

**Trace:** CAP-8; FR-40; NFR-3, NFR-17, NFR-18, NFR-19, NFR-24, NFR-25,
NFR-26; AD-2, AD-3, AD-12; UX-DR6, UX-DR8, UX-DR21, UX-DR22, UX-DR30;
V-02, V-04, V-05, V-07, V-10, V-11, V-16; EV-03, EV-04, EV-06, EV-07,
EV-11, EV-13, EV-14, EV-17.

**Acceptance Criteria:**

**Given** domain validation rejects a command
**When** UI receives stable reason code and affected semantic reference
**Then** error identifies the object/field, broken rule и safe corrective
action рядом с control или conflict point
**And** logs/diagnostics сохраняют only non-sensitive reason context.

**Given** rejected candidate закрыт пользователем
**When** Project снова отображается
**Then** no history entry, autosave mutation или Durable Revision были созданы
**And** prior valid state остаётся доступным для undo/redo и export по policy.

**Given** пользователь применяет assistive technology
**When** validation message появляется
**Then** ошибка объявляется и focus остаётся возле исправляемого поля
**And** critical correction доступна через DOM/numeric path без canvas-only
gesture.

## Epic 8: Владение, автономность и переносимость Project

После V-12 resource semantics пользователь может окончательно удалить Project
после explicit confirm, установить
PWA, работать offline, восстановить Portable Backup и пережить update без
потери Durable Project.

**Execution gates:** V-14 начинается после `G-V12-resource-semantics`;
V-15–V-17 additionally require `G-V01-S3` и, где
затронуты catalog resources, `G-S6-catalog`. Formal real-device matrix уже
`FORMALIZED` через `H-DEV-01`/PRD NFR-15; Story 8.x не выбирает её заново, а
должна собрать требуемые физические traces.

### Story 8.1: retired — независимый вариант Project после resource semantics

Retired владельцем продукта 2026-08-25. Alpha не создаёт независимый Project
variant; варианты сравниваются через session undo/redo. Номер зарезервирован
только как неизменяемый исторический указатель на retired `FR-3`; delivery,
acceptance criteria и automation для него отсутствуют.

### Story 8.2: Окончательно удалить Project после явного подтверждения

Как пользователь,
я хочу явно подтвердить окончательное удаление Project,
чтобы не потерять его случайным действием и не тратить время на ненужный
промежуточный lifecycle.

**Trace:** CAP-1; FR-4; NFR-3, NFR-11, NFR-13, NFR-18, NFR-24, NFR-26; AD-3,
AD-4, AD-12; UX-DR7, UX-DR21, UX-DR24; V-14; EV-06, EV-07, EV-13, EV-17.

**Screenshot checkpoint:** `SC-V14` по центральному protocol.

**Acceptance Criteria:**

**Given** V-12 завершён и пользователь видит active Project
**When** пользователь открывает permanent-delete confirmation, видит точное
имя Project и необратимость и явно подтверждает действие
**Then** delete атомарно удаляет Project pointer, staging record и все owned
Durable Revision согласно reachability/GC policy
**And** shared resource bytes остаются до отдельного global-GC доказательства
недостижимости.
**And** cancel, storage error или recovery fault сохраняют Project и его
reachable resources без partial deletion.

**Given** local storage содержит legacy pointer с устаревшим lifecycle marker
**When** Alpha открывает список Projects
**Then** pointer виден как обычный Project и никогда не удаляется автоматически.

### Story 8.3: Установить PWA и понять границы local context

Как пользователь,
я хочу установить приложение или продолжить в браузере с понятными platform
limitations,
чтобы не думать, что мои данные автоматически переносятся между Safari и iOS
Home Screen.

**Trace:** CAP-9; FR-41; NFR-14, NFR-15, NFR-16, NFR-17, NFR-18, NFR-21,
NFR-25, NFR-26; AD-2, AD-4, AD-5, AD-11, AD-12; UX-DR1, UX-DR4, UX-DR21,
UX-DR26, UX-DR28, UX-DR31; V-15; EV-07, EV-08, EV-13, EV-14, EV-17.

**Acceptance Criteria:**

**Given** поддерживаемая platform открывает app shell
**When** пользователь выбирает browser или available install path
**Then** core authoring остаётся доступным без обязательной установки
**And** install guidance использует capability detection, а не user-agent
promise.

**Given** пользователь на iOS до создания первого Project
**When** он видит install help
**Then** UI объясняет separate Safari/Home Screen local stores и
Portable-Backup handoff
**And** не обещает автоматическую синхронизацию между contexts.

**Given** WebGL2, storage либо install capability отсутствует
**When** app starts
**Then** пользователь видит capability-specific compatibility/fallback state
**And** canonical 2D/project/export access не подменяется broken editor.

### Story 8.4: Открыть и сохранить existing Project в airplane mode

Как пользователь,
я хочу reopen, edit и save уже созданный Project без сети,
чтобы работа на объекте не зависела от соединения.

**Trace:** CAP-1, CAP-6, CAP-9; FR-41, FR-42; cross-cutting FR-54; NFR-3,
NFR-7, NFR-10, NFR-11, NFR-14, NFR-15, NFR-16, NFR-21, NFR-26; AD-3, AD-4,
AD-5, AD-11, AD-14, AD-17; UX-DR6, UX-DR19, UX-DR21, UX-DR28, UX-DR31,
UX-DR35; V-15; EV-07, EV-08, EV-12, EV-17.

**Screenshot checkpoint:** `SC-V15` по центральному protocol.

**Acceptance Criteria:**

**Given** first successful online app-shell setup и existing healthy Project
**When** device входит в airplane mode
**Then** browser и standalone shell открывают Project с locally available
resources
**And** valid local edit может пройти обычную Durable persistence boundary.

**Given** пользователь сделал offline valid edit и перезапустил приложение
**When** Project открывается снова
**Then** та же последняя Durable Revision читается локально
**And** never-downloaded asset честно показывает unavailable/placeholder state
без hidden network dependency.

**Playwright E2E — `CATALOG-E2E-03` (pinned Project survives control-plane outage).**

**Given** browser and installed-PWA test contexts имеют healthy Project, у
которого все exact referenced resources pinned locally, а `CatalogGatewayPort`
становится unavailable
**When** пользователь открывает Project, выполняет valid local edit, получает
Durable Revision и local undo/redo
**Then** все локальные действия остаются available и catalog outage отображается
как non-blocking state, а не как `ResourceRecoveryRequired`/read-only
**And** report distinguishes automated browser/PWA regression from the
completed NFR-15 Product Owner functional acceptance.

**Given** acceptance run выполняется для этого flow
**When** evidence записывается
**Then** it follows the accepted NFR-15 browser/PWA functional path on iPhone
15 Pro Max and Samsung S24 Ultra
**And** detailed model/OS/network/battery/thermal traces are optional
engineering diagnostics, not release evidence.

### Story 8.5: Увидеть storage pressure до потери данных

Как пользователь,
я хочу видеть использование и риск хранилища до quota failure,
чтобы успеть безопасно сохранить или упростить Project.

**Trace:** CAP-1, CAP-9; FR-43; NFR-3, NFR-11, NFR-13, NFR-16, NFR-25,
NFR-26; AD-3, AD-4, AD-12, AD-19; UX-DR6, UX-DR19, UX-DR21, UX-DR24,
UX-DR25, UX-DR38; V-16; EV-06, EV-07, EV-08, EV-14, EV-17.

**Acceptance Criteria:**

**Given** platform exposes storage information либо policy detects approaching
warning/hard envelope
**When** Project приближается к risk threshold
**Then** UI показывает usage/risk и доступное backup/retry action
**And** persistence request/status не выдаётся за гарантию против external
browser/OS eviction.

**Given** quota error возникает during publication
**When** persistence завершается failure
**Then** previous Durable Revision остаётся current, candidate не называется
saved
**And** пользователь видит recoverable retry/export path, а следующий commit
не стартует без recovery.

**Given** app выполняет cache cleanup
**When** policy освобождает повторно скачиваемые bytes
**Then** удаляется только browse-only/unreferenced cache
**And** current, recovery, custom definition, active History и
`PinStagingLease` roots остаются защищены до approved publication либо
no-publication cleanup.

### Story 8.6: Восстановить Project после resource-integrity failure

Как пользователь,
я хочу безопасно восстановить точный ресурс либо выполнить полный repair,
чтобы повреждённый asset не превратился в скрытую потерю данных.

**Trace:** CAP-1, CAP-6, CAP-8, CAP-9; FR-43; cross-cutting FR-37, FR-38,
FR-44, FR-45, FR-54; NFR-3, NFR-10, NFR-11, NFR-12, NFR-13, NFR-16,
NFR-21, NFR-26; AD-3, AD-4, AD-12, AD-14, AD-17, AD-19; UX-DR6, UX-DR21,
UX-DR24, UX-DR25, UX-DR35, UX-DR38; V-16; EV-06, EV-07, EV-08, EV-09,
EV-17.

**Acceptance Criteria:**

**Given** integrity scan находит Missing, HashMismatch, MediaInvalid,
DecodeInvalid или PortabilityMetadataMissing referenced resource
**When** Project открывается
**Then** он явно становится read-only ResourceRecoveryRequired с
diagnostic placeholders
**And** normal edits/undo/redo blocked, а corrupted bytes не попадают в
renderer fallback.

**Playwright E2E — `CATALOG-E2E-04` (real resource corruption is not outage).**

**Given** controlled browser fixture содержит missing/corrupt exact referenced
hash при reachable либо unavailable Catalog Control Plane
**When** integrity scan открывает Project
**Then** оба service outcomes оставляют Project в the same blocking
`ResourceRecoveryRequired` until verified exact-byte repair or one complete
RecoveryChangeSet
**And** this browser fault regression proves state separation only; it does not
replace domain hash/backup tests or physical NFR-15 evidence.

**Given** пользователь предоставляет exact local hash, entry complete backup
либо allowed exact catalog version
**When** size/media/hash проверка успешна
**Then** Health возвращается только после проверки всех referenced resources и
policy
**And** repair bytes проходят fenced `PinStagingLease` и не создают Project
Revision сами по себе.

**Given** exact repair невозможен
**When** пользователь явно подтверждает один RecoveryChangeSet
**Then** все unresolved references удаляются/заменяются атомарно в ровно одной
Durable Revision
**And** partial repair не публикуется; history-only issue оставляет отдельный
confirm/cancel DiscardSessionHistory flow из Story 7.1.

**Given** repair/admission interrupted by cancel, fence loss, crash or forced GC
**When** repository resumes recovery accounting
**Then** staging bytes survive only while referenced by `PinStagingLease` and
are released only by deterministic no-publication cleanup
**And** current Durable Revision, History and Portable Backup manifest remain
unchanged until one complete fenced RecoveryChangeSet publishes.

**Playwright E2E — `RECOVERY-E2E-01` (observable recovery outcomes).**

**Given** controlled browser fixture has a CurrentProject resource issue
**When** пользователь performs exact-byte repair, cancel/fence-loss/crash path
or confirms complete `RecoveryChangeSet`
**Then** exact repair alone creates no Project Revision, interrupted flow keeps
the prior Durable Revision, and only a fresh fenced complete change publishes
one recovery Revision
**And** observable browser states complement hash/pin/forced-GC recovery corpus.

### Story 8.7: Пережить PWA update без unsafe reload

Как пользователь,
я хочу применять update только на safe Durable boundary,
чтобы новая версия не ломала активную работу.

**Trace:** CAP-1, CAP-9; FR-47; cross-cutting FR-43; NFR-11, NFR-12,
NFR-13, NFR-14, NFR-15, NFR-16, NFR-25, NFR-26; AD-4, AD-11, AD-12;
UX-DR6, UX-DR21, UX-DR24, UX-DR26; V-16; EV-07, EV-08, EV-14, EV-17.

**Acceptance Criteria:**

**Given** waiting update появляется во время active edit или gesture
**When** app уведомляет пользователя
**Then** active editor не reload-ится автоматически
**And** user-mediated reload предлагается только после Durable Revision.

**Given** user accepts reload либо new startup произошёл после automatic worker
activation
**When** startup handshake выполняется
**Then** ReleaseManifest проверяет shell/worker/project/catalog schema и
capabilities до editable mode
**And** version-tolerant read/copy-on-write migration сохраняют recovery path.

**Given** migration fails либо schema unreadable
**When** Project открывается после update
**Then** исходные readable bytes не перезаписываются
**And** UI предлагает recoverable migration/read-only export rather than
unsafe silent downgrade.

### Story 8.8: Экспортировать self-contained Portable Backup

Как пользователь,
я хочу вынести healthy Project в Portable Backup,
чтобы не быть запертым в одном browser profile или iOS context.

**Trace:** CAP-6, CAP-10; FR-44; cross-cutting FR-3, FR-5, FR-37, FR-54;
NFR-1, NFR-3, NFR-4, NFR-10, NFR-12, NFR-13, NFR-21, NFR-24, NFR-26;
AD-2, AD-3, AD-4, AD-11, AD-12, AD-14, AD-17, AD-19; UX-DR19, UX-DR21,
UX-DR24, UX-DR25, UX-DR28, UX-DR35, UX-DR38; V-17; EV-06, EV-07, EV-09,
EV-10, EV-14, EV-17.

**Acceptance Criteria:**

**Given** non-corrupt Durable Project в current ProjectLimitsPolicy
**When** пользователь экспортирует его offline
**Then** self-contained bundle включает canonical Project, schema/manifest,
checksums и exact referenced catalog/custom resources
**And** session undo/redo History намеренно не включается.

**Playwright E2E — `CATALOG-E2E-05` (fully pinned backup during outage).**

**Given** healthy Project и все exact referenced resources уже pinned locally,
а `CatalogGatewayPort` controlled stub unavailable
**When** пользователь запускает Portable Backup export
**Then** complete self-contained bundle строится без remote fetch и содержит
required resource metadata/hash manifest data
**And** browser E2E доказывает только local workflow; browser/iOS/Android
physical PWA behavior remains separately required by NFR-15.

**Given** complete bundle нельзя построить из-за corruption, I/O или quota
fault
**When** export завершается failure
**Then** user видит recoverable error
**And** неполный semantic output никогда не называется Portable Backup и
transient `PinStagingLease` bytes не masquerade as Durable manifest entries.

**Given** новая mutation превысила бы backup envelope
**When** пользователь подтверждает её до publication
**Then** BackupFeasibilityPolicy отклоняет candidate заранее
**And** current Durable Project остаётся exportable без сети.

### Story 8.9: Импортировать backup атомарно как новый Project

Как пользователь,
я хочу восстановить compatible Portable Backup без риска существующему проекту,
чтобы безопасно перенести работу между local contexts.

**Trace:** CAP-10; FR-45; NFR-1, NFR-3, NFR-4, NFR-12, NFR-13, NFR-18,
NFR-21, NFR-24, NFR-26; AD-2, AD-3, AD-4, AD-11, AD-12, AD-14, AD-19;
UX-DR19, UX-DR21, UX-DR24, UX-DR25, UX-DR28, UX-DR30, UX-DR38; V-17;
EV-07, EV-09, EV-13, EV-17.

**Acceptance Criteria:**

**Given** пользователь выбирает Portable Backup
**When** import запускается
**Then** container/path/count/bytes/checksum/schema/domain/resource validation
происходит в staging с progress, cancel и cleanup journal
**And** clean-profile offline read/render smoke проводится до publication.

**Given** archive corrupt, oversized, path-unsafe, unknown-future schema либо
migration fails
**When** validation прекращается
**Then** existing Projects остаются неизменными
**And** user получает понятный recovery/error state без partial staged
publication.

**Given** staged import проходит все checks
**When** publish завершается
**Then** атомарно создаётся новый Project ID
**And** canonical geometry и resource hashes восстанавливаются без semantic mm
drift; staging/pin roots входят в published
manifest только после complete fenced validation.

### Story 8.10: retired — сохранить или поделиться PNG

Retired владельцем продукта 2026-08-25. Alpha не создаёт, не скачивает и не
отправляет PNG Plan/3D; Project переносится self-contained Portable Backup.
Номер зарезервирован только как неизменяемый исторический указатель на
retired `FR-46`; delivery, acceptance criteria и automation для него
отсутствуют.


## Epic 9: Безопасное добавление собственного GLB (Alpha+)

После Alpha entry пользователь может локально выбрать и проверить static GLB,
увидеть безопасный preview, подтвердить его dimensions/anchor и сохранить
только asset, прошедший policy, limits и portable-storage checks.

**Execution gate:** CAP-12 не блокирует Alpha entry. Stories Epic 9 начинаются
только после отдельного owner decision и S-5 hostile GLB evidence: confirmed
limits/allowlist, local decoder policy, no-network proof и floor-device
thermal/memory results.

### Story 9.1: Безопасно проверить или отклонить локальный GLB

Как пользователь,
я хочу локально проверить один GLB до добавления в Project,
чтобы опасный или слишком тяжёлый файл не повредил мои данные.

**Trace:** CAP-12; FR-48, FR-49, FR-51; NFR-5, NFR-6, NFR-8, NFR-21,
NFR-22, NFR-24, NFR-25, NFR-26; AD-2, AD-9, AD-12; UX-DR20, UX-DR21,
UX-DR30; P-01; EV-06, EV-12, EV-14, EV-16, EV-17.

**Acceptance Criteria:**

**Given** пользователь выбирает один local file
**When** file не является self-contained binary glTF 2.0 GLB
**Then** glTF с external files, OBJ, FBX, DAE, USD variants и archives
отклоняются до Project/blob registration
**And** extension alone не считается доказательством trusted container.

**Given** bounded header/JSON preflight и staged decoder checks
**When** обнаружены external/data URI, unknown required extension, animation,
skin, morph, camera, light, malformed metadata либо hard budget breach
**Then** stable error показывает actual/limit where safe и actionable next step
**And** no Project Revision, partial blob или network request не создаётся.

**Given** parsing/validation выполняется в worker
**When** пользователь cancel-ит либо deadline истекает
**Then** worker, ArrayBuffer, ImageBitmap и preview GPU resources dispose-ятся
**And** Worker не объявляется hard memory sandbox, а partial state не
публикуется.

### Story 9.2: Подтвердить физическую семантику и зарегистрировать CustomAsset

Как пользователь с прошедшим preflight GLB,
я хочу увидеть isolated preview и подтвердить его реальные dimensions и anchor,
чтобы custom item появился в плане честно и предсказуемо.

**Trace:** CAP-12, CAP-6; FR-50, FR-52; NFR-1, NFR-3, NFR-13, NFR-21,
NFR-22, NFR-24, NFR-26; AD-3, AD-4, AD-8, AD-9, AD-12, AD-19; UX-DR20,
UX-DR21, UX-DR30, UX-DR38; P-02; EV-06, EV-07, EV-12, EV-16, EV-17.

**Acceptance Criteria:**

**Given** GLB успешно прошёл policy/limits validation
**When** пользователь видит isolated preview
**Then** он явно подтверждает width, depth, height в мм, up/forward,
pivot, footprint, AnchorClass и allowed recolorable slots
**And** custom item визуально отличим от catalog asset.

**Given** пользователь подтверждает normalization/classification
**When** registration проходит policy
**Then** scale применяется ровно один раз и CustomAssetDefinition получает ID,
source hash, validated metadata и local blob reference
**And** original/runtime bytes pin-ятся atomically с `PinStagingLease`, и
`BackupFeasibilityPolicy` проходит до Durable definition; Alpha+ также не
собирает assetUsageDeclaration или AssetUsageGrant.

**Given** source hash уже известен либо operation cancel-ится/не проходит quota
**When** registration завершается
**Then** approved bytes deduplicate by hash либо no partial definition/blob
reference remains
**And** cancel, fence loss, crash/restart и forced GC сохраняют candidate bytes
только через `PinStagingLease` до deterministic no-publication cleanup либо
atomic publication; пользователь получает safe retry/cancel explanation without
uploading file externally.

**Playwright E2E — `CUSTOM-ASSET-E2E-01` (Alpha+ registration lifecycle).**

**Given** Alpha+ controlled browser fixture проходит preflight и затем
останавливает declaration/pin/admission на cancel, fence loss или restart
**When** пользователь наблюдает registration flow
**Then** missing declaration blocks Durable definition, а incomplete route
оставляет only cancellable preview/current Durable state
**And** browser check дополняет mandatory custom pin/forced-GC/crash corpus и
не включает CAP-12 в Alpha entry.

### Story 9.3: Переиспользовать, удалить и перенести custom asset

Как пользователь с несколькими экземплярами custom item,
я хочу reuse, delete и backup lifecycle без утечек,
чтобы Project оставался portable и не раздувал storage.

**Trace:** CAP-12, CAP-10; FR-52; cross-cutting FR-44, FR-45; NFR-1,
NFR-12, NFR-13, NFR-21, NFR-22, NFR-24, NFR-26; AD-4, AD-8, AD-9,
AD-12; UX-DR20, UX-DR21, UX-DR24; P-03; EV-06, EV-07, EV-09, EV-12,
EV-14, EV-16, EV-17.

**Acceptance Criteria:**

**Given** несколько AssetInstance ссылаются на один validated custom hash
**When** пользователь размещает/duplicate-ит instances
**Then** один binary reused, а каждый instance имеет independent placement
**And** history/resource-retention rules защищают exact bytes для current и
active branches.

**Given** последняя reachable reference удаляется
**When** retention policy разрешает cleanup
**Then** blob, object URLs и GPU resources dispose-ятся безопасно
**And** reachable current/recovery/staging/History roots никогда не
освобождаются преждевременно.

**Given** custom-asset Project экспортируется и импортируется в clean offline
profile
**When** complete bundle проходит staging validation
**Then** bytes, metadata, checksums, dimensions и instances восстанавливаются
без drift
**And** incomplete, tampered или oversized bundle никогда не публикует новый
Project.

## Telegram S0 — извлечение требований, 2026-11-04 (шаг 1 подтверждён)

Этот раздел дополняет существующий backlog и его исторический inventory; он не
перезаписывает старые Epic/Story IDs, статусы или scope. Основание: PRD и
addendum, DESIGN + EXPERIENCE, Architecture Spine, SPEC и все его companions,
project-context, Telegram extension spec и preflight, результаты четырёх S0
workflows, REL/FUP от 1 ноября. Выделенные ранее UX-DR — исторические локаторы;
при несовпадении действуют текущие UX-пара и REL/FUP. Исторический Alpha READY
и baseline tests не являются Telegram readiness или acceptance.

### Functional Requirements — действующий inventory и дополнение

Существующий inventory выше сохраняет FR-1–52 и FR-54, включая маркировку
retired и Alpha+; FR-53 retired (Focus/native fullscreen). Всего в PRD 58
стабильных идентификаторов: 40 активных Alpha entry до Telegram, 5 Alpha+,
9 retired; добавлены 4 активных Telegram FR (всего 44 active Alpha entry + 5
Alpha+). Первоначальный исторический счётчик coverage выше не переписывается.
Конкретные FR и полные условия остаются у PRD; перечисление ниже — additive
извлечение, а не изменение продукта.

- **FR-55:** общий принятый Alpha editor и эквивалентный результат команд;
  Telegram online launch, наблюдаемая per-mode подготовка и local edit/save/
  undo после неё; безопасные Back/Close/draft/pending/failure, viewport,
  keyboard, theme, lifecycle и renderer fallback; недоступный host/SDK даёт
  retry/выход, без общей writable области; доступность и REL/FUP сохранены.
- **FR-56:** до runtime, DB, миграции и cleanup выбрать неизменяемый account
  scope для Projects/Revisions, resources/library, staging/journal, history/GC,
  writer/takeover и preferences. A→B→A изолирован, поздняя работа отвергается;
  старые данные и browser DB names сохраняются; identity вне Project/backup.
- **FR-57:** реальный внешний `.interiors` в обе стороны с явно указанными
  совместимыми build/schema; до полного чтения проверка размера, затем staging,
  schema/integrity/resources и atomic publish в новый ID без изменения исходника;
  0 мм drift, host addresses и exact hashes; история не portable; неверный,
  повреждённый или отменённый импорт не публикуется. API callback не доказывает
  внешний файл; скрытые upload и bot delivery не разрешены.
- **FR-58:** Web/PWA entry, данные, install, offline и update сохраняются;
  каждый target независимо выполняет manifest/schema guards и безопасную
  migration/recovery. Открытые клиенты сохраняют immutable resources при
  выпуске и откате; Telegram не вызывает принудительный PWA reload. Отдельный
  retirement возможен лишь после owner check, доступа к старым данным,
  доказанного переноса, rollback и отдельного допуска.

### Nonfunctional Requirements — действующий inventory и дополнение

Существующий inventory содержит NFR-1–26; NFR-27 retired (не переиспользуется).
В PRD 27 действующих NFR из 28 идентификаторов, включая следующий:

- **NFR-28:** отдельное physical evidence на Telegram iOS и Android: create →
  edit → реальные floor/wall placements → 3D → Durable save → close → reopen;
  Back/Close, keyboard/safe area, prepared offline, exact pin/hash и внешние
  export + reimport в обе стороны. iPhone 15 Pro Max и Samsung S24 Ultra либо
  согласованные замены; записать device/OS/Telegram versions. Bridge fake,
  emulator и исторический NFR-15 не заменяют физическую проверку.

Применяются прежние NFR о 0 мм drift, атомарной публикации и recovery,
quota/history roots, WebGL2, capability detection, accessibility, local privacy,
versioning и тестируемых boundaries. Telegram cold offline launch не требуется;
PWA cold offline сохраняется. Никаких новых численных performance gates не
выводить из diagnostics.

### Additional Requirements — Architecture / SPEC

- **AD-25 / CAP-13:** общие domain/application, codecs, renderer и editor;
  SDK только в host adapter. Разные entries/outputs и стабильные origins;
  browser names/data/URL/manifest/worker/install/offline/update неизменны.
  Telegram не подключает browser DEV cleanup, не регистрирует PWA worker, не
  удаляет чужие caches/DB/output; отсутствующий JS/API/manifest не отдаётся как
  HTML. Базовый root уже существует: greenfield starter не создаётся.
- **AD-26 / CAP-1/8–10/13 (assumption):** проверенный raw signed initData по
  Ed25519 со строго определёнными trusted bot/environment, parsing, freshness и
  capability guards до runtime/storage/GC; не `initDataUnsafe`, не token и не
  общий writable fallback. Scope алгоритм и serialized generation barrier — по
  Spine; fencing, teardown, A→B→A и late commit/journal/GC сохраняются. Host
  activation не доказывает identity; физическая безопасность смены аккаунта —
  отдельный release gate, namespace не является server authorization.
- **AD-27 / CAP-1/2/5/8–11/13:** единая наиболее защитная обработка Back/Close,
  draft, PendingDurability и persist-failed; stale projection не публикует
  геометрию, второй pointer отменяет draft перед pinch; resume проверяет fence,
  base и generation; renderer и subscriptions disposable, offline readiness по
  каждому доступному модулю/ресурсу.
- **AD-28 / CAP-1/6/9/10/13 (assumption):** ReleaseManifest и schema handshake
  без зависимости от worker, fail-closed при incompatibility; shell/manifest
  переключать атомарно после публикации полного immutable набора; старые и
  rollback URLs без автоудаления до отдельного безопасного решения. Оба origin
  маршрутизируют catalog-only `/catalog-api` с прежними validation/pin guards.
- **AD-29 / CAP-1/10/13 (assumption):** общий codec и host file seam, строгий
  staged import и честные состояния handoff; не приравнивать локальный `blob:`
  к HTTPS-only `downloadFile`. Runtime V1 и PPJ-A1 используют один selector с
  разными форматами: source owner обязан разрешить identity/registry/migration,
  error precedence и build/schema matrix до зависимого S3. Строгий decoder,
  точность и исходные bytes не ослабляются; S1 эта конкретная коллизия не
  блокирует после применимого gate.
- Catalog Control Plane остаётся только каталогом; real assets требуют exact
  pin + BackupFeasibilityPolicy, fenced durable publication и сохранения undo/
  redo roots. Outage не объявляется повреждением healthy Project. Решением
  владельца 2026-11-04 формальный AssetUsageGrant, licensing/provenance/
  declaration/attribution/notice admission не является Alpha gate; владелец
  выбирает бесплатные либо собственные модели вне приложения. Сохраняются
  технические format/size/hash/security validation, exact pin, backup policy и
  запрет передачи Project или файлов на сервер.
- Каждый будущий implementation slice имеет одного owner, проходит RED → GREEN,
  необходимые mutation и regression checks. Само извлечение не разрешает код:
  нужны approved planning package и применимый READY либо письменный waiver.

### UX Design Requirements — Telegram, конкретные work items

- **UX-TMA-01:** вход показывает проверку host/identity/compatibility; вне
  host и при invalid identity — объяснение, retry/exit и доступная Web-ссылка;
  SDK timeout завершается понятной ошибкой, не бесконечным spinner.
- **UX-TMA-02:** Projects доступны только выбранному scope; переключение A→B→A
  не показывает чужие данные, не удаляет предыдущую область и не обещает sync.
- **UX-TMA-03:** in-app и host Back закрывают верхнюю панель с возвратом focus;
  для draft/conflict предлагают продолжить или явно отменить. Отмена диалога
  сохраняет draft/selection/focus и не вызывает второй Back handler.
- **UX-TMA-04:** PendingDurability показывает процесс и задерживает управляемый
  выход; persist-failed сохраняет candidate, retry/recovery export и явное
  предупреждение; recovery остаётся read-only без автоматического repair/delete.
- **UX-TMA-05:** host Close предупреждает при доступности, не подтверждает draft
  и не обещает заблокировать принудительное закрытие; Projects закрывается
  только явным Back. Ограниченные host swipes восстанавливаются при выходе.
- **UX-TMA-06:** semantic theme tokens сохраняют контраст canvas/dimensions/
  focus; реальные insets без двойного сложения, keyboard и scrollable sheets
  оставляют status, primary action, cancel и активное поле видимыми при 360 CSS
  px и 200% текста; targets ≥44 px, DOM/list alternatives и reduced motion.
- **UX-TMA-07:** viewport/keyboard инвалидируют старый screen→plan transform;
  transient SelectionUnavailable даёт retry/numeric/cancel без mutation;
  второй pointer отменяет draft перед pinch и следующий жест работает.
- **UX-TMA-08:** изменение theme/layout/lifecycle не создаёт Revision; после
  resume проверяются fence/base, WebGL loss восстанавливает модель либо даёт
  безопасный 2D путь, подписки не дублируют команды.
- **UX-TMA-09:** показывать готовность отдельно для editor, 2D/3D lazy modules,
  codec и exact resources; до готовности обозначать конкретный недоступный путь,
  после — поддерживать доступное local edit/save/undo. Catalog outage и missing
  unpinned resource не маскируются под повреждение здорового Project.
- **UX-TMA-10:** отдельно показывать подготовку backup, передачу системному
  действию и непроверенный результат; cancel/error/unsupported дают retry/exit.
  Только внешний файл и повторный import подтверждают handoff; recovery export
  candidate не называется complete backup или saved.
- **UX-TMA-11:** picker проверяет размер до полного чтения, staging сообщает
  validation/cancel/error; успешный import создаёт новый Project, сохраняет
  source и не переносит History; unsupported/corrupt не создаёт partial Project.
- **UX-TMA-12:** текущие компоненты AppShell, EditorTopBar/ViewSwitch,
  ActionDock, sheets, fields, catalogue и status/recovery states остаются общими;
  REL/FUP сохраняют отсутствие auto wall panel, wall reverse и dock-delete,
  подтверждение Opening без повторного изменения размеров и доступный wall-item
  route. Не восстанавливать retired onboarding/Focus/finish/Walk/PNG flows.

### Действующий preview и изоляция будущих проверок

Read-only проверка координатора установила, что активный preview на
`127.0.0.1:4175` запущен из `apps/web` и читает `apps/web/dist`; также работает
`cloudflared`. Обычный build с `clean:true` способен изменить текущую телефонную
версию без отдельной публикации. Поэтому будущие S1/S7 проверки используют
изолированные output и preview, сохраняют текущий live origin и retained chunks;
нельзя останавливать существующие процессы или перезаписывать live `dist` в
planning workflow. Проверка изолированного output, отсутствие удаления assets и
работоспособность старого клиента должны стать явным будущим evidence. Этот факт
не разрешает implementation или release.

### Открытые gates и ожидаемое доказательство

Исторический снимок до регистрации SPEC: форматный source-owner disposition
блокировал S3. Актуальный статус и оставшиеся evidence — в последнем разделе
обновления AD-30 ниже; S1 уже выполнен. Прежний licensing source conflict разрешён
владельцем 2026-11-04: формальный grant не требуется. Реальные bot/HTTPS
origins, signed launch/Ed25519 и account isolation, physical iOS/Android,
внешний двусторонний file roundtrip и release/rollback evidence пока pending.
При фактической невозможности local handoff только владелец отдельно выбирает
альтернативу и privacy/retention; автоматического upload нет. Отложенное
удаление Web/PWA не является реализационной историей S0–S7.

## Telegram Mini App — требования к пилоту от 2026-11-21

Владелец подтвердил пакет изменений от 21 ноября. Уточнение FR-55 о проверке
ресурсов и загрузке 3D относится к существующим Stories 10.6 и 10.8–10.12.
Три новых требования используют ту же Telegram-композицию и историю проекта.

| Требование | Результат и источники |
|---|---|
| FR-59 | В черновике размещения или перемещения напольного предмета в плане видны расстояния до внутренних границ комнаты. AD-32 задаёт расчёт по usable Room поддерживаемой геометрии V1. UX задаёт подписи четырёх сторон, чтение значений в панели и правила скрытия. |
| FR-60 | Локальный каталог Telegram даёт условные формы, точные размеры, поддерживаемые привязки и палитру. AD-33 сохраняет V1-параметры, идентичность и байты старых GLB. UX задаёт карточки, поиск, образцы цвета и сценарии отмены. |
| FR-61, NFR-29 | Согласившиеся пользователи могут участвовать в измерении пилота и добровольно оценить редактор. AD-34 ограничивает данные, origin, жизненный цикл канала и доступ SDK. UX задаёт состояние согласия и оценку в Projects. |

NFR-26 требует проверку каждого инкремента через Playwright MCP. NFR-28
задаёт отдельную физическую проверку перед пилотом. Действующие NFR-1,
NFR-5, NFR-10, NFR-13, NFR-17–19, NFR-21, NFR-23 и NFR-25 применимы по
срезам. FR-58 задаёт сохранение независимых Web/PWA.

**Место в Epic 10.** Пользователь Telegram собирает планировку с понятной
расстановкой и оценивает удобство после первого сеанса. Срезы используют
уже принятые редактор, local-first сохранение и совместимость выпусков.
Порядок пилота: устранение блокировок FR-55 и проверка 3D → направляющие
→ каталог и палитра → оценка и аналитика → физическая приёмка по NFR-28.
Проверки направляющих используют доступный путь напольного размещения, а
проверки каталога работают при отключённой аналитике.

## Telegram S0 — структура эпиков (шаг 2 подтверждён)

### Epic 10: Работать со своим планом в Telegram, сохраняя Web/PWA

Пользователь продолжает привычную работу в Web/PWA и получает тот же принятый
редактор в Telegram: создаёт и повторно открывает локальный Project, точно
редактирует план, размещает реальные предметы, проверяет 3D, сохраняет и
восстанавливает работу; после отдельного разрешения формата и доказанного
локального handoff переносит Project внешним файлом в обе стороны. Владелец
получает проверяемый двойной выпуск и rollback без потери прежней платформы.

**FR coverage:** FR-55–58; применимые существующие FR-1–2, 4–19, 21–23,
25–33, 38–45, 47 и 54 сохраняются и проверяются на соответствующих поверхностях.
**Другие связи:** CAP-1–11/13; NFR-1–21, 23–26 и 28 по применимости;
AD-1–8, 10–14, 16–17, 20–29; UXF-1–6/8, REL/FUP. CAP-12 / FR-48–52 /
NFR-22 / AD-9 остаются Alpha+ и этим Epic не повышаются.

**Порядок ценности и рисков:** S1 сохраняет работающий browser/PWA путь при
выделении host boundary; S2 даёт проверенный scoped create → save → reopen в
Telegram; S3 даёт двусторонний внешний file handoff после source-owner
форматного решения; S4 добавляет безопасную точную работу с планом и host
навигацией; S5 — реальные pinned floor/wall предметы и 3D; S6 — подготовленную
offline continuity и recovery; S7 — изолированно проверяемый двойной выпуск,
runbook, rollback и честное physical evidence. S4–S6 не ждут решения формата S3,
если их собственные зависимости удовлетворены. Все части сохраняют Web/PWA,
его данные и проверки. Перечень S1–S7 задаёт этапы, а не готовые Story IDs;
подробная вертикальная декомпозиция выполняется на следующем шаге.

**Группировка:** один Epic выбран из-за общей композиции editor/runtime, host
lifecycle, scoped persistence и повторного изменения тех же пользовательских
поверхностей. Этапы разделяют проверяемые результаты и риск внешнего файла,
а будущие stories должны оставаться достаточно малыми для одного владельца.
Отдельная итоговая physical acceptance не подменяет применимый implementation
readiness gate. Готовность каждого промежуточного результата не означает, что
весь Epic или выпуск приняты.

**Границы и зависимости:** утверждённый planning package и применимый свежий
READY либо письменный waiver нужны до нового implementation. Source-owner
решение V1/PPJ-A1 зарегистрировано SPEC; engineering следует текущему контракту
после применимого gate, а доказательства собираются в реализации до rollout/
acceptance. S1 уже выполнен. По решению владельца формальный grant и licensing
admission не являются Alpha gate; technical resource validation и pin остаются.
Actual bot/HTTPS origins, physical clients,
локальный внешний roundtrip и release/rollback остаются evidence gates; при
невозможности local handoff отдельный owner выбирает alternative/privacy/
retention. Нет server upload, sync или bot file delivery. Изоляция будущих
output/preview защищает текущий работающий телефонный preview и retained chunks.
Будущий browser-owned retirement — только boundary и отдельное последующее
решение, не исполняемый в S0–S7 Epic или Story.

### FR Coverage Map — дополнение к исторической карте

Прежняя карта FR-1–54 и Epic 1–9 остаётся выше; retired FR-3, 20, 24, 34–37,
46 и 53 не получают нового owner. Исторические FR-48–52 остаются в Epic 9
Alpha+ без изменения applicability. Telegram не заменяет первоначальных owners.

- **FR-55 → Epic 10:** общий принятый редактор, host interaction и lifecycle,
  подготовленная локальная работа, сохранение и recovery.
- **FR-56 → Epic 10:** подписанная identity, immutable scoped storage, fencing,
  изоляция аккаунтов и поздних операций.
- **FR-57 → Epic 10:** строгий versioned staged import/export и доказанный
  внешний двусторонний handoff; зависит от source-owner disposition и физического
  evidence.
- **FR-58 → Epic 10:** сосуществование, совместимость выпусков, сохранение
  Web/PWA, доступных ресурсов, rollback и отдельно gated future retirement.
- **FR-59 → Epic 10 / Story 10.16:** четыре обновляемых расстояния до стен
  у напольного черновика, включая поддерживаемые непрямоугольные комнаты.
- **FR-60 → Epic 10 / Story 10.17:** локальные условные предметы и палитра
  с совместимостью прежних ресурсов и резервных копий.
- **FR-61, NFR-29 → Epic 10 / Story 10.18:** добровольное измерение и оценка
  в Telegram с изоляцией канала сбора данных.

## Epic 10: Работать со своим планом в Telegram, сохраняя Web/PWA

Цель, applicability и зависимости описаны в подтверждённой структуре Epic 10
выше. Каждая story имеет одного implementation owner; independent review и
реальное release evidence не подменяются этим документом.

### Story 10.1: Продолжить работу в Web/PWA после выделения платформенной границы

Как пользователь существующей Web/PWA,
я хочу открыть и изменить свой прежний проект после выделения browser host,
чтобы сохранить доступ к данным и привычной работе при подготовке Telegram.

**Production path:** существующий browser entry → browser host adapter → общий
editor/runtime → прежние stores → durable publication. Один implementation owner.
**Минимальная ценность:** прежний Project открывается, редактируется и повторно
открывается с тем же durable outcome без зависимости от Telegram.

**Acceptance Criteria:**

1. **Дано** ранее сохранённый Project и browser/PWA context, **когда** пользователь
   открывает Project, подтверждает допустимую правку, дожидается сохранения и
   открывает его снова, **тогда** доступна та же последняя Durable Revision;
   имена и schema существующих баз не меняются, автоматической миграции или
   удаления данных нет.
2. **Дано** недоступный Telegram SDK и отсутствие Telegram host, **когда**
   пользователь открывает browser entry, **тогда** запуск и редактирование не
   зависят от Telegram и не перенаправляются в него; domain/application не
   импортируют SDK и не читают `window.Telegram`.
3. **Дано** установленная PWA со старым worker и подготовленными данными,
   **когда** пользователь открывает и редактирует Project офлайн либо применяет
   совместимое обновление, **тогда** прежние offline, install и update paths,
   schema handshake и безопасные recovery states сохраняются.
4. **Дано** сборка или проверка этого среза, **когда** создаётся тестовый output,
   **тогда** он изолирован от действующего `apps/web/dist` и live preview;
   текущие процессы и origin сохраняются, опубликованные chunks не удаляются.
5. **Дано** одинаковые исходный Project и подтверждённая команда до и после
   выделения boundary, **когда** сравниваются результаты, **тогда** доменное
   состояние и durable outcome эквивалентны; draft и rejected command не создают
   Revision.

**RED → GREEN и evidence:** RED — проверка независимого browser host/import без
побочных storage effects и единственного runtime при StrictMode, а также
существующие durability/reopen/PWA сценарии обнаруживают нарушение при неверной
границе. GREEN — production path и регресс проходят с новым адаптером. Required
mutation checks оценивают значимые guards и durable/fencing outcomes; type,
lint, boundary, domain и применимые browser/PWA offline/update проверки
сохраняются. Физическая Telegram acceptance не заявляется.

**Связи:** TMA-01–04; TMA-AC-01/02/11/12; CAP-1/9/13; FR-1/2/5/41/42/47/58;
NFR-3/10–13/24/26; AD-2/3/4/11/12/25/28. Требуется approved planning package и
применимый свежий READY либо письменный waiver. V1/PPJ-A1 collision сам по себе
не блокирует эту story после применимого gate.

**Актуальный статус S1:** browser-only Story 10.1 реализована и проверена в
[отчёте S1](../../docs/progress/telegram-extension-2026-11-04/S1/README.md).
Это не полный Telegram PASS: весь Epic 10 и физическое acceptance остаются
отдельными; отметка о 2 timeout в mutation и границы привязки всех прогонов к
снимку источников сохраняются по [readiness result](../../plans/telegram-mini-app-s0-readiness-result-2026-11-04.md).

### Story 10.2: Создать и повторно открыть локальный план в Telegram

Проверить доступ к новым документам, отключение общего подсчёта до первого учитываемого входа и отдельный акцепт EULA. Изменение редакции требует нового акцепта. [Обычная сборка](sprint-change-proposal-2026-11-22-public-candidate.md).

Как пользователь Telegram, я хочу безопасно открыть Mini App, создать комнату и
вернуться к ней после закрытия, чтобы начать работу с собственным локальным
проектом.

**Production path:** Telegram entry → host adapter → identity и ReleaseManifest
checks → immutable storage scope → общий editor/runtime → создание комнаты →
atomic Durable publication → reopen. Один implementation owner.
**Минимальная ценность:** поддержанный host создаёт прямоугольную комнату и
повторно открывает её последнюю Durable Revision.

**Acceptance Criteria:**

1. **Дано** поддержанный launch и trusted bot/environment configuration,
   **когда** host предоставляет raw signed `initData`, **тогда** AD-26 strict
   parsing, Ed25519, freshness и capability checks выполняются до создания
   runtime, открытия/миграции DB, journal reconciliation и GC. Проверяются
   trusted production/test public key и canonical bot ID; однократный strict
   decoding отказывает malformed percent/UTF-8, duplicate decoded keys, CR/LF,
   duplicate user JSON keys, missing signature/auth_date/user или unsafe user ID.
   Для bootstrap `auth_date` не старше 300 s и не более 60 s в будущем; Web
   Crypto Ed25519/SHA-256 capability обязательна. Используется подписанный user ID;
   raw initData, `initDataUnsafe`, bot token и Project не отправляются на сервер.
2. **Дано** отсутствующий/unsupported host, invalid подпись, identity, время или
   crypto, либо SDK timeout, **когда** пользователь открывает Telegram entry,
   **тогда** видны retry/exit и доступная Web/PWA-ссылка; общий writable fallback
   не открывается и данные не меняются.
3. **Дано** валидная identity, **когда** создаётся runtime, **тогда** один scope
   по AD-26 охватывает Project/Revision, resource/library, staging/journal,
   history/GC, writer/takeover и preferences; browser names/data не изменяются.
   При неоднозначной смене host identity запись останавливается до нового
   проверенного bootstrap; host activation не удостоверяет аккаунт.
4. **Дано** отсутствующий, incompatible или непроверяемый ReleaseManifest либо
   migration failure, **когда** Telegram запускается без worker, **тогда** schema
   guard не разрешает unsafe write и показывает доступный read-only/exportable
   либо recovery путь. Совместимый manifest и fence необходимы, но не достаточны:
   первая writable операция запрещена до всех guards и evidence пунктов 9–21.
5. **Дано** compatible manifest и проверенный scope, **когда** пользователь
   создаёт Project, задаёт прямоугольную Room, дожидается `Сохранено`, закрывает
   и снова открывает приложение, **тогда** последняя Durable Revision имеет те же
   размеры; pending/failed candidate не называется saved.
6. **Дано** Telegram entry и Web/PWA, **когда** проверяют запуск и локальные
   данные обоих, **тогда** Telegram не регистрирует PWA worker и не выполняет
   browser DEV cleanup; Web/PWA независимо открывает прежние данные.

7. **Дано** Projects проверенного scope, **когда** пользователь открывает список,
   открывает или переименовывает Project, **тогда** действует общий принятый
   lifecycle без изменения ID и чужих областей. Окончательное удаление доступно
   только после явного подтверждения; cancel оставляет Project и его revisions,
   успешное удаление не затрагивает другие Projects.
8. **Дано** Telegram launch, **когда** пользователь начинает работу, **тогда**
   приложение не запрашивает телефон, контакты, геолокацию или право отправки
   сообщений без отдельного пользовательского сценария.
9. **Дано** проверенный signed user и trusted environment/bot, **когда** до
   runtime выводится scope, **тогда** он в точности равен `tma-v1-` + lowercase
   hex SHA-256 UTF-8 строки `tma-v1:<environment>:<bot-id>:<user-id>` по AD-26;
   canonical decimal IDs не имеют ведущих нулей, environment — `production` или
   `test`. Scope неизменен в runtime, identity/initData не входят в Project или
   backup и не передаются на сервер; browser names/data неизменны.
10. **Дано** первая или любая последующая writable операция, **когда** она
    меняет lease/takeover, stage, journal/root, pin/protect, pointer или cleanup,
    **тогда** все contexts и shipped versions данного scope получают exclusive
    secure-context Web Lock `interiors-tma-storage-v1:<scope>` и удерживают до
    завершения всех затронутых transactions единой scoped DB; `steal` и nested request
    запрещены. Network/user input выполняются вне lock с повторной проверкой
    predicates и bytes под ним. Нет `navigator.locks`/доступного lock — только
    ожидание/read-only/отказ, никакого unfenced fallback. Разные origins/partitions
    не объявляются общим lock domain. Web Lock не заменяет durable fencing и receipt.
11. **Дано** create или изменение Project, **когда** происходит stage write,
    overwrite или delete, **тогда** одна scoped IDB transaction охватывает
    Project pointer, staging/revision, writer/fence, journal и нужные resource/
    library stores и атомарно проверяет scope, Project ID, current owner/fence, ожидаемый base/current
    pointer либо подтверждённое отсутствие при create и unique attempt ID. Revision,
    attempt и lease IDs проверяются на collision во всём scope в атомарной
    transaction соответствующего store; Revision записывается no-overwrite `add`,
    кроме доказанного идентичного idempotent retry того же attempt/checksum/owner.
    Collision не перезаписывает существующую Revision; unfenced `delegate.publish`
    и stage по одному Project ID запрещены. Без атомарного predicate write закрыт.
12. **Дано** новый attempt, **когда** до записи bytes создаётся journal root,
    **тогда** immutable scope, Project, attempt, expected base/create, owner/fence,
    revision checksum и полный target hash manifest закрепляются до записи. Одна
    fenced pointer-swap transaction проверяет всё и атомарно пишет durable
    published receipt для revision/checksum/manifest; совпадение только текущей
    Revision receipt не заменяет и поздняя смена pointer его не отменяет.
13. **Дано** attempt или pin lease, **когда** выделяется ID, **тогда** под scope
    lock отдельная atomic transaction необратимо увеличивает сохранённый uint64
    scope-local counter и выдаёт `tma-v1:<scope>:<kind>:<counter>`. Attempt/lease
    kinds различны, зарезервированные значения не повторяются после abort/delete;
    counter и scope identity не сбрасываются и хранятся без потери точности выше
    2^53. Новый scope и marker инициализируются атомарно; отсутствующий/corrupt
    counter существующего scope или exhaustion закрывают запись без reset/wrap.
    Durable prepared/published/no-publish и receipt сохраняются до завершения
    exact attempt; случайный UUID или проверка только живых записей не доказывает
    no-ABA. Повторы идемпотентны и не меняют более новую generation/revision.
14. **Дано** cancel либо очистка stage/resource, **когда** current owner/fence
    в Project transaction атомарно закрывает exact attempt как `no-publish`,
    **тогда** отсутствие publication доказано, дальнейший publish невозможен и
    cleanup сравнивает scope/Project/attempt/fence/base. Победившая publication
    оставляет receipt; read-then-delete не подходит. При expired/lost fence,
    unknown outcome, недоступной DB или неполном старом journal сохраняются
    staging, journal и bytes с recoverable/read-only состоянием.
15. **Дано** resource и Project в одной scoped IDB, **когда** выполняется
    publication или conditional cleanup, **тогда** общая transaction охватывает
    pin/protect, pointer/receipt или no-publish/cleanup вместе с fence и journal.
    Под scope lock bytes сначала читаются в immutable snapshot; async hash/size
    вычисляются вне активной IDB transaction; новая transaction перечитывает
    resource и сверяет immutable identity/version/size с fence/base/journal перед
    pin/protect и commit. `crypto.subtle.digest` нельзя await внутри ожидающей
    IDB transaction. При revocation/изменении identity — reject или полный retry;
    крупный ресурс допускает immutable prepared staging root в этой же DB с
    повторной exact проверкой перед atomic publication, не две несогласованные DB.
    `deletePinnedIfOwned(hash, leaseId)` разрешён только после доказанного
    no-publish и exact scope/ownership, без безусловного `delete(hash)`.
    Второй consumer до publish атомарно protect/pin-ит запись в конкурирующей
    resource-store transaction и проверяет hash/size защищённых bytes; если delete
    победил, он заново получает, проверяет и атомарно pin/protect-ит bytes.
    Re-read/re-fetch/hash без успешной защиты недостаточны. Receipt завершает
    только свой root; inconclusive root, чужие leases/history и SessionRetention/
    BackupFeasibilityPolicy сохраняются; release и removal идемпотентны.
16. **Дано** acquisition/takeover/release/delete/recreate Project, **когда**
    меняется writer, **тогда** persisted fence generation `(scope, ProjectId)`
    монотонна без reset/reuse; Project IDs не переиспользуются, counter/tombstone
    остаётся. Старый token не восстанавливает право на stage/commit/cleanup.
    Teardown закрывает local generation и ждёт допущенные операции; без atomic
    conditional lease release с scope/owner/token и сохранным счётчиком он лишь
    прекращает renewal и ждёт expiry, не удаляя lease и не обещая мгновенный release.
17. **Дано** switch/bootstrap новой identity либо неоднозначный host context,
    **когда** прежний runtime прекращает работу, **тогда** сначала запрещаются
    новые действия, отзывается generation, отменяется async работа и снимаются
    listeners; ожидается завершение допущенных barrier transactions/reconciliation,
    освобождаются renderer и handles и лишь затем открывается новый runtime.
    Поздний результат повторно запрашивает допуск и отклоняется; A→B→A не оживляет
    старую generation и старый scope не удаляется. Activation и сохранённый
    initData не удостоверяют аккаунт; unseen switch внутри живого runtime не
    считается обнаруженным. Нет доказанной physical isolation — нет writable
    release клиента. На resume проверяются base/fence и runtime integrity;
    истечение 300 s после bootstrap само по себе не завершает сессию, но destroyed
    runtime, новая identity или признак неоднозначности требуют fresh bootstrap.
18. **Дано** startup/crash Telegram runtime, **когда** обнаружена незавершённая
    запись, **тогда** browser `recover()` с массовым удалением staging не
    вызывается. Scoped reconciliation опирается на published receipt либо
    доказанный no-publish; неопределённые записи и bytes остаются сохранными и
    блокируют только затронутую запись. После explicit takeover новый owner под
    тем же lock может recovery transaction принять exact immutable identity
    полного старого attempt только с current fence и доказательством невозможности
    старой publication: receipt завершает лишь свой root без смены newer pointer;
    при полном протоколе и доказанном отсутствии receipt атомарно закрывается
    no-publish и затем выполняется conditional cleanup. Неполный legacy journal,
    unknown outcome или непроверенные predicates остаются сохранными/read-only.
19. **Дано** текущий baseline, **когда** выполняются S2 и его проверки, **тогда**
    общий scope-wide GC не создаётся и не имитируется: owned bytes и roots
    сохраняются, тестируются реальные exclusive pin cancellation cleanup и
    reconcile. `sessionRetentionRoots()` одного controller не является scope-wide
    inventory. Если GC появится в будущем, до запуска потребуются полная scope
    inventory, cross-context coordination и barrier; retention не отменяет
    SessionRetentionPolicy.
20. **Дано** один DB `interiors-editor-projects:<scope>`, **когда** под scope
    Web Lock metadata-only v1 обновляется до v2, **тогда** versionchange atomic
    transaction сохраняет exact identity (`protocolVersion=1`), uint64 counter и
    все прежние records без удаления/пересоздания DB, добавляя нужные object
    stores. До commit проверены identity/counter и полный v1 inventory; missing,
    corrupt, unknown stores/records или незавершённые данные вне ожидаемого v1
    приводят к abort без изменений. Fresh oldVersion=0 создаёт stores, marker и
    counter атомарно, но не доказывает восстановление externally cleared данных;
    уже существующий scope нельзя reset. Blocked/abort/quota/failure сохраняют v1;
    late `onupgradeneeded` после rejected/timeout open abort-ит transaction, late
    `onsuccess` закрывает handle; старый runtime на versionchange отзывает session
    и закрывает connection, client без поддержки v2 не пишет. После upgrade вновь
    проверяются exact counter, identity, state/schema. Обычные counter/fence/
    receipt/no-publish writes требуют реально проверенной `durability:"strict"`
    без silent downgrade; browser-created versionchange не получает вымышленный
    durability parameter. Browser/PWA names, schema и adapters не меняются.
21. **Дано** Undo/Redo на ранее существующую owned Revision, **когда** current
    fence и exact source base проверены, **тогда** новый attempt/receipt атомарно
    переводит history pointer только после сверки Project ID, revision ID,
    checksum, serialized bytes и resource manifest. Существующая Revision не
    перезаписывается и новая semantic Revision не создаётся; session History не
    становится portable. Нет всех guard/evidence пунктов 9–21 — нет первой
    writable create/import/repair/delete/publish и нет DONE Story 10.2.

**RED → GREEN и evidence:** RED — positive known-answer проверяет Telegram-signed
fixture из независимой документации [tma.js maintainers](https://github.com/Telegram-Mini-Apps/tma.js/blob/9350703debf015ff6b5fa751fdf1f72ae8ae250a/apps/docs/platform/init-data.md),
не официальный Telegram SDK; protocol/public keys — [официальный Telegram](https://core.telegram.org/bots/webapps#validating-data-for-third-party-use).
Фиксированный test clock для старого fixture не отключает 300 s/60 s в production.
Negative vectors: malformed encoding, duplicate decoded keys/user ID, CR/LF,
invalid signature/freshness/crypto; проверка no storage access до guards,
manifest failure и create/save/reopen через production composition.

До первой writable операции два независимых runtime одного scope проходят весь
[обязательный race corpus S2 disposition](architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md#проверки-и-handoff):
stage A против takeover B; stale-base cleanup A против новой stage B; один hash и
cancel/protect, включая delete между read/protect и protect/publication; ABA и
повторный lease ID; crash после counter reservation; значения >2^53; missing/
corrupt counter существующего scope, overflow/reset; collision revision/attempt/
lease IDs без изменения исходной Revision; takeover между no-publish и resource
cleanup; crash/expiry с adoption полных и неполных journals; crash на каждой
journal/pin/receipt/pointer boundary; v1→v2 blocked/late `onupgradeneeded`/
abort/quota/versionchange с сохранением identity/counter; revoke во время reserve/
upgrade (поздний ID расходуется без последующей mutation); Undo/Redo на exact
owned Revision с новым attempt/receipt без overwrite; receipt после смены current
pointer; unknown старый journal; двойной startup; failure/retry; Project delete и повторное
использование ID; release/expiry без token reset; A→B→A, поздние callbacks и
приостановленный commit/reconcile/exclusive cleanup. Каждый случай доказывает
отсутствие чужой publication/deletion и сохранение exact bytes/history roots;
неопределённый исход сохраняет данные. Проверяются реальные операции, не
выдуманный scope GC. GREEN — production composition и substrate проходят весь
corpus до первого writable publish; локальная queue не заменяет cross-context lock.
Required mutation checks покрывают lock, atomic predicate/receipt, monotonic ID,
no-publish/conditional cleanup, protect/pin, takeover/fence и recovery guards;
regression включает Story 10.1, type/lint, browser storage/PWA и boundaries.
Текущие validator/session queue и bounded scoped-IDB-v2 fixture, включая 26/26
native cases и 2072/2072 unit в отдельных логах, не доказывают полный protocol,
product entry/runtime/storage или S2 PASS; реальные bot/clients и physical
isolation NFR-28 остаются pending. Эти логи не заменяют полный race corpus.

**Дополнительное evidence:** RED — list/rename/delete-confirm/cancel и проверка
отсутствия необоснованных permissions выявляют нарушение; GREEN — production
routes проходят. Regression включает browser lifecycle и неизменность scope.

**Связи:** TMA-02/04/08/10/14; TMA-AC-03/07/10/11/12/13; CAP-1/8/9/13;
FR-1/2/5/55/56/58; NFR-3/11/16/21/23/24/26/28; AD-3/4/25/26/28;
UX-TMA-01/02/08. Нужен применимый implementation gate; bot/origins и physical
clients остаются отдельными зависимостями evidence.

### Story 10.3: Безопасно переключить локальную область Telegram-аккаунта

Область устройства отделяет акцепт, выбор и признак базового входа. Возврат на известное устройство того же аккаунта учитывает только состояние его проверенной локальной области. [Обычная сборка](sprint-change-proposal-2026-11-22-public-candidate.md).

Как пользователь, открывающий Mini App под разными аккаунтами, я хочу видеть
проекты только проверенного текущего аккаунта, чтобы поздняя работа прежней
сессии не раскрыла и не изменила мои данные.

**Зависимость:** полностью защищённый writable runtime, единая scoped IDB v2 и все обязательные AD-26
barrier/generation/teardown/fence guards уже поставлены и доказаны Story 10.2.
10.3 расширяет контролируемые A→B→A, edge-case и physical-release evidence; она
не разрешает откладывать или вводить обязательную защиту после первой записи.

**Production path:** новый signed bootstrap → остановка и teardown прежнего
runtime → serialized barrier → проверка новой identity → scoped runtime →
Projects и ресурсы текущего scope. Один implementation owner.
**Минимальная ценность:** A → B → A показывает каждому только свою сохранённую
область без удаления прежних данных.

**Acceptance Criteria:**

1. **Дано** Projects и pinned resources A, **когда** после нового проверенного
   bootstrap открывается B, **тогда** B не видит данные A; при проверенном
   возврате A его прежние данные доступны, browser/PWA namespace/data неизменны.
2. **Дано** активный runtime A и начало переключения, **когда** generation
   отзывается, **тогда** новые действия A запрещены, работа отменяется либо поздний
   результат отклоняется; listeners, renderer и handles освобождаются до нового
   runtime, lease завершается только conditional release либо expiry по 10.2. A → B → A не возрождает старую generation.
3. **Дано** commit, pin journal reconciliation или exclusive pin cleanup A,
   уже допущенный к local barrier и scope Web Lock, **когда** начинается switch,
   **тогда** он ждёт окончания допущенной transaction/reconciliation. Поздняя
   работа повторно просит допуск и отклоняется, не затрагивая B или нового A.
4. **Дано** два контекста одного scope, **когда** они претендуют на запись,
   **тогда** действуют scope Web Lock, persisted monotonic writer fence и явный
   takeover; условный no-publish/cleanup не удаляет чужие ресурсы. Owned-history pointer
   transition не перезаписывает Revision; source/base/receipt следуют 10.2.
   Общий GC в S2
   отсутствует, bytes и roots сохраняются, ни один scope не удаляется автоматически.
5. **Дано** resume живого runtime, **когда** возвращается foreground, **тогда**
   проверяются fence и base Revision. Activation не удостоверяет аккаунт; при
   уничтоженном runtime, новой identity или неоднозначной смене запись
   прекращается до нового signed bootstrap.
6. **Дано** клиент без physical evidence изоляции аккаунтов, **когда** готовится
   writable release, **тогда** клиент не допускается до evidence. Scope не
   заявляется server authorization или защитой от владельца устройства.

**RED → GREEN и evidence:** RED — контролируемые гонки отложенного commit,
download/import/repair, pin journal и exclusive cleanup при A→B→A демонстрируют нарушение без
barrier/generation; GREEN — production composition отвергает поздние результаты
и сохраняет обе области. Required mutation checks покрывают generation, Web Lock/barrier, conditional
cleanup и fencing; regression включает Stories 10.1–10.2 и неизменность browser DB.
Physical account switching остаётся pending.

**Связи:** TMA-08/10/11/14; TMA-AC-06/07/10/12/13; CAP-1/8/9/13;
FR-5/55/56/58; NFR-3/11/13/21/23/26/28; AD-3/4/25/26/27; UX-TMA-02/08.

### Story 10.4: Перенести существующий Web/PWA Project в Telegram

Как пользователь Web/PWA, я хочу экспортировать Project во внешний файл и
импортировать его в Telegram, чтобы продолжить работу с отдельной локальной копией.

**Production path:** Web/PWA Durable Project → общий versioned encoder → browser
file handoff → внешний файл → Telegram picker → size guard → staged decoder/
validation → scoped atomic publish. Один implementation owner.
**Минимальная ценность:** поддерживаемый реальный файл создаёт новый Telegram
Project без изменения исходника и существующих Projects назначения.

**Зависимости и gates:** SPEC зарегистрировал строгий PPJ-A1, отдельный
`interiors.project/runtime-v1-wire@1` и V1-legacy только с историческим byte
 equality и PPJ-disjoint witness. [Реестр](../specs/spec-interiors-editor-alpha/portable-backup-ingress-registry.md)
и [полная grammar AD-30](architecture/architecture-InteriorsEditor-2026-07-26/telegram-portable-v1-disposition-2026-11-04.md)
— контракт, не доказательство codec или READY. После применимого readiness/owner
approval инженер выполняет реализацию и доказательства в RED→GREEN циклах; уже
готовый worst-case proof или проверенный recovery path не требуются **до начала
кода**. Они обязательны до утверждения соответствующей совместимости, замены
browser exporter и выпуска. Формальный AssetUsageGrant и licensing admission не
являются Alpha gate по решению владельца; resource/security validation, exact
pin и BackupFeasibilityPolicy сохраняются.

**Acceptance Criteria:**

1. **Дано** применимое source-owner решение и поддерживаемый реальный Web/PWA
   build, **когда** пользователь экспортирует Durable Project и выбирает внешний
   `.interiors` в Telegram, **тогда** полная staged validation атомарно создаёт
   новый Project ID, не изменяя исходник и Projects назначения.
2. **Дано** принятый fixture с несколькими комнатами, диагоналями, проёмами и
   floor/wall предметами, **когда** import завершён, **тогда** geometry semantics
   имеют 0 мм drift, host addresses и exact resource hashes совпадают, ресурсы
   закреплены локально; session History не переносится.
3. **Дано** unsupported, corrupt, truncated или oversized файл, **когда** он
   выбран, **тогда** размер проверяется до полного чтения, strict admission даёт
   предусмотренную причину без публикации; cancel, quota и error не оставляют
   опасных staging roots.
4. **Дано** подготовка и выдача backup, **когда** encoder завершился или
   системное действие вызвано, **тогда** UI различает подготовку, передачу и
   фактически проверенный внешний handoff; callback/click не доказывает сохранение.
5. **Дано** недоступная локальная выдача или выбор, **когда** пользователь
   пытается продолжить, **тогда** видны отказ/cancel и retry/exit; Project, backup
   и GLB не загружаются на сервер и не отправляются боту. При физической
   невозможности handoff зависимая приёмка ждёт отдельного owner-решения об
   альтернативе и privacy/retention.

6. **Дано** потенциально неоднозначный прежний файл, включая empty V1/PPJ
   overlap без зарегистрированного witness, **когда** он не проходит однозначный
   зарегистрированный dispatch,
   **тогда** отказ консервативен, без публикации или угадывания provenance; exact
   source bytes сохраняются. Проверенный обходной путь заявляется только после
   фактического восстановления в конкретном старом контексте/build, нового полного
   exact export и подтверждённого переноса. Простая доступность старой Web/PWA не
   доказывает восстановление; текущий файл нельзя переименовать в unsupported ради
   закрытия критерия. Если неоднозначный файл — единственная копия и проверенного
   пути нет, инженер сначала проверяет возможный recovery path. Если подтверждено,
   что пути нет, owner отдельно решает восстановление либо ограничение и условия
   пересмотра; зависимая compatibility acceptance остаётся открытой.
7. **Дано** новый portable export и каждый non-corrupt Durable Project в policy,
   **когда** выбирается wire/rollout, **тогда** реализация и проверяемый corpus
   доказывают exact representation включая `yawRadians = -0`, finite values и
   приоритет полей; старые browser export/recovery paths нельзя заменять до
   доказательства полного FR-44 envelope. Original IDB/revisions/checksums и
   исходные bytes не переписываются; PPJ registry/bounds/error precedence не
   ослабляются. Реальные build/schema/files и physical roundtrip обязательны.

8. **Дано** зарегистрированные PPJ-A1, V1-legacy и V1-wire selectors, **когда**
   bounded checksum и selector scan завершены, **тогда** выбирается ровно один
   format-specific decoder без fallback. PPJ остаётся независимым со своими
   scalar/AST/reason rules; V1-legacy проходит exact historical byte equality и
   только затем зарегистрированный PPJ-disjoint witness. Empty/no-witness файл
   остаётся ambiguous с сохранением source. Те же routing/precedence действуют
   для import и exact-resource repair; repair не создаёт Project и не заменяет
   RecoveryChangeSet. Unknown selector не перебивает более ранний size/checksum
   fault; no-overwrite и copy-on-write сохраняются.
9. **Дано** точный durable candidate V1, **когда** отдельный wire encoder и
   decoder обрабатывают его, **тогда** сохраняются допустимые `-0` на numeric
   pointers, finite `yawRadians` включая `0.5`, приоритет `yawStep`, exact UTF-16
   code units через закрытый wrapper и отличия own-undefined от отсутствующего
   поля на разрешённых pointers; допустимые bounded VariantValue arrays и exact
   порядок сохраняются. Historical JSON `0` не восстанавливает утраченный знак.
   Source Project, revision string/checksum, serializer и IDB не переписываются.
10. **Дано** rollout и замена browser exporter, **когда** оценивается feasibility,
    **тогда** исполняемый worst-case corpus доказывает bounds из AD-30 и exact
    экспорт каждого non-corrupt Durable Project текущей policy; более строгие
    ProjectLimits (100 unique definitions), лимиты resources/archive и PPJ не
    ослабляются. До proof сохраняются прежние export/recovery; читаемая sole-copy
    вне closed grammar не объявляется corrupt только по этой причине.

11. **Дано** выбранный browser Project любой поддерживаемой локальной области,
    **когда** пользователь явно выбирает отдельное действие `Экспорт файла для
    переноса` в Projects или editor, **тогда** registered V1-wire writer получает
    snapshot и exact pinned resources именно доверенного owner handle; прежнее
    `Создать резервную копию` и его codec/FR-44 маршрут сохраняются отдельно.
    Отсутствие owner, неподтверждённый resource pin или невалидный snapshot не
    дают successful export и не выбирают другой store по совпавшему raw hash.
    Отмена не объявляется готовым файлом; реальная внешняя передача проверяется
    отдельно, синхронизация или upload не появляются.

**RED → GREEN и evidence:** RED — реальные файлы поддерживаемого build/schema и
negative vectors размера, schema, integrity, cancel, quota и staging показывают
нарушение при обходе строгой проверки; GREEN — production export/picker/import
проходит с exact hashes и новым ID. Required mutation checks покрывают admission,
cleanup и publication guards; regression — Stories 10.1–10.3 и backup tests.
RED→GREEN corpus покрывает все три dispatch rows и witness, empty ambiguous,
проверенный old-build → same-context upgrade → exact new export, единственную
копию без пути, `-0`/0.5, lone UTF-16, own-undefined vs absent, bounded nested
variants, exact hashes и case aliases, malformed/duplicate/oversize/checksum/
selector precedence, PPJ differential rules, source checksum/no-overwrite,
exact-repair и worst-case size. Эти проверки выполняются в ходе implementation;
fixtures не заменяют фактические build/files и physical acceptance.
Physical внешний файл и повторный выбор на iOS/Android остаются pending.

**Связи:** TMA-10–13; TMA-AC-07–10/12/13; CAP-1/8/10/13; FR-43–45/55–57;
NFR-1/3/11–13/21/24/26/28; AD-3/4/14/25/26/29/30/31; UXF-8, UX-TMA-10/11.

### Story 10.5: Вернуть Telegram Project во внешнюю копию Web/PWA

При отказе от новых условий подтверждённому владельцу доступны прежние проекты и поддерживаемый экспорт. Чтение и экспорт до акцепта не увеличивают ни один итог. [Обычная сборка](sprint-change-proposal-2026-11-22-public-candidate.md).

Как пользователь Telegram Mini App, я хочу вынести сохранённый Project во внешний
файл и импортировать его в Web/PWA, чтобы сохранить независимую копию и
продолжить работу в привычной поверхности.

**Production path:** Telegram Durable Project → общий encoder и exact pinned
resources → Telegram host file seam → внешний файл → явное browser действие
`Импорт файла для переноса` → strict staging/legacy-representability → trusted
browser composition → отдельный registered namespace/repository → atomic publish
нового Project → общий editor и owner-scoped operations. Один implementation owner.
**Минимальная ценность:** проверяемая отдельная копия Telegram Project в Web/PWA
при сохранении исходника.

**Зависимости:** Story 10.4 и зарегистрированные SPEC V1/PPJ routes; состояние
конкретных build/schema/file pairs приведено в таблице ниже. Применимый readiness
разрешает начать engineering до наличия будущих test proofs; подтверждение
совместимости, замена browser exporter и physical acceptance ждут своих evidence.
Физически доказанный local handoff нужен для приёмки переноса.

**Acceptance Criteria:**

1. **Дано** здоровый Durable Telegram Project с точными pinned resources,
   **когда** пользователь инициирует export, **тогда** общий encoder готовит
   self-contained backup в утверждённом формате, не изменяя сохранённый Project.
2. **Дано** подготовленный backup, **когда** host запускает локальное системное
   действие, **тогда** UI показывает передачу без утверждения внешнего сохранения
   по callback/click; `blob:` не передаётся в HTTPS-only `downloadFile`.
3. **Дано** реально сохранённый внешний файл поддерживаемой версии, **когда**
   он выбран в Web/PWA, **тогда** strict staged import создаёт новый Project ID с
   0 мм semantic drift, теми же host addresses и exact resource hashes; исходный
   Telegram и прежние browser Projects сохраняются, session History не переносится.
4. **Дано** cancel, error, unsupported handoff либо corrupt, unsupported,
   truncated или oversized файл, **когда** выполняется выдача/import, **тогда**
   видны честная причина и retry/exit; unsafe publication и опасных staging roots
   нет, размер проверяется до полного чтения.
5. **Дано** persist-failed candidate, **когда** выбран recovery export, **тогда**
   UI называет файл данными для восстановления, не complete Portable Backup и не
   saved Revision.
6. **Дано** Telegram iOS и Android, **когда** проводится S3 acceptance, **тогда**
   на каждом фактически сохраняют файл вне WebView и повторно выбирают для
   импорта, проверяя оба направления и фиксируя device/OS/Telegram versions.
   При невозможности local handoff приёмка ждёт owner-выбора; скрытый upload,
   bot delivery и cloud sync не вводятся.

7. **Дано** существующий browser recovery/export и зарегистрированный AD-30
   wire, **когда** выбирается маршрут возврата, **тогда** PPJ registry и прежние
   recovery/export сохраняются до доказательства exact export каждого non-corrupt
   Durable Project по текущей policy и исполняемого worst-case corpus. Для
   единственной неоднозначной копии без проверенного пути сначала проверяется
   old-build → same-context upgrade → новый exact export; если путь невозможен,
   требуется адресное решение owner. Отказ не объявляется восстановлением.

8. **Дано** явное действие `Импорт файла для переноса`, **когда** пользователь
   выбирает зарегистрированный файл, **тогда** только trusted browser composition
   направляет этот ingress в отдельный anonymous browser-local namespace с
   собственными Project/Revision, staging, resources/library, writer/fence,
   journal/receipt и roots. Его substrate — новая DB (предпочтительно
   `interiors-editor-browser-registered`, schema v1), общий domain, ImportUseCase,
   validation и publication boundary. Файл, raw ID, hash или пользовательский
   flag не назначают owner; Telegram identity/`VerifiedTelegramScope`/signed
   launch/`tma-v1:` не подделываются. Прежние browser DB names/schema/data,
   default import/export, команды и history protocol не мигрируются и не
   переписываются; никакой общий old-writer guard не вводится попутно.
9. **Дано** исходный raw Project ID и оба известных browser stores, **когда**
   после обязательных preflight проверок выбирается destination ID, **тогда**
   raw ID точно отличается от source ID и проверяется на отсутствие в каждом
   доступном store; совпадение требует новый ID, невозможность проверки закрывает
   import. Destination атомарно `add`-ит Project/Revision с no-overwrite/no-ABA,
   а collision вызывает безопасный отказ или retry. Эта проверка двух независимых
   DB не атомарна между ними и не гарантирует глобальную уникальность против
   concurrent/future legacy producer; при позднем совпадении обе записи остаются
   раздельными, без слияния или overwrite.
10. **Дано** объединённая directory и одна или две записи с одинаковым raw ID,
    **когда** пользователь открывает, переименовывает, редактирует, подтверждённо
    удаляет Project или возобновляет ранее начатую работу, **тогда** trusted
    `(namespace, raw ProjectId)` и generation направляют все команды, writer/
    takeover, pending/retry, History/undo/redo, recovery/repair, resource
    hydration/pin, export и поздние callbacks только выбранному owner. Unknown
    owner означает отказ/reselection, не `first match`; namespace не сериализуется
    в Project/backup. Карточки различимы видимо и для assistive technology.
11. **Дано** bounded registered decode, **когда** выполняется import, **тогда**
    порядок — archive/schema/domain/resource validation → actual render smoke
    проверенных source/resources → cancel → read-only exact representability для
    прежнего browser backup → стандартный ImportUseCase и browser feasibility.
    Проверяются lowercase raw resource hashes, exact bytes и прежние limits, а
    также structured `-0`/`0`, own-undefined/absent и UTF-16; будущие ID/metadata
    учитываются консервативно без раннего allocation. Непредставимый valid wire
    получает `PROJECT_BACKUP_ENVELOPE_EXCEEDED` до IDs/pin/staging/Durable,
    не объявляется corrupt, не подменяет более ранний validation reason и сохраняет
    source/raw keys. При неразрешённом precedence route не включается;
    действующий registered resource preflight 25 MiB сохраняется отдельно от
    portable envelope. Не менять общий Telegram V1 alias policy или старый decoder.
12. **Дано** новый browser namespace, **когда** происходит create/stage/commit,
    takeover, cancel, crash или неизвестный результат, **тогда** scope имеет
    собственный проверенный cross-context lock/owner и atomic fence/base, IDs,
    exact pin/root, receipt и conditional no-publish cleanup; неизвестная запись
    сохраняется до доказанной reconciliation, чужие Project/Revision/resources/
    undo/redo roots не изменяются. Недоступный обязательный lock/fence/storage
    означает read-only/отказ нового scope без fallback к legacy. Обычные directory
    и capability probe не создают DB: existing-only open с `oldVersion=0`
    abort-ит versionchange и закрывает поздний success. Фактическое отсутствие DB
    сейчас — `not-provisioned`, история неизвестна, не healthy empty и не
    доказанная первая установка; ошибка/недоступность existing store не считается
    отсутствием. Доступная legacy область продолжает безопасную работу.

    Только явный registered import после bounded validation, actual smoke,
    cancel и representability до IDs может инициировать bounded fresh-v0.
    Trusted browser composition получает тот же exclusive scope Web Lock, без
    `steal`, рекурсивного lock, сети или пользовательского ввода внутри него;
    повторно проверяет generation и текущий DB state. При native `oldVersion=0`
    и неотозванной попытке одна versionchange transaction атомарно создаёт
    зарегистрированные stores/keyPaths, browser identity/protocol marker и
    counter. Если другая вкладка уже создала DB, выполняется проверенный existing
    reopen. Это создание текущей области не доказывает, что прежних данных не
    было или они восстановлены. После schema commit повторно проверяются
    identity/counter и publication predicates; затем raw ID сравнивается с source
    и обоими stores по AC9. Если import отменён или отклонён после schema commit,
    допустимо сохранить валидную служебную область без Project, не называя её
    imported; пустой она считается только после успешного актуального чтения,
    без утверждения об истории.

    Existing DB с missing/corrupt/foreign marker, неверным или отсутствующим
    counter, unknown ownership, unexpected/future schema — read-only/recovery
    либо отказ без reset, удаления, догаданного upgrade или legacy fallback.
    При обнаружении исчезновения ранее подтверждённой DB, marker или counter в
    живом context его generation окончательно отзывается: старые callbacks и
    attempts не получают новую capability и не могут автоматически пересоздать
    область; требуется recovery/fail-closed, не fresh-v0. Native versionchange,
    forced close или connection error отзывают capability; начатые transactions
    abort-ятся, где возможно, либо их исход подтверждается под удерживаемым lock.
    Cancel после lock grant сам по себе не откатывает IDB transaction; возможный
    commit или unknown outcome разрешается по receipt с сохранением roots.
    Blocked/timeout/revoke не отменяют IDBOpenDBRequest: abandoned guard abort-ит
    поздний upgrade и закрывает поздний `onsuccess`. Strict durability обычных
    readwrite transactions проверяется; для native versionchange не выдумывается
    application-set durability option.

    В проверенной модели кооперирующихся живых contexts stale capability/attempt
    предыдущего экземпляра не может писать или очищать текущий scope; при
    недоказанном lifecycle — fail closed, в том числе при valid-present rollback.
    Полный origin clear/eviction или snapshot без DB может быть неотличим от v0:
    недопустимо обещать восстановление либо математическую глобальную never-reuse.
    DB names или случайная epoch сами не доказывают изоляцию/non-reuse; внешний
    eviction risk NFR-13, source и legacy данные сохраняются.
13. **Дано** healthy Durable Project новой области и последующие допустимые
    edits/history transitions, **когда** пользователь офлайн выбирает обычное
    `Создать резервную копию`, **тогда** прежний browser codec читает exact pinned
    resources из repository этого owner и создаёт полный self-contained FR-44
    backup; новый transfer export остаётся отдельным действием. Эта гарантия
    проверяется для каждого допустимого non-corrupt Project; допустимый legacy
    reimport создаёт отдельную копию. Данные другой области не удаляются и не
    становятся доступными по одному hash. Для копирования ресурса из legacy
    library нужны verified bytes/hash/length и новый scoped pin/policy до Durable,
    исходник сохраняется. Если полная представимость не доказана — route не
    допускается, существующий FR-44 не ослабляется.
14. **Дано** недоступная, занятая, повреждённая или несовместимая одна область,
    **когда** открывается merged directory или происходят startup/update/rollback,
    **тогда** она помечается как неизвестная/недоступная, список — неполным, не
    пустым; другая область продолжает безопасную работу по своему handshake.
    Нет auto-create/reset/delete/repair/migration и нет обещания общей квоты,
    защиты от same-origin script или origin eviction. Старый PWA не видит новые
    локальные Projects; обновлённый client предупреждает до rollback и предлагает
    только фактически доказанный file route отдельной копии, без sync.
15. **Дано** persist-failed candidate этого sealed ingress и неактивная
    publication без pending history transition, **когда** пользователь повторно
    выбирает файл, **тогда** до новых IDs снова выполняются registered validation
    и private exact comparison structured source, всех resource refs и bytes с
    защищённым proof первой попытки. Только тот же source может безопасно
    restart-иться; иной файл, cancel, exception, missing proof или active history/
    publication сохраняют прежний candidate, экран и roots без IDs. Заменить
    pending можно только после подтверждённого нового Durable outcome либо нового
    persist-failed candidate точно того же source с уже защищёнными recovery
    roots. При unknown предыдущем commit сначала нужна доказанная reconciliation;
    его нельзя считать отказом, публиковать повторно или освобождать roots по ID.
    Пока путь не реализован и не проверен, повторный выбор не заявляется
    работающим; текущий pending guard может вернуть `in-progress`.

**Локальный implementation gate и границы:** прежний узкий S3 gate не оценивал
AD-31. [Readiness report](implementation-readiness-report-2026-11-04.md) от
2026-11-05 зафиксировал применимый LOCAL READY на реализацию этого scoped пути;
это не waiver, release READY или evidence выполнения. До включения registered
ingress и DONE 10.5 один implementation owner доказывает
весь production path и обязательный corpus ниже, включая старую PWA. Это scoped
local gate, не blanket release READY и не physical acceptance. Если first-use/
anti-ABA или другой обязательный proof неразрешим — новый writable route остаётся
закрытым, безопасный legacy путь сохраняется.

**RED → GREEN и evidence:** RED — реальный файл и controlled failure/cancel/
oversize/unsupported paths выявляют ложный успех, потерю resources или partial
publication; GREEN — production handoff и strict import сохраняют source,
точность и hashes. Required mutation checks покрывают handoff, staging и
publication guards; regression включает Story 10.4 и browser backup path.
Дополнительный RED→GREEN corpus AD-31: два независимых browser contexts и
concurrent bootstrap; existing-only probe отсутствующей DB без создания, явный
validated fresh-v0, конкурентный existing reopen и отсутствие ложного first-use;
missing/corrupt marker/counter, known loss с окончательным revoke generation,
valid-present rollback и неразличимый origin clear/eviction; blocked/timeout,
late upgrade/success, versionchange/forced close, abort/drain in-flight IDB и
cancel после lock grant, unknown commit/receipt; native IDB quota/crash/fence/
takeover и late commits; current/undo/redo roots
и no-overwrite; source-ID повтор, ID collision в каждой DB и недоступная проверка;
конкурентное/будущее совпадение raw IDs, различимые карточки и точный owner для
всех open/rename/edit/delete, writer/takeover, undo/redo, pending/retry,
recovery/repair, resource hydration, обоих exports и delayed async после switch.
Отдельно оба варианта partial failure одного store, повторный выбор того же/
другого файла, cancel/exception, missing private proof и active history/
publication, отсутствие новых IDs до proof. Реальный GLB/SHA → pin → reopen →
edit → undo/redo → прежний offline backup → допустимый legacy reimport; сравнение
geometry/hosts/metadata, exact bytes/raw hash keys, resource copy и обеих areas;
`-0`, own-undefined, UTF-16, uppercase/mixed-case aliases и границы; validation/
smoke/cancel precedence и ранний refusal. Старый установленный PWA, update/
rollback, старые import/export/History и полный прежний corpus без ослабления;
проверка отсутствия нового namespace в поддерживаемых old builds. Required
mutation проверяет owner routing, collision/fence/receipt, fail-closed,
representability/pin и pending/reselection guards. Native browser/IDB evidence не
является physical Telegram; NFR-28 и реальный внешний roundtrip остаются pending.

**Связи:** TMA-11–13; TMA-AC-08–10/12/13; CAP-1/8/10/13; FR-5/43–45/55/57;
NFR-1/3/11–13/21/26/28; AD-3/4/25/26/29/30/31; UXF-8, UX-TMA-04/10/11.

#### Build/file matrix S3 — зарегистрированный контракт и будущие evidence

| Producer → consumer | Контрактный путь | Статус evidence / когда требуется |
|---|---|---|
| Старый build `ccdd13662cdca379` → старый Web/PWA | Исторический V1 path; source archive и context сохраняются | Существующие synthetic paths не доказывают реальный пользовательский файл; проверка конкретной пары выполняется в engineering. |
| Old Web/PWA или S1 `d38550c8f379120a` → новый Web/PWA/TMA | V1-legacy только с exact historical bytes, полной grammar и PPJ-disjoint witness; иначе консервативный отказ | Decoder/corpus и реальные файлы pending; sole-copy без witness проверяется через старый context → upgrade → новый wire; решение owner только если путь действительно невозможен. |
| Новый Web/PWA → TMA | Явный дополнительный `Экспорт файла для переноса`, registered `runtime-v1-wire@1`, snapshot/resources выбранного owner; старый backup остаётся | Конкретные build/file pairs, writer, worst-case proof и внешний reselect pending; proof не требуется готовым до начала кода. |
| TMA → новый Web/PWA | Явный registered import в отдельный browser namespace после строгой representability прежним backup; raw ID ≠ source и precheck обоих stores | LOCAL READY для AD-31 получен; implementation и полное локальное evidence pending; без обещания межбазной атомарности или общей storage с Telegram. |
| Новый registered Project → старая установленная PWA | Прямая локальная видимость отсутствует; только проверенный legacy backup/reimport как отдельная копия | До rollback обновлённая UI объясняет границу; фактическая пара build/file и внешний handoff pending. |
| Legacy и registered Project с одним raw ID | Отдельные карточки и trusted `(namespace, raw ProjectId)` для всех операций | Forced collision и concurrent/future legacy producer обязательны в corpus; precheck не обещает глобальной уникальности. |
| Новый wire → старый client | Старый decoder не поддерживает selector; требуется обновление Web/PWA | Наблюдение по коду, не физическое подтверждение конкретной пары. |
| PPJ-A1 → новый client | Только strict PPJ и полностью lossless V1 mapping, без decoder fallback | Mapper/corpus pending; PPJ не приравнивается к V1. |
| Unknown/corrupt/ambiguous/unrepresentable | Ранний правильный reason, сохранение исходника без publication | Проверить на corpus и реальных файлах; единственная читаемая копия вне grammar не объявляется corrupt. |

### Story 10.6: Точно редактировать план в доступной области Telegram

Как пользователь Telegram, я хочу строить и измерять план привычными жестами и
полями, чтобы получить точный результат при изменении окна или клавиатуры.

**Production path:** Telegram viewport/theme adapter → общий Plan UI и projection
→ validated command → fenced Durable Revision → reopen. Один implementation owner.
**Минимальная ценность:** допустимая стена, видимый размер и тот же сохранённый
результат после viewport change.
**Зависимости:** scoped Telegram runtime Stories 10.2–10.3; Stories 10.4–10.5 и
решение формата переноса не требуются.

**Source-owner status:** PRD owner согласовал FR-16 с REL-05 и FR-9 с REL-08:
редактируются type/height, сохранённое name сохраняется, отдельный split UI не
обещается, а допустимые контакты нормализуются. В SPEC уже наблюдается эта
дельта в CAP-2/3, source-owner workflow подтвердил reconciliation. Project-context
теперь называет non-canvas type/height route, но его общая фраза о metadata flow
требует уточнения; применимый readiness recheck остаётся отдельным.

**Acceptance Criteria:**

1. **Дано** открытый Telegram Project, **когда** пользователь строит допустимую
   orthogonal или 45° стену и подтверждает её, **тогда** общий command path
   сохраняет integer mm и даёт доменный результат, эквивалентный Web/PWA;
   preview, измерения и reopened Project согласованы.
2. **Дано** active wall/item draft, **когда** viewport/keyboard меняет
   screen→plan transform, **тогда** stale projection не публикует команду;
   недоступная актуальная проекция показывает `SelectionUnavailable` с retry,
   numeric или cancel без Project/History mutation.
3. **Дано** незавершённое построение/перемещение, **когда** второй pointer
   начинает pinch, **тогда** draft отменяется без Revision, pan/pinch не
   подтверждают команду и следующий жест работает.
4. **Дано** 360 CSS px и текст 200%, **когда** открыты активное поле/sheet,
   **тогда** статус сохранения, основное действие, cancel и поле доступны;
   keyboard/safe areas не перекрывают controls и не суммируются дважды. Targets
   ≥44 px, DOM/list alternatives, focus и reduced motion сохраняются.
5. **Дано** theme, rotation или resize, **когда** интерфейс перестраивается,
   **тогда** контраст плана и размеров читаем, Project/History/Revision не
   меняются; актуальные REL/FUP маршруты стены и проёма сохраняются в обоих host.

6. **Дано** существующий поддерживаемый план, **когда** пользователь изменяет
   допустимые стены/параметры комнат, создаёт или редактирует проём и выполняет
   точное измерение, **тогда** действуют те же domain validation, preview,
   conflict/re-entry и измерения, что в Web/PWA; rejected/cancelled действие не
   меняет Project или History. REL/FUP сохраняют принятые маршруты и controls.

7. **Дано** принятые FR-9/FR-16 и REL-05/08, **когда** пользователь меняет
   type или height помещения и открывает Project снова, **тогда** существующее
   `Room.name` сохраняется без поля редактирования имени и показа исторического
   имени на плане. Допустимые T/X и другие контакты нормализуются автоматически;
   удалённый gesture split и отдельный numeric split UI не восстанавливаются,
   domain operations и совместимость старых разделённых стен сохраняются.

**RED → GREEN и evidence:** RED — host viewport/keyboard и multi-pointer scenarios
выявляют stale projection или accidental publication; GREEN — production UI и
command path дают точный результат и безопасную отмену. Required mutation checks
покрывают stale/generation и no-mutation guards; regression — Web/PWA plan/
projection, REL/FUP и Stories 10.1–10.3. Physical keyboard/safe areas на iOS и
Android остаются pending NFR-28.

**Дополнительное evidence:** RED — одинаковые supported wall/room/opening и
measurement intents в двух host выявляют drift или mutation при reject/cancel;
GREEN — общий production path даёт совпадающие outcomes. Regression включает
существующие topology, opening, measurement и REL/FUP checks. RED также
проверяет сохранение `Room.name` после type/height/reopen, отсутствие split UI и
корректную T/X-нормализацию; GREEN использует принятые production routes.

**Связи:** TMA-05–07; TMA-AC-03/04/12/13; CAP-2–4/8/9/13;
FR-7–13/17–19/38–40/55; NFR-1–4/16–20/26/28; AD-1/3/7/20–22/25/27;
UX-TMA-06/07/08/12, REL/FUP.

### Story 10.7: Безопасно выйти из редактора или продолжить незавершённую правку

Как пользователь Telegram, я хочу предсказуемо пользоваться Back и Close,
чтобы случайно не подтвердить правку и не потерять доступный путь восстановления.

**Production path:** in-app или Telegram Back/Close → общий safety state и
navigation handler → panel/draft/pending/recovery action → editor или Projects.
Один implementation owner. **Минимальная ценность:** пользователь может
продолжить или явно отменить draft без новой Revision.
**Зависимости:** Stories 10.2–10.3; Stories 10.4–10.5 и форматное решение не
требуются.

**Acceptance Criteria:**

1. **Дано** несколько одновременных состояний editor, **когда** нажат in-app или
   Telegram Back, **тогда** один handler применяет наиболее защитное состояние;
   закрытие панели не обходит draft, PendingDurability или persist-failed.
2. **Дано** draft, незавершённый ввод или ConflictPreview, **когда** вызван Back,
   **тогда** доступны продолжение или явная отмена правки. Отмена диалога выхода
   сохраняет тот же draft, selection и focus; отмена правки не создаёт Revision и
   не вызывает второй Back.
3. **Дано** PendingDurability, **когда** пользователь управляемо выходит,
   **тогда** UI показывает сохранение и ждёт результата. При persist-failed
   сохраняются точный candidate, retry/recovery export; отказ от candidate требует
   явного предупреждения и подтверждения.
4. **Дано** read-only recovery, **когда** закрывается панель или открываются
   Projects, **тогда** Project автоматически не чинится и не удаляется. Из
   Durable editor без draft Back ведёт к Projects; из списка Mini App закрывается
   только по явному Back.
5. **Дано** системный Close или конфликтующие host swipes при несохранённой
   работе, **когда** host позволяет предупреждение, **тогда** оно используется без
   обещания предотвратить принудительное закрытие; draft не подтверждается. Swipe
   ограничивается лишь когда необходимо и восстанавливается при выходе. Внезапное
   завершение использует atomic recovery последней Durable Revision.
6. **Дано** Web/PWA и Telegram, **когда** пользователь использует controls,
   **тогда** Telegram handler не дублирует команды и не меняет привычный browser
   Back; критические confirm/cancel/recovery actions доступны через DOM.

**RED → GREEN и evidence:** RED — матрица состояний и сочетаний panel+draft,
pending, persist-failed и recovery выявляет неверный приоритет или duplicate
handler; GREEN — production navigation сохраняет candidate, focus и durable
boundary. Required mutation checks покрывают приоритеты и no-publication guards;
regression — browser Back, REL/FUP и Stories 10.1–10.3/10.6. Physical host
Back/Close/swipe остаются pending NFR-28.

**Связи:** TMA-06–08; TMA-AC-04/06/12/13; CAP-1/2/8/9/13;
FR-5/38–40/55; NFR-3/11/17–20/26/28; AD-3/4/25/27;
UXF-8, UX-TMA-03–05/12.

### Story 10.8: Разместить реальную напольную модель и увидеть её в 3D

Как пользователь Telegram, я хочу выбрать предмет реальных размеров, поставить
его на пол и осмотреть в 3D, чтобы проверить расстановку и продолжить работу
после повторного открытия.

**Production path:** общий CatalogGateway → metadata и exact resource download →
scoped pin и BackupFeasibilityPolicy → floor preview → validated placement →
Durable Revision → общий 2D/3D renderer → reopen. Один implementation owner.
**Минимальная ценность:** реальная floor-модель сохраняется с точными ресурсами и
одинаковым положением в Plan и 3D.
**Зависимости:** Stories 10.2–10.3 и доступный Plan path; перенос Stories 10.4–10.5
не требуется. По решению владельца 2026-11-04 бесплатные или собственные модели
отбираются вне приложения; формальный AssetUsageGrant и licensing admission не
являются Alpha gate. Техническая проверка ресурсов и точный pin обязательны.

**Acceptance Criteria:**

1. **Дано** доступный catalog-only gateway и допущенная реальная floor-модель,
   **когда** пользователь выбирает и подтверждает допустимое положение, **тогда**
   exact bytes проходят hash/size validation, pin и BackupFeasibilityPolicy до
   публикации одной Durable Revision.
2. **Дано** выбранное положение, **когда** пользователь переключает Plan/3D и
   повторно открывает Project, **тогда** сохранены размеры, floor host, placement,
   orientation и exact hash; оба вида показывают одну доменную модель.
   Переключение вида не создаёт Revision.
3. **Дано** недоступный каталог, прерванную загрузку, hash/range mismatch или
   cancel до pin, **когда** ресурс ещё не доступен, **тогда** есть retry/cancel,
   placement не становится Durable, healthy Project не переходит в
   ResourceRecoveryRequired.
4. **Дано** полностью pinned Project, **когда** каталог недоступен, **тогда**
   локальные open/edit/save и session undo/redo сохраняются; Catalog Control
   Plane не получает Project, Revision, History или backup.
5. **Дано** unsupported WebGL или потеря контекста, **когда** открывается 3D или
   renderer восстанавливается, **тогда** Project не меняется; доступен capability,
   2D или diagnostic fallback, а пересозданная сцена использует ту же модель.
   Потеря renderer сама по себе не переводит healthy Project в
   ResourceRecoveryRequired: этот статус требует действующей resource corruption.

6. **Дано** допустимый floor AssetInstance или placeholder, **когда** пользователь
   перемещает, поворачивает, изменяет свойства, дублирует или удаляет его,
   **тогда** действуют принятые placement/collision, confirm и undo/redo semantics
   без изменения других объектов. Допустимый item color/variant по FR-33/CAP-7
   сохраняет host и размеры, а требующий resource variant pin-ится до Durable.
   Independent Project variants, finishes и Alpha+ этим не добавляются.

**RED → GREEN и evidence:** RED — production placement с реальными bytes, ошибкой
hash, cancel и потерей renderer выявляет premature publication или расхождение
проекций; GREEN — exact pin и policy предшествуют durable placement, reopen
сохраняет hash и геометрию. Required mutation checks покрывают resource admission,
pin и publication guards; regression — Web/PWA catalog/placement/3D и Stories
10.1–10.3/10.6. Physical floor placement/reopen остаётся pending NFR-28.

**Дополнительное evidence:** RED — transform/collision/placeholder, item actions,
undo/redo и resource-backed variant выявляют неверный host или missing pin; GREEN —
общие production routes и Web/PWA regression сохраняют принятые outcomes.

**Связи:** TMA-05/08/15; TMA-AC-03/06/10/12/13; CAP-1/5–8/11/13;
FR-21–23/25–31/38/54/55; NFR-2–4/8/10/13/14/21/26/28;
AD-3/4/5/8/10/13/14/17/23–25/27/28; UX-TMA-08/09/12.

### Story 10.9: Разместить настенную модель с устойчивой привязкой

Как пользователь Telegram, я хочу разместить настенный предмет на выбранной
стене и повторно открыть проект, чтобы видеть его в том же месте в плане и 3D.

**Production path:** общий catalog gateway → exact resource pin и policy → выбор
стены и wall-placement preview → подтверждённая команда → Durable Revision →
Plan/3D → reopen. Один implementation owner.
**Минимальная ценность:** реальная wall-модель сохраняет точный host address и
ресурсы после reopen. **Зависимости:** Stories 10.2–10.3/10.6/10.8; перенос
10.4–10.5 не нужен. Формальный licensing/grant admission не является Alpha gate;
format/size/hash/security checks, exact pin и backup policy остаются обязательными.

**Acceptance Criteria:**

1. **Дано** допустимая стена и допущенная реальная wall-модель, **когда**
   пользователь подтверждает placement, **тогда** exact bytes проходят validation,
   scoped pin и BackupFeasibilityPolicy до одной Durable Revision; сохраняются
   wall host address и допустимые смещение/высота.
2. **Дано** сохранённый настенный предмет, **когда** пользователь переключает
   Plan/3D и повторно открывает Project, **тогда** обе проекции показывают тот же
   host и положение, exact hash совпадает; switch не создаёт Revision.
3. **Дано** выбранное окно, **когда** открывают каталог и выбирают wall-модель,
   **тогда** контекст окна очищается, confirm/cancel placement доступны, окно не
   меняется; до confirm предмет отсутствует в Durable Project.
4. **Дано** invalid host, conflict, stale base или потеря writer fence, **когда**
   пользователь подтверждает placement, **тогда** действует существующий safe
   reject либо conflict/re-entry без partial placement, silent rehost или лишней
   Revision.
5. **Дано** cancel или error до завершения pin, **когда** ресурс недоступен,
   **тогда** retry/cancel доступны, ресурс не становится Durable reference и
   healthy Project не объявляется повреждённым. Изменение стены сохраняет
   существующие правила явного разрешения неоднозначного host.
6. **Дано** Web/PWA с тем же исходным Project и командой, **когда** выполнен
   эквивалентный placement, **тогда** domain outcome и host semantics совпадают;
   REL/FUP пути свойств и подтверждения не восстанавливают удалённые controls.

7. **Дано** выбранный wall AssetInstance, **когда** пользователь изменяет
   поддерживаемые свойства/положение, дублирует, блокирует или удаляет его,
   **тогда** действующие REL/FUP controls, host validation, confirm и undo/redo
   сохраняются; изменение не приводит к скрытому rehost или потере точных ресурсов.

**RED → GREEN и evidence:** RED — реальная модель, окно→каталог→wall item, stale
fence и unavailable resource выявляют неверный host или premature publication;
GREEN — production path сохраняет host/hash и открывается в Plan/3D. Required
mutation checks покрывают host compatibility, pin и fencing guards; regression —
Story 10.8 и Web/PWA wall placement/REL/FUP. Physical wall placement/reopen на
обоих клиентах остаётся pending NFR-28.

**Дополнительное evidence:** RED — wall properties/item actions и undo/redo после
reopen выявляют потерю host либо неверный route; GREEN — production и Web/PWA
regression сохраняют те же подтверждённые outcomes.

**Связи:** TMA-05/08/15; TMA-AC-03/06/10/12/13; CAP-4–6/8/13;
FR-17–19/21–23/26–31/38/54/55; NFR-1–4/8/10/13/21/26/28;
AD-3/4/6–8/13/14/17/23–25/27; UX-TMA-08/09/12, FUP-06/07.

### Story 10.10: Продолжить подготовленную работу при потере сети

Как пользователь Telegram, я хочу продолжить работу с подготовленным проектом
при обрыве сети, чтобы редактировать и сохранять локальные изменения.

**Production path:** online launch → наблюдаемая готовность editor/режимов/
codecs/resources → потеря сети → local command и durable path → local undo/redo.
Один implementation owner. **Минимальная ценность:** после подготовки доступна
локальная правка и Durable Revision без сети.
**Зависимости:** Stories 10.2–10.3/10.6; для проверки предметов — 10.8–10.9.
Перенос 10.4–10.5 не требуется.

**Acceptance Criteria:**

1. **Дано** online launch и локальный Project, **когда** загружаются editor,
   2D/3D lazy modules, codecs и exact referenced resources, **тогда** готовность
   видна по каждому действительно доступному пути; первый экран не объявляет
   весь editor готовым офлайн.
2. **Дано** обрыв до подготовки режима или ресурса, **когда** пользователь
   пытается его открыть или разместить новый предмет, **тогда** UI объясняет
   недоступный путь и даёт retry при сети; доступные local actions сохраняются,
   неподготовленный ресурс не становится Durable.
3. **Дано** подготовленный Plan path и pinned resources, **когда** сеть пропадает,
   **тогда** доступны local edit, Durable Revision и session undo/redo. 3D
   доступен только при подготовленных модуле и необходимых ресурсах.
4. **Дано** недоступный Catalog Control Plane, **когда** открыт healthy Project с
   pinned ресурсами, **тогда** outage ограничивает browse/download неполученных
   ресурсов, не вызывает ResourceRecoveryRequired или удаление данных; после
   возвращения сети доступен retry.
5. **Дано** установленная подготовленная Web/PWA, **когда** проверяют холодное
   открытие без сети, **тогда** её существующий offline open/edit/save проходит
   отдельно. Telegram cold offline launch не обещается.

**RED → GREEN и evidence:** RED — потеря сети до/после подготовки каждого пути
выявляет ложную готовность, блокировку local save или публикацию unpinned resource;
GREEN — production runtime показывает доступность и сохраняет подготовленную
работу. Required mutation checks покрывают readiness/resource и durable guards;
regression — отдельный PWA cold offline, catalog outage и Stories
10.1–10.3/10.6/10.8–10.9. Physical Telegram offline остаётся pending NFR-28.

**Связи:** TMA-08/09/15; TMA-AC-02/03/05/12/13; CAP-1/6/8/9/13;
FR-5/38/41–43/54/55/58; NFR-3/10/11/13/21/26/28;
AD-3/4/11/14/17/25/27/28; UX-TMA-08/09.

### Story 10.11: Вернуться к последней сохранённой версии после прерывания

Как пользователь Telegram, я хочу безопасно вернуться к проекту после
сворачивания или принудительного закрытия, чтобы продолжить работу с последней
Durable Revision.

**Production path:** host lifecycle → общий runtime и writer lease → проверка
generation/base/fence → atomic persistence или recovery → renderer projection →
reopen. Один implementation owner. **Минимальная ценность:** успешно
опубликованная правка переживает закрытие, draft не выдаётся за сохранённый.
**Зависимости:** Stories 10.2–10.3/10.7; формат и Stories 10.4–10.5 не нужны.

**Acceptance Criteria:**

1. **Дано** последняя Durable Revision и активный draft, **когда** приложение
   уходит в фон и возвращается, **тогда** lifecycle не создаёт Command/Revision;
   до продолжения проверяются scope/generation, base Revision и writer fence.
2. **Дано** потеря writer lease или takeover, **когда** прежняя сессия
   возвращается, **тогда** stale draft/поздний результат не публикуются, право
   записи автоматически не возвращается и старый draft не воскрешается.
3. **Дано** принудительное завершение до либо после atomic pointer swap, **когда**
   Project снова открыт, **тогда** восстанавливается последняя действительно
   Durable Revision; partial write не заменяет её пустым Project, проекты не
   удаляются автоматически.
4. **Дано** PendingDurability либо persist-failed и ошибка публикации, **когда**
   UI показывает состояние, **тогда** saved Revision и точный candidate различны,
   доступен retry/recovery-export path, candidate не называется `Сохранено`.
5. **Дано** длительный фон или повторная инициализация, **когда** runtime
   возвращается, **тогда** subscriptions и disposable renderer не дублируют
   handlers/команды. WebGL loss сохраняет модель и capability/2D fallback, не
   объявляя renderer loss повреждением resources.
6. **Дано** подготовленная Web/PWA, **когда** выполняется отдельная cold-offline
   regression, **тогда** open/edit/save и update safety сохраняются.

**RED → GREEN и evidence:** RED — controlled termination на staging/pointer-swap,
takeover и поздние callbacks выявляют потерю Durable Revision или stale write;
GREEN — production persistence/lifecycle восстанавливают корректное состояние.
Required mutation checks покрывают fence, generation и atomic publication guards;
regression — Stories 10.1–10.3/10.7/10.10 и crash/recovery/PWA tests. Physical
background/kill/reopen iOS/Android остаётся pending NFR-28.

**Связи:** TMA-08/10/11; TMA-AC-02/03/06/07/12/13; CAP-1/5/8/9/13;
FR-5/38/42/43/55/56; NFR-3/8/10–13/26/28; AD-3/4/10/11/25–27;
UX-TMA-04/08/09.

### Story 10.12: Сохранить проект и историю при нехватке места или повреждении ресурса

Как пользователь Telegram, я хочу получить понятный и безопасный путь
восстановления при ошибке хранилища, чтобы не потерять последнюю сохранённую
версию или доступную историю.

**Production path:** scoped persistence/resource store → quota/integrity detection
→ существующие recovery и retention policies → безопасное действие пользователя
→ atomic outcome. Один implementation owner. **Минимальная ценность:** ошибка
хранения не уничтожает последнюю Durable Revision и не публикует partial change.
**Зависимости:** Stories 10.2–10.3/10.11 и общие recovery policies; 10.4–10.5 не
нужны для local diagnosis/repair, внешний backup имеет отдельный gate.

**Acceptance Criteria:**

1. **Дано** quota error во время staging/publication, **когда** запись не
   завершается, **тогда** последняя Durable Revision читаема, Project не удаляется,
   candidate не называется saved и доступен предусмотренный retry/recovery export.
2. **Дано** отсутствующие или corrupt exact bytes resource текущего Project,
   **когда** integrity check обнаруживает проблему, **тогда** Project read-only
   ResourceRecoveryRequired; обычные edits и undo/redo блокируются до verified
   exact-byte repair или одного полного atomic RecoveryChangeSet без unresolved
   references.
3. **Дано** corruption только session History при healthy current Project,
   **когда** пользователь выбирает восстановление, **тогда** возможны exact
   repair либо явно подтверждённый DiscardSessionHistory; последний сначала
   проверяет health current Project, атомарно удаляет обе ветви без Project Revision.
4. **Дано** ресурсы undo/redo активной сессии, **когда** работает
   SessionRetentionPolicy или допустимый exclusive pin cleanup, **тогда** они
   остаются roots; общий GC в S2 не добавляется, bytes сохраняются; новая команда может быть
   отклонена с причиной, но существующая history entry не ломается молча.
5. **Дано** scope switch или lifecycle interruption во время pin, cleanup либо
   recovery, **когда** операция возвращается поздно, **тогда** generation/barrier/
   fence не допускают публикацию или удаление в другом scope; старые данные целы.
6. **Дано** healthy pinned Project и недоступный каталог, **когда** пользователь
   работает локально, **тогда** outage ошибочно не вызывает recovery. Web/PWA
   storage/recovery и cold-offline regression проходят отдельно.

**RED → GREEN и evidence:** RED — quota, corrupt/missing resources, history-only
corruption, exclusive cleanup и scope switch выявляют потерю Revision или roots; GREEN —
production policies дают предусмотренный atomic outcome. Required mutation checks
покрывают integrity, retention, cleanup и publication guards; regression —
Stories 10.3/10.10–10.11 и Web/PWA storage/recovery. Physical WebView quota/
lifecycle остаётся pending; новых численных performance gates нет.

**Связи:** TMA-10/11; TMA-AC-05–07/12/13; CAP-1/6/8–10/13;
FR-5/38/39/42/43/55/56; NFR-3/10–13/21/26/28; AD-3/4/14/25–27;
UX-TMA-02/04/08/09.

### Story 10.13: Проверить обе оболочки без изменения действующего preview

Как владелец продукта, я хочу получить независимо проверяемые browser/PWA и
Telegram outputs, чтобы убедиться, что Mini App не нарушает работающую версию.

**Production path:** изолированные builds/previews → отдельные entries/origins →
проверка фактически загруженных shell и ReleaseManifest → schema guards →
catalog-only route. Один implementation owner. **Минимальная ценность:** оба
output запускаются с собственными guards без воздействия на телефонный preview.
**Зависимости:** Stories 10.1–10.3; перенос 10.4–10.5 не нужен для этой проверки,
полная release acceptance имеет отдельные зависимости.

**Acceptance Criteria:**

1. **Дано** действующий preview, читающий `apps/web/dist`, **когда** запускают
   сборку/проверку новых targets, **тогда** используются изолированные outputs и
   previews; текущие dist, live origin, процессы и retained chunks не очищаются и
   не перезаписываются.
2. **Дано** два target, **когда** каждый запускается из своего output, **тогда**
   browser/PWA сохраняет URL, manifest, worker, install/offline/update и не зависит
   от Telegram SDK; Telegram имеет отдельные entry/origin, не регистрирует PWA
   worker и не выполняет чужую cleanup.
3. **Дано** фактически загруженная оболочка каждого target, **когда** выполняется
   startup handshake, **тогда** ReleaseManifest соответствует именно ей и
   проверяется вместе со schema/capability guards. Telegram выполняет проверку без
   service worker; одного schema range недостаточно.
4. **Дано** отсутствующий, недоступный, несовместимый или принадлежащий другой
   оболочке manifest либо migration failure, **когда** открывается Project,
   **тогда** unsafe write запрещён, доступны предусмотренные read-only/exportable
   либо recovery состояния.
5. **Дано** запрос HTML, JS/CSS, manifest, lazy chunk или `/catalog-api`, **когда**
   target разрешает адрес, **тогда** используются верный asset base и catalog-only
   perimeter; отсутствующий JS/API/manifest не выдаётся как HTML с успешным
   статусом. Catalog hash/size/Range/pin guards сохраняются.
6. **Дано** старый установленный PWA worker и сохранённый Project, **когда**
   появляется Telegram target, **тогда** PWA открывает свои данные, работает
   offline и безопасно обновляется; Telegram chunks не попадают автоматически в
   её precache.

7. **Дано** catalog requests каждого target, **когда** gateway обращается к
   catalog-only perimeter, **тогда** он использует `credentials: omit`, не
   добавляет Telegram token и сохраняет прежний отказ backend от Cookie/
   Authorization; не создаётся скрытая Project-service boundary.

**RED → GREEN и evidence:** RED — shell/manifest mismatch, missing chunks/API,
отсутствие worker и old-worker regression выявляют unsafe launch или смешение
outputs; GREEN — оба production outputs проходят из изолированных previews.
Required mutation checks покрывают manifest identity, schema и routing guards;
обязательны type/lint/boundary, browser/PWA и Telegram tests. Проверка не является
публикацией или physical Telegram release.

**Дополнительное evidence:** RED — network-boundary tests выявляют credentials,
Telegram token или Project payload; GREEN — оба target соблюдают catalog-only
contract, а существующий gateway/security regression остаётся зелёным.

**Связи:** TMA-01–04/15/16; TMA-AC-01/02/10–13; CAP-1/6/9/13;
FR-41/42/47/54/58; NFR-10/12/21/24/26/28; AD-2/4/11/16/17/24/25/28;
UX-TMA-01/09.

### Story 10.14: Безопасно подготовить выпуск и откат двух оболочек

Сохранить неизменяемый архив прежних редакций. Закрыть прежние адреса открытия и персонального возврата для старого клиента перед переключением, сохранить запрет при откате. Проверить подсчёт двумя пустыми маршрутами и завершение повторов по часам приёмника. [Обычная сборка](sprint-change-proposal-2026-11-22-public-candidate.md).

Как владелец продукта, я хочу проверить выпуск и независимый откат Web/PWA и
Telegram, чтобы открытые клиенты продолжали работать, а проекты сохранялись.

**Production path:** изолированная подготовка release sets → полнота immutable
assets → атомарное переключение shell/manifest → старый клиент → rollback на
целостный retained set. Один implementation owner. **Минимальная ценность:**
локальная репетиция доказывает работу ещё не загруженного режима старого клиента
после выпуска и отката.
**Зависимости:** Story 10.13 и проверочные release sets; для репетиции 10.4–10.5
не нужны, полная Telegram release acceptance имеет отдельные gates/evidence.

**Acceptance Criteria:**

1. **Дано** подготовленный выпуск target, **когда** проверяют release set,
   **тогда** все адресуемые immutable JS/CSS/lazy assets опубликованы в
   проверочной среде и проверены до атомарного переключения shell/manifest;
   отсутствующий или несогласованный asset не допускает переключение.
2. **Дано** старый открытый клиент с ещё не загруженным режимом, **когда**
   репетируют release и rollback, **тогда** старый клиент получает нужный
   неизменный lazy URL, schema guards действуют, rollback выбирает полный
   целостный retained set.
3. **Дано** два target, **когда** Telegram release отключается/откатывается,
   **тогда** не требуются откат исправной PWA, принудительный reload её активной
   сессии или удаление Projects; worker/cache/output не очищают соседний target.
4. **Дано** опубликованные immutable URLs, **когда** рассчитывают хранение и
   release budget, **тогда** они сохраняются без автоматического срока удаления до
   отдельного безопасного release/retirement решения; budget текущей сборки
   измеряется по её shell, не glob всех retained chunks.
5. **Дано** действующий телефонный preview, **когда** проводят репетицию,
   **тогда** изолированные outputs/previews не перезаписывают `apps/web/dist`,
   не останавливают процессы и не меняют live origin. До/после записывают startup
   bundle sizes и наблюдаемость жестов на одинаковом fixture без нового
   обязательного hardware benchmark.
6. **Дано** подготовка реального выпуска, **когда** проверяют bot, HTTPS origins
   и catalog routing, **тогда** недостающие значения/доступы остаются pending;
   репетиция не является внешней публикацией или разрешением на неё.

**RED → GREEN и evidence:** RED — неполный release set, shell/manifest mismatch,
ранняя cleanup и rollback со старым клиентом выявляют недоступный lazy mode;
GREEN — изолированная репетиция обоих targets проходит без изменения preview.
Required mutation checks покрывают полноту набора, переключение и rollback guards;
regression — Story 10.13 и старая установленная PWA. Реальные bot/origins,
внешний выпуск и physical evidence фиксируются отдельно.

**Связи:** TMA-02–04/16; TMA-AC-01/02/11–13; CAP-1/9/10/13;
FR-41/42/47/58; NFR-10–12/24/26/28; AD-4/11/25/28; UX-TMA-01/09.

### Story 10.15: Получить проверяемый runbook и фактические доказательства выпуска

Сверить обычную сборку, коллектор и суточный отчёт. Проверить физический вход iOS/Android, открытие документов, отключение, отзыв, сетевые журналы и исторических получателей. Запрос от рабочей копии к живой системе требует допуска публикации. [Обычная сборка](sprint-change-proposal-2026-11-22-public-candidate.md).

Как владелец продукта, я хочу видеть воспроизводимые шаги и фактические
результаты проверки обеих поверхностей, чтобы принимать решение о выпуске на
основании подтверждённого поведения и открытых ограничений.

**Production path:** проверяемые outputs → изолированная release/rollback
rehearsal → при наличии разрешённых реальных ресурсов запуск на целевых клиентах
→ запись результатов и runbook → отдельное решение о выпуске. Один implementation
owner; физическую проверку и owner decision выполняют соответствующие участники.
**Минимальная ценность:** runbook повторяет проверенные локальные шаги, отчёт
показывает открытые release gates.
**Зависимости:** локальные результаты Stories 10.1–10.3/10.6–10.14; полная
приёмка переноса также требует source-owner disposition и 10.4–10.5. Внешний
запуск, устройства и публикация зависят от доступов и отдельного разрешения.

**Acceptance Criteria:**

1. **Дано** подготовленные outputs, **когда** составляется runbook, **тогда** в
   нём проверенные команды и конфигурационные значения для targets, bot/HTTPS
   origins, catalog routing, isolated preview, release и rollback. Отсутствующие
   реальные значения — pending; credentials и signed data не попадают в отчёт.
2. **Дано** результаты automated проверок, **когда** составляется evidence record,
   **тогда** отдельно указаны дата, команда, target, фактический результат и
   ограничения type/lint/boundary/domain, browser/PWA, Telegram и required mutation
   checks. Старые прогоны и historical READY не называются новым TMA acceptance.
3. **Дано** доступные iOS/Android Telegram-клиенты, **когда** выполняется NFR-28,
   **тогда** записываются device, OS и Telegram versions и фактически проверяются
   create → edit → реальные floor/wall placement → 3D → Durable save → close →
   reopen, Back/Close, keyboard/safe area, prepared offline, exact pin/hash и
   безопасная account isolation. Без доступа результаты pending; bridge fake и
   emulator не заменяют physical evidence.
4. **Дано** source-owner форматное решение и работающий local handoff, **когда**
   проверяется перенос, **тогда** на каждом целевом клиенте реальный файл
   сохраняется вне WebView и повторно выбирается для import в обоих направлениях.
   Записаны build/schema, 0 мм semantic drift и exact hashes; исходные Projects
   сохраняются.
5. **Дано** невозможность подтвердить local handoff либо account isolation,
   **когда** готовят release decision, **тогда** зависимый gate остаётся открытым.
   Только при доказанной невозможности handoff владелец отдельно решает
   alternative/privacy/retention; upload, bot delivery и cloud sync не появляются.
6. **Дано** release evidence и rehearsal, **когда** владелец рассматривает
   результат, **тогда** implementation readiness, Telegram acceptance,
   внешняя публикация и будущий Web/PWA retirement — разные решения. Retirement
   требует отдельного допуска после owner check, доступа к старым данным,
   доказанного переноса и rollback; automatic deletion нет.

7. **Дано** diagnostic event, **когда** он записывается согласно действующей
   consent policy, **тогда** содержит target, app/schema/catalog versions,
   capability result и stable reason; не содержит initData, tokens, имени,
   geometry, GLB contents или file paths. Недоказанные результаты не маркируются
   PASS; временный tunnel не объявляется стабильным origin или переносом storage.

**RED → GREEN и evidence:** RED — проверка полноты runbook/evidence выявляет
пропущенный target, несуществующие результаты или отсутствие источника PASS;
GREEN — каждый выполненный результат воспроизводим или ссылается на фактическое
evidence, прочие — pending. Required mutation и regression checks фиксируются
только по фактическому выполнению. Документ сам не доказывает physical acceptance
или публикацию.

**Дополнительное evidence:** RED — diagnostic privacy/consent и evidence audit
выявляют запрещённые поля или непроверенное PASS; GREEN — production diagnostics
и сохранённые regression проверки соответствуют contract без данных Project.

**Связи:** TMA-01–16 и TMA-AC-01–13 — итоговая evidence-матрица; CAP-1–11/13;
FR-41–45/47/54–58; NFR-10–13/21/24/26/28; AD-4/11/14/17/24–29; UXF-8 и REL/FUP.

### Story 10.16: Уточнить положение предмета по расстояниям до стен

Как человек, который сам расставляет мебель в Telegram, я хочу видеть зазоры
до стен во время движения предмета, чтобы выбрать положение без повторных
ручных замеров.

**Зависимости.** Использует редактируемый план, принятый черновик напольного
размещения и проверку сохранения из 10.6, 10.8 и 10.11–10.12. Начальный
fixture может использовать существующий напольный предмет. Допуск к
реализации зависит от применимого readiness.

**Acceptance Criteria:**

1. **Дано** внутренняя прямоугольная комната `4000 × 3000 мм`, предмет
   `1000 × 500 мм` с поворотом `0°` и центр в `1000 мм` от левой и верхней
   стен. **Когда** пользователь располагает предмет в плане, **тогда** видит
   `500`, `2500`, `750` и `1750 мм` слева, справа, сверху и снизу. Линии
   идут вдоль X и Z из границы footprint до внутренней границы той же Room.
   Те же значения доступны по подписанным направлениям в панели.
2. **Дано** допустимая V1-комната с нишей, диагональю, проёмом или несколькими
   внутренними тайлами проекции. **Когда** пользователь перемещает предмет,
   задаёт точное положение или поворачивает его на `45°`, **тогда** начало
   линии следует повёрнутому габариту, конец остаётся на первой границе той
   же usable компоненты. Внутреннее ребро тайла и касание одной вершины при
   дальнейшем движении внутри комнаты пропускаются. Совпадение луча с
   отрезком границы даёт конец в начале совпадения, а проём останавливает
   измерение на границе комнаты. Смена комнаты обновляет все направления.
3. **Дано** черновик в контакте со стеной, **когда** его габарит касается
   грани или пересекает её, **тогда** касание показывает `0 мм`, а пересечение
   показывает действующий конфликт в направлении измерения. Сторона без
   надёжного пересечения скрыта. При неопределённом Room, устаревшей Revision
   или отвергнутом V1 void/nested ring (`AMBIGUOUS_BOUNDED_WALK`) направляющие
   отсутствуют. Поддержка топологии остаётся в рамках действующего V1.
4. **Дано** узкий экран, увеличение текста или изменение масштаба и
   панорамирование, **когда** пользователь двигает предмет, **тогда** значения
   вычисляются по `MeasurementFormatPolicy` и сохраняют физический смысл при
   изменении экранной проекции. При нехватке места числа доступны текстом в
   панели. Чтение значений доступно по запросу и по завершении шага ввода.
   Линии пропускают касания, касание предмета без черновика оставляет обычное
   действие «Измерить».
5. **Дано** активный черновик, **когда** пользователь отменяет или завершает
   правку, переходит в 3D или теряет актуальный черновик, **тогда** линии
   исчезают. Повторное открытие проекта и backup показывают сохранённый
   предмет без данных направляющих. При отмене количество Durable Revision
   и обе ветки истории совпадают с исходным состоянием. Дверь, окно, настенный
   предмет и Web/PWA используют действующие маршруты измерений.

**RED → GREEN и evidence.** Playwright MCP в мобильном viewport подписанного
TMA проверяет точные четыре значения, поворот, drag, два масштаба, смену комнаты,
контакт, конфликт и скрытие. Использовать принятые fixture для диагонали,
ниши и границ, а отвергнутые `TCC-A1-FACE-VOID-RING` и
`TCC-A1-FACE-NESTED-RING` проверять на штатный отказ производной Room и
отсутствие линий. Приёмка фиксирует видимый текст, загруженную сборку и reload/backup.
Изменение общего кода запускает применимую Web/PWA регрессию по FR-58.

**Связи.** CAP-2/5/6/13, FR-13/29/31/55/58/59, NFR-1/5/17–19/26/28,
AD-1/2/20/25/32, [UX FR-59](ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md).

### Story 10.17: Расставить условные предметы и сравнить цвета

Как человек, который планирует интерьер в Telegram, я хочу быстро выбрать
узнаваемую форму и цвет с точными габаритами, чтобы сравнить сочетания в 2D и 3D.

**Зависимости.** Использует размещение и сохранение из 10.6, 10.8–10.12.
Поддерживаемые старые файлы и readers проверяются по 10.4–10.5 и FR-57.
Приёмка пилота идёт после 10.16, каталог работает и при выключенных
направляющих или аналитике.

**Acceptance Criteria:**

1. **Дано** подготовленный TMA-редактор с закрытым `CatalogGatewayPort` и
   недоступной сетью, **когда** пользователь открывает «Предмет», **тогда**
   видит локальные формы для мебели, сантехники, техники, светильников и
   аксессуаров. Для каждой карточки доступны название, узнаваемый силуэт,
   целочисленные габариты в мм и штатный floor/wall anchor. Базовый набор
   опирается на текущие мебельные пресеты, включая стул и шкаф. Проверяемые
   примеры для остальных категорий — напольная ванна и стиральная машина,
   настенный светильник и зеркало. Допустимы эквивалентные формы с теми же
   категориями и покрытием привязок. Поиск находит подходящие формы,
   «Очистить поиск» возвращает полный каталог. Карточки используют собственный
   WebGL2-силуэт по контракту редактора, без SKU, фото и товарных моделей.
2. **Дано** локальные floor/wall пресеты, **когда** пользователь пытается
   разместить их на совместимой или несовместимой опоре, **тогда** подходящая
   опора даёт стабильный предпросмотр и обычное подтверждение, а неподходящая
   остаётся с объяснимым конфликтом без Durable изменения. План, карточка,
   3D-черновик и подтверждённый экземпляр выводят один габарит, форму и цвет
   из совместимых V1 параметров. Точный ввод размера сохраняет штатный
   параметрический и обратимый путь.
3. **Дано** размещённый условный предмет, **когда** пользователь выбирает
   именованный образец в свойствах и подтверждает цвет, **тогда** меняется
   только цвет. Образцы имеют текстовую подпись, выбранное состояние и подсказку
   о приблизительном экранном цвете. Отмена, Undo и Redo дают ожидаемые пары
   `colorVariantId` и `color`, включая контрольные пары `alpha-warm-wood` /
   `#a76a3b`, `alpha-blue` / `#416b91`. Reload и перенос сохраняют ту же пару,
   footprint, ориентацию и опору. Вариант вне допустимого V1 представления
   не публикуется. Если показан внешний цветовой код, рядом проверяемый
   источник и система.
4. **Дано** проект только с ранее размещёнными GLB и проект со смешанными
   экземплярами, **когда** пользователь открывает, изменяет и переносит их,
   **тогда** поддерживаемые текущие и старые readers сохраняют исходные
   привязки, ключи моделей, геометрию, V1 пары цветов и точные байты/hash.
   Действующие зарегистрированный и прежний `Portable Backup` сохраняют
   семантику при roundtrip. GLB в активной истории сохраняется при Undo/Redo.
   При извлечении или повреждении ресурса применяются штатные recovery и
   exact repair. Карточка условной модели не становится подменой GLB.
5. **Дано** активный Web/PWA и локальные данные, **когда** публикуется TMA
   каталог, **тогда** их собственный каталог, обычные defaults и совместимый
   импорт/экспорт продолжают работать по FR-58. Если выбранный пресет или
   оттенок невозможно представить в V1, он недоступен для новой постановки,
   а принятие отдельного изменения формата остаётся за владельцами источников.

**RED → GREEN и evidence.** Через Playwright MCP отработать поиск, несовместимую
опору и полный путь для покрытых категорий с минимум одним floor и wall
примером, при закрытом gateway и отключённой сети после подготовки. Проверить
один и тот же цвет и габарит на плане, в 3D, после Undo/Redo и reopen. Зафиксировать
roundtrip смешанного fixture текущим совместимым и применимым прежним readers,
а также восстановление действительно недостающего GLB. Доказательство
совместимости содержит проверки семантики и exact resource hashes.

**Связи.** CAP-5–7/10/13, FR-26–33/44/45/54/55/57/58/60,
NFR-1/3/10/13/21/26/28, AD-4/8/14/25/30/33,
[UX FR-60](ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md).

### Story 10.18: Оценить первый сеанс и управлять статистикой

Общий подсчёт по умолчанию включён. Им управляют до первого входа и из настроек. Повторные открытия требуют отдельного разрешения этой редакции. Первый разрешённый вход задаёт старт на устройстве, следующий проверенный вход может добавить один повтор. Перемонтирование входа не дублирует его. После отзыва новый допуск начинает счёт заново. Для обоих итогов проверить отказ, повреждённый выбор и отсутствие идентификатора или проекта в запросах и отчёте. Далее описан исторический пилот с SDK. [Обычная сборка](sprint-change-proposal-2026-11-22-public-candidate.md).

Как участник пилота Telegram, я хочу решать, передавать ли счётчику
обобщённые события и оценку, чтобы сообщить, насколько удобен редактор.

**Зависимости.** Проверенный Telegram-запуск и изоляция аккаунтов по 10.2–10.3,
доставка и rollback по 10.13–10.14, устойчивые Durable outcomes редактора.
10.16–10.17 дают единый сценарий пилота, на котором проверяется вся воронка.
Провайдер, отдельный HTTPS origin, минимальный egress, настройки retention и
приём тестового события подтверждаются до активации. Счётчик остаётся выключен,
пока эти условия не выполнены. Локальная проверка контракта отдельно
использует перехваты, а реальные события отправляют только в согласованном
тестовом сеансе.

**Acceptance Criteria:**

1. **Дано** первый проверенный запуск и настройки по умолчанию, **когда**
   пользователь открывает «Статистика и оценка», закрывает панель или оставляет
   статистику выключенной, **тогда** редактирование, сохранение и экспорт
   доступны, SDK, запросы, скрытые ресурсы и идентификаторы аналитики
   отсутствуют. То же проверяется для неподписанного запуска, прямого открытия
   документа аналитики, Web/PWA и неподтверждённой настройки.
2. **Дано** явное согласие в проверенном TMA, **когда** инициализируется
   статистика, **тогда** SDK работает только в статическом документе другого
   origin с версионированным каналом и заголовками по AD-34. Визит использует
   фиксированный безопасный URL и максимум один `tma_open` на проверенный
   запуск, включая повторный рендер, remount и новое согласие в пределах
   запуска. Атрибуция приходит только из проверенного allowlist
   `start_param`, с `direct` при отсутствии и `unknown` для неизвестного кода.
   Неактивный или несовместимый документ оставляет аналитику выключенной.
3. **Дано** подтверждённая настройка, **когда** пользователь завершает действия
   редактора, **тогда** четыре изменения Project (`project_created`,
   `room_created`, `item_placed`, `item_color_changed`) отправляются после
   Durable результата, `view_3d_opened` — после доступного 3D, `project_reopened` —
   после открытия. `editor_recovery_shown` и `editor_save_failed` возникают
   при переходе в состояние с утверждённым кодом и версией. Черновики, отмены,
   неуспешный publish, повторный рендер и события до согласия не создают
   цели завершения. Схема пропускает только `FR-61` и разрешённые скаляры.
4. **Дано** два контекста с общей настройкой, **когда** пользователь отзывает
   согласие, **тогда** предыдущее поколение прекращает отправку в обоих
   контекстах, закрывает документы и сбрасывает ожидающие события. Смена
   scope или завершение runtime закрывает его активный канал. Повторное
   согласие не воспроизводит очередь, смена writer lease не даёт согласия.
   Таймаут, блокировка, rollback с несовместимой парой или отсутствие сети
   оставляют редактор рабочим.
5. **Дано** завершённый первый сохранённый сценарий или явное «Оценить»,
   **когда** пользователь отвечает «Удалось собрать планировку?» и выбирает
   значение `1–5`, **тогда** только явное «Отправить» при согласии создаёт
   `feedback_rating` с булевым ответом и выбранной оценкой. `Пропустить` и
   Back ничего не записывают. Панель не перебивает правку и recovery.
   При выключенной статистике вариант согласия предлагается только после
   явной попытки отправить оценку. Текстовый отзыв следует отдельному пути.
6. **Дано** наблюдаемые сетевые запросы и кабинет владельца, **когда**
   проверяется активация, **тогда** доказаны отсутствие передачи Project,
   файла, названия, кадра, исходного error/stack, аккаунта, launch данных,
   реального URL и referrer, корректный CSP и фактический stop при отзыве.
   Вебвизор, формы, карты кликов, автоматические цели и остальные
   автоматические механизмы из AD-34 выключены. Команда фиксирует реально
   принятый контролируемый визит и цель в счётчике. Недоказанные поля,
   retention или прекращение передачи держат подключение выключенным.

**RED → GREEN и evidence.** Playwright MCP проверяет подписанный TMA и
изолированный документ с перехватом сетевых запросов и проверкой schema по
NFR-29. Позитивный сценарий покрывает одну явную сессию, разрешённые цели и
отзыв. Отказные сценарии включают неподтверждённую настройку, закрытую сеть,
смену scope, revoke в двух контекстах, прямой document URL, лишний параметр,
повторный монтаж и Web/PWA. Отдельно записываются совместимость при update и
rollback, реальные поля провайдера и факт приёма контрольного события.

**Связи.** CAP-9/13, FR-55/58/61, NFR-21/23/25/26/28/29, AD-25/26/28/34,
[UX FR-61](ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md).

#### Приёмка пилота Telegram

Пакет 10.16–10.18 подготовлен к независимой проверке готовности каждого среза.
Номер Story и наличие сценариев Playwright MCP фиксируют план проверки.
Физическая приёмка дополняет 10.15 и следует NFR-28. На каждом целевом
устройстве записываются сборка, ОС, версия Telegram, открытие и сохранение
плана, работа направляющих, цвет, 3D, повторное открытие и отказ от статистики.
Публикация приглашения опирается на результаты этой приёмки и решение о
допуске пилота. Подключение счётчика требует отдельного доказательства 10.18.

### Сверка покрытия Telegram — шаг 3

Связи указывают планируемые stories и будущие evidence, не выполненный PASS.
Уточнения TMA-05/14–16 подтверждены и внесены в соответствующие stories;
покрытие означает наличие планируемого пути и доказательства, не готовый результат.

| Требование | Stories | Источники | Будущее доказательство |
|---|---|---|---|
| TMA-01 общее ядро | 10.1–10.3, 10.13 | CAP-9/13; FR-55/58; NFR-26; AD-2/25 | boundary/import tests, одинаковая команда и две composition |
| TMA-02 отдельный entry | 10.1/10.2/10.13 | CAP-9/13; FR-55/58; NFR-16/28; AD-25/26 | SDK blocked, invalid host/timeout, два entry |
| TMA-03 worker/build isolation | 10.1/10.13/10.14 | CAP-9/13; FR-41/47/58; NFR-10/24; AD-11/25/28 | старый worker, offline/update, независимые outputs/cache |
| TMA-04 release compatibility | 10.2/10.13/10.14 | CAP-1/9/13; FR-47/58; NFR-12/24; AD-11/28 | shell/manifest mismatch без SW, migration/read-only, старый lazy client |
| TMA-05 editor parity | 10.2/10.6/10.8/10.9/10.15 | CAP-1–8/11/13; FR-1–2/4–19/21–23/25–33/38–40/55; NFR-1–4/26/28; AD-1–8/13/20–27 | одинаковые доменные результаты и фактический physical путь; явные parity AC и regression |
| TMA-06 theme/viewport/a11y | 10.6/10.7/10.15 | CAP-2/9/13; FR-55; NFR-16–20/28; AD-25/27 | 360 px/200%, keyboard/safe area, физические устройства |
| TMA-07 Back/Close/gestures | 10.6/10.7/10.15 | CAP-1/2/8/13; FR-39/55; NFR-3/17–20/28; AD-3/27 | state-priority matrix, stale projection, physical Back/swipe |
| TMA-08 lifecycle | 10.3/10.7/10.11/10.15 | CAP-1/5/8/13; FR-5/55/56; NFR-8/11/28; AD-4/26/27 | resume/fence/kill, WebGL fallback, physical lifecycle |
| TMA-09 network | 10.10/10.15 | CAP-6/9/13; FR-42/54/55; NFR-10/28; AD-14/27/28 | loss before/after per-mode readiness; PWA cold offline отдельно |
| TMA-10 scopes | 10.2/10.3/10.12/10.15 | CAP-1/8/13; FR-56; NFR-11/21/28; AD-4/26 | Все guards и полный S2 corpus commit/journal/exclusive pin cleanup до writable 10.2; общего GC нет; 10.3 расширяет A→B→A и physical isolation |
| TMA-11 storage/recovery | 10.3/10.11/10.12/10.15 | CAP-1/8/13; FR-5/38/43/56; NFR-3/11–13/28; AD-3/4/26 | quota, crash, exact repair, history roots, physical storage |
| TMA-12 двусторонний backup | 10.4/10.5/10.15 | CAP-1/10/13; FR-44/45/57; NFR-1/12/28; AD-29 | source-owner disposition, реальные файлы, оба направления, 0 мм/hash |
| TMA-13 handoff | 10.4/10.5/10.15 | CAP-1/10/13; FR-44/45/57; NFR-13/21/28; AD-29 | внешний файл/reselect на iOS и Android, cancel/oversize |
| TMA-14 identity/privacy | 10.2/10.3/10.15 | CAP-1/9/13; FR-55/56; NFR-21/23/28; AD-26 | signed vectors, no common fallback/upload/token/PII; negative permissions checks |
| TMA-15 каталог | 10.8–10.10/10.13/10.15 | CAP-6/7/13; FR-26–33/54/55; NFR-10/21/28; AD-14/17/24/28 | floor/wall exact bytes и reopen, outage, catalog route |
| TMA-16 диагностика/выпуск | 10.13–10.15 | CAP-9/11/13; FR-54/58; NFR-21/23–26/28; AD-17/25/28 | runbook, privacy-safe diagnostics, два release/rollback; diagnostics/privacy checks |

| Критерий | Stories и будущее доказательство | Источники |
|---|---|---|
| TMA-AC-01 | 10.1/10.13: browser/PWA без SDK, core regression | CAP-9/13; FR-55/58; NFR-26; AD-25 |
| TMA-AC-02 | 10.1/10.10/10.13: старый worker, offline и update | CAP-9/13; FR-41/42/47/58; NFR-10/12; AD-11/25 |
| TMA-AC-03 | 10.2/10.6/10.8/10.9/10.15: полный путь на iOS/Android | CAP-1–6/13; FR-55; NFR-28; AD-25/27 |
| TMA-AC-04 | 10.6/10.7/10.15: viewport/keyboard/Back/swipe на клиентах | CAP-2/9/13; FR-55; NFR-17–20/28; AD-27 |
| TMA-AC-05 | 10.10/10.15: offline до/после readiness | CAP-9/13; FR-55; NFR-10/28; AD-27 |
| TMA-AC-06 | 10.7/10.11/10.12: crash/failure/fence и сохранный Durable | CAP-1/8/13; FR-5/55; NFR-3/11–13; AD-3/4/27 |
| TMA-AC-07 | 10.2: scope Web Lock, atomic fence/receipt и commit/journal/exclusive cleanup corpus до записи; 10.3/10.12/10.15: дополнительные A→B→A и physical isolation | CAP-1/8/13; FR-56; NFR-11/21/28; AD-26 |
| TMA-AC-08 | 10.4/10.5/10.15: реальные файлы в обе стороны, 0 мм/hash/new ID | CAP-10/13; FR-57; NFR-1/28; AD-29 |
| TMA-AC-09 | 10.4/10.5/10.15: внешний reselect на iOS и Android | CAP-10/13; FR-57; NFR-21/28; AD-29 |
| TMA-AC-10 | 10.2–10.5/10.8/10.13/10.15: нет upload/token/initData logs | CAP-9/10/13; FR-56/57; NFR-21/23; AD-17/26/29 |
| TMA-AC-11 | 10.1/10.13/10.14: изоляция build/worker/manifest/assets | CAP-9/13; FR-41/47/58; NFR-24/26; AD-25/28 |
| TMA-AC-12 | 10.1–10.15: RED/GREEN, required mutation и regression evidence | CAP-1–11/13; FR-55–58; NFR-26; AD-12/25–29 |
| TMA-AC-13 | 10.15: actual evidence/runbook, fake не physical | CAP-9/13; FR-55–58; NFR-28; AD-25–29 |

**Проверка зависимостей (дополнена после readiness):** writable 10.2 содержит
все обязательные AD-26 guards и evidence без forward dependency на 10.3.
10.4–10.5 используют зарегистрированный source-owned contract и проверяют
совместимость/rollout в реализации; 10.6–10.14 не получают зависимости от них только из-за номера. 10.15 собирает
локальные результаты, но полная transfer acceptance отдельно требует 10.4–10.5.
Всем implementation paths предшествуют approved planning package и применимый
READY либо waiver. Licensing conflict разрешён владельцем; техническая resource
policy сохраняется. Реальный bot/HTTPS, physical isolation и NFR-28,
внешний handoff и production release остаются pending. Этот workflow не
назначает retirement implementation story и не объявляет Telegram READY.

### Финальная документная проверка Telegram S0 — 2026-11-04

- **FR/NFR/UX:** исторические Epic 1–9 и FR-1–54 сохранены; FR-55–58,
  NFR-28 и UX-TMA-01–12 связаны с Epic 10 и планируемыми проверками. Retired и
  Alpha+ IDs не переиспользованы. Покрытие — план, не подтверждение выполнения.
- **Stories и архитектура:** 10.1–10.15 имеют actor/trigger/outcome, production
  path, минимальную ценность, один implementation owner, проверяемые AC,
  RED→GREEN, required mutation и regression. Проверены TMA-01–16 и TMA-AC-01–13.
  Отдельный root starter не создаётся: существующий root уже реализован; новые
  stores/обязанности привязаны к использующим их slices и AD-25–29.
- **Зависимости:** после readiness-коррекции устранена выявленная forward
  dependency 10.2 на обязательные guards 10.3; документное описание проверено,
  реализация и независимый readiness recheck ещё не выполнялись на тот момент.
  Последующая регистрация S3 и актуальный статус приведены ниже; 10.6–10.14 не зависят от неё
  по номеру. 10.15 отделяет local evidence от полной physical/transfer acceptance.
- **Организация:** один Epic дополнения избегает необоснованного разделения общих
  host/editor/runtime поверхностей; S1–S7 обеспечивают отдельные пользовательские
  результаты и разрешают независимое движение там, где зависимости сняты.
- **Открыто:** approved planning package и применимый READY/waiver до кода;
  S3 evidence/rollout (прежний licensing conflict разрешён владельцем);
  bot/origins, signed identity и client isolation, physical iOS/Android,
  двусторонний внешний файл, production release и owner check — pending.
  Отдельный retirement gate не превращён в implementation story.
- **Фактически проверено:** структура 15 stories, 16 строк TMA, 13 строк TMA-AC,
  12 UX identifiers и S0–S7, локальные файловые ссылки roadmap и матрицы. Код,
  application tests, build, mutation, physical Telegram и release в этом workflow
  не выполнялись; действующий preview не изменялся.

Эта проверка документа не является implementation-readiness verdict, owner
approval planning package или физической приёмкой Telegram.


### Коррекция sequencing S2 после readiness review — 2026-11-04

[Readiness report](implementation-readiness-report-2026-11-04.md#epic-quality-review)
выявил скрытую зависимость первой writable Story 10.2 от защит, ранее явно
проверявшихся только в 10.3. Все обязательные AD-26 scope/generation, serialized
barrier, teardown, commit/journal и exclusive pin cleanup, writer fence и controlled race tests теперь
являются входными условиями первого writable publish и завершения 10.2. 10.3
расширяет A→B→A/edge и physical-release evidence, не является запоздалым местом
поставки защиты. Это коррекция планирования, не реализация и не новая readiness
оценка; S3 evidence gates сохраняются, прежний licensing conflict позднее разрешён
владельцем. PRD owner согласовал
FR-16/REL-05 и FR-9/REL-08; SPEC-owner подтвердил reconciliation в CAP-2/3.
Project-context отдельно упоминает type/height, но общая фраза о metadata требует
уточнения; далее требуется применимый readiness recheck.


### Source-owner S2/S3 remediation — исторический снимок до обновления SPEC

SPEC-owner подтвердил принятие [полного S2 fencing disposition](architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md)
в companions: правила и весь race corpus обязательны в 10.2 до первой writable
операции. 10.3 — расширение, не поздняя поставка защиты. Telegram не вызывает
browser bulk `recover()`; общего GC baseline нет, S2 его не создаёт, exclusive
pin cleanup/reconcile тестируются, неопределённые bytes и roots сохраняются.
Прежние упоминания планового «scope-wide GC» в исторических записях выше не
означают существования или необходимости такого GC в S2. Standalone identity
validator и session queue — частичный прогресс, не runtime/storage и не S2 PASS.

На момент этой записи AD-30 ещё не был зарегистрирован SPEC; теперь он
зарегистрирован, актуальный статус приведён ниже. Тогда S3 ожидал регистрации: см. Story 10.4 об ambiguous empty V1, -0,
строгой полной grammar, проверке сохранённого старого recovery → нового exact
export и адресном owner-решении для единственной неоднозначной копии без пути.
Документный update не меняет PPJ registry, существующие данные или verdict.


### Актуальная синхронизация AD-26/AD-30 после регистрации SPEC

**S2:** Story 10.2 требует до первой writable операции единый scoped IDB v2,
atomic v1 upgrade с сохранением identity/protocolVersion/counter, scope Web Lock,
strict durability обычных writes, атомарные prepared/published/no-publish,
fence/stage/receipt/pin и exact owned-history pointer transition без Revision
overwrite. Все source-owned race и recovery cases выполняются в реализации до
первой записи; Story 10.3 расширяет cross-context/physical проверки. Browser
bulk recover не используется, общий GC не добавляется. Bounded v2/queue native
26/26 и unit 2072/2072 зафиксированы в отдельных логах S2; product entry не
подключён, полный protocol и Story 10.2 ещё не DONE.

**S3:** SPEC зарегистрировал три маршрута: неизменный PPJ-A1, runtime-v1-wire
с точными -0/UTF-16/own-undefined и conservative V1-legacy с обязательным
PPJ-disjoint witness. Истории 10.4–10.5 и build/file matrix выше используют
source-owned closed grammar. Реализацию и исполняемый worst-case proof можно
проводить после применимого implementation gate; отсутствующее code evidence не
является само по себе предварительным решением владельца. Замена старого
export/recovery и заявленная совместимость ждут полного proof, конкретных
build/files и соответствующей physical acceptance. Если sole-copy без witness не
имеет доказанного recovery path, Product Owner адресно решает условный FR-57 case.
Новых READY, physical PASS, human approval, удаления Web/PWA или upload нет.


### Решение владельца о catalog admission — 2026-11-04

Владелец сохранил правило PRD/SPEC/AD-14 и обновил AGENTS: он отбирает только
бесплатные или созданные им модели вне приложения. Формальный AssetUsageGrant,
licensing/provenance/declaration/attribution/notice admission не является Alpha
gate. Прежние упоминания открытого конфликта в исторических отчётах относятся
к состоянию до этого решения. Format/size/hash/security validation, exact-byte
pin, BackupFeasibilityPolicy, fencing, сохранность history roots и запрет upload
Projects/files сохраняются. Решение не является physical acceptance или READY.


### AD-31: scoped browser registered ingress — source reconciliation 2026-11-05

Новый дополнительный browser storage относится только к явно выбранному
registered-transfer import. [Story 10.5](#story-105-вернуть-telegram-project-во-внешнюю-копию-webpwa)
описывает полный путь и обязательный local corpus одним implementation owner;
Story 10.4 сохраняет отдельный зарегистрированный export и прежний FR-44 backup.
Прежняя история/DB не мигрируется, старый независимый history/fencing risk не
считается исправленным. Project address принадлежит trusted composition как
`(namespace, raw ProjectId)`, не файлу и не Telegram identity. Source ID и новый
raw ID всегда различны, кандидат проверяется по двум известным stores, destination
атомарно защищает create; позднее совпадение двух независимых stores разрешается
раздельной маршрутизацией, не ложной глобальной атомарностью.

Применимый readiness report 2026-11-05 зафиксировал LOCAL READY для AD-31
implementation scope, включая directory, все команды/history/resources/export/
repair, pending/reselection, обе partial-failure ветви и неизменный old-PWA
corpus. Фактические tests выполняются после разрешения implementation и до
включения пользовательского маршрута должны быть пройдены. Этот документный
handoff не является новым verdict, release READY или physical Telegram PASS.

## Приёмка мобильного редактора, 22 ноября

- Stories 3.2, 10.6, 10.7, 10.18. Единый заголовок, предсказуемое закрытие,
  доступный фокус и неизменные правила согласия. Владелец комнаты управляет её
  типом и высотой. CAP-3/13 · FR-16/55/61 · NFR-15/17–21/28/29 · AD-27/34.
- Stories 5.2, 5.4, 10.16, 10.17. Изменить один зазор в мм, пересчитать
  остальные, сохранить черновик при ошибке и при переходе между видами.
  Управление цветом и выбор прежнего wall item в 3D.
  CAP-2/5/6/7/13 · FR-13/29/31/55/59/60 · NFR-1/15/17–20/26 · AD-3/32/33.
- Stories 5.4, 10.6, 10.7. Контур доступен в обоих видах. Второй контакт
  возвращает позицию и угол до первого и передаёт управление плану.
  CAP-2/5/6/8/13 · FR-21/23/29/55 · NFR-15/17–20 · AD-23/27.
- Stories 5.4, 8.8, 8.9, 10.15. Точный угол проходит подготовку отдельно
  до включения записи. CAP-5/6/8/10/13 · FR-22/29/44/45/57/58 ·
  NFR-1–4/10–13/26/28 · AD-3/4/23/28–31.

[Согласованные критерии и порядок проверки](sprint-change-proposal-2026-11-22-mobile-editor-finish.md).

### Точный угол и совместимый выпуск

AD-35 привязывает критерии Stories 5.4, 8.8, 8.9 и 10.15 к трём проверяемым
результатам. Точный физический pose сохраняется после обычных команд.
Файл с новым selector проходит полное восстановление с exact resources.
Клиент предыдущего выпуска с открытой IDB 2 прекращает запись при переходе
на 3, а переход с C на B сохраняет возможность чтения, работы и экспорта
без преобразования угла. Кандидат C активируется после прохождения этих
проверок и запуска B как действующей версии.
