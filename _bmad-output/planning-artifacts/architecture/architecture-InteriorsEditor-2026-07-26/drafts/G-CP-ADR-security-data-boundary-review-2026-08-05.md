---
title: "G-CP-ADR — independent security and data-boundary review"
status: independent_review_complete
reviewed_artifact: G-CP-ADR-draft-2026-08-05.md
review_date: 2026-08-05
review_scope: "security, privacy, prohibited-data boundary, operations boundary"
disposition: ACCEPT_AS_PRECANONICAL_INPUT_ONLY
canonical_adoption: BLOCKED
gate: G-CP-ADR
closes_gate: false
implementation_authority: false
---

# Independent security and data-boundary review

## Disposition

**Accept as a noncanonical review input only.  Do not adopt it as a canonical
ADR yet.**  The draft preserves the required narrow perimeter and makes no
implementation claim, but it leaves material security, operational and
data-boundary decisions unresolved.  Those decisions are acceptable in a
precanonical input only when they remain explicit blockers with named human
owners and reproducible evidence.

`G-CP-ADR` remains blocked and `G-READY` remains `NOT_READY`.  This review
does not authorize Kotlin code, a control-plane root, an API, persistence,
object storage, hosting, a catalog corpus, secrets, CI or deployment.

## Sources checked

- `ARCHITECTURE-SPINE.md`, especially AD-2, AD-4, AD-14, AD-16 and AD-17;
- `G-CP-ADR-INTAKE.md` and the reviewed draft;
- `SPEC.md` and all listed companion contracts, with particular attention to
  `project-and-backup-contract.md` and `catalog-control-plane-contract.md`;
- `prd.md`, `addendum.md`, `project-context.md`, and the UX contracts where
  catalog outage, recovery and notices are observable.

## Boundary confirmed by this review

The draft correctly carries forward the non-negotiable boundary from AD-2,
AD-4 and AD-17.  The remote perimeter must never receive, persist, synchronize,
recover, derive, proxy, cache on behalf of a user, log, analyze or back up a
User Project, Project geometry, Revision, `PendingDurability`, session History,
Command, draft, selection, writer lease, recovery state, Portable Backup,
`.interiors` member, screenshot/diagnostic payload containing Project content,
or a user-owned pinned resource byte or local blob key.  This prohibition also
applies to rejected requests, error responses, migration data, queues,
dead-letter records, object-storage metadata, CDN/proxy caches, traces,
metrics, audit records, support exports, provider backups and restore targets.

The only permissible remote bytes are curated **catalog-owned** bytes that are
bound to a published immutable catalog version/hash, provenance, a complete
human-approved `AssetUsageGrant` and required notices.  A browser's local
exact-byte pin and `BackupFeasibilityPolicy` remain decisive.  A control-plane
outage may produce only `control-plane-unavailable` or
`unpinned-download-unavailable`; it cannot create `ResourceRecoveryRequired`
or block a healthy fully pinned local Project.

## Findings and conditions before canonical adoption

- The public and operator capabilities need closed, versioned request and
  response allowlists: exact routes, methods, accepted headers, query keys,
  media types, field grammar, byte/count limits and unknown-field behavior.
  A statement that a payload is prohibited does not prevent an untyped query,
  header, opaque JSON field or multipart fallback from carrying it.

- The browser-to-`CatalogGatewayPort` contract needs capture-based negative
  tests proving that Project IDs, geometry, placements, resource manifests,
  writer/recovery/history state, browser-storage keys and backup metadata never
  reach a URL, header, body, retry, telemetry event or error report.

- Public-read route behavior is incomplete without an explicit CORS,
  cache-control, content-type, content-disposition, range-request and error
  policy.  CDN/proxy cache keys must not vary on cookies, authorization or
  caller-controlled data, and failure pages must not reflect request values or
  internal object paths.

- The proposed no-body/no-IP/no-referrer logging rule is not enforceable until
  reverse-proxy, CDN/WAF, load-balancer, application, database, object-store,
  tracing, crash-reporting and provider-log configurations are all allowlisted
  and tested.  In particular, server-generated opaque correlation IDs must
  replace client-supplied correlation/header propagation, which can otherwise
  become a covert data path.

- The object-store boundary needs a concrete least-privilege data plane:
  non-public bucket/container, no anonymous List/Write/Delete, no user
  pre-signed upload, no per-user namespace, no generic proxy/cache, immutable
  hash-addressed key policy, service identities separated by function, and a
  denial corpus for every unapproved operation.  A hash-shaped key alone does
  not establish these properties.

- Curated byte ingestion is intentionally unresolved, so canonical adoption
  must remain blocked until a controlled publisher-only pipeline binds catalog
  identity/version, exact bytes, hash algorithm/encoding, media validation,
  provenance, grant and notices before write.  It must deny browser uploads,
  multipart user uploads, backup import, arbitrary URLs and operator-supplied
  generic blobs before they reach temporary storage, queues or logs.

- Publication needs an immutable atomicity model: a catalog descriptor must
  bind one exact-byte hash, provenance snapshot, complete grant snapshot,
  notice-placement set and publication state; it must not be mutable in place.
  The design must define failed-write/orphan-byte handling, withdrawal behavior
  and how an existing local pinned resource remains local rather than being
  reclassified as remote data.

