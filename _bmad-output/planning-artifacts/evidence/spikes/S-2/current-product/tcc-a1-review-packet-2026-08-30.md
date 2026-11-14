---
title: "TCC-A1 current-product review packet"
date: 2026-08-30
status: assigned
reviewer: "Roman Zheltov"
gate: G-S2-topology
evidenceStatus: PASS
---

# Review packet — G-S2 topology

## Decision requested

Reviewer: **Roman Zheltov**.

Review the narrow production TCC-A1 execution change and record one outcome:

- `APPROVE` — immutable fixture identity and current domain/active Alpha §4
  outcomes are adequate for G-S2;
- `REQUEST_CHANGES` — cite fixture IDs or a missing family/outcome; or
- `REJECT` — the result breaches a topology, durability or ingress boundary.

The executable and mutation evidence status is **PASS**. This packet remains
assigned until Roman records the independent human disposition.

## Reviewable files

- `apps/web/src/domain/tcc-a1-corpus-runner.ts`
- `apps/web/src/domain/current-product-tcc-a1-corpus.ts`
- `apps/web/src/domain/current-ppj-a1-legacy-classifier.ts`
- `apps/web/src/domain/tcc-a1-corpus-runner.test.ts`
- `apps/web/src/domain/current-product-tcc-a1-corpus.test.ts`
- `apps/web/src/domain/current-ppj-a1-legacy-classifier.test.ts`
- `tcc-a1-execution-2026-08-30.md`

## Required checks

1. A domain manifest cannot execute `legacy-classification`; a legacy manifest
   cannot execute a topology accepted/reject/transient outcome.
2. SHA verification occurs before any executor dispatch.
3. Every no-effect path proves base digest equality and zero allocation intent.
4. Every accepted path declares and compares allocation labels, opaque refs,
   post digest and inverse-to-base digest.
5. The legacy adapter uses the production `parsePpjA1JsonBytes` parser and
   exact current PPJ-A1 closed selector—not a V1/V2 fixture switch or
   historical decoder. Its current/V1-like/V2-like/future fixtures are
   individually SHA-bound.
6. `legacy-unreadable` preserves source bytes and has no migration, pin,
   allocation, Project publication, Revision or RecoveryChangeSet port;
   Portable Backup keeps its earlier `BACKUP_*` reason precedence.
7. All six current-kernel families and the active Alpha legacy-and-ingress
   closure are represented by actual production calls.

## Reproduction

Run the commands recorded in `tcc-a1-execution-2026-08-30.md`. Expected
results are 88/88 focused topology tests, 60/60 Portable Backup precedence
tests and 1,700/1,700 full web tests; typecheck and lint are also green.
The narrow Stryker result is 286 killed / 20 survived / 93.46%, above its 90%
high threshold with no timeout, no-coverage, runtime or compile error.

## Boundary of this review

This review is only G-S2 topology evidence. It does not approve catalog
resources, renderer/device evidence, release deployment, legal claims beyond
the separate asset grant, or a source-code commit.
