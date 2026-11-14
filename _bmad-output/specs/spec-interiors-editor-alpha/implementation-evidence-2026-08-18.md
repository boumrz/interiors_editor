# Подтверждённая реализация — checkpoint 2026-08-18

Статус: **observed implementation evidence**. Этот документ фиксирует
реализованный и проверенный Product Owner путь. Он не изменяет границу Alpha,
не заменяет требования PRD/SPEC и не является PASS какого-либо release gate.

> **Scope correction, 2026-08-25.** Доказательства, относящиеся к назначению
> покрытий пола/стен, независимому дублированию Project или PNG-выгрузке,
> являются историческими: Product Owner исключил эти возможности из Alpha.

## Что подтверждено

Product Owner выполнил функциональную проверку текущего editor/import/catalog
flow на физическом телефоне. Подтверждение относится к работоспособности
текущего пути, а не к полной device/performance certification. В частности,
визуальный дизайн и визуальный UX Product Owner считает неприемлемыми и
**откладывает их переработку**; визуальная приёмка этим checkpoint не дана.

Browser evidence на текущем checkpoint: `lint`, `typecheck`, production build,
full web suite (`1080` tests), 89 mobile-browser E2E и 3 production-PWA E2E
— green.

## Реализованный функциональный инкремент

| Наблюдаемый путь | Трассировка | Статус доказательства и граница |
| --- | --- | --- |
| Phone-first 2D/3D editor и интеракции продолжают работать на физическом устройстве. | `CAP-2`, `CAP-3`, `CAP-5`; `FR-6`–`FR-25`; `AD-1`–`AD-5`, `AD-20`–`AD-23` | Функциональный smoke подтверждён владельцем. Это не закрывает corpus, независимую приёмку или `NFR-15`. |
| Direct self-contained GLB проходит локальный bounded preflight, изолированный preview и пользовательское подтверждение перед локальной регистрацией. | `CAP-12` (Alpha+); `FR-48`–`FR-52`; `NFR-22`; `AD-9` | Реализация есть и проверена как путь использования. Полный hostile corpus, thermal/memory, cancel/recovery и self-contained backup evidence ещё открыты. |
| Один статический FBX или ZIP с допустимыми sidecar-текстурами локально конвертируется в GLB; texture aliasing и смена состава custom GLB вызывают rebuild disposable 3D scene. Это устраняет известные чёрные модели/протекание ресурсов в проверенных fixtures. | Proposed `IMP-01`–`IMP-03`; `G-IMP-UX`; `AD-9`, `AD-10` | Это **experimental scope change**, а не реализация принятого `CAP-12`: действующий контракт принимает только self-contained GLB. FBX/ZIP не повышается в Alpha/Alpha+ контракт без решения владельца, PRD → SPEC → Architecture → UX reconciliation и полного gate. |
| Подтверждённый импорт регистрирует exact GLB и metadata в общем device-local разделе «Кастомное» с renderer-derived preview. Карточка переживает reload и может быть выбрана в другом local Project; только подтверждённая постановка добавляет definition/reference в этот Project. При открытии здорового legacy Project его верифицированные project-owned custom definitions также промотируются в общую library без новой Project Revision. | Proposed `IMP-04`; `CAP-6`, `CAP-10`, `CAP-12`; `FR-28`, `FR-52`; `AD-4`, `AD-8`, `AD-9` | Browser E2E импортирует GLB, отменяет постановку, перезагружает app, создаёт второй Project и ставит ту же card с preview. Отдельный E2E очищает library, открывает legacy Project и подтверждает восстановление card для следующего Project. Это не доказывает полную переносимость, GC/delete policy или complete Portable Backup. |
| Shared «Кастомное» проверяет bytes локального resource до preview или placement тем же static-GLB preflight и SHA-256 address. Missing, malformed либо hash-mismatched resource остаётся видимой disabled card с явным повторным import исходного GLB; exact re-import возвращает ready card без Project Revision. Late local hydration не удаляет только что зарегистрированную card, а поздний import не может заменить более новый выбор. | Partial `IMP-04`; `CAP-1`, `CAP-6`, `CAP-12`; `FR-28`, `FR-43`, `FR-52`; `AD-8`, `AD-9` | Browser E2E удаляет library-only resource, подтверждает отсутствие preview/placement и неизменную Project Revision, затем exact re-import восстанавливает preview. Тот же E2E проверяет malformed bytes и valid-container hash mismatch без preview, а direct exact re-import в уже использующий ресурс Project повторно ставит предмет через исходное definition. Это не ResourceRecoveryRequired для durable Project и не Portable Backup/GC policy. |
| При открытии Durable Project проверяются `byteLength` и SHA-256 каждого pinned custom-GLB resource в локальном store. Отсутствие либо несовпадение bytes переводит Project в `recovery-needed`, writer недоступен, а модель не подменяется greybox-ом. Для нескольких unresolved resources пользователь выбирает только отсутствующий/повреждённый exact set; already-healthy bytes не перезаписываются. Controller допускает exact one-to-one hashes, IndexedDB записывает их одним `readwrite` transaction и повторно открывает ту же Project card. Legacy один-файл путь fail-closed при нескольких unresolved hashes. | Partial `IMP-02`, `V-16`; `CAP-1`, `CAP-9`; `FR-43`, `FR-47`; `AD-9`, `AD-10` | RED→GREEN unit evidence покрывает two-resource batch, incomplete/duplicate/unexpected selection, only-unresolved selection, same-card directory reopen, storage failure, byte-copy boundary, one-resource compatibility и no partial legacy write. Отдельный adapter test доказывает один transaction; targeted iPhone E2E подтверждает recovery surface. На checkpoint зелёные 1,056 web unit tests, typecheck/lint/build; controller mutation 135 killed / 27 survived (83%, порог 80%). |
| Если exact GLB недоступен навсегда, current V1 `recovery-needed` показывает число затронутых definitions/instances и требует отдельного подтверждения удаления **всех** unresolved refs. Один candidate удаляет matching definitions и dependent instances, не удаляет blob, публикуется через exact-base fenced/CAS revision, очищает session boundary и возвращает writable editor только после успешного integrity reopen. | Bounded current-Project part of `RecoveryChangeSet`; `CAP-1`, `CAP-8`, `CAP-9`; `FR-38`, `FR-43`, `FR-47`; `NFR-11`–`NFR-13`; `AD-9`, `AD-10` | Targeted 66 tests, full 1,070 tests, typecheck/lint/build и iPhone 13 emulation `PROJECT-E2E-04D` зелёные. Focused mutation: 91 killed / 20 survived (81.98%, порог 80%). Проверены malformed links, unchanged hash-set, CAS/persist failure, local repair/delete exclusion и failed reopen. Это **не** history/`Both` recovery, `DiscardSessionHistory`, backup/GC или межконтекстная атомарность shared resource store; semantic GLB decode validation также остаётся отдельным work item. |
| **Историческое, retired 2026-08-25:** в общем списке Projects у durable V1 card была операция «Дублировать». | Бывший `V-13`; `FR-3` retired. | Доказательство сохранено только как историческая запись. Операция, её API, UI и тестовые сценарии удалены; независимые варианты проекта не входят в Alpha. |
| Isolated custom-GLB preview и 3D-сцена используют один local-only GLTF runtime loader: один и тот же root проходит finite-bounds admission и canvas-backed texture materialization до того, как им владеет renderer. Общий source у нескольких Three textures копируется один раз и закрывается только после назначения всем aliases. Decode/materialization failure не передаёт root в WebGL и не вызывает greybox substitute; ожидание local verification отображается как 3D loading state, terminal unavailable — только после завершённой verification. | Partial runtime hardening `IMP-02`; `CAP-12`, `FR-48`–`FR-52`; `AD-9`, `AD-10` | RED→GREEN unit coverage включает valid/empty/malformed/defaultless root, materialization failure, shared image aliases, ready/loading/unavailable status; `PROJECT-E2E-04G` подтверждает custom renderer route. На этой ревизии зелёные lint, typecheck, production build, 1,049 unit tests, 84 mobile-browser E2E и 3 production-PWA E2E. Это не device pixel acceptance, не real context-loss proof и не complete backup/reopen roundtrip. |
| Восемь bundled GLB отображаются в локальном предзагруженном каталоге с renderer-derived thumbnail. При первом запросе полные bytes загружаются и постановка, нажатая во время загрузки, ожидает ресурс и запускается автоматически. | Partial `CAP-6`; `FR-26`–`FR-28`; `AD-8`, `AD-14` | Это local **candidate catalog**, а не Alpha CatalogAsset. Для каждого ресурса отсутствует зафиксированный human-approved `AssetUsageGrant`, versioned catalog/provenance bundle и notices; поэтому он не может считаться compliant Alpha catalog placement. |

