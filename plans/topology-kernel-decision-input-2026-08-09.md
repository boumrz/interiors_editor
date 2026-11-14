---
title: Topology Kernel Decision Input
date: 2026-08-09
status: historical-decision-input-partially-superseded-by-ad-20
target_workflow: bmad-spec update plus versioned corpus delivery
---

# Topology Kernel Decision Input

## Purpose and authority boundary

This was the technical input for a **fresh** `bmad-architecture` update. It
is not an ADR and does not itself change any `AD-*`. AD-20 has now adopted
the domain-owned constrained PlanGraph kernel as the canonical authority and
has retained external geometry only as an immutable test-only oracle/fixture
adapter. The historical comparison remains here for traceability; it must not
be used to reopen that authority decision or select a production library.

## Adopted decision and remaining source work

AD-20 selects the authoritative implementation strategy for the Alpha planar
graph: a domain-owned constrained kernel for integer-mm ingress, 0°/45°
direction rules, exact T/X normalization, face/usable-polygon derivation,
lineage/inverse and application-facing stable reasons. It does **not** select
an external runtime library.

Before feature implementation, the remaining source-owned work is to publish
the canonical portable backup/legacy classification matrix, map missing
materialization-limit reasons, choose or explicitly defer a versioned
test-only oracle, and adopt the versioned golden/property/hostile corpus. A
new Architecture workflow is needed only if that adopted authority or its
cross-cutting boundary changes; ordinary policy and corpus work belongs to
the owning SPEC companions.

## Non-negotiable constraints

- Canonical endpoint coordinates are integer millimetres; a 45° intersection
  that requires a fractional canonical Vertex is rejected rather than rounded.
- The kernel owns PlanGraph topology, Room/Opening lineage, `ChangeSet`
  inverse and application reason codes. A renderer or GIS helper cannot become
  a second source of truth.
- Every accepted command must have deterministic allocation intent; rejected,
  stale and cancelled candidates allocate no durable IDs and do not mutate the
  current Revision.
- The existing V1/V2 cardinal/rectangular implementation is characterization
  material only. It must not be silently reinterpreted, discarded or promoted.

## Candidate comparison

| Candidate | Fit | Principal conflict / cost | Preliminary disposition |
| --- | --- | --- | --- |
| Domain-owned constrained PlanGraph kernel using integer values and exact `BigInt` predicates/rational intersection preflight | Directly preserves integer-mm ingress, T/X policy, application lineage, stable reason codes and no-mutation allocation semantics | More implementation/corpus work; usable-polygon offset needs a separately specified exact representation | Recommended candidate for authoritative domain state, subject to Architecture adoption |
| JTS/JSTS-style topology engine with fixed precision | Mature concepts for noding, polygonization and precision handling | Fixed precision still rounds constructed coordinates; it does not own product lineage, allocation, revision/fence or reason-code semantics. JTS documents constructed intersections as potentially non-exact under its precision model. | Evaluate only as an optional test oracle/adapter, not an authoritative Project kernel unless corpus disproves the conflicts |
| `polygon-clipping`/Martinez boolean polygons | Useful for isolated polygon boolean experiments and test comparisons | Polygon input/output does not model PlanGraph wall splitting, T/X commands, host lineage or revision semantics; its own documentation exposes floating-point round-off guards | Reject as primary kernel; optional non-authoritative fixture oracle only |

Relevant technical references: [JTS PrecisionModel](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/geom/PrecisionModel.html),
[JTS Geometry precision notes](https://javadoc.io/static/org.locationtech.jts/jts-core/1.18.0/org/locationtech/jts/geom/Geometry.html),
and [polygon-clipping](https://github.com/mfogel/polygon-clipping).

## Remaining source-owner questions

1. Which exact versioned test-only oracle, if any, is used for differential
   fixtures without becoming a canonical authority?
2. How are half-mm usable offsets, miter/bevel and collapsed usable polygons
   represented without changing canonical wall centerlines?
3. Which of V1/V2 projects can migrate losslessly, which stay readable legacy,
   and which require explicit user recovery rather than reinterpretation?
4. Which stable canonical reason codes map from existing V1/V2 errors?
5. If an oracle is approved, what test-only boundary prevents it from changing
   canonical state or allocating IDs?

## Required evidence after adoption

- A versioned corpus for raw ingress, 0°/45°, C1–C4 projection, T/X contacts,
  faces/holes, usable polygons, metrics, lineage/inverse, Openings and
  no-mutation outcomes.
- Property chains and hostile fixtures run against the selected runtime.
- An independently attributed review of the corpus and implementation.
- Browser vectors using the same corpus, followed by real touch/device proof
  through the separate S-4/NFR-15 routes.
