# Контракт взаимодействия редактора, сетки и presentation-проекций

Статус: **Alpha draft**. Этот companion уточняет пользовательскую поверхность
уже принятых `CAP-2`, `CAP-4`–`CAP-7`. Он не вводит вторую геометрическую
модель, не авторизует V1/V2 и не является implementation/readiness evidence.

## 1. Единое выделение и прямое редактирование

`Plan 2D` и `3D` показывают одну Selection. Переключатель этих видов постоянно
доступен в EditorTopBar и не скрывается в submenu; само переключение не
создаёт Command или Revision.

Выбранный floor AssetInstance в 2D имеет читаемую локальную front-marker, а в
3D — эквивалентный selected outline/front-marker. Направление — существующий
дискретный `RotationStep`: положительные 45° повороты вокруг `+Y` от локальной
оси `+Z`. Ни SVG, ни WebGL object не владеют поворотом.

Drag одного выбранного предмета в 2D или 3D создаёт только
`PlacementPreview`: выбранный host floor, grid-snapped position, rotated
footprint, коллизии и допустимые клетки. До confirm/release preview не входит
в Project, History или backup. Его подтверждение идёт через одну canonical
`MoveFloorPlacement`/`RotateFloorPlacement` Command с normal base/fence,
host/footprint, collision, inverse and durability validation. Rejected/stale/
cancelled preview не меняет Project.

На телефоне удержание пустого холста дольше порога pan (`180 ms` в текущем UX
contract) переводит жест в pan; движение до его истечения продолжает действие
активного инструмента. Второй pointer всегда принадлежит pinch/pan, не
подтверждает Wall/Opening/Placement draft. У ActionDock есть один явный `Рука и
выбор` DOM-control: tap объекта selects, drag selected object показывает
PlacementPreview, а long press/drag пустого холста pan-ит; accessibility
никогда не зависит только от long press.

## 2. Construction grid

Gridfinity здесь означает редакторскую construction grid, не формат хранения.
Непрерывная 100-mm minor lattice видна и внутри каждой usable Room; zoom меняет
только плотность major-lines и контраст, но не step active gesture.

Для orthogonal 100-mm Wall grid phase выбирается так, чтобы внешние края стены
совпадали с линиями одной minor cell; пунктиром обозначаются только dimension
guides/preview, не physical wall. Wall centerline, face и usable polygon всё
равно остаются canonical integer-mm geometry.

Touch Wall, Opening offset и FloorPlacement по умолчанию snap-ятся к этой
100-mm lattice. Exact numeric input по-прежнему допускает valid off-grid mm
значение из `geometry-contract.md`; UI показывает его как exact non-grid и не
скрытно переписывает на cell value. Диагональная 45° Wall не может полностью
занять квадратную cell без искажения geometry: UI показывает точную diagonal
centerline и construction step guide, но не делает ложного заявления о полном
cell cover.

Reachability preview перечисляет только grid positions, на которых весь
rotated Footprint лежит внутри usable Floor host и не пересекает blocking
footprint. Это visual aid, не отдельный collision cache or persisted grid.

## 3. Размеры и стены

Physical Wall рисуется сплошным body с видимой толщиной. Dimension layout —
отдельная revision-bound projection:

- label пытается занять свободную область внутри measured Room/segment;
- если label не помещается или пересекает Wall/другой label, он выносится за
  object с tick/leader guide, как CAD annotation;
- display text получает только `MeasurementFormatPolicy`; annotation placement
  не меняет source length/area/perimeter.

Wall создаётся только explicit non-zero drag от start до endpoint либо exact
numeric input. Простое касание в существующей Room или свободном canvas
заканчивается без wall candidate и без durable effect. Valid segment может
начаться вне existing Room; Room появляется только после derived closed Face.
Явные `Свойства` выбранной стены дают `Удалить стену` для любого WallSegment;
выбор сам не открывает panel. Если удаление открывает
или уничтожает Face, меняет Opening или host, UI показывает complete
`ConflictPreview`; closed contour сам по себе не делает Wall undeletable.
Before preview/commit, closed swept wall body проверяется против retained
rotated item footprints: overlap даёт visible `WALL_ITEM_COLLISION` и не
перемещает предмет.

После reopen контур с bounded faces, но отсутствующей Room metadata, проходит
узкий current-schema reconciliation до показа редактора: его derived rooms,
2D floor tiles и доступность `3D` должны наблюдать один и тот же PlanGraph.
Открытый/невалидный план либо любой план с asset/opening host остаётся без
silent repair и следует обычному visible recovery/editing route.