## Чего этот checkpoint не утверждает

- Нет PASS `NFR-15`: нужны восемь physical contexts, cold/warm starts,
  RS-2 interaction traces, thermal run, frame/main-thread measurements,
  WebGL context-loss recovery и manual Focus rows.
- Нет visual/UX acceptance и нет утверждения выполнения `NFR-17`–`NFR-20`;
  это сознательно отложенный отдельный поток работы.
- Нет `AssetUsageGrant` / provenance admission для bundled third-party моделей
  по `CAP-6`, `FR-28` и `AD-14`.
- Нет основания утверждать full `FR-44`–`FR-45`, `CAP-10` либо окончательную
  lifecycle policy импортированных ресурсов.
- Нет независимого acceptance review и ни одна story этим документом не
  переводится в `done`.

## Операционная оценка покрытия

После синхронизации tracker на 2026-08-18 в нём 47 историй: 12 `backlog`, 25
`in-progress`, 10 `review`, 0 `done`. Для одной прозрачной рабочей оценки
используется вес `0% / 50% / 80% / 100%` соответственно:

```text
(12 × 0 + 25 × 0.5 + 10 × 0.8 + 0 × 1) / 47 = 43.6%
```

Это означает **примерно 44% реализации roadmap**, не 44% готовности к
выпуску. Формальная Alpha release readiness остаётся `0%`: ни одна story не
`done`, а release gates выше не пройдены.

## Ближайшие не-визуальные гейты

1. Оформить owner decision для FBX/ZIP: оставить experimental local route либо
   принять scope change с ограниченным преобразованием в GLB.
2. Для кандидатского bundled catalog собрать provenance, `AssetUsageGrant` и
   `CatalogVersion` bundle либо вернуть assets к явно procedural-only статусу.
3. После закрытия документированной зависимости `V-12` завершить оставшиеся
   AC `V-13`: compare walkthrough, независимый review и physical acceptance;
   не объявлять feature `done`
   только по текущей foundation.
4. Расширить current-Project deletion RecoveryChangeSet до history/`Both`
   recovery, explicit history discard и self-contained backup/reopen roundtrip;
   отдельно определить shared-store lease и semantic GLB validation, затем
   выполнить device/performance protocol.

Визуальная переработка намеренно не включена в эти ближайшие шаги по текущему
направлению Product Owner.
