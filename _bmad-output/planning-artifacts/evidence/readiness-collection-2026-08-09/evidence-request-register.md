---
title: External Readiness Evidence Request Register
date: 2026-08-09
status: current-reconciled-2026-08-30
---

# External Readiness Evidence Request Register

## Rule

An unassigned external-evidence row starts `awaiting-assignment`. It becomes
`in-collection` only after a named accountable person accepts it, and it
becomes reviewable only when the linked evidence exists. No row is a PASS
because this register exists. Rows already closed by a current source-owner
decision remain linked to that decision rather than being reset to their
historical spike state.

## Decision ownership

Roman Zheltov is the accountable Product/Architecture decision owner, assigned
by the Product Owner on 2026-08-09. This does not make him an independent
reviewer, an observed participant or a device-lab operator unless a real
appointment establishes that separate role.

| Gate / package | Required accountable roles | Minimum deliverable | Status | Assignment / immutable evidence reference |
| --- | --- | --- | --- | --- |
| G-1 UJ-1…UJ-6 | Research owner, independent observer, consented independent participants | Approved protocol; observed sessions; redacted synthesis | awaiting-assignment | Protocol template: `uj-research-protocol.md`; accountable assignment/evidence: `TBD` |
| G-S2 topology review | Geometry evidence owner, independent reviewer | Selected kernel corpus replay and independent review | awaiting-assignment | `TBD` |
| G-S1 renderer | Renderer owner | current renderer decision, lifecycle/cutaway regressions, current NFR-15 mobile acceptance | **PASS** | `evidence/current-product-gates-2026-08-30.md` |
| G-V01-S3 storage/PWA | Persistence/PWA owner | durable/fence/recovery corpus plus current NFR-15 lifecycle/handoff acceptance | **PASS** | `evidence/current-product-gates-2026-08-30.md` |
| G-S4 touch/a11y | Mobile interaction owner | gesture/numeric/44×44/error-taxonomy regressions plus current NFR-15 mobile acceptance | **PASS** | `evidence/current-product-gates-2026-08-30.md` |
| G-S6 catalog | Catalog/content owner, independent reviewer, device-lab owner | versioned technical manifest; format/size/hash/pin/backup/device corpus | awaiting-assignment | `TBD` |
| G-CP-ADR | Backend, Security, Operations owners, independent reviewer | adopted bounded ADR, build/API/restore/negative-boundary evidence | awaiting-assignment | `TBD` |
| NFR-15 Alpha | Product Owner | iPhone 15 Pro Max + Samsung S24 Ultra in available browser and installed-PWA contexts | **PASS** | `readiness-collection-2026-08-09/product-owner-mobile-attestation-2026-08-30.md` |
| Later performance diagnostics | Device-lab owner, independent reviewer | quantitative physical device/context traces | optional | `TBD` |

## Assignment checklist

Before assigning a row, record the person’s real authority, scope, conflict of
interest and secure evidence system. Before replacing `TBD`, confirm that the
link permits the required reviewer to inspect the immutable raw material while
keeping participant PII and Project content outside this repository.
