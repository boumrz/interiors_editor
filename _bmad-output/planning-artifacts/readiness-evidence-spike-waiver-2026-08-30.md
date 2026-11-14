---
title: Readiness Evidence Spike Waiver
status: active-for-bounded-evidence-only
date: 2026-08-30
authorizer: Roman Zheltov, Product Owner
source: current Codex conversation
reviewer: Roman Zheltov
---

# Readiness Evidence Spike Waiver

## Authorisation

The Product Owner instructed Codex on 2026-08-30 to complete the formal path to
`READY`, confirmed all physical/mobile evidence, and appointed himself for the
review. This record authorises exactly one disposable evidence package: the
TCC-A1 topology corpus required for `G-S2-topology`.

## Permitted scope

- `_bmad-output/implementation-artifacts/spikes/W-READY-2026-08-30/S-2/**`
  may contain a detached corpus manifest, fixtures, test runner and its reports;
- `_bmad-output/planning-artifacts/evidence/spikes/S-2/current-product/**`
  may contain hashes, executed-fixture results and the Product Owner review
  record;
- the detached runner may read the existing `apps/web/src/domain/**` kernel,
  but it may not change it.

## Non-negotiable limits

This waiver does **not** permit changes to `apps/**`, production manifests,
lockfiles, build configuration, runtime assets, `V-*` stories, feature code,
commits or promotion/reuse of spike code. It creates no Product, Revision,
catalog asset, network call or user-visible feature. A `PASS` is possible only
if the resulting corpus satisfies the source-owned TCC-A1 contract and Roman
Zheltov records the independent review outcome after inspecting the immutable
manifest and results.
