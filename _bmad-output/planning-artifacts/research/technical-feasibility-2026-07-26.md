---
title: Техническая реализуемость mobile-first PWA-редактора интерьеров
status: research-complete
date: 2026-07-26
updated: 2026-07-26
research_type: technical
project: InteriorsEditor
source_verification: primary-sources-and-live-package-registries
---

# Техническая реализуемость mobile-first PWA-редактора интерьеров

## Резюме решения

Продукт технически реализуем как устанавливаемая PWA для телефонов, если не переносить на мобильное устройство ожидания от настольного CAD. Основа Alpha должна быть следующей:

1. **Подтверждено для проекта:** каноническая модель плана — независимый от рендера планарный граф в целых миллиметрах; комнаты являются производными гранями; 3D-сцена — только проекция модели.
2. **Рекомендуется:** WebGL 2 как обязательный графический baseline, Three.js как первый кандидат рендер-ядра, React Three Fiber (R3F) как опциональный React-адаптер, а не как доменная модель.
3. **Рекомендуется:** WebGPU не включать в обязательный Alpha-контур. Его следует исследовать отдельным spike и позднее использовать как progressive enhancement.
4. **Рекомендуется:** curated-каталог заранее оптимизированных GLB; произвольный импорт пользователя не должен быть критическим условием базовой Alpha.
5. **Предварительно:** IndexedDB для документов/журнала, Cache Storage для app shell и повторно скачиваемых ресурсов, storage adapter для бинарных assets с выбором IndexedDB Blob против OPFS после device-spike.
6. **Ключевой технический риск:** не 3D-рендер сам по себе, а детерминированная топология плана — пересечения, 45°-стены, устойчивые `roomId`, дверная смежность, undo/redo и перенос отделки после перестроения комнат.

Итоговая рекомендация не является выбором npm-зависимостей. До реализации обязательны шесть spike: renderer, topology, offline/storage, GLB import, touch UX и asset pipeline.

## 1. Статус утверждений и методика

В документе используются четыре статуса:

| Статус | Значение |
|---|---|
| **Подтверждено** | Факт из исходных требований, project context, стандарта или актуальной первичной документации |
| **Рекомендуется** | Архитектурная рекомендация для InteriorsEditor; требует фиксации в ADR |
| **Предварительно** | Численная гипотеза или кандидат, который нужно проверить spike/benchmark |
| **Открытый вопрос** | Решение, требующее продуктового или технического выбора |

Исследование выполнено 2026-07-26. Для меняющихся фактов использованы официальные спецификации, документация браузеров и библиотек, live npm registry и GitHub. В проекте пока нет `package.json` или lock-файла, поэтому версия в таблице ниже — **снимок доступного `latest`, а не выбранная или установленная зависимость**.

## 2. Платформенная реализуемость: WebGL 2 и WebGPU

### 2.1 Подтвержденные факты

