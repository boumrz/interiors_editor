---
title: "G-CP-ADR — independent legal and asset-governance review"
status: NOT_READY
reviewed_artifact: G-CP-ADR-draft-2026-08-05.md
review_date: 2026-08-05
review_scope: "asset rights, provenance, grants, notices and catalog-publication controls"
disposition: ACCEPT_AS_PRECANONICAL_INPUT_ONLY_WITH_BLOCKERS
canonical_adoption: BLOCKED
gate: G-CP-ADR
closes_gate: false
implementation_authority: false
legal_advice: false
---

# Independent legal and asset-governance review

## Disposition

**Accept the reviewed document only as a noncanonical planning input.  It is
not a grant of rights, legal advice, approval of a catalog corpus, or authority
to publish one.**  `G-CP-ADR` stays blocked and `G-READY` stays `NOT_READY`.
No Kotlin/control-plane/catalog implementation, resource upload, or catalog
publication follows from this disposition.

The draft correctly says that a licence label, an application field, an
unsigned manifest, or automated licence detection cannot substitute for a
human-approved `AssetUsageGrant`.  It also retains the local-first rule: local
exact-byte pinning and `BackupFeasibilityPolicy` remain decisive, and a
published catalog byte never becomes authority to use a user's pinned byte.

## Contract coverage retained, but not yet proven

The draft does not itself claim to grant asset rights and inherits the required
boundary from `AD-14`, `AD-17`, `FR-28`, `FR-37`, `FR-44`,
`project-and-backup-contract.md`, and `catalog-control-plane-contract.md`:

- every exact model, texture, and other subresource needs human review;
- the grant surface includes in-app render/thumbnail, optimization or
  transcoding, exact runtime bytes in `.interiors`, private 3D-resource
  transfer, user-controlled rendered PNG download/share, and required notice
  placement;
- unknown, incomplete, or forbidden scope excludes a resource from the Alpha
  catalog, including offline/backup-ready placement; and
- attribution must survive the required catalog-card, bundle-manifest,
  export-UI, and, when needed, visible-PNG placements.

Those are inherited constraints, not evidence that any actual resource has
them.  No named Legal approver, Asset steward, or per-resource human-approved
grant/provenance corpus appears in the reviewed planning materials.

## Blocking findings before canonical adoption or catalog publication

1. **Unauthenticated byte delivery has an unclosed rights question.**  The
   candidate calls catalog reads public and permits an exact resource candidate
   to be returned.  Public raw-byte delivery must not be inferred from the
   existing right for *private* transfer/Portable Backup.  A named Legal
   approver must explicitly determine, for each published resource version,
   whether unauthenticated catalog delivery is permitted.  If it is not,
   neither a public byte endpoint nor an equivalent CDN/object-store path may
   publish that resource; this must not be solved by adding end-user accounts
   or by weakening the no-account boundary.

2. **`AssetUsageGrant` needs a precise, immutable schema and lifecycle.**  The
   future ADR must carry the contract's separate
   `runtimeUsePolicy`, `backupPackagingPolicy`, and `renderedOutputPolicy`
   values (`allowed | allowed-with-notice | forbidden`), every covered exact
   model/subresource and derived runtime byte, required notice placements,
   evidence references, named reviewer, review date, validity/review status,
   and withdrawal/renewal state.  A generic “complete grant” reference would
   lose required restrictions.

3. **Provenance must bind source to every published byte.**  A catalog version
   needs an immutable source → approved transformation → runtime-byte chain,
   with exact hash/media metadata for source, model, texture, and generated
   subresource.  Changing bytes, a transformation, a notice, or grant scope
   creates a new reviewed version; it cannot edit a published descriptor in
   place.

4. **Notice compliance needs a tested placement matrix.**  Required text,
   attribution, locale/version, and placement must be bound to the same grant
   snapshot.  The release gate must prove the appropriate catalog-card,
   `.interiors` manifest, export UI, and visible PNG layer placements.  A
   metadata-only notice is insufficient where the output is separable from its
   metadata.

