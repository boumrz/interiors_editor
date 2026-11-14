---
title: Readiness Evidence Collection Kit
date: 2026-08-09
status: historical-templates-with-current-nfr15-override
---

# Readiness Evidence Collection Kit

## Truth boundary

This directory contains collection templates, not evidence and not a gate
result. A completed-looking template without a named accountable person,
real-world observation and attached raw material remains **missing evidence**.
No template itself changes a readiness verdict.

**Current NFR-15 override (2026-08-29).** The Alpha mobile acceptance scope is
owned by the PRD: Product Owner confirmation on iPhone 15 Pro Max and Samsung
S24 Ultra, in available browser and installed-PWA contexts, is sufficient.
The historic eight-row device-lab matrix, quantitative performance traces and
independent device reviewer are optional diagnostics, not Alpha blockers. See
the recorded [Product Owner mobile attestation](product-owner-mobile-attestation-2026-08-30.md).

## Required accountable roles

| Package | Required accountable people |
| --- | --- |
| UJ-1…UJ-6 | Research owner, independent observer, consented independent participant |
| Device trace | Product Owner under current PRD NFR-15; device-lab owner and independent reviewer remain optional diagnostics |
| Technical catalog resource | Catalog/content owner and independent reviewer |
| Internal package review | Evidence owner and reviewer independent of that owner |
| Control plane | Backend, Security and Operations owners plus independent reviewer |

An agent, browser emulation, screenshot or a synthetic fixture cannot replace
the real-world evidence required by a given current gate. Product Owner mobile
acceptance is the explicit NFR-15 exception above; it does not replace a
participant study, independent technical review, topology corpus, legal grant
or catalog-resource evidence.

## Templates

- [participant-session-record.md](participant-session-record.md) records an
  observed UJ-1…UJ-6 session without committing participant PII or Project
  content.
- [uj-research-protocol.md](uj-research-protocol.md) supplies the required
  consent/recruitment/session/synthesis template; it remains unusable until
  real research, observer and privacy authorities approve it externally.
- [physical-device-trace.md](physical-device-trace.md) records one of the
  mandatory physical device/context rows.
- [nfr-15-device-lab-runbook.md](nfr-15-device-lab-runbook.md) supplies the
  eight-row collection sequence and threshold calculation protocol; it is not
  physical evidence.
- Техническая пригодность catalog asset доказывается versioned manifest,
  format/size/hash, exact pin, backup feasibility и независимым review. Legal
  grant/provenance/notice dossier не является Alpha evidence.
- [independent-review-record.md](independent-review-record.md) records a
  review after the reviewable corpus exists.
- [evidence-request-register.md](evidence-request-register.md) keeps every
  external proof obligation at `awaiting-assignment` until a real owner accepts
  it.

## Evidence hygiene

1. Store personal data, consent forms, raw recordings and user Project content
   outside this repository in the approved restricted system.
2. Put only consent reference, pseudonymous session ID, immutable build/schema
   IDs, hashes and redacted findings here.
3. Attach raw artifacts by immutable location and SHA-256; do not paste an
   assertion in place of a trace.
4. Missing, unverified or redacted-beyond-reproducibility fields mean
   `PAUSED`, never `PASS`.
