---
title: "InteriorsEditor — independent adversarial security review of G-CP-ADR R2"
review_type: adversarial-security-precanonical-control-plane-r2
reviewed: 2026-08-05
reviewer: "Codex /root/d022_exact_geometry_research"
reviewed_artifact: ../drafts/G-CP-ADR-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 4e6e4248b76d6cc04350be6ff69dbb34232a00a44853cf480267f3b094854f0c
  r1_security_data_boundary_review_sha256: 6d85f24fde4b2cacf63505fdf366119c97c91dcd1016c403bae79065518a6a38
  r1_operations_recovery_review_sha256: 9741cb6dd9bb920ac6191aaf14b9c47b3dde9223f1d79d5de8ddd2d228a96223
  r1_legal_asset_governance_review_sha256: 8364ba6a53767c49255f157fe779be613474860c70427289a0c01d696e1acb60
  r2_data_boundary_privacy_review_sha256: 41c78cb2a01c5142b156510e91feab3dcd6775fbbb6e024ddb2995f58d56baea
  architecture_spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  intake_sha256: bfc899e0dc3b2e4e69850a664812025082d7942a9a47ad6fd51e4fe5c8b78876
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../G-CP-ADR-INTAKE.md
  - ../drafts/G-CP-ADR-security-data-boundary-review-2026-08-05.md
  - ../drafts/G-CP-ADR-operations-recovery-review-2026-08-05.md
  - ../drafts/G-CP-ADR-legal-asset-governance-review-2026-08-05.md
  - review-current-source-g-cp-adr-r2-data-boundary-privacy-2026-08-05.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../../project-context.md
status: complete
verdict: PASS_FOR_PRECANONICAL_INPUT_ONLY
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Read-only independent adversarial review of the R2 security model at the declared SHA: public metadata and conditional raw-byte delivery, OIDC/JWT/JWKS, ingress/egress/object storage/CDN/cache, CI/supply chain, logs and secrets. No draft, canonical source, memlog, code, test, configuration, evidence or owner-decision mutation."
source_mutations: "Created this independent review artifact only."
---

# Verdict

**`PASS_FOR_PRECANONICAL_INPUT_ONLY`; `G-CP-ADR` remains `BLOCKED` and
`G-READY` remains `NOT_READY`.**

R2 is safe to retain as a *noncanonical planning input* because it turns the
three R1 reviews into explicit gates instead of silently claiming the controls
exist.  In particular, it corrects the dangerous implication that a published
descriptor, a grant, a private-transfer right, or public metadata permits
unauthenticated raw-byte delivery.  It also keeps the only allowed remote
perimeter behind `CatalogGatewayPort` and keeps all Project, Revision, History,
Portable Backup and user-pinned bytes local.

This is not a security certification, a provider decision, a raw-delivery
approval, or authority to implement a Kotlin service, CI, identity integration,
storage, CDN, secret or deployment.  The stated SHA may be used only as input
to the next source-owning architecture workflow.  A concrete successor must
resolve every blocker below and receive a fresh independent review against its
actual provider-backed evidence.

## What R2 correctly carries forward

- The public metadata route, raw-byte route and operator route are separate
  capability classes.  Metadata does not implicitly grant raw-byte access, and
  a raw response is default-deny until an immutable per-version human approval
  exists.
- The draft treats redirects, signed URLs, object-store URLs, ranges, caches,
  CDNs and errors that can return bytes as delivery surfaces.  This is the
  necessary policy boundary; it is not yet an enforcement mechanism.
- It does not create an end-user identity, cookie session, Project-sync,
  recovery or generic upload path.  A remote response still cannot make a
  local Project durable without local exact-byte pinning and
  `BackupFeasibilityPolicy`.
- It explicitly rejects caller-selected JWKS URLs and names issuer, audience,
  authorized party, algorithm, key, `kid`, expiry, revocation and replay as
  mandatory operator-token checks.
