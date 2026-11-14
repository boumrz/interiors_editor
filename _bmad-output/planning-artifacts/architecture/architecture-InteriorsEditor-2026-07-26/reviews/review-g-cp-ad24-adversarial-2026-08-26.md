---
title: "AD-24 adversarial interoperability review"
review_type: adversarial-architecture-gate
reviewed: 2026-08-26
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../catalog-control-plane-alpha-decision-2026-08-26.md
also_considered:
  - ../../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../../../../apps/web/src/application/ports.ts
  - ../../../../../apps/web/src/ui/preloaded-glb-resource.ts
  - ../../../../../apps/web/src/ui/AppShell.tsx
  - ../../../../../apps/web/public/sw.template.js
  - ../../../../../apps/web/rspack.config.mjs
reviewed_snapshot:
  architecture_spine_sha256: 3333f6633ed231019d8f572cad7b48e90ed4061fb851515b35acdb275cf0d712
  ad24_decision_sha256: 9728da07a01986c5515cbd3645c56320117e9f23cb81bab93c5951e1f4a79919
verdict: REVISE_BEFORE_IMPLEMENTATION
source_mutations: none
---

# AD-24 adversarial interoperability review

## Verdict

`REVISE_BEFORE_IMPLEMENTATION`. AD-24 selects a credible bounded internal-Alpha
substrate and preserves the AD-17 no-Project perimeter, but it is not yet an
executable interoperability contract. Independent web, proxy, seed and Kotlin/
PostgreSQL units can each satisfy the current prose while disagreeing on wire
shape, cache behavior, range delivery, publication identity, failure mapping
and recovery handoff. The gate should be re-reviewed after the ambiguities below
are closed with one normative schema/port contract and shared conformance
fixtures.

## Findings

- The wire contract has no normative JSON/OpenAPI schema and the application has no exact `CatalogGatewayPort` signature. Field names, enum literals, optionality, branded identifiers, method inputs, cancellation and result payloads can therefore differ while both sides satisfy the English description. Adopt one versioned schema, the exact TypeScript port, and byte-level cross-language fixtures before either unit is implemented.

- “Bounded list” has no numeric bound, and asset ids, labels, taxonomy strings, dimensions and the envelope body have no byte/count/range limits. One compliant backend can emit a response that another compliant web decoder rejects or exhausts memory on. Fix exact UTF-8, member, asset-count, body-byte and positive-dimension limits, including duplicate JSON-member handling before host `JSON.parse` loses evidence.

- The optional thumbnail descriptor is not defined. It can legally become an external URL, data URI, unhashed byte stream or unsupported media type even though the slice claims same-origin, exact catalog-owned resources and no CDN. Either remove thumbnail transport from this slice or define the same hash/size/media/same-origin rules and database ownership as for every other resource.

- The “hash-addressed resource route” is supplied as envelope data even though its route is deterministic. Without an exact relative-path rule, a backend may emit an absolute or redirected cross-origin URL and the web may follow it while still claiming to use the port. Derive the route locally from a validated hash, or require exact equality with `/catalog-api/v1/resources/sha256/{hash}` and reject redirects.

- `catalogVersion`, asset id and SHA-256 lexical grammars and canonical case are not fixed. Uppercase hashes, percent encoding, Unicode normalization, encoded slashes and version aliases can produce distinct URL/cache/database identities for the same logical resource. Define bounded ASCII grammars, lowercase hash canonicalization, path decoding rules and the exact `400` versus `404` split.

- “Duplicate hashes” is ambiguous and conflicts with normalized content-addressed storage: two assets may legitimately share one exact GLB. One implementation can reject the publication while another deduplicates it. State whether uniqueness is per descriptor, per asset or per resource row, and define the asset-to-resource cardinality and foreign keys.

- Strong envelope ETags are not reproducible because the exact canonical envelope bytes, JSON member order, timestamp source and ETag syntax are unspecified. `/current` and `/catalogs/{version}` can expose semantically equal but byte-different envelopes and ETags. Fix a deterministic representation, require the version route to match the selected current publication, and specify `If-None-Match`/`304` headers and body behavior.

- The existing service worker is cache-first for every same-origin non-range `GET`, including `/catalog-api/v1/catalogs/current`. It returns its manual Cache Storage entry without revalidation, so the backend’s `no-cache, must-revalidate` header cannot keep `current` current. AD-24 must require a network/revalidate strategy or an explicit service-worker bypass for `current`, while limiting cache-first behavior to immutable version/hash routes.

- “No cookie or credentials” conflicts with browser `fetch` defaults: a same-origin fetch uses `credentials: "same-origin"` unless the adapter explicitly selects `omit`. A nominally compliant adapter can therefore transmit existing origin cookies. Require `credentials: "omit"`, `redirect: "error"`, no caller-derived headers, and proxy/service rejection or stripping of `Cookie` and `Authorization` before routing, logging and caching.

- The required claim that prohibited data “cannot enter a request” is impossible for an HTTP endpoint: a caller can send arbitrary headers, query, body or unknown paths even if the application rejects them. The enforceable boundary is that such bytes are never accepted into an application value, reflected, persisted, cached or logged. Rewrite the evidence target accordingly and cover Netty, Rspack, tunnel/access logs and Cache Storage, not only Ktor application logs.

- Resource delivery does not define the accepted single-range grammar (`start-end`, open-ended, suffix, whitespace and overflow), `If-Range`, the `416 Content-Range`, or the required `HEAD`/`200`/`206` headers. It also does not require `Content-Type`, `Content-Length`, `Accept-Ranges`, ETag and absence of `Content-Encoding` to agree across all variants. Fix a response matrix that both Ktor and the browser adapter run as shared fixtures.

