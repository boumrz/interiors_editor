# Чистый 3D, поворот до установки и устойчивый кадр

25 октября 2026. Контракты до кода:
[clean viewport](../../../../../_bmad-output/implementation-artifacts/spec-dimension-filters-clean-viewport-2026-10-25.md),
[E4/E6](../../../../../_bmad-output/implementation-artifacts/spec-editor-refinements-gost-2026-10-25.md).
Без commit/push, публикации или очистки пользовательского хранилища. Эти
результаты — focused verification; общие итоговые QA/PWA/build ведёт root.

## Что изменилось

- Из RoomScene3d удалены объясняющие карточки, +Z, инструкции обзора,
  «Только для обзора», GLB loading/success cards и положительные placement prompts.
  Состояние cutaway/renderer/item count осталось в настоящих hidden outputs.
  Имя предмета, invalid feedback, камера, ±45°, полусфера, отмена/подтверждение,
  WebGL/GLB errors, retry и 2D fallback сохранены.
- Общий AppShell draft yaw используется до выбора точки и при preview.
  После появления preview полусфера доступна сразу. Placement gesture имеет
  отдельный target, не вызывает controller редактирования сохранённого item;
  shared callback меняет только draft. Cancel возвращает исходный угол.
  Подтверждение публикует один выбранный yaw через обычную команду.
- Устранён ложный выбор preview при `undefined === undefined` asset ID.
  Нулевой selected ID теперь не подменяет сохранённый предмет черновиком.
- В коротком viewport menu имеет ограниченную высоту и прокрутку; cap учитывает
  реальные header/menu bounds. Touch targets сохраняют CSS-pixel размер.
- Пустая комната раньше использовала raw renderer, а первый catalog/custom GLB
  переключал всю комнату на Three. Обычные сцены теперь используют Three с
  первого кадра. При ошибке инициализации Three выбирается raw fallback;
  повторная тяжёлая инициализация не выполняется на каждом camera frame.
- Raw fallback перед каждым кадром устанавливает default framebuffer/VAO,
  viewport, depth range/function/write mask, color write mask, отключает
  scissor/blend/cull/stencil/polygon-offset/rasterizer-discard и очищает color/depth.
  Перед geometry attribute setup явно привязывается собственный vertex buffer.

## RED → GREEN и проверки

1. Cleanup: 5 unit RED и 3 browser RED до production changes; затем GREEN.
2. Draft rotation: unit RED и 2 browser RED до production changes.
   Отдельный реальный RED — menu закрыл touch point на 360×480/200%; исправлен
   bounded scroll и измерением cap bounds. Context loss оставлял 315° вместо
   исходных 0°; отдельный RED исправлен восстановлением base yaw.
3. Renderer: unit policy RED (42/43), browser RED пустой raw pipeline и RED
   неправильного полного кадра после чужого GL state; после изменений GREEN.
4. Итоговый [browser run](final-qa-seventeen.log): **17/17 PASS, 54.4 s** на
   изолированном frozen source snapshot, порт 49374, Chrome mobile/touch emulation.
   [Новые 8 cases](../../../../../apps/web/tests/browser/clean-three-dimensional-e2e.spec.ts)
   и [9 dome cases](../../../../../apps/web/tests/browser/rotation-dome-e2e.spec.ts).
5. [Focused unit run](final-focused-unit.log): **74/74 PASS**, 5 файлов.
   Общий TypeScript config и Biome для шести затронутых TS/TSX файлов PASS.
6. Browser проверяет shared angle до точки, 2D↔3D, immediately visible cap,
   native touch cancel, rotated footprint/invalid confirm block, 0 Revision
   до установки, одну Revision с 45°, reopen и context-loss cancellation.
7. Renderer browser проходит empty → orbit/zoom/pan → overview → cutaway →
   landscape/resize → настоящий `WEBGL_lose_context`/recovery → GLB → удаление
   GLB → empty. Возврат к пустой комнате даёт тот же SHA-256 полных RGBA pixels.
   Только явные добавление/удаление создают две Revisions.
8. Raw fallback: all-walls reference отличается от Auto; после испорченных
   настоящих framebuffer/scissor/write masks следующий all-walls кадр в точности
   совпадает по всем RGBA bytes. Resize и настоящий context loss/recovery
   сохраняют тот же кадр; новых Revisions нет. Fallback sticky на camera frames.

[Пустая комната](empty-room.png), [комната с GLB](furnished-room.png),
[реальный RED raw-frame до исправления](raw-frame-before-fix.png).
Browser images/real GPU checks выполнены в Chrome/SwiftShader emulation,
не на физическом iOS/Android телефоне. Отсутствие всех аппаратных видов
артефактов на любых драйверах этими проверками не утверждается.

Dome case05 стабилизирован после QA: exact bounds перечитываются через
expect.poll до завершения ResizeObserver layout. Границы, default timeouts
и проверки gesture/Revision не ослаблены; arbitrary sleep/skip не добавлены.

## Mutation evidence и границы scope

Stryker 9.6.1 / Node 24.19.0, отдельная source copy, concurrency 1, in-place
только внутри временной папки. На точных двух extracted functions
`shouldUseThreeWebGl2RoomSceneRenderer` и `resetProceduralWebGl2Frame`:
**8/8 generated mutants killed, 100%, no timeout/survivor/error**, threshold 80.
Это не оценка всего renderer/controller/component. Поддерживаемые Stryker
операторы здесь в основном удаляют блоки/меняют boolean arguments.

- [Исходный Stryker JSON](report.json), [точный scope/SHA manifest](extraction-manifest.json).
- [Exact extracted source](renderer-frame.ts), [real unit callbacks](renderer-frame-tests.ts),
  [palette dependency](palette.ts), [portable config](stryker.config.mjs).
- Дополнительно [17/17 отдельных удалений GL-state calls](manual-call-removal.json)
  убиты теми же real behavior callbacks. Это ручные mutants, отдельно от Stryker.
- [4/4 UI mutants](manual-ui-mutations.json) в изолированной полной source copy:
  [preview yaw](mutation-preview-yaw-omitted.log),
  [step callback](mutation-step-callback-omitted.log),
  [cancel restore](mutation-cancel-restore-omitted.log),
  [invalid feedback](mutation-invalid-feedback-hidden.log).
  Все падали на соответствующих assertions, не на build/network/runtime errors.

Для воспроизведения helper mutation скопировать source/tests/palette/config
в отдельную папку; использовать Node 24.19.0 и уже установленный Stryker 9.6.1.
Сначала `node renderer-frame-tests.ts`, затем Stryker с указанным config.
Не выполнять установку зависимостей в папке с общими symlink node_modules.
Рабочие исходники после mutation runs не изменялись; temporary copies восстановлены.

## Source identity

- RoomScene3d.tsx: `5b1a3a8138b89589aa4ebec791e3731de0b4269fabb42ec8ae518a776067c0fa`
- RoomScene3d.module.css: `b24ee29c151b6f65bff91f7de09a70ffdebb77f4de02995a37a7acc42e5d42ec`
- webgl2-room-renderer.ts: `dac659413d9f782cd035b3840c22328566b0176eb03be23b22b8a480da630585`
- clean-three-dimensional-e2e.spec.ts: `5b76071a5b8217f432795b48ac94072ce7c7fce9e79a8ccf729ce4c463cab209`

[RoomScene3d](../../../../../apps/web/src/ui/RoomScene3d.tsx),
[renderer](../../../../../apps/web/src/adapters/renderer/webgl2-room-renderer.ts),
[renderer tests](../../../../../apps/web/src/adapters/renderer/webgl2-room-renderer.test.ts).
