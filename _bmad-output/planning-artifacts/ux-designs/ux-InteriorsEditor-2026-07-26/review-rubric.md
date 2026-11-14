# Spine Pair Review — InteriorsEditor

**Проверено:** 2026-08-30. Независимая read-only проверка draft-пары
`DESIGN.md` + `EXPERIENCE.md`, memlog, двух reference boards, frontmatter и
указанных источников. Проверяющий не менял спины, макеты, memlog или исходные
контракты.

## Overall verdict

Направление Calm Spatial Studio уже даёт убедительный phone-first характер:
canvas-first компоновка, короткая микрокопия, честная durability-модель и
Telegram-адаптер хорошо согласуются между собой. Однако пара пока **не готова
к статусу final**: формальный контракт нельзя надёжно извлечь машинно, а
макеты и flows в нескольких местах расходятся с UX spine и источниками.

Критических находок нет; до следующей реализации необходимо закрыть шесть High
находок. Это review исходных UX-артефактов, не разрешение на implementation и
не замена тестов с пользователями или устройствами.

## 1. Flow coverage — broken

Проверены все journeys из PRD: `UJ-1`–`UJ-6` и `UJ-A1`. `UXF-1`–`UXF-6`
покрывают основу room/placement/geometry/offline/recovery/backup, но не
выполнены как формальные downstream flows: нет нумерованных шагов и явных
climax beats; карты `UJ → UXF` нет.

### Findings

- **[high] FLOW-01 — Source journeys покрыты неполно и не имеют обязательной формы flow.** `UJ-1` требует placement кровати с конфликтом; `UJ-3` — item variant, несколько типов каталога и undo/redo; `UJ-4` — update/migration; `UJ-5` — Parametric Placeholder; `UJ-6` — schema-migration failure; `UJ-A1` — GLB preflight/preview/reject. В `EXPERIENCE.md` §§217–263 ни один flow не имеет numbered steps или явно отмеченного climax; `UJ-A1` отсутствует полностью, а `UJ-3`/`UJ-5` покрыты только частично. (PRD §§3.1–3.7, строки 58–124; `EXPERIENCE.md` §§217–263.) *Fix:* добавить перед flows таблицу `UJ → UXF → surface/state/mock`; переписать `UXF-1`–`UXF-6` нумерованно с именованным протагонистом, **Climax** и applicable failure path. Добавить отдельные flows для Placeholder и Alpha+ GLB либо явно задокументировать их как deferred surface с owner-approved reason — не молча опускать source UJ.

## 2. Token completeness — broken

Все цвета из `DESIGN.md` имеют hex-значение; единственная prose token-ссылка
`{colors.focus-ring}` разрешается. YAML синтаксически валиден, но структура
основных token-групп не соответствует контракту `design-md-spec.md` и часть
accessibility-токенов не работает в dark theme.

### Findings

- **[high] TOK-01 — Typography, spacing и components не являются машиночитаемыми token-объектами.** `typography.*` записаны строками вместо объектов с `fontFamily`/`fontSize`/`fontWeight`/`lineHeight`; `spacing` — одна prose-строка, а `components` — список имён вместо `component-name → object` со ссылками на tokens. Поэтому downstream consumer не может извлечь размер, scale или визуальные параметры компонента. (`DESIGN.md` строки 32–60; `design-md-spec.md`, таблица «Frontmatter tokens».) *Fix:* сохранить текущую эстетику, но заменить строки структурированными объектами, например `spacing.gutter: "16px"`, и дать каждому component key объект с radius/surface/foreground/border/elevation/minTarget, используя `{colors.*}`, `{rounded.*}` и `{spacing.*}`.

- **[high] TOK-02 — Focus indicator не соответствует заявленному AA в dark theme.** `focus-ring` `#155E96` на `surface-dark` `#1F2C36` даёт контраст около **2.09:1**, ниже 3:1 для видимого focus indicator; для Telegram dynamic theme нет dark mapping. (`DESIGN.md` строки 12, 31, 91–95; `EXPERIENCE.md` строки 145–149, 179–187.) *Fix:* добавить `focus-ring-dark` с проверенным контрастом ≥3:1 к соседней dark surface, описать mapping light/dark/host-theme и зафиксировать контрастную пару в Colors/Accessibility Floor.