- It retains the R1 direction for private catalog-only storage, separated
  operational identities, reproducible Gradle/JDK/dependency inputs and
  field-level observability evidence rather than treating a framework choice
  as a security proof.

The independent R2 data-boundary/privacy review reaches the same limited
conclusion: the stated prohibitions are a sound input, while their concrete
transport, provider, audit and evidence decisions remain open.  This review
does not convert that review into a security approval.

## Findings that remain canonical-adoption blockers

- **GCP-SEC-R2-01 — Conditional delivery has no total authorization
  decision.**  The dossier names an exact version/byte and a permitted
  exposure, but does not yet define the single immutable predicate that every
  delivery surface evaluates.  Without one, an implementation can correctly
  deny `GET` at the application route while serving the same byte through a
  redirect, `HEAD`, a `Range`/`206`, `If-*`/`304`, a CDN revalidation or an
  error fallback.  Before adoption, define and test a versioned decision over
  exact catalog version, representation/hash/media type, exposure, current
  validity/withdrawal state and time; every byte-producing response must call
  it before an origin, cache or redirect can supply bytes.  Absence, ambiguity,
  expiry, withdrawal or descriptor mismatch must be fail-closed.

- **GCP-SEC-R2-02 — “Safe public metadata” is not yet a closed output
  contract.**  R2 permits a safe provenance/grant/notice summary but does not
  select its fields, grammar, size bounds, normalization, escaping or media
  rendering rules.  A free-form notice, evidence reference, object key,
  filename, URL, signed query, HTML-like text or unbounded value can disclose
  restricted material, become a browser/log injection path, or point around
  conditional delivery.  Before adoption, publish a schema allowlist with
  bounded canonical values and output encoding; it must exclude raw bytes,
  storage paths, capability-bearing URLs and unapproved evidence.  Contract
  and browser-capture tests must include malformed, reflected and oversized
  metadata on ordinary, error and cached responses.

- **GCP-SEC-R2-03 — CDN and shared-cache revocation semantics are unresolved.**
  Calling CDN/cache paths delivery surfaces is correct, but there is no
  chosen cache-key, cacheability, TTL, negative-cache, revalidation, purge or
  withdrawal rule.  An otherwise private byte can survive a scope expiry or
  withdrawal in an edge cache, or a cache key can accidentally vary on a
  cookie, authorization header, query or user-controlled value.  The adopted
  ADR must state which response classes may be shared, one cache key made only
  from approved immutable catalog identifiers, `Vary` behavior, direct-origin
  denial, maximum freshness and the observed purge/fail-closed behavior for
  every delivery revocation.  Exercise `GET`, `HEAD`, ranges, conditional
  requests, redirects, stale-if-error and 4xx/5xx paths against the selected
  delivery provider.

- **GCP-SEC-R2-04 — A non-public bucket is not a data-plane policy.**  The
  draft requires a private catalog-only bucket and separated identities, but
  has not selected the provider policy that prevents public ACL/policy drift,
  direct origin access, broad signed URLs, list/overwrite/delete operations,
  recovery-namespace leakage or object-tag disclosure.  Before adoption,
  Security and Operations must inspect a provider-backed deny/allow policy
  with distinct ingest, runtime-read, backup, restore and operations
  principals, network/origin restrictions and immutable object rules.  If any
  signed delivery URL is selected, it must be bound to one exact approved
  object, method and lifetime and be tested for expiration, withdrawal,
  redirect and cache bypass; it cannot become a general storage capability.

- **GCP-SEC-R2-05 — Curated-byte ingress is still the highest-risk undefined
  state machine.**  R2 prohibits generic browser/upload/URL/backup shortcuts,
  but no allowed acquisition route, validation order, quarantine, parser or
  transformation isolation exists yet.  Curated source bytes and models remain
  untrusted until exact validation; a publisher workflow must not parse them
  in a privileged service with cloud credentials, arbitrary network egress or
  access to the final bucket.  Before adoption, choose a bounded source
  allowlist and an isolated ingestion/transform environment with size/media/
  hash checks, controlled egress, temporary-object and queue limits, retry/
  idempotency/orphan-cleanup rules, and no secrets or prohibited data in
  dead-letter, object metadata or diagnostics.  The release gate must bind the
  resulting exact byte and derivative manifest before publication.

