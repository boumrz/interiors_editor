---
title: "Reviewer Gate: Telegram S0 current-technology lens"
date: 2026-11-04
scope: "Architecture Spine, Telegram platform and current code"
verdict: "changes-required at review snapshot"
---

# Результат

**Critical — AD-25–AD-29 отсутствовали в Spine на момент проверки.** После AD-24 непосредственно следует Consistency Conventions; новое описание trust design, delivery и host lifecycle из memlog не является само по себе builder contract. Вставить отсутствующие решения в Spine и повторить механическую проверку и semantic review.

**High — доказательство host/session continuity нельзя вывести из Telegram lifecycle.** [Telegram `activated`/`deactivated`](https://core.telegram.org/bots/webapps#events-available-for-mini-apps) не передают identity, fresh signature или session identifier. Нельзя считать их доказательством, что текущий аккаунт не сменился, либо требовать мифический host reauthentication API на каждом resume. Зафиксировать конкретный критерий непрерывности *только существующего runtime*, прекращение записи при неопределённости/смене данных запуска и честное ограничение: обнаружение переключения аккаунта внутри живого WebView не гарантируется Telegram API; новые запуски проходят новую проверку. Physical client evidence для поведения account switching остаётся открытым.

**Medium — выбор crypto требует physical compatibility evidence.** [Telegram](https://core.telegram.org/bots/webapps#validating-data-for-third-party-use) документирует `bot_id:WebAppData`, LF, все поля кроме `hash`/`signature`, сортировку, base64url Ed25519 signature и отдельные public keys test/production. `user` optional; keyboard/inline launch может давать пустой initData. Свежесть по `auth_date` рекомендуется, но интервалы 300/60 секунд — локальная policy, а не гарантия Telegram. [Web Cryptography Level 2](https://www.w3.org/TR/webcrypto/#ed25519) определяет Ed25519 verify, но стандарт сам не подтверждает его наличие в целевых iOS/Android WebView. Capability probe и unsupported/fail-closed path являются необходимыми; support нельзя утверждать до реального доказательства. Подпись подтверждает выданные данные, не origin исполняемого кода и не защиту от replay за время окна.

**Medium — физический file handoff остаётся независимым gate.** [Telegram `downloadFile`](https://core.telegram.org/bots/webapps#downloadfileparams) требует HTTPS URL; callback фиксирует согласие на запрос, не запись файла. [Web events](https://core.telegram.org/api/web-events#web-app-request-file-download) сообщают `downloading`, а не приложению подтверждённый повторный импорт. Архитектуре нужны отдельные состояния и физический внешний roundtrip; отсутствие разрешённого upload не позволяет подменить `blob:` на этот метод.

# Проверка baseline

`apps/web/src/app/editor-app.tsx` создаёт `createProductionRuntime()` на уровне модуля до identity/handshake; его прямой импорт в Telegram path не удовлетворяет scope-before-runtime. `apps/web/src/app/release-startup.ts` проверяет shell manifest и capabilities при отсутствии worker; это поддерживает выбранную без-worker схему, но не доказывает правильный target/build binding или работу lazy chunk после release. `apps/web/src/adapters/catalog/http-catalog-gateway.ts` использует относительный `/catalog-api` и `credentials: omit`; routing на новом origin должен явно сохранить существующие resource/hash/Range/cancel семантики. Версии существующего стека сверены с текущим кодом и lockfile как brownfield baseline, не объявлены новыми актуальными рекомендациями.

Проверка документации и кода read-only; physical WebView, live bot/domain, release rollback и файловый roundtrip не запускались.

## Повторная проверка после исправлений

**Вердикт: PASS с открытыми physical/release evidence, без Critical/High замечаний по текущему technology lens.** AD-25–AD-29 присутствуют; AD-26 теперь прямо различает непрерывность runtime и неподтверждённую идентичность текущего аккаунта, фиксирует ограничение обнаружения account switch, fail-closed bootstrap и capability probe. AD-28 закрепляет retained immutable URLs и бюджет текущего shell без смешения с архивом. AD-29 различает callback и подтверждённый внешний roundtrip. Прежние Critical и High замечания устранены в Spine; оставшиеся выводы о поддержке Ed25519 в целевых WebView, поведении переключения аккаунта, physical file roundtrip и живом release/rollback требуют именно последующей проверки, не считаются доказанными этим review. Проверка не оценивает implementation readiness и не разрешает реализацию или публикацию.
