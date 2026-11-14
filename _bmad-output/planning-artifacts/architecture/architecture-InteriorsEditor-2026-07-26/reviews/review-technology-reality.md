---
title: "InteriorsEditor — проверка технологий и реальности: обновление readiness-evidence architecture"
review_type: current-tech-and-reality
reviewed: 2026-08-09
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewer: "Codex /root/renderer_catalog_review"
status: complete
verdict: concerns
scope: "read-only review of AD-10, AD-13, AD-17, AD-20 and the current Stack; version existence, peer fit, platform-reality wording and unsupported claims"
---

# Проверка технологий и реальности: readiness-evidence architecture update

## Verdict

**CONCERNS — один medium finding.** Обновлённые AD-10, AD-13 и AD-17 не
вводят неподтверждённую библиотеку как adopted dependency и не выдают
corpus/Playwright за physical, participant, Legal или independent evidence.
Точные версии всех именованных runtime/toolchain/candidate packages существуют;
проверенные peer constraints согласуют выбранные React, Three, Rspack, Rstest
и Node baselines.

Для действительно эквивалентного renderer comparison до запуска corpus нужно
зафиксировать способ принудительной потери WebGL context при отсутствии
`WEBGL_lose_context` или при асинхронном restore. Иначе одинаково названный
`forced context loss` может быть разными испытаниями у двух кандидатов. Это
не device-claim и не препятствует сохранению renderer selection в `Deferred`,
но является необходимой точкой воспроизводимости evidence program.

Этот review не утверждает `READY`, `PASS`, device compatibility, legal rights,
operation readiness или независимую экспертизу.

## Метод и первичные источники

Проведена read-only сверка обновлённого Spine и live primary sources 2026-08-09:

