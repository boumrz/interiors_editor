---
document_title: "Sprint Change Proposal — перенос, каталог и прямое редактирование"
status: approved-direction
date: 2026-08-15
owner: Roman
sources:
  - specs/spec-interiors-editor-alpha/SPEC.md
  - planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
---

# Sprint Change Proposal — перенос, каталог и прямое редактирование

## Решение Product Owner

Пользовательский проект остаётся local-first: передача между устройствами не
требует аккаунта, сервера или облачной базы. Каталог и покрытия становятся
понятной частью редактора, а точные размеры стены и проёма редактируются на
самом плане, не в перекрывающем диалоге.

House Flipper и Planoplan используются только как публичные UX-референсы:
категорийный «планшет» каталога, крупные превью, поиск, варианты и материалы.
Их бренды, интерфейс, текстуры, модели и другие ассеты не копируются и не
извлекаются. В продукт могут попасть только собственные, сгенерированные либо
явно лицензированные ресурсы с подтверждённым происхождением.

## Scope и границы

| Направление | Решение | Граница |
| --- | --- | --- |
| Перенос проекта | `Interiors Project JSON v1` для текущих локальных, безресурсных проектов: schema/version, canonical project JSON и SHA-256. Импорт валидируется до публикации и всегда создаёт новый `Project ID`. | Не заменяет full Portable Backup из CAP-10. Если в проекте появятся собственные или catalog ресурсы, экспорт обязан перейти на self-contained `.interiors`, включающий exact bytes, manifest и notices. |
| Модели из Blender/Maya | Стандартный путь Alpha+ — self-contained GLB. По явному решению Product Owner FBX становится **экспериментальным локальным входом**: выбранный статический FBX конвертируется в Worker в GLB и проходит тот же preflight. | Нельзя помещать FBX напрямую в renderer/Project. До завершения конвертер-spike принимается только GLB; FBX с внешними текстурами, animation/skin/camera/light или превышением лимитов отклоняется без мутации. |
| Каталог | Canvas-first библиотека: desktop — закреплённая левая панель, телефон — отдельный sheet; поиск и категории всегда видимы, карточка выбирается до явного «Разместить на плане». Реальные карточки рендерятся из той же разрешённой модели, что появится в 3D. | Curated/model/material catalog получает реальные ресурсы только после `AssetUsageGrant`, exact-byte pin и `BackupFeasibilityPolicy`; изображения сайта или игровые ассеты не считаются ресурсами каталога. |
| Покрытия | Отдельные свойства `floor`, `ceiling`, `wall side`; сначала безопасные локальные варианты, затем лицензированные текстуры/материалы. | Нельзя превращать текстуру в ссылку из кэша: каждое durable назначение должно быть offline/backup-ready. |
| UI редактора | Единый mobile component contract: canvas-first, один активный overlay, inline dimensions на плане с ✓/×, bottom sheet — только для вторичных свойств. | Никакая временная панель не изменяет Project, не скрывает критические действия и не перехватывает события холста. |

## Порядок реализации

1. **8.8/8.9 foundation — перенос без ресурсов.** Строгий JSON ingress,
   checksum, file download/selection, fresh Project/Revision IDs, staging and
   atomic publication. Existing project never overwrites. Ошибка импорта не
   меняет directory, current project или history.
2. **5.1 UX refresh — каталог.** Закреплённая/адаптивная библиотека,
   sticky search/category, select → explicit placement, empty/offline/error
   states и не перекрывающий editor flow. До реальных ресурсов используются
   честные placeholder preview; затем единые собственные thumbnail render из
   разрешённых моделей.
3. **9.1–9.3 resource foundation — GLB.** `AssetBlobStorePort`, hash pin,
   source/license/notice manifest, static self-contained GLB preflight,
   isolated preview and renderer projection. Начальный curated pack — только
   с документированным grant; кандидат для semi-realistic furniture — CC0
   Poly Haven, со своими сгенерированными thumbnail.
4. **9.4 experimental FBX ingress spike.** Bounded Worker conversion
   FBX → normalized GLB, cancellation/deadline, hostile-corpus evidence and
   exact source/runtime backup entries. UI предлагает FBX лишь после
   успешного browser/physical-memory proof; экспорт Blender/Maya в GLB
   остаётся рекомендуемым путём.
