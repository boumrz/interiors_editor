---
document_title: "Sprint Change Proposal — надёжный custom import и mobile UX remediation"
status: proposed
date: 2026-08-16
owner: Roman
mode: batch
sources:
  - specs/spec-interiors-editor-alpha/SPEC.md
  - specs/spec-interiors-editor-alpha/asset-import-contract.md
  - planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - planning-artifacts/roadmap-to-alpha.md
  - implementation-artifacts/sprint-status.yaml
evidence:
  - "2026-08-16: Product Owner observed a black model after importing a ZIP containing FBX and texture files on a phone."
  - "2026-08-16: Product Owner observed that importing the equivalent GLB renders the new model correctly and changes the earlier model's texture appearance."
  - "2026-08-16: tunnel check at 393×852 and 320×568 reproduced cramped catalog composition; this is browser-emulation evidence, not physical-device certification."
---

# Sprint Change Proposal — надёжный custom import и mobile UX remediation

## 1. Суть изменения

### Подтверждённая проблема

На телефоне импорт ZIP с одним `.fbx` и его текстурами даёт чёрную модель.
Когда затем импортируется тот же предмет в `.glb`, новая модель отображается
нормально, а у уже добавленной модели неожиданно появляются текстуры. Это
нарушает базовую изоляцию ресурсов: результат одного импорта не должен менять
визуальный результат другого.

Параллельно редактор и каталог не проходят минимальную мобильную usability
проверку: панели перекрываются, часть содержимого попадает за границы без
доступного пути прокрутки, а рабочая область остаётся слишком маленькой.
В туннеле `https://precise-working-laptops-flush.trycloudflare.com/` это
видно уже синтетически: на `393×852` вкладки каталога обрезаются, на `320×568`
две import-панели и sticky-панель постановки почти вытесняют карточки. У
`catalogDialog` фиксированная grid-разметка и `overflow: hidden`; у большого
review импорта нет собственного предсказуемого scroll owner.

### Классификация

- `technical limitation / failed approach` — текстурный FBX route и lifecycle
  Three-ресурсов недоказаны;
- `misunderstanding of requirement` — текущий flow смешивает «импортировать»,
  «немедленно поставить в текущий проект» и «добавить в общий каталог»;
- `mobile UX blocker` — текущая композиция не гарантирует usable viewport.

Exact private fixtures получены 2026-08-16: ZIP содержит один binary FBX и
четыре image sidecar, а equivalent GLB — четыре embedded images. Isolated
import preview этого ZIP показывает textures, поэтому «не найден texture
sidecar» больше не является допустимой гипотезой root cause. Зафиксирован
конкретный lifecycle defect 3D renderer: после первой parsed custom GLB он не
rebuild-ил disposable Three scene при добавлении следующей custom GLB. Это
объясняет часть A→B-симптома, но ещё не заменяет обязательную проверку
physical phone, reopen и context-loss для обоих exact файлов.

## 2. Что уже сделано и почему этого недостаточно

| Наблюдаемая работа | Фактический статус | Почему не закрывает проблему |
| --- | --- | --- |
| Story 5.1: локальный каталог, категории, поиск и procedural preview | `in-progress` | В карточках только offline parametric placeholders; нет durable общего раздела «Кастомное». |
| Прямой GLB route в туннеле | реализован вне текущего статуса Epic 9 | Есть preflight, preview и постановка, но Epic 9 всё ещё `backlog`; нет требуемых S-5/hostile-device/backup доказательств. |
| FBX/ZIP → GLB Worker route | реализован как эксперимент | Нельзя считать production contract: current `asset-import-contract.md` принимает только self-contained GLB, а предыдущий proposal разрешал FBX лишь как ограниченный эксперимент. Телефонное наблюдение доказывает, что route не готов. |
| Mobile catalog sheet | `in-progress` | Один экран одновременно показывает два importer-а, browse-каталог, tabs, grid и sticky placement. При расширенном import review grid может схлопнуться, а форма не получает гарантированный scroll path. |

Сейчас implementation опережает канонический roadmap: наличие UI, теста или
туннеля не переводит P-01…P-03 либо Story 9.* в `done`.

## 3. Конфликт с каноническими артефактами

| Владелец | Текущее правило | Необходимая корректировка после approval |
| --- | --- | --- |
| SPEC / `CAP-12` | Alpha+ принимает только self-contained GLB. | Решить, остаётся ли import Alpha+ или повышается до Alpha; описать ровно ограниченный FBX/ZIP ingress, если он становится обязательным. Только `bmad-spec` заново выводит SPEC. |
| PRD / `FR-48`–`FR-52` | FBX и архивы отклоняются. | PRD owner должен добавить отдельные FR для статического binary FBX package, texture-sidecar rules, «Кастомное» и thumbnail lifecycle либо явно оставить FBX экспериментом вне release. |
| Architecture / AD-4, AD-8, AD-9 | Custom GLB — isolated/pinned route; definition отделена от instance. | Нужен bounded decision `CustomAssetLibrary`: локальная библиотека не владеет Project, а Project durable-claim-ит exact bytes. Нельзя использовать browse cache как ресурс проекта. |
| UX / BottomSheet и safe viewport | Sheet сохраняет draft/scroll и не должен скрывать critical action. | Нужен отдельный mobile screen contract: один активный non-blocking surface и один явный scroll owner для каждого состояния. |

