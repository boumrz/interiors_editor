---
title: "G-CP-ADR — Minimal Alpha Catalog Control Plane"
status: adopted-for-internal-alpha
date: 2026-08-26
decision_id: AD-24
gate: G-CP-ADR
gate_disposition: internal-implementation-ready
closes_release_gate: false
parent_spine: ARCHITECTURE-SPINE.md
authority:
  - ../../implementation-waiver-2026-08-06.md
  - ../../readiness-evidence-program-waiver-2026-08-09.md
---

# G-CP-ADR — Minimal Alpha Catalog Control Plane

## Decision boundary

This decision closes the design choices required to build and test Story 5.6
inside the Product Owner-authorized internal Alpha. It does not turn
`G-READY` into `READY`, certify a public deployment, or claim physical-device,
availability, Security/Operations, privacy, recovery-time or independent-human
evidence.

The perimeter owns only immutable versioned catalog envelopes, normalized
catalog-item metadata, exact catalog-owned resource bytes and their SHA-256
hashes. It never accepts or stores account identity, User Project, Revision,
session History, Portable Backup or user-owned pinned bytes. Licensing,
provenance, grants and notice fields are absent from the Alpha contract under
the Product Owner scope correction of 2026-08-25.

## Selected implementation substrate

| Concern | Minimal Alpha decision |
| --- | --- |
| Root | `apps/catalog-control-plane`, built and tested independently from `apps/web` |
| Build | Gradle Wrapper `9.5.0`, Kotlin DSL; no unpinned host Gradle in reproducible commands |
| JVM | JDK `17` runtime and bytecode baseline; compatible newer local JDKs may run the wrapper |
| Language | Kotlin `2.4.10` |
| HTTP | Ktor `3.5.2` with Netty, same-origin versioned REST/JSON |
| Database | PostgreSQL `18.4`, pgJDBC `42.7.13`, HikariCP `7.0.2` |
| Migrations | Flyway `13.3.0` plus its PostgreSQL database module; forward versioned SQL, `validate` before serving, no runtime `clean`/`repair` |
| Integration test | Testcontainers `2.0.5` with the exact `postgres:18.4` image; never H2 as PostgreSQL evidence |
| Mutation test | Gradle PIT plugin `1.19.0`, PIT engine `1.25.8` and JUnit 5 adapter `1.2.3`; generated/coroutine glue is excluded |

Gradle owns all Kotlin unit, contract, integration and mutation tasks. `pnpm`,
Rstest and the JavaScript mutation runner remain scoped to `apps/web` and do
not pretend to compile or validate Kotlin.

The wrapper properties pin the official Gradle distribution URL and SHA-256;
Gradle dependency locking/checksum verification closes the resolved graph.
`kotlin.jvmToolchain(17)` and JVM target 17 are mandatory, and evidence records
the exact vendor/build reported by `java -version`. Version renewal is required
before public deployment, not performed through a `latest` selector.

PostgreSQL `18.4` is retained because AD-17 and the project context explicitly
bind that source-owned baseline. The 2026-08-26 current-technology review notes
that security minor `18.6` supersedes it. Therefore 18.4 is allowed only for
this loopback internal-Alpha evidence environment; it must not be exposed as a
public database or described as release-current, and the source owner must
update AD-17/project context before a public deployment.

## Normative contract and limits

The language-neutral envelope authority is
`contracts/catalog-control-plane/catalog-envelope-v1.schema.json`. Kotlin,
the TypeScript decoder, fake gateway and real-service smoke consume the same
mandatory semantic algorithm/HTTP/DDL profile in
`contracts/catalog-control-plane/catalog-envelope-v1.semantic.md` and the
positive/negative corpus in `contracts/catalog-control-plane/fixtures/`.
The decoder reads bounded raw UTF-8 and rejects duplicate object members before
ordinary JSON materialization. Checking JSON Schema without that semantic
profile and corpus is non-conformant.

- maximum envelope body: 262,144 bytes;
- maximum assets: 256;
- identifiers: 1–64 lowercase ASCII letters/digits/hyphens;
- content versions: 1–64 lowercase ASCII letters/digits/dots/hyphens;
- labels: NFC UTF-8, 1–120 Unicode scalars and at most 240 UTF-8 bytes;
- dimensions: positive integer millimetres, maximum 100,000;
- GLB bytes: 1–25 MiB; PNG thumbnail bytes: 1–256 KiB;
- hashes: exactly 64 lowercase hexadecimal SHA-256 characters.

