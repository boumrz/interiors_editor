---
name: InteriorsEditor — Calm Spatial Studio
description: "Mobile-first визуальная система Web/PWA и Telegram Mini App: точный план и 3D — главное содержимое, интерфейс даёт короткие контекстные действия."
status: final
updated: 2026-11-22
colors:
  background: "#F4F6F8"
  background-dark: "#17212B"
  canvas-plan: "#F8F5EF"
  canvas-plan-dark: "#1D252C"
  surface: "#FFFFFF"
  surface-dark: "#1F2C36"
  text: "#17212B"
  text-dark: "#F5F7FA"
  text-muted: "#677581"
  text-muted-dark: "#A7B6C2"
  outline: "#D9E1E8"
  outline-dark: "#3B4C59"
  grid-minor: "#DEE5E8"
  grid-minor-dark: "#33414B"
  primary: "#1976B9"
  primary-soft: "#E7F3FB"
  primary-dark: "#68BFFF"
  success: "#187B49"
  success-dark: "#65D891"
  warning: "#8A5A00"
  warning-dark: "#F4C96A"
  danger: "#BA332D"
  danger-dark: "#FF887F"
  scrim: "#0B1720"
  focus-ring: "#0B5D8E"
  focus-ring-dark: "#8DD3FF"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "28px"
    fontWeight: "700"
    lineHeight: "34px"
    letterSpacing: "-0.02em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: "700"
    lineHeight: "26px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: "400"
    lineHeight: "22px"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: "600"
    lineHeight: "18px"
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: "400"
    lineHeight: "18px"
  numeric:
    fontFamily: "'SF Mono', 'Roboto Mono', ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: "600"
    lineHeight: "20px"
    fontVariantNumeric: "tabular-nums"
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  full: "9999px"
spacing:
  unit: "4px"
  gutter-mobile: "16px"
  gap-tight: "8px"
  gap-default: "12px"
  gap-section: "16px"
  gap-sheet: "24px"
  touch-min: "44px"
  touch-preferred: "48px"
components:
  app-shell:
    background: "{colors.background}"
    foreground: "{colors.text}"
    gutter: "{spacing.gutter-mobile}"
  project-card:
    background: "{colors.surface}"
    radius: "{rounded.lg}"
    padding: "{spacing.gap-section}"
  editor-top-bar:
    background: "{colors.surface}"
    radius: "{rounded.lg}"
    minHeight: "{spacing.touch-preferred}"
  view-switch:
    selectedBackground: "{colors.primary-soft}"
    selectedForeground: "{colors.primary}"
    radius: "{rounded.sm}"
  action-dock:
    background: "{colors.surface}"
    radius: "{rounded.xl}"
    minTarget: "{spacing.touch-min}"
    maxContextActions: 3
  bottom-sheet:
    background: "{colors.surface}"
    radius: "{rounded.xl}"
    padding: "{spacing.gap-section}"
  dimension-input:
    background: "{colors.surface}"
    outline: "{colors.outline}"
    radius: "{rounded.sm}"
    typography: "{typography.numeric}"
  geometry-preview:
    background: "{colors.primary-soft}"
    foreground: "{colors.text}"
    radius: "{rounded.md}"
  catalogue-card:
    background: "{colors.surface}"
    radius: "{rounded.md}"
    padding: "{spacing.gap-default}"
  selection-card:
    background: "{colors.surface}"
    radius: "{rounded.lg}"
  status-banner:
    background: "{colors.primary-soft}"
    foreground: "{colors.text}"
    radius: "{rounded.sm}"
  undo-redo:
    minTarget: "{spacing.touch-min}"
    foreground: "{colors.text}"
  confirm-sheet:
    background: "{colors.surface}"
    radius: "{rounded.xl}"
  catalogue-sheet:
    background: "{colors.surface}"
    radius: "{rounded.xl}"
    composition: "bottom-sheet + catalogue-card"
  placement-preview:
    outline: "{colors.primary}"
    statusBackground: "{colors.primary-soft}"
    composition: "canvas overlay + action-dock"
  object-list-room-directory:
    background: "{colors.surface}"
    radius: "{rounded.lg}"
    composition: "bottom-sheet list rows"
  opening-sheet:
    background: "{colors.surface}"
    radius: "{rounded.xl}"
    composition: "bottom-sheet + dimension-input"
  custom-item-placeholder:
    background: "{colors.surface}"
    radius: "{rounded.xl}"
    composition: "bottom-sheet + dimension-input"
  static-glb-import:
    background: "{colors.surface}"
    radius: "{rounded.xl}"
    composition: "bottom-sheet + status-banner"
  measurement-card:
    background: "{colors.primary-soft}"
    foreground: "{colors.text}"
    radius: "{rounded.md}"
  placement-distances:
    line: "{colors.focus-ring}"
    lineDark: "{colors.focus-ring-dark}"
    background: "{colors.surface}"
    foreground: "{colors.text}"
    typography: "{typography.numeric}"
    radius: "{rounded.sm}"
  item-color-swatch:
    minTarget: "{spacing.touch-min}"
    foreground: "{colors.text}"
    selectionOutline: "{colors.focus-ring}"
    selectionOutlineDark: "{colors.focus-ring-dark}"
    radius: "{rounded.sm}"
