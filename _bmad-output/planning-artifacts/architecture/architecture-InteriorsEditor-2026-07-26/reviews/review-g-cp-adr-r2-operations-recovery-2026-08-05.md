---
title: "InteriorsEditor — independent G-CP-ADR R2 operations and recovery review"
review_type: operations-recovery-precanonical-control-plane-r2
reviewed: 2026-08-05
reviewer: "Codex /root/d022_changeset_policy_research"
reviewed_artifact: ../drafts/G-CP-ADR-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 4e6e4248b76d6cc04350be6ff69dbb34232a00a44853cf480267f3b094854f0c
  r1_security_review_sha256: 6d85f24fde4b2cacf63505fdf366119c97c91dcd1016c403bae79065518a6a38
  r1_operations_review_sha256: 9741cb6dd9bb920ac6191aaf14b9c47b3dde9223f1d79d5de8ddd2d228a96223
  r1_legal_review_sha256: 8364ba6a53767c49255f157fe779be613474860c70427289a0c01d696e1acb60
  r2_data_review_sha256: 41c78cb2a01c5142b156510e91feab3dcd6775fbbb6e024ddb2995f58d56baea
  architecture_spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  catalog_contract_sha256: c3b06f9967630fb1e66754463acb97d5dda9a3209ac1cade418f33e770b8a48c
  project_backup_contract_sha256: 91ecfb9ac4cb7bc21e2e0205442b960713e70a2aaf3384a40645db2fff8d7157
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
review_basis:
  - ../drafts/G-CP-ADR-draft-2026-08-05.md
  - ../drafts/G-CP-ADR-security-data-boundary-review-2026-08-05.md
  - ../drafts/G-CP-ADR-operations-recovery-review-2026-08-05.md
  - ../drafts/G-CP-ADR-legal-asset-governance-review-2026-08-05.md
  - review-current-source-g-cp-adr-r2-data-boundary-privacy-2026-08-05.md
  - ../ARCHITECTURE-SPINE.md
  - ../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../project-context.md
status: complete
verdict: PASS_FOR_PRECANONICAL_INPUT_ONLY
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Independent read-only R2 review of operations, recovery and release boundaries; no draft, canonical, memlog, code, test, configuration, provider, owner-decision or evidence mutation"
source_mutations: "Created only this versioned review artifact."
---

# G-CP-ADR R2 — independent operations/recovery review

## Verdict

**`PASS_FOR_PRECANONICAL_INPUT_ONLY`.** R2 is a soundly bounded planning input
because it preserves the catalog-only/local-first invariant, does not pretend
that a provider, recovery plane, ingress pipeline or identity system has been
selected, and retains the R1 conditions as explicit adoption gates. It is not
a pass for a canonical ADR, operational deployment, catalog publication or any
implementation. `G-CP-ADR` remains `BLOCKED` and `G-READY` remains `NOT_READY`.

This scope agrees with the newer data-boundary review's limited precanonical
pass: the remote control plane can never become `ProjectRepositoryPort`,
`AssetBlobStorePort`, Project recovery, a user backup target or a sync/account
service. The positive result is limited to the quality of R2 as a fail-closed
decision packet. It does not establish any of the provider-backed facts below.

## Conditions R2 correctly preserves

- A catalog outage remains only `control-plane-unavailable` or
  `unpinned-download-unavailable`; a healthy fully pinned Project continues to
  edit, publish Durably, undo/redo and make a complete Portable Backup locally.
- PostgreSQL, object storage, backup/restore and logs are scoped to catalog-only
  data; R2 explicitly excludes Project/Revision/History/Backup/user-pinned
  bytes from both normal and failure paths.
- The R1 reviews are requirements rather than approval evidence. R2 names the
  needed independent Security, data-boundary/privacy, operations/recovery,
  legal/asset-governance and architecture reviews before canonical adoption.
- R2 rightly treats an object-key hash, a local emulator, a framework/version
  pin and a feature-page claim as insufficient evidence for production IAM,
  immutability, recovery or release safety.

## Named blockers before canonical adoption

- **GCP-R2-OPS-01 — Provider, region and complete-copy inventory are not an
  operational decision yet.** R2 correctly leaves provider/region/residency
  open, but a single-region container direction cannot establish where managed
  PostgreSQL snapshots/WAL, replicas, object versions, recovery objects,
  CDN/WAF caches, access/audit logs, APM/crash exports, DNS/HTTP egress and
  support evidence reside. Before adoption, named Product/Legal/Operations/
  Security owners must select provider/service plans and publish a copy
  inventory with jurisdiction, subprocessors, retention, deletion authority,
  support escalation and explicit handling for every secondary or cross-region
  copy. An unapproved replica/cache/export must be denied, not treated as an
  implementation detail.