Assets are ordered by `assetId`; the optional single variant slot and its
variants by id. Accepted data is serialized once with RFC 8785 JSON
Canonicalization Scheme and those exact bytes are stored with normalized rows;
the service never reconstructs response bytes with a runtime serializer.
`publishedAt` is a unique UTC-`Z` manifest value, never database `now()`. The
quoted strong envelope ETag is SHA-256 of the stored response bytes and is only
an HTTP header, not a self-referential JSON field.

Every asset declares canonical section/category, `anchorClass`, normalized
local front `positive-z`, rectangular footprint, dimensions, one exact GLB,
an optional exact PNG thumbnail and zero or one explicit `model-resource`
variant slot (empty when no variant is available). A model-resource slot
replaces the one complete GLB. Catalog-provided color/material effects are
outside this control-plane slice; local parametric color variants are unchanged.
Different assets may reference the same content hash; resource rows deduplicate
by hash, while asset ids and `(slotId, variantId)` are unique in their parent.
Resource routes are never supplied by JSON: the adapter derives the only legal
relative path `/catalog-api/v1/resources/sha256/{hash}`.

## Exact `CatalogGatewayPort`

The application contract has two cancellable operations:

```text
currentPublication() -> CatalogRequest<CatalogPublicationResult>
catalogResource(descriptor) -> CatalogRequest<CatalogResourceResult>

CatalogRequest<T> = { result: Promise<T>; cancel(): void }
CatalogPublicationResult =
  | { kind: "available"; publication: CatalogPublication }
  | { kind: "control-plane-unavailable" }
  | { kind: "cancelled" }
  | { kind: "invalid-envelope" }
CatalogResourceResult =
  | { kind: "available"; bytes: Uint8Array; sha256: string }
  | { kind: "unpinned-download-unavailable" }
  | { kind: "cancelled" }
  | { kind: "resource-integrity-mismatch" }
```

Calling `cancel()` linearizes cancellation only while the request is unsettled;
after settlement it is a no-op. A user cancel wins over an abort exception it
caused. Timeouts/network/429/5xx/current-404 map to the operation's unavailable
outcome. A bounded `200` with invalid metadata maps to `invalid-envelope`.
For resources, network/404/416/5xx map to
`unpinned-download-unavailable`; wrong headers/ranges/media/size/hash/GLB map
to `resource-integrity-mismatch`.

The gateway has no local resource store and exposes no successful bytes until
descriptor size/media limits, response length/ranges, assembled length,
SHA-256 and media-specific admission (static GLB or bounded PNG) all pass in
that order. Only the separate
AD-4 staging/pin lease plus `BackupFeasibilityPolicy` makes bytes eligible for
a Project publication. Existing recovery state is preserved on unavailable or
cancelled repair; even successful download cannot clear it before one complete
atomic local repair succeeds.

## HTTP contract

The HTTP adapter may use only:

- `GET /catalog-api/v1/catalogs/current`;
- `GET /catalog-api/v1/catalogs/{catalogVersion}`;
- `GET|HEAD /catalog-api/v1/resources/sha256/{hash}`; and

The HTTP API version and catalog content version are separate. Client routes
accept no body, cookie, credentials, account/user selector, generic query,
multipart form or caller-selected storage key. Queries, bodies, `Cookie` or
`Authorization` return bodyless `400`. All other methods, including `OPTIONS`, return a
fixed `405`; a syntactically invalid decoded version/hash is `400`, while a
valid absent version/hash is `404`, before database access. The browser adapter
must use `credentials: "omit"`, `redirect: "error"` and only fixed
`Accept`/`Range` headers. Metadata always sends exactly
`Accept: application/json`; resource calls send exactly their descriptor media
type. Ktor rejects `Cookie` or `Authorization`; the proxy forwards both
unchanged so the actual-origin smoke observes the same fixed `400`.

Unknown fields, duplicate members/ids, invalid taxonomy, unsafe integers,
missing descriptors, wrong media types and malformed SHA-256 values make the
whole envelope `invalid-envelope`; no partial catalog is exposed.

`current` uses `Cache-Control: no-cache, max-age=0, must-revalidate`.
Version-addressed envelopes and hash-addressed bytes use
`Cache-Control: public, max-age=31536000, immutable`. Strong ETags are derived
from the exact envelope or resource hash. Errors use `no-store`.