---

# Brand & Style

**Calm Spatial Studio** — тихий, точный и современный инструмент для
пространственных решений на телефоне. План или 3D-сцена занимают почти весь
экран; интерфейс появляется ровно в момент, когда нужен следующий шаг.

Planner 5D — reference interaction model только для короткого цикла
«план → предмет → 3D», видимого каталога и быстрого возврата между видами.
InteriorsEditor не копирует его бренд, зелёную айдентику, изображения, каталог
или расширенный scope. Визуальный приоритет — не «дом мечты», а ясное решение:
поместится ли предмет и останется ли проход.

Telegram Mini App — дополнительная поверхность общего редактора рядом с Web/PWA.
Компактный header, списки и solid sheets используют существующие semantic tokens;
host theme влияет только на presentation и не копирует бренд Telegram. Это
план расширения, а не утверждение о готовой интеграции.

- пространство важнее chrome;
- один главный следующий шаг вместо сетки равноправных кнопок;
- точность выглядит дружелюбно, а не как CAD;
- состояние данных говорится коротким текстом и не прячется за иконкой;
- нейтральная 3D-сцена помогает оценить габариты, но не обещает фотореализм.

# Colors

Светлая тема — основной режим: холодный почти белый app chrome и слегка тёплый
`canvas-plan` для плана. Тёмная тема сохраняет различимый slate-холст, а не
инвертирует геометрию.

`primary` — спокойный синий для единственного primary action, выбранного
инструмента, keyboard focus и ссылок. Зелёный зарезервирован для успешной
durability, а красный — для ошибки и необратимого действия. Цвет никогда не
остаётся единственным носителем состояния: рядом обязательны текст, форма или
иконка. `focus-ring` применяется на светлой поверхности, `focus-ring-dark` —
на тёмной; оба рассчитаны на заметный контур вокруг целого control, а не на
изменение только цвета текста. Контраст соответствует WCAG 2.2 AA.

Запрещены градиенты, glassmorphism над геометрией, декоративное свечение,
постоянные зелёные акценты и статусы-точки без текста.

# Typography

Система использует системный шрифт: он быстро загружается, естественно
поддерживает кириллицу, Dynamic Type и host-тему Telegram. Большой
`display` допустим только в пустом состоянии `Projects`; внутри editor самый
крупный текст — `title`.

`numeric` обязателен для размера, координат draft, угла и габаритов предмета.
Числа используют табличную ширину. Единица `мм` всегда расположена рядом с
editable length/height/offset; ввод `3200` означает `3200 мм`. Display format
не меняет canonical integer-mm input.

Не использовать all caps, рекламные заголовки, эмодзи в системных статусах и
обрезание действия без доступного полного названия.

# Layout & Spacing

