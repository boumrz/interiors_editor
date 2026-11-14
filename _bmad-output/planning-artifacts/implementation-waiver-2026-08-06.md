---
title: Product Owner Implementation Waiver
date: 2026-08-06
status: active
authorizing_role: Product Owner
authorizing_person: Roman
---

# Product Owner Implementation Waiver

## Authorisation

The Product Owner wrote: “Я всё одобряю как владелец продукта, поэтому
доделывай все, что требуется и продолжай разработку и работу”. This is an
explicit written authorisation to continue implementation while the latest
BMAD implementation-readiness verdict remains `NOT_READY`.

## Scope

It permits implementation of the approved Alpha editor scope, including the
accepted infinite presentation canvas, bounded rectangular Room draft,
reversible Wall/Item deletion and camera-relative 3D cutaway. It also permits
the initial code-authored procedural greybox set (table, chair, bed, door,
walls, floor, window, bedside table, dresser and wardrobe), together with
their unit, browser and Playwright regression tests and running-build
screenshots. These placeholders are not third-party catalog resources.

## Non-waived boundaries

- This waiver does not change the `NOT_READY` verdict or mark `G-READY` passed.
- It does not create legal authority for AssetUsageGrant, real participant
  evidence, physical-device NFR-15 evidence, Security/Operations decisions or
  a release/production-certification claim.
- Deferred research after feature-complete internal Alpha remains a reason not
  to call the project formally `READY` or publicly production-ready.
- It does not authorise a commit; repository governance still requires an
  explicit commit request or approval.
- The project must continue to label browser screenshots/emulation as such.

## Operating rule

Each implementation slice remains TDD-first, includes the required Rstest and
Playwright evidence, and is reviewed against the canonical invariants. The
formal readiness workflow must be re-run when genuine external evidence is
available.