Resource delivery supports whole responses and one validated byte range.
Only `bytes=<start>-<end>` with canonical non-negative decimal integers is
accepted; open, suffix, multi, whitespace, overflow, start-after-end and
end-outside-resource ranges are `416` with `Content-Range: bytes */<length>`.
`If-Range` is unsupported and rejected as `400`. A successful `GET` range is
`206` with `Content-Type`, exact `Content-Length`, `Accept-Ranges: bytes`,
quoted hash ETag and correct `Content-Range`; full `GET` is `200` with the same
headers except `Content-Range`. `HEAD` accepts no Range and normally returns
the full `200` headers with no body. Exact `If-None-Match` on a non-range GET
or HEAD gives `304`, ETag/cache headers and no body. `Content-Encoding` is absent.

The service worker never stores or cache-first serves `catalogs/current`.
For internal Alpha it passes every `/catalog-api/**` request directly to the
network and never puts those responses in Cache Storage. Bytes supplied in an
arbitrary incoming request may be rejected at the edge but are never accepted
into an application value, reflected, persisted, application-cached or
application-logged.

## Publication and PostgreSQL ownership

There is no runtime publication/upload/admin HTTP endpoint in Alpha. A
separate Gradle-owned publish command, using only its publication database
role, reads the source-controlled manifest plus exact curated files, validates
their size/media/hash, and atomically inserts an immutable publication.
That command plus its private process-scoped credential is the publication
trust boundary. PostgreSQL enforces the exact structural DDL, references,
length/hash grammar and grants; it does not claim to parse media, recompute
hashes, normalize text or canonicalize JSON. Direct SQL use of the private
publisher credential is outside the accepted application path.

PostgreSQL owns only normalized `catalog_data` tables:

- `catalog_publication`;
- `catalog_asset`; and
- `catalog_resource` with exact `bytea` bytes;
- one-row `catalog_current` pointer;
- `catalog_variant_slot`; and
- `catalog_variant_option`.

Flyway owns only `catalog_migration.flyway_schema_history`. The exact columns,
types, constraints and allowed indexes are normative in
`contracts/catalog-control-plane/catalog-operator-bootstrap-v1.sql`,
`catalog-schema-v1.sql` and `catalog-envelope-v1.semantic.md`. The operator
bootstrap alone creates the three roles and two owned schemas; the Flyway
migration creates/alters neither roles nor schemas. The audit
allowlist includes those seven named tables and no application sequence, view,
materialized view, function, trigger, large object, extra column or other
non-system schema.

The schema has no `json`, `jsonb`, free-form payload, user/account/project
column, generic blob upload table or audit-body table where prohibited data
could hide. `PUBLIC` gets no schema/database privilege and default privileges
are revoked. A migration owner alone owns DDL. A publisher role receives
`SELECT`/`INSERT` on immutable catalog rows and `SELECT`/`INSERT`/`UPDATE` on
`catalog_current`, but no `UPDATE`, `DELETE`, `TRUNCATE` or DDL on immutable
tables. Immutability uses grants and constraints, not a trigger function.
Runtime receives only `SELECT` on catalog tables with a fixed
`search_path`. Integration tests use the actual three credentials and prove
forbidden DML/DDL/cross-schema access fails.

The no-Project proof is structural: accepted request/DTO fields and the exact
database object/column allowlist have no Project, Revision, History, Backup,
account, user-pinned or generic-upload field. Arbitrary label/id text is not
classified by comparing it with user data.

Before a transaction, the seed command resolves only regular, non-symlink
files whose real paths remain under the fixed catalog asset root; absolute,
traversal, unknown and non-regular inputs are rejected. It validates manifest
grammar, PNG/GLB signature and adopted static-GLB limits, every exact size/hash
and the complete envelope before database access.

Publication takes one transaction-scoped advisory lock. Resource bytes, all
asset rows, the publication and current pointer either become visible together
or not at all. A replay of an identical version/hash is a no-op; the same
version with any different byte/metadata fails. A newer manifest-owned
`publishedAt` wins current selection; equal/older versions cannot rewind it.
Prior publication/resource/asset/variant rows are immutable by grants.
The launcher runs the separate migration-credential `catalogValidate` command
before runtime; the SELECT-only runtime has no `catalog_migration` access. The
service fails readiness/startup unless exactly one complete current publication
exists; reconstruction from the same seed must
reproduce byte-identical version responses and ETags.

