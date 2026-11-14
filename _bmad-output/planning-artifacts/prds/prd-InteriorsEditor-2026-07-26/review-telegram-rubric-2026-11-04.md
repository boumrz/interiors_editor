# PRD Quality Review — InteriorsEditor Telegram update

Review snapshot: 2026-11-04, before disposition of the findings below. This is an independent PRD quality review, not implementation readiness or physical evidence.

## Overall verdict

The additive platform direction, offline distinction, data isolation, explicit portable transfer and deferred retirement are concrete enough to carry into the owning UX and architecture workflows. Two inherited, now cross-platform requirements need applicability clarification before finalization: the unconditional account-free creation in FR-1 conflicts with scoped Telegram identity, and FR-47 unconditionally names a worker despite the new no-worker Telegram path. The grant-policy conflict and the conditional transport decision are surfaced without fabricating a resolution.

## Decision-readiness — adequate

FR-58 retains Web/PWA through S0–S7 and states a separate retirement gate. Section 10 identifies the licensing source conflict and confines a possible product decision on server transfer to the situation where local file handoff fails; it does not presume consent. FR-57 honestly makes external file evidence a condition for Telegram acceptance.

### Findings

- **[high]** Creation identity contradiction (§5.1 FR-1, §5.11 FR-56) — FR-1 says a new Project requires no account after loading the shell, whereas FR-56 says missing necessary identity cannot open a shared writable fallback. A reader could waive scope selection for Telegram or wrongly impose Telegram identity on Web/PWA. *Fix:* make FR-1's account-free condition expressly browser/PWA and point Telegram to FR-56, preserving offline editing after preparation.

## Substance over theater — strong

The FRs tie precision, durable publication, no silent deletion and actual external backup to concrete user risks. NFR-28 names physical clients and scenarios rather than presenting a bridge fake as platform evidence; the data-owned Product Owner decision is explicit.

## Strategic coherence — adequate

The phone-first planning thesis, local ownership and counter-metrics still organize the core editor, while UJ-7 and FR-55–58 add a second surface without silently retiring the first. The conditional server-transfer decision preserves the privacy thesis. UJ-7's statement that the file was saved «вне Web/PWA» is imprecise about whether the source was the Web/PWA product or external storage.

### Findings

- **[low]** Source of the transferred file (§3 UJ-7) — «ранее сохранённый вне Web/PWA» can read as a file created outside the product, rather than a Web/PWA export saved externally. *Fix:* say explicitly that the supported Web/PWA backup was saved as an external file.

## Done-ness clarity — adequate

FR-55 sets state-sensitive Back/Close behavior and avoids false saved status; FR-56 includes A→B→A and stale work; FR-57 defines both directions, identity, hashes, cancellation, and external file evidence. NFR-28 separates Telegram device acceptance from historical NFR-15.

### Findings

- **[high]** Worker compatibility contradiction (§5.8 FR-47, §5.11 FR-58) — FR-47 requires every startup to check «shell/worker/Project/catalog schema», but FR-58 permits Telegram without a worker. The text does not state how to satisfy both without inventing a worker or bypassing the release handshake. *Fix:* explicitly limit the worker component of FR-47 to PWA and require equivalent shell/Project/catalog compatibility for Telegram with no worker, preserving the PWA update contract.
- **[medium]** Unsupported host recovery path incomplete (§5.11 FR-55) — retry/exit or an available fallback is named, but an out-of-host visitor is not specifically offered a route into Telegram and a link to the existing Web/PWA as required by the change input. *Fix:* specify both available links and keep invalid-host and SDK-failure paths non-writing.

## Scope honesty — adequate

The Alpha+ distinction, retired FR/NFR IDs, no automatic sync and absence of hidden upload are explicitly maintained. Source conflict and future owner choice are not expressed as new licensing policy or a blanket blocker. The frontend release/transport mechanisms are principally located in the addendum.

### Findings

- **[medium, inherited]** Stale historical Alpha statements (§10 “Resolved in this update”; addendum “Catalog Acceptance”) — the procedural-only catalog and retired ceiling/lighting language coexist with representative catalog/lighting elsewhere. The Telegram update should not silently decide catalog policy, but downstream readers need dates and current applicability distinguished. *Fix:* identify historical statements as historical and route the content-policy question to the appropriate owner without changing it in this update.

## Downstream usability — adequate

FR-55–58 and NFR-28 are distinct stable IDs; the platform matrix distinguishes the PWA cold offline obligation and Telegram's online cold launch, and highlights evidence separation. The addendum names the owner handoffs and preserves the ReleaseManifest delivery details for architecture.

### Findings

- **[low]** Requirement order and UJ order (§3, §6) — UJ-7 appears before UJ-5/6 and NFR-28 appears between NFR-15 and NFR-16. *Fix:* move each new item to the natural numeric position without changing IDs or semantics.
- **[low, inherited]** Assumption roundtrip (§0, §11) — the introduction says unconfirmed decisions are marked as assumptions, but A-2–A-8 are indexed without inline assumption tags. *Fix:* align the index or wording when the broader PRD is next polished; do not relabel owner decisions as assumptions.

## Shape fit — adequate

Named journeys fit this phone-first consumer product, and explicit consequences and separate usability/failure requirements support UX, architecture and story extraction. The additional platform matrix makes the brownfield scope clear. Existing detail is long but serves the required downstream handoff; avoid rewriting unrelated canonical requirements during this focused update.

## Mechanical notes

- FR-53 and NFR-27 are explicitly retired and must not be reused. FR-55–58 and NFR-28 appear once as definitions in the review snapshot.
- Newly added scope references current UX contracts without direct links; direct paths in the handoff would ease verification.
- Existing glossary and addendum contain historical terminology such as ItemInstance and Door transition; these are inherited, not a new Telegram decision.
- This review does not change, approve, or reconcile SPEC, Architecture, UX or licensing policy.
