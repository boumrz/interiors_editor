---
title: "AD-24 focused adversarial re-review R4"
review_type: focused-adversarial-architecture-gate
reviewed: 2026-08-26
prior_review: review-g-cp-ad24-adversarial-r3-2026-08-26.md
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../catalog-control-plane-alpha-decision-2026-08-26.md
  - ../../../../../contracts/catalog-control-plane/catalog-envelope-v1.schema.json
  - ../../../../../contracts/catalog-control-plane/catalog-envelope-v1.semantic.md
  - ../../../../../contracts/catalog-control-plane/catalog-schema-v1.sql
  - ../../../../../contracts/catalog-control-plane/fixtures/manifest.json
  - ../../../../../contracts/catalog-control-plane/fixtures/media-cases.json
  - ../../../../../contracts/catalog-control-plane/fixtures/semantic-cases.json
  - ../../../../../contracts/catalog-control-plane/fixtures/http-cases.json
reviewed_snapshot:
  architecture_spine_sha256: a942b3d1891e92836b36c132ff1723cf37de00ae4bd60b31a1b34c7ac86163ae
  ad24_decision_sha256: 3624c17d0dc793ad3a25d71ef21bb5368353c9197a6b75c87d2312959b2f9631
  envelope_schema_sha256: 203a4707ba43e717bd76ddaceeddd293a5d4fc7b5b7bb9b6e64cf6aa5bd52675
  semantic_profile_sha256: 745f6133aea02584a7d6e7940c55a845b63cfdb0ded48d52e151075b3d81c2d2
  sql_schema_sha256: 0c44c6b289c45cc2a7956aefd8ceaa14ccc702a043a807c889b6e6c5db618881
  fixture_manifest_sha256: 762a9cd2c771407a0061c51722d75420400536bade361eb1f2e42846c1a7f2bd
verdict: CHANGES_REQUIRED_ONE_BLOCKER
source_mutations: none
---

# AD-24 focused adversarial re-review R4

## Verdict

`CHANGES_REQUIRED_ONE_BLOCKER` for the bounded internal Alpha. Eleven R3
findings are closed: media profiles are bounded, catalog color effects are
removed, model variants have one complete-replacement slot, timestamp/HTTP
semantics are total, publisher/no-Project trust claims are narrowed, runtime
validation is separated, the proxy preserves rejection inputs, and the schema,
semantic profile and fixtures are mechanically coherent. Fixture expansion and
executable realization remain Story 5.6 follow-up, not this verdict's blocker.

## Remaining blocker

- `catalog-schema-v1.sql` is not unambiguously executable by the selected `catalogMigrate` boundary. It creates `catalog_migration`, although Flyway needs that schema before it can create/use `catalog_migration.flyway_schema_history`, and it also executes `ALTER ROLE catalog_publish`/`catalog_runtime`, which requires operator/role-management authority not assigned to the migration credential. Treating the file as reference DDL instead leaves the actual Flyway migration free to differ from the normative source. Split one explicit operator bootstrap (schemas, roles and role settings) from a Flyway-owned migration containing only `catalog_data` objects/grants, or define an exact idempotent bootstrap performed before Flyway and name the authority that may alter the roles.

After that ownership/order split is made, a focused source-only recheck is
sufficient for `PASS_WITH_EXECUTABLE_FOLLOW_UP`; no other R3 blocker needs to
be reopened.
