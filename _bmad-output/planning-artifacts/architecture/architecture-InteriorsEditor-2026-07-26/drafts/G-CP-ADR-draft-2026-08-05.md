---
title: "G-CP-ADR — bounded control-plane ADR draft for independent review"
status: draft_for_independent_review
canonical: false
created: 2026-08-05
updated: 2026-08-05
revision: R2
authoring: "bmad-architecture update preparation"
parent_spine: ../ARCHITECTURE-SPINE.md
parent_intake: ../G-CP-ADR-INTAKE.md
review_inputs:
  - G-CP-ADR-security-data-boundary-review-2026-08-05.md
  - G-CP-ADR-operations-recovery-review-2026-08-05.md
  - G-CP-ADR-legal-asset-governance-review-2026-08-05.md
gate: G-CP-ADR
closes_gate: false
implementation_authority: false
---

# G-CP-ADR — bounded control-plane ADR draft

## Status and authority

This is a **noncanonical review input**, not an adopted Architecture Decision
and not an update to `ARCHITECTURE-SPINE.md`. It turns the selected packet in
the delegated change proposal into a reviewable candidate without changing
`G-CP-ADR: inputs_pending`.

It does **not** authorize Kotlin code, a Gradle wrapper, a PostgreSQL schema,
an API, a deployment, a provider account, object storage, CI, secrets,
configuration, a catalog, a commit, or any product-root artifact. `G-READY`
remains `NOT_READY`.

The only already-adopted stack baseline inherited from `AD-17` is Kotlin
`2.4.10` plus PostgreSQL `18.4`, and even that adoption is limited to a narrow
Catalog Control Plane. Every additional choice below is a proposed ADR input
until the review gate in this document passes and an owner adopts it through
the canonical architecture workflow.

### R2 disposition

R2 incorporates the blocking conditions from the independent
[security/data-boundary](G-CP-ADR-security-data-boundary-review-2026-08-05.md),
[operations/recovery](G-CP-ADR-operations-recovery-review-2026-08-05.md), and
[legal/asset-governance](G-CP-ADR-legal-asset-governance-review-2026-08-05.md)
reviews. Their findings are retained as requirements, not treated as approvals.
R2 has not itself received a new independent review, therefore it remains a
precanonical input and must be reviewed again before any canonical adoption.

## Inherited non-negotiable boundary

This draft is constrained by `AD-2`, `AD-4`, `AD-14`, `AD-16`, `AD-17`,
`FR-54`, `NFR-10`, `NFR-13`, and `NFR-21`.

The remote perimeter may own only curated, versioned catalog metadata,
resource descriptors and catalog resource bytes, content version/hash,
provenance, human-approved `AssetUsageGrant`, required notices, and the
minimal publication/audit data needed to operate those records.

The existence of a catalog byte, descriptor, hash, or `AssetUsageGrant` does
**not** by itself authorize unauthenticated/public raw-byte delivery. Such
delivery is forbidden by default. It needs a separate, immutable, per-version
human-approved delivery scope in the publication dossier; a private-transfer
or Portable Backup right cannot be inferred as public delivery permission.

It must never create account identity or accept, store, synchronize, recover,
derive, log, analyze, back up, proxy, cache on behalf of a user, or otherwise
own any of the following:

- User Project or any Project JSON/geometry;
- Revision, `PendingDurability`, session History, Command, draft, selection,
  writer lease, recovery state, screenshot, or diagnostic payload containing
  Project content;
- Portable Backup, `.interiors` member, manifest, checksum set, import/export
  request, or recovery bundle;
- a user's pinned resource bytes, local blob-store key, or browser-storage
  inventory;
- remote sync, collaboration, user account, user profile, cookie session, or
  a user-to-Project relationship.

`CatalogGatewayPort` remains the only web-to-remote seam. The web adapter must
make local exact-byte pinning and `BackupFeasibilityPolicy` decisive: a remote
response is never Durable Project state. A healthy Project with all exact
referenced bytes pinned remains able to open, edit, publish a Durable Revision,
undo/redo locally, and export a complete Portable Backup while this perimeter
is unavailable.