## 3. Component coverage — thin

Основные behavior rules для `AppShell`, `ActionDock`, `ViewSwitch`,
`DimensionInput`, `GeometryPreview`, `SelectionCard`, `CatalogueSheet`,
`PlacementPreview`, `StatusBanner` и `ConfirmSheet` есть. Но один исходный
компонент переименован без reconciliation, а component registry расходится
между frontmatter, visual и behavior уровнями.

### Findings

- **[high] CMP-01 — `ActionDock` заменяет source-owned `ToolRail` без контракта эквивалентности.** Глоссарий определяет `ToolRail` как floating vertical canvas-local DOM control rail для views, active tool, history и Options; CAP-5 также требует этот active ToolRail вне overflow. Draft вводит нижний `ActionDock`, а reference board одновременно рисует вертикальный rail, но не говорит, является ли он тем же компонентом. Это позволяет реализовать два несогласованных набора controls или потерять обязательные controls. (SPEC glossary строка 42; SPEC CAP-5, строки 183–188; `DESIGN.md` строки 117–125, 163–176; `EXPERIENCE.md` строки 84–98.) *Fix:* использовать canonical name `ToolRail` во всех трёх слоях либо явное правило «ActionDock — mobile presentation variant ToolRail» с его обязательными view/tool/history controls, функцией unified `Рука и выбор`, состоянием Wall/Opening/Catalog и mobile placement. Если source owner намерен изменить термин/контракт, сначала оформить source-owner reconciliation.

- **[medium] CMP-02 — Не каждый названный компонент имеет обе части контракта.** `BottomSheet`, `EditorTopBar`, `CatalogueCard` и `UndoRedo` перечислены в `DESIGN.md` frontmatter, но не имеют отдельного behavior row; `PropertyField` есть только в visual prose; напротив, `PlacementPreview` и `Object list / Room directory` имеют behavior, но отсутствуют в visual registry. (`DESIGN.md` строки 46–60, 147–207; `EXPERIENCE.md` строки 84–98.) *Fix:* создать один canonical registry: одно имя, visual token-object, anatomy/states в DESIGN и use/interaction/focus/escape rules в EXPERIENCE для каждого компонента; убрать лишь действительно некомпонентные названия.

## 4. State coverage — thin

Сильные состояния durability, catalog outage, recovery, history и writer lease
описаны. Но state table не проходит IA surface-by-surface: она не связывает
создание/импорт, каталог, свойства предмета, 3D/Compatibility и Project menu с
их empty, loading, focus, permission/capability, error и return actions.

### Findings

- **[medium] STATE-01 — IA surfaces не имеют полной матрицы состояний и безопасных возвратов.** Для `Create Project`/import не описаны invalid bounds, staged import и migration reject; для `Catalogue` отсутствуют initial loading, no results и pin progress per card; для `Item properties` — locked/fixed-size/incompatible-anchor; для `3D`/`Compatibility` — unsupported WebGL and retry/2D/export path; для `Room directory`/`Project menu` — empty and focus-return states. (`EXPERIENCE.md` строки 40–59, 100–122.) *Fix:* добавить таблицу `Surface × state × visible copy × available actions × Back/focus destination`; не дублировать domain policy, а сослаться на уже заданные stable outcomes. Это позволит проверить каждый mock и E2E flow без изобретения UI при реализации.

## 5. Visual reference coverage — thin

`mockups/` содержит ровно две boards; `imports/` и `wireframes/` отсутствуют.
Обе boards просмотрены и имеют ссылки из `DESIGN.md`, но ссылки слишком общие,
а несколько показанных состояний прямо расходятся со spine.

### Findings

- **[high] VIS-01 — Board offline/storage показывает неверную mental model offline.** `calm-spatial-studio-workspace-2026-08-29.png` показывает крупную error-like sheet «Офлайн — проект работает» с неуточнённой кнопкой `Повторить`. По spine offline — неблокирующая строка, локальное редактирование/undo/backup продолжаются, retry относится только к конкретному unpinned catalog operation; `StatusBanner` должен быть коротким. Такой макет может заставить реализовать offline как retry/error и нарушить local-first сценарий. (workspace board `…workspace-2026-08-29.png`, правая панель; `DESIGN.md` строки 203–207; `EXPERIENCE.md` строки 113–116, 244–249.) *Fix:* перерисовать offline как компактный non-blocking banner без retry; показывать retry/cancel только в контексте catalog download. Отдельно нарисовать `ResourceRecoveryRequired` как blocking read-only surface и storage-pressure как самостоятельное состояние.

