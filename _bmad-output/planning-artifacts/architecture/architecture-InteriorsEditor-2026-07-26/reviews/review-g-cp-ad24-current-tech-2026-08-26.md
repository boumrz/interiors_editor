---
title: "G-CP-ADR AD-24 — current technology and feasibility review"
date: 2026-08-26
reviewer: "Codex /root/story56_tech"
reviewer_lens: "current primary-source technology compatibility and implementation feasibility"
reviewed_artifacts:
  - "../ARCHITECTURE-SPINE.md#AD-24"
  - "../catalog-control-plane-alpha-decision-2026-08-26.md"
verdict: "REJECT_CURRENT_TECH_GATE"
implementation_ready: false
readiness: NOT_READY
spine_changed: false
decision_changed: false
memlog_changed: false
source_mutations: none
---

# Reviewer gate: AD-24 current technology and feasibility

## Verdict

**`REJECT_CURRENT_TECH_GATE`.** Общая архитектура минимального read-only
Catalog Control Plane технически реализуема на JDK 17, Kotlin/Ktor, plain JDBC
и PostgreSQL. Однако текущий AD-24 нельзя считать прошедшим technology gate:

1. PostgreSQL `18.4` уже заменён security-релизом `18.6`; официальный образ
   больше не перечисляет `18.4` среди поддерживаемых тегов. Оставлять новый
   внутренний Alpha на версии до множества опубликованных CVE нельзя.
2. PIT `1.25.8` — это версия mutation engine, но решение не выбирает и не
   pin-ит Gradle PIT plugin и JUnit 5 adapter. Текущий Gradle plugin заявляет
   только initial Gradle 9 support, а не проверенную совместимость с Gradle
   `9.5.0`. Поэтому обязательный mutation task пока не воспроизводим.

Это узкий technology-gate verdict. Он не меняет источники, не отменяет
содержательный perimeter AD-24 и не меняет общий `G-READY = NOT_READY`.

## Проверка выбранных версий