- WebGL остаётся широко доступным web API, но реальная работоспособность зависит от GPU, драйвера и политики браузера; приложение обязано обрабатывать отсутствие и потерю контекста. Практики MDN отдельно требуют учитывать системные лимиты, VRAM, draw calls, high-DPI и context loss: [MDN — WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
- Актуальный `WebGLRenderer` Three.js использует WebGL 2; WebGL 1 не поддерживается с `r163`: [Three.js — WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).
- WebGPU поставляется в отдельных комбинациях Chrome/Firefox/Safari,
  OS и GPU, но не является универсальным mobile baseline; MDN по состоянию на
  срез отмечает API как **Limited availability**:
  [MDN — WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).
- На Android исходная поддержка WebGPU в Chrome появилась для Chrome 121, Android 12+ и Qualcomm/ARM GPU; покрытие расширяется, но зависит от аппаратной конфигурации: [Chrome for Developers — WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview).
- Safari 26 добавил WebGPU на поддерживаемых iOS/iPadOS/macOS: [WebKit — Safari 26 features](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).
- Three.js `WebGPURenderer` умеет fallback на WebGL 2, но официально остаётся experimental и имеет отличия в материалах и post-processing; для чистого WebGL 2 сам Three.js рекомендует стабильный `WebGLRenderer`: [Three.js — WebGPURenderer](https://threejs.org/manual/en/webgpurenderer).
- Babylon.js поддерживает WebGL и WebGPU параллельно; WebGPU доступен с Babylon.js 5.0: [Babylon.js — WebGPU support](https://doc.babylonjs.com/setup/support/webGPU/).

### 2.2 Решение для Alpha

| Вопрос | Решение | Статус |
|---|---|---|
| Обязательная графическая API | WebGL 2 | **Рекомендуется** |
| WebGPU | Feature-detection, отдельный experimental path после spike | **Рекомендуется** |
| Проверка поддержки | Capability detection, не UA-sniffing | **Рекомендуется** |
| Корректность проекта | Не должна зависеть от выбранного GPU backend | **Подтверждено для проекта** |
| Потеря контекста | Восстановление сцены из доменного состояния без потери проекта | **Рекомендуется** |

WebGPU может дать новые возможности, но на Alpha он создаёт дополнительную матрицу различий в renderer/material API именно там, где главным риском является топология. Его раннее включение не закрывает базовую потребность планировщика.

## 3. Матрица Three.js, R3F и Babylon.js

Важно: R3F — React renderer поверх Three.js, а не отдельный 3D-движок. Поэтому сравниваются три реальные сборочные стратегии.

| Критерий | Three.js напрямую | Three.js + R3F | Babylon.js |
|---|---|---|---|
| Контроль lifecycle и памяти | Максимальный, но весь lifecycle пишется вручную | Высокий; lifecycle частично ведёт reconciler | Высокий, много готовых подсистем |
| Связь с React UI | Ручной adapter/imperative bridge | Нативная декларативная интеграция | Ручная или через сторонние bindings |
| Fast gesture state | Прямые мутации без React | Нужны refs/transient store; нельзя обновлять React state на каждом кадре | Прямой engine state |
| On-demand rendering | Реализуется вручную | Поддерживается `frameloop="demand"` | Реализуется через engine render loop policy |
| WebGPU | Новый experimental renderer с WebGL 2 fallback | Зависит от поддержки Three/R3F и выбранного renderer | WebGL/WebGPU поддерживаются side-by-side |
| Готовые engine-функции | Минимальное ядро и большой ecosystem | Three ecosystem + React helpers | Inspector, GUI, loaders и больше engine-level функций |
| Риск vendor/API surface | Низкий/средний | Средний: связка React + R3F + Three | Средний: более широкая engine surface |
| Соответствие кастомному планировщику | Очень высокое | Высокое при строгой изоляции domain | Высокое, но часть возможностей может быть лишней |
| Предварительный итог | Надёжный контрольный вариант | **Первый кандидат для продукта** | Обязательный сравнительный кандидат spike |

Официальные источники: [Three.js](https://github.com/mrdoob/three.js), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [R3F performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls), [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [Babylon.js](https://github.com/BabylonJS/Babylon.js).

### 3.1 Рекомендация

**Рекомендуется** начать renderer-spike с Three.js + R3F, одновременно сохранив прямой Three.js вариант как контрольный:

- React отвечает за shell, панели, формы, каталог, dialogs и доступные числовые controls.
- R3F отвечает только за проекцию render model и события canvas.
- Domain, geometry compiler, commands, persistence и asset metadata не импортируют `THREE.*`.
- Во время drag/pinch/camera fast-state живёт в refs или transient store;
  DraftCommand подтверждается в конце gesture, после чего отдельно проходит
  validation и публикацию Durable Revision.
- Сцена рендерится on-demand вне активной анимации. R3F официально предлагает `frameloop="demand"` и `invalidate()` для такого режима: [R3F — Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance).
- Геометрии, материалы и загруженные assets переиспользуются; mount/unmount тяжёлых объектов во время жеста запрещён.

**Открытый вопрос:** окончательный выбор между direct Three, R3F и Babylon принимается только после одинакового benchmark scene на реальных телефонах.

## 4. Рекомендуемая архитектура

### 4.1 Слои и направление зависимостей

| Слой | Ответственность | Не должен знать |
|---|---|---|
| Domain model | Проект, уровни, вершины, стены, openings, derived rooms, items, finishes | React, Three, IndexedDB |
| Command engine | Атомарные изменения, validation, undo/redo, journal | Canvas gestures, GPU |
| Geometry/topology engine | Пересечения, planar subdivision, room faces, footprints | UI widgets, storage |
| Render compiler | Domain snapshot → render model/meshes | Persistence details |
| Renderer adapter | Three/R3F/Babylon scene, picking, quality tier | Бизнес-правила |
| Persistence ports | Versioned snapshots, journal, migrations, binary asset adapter | Renderer |
| PWA shell | Installability, service worker, update UX, offline bootstrap | Геометрические правила |
| UI/application | Use cases, gestures, commands, accessible numeric alternatives | Низкоуровневое хранение |

**Рекомендуется** применить ports-and-adapters на границах рендера, persistence, importer и clock/id generation, но не превращать каждую функцию в interface. Это позволит заменить renderer или storage backend без изменения формата проекта.

### 4.2 Минимальный доменный словарь

- `Project` — versioned aggregate проекта.
- `Level` — единственная горизонтальная плоскость Alpha; многоуровневая модель
  не проектируется «на будущее».
- `Vertex` — точка плана `{ xMm, zMm }`.
- `WallSegment` — centerline-ребро между двумя вершинами с `thicknessMm`;
  высота выводится из соседних Room.
- `Room` — идентифицированная derived Face с единственной пользовательской
  `heightMm` и производным usable polygon.
- `Opening` — объект, принадлежащий одной стене, с `offsetMm`, `widthMm`, `heightMm`, `sillMm`.
- `RoomFace` — вычисленная ограниченная грань planar graph; не второй изменяемый polygon source.
- `AssetInstance` — ссылка на definition + discriminated floor/wall/ceiling
  placement со stable host + overrides.
- `SurfaceFinish` — ссылка на finish по stable SurfaceAddress пола, потолка или
  стороны стены.
- `AssetRef` — content-addressed ссылка на asset version.

### 4.3 Команды и консистентность

**Подтверждено для проекта:**

- любое изменение выполняется атомарной domain command;
- команда либо создаёт полностью валидный snapshot, либо не меняет проект;
- undo/redo применяется только к Commands, чьи Revision стали Durable;
- активный gesture отменяется отдельно;
- autosave/UI `saved` видит только Durable state; validated candidate остаётся
  `PendingDurability`.

**Рекомендуемый command set для технического ядра Alpha:**

`AddWall`, `MoveVertex`, `SplitWall`, `DeleteWall`, `SetWallThickness`,
`SetRoomProperties`, `AddOpening`, `MoveOpening`, `DeleteOpening`, `PlaceItem`,
`TransformItem`, `RemoveItem`, `SetSurfaceFinish`, `SetMaterialOverride`.

## 5. Координаты, grid и топология

### 5.1 Миллиметры и метры

Формат glTF использует правую систему координат, `+Y` вверх, а линейные расстояния задаёт в метрах: [Khronos — glTF 2.0, Coordinate System and Units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units).

**Подтверждено для проекта:** domain хранит целые миллиметры.

**Рекомендуется:**

```text
domain:  { xMm, yMm, zMm } ∈ integer
render:  { x: xMm / 1000, y: yMm / 1000, z: zMm / 1000 } ∈ meter
```

- Горизонтальная плоскость — `X/Z`, вертикаль — `Y`.
- Конвертация выполняется один раз на границе render/import adapter.
- В domain запрещены накопительные float-transform.
- Для imported asset исходный glTF остаётся в метрах; нормализованный `dimensionsMm` и placement metadata вычисляются отдельно.
- Повороты экземпляров хранятся либо как дискретный angle unit, либо как нормализованное значение с явно заданной точностью; не как накопленный float после каждого gesture.

### 5.2 Что означает grid

Термин «гридфинити» в исходном описании неоднозначен. **Предварительная интерпретация:** бесконечный snap-grid, а не физический стандарт Gridfinity.

Для Alpha допустимы направления:

```text
dx = 0                         — вертикаль плана
dz = 0                         — горизонталь плана
abs(dx) = abs(dz)              — диагональ 45°
```

**Рекомендуется:**

- хранить endpoints, а не округлённую длину диагонали;
- показывать длину диагонали как вычисленную `sqrt(dx² + dz²)` с UX-округлением, не записывая её обратно;
- сделать `gridStepMm` конфигурацией проекта; начальная гипотеза — 100 мм;
- numeric edit может задавать миллиметры, но wall-direction validator сохраняет набор `0°/45°/90°`;
- вычислять пересечения 0/45/90 в рациональной арифметике. Если пересечение попадает в половину миллиметра, команда должна быть отклонена либо grid-инвариант должен быть пересмотрен в ADR; тихое округление запрещено.

### 5.3 Planar graph и комнаты

**Рекомендуемый алгоритмический spine:**

1. Snap нового endpoint.
2. Проверка направления и нулевой длины.
3. Нахождение всех пересечений с существующими рёбрами.
4. Создание общей вершины на каждом валидном пересечении.
5. Атомарное разбиение затронутых стен.
6. Удаление zero-length и duplicate edges.
7. Построение half-edge/DCEL-представления.
8. Извлечение ограниченных граней; внешняя грань не является комнатой.
9. Сопоставление новых граней со старыми `roomId`.
10. Перенос room finishes/metadata только после однозначного match.

Полезные низкоуровневые кандидаты, не готовая доменная модель:

- [robust-predicates](https://github.com/mourner/robust-predicates) — устойчивые геометрические predicates;
- [Earcut](https://github.com/mapbox/earcut) — triangulation валидных floor/ceiling polygons;
- [Martinez polygon clipping](https://github.com/w8r/martinez) — кандидат для polygon boolean/overlap после отдельного spike;
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) — ускорение picking/raycast, если profiling докажет необходимость.

Ни одна из этих библиотек не заменяет правила planar graph, стабильность identity и command validation.

### 5.4 Стабильность `roomId`

Это обязательный до-Alpha spike. Простая нумерация граней после каждого rebuild приведёт к «прыгающей» отделке и дверным переходам.

**Рекомендуемый кандидат:**

- сначала exact match по signature нормализованного boundary;
- затем maximum-overlap matching между old/new faces;
- при split одна новая грань наследует old `roomId` по наибольшему overlap, остальные получают новые ID;
- при merge survivor выбирается детерминированно, остальные room IDs записываются в command history;
- неоднозначный match не скрывается: command result содержит migration event, который тестируется fixture.

### 5.5 Стены, углы и openings в 3D

**Рекомендуется:**

- хранить wall centerline + thickness; render compiler строит offset contour;
- явно определить miter/bevel/cap для L/T/X и 45° junctions;
- двери и окна якорятся на wall parameter, а не на мировые координаты;
- doorway создаёт ребро room-adjacency graph, exterior door соединяет комнату с `Outside`;
- в Alpha не использовать runtime CSG для каждой двери. Компилировать стену из детерминированных сегментов вокруг openings;
- collision/placement строить по 2D footprint + диапазону высоты. Полноценный physics engine для Alpha не нужен.

## 6. Offline-first PWA и хранение

### 6.1 Подтвержденные платформенные факты

Google рекомендует Cache Storage для сетевых ресурсов приложения, OPFS для file-based content и IndexedDB для остальных структурированных данных; все три доступны в современных браузерах: [web.dev — Storage for the web](https://web.dev/articles/storage-for-the-web).

OPFS является origin-private, подчиняется quota, удаляется при очистке site data и не является пользовательской резервной копией: [MDN — Origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

WebKit указывает, что standalone Home Screen app получает те же quota-классы, что браузерное приложение, но storage по умолчанию best-effort и может быть evicted при pressure/LRU; доступны `estimate()` и запрос persistent mode: [WebKit — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

Service worker lifecycle обычно удерживает старую и новую версии раздельно;
преждевременный `skipWaiting()` может смешать app version и storage schema.
При этом корректность нельзя строить на обещании, что waiting worker удастся
удержать между закрытиями clients: automatic activation должна быть безопасна
через version handshake и migration boundary. Источник:
[web.dev — Service worker lifecycle](https://web.dev/articles/service-worker-lifecycle).

### 6.2 Рекомендуемое распределение данных

| Данные | Хранилище | Политика |
|---|---|---|
| HTML/JS/CSS/icons/app shell | Cache Storage + versioned service worker | Precache; безопасное обновление |
| Browse-only/неиспользуемый каталог | Cache Storage | Version/hash; LRU допустим |
| Exact resources, referenced Durable Project | Content-addressed blob adapter | Pin до Durable placement; BackupFeasibilityPolicy; LRU запрещён |
| Project metadata, snapshots, journal | IndexedDB | Приложение не очищает автоматически; external eviction обрабатывается через backup restore |
| Большие GLB/KTX2/preview blobs | Storage adapter: OPFS или IndexedDB Blob | Выбор после spike |
| User preferences | IndexedDB | Не `localStorage` в hot path |
| Portable backup | Самодостаточный `.interiors` export | Пользователь владеет exact referenced resources |

### 6.3 Save/update protocol

**Рекомендуется:**

1. `gesture → DraftCommand → full validation → PendingDurability`;
2. записать staging revision/journal с project schema version;
3. проверить checksum snapshot и asset references, затем атомарно переключить
   current pointer;
4. только после этого назвать Revision `Durable`, опубликовать HistoryEntry и
   разрешить следующую mutating Command;
5. compact snapshots выполняются без удаления last Durable/recovery state;
6. при запуске — recovery последней Durable Revision и очистка недостижимого
   staging;
7. migration только forward, idempotent/copy-on-write, с fixtures прежних
   версий;
8. startup сверяет ReleaseManifest и schema независимо от того, waiting или
   автоматически activated service worker;
9. активный UI предлагает reload только после Durable boundary, но automatic
   activation остаётся recoverable;
10. повреждённая запись не перезаписывает последнюю валидную копию.

**Alpha offline acceptance:** установленная PWA в airplane mode открывает существующий проект, позволяет редактировать, сохранять, закрывать и повторно открыть его со всеми уже закэшированными assets.

**Обязательная продуктовая гарантия:** браузерное storage не считается backup. Alpha предоставляет portable export/import проекта.

## 7. GLB import и asset pipeline

### 7.1 Политика формата

glTF — runtime asset delivery format, а GLB позволяет держать JSON и бинарные ресурсы в одном контейнере: [Khronos — glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

**Рекомендуется для первой версии импорта:**

- только `.glb` glTF 2.0;
- никаких внешних URI;
- только static meshes;
- запрет animations, skins, morph targets, cameras и lights;
- core metallic-roughness PBR;
- allowlist extensions: `KHR_texture_transform`, `KHR_mesh_quantization`, `EXT_meshopt_compression`, `KHR_draco_mesh_compression`, `KHR_texture_basisu`;
- неизвестная extension из `extensionsRequired` — reject;
- parse/decode в worker с cancel и timeout;
- Khronos validator до добавления в проект: [glTF Validator](https://github.com/KhronosGroup/glTF-Validator);
- MIME/extension не считаются доказательством содержимого. OWASP рекомендует allowlist, signature/content validation и лимиты до и после распаковки/декодирования: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

### 7.2 Предварительные лимиты импортируемого объекта

Это исторический research snapshot стартовых benchmark hypotheses, а не
нормативная policy. После создания SPEC единственным владельцем provisional и
финальных значений является
[`asset-import-contract.md`](../../specs/spec-interiors-editor-alpha/asset-import-contract.md);
таблица ниже не используется validator-ом и сохраняется как evidence
исследовательской неопределённости.

| Ресурс | Стартовый предел | Статус |
|---|---:|---|
| Размер GLB на диске | 25 MiB | **Предварительно** |
| Triangles | 250 000 | **Предварительно** |
| Vertices | 500 000 | **Предварительно** |
| Nodes | 128 | **Предварительно** |
| Primitives | 32 | **Предварительно** |
| Materials | 16 | **Предварительно** |
| Textures | 8 | **Предварительно** |
| Размер одной texture | 2048×2048 | **Предварительно** |
| Суммарные texture pixels | 8 megapixels | **Предварительно** |
| Bounding box по каждой оси | 1–20 000 мм | **Предварительно** |
| Worker processing | cancellable; целевой timeout 15 s | **Предварительно** |

Размер файла не является оценкой памяти. Обычная texture в WebGL приблизительно занимает `width × height × 4 × 1.33` bytes независимо от размера JPG/PNG на диске: [Three.js — Textures / Memory Usage](https://threejs.org/manual/en/textures.html).

Worker обеспечивает cancel и отзывчивость, но не hard memory quota. Нормативный
pipeline поэтому требует byte-level preflight до loader/decoder и deny-network
resource resolver.

При удалении imported asset приложение обязано явно освобождать geometry, material, texture и `ImageBitmap`; Three.js не делает это автоматически для всех ресурсов: [Three.js — How to dispose of objects](https://threejs.org/manual/en/how-to-dispose-of-objects.html).

### 7.3 Curated asset pipeline

**Рекомендуемый CI pipeline:**

```text
Blender/source
→ GLB export
→ Khronos validation
→ normalize units/origin/facing
→ prune/dedup/weld
→ mesh optimization (Meshopt или Draco по профилю)
→ texture resize + KTX2/Basis
→ footprint/anchors/clearance metadata
→ thumbnail
→ manifest + content hash + license
→ device benchmark gate
→ catalog publish
```

Кандидаты инструментов:

- [glTF Transform](https://github.com/donmccurdy/glTF-Transform) — inspect/transform/optimize;
- [meshoptimizer](https://github.com/zeux/meshoptimizer) — geometry/mesh compression;
- [KTX-Software](https://github.com/KhronosGroup/KTX-Software) — KTX2 validation/encoding;
- [glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) — проверочные assets;
- [glTF Validator](https://github.com/KhronosGroup/glTF-Validator) — conformance gate.

Обязательные catalog metadata:

`assetId`, `version`, `contentHash`, `dimensionsMm`, `footprint`, `placementClass`, `pivot`, `frontVector`, `snapPlanes`, `clearanceEnvelope`, `recolorableMaterialSlots`, `thumbnail`, `lodRefs`, `license`, `attribution`.

**Рекомендуется:** Alpha закрывает базовую потребность curated-каталогом. User import можно включить feature flag после стабильных topology/persistence flows; его отсутствие не должно блокировать ручное планирование комнаты.

## 8. Mobile performance budgets

### 8.1 Подтвержденные ограничения

На мобильных критичны:

- framebuffer/high DPR: трёхкратный DPR означает до девятикратного числа pixels; Three.js прямо рекомендует ограничивать внутреннее разрешение тяжёлой 3D-сцены: [Three.js — Responsive design / HD-DPI](https://threejs.org/manual/en/responsive.html);
- texture memory и bandwidth;
- draw calls, material/shader switches и overdraw;
- main-thread stalls во время gesture;
- thermal throttling и battery drain;
- WebGL context loss и iOS process termination;
- явное освобождение GPU/CPU ресурсов.

### 8.2 Стартовые benchmark gates

Все числа ниже — **предварительные бюджеты**, которые renderer-spike должен подтвердить или заменить.

| Метрика | Стартовая цель |
|---|---:|
| Frame time во время drag, p95 | ≤ 33.3 ms (не ниже устойчивых 30 FPS) |
| Цель на high-tier reference phone | 60 FPS при обычной сцене |
| Touch-to-visible-update, p95 | ≤ 100 ms |
| Blocking main-thread task во время gesture | < 50 ms |
| Draw calls в reference scene | ≤ 200–250 |
| Видимые triangles | ≤ 750 000 |
| Оценка scene GPU resources для low/mid tier | ≤ 128 MiB |
| Render DPR | 1.0–1.5 low/mid; максимум 2.0 high |
| Warm offline open до editable state | ≤ 1.5 s |
| Cold open на mid-tier reference | ≤ 3 s |
| Thermal run | 10–15 минут непрерывного редактирования |

**Рекомендуемый adaptive quality ladder:**

- tier выбирается не только по названию GPU, но и по наблюдаемому frame time;
- динамический render scale;
- shadows off на low tier, ограниченный один shadow-caster на high;
- без SSAO/bloom/post-processing в Alpha baseline;
- instancing для повторяющихся catalog assets;
- LOD или simplified proxy для тяжёлых объектов;
- on-demand render в idle;
- background decode и incremental scene attach;
- degradation не меняет точность domain model.

## 9. Стратегия тестирования

### 9.1 Domain и topology

Основная часть геометрии должна тестироваться без DOM и GPU.

Обязательные property/invariant tests:

- `apply(command) → undo` возвращает идентичный serialized state;
- serialize/deserialize roundtrip сохраняет семантику;
- snap idempotent;
- каждая wall direction принадлежит 0/45/90-набору;
- нет zero-length/duplicate walls;
- каждое пересечение представлено общей вершиной;
- bounded room face имеет положительную площадь;
- opening принадлежит ровно одной wall и не выходит за её допустимый интервал;
- локальная команда не меняет несвязанные части проекта;
- mm↔meter roundtrip сохраняет целые миллиметры в допустимом диапазоне;
- failed command не меняет snapshot.

Кандидат для property-based tests: [fast-check](https://github.com/dubzzz/fast-check).

Golden corpus должен включать:

- rectangle и concave room;
- L/T/X junctions;
- 45° wall и пересечение диагоналей;
- half-millimeter intersection rejection;
- дверь рядом с углом;
- shared wall и exterior door;
- split/merge room с проверкой `roomId`;
- opening resize;
- wall thickness/miter edge cases;
- delete wall, превращающий две комнаты в одну.

### 9.2 Остальные уровни

| Уровень | Что проверяет | Инструмент-кандидат |
|---|---|---|
| Unit/property | Domain, commands, geometry, migrations | Vitest + fast-check |
| Browser component | Touch/DOM controls, accessible numeric edit | [Vitest Browser Mode](https://vitest.dev/guide/browser/) |
| Renderer integration | Mesh compilation, picking, disposal, context restore | Real browser + deterministic fixtures |
| Import corpus | Valid/invalid GLB, extension policy, cancellation, memory cleanup | Validator + worker integration tests |
| PWA E2E | Install bootstrap, airplane mode, update, migration, quota error | [Playwright](https://playwright.dev/docs/browsers) + manual device tests |
| Visual | Stable reference views с небольшим tolerance | [Playwright snapshots](https://playwright.dev/docs/test-snapshots) |
| Performance | Frame time, draw calls, memory estimate, thermal run | Instrumented reference devices |

Playwright device emulation полезна для viewport/input, но не заменяет физический iPhone/iPad/Android: она не воспроизводит реальный GPU, память, thermal throttling, Home Screen lifecycle и Safari OS integration.

### 9.3 Обязательная device matrix

Перед Alpha нужно закрепить не менее:

- один поддерживаемый iPhone low/mid tier;
- один современный iPhone;
- один Android low/mid tier;
- один Android high tier;
- при поддержке планшетов — один iPad;
- Safari standalone PWA и Chrome Android installed PWA.

Модели устройств и минимальные OS versions являются **открытым продуктовым решением** и должны попасть в NFR/compatibility policy.

## 10. Обязательные технические spike

### Spike 1 — Renderer selection

**Сравнить:** direct Three.js, Three.js + R3F, Babylon.js.

**Одинаковая сцена:** 4 комнаты, 50–100 предметов, 20+ materials, doors/openings, floor/wall textures, selection outline и drag.

**Измерить:** cold/warm load, bundle split, frame p50/p95, draw calls, texture/geometry count, DPR scaling, idle battery behavior, context restore, cleanup после смены проекта.

**Exit:** один renderer выбран; причины и rejected alternatives зафиксированы в `ADR-001-renderer-and-react-binding.md`.

### Spike 2 — Topology kernel

**Реализовать только прототип:** integer-mm 0/45/90 graph, intersections, half-edge faces, room identity, door adjacency, undo.

**Exit:** весь golden corpus проходит; определена политика half-mm intersections и split/merge identity; `ADR-002-coordinate-and-topology-model.md`.

### Spike 3 — Offline/storage

**Проверить:** IndexedDB snapshot/journal, OPFS против IndexedDB Blob, quota
estimate/persist, airplane-mode reopen, corrupt record recovery, iOS
browser↔Home Screen handoff, writer lease/fencing, automatic service-worker
activation и ReleaseManifest/schema handshake.

**Exit:** одинаковый project fixture переживает kill/restart/update и context
handoff на iOS/Android без потери Durable state; stale writer не публикует
Revision; `ADR-003-persistence-and-recovery.md`.

### Spike 4 — GLB import

**Corpus:** небольшие/граничные/сломанные GLB, неизвестные required extensions, огромные texture dimensions, Meshopt/Draco/KTX2, cancellation, repeated import/delete.

**Exit:** подтверждены реальные limits и cleanup; importer никогда не блокирует UI без возможности отмены; `ADR-004-glb-policy-and-budgets.md`.

### Spike 5 — Touch UX

**Проверить одной рукой и двумя:** создание стены, drag vertex, numeric dimensions, размещение/поворот мебели, установка двери, переход через дверь, undo, cancel gesture.

**Exit:** базовый сценарий выполним без hover/keyboard, DOM controls имеют touch target не меньше 44×44 CSS px, каждое критическое canvas-действие имеет числовую/доступную альтернативу; `ADR-005-mobile-interaction-model.md`.

### Spike 6 — Asset pipeline

**Проверить:** один furniture set от source до manifest, включая validation, optimization, KTX2, footprint, recolor slots, thumbnail и license metadata.

**Exit:** pipeline воспроизводим в CI, scene budget измерим до публикации asset; `ADR-006-asset-pipeline.md`.

## 11. Снимок версий пакетов на 2026-07-26

Источник — live npm registry `dist-tags.latest`, проверенный 2026-07-26. Это research snapshot; перед созданием приложения версии нужно повторно проверить, совместимость подтвердить минимальным проектом и затем зафиксировать lock-файлом.

| Назначение | Пакет | `latest` на дату среза | Статус |
|---|---|---:|---|
| Язык | [typescript](https://www.npmjs.com/package/typescript) | 7.0.2 | кандидат |
| UI runtime | [react](https://www.npmjs.com/package/react) | 19.2.8 | кандидат |
| Build | [vite](https://www.npmjs.com/package/vite) | 8.1.5 | кандидат |
| React/Vite | [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | 6.0.4 | кандидат |
| 3D engine | [three](https://www.npmjs.com/package/three) | 0.185.1 | первый кандидат |
| React adapter | [@react-three/fiber](https://www.npmjs.com/package/@react-three/fiber) | 9.6.1 | spike |
| R3F helpers | [@react-three/drei](https://www.npmjs.com/package/@react-three/drei) | 10.7.7 | выборочно |
| UI/transient state | [zustand](https://www.npmjs.com/package/zustand) | 5.0.14 | кандидат |
| Alternative engine | [@babylonjs/core](https://www.npmjs.com/package/@babylonjs/core) | 9.18.0 | spike |
| IndexedDB wrapper | [idb](https://www.npmjs.com/package/idb) | 8.0.3 | кандидат |
| PWA integration | [vite-plugin-pwa](https://www.npmjs.com/package/vite-plugin-pwa) | 1.3.0 | кандидат |
| SW client | [workbox-window](https://www.npmjs.com/package/workbox-window) | 7.4.1 | кандидат |
| glTF processing | [@gltf-transform/core](https://www.npmjs.com/package/@gltf-transform/core) | 4.4.2 | asset pipeline |
| glTF validation | [gltf-validator](https://www.npmjs.com/package/gltf-validator) | 2.0.0-dev.3.10 | осторожно: `latest` имеет dev-version |
| Mesh optimization | [meshoptimizer](https://www.npmjs.com/package/meshoptimizer) | 1.2.0 | pipeline/import candidate |
| Property tests | [fast-check](https://www.npmjs.com/package/fast-check) | 4.9.0 | кандидат |
| Test runner/browser mode | [vitest](https://www.npmjs.com/package/vitest) | 4.1.10 | кандидат |
| E2E | [@playwright/test](https://www.npmjs.com/package/@playwright/test) | 1.62.0 | кандидат |
| Triangulation | [earcut](https://www.npmjs.com/package/earcut) | 3.2.3 | spike |
| Robust predicates | [robust-predicates](https://www.npmjs.com/package/robust-predicates) | 3.0.3 | spike |
| Polygon operations | [martinez-polygon-clipping](https://www.npmjs.com/package/martinez-polygon-clipping) | 0.8.1 | spike |
| Raycast acceleration | [three-mesh-bvh](https://www.npmjs.com/package/three-mesh-bvh) | 0.9.13 | только после profiling |

Не следует устанавливать всю таблицу. В частности, Three/R3F и Babylon — взаимоисключающие результаты renderer-spike, а BVH/polygon packages добавляются только при доказанной необходимости.

## 12. Регистр технических рисков

| Риск | Вероятность/влияние | Ранний сигнал | Снижение |
|---|---|---|---|
| Нестабильные `roomId` | высокое/критическое | «прыгает» отделка после стены | topology spike + overlap fixtures |
| Ошибки 45° junction | высокое/высокое | cracks/self-intersection | exact rules + golden corpus |
| GPU memory/context loss | высокое/высокое | black canvas/reload | budgets, disposal, restore |
| Storage eviction | среднее/критическое | пропал local project | export backup, persist request, recovery |
| SW/schema mismatch | среднее/критическое | проект не открывается после deploy | ReleaseManifest handshake + version-tolerant read + migration gate |
| GLB decompression bomb | среднее/высокое | freeze/OOM при малом файле | decoded limits, worker, cancel |
| Каталог раздувает scope | высокое/высокое | контент блокирует Alpha | curated starter set + pipeline |
| Touch UX непригоден | высокое/критическое | нужен desktop/keyboard | physical-device UX spike |
| WebGPU churn | среднее/среднее | разные renderer bugs | WebGL 2 baseline |
| Лицензии assets | среднее/высокое | нет attribution/source | mandatory license metadata |

## 13. Финальная техническая рекомендация

До реализации следует утвердить:

1. `WebGL 2 baseline`, WebGPU enhancement-only.
2. Pure TypeScript domain + command engine в integer mm.
3. Planar graph как единственный источник плана; derived room faces.
4. Renderer adapter, не допускающий `THREE.Object3D` в domain.
5. Renderer-spike с первым кандидатом Three + R3F и контрольными direct Three/Babylon.
6. Offline-first save/recovery с portable export.
7. Curated GLB catalog; user import не является блокером Alpha.
8. Численные limits только после benchmark на утверждённой device matrix.
9. Никакого product implementation до успешного topology/offline/touch spike и BMAD readiness gate.

## 14. GitHub-репозитории для изучения

### Производственные кандидаты

- [mrdoob/three.js](https://github.com/mrdoob/three.js)
- [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js)
- [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber)
- [pmndrs/drei](https://github.com/pmndrs/drei)
- [pmndrs/zustand](https://github.com/pmndrs/zustand)
- [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox)
- [vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)
- [KhronosGroup/glTF-Validator](https://github.com/KhronosGroup/glTF-Validator)
- [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform)
- [zeux/meshoptimizer](https://github.com/zeux/meshoptimizer)
- [KhronosGroup/KTX-Software](https://github.com/KhronosGroup/KTX-Software)
- [dubzzz/fast-check](https://github.com/dubzzz/fast-check)
- [vitest-dev/vitest](https://github.com/vitest-dev/vitest)
- [microsoft/playwright](https://github.com/microsoft/playwright)

### Только как архитектурные и UX-референсы

- [charmlinn/blueprint3d-modern](https://github.com/charmlinn/blueprint3d-modern) — близкий функциональный референс, но на дату среза всего 10 commits; roadmap ещё содержит unit tests, GLB, undo/redo, multi-room и mobile gesture improvements. Не использовать как production foundation без полного аудита.
- [furnishup/blueprint3d](https://github.com/furnishup/blueprint3d) — исторический floor-planner reference; последняя push-активность, проверенная через GitHub, относится к 2021 году.
- [mehanix/arcada](https://github.com/mehanix/arcada) — референс 2D floor-plan UX и React/Pixi подхода.
- [cvdlab/react-planner](https://github.com/cvdlab/react-planner) — референс plan-editor interaction и 2D→3D flow.
- [xiangechen/chili3d](https://github.com/xiangechen/chili3d) — референс browser CAD, command/undo и модульной архитектуры; OpenCascade/CAD scope для InteriorsEditor Alpha избыточен, лицензия AGPL требует отдельной правовой оценки.
- [Three.js editor](https://github.com/mrdoob/three.js/tree/dev/editor) — референс инспектора и scene commands, но не mobile-first product template.