## Candidate decision

If adopted after the gate, the Catalog Control Plane is a separately built
internal root at `apps/catalog-control-plane`, not a separately delivered
product and not a path to a general backend. Its only job is a curated catalog
publication/read perimeter behind `CatalogGatewayPort`.

### Proposed build and runtime direction

| Area | Proposed bounded choice | Why this is a credible input, not an adoption |
| --- | --- | --- |
| Build/test | Gradle Wrapper `8.10.2`, Kotlin DSL, Gradle-only Kotlin unit/contract/integration tests | The official Gradle `8.10.2` release explicitly recommends the Wrapper pin. Kotlin's compatibility table lists Kotlin Gradle Plugin `2.4.0–2.4.10` as fully supported on Gradle `7.6.3–9.5.0`; the selected pair is inside that range. JavaScript runners remain limited to `apps/web` by AD-16. |
| JVM toolchain | JDK `21` toolchain | JDK 21 is an LTS release; Gradle supports Java 21 toolchains and running Gradle from 8.5 onward. The exact JDK vendor, image digest, update cadence and licence review are intentionally not selected here. |
| Language | Kotlin `2.4.10` | This is the inherited AD-17 baseline. Kotlin's official release page identifies it as the latest bug-fix release of the supported 2.4 line on the review date. |
| HTTP service | Ktor `3.5.1` on JVM/Netty | Ktor documents 3.5.1 as a Kotlin 2.4-compatible patch release and documents the JVM/Netty server route. This selects neither an endpoint schema nor a provider. |
| Contract shape | Versioned HTTPS REST/JSON described by OpenAPI `3.1` | The selected input is intentionally conventional and reviewable. It must stay transport-contract-first; no client/domain type may leak Project-shaped values into it. OpenAPI 3.1 remains a specification family, not a license to generate an API before approval. |
| Catalog database | PostgreSQL `18.4` | This is the inherited AD-17 baseline. PostgreSQL's official release and support policy identify 18.4 as a supported 18.x security-maintenance release at review time. A future release decision must record its exact deployed minor and re-run security review rather than silently pinning an obsolete image. |
| Schema migration | Flyway OSS `13.0.0`; forward versioned SQL migrations; `validate` required; production `repair` and `clean` prohibited | The official Flyway 13.0.0 release record exists. The operational constraints preserve an auditable, forward-only catalog schema and must be exercised in an isolated test database before adoption. |

No “latest” selector, unpinned distribution, host JDK, JavaScript package
manager, second JavaScript lockfile, or cross-build shortcut is allowed by
this candidate. At an authorized future bootstrap the wrapper distribution
checksum, JDK vendor/build digest, Ktor/Flyway dependency checksums, and
PostgreSQL image/package identity must be recorded and independently checked;
they are deliberately not invented in this planning artifact.

### Proposed remote data classification