- **GCP-SEC-R2-06 — OIDC discovery and JWKS retrieval remain vulnerable until
  their trust roots and egress rules are concrete.**  R2 says not to trust a
  caller-selected `jku`, yet a server-selected discovery/JWKS endpoint can
  still permit issuer confusion, hostile redirects, DNS rebinding, private
  address access, key-type confusion, refresh amplification or stale-key
  acceptance.  Before adoption, name a finite issuer/tenant set and its exact
  discovery/JWKS origins; constrain TLS, DNS/IP and HTTP redirect behavior,
  accepted algorithms/key types and outbound destinations.  Specify bounded
  cache/refresh/timeout behavior, key rollover and unknown-`kid` handling that
  fails closed rather than accepting an unverified token or repeatedly probing
  attacker-controlled infrastructure.

- **GCP-SEC-R2-07 — JWT claim and operator-lifecycle semantics are not yet an
  authorization model.**  The two scope names do not say which issuer,
  audience, authorized party, tenant, client, subject, token age, clock skew,
  revocation/offboarding state or target state transition is required.  Nor do
  they decide how a minimised external operator reference is represented
  without persisting raw claims or creating an end-user account.  Before
  adoption, Security must define a closed token profile and scope-to-transition
  matrix, including audience/`azp` rules, required and rejected claims,
  maximum lifetime, `exp`/`nbf`/`iat` policy, revocation/offboarding and
  break-glass handling.  It must reject wrong issuer/client/tenant/scope/state
  attempts and keep raw JWTs and claim blobs out of database, audit and logs.

- **GCP-SEC-R2-08 — Publication and withdrawal need replay-safe atomic state
  transitions.**  A valid bearer token can be replayed inside its lifetime,
  while concurrent publish, expiry and withdrawal actions can race with byte
  publication and delivery caches.  The draft explicitly leaves idempotency,
  second approval and the DB-to-object boundary open.  The adopted model must
  use a bounded immutable release identity, an explicit expected state/version
  and an atomic/idempotent outcome for retries; it must define duplicate,
  stale, conflicting and post-withdrawal commands without accepting a generic
  client payload.  Evidence must show that audit records are minimised and
  that a race cannot make an unapproved descriptor discoverable or deliverable.

- **GCP-SEC-R2-09 — The TLS/reverse-proxy direction does not yet prevent
  bypass or create a public-abuse policy.**  A “TLS reverse proxy” leaves open
  direct container, database and bucket reachability; TLS versions/certificate
  lifecycle; origin authentication; request-size/timeouts; WAF/rate limiting;
  and an abuse response that could silently add cookies, device fingerprinting
  or Project-derived data.  Before adoption, choose and test the ingress and
  network segmentation policy: only the intended proxy/delivery origin may
  reach the service, no data store is internet-reachable, and public metadata
  controls remain stateless and privacy-preserving.  Include denial, timeout
  and overload responses in the no-reflection/no-unsafe-log corpus.

- **GCP-SEC-R2-10 — Version pins are not a CI and software-supply-chain
  control.**  R2 correctly proposes a frozen Wrapper, JDK, dependencies,
  SBOM and reviewed repositories, but no CI execution/trust model currently
  binds source to the deployed artifact.  Before adoption, select commit-pinned
  CI actions/runners, repository and branch-change permissions, dependency and
  plugin verification, JDK/container/image digests, provenance/SBOM signing
  and artifact promotion verification.  Untrusted pull-request or catalog
  fixture work must not receive production credentials, publish artifacts or
  alter deployment policy; builds must not resolve runtime dependencies from
  arbitrary repositories or “latest” selectors.