5. **6.2–6.5 foundation — surfaces.** Surface address and durable local variant
   route; затем resource pin/grant/manifest route для текстур и материалов.
6. **2.5/3.3 direct edit.** Размерные annotations на 2D плане становятся
   интерактивными: tap → field with `мм` → ✓ применяет одну валидированную
   command, × возвращает durable value. Длина, толщина стены, ширина и offset
   проёма получают одну и ту же validation/persistence path.

## Acceptance criteria для первого среза

- Пользователь скачивает `.interiors.json`, передаёт файл без сети и импортирует
  его на другом устройстве.
- File parser ограничен по размеру и глубине, принимает только versioned,
  canonical документ с совпадающим SHA-256 и строго проверенной V1 моделью.
- Импорт публикуется как отдельный project card с новым ID; источник и все
  существующие проекты остаются нетронутыми при success, cancel или reject.
- JSON экспорт не обещает перенести будущие модели/текстуры. При появлении
  resource reference UI объясняет необходимость self-contained Portable Backup,
  а не экспортирует битый/неполный проект.
- Файлы проекта не уходят в Catalog Control Plane или какой-либо иной backend.

## Изменения roadmap

- Epic 8.8 и 8.9 переходят от backlog к implementation foundation после
  успешного TDD-среза, но не могут быть отмечены `done` до полной
  self-contained resource/manifest/notice семантики CAP-10.
- Epic 5.1 и 6.2–6.5 получают UX и domain foundation, но реальный сторонний
  каталог не обходит V-12: provenance, grants, pinned bytes и backup policy.
- Epic 9 остаётся Alpha+ и начинает только GLB route. Прямой FBX импорт не
  добавляется в Alpha без отдельного Product/Architecture decision.

## Риски и контроль

- **Повреждённый или чужой JSON:** bounded raw-byte ingress, closed schema,
  canonical comparison, checksum and publish-as-new only.
- **Потеря моделей при передаче:** JSON без resources честно ограничен;
  resource-bearing project требует `.interiors` bundle.
- **Нелицензированный контент:** no asset extraction; provenance/grant gate
  before every bundled catalog/custom runtime resource.
- **Небезопасный FBX:** один выбранный байтовый поток обрабатывается в
  отменяемом Worker с жёстким budget; external texture path, animation и
  неподдерживаемая scene content не обходят GLB preflight и не оставляют
  staging resource после reject/cancel.
- **Перегруженный телефонный UI:** canvas remains the primary surface; catalog
  owns a single full-screen browsing state, dimensions use local inline edit,
  and overlays neither stack nor pass pointer input through.

## Evidence первого FBX ingress-подсреза — 2026-08-15

В production source добавлен пользовательский, но **недолговечный** route
конвертации: в разделе «Предметы интерьера» пользователь выбирает binary FBX,
отдельный отменяемый Worker локально делает `FBX → GLB`, а UI предлагает
скачать получившийся `.glb`. Конвертация не добавляет ресурс в Project,
каталог или renderer, поэтому её отмена, ошибка и закрытие каталога не создают
revision/staging state.

Admission boundary проверяет точную magic-подпись и allowlist версий
`7100–7800`; текстовый FBX и неизвестные версии отбрасываются до parser.
Практический телефонный budget — предупреждение после `8 MiB`, жёсткий лимит
`12 MiB` и для входного FBX, и для GLB-результата, плюс deadline `15 s`.
Worker запрещает внешние URI, animation, skin/morph targets, camera/light и
texture maps; он принимает только статичную не-текстурированную mesh-сцену.
Все rejects имеют стабильные причины и не дают неполный файл для скачивания.
Граница покрыта TDD, включая точные границы input/output budget, а реальный
browser smoke test конвертирует статичный FBX и скачивает GLB.

Это не заменяет CustomAssetDefinition, pin/manifest/backup и постановку
пользовательской модели в план. Следующий вертикальный slice — GLB resource
foundation из 9.1–9.3; лишь после него результат можно честно назвать
«импортированной в проект моделью».
