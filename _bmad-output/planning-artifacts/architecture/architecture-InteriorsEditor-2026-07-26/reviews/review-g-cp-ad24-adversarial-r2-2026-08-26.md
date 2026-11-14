---
title: "AD-24 adversarial interoperability re-review R2"
review_type: adversarial-architecture-gate
reviewed: 2026-08-26
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../catalog-control-plane-alpha-decision-2026-08-26.md
  - ../../../../../contracts/catalog-control-plane/catalog-envelope-v1.schema.json
prior_review: review-g-cp-ad24-adversarial-2026-08-26.md
reviewed_snapshot:
  architecture_spine_sha256: 2c695aae325c3c90d12ba4629fc434a22ce71b87867434665d1dcab03153bcc6
  ad24_decision_sha256: 8b8fd9e7f5dfe06b857714bc7695e5411db72997e9b51c02cccb6b9f552bd0cd
  envelope_schema_sha256: 02df29d2bb85cfcadd1213ff6e9674ce7b7c8b9c9b7cfa8ff1eb67c8b6daf070
verdict: CHANGES_REQUIRED
source_mutations: none
---

# AD-24 adversarial interoperability re-review R2

## Verdict

`CHANGES_REQUIRED`. The remediation closes most of the original 25 findings:
the no-Project perimeter, port outcomes, bounded ingress, cancellation, range
headers, pin/recovery handoff, deterministic seed intent, same-origin topology
and cross-build evidence are now materially stronger. The remaining findings
below are implementation blockers because the normative schema, normalized
database model and web transport can still require mutually incompatible
behavior.

## Remaining findings

- The generic schema resource permits either `model/gltf-binary` or `image/png` up to 25 MiB in every position, while the decision requires a 25 MiB GLB model, a 256 KiB PNG thumbnail and static-GLB admission before *every* `catalogResource` success. A conforming PNG thumbnail therefore either passes an inapplicable GLB preflight or can never become available. Replace the generic references with media-specific GLB/PNG definitions and dispatch media-specific admission in the port.

- The adopted envelope now contains nested variant slots, variants and up to eight resources per variant, but the PostgreSQL allowlist has no normalized slot, variant or association tables and forbids JSON/free-form payloads and additional objects. The selected schema cannot persist the selected contract without denormalized fixed columns or violating its own allowlist. Add the exact normalized variant/link tables or remove variants from this bounded contract.

- Multiple independently selectable variant slots have no composition rule. A selected variant only lists anonymous changed resources, so two slot selections can each supply a GLB without defining which complete runtime model wins or how they combine. Fix Alpha to one complete-state variant axis, or add explicit resource roles/replacement targets and a deterministic valid-combination model.

- Content-address deduplication is under-specified across descriptors. The same SHA-256 may appear with different `byteLength` or `mediaType` values and still satisfy JSON Schema, while PostgreSQL stores one resource row per hash. Require every occurrence of one hash to have identical descriptor metadata and reject conflicting aliases before publication and in the web decoder.

- Canonical envelope bytes are not fully reproducible. “Schema property order, no whitespace” does not select JSON string escaping, Unicode emission, slash escaping, numeric spelling or an exact timestamp lexical form; JSON Schema property order is not a canonicalization standard. Kotlin can reconstruct bytes and ETags that differ from another valid serializer. Adopt one explicit canonical JSON algorithm or store and serve the validated canonical envelope bytes under a narrowly allowed immutable representation.

- `publishedAt` uses the broad JSON Schema `date-time` format while it is also the current-publication ordering key. Offsets, fractional precision and lexically different representations of the same instant remain legal, and two different versions with equal instants make reconstruction order decide `catalog_current`. Fix one UTC grammar and reject equal timestamps across different versions or define a deterministic secondary key.

- The JSON Schema is described as the language-neutral authority but does not encode the decision’s NFC/UTF-8-byte limit, array ordering, id uniqueness, descriptor-consistency or media-specific limits. Independent validators can truthfully “consume the schema” and disagree on valid envelopes. Publish the mandatory semantic-validator algorithm/fixture manifest as part of the normative contract rather than leaving these checks distributed through prose.

- Metadata HTTP behavior is still incomplete: the contract does not fix successful/error `Content-Type`, body length, envelope ETag verification, version-path-to-body-version equality, or mapping of malformed UTF-8, oversized bodies and wrong metadata headers to `invalid-envelope` versus unavailability. Add a total metadata response matrix parallel to the resource matrix.

- Request rejection is not total. Bodies and generic queries are prohibited, but their exact status is absent; `OPTIONS` remains conditionally permitted without exact paths, allowed headers, status or `Allow` response. Ktor, proxy tests and the negative corpus can therefore encode different contracts. Eliminate `OPTIONS` for the same-origin slice or define its closed response and fix statuses for every rejected request class.

- Immutable Cache Storage ownership is unresolved. The service worker may cache a version/hash response only “after a verified successful response,” but it intercepts before the application decoder performs schema/hash/GLB validation, and the decision does not give the worker a verifier or an adapter-to-worker admission protocol. Require network pass-through for `/catalog-api` in this slice, or make one named adapter own validation and explicit cache insertion.

- The database perimeter still lacks an exact application schema name and column/constraint allowlist. Table-name auditing plus bans on conspicuously named Project columns does not prevent a free `text`, array or mislabeled metadata column from storing prohibited bytes, and a fixed runtime `search_path` cannot be implemented consistently without the target schema. Adopt the exact DDL contract, including keys, checks, foreign keys and allowed columns/types.

- Role ownership contradicts itself: the seed is introduced as using a “migration/publication database role,” but the later model separates a DDL migration owner, a publisher and runtime as three credentials. This changes whether seed execution can migrate or retain DDL authority. Name separate Gradle migrate and publish commands, their exact credentials and startup order; the running service must receive neither elevated credential.

- The Spine still promises that no log or cache accepts prohibited data, while the remediated decision proves only application logging and allows traffic through Rspack and a Cloudflare tunnel. A malformed incoming path/header can be access-logged before Ktor rejection. Either configure and include those layers in the negative perimeter or narrow the Spine claim to accepted application values and application-owned caches/logs.

After these contract contradictions are removed, the earlier 25-point review
does not need to be replayed in full; a focused schema/DDL/HTTP conformance
re-review is sufficient for the bounded internal-Alpha implementation gate.