| Компонент | Результат | Проверка и вывод |
| --- | --- | --- |
| JDK `17` | **PASS с условием конфигурации** | Gradle 9 требует JVM 17+, Flyway 13 требует JDK 17+, Gradle PIT plugin 1.19.0 также требует Java 17+. JDK 17 остаётся поддерживаемым LTS. Это минимальный общий runtime baseline; переход на JDK 21 для этого slice не обязателен. Build обязан задать `kotlin.jvmToolchain(17)` и JVM target 17, иначе Kotlin по умолчанию может сгенерировать target 1.8 при несовпадающих Gradle metadata. Для повторяемости evidence нужно записывать vendor и полный `java -version` либо pin-ить toolchain resolver/vendor. |
| Gradle Wrapper `9.5.0` | **PASS по Kotlin compatibility; ADVISORY по patch currency** | Официальная матрица KGP даёт Kotlin `2.4.0–2.4.10` полностью поддерживаемый диапазон Gradle `7.6.3–9.5.0`, поэтому выбранная пара валидна. Но Gradle выпустил `9.5.1`, исправив OOM и Tooling API regression, и прямо рекомендует обновление. `9.5.1` не входит в точную верхнюю границу текущей матрицы Kotlin, поэтому менять pin автоматически нельзя: либо оставить `9.5.0` и проверить память/CLI build, либо отдельно smoke-test `9.5.1` с KGP `2.4.10`. |
| Kotlin `2.4.10` | **PASS** | Текущий стабильный bug-fix релиз линии 2.4; следующий `2.4.20` на дату review ещё запланирован. Поддерживает JVM target 17 и Gradle `9.5.0`. |
| Ktor / Netty `3.5.2` | **PASS** | Текущий стабильный patch-релиз Ktor. В `3.5.1` исправлены breaking changes Kotlin 2.4 compiler plugin, а `3.5.2` добавляет последующие stability/performance fixes. Netty — штатный JVM server engine Ktor; отдельный независимый Netty pin не нужен, версии engine modules следует выровнять через Ktor `3.5.2`. |
| PostgreSQL `18.4` | **FAIL / P1** | PostgreSQL `18.6` выпущен 2026-08-13; `18.5` не выпускался. Release notes говорят, что `18.6` содержит fixes from `18.4`, включая многочисленные security fixes и CVE, среди которых memory disclosure, arbitrary-code-execution и SQL-injection классы. Minor upgrade внутри 18.x не требует dump/restore. Текущий Docker Official Image перечисляет `18.6`, но не `18.4`. Требуется заменить все source pins и Testcontainers image на `18.6`, предпочтительно с зафиксированным image digest в evidence. |
| pgJDBC `42.7.13` | **PASS** | Официальная download page называет `42.7.13` текущим драйвером. Он поддерживает Java 8+ и PostgreSQL 8.4+, содержит отдельные улучшения для PostgreSQL 18 и следует за security-fix `42.7.12`. Совместим с JDK 17 и PostgreSQL 18.6. |
| HikariCP `7.0.2` | **PASS** | Текущий опубликованный Java 11+ artifact из primary repository; JDK 17 подходит. Для небольшого локального read-only сервиса достаточен bounded pool. Не включать virtual threads: unreleased branch notes содержат более позднюю правку virtual-thread spin, но Ktor/Netty и выбранный bounded JDBC dispatcher их не требуют. |
| Flyway `13.3.0` + PostgreSQL module | **PASS, superseded non-blocking** | Версия совместима с JDK 17 и PostgreSQL major 18, а PostgreSQL support действительно требует отдельный `org.flywaydb:flyway-database-postgresql` module. В день review выпущен `13.4.0`; его изменения не исправляют PostgreSQL/JDK blocker этого slice, поэтому `13.3.0` остаётся осуществимым стабильным pin. Если source owners требуют именно latest-at-gate, обе Flyway-зависимости следует синхронно поднять до `13.4.0` и повторить migration test. Runtime `clean`/`repair` остаются запрещёнными. |
| Testcontainers `2.0.5` | **PASS после PostgreSQL correction** | Официальная документация pin-ит `org.testcontainers:testcontainers-postgresql:2.0.5`; также нужны согласованные BOM/JUnit Jupiter module. Реальный PostgreSQL container, а не H2, соответствует evidence contract. Образ должен стать `postgres:18.6`, не `postgres:18.4`. На машине/CI обязателен Docker-API-compatible runtime. |
| PIT `1.25.8` | **FAIL / P1 integration gap** | PIT engine `1.25.8` существует и является текущим релизом, но сам по себе не создаёт Gradle task. Текущий `info.solidsoft.pitest` Gradle plugin — `1.19.0`; его default engine — `1.22.1`, поэтому `pitestVersion = "1.25.8"` надо задавать явно. Для JUnit 5 нужен `pitest-junit5-plugin` `1.2.3`. Plugin 1.19.0 требует Java 17+/Gradle 8.4+ и заявляет initial support for Gradle 9, но его опубликованная проверка не доказывает Gradle 9.5. До PASS требуется pin всех трёх частей и реальный smoke `./gradlew pitest` на JDK 17/Gradle 9.5.0. PIT мутирует JVM bytecode, но его Kotlin-aware filtering ограничен; coroutine/generated/serialization glue надо исключить, а survivors проверить вручную. |

## Реализуемость AD-24 perimeter

После исправления двух P1 выбранный минимальный substrate осуществим без ORM:

- Ktor 3.5.2 предоставляет JVM Netty engine и `testApplication` для быстрых
  route/headers tests.
- pgJDBC/Hikari можно выполнять на отдельном bounded blocking dispatcher, не
  блокируя Netty event loop.
- PostgreSQL `bytea` подходит для текущего ограниченного Alpha-каталога.
  Single-range чтение можно делать через `substring(bytea from ... for ...)`,
  не материализуя целый GLB для каждого 1 MiB range.
- Flyway может `validate`/`migrate` отдельной publication role до старта
  read-only runtime. Runtime role остаётся `SELECT` only.