| Surface | May contain | Must reject or omit |
| --- | --- | --- |
| Public catalog metadata read | Published immutable metadata, descriptor/hash, safe provenance and notice summary, grant identifier, and availability state — **never raw asset bytes by default** | Raw model/texture/subresource bytes, a download URL/redirect/range response, request bodies, cookies, sessions, Project IDs, Project-derived filters, placement state, browser blob keys, backup/recovery data, user analytics identifiers |
| Conditionally enabled raw-byte delivery | One exact **catalog-owned** byte of a version whose publication dossier has a separate human-approved per-version delivery scope; the response remains bound to the immutable descriptor/hash/media type | Any raw byte without that scope; public bucket/object URL by default; user-specific namespace, cookie/session/account workaround, generic signed upload, Project/Revision/History/Backup/user-pinned bytes, or caller-controlled cache/object keys |
| Operator publication/withdrawal | Bounded immutable publication or withdrawal record with dossier references, exact descriptor/hash, provenance, complete grant, delivery-scope decision, notices and permitted state transition | Any user content; Project/Revision/History/Backup payloads or references; user-pinned bytes; generic file upload; sync/recovery/import/export commands; mutation of a published byte/descriptor/grant snapshot in place |
| PostgreSQL | Only a dedicated **catalog-only** data scope: catalog identities/versions, descriptors, provenance, grants, delivery-scope and notice snapshots, publication/withdrawal state, migration metadata and minimal publication audit | A shared Project-service cluster/restore target, or any table, column, JSON/document escape hatch, index, queue, seed, failed-migration artifact or audit field for Project, Revision, History, backup, browser context, user asset pin, account, session or collaboration |
| Private object storage | Only a dedicated **catalog-only** bucket/container and recovery namespace holding immutable catalog-owned bytes bound to approved descriptor/hash/provenance/grant/notice snapshots | Public bucket access by default, user upload/download staging, `.interiors`, a Project/Revision/History/backup object, browser-pinned bytes, a per-user namespace, generic proxy/cache, recovery archive, or object metadata/tags containing prohibited values |
| Application logs and diagnostics | Fixed reason code, deployment/build version, route class, server-generated correlation token that cannot identify a user, and bounded operational outcome | Request/response body, cookie, authorization token, Project data, asset bytes, filename/path, IP address, referrer, user identifier, browser-storage state, backup/recovery details |
| Provider/platform access, audit and support logs | No approved product-field inventory yet; this draft does not claim unavoidable provider metadata is absent | Any Project/Revision/History/Backup/user-pinned byte, request body, bearer token, raw OIDC claim, asset byte, filename, object path, client trace header or reflected prohibited value; field inventory, minimisation, access and retention remain human blockers |
| Operations backup/restore | A paired, catalog-only PostgreSQL **and** catalog-object recovery set, restored only to an isolated non-public environment and reconciled against the publication dossier before exposure | A Portable Backup substitute, Project recovery system, user-pinned bytes, user state, cross-context sync route, shared backup account/cluster/bucket/restore target, or a restored descriptor that is not paired with its exact catalog byte |
| Analytics | None for product use | Product analytics, tracking pixels, Project-derived events, user profiling, asset-use telemetry tied to a person/device, or a fallback log export that behaves as analytics |

The distinction between a published catalog byte and a user's pinned byte is
semantic and mandatory: the former is a curated source resource owned by the
catalog corpus; the latter is a local Project dependency and never travels
back to this perimeter.

The distinction between metadata and raw-byte delivery is equally mandatory:
an approved metadata record never grants raw-byte delivery. Any CDN, reverse
proxy, redirect, signed URL, object-store URL, range request, cache or error
path that can return raw bytes is a delivery surface and must satisfy the same
per-version scope and later provider/IAM review.

### Proposed request and failure contract

The future API/delivery specification may expose only these bounded capability
classes:

1. **Public read-only catalog metadata capability.** It returns published
   metadata/descriptors and only the safe provenance/grant/notice summary. It
   carries no body, cookie, session, account, Project-derived selector or raw
   asset byte.
2. **Per-version conditional raw-byte delivery capability.** It is absent for
   every version whose separate human-approved delivery scope is missing,
   unknown, expired, withdrawn or forbids the relevant delivery exposure. A
   permitted response may return only the exact descriptor-bound catalog byte.
   It does not turn a bucket public, create an account/session, or accept a
   caller-selected object key or user data.
3. **Separated operator capability.** It creates an immutable catalog
   publication or records a withdrawal after operator authorization. It accepts
   only the bounded dossier/release record below, never a generic binary upload
   or a user-selected file/backup.

The exact routes, methods, headers, query grammar, request/response fields,
unknown-field rule, media types, range/CORS/cache/content-disposition/error
policy and byte/count limits are deliberately unselected. Before adoption they
must become versioned allowlists and a machine-readable negative corpus; no
untyped query/header/body/multipart fallback may carry a prohibited value.