## 4. Рекомендуемый путь

**Hybrid: прямое исправление + новая evidence-gated дорожка.** Откат всей
работы не нужен, но import нельзя продолжать расширять поверх текущего
эксперимента. Сначала восстанавливается детерминированность GLB/texture route,
затем FBX/ZIP используется только как вход в тот же нормализованный GLB
контур. Одновременно mobile shell проходит структурный UX remediation, прежде
чем в него добавляются новые панели.

Это изменение **не меняет Alpha boundary автоматически**. Владелец уже
подтвердил приоритет обоих форматов; повышение `CAP-12` и добавление FBX в
release scope всё ещё требует синхронного PRD → SPEC → Architecture → UX
решения. До него можно выполнять только изолированные диагностику и evidence
работы согласно действующему разрешению.

| Option | Оценка | Решение |
| --- | --- | --- |
| Исправлять текущий importer точечно, сохраняя смешанный экран | быстро, высокий риск повторной регрессии | отклонено |
| Убрать FBX и оставить один GLB | безопаснее, но против подтверждённого product priority | отклонено как целевой путь |
| Bounded FBX/ZIP → normalized GLB + отдельная custom library + redesign flow | средняя/высокая работа, контролируемый риск | рекомендовано |

## 5. Новая последовательность roadmap

### G-IMP-UX. Надёжный import и usable mobile shell

**Статус сейчас: `PAUSED`.** Ни P-01…P-03, ни Story 5.1 не могут закрыться
пока не выполнены следующие срезы.

| Slice | Наблюдаемый результат | Зависимости |
| --- | --- | --- |
| `IMP-01` — characterize and contain | Исходный FBX/ZIP и эквивалентный GLB становятся versioned private test fixtures; harness воспроизводит A → B import, preview, placement, reload и disposal. До PASS UI не называет FBX route готовым. | exact user fixture; current GLB ingress |
| `UXR-01` — mobile shell contract | Для editor, catalog browse и import review есть отдельные layout states; одновременно активна одна non-blocking поверхность, у контента один scroll owner, sticky actions не закрывают последний focusable control. | S-4 / UX owner |
| `IMP-02` — deterministic GLB | Self-contained GLB с embedded textures корректно отображается в isolated preview и 3D после placement/reopen; resource A не меняется после B. | `IMP-01`, AD-9 |
| `IMP-03` — static FBX package | Один binary static FBX или ZIP с выбранными JPG/PNG/WebP sidecars локально преобразуется в self-contained GLB, сохраняя допустимые base-color/normal/metallic-roughness bindings без network fetch. Неподдерживаемое содержимое детерминированно отклоняется. | `IMP-02`, accepted PRD/SPEC scope, S-5 evidence |
| `IMP-04` — CustomAssetLibrary | Успешный import создаёт отдельную локальную карточку в «Кастомное» с renderer-derived thumbnail; import не размещает instance сам. Placement создаёт Project reference только после pin/staging/backup admission. | `IMP-02`; Architecture decision; CAP-10/AD-4 |
| `UXR-02` — regression matrix | Все importer/catalog/editor overlay states проходят automation и owner review на телефонах; no visual overflow, inaccessible action или pointer-through. | `UXR-01`, `IMP-04` |

`IMP-03` не означает «поддержать любой FBX». Допустим только заранее
описанный статический binary subset и только архив с ровно одним FBX и
разрешёнными image sidecars. ASCII FBX, animation, skin, morph targets,
cameras/lights, scripts, network paths, неизвестные/ambiguous texture matches,
nested/oversized/bomb archive и непроверенный format должны получить понятный
reject до регистрации ресурса.

## 6. Acceptance criteria

### Import, texture integrity and lifecycle

1. **GLB.** Контрольный self-contained GLB с минимум двумя materials и
   embedded textures показывает те же textures в import preview, placement,
   3D, reopen и clean-profile Portable Backup roundtrip. Проверяется binding
   material-slot → texture, а не только `textures.length` в JSON.
2. **FBX/ZIP.** Подтверждённый пользовательский ZIP с FBX и текстурами
   преобразуется локально в GLB. Его preview и 3D не чёрные; visual assertion
   фиксирует expected texture regions. При отсутствии/двойственности sidecar
   приложение не подставляет белый/чёрный material, а объясняет reject.
