# Plan: P0 производительности импортируемых моделей

**Status:** Complete — Product Owner approved 2026-08-16

## Goal

Пользователь импортирует и размещает статическую модель без повторного разбора
GLB, повторной загрузки тех же текстур или пересоздания WebGL-контекста при
перемещении и повороте предмета.

## Acceptance criteria

- [x] Поза экземпляра не перечитывает pinned resource и не запускает новый `GLTFLoader.parse` для неизменного hash.
- [x] 3D renderer не пересоздаётся для x/z/yaw-only изменений; структурная смена сцены пересобирает его безопасно.
- [x] Предпросмотр сначала показывает loading state, рендерит без antialiasing с DPR не выше 1 и освобождает textures/ImageBitmap.
- [x] FBX sidecar JPEG остаётся JPEG в converted GLB; supplied armchair retains its textures.
- [x] Static GLB отклоняется до decoder при hard texture limits из `asset-import-contract.md` (4096×4096 per image, 48 MP total).

## Slices

### Slice 1: Reuse immutable resources and parsed scenes across pose changes

**Value:** A placed custom model remains responsive while moved or rotated.
**RED:** Cache/lifecycle tests prove equal resource hash and pose-only scene changes do not parse or recreate.
**GREEN:** Stable resource manifest, parsed-root cache and structural renderer key.
**MUTATE:** Targeted cache/lifecycle mutation or documented manual mutation where adapter Stryker scope excludes UI.

### Slice 2: Bound decoded work before 3D preview and preserve texture encoding

**Value:** A user gets an immediate safe rejection for too-large textures; ordinary FBX conversion does not inflate JPEG assets.
**RED:** GLB image-header boundary tests and a real-archive browser evidence test.
**GREEN:** Header-based preflight and sidecar MIME preservation.
**MUTATE:** Stryker scope for domain preflight plus manual worker-path evidence.

### Slice 3: Keep the first preview lightweight and release transient graphics resources

**Value:** Import shows progress before expensive work and does not retain preview GPU objects after close.
**RED:** Unit seams assert profile and disposal behavior.
**GREEN:** Deferred parse, low preview profile and unique texture/ImageBitmap disposal.
**MUTATE:** Focused manual mutation evidence if renderer/UI not in Stryker scope.

## Verification

- 1006 unit tests, type checks, lint and production Rspack build are green.
- Browser regression `PROJECT-E2E-04A/04B` is green. A real-worker local
  verification with the supplied armchair ZIP confirmed four embedded JPEGs
  and measured 2022×2002×2277 mm after FBX unit normalization.
- The configured Stryker in-place run was stopped after its mandatory backup
  mechanism interfered with the live development surface; source restoration
  was verified. Focused manual mutations were killed by tests: `>`→`>=` at the
  exact 48 MP limit, and hash-keyed cache lookup→definition-keyed lookup.