В UI комната идентифицируется по типу; пользователь может изменить тип и
высоту через доступный маршрут. Поля редактирования имени и исторического имени
на плане нет. Сохранённое `Room.name` остаётся для совместимости: изменение
типа или высоты не переписывает его, повторное открытие сохраняет его (FR-16,
REL-05). Это не добавляет выбор Room на холсте и не меняет schema.

Автоматическое разделение Wall segments при допустимых точных контактах и
перемещение Vertex сохраняются. Отдельный жест `Разделить стену` отсутствует,
как и текущий числовой split выбранной стены; доменная нормализация и совместимость
уже разделённых стен сохраняются (FR-9, REL-08).

## 4. Проёмы

ActionDock открывает `Добавить проём` только после выбора совместимой Wall; sheet
сначала предлагает `Дверь` или `Окно`, затем показывает host Wall, 100-mm-grid
offset, width and clearance. `AddOpening`, move, resize и delete остаются
canonical wall-hosted commands: Opening не может покинуть usable Wall interval
или overlap incompatible Opening. Door и Window не создают navigation
semantics. Open/close/lock/key state не входит в Alpha. При перемещении
Opening confirm/cancel не содержит полей редактирования размеров; размеры и
host сохраняются, пока позиция меняется в допустимом интервале (FUP-06).

## 5. Нейтральный пол и каталог

Пол и стены показываются только нейтральной display-проекцией derived Room.
Она не имеет `Floor(RoomId)`/`WallSide`, ресурса, picker-а или Durable command:
никакой пользовательский выбор покрытия не входит в Alpha.

Внутренний greybox catalog не выдаёт изометрический рисунок за 3D preview.
Каждая карточка показывает предмет на neutral floor через тот же WebGL2
projection/rendering family, что и редактор: canonical dimensions, local
forward direction and bounded procedural silhouette. Внутренний preset
остаётся procedural placeholder, а не CatalogAsset или commercial SKU.

## 6. Единый ActionDock

У нижнего safe edge canvas находится один floating ActionDock — единая
командная поверхность редактора. `Plan 2D` / `3D` остаётся в EditorTopBar;
постоянная часть dock — `Рука и выбор`, а контекстная показывает максимум три
действия. На пустом Plan это `Комната`, `Стена`, `Предмет`; у выбранной Wall —
`Добавить проём`, `Свойства`; у выбранного floor AssetInstance — `Повернуть`,
`Свойства`, у wall AssetInstance — `Свойства`; в PlacementPreview — `Поставить`,
`Отмена`. Команды удаления в dock нет; удаление доступно через свойства. Undo/Redo
доступны как подписанные edge-controls, когда соответствующая command есть.

Отдельных `Выбор`/`Рука`, `Фокус`, fullscreen/viewport control и duplicate
`Опции` submenu не существует. `Добавить проём` недоступно до selection
compatible Wall. Dock не накрывает active selection/property card, имеет
44×44 CSS px DOM controls, visible active state и text/name alternative.

Нажатие предмета открывает его property card near the selection; оно не
является отдельной вкладкой командной поверхности. Card допускает label/allowed size/rotation
только через commands, а layout не закрывает selected footprint or canvas.

## 7. Acceptance evidence

Вертикальный canonical slice доказывает минимум:

1. Floor item move/rotate in both 2D and 3D gives identical durable
   placement/RotationStep, inverse and reload projection.
2. Every default touch placement is 100-mm snapped and rejects collision or
   outside-host state without allocation/publication; off-grid numeric value
   remains explicit and follows the same full validation.
3. Solid wall + dashed annotation, leader fallback, pan/pinch arbitration and
   ActionDock are verified in mobile browser tests.
4. General-wall and every-wall-delete corpus covers detached/connected
   segments, no-intent tap, item-body reject and face/host conflict re-entry;
   Door/Window then passes topology/Opening corpus, 2D/3D projection and valid
   Opening validity before a UI claim; retired Walk adjacency is not restored.
5. Shared neutral floor/wall display projection remains continuous over derived
   connected tiles and exposes neither a Room finish picker nor a durable
   surface-assignment command.
6. Catalog preview uses a renderer-family scene and cannot place/mutate a
   Project until user confirms a compatible placeholder/asset route.
7. Reopen regression seeds a saved closed contour with empty Room metadata and
   proves one repair Revision, derived room count and enabled 3D; simultaneous
   controller opens cannot duplicate or discard that result.
