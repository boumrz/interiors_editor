# 3D rotation dome — focused evidence

25 октября 2026. Проверки выполнены без commit/push и без mutation реальных
исходников. Это focused verification, не утверждение о полном release gate.

Историческая фиксация первоначального S4. Последующее удаление подсказок,
placement rotation и renderer E6 описаны [в новой проверке](3d-refinements/verification.md).

## Проверенное поведение

- Видимая SVG полусфера 200×128 CSS px (painted arc width 146 px), hit band48px,
  DOM step buttons48px; центральная область передает касание canvas.
- Relative yaw без скачка при захвате любого сектора; canonical шаг45°,
  ноль новых Revisions при tap/zero-step/return-to-origin.
- Window capture fallback при отказе SVG pointer capture, выход за дугу,
  второй pointer переключает на camera pinch/pan без публикации поворота.
- Explicit cancel, Escape, pointercancel, lost WebGL и window blur;
  после blur следующий жест работает без stale pointer/listener state.
- Locked item остается selectable, camera navigation доступна, transform
  targets отсутствуют при canTransformSelectedItem=false.
- Одна подтвержденная rotation создает одну Revision; step buttons,
  Undo/Redo и reopen показывают тот же угол.
- Кнопка отмены находится в средней ячейке существующей48px строки и не
  уходит под deck на360×480 при200% текста.
- Placement confirmation скрывается во время active3Dtransform в root AppShell.

## Результаты

1. Helper + existing RoomScene/floor-interaction Rstest:22/22 PASS.
2. Helper Stryker9.6.1, Node24.19.0, isolated source copy/direct Node behavior
   harness:20/20 killed,100%,0survivors/timeout/errors. Source SHA-256:
   `52f2bef42942ea804e438105a6cc3182fb22600bffdfea7b9ad05eae75dab8b2`.
   [JSON report](rotation-dome-gesture-mutation.json),
   [Node harness](rotation-dome-gesture-mutation.mjs).
3. [Новый browser suite](../../../../apps/web/tests/browser/rotation-dome-e2e.spec.ts):
   9/9 PASS,30.6s, на frozen snapshot актуального root src через49374.
   Исходники других owners не могли вызывать HMR в этой копии.
4. Существующие13I/04F/18 browser cases PASS после dome expectations migration;
   отдельная перепроверка04C/04D/04E —3/3 PASS. Старые2D corner handles сохранены;
   3D проверяет пассивный polygon вместо декоративных corner dots.
5. Own Biome clean. Frozen stage TypeScript PASS; общий итоговый typecheck и
   полный browser/PWA/live run ведет root после общего source freeze.

RED evidence: отсутствующая полусфера; legacy exact angle округлялся наgrab;
active cancel пересекал deck (399px против372px); blur оставлял livepreview;
последний integration RED подтверждал, что placement toast оставался видимым
во время rotation. После соответствующих исправлений focused cases GREEN.

Private validation root:
`/tmp/interiors-phone-fixes-2026-10-25/rotation-stage`.
Direct Node mutation root:
`/tmp/interiors-phone-fixes-2026-10-25/rotation-mutations`.
Установку зависимостей в копиях с общими symlink node_modules не выполнять.
