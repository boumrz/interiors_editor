---
title: "G-CP-ADR AD-24 — current technology remediation re-review R2"
date: 2026-08-26
reviewer: "Codex /root/story56_tech"
reviewer_lens: "current primary-source compatibility and bounded internal-Alpha feasibility"
reviewed_artifacts:
  - "../ARCHITECTURE-SPINE.md#AD-24"
  - "../catalog-control-plane-alpha-decision-2026-08-26.md"
prior_review: "review-g-cp-ad24-current-tech-2026-08-26.md"
verdict: "PASS_INTERNAL_ALPHA_TECH_GATE"
implementation_ready: true
implementation_scope: "Story 5.6 internal Alpha under active waivers only"
public_release_ready: false
readiness: NOT_READY
spine_changed: false
decision_changed: false
memlog_changed: false
source_mutations: none
---

# AD-24 current technology remediation re-review R2

## Verdict

**`PASS_INTERNAL_ALPHA_TECH_GATE`.** Два P1 предыдущего review закрыты на
уровне architecture decision:

1. PostgreSQL `18.4` больше не представлен как release-current выбор. Его
   использование ограничено локальным loopback internal-Alpha контуром, а
   обновление AD-17/project context сделано обязательным до публичного
   deployment.
2. Mutation toolchain теперь полностью назван: Gradle PIT plugin `1.19.0`,
   PIT engine `1.25.8`, JUnit 5 adapter `1.2.3`; wrapper, dependency locking и
   checksum verification задают воспроизводимый resolved graph.

Этот PASS разрешает только реализацию и executable evidence Story 5.6 под
действующими waiver. Он не меняет `G-READY = NOT_READY`, не допускает public
release и не является подтверждением фактического прохождения ещё не созданных
Gradle/PIT/PostgreSQL тестов.

## R1 remediation closure

| R1 finding | R2 evidence | Assessment |
| --- | --- | --- |
| PostgreSQL `18.4` superseded security minor `18.6` | Decision прямо признаёт supersession; PostgreSQL container port и Ktor bind loopback-only, publisher/migrator не доступны браузеру, runtime role имеет только `SELECT`, HTTP perimeter не принимает произвольный SQL/данные. Решение запрещает считать 18.4 release-current и требует source update до public deployment. | **Closed for bounded internal Alpha only.** Исключение автоматически прекращается при non-loopback bind, прямом LAN/public DB access, cloud/shared hosting или public-release preparation. |
| PIT engine был указан без Gradle/JUnit integration | Decision pin-ит plugin `1.19.0`, engine override `1.25.8`, adapter `1.2.3`; Gradle distribution SHA, dependency locking/checksum verification и JDK 17 toolchain закрывают reproducibility design. | **Closed at design level.** Реальный `./gradlew pitest` остаётся обязательным implementation evidence. |
| JDK/toolchain не был достаточно определён | `kotlin.jvmToolchain(17)`, JVM target 17 и запись полного vendor/build через `java -version` теперь нормативны. | **Closed.** |
| Envelope ETag можно было прочитать как self-referential JSON field | Решение явно определяет ETag только как HTTP header от точных canonical response bytes. | **Closed.** |

## PostgreSQL 18.4 exception boundary

Официальные release notes PostgreSQL подтверждают, что `18.6` от 2026-08-13
содержит security fixes относительно `18.4`, а `18.5` не выпускался. Поэтому
`18.4` нельзя рекомендовать как обычный новый baseline. Тем не менее данное
исключение приемлемо в требуемом reviewer scope по совокупности ограничений:

- source-owned AD-17/project context пока жёстко фиксируют `18.4`;
- PostgreSQL доступен только через container-mapped loopback, Ktor — только на
  `127.0.0.1:4174`;
- web/tunnel видит лишь фиксированный read-only `/catalog-api` через proxy, не
  JDBC endpoint, publisher или migration credentials;
- proxy удаляет Cookie/Authorization, HTTP adapter не принимает credentials,
  body, generic query/storage key или произвольный resource URL;
- runtime role — `SELECT` only с фиксированным `search_path`; publisher и
  migrator process-scoped и локальные;
- перед любым public deployment требуется отдельный source-owner upgrade и
  новый release/operations/security review.

Cloudflare test tunnel означает, что read-only HTTP route может быть доступен
по тестовому URL; поэтому контур нельзя называть полностью network-isolated.
Acceptance опирается на отсутствие прямого PostgreSQL/Ktor exposure и на
закрытый read-only transport perimeter. Если tunnel начинает проксировать
backend port напрямую либо появляются write/admin endpoints, этот PASS
немедленно недействителен.

Для воспроизводимости Testcontainers evidence должен дополнительно записать
фактически pulled digest `postgres:18.4`; tag сам по себе не является
immutable content address. Невозможность получить этот historical image или
его несовпадение с recorded digest требует остановки и source upgrade, а не
подмены на `latest`.

## PIT compatibility verification