The mechanism that first ingests a curated catalog-owned resource byte is
deliberately still open. A later ADR may select a controlled publisher pipeline
only if it binds an approved catalog identity/version, exact bytes/hash/size/
media, provenance, grant, per-version delivery scope and notices before an
object-store write. Its state machine, temporary storage/queue/dead-letter
handling, idempotency/replay, orphan cleanup, failure compensation and
DB-to-object publication boundary are human/operator blockers, not answers in
this draft. It must not fill this gap with browser upload, multipart user
upload, pre-signed user upload, backup import, arbitrary URL fetch, generic
operator blob or generic object-store proxy.

Any inbound field, encoded body, multipart payload, query value, header,
object key, log attribute, migration data, operator UI form, or asynchronous
job that represents a prohibited class is a contract violation and must be
rejected before persistence, object-store interaction, audit append, or log
write. An error response must use a fixed non-sensitive reason and must not
echo the prohibited value.

When catalog metadata or an unpinned resource is unavailable, the only
client-visible outcomes are `control-plane-unavailable` or
`unpinned-download-unavailable`. Neither outcome is `ResourceRecoveryRequired`
and neither may block a healthy local Project. Missing/corrupt locally pinned
bytes remain a local integrity condition; the catalog can only later offer one
candidate source for an exact-byte repair, which the client verifies locally.

### Per-version publication dossier and release gates

No catalog version may transition to published merely because an operator holds
`catalog:publish` or a byte exists in object storage. Each version needs an
immutable, controlled dossier whose public metadata exposes only the approved
safe summary and notice fields. The underlying licence/contract evidence stays
in a controlled evidence location chosen by the named human owners.

| Dossier record | Minimum immutable binding | Accountable human record required before publication |
| --- | --- | --- |
| Provenance dossier | Catalog identity/version; acquisition/source chain; exact source/model/texture/subresource hashes and media types; transformation lineage | Named Asset steward and Legal approver, with evidence references and review status |
| `AssetUsageGrant` snapshot | Separate `runtimeUsePolicy`, `backupPackagingPolicy` and `renderedOutputPolicy`; every subresource/derived runtime byte; notice requirements; validity/review/withdrawal state | Named Legal approver and Asset steward; no licence label or automated scan substitutes |
| Per-version delivery scope | Exact version/byte(s), permitted exposure if any, validity/expiry and withdrawal state; it is separate from private-transfer/backup rights | Explicit human approval for raw-byte delivery; absence, unknown or forbidden means metadata-only publication |
| Derivative-resource manifest | Source hash → approved tool/profile → every exact output hash/media mapping | Asset steward confirms the grant/provenance covers each transformation |
| Notice-placement matrix | Exact notice text/version/locale and required catalog-card, bundle-manifest, export-UI and visible-PNG placements; future bounded/safe-rendering rule | Legal approver, Asset steward and product/export owner confirm the same grant snapshot |
| Publication release record | Immutable descriptor/hash + provenance/grant/delivery-scope/notice snapshots + completed technical checks | Designated publisher plus the named approvers; records a permitted state transition only |
| Expiry/withdrawal/correction register | Trigger, effective state, affected immutable versions and corrective publication action | Legal approver, Asset steward and product owner; records non-destructive handling of local copies |

The controlled publisher pipeline must reject a publication unless all of these
gates are true:

1. Every source, model, texture, subresource and derivative runtime byte is
   enumerated with its exact hash/media value and binds to one immutable
   catalog version.
2. The provenance dossier and human `AssetUsageGrant` cover exactly that set,
   with no missing, unknown, expired, withdrawn or forbidden required policy.
3. Every `allowed-with-notice` obligation has a bound, reviewable placement;
   a metadata-only notice cannot replace a required visible-PNG placement.
4. Raw-byte delivery is disabled unless the separate per-version delivery scope
   explicitly approves it. A descriptor, grant ID, cached byte or private
   Portable Backup right never supplies that scope by inference.
