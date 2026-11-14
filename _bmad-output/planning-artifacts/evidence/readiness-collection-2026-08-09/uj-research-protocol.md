---
title: UJ-1 to UJ-6 Observed Research Protocol
date: 2026-08-09
status: template-only
requires: research-owner-independent-observer-consent-approval
---

# UJ-1…UJ-6 Observed Research Protocol

## Status and boundary

This is a collection protocol template, not an approved consent form, a
recruitment decision, a participant record or a research result. It does not
change the current `NOT_READY` verdict. Before any session, a real Research
Owner and independent Observer must accept the protocol in the approved
restricted research system; a Legal/Privacy authority must approve the
consent, retention and deletion materials there.

The repository may contain only pseudonymous identifiers, redacted findings,
immutable build/fixture hashes and references to restricted raw material.
Names, contact details, consent text/signatures, recordings, real plans,
screenshots, filenames, asset bytes and unredacted telemetry stay outside it.

## Purpose

Establish whether independent participants can complete the Alpha journeys
without developer intervention, and gather evidence for or against H-1…H-6
and the UJ/SM measures in the PRD. The protocol is deliberately blocked until
the product implements the required journey capability; inability to expose a
task is a finding, not a reason to substitute a walkthrough.

## Required accountability and approval

| Role | Required real person / authority | Reference |
| --- | --- | --- |
| Product/Architecture decision owner | Roman Zheltov | Product Owner assignment, 2026-08-09 |
| Research Owner | `TBD` | `TBD` |
| Independent Observer | `TBD` | `TBD` |
| Consent / privacy approver | `TBD` | `TBD` |
| Recruitment owner | `TBD` | `TBD` |
| Participant | Pseudonym only in repository | Restricted consent reference `TBD` |

The Observer must be independent of the Research Owner and implementation
author. Roman’s product/architecture accountability does not make him the
Observer, participant, device-lab operator or consent approver without an
actual separate appointment.

## Recruitment and consent gates

Before recruitment, record an approved screener and consent process in the
restricted system. At minimum, it must establish:

1. the participant is independent of the implementation/review chain;
2. the intended user context and enough relevant planning/interior task
   experience to make the session meaningful;
3. voluntary, revocable consent for the exact observation/recording method;
4. how compensation, withdrawal, retention, deletion, redaction and access
   requests are handled; and
5. that no real plan, address, resource file or sensitive household
   information must be entered into the product.

No participant count is asserted by this template. The approved research plan
must set the sample, recruitment source, inclusion/exclusion criteria,
compensation and stopping rule before collection begins.

## Session preconditions

| Check | Required value |
| --- | --- |
| Build / schema / fixture hashes | `TBD` |
| Physical phone and browser/PWA context | `TBD` |
| Network / offline condition | `TBD` |
| Moderator, Observer and participant pseudonym | `TBD` |
| Consent reference and expiry | `TBD` |
| Recording location and immutable SHA-256 | `TBD` |
| Accessibility needs and approved accommodations | `TBD` |

The moderator follows the script verbatim. They may provide only the approved
safety/recovery script. Every prompt, hint, retry, intervention, abandonment
and technical fault is recorded as an observed event.

## Task cards

Run only task cards whose product capability is actually implemented. A task
that cannot be offered is recorded `not available` and keeps its gate open.

| Journey | Participant task | Required observation |
| --- | --- | --- |
| UJ-1 | Create a numeric bedroom, Door/Window and bed; observe collision/clearance; use 3D to make a decision; confirm durable local save. | Unaided completion, time, accidental gestures, recovery, confidence and a concrete 3D decision/problem. |
| UJ-2 | Create 0°/45° off-grid geometry with valid T/X contacts; inspect derived Rooms and Door/Walk adjacency; attempt invalid geometry. | Numeric/gesture path, rejection comprehension, no silent topology mutation, time and confidence. |
| UJ-3 | Furnish a representative catalog scene and compare permitted variant B. | Catalog comprehension, variant decision and completion outcome. |
| UJ-4 | In an installed PWA, edit in airplane mode; force close/reopen; observe a safe update path. | Offline/durable recovery, update messaging and intervention count. |
| UJ-5 | Configure a Parametric Placeholder with dimensions, colour and AnchorClass; attempt invalid placement/limits. | Input comprehension, safe rejection and recovery. Static GLB is not an Alpha task. |
| UJ-6 | Export, remove local copy, import a self-contained backup and observe a recoverable migration failure. | Semantic round-trip, backup boundary understanding and recovery outcome. |

## Measures and scoring

For each attempted task, the Observer records the fields in
`participant-session-record.md` plus the following controlled measures:

| Measure | Recording rule |
| --- | --- |
| Unaided completion | `complete` / `complete-with-approved-recovery` / `abandoned` / `not available`; record every intervention. |
| Time | Monotonic start/end timestamps and elapsed duration; exclude only a predeclared technical outage with both timestamps. |
| Accidental gesture / undo | Count each observed unintended action and whether recovery succeeded. |
| Durable recovery | Record forced-close/offline/update result separately from task completion. |
| Quality-tier result | Record the exact task-specific pass/fail criterion and evidence reference. |
| Confidence | Participant self-report 1–5 after each completed/abandoned task; do not infer it. |
| Decision/problem | Verbatim redacted statement plus observer classification; do not infer a decision from click history. |

The approved plan must map these records to SM-1…SM-6 thresholds without
retroactively changing a threshold after observing results.

## Session flow and safeguards

1. Confirm consent and pseudonym; disclose recording/withdrawal route.
2. Confirm the controlled fixture contains no personal Project content.
3. Run the task cards in the approved counterbalanced order.
4. If the product fails, record the visible state and use only the approved
   recovery script; do not repair the participant’s plan on their behalf.
5. Stop immediately on withdrawal, distress, safety issue or the predeclared
   technical-stop condition; preserve the reason without personal detail.
6. Conduct the approved debrief, confidence questions and deletion reminder.
7. Store raw material in the restricted system, calculate required hashes and
   complete one redacted session record.

## Synthesis and integrity

The Research Owner produces a redacted synthesis that separates observations,
participant quotations, inferred themes, unsupported hypotheses and proposed
changes. The independent Observer reviews the synthesis against immutable raw
references. Missing consent, incomplete raw linkage, unauthorised moderator
intervention or a non-independent participant makes that session unusable for
gate evidence and is recorded `PAUSED`, not silently excluded.
