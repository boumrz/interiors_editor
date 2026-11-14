---
title: Readiness Evidence Program Waiver
date: 2026-08-09
status: active
authorizing_role: Product Owner
authorizing_person: Roman
---

# Readiness Evidence Program Waiver

## Authorisation

The Product Owner wrote: “В таком случае, сделай всё, что нужно до статуса
READY”. This is written authority to perform the internal implementation and
evidence-preparation work required to make a future independent readiness
assessment possible.

## Scope

This waiver permits work in the repository that is directly traceable to an
approved Alpha requirement and is necessary to create reproducible internal
evidence for the readiness packages: topology/kernel, renderer/WebGL2,
local-first persistence/PWA/recovery, touch/accessibility, backup/limits,
catalog integration boundaries and the catalog control-plane contract.

It includes production-source changes, tests, fixtures, build evidence and
review-ready documentation. Each change remains subject to the project TDD,
traceability and one-owner-per-slice rules.

## Non-waived boundaries

- This waiver does not change the formal `NOT_READY` verdict or mark
  `G-READY` passed.
- It cannot create participant consent, observed UJ-1–UJ-6 results,
  independent human review, physical-device traces, Security/Operations
  decisions, provider evidence or a release certification.
- It does not issue an `AssetUsageGrant`, establish rights to a third-party
  asset, or allow an agent to sign for a Legal Rights Authority or Asset
  Steward.
- Every external-evidence artefact must identify its real accountable person,
  device, build and observation; browser emulation remains labelled synthetic
  regression evidence.
- It does not authorise a commit. Repository governance still requires an
  explicit commit request or approval.

## Operating rule

The readiness assessment remains a separate fresh BMAD workflow. It may be
run only after the required evidence corpus is present and independently
attributed; it must retain its actual verdict rather than treating this waiver
as proof.