- Resource size verification has no ordered algorithm. The current browser helper allocates from the first `Content-Range.total` before comparing it with an expected descriptor and accepts an unconstrained whole `200`; a hostile or faulty service can force a large allocation despite a later hash check. Require descriptor limit validation first, equality among descriptor length, `Content-Length`/range total and assembled bytes, bounded chunks, then SHA-256 and GLB admission before any pin or preview.

- Failure outcomes lack an operation/status/race mapping. A timeout, user abort, metadata `404`, resource `404`, malformed `206`, `416`, invalid media, hash mismatch and `5xx` can each be mapped differently to `cancelled`, an outage or integrity failure. Define the total mapping separately for metadata and unpinned download, including the user-cancel-versus-timeout linearization point.

- The port-to-local-storage handoff is not fixed. One adapter can expose or write partial bytes while another returns only fully verified bytes, and both can claim that “the local adapter validates and pins.” Define that the gateway owns no local resource store, returns no successful resource until size/media/hash/GLB checks pass, and that only the AD-4 staging/pin lease plus `BackupFeasibilityPolicy` may make the bytes publication-eligible.

- Recovery-source behavior remains ambiguous. If a Project is already in `ResourceRecoveryRequired`, a cancelled or unavailable exact-byte repair must preserve that blocking state; successful network retrieval must not clear it until the complete local atomic repair passes. “None of these outcomes selects recovery” does not define this pre-existing-recovery transition and permits incompatible orchestrations.

- The executable evidence is weaker than AD-17 and the catalog companion: it checks unchanged Durable Revision count and no new recovery/read-only state, but does not prove that a healthy fully pinned Project still opens, edits, publishes, undo/redoes and creates a Portable Backup during outage. A web bootstrap that awaits catalog availability can pass the listed Story 5.6 UI test yet violate the architectural invariant.

- The real Kotlin/PostgreSQL smoke is not required to traverse the Rspack same-origin path. Direct Ktor tests and isolated web adapter tests can both pass while the proxy strips `/catalog-api`, drops `Range`, transforms bytes or changes cache headers. Run the shared contract smoke through the actual web origin/proxy; keep tunnel evidence separately labelled if it is exercised.

- Same-origin topology is not operationally closed: the Rspack configuration currently has no `/catalog-api` proxy, and AD-24 does not select prefix preservation/rewrite, backend loopback binding, port/config validation, startup order or direct-port exposure. Two correct roots can therefore be unreachable from each other or accidentally expose a second LAN endpoint. Define one fail-closed local run contract without making it a public-deployment claim.

- The PostgreSQL allowlist names exactly three tables, but Flyway normally creates `flyway_schema_history`; the document simultaneously requires Flyway and a normalized schema/table allowlist without defining this fourth object or its schema. Specify application-owned schemas and the migration-history exception, and audit tables, views, materialized views, functions, large objects, sequences and default/public privileges rather than only three table names.

- “SELECT-only runtime” and “immutable publication” are not enforceable from the stated schema. A publication role able to insert can also be left able to update/delete old versions, while an owner or default privilege can bypass the intended perimeter. Fix exact role ownership, `search_path`, grants/revokes/default privileges and database constraints/triggers; test failed `UPDATE`, `DELETE`, `TRUNCATE`, DDL and cross-schema access using the actual runtime and publication credentials.

- Publication has no deterministic current-selection, replay or concurrency rule. Two seeds can race, the same version with different bytes can be ignored or overwritten, and `publication timestamp = now()` makes database reconstruction produce a different immutable envelope/ETag. Require a manifest-owned timestamp/version, validate all files before the transaction, fail on same-version/different-content, define identical replay as no-op, serialize current selection and prove prior versions remain byte-identical.

- Seed input is not a closed ingress boundary. “Source-controlled manifest plus exact curated files” does not prohibit absolute paths, `..`, symlinks, files outside the backend root or arbitrary bytes merely labelled `model/gltf-binary`; size/media/hash validation alone can ingest a Project backup or malformed GLB. Fix the seed directory and manifest grammar, reject traversal/symlinks/non-regular files, apply the adopted GLB byte-level admission and exact resource limits, and log only fixed reason codes.

- Rebuild/startup semantics are absent. After Flyway validation but before seed publication, the service may serve an empty `current` as `404`, which the web can classify as invalid, unavailable or a valid empty catalog. Require startup/readiness to fail closed until exactly one deterministic current publication exists, and prove reconstruction yields the same versions, bytes and ETags.

- The present web seam bypasses the proposed architecture: `AppShell.tsx` calls the UI-owned `fetchPreloadedGlbBytes`, catalog records contain arbitrary resource URLs and computed hashes are not compared with a published expected hash; `application/ports.ts` has no catalog port. Merely adding a gateway beside this path would satisfy superficial tests while leaving a second network/catalog owner. Add a static dependency rule and tests proving only `adapters/catalog` performs catalog transport and remove the UI/static-URL route from the Alpha path.

- The fake gateway and real smoke are only said to prove “the same port contract,” but no shared conformance suite, fixture bytes or coverage minimum binds them. The fake can model a strict union while the HTTP adapter collapses cases and the smoke checks only happy-path metadata. Make the schema fixtures and complete outcome/range corpus reusable by the Kotlin contract tests, web adapter tests and fake-gateway contract test.

Until these findings are reconciled, AD-24 may remain a bounded decision input,
but `internal-implementation-ready` overstates the precision available to two
independent implementation owners.