- [Node distribution index](https://nodejs.org/dist/index.json) подтверждает
  `v24.19.0`, 2026-08-03, LTS line `Krypton`;
- [release Kotlin 2.4.10](https://github.com/JetBrains/kotlin/releases/tag/v2.4.10),
  [release Rspack 2.1.8](https://github.com/web-infra-dev/rspack/releases/tag/v2.1.8)
  и [PostgreSQL 18.4 release notes](https://www.postgresql.org/docs/current/release-18-4.html)
  подтверждают соответствующие exact releases;
- official npm registry metadata через `npm view` для всех Stack rows;
  репрезентативные immutable records:
  [`@rspack/core@2.1.8`](https://registry.npmjs.org/@rspack/core/2.1.8),
  [`react@19.2.8`](https://registry.npmjs.org/react/19.2.8),
  [`@react-three/fiber@9.6.1`](https://registry.npmjs.org/@react-three/fiber/9.6.1),
  [`@react-three/drei@10.7.7`](https://registry.npmjs.org/@react-three/drei/10.7.7),
  [`@babylonjs/core@9.18.0`](https://registry.npmjs.org/@babylonjs/core/9.18.0)
  и [`@rstest/adapter-rspack@0.11.5`](https://registry.npmjs.org/@rstest/adapter-rspack/0.11.5);
- [ratified `WEBGL_lose_context` specification](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/)
  для реальности context-loss/restore lifecycle.

Проверялись existence exact version, declared engine/peer ranges и wording
решений; не запускались application code, tests или device traces.

## Проверенная матрица

| Область / утверждение Spine | Результат | Evidence и интерпретация |
| --- | --- | --- |
| AD-10: disposable projection, WebGL2 loss/recreate, low-quality затем 2D fallback | Применимо с finding ниже | Khronos определяет lifecycle loss/restore и допускает асинхронный restore. AD корректно сохраняет Project/Draft/PendingDurability/History/fence/recovery вне renderer и не заявляет результат на физическом устройстве. |
| AD-13: Three.js + R3F против Babylon остаётся сравнением | Применимо | Exact releases `three@0.185.1`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7` и Babylon `9.18.0` разрешаются. R3F 9.6.1 допускает React `>=19 <19.3` и Three `>=0.156`; Drei 10.7.7 допускает React 19, R3F 9 и Three `>=0.159`. Поэтому React 19.2.8 / Three 0.185.1 peer-compatible. Ни один candidate не назван adopted dependency. |
| Baseline AD-16: Node/Rspack/Rstest/Playwright | Применимо | Node 24.19.0 удовлетворяет engines `@rspack/core@2.1.8` и `@rstest/core@0.11.5`: `^20.19.0 || >=22.12.0`; `@rstest/adapter-rspack@0.11.5` имеет peers `@rspack/core`, `@rspack/cli` `^2.0.0` и Rstest `^0.11.5`; Playwright 1.62.1 требует Node >=20. Exact releases существуют. |
| Perimeter AD-17: Kotlin/PostgreSQL | Применимо как planned baseline | Kotlin 2.4.10 и PostgreSQL 18.4 — реальные releases. AD-17 не выбирает Kotlin framework, transport, provider, schema, CDN/object store, IAM или operations model, поэтому не завышает technical proof. |
| Другие Stack candidates/proposals | Корректно помечены, не являются implementation evidence | Exact registry versions разрешаются для Zustand 5.0.14, Dexie 4.4.4, Zod 4.4.3, glTF Transform 4.4.2, three-mesh-bvh 0.9.13, fast-check 4.9.0 и dependency-cruiser 18.1.0. Они остаются `proposed`, `candidate` или `deferred`; ни один не является readiness-approved production dependency. |
| Формулировки о device, participant, legal и independent review | Ложного claim не найдено | AD-13 прямо говорит, что его corpus и Playwright/simulation не заменяют physical NFR-15 или participant evidence. AD-17 требует designated Security/Operations и applicable Legal/Asset-Steward authorities, не назначая и не имитируя их. |

## Статус current pin и candidate

Stack корректно отделяет exact reproducible baseline от утверждения, что каждый
package является самым новым registry `latest`:

- **adopted planned baselines:** Node 24.19.0, pnpm 11.20.0, Rspack 2.1.8,
  TypeScript 7.0.2, React/react-dom 19.2.8, Rstest 0.11.5, Playwright 1.62.1,
  Kotlin 2.4.10 and PostgreSQL 18.4;
- **not selected renderer/storage/tool candidates:** Three/R3F/Drei, Babylon,
  Zustand, Dexie, Zod, glTF Transform, three-mesh-bvh, fast-check and
  dependency-cruiser; PWA integration remains explicitly deferred.

Несколько exact pins уже не являются registry `latest` на дату review
(например pnpm 11.21.0, Rstest 0.11.6, R3F 9.7.0, Drei 10.7.8, Babylon 9.20.0,
three-mesh-bvh 0.9.14 и dependency-cruiser 18.1.1). Это **не** finding само по
себе: Spine называет их pinned baselines/candidates, а не `latest`, и
reproducible lockfile не должен drift только из-за более позднего release.
Однако перед future authorised bootstrap или candidate selection owner должен
повторно review changed releases, а не upgrade их молча.

## Findings

### TR-RE-1 — MEDIUM: forced context-loss evidence не имеет нормализованного правила injection

**Evidence.** AD-13 требует от каждого renderer candidate цикла
`init → forced context loss → dispose → recreate/open`. Khronos определяет
`WEBGL_lose_context` как extension, а его `restoreContext()` допускает, что
context останется lost до последующего usable restore; это не generic
synchronous reset primitive. Spine не задаёт, как corpus feature-detects этот
механизм, фиксирует действительно unavailable injector или нормализует
alternative controlled fault mechanism.

**Почему это важно.** Одна candidate team может использовать extension, другая
симулировать adapter event, а третья — browser-specific tool. Все смогут
отчитаться о green vector `forced loss`, проверив несовместимые paths. Это
ослабит главную причину AD-13 требовать эквивалентный corpus.

**Required disposition.** В versioned renderer corpus/protocol (не в новой
renderer dependency и не в physical-device claim) нужно закрепить:

1. the feature-detected mechanism and evidence label for actual forced loss;
2. the allowed controlled substitute when the mechanism is unavailable;
3. the expected asynchronous loss/restore/dispose observation sequence; and
4. the result classification for unavailable injection versus a failed
   renderer recovery.

Real observed loss/recovery row должен остаться отдельным от simulation и
восьми NFR-15 physical traces. После принятия corpus protocol следует
повторить этот lens.

## Нет finding: unsupported binding или подмена evidence

- `2D fallback`, diagnostics fields и transient camera/cutaway rule в AD-10 —
  generic renderer boundaries, не скрытый выбор Three, R3F, Babylon, WebGPU
  или mobile device API.
- AD-13 делает renderer selection условным по одному comparison corpus и
  independent review; он не утверждает, что comparison уже состоялось.
- AD-17 уточняет application port/data allow-list, но сохраняет
  API/transport, resource delivery, authentication, hosting, operations, SLA,
  telemetry и retention deferred to `G-CP-ADR`.
- AD-20 не добавляет external geometry engine; `BigInt` и rational
  intermediate arithmetic — language-level ephemeral techniques внутри
  существующей canonical integer-mm boundary.

## Следующий обязательный шаг

Нужно устранить `TR-RE-1` в renderer evidence protocol до запуска candidate
comparison. Следует сохранить current candidate/deferred labels и повторить
technology/reality lens после изменения protocol либо любого exact package pin.
Из этого review не следуют application scaffold, implementation, release,
device certification или readiness verdict.