- **GCP-R2-OPS-02 — Per-version raw-byte scope has no selected enforcement
  locus.** R2 requires a delivery scope, but has not decided whether scope is
  evaluated by the service, a delivery gateway, a CDN, a redirect, a signed URL
  or object-store policy. Without one authoritative enforcement point, a
  still-cached, ranged or redirected object can survive expiry/withdrawal even
  while PostgreSQL says delivery is disabled. Before adoption, choose the
  enforcement path and prove that every edge/origin identity can read only an
  authorised descriptor-bound byte; define scope expiry/withdrawal propagation,
  cache TTL/purge, range and error behavior, and fail closed if the policy state
  cannot be checked.

- **GCP-R2-OPS-03 — Least-privilege roles are named but the trust boundaries
  between them are not.** R2 separates ingestion, runtime read, backup, restore
  and operations identities, yet leaves provider account/project boundaries,
  role-assumption trust, credential source/rotation, network reachability,
  permissions boundaries and break-glass behavior unselected. A broad
  operations or restore principal could otherwise list or export all objects
  regardless of catalog state. The selected provider policy must enumerate
  allowed actions and resources for each principal, prohibit runtime
  list/write/delete/DDL, isolate recovery credentials from runtime delivery,
  and subject emergency access to time-bounded approval, minimised audit and
  post-incident revocation. Provider-backed allow/deny tests must prove this,
  including attempted cross-scope access.

- **GCP-R2-OPS-04 — The catalog-only PostgreSQL boundary needs a mechanically
  checked schema-and-privilege gate.** A prose prohibition of Project,
  document, queue and audit escape hatches does not prevent a migration from
  adding an unbounded `jsonb`, raw event payload, generic blob table, seed or
  failed-migration artifact. Before adoption, define an approved schema/object
  inventory, database/default privileges, migration-only/runtime/restore roles,
  connection/network restrictions and a post-migration inspector that rejects
  every unapproved table, column, index, function, extension, queue/audit
  payload and seed. The check must run for empty, upgrade, failed and restored
  databases, not only the happy-path schema.

- **GCP-R2-OPS-05 — Migration, service release and rollback lack a compatible
  state machine.** R2 correctly forbids production `clean`, `repair` and
  destructive down migrations, but does not yet bind a service image to the
  migrations/schema versions it can read and write. An attempted previous-image
  rollback after a forward migration can corrupt catalog publication state or
  make an operator action unrecoverable. Before adoption, define an
  expand/contract release sequence, migration lock/ownership, compatibility
  assertions for current and prior image, failure stop point, forward-fix rule,
  and the exact point at which contract cleanup becomes legal. Persist a
  release/migration evidence manifest without secrets or prohibited data and
  rehearse a failed migration plus an incompatible previous image.

- **GCP-R2-OPS-06 — “Paired restore” has no common recovery point or witness
  manifest.** A PostgreSQL PITR target is selected by LSN/time while versioned
  object storage may restore a different object inventory. Verifying that all
  restored descriptors have a byte detects one class of failure, but it does
  not establish that the descriptor state, object versions and release dossiers
  represent one coherent point in catalog history. Before adoption, define a
  catalog recovery manifest/watermark that binds the database recovery point,
  immutable release records and exact object-version inventory. The witnessed
  drill must restore to that common point, reject extra/missing/mismatched
  discoverable objects, record RPO/RTO and keep the target non-public until the
  complete reconciliation succeeds.

- **GCP-R2-OPS-07 — Restore-before-withdrawal/expiry behavior is undefined.**
  R2 says to reconcile against the publication dossier before exposure, but it
  does not name the source of truth or replay process when PITR returns to a
  point before a later legal withdrawal, delivery-scope expiry or correction.
  That can re-expose a byte that was intentionally disabled. Before adoption,
  define an immutable withdrawal/correction ledger, its recovery authority and
  fail-closed reconciliation rule: a restored version is never discoverable or
  deliverable until current authorised withdrawal/expiry records have been
  applied and witnessed. This must be tested without touching local user-pinned
  copies or turning catalog restore into Project recovery.