5. The object write, immutable descriptor, PostgreSQL release record and
   publication state are reconciled as one release gate; an orphan, mismatch
   or failed write cannot make a version discoverable or deliverable.
6. A byte, transformation, notice, grant revision, delivery scope, expiry or
   withdrawal change creates a new reviewable publication state rather than
   mutating a published descriptor in place.
7. Withdrawal stops new publication/delivery according to the steward-owned
   record, but never deletes, rewrites or reclassifies a user's locally pinned
   byte, Durable Project or Portable Backup, and never turns into
   `ResourceRecoveryRequired` merely because a catalog version was withdrawn.

The exact dossier system, schema, dual-approval requirement and publication
state machine remain unselected human/operator decisions. They must not be
silently replaced by mutable free-form metadata, a generic database document,
or an unaudited operator form.

### Proposed operator security boundary

Public catalog **metadata** reads are unauthenticated and read-only; they do
not establish an end-user account, cookie, session, or user table. Conditional
raw-byte delivery exists only where its separate per-version scope explicitly
permits that exposure; it must not be enabled merely because metadata is
public, and it must not be solved by adding an end-user account. Operator
routes are separate and require externally issued OIDC JWTs validated against
an approved issuer/JWKS configuration. The candidate scopes are exactly:

- `catalog:publish` for immutable publication;
- `catalog:withdraw` for withdrawal.

The eventual implementation must verify issuer, audience, authorized-party
where applicable, signature, allowed algorithm/key type, expiry/not-before,
`kid`/unknown-key behavior, `crit`/`none` rejection, key rotation, scope and
permitted publication-state transition before an operator action. It must not
trust a caller-selected `jku`/remote key URL or client-provided correlation
header. An external operator principal is authorization context only, not a
product user/account or a link to a Project.

The trusted issuer discovery/JWKS origin and egress restrictions, TLS policy,
tenant, audience, clock skew, JWKS cache/refresh/fail-closed behavior,
revocation/offboarding, replay/idempotency, scope matrix, second approval,
break-glass process, secret manager, encryption-key custody/rotation and audit
identity minimisation remain unresolved human Security/Operations decisions.
This draft does not select an identity provider or a secrets system.

### Proposed operating boundary

The candidate operating shape is a stateless single-region container service
behind a TLS reverse proxy, managed PostgreSQL and versioned private
S3-compatible object storage. It describes a direction, not a provider or
deployment configuration. The following isolation constraints are mandatory
for a later adoption:

- PostgreSQL must be a dedicated catalog-only instance/cluster, database-role
  and backup/restore scope; it cannot share an application cluster, backup
  account or restore target with a current or future User Project service,
  generic media, support export, user upload or Portable Backup.
- Object storage must be a dedicated catalog-only bucket/container plus
  recovery namespace. It remains non-public; a per-version delivery scope does
  not make the bucket itself public or create a generic object path.
- Ingestion, service read, backup, restore and operations must use separate
  least-privilege identities. Runtime reads cannot list/write/delete; public
  clients cannot List/Write/Delete or obtain a generic pre-signed upload.
- A hash-shaped key is not proof of immutability. The later provider-specific
  decision must state and test the hash algorithm/encoding, create-only or
  conditional write, overwrite/delete/list policy, versioning/object-lock or
  equivalent controls, retention and withdrawal/deletion semantics.

Database protection is provisionally daily backup plus WAL/PITR, with a
witnessed paired restore drill before release. A valid drill restores both the
dedicated PostgreSQL catalog data **and** its exact catalog-owned objects to an
isolated non-public environment, then verifies schema/privilege allowlists,
object inventory, descriptor/hash/media, provenance, grant, delivery scope and
notices before any exposure. It records actual RPO/RTO, tools/builds, actor
roles and cleanup. It is never Project/Revision/History/Portable Backup
recovery. A partial DB-only or object-only restore that leaves a descriptor
pointing at missing/wrong bytes is a failed catalog restore, not a successful
fallback.