The migration and publication commands never share a credential.
`catalogMigrate` uses `CATALOG_MIGRATION_DATABASE_*` and exits;
`catalogValidate` uses the migration credential and exits; `catalogPublish`
then uses `CATALOG_PUBLISH_DATABASE_*` and exits; only then
may `run` receive SELECT-only `CATALOG_DATABASE_*`. The publisher is not an
application account and authenticates with a process-scoped dedicated
PostgreSQL username/password. The runtime process receives distinct credentials
and its environment/schema tests prove it cannot obtain migration/publication
authority. Browser bundles, HTTP responses and logs contain neither credential.

## Alpha operations and privacy

For the internal Alpha, PostgreSQL and the Kotlin service bind loopback only:
PostgreSQL on its container-mapped loopback port and Ktor at
`127.0.0.1:4174`. The Rspack `0.0.0.0:4173` dev server preserves the
`/catalog-api` prefix while proxying to Ktor, forwards `Cookie`/`Authorization`
unchanged for Ktor rejection, does not transform bytes and forwards
`Range`/conditional headers. Invalid or
missing backend URL/port fails startup rather than silently falling back to a
bundled remote catalog. The existing single Cloudflare tunnel exposes only the
web origin, so phone traffic uses the same route and no second LAN/public
backend endpoint or credentialed CORS mode is introduced.

There is no cloud provider, CDN, object store, end-user/operator account,
cookie, analytics pipeline, product telemetry, user-data log, SLA or public
availability promise in this slice. Application logs are an allowlist of
fixed route class, fixed reason code, server-generated correlation id and
build version; bodies, headers, IP addresses, asset bytes and file paths are
not logged.

The local catalog database is reconstructed from the versioned seed. This is
the selected internal-Alpha recovery policy; no RPO/RTO is claimed. Provider,
IAM, public hosting, production backup/restore, retention, abuse controls and
availability targets must be selected before any public deployment and may
not expand the AD-17 perimeter.

## Failure semantics

`CatalogGatewayPort` exposes only:

- an available validated publication;
- `control-plane-unavailable` for metadata/service reachability;
- `unpinned-download-unavailable` for a selected resource not yet locally pinned;
- `cancelled`; and
- `invalid-envelope` or `resource-integrity-mismatch`.

None of these outcomes selects `ResourceRecoveryRequired`, changes writer
access, mutates a Project or makes a healthy local Project read-only. Only a
separate local integrity scan finding missing/corrupt bytes already referenced
by the current Project may enter Story 8.6 recovery.

## Required executable evidence

- Ktor contract tests for the route/method/body allowlist, envelope validation,
  ETag/conditional requests, cache headers, `HEAD`, range `206`/`416` and fixed
  errors.
- PostgreSQL 18.4 integration tests for migrations, atomic publication,
  immutable versions, exact bytes/hash, normalized schema allowlist and
  SELECT-only runtime privileges.
- A negative corpus proving Project-shaped fields and request flows cannot be
  accepted into an application value, reflected, persisted, cached or
  application-logged when supplied in bodies, queries, headers or malformed
  routes. Database evidence is the exact structural object/column allowlist;
  it does not attempt to infer provenance from arbitrary label/id text.
- Web adapter tests for decoding, hash/size verification, cancellation and
  typed outage mapping.
- `CATALOG-E2E-02` with a controlled fake gateway for deterministic UI state,
  plus a real Kotlin/PostgreSQL smoke through the actual Rspack origin/proxy.
  The shared corpus must show catalog version/front/variant/resource metadata,
  accessible retry/cancel, stable Project semantic digest/current Revision id,
  Durable Revision count and writer access, no pending publication and no new
  recovery/read-only state. A fully pinned Project must still open, edit,
  publish, undo/redo and export a Portable Backup during outage.
- A static dependency check proves only `adapters/catalog` performs remote
  catalog transport; UI and application code cannot call the legacy direct
  catalog fetch path.

## Deferred by explicit absence

Runtime publication API, public operator/account authentication,
cloud/provider topology,
object storage/CDN, cross-origin delivery, public SLA/SLO, production backup
retention, incident response and user/account functionality do not exist in
this implementation. They are release-time decisions, not incomplete hidden
parts of Story 5.6.