- Ktor conditional/caching headers и ручной bounded single-range handler
  позволяют реализовать strong ETag, `304`, `206` и `416`. Built-in
  `PartialContent` допустим только если response source действительно умеет
  random access; загрузка полного `bytea` перед каждым range не соответствует
  минимальному resource path.
- Same-origin Rspack proxy исключает CORS и второй tunnel; `OPTIONS` нужен
  только если фактический proxy действительно его посылает.

Есть одна contract-ясность, которую надо закрепить тестом: envelope ETag
должен быть **HTTP header**, вычисленный от уже сериализованных точных response
bytes. Его нельзя включать в JSON body, от которого вычисляется тот же hash —
это создало бы циклическое определение. Resource ETag может быть quoted
SHA-256 exact unencoded bytes.

## Обязательная remediation перед повторным gate

1. Source owner меняет PostgreSQL baseline и Testcontainers fixture с `18.4`
   на `18.6`; проверяет отсутствие остальных `postgres:18.4` pins и при
   возможности фиксирует digest official image.
2. Source owner добавляет reproducible mutation toolchain:
   `info.solidsoft.pitest:1.19.0`, PIT engine `1.25.8`,
   `pitest-junit5-plugin:1.2.3` и согласованный JUnit Platform launcher.
3. Перед снятием P1 запускается минимальный Gradle 9.5.0/JDK 17 smoke:
   `compileKotlin`, unit tests и `pitest` на одной чистой checkout/runtime
   конфигурации. Если plugin 1.19.0 не работает с 9.5.0, выбрать custom
   Gradle-owned PIT `JavaExec` либо другой проверенный build seam; не заявлять
   mutation evidence по наличию engine dependency.
4. Зафиксировать `kotlin.jvmToolchain(17)`/JVM target 17 и записывать полный
   JDK build в evidence.
5. После source correction повторить technology gate. Версии Ktor, Kotlin,
   pgJDBC, HikariCP и Testcontainers менять не требуется; Flyway 13.3.0 можно
   оставить намеренным pin либо осознанно поднять до 13.4.0 с повторным
   migration test.

## Primary sources

- [Kotlin release status and 2.4.10](https://kotlinlang.org/docs/releases.html)
- [Kotlin Gradle compatibility and JVM toolchains](https://kotlinlang.org/docs/gradle-configure-project.html)
- [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html)
- [Gradle 9.5.1 fixes and upgrade recommendation](https://docs.gradle.org/9.5.1/release-notes.html)
- [Ktor releases](https://ktor.io/docs/releases.html)
- [Ktor server engines](https://ktor.io/docs/server-engines.html)
- [Ktor server testing](https://ktor.io/docs/server-testing.html)
- [PostgreSQL 18.6 release notes](https://www.postgresql.org/docs/18/release-18-6.html)
- [Postgres Docker Official Image](https://hub.docker.com/_/postgres)
- [pgJDBC current downloads](https://jdbc.postgresql.org/download/)
- [pgJDBC 42.7.13 changelog](https://jdbc.postgresql.org/changelogs/2026-07-06-42.7.13-release/)
- [HikariCP primary repository](https://github.com/brettwooldridge/HikariCP)
- [Flyway engine release notes](https://documentation.red-gate.com/fd/release-notes-for-flyway-engine-179732572.html)
- [Flyway Java/JDK support](https://documentation.red-gate.com/fd/api-java-277579358.html)
- [Flyway PostgreSQL module and verified major](https://documentation.red-gate.com/fd/postgresql-database-277579325.html)
- [Testcontainers PostgreSQL 2.0.5 module](https://java.testcontainers.org/modules/databases/postgres/)
- [PIT 1.25.8 release](https://github.com/hcoles/pitest/releases)
- [Gradle PIT plugin 1.19.0 compatibility](https://github.com/szpak/gradle-pitest-plugin/releases)
- [PIT JUnit 5 plugin versions](https://github.com/pitest/pitest-junit5-plugin)
- [JDK 17 LTS support roadmap](https://adoptium.net/support/)