Выбранные pins совместимы по опубликованным ограничениям:

- Gradle PIT plugin `1.19.0` требует Java 17+ и Gradle 8.4+, заявляет initial
  Gradle 9 support и по умолчанию использует PIT `1.22.1`;
- явный `pitestVersion = "1.25.8"` корректно заменяет default engine;
- JUnit 5 adapter `1.2.3` требует PIT 1.19.4+, что выполняется для 1.25.8;
- dependency locking/checksum verification фиксируют JUnit Platform launcher
  и остальные transitives после первого осознанного lock generation.

Primary sources не содержат отдельной гарантии Gradle PIT plugin `1.19.0`
именно для Gradle `9.5.0`; они подтверждают Gradle 9.0-class support. Поэтому
PASS требует executable acceptance, а не предположения:

1. на JDK 17 выполнить `compileKotlin`, обычные unit tests и
   `./gradlew pitest` через Wrapper `9.5.0`;
2. доказать, что отчёт реально использует engine `1.25.8` и JUnit adapter
   `1.2.3`, а не plugin defaults;
3. оставить generated serialization/coroutine glue вне target set, но не
   исключать validators, range parser, header policy и repository mapping;
4. вручную классифицировать Kotlin compiler-artifact/equivalent survivors;
5. при несовместимости не менять версии молча: вернуть technology gate или
   выбрать отдельный Gradle-owned PIT invocation через architecture owner.

Это executable condition Story 5.6, а не оставшийся architecture blocker,
поскольку exact integration coordinates и fallback governance теперь
определены.

## Remaining stack

| Component | R2 result |
| --- | --- |
| JDK `17` | **PASS.** Поддерживаемый LTS и общий минимальный baseline для Gradle 9, Flyway 13 и Gradle PIT plugin; toolchain/target закреплены. |
| Gradle `9.5.0` + Kotlin `2.4.10` | **PASS.** Kotlin официально полностью поддерживает Gradle до 9.5.0. Gradle рекомендует 9.5.1 из-за OOM/Tooling fixes, но 9.5.1 не входит в точную текущую Kotlin matrix; намеренный 9.5.0 pin приемлем с CLI/memory smoke. |
| Ktor/Netty `3.5.2` | **PASS.** Stable patch после Kotlin 2.4 compiler compatibility fixes в 3.5.1; выбранный JVM/Netty route осуществим. |
| pgJDBC `42.7.13` | **PASS.** Текущий официальный driver, Java 8+, с PostgreSQL 18 improvements; JDK 17/PG 18.4 совместимы. |
| HikariCP `7.0.2` | **PASS.** Java 11+ artifact; bounded pool без virtual threads соответствует локальному сервису. |
| Flyway `13.3.0` + PostgreSQL module | **PASS.** JDK 17+, PostgreSQL 18 verified, отдельный module назван. Выпущенный в день review 13.4.0 не содержит PostgreSQL fix, необходимого этому slice; intentional 13.3.0 lock допустим. |
| Testcontainers `2.0.5` | **PASS.** Официальный PostgreSQL module и реальный `postgres:18.4` вместо H2; требуется доступный Docker-compatible runtime и recorded image digest. |

## Implementation handoff conditions

Technology gate остаётся PASS, только если implementation slice сохраняет:

- loopback binds и единственный same-origin proxy path;
- отсутствие CORS credential mode, arbitrary fetch, upload/admin route и
  browser-visible database credentials;
- Wrapper distribution SHA, dependency locks/checksum verification и JDK 17
  evidence;
- green PostgreSQL role/schema/atomic-publication tests и green PIT task;
- явный release blocker: до public deployment PostgreSQL pin обновляется
  source-owner workflow, после чего повторяется technology/security review.

## Primary sources

- [PostgreSQL 18.6 release notes](https://www.postgresql.org/docs/18/release-18-6.html)
- [Kotlin Gradle compatibility and JVM toolchains](https://kotlinlang.org/docs/gradle-configure-project.html)
- [Kotlin 2.4.10 release status](https://kotlinlang.org/docs/releases.html)
- [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html)
- [Gradle PIT plugin 1.19.0 compatibility](https://github.com/szpak/gradle-pitest-plugin/releases)
- [PIT 1.25.8 releases](https://github.com/hcoles/pitest/releases)
- [PIT JUnit 5 adapter requirements](https://github.com/pitest/pitest-junit5-plugin)
- [Ktor releases](https://ktor.io/docs/releases.html)
- [pgJDBC current driver](https://jdbc.postgresql.org/download/)
- [HikariCP primary repository](https://github.com/brettwooldridge/HikariCP)
- [Flyway Java support](https://documentation.red-gate.com/fd/api-java-277579358.html)
- [Flyway PostgreSQL module](https://documentation.red-gate.com/fd/postgresql-database-277579325.html)
- [Testcontainers PostgreSQL module](https://java.testcontainers.org/modules/databases/postgres/)

