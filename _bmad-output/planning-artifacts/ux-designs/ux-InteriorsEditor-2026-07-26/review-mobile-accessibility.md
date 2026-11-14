# Независимая UX-проверка: mobile и accessibility

**Статус:** findings для доработки draft-пакета, не approval и не readiness verdict.  
**Проверено:** `DESIGN.md`, `EXPERIENCE.md`, оба mockup PNG, Alpha-ограничения
из `SPEC.md`, PRD `NFR-17`–`NFR-20`, а также связанные editor/architecture
contracts.  
**Граница:** phone-first PWA, `360 CSS px`, работа одной рукой, safe area,
keyboard/visual viewport, 200% text zoom, DOM/AT, contrast/motion и безопасные
offline/recovery сценарии. Код и исходные макеты не менялись.

## Итог

Направление Calm Spatial Studio убедительно: canvas-first композиция, короткие
контекстные действия и отказ от тяжёлой CAD-панели подходят Alpha. Но пакет
пока **не готов к финальной UX-приёмке**. Ниже есть один P0-конфликт с
ограничениями Alpha и несколько P1, из-за которых нельзя доказать безопасное
использование на малом телефоне и с ассистивными технологиями.

Приоритеты: **P0** — конфликт с утверждённым scope; **P1** — блокирует
mobile/accessibility acceptance; **P2** — нужно закрыть до реализации;
**P3** — улучшение качества.

## Findings

1. **P0 — Сопутствующий interaction contract возвращает retired Focus и finish.**
   `editor-interaction-and-grid-contract.md:105–112` включает `Фокус` в
   постоянный ToolRail, а `:133–134` требует one-Room finish override. Это
   прямо конфликтует с `EXPERIENCE.md:34–38, 186`, `SPEC.md:402–419, 461–462`
   и `ARCHITECTURE-SPINE.md:486–492`: Focus/fullscreen и покрытия retired/out
   of scope. Если разработчик будет следовать companion, в Alpha попадёт
   запрещённая поверхность. **Правка:** владельцу source contract удалить
   Focus и переписать acceptance item 5 как нейтральную display-проекцию без
   assignment; затем проверить все ссылки на эти retired flows. До этого UX
   пакет не может быть согласован как соответствующий Alpha.

2. **P1 — В макете offline выглядит blocking-ошибкой и даёт неясный Retry.**
   В третьей панели
   `mockups/calm-spatial-studio-workspace-2026-08-29.png` plan затемнён scrim,
   поверх него карточка `Офлайн — проект работает` с `Повторить`. Это
   противоречит `EXPERIENCE.md:113–116`: offline — неблокирующая строка, в
   которой продолжаются local edit, history и backup; retry нужен только для
   catalog/download state. Так пользователь в самолёте получает ложный сигнал,
   что должен восстановить сеть, хотя проект исправен. **Правка:** показать
   offline как компактный, не-modal `StatusBanner` под header без action;
   `Повторить/Отмена` оставлять внутри явного catalog/unpinned-download sheet.
   Blocking scrim допустим только для persist failure, writer loss или resource
   recovery (`DESIGN.md:203–207`).

3. **P1 — Отсутствует обязательный reference screen для настоящего recovery.**
   `DESIGN.md:209–220` требует surface `Recovery / local safety` с read-only
   Project, placeholder, причиной и repair actions, но в обоих PNG нет
   `ResourceRecoveryRequired`: есть только offline и `Мало места`.
   Следовательно, нельзя проверить критический путь из `EXPERIENCE.md:118–121,
   251–257` и PRD `NFR-13` — edits/undo/redo должны быть скрыты, а вернуть
   writable state могут только exact repair либо один полный atomic
   RecoveryChangeSet. **Правка:** добавить отдельный 360px reference: явно
   `Только чтение`, число/список placeholder-ресурсов, diagnostics, exact
   local/backup/catalog repair, atomic remove/replace, cancel и confirmed
   deletion. Отдельно показать healthy-current/history-only issue с
   `Начать новую историю`; не смешивать эти состояния с offline или quota.