- **[medium] VIS-02 — Референсы не трассируются до конкретных surfaces и в них есть непокрытые contract details.** Обе ссылки названы только «основные поверхности» и «рабочие состояния»; формула «spines win on conflict» нигде не зафиксирована. Board foundations показывает 3D miniatures на `ProjectCard`, хотя DESIGN требует actual 2D-plan или neutral placeholder; кадр `Wall draft + numeric` не показывает candidate class/origin/endpoint-or-Δ; Board workspace не показывает в catalogue title, anchor и technical readiness, требуемые card. (`DESIGN.md` строки 156–161, 185–197, 209–220; обе boards.) *Fix:* дать каждому IA/required surface inline-ссылку на board и точное описание кадра; добавить одну явную фразу, что DESIGN/EXPERIENCE имеют приоритет над mockups. Перерисовать или подписать упрощённые кадры так, чтобы они не противоречили контракту.

## 6. Bloat & overspecification — strong

Существенного bloat не обнаружено. `Product Invariants Mapping` оправдан как
traceability для safety-critical local-first editor, а visual prose не пытается
подменить доменный алгоритм. Не фиксировать в UX новые geometry tolerances,
рендерные thresholds или platform-library defaults.

## 7. Inheritance discipline — thin

Все локальные пути в `EXPERIENCE.md.sources` существуют; ссылочный
`DESIGN.md` также разрешается. Действующие термины и memlog-история, однако,
не дают downstream consumer однозначного authority при конфликте.

### Findings

- **[high] INH-01 — Термины и append-only provenance не полностью согласованы с canonical glossary/current source.** Draft использует `CatalogueSheet`/`CatalogueCard` и `ItemInstance`, тогда как SPEC glossary фиксирует `Catalog Control Plane` и `AssetInstance`; более существенно, memlog сохраняет решения о Door navigation (строки 7, 19) и Focus/fullscreen (строки 13–16), а текущие source/Draft запрещают оба маршрута. Поздний redesign записан, но не содержит явного supersession указателя на эти решения. (`.memlog.md` строки 7, 13–20, 40–43; SPEC glossary строки 23–26, 42, 55; `EXPERIENCE.md` строки 34–38, 174–187.) *Fix:* владельцу UX append-only способом через `memlog.py` добавить одно явное supersession/reconciliation event с точными строками current authority; затем нормализовать component/domain names к глоссарию либо создать owner-approved vocabulary mapping. Не редактировать старые memlog entries.

## 8. Shape fit — strong

`DESIGN.md` содержит все canonical body sections в правильном порядке:
Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth →
Shapes → Components → Do's and Don'ts. `EXPERIENCE.md` содержит все required
default sections; `Responsive & Platform` и `Inspiration & Anti-patterns`
обоснованно присутствуют. Дополнительный `Product Invariants Mapping` полезен
как traceability и не является декоративным разделом.

## Mechanical notes

- YAML обоих frontmatter синтаксически читается; проблема TOK-01 — в форме
  данных относительно design-md contract, а не в синтаксисе YAML.
- Все восемь local `sources:` из `EXPERIENCE.md` разрешаются в существующие
  файлы; три external reference URLs оставлены как research sources.
- В `mockups/` обнаружены две PNG; других `mockups/`, `wireframes/` или
  `imports/` для проверки нет.
- Проверенная snapshot: `DESIGN.md`
  `55352bf7e719b478bd40b2310ce322f8fd8758e0bf602378c55843cff463dc1e`,
  `EXPERIENCE.md`
  `50f687bf9c1890a27ac1316d2af7ecefe7176c7f923dc96306d03cdb5db72ac9`,
  `.memlog.md`
  `c12c2c421d9144e2c088712034572c186dffcccbf0f829d71b3f0f8ef469588f`.