The proposed retention input is: no product analytics; operational logs retain
no bodies/cookies/Project data/IP/referrer and expire after 14 days; the
minimal publication audit record expires after 365 days. Those are placeholders
until field-level inventories cover reverse proxy, CDN/WAF/load balancer, Ktor,
database, object store, traces/APM, crash reporting, metrics, alerts, DNS/HTTP
egress and support exports. Provider access logs may retain unavoidable
metadata; they must be minimised, governed and documented rather than claimed
absent. The exact provider, region/residency, network topology, availability/
SLA, backup provider, replication, object-lock policy, encryption/key
management, secret storage, incident response, deletion process and legal basis
for retention remain open. No vendor is selected by “S3-compatible”.

## Required proof before adoption

An adopted `G-CP-ADR` must name accountable owners and attach reproducible
evidence for all of the following. These are acceptance obligations for a
future authorized slice, not permission to create it now.

1. **Reproducible Kotlin boundary and supply chain.** A frozen Gradle Wrapper,
   JDK toolchain and repository/dependency allowlist build and test Kotlin only
   under Gradle on a clean runner; Wrapper/JDK/dependency/plugin/artifact image
   identities, SBOM and patch/incident policy are reviewed. No host JDK,
   JavaScript runner, dynamic version or unreviewed repository participates.
2. **Versioned allowlist and capture corpus.** Machine-readable request,
   response, header, query, media, range/CORS/cache/error and byte/count
   allowlists drive contract, integration and browser-capture tests. They prove
   that Project identifiers/geometry/placement/history/recovery state,
   browser-storage keys, backup metadata and client trace headers never reach
   `CatalogGatewayPort`, URL, header, body, retry, telemetry or error report.
3. **Publication dossier gate.** Tests and human records prove byte → hash →
   provenance → transformation → `AssetUsageGrant` → separate delivery scope
   → notice-placement → immutable release binding for every resource and
   subresource. Metadata publication never enables raw delivery by inference.
4. **Delivery and ingress boundary.** Positive/negative evidence proves a
   raw byte is unavailable without its per-version human-approved delivery
   scope, and the controlled publisher pipeline rejects browser/user/generic
   upload, arbitrary URL fetch, backup import and prohibited values before
   temporary storage, queues, object metadata or logs.
5. **PostgreSQL/migration and rollback proof.** A catalog-only schema and
   privilege allowlist, migration-only principal, empty/prior/failed migration
   corpus and post-migration inspection prove there is no Project/document/
   queue/audit escape hatch. `flywayValidate` passes, runtime has no DDL, and
   rollback is either a compatible prior image or a catalog-only forward-fix/
   restore runbook — never automatic `repair`, `clean`, destructive down
   migration or request-triggered schema mutation.
6. **Provider-backed object/IAM proof.** Against the selected provider,
   allow/deny tests inspect non-public catalog-only storage and separate
   identities for ingest/read/backup/restore/operations. They cover
   create/read/overwrite/delete/list/lifecycle/restore, immutable-byte policy,
   object metadata/tags and no user pin/backup/recovery namespace; an emulator
   or a hash-shaped key alone is insufficient.
7. **Paired recovery/PITR proof.** A witnessed restore of the dedicated
   PostgreSQL data plus catalog object inventory reaches an isolated target,
   validates descriptor/hash/media/provenance/grant/delivery-scope/notices and
   runs the negative Project-data corpus before exposure. It records RPO/RTO,
   retention/key availability and cleanup, and proves no User Project recovery
   or sync capability exists.
8. **Outage and local-first proof.** Contract evidence demonstrates that remote
   DNS/timeout/5xx/partial-byte failure maps only to the two catalog-unavailable
   states while local Project editing/durability/history/Portable Backup remain
   local. A network resource is not a successful repair until local exact-byte
   validation passes.