Базовая поверхность — портретный телефон от `360 CSS px`. AppShell учитывает
safe-area сверху и снизу; target не меньше `44×44 CSS px`, предпочтительно
`48×48`. Home — вертикальный список/карточки. Editor занимает visual viewport:
верхний bar показывает выход, название и durability; canvas занимает остаток;
ActionDock находится в нижней безопасной зоне.

Свойства, каталог и confirm открываются одним bottom sheet с высотами `peek`,
`half`, `full`; новый sheet заменяет предыдущий. При ширине от `768px`
properties могут стать закреплённой панелью — это compatibility layout, а не
desktop-first authoring target.

# Elevation & Depth

Иерархия создаётся пространством, типографикой и tonal layering. На canvas нет
карточек с тяжёлыми тенями. Лёгкая тень допустима только у floating ActionDock,
избранной карточки и поднятого bottom sheet, чтобы отличать transient UI от
плана. Blocking states используют solid surface и scrim с достаточным
контрастом, не только blur.

# Shapes

`sm` применяется к input и small action, `md` — к карточке предмета и property
row, `lg` — к project card и top bar, `xl` — только к bottom sheet и
ActionDock. Pill-формы разрешены только для filter chip или малого статуса;
primary button не выглядит рекламной капсулой.

Иконки — спокойные outline `1.75–2px` с единой системой скругления. Иконка
основного действия сопровождается названием при первом использовании и на
ActionDock; icon-only control допустим лишь с доступным именем; обучающие tooltip не показываются (REL-02).

# Components

Новые состояния Telegram используют AppShell, StatusBanner и существующие
BottomSheet/ConfirmSheet с текущими tokens; отдельный визуальный язык не вводится.
Контракты [REL](../../../../contracts/alpha-release-ux-2026-11-01.md) и
[FUP](../../../../contracts/alpha-release-ux-followup-2026-11-01.md) уточняют
прежние композиции: без декоративных боковых акцентных полос и dock-delete.


## AppShell и ProjectCard

Верхний bar editor: `Назад` / название Project / текст durability / меню
Project. Status — короткий текст (`Сохранено`, `Сохраняем…`, `Нужна проверка`),
не цветная точка. Home использует тот же system-like header: `Проекты`,
secondary `Импорт` и primary `Новый проект`.

ProjectCard показывает миниатюру реального 2D-plan или нейтральный placeholder,
название, короткую мета-строку и durability/recovery status. Для условной AD-31
объединённой directory карточка также показывает читаемую и доступно озвучиваемую
метку локальной области; состояние неполного списка видно текстом в AppShell. Tap по всей
карточке открывает Project. Меню содержит rename, Portable Backup, diagnostics
и delete; destructive действие не располагается рядом с обычным открытием.
Пустой список — одна спокойная plan-grid поверхность, строка `Пока нет
проектов` и `Новый проект`, без карусели и маркетинговых обещаний.

## EditorTopBar, ViewSwitch и ActionDock

`План` и `3D` — compact segmented switch в EditorTopBar, всегда доступный вне
overflow. Это navigation/view control, не часть ActionDock.
Переключение не создаёт Command, Revision или историю и не теряет selection
Wall/AssetInstance, если объект видим. В 2D видны solid wall body, чистые
dimension annotations и ненавязчивая construction grid. В 3D — нейтральные
пол и стены; пользователю не предлагаются finish pickers.

Floating ActionDock — единственная командная поверхность редактора. Он
показывает максимум три context actions и overflow только для редких Project
actions. На Plan его постоянная часть содержит `Рука и выбор`; второго
ToolRail, `Фокус` или fullscreen-control нет. Контекст определяет `Комната / Стена / Предмет` для
пустого Plan; `Добавить проём / Свойства` для Wall; для floor
AssetInstance — `Повернуть / Свойства`, а для wall-hosted
AssetInstance — `Свойства`; `Поставить / Отмена` для preview и
`Предмет / Авто cutaway / Показать все стены` для 3D без selection.
`Рука и выбор` остаётся единым доступным control и не раздваивается на режимы.

После выбора Wall контекстная action называется `Добавить проём`: она открывает
один sheet с выбором `Дверь` или `Окно`, полями width/height/offset в мм и
обязательным `sillMm`: для Door — `Порог / нижняя отметка, мм`, для Window —
`Высота подоконника, мм`. Preview показывает допустимый интервал и inline
validation; это не добавляет дугу распахивания, ручки, ключи или состояние
двери.