4. **P1 — Нет доказуемой композиции для 360px, вырезов и экранной клавиатуры.**
   `DESIGN.md:117–125` и `EXPERIENCE.md:166–168` заявляют safe area и
   visual-viewport поведение, однако оба raster reference (`1536×1024`) —
   коллажи без подписанного device viewport, notch/home-indicator и keyboard
   state. Особенно не проверяется central flow: три размера Room, Wall
   `3200 мм` и primary confirm после открытия числовой клавиатуры. Это не
   доказывает `NFR-17` и может спрятать confirm/отмену за IME на Safari.
   **Правка:** добавить измеренные 360×640/360×800 mobile frames (включая
   smallest visual viewport с открытой клавиатурой) для Create Room, Wall
   numeric draft и Catalogue search. Зафиксировать: sheet scrolls to focused
   field, title/field/error/Confirm и Cancel находятся выше
   `visualViewport.height`, fixed UI применяет верхний/нижний inset, а canvas
   только уменьшается. Проверить iOS browser и installed PWA отдельно.

5. **P1 — Каталог не показывает безопасный переход card → preview → Durable placement.**
   Левая панель `workspace` показывает карточки и единственную кнопку
   `Поставить`; явных `Отмена`, placement-preview, footprint/collision,
   выбранного host и `Готовим для офлайн…` нет. Это расходится с
   `DESIGN.md:171–175, 193–201, 216`, `EXPERIENCE.md:94–95, 115–116, 228–234`
   и `FR-28`: до exact pin + BackupFeasibilityPolicy предмет не Durable, а
   unpinned outage остаётся cancelable. Непонятно, подтверждает ли `Поставить`
   выбор card или уже записывает предмет — опасная двусмысленность для
   local-first продукта. **Правка:** показать отдельный preview state после
   выбора: sheet либо закрыт, либо явно заменён; на canvas видны host,
   rotation/front marker, footprint и collision; в dock есть равноправные
   `Поставить` и `Отмена`. Во время pin primary disabled/озаглавлен
   `Готовим для офлайн…`; failure имеет retry/cancel и не называет предмет
   сохранённым.

6. **P1 — Заявленный WCAG AA contrast не обеспечен палитрой во всех объявленных контекстах.**
   `DESIGN.md:6–31, 91–95` задаёт один `focus-ring` и одновременно применяет
   primary к focus, selected tools и links. Проверка токенов даёт: `primary`
   `#1976B9` на `canvas-plan` `#F8F5EF` — **4.45:1**, `text-muted`
   `#677581` на том же canvas — **4.35:1**, `primary` на `primary-soft` —
   **4.29:1**; `focus-ring` `#155E96` на `surface-dark` — **2.09:1**, а на
   filled `primary` — **1.41:1**. Это ниже 4.5:1 для normal text и/или 3:1 для
   видимого non-text focus indicator. **Правка:** утвердить contrast matrix
   для текста, selected outline, disabled, error и focus во light/dark/on-
   primary contexts; выделить минимум `focus-ring-light`, `focus-ring-dark` и
   `focus-ring-on-primary`, затем изменить токены до прохождения AA и добавить
   token-level regression check. Не полагаться на цвет: уже требуемые text +
   outline + semantic icon оставить (`EXPERIENCE.md:157–158`).

7. **P1 — DOM alternative назван, но не образует завершённый путь без canvas.**
   `EXPERIENCE.md:98, 153–156` обещает `Object list / Room directory` и
   DimensionInput, но не описывает entry point, порядок/содержание списка,
   keyboard действия или альтернативы для select Wall/Item, start Wall,
   move/rotate, collision review и confirm/cancel. Это особенно важно, потому
   что Alpha запрещает прямой ввод глобальных координат (`PRD NFR-19` и
   `FR-8`), а drag/pinch не может быть единственным способом. **Правка:**
   специфицировать один DOM Inspector: доступная кнопка открытия, list rows с
   типом/именем/размером/status, Actions для item и wall, выбор допустимой
   опорной точки/стены из названного списка, exact relative dimension input,
   текстовый placement/collision preview и same confirm/cancel. Для каждого
   canvas-critical flow привести keyboard и screen-reader walkthrough; все
   они должны пользоваться тем же `EditorQueryModel`/command path, не второй
   геометрией.