- **GCP-R2-OPS-08 — Immutability, retention and deletion are not reconciled.**
  R2 properly refuses to equate hash-shaped keys with WORM storage, but leaves
  versioning/object-lock, legal withdrawal, physical deletion, backup expiry,
  replica/cache purge and key destruction as separate future choices. A strict
  retention lock may make a required removal impossible; an unrestricted delete
  can destroy a catalog byte before a valid catalog restore. Before adoption,
  choose an immutable-object and lifecycle policy that distinguishes
  discoverability withdrawal from physical deletion, names the authorised
  deleter and evidence, covers every replica/backup/cache and records the
  retention/key-availability relationship. Test both an allowed deletion and a
  denied premature delete against the selected provider.

- **GCP-R2-OPS-09 — Curated ingress and DB-to-object publication are still an
  unselected state machine.** R2 is right to reject browser, multipart,
  arbitrary-URL, generic-operator and backup ingress, but a future system still
  needs a single publisher-controlled transition from approved source bytes to
  an immutable catalog version. Before adoption, select a bounded pipeline with
  explicit states such as received/quarantined, validated, immutable-object
  committed, dossier-bound, published and withdrawn. It must bind byte/hash/
  size/media/provenance/grant/notices/delivery scope before publication, define
  idempotency/replay, temporary storage/queue/dead-letter classification,
  orphan quarantine/cleanup and failure compensation, and prove that no step
  accepts prohibited data or emits it to logs/provider diagnostics.

- **GCP-R2-OPS-10 — Publication proof is not yet a reproducible release
  attestation.** The dossier table and proof list state what must be checked,
  but do not yet define a stable release evidence unit that ties the selected
  provider configuration, object/descriptor versions, migration set, service
  image, operator approvals, test run and withdrawal state together. Without
  that unit, an audit cannot distinguish an approved release from a later
  configuration drift or a retry against altered evidence. Before adoption,
  define a catalog-only, immutable release attestation with bounded references
  and hashes to those inputs, approver identities minimised to the authorised
  operator context, review timestamp and revocation/supersession semantics.
  The attestation must be validated before discoverability and rechecked on
  restore; it must not store Project/user data or secret material.

- **GCP-R2-OPS-11 — Observability, incident response and support-export paths
  have no enforceable operating model.** R2 accurately calls the 14-day log
  and 365-day audit values placeholders, but it does not yet specify field
  allowlists, collection/egress locations, access roles, deletion proof or a
  safe incident workflow across proxy/CDN/WAF, Ktor, PostgreSQL, object-store,
  APM, crash, metrics, alerts and support tools. Before adoption, choose the
  field inventory and incident runbook, including server-generated correlation
  IDs, redaction before export, operator-audit minimisation, break-glass access,
  retention/deletion verification and provider-generated metadata treatment.
  End-to-end normal/error/auth/timeout/incident capture must prove no body,
  token, raw claim, object path/name, asset byte, Project or browser-local value
  reaches a durable diagnostic or third-party egress.

- **GCP-R2-OPS-12 — Public availability and abuse handling remain unresolved
  without an identity-safe failure policy.** R2 identifies rate limiting as an
  open decision and rightly forbids solving it with end-user accounts, cookies,
  tracking or Project-derived signals. Before adoption, Security and Product
  must choose bounded overload/rate/abuse controls, their data minimisation and
  retention, their operator escalation, and the client-visible retry semantics.
  The proof must show that an outage, partial byte, throttling or WAF rejection
  still maps only to the two catalog-unavailable states, never persists caller
  state, never creates `ResourceRecoveryRequired`, and never stops a healthy
  local Project from operating offline.

## Required evidence for a later adoption review

The next source-owned ADR must close every named blocker with selected human
owners and reproducible evidence, then receive a new independent review. The
minimum evidence package is:

- provider/IAM policy export and live allow/deny tests for every principal,
  bucket/container, delivery edge, database role and recovery target;
- a versioned catalog schema/privilege inspection corpus for empty, migrated,
  failed-migration, restored and prior-release states;
- immutable publisher/release/withdrawal attestation fixtures, including retry,
  orphan, expiry and cache/redirect/range negatives;
- a witnessed common-point PostgreSQL-plus-object restore/PITR drill with
  measured RPO/RTO, clean-up proof and no-Project-data corpus before exposure;
- migration/rollback/forward-fix rehearsals using immutable service images and
  a compatibility matrix; and
- end-to-end observability, incident, deletion and outage captures proving the
  catalog-only/local-first boundary under success and failure.

Until that package and the other named independent reviews exist, this pass
cannot be promoted into implementation authority or a canonical decision.