## BottomSheet, PropertyField и GeometryPreview

Sheet получает крупную drag-handle, ясный title, одно primary действие и
scrollable body. При появлении клавиатуры active DimensionInput и confirm
остаётся над visual viewport; sheet возвращается к тому же draft, полю и
ошибке после сворачивания.

PropertyField отделяет applied value от raw draft. DimensionInput всегда имеет
visible unit, stepper только как удобство и inline reason возле конкретного
поля. GeometryPreview текстом показывает candidate class, origin,
endpoint/`Δx/Δz` или diagonal quadrant; canvas дополняет, но не заменяет этот
DOM-маршрут. `Validated` не называется `Сохранено` до atomic pointer swap.

## CatalogueSheet, SelectionCard и states

Каталог открывается full-height sheet: search, компактные категории и
двухколоночные крупные CatalogueCard. Card содержит preview, название,
габариты, anchor и technical readiness, но не цену, бренд, рейтинг, лицензию,
provenance или `Избранное`. `Готовим для офлайн…` описывает progress до exact
pin + BackupFeasibilityPolicy; preview пока cancelable.

В Telegram карточка условного предмета показывает собственный простой силуэт
на нейтральном фоне. Под ним расположены тип, размеры в мм и подпись `На пол`
или `На стену`. На узком экране и при увеличении шрифта карточки переходят в
одну колонку. В свойствах образец цвета использует {components.item-color-swatch}
и текстовое имя. Выбранный вариант отмечен обводкой и отметкой на контрастной
подложке, поэтому состояние читается и у близких по тону оттенков.

SelectionCard не перекрывает footprint. Выбор Wall выделяет её тело и не
открывает карточку автоматически; явные `Свойства` открывают полный маршрут,
включая удаление стены с подтверждением последствий. `Измерить` даёт первый
target measurement route; второй target можно
выбрать на canvas или в Object list. У AssetInstance `Свойства` открывает
подписанные rows `Дублировать`, `Заблокировать` / `Разблокировать` и `Удалить`;
это reversible item commands, не door access control. 2D front marker и 3D
orientation используют одну local `+Z` direction. Undo/redo закреплены слева на canvas: в 2D внизу, в 3D под шапкой; они не перекрывают dock,
свойства и safe area (REL-09). На экране высотой ≤600 px открытая панель
размеров временно выше инструментов; после закрытия история снова доступна.

StatusBanner — короткая негромкая строка под header. Catalog outage не
выглядит как Project error. Blocking attention допустима только для recovery,
persist-failed и writer-loss. ConfirmSheet используется для Project deletion, `DiscardSessionHistory`,
ConflictPreview, RecoveryChangeSet, подтверждения переноса проёма и безопасной
обработки Back/Close;
удаление AssetInstance остаётся обратимой command с Undo; для Wall действует
явное подтверждение последствий по FUP-09.

## Расстояния до стен и статистика в Telegram

На стартовом экране и в настройках доступны действующие редакции документов. До первого учитываемого входа и позднее можно выключить общий счётчик. Повторные открытия с этого устройства требуют отдельного выбора с равнодоступными «Разрешить» и «Отказаться». Достаточное пояснение для экрана — «Статистика помогает развивать приложение. Ваши проекты, файлы и Telegram ID в статистику не передаются». Более подробная ссылка объясняет местный выбор, суточные суммы, возможность отзыва и техническую видимость IP при соединении. [Условия выпуска](../../sprint-change-proposal-2026-11-22-public-candidate.md)

Линии расстояний визуально отделены от сетки и общих размеров выбранного плана.
{components.placement-distances} задаёт контрастную линию в светлой и тёмной
темах и числовую подпись на непрозрачной подложке. Линии имеют отметки концов.
При тесном расположении подпись смещается от предмета и органов управления.
Подписи, для которых нет свободного места, остаются в текстовой части панели.