5. **Rights evidence and public metadata have different audiences.**  A public
   provenance summary or grant identifier is not the underlying contract,
   licence evidence, or approval.  The controlled evidence location, access
   policy, retention, and redaction of commercial/legal documents need an
   accountable human decision; the public API must expose only the approved
   safe summary/notice fields.

6. **Withdrawal cannot silently rewrite a local Project.**  The publication
   process needs a steward-owned expiry/withdrawal record and response path.
   It may stop new publication or placement when the grant is no longer valid,
   but it cannot silently delete or reclassify user-pinned bytes, a Durable
   Project, or a Portable Backup.  The handling of already delivered private
   copies requires a documented human decision consistent with AD-4 and the
   recovery contract.

## Required human-controlled records before each catalog publication

| Record | Accountable human(s) | Minimum publication evidence |
| --- | --- | --- |
| **Steward appointment and approval matrix** | Product owner; named Legal approver; named Asset steward | Authority, resource scope, approval/review cadence, escalation/substitution, and withdrawal responsibility. |
| **Per-version Asset Provenance Dossier and ledger** | Asset steward; Legal approver verifies rights evidence | Catalog identity/version; source/acquisition chain; source/model/texture/subresource hashes and media types; licence/contract/evidence references; transformation lineage; provenance status. |
| **Per-version AssetUsageGrant** | Named Legal approver plus Asset steward | The three policy enums; explicit full usage surface; all subresources and derivative runtime bytes; delivery-exposure decision; notice placements; reviewer/date/evidence reference; validity and withdrawal state. |
| **Transformation and derivative-resource manifest** | Asset steward; runtime-pipeline owner | Approved source hash → tool/profile → each output hash mapping, including optimized/transcoded models and textures; proof that the grant covers those transformations. |
| **Notice and attribution placement matrix** | Legal approver; Asset steward; product/export owner | Exact approved notice text/version and the catalog-card, bundle-manifest, export-UI, and visible-PNG placements that apply to the asset version. |
| **Catalog publication release record** | Designated publisher plus the two named approvers | Immutable descriptor/hash/grant/notice snapshot; completed automated validation; explicit human approval; no missing, unknown, forbidden, expired, or withdrawn policy value. |
| **Expiry, withdrawal, and correction register** | Legal approver; Asset steward; product owner | Trigger, effective state, affected immutable versions, publication stop/correction action, and the non-destructive local-data handling decision. |

These are evidence and governance requirements, not a prescribed form of
contract or a legal conclusion.  They may be stored in a controlled evidence
system rather than exposed through the public catalog API, provided the
publication record contains stable, reviewable references.

## Enforceable publication controls required later

Before a resource can transition to published, the controlled publisher
pipeline must reject it unless all of the following are true:

1. its immutable descriptor enumerates every exact source, model, texture, and
   derived runtime byte and their hashes;
2. the provenance dossier and human `AssetUsageGrant` reference that exact
   immutable set, not merely an asset name or licence label;
3. no applicable use policy is `unknown` or `forbidden`, and every
   `allowed-with-notice` placement is present in the release record;
4. public delivery, if any, is explicitly within the human-approved grant;
5. a new byte, derivation, notice, grant revision, expiry, or withdrawal creates
   a new reviewable publication state rather than mutating the old one; and
6. publication, withdrawal, audit, logs, object metadata, and error paths keep
   the security review's no-Project/no-user-pinned-data boundary intact.

Automated scanners can assist inventory and consistency checks, but cannot
create a grant, approve a rights scope, or close this gate.

## Conclusion

The reviewed draft is careful enough to remain a useful **precanonical** input
because it explicitly withholds implementation authority and requires human
provenance proof.  It is not sufficient for canonical adoption: the named
human authorities, actual evidence corpus, public-delivery decision, immutable
grant/provenance schema, notice matrix, and withdrawal process are all absent.
Keep `G-CP-ADR` blocked until an amended concrete ADR and the corresponding
human records and technical publication evidence receive independent review.