3. **Изоляция.** `A import → A place → B import → B place → reload` не меняет
   image, material maps, dimensions либо resource hash A. Повторить в обратном
   порядке и после dispose/context-loss. Cache key включает resource hash и
   texture identity, а disposable Three objects/materials не шарятся между
   instances без безопасного clone/dispose policy.
4. **Безопасность и сохранность.** Ни FBX, ни GLB не выполняют network fetch;
   cancel/failure/fence-loss/timeout не создают Project Revision, library entry
   или dangling staging resource. Каждый успешный Project reference имеет
   exact pinned source/runtime bytes и проходит BackupFeasibilityPolicy.
5. **Честная деградация.** Если визуальная валидация, memory budget или
   texture mapping не проходит, модель не именуется успешно импортированной и
   не появляется в «Кастомное» как готовая к размещению.

### «Кастомное» и thumbnail

1. После complete import пользователь видит карточку в отдельной категории
   **«Кастомное»** общего локального каталога, а не только временную форму
   текущего проекта.
2. Карточка показывает название, physical dimensions, source format,
   local/resource state и хороший renderer-derived thumbnail на нейтральном
   фоне. Thumbnail строится из того же нормализованного GLB, привязан к
   `sourceHash + normalizationVersion`; default procedural sketch не выдаётся
   за preview пользовательской модели.
3. `Import` и `Place` — разные действия. Из «Кастомное» пользователь выбирает
   карточку и затем явно размещает экземпляр. Удаление карточки не может
   разрушить resources, достижимые из Project, Trash, recovery или session
   history; policy объясняет, что именно будет освобождено.
4. После restart карточка, preview state и возможность повторно выбрать asset
   сохраняются локально. Project export остаётся self-contained: global library
   не служит скрытой зависимостью backup.

### Mobile UI/UX

1. Catalog browse, import source choice, conversion/progress, import review и
   placement — отдельные состояния, а не одна бесконечно растущая modal-grid.
   Каждый state имеет labelled Back/Close и не оставляет невидимую active
   overlay позади себя.
2. Для каждого state ровно один scroll owner; shell не использует
   `overflow: hidden` для отсечения unbounded content. Sticky action bar имеет
   reserved bottom space и никогда не закрывает последний input/card/action.
3. На `320×568`, `375×667`, `393×852`, landscape, keyboard-open и text-200%
   все primary actions доступны, target не меньше 44×44 CSS px, нет horizontal
   clipping без осознанного labelled horizontal control, а scroll/selection
   draft сохраняется при Back и Focus.
4. Проверяется матрица конфликтов editor dock × selection inspector × item
   draft × error/recovery × PWA notice: видимы status и применимые cancel/undo/
   redo, action rails не перекрывают друг друга и не пропускают pointer events
   сквозь blocking surface.
5. Синтетический Playwright viewport — regression evidence; окончательный PASS
   требует owner walkthrough на реальном iPhone и Android phone. Он не заменяет
   восемь NFR-15 contexts.

## 7. Влияние на epics, риск и handoff

- **Epic 5:** Story 5.1 остаётся `in-progress`; добавляется `UXR-01/02` как
  blocker её завершения. Каталог не считается готовым по числу карточек.
- **Epic 8:** Stories 8.8/8.9 остаются лишь resource-free JSON foundation;
  они не закрывают Portable Backup custom assets.
- **Epic 9:** остаётся `backlog` до approved scope change и S-5. После этого
  его необходимо развернуть в `IMP-01…04` либо обновить Story 9.1–9.3, чтобы
  FBX/ZIP и CustomAssetLibrary получили собственные AC.
- **PRD/SPEC/Architecture/UX:** требуются source-owner edits; этот proposal и
  roadmap не подменяют их.

| Риск | Контроль |
| --- | --- |
| Второй импорт меняет первый | Pairwise A/B isolation corpus, byte/resource-hash assertions, renderer material/texture clone+dispose audit. |
| ZIP bomb/path ambiguity/external fetch | Bounded central-directory admission, normalized path uniqueness, declared/decoded budgets, deny-all resolver and network assertion. |
| «Кастомное» ломает backup | Separate library metadata from Project GC roots; exact bytes are pinned into Project before durable placement; clean-profile roundtrip. |
| UI исправляется только под один screenshot | Viewport/state matrix, keyboard/text-scale and real-device owner walkthrough. |
| Scope silently grows to arbitrary 3D formats | Binary static FBX subset is explicit; all other formats remain rejected pending a new decision. |

**Scope:** major. После approval handoff получает Product Manager/PO для PRD
границы, `bmad-spec` для CAP derivation, Architect для library/ownership
decision, UX owner для state contract и один Developer owner для каждого
последовательного slice. До этого не меняются `sprint-status.yaml` и статусы
stories.