В прежнем пилоте с браузерным SDK ссылка на настройки статистики расположена под списком проектов, у нижнего
края короткого экрана. Она раскрывает строку с переключателем в цветах темы
Telegram. Пояснение под строкой содержит название провайдера и назначение
сбора, а подробности о передаче и хранении раскрываются по нажатию. Оценки
снабжены текстом, а выбранное значение обозначено обводкой и состоянием
элемента управления. На узком экране варианты переносятся. Кнопки учитывают
нижнюю безопасную область и минимальный размер {spacing.touch-min}.

## Обязательные reference surfaces

| Surface | Композиция |
|---|---|
| `Projects` | Header, ProjectCard, один `Новый проект`, empty/list/recovery states. |
| `Empty Plan` | Canvas, `План / 3D`, dock `Комната / Стена / Предмет`, без обучающей подсказки. |
| `Wall draft + numeric` | Candidate, mm sheet, candidate class и inline rejection. |
| `Measurement` | Один/два target, revision-bound value, stale → `Выбрать заново`; измерение не создаёт Command. |
| `Catalogue + PlacementPreview` | Card → pin/backup progress → cancelable preview → `Поставить / Отмена` → Durable outcome. |
| `3D item editing` | Нейтральная 3D-сцена, тот же selected item и `+Z`, cutaway controls; floor item drag/rotate и wall item numeric properties. |
| `Local / failure states` | Отдельные offline, catalog outage и persist-failed панели; они не смешиваются. |
| `Recovery / local safety` | Read-only Project, placeholder, причина и exact repair / atomic recovery actions. |
| `Opening` | Wall selected, Door/Window sheet, width/height/offset/`sillMm`, valid interval и ConflictPreview. |

Актуальные визуальные референсы перечислены в [mockups index](mockups/README.md): editor, placement, failure states и brief исправлений. `calm-spatial-studio-foundations-2026-08-29.png` и `calm-spatial-studio-workspace-2026-08-29.png` — historical, не ориентир реализации. Контракты REL/FUP 1 ноября и обновлённые spines имеют приоритет над деталями старых PNG. Это композиционные ориентиры, не обещание фотореализма renderer.

# Do's and Don'ts

| Do | Don't |
|---|---|
| Отдавать экран plan/3D-сцене | Заполнять canvas постоянными панелями и рекламными карточками |
| Показывать один следующий шаг в контексте | Ставить восемь равноправных инструментов в bottom nav |
| Называть действие `Сохранено` только после Durable Revision | Называть preview, validation или pin сохранением |
| Использовать текст, outline и shape вместе с цветом | Давать смысл только зелёной/красной точкой |
| Оставлять sheet и header в safe area | Прижимать controls к notch, системной панели или клавиатуре |
| Использовать нейтральную 3D-сцену | Обещать фотореализм, AI, AR или выбор покрытий |
| Адаптировать semantic tokens к host-теме Telegram | Копировать Telegram UI/бренд или требовать Telegram-аккаунт |

## Панели мобильного редактора, 22 ноября

Общий шаблон Telegram берёт геометрию шторки «Размеры». Панель открывается
снизу, учитывает safe area и оставляет одинаковые внешние поля. Заголовок
слева, именованный крестик справа, единая цветовая иерархия, видимый фокус
и цели от 44×44 CSS px. Текст, поля и нижние действия используют общие
края. При длинном содержимом доступна прокрутка. Модальные свойства
предмета блокируют фон. Черновик расстановки оставляет доступ к холсту.
В строке поворота одинаковые стрелки расположены симметрично по сторонам
числового поля. Палитра в 3D сохраняет площадь сцены. Четыре поля «Слева», «Справа», «Сверху»
и «Снизу» образуют одну строку при 320–390 CSS px и стандартном тексте. При
200% сохраняются значения, доступные подписи и размеры целей.
«Статистика» использует переключатели и явное действие «Разрешить» для
дополнительного счётчика рядом с действующей формой. Матрица панелей,
приоритет закрытия и критерии для клавиатуры указаны в
[согласованном пакете](../../sprint-change-proposal-2026-11-22-mobile-editor-finish.md).