8. **P2 — 200% text zoom не имеет layout-contract и ломает показанные плотные ряды.**
   `EXPERIENCE.md:151–152` обещает сохранность primary/durability/cancel, но
   ни document, ни mockup не задают reflow. В средней панели `foundations`
   три поля Ширина/Глубина/Высота идут в одну строку; в `workspace` catalogue
   — две колонки, а SelectionCard — ряд icon-only действий. На ширине 360px
   при 200% они либо обрежут label/value, либо оставят неочевидные иконки.
   **Правка:** в DESIGN добавить container rules: form fields stack in one
   column, catalogue switches to one column below a defined available width,
   icon actions become labelled rows/overflow with accessible name, segmented
   ViewSwitch stays full-width, primary/cancel never overflow. Добавить
   screenshots 360px/200% для Create Room, selected Wall/Item и recovery.

9. **P2 — BottomSheet не имеет определённой семантики и recovery focus-path.**
   Сейчас есть только «новый sheet заменяет предыдущий» и focus return
   (`DESIGN.md:123–125`; `EXPERIENCE.md:159–160`). Не сказано, когда sheet
   non-modal (catalogue/properties) и когда это modal dialog (delete,
   ConflictPreview, RecoveryChangeSet), где trap/initial focus, как назвать
   scrollable region и куда вернуть focus, если инициатор удалён или стал
   недоступен. Такая неопределённость нарушает practical часть `NFR-18` и
   делает Back/Esc на screen reader ненадёжным. **Правка:** для каждого sheet
   class задать role, accessible name/description, initial focus, focus
   containment, close affordance, return fallback (например, header или
   Object list) и scrolling order; blocking sheet получает modal semantics,
   catalogue/properties — нет.

10. **P2 — Политика live announcements может зачитывать drag-изменения слишком часто.**
    `EXPERIENCE.md:155–156` требует озвучить candidate, origin, endpoint,
    delta, quadrant, lifecycle и error «один раз», но pointer move постоянно
    меняет candidate. Без правила это либо flood screen reader, либо не
    сообщит нужную смену состояния. **Правка:** определить announcement policy:
    live region сообщает только transition (draft started, valid→invalid,
    host/collision changed, persistence outcome), не каждую координату;
    текущие exact values доступны по явной кнопке `Озвучить черновик`/Inspector.
    Validation/error связывать с полем через accessible description и
    announce после submit, не при каждом keystroke.

11. **P2 — Обязательные Empty Plan и error/recovery states не покрыты макетами.**
    `DESIGN.md:171–176, 209–218` предписывает dock `Комната / Стена / Предмет`,
    а также distinct persist failure, writer loss, catalog outage и WebGL
    fallback (`EXPERIENCE.md:111–122`). В `foundations` вместо Empty Plan
    показан уже открытый room-starter sheet, а план с выбранной стеной содержит
    только иконки и Undo/Redo; в `workspace` отсутствуют persist-failed,
    writer/read-only, catalog-unavailable и 2D fallback. **Правка:** добавить
    компактную state matrix и high-fidelity panels как минимум для Empty Plan,
    Persist failure (`Повторить` + `Сохранить копию`, mutation fenced), Writer
    lost, Catalog unavailable (не recovery) и WebGL→2D. Это также проверит,
    что никаких critical status не прячется ради canvas (`EXPERIENCE.md:88`).

12. **P3 — Одноручность и hit-targets заявлены, но не операционализированы на макетах.**
    На panel Plan в `foundations` switch и Back/menu находятся в верхней зоне,
    а right ToolRail и нижний sheet конкурируют за правый нижний угол; на
    360px plus/rail/icon-only affordances могут оказаться рядом с системным
    gesture area. `DESIGN.md:117–121, 143–145` задаёт 44/48px и accessible
    name, однако изображение не содержит измерений или one-handed priority.
    **Правка:** добавить redline для каждого fixed control: CSS target box,
    min 8px separation, safe-area/gesture exclusion and thumb-zone priority.
    Primary authoring action и Cancel удерживать в нижней безопасной зоне;
    navigation и rare project menu могут оставаться сверху. Проверить
    hit-target overlay на 360px, включая long Russian labels и 200% text.

## Необходимый re-review

После закрытия P0/P1 достаточно повторно проверить: (1) 360px с клавиатурой
и safe areas, (2) Catalogue placement + offline/outage, (3) настоящую
ResourceRecoveryRequired/history-only flow, (4) DOM-only walkthrough и
screen-reader announcements, (5) light/dark contrast matrix и 200% reflow.
Это остаётся документарной UX-проверкой; она не заменяет тест с участниками и
не меняет определённый для Alpha device/release gate.