9. **Operator-security and observability proof.** Tests cover issuer/audience/
   authorized-party/signature/algorithm/key/`kid`/expiry/revocation/replay,
   wrong scope/state transition, separated routes, no account/user table and
   fail-closed JWKS behavior. End-to-end normal/error/auth/timeout evidence
   covers proxy/CDN/WAF/application/database/object-store/trace/APM/metric/
   crash/support paths, field-level retention/deletion and no unsafe output.
10. **Human provenance and delivery proof.** A named Legal approver and Asset
    steward supply the complete per-version grant, delivery scope, provenance,
    transformation and notice corpus for each exact Alpha resource/subresource.
    A licence label, automated scan, application field or unsigned manifest
    cannot stand in for that approval.

## Independent review gate

`G-CP-ADR` cannot pass because this draft exists. Before canonical adoption,
the following independent reviews must each issue a written disposition against
the concrete R2-or-later ADR, its evidence, and its owners. The three R1
reviews are evidence inputs; they are not a pass of R2:

| Review | Independent remit | Cannot be waived by |
| --- | --- | --- |
| Security | OIDC/JWT/JWKS trust/egress/revocation, route separation, state-transition scope model, secrets, TLS, supply-chain, delivery/object-store exposure and threat model | A green unit test or a selected framework version |
| Data-boundary and privacy | Exhaustive prohibited-data corpus across request/delivery, database, migration, queues, object storage, audit, log, telemetry, backup/restore, provider paths and failure paths | A type name, diagram, or statement that the backend is “catalog only” |
| Operations and recovery | Provider/region/residency, dedicated PostgreSQL/bucket scope, paired DB+object PITR restore, IAM, immutability, retention/deletion, monitoring, incident ownership and release evidence | A local Docker proof or a provider marketing claim |
| Legal and asset governance | Per-version human `AssetUsageGrant`, separate raw-delivery scope, provenance/derivative corpus, notices, private-transfer/backup/rendered-output rights, release/withdrawal dossier and steward accountability | Automated licence detection or an unsigned manifest |
| Architecture reconciliation | No contradiction with AD-2/4/14/16/17, SPEC catalog contract, PRD FR-54 and local-first outage semantics | This noncanonical draft |

Any unresolved critical finding stays in the canonical ADR's `Deferred` or
open-question section and keeps `G-CP-ADR` blocked. The final gate also needs
the normal BMAD reviewer pass; this preparation document does not substitute
for it.

## Open decisions that require named human owners

| Open decision | Required owner(s) | Why it remains open |
| --- | --- | --- |
| Cloud/provider, managed PostgreSQL and S3-compatible object-store provider | Product + Operations + Security | No provider, subprocessors, service plan or contractual privacy/residency choice has been made. |
| Deployment region, residency, replication/CDN and network/DNS/TLS boundary | Product + Legal + Operations + Security | A single-region direction is not a named jurisdiction, copy inventory or authority for a replica/cache. |
| Dedicated catalog-only PostgreSQL cluster/database/roles and backup/restore account | Operations + Security + backend/catalog owner | The draft requires isolation but does not select the concrete cluster, privilege model or recovery account. |
| Dedicated catalog-only bucket/container, recovery namespace, object immutability and IAM | Operations + Security + backend/catalog owner | The draft deliberately does not choose provider-specific versioning/object-lock/create-only/delete/list/retention policy or service identities. |
| Per-version raw-byte delivery scope and delivery plane | Named Legal approver + Asset steward + Product + Security | Metadata/grant/private-transfer rights do not imply unauthenticated raw delivery; scope, expiry, withdrawal and delivery mechanism need human approval. |
| Curated resource-byte ingress and immutable publication state machine | Backend/catalog owner + Security + Asset steward + Legal approver | Temporary objects/queues, validation order, retries, orphan cleanup, DB/object release boundary and operator controls are not selected. |
| Grant/provenance/notice/release/withdrawal dossier and actual corpus | Product + named Legal approver + named Asset steward | No human appointment or resource-by-resource evidence currently covers the full Alpha rights surface. |
| OIDC issuer, tenant, audience, discovery/JWKS egress, scope matrix and operator lifecycle | Security + Operations | Selecting OIDC/JWKS is not selecting a trustworthy issuer, revocation/offboarding or accountable administrator. |
| Secrets, signing/encryption keys, custody, rotation and break-glass | Security + Operations | The draft states controls but does not choose their custodian, system or incident procedure. |
| JDK distribution/image, database/image patch policy, repositories, SBOM and supply-chain attestation | Backend/catalog owner + Security | JDK 21/tool versions are direction pins; exact distributables and security response need a later reproducible decision. |
| Migration serialization, privilege separation, expand/contract compatibility and release rollback | Backend/catalog owner + Operations + Security | Flyway direction does not select migration lock, prior-image compatibility, forward-fix/restore runbook or service release order. |
| Observability field inventory, provider metadata, retention/deletion and support-export path | Product + Legal + Operations + Security | “No analytics” and target retentions do not select all collection points or the legal basis for unavoidable provider metadata. |
| Availability/SLA, catalog RPO/RTO, restore drill and operational support | Product + Operations + Security | The product has no adopted remote-service promise or named incident/recovery owner. |
| Rate limiting/abuse controls without identity | Security + Product | It must not be solved by silently adding end-user accounts, cookies, tracking or Project-derived signals. |