- **GCP-SEC-R2-11 — Secret and cryptographic-key custody has no enforceable
  boundary.**  The draft defers the secret manager, encryption keys, rotation
  and break-glass process, so it cannot yet show that database, object-store,
  backup, OIDC-client, deployment, TLS and operational credentials are
  short-lived, least-privileged and recoverable from compromise.  Before
  adoption, create a bounded secret/key inventory with workload identities,
  storage locations, access owners, rotation/revocation, backup-key
  availability and break-glass audit.  CI/test logs, Gradle caches, images,
  fixtures, exception paths and support exports must be proved free of secret
  material; static cloud credentials or copied bearer tokens cannot be the
  default integration mechanism.

- **GCP-SEC-R2-12 — Logging and observability remain a cross-boundary egress
  risk.**  R2's application-log allowlist is a strong starting point, but
  reverse proxy/CDN/WAF, database, object store, APM, crash reporting, metrics,
  DNS/HTTP egress and support exports each can collect URL/query, IP, headers,
  raw authorization, signed URLs, object paths, filenames or exception text
  before application redaction runs.  Before adoption, choose every collector
  and prove a field-level allowlist, pre-export redaction/drop behavior,
  sampling/body-capture disablement, server-generated bounded correlation IDs,
  access control and retention/deletion path.  Tests must cover normal, auth
  failure, malformed request, timeout, provider failure, restore and upload-
  rejection paths without placing prohibited values in an audit, trace, metric,
  alert or support package.

## Evidence shape for the next security review

| Threat surface | Evidence required before canonical adoption | Required fail-closed result |
| --- | --- | --- |
| Public metadata and raw delivery | Versioned schemas plus browser/contract captures for metadata, `GET`/`HEAD`, range, conditional, redirect, error and withdrawal cases | No raw byte, capability URL, object path or reflected prohibited value without the exact active delivery decision |
| CDN and object storage | Provider policy inspection and allow/deny tests for every identity, direct origin, cache/revalidation and lifecycle operation | A cache, signed URL, restore object or bucket policy cannot bypass the same version/hash/scope decision |
| OIDC/JWT/JWKS | Fixed trust-root configuration and tests for issuer/audience/client/tenant/algorithm/key/unknown-`kid`/rotation/time/revocation/replay | Unknown or unverifiable identity and every wrong scope/state transition are rejected before a state change or audit append |
| Ingress and publication | Isolated publisher-pipeline evidence, exact byte/derivative binding and concurrency/retry/withdrawal corpus | No generic/user byte, arbitrary fetch, orphan or race becomes published or deliverable |
| CI and secrets | Clean reproducible build, dependency/provenance verification, CI privilege review and secret/key inventory/rotation exercise | Untrusted source or build execution cannot obtain credentials, replace an artifact or publish a release |
| Logs and support paths | End-to-end collector inventory, capture/redaction/retention/deletion evidence for normal and failure paths | Prohibited Project/user/byte/token/path fields never leave the bounded product service through diagnostics |

## Remaining global gates

- The R2 draft deliberately does not name the provider, region, CDN, storage
  policy, ingress pipeline, OIDC issuer, secret manager, operator lifecycle or
  accountable Security/Operations owners.  Each decision is still required;
  none may be supplied by a framework default.
- The three R1 reviews and the R2 data-boundary/privacy review remain inputs,
  not evidence that a real provider, CI workflow, storage policy, token issuer
  or rights corpus has passed these checks.
- A later source-owned ADR must reconcile all of these blockers with `AD-2`,
  `AD-4`, `AD-14`, `AD-16`, `AD-17`, `FR-54`, `NFR-10`, `NFR-13`, `NFR-21`,
  `NFR-23` and `NFR-25`, then obtain fresh security, data-boundary/privacy,
  operations/recovery, legal/asset and architecture-reconciliation reviews.
- No item in this review authorizes a control-plane implementation, catalog
  publication, raw-byte delivery, CI/deployment setup, provider account,
  secret, code/test/configuration change or a readiness claim.
