# Corrected read-only proposal: persisted acknowledgements and existing opaque Projects

This supersedes the route in `proposal-persisted-ack-opaque-ids.md`. My previous proposal incorrectly used `runtime.controller.create()`: the factory explicitly forbids it at `browser-registered-runtime.ts:269–295`. That route must not be used or bypassed. No implementation, new Native run, corpus change or whole restart has occurred.

## Executable producer route from the current source

The consumer factory can OPEN existing V1 Projects. A separate genuine public producer can create their records without that proxy:

1. Provision the synthetic native database through one genuine valid UUID registered import. Do not invoke `provisionForRegisteredImport` from an ordinary setup/probe path.
2. Use a separate `BrowserRegisteredStorageSession` and existing-only `BrowserRegisteredScopeStore` over actual IndexedDB/Web Locks. Construct the public `BrowserRegisteredProjectRepository` with native checksums, an ordinary valid owner identity, the public clock and an independent acknowledgement port.
3. Run the production `CreateProjectUseCase` with a trusted IdPort sequence `[levelId, opaqueProjectId, revisionId]`, canonical serializer and that real repository. This calls the public `repository.publish()`; it does not fabricate IDB rows, `ScopedProjectAccess` or transactions. The already qualified browser harness contains this production call chain at `browser-registered-project-harness.ts:791–816`.
4. Require actual Durable publication, exact `repository.loadProject()` and directory results, then close/drain this producer. Consumers use only the factory's permitted `controller.openProject()`, writer access, rename and explicit takeover APIs.

Source reachability is concrete: `IdPort.next():string` (`ports.ts:14`); V1 ID grammar is nonempty and at most256 UTF-16 units (`project-json-transfer.ts:563`); `ScopedProjectRepository.readable()` validates that V1 grammar/canonical serialization/checksum without UUID restriction (`scoped-project-repository.ts:2073–2091`). Registered import destination IDs remain UUIDv4-only. A future actual plain Native baseline is still required before claiming that this fixture is demonstrated.

## Minimal proposed successor: two additive Native cases

**1. Genuine plain persisted acknowledgement → current generation.** Keep the prior compatibility scenario: capture actual synthetic host state produced by exact plain Source482810b3… while A owns P, B owns Q and B has observed foreign P. Retain the complete actual native data/schema and B sessionStorage, raw producer/BODY/emission evidence and true closure. Existing plain55/28 evidence did not retain complete sessionStorage; a separately approved producer capture is needed. No expected key is calculated from the active encoder or copied by hand.

The current generation restores only those captured producer outputs through real browser storage, performs a real reload, and opens Q/P through the public factory. Past lease expiry, Q remains writable; P stays read-only, refuses Durable rename and leaves all native rows unchanged until explicit takeover. Require complete operation/context/browser drain. Reachable survivor hypotheses:385 (added encoding prefix),387 (extra encoding iteration),391 (removed padding). These are upgrade-loss hypotheses, not already observed detections.

**2. Public repository producer → current factory OPEN/fencing.** After valid provisioning, publish two pairs through the real producer above. Pair one contains two valid256-unit IDs:128 well-formed astral characters, differing in the last character. Pair two is `a\u1234` versus `\u0611\u0234`, distinct well-formed two-unit IDs. No record is created through the forbidden factory method.

In separate real consumer contexts, open P/Q and explicitly take over each from the closed producer. Both must become writable. B then observes A's foreign P and returns to its own Q; Q must remain writable. After real reload/clock expiry, only P requires explicit takeover; rejected writes preserve all native rows. This is a Project ownership oracle, not a literal-key assertion. Reachable hypotheses:382 rejects a valid256-unit existing Project;391 can make the two Unicode IDs collide when padding is removed. The Unicode case is independently meaningful even though391 overlaps the upgrade case.

All55CPU and28Native callbacks/assertions/order, production Source, fixed415 denominator, threshold80 and caller budgets stay unchanged. Proposed count would be55+30 in a separate candidate only after approval. The Native case limit stays10s, Page.evaluate observer limit stays2.5s and the controller budget stays120s; a plain baseline must fit them. No new detection or passing score is claimed. These hypotheses cover at most four distinct current survivors; seven additional genuine detections are needed for80, so this scope alone is not a threshold guarantee.

## Directory-deadline assessment: omit from the minimal successor

A genuine active deadline/retry scenario is reachable: start/provision a live runtime with `directoryTimeoutMs=200`, hold `interiors-browser-registered-v1` through an unrelated real native WebLock request, call `readDirectory`, and witness that its real request queues. The public result should become exactly `{kind:"unavailable"}` while the holder remains held and native data stays unchanged. Release/await the holder, retry to an available directory, then dispose and drain the actual pending work. Such a case can fit existing budgets without framework-timeout credit.

It does **not** target the cited surviving branches. The exact map shows344–346 are the deadline callback mutations and are already Killed.348–350 are the rejection callback of private `bounded()`. Every supported public directory flight first passes through `owned(inspect).catch(...)` at lines327–329, which resolves a typed result, including native storage failures; an ordinary held lock does not turn that promise into a rejection.119/120 belong to registered-import key lookup's unavailable result at line226 and are unrelated to directory expiry. No unsupported Promise tampering/private helper extraction is proposed to reach those callbacks, and their actual Survived statuses remain unchanged.

Therefore I recommend the two compatibility/fencing cases above and omit a new deadline case from this minimal scope, rather than crediting it with hypothetical survivor detections. No equivalence exclusions or status adjustments follow from this reachability assessment.