- `AssetUsageGrant` and required notices need a schema and lifecycle proof,
  not merely a grant reference.  The future contract must verify coverage of
  every model and subresource, runtime/optimization/backup/private-transfer/
  rendered-PNG rights, notice placement, named human approver, evidence date
  and withdrawal/review status before publication.  Metadata strings and
  notices also require size, character and safe-rendering constraints so they
  cannot become an HTML, log-injection or unbounded-data channel.

- OIDC/JWT validation needs a selected, testable trust policy beyond the names
  of checks: trusted issuer discovery/JWKS origin, TLS and egress restriction,
  issuer/audience/authorized-party binding, accepted key types and algorithms,
  `kid` collision/unknown-key behavior, `crit`/`none` rejection, clock skew,
  JWKS cache/refresh timeout and fail-closed behavior.  Caller-selected key
  URLs are forbidden, but server-side discovery and refresh still need the same
  SSRF and key-confusion protections.

- The claimed revoked-operator test cannot be satisfied until the design
  chooses an enforceable revocation/lifecycle mechanism for JWTs (for example,
  short lifetime plus a controlled denylist or introspection), tenant/client
  binding and operator offboarding.  It must not solve revocation by adding an
  end-user account table or cookie session.

- `catalog:publish` and `catalog:withdraw` need an authorization matrix bound
  to immutable publication identifiers and permitted state transitions, with
  separation of operator roles, replay/idempotency handling and an explicit
  decision on whether a second approval is required.  Scope text alone does
  not prevent a broad bearer token from publishing arbitrary catalog bytes or
  withdrawing an unintended version.

- PostgreSQL needs a schema and privilege allowlist: separate migration,
  application read/write and restore identities; no general JSON/document
  escape hatch; migration review that rejects prohibited table/column/index/
  queue/audit shapes; bounded query parameters; and an inspection test after
  every migration.  The prohibition must include seed data and failed
  migration artifacts, not merely production tables.

- Backup and restore require a data inventory and isolation plan that covers
  PostgreSQL snapshots/WAL/PITR, object versions, replica/DR copies and restore
  environments.  Encryption/key custody, retention, deletion, residency,
  access controls and a witnessed restore drill remain open; until selected,
  the draft cannot prove that catalog operations backup is not a disguised
  user-data recovery channel.

- “No analytics” is insufficient without outbound observability controls.
  Metrics, APM, error tracking, feature flags, DNS/HTTP egress and support
  exports need an allowlist and body/header/attribute scrubbing proof.  The
  production decision must also state how unavoidable network metadata at a
  hosting provider is minimized, retained and legally governed rather than
  treating it as absent by assertion.

- Supply-chain integrity remains only a direction.  Adoption needs a frozen
  Wrapper checksum, JDK/image identity, dependency verification/checksums,
  SBOM/vulnerability handling, trusted build provenance, secret-free test
  fixtures and a policy for patch/incident response.  No unpinned host tool or
  implicit dependency repository may become a byte-ingestion path.

- The negative corpus in the draft should be expanded to exercise every
  indirect seam named above, including malformed header/query values,
  correlation IDs, exception paths, async/dead-letter payloads, object metadata
  and tags, migration seeds, backup manifests, restore logs and third-party
  telemetry exports.  Each case must prove rejection before durable write,
  object write, audit append, provider-bound diagnostic emission or unsafe log
  output.

## Evidence required for a later adoption review

The existing eight proof obligations in the draft remain necessary.  The
following clarifications are required for them to be sufficient:

1. A machine-readable boundary corpus drives contract, integration and
   browser-capture tests for allowed and prohibited values at every ingress and
   egress seam.
2. Storage/IAM and database privilege policies are inspected in an isolated
   environment, then verified through allow/deny integration tests and a
   restore drill; their own logs are included in the negative corpus.
3. OIDC/JWKS tests include key rotation, unknown `kid`, algorithm confusion,
   issuer/audience/client mismatch, expiry/not-before, revocation/offboarding,
   replay and wrong-scope/state-transition attempts.
4. Publication evidence proves byte-to-hash-to-provenance-to-grant-to-notice
   binding, safe withdrawal and local-first outage/repair semantics.  It does
   not accept a resource merely because a remote endpoint returned bytes.
5. The Asset steward and Legal approver provide a human-reviewed corpus for
   each exact Alpha resource and subresource.  A license label, automated scan
   or application field is not an approval and cannot close this gate.

## Non-waivable human gates

Canonical adoption still requires named and accountable Security/Operations,
Product, Legal/Asset-steward and backend/catalog owners for the open issuer,
provider/region, retention, key/secrets, byte-ingestion, publishing,
availability and incident decisions.  Legal must approve the actual
`AssetUsageGrant` corpus and notices; Security/Operations must approve the
identity, storage, backup/restore, logging and egress controls.  Neither a
passing automated suite nor this review substitutes for those human decisions.

## Conclusion

The reviewed draft is suitable to carry these constraints forward as a
precanonical architecture input.  It is not sufficient to select or operate a
control plane.  Preserve the absolute local-first boundary verbatim, retain all
unresolved items as blockers, and require an amended concrete ADR plus the
independent review/evidence set above before any canonical adoption or backend
implementation.