## Primary-source evidence checked for this draft

- Gradle's [8.10.2 release](https://github.com/gradle/gradle/releases/tag/v8.10.2)
  documents the exact Wrapper version; the [Gradle compatibility
  matrix](https://docs.gradle.org/current/userguide/compatibility.html) lists
  Java 21 support from Gradle 8.4 onward.
- Kotlin's [Gradle configuration guidance](https://kotlinlang.org/docs/gradle-configure-project.html)
  lists Kotlin Gradle Plugin `2.4.0–2.4.10` as compatible with Gradle
  `7.6.3–9.5.0`, while the [Kotlin release
  page](https://kotlinlang.org/docs/releases.html) records `2.4.10`.
- [OpenJDK 21](https://openjdk.org/projects/jdk/21/) identifies JDK 21 as an
  LTS release; the exact distributor remains a deliberate operational choice.
- Ktor's [release page](https://ktor.io/docs/releases.html) and [JVM/Netty
  server guide](https://ktor.io/docs/server-create-a-new-project.html) document
  `3.5.1` and the selected server engine.
- PostgreSQL's [18.4 release notes](https://www.postgresql.org/docs/release/18.4/)
  and [versioning policy](https://www.postgresql.org/support/versioning/)
  establish the review-date baseline and supported-major policy.
- Flyway's [13.0.0 engine release notes](https://documentation.red-gate.com/flyway/release-notes-and-older-versions/release-notes-for-flyway-engine)
  and [Validate command reference](https://documentation.red-gate.com/flyway/reference/commands/validate)
  establish the selected migration-tool input and its limited validation role.
- Gradle's [Wrapper verification guidance](https://docs.gradle.org/current/userguide/gradle_wrapper.html),
  PostgreSQL's [backup/restore documentation](https://www.postgresql.org/docs/18/backup.html)
  and [pg_basebackup reference](https://www.postgresql.org/docs/18/app-pgbasebackup.html),
  and S3's [Object Lock documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
  inform the required future integrity/PITR/immutability review. They do not
  select a provider, region, object-lock mode or recovery policy.
- The [OpenAPI specification registry](https://spec.openapis.org/oas/) and
  [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0-18.html)
  are cited for the proposed contract and operator-token review surface, not as
  a preselected API/identity provider.

The research date is 2026-08-05. Any later adoption must repeat time-sensitive
version, security and provider checks.

## Consequence for delivery

Until all gates above pass and a canonical ADR is adopted, `V-09-CP` and Story
5.6 remain blocked. This draft cannot be used to infer that code, deployment,
catalog publication, a raw-asset delivery path, a provider decision, or
production readiness is approved.
